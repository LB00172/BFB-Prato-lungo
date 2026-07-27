const { useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;

// ---------- Utility ----------

// Formatta una Date in 'YYYY-MM-DD' usando l'ora LOCALE (niente UTC),
// evitando lo sfasamento di un giorno dei fusi orari.
const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Interpreta 'YYYY-MM-DD' come data locale (non UTC).
const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Lettura sicura da localStorage: se i dati sono corrotti non fa crashare l'app.
const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn('Dati corrotti in', key, '- uso i valori di default.', e);
    return fallback;
  }
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const money = (n) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
// Numero >= 0 a partire da una stringa di input.
const posNum = (v) => Math.max(0, parseFloat(v) || 0);

const initialDayState = () => ({ note: '', guestsNames: '', meals: {} });

// Branding e funzionalità: letti da window.APP_CONFIG (firebase-config.js),
// con fallback ai valori attuali se la configurazione non è presente.
const CFG = (typeof window !== 'undefined' && window.APP_CONFIG) || {};
const BRAND = {
  appTitle: 'PRATO LUNGO 2026',
  groupName: 'Brigata Fabio Bandone',
  splashLine1: 'BRIGATA',
  splashLine2: 'FABIO BANDONE',
  splashTagline: 'Prato Lungo Forever',
  footerMotto: 'In BANDY we Trust',
  credits: 'Web app prodotta da Lorenzo Ballerini · Tutti i diritti riservati © 2026',
  ...(CFG.brand || {}),
};
const FEATURES = { auth: false, rooms: false, equipExemption: false, ...(CFG.features || {}) };

// Periodo del campo. Durante il campo l'app si apre sul giorno corrente.
const CAMP_START = '2026-08-11';
const CAMP_END = '2026-08-16';
const defaultDateStr = () => {
  const today = toDateStr(new Date());
  return today >= CAMP_START && today <= CAMP_END ? today : CAMP_START;
};

// Tipologie di acquisto e a quale voce di spesa contribuiscono.
const PURCHASE_TYPES = { alimentare: 'Alimentare', bevande: 'Bevande', logistica: 'Logistica' };

// Codici meteo WMO (Open-Meteo) -> icona e descrizione.
const wmoInfo = (code) => {
  if (code === 0) return { icon: '☀️', label: 'Sereno' };
  if (code === 1 || code === 2) return { icon: '🌤️', label: 'Poco nuvoloso' };
  if (code === 3) return { icon: '☁️', label: 'Coperto' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: 'Nebbia' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: 'Pioviggine' };
  if (code >= 61 && code <= 67) return { icon: '🌧️', label: 'Pioggia' };
  if (code >= 71 && code <= 77) return { icon: '🌨️', label: 'Neve' };
  if (code >= 80 && code <= 82) return { icon: '🌦️', label: 'Rovesci' };
  if (code === 85 || code === 86) return { icon: '🌨️', label: 'Rovesci di neve' };
  if (code >= 95) return { icon: '⛈️', label: 'Temporale' };
  return { icon: '🌡️', label: 'Meteo' };
};

// Dotazione personale base: uguale per tutti, non modificabile dall'app.
// Le voci con emphasis: true sono mostrate in evidenza (piu' grandi e sottolineate).
const BASE_GEAR = [
  { text: 'SEDIA PERSONALE PER ADULTI E EVENTUALI BAMBINI', emphasis: true },
  { text: 'Stoviglie, posate personali e bicchiere riutilizzabile', emphasis: true },
  { text: 'Borraccia' },
  { text: 'Canovacci' },
  { text: 'Luci LED' },
];

// Comprime una foto (scontrino) ridimensionandola e convertendola in JPEG,
// così da poterla salvare in localStorage senza esaurire lo spazio.
const compressImage = (file, maxDim = 1200, quality = 0.6) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ============================================================================
//  MINI GIOCO "Aiuta Bandy" — snake in canvas, tutto offline.
//  La canna cresce ogni volta che raccoglie Bandy. Sfondo: bosco visto
//  dall'alto, generato a pixel (nessuna immagine da scaricare).
// ============================================================================
const GAME_COLS = 15;
const BASE_STEP = 170;   // millisecondi per passo al livello 1
const BASE_LEN = 3;      // lunghezza di partenza a ogni livello
const LEVEL_EVERY = 15;  // Bandy necessari per salire di livello
const MIN_STEP = 45;     // limite di velocità: sotto diventa ingiocabile
const GAME_ROWS = 19;

// Rumore deterministico: lo sfondo è sempre lo stesso ad ogni partita.
const seeded = (n) => { let s = n * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };

function drawForest(ctx, w, h, cell) {
  const rnd = seeded(7);
  ctx.fillStyle = '#24371F';
  ctx.fillRect(0, 0, w, h);
  // sottobosco a chiazze
  const px = Math.max(3, Math.round(cell / 5));
  for (let y = 0; y < h; y += px) {
    for (let x = 0; x < w; x += px) {
      const r = rnd();
      if (r > 0.86) { ctx.fillStyle = '#2E4527'; ctx.fillRect(x, y, px, px); }
      else if (r > 0.8) { ctx.fillStyle = '#1D2C19'; ctx.fillRect(x, y, px, px); }
    }
  }
  // chiome degli alberi viste dall'alto
  const canopies = 16;
  for (let i = 0; i < canopies; i++) {
    const cx = rnd() * w, cy = rnd() * h, rad = cell * (0.7 + rnd() * 0.9);
    const tone = ['#3E6B33', '#356029', '#477A38'][Math.floor(rnd() * 3)];
    for (let y = cy - rad; y < cy + rad; y += px) {
      for (let x = cx - rad; x < cx + rad; x += px) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > rad * rad) continue;
        ctx.fillStyle = (dx + dy) % (px * 4) === 0 ? '#2B4C22' : tone;
        ctx.fillRect(Math.round(x / px) * px, Math.round(y / px) * px, px, px);
      }
    }
    // tronco
    ctx.fillStyle = '#4A3526';
    ctx.fillRect(Math.round(cx / px) * px, Math.round(cy / px) * px, px, px);
  }
}

// Livello 2: strada vista dall'alto. Due corsie, rotaie del tram al centro,
// e ai bordi si intravedono i portoni dei palazzi.
function drawStreet(ctx, w, h, cell) {
  const rnd = seeded(23);
  const px = Math.max(3, Math.round(cell / 5));
  const edge = cell * 1.1;               // fascia dei palazzi a destra e sinistra

  // asfalto
  ctx.fillStyle = '#3A3A3E';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += px) {
    for (let x = edge; x < w - edge; x += px) {
      const r = rnd();
      if (r > 0.9) { ctx.fillStyle = '#43434A'; ctx.fillRect(x, y, px, px); }
      else if (r > 0.82) { ctx.fillStyle = '#333338'; ctx.fillRect(x, y, px, px); }
    }
  }

  // marciapiedi + palazzi ai due bordi, con portoni appena visibili
  [0, w - edge].forEach((bx, side) => {
    ctx.fillStyle = '#6E6A63';
    ctx.fillRect(bx, 0, edge, h);
    ctx.fillStyle = '#5C5851';
    for (let y = 0; y < h; y += px * 3) ctx.fillRect(bx, y, edge, px);   // lastre
    // portoni: rettangoli scuri con architrave chiara
    for (let y = cell * 1.2; y < h - cell; y += cell * 3.4) {
      const dw = edge * 0.62, dh = cell * 1.5;
      const dx = side === 0 ? bx + edge - dw : bx;
      ctx.fillStyle = '#4A3526';
      ctx.fillRect(dx, y, dw, dh);
      ctx.fillStyle = '#2E2119';
      ctx.fillRect(dx + px, y + px, dw - px * 2, dh - px * 2);
      ctx.fillStyle = '#8A8078';
      ctx.fillRect(dx, y - px, dw, px);
      ctx.fillStyle = '#C9A227';                    // maniglia
      ctx.fillRect(side === 0 ? dx + px : dx + dw - px * 2, y + dh / 2, px, px);
    }
  });

  // strisce di mezzeria tratteggiate delle due corsie
  ctx.fillStyle = '#D8D3C4';
  [w * 0.3, w * 0.7].forEach((lx) => {
    for (let y = 0; y < h; y += cell * 1.6) ctx.fillRect(lx - px / 2, y, px, cell * 0.8);
  });

  // rotaie del tram al centro
  const cx = w / 2, gauge = cell * 0.9;
  ctx.fillStyle = '#4E4A46';
  ctx.fillRect(cx - gauge / 2 - px, 0, gauge + px * 2, h);   // massicciata
  ctx.fillStyle = '#6B4A32';
  for (let y = 0; y < h; y += cell * 0.9) ctx.fillRect(cx - gauge / 2 - px, y, gauge + px * 2, px); // traversine
  [cx - gauge / 2, cx + gauge / 2].forEach((rx) => {
    ctx.fillStyle = '#B9BCC2';
    ctx.fillRect(rx - px / 2, 0, px, h);
    ctx.fillStyle = '#8E9298';
    ctx.fillRect(rx + px / 2, 0, Math.max(1, px / 2), h);
  });
}

// Figura stilizzata (top + gonna) disegnata a blocchi: la fila che segue Bandy.
const FIG_TOPS = ['#D94F6A', '#E0803A', '#7B5BD6', '#3FA7A0', '#D64C9B'];
const FIG_SKIRTS = ['#2B3A6B', '#7A2540', '#243B2A', '#4A2B6B', '#6B4A20'];
const FIG_HAIR = ['#2B1B12', '#5C3A1E', '#8A6234', '#1F1B1A'];
function drawFigure(ctx, x, y, cell, i, leader) {
  const u = cell / 10;                      // unità di disegno
  const top = leader ? '#F0C674' : FIG_TOPS[i % FIG_TOPS.length];
  const skirt = leader ? '#8A5A1E' : FIG_SKIRTS[i % FIG_SKIRTS.length];
  const hair = FIG_HAIR[i % FIG_HAIR.length];
  const skin = '#E9B48E';
  // gambe
  ctx.fillStyle = skin;
  ctx.fillRect(x + u * 3.5, y + u * 7.5, u * 1.2, u * 2.2);
  ctx.fillRect(x + u * 5.3, y + u * 7.5, u * 1.2, u * 2.2);
  // gonna (trapezio a blocchi)
  ctx.fillStyle = skirt;
  ctx.fillRect(x + u * 2.6, y + u * 6.4, u * 4.8, u * 1.3);
  ctx.fillRect(x + u * 3.0, y + u * 5.4, u * 4.0, u * 1.1);
  // top e braccia (spalle marcate)
  ctx.fillStyle = top;
  ctx.fillRect(x + u * 3.0, y + u * 3.4, u * 4.0, u * 2.1);
  ctx.fillStyle = skin;
  ctx.fillRect(x + u * 2.1, y + u * 3.6, u * 0.9, u * 2.4);
  ctx.fillRect(x + u * 7.0, y + u * 3.6, u * 0.9, u * 2.4);
  // testa e capelli
  ctx.fillStyle = skin;
  ctx.fillRect(x + u * 3.7, y + u * 1.2, u * 2.6, u * 2.4);
  ctx.fillStyle = hair;
  ctx.fillRect(x + u * 3.4, y + u * 0.7, u * 3.2, u * 1.1);
  ctx.fillRect(x + u * 3.1, y + u * 1.3, u * 0.7, u * 1.8);
  ctx.fillRect(x + u * 6.2, y + u * 1.3, u * 0.7, u * 1.8);
}

function BandyGame({ playerName, onExit, onGameOver, bestLocal }) {
  const canvasRef = useRef(null);
  const bgRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(1);
  const [levelUp, setLevelUp] = useState(false);
  useEffect(() => {
    if (level < 2) return;
    setLevelUp(true);
    const t = setTimeout(() => setLevelUp(false), 1800);
    return () => clearTimeout(t);
  }, [level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cell = Math.floor(Math.min(canvas.width / GAME_COLS, canvas.height / GAME_ROWS));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // sfondo disegnato una volta e riusato
    const mkBg = (fn) => {
      const c = document.createElement('canvas');
      c.width = canvas.width; c.height = canvas.height;
      fn(c.getContext('2d'), canvas.width, canvas.height, cell);
      return c;
    };
    const bgForest = mkBg(drawForest);
    const bgStreet = mkBg(drawStreet);
    bgRef.current = bgForest;

    const img = new Image();
    img.src = './bandy.png';

    const st = {
      snake: [{ x: 7, y: 12 }, { x: 7, y: 13 }, { x: 7, y: 14 }],
      dir: { x: 0, y: -1 }, queue: [],
      food: { x: 7, y: 5 }, score: 0, alive: true, acc: 0, last: 0, step: BASE_STEP, level: 1,
    };
    stateRef.current = st;
    canvas.__game = st;   // aggancio per i test automatici (non usato dall'app)

    const placeFood = () => {
      let p, tries = 0;
      do {
        p = { x: Math.floor(Math.random() * GAME_COLS), y: Math.floor(Math.random() * GAME_ROWS) };
        tries++;
      } while (tries < 200 && st.snake.some((s) => s.x === p.x && s.y === p.y));
      st.food = p;
    };

    const offX = Math.floor((canvas.width - cell * GAME_COLS) / 2);
    const offY = Math.floor((canvas.height - cell * GAME_ROWS) / 2);

    const draw = () => {
      ctx.drawImage(bgRef.current, 0, 0);
      // Bandy da raccogliere
      const f = st.food;
      const fcx = offX + f.x * cell + cell / 2, fcy = offY + f.y * cell + cell / 2;
      // alone chiaro: stacca Bandy dal verde del bosco
      ctx.beginPath();
      ctx.arc(fcx, fcy, cell * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240, 244, 241, 0.28)';
      ctx.fill();
      if (img.complete && img.naturalWidth) {
        const fs = cell * 1.34; // un filo più grande della cella per leggerlo bene
        ctx.drawImage(img, fcx - fs / 2, fcy - fs / 2, fs, fs);
      } else {
        ctx.fillStyle = '#E9B48E';
        ctx.fillRect(fcx - cell * 0.4, fcy - cell * 0.4, cell * 0.8, cell * 0.8);
      }
      // Livello 2: la fila di figure stilizzate al posto della canna.
      if (st.level >= 2) {
        st.snake.forEach((s, i) => {
          const x = offX + s.x * cell, y = offY + s.y * cell;
          ctx.fillStyle = 'rgba(0,0,0,0.28)';                 // ombra a terra
          ctx.fillRect(x + cell * 0.2, y + cell * 0.82, cell * 0.6, cell * 0.12);
          drawFigure(ctx, x, y, cell, i, i === 0);
        });
        return;
      }
      // la canna: corpo di carta con punta accesa
      st.snake.forEach((s, i) => {
        const x = offX + s.x * cell, y = offY + s.y * cell;
        if (i === 0) {
          ctx.fillStyle = '#F6EFDF';
          ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
          ctx.fillStyle = '#D97706';           // brace
          ctx.fillRect(x + cell * 0.28, y + cell * 0.28, cell * 0.44, cell * 0.44);
          ctx.fillStyle = '#FFD08A';
          ctx.fillRect(x + cell * 0.4, y + cell * 0.4, cell * 0.2, cell * 0.2);
        } else {
          const last = i === st.snake.length - 1;
          ctx.fillStyle = last ? '#C7A87C' : (i % 2 ? '#F1E7D2' : '#FAF4E6');
          ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
          if (i % 3 === 0) { ctx.fillStyle = '#E3D6BB'; ctx.fillRect(x + 3, y + 3, cell - 6, 2); }
        }
      });
    };

    const tick = (ts) => {
      if (!stateRef.current) return;
      if (!st.last) st.last = ts;
      const dt = ts - st.last; st.last = ts;
      if (st.alive && !st.pause) {
        st.acc += dt;
        if (st.acc >= st.step) {
          st.acc = 0;
          if (st.queue.length) st.dir = st.queue.shift();
          const head = { x: st.snake[0].x + st.dir.x, y: st.snake[0].y + st.dir.y };
          const hitWall = head.x < 0 || head.y < 0 || head.x >= GAME_COLS || head.y >= GAME_ROWS;
          const hitSelf = st.snake.some((s) => s.x === head.x && s.y === head.y);
          if (hitWall || hitSelf) {
            st.alive = false;
            setOver(true);
            onGameOver(st.score);
          } else {
            st.snake.unshift(head);
            if (head.x === st.food.x && head.y === st.food.y) {
              st.score += 1;
              setScore(st.score);
              const nextLevel = Math.floor(st.score / LEVEL_EVERY) + 1;
              if (nextLevel > st.level) {
                st.level = nextLevel;
                // velocità raddoppiata a ogni livello
                st.step = Math.max(MIN_STEP, Math.round(BASE_STEP / Math.pow(2, nextLevel - 1)));
                // si riparte dalla lunghezza base, mantenendo posizione e direzione
                st.snake = st.snake.slice(0, BASE_LEN);
                st.queue = [];
                bgRef.current = nextLevel >= 2 ? bgStreet : bgForest;
                setLevel(nextLevel);
              }
              placeFood();
            } else {
              st.snake.pop();
            }
          }
        }
      }
      draw();
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);

    const turn = (x, y) => {
      // Confronto con l'ultima direzione decisa (non con quella a schermo),
      // così due comandi rapidi in sequenza funzionano entrambi.
      const last = st.queue.length ? st.queue[st.queue.length - 1] : st.dir;
      if (last.x === -x && last.y === -y) return;   // niente inversione a U
      if (last.x === x && last.y === y) return;     // già in questa direzione
      if (st.queue.length < 2) st.queue.push({ x, y });
      // Se il passo è già a metà, lo anticipo: la svolta si vede subito
      // invece di aspettare fino a un tick intero.
      if (st.acc >= st.step * 0.45) st.acc = st.step;
    };
    const onKey = (e) => {
      const k = e.key;
      if (['ArrowUp', 'w', 'W'].includes(k)) { turn(0, -1); e.preventDefault(); }
      else if (['ArrowDown', 's', 'S'].includes(k)) { turn(0, 1); e.preventDefault(); }
      else if (['ArrowLeft', 'a', 'A'].includes(k)) { turn(-1, 0); e.preventDefault(); }
      else if (['ArrowRight', 'd', 'D'].includes(k)) { turn(1, 0); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);

    let sx = 0, sy = 0, swiped = false;
    const onStart = (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; swiped = false; };
    const onMove = (e) => {
      if (swiped) return;
      const t = e.touches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
      // Svolta appena il dito ha percorso abbastanza: non aspetta il rilascio.
      if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0); else turn(0, dy > 0 ? 1 : -1);
      swiped = true;
    };
    canvas.addEventListener('touchstart', onStart, { passive: true });
    canvas.addEventListener('touchmove', onMove, { passive: true });

    stateRef.current.turn = turn;

    return () => {
      cancelAnimationFrame(st.raf);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nudge = (x, y) => { const st = stateRef.current; if (st && st.turn) st.turn(x, y); };
  const togglePause = () => {
    const st = stateRef.current; if (!st || !st.alive) return;
    st.pause = !st.pause; setPaused(st.pause);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-[#8F9E8B]/30">
        <span className="text-xs uppercase font-bold text-gray-500 truncate">{playerName}</span>
        <span className="font-rustic text-lg text-[#2D392C]">{score} 🌿</span>
        <span className="text-[10px] text-gray-400">
          liv. {level}{level >= 2 ? ' 🏙️' : ''} · -{Math.max(0, level * 15 - score)} · rec {bestLocal}
        </span>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={360}
          height={456}
          className="w-full rounded-lg border-2 border-[#2D392C]/40 touch-none"
          style={{ imageRendering: 'pixelated' }}
        />
        {levelUp && !over && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/70 px-5 py-3 rounded-lg text-center">
              <div className="font-rustic text-2xl text-[#D97706]">LIVELLO {level}</div>
              <div className="text-[10px] uppercase tracking-widest text-[#F0F4F1]">
                {level === 2 ? 'In città!' : 'Il doppio più veloce!'}
              </div>
            </div>
          </div>
        )}
        {(over || paused) && (
          <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center text-center p-4">
            {over ? (
              <>
                <div className="font-rustic text-2xl text-[#F0F4F1]">Bandy è scappato!</div>
                <div className="text-[#D97706] font-rustic text-3xl my-2">{score}</div>
                <div className="text-[11px] text-gray-300 mb-4">
                  {score > bestLocal ? 'Nuovo record personale! 🎉' : `Il tuo record resta ${bestLocal}`}
                </div>
                <button onClick={onExit} className="px-6 py-2.5 bg-[#2D392C] text-white rounded font-bold uppercase text-xs">Chiudi</button>
              </>
            ) : (
              <div className="font-rustic text-xl text-[#F0F4F1]">In pausa</div>
            )}
          </div>
        )}
      </div>

      {/* Comandi per il telefono (in alternativa si scorre il dito sul campo) */}
      <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
        <span></span>
        <button onPointerDown={(e) => { e.preventDefault(); nudge(0, -1); }} aria-label="Su" className="py-3 bg-[#2D392C] text-white rounded font-bold">▲</button>
        <span></span>
        <button onPointerDown={(e) => { e.preventDefault(); nudge(-1, 0); }} aria-label="Sinistra" className="py-3 bg-[#2D392C] text-white rounded font-bold">◀</button>
        <button onClick={togglePause} aria-label="Pausa" className="py-3 bg-[#5C4A3C] text-white rounded font-bold text-xs">{paused ? '▶' : '❚❚'}</button>
        <button onPointerDown={(e) => { e.preventDefault(); nudge(1, 0); }} aria-label="Destra" className="py-3 bg-[#2D392C] text-white rounded font-bold">▶</button>
        <span></span>
        <button onPointerDown={(e) => { e.preventDefault(); nudge(0, 1); }} aria-label="Giù" className="py-3 bg-[#2D392C] text-white rounded font-bold">▼</button>
        <span></span>
      </div>

      <button onClick={onExit} className="w-full py-2 text-[11px] uppercase font-bold text-gray-500 hover:text-gray-700">Esci dal gioco</button>
    </div>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('calendario');
  const [currentDate, setCurrentDate] = useState(() => parseDate(defaultDateStr()));
  const [selectedDateStr, setSelectedDateStr] = useState(defaultDateStr());

  const [members, setMembers] = useState(() => load('cambusa_members', []));
  const [campData, setCampData] = useState(() => load('cambusa_camp_data', {}));
  // Taccuino delle spese: ogni voce è un acquisto { id, name, price, type, at }.
  // I totali della scheda Spesa sono calcolati da qui.
  const [purchases, setPurchases] = useState(() => {
    const saved = load('cambusa_purchases', null);
    if (Array.isArray(saved)) return saved;
    // Migrazione una-tantum dai vecchi totali manuali, se presenti.
    const g = load('cambusa_global_expenses', null);
    const seed = [];
    if (g) {
      const mk = (amt, type, name) => {
        const n = Math.max(0, parseFloat(amt) || 0);
        if (n > 0) seed.push({ id: uid(), name, price: n, type, at: Date.now() });
      };
      mk(g.food, 'alimentare', 'Totale cibo (importato)');
      mk(g.drinks, 'bevande', 'Totale bevande (importato)');
      mk(g.accessory, 'logistica', 'Totale accessori (importato)');
    }
    return seed;
  });

  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberChild, setNewMemberChild] = useState(false);
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pType, setPType] = useState('alimentare');
  const [pBuyer, setPBuyer] = useState('');
  const [pReceipt, setPReceipt] = useState(null); // foto scontrino in attesa di Salva
  const [viewReceipt, setViewReceipt] = useState(null); // foto aperta a schermo intero
  const [snapList, setSnapList] = useState(null); // elenco snapshot per il ripristino
  const [spesaSection, setSpesaSection] = useState('totali'); // sotto-sezione attiva in Spesa
  const [guideOpen, setGuideOpen] = useState('calendario'); // pill aperta nella guida

  // Rimborsi segnati come "saldati" (solo barrati, non rimossi). Condivisi via sync.
  const [settled, setSettled] = useState(() => load('cambusa_settled', []));

  // Cache meteo (Open-Meteo, 16 giorni). Aggiornata al massimo una volta all'ora.
  const [weather, setWeather] = useState(() => load('cambusa_weather', { fetchedAt: 0, byDate: {} }));

  // Foto scontrini: sincronizzate via Firestore (sotto-collezione dedicata,
  // un documento per foto) + copia locale in localStorage.
  const [receipts, setReceipts] = useState(() => load('cambusa_receipts', {}));
  const receiptsRef = useRef({});

  // Dotazioni aggiuntive (box editabile), condivise via sync.
  const [gear, setGear] = useState(() => load('cambusa_gear', []));
  const [newGearText, setNewGearText] = useState('');

  // Attrezzatura da acquistare: { id, text, price, bought }. Quelle spuntate
  // (acquistate) entrano nelle spese totali come logistica. Condivisa via sync.
  const [equipment, setEquipment] = useState(() => load('cambusa_equipment', []));

  // Lista "Da Acquistare": { id, name, qty }. Quando viene acquistata la voce
  // passa nella cronologia (diventa un acquisto con lo stesso id, così l'even-
  // tuale foto dello scontrino resta collegata).
  const [toBuy, setToBuy] = useState(() => load('cambusa_tobuy', []));
  const [newBuyName, setNewBuyName] = useState('');
  const [newBuyQty, setNewBuyQty] = useState('');
  const [buying, setBuying] = useState(null); // voce in fase di registrazione acquisto
  const [listaSection, setListaSection] = useState('daacquistare'); // sotto-sezione Lista della Spesa

  // ---------- Mini gioco "Aiuta Bandy" ----------
  const [gamePlayer, setGamePlayer] = useState(() => localStorage.getItem('cambusa_player') || '');
  const [gameRunning, setGameRunning] = useState(false);
  const [gameBest, setGameBest] = useState(() => Number(load('cambusa_best', 0)) || 0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [newEquipText, setNewEquipText] = useState('');
  const [newEquipPrice, setNewEquipPrice] = useState('');
  const [newEquipBuyer, setNewEquipBuyer] = useState('');

  const [menuOpen, setMenuOpen] = useState(false);

  // Suggerimento installazione PWA: mostrato finché l'app non è installata
  // (o finché l'utente non lo chiude). Su iOS l'installazione è solo manuale.
  const [showInstallHint, setShowInstallHint] = useState(() => {
    const standalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
    return !standalone && !localStorage.getItem('cambusa_install_hint_off');
  });
  const dismissInstallHint = () => {
    localStorage.setItem('cambusa_install_hint_off', '1');
    setShowInstallHint(false);
  };
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // Desktop = puntatore fine e nessun touch primario: cambia solo i testi
  // delle istruzioni, non la grafica.
  const isDesktop = !/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

  // Chiusura del menu laterale con Esc (comodo da tastiera).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ---------- Stato sincronizzazione cloud (Firebase) ----------
  const [cloud, setCloud] = useState({ connected: false, status: 'idle', code: null, lastSync: null, error: null });
  const [campCodeInput, setCampCodeInput] = useState((typeof window !== 'undefined' && window.CAMP_CODE_DEFAULT) || '');
  const cloudConnectedRef = useRef(false);
  const suppressPushRef = useRef(false);

  // ---------- Persistenza ----------
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => localStorage.setItem('cambusa_members', JSON.stringify(members)), [members]);
  useEffect(() => localStorage.setItem('cambusa_camp_data', JSON.stringify(campData)), [campData]);
  useEffect(() => localStorage.setItem('cambusa_purchases', JSON.stringify(purchases)), [purchases]);
  useEffect(() => localStorage.setItem('cambusa_gear', JSON.stringify(gear)), [gear]);
  useEffect(() => localStorage.setItem('cambusa_settled', JSON.stringify(settled)), [settled]);
  useEffect(() => localStorage.setItem('cambusa_equipment', JSON.stringify(equipment)), [equipment]);
  useEffect(() => localStorage.setItem('cambusa_tobuy', JSON.stringify(toBuy)), [toBuy]);
  useEffect(() => localStorage.setItem('cambusa_weather', JSON.stringify(weather)), [weather]);

  // Scarica le previsioni (16 giorni) se c'è linea, la località è impostata e
  // la cache ha più di un'ora. Navigando tra i giorni i dati sono già pronti.
  useEffect(() => {
    const loc = window.CAMP_LOCATION;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return;
    if (!navigator.onLine) return;
    if (Date.now() - weather.fetchedAt < 60 * 60 * 1000) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`)
      .then((r) => r.json())
      .then((j) => {
        const d = j && j.daily;
        if (!d || !Array.isArray(d.time)) return;
        const byDate = {};
        d.time.forEach((t, i) => {
          byDate[t] = {
            code: d.weather_code[i],
            tmax: d.temperature_2m_max[i],
            tmin: d.temperature_2m_min[i],
            rain: d.precipitation_probability_max[i],
          };
        });
        setWeather({ fetchedAt: Date.now(), byDate });
      })
      .catch(() => { /* offline o API non raggiungibile: resta la cache */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, selectedDateStr]);
  useEffect(() => {
    receiptsRef.current = receipts;
    try {
      localStorage.setItem('cambusa_receipts', JSON.stringify(receipts));
    } catch (e) {
      console.warn('localStorage pieno: le foto restano comunque nella cache di Firestore.');
    }
  }, [receipts]);

  // Pulizia: elimina le foto locali di acquisti che non esistono più
  // (es. acquisto cancellato da un altro dispositivo).
  useEffect(() => {
    setReceipts((prev) => {
      const ids = new Set(purchases.map((p) => p.id));
      const keys = Object.keys(prev);
      if (keys.every((k) => ids.has(k))) return prev;
      const copy = {};
      keys.forEach((k) => { if (ids.has(k)) copy[k] = prev[k]; });
      return copy;
    });
  }, [purchases]);

  useEffect(() => {
    const on = () => {
      setIsOnline(true);
      // Al ritorno della linea, se non siamo connessi (e la sync non è stata
      // disattivata a mano), riconnette da solo col codice salvato o predefinito.
      const CS = window.CloudSync;
      const optedOut = localStorage.getItem('cambusa_sync_optout') === '1';
      if (CS && CS.isConfigured() && !cloudConnectedRef.current && !optedOut) {
        const code = CS.savedCode() || window.CAMP_CODE_DEFAULT || '';
        if (code) CS.connect(window.FIREBASE_CONFIG, code, applyRemote).catch(() => {});
      }
    };
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Sincronizzazione cloud ----------
  // Applica al locale i dati arrivati dal cloud (senza rimbalzarli indietro).
  const applyRemote = (remote) => {
    suppressPushRef.current = true;
    if (Array.isArray(remote.members)) setMembers(remote.members);
    if (remote.campData && typeof remote.campData === 'object') setCampData(remote.campData);
    if (Array.isArray(remote.purchases)) setPurchases(remote.purchases);
    if (Array.isArray(remote.gear)) setGear(remote.gear);
    if (Array.isArray(remote.settled)) setSettled(remote.settled);
    if (Array.isArray(remote.equipment)) setEquipment(remote.equipment);
    if (Array.isArray(remote.toBuy)) setToBuy(remote.toBuy);
    setTimeout(() => { suppressPushRef.current = false; }, 0);
  };

  const connectCloud = async (code) => {
    const CS = window.CloudSync;
    if (!CS || !CS.isConfigured()) {
      window.alert('Firebase non è configurato. Incolla la config del tuo progetto in firebase-config.js.');
      return;
    }
    const c = (code || '').trim();
    if (!c) { window.alert('Inserisci il codice del campo.'); return; }
    localStorage.removeItem('cambusa_sync_optout'); // riattiva l'auto-connessione
    try {
      await CS.connect(window.FIREBASE_CONFIG, c, applyRemote);
    } catch (e) {
      window.alert('Connessione fallita: ' + (e && e.message ? e.message : e));
    }
  };

  const disconnectCloud = () => {
    // Scelta esplicita: niente riconnessione automatica finché non si riattiva.
    localStorage.setItem('cambusa_sync_optout', '1');
    if (window.CloudSync) window.CloudSync.disconnect();
  };

  // Foto scontrini in arrivo dal cloud: merge con le locali, e upload di
  // quelle presenti solo in locale (es. scattate prima della connessione).
  const handleCloudReceipts = (cloudMap) => {
    const local = receiptsRef.current;
    const CS = window.CloudSync;
    Object.keys(local).forEach((id) => {
      if (!cloudMap[id] && CS && CS.isConnected()) CS.putReceipt(id, local[id]);
    });
    setReceipts((prev) => ({ ...prev, ...cloudMap }));
  };

  // All'avvio: aggancia lo stato e si connette DA SOLO col codice campo
  // (salvato o predefinito). Chi ha premuto Disconnetti resta fuori finché
  // non riattiva manualmente (flag cambusa_sync_optout).
  useEffect(() => {
    const CS = window.CloudSync;
    if (!CS) return;
    CS.onStatus((s) => { cloudConnectedRef.current = s.connected; setCloud(s); });
    if (CS.onReceipts) CS.onReceipts(handleCloudReceipts);
    const optedOut = localStorage.getItem('cambusa_sync_optout') === '1';
    const code = CS.savedCode() || window.CAMP_CODE_DEFAULT || '';
    if (code && CS.isConfigured() && !optedOut) {
      setCampCodeInput(code);
      CS.connect(window.FIREBASE_CONFIG, code, applyRemote).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push verso il cloud quando i dati cambiano. Se offline, Firestore mette la
  // scrittura in coda e la invia da solo al ritorno della linea.
  useEffect(() => {
    if (!cloudConnectedRef.current) return;
    if (suppressPushRef.current) return;
    if (window.CloudSync) window.CloudSync.pushState({ members, campData, purchases, gear, settled, equipment, toBuy });
  }, [members, campData, purchases, gear, settled, equipment, toBuy]);

  // ---------- Dati per giorno ----------
  const getDayData = (dateStr) => ({ ...initialDayState(), ...(campData[dateStr] || {}) });

  const updateDayData = (dateStr, field, value) => {
    setCampData((prev) => ({
      ...prev,
      [dateStr]: { ...initialDayState(), ...(prev[dateStr] || {}), [field]: value },
    }));
  };

  const getMeal = (dateStr, memberId) => {
    const day = campData[dateStr];
    return (day && day.meals && day.meals[memberId]) || { lunch: false, dinner: false };
  };

  const toggleMeal = (dateStr, memberId, mealType) => {
    setCampData((prev) => {
      const day = { ...initialDayState(), ...(prev[dateStr] || {}) };
      const meals = { ...(day.meals || {}) };
      const cur = meals[memberId] || { lunch: false, dinner: false };
      meals[memberId] = { ...cur, [mealType]: !cur[mealType] };
      return { ...prev, [dateStr]: { ...day, meals } };
    });
  };

  // Segna (o toglie) TUTTI i membri a pranzo/cena per il giorno: se sono già
  // tutti segnati, li toglie tutti; altrimenti li segna tutti.
  const setAllMeals = (dateStr, mealType) => {
    if (members.length === 0) return;
    setCampData((prev) => {
      const day = { ...initialDayState(), ...(prev[dateStr] || {}) };
      const meals = { ...(day.meals || {}) };
      const allOn = members.every((m) => meals[m.id] && meals[m.id][mealType]);
      members.forEach((m) => {
        const cur = meals[m.id] || { lunch: false, dinner: false };
        meals[m.id] = { ...cur, [mealType]: !allOn };
      });
      return { ...prev, [dateStr]: { ...day, meals } };
    });
  };

  // Copia le presenze (pranzo e cena) dal giorno precedente.
  const copyFromPreviousDay = () => {
    const d = parseDate(selectedDateStr);
    d.setDate(d.getDate() - 1);
    const prevStr = toDateStr(d);
    const prevMeals = (campData[prevStr] && campData[prevStr].meals) || {};
    if (!Object.keys(prevMeals).length) {
      window.alert('Nessuna presenza registrata il giorno precedente.');
      return;
    }
    const curMeals = (campData[selectedDateStr] && campData[selectedDateStr].meals) || {};
    const hasAny = Object.values(curMeals).some((m) => m && (m.lunch || m.dinner));
    if (hasAny && !window.confirm('Questo giorno ha già delle presenze: sostituirle con quelle di ieri?')) return;
    setCampData((prev) => {
      const day = { ...initialDayState(), ...(prev[selectedDateStr] || {}) };
      return { ...prev, [selectedDateStr]: { ...day, meals: JSON.parse(JSON.stringify(prevMeals)) } };
    });
  };

  // ---------- Gestione membri ----------
  const addMember = () => {
    const name = newMemberName.trim();
    if (!name) return;
    setMembers((prev) => [...prev, { id: uid(), name, isChild: newMemberChild }]);
    setNewMemberName('');
    setNewMemberChild(false);
  };

  const removeMember = (id) => {
    const m = members.find((x) => x.id === id);
    if (m && !window.confirm(`Eliminare ${m.name} dai membri?\nLe sue presenze e i suoi pasti non conteranno più nei calcoli.`)) return;
    setMembers((prev) => prev.filter((x) => x.id !== id));
  };

  const toggleChild = (id) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, isChild: !m.isChild } : m)));
  };

  // Esenzione dalla spesa per l'attrezzatura aggiunta.
  const toggleEquipExempt = (id) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, equipExempt: !m.equipExempt } : m)));
  };

  // ---------- Lista "Da Acquistare" ----------
  const addToBuy = () => {
    const name = newBuyName.trim();
    if (!name) return;
    setToBuy((prev) => [...prev, { id: uid(), name, qty: newBuyQty.trim() }]);
    setNewBuyName('');
    setNewBuyQty('');
  };

  const removeToBuy = (id) => {
    const it = toBuy.find((x) => x.id === id);
    if (it && !window.confirm(`Eliminare "${it.name}" dalla lista da acquistare?`)) return;
    setToBuy((prev) => prev.filter((x) => x.id !== id));
    setReceipts((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev }; delete copy[id]; return copy;
    });
    if (window.CloudSync) window.CloudSync.deleteReceipt(id);
  };

  // Foto scontrino allegata direttamente alla voce da acquistare.
  // Allega una foto scontrino a un id qualsiasi (voce da acquistare o acquisto
  // già registrato: le foto sono indicizzate per id).
  const attachReceiptTo = async (e, id) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      let dataUrl = await compressImage(file, 1000, 0.6);
      if (dataUrl.length > 900000) dataUrl = await compressImage(file, 800, 0.4);
      setReceipts((prev) => ({ ...prev, [id]: dataUrl }));
      if (window.CloudSync) window.CloudSync.putReceipt(id, dataUrl);
    } catch (err) {
      window.alert('Impossibile leggere la foto. Riprova.');
    }
  };

  // Conferma acquisto: la voce esce dalla lista ed entra nella cronologia
  // mantenendo lo stesso id (così la foto scontrino resta collegata).
  const confirmBuy = () => {
    if (!buying) return;
    const price = posNum(buying.price);
    if (price <= 0) { window.alert('Inserisci un prezzo maggiore di zero.'); return; }
    const fullName = buying.qty ? `${buying.name} (${buying.qty})` : buying.name;
    setPurchases((prev) => [...prev, {
      id: buying.id, name: fullName, price, type: buying.type,
      buyer: (buying.buyer || '').trim(), at: Date.now(), fromList: true,
    }]);
    setToBuy((prev) => prev.filter((x) => x.id !== buying.id));
    setBuying(null);
  };

  // ---------- Taccuino delle spese ----------
  const addPurchase = () => {
    const name = pName.trim();
    const price = posNum(pPrice);
    if (!name || price <= 0) {
      window.alert('Inserisci il nome del prodotto e un prezzo maggiore di zero.');
      return;
    }
    const id = uid();
    setPurchases((prev) => [...prev, { id, name, price, type: pType, buyer: pBuyer.trim(), at: Date.now() }]);
    if (pReceipt) {
      setReceipts((prev) => ({ ...prev, [id]: pReceipt }));
      if (window.CloudSync) window.CloudSync.putReceipt(id, pReceipt);
    }
    setPName('');
    setPPrice('');
    setPType('alimentare');
    setPBuyer('');
    setPReceipt(null);
  };

  const removePurchase = (id) => {
    const p = purchases.find((x) => x.id === id);
    if (p && !window.confirm(`Eliminare l'acquisto "${p.name}" (${money(posNum(p.price))} €)?\nVerrà tolto dai totali${receipts[id] ? ' insieme alla foto dello scontrino' : ''}.`)) return;
    setPurchases((prev) => prev.filter((x) => x.id !== id));
    setReceipts((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (window.CloudSync) window.CloudSync.deleteReceipt(id);
  };

  const onReceiptFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      // Comprimi; se ancora troppo grande per un documento Firestore (1MB),
      // ricomprimi più aggressivamente.
      let dataUrl = await compressImage(file, 1000, 0.6);
      if (dataUrl.length > 900000) dataUrl = await compressImage(file, 800, 0.4);
      setPReceipt(dataUrl);
    } catch (err) {
      window.alert('Impossibile leggere la foto. Riprova.');
    }
  };

  // ---------- Ripristino di emergenza (snapshot giornalieri) ----------
  const openRestore = async () => {
    const CS = window.CloudSync;
    if (!CS || !CS.isConnected || !CS.isConnected()) {
      window.alert('Serve la connessione al cloud per il ripristino. Riprova quando c\'è linea.');
      return;
    }
    const ids = await CS.listSnapshots();
    if (!ids.length) {
      window.alert('Nessun salvataggio automatico disponibile (se ne crea uno al giorno).');
      return;
    }
    setSnapList(ids);
  };

  const restoreSnapshot = async (id) => {
    if (!window.confirm(`Ripristinare i dati salvati il ${id}?\nI dati attuali verranno sostituiti su TUTTI i dispositivi connessi.`)) return;
    const CS = window.CloudSync;
    const json = await CS.getSnapshot(id);
    if (!json) { window.alert('Impossibile leggere questo salvataggio.'); return; }
    try {
      const d = JSON.parse(json);
      // Set "normali" (non via applyRemote): così il push parte e propaga
      // il ripristino a tutti i dispositivi.
      setMembers(Array.isArray(d.members) ? d.members : []);
      setCampData(d.campData && typeof d.campData === 'object' ? d.campData : {});
      setPurchases(Array.isArray(d.purchases) ? d.purchases : []);
      setGear(Array.isArray(d.gear) ? d.gear : []);
      setSnapList(null);
      window.alert('Dati ripristinati: tra qualche secondo saranno su tutti i dispositivi.');
    } catch (e) {
      window.alert('Salvataggio non valido.');
    }
  };

  // ---------- Condividi resoconto spese ----------
  const buildReport = () => {
    const t = totals;
    const lines = [];
    lines.push(`🏕️ ${BRAND.appTitle} — Conti finali`);
    lines.push('');
    lines.push(`💶 Totale spese: ${money(t.overallTotal)} €`);
    if (t.transfers.length > 0) {
      lines.push('');
      lines.push('👉 Chi paga chi:');
      t.transfers.forEach((x) => lines.push(`• ${x.from} → ${x.to}: ${money(x.amount)} €`));
    }
    if (t.settlement.length > 0) {
      lines.push('');
      lines.push('📋 Dettaglio a testa:');
      t.settlement.forEach((s) => {
        const stato = s.net > 0.005 ? `riceve ${money(s.net)} €` : s.net < -0.005 ? `deve dare ${money(-s.net)} €` : 'in pari';
        lines.push(`• ${s.name}: ${stato} (anticipato ${money(s.paid)} €, quota ${money(s.owed)} €)`);
      });
    }
    if (t.unattributed > 0.005) {
      lines.push('');
      lines.push(`⚠️ ${money(t.unattributed)} € di spese comuni senza acquirente.`);
    }
    return lines.join('\n');
  };

  const shareReport = async () => {
    if (totals.overallTotal <= 0) {
      window.alert('Nessuna spesa da condividere: registra prima gli acquisti.');
      return;
    }
    const text = buildReport();
    if (navigator.share) {
      try { await navigator.share({ title: 'Prato Lungo 2026 — Conti', text }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; /* altrimenti prova WhatsApp */ }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  // Carica la classifica quando si apre la sezione del gioco.
  useEffect(() => {
    if (activeTab === 'gioco') refreshLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, cloud.connected]);

  // ---------- Mini gioco: classifica ----------
  const refreshLeaderboard = () => {
    const CS = window.CloudSync;
    if (CS && CS.listScores) CS.listScores().then(setLeaderboard).catch(() => {});
  };

  const startGame = () => {
    const n = gamePlayer.trim();
    if (!n) { window.alert('Scrivi il tuo nome per entrare in classifica.'); return; }
    localStorage.setItem('cambusa_player', n);
    setGameRunning(true);
  };

  const endGame = (score) => {
    if (score > gameBest) {
      setGameBest(score);
      localStorage.setItem('cambusa_best', JSON.stringify(score));
    }
    const CS = window.CloudSync;
    if (CS && CS.submitScore) {
      CS.submitScore(gamePlayer.trim(), score).then(refreshLeaderboard).catch(() => {});
    }
  };

  // ---------- Rimborsi saldati (barrati) ----------
  const toggleSettled = (key) => {
    setSettled((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // ---------- Aggiunta attrezzatura ----------
  const addEquip = () => {
    const text = newEquipText.trim();
    if (!text) return;
    setEquipment((prev) => [...prev, { id: uid(), text, price: posNum(newEquipPrice), bought: false, buyer: newEquipBuyer.trim() }]);
    setNewEquipText('');
    setNewEquipPrice('');
    setNewEquipBuyer('');
  };

  const toggleEquipBought = (id) => {
    setEquipment((prev) => prev.map((e) => (e.id === id ? { ...e, bought: !e.bought } : e)));
  };

  const removeEquip = (id) => {
    const e = equipment.find((x) => x.id === id);
    if (e && !window.confirm(`Eliminare "${e.text}" dall'attrezzatura?`)) return;
    setEquipment((prev) => prev.filter((x) => x.id !== id));
  };

  // ---------- Dotazioni aggiuntive ----------
  const addGear = () => {
    const text = newGearText.trim();
    if (!text) return;
    setGear((prev) => [...prev, { id: uid(), text }]);
    setNewGearText('');
  };

  const removeGear = (id) => {
    const g = gear.find((x) => x.id === id);
    if (g && !window.confirm(`Eliminare "${g.text}" dalle dotazioni?`)) return;
    setGear((prev) => prev.filter((x) => x.id !== id));
  };

  // ---------- Navigazione date ----------
  const changeWeek = (days) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
    setSelectedDateStr(toDateStr(newDate));
  };

  const navigateDate = (days) => {
    const d = parseDate(selectedDateStr);
    d.setDate(d.getDate() + days);
    setSelectedDateStr(toDateStr(d));
    setCurrentDate(new Date(d));
  };

  const getDaysOfWeek = (start) => {
    const days = [];
    const temp = new Date(start);
    const day = temp.getDay();
    const diff = temp.getDate() - day + (day === 0 ? -6 : 1); // lunedì come inizio settimana
    temp.setDate(diff);
    for (let i = 0; i < 7; i++) {
      days.push(new Date(temp));
      temp.setDate(temp.getDate() + 1);
    }
    return days;
  };

  const weekDays = getDaysOfWeek(currentDate);

  // ---------- Calcolo ripartizione (coerente: somma quote = totale) ----------
  const calculateTotals = () => {
    // I totali di spesa sono generati dal taccuino (per tipologia).
    const sumByType = (t) => purchases.reduce((s, p) => (p.type === t ? s + posNum(p.price) : s), 0);
    const totalFood = sumByType('alimentare');
    const totalDrinks = sumByType('bevande');
    // Logistica dagli acquisti (divisa fra tutti i presenti) e attrezzatura
    // acquistata (divisa solo fra chi NON è esente): due quote separate.
    const logisticsPurchases = sumByType('logistica');
    const equipBought = equipment.reduce((s, e) => (e.bought ? s + posNum(e.price) : s), 0);
    const totalAccessory = logisticsPurchases + equipBought;
    const totalFoodDrinks = totalFood + totalDrinks;
    const overallTotal = totalFoodDrinks + totalAccessory;

    // Pasti per membro sull'intero campo.
    const mealsByMember = {};
    members.forEach((m) => (mealsByMember[m.id] = 0));

    let adultMealsTotal = 0;
    const attendingAdults = new Set();
    const attendingForEquip = new Set(); // presenti NON esenti da attrezzatura

    Object.values(campData).forEach((day) => {
      const meals = (day && day.meals) || {};
      members.forEach((m) => {
        const mm = meals[m.id];
        if (!mm) return;
        const count = (mm.lunch ? 1 : 0) + (mm.dinner ? 1 : 0);
        if (count === 0) return;
        mealsByMember[m.id] += count;
        if (!m.isChild) {
          adultMealsTotal += count;
          attendingAdults.add(m.id);
          // L'esenzione vale solo se la funzione e' attiva (vedi FEATURES).
          if (!(FEATURES.equipExemption && m.equipExempt)) attendingForEquip.add(m.id);
        }
      });
    });

    // Cibo+bevande ripartiti sui pasti degli adulti (bambini = gratis).
    const costPerMeal = adultMealsTotal > 0 ? totalFoodDrinks / adultMealsTotal : 0;
    // Logistica: parti uguali tra tutti gli adulti presenti.
    const logisticsPerAdult = attendingAdults.size > 0 ? logisticsPurchases / attendingAdults.size : 0;
    // Attrezzatura: parti uguali tra i presenti non esenti. Se sono tutti
    // esenti, per non perdere la spesa si ripartisce su tutti i presenti.
    const equipDivisorSet = attendingForEquip.size > 0 ? attendingForEquip : attendingAdults;
    const equipPerAdult = equipDivisorSet.size > 0 ? equipBought / equipDivisorSet.size : 0;
    // Quota "accessori" media mostrata nel riepilogo.
    const accessoryPerAdult = logisticsPerAdult + equipPerAdult;

    // Quota dovuta da ciascun membro (valore esatto).
    const breakdown = members.map((m) => {
      const mealCount = mealsByMember[m.id] || 0;
      const foodShare = m.isChild ? 0 : mealCount * costPerMeal;
      const present = !m.isChild && mealCount > 0;
      const logShare =
        (present ? logisticsPerAdult : 0) +
        (present && equipDivisorSet.has(m.id) ? equipPerAdult : 0);
      return { ...m, mealCount, foodShare, logShare, owed: foodShare + logShare };
    });

    // --- Arrotondamento "cassa-friendly" ---
    // Ogni quota viene arrotondata a multipli di 0,10 € (niente monetine da
    // 1/2/5 cent). Lo scarto rispetto al totale reale viene riconciliato SOLO
    // se è >= 0,50 €: sotto quella soglia si lascia com'è (non vale la pena).
    const round10 = (cents) => Math.round(cents / 10) * 10;
    breakdown.forEach((b) => {
      b.payCents = b.isChild ? 0 : round10(Math.round(b.owed * 100));
    });

    const targetCents = Math.round(overallTotal * 100);
    let residual = targetCents - breakdown.reduce((s, b) => s + b.payCents, 0);

    if (Math.abs(residual) >= 50) {
      // Redistribuisce lo scarto a passi di 10 cent, partendo da chi deve di più.
      const order = breakdown
        .filter((b) => !b.isChild && b.owed > 0)
        .sort((a, b) => b.owed - a.owed);
      const step = residual > 0 ? 10 : -10;
      let guard = 0;
      let idx = 0;
      while (Math.abs(residual) >= 10 && order.length > 0 && guard < 100000) {
        const t = order[idx % order.length];
        if (!(step < 0 && t.payCents + step < 0)) {
          t.payCents += step;
          residual -= step;
        }
        idx++;
        guard++;
      }
    }

    breakdown.forEach((b) => { b.pay = b.payCents / 100; });
    const collected = breakdown.reduce((s, b) => s + b.payCents, 0) / 100;
    const roundingDiff = collected - overallTotal;

    // Anticipi per acquirente: quanto ha speso ciascuno (per i rimborsi).
    const buyerMap = {};
    purchases.forEach((p) => {
      const key = (p.buyer && p.buyer.trim()) ? p.buyer.trim() : '—';
      buyerMap[key] = (buyerMap[key] || 0) + posNum(p.price);
    });
    const byBuyer = Object.keys(buyerMap)
      .map((name) => ({ name, total: buyerMap[name] }))
      .sort((a, b) => b.total - a.total);

    // --- Saldo netto per persona (stile Splitwise): anticipato - dovuto ---
    const norm = (s) => (s || '').trim().toLowerCase();
    const paidByName = {}; // nome normalizzato -> { display, paid }
    purchases.forEach((p) => {
      const raw = (p.buyer && p.buyer.trim()) ? p.buyer.trim() : '—';
      const key = norm(raw) || '—';
      if (!paidByName[key]) paidByName[key] = { display: raw, paid: 0 };
      paidByName[key].paid += posNum(p.price);
    });
    // Attrezzatura acquistata: se ha un acquirente viene accreditata a lui
    // (verrà rimborsato); altrimenti è spesa comune ("non attribuita"). In
    // entrambi i casi la somma dei saldi resta zero.
    equipment.forEach((e) => {
      if (!e.bought) return;
      const price = posNum(e.price);
      if (price <= 0) return;
      const raw = (e.buyer && e.buyer.trim()) ? e.buyer.trim() : '—';
      const key = norm(raw) || '—';
      if (!paidByName[key]) paidByName[key] = { display: raw, paid: 0 };
      paidByName[key].paid += price;
    });
    const owedByName = {}; // nome membro normalizzato -> { display, owed }
    breakdown.forEach((b) => {
      const key = norm(b.name);
      if (!owedByName[key]) owedByName[key] = { display: b.name, owed: 0 };
      owedByName[key].owed += b.pay; // già arrotondato; bambini = 0
    });
    const unattributed = paidByName['—'] ? paidByName['—'].paid : 0;
    const allKeys = new Set([...Object.keys(paidByName), ...Object.keys(owedByName)]);
    allKeys.delete('—');
    const settlement = [];
    allKeys.forEach((k) => {
      const paid = paidByName[k] ? paidByName[k].paid : 0;
      const owed = owedByName[k] ? owedByName[k].owed : 0;
      if (paid === 0 && owed === 0) return;
      const display = (owedByName[k] && owedByName[k].display) || (paidByName[k] && paidByName[k].display) || k;
      settlement.push({ name: display, paid, owed, net: paid - owed });
    });
    settlement.sort((a, b) => b.net - a.net); // prima chi deve ricevere

    // Transazioni di pareggio: chi paga chi, col minor numero di giri.
    // Greedy sui centesimi: il debitore più grosso paga il creditore più grosso.
    const creditors = settlement.filter((s) => s.net > 0.005).map((s) => ({ name: s.name, cents: Math.round(s.net * 100) }));
    const debtors = settlement.filter((s) => s.net < -0.005).map((s) => ({ name: s.name, cents: Math.round(-s.net * 100) }));
    const transfers = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const amt = Math.min(creditors[ci].cents, debtors[di].cents);
      if (amt > 0) transfers.push({ from: debtors[di].name, to: creditors[ci].name, amount: amt / 100 });
      creditors[ci].cents -= amt;
      debtors[di].cents -= amt;
      if (creditors[ci].cents === 0) ci++;
      if (debtors[di].cents === 0) di++;
    }

    return {
      totalFood, totalDrinks, totalAccessory, totalFoodDrinks, overallTotal,
      costPerMeal, logisticsPerAdult, equipPerAdult, accessoryPerAdult,
      logisticsPurchases, equipBought, equipPayersCount: equipDivisorSet.size,
      adultMealsTotal,
      attendingAdultsCount: attendingAdults.size, breakdown,
      collected, roundingDiff, byBuyer, settlement, unattributed, transfers,
    };
  };

  const totals = calculateTotals();

  // ---------- Backup (Export / Import) ----------
  const exportData = () => {
    const payload = { version: 6, exportedAt: new Date().toISOString(), members, campData, purchases, gear, settled, equipment, toBuy, receipts };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bandone-backup-${toDateStr(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!window.confirm('Importare questo backup? I dati attuali verranno sostituiti.')) return;
        if (Array.isArray(d.members)) setMembers(d.members);
        if (d.campData && typeof d.campData === 'object') setCampData(d.campData);
        if (Array.isArray(d.purchases)) setPurchases(d.purchases);
        if (Array.isArray(d.gear)) setGear(d.gear);
        if (Array.isArray(d.settled)) setSettled(d.settled);
        if (Array.isArray(d.equipment)) setEquipment(d.equipment);
        if (Array.isArray(d.toBuy)) setToBuy(d.toBuy);
        if (d.receipts && typeof d.receipts === 'object') setReceipts(d.receipts);
      } catch (err) {
        window.alert('File non valido: non è un backup leggibile.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---------- Render ----------
  if (showSplash) {
    return (
      <div
        onClick={() => setShowSplash(false)}
        className="fixed inset-0 bg-[#2D392C] flex flex-col items-center justify-center text-[#F0F4F1] z-50 cursor-pointer"
      >
        <div className="w-56 h-56 mb-6 rounded-full overflow-hidden shadow-2xl flex items-center justify-center border-4 border-[#8F9E8B] bg-[#F0F4F1]">
          <img src="./logo.png" alt={`Logo ${BRAND.groupName}`} className="w-full h-full object-cover" />
        </div>
        <h1 className="font-rustic text-3xl tracking-widest text-[#8F9E8B]">{BRAND.splashLine1}</h1>
        <h2 className="font-rustic text-xl tracking-widest text-[#F0F4F1]">{BRAND.splashLine2}</h2>
        <p className="mt-4 text-xs uppercase tracking-widest opacity-60">{BRAND.splashTagline}</p>
        <p className="absolute bottom-4 left-0 right-0 text-center text-[9px] tracking-wide text-[#8F9E8B]/70 px-6">
          {BRAND.credits}
        </p>
      </div>
    );
  }

  const tabs = {
    calendario: 'Calendario',
    membri: 'Membri',
    presenze: 'Presenze',
    spesa: 'Spese Totali',
    lista: 'Lista della Spesa',
    attrezzatura: 'Aggiunta Attrezzatura',
    regole: 'Regole',
    dotazioni: 'Dotazioni personali',
    gioco: 'Aiuta Bandy',
    guida: 'Come funziona',
  };

  const goTo = (tab) => { setActiveTab(tab); setMenuOpen(false); };

  // Guida: una "pill" per ogni area di lavoro.
  const GUIDE = [
    { k: 'calendario', icon: '📅', title: 'Calendario', body: 'Per ogni giorno: il meteo previsto di Pereto (massima, minima e probabilità di pioggia), il riepilogo cucina con quanti pasti preparare a pranzo e a cena, e uno spazio per le note su menù, legna, turni. Scorri le settimane con le frecce: meteo e cucina si aggiornano sul giorno scelto.' },
    { k: 'membri', icon: '👥', title: 'Membri', body: 'Aggiungi tutte le persone del campo. Il pulsante Adulto/Bambino decide chi paga: i bambini mangiano gratis e il loro costo è ripartito sugli adulti. L\'elenco alimenta presenze, conti e il suggerimento dei nomi quando registri una spesa.' },
    { k: 'presenze', icon: '🍽️', title: 'Presenze', body: 'Segna chi c\'è a pranzo e a cena, giorno per giorno: è la base del calcolo delle quote. Per fare in fretta usa "Tutti a pranzo" o "Tutti a cena" e poi togli i pochi assenti, oppure "Copia da ieri". In alto trovi il conteggio del giorno. Durante il campo l\'app si apre già sulla data di oggi.' },
    { k: 'lista', icon: '🧾', title: 'Lista della Spesa', body: 'Due sezioni. "Da acquistare": la lista di cosa serve, con nome e quantità; ogni voce ha l\'icona 📷 per lo scontrino e il tasto "Segna come acquistata", che chiede prezzo, acquirente e tipologia e la sposta in "Acquistato". "Acquistato": la cronologia di tutte le spese, più una maschera per registrare a mano ciò che non era in lista. Hai dimenticato lo scontrino? Tocca 📷 sulla voce e fotografalo anche dopo.' },
    { k: 'attrezzatura', icon: '🪛', title: 'Aggiunta Attrezzatura', body: 'Elenco dell\'attrezzatura da comprare, con prezzo ed eventuale acquirente. Spunta una voce quando è acquistata: solo allora il costo entra nelle spese, come logistica. In fondo vedi il totale previsto e quello effettivamente acquistato. Se indichi l\'acquirente, gli verrà rimborsata.' },
    { k: 'spesa', icon: '💶', title: 'Spese Totali', body: 'Quattro sotto-sezioni. Totali: quanto si è speso per cibo, bevande, logistica e attrezzatura. Quote: quanto costa a testa. Saldi: chi deve dare o ricevere. Dati: backup e sincronizzazione. I totali non si scrivono a mano, nascono dalla Lista della Spesa e dall\'attrezzatura acquistata.' },
    { k: 'conti', icon: '⚖️', title: 'Come si dividono', body: 'Cibo e bevande sono divisi per il numero di pasti: chi mangia di più paga di più. Logistica e attrezzatura sono una quota fissa uguale per ogni adulto presente: nessuno paga più di una quota. Le cifre sono arrotondate a 10 centesimi, così non servono monetine da 1, 2 o 5 cent.' },
    { k: 'saldi', icon: '🤝', title: 'Saldi e rimborsi', body: 'Per ogni persona l\'app confronta quanto ha anticipato con quanto deve, e dice se riceve o se deve dare. Sotto, in "Chi paga chi", trovi i pochi passaggi di denaro necessari per pareggiare tutto: tocca una riga quando il rimborso è stato fatto e resta barrata. Con "Condividi resoconto" mandi il riepilogo pronto nel gruppo WhatsApp.' },
    { k: 'dotazioni', icon: '🎒', title: 'Dotazioni personali', body: 'Cosa portarsi da casa: una dotazione base uguale per tutti (tenda, sacco a pelo, stoviglie, borraccia…) che non si modifica, e un elenco di aggiunte per questo campo che potete integrare quando serve.' },
    { k: 'backup', icon: '🛟', title: 'Backup e sicurezza', body: 'Ogni giorno viene salvata da sola una copia dei dati nel cloud: se qualcosa va storto, "Ripristino di emergenza" (in Spese Totali → Dati) permette di tornare a un giorno preciso. In più puoi esportare tutto su file con Esporta e ricaricarlo con Importa. Prima di eliminare qualcosa l\'app chiede sempre conferma.' },
    { k: 'sync', icon: '☁️', title: 'Sincronizzazione', body: 'La connessione al campo è automatica: quando c\'è linea i dati si allineano da soli fra i telefoni, in tempo reale, foto degli scontrini comprese. Senza linea si continua a lavorare normalmente e tutto viene inviato appena la rete torna. Il pallino in alto a destra indica se sei online o offline.' },
    { k: 'installa', icon: '📲', title: 'Installa l\'app', body: 'Conviene installarla, così si apre a schermo intero e funziona anche senza rete. Su iPhone: Condividi (il quadrato con la freccia) e poi "Aggiungi alla schermata Home". Su Android: menu del browser e "Installa app". Quando usciamo un aggiornamento, l\'app si aggiorna da sola: se non vedi una novità, chiudila e riaprila.' },
  ];

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[#F0F4F1] border-x border-[#8F9E8B]/30 shadow-2xl pb-24">
      <header className="bg-[#2D392C] text-[#F0F4F1] p-4 text-center border-b-4 border-[#5C4A3C] relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex flex-col items-center justify-center gap-[3px] rounded hover:bg-white/10"
        >
          <span className="block w-5 h-0.5 bg-[#F0F4F1]"></span>
          <span className="block w-5 h-0.5 bg-[#F0F4F1]"></span>
          <span className="block w-5 h-0.5 bg-[#F0F4F1]"></span>
        </button>
        <h1 className="font-rustic text-2xl tracking-wide">{BRAND.appTitle}</h1>
        <p className="text-xs uppercase tracking-wider text-[#8F9E8B]">{tabs[activeTab]}</p>
        <span
          title={isOnline ? 'Online' : 'Offline'}
          className={`absolute top-3 right-3 flex items-center gap-1 text-[9px] uppercase font-bold ${isOnline ? 'text-[#8F9E8B]' : 'text-[#D97706]'}`}
        >
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#8F9E8B]' : 'bg-[#D97706]'}`}></span>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </header>

      {/* Menu laterale (drawer): scorre da sinistra sopra il contenuto */}
      <div className={`fixed inset-0 z-40 ${menuOpen ? '' : 'pointer-events-none'}`}>
        <div
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
        ></div>
        {/* Il pannello è ancorato alla colonna dell'app (max-w-md centrata),
            così su desktop entra dal bordo dell'app e non da quello della finestra. */}
        <div className="absolute inset-0 max-w-md mx-auto overflow-hidden pointer-events-none">
        <nav
          className={`pointer-events-auto absolute left-0 top-0 bottom-0 w-72 max-w-[80%] bg-[#F0F4F1] border-r-4 border-[#5C4A3C] shadow-2xl p-4 space-y-1 overflow-y-auto transition-transform duration-300 ease-out ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center gap-3 border-b border-[#8F9E8B]/40 pb-3 mb-2">
            <img src="./logo.png" alt="" className="w-11 h-11 rounded-full object-cover border-2 border-[#8F9E8B] bg-white" />
            <div>
              <div className="font-rustic text-[#2D392C] leading-tight">{BRAND.appTitle}</div>
              <div className="text-[9px] uppercase tracking-wider text-[#8F9E8B]">{BRAND.groupName}</div>
            </div>
          </div>
          {Object.keys(tabs).map((tab) => (
            <button
              key={tab}
              onClick={() => goTo(tab)}
              className={`w-full text-left px-4 py-3 rounded font-bold uppercase text-sm tracking-wide transition-colors ${
                activeTab === tab ? 'bg-[#2D392C] text-[#F0F4F1]' : 'text-[#2D392C] hover:bg-[#E2EAE4]'
              }`}
            >
              {tabs[tab]}
            </button>
          ))}
        </nav>
        </div>
      </div>

      {/* Suggerimento installazione app */}
      {showInstallHint && (
        <div className="bg-[#D97706]/15 border-b border-[#D97706]/40 px-4 py-2.5 flex items-start gap-2">
          <span className="text-base leading-none mt-0.5">📲</span>
          <p className="flex-grow text-[11px] text-[#5C4A3C] leading-snug">
            <span className="font-bold">{isDesktop ? 'Installa l\'app sul computer:' : 'Installa l\'app sul telefono:'}</span>{' '}
            {isIOS
              ? 'tocca Condividi (il quadrato con la freccia in su) e poi "Aggiungi alla schermata Home".'
              : isDesktop
              ? 'clicca l\'icona di installazione nella barra degli indirizzi (o menu ⋮ → "Installa").'
              : 'apri il menu del browser (⋮) e tocca "Installa app" (o "Aggiungi a schermata Home").'}
            {' '}Una volta installata funziona anche senza linea.
          </p>
          <button onClick={dismissInstallHint} aria-label="Chiudi avviso" className="text-[#5C4A3C] font-bold px-1 shrink-0">&times;</button>
        </div>
      )}

      <main className="flex-grow p-4">
        {/* ---------- CALENDARIO ---------- */}
        {activeTab === 'calendario' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm">
              <button onClick={() => changeWeek(-7)} className="p-2 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&larr;</button>
              <span className="font-bold text-sm text-[#2D392C] uppercase font-rustic">Settimana Selezionata</span>
              <button onClick={() => changeWeek(7)} className="p-2 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&rarr;</button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((d) => {
                const dateStr = toDateStr(d);
                const isSelected = dateStr === selectedDateStr;
                const isCampPeriod = dateStr >= CAMP_START && dateStr <= CAMP_END;
                const label = d.toLocaleDateString('it-IT', { weekday: 'short' });
                return (
                  <button
                    key={dateStr}
                    onClick={() => { setSelectedDateStr(dateStr); setCurrentDate(new Date(d)); }}
                    className={`p-2 flex flex-col items-center rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-[#5C4A3C] text-white border-[#5C4A3C]'
                        : isCampPeriod
                        ? 'bg-[#2D392C]/10 text-[#2D392C] border-[#2D392C]'
                        : 'bg-white text-gray-400 border-gray-200'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold">{label}</span>
                    <span className="text-lg font-bold font-rustic">{d.getDate()}</span>
                    {isCampPeriod && <span className="w-1.5 h-1.5 bg-[#D97706] rounded-full mt-0.5"></span>}
                  </button>
                );
              })}
            </div>

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-dashed border-[#8F9E8B] pb-1">
                Note del {parseDate(selectedDateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
              </h3>

              {/* Meteo previsto per il giorno selezionato */}
              {(() => {
                const loc = window.CAMP_LOCATION;
                const locOk = loc && typeof loc.lat === 'number' && typeof loc.lon === 'number';
                const wx = weather.byDate[selectedDateStr];
                return (
                  <div className="flex items-center gap-2 bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20">
                    {!locOk ? (
                      <span className="text-[10px] text-gray-400 italic">Meteo: località del campo da impostare.</span>
                    ) : wx ? (
                      <>
                        <span className="text-2xl leading-none">{wmoInfo(wx.code).icon}</span>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-[#2D392C]">{wmoInfo(wx.code).label}</span>
                          {loc.label && <span className="text-[9px] text-gray-400">{loc.label}</span>}
                        </div>
                        <span className="ml-auto text-xs text-gray-600 font-bold">
                          {Math.round(wx.tmax)}° / {Math.round(wx.tmin)}°{wx.rain != null ? <span className="text-[#5C8AA8]"> · 💧{wx.rain}%</span> : null}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">
                        Previsione non ancora disponibile per questo giorno{isOnline ? ' (copre ~16 giorni in avanti)' : ' (offline)'}.
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Riepilogo cucina del giorno: quanti pasti preparare */}
              {(() => {
                const lunch = members.filter((m) => getMeal(selectedDateStr, m.id).lunch).length;
                const dinner = members.filter((m) => getMeal(selectedDateStr, m.id).dinner).length;
                return (
                  <div className="flex items-center gap-2 bg-[#2D392C]/5 px-3 py-2 rounded border border-[#2D392C]/15">
                    <span className="text-xl leading-none">🍲</span>
                    <span className="text-[11px] uppercase font-bold text-gray-500">Cucina</span>
                    <span className="ml-auto text-sm font-bold text-[#2D392C]">
                      {lunch} <span className="text-[10px] font-normal text-gray-500">a pranzo</span>
                      <span className="text-gray-300"> · </span>
                      {dinner} <span className="text-[10px] font-normal text-gray-500">a cena</span>
                    </span>
                  </div>
                );
              })()}

              <textarea
                value={getDayData(selectedDateStr).note}
                onChange={(e) => updateDayData(selectedDateStr, 'note', e.target.value)}
                placeholder="Inserisci note sul menu, meteo o legna per oggi..."
                className="w-full h-32 p-3 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded-lg text-sm focus:outline-none focus:border-[#2D392C] resize-none"
              />
            </div>
          </div>
        )}

        {/* ---------- MEMBRI ---------- */}
        {activeTab === 'membri' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aggiungi Membro</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMember()}
                  placeholder="Nome e cognome"
                  className="flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                />
                <button onClick={addMember} className="px-4 bg-[#2D392C] text-white rounded font-bold text-sm hover:bg-[#1F271E]">+</button>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={newMemberChild} onChange={(e) => setNewMemberChild(e.target.checked)} />
                Bambino (pasti gratis)
              </label>
            </div>

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">
                Membri ({members.length})
              </h3>
              {members.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessun membro. Aggiungine uno per iniziare a segnare le presenze.</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li key={m.id} className="bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-[#2D392C] truncate">{m.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => toggleChild(m.id)}
                            className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${m.isChild ? 'bg-[#D97706] text-white' : 'bg-gray-200 text-gray-500'}`}
                          >
                            {m.isChild ? 'Bambino' : 'Adulto'}
                          </button>
                          <button onClick={() => removeMember(m.id)} className="text-red-700 font-bold px-2 hover:text-red-900">&times;</button>
                        </div>
                      </div>
                      {/* Esenzione attrezzatura: nascosta finche' FEATURES.equipExemption e' false */}
                      {FEATURES.equipExemption && (
                        <button
                          onClick={() => toggleEquipExempt(m.id)}
                          aria-label="Esenzione attrezzatura"
                          className="mt-1.5 flex items-center gap-2 text-left"
                        >
                          <span className={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-[10px] font-bold ${m.equipExempt ? 'bg-[#5C4A3C] border-[#5C4A3C] text-white' : 'bg-white border-[#8F9E8B]'}`}>
                            {m.equipExempt ? '✓' : ''}
                          </span>
                          <span className={`text-[10px] ${m.equipExempt ? 'font-bold text-[#5C4A3C]' : 'text-gray-500'}`}>
                            Esente attrezzatura
                          </span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ---------- PRESENZE ---------- */}
        {activeTab === 'presenze' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm">
              <button onClick={() => navigateDate(-1)} className="px-3 py-1 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&larr;</button>
              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => { if (e.target.value) { setSelectedDateStr(e.target.value); setCurrentDate(parseDate(e.target.value)); } }}
                className="bg-transparent border-none text-sm focus:outline-none font-bold text-center w-full mx-2 text-[#5C4A3C]"
              />
              <button onClick={() => navigateDate(1)} className="px-3 py-1 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&rarr;</button>
            </div>

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">
                Presenze del {parseDate(selectedDateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
              </h3>

              {members.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aggiungi prima i membri nella scheda "Membri".</p>
              ) : (
                <>
                {/* Azioni rapide */}
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setAllMeals(selectedDateStr, 'lunch')} className="py-2.5 bg-[#2D392C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#1F271E]">Tutti a pranzo</button>
                  <button onClick={() => setAllMeals(selectedDateStr, 'dinner')} className="py-2.5 bg-[#5C4A3C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#463628]">Tutti a cena</button>
                  <button onClick={copyFromPreviousDay} className="py-2.5 bg-white border-2 border-[#8F9E8B]/50 text-[#2D392C] rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#E2EAE4]">Copia da ieri</button>
                </div>
                <p className="text-[9px] text-gray-400 -mt-1">
                  Segna tutti, poi togli i pochi assenti. Se sono già tutti segnati, il bottone li toglie tutti.
                  {' '}<span className="font-bold text-[#5C4A3C]">
                    Oggi: {members.filter((m) => getMeal(selectedDateStr, m.id).lunch).length} a pranzo · {members.filter((m) => getMeal(selectedDateStr, m.id).dinner).length} a cena
                  </span>
                </p>
                <ul className="space-y-2">
                  {members.map((m) => {
                    const meal = getMeal(selectedDateStr, m.id);
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-2 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/20">
                        <span className="text-sm font-bold text-[#2D392C] truncate flex items-center gap-1">
                          {m.name}
                          {m.isChild && <span className="text-[8px] uppercase bg-[#D97706] text-white px-1 rounded">gratis</span>}
                        </span>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => toggleMeal(selectedDateStr, m.id, 'lunch')}
                            className={`text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border ${meal.lunch ? 'bg-[#2D392C] text-white border-[#2D392C]' : 'bg-white text-gray-400 border-gray-300'}`}
                          >
                            Pranzo
                          </button>
                          <button
                            onClick={() => toggleMeal(selectedDateStr, m.id, 'dinner')}
                            className={`text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border ${meal.dinner ? 'bg-[#5C4A3C] text-white border-[#5C4A3C]' : 'bg-white text-gray-400 border-gray-300'}`}
                          >
                            Cena
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                </>
              )}
            </div>

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-2">
              <h4 className="font-rustic text-sm text-[#5C4A3C]">Note / Ospiti del giorno</h4>
              <textarea
                value={getDayData(selectedDateStr).guestsNames}
                onChange={(e) => updateDayData(selectedDateStr, 'guestsNames', e.target.value)}
                placeholder="Ospiti occasionali o note sulle presenze..."
                className="w-full h-20 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C] resize-none"
              />
            </div>
          </div>
        )}

        {/* ---------- SPESA ---------- */}
        {activeTab === 'spesa' && (
          <div className="space-y-4">
            {/* Sotto-sezioni della Spesa */}
            <div className="grid grid-cols-4 gap-1.5">
              {[['totali', 'Totali'], ['quote', 'Quote'], ['saldi', 'Saldi'], ['dati', 'Dati']].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setSpesaSection(k)}
                  className={`py-2.5 rounded text-[10px] font-bold uppercase tracking-wide border-b-4 transition-all ${
                    spesaSection === k ? 'bg-[#2D392C] text-white border-[#5C4A3C]' : 'bg-white text-[#2D392C] border-gray-300 hover:bg-[#E2EAE4]'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {spesaSection === 'totali' && (<div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-4">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Cassa Globale Campo</h3>
              <p className="text-[10px] text-gray-500 -mt-1">Totali generati automaticamente dalla <span className="font-bold">Lista della Spesa</span> e dall'<span className="font-bold">Attrezzatura</span> acquistata.</p>
              <div className="space-y-2">
                {[
                  ['Spesa Cibo (Alimentare)', totals.totalFood],
                  ['Spesa Bevande', totals.totalDrinks],
                  ['Logistica', totals.logisticsPurchases],
                  ['Attrezzatura acquistata', totals.equipBought],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20">
                    <span className="text-[11px] uppercase font-bold text-gray-500">{label}</span>
                    <span className="font-bold text-[#2D392C]">{money(val)} €</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#2D392C]/10 p-3 rounded border border-[#2D392C]/20 flex justify-between items-center mt-2">
                <span className="font-bold text-xs uppercase">Importo Complessivo:</span>
                <span className="font-rustic font-bold text-lg text-[#2D392C]">{money(totals.overallTotal)} €</span>
              </div>
            </div>

            <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md space-y-4">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-1">Il Conto della Serva</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20">
                  <span className="text-[10px] uppercase text-[#8F9E8B] block">Quota Singolo Pasto</span>
                  <span className="font-rustic text-xl text-[#D97706]">{money(totals.costPerMeal)} €</span>
                  <p className="text-[9px] text-gray-400 mt-1">Cibo+bevande ({money(totals.totalFoodDrinks)} €) / {totals.adultMealsTotal} pasti adulti.</p>
                </div>
                <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20">
                  <span className="text-[10px] uppercase text-[#8F9E8B] block">Logistica a testa</span>
                  <span className="font-rustic text-xl text-[#D97706]">{money(totals.logisticsPerAdult)} €</span>
                  <p className="text-[9px] text-gray-400 mt-1">Logistica ({money(totals.logisticsPurchases)} €) / {totals.attendingAdultsCount} adulti presenti.</p>
                </div>
                <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20 col-span-2">
                  <span className="text-[10px] uppercase text-[#8F9E8B] block">Attrezzatura a testa</span>
                  <span className="font-rustic text-xl text-[#D97706]">{money(totals.equipPerAdult)} €</span>
                  <p className="text-[9px] text-gray-400 mt-1">
                    Attrezzatura ({money(totals.equipBought)} €) / {totals.equipPayersCount} {FEATURES.equipExemption
                      ? (totals.equipPayersCount === 1 ? 'persona non esente' : 'persone non esenti')
                      : (totals.equipPayersCount === 1 ? 'adulto presente' : 'adulti presenti')}.
                  </p>
                </div>
              </div>
              <p className="text-[9px] text-gray-400 italic">I pasti dei bambini sono gratis: il loro costo è ripartito sugli adulti.</p>
            </div>

            </div>)}

            {spesaSection === 'quote' && (<div className="space-y-4">
            {/* Ripartizione per membro */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Quanto deve ciascuno</h3>
              {totals.breakdown.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aggiungi membri e segna le presenze per vedere la ripartizione.</p>
              ) : (
                <div>
                  <ul className="divide-y divide-[#8F9E8B]/20">
                    {totals.breakdown.map((b) => (
                      <li key={b.id} className="flex items-center justify-between py-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-[#2D392C]">{b.name}</span>
                          <span className="text-[10px] text-gray-500">{b.mealCount} {b.mealCount === 1 ? 'pasto' : 'pasti'}{b.isChild ? ' · bambino' : ''}</span>
                        </div>
                        <span className={`font-rustic font-bold ${b.isChild ? 'text-gray-400' : 'text-[#2D392C]'}`}>
                          {b.isChild ? 'Gratis' : `${money(b.pay)} €`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between items-center pt-2 mt-1 border-t border-[#8F9E8B]/30">
                    <span className="text-[11px] uppercase font-bold text-gray-500">Totale raccolto</span>
                    <span className="font-rustic font-bold text-[#2D392C]">{money(totals.collected)} €</span>
                  </div>
                  <p className="text-[9px] text-gray-400 italic mt-2">
                    Quote arrotondate a 0,10 € (niente monetine da 1/2/5 cent).
                    {Math.abs(totals.roundingDiff) >= 0.005
                      ? ` Scarto rispetto al totale: ${totals.roundingDiff > 0 ? '+' : ''}${money(totals.roundingDiff)} € (sotto 0,50 €, non riconciliato).`
                      : ' Nessuno scarto.'}
                  </p>
                </div>
              )}
            </div>

            </div>)}

            {spesaSection === 'saldi' && (<div className="space-y-4">
            {/* Anticipi per acquirente */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Anticipi per acquirente</h3>
              {totals.byBuyer.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Registra gli acquisti nel Taccuino per vedere chi ha anticipato quanto.</p>
              ) : (
                <div>
                  <ul className="divide-y divide-[#8F9E8B]/20">
                    {totals.byBuyer.map((b) => (
                      <li key={b.name} className="flex items-center justify-between py-2">
                        <span className={`text-sm font-bold ${b.name === '—' ? 'text-gray-400 italic' : 'text-[#2D392C]'}`}>
                          {b.name === '—' ? 'Non indicato' : b.name}
                        </span>
                        <span className="font-rustic font-bold text-[#2D392C]">{money(b.total)} €</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[9px] text-gray-400 italic mt-2">Quanto ha anticipato ciascuno (utile per i rimborsi).</p>
                </div>
              )}
            </div>

            {/* Saldo finale (stile Splitwise) */}
            <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 mb-3">Saldo finale</h3>
              {totals.settlement.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Registra acquisti (con acquirente) e presenze per vedere chi deve dare o ricevere.</p>
              ) : (
                <ul className="divide-y divide-[#8F9E8B]/20">
                  {totals.settlement.map((s) => {
                    const credito = s.net > 0.005;
                    const debito = s.net < -0.005;
                    return (
                      <li key={s.name} className="flex items-center justify-between py-2 gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold truncate">{s.name}</span>
                          <span className="text-[9px] text-[#8F9E8B]">ha anticipato {money(s.paid)} € · deve {money(s.owed)} €</span>
                        </div>
                        <span className={`font-rustic font-bold text-sm shrink-0 text-right ${credito ? 'text-[#8FBF8F]' : debito ? 'text-[#D97706]' : 'text-gray-400'}`}>
                          {credito ? `riceve ${money(s.net)} €` : debito ? `dà ${money(-s.net)} €` : 'in pari'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {totals.transfers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#8F9E8B]/30">
                  <h4 className="font-rustic text-sm text-[#8F9E8B] mb-1">Chi paga chi</h4>
                  <p className="text-[9px] text-gray-400 mb-2">Tocca una riga quando il rimborso è stato fatto: resta barrata. Tocca di nuovo per annullare.</p>
                  <ul className="space-y-1.5">
                    {totals.transfers.map((t, i) => {
                      const key = `${t.from}→${t.to}@${Math.round(t.amount * 100)}`;
                      const paid = settled.includes(key);
                      return (
                        <li
                          key={key + i}
                          onClick={() => toggleSettled(key)}
                          className={`cursor-pointer select-none flex items-center justify-between bg-[#1F271E] px-3 py-2 rounded border transition-opacity ${paid ? 'border-[#8FBF8F]/40 opacity-60' : 'border-[#8F9E8B]/20'}`}
                        >
                          <span className={`text-xs ${paid ? 'line-through text-gray-400' : ''}`}>
                            <span className="font-bold">{t.from}</span>
                            <span className="text-[#8F9E8B]"> → </span>
                            <span className="font-bold">{t.to}</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className={`font-rustic font-bold ${paid ? 'line-through text-gray-400' : 'text-[#D97706]'}`}>{money(t.amount)} €</span>
                            {paid && <span className="text-[#8FBF8F] text-sm font-bold">✓</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {totals.unattributed > 0.005 && (
                <p className="text-[9px] text-[#D97706] italic mt-2">
                  Attenzione: {money(totals.unattributed)} € di acquisti sono senza acquirente. Assegna un acquirente nel Taccuino per far quadrare i conti.
                </p>
              )}
              <p className="text-[9px] text-gray-400 italic mt-1">"Riceve" = ha anticipato più di quanto deve; "dà" = deve versare la differenza.</p>
            </div>

            <button onClick={shareReport} className="w-full py-3 bg-[#25D366] text-white rounded font-bold uppercase text-sm tracking-wide hover:brightness-95 flex items-center justify-center gap-2">
              <span>📤</span> Condividi resoconto
            </button>
            <p className="text-[9px] text-gray-400 italic text-center">Genera un messaggio pronto con totale e "chi paga chi" da mandare nel gruppo.</p>

            </div>)}

            {spesaSection === 'dati' && (<div className="space-y-4">
            {/* Backup dati */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Backup Dati</h3>
              <p className="text-[10px] text-gray-500">Ogni giorno viene salvata da sola una copia di sicurezza nel cloud. Esporta/Importa serve per un backup manuale su file.</p>
              <div className="flex gap-2">
                <button onClick={exportData} className="flex-1 py-2.5 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]">Esporta</button>
                <label className="flex-1 py-2.5 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase text-center cursor-pointer hover:bg-[#463628]">
                  Importa
                  <input type="file" accept="application/json,.json" onChange={importData} className="hidden" />
                </label>
              </div>
              <button onClick={openRestore} className="w-full py-2.5 bg-white border-2 border-[#D97706]/50 text-[#D97706] rounded text-xs font-bold uppercase hover:bg-[#D97706]/10">
                Ripristino di emergenza
              </button>
            </div>

            {/* Sincronizzazione Cloud (online) */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
                <h3 className="font-rustic text-lg text-[#2D392C]">Sincronizzazione Cloud</h3>
                <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${cloud.connected ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {cloud.connected ? 'Connesso' : 'Non connesso'}
                </span>
              </div>

              {!(window.CloudSync && window.CloudSync.isConfigured()) ? (
                <p className="text-[10px] text-gray-500 italic">
                  Firebase non configurato. Incolla la config del tuo progetto in <span className="font-bold">firebase-config.js</span> per abilitare la sincronizzazione online tra dispositivi.
                </p>
              ) : (
                <>
                  <p className="text-[10px] text-gray-500">
                    La sincronizzazione si attiva da sola all'avvio quando c'è linea. Offline si continua a lavorare in locale. Premi Disconnetti solo se vuoi lavorare senza condividere i dati.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={campCodeInput}
                      onChange={(e) => setCampCodeInput(e.target.value)}
                      placeholder="Codice campo"
                      disabled={cloud.connected}
                      className="flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C] disabled:opacity-60"
                    />
                    {cloud.connected ? (
                      <button onClick={disconnectCloud} className="px-4 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase hover:bg-[#463628]">Disconnetti</button>
                    ) : (
                      <button onClick={() => connectCloud(campCodeInput)} className="px-4 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]">Connetti</button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>
                      {cloud.status === 'connecting' && 'Connessione in corso…'}
                      {cloud.status === 'saving' && 'Salvataggio…'}
                      {cloud.status === 'connected' && (cloud.lastSync ? `Ultima sync: ${new Date(cloud.lastSync).toLocaleTimeString('it-IT')}` : 'In ascolto…')}
                      {cloud.status === 'error' && <span className="text-red-700">Errore: {cloud.error}</span>}
                      {cloud.status === 'idle' && (localStorage.getItem('cambusa_sync_optout') === '1'
                        ? 'Sincronizzazione disattivata: premi Connetti per riattivarla.'
                        : 'In attesa di connessione automatica…')}
                    </span>
                    {!isOnline && <span className="text-[#D97706] font-bold">offline</span>}
                  </div>
                </>
              )}
            </div>
            </div>)}
          </div>
        )}

        {/* ---------- TACCUINO DELLE SPESE ---------- */}
        {activeTab === 'lista' && (
          <div className="space-y-4">
            {/* Sotto-sezioni: Da acquistare / Acquistato */}
            <div className="grid grid-cols-2 gap-2">
              {[['daacquistare', 'Da acquistare', toBuy.length], ['acquistato', 'Acquistato', purchases.length]].map(([k, l, n]) => (
                <button
                  key={k}
                  onClick={() => setListaSection(k)}
                  className={`py-2.5 rounded text-[11px] font-bold uppercase tracking-wide border-b-4 transition-all ${
                    listaSection === k ? 'bg-[#2D392C] text-white border-[#5C4A3C]' : 'bg-white text-[#2D392C] border-gray-300 hover:bg-[#E2EAE4]'
                  }`}
                >
                  {l}{n > 0 ? ` (${n})` : ''}
                </button>
              ))}
            </div>

            {/* ===== DA ACQUISTARE ===== */}
            {listaSection === 'daacquistare' && (
            <div className="bg-white p-4 rounded-lg border-2 border-[#5C4A3C]/30 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
                <h3 className="font-rustic text-lg text-[#2D392C]">Da Acquistare</h3>
                {toBuy.length > 0 && (
                  <span className="text-[10px] uppercase font-bold text-gray-500">{toBuy.length} {toBuy.length === 1 ? 'voce' : 'voci'}</span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBuyName}
                  onChange={(e) => setNewBuyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addToBuy()}
                  placeholder="Cosa serve…"
                  className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                />
                <input
                  type="text"
                  value={newBuyQty}
                  onChange={(e) => setNewBuyQty(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addToBuy()}
                  placeholder="Q.tà"
                  className="w-20 shrink-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm text-center focus:outline-none focus:border-[#2D392C]"
                />
                <button onClick={addToBuy} aria-label="Aggiungi alla lista" className="shrink-0 px-3 bg-[#2D392C] text-white rounded font-bold text-lg leading-none hover:bg-[#1F271E]">+</button>
              </div>

              {toBuy.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Lista vuota. Scrivi cosa serve e premi +.</p>
              ) : (
                <ul className="space-y-2">
                  {toBuy.map((it) => (
                    <li key={it.id} className="bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                      <div className="flex items-center gap-2">
                        <div className="flex-grow min-w-0">
                          <div className="text-sm font-bold text-[#2D392C] truncate">{it.name}</div>
                          {it.qty && <div className="text-[10px] text-gray-500">Quantità: {it.qty}</div>}
                        </div>
                        {/* Foto scontrino della singola voce */}
                        {receipts[it.id] ? (
                          <button onClick={() => setViewReceipt(receipts[it.id])} aria-label="Vedi scontrino" className="shrink-0 px-2 py-1.5 rounded border-2 border-[#2D392C] bg-[#2D392C] text-white leading-none">📷</button>
                        ) : (
                          <label title="Foto scontrino" aria-label="Allega scontrino" className="shrink-0 cursor-pointer px-2 py-1.5 rounded border-2 border-[#8F9E8B]/50 bg-white leading-none hover:bg-[#E2EAE4]">
                            📷
                            <input type="file" accept="image/*" capture="environment" onChange={(e) => attachReceiptTo(e, it.id)} className="hidden" />
                          </label>
                        )}
                        <button onClick={() => removeToBuy(it.id)} aria-label="Rimuovi" className="shrink-0 text-red-700 font-bold px-1.5 hover:text-red-900">&times;</button>
                      </div>
                      <button
                        onClick={() => setBuying({ id: it.id, name: it.name, qty: it.qty, price: '', buyer: '', type: 'alimentare' })}
                        className="mt-2 w-full py-2 bg-[#5C4A3C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#463628]"
                      >
                        Segna come acquistata
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[9px] text-gray-400 italic">Quando una voce viene acquistata passa in "Acquistato", con prezzo e acquirente.</p>
            </div>
            )}

            {/* ===== ACQUISTATO: inserimento manuale + cronologia ===== */}
            {listaSection === 'acquistato' && (<>
            {/* Form di inserimento diretto */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
                <h3 className="font-rustic text-lg text-[#2D392C]">Prodotto acquistato</h3>
                <label
                  title="Foto scontrino"
                  aria-label="Allega scontrino"
                  className={`cursor-pointer px-3 py-2 rounded border-2 text-lg leading-none ${pReceipt ? 'bg-[#2D392C] border-[#2D392C]' : 'bg-white border-[#8F9E8B]/50 hover:bg-[#E2EAE4]'}`}
                >
                  📷
                  <input type="file" accept="image/*" capture="environment" onChange={onReceiptFile} className="hidden" />
                </label>
              </div>
              <p className="text-[10px] text-gray-500 -mt-1">Per un prodotto che non era in "Da acquistare".</p>

              {pReceipt && (
                <div className="flex items-center gap-3 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/30">
                  <img src={pReceipt} alt="Scontrino" className="w-12 h-12 object-cover rounded" />
                  <span className="flex-grow text-xs text-[#2D392C] font-bold">Scontrino allegato ✓</span>
                  <button onClick={() => setPReceipt(null)} aria-label="Rimuovi foto" className="text-red-700 font-bold px-2 hover:text-red-900">&times;</button>
                </div>
              )}

              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Nome</label>
                <input
                  type="text"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="Es. Pasta, Acqua, Piatti…"
                  className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Acquirente</label>
                <input
                  type="text"
                  list="acquirenti"
                  value={pBuyer}
                  onChange={(e) => setPBuyer(e.target.value)}
                  placeholder="Chi ha acquistato"
                  className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                />
                <datalist id="acquirenti">
                  {members.map((m) => (<option key={m.id} value={m.name} />))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Prezzo (€)</label>
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPurchase()}
                    placeholder="0.00"
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Tipologia</label>
                  <select
                    value={pType}
                    onChange={(e) => setPType(e.target.value)}
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold focus:outline-none focus:border-[#2D392C]"
                  >
                    {Object.keys(PURCHASE_TYPES).map((k) => (
                      <option key={k} value={k}>{PURCHASE_TYPES[k]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button onClick={addPurchase} className="w-full py-3 bg-[#2D392C] text-white rounded font-bold uppercase text-sm tracking-wide hover:bg-[#1F271E]">
                Salva
              </button>
            </div>

            {/* Cronologia acquisti */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
                <h3 className="font-rustic text-lg text-[#2D392C]">Cronologia acquisti</h3>
                {purchases.length > 0 && (
                  <span className="font-rustic font-bold text-[#2D392C]">{money(totals.overallTotal)} €</span>
                )}
              </div>

              {purchases.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessun acquisto registrato. Compila il form qui sopra e premi Salva.</p>
              ) : (
                <ul className="space-y-2">
                  {purchases.slice().reverse().map((p) => (
                    <li key={p.id} className="flex items-center gap-2 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#2D392C] truncate">{p.name}</span>
                          <span className="text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#8F9E8B] shrink-0">{PURCHASE_TYPES[p.type] || p.type}</span>
                          {p.fromList && <span className="text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#5C4A3C] shrink-0">acquistata</span>}
                        </div>
                        <span className="text-[9px] text-gray-400">
                          {p.buyer ? <span className="text-[#5C4A3C] font-bold">{p.buyer}</span> : <span className="italic">acquirente non indicato</span>}
                          {p.at && ` · ${new Date(p.at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} ${new Date(p.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                      </div>
                      <span className="font-rustic font-bold text-[#2D392C] shrink-0">{money(posNum(p.price))} €</span>
                      {receipts[p.id] ? (
                        <button onClick={() => setViewReceipt(receipts[p.id])} aria-label="Vedi scontrino" className="shrink-0 px-2 py-1 rounded border-2 border-[#2D392C] bg-[#2D392C] text-white text-sm leading-none">📷</button>
                      ) : (
                        <label title="Allega scontrino" aria-label="Allega scontrino" className="shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-[#8F9E8B]/50 bg-white text-sm leading-none hover:bg-[#E2EAE4]">
                          📷
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => attachReceiptTo(e, p.id)} className="hidden" />
                        </label>
                      )}
                      <button onClick={() => removePurchase(p.id)} aria-label="Rimuovi" className="text-red-700 font-bold px-1.5 hover:text-red-900 shrink-0">&times;</button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[9px] text-gray-400 italic mt-2">Manca uno scontrino? Tocca 📷 sulla voce e fotografalo anche dopo. Le foto si sincronizzano tra i dispositivi del campo e sono incluse nel backup.</p>
            </div>
            </>)}
          </div>
        )}

        {/* ---------- AGGIUNTA ATTREZZATURA ---------- */}
        {activeTab === 'attrezzatura' && (() => {
          const equipBoughtTotal = equipment.reduce((s, e) => (e.bought ? s + posNum(e.price) : s), 0);
          const equipPlannedTotal = equipment.reduce((s, e) => s + posNum(e.price), 0);
          return (
          <div className="space-y-4">
            {/* Form di inserimento */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aggiungi attrezzatura</h3>
              <input
                type="text"
                value={newEquipText}
                onChange={(e) => setNewEquipText(e.target.value)}
                placeholder="Es. Corda, gazebo, tanica…"
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
              />
              <input
                type="text"
                list="acquirenti-attrezzatura"
                value={newEquipBuyer}
                onChange={(e) => setNewEquipBuyer(e.target.value)}
                placeholder="Acquirente (facoltativo)"
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
              />
              <datalist id="acquirenti-attrezzatura">
                {members.map((m) => (<option key={m.id} value={m.name} />))}
              </datalist>
              <div className="flex gap-2">
                <input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={newEquipPrice}
                  onChange={(e) => setNewEquipPrice(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEquip()}
                  placeholder="Prezzo (€)"
                  className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
                />
                <button onClick={addEquip} className="shrink-0 px-3 bg-[#2D392C] text-white rounded font-bold uppercase text-xs hover:bg-[#1F271E]">Aggiungi</button>
              </div>
              <p className="text-[9px] text-gray-400">Spunta una voce quando l'hai acquistata: il suo prezzo entra nelle Spese Totali (come logistica).</p>
            </div>

            {/* Elenco attrezzatura */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
                <h3 className="font-rustic text-lg text-[#2D392C]">Attrezzatura</h3>
                {equipment.length > 0 && (
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    {equipment.filter((e) => !e.bought).length} da comprare
                  </span>
                )}
              </div>
              {equipment.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessuna attrezzatura. Aggiungi la prima voce qui sopra.</p>
              ) : (
                <>
                <ul className="space-y-2">
                  {equipment.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                      <button
                        onClick={() => toggleEquipBought(e.id)}
                        aria-label={e.bought ? 'Segna da comprare' : 'Segna acquistato'}
                        className={`w-6 h-6 shrink-0 rounded border-2 flex items-center justify-center font-bold ${e.bought ? 'bg-[#2D392C] border-[#2D392C] text-white' : 'bg-white border-[#8F9E8B]'}`}
                      >
                        {e.bought ? '✓' : ''}
                      </button>
                      <div className="flex-grow min-w-0">
                        <div className={`text-sm truncate ${e.bought ? 'line-through text-gray-400' : 'text-[#2D392C]'}`}>{e.text}</div>
                        {e.buyer && <div className="text-[9px] text-[#5C4A3C] font-bold truncate">{e.buyer}</div>}
                      </div>
                      <span className={`font-rustic font-bold shrink-0 ${e.bought ? 'text-[#2D392C]' : 'text-gray-400'}`}>{money(posNum(e.price))} €</span>
                      <button onClick={() => removeEquip(e.id)} aria-label="Rimuovi" className="text-red-700 font-bold px-1.5 hover:text-red-900 shrink-0">&times;</button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 pt-2 border-t border-[#8F9E8B]/30 space-y-1">
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span className="uppercase font-bold">Previsto (tutto)</span>
                    <span className="font-bold">{money(equipPlannedTotal)} €</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] uppercase font-bold text-[#2D392C]">Acquistato (nelle spese)</span>
                    <span className="font-rustic font-bold text-[#2D392C]">{money(equipBoughtTotal)} €</span>
                  </div>
                </div>
                </>
              )}
            </div>
          </div>
          );
        })()}

        {/* ---------- REGOLE ---------- */}
        {activeTab === 'regole' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg border-2 border-[#2D392C]/20 shadow-sm text-center">
              <h3 className="font-rustic text-lg text-[#2D392C] mb-2">Regole</h3>
              <p className="text-sm text-gray-400 italic">Work in progress</p>
            </div>
          </div>
        )}

        {/* ---------- DOTAZIONI PERSONALI ---------- */}
        {activeTab === 'dotazioni' && (
          <div className="space-y-4">
            {/* Box fisso: dotazione base */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Dotazione base</h3>
              <ul className="space-y-2">
                {BASE_GEAR.map((item) => (
                  <li
                    key={item.text}
                    className={`flex items-center gap-3 rounded border p-2.5 ${
                      item.emphasis
                        ? 'bg-[#D97706]/10 border-[#D97706]/40'
                        : 'bg-[#F0F4F1]/60 border-[#8F9E8B]/20'
                    }`}
                  >
                    <span className={`shrink-0 rounded-full bg-[#D97706] ${item.emphasis ? 'w-2 h-2' : 'w-1.5 h-1.5'}`}></span>
                    <span className={item.emphasis
                      ? 'text-base font-bold uppercase underline decoration-2 underline-offset-2 text-[#2D392C] leading-snug'
                      : 'text-sm text-[#2D392C]'}>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[9px] text-gray-400 italic mt-2">Dotazione obbligatoria per ogni partecipante.</p>
            </div>

            {/* Box editabile: aggiunte dell'occasione */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aggiunte per questo campo</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGearText}
                  onChange={(e) => setNewGearText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGear()}
                  placeholder="Es. costume, torcia frontale…"
                  className="flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                />
                <button onClick={addGear} aria-label="Aggiungi dotazione" className="px-4 bg-[#2D392C] text-white rounded font-bold text-lg leading-none hover:bg-[#1F271E]">+</button>
              </div>
              {gear.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessuna aggiunta. Inserisci qui le dotazioni extra per questo campo.</p>
              ) : (
                <ul className="space-y-2">
                  {gear.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                      <span className="w-1.5 h-1.5 bg-[#8F9E8B] rounded-full shrink-0"></span>
                      <span className="flex-grow text-sm text-[#2D392C]">{g.text}</span>
                      <button onClick={() => removeGear(g.id)} aria-label="Rimuovi" className="text-red-700 font-bold px-2 hover:text-red-900">&times;</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ---------- AIUTA BANDY (mini gioco) ---------- */}
        {activeTab === 'gioco' && (
          <div className="space-y-4">
            {!gameRunning ? (
              <>
                <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
                  <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aiuta Bandy</h3>
                  <div className="flex items-center gap-3">
                    <img src="./bandy.png" alt="Bandy" className="w-14 h-14 rounded border-2 border-[#8F9E8B]/40 bg-[#F0F4F1]" style={{ imageRendering: 'pixelated' }} />
                    <p className="text-[11px] text-gray-600 leading-snug">
                      Bandy è in montagna e non è ancora fatto: raggiungilo con la canna più volte che puoi. Ogni volta che lo prendi la canna si allunga — se sbatti contro i bordi o contro te stesso, GAME OVER.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Nome giocatore</label>
                    <input
                      type="text"
                      list="acquirenti"
                      value={gamePlayer}
                      onChange={(e) => setGamePlayer(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && startGame()}
                      placeholder="Come ti chiami?"
                      maxLength={24}
                      className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                    />
                  </div>
                  <button onClick={startGame} className="w-full py-3 bg-[#2D392C] text-white rounded font-bold uppercase text-sm tracking-wide hover:bg-[#1F271E]">
                    Gioca
                  </button>
                  <p className="text-[9px] text-gray-400 italic">Comandi: scorri il dito sul campo o usa le frecce sotto. Da computer: frecce o WASD.</p>
                </div>

                <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md">
                  <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
                    <h3 className="font-rustic text-lg">Classifica</h3>
                    <button onClick={refreshLeaderboard} className="text-[9px] uppercase font-bold text-[#8F9E8B] hover:text-white">Aggiorna</button>
                  </div>
                  <div className="flex justify-between text-xs mb-3 pb-2 border-b border-[#8F9E8B]/20">
                    <span className="text-[#8F9E8B]">Il tuo record</span>
                    <span className="font-rustic text-[#D97706] text-lg leading-none">{gameBest}</span>
                  </div>
                  {leaderboard.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic">Nessun punteggio condiviso ancora. Gioca una partita: con la linea il tuo record finisce qui per tutti.</p>
                  ) : (
                    <ul className="space-y-1">
                      {leaderboard.map((r, i) => (
                        <li key={r.name + i} className="flex items-center justify-between py-1">
                          <span className="text-sm truncate">
                            <span className="text-[#8F9E8B] mr-2">{i + 1}.</span>
                            {i === 0 ? '🏆 ' : ''}{r.name}
                          </span>
                          <span className="font-rustic font-bold text-[#D97706]">{r.score}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <BandyGame
                playerName={gamePlayer.trim()}
                bestLocal={gameBest}
                onGameOver={endGame}
                onExit={() => { setGameRunning(false); refreshLeaderboard(); }}
              />
            )}
          </div>
        )}

        {/* ---------- COME FUNZIONA (guida) ---------- */}
        {activeTab === 'guida' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-1">Come funziona l'app</h3>
              <p className="text-[11px] text-gray-500 mb-3">Tocca un'area per vedere a cosa serve. In sintesi: segni presenze e spese, l'app calcola quanto deve ciascuno e chi rimborsa chi.</p>

              {/* Pills */}
              <div className="flex flex-wrap gap-1.5">
                {GUIDE.map((g) => (
                  <button
                    key={g.k}
                    onClick={() => setGuideOpen(g.k)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                      guideOpen === g.k ? 'bg-[#2D392C] text-white' : 'bg-[#F0F4F1] text-[#2D392C] border border-[#8F9E8B]/40 hover:bg-[#E2EAE4]'
                    }`}
                  >
                    {g.icon} {g.title}
                  </button>
                ))}
              </div>

              {/* Testo della pill selezionata */}
              {(() => {
                const g = GUIDE.find((x) => x.k === guideOpen) || GUIDE[0];
                return (
                  <div className="mt-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg leading-none">{g.icon}</span>
                      <span className="font-rustic text-[#2D392C]">{g.title}</span>
                    </div>
                    <p className="text-xs text-[#2D392C] leading-relaxed">{g.body}</p>
                  </div>
                );
              })()}
            </div>

            <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md">
              <h4 className="font-rustic text-base mb-2">In tre passi</h4>
              <ol className="text-xs space-y-1.5 list-decimal list-inside text-[#F0F4F1]/90">
                <li>In <span className="font-bold">Membri</span> aggiungi le persone (e segna chi è bambino).</li>
                <li>Ogni giorno segna le <span className="font-bold">Presenze</span> e registra le spese nella <span className="font-bold">Lista della Spesa</span>: prima cosa serve in "Da acquistare", poi la sposti in "Acquistato" con prezzo e acquirente.</li>
                <li>In <span className="font-bold">Spese Totali → Saldi</span> vedi chi deve dare o ricevere e chi paga chi, e con <span className="font-bold">Condividi resoconto</span> lo mandi nel gruppo.</li>
              </ol>
            </div>
          </div>
        )}
      </main>

      {/* Registrazione acquisto di una voce "Da Acquistare" */}
      {buying && (
        <div onClick={() => setBuying(null)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-3 shadow-2xl">
            <h3 className="font-rustic text-lg text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2">
              Acquistata: {buying.name}{buying.qty ? ` (${buying.qty})` : ''}
            </h3>
            <div>
              <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Prezzo (€)</label>
              <input
                type="number" min="0" step="0.01" inputMode="decimal" autoFocus
                value={buying.price}
                onChange={(e) => setBuying((b) => ({ ...b, price: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && confirmBuy()}
                placeholder="0.00"
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Acquirente</label>
              <input
                type="text"
                list="acquirenti"
                value={buying.buyer}
                onChange={(e) => setBuying((b) => ({ ...b, buyer: e.target.value }))}
                placeholder="Chi ha acquistato"
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Tipologia</label>
              <select
                value={buying.type}
                onChange={(e) => setBuying((b) => ({ ...b, type: e.target.value }))}
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold"
              >
                {Object.keys(PURCHASE_TYPES).map((k) => (<option key={k} value={k}>{PURCHASE_TYPES[k]}</option>))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setBuying(null)} className="flex-1 py-2.5 bg-white border border-[#8F9E8B]/50 text-gray-500 rounded text-xs font-bold uppercase">Annulla</button>
              <button onClick={confirmBuy} className="flex-1 py-2.5 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]">Conferma</button>
            </div>
          </div>
        </div>
      )}

      {/* Scelta dello snapshot da ripristinare */}
      {snapList && (
        <div onClick={() => setSnapList(null)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-2 max-h-[70vh] overflow-y-auto shadow-2xl">
            <h3 className="font-rustic text-lg text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2">Ripristina un salvataggio</h3>
            <p className="text-[10px] text-gray-500">Copie automatiche giornaliere. Scegli il giorno a cui tornare.</p>
            {snapList.map((id) => (
              <button
                key={id}
                onClick={() => restoreSnapshot(id)}
                className="w-full py-2.5 bg-[#F0F4F1] border border-[#8F9E8B]/40 rounded text-sm font-bold text-[#2D392C] hover:bg-[#E2EAE4]"
              >
                {parseDate(id).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })}
              </button>
            ))}
            <button onClick={() => setSnapList(null)} className="w-full py-2 text-xs uppercase font-bold text-gray-500 hover:text-gray-700">Annulla</button>
          </div>
        </div>
      )}

      {/* Visualizzatore scontrino a schermo intero (tocca per chiudere) */}
      {viewReceipt && (
        <div
          onClick={() => setViewReceipt(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-pointer"
        >
          <img src={viewReceipt} alt="Scontrino" className="max-w-full max-h-full rounded shadow-2xl" />
          <span className="absolute bottom-6 left-0 right-0 text-center text-[10px] uppercase tracking-widest text-white/60">Tocca per chiudere</span>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#F0F4F1] border-t-2 border-[#5C4A3C] py-3 px-4 text-center z-10">
        <div className="font-rustic text-[#2D392C] tracking-widest text-sm uppercase font-bold">{BRAND.footerMotto}</div>
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
