/* File GENERATO da App.jsx tramite Babel (node build.js). Non modificare a mano. */
const {
  useState,
  useEffect,
  useRef
} = React;
const {
  createRoot
} = ReactDOM;

// ---------- Utility ----------

// Formatta una Date in 'YYYY-MM-DD' usando l'ora LOCALE (niente UTC),
// evitando lo sfasamento di un giorno dei fusi orari.
const pad = n => String(n).padStart(2, '0');
const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Interpreta 'YYYY-MM-DD' come data locale (non UTC).
const parseDate = s => {
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

// Cronologia delle modifiche per la fusione fra dispositivi (vedi sync-merge.js).
const SYNC_META_KEY = 'cambusa_syncmeta';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const money = n => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
// Numero >= 0 a partire da una stringa di input.
const posNum = v => Math.max(0, parseFloat(v) || 0);
const initialDayState = () => ({
  note: '',
  guestsNames: '',
  meals: {}
});

// Branding e funzionalità: letti da window.APP_CONFIG (firebase-config.js),
// con fallback ai valori attuali se la configurazione non è presente.
const CFG = typeof window !== 'undefined' && window.APP_CONFIG || {};
const BRAND = {
  appTitle: 'PRATO LUNGO 2026',
  groupName: 'Brigata Fabio Bandone',
  splashLine1: 'BRIGATA',
  splashLine2: 'FABIO BANDONE',
  splashTagline: 'Prato Lungo Forever',
  footerMotto: 'In BANDY we Trust',
  credits: 'Web app prodotta da Lorenzo Ballerini · Tutti i diritti riservati © 2026',
  ...(CFG.brand || {})
};
const FEATURES = {
  auth: false,
  rooms: false,
  equipExemption: false,
  ...(CFG.features || {})
};

// Periodo del campo. Durante il campo l'app si apre sul giorno corrente.
const CAMP_START = '2026-08-11';
const CAMP_END = '2026-08-16';
const defaultDateStr = () => {
  const today = toDateStr(new Date());
  return today >= CAMP_START && today <= CAMP_END ? today : CAMP_START;
};

// Tipologie di acquisto e a quale voce di spesa contribuiscono.
const PURCHASE_TYPES = {
  alimentare: 'Alimentare',
  bevande: 'Bevande',
  logistica: 'Logistica'
};

// Codici meteo WMO (Open-Meteo) -> icona e descrizione.
const wmoInfo = code => {
  if (code === 0) return {
    icon: '☀️',
    label: 'Sereno'
  };
  if (code === 1 || code === 2) return {
    icon: '🌤️',
    label: 'Poco nuvoloso'
  };
  if (code === 3) return {
    icon: '☁️',
    label: 'Coperto'
  };
  if (code === 45 || code === 48) return {
    icon: '🌫️',
    label: 'Nebbia'
  };
  if (code >= 51 && code <= 57) return {
    icon: '🌦️',
    label: 'Pioviggine'
  };
  if (code >= 61 && code <= 67) return {
    icon: '🌧️',
    label: 'Pioggia'
  };
  if (code >= 71 && code <= 77) return {
    icon: '🌨️',
    label: 'Neve'
  };
  if (code >= 80 && code <= 82) return {
    icon: '🌦️',
    label: 'Rovesci'
  };
  if (code === 85 || code === 86) return {
    icon: '🌨️',
    label: 'Rovesci di neve'
  };
  if (code >= 95) return {
    icon: '⛈️',
    label: 'Temporale'
  };
  return {
    icon: '🌡️',
    label: 'Meteo'
  };
};

// Dotazione personale base: uguale per tutti, non modificabile dall'app.
// Le voci con emphasis: true sono mostrate in evidenza (piu' grandi e sottolineate).
// Regole dell'accampamento (mostrate in maiuscolo e sottolineate).
// Testo VERBATIM come scritto da Lorenzo: non correggere.
const CAMP_RULES = ['Amici, parenti e prole al seguito sono sotto la stretta giurisdizione di chi li ha trascinati qui. Siete i domatori ufficiali delle vostre creature, grandi o piccole che siano: fate in modo che rispettino le regole dell\'accampamento. Istruiteli a dovere anche sull\' attrezzatura da portarsi.', 'Il vincitore del minigioco Bandy, sarà premiato dal EL Presidente  in una sontuosa cerimonia', 'Siamo in montagna, non ad Hogwarts. La griglia non si accende per magia, l\'acqua non levita fino alla cucina e le incrostazioni sulle pentole non scompaiono con un incantesimo. E\' richiesto l\'impegno di tutti, per far rilassare tutti.', 'Il bicchiere di chi sta cuocendo sulla braticola deve essere sempre pieno, adoperatevi di conseguenza se non volete incorrere nelle ire del presidente.', 'Gli ospiti non fanno ospiti. Niente, di personale ovviamente. Per fortuna la montagna offre notevole spazio.', 'Membri o ospiti single, di ambo i sessi, sono sempre i ben accetti nella tenda del El Presidente.'];
const BASE_GEAR = [{
  text: 'SEDIA PERSONALE PER ADULTI E EVENTUALI BAMBINI',
  emphasis: true
}, {
  text: 'Stoviglie, posate personali e bicchiere riutilizzabile',
  emphasis: true
}, {
  text: 'Borraccia'
}, {
  text: 'Canovacci'
}, {
  text: 'Luci LED'
}];

// Comprime una foto (scontrino) ridimensionandola e convertendola in JPEG,
// così da poterla salvare in localStorage senza esaurire lo spazio.
const compressImage = (file, maxDim = 1200, quality = 0.6) => new Promise((resolve, reject) => {
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
const BASE_STEP = 170; // millisecondi per passo al livello 1
const BASE_LEN = 3; // lunghezza di partenza a ogni livello
const LEVEL_EVERY = 15; // Bandy necessari per salire di livello
const LEVEL_SPEEDUP = 1.5; // di quanto accelera a ogni livello
const MIN_STEP = 45; // limite di velocità: sotto diventa ingiocabile
const GAME_ROWS = 19;

// Rumore deterministico: lo sfondo è sempre lo stesso ad ogni partita.
const seeded = n => {
  let s = n * 9301 + 49297;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
};
function drawForest(ctx, w, h, cell) {
  const rnd = seeded(7);
  ctx.fillStyle = '#24371F';
  ctx.fillRect(0, 0, w, h);
  // sottobosco a chiazze
  const px = Math.max(3, Math.round(cell / 5));
  for (let y = 0; y < h; y += px) {
    for (let x = 0; x < w; x += px) {
      const r = rnd();
      if (r > 0.86) {
        ctx.fillStyle = '#2E4527';
        ctx.fillRect(x, y, px, px);
      } else if (r > 0.8) {
        ctx.fillStyle = '#1D2C19';
        ctx.fillRect(x, y, px, px);
      }
    }
  }
  // chiome degli alberi viste dall'alto
  const canopies = 16;
  for (let i = 0; i < canopies; i++) {
    const cx = rnd() * w,
      cy = rnd() * h,
      rad = cell * (0.7 + rnd() * 0.9);
    const tone = ['#3E6B33', '#356029', '#477A38'][Math.floor(rnd() * 3)];
    for (let y = cy - rad; y < cy + rad; y += px) {
      for (let x = cx - rad; x < cx + rad; x += px) {
        const dx = x - cx,
          dy = y - cy;
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
  const edge = cell * 1.1; // fascia dei palazzi a destra e sinistra

  // asfalto
  ctx.fillStyle = '#3A3A3E';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += px) {
    for (let x = edge; x < w - edge; x += px) {
      const r = rnd();
      if (r > 0.9) {
        ctx.fillStyle = '#43434A';
        ctx.fillRect(x, y, px, px);
      } else if (r > 0.82) {
        ctx.fillStyle = '#333338';
        ctx.fillRect(x, y, px, px);
      }
    }
  }

  // marciapiedi + palazzi ai due bordi, con portoni appena visibili
  [0, w - edge].forEach((bx, side) => {
    ctx.fillStyle = '#6E6A63';
    ctx.fillRect(bx, 0, edge, h);
    ctx.fillStyle = '#5C5851';
    for (let y = 0; y < h; y += px * 3) ctx.fillRect(bx, y, edge, px); // lastre
    // portoni: rettangoli scuri con architrave chiara
    for (let y = cell * 1.2; y < h - cell; y += cell * 3.4) {
      const dw = edge * 0.62,
        dh = cell * 1.5;
      const dx = side === 0 ? bx + edge - dw : bx;
      ctx.fillStyle = '#4A3526';
      ctx.fillRect(dx, y, dw, dh);
      ctx.fillStyle = '#2E2119';
      ctx.fillRect(dx + px, y + px, dw - px * 2, dh - px * 2);
      ctx.fillStyle = '#8A8078';
      ctx.fillRect(dx, y - px, dw, px);
      ctx.fillStyle = '#C9A227'; // maniglia
      ctx.fillRect(side === 0 ? dx + px : dx + dw - px * 2, y + dh / 2, px, px);
    }
  });

  // strisce di mezzeria tratteggiate delle due corsie
  ctx.fillStyle = '#D8D3C4';
  [w * 0.3, w * 0.7].forEach(lx => {
    for (let y = 0; y < h; y += cell * 1.6) ctx.fillRect(lx - px / 2, y, px, cell * 0.8);
  });

  // rotaie del tram al centro
  const cx = w / 2,
    gauge = cell * 0.9;
  ctx.fillStyle = '#4E4A46';
  ctx.fillRect(cx - gauge / 2 - px, 0, gauge + px * 2, h); // massicciata
  ctx.fillStyle = '#6B4A32';
  for (let y = 0; y < h; y += cell * 0.9) ctx.fillRect(cx - gauge / 2 - px, y, gauge + px * 2, px); // traversine
  [cx - gauge / 2, cx + gauge / 2].forEach(rx => {
    ctx.fillStyle = '#B9BCC2';
    ctx.fillRect(rx - px / 2, 0, px, h);
    ctx.fillStyle = '#8E9298';
    ctx.fillRect(rx + px / 2, 0, Math.max(1, px / 2), h);
  });
}

// Livello 2+: il corpo è un tubo cartoon a blocchi (stile fumetto, non
// realistico) con la punta arrotondata e due lobi alla base.
const SK = {
  skin: '#E4A882',
  shade: '#C98D68',
  light: '#F4CFAF',
  tip: '#E8A090',
  crease: '#A9714F'
};
// Livello 1: la canna come cilindro continuo, con brace tonda e sfumata
// e filtro in fondo (prima era una catena di quadretti staccati).
const JO = {
  paper: '#F6EFDF',
  paper2: '#E9DFC7',
  seam: '#DCCFB2',
  filter: '#B98F5E',
  filter2: '#9C7345'
};
function drawJoint(ctx, snake, i, cell, offX, offY, dir) {
  const seg = snake[i];
  const x = offX + seg.x * cell,
    y = offY + seg.y * cell;
  const u = cell / 10;
  const T = cell - u * 3.6; // spessore della cartina
  const cx = x + cell / 2,
    cy = y + cell / 2;
  const total = snake.length;
  const bandTo = nb => {
    if (!nb) return;
    const dx = nb.x - seg.x,
      dy = nb.y - seg.y;
    if (dx > 0) ctx.fillRect(cx, cy - T / 2, cell / 2 + 1, T);else if (dx < 0) ctx.fillRect(x - 1, cy - T / 2, cell / 2 + 1, T);else if (dy > 0) ctx.fillRect(cx - T / 2, cy, T, cell / 2 + 1);else if (dy < 0) ctx.fillRect(cx - T / 2, y - 1, T, cell / 2 + 1);
  };
  if (i === 0) {
    const d = dir && (dir.x || dir.y) ? dir : {
      x: 0,
      y: -1
    };
    // cartina fino alla punta
    ctx.fillStyle = JO.paper;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[1]);
    // brace: cerchio con sfumatura + alone morbido
    const ex = cx + d.x * u * 1.2,
      ey = cy + d.y * u * 1.2;
    const r = T * 0.5;
    const glow = ctx.createRadialGradient(ex, ey, r * 0.3, ex, ey, r * 2.1);
    glow.addColorStop(0, 'rgba(255,150,40,0.45)');
    glow.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ex, ey, r * 2.1, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(ex - r * 0.25, ey - r * 0.25, r * 0.1, ex, ey, r);
    g.addColorStop(0, '#FFF3C4');
    g.addColorStop(0.4, '#FFB13B');
    g.addColorStop(0.8, '#E06A0C');
    g.addColorStop(1, '#8E3406');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (i === total - 1 && total > 2) {
    // filtro di cartoncino
    ctx.fillStyle = JO.filter;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[i - 1]);
    ctx.fillStyle = JO.filter2;
    const horizT = snake[i - 1].y === seg.y;
    if (horizT) ctx.fillRect(cx - T / 2, cy - T / 2, u * 1.2, T);else ctx.fillRect(cx - T / 2, cy - T / 2, T, u * 1.2);
    return;
  }

  // corpo: cartina con una leggera ombra lungo l'asse
  ctx.fillStyle = JO.paper;
  ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
  bandTo(snake[i - 1]);
  bandTo(snake[i + 1]);
  const horiz = snake[i - 1] && snake[i - 1].y === seg.y || snake[i + 1] && snake[i + 1].y === seg.y;
  ctx.fillStyle = JO.paper2;
  if (horiz) ctx.fillRect(x, cy + T * 0.18, cell, u * 1.1);else ctx.fillRect(cx + T * 0.18, y, u * 1.1, cell);
  ctx.fillStyle = JO.seam; // cucitura della cartina
  if (i % 3 === 0) {
    if (horiz) ctx.fillRect(cx - u * 0.4, cy - T / 2, u * 0.8, T);else ctx.fillRect(cx - T / 2, cy - u * 0.4, T, u * 0.8);
  }
}
function drawBody(ctx, snake, i, cell, offX, offY, dir) {
  const seg = snake[i];
  const x = offX + seg.x * cell,
    y = offY + seg.y * cell;
  const u = cell / 10;
  const T = cell - u * 2.6; // spessore unico per tutto il fusto
  const cx = x + cell / 2,
    cy = y + cell / 2;
  const total = snake.length;

  // banda dal centro della cella verso un segmento vicino: garantisce
  // spessore uniforme anche nelle curve (niente gradini)
  const bandTo = n => {
    if (!n) return;
    const dx = n.x - seg.x,
      dy = n.y - seg.y;
    if (dx > 0) ctx.fillRect(cx, cy - T / 2, cell / 2 + 1, T);else if (dx < 0) ctx.fillRect(x - 1, cy - T / 2, cell / 2 + 1, T);else if (dy > 0) ctx.fillRect(cx - T / 2, cy, T, cell / 2 + 1);else if (dy < 0) ctx.fillRect(cx - T / 2, y - 1, T, cell / 2 + 1);
  };
  if (i === 0) {
    // Punta a mezza sfera orientata nel senso di marcia
    const d = dir && (dir.x || dir.y) ? dir : {
      x: 0,
      y: -1
    };
    const th = Math.atan2(d.y, d.x);
    ctx.fillStyle = SK.skin;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[1]);
    ctx.fillStyle = SK.tip;
    ctx.beginPath();
    ctx.arc(cx, cy, T / 2, th - Math.PI / 2, th + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SK.light;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(th - 0.7) * T * 0.22, cy + Math.sin(th - 0.7) * T * 0.22, T * 0.12, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (i === total - 1 && total > 2) {
    // Base: due lobi ben visibili
    ctx.fillStyle = SK.skin;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[i - 1]);
    const prev = snake[i - 1];
    const vertical = prev.x === seg.x; // lobi affiancati rispetto all'asse
    const r = cell * 0.34,
      off = cell * 0.33;
    const lobe = (a, b) => {
      ctx.beginPath();
      ctx.arc(a, b, r, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.fillStyle = SK.shade;
    if (vertical) {
      lobe(cx - off, cy + u * 0.8);
      lobe(cx + off, cy + u * 0.8);
    } else {
      lobe(cx + u * 0.8, cy - off);
      lobe(cx + u * 0.8, cy + off);
    }
    // piega centrale: fa leggere due lobi distinti invece di un ovale unico
    ctx.fillStyle = SK.crease;
    if (vertical) ctx.fillRect(cx - u * 0.25, cy - u * 0.6, u * 0.5, r * 1.5);else ctx.fillRect(cx - u * 0.6, cy - u * 0.25, r * 1.5, u * 0.5);
    ctx.fillStyle = SK.skin; // raccordo sopra i lobi
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    return;
  }

  // Fusto: spessore identico per ogni segmento
  ctx.fillStyle = SK.skin;
  ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
  bandTo(snake[i - 1]);
  bandTo(snake[i + 1]);
  // luce lungo l'asse del tubo
  const horiz = snake[i - 1] && snake[i - 1].y === seg.y || snake[i + 1] && snake[i + 1].y === seg.y;
  ctx.fillStyle = SK.light;
  if (horiz) ctx.fillRect(x, cy - T * 0.34, cell, u * 1.2);else ctx.fillRect(cx - T * 0.34, y, u * 1.2, cell);
}
function BandyGame({
  playerName,
  onExit,
  onGameOver,
  bestLocal
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
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
    const mkBg = fn => {
      const c = document.createElement('canvas');
      c.width = canvas.width;
      c.height = canvas.height;
      fn(c.getContext('2d'), canvas.width, canvas.height, cell);
      return c;
    };
    const bgForest = mkBg(drawForest);
    const bgStreet = mkBg(drawStreet);
    bgRef.current = bgForest;
    const img = new Image();
    img.src = './bandy.png';
    const st = {
      snake: [{
        x: 7,
        y: 12
      }, {
        x: 7,
        y: 13
      }, {
        x: 7,
        y: 14
      }],
      dir: {
        x: 0,
        y: -1
      },
      queue: [],
      food: {
        x: 7,
        y: 5
      },
      score: 0,
      alive: true,
      acc: 0,
      last: 0,
      step: BASE_STEP,
      level: 1
    };
    stateRef.current = st;
    canvas.__game = st; // aggancio per i test automatici (non usato dall'app)

    const placeFood = () => {
      let p,
        tries = 0;
      do {
        p = {
          x: Math.floor(Math.random() * GAME_COLS),
          y: Math.floor(Math.random() * GAME_ROWS)
        };
        tries++;
      } while (tries < 200 && st.snake.some(s => s.x === p.x && s.y === p.y));
      st.food = p;
    };
    const offX = Math.floor((canvas.width - cell * GAME_COLS) / 2);
    const offY = Math.floor((canvas.height - cell * GAME_ROWS) / 2);
    const draw = () => {
      ctx.drawImage(bgRef.current, 0, 0);
      // Bandy da raccogliere
      const f = st.food;
      const fcx = offX + f.x * cell + cell / 2,
        fcy = offY + f.y * cell + cell / 2;
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
        // dal fondo verso la testa, così la punta resta sopra
        for (let i = st.snake.length - 1; i >= 0; i--) {
          drawBody(ctx, st.snake, i, cell, offX, offY, st.dir);
        }
        return;
      }
      // la canna: dal fondo verso la testa, così la brace resta sopra
      for (let i = st.snake.length - 1; i >= 0; i--) {
        drawJoint(ctx, st.snake, i, cell, offX, offY, st.dir);
      }
    };
    const tick = ts => {
      if (!stateRef.current) return;
      if (!st.last) st.last = ts;
      const dt = ts - st.last;
      st.last = ts;
      if (st.alive && !st.pause) {
        st.acc += dt;
        if (st.acc >= st.step) {
          st.acc = 0;
          if (st.queue.length) st.dir = st.queue.shift();
          const head = {
            x: st.snake[0].x + st.dir.x,
            y: st.snake[0].y + st.dir.y
          };
          const hitWall = head.x < 0 || head.y < 0 || head.x >= GAME_COLS || head.y >= GAME_ROWS;
          const hitSelf = st.snake.some(s => s.x === head.x && s.y === head.y);
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
                // a ogni livello la velocità aumenta di una volta e mezza
                st.step = Math.max(MIN_STEP, Math.round(BASE_STEP / Math.pow(LEVEL_SPEEDUP, nextLevel - 1)));
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
      if (last.x === -x && last.y === -y) return; // niente inversione a U
      if (last.x === x && last.y === y) return; // già in questa direzione
      if (st.queue.length < 2) st.queue.push({
        x,
        y
      });
      // Se il passo è già a metà, lo anticipo: la svolta si vede subito
      // invece di aspettare fino a un tick intero.
      if (st.acc >= st.step * 0.45) st.acc = st.step;
    };
    const onKey = e => {
      const k = e.key;
      if (['ArrowUp', 'w', 'W'].includes(k)) {
        turn(0, -1);
        e.preventDefault();
      } else if (['ArrowDown', 's', 'S'].includes(k)) {
        turn(0, 1);
        e.preventDefault();
      } else if (['ArrowLeft', 'a', 'A'].includes(k)) {
        turn(-1, 0);
        e.preventDefault();
      } else if (['ArrowRight', 'd', 'D'].includes(k)) {
        turn(1, 0);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    let sx = 0,
      sy = 0,
      swiped = false;
    const onStart = e => {
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      swiped = false;
    };
    const onMove = e => {
      if (swiped) return;
      const t = e.touches[0];
      const dx = t.clientX - sx,
        dy = t.clientY - sy;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
      // Svolta appena il dito ha percorso abbastanza: non aspetta il rilascio.
      if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);else turn(0, dy > 0 ? 1 : -1);
      swiped = true;
    };
    canvas.addEventListener('touchstart', onStart, {
      passive: true
    });
    canvas.addEventListener('touchmove', onMove, {
      passive: true
    });
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

  // Schermo intero: su Android/desktop usa l'API Fullscreen; su iPhone quella
  // API non esiste, ma il gioco è già un overlay che copre tutto lo schermo.
  useEffect(() => {
    const el = wrapRef.current;
    const req = el && (el.requestFullscreen || el.webkitRequestFullscreen);
    if (req) {
      try {
        req.call(el);
      } catch (e) {/* niente fullscreen: resta l'overlay */}
    }
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
        try {
          exit.call(document);
        } catch (e) {/* ignora */}
      }
    };
  }, []);
  const nudge = (x, y) => {
    const st = stateRef.current;
    if (st && st.turn) st.turn(x, y);
  };
  const togglePause = () => {
    const st = stateRef.current;
    if (!st || !st.alive) return;
    st.pause = !st.pause;
    setPaused(st.pause);
  };
  return /*#__PURE__*/React.createElement("div", {
    ref: wrapRef,
    className: "fixed inset-0 z-50 bg-[#1F271E] flex flex-col gap-2 p-2",
    style: {
      paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
      paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between bg-white/95 px-3 py-2 rounded-lg shrink-0"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs uppercase font-bold text-gray-500 truncate"
  }, playerName), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic text-lg text-[#2D392C]"
  }, score, " \uD83C\uDF3F"), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-gray-400"
  }, "liv. ", level, level >= 2 ? ' 🏙️' : '', " \xB7 -", Math.max(0, level * 15 - score), " \xB7 rec ", bestLocal)), /*#__PURE__*/React.createElement("div", {
    className: "relative flex-1 min-h-0 flex items-center justify-center"
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    width: 360,
    height: 456,
    className: "rounded-lg border-2 border-[#2D392C]/40 touch-none max-h-full max-w-full",
    style: {
      imageRendering: 'pixelated',
      height: '100%',
      width: 'auto',
      aspectRatio: '360 / 456'
    }
  }), levelUp && !over && /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 flex items-center justify-center pointer-events-none"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-black/70 px-5 py-3 rounded-lg text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-rustic text-2xl text-[#D97706]"
  }, "LIVELLO ", level), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] uppercase tracking-widest text-[#F0F4F1]"
  }, level === 2 ? 'In città!' : 'Ancora più veloce!'))), (over || paused) && /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center text-center p-4"
  }, over ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "font-rustic text-2xl text-[#F0F4F1]"
  }, "Bandy \xE8 scappato!"), /*#__PURE__*/React.createElement("div", {
    className: "text-[#D97706] font-rustic text-3xl my-2"
  }, score), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] text-gray-300 mb-4"
  }, score > bestLocal ? 'Nuovo record personale! 🎉' : `Il tuo record resta ${bestLocal}`), /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    className: "px-6 py-2.5 bg-[#2D392C] text-white rounded font-bold uppercase text-xs"
  }, "Chiudi")) : /*#__PURE__*/React.createElement("div", {
    className: "font-rustic text-xl text-[#F0F4F1]"
  }, "In pausa"))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2 max-w-[240px] w-full mx-auto shrink-0"
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      nudge(0, -1);
    },
    "aria-label": "Su",
    className: "py-3 bg-[#2D392C] text-white rounded font-bold"
  }, "\u25B2"), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      nudge(-1, 0);
    },
    "aria-label": "Sinistra",
    className: "py-3 bg-[#2D392C] text-white rounded font-bold"
  }, "\u25C0"), /*#__PURE__*/React.createElement("button", {
    onClick: togglePause,
    "aria-label": "Pausa",
    className: "py-3 bg-[#5C4A3C] text-white rounded font-bold text-xs"
  }, paused ? '▶' : '❚❚'), /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      nudge(1, 0);
    },
    "aria-label": "Destra",
    className: "py-3 bg-[#2D392C] text-white rounded font-bold"
  }, "\u25B6"), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      nudge(0, 1);
    },
    "aria-label": "Gi\xF9",
    className: "py-3 bg-[#2D392C] text-white rounded font-bold"
  }, "\u25BC"), /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    className: "w-full py-1.5 text-[11px] uppercase font-bold text-[#8F9E8B] hover:text-white shrink-0"
  }, "Esci dal gioco"));
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
        if (n > 0) seed.push({
          id: uid(),
          name,
          price: n,
          type,
          at: Date.now()
        });
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
  const [weather, setWeather] = useState(() => load('cambusa_weather', {
    fetchedAt: 0,
    byDate: {}
  }));

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

  // Campi chiusi e archiviati: restano consultabili e scaricabili, ma non
  // fanno più parte dei dati di lavoro.
  const [archives, setArchives] = useState(() => load('cambusa_archives', []));
  const [closing, setClosing] = useState(false); // modale "Chiudi il campo"
  const [closeName, setCloseName] = useState('');
  const [viewArchive, setViewArchive] = useState(null); // resoconto aperto

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
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
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
    const onKey = e => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ---------- Stato sincronizzazione cloud (Firebase) ----------
  const [cloud, setCloud] = useState({
    connected: false,
    status: 'idle',
    code: null,
    lastSync: null,
    error: null
  });
  const [campCodeInput, setCampCodeInput] = useState(typeof window !== 'undefined' && window.CAMP_CODE_DEFAULT || '');
  const cloudConnectedRef = useRef(false);
  const suppressPushRef = useRef(false);

  // Stato sincronizzato sempre aggiornato: serve alla fusione, che deve
  // partire dai dati di ADESSO e non da quelli di quando ci si è connessi.
  const syncStateRef = useRef(null);
  syncStateRef.current = {
    members,
    campData,
    purchases,
    gear,
    settled,
    equipment,
    toBuy
  };

  // Cronologia delle modifiche (data di ultima modifica/cancellazione per ogni
  // voce). Al primo avvio i dati già presenti restano "senza data": qualsiasi
  // modifica altrui, essendo datata, ha la precedenza.
  const metaRef = useRef(null);
  if (metaRef.current === null) {
    const saved = load(SYNC_META_KEY, null);
    const SM = window.SyncMerge;
    metaRef.current = saved && saved.rev ? {
      flat: saved.flat || {},
      rev: saved.rev,
      del: saved.del || {}
    } : {
      flat: SM ? SM.flatten(syncStateRef.current) : {},
      rev: {},
      del: {}
    };
  }
  const saveMeta = m => {
    metaRef.current = m;
    try {
      localStorage.setItem(SYNC_META_KEY, JSON.stringify(m));
    } catch (e) {/* spazio esaurito */}
  };

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
  useEffect(() => {
    try {
      localStorage.setItem('cambusa_archives', JSON.stringify(archives));
    } catch (e) {
      console.warn('Spazio esaurito: l\'archivio resta nel cloud e nei file scaricati.');
    }
  }, [archives]);

  // Scarica le previsioni (16 giorni) se c'è linea, la località è impostata e
  // la cache ha più di un'ora. Navigando tra i giorni i dati sono già pronti.
  useEffect(() => {
    const loc = window.CAMP_LOCATION;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return;
    if (!navigator.onLine) return;
    if (Date.now() - weather.fetchedAt < 60 * 60 * 1000) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`).then(r => r.json()).then(j => {
      const d = j && j.daily;
      if (!d || !Array.isArray(d.time)) return;
      const byDate = {};
      d.time.forEach((t, i) => {
        byDate[t] = {
          code: d.weather_code[i],
          tmax: d.temperature_2m_max[i],
          tmin: d.temperature_2m_min[i],
          rain: d.precipitation_probability_max[i]
        };
      });
      setWeather({
        fetchedAt: Date.now(),
        byDate
      });
    }).catch(() => {/* offline o API non raggiungibile: resta la cache */});
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

  // Pulizia: elimina le foto locali di voci che non esistono più (es. acquisto
  // cancellato da un altro dispositivo). Vanno considerate TUTTE le liste che
  // possono avere uno scontrino, altrimenti si perdono le foto delle voci
  // ancora da acquistare o dell'attrezzatura.
  useEffect(() => {
    setReceipts(prev => {
      const ids = new Set([...purchases.map(p => p.id), ...toBuy.map(t => t.id), ...equipment.map(e => e.id)]);
      const keys = Object.keys(prev);
      if (keys.every(k => ids.has(k))) return prev;
      const copy = {};
      keys.forEach(k => {
        if (ids.has(k)) copy[k] = prev[k];
      });
      return copy;
    });
  }, [purchases, toBuy, equipment]);
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
  // Arrivano i dati di un altro dispositivo: si FONDONO con i nostri voce per
  // voce (vedi sync-merge.js). Senza questa fusione, due telefoni che hanno
  // lavorato offline al campo si cancellerebbero il lavoro a vicenda: il
  // secondo che torna online sovrascriverebbe tutto.
  const applyRemote = remote => {
    const SM = window.SyncMerge;
    const rmeta = remote && remote._meta;
    const local = syncStateRef.current;

    // Dispositivo con la versione vecchia (dati senza cronologia): si torna al
    // comportamento di prima, cioè si prende quello che arriva.
    if (!SM || !rmeta || rmeta.v !== SM.VERSION) {
      suppressPushRef.current = true;
      const next = {
        ...local
      };
      if (Array.isArray(remote.members)) {
        setMembers(remote.members);
        next.members = remote.members;
      }
      if (remote.campData && typeof remote.campData === 'object') {
        setCampData(remote.campData);
        next.campData = remote.campData;
      }
      if (Array.isArray(remote.purchases)) {
        setPurchases(remote.purchases);
        next.purchases = remote.purchases;
      }
      if (Array.isArray(remote.gear)) {
        setGear(remote.gear);
        next.gear = remote.gear;
      }
      if (Array.isArray(remote.settled)) {
        setSettled(remote.settled);
        next.settled = remote.settled;
      }
      if (Array.isArray(remote.equipment)) {
        setEquipment(remote.equipment);
        next.equipment = remote.equipment;
      }
      if (Array.isArray(remote.toBuy)) {
        setToBuy(remote.toBuy);
        next.toBuy = remote.toBuy;
      }
      if (SM) saveMeta({
        flat: SM.flatten(next),
        rev: metaRef.current.rev,
        del: metaRef.current.del
      });
      setTimeout(() => {
        suppressPushRef.current = false;
      }, 0);
      return;
    }
    const remoteState = {
      ...remote
    };
    delete remoteState._meta;
    const res = SM.merge(local, metaRef.current, remoteState, rmeta);
    // Se il risultato è già identico a quello ricevuto non c'è niente da
    // rimandare indietro; altrimenti il push riporta all'altro ciò che gli manca.
    suppressPushRef.current = SM.sameAs(res.meta, remoteState, rmeta);
    setMembers(res.state.members);
    setCampData(res.state.campData);
    setPurchases(res.state.purchases);
    setGear(res.state.gear);
    setSettled(res.state.settled);
    setEquipment(res.state.equipment);
    setToBuy(res.state.toBuy);
    saveMeta(res.meta);
    setTimeout(() => {
      suppressPushRef.current = false;
    }, 0);
  };
  const connectCloud = async code => {
    const CS = window.CloudSync;
    if (!CS || !CS.isConfigured()) {
      window.alert('Firebase non è configurato. Incolla la config del tuo progetto in firebase-config.js.');
      return;
    }
    const c = (code || '').trim();
    if (!c) {
      window.alert('Inserisci il codice del campo.');
      return;
    }
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
  const handleCloudReceipts = cloudMap => {
    const local = receiptsRef.current;
    const CS = window.CloudSync;
    Object.keys(local).forEach(id => {
      if (!cloudMap[id] && CS && CS.isConnected()) CS.putReceipt(id, local[id]);
    });
    setReceipts(prev => ({
      ...prev,
      ...cloudMap
    }));
  };

  // All'avvio: aggancia lo stato e si connette DA SOLO col codice campo
  // (salvato o predefinito). Chi ha premuto Disconnetti resta fuori finché
  // non riattiva manualmente (flag cambusa_sync_optout).
  useEffect(() => {
    const CS = window.CloudSync;
    if (!CS) return;
    CS.onStatus(s => {
      cloudConnectedRef.current = s.connected;
      setCloud(s);
    });
    if (CS.onReceipts) CS.onReceipts(handleCloudReceipts);
    const optedOut = localStorage.getItem('cambusa_sync_optout') === '1';
    const code = CS.savedCode() || window.CAMP_CODE_DEFAULT || '';
    if (code && CS.isConfigured() && !optedOut) {
      setCampCodeInput(code);
      CS.connect(window.FIREBASE_CONFIG, code, applyRemote).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ogni modifica viene datata (anche offline: è proprio lì che serve, perché
  // al ritorno della linea si sappia cosa è più recente) e poi inviata.
  // Se offline, Firestore mette la scrittura in coda e la invia da solo.
  useEffect(() => {
    const SM = window.SyncMerge;
    const st = syncStateRef.current;
    if (SM && !suppressPushRef.current) saveMeta(SM.bump(st, metaRef.current, Date.now()));
    if (!cloudConnectedRef.current) return;
    if (suppressPushRef.current) return;
    const m = metaRef.current;
    if (window.CloudSync) {
      window.CloudSync.pushState({
        ...st,
        _meta: {
          v: SM ? SM.VERSION : 0,
          rev: m.rev,
          del: m.del
        }
      });
    }
  }, [members, campData, purchases, gear, settled, equipment, toBuy]);

  // ---------- Dati per giorno ----------
  const getDayData = dateStr => ({
    ...initialDayState(),
    ...(campData[dateStr] || {})
  });
  const updateDayData = (dateStr, field, value) => {
    setCampData(prev => ({
      ...prev,
      [dateStr]: {
        ...initialDayState(),
        ...(prev[dateStr] || {}),
        [field]: value
      }
    }));
  };
  const getMeal = (dateStr, memberId) => {
    const day = campData[dateStr];
    return day && day.meals && day.meals[memberId] || {
      lunch: false,
      dinner: false
    };
  };
  const toggleMeal = (dateStr, memberId, mealType) => {
    setCampData(prev => {
      const day = {
        ...initialDayState(),
        ...(prev[dateStr] || {})
      };
      const meals = {
        ...(day.meals || {})
      };
      const cur = meals[memberId] || {
        lunch: false,
        dinner: false
      };
      meals[memberId] = {
        ...cur,
        [mealType]: !cur[mealType]
      };
      return {
        ...prev,
        [dateStr]: {
          ...day,
          meals
        }
      };
    });
  };

  // Segna (o toglie) TUTTI i membri a pranzo/cena per il giorno: se sono già
  // tutti segnati, li toglie tutti; altrimenti li segna tutti.
  const setAllMeals = (dateStr, mealType) => {
    if (members.length === 0) return;
    setCampData(prev => {
      const day = {
        ...initialDayState(),
        ...(prev[dateStr] || {})
      };
      const meals = {
        ...(day.meals || {})
      };
      const allOn = members.every(m => meals[m.id] && meals[m.id][mealType]);
      members.forEach(m => {
        const cur = meals[m.id] || {
          lunch: false,
          dinner: false
        };
        meals[m.id] = {
          ...cur,
          [mealType]: !allOn
        };
      });
      return {
        ...prev,
        [dateStr]: {
          ...day,
          meals
        }
      };
    });
  };

  // Copia le presenze (pranzo e cena) dal giorno precedente.
  const copyFromPreviousDay = () => {
    const d = parseDate(selectedDateStr);
    d.setDate(d.getDate() - 1);
    const prevStr = toDateStr(d);
    const prevMeals = campData[prevStr] && campData[prevStr].meals || {};
    if (!Object.keys(prevMeals).length) {
      window.alert('Nessuna presenza registrata il giorno precedente.');
      return;
    }
    const curMeals = campData[selectedDateStr] && campData[selectedDateStr].meals || {};
    const hasAny = Object.values(curMeals).some(m => m && (m.lunch || m.dinner));
    if (hasAny && !window.confirm('Questo giorno ha già delle presenze: sostituirle con quelle di ieri?')) return;
    setCampData(prev => {
      const day = {
        ...initialDayState(),
        ...(prev[selectedDateStr] || {})
      };
      return {
        ...prev,
        [selectedDateStr]: {
          ...day,
          meals: JSON.parse(JSON.stringify(prevMeals))
        }
      };
    });
  };

  // ---------- Gestione membri ----------
  const addMember = () => {
    const name = newMemberName.trim();
    if (!name) return;
    setMembers(prev => [...prev, {
      id: uid(),
      name,
      isChild: newMemberChild
    }]);
    setNewMemberName('');
    setNewMemberChild(false);
  };
  const removeMember = id => {
    const m = members.find(x => x.id === id);
    if (m && !window.confirm(`Eliminare ${m.name} dai membri?\nLe sue presenze e i suoi pasti non conteranno più nei calcoli.`)) return;
    setMembers(prev => prev.filter(x => x.id !== id));
  };
  const toggleChild = id => {
    setMembers(prev => prev.map(m => m.id === id ? {
      ...m,
      isChild: !m.isChild
    } : m));
  };

  // Esenzione dalla spesa per l'attrezzatura aggiunta.
  const toggleEquipExempt = id => {
    setMembers(prev => prev.map(m => m.id === id ? {
      ...m,
      equipExempt: !m.equipExempt
    } : m));
  };

  // ---------- Lista "Da Acquistare" ----------
  const addToBuy = () => {
    const name = newBuyName.trim();
    if (!name) return;
    setToBuy(prev => [...prev, {
      id: uid(),
      name,
      qty: newBuyQty.trim()
    }]);
    setNewBuyName('');
    setNewBuyQty('');
  };
  const removeToBuy = id => {
    const it = toBuy.find(x => x.id === id);
    if (it && !window.confirm(`Eliminare "${it.name}" dalla lista da acquistare?`)) return;
    setToBuy(prev => prev.filter(x => x.id !== id));
    setReceipts(prev => {
      if (!prev[id]) return prev;
      const copy = {
        ...prev
      };
      delete copy[id];
      return copy;
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
      setReceipts(prev => ({
        ...prev,
        [id]: dataUrl
      }));
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
    if (price <= 0) {
      window.alert('Inserisci un prezzo maggiore di zero.');
      return;
    }
    const fullName = buying.qty ? `${buying.name} (${buying.qty})` : buying.name;
    setPurchases(prev => [...prev, {
      id: buying.id,
      name: fullName,
      price,
      type: buying.type,
      buyer: (buying.buyer || '').trim(),
      at: Date.now(),
      fromList: true
    }]);
    setToBuy(prev => prev.filter(x => x.id !== buying.id));
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
    setPurchases(prev => [...prev, {
      id,
      name,
      price,
      type: pType,
      buyer: pBuyer.trim(),
      at: Date.now()
    }]);
    if (pReceipt) {
      setReceipts(prev => ({
        ...prev,
        [id]: pReceipt
      }));
      if (window.CloudSync) window.CloudSync.putReceipt(id, pReceipt);
    }
    setPName('');
    setPPrice('');
    setPType('alimentare');
    setPBuyer('');
    setPReceipt(null);
  };
  const removePurchase = id => {
    const p = purchases.find(x => x.id === id);
    if (p && !window.confirm(`Eliminare l'acquisto "${p.name}" (${money(posNum(p.price))} €)?\nVerrà tolto dai totali${receipts[id] ? ' insieme alla foto dello scontrino' : ''}.`)) return;
    setPurchases(prev => prev.filter(x => x.id !== id));
    setReceipts(prev => {
      if (!prev[id]) return prev;
      const copy = {
        ...prev
      };
      delete copy[id];
      return copy;
    });
    if (window.CloudSync) window.CloudSync.deleteReceipt(id);
  };
  const onReceiptFile = async e => {
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
  const restoreSnapshot = async id => {
    if (!window.confirm(`Ripristinare i dati salvati il ${id}?\nI dati attuali verranno sostituiti su TUTTI i dispositivi connessi.`)) return;
    const CS = window.CloudSync;
    const json = await CS.getSnapshot(id);
    if (!json) {
      window.alert('Impossibile leggere questo salvataggio.');
      return;
    }
    try {
      const d = JSON.parse(json);
      // Set "normali" (non via applyRemote): così il push parte e propaga
      // il ripristino a tutti i dispositivi.
      setMembers(Array.isArray(d.members) ? d.members : []);
      setCampData(d.campData && typeof d.campData === 'object' ? d.campData : {});
      setPurchases(Array.isArray(d.purchases) ? d.purchases : []);
      setGear(Array.isArray(d.gear) ? d.gear : []);
      setSettled(Array.isArray(d.settled) ? d.settled : []);
      setEquipment(Array.isArray(d.equipment) ? d.equipment : []);
      setToBuy(Array.isArray(d.toBuy) ? d.toBuy : []);
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
      t.transfers.forEach(x => lines.push(`• ${x.from} → ${x.to}: ${money(x.amount)} €`));
    }
    if (t.settlement.length > 0) {
      lines.push('');
      lines.push('📋 Dettaglio a testa:');
      t.settlement.forEach(s => {
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
      try {
        await navigator.share({
          title: 'Prato Lungo 2026 — Conti',
          text
        });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; /* altrimenti prova WhatsApp */
      }
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
    if (!n) {
      window.alert('Scrivi il tuo nome per entrare in classifica.');
      return;
    }
    localStorage.setItem('cambusa_player', n);
    setGameRunning(true);
  };
  const endGame = score => {
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
  const toggleSettled = key => {
    setSettled(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // ---------- Aggiunta attrezzatura ----------
  const addEquip = () => {
    const text = newEquipText.trim();
    if (!text) return;
    setEquipment(prev => [...prev, {
      id: uid(),
      text,
      price: posNum(newEquipPrice),
      bought: false,
      buyer: newEquipBuyer.trim()
    }]);
    setNewEquipText('');
    setNewEquipPrice('');
    setNewEquipBuyer('');
  };
  const toggleEquipBought = id => {
    setEquipment(prev => prev.map(e => e.id === id ? {
      ...e,
      bought: !e.bought
    } : e));
  };
  const removeEquip = id => {
    const e = equipment.find(x => x.id === id);
    if (e && !window.confirm(`Eliminare "${e.text}" dall'attrezzatura?`)) return;
    setEquipment(prev => prev.filter(x => x.id !== id));
    setReceipts(prev => {
      if (!prev[id]) return prev;
      const copy = {
        ...prev
      };
      delete copy[id];
      return copy;
    });
    if (window.CloudSync) window.CloudSync.deleteReceipt(id);
  };

  // ---------- Dotazioni aggiuntive ----------
  const addGear = () => {
    const text = newGearText.trim();
    if (!text) return;
    setGear(prev => [...prev, {
      id: uid(),
      text
    }]);
    setNewGearText('');
  };
  const removeGear = id => {
    const g = gear.find(x => x.id === id);
    if (g && !window.confirm(`Eliminare "${g.text}" dalle dotazioni?`)) return;
    setGear(prev => prev.filter(x => x.id !== id));
  };

  // ---------- Navigazione date ----------
  const changeWeek = days => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
    setSelectedDateStr(toDateStr(newDate));
  };
  const navigateDate = days => {
    const d = parseDate(selectedDateStr);
    d.setDate(d.getDate() + days);
    setSelectedDateStr(toDateStr(d));
    setCurrentDate(new Date(d));
  };
  const getDaysOfWeek = start => {
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
    const sumByType = t => purchases.reduce((s, p) => p.type === t ? s + posNum(p.price) : s, 0);
    const totalFood = sumByType('alimentare');
    const totalDrinks = sumByType('bevande');
    // Logistica dagli acquisti (divisa fra tutti i presenti) e attrezzatura
    // acquistata (divisa solo fra chi NON è esente): due quote separate.
    const logisticsPurchases = sumByType('logistica');
    const equipBought = equipment.reduce((s, e) => e.bought ? s + posNum(e.price) : s, 0);
    const totalAccessory = logisticsPurchases + equipBought;
    const totalFoodDrinks = totalFood + totalDrinks;
    const overallTotal = totalFoodDrinks + totalAccessory;

    // Pasti per membro sull'intero campo.
    const mealsByMember = {};
    members.forEach(m => mealsByMember[m.id] = 0);
    let adultMealsTotal = 0;
    const attendingAdults = new Set();
    const attendingForEquip = new Set(); // presenti NON esenti da attrezzatura

    Object.values(campData).forEach(day => {
      const meals = day && day.meals || {};
      members.forEach(m => {
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
    const breakdown = members.map(m => {
      const mealCount = mealsByMember[m.id] || 0;
      const foodShare = m.isChild ? 0 : mealCount * costPerMeal;
      const present = !m.isChild && mealCount > 0;
      const logShare = (present ? logisticsPerAdult : 0) + (present && equipDivisorSet.has(m.id) ? equipPerAdult : 0);
      return {
        ...m,
        mealCount,
        foodShare,
        logShare,
        owed: foodShare + logShare
      };
    });

    // --- Arrotondamento "cassa-friendly" ---
    // Ogni quota viene arrotondata a multipli di 0,10 € (niente monetine da
    // 1/2/5 cent). Lo scarto rispetto al totale reale viene riconciliato SOLO
    // se è >= 0,50 €: sotto quella soglia si lascia com'è (non vale la pena).
    const round10 = cents => Math.round(cents / 10) * 10;
    breakdown.forEach(b => {
      b.payCents = b.isChild ? 0 : round10(Math.round(b.owed * 100));
    });
    const targetCents = Math.round(overallTotal * 100);
    let residual = targetCents - breakdown.reduce((s, b) => s + b.payCents, 0);
    if (Math.abs(residual) >= 50) {
      // Redistribuisce lo scarto a passi di 10 cent, partendo da chi deve di più.
      const order = breakdown.filter(b => !b.isChild && b.owed > 0).sort((a, b) => b.owed - a.owed);
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
    breakdown.forEach(b => {
      b.pay = b.payCents / 100;
    });
    const collected = breakdown.reduce((s, b) => s + b.payCents, 0) / 100;
    const roundingDiff = collected - overallTotal;

    // Anticipi per acquirente: quanto ha speso ciascuno (per i rimborsi).
    const buyerMap = {};
    purchases.forEach(p => {
      const key = p.buyer && p.buyer.trim() ? p.buyer.trim() : '—';
      buyerMap[key] = (buyerMap[key] || 0) + posNum(p.price);
    });
    const byBuyer = Object.keys(buyerMap).map(name => ({
      name,
      total: buyerMap[name]
    })).sort((a, b) => b.total - a.total);

    // --- Saldo netto per persona (stile Splitwise): anticipato - dovuto ---
    const norm = s => (s || '').trim().toLowerCase();
    const paidByName = {}; // nome normalizzato -> { display, paid }
    purchases.forEach(p => {
      const raw = p.buyer && p.buyer.trim() ? p.buyer.trim() : '—';
      const key = norm(raw) || '—';
      if (!paidByName[key]) paidByName[key] = {
        display: raw,
        paid: 0
      };
      paidByName[key].paid += posNum(p.price);
    });
    // Attrezzatura acquistata: se ha un acquirente viene accreditata a lui
    // (verrà rimborsato); altrimenti è spesa comune ("non attribuita"). In
    // entrambi i casi la somma dei saldi resta zero.
    equipment.forEach(e => {
      if (!e.bought) return;
      const price = posNum(e.price);
      if (price <= 0) return;
      const raw = e.buyer && e.buyer.trim() ? e.buyer.trim() : '—';
      const key = norm(raw) || '—';
      if (!paidByName[key]) paidByName[key] = {
        display: raw,
        paid: 0
      };
      paidByName[key].paid += price;
    });
    const owedByName = {}; // nome membro normalizzato -> { display, owed }
    breakdown.forEach(b => {
      const key = norm(b.name);
      if (!owedByName[key]) owedByName[key] = {
        display: b.name,
        owed: 0
      };
      owedByName[key].owed += b.pay; // già arrotondato; bambini = 0
    });
    const unattributed = paidByName['—'] ? paidByName['—'].paid : 0;
    const allKeys = new Set([...Object.keys(paidByName), ...Object.keys(owedByName)]);
    allKeys.delete('—');
    const settlement = [];
    allKeys.forEach(k => {
      const paid = paidByName[k] ? paidByName[k].paid : 0;
      const owed = owedByName[k] ? owedByName[k].owed : 0;
      if (paid === 0 && owed === 0) return;
      const display = owedByName[k] && owedByName[k].display || paidByName[k] && paidByName[k].display || k;
      settlement.push({
        name: display,
        paid,
        owed,
        net: paid - owed
      });
    });
    settlement.sort((a, b) => b.net - a.net); // prima chi deve ricevere

    // Transazioni di pareggio: chi paga chi, col minor numero di giri.
    // Greedy sui centesimi: il debitore più grosso paga il creditore più grosso.
    const creditors = settlement.filter(s => s.net > 0.005).map(s => ({
      name: s.name,
      cents: Math.round(s.net * 100)
    }));
    const debtors = settlement.filter(s => s.net < -0.005).map(s => ({
      name: s.name,
      cents: Math.round(-s.net * 100)
    }));
    const transfers = [];
    let ci = 0,
      di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const amt = Math.min(creditors[ci].cents, debtors[di].cents);
      if (amt > 0) transfers.push({
        from: debtors[di].name,
        to: creditors[ci].name,
        amount: amt / 100
      });
      creditors[ci].cents -= amt;
      debtors[di].cents -= amt;
      if (creditors[ci].cents === 0) ci++;
      if (debtors[di].cents === 0) di++;
    }
    return {
      totalFood,
      totalDrinks,
      totalAccessory,
      totalFoodDrinks,
      overallTotal,
      costPerMeal,
      logisticsPerAdult,
      equipPerAdult,
      accessoryPerAdult,
      logisticsPurchases,
      equipBought,
      equipPayersCount: equipDivisorSet.size,
      adultMealsTotal,
      attendingAdultsCount: attendingAdults.size,
      breakdown,
      collected,
      roundingDiff,
      byBuyer,
      settlement,
      unattributed,
      transfers
    };
  };
  const totals = calculateTotals();

  // ---------- Backup (Export / Import) ----------
  const downloadJson = (filename, payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const exportData = () => {
    downloadJson(`bandone-backup-${toDateStr(new Date())}.json`, {
      version: 6,
      exportedAt: new Date().toISOString(),
      members,
      campData,
      purchases,
      gear,
      settled,
      equipment,
      toBuy,
      receipts
    });
  };
  const importData = e => {
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

  // ---------- Chiusura del campo e archivio ----------
  // "Chiudi il campo" salva tutto (file + cloud), lo mette in Archivio e poi
  // azzera i dati di lavoro: l'app resta pronta per l'evento successivo.
  const campRange = () => {
    const days = Object.keys(campData).filter(d => {
      const day = campData[d];
      if (!day) return false;
      const meals = day.meals || {};
      return Object.keys(meals).some(k => meals[k] && (meals[k].lunch || meals[k].dinner));
    }).sort();
    if (days.length) return {
      from: days[0],
      to: days[days.length - 1]
    };
    return {
      from: CAMP_START,
      to: CAMP_END
    };
  };
  const openClose = () => {
    const hasData = members.length > 0 || purchases.length > 0 || toBuy.length > 0 || equipment.length > 0;
    if (!hasData) {
      window.alert('Non c\'è niente da chiudere: membri e spese sono già vuoti.');
      return;
    }
    setCloseName(BRAND.appTitle || 'Campo');
    setClosing(true);
  };
  const closeCamp = async () => {
    const name = (closeName || '').trim() || 'Campo';
    const range = campRange();
    const t = totals;
    const unpaid = t.transfers.filter(x => !settled.includes(`${x.from}→${x.to}@${Math.round(x.amount * 100)}`));
    const warn = unpaid.length > 0 ? `\n\nATTENZIONE: ci sono ancora ${unpaid.length} rimborsi non segnati come saldati.` : '';
    const conferma = `Chiudere "${name}"?\n\n` + `Verrà archiviato tutto (spese ${money(t.overallTotal)} €, ${members.length} membri) ` + 'e scaricato un file di salvataggio con foto degli scontrini comprese.\n\n' + 'Poi membri, presenze, spese, lista, attrezzatura, dotazioni aggiuntive e ' + 'scontrini verranno AZZERATI su tutti i dispositivi, per ripartire con il ' + 'prossimo evento.' + warn;
    if (!window.confirm(conferma)) return;
    const id = toDateStr(new Date()) + '-' + uid();
    const state = {
      members,
      campData,
      purchases,
      gear,
      settled,
      equipment,
      toBuy
    };
    const meta = {
      id,
      name,
      closedAt: new Date().toISOString(),
      from: range.from,
      to: range.to,
      report: buildReport(),
      totals: {
        overall: t.overallTotal,
        food: t.totalFood,
        drinks: t.totalDrinks,
        logistics: t.logisticsPurchases,
        equipment: t.equipBought,
        members: members.length,
        adults: members.filter(m => !m.isChild).length,
        meals: t.adultMealsTotal,
        purchases: purchases.length
      }
    };

    // 1) Copia su file (l'unica che contiene anche le foto).
    downloadJson(`bandone-archivio-${toDateStr(new Date())}.json`, {
      version: 6,
      archive: meta,
      ...state,
      receipts
    });

    // 2) Copia nel cloud, visibile anche dagli altri dispositivi.
    const CS = window.CloudSync;
    let cloudOk = false;
    if (CS && CS.isConnected && CS.isConnected()) {
      cloudOk = await CS.putArchive(id, meta, state);
      Object.keys(receipts).forEach(rid => CS.deleteReceipt(rid));
    }

    // 3) Copia locale (senza foto, per non riempire la memoria del telefono).
    setArchives(prev => [{
      ...meta,
      state,
      cloud: cloudOk
    }, ...prev]);

    // 4) Azzeramento: i dati vuoti vengono sincronizzati e puliscono anche
    //    gli altri telefoni (le cancellazioni sono datate, quindi non tornano).
    setMembers([]);
    setCampData({});
    setPurchases([]);
    setToBuy([]);
    setEquipment([]);
    setGear([]);
    setSettled([]);
    setReceipts({});
    setBuying(null);
    setSelectedDateStr(defaultDateStr());
    setClosing(false);
    setActiveTab('archivio');
    window.alert('Campo chiuso e archiviato.' + (cloudOk ? ' La copia è anche nel cloud.' : ' (Senza linea: la copia nel cloud verrà fatta a mano quando torna la rete — il file scaricato è già completo.)'));
  };
  const downloadArchive = async a => {
    let state = a.state;
    if (!state) {
      const CS = window.CloudSync;
      if (CS && CS.isConnected && CS.isConnected()) state = await CS.getArchive(a.id);
      if (!state) {
        window.alert('Per scaricare questo archivio serve la connessione.');
        return;
      }
    }
    downloadJson(`bandone-archivio-${a.id}.json`, {
      version: 6,
      archive: a,
      ...state
    });
  };
  const removeArchive = a => {
    if (!window.confirm(`Eliminare l'archivio "${a.name}"?\nSe non hai il file scaricato, i dati di quel campo andranno persi.`)) return;
    setArchives(prev => prev.filter(x => x.id !== a.id));
    const CS = window.CloudSync;
    if (CS && CS.deleteArchive) CS.deleteArchive(a.id);
  };
  const shareArchive = async a => {
    const text = a.report || '';
    if (!text) {
      window.alert('Questo archivio non ha un resoconto salvato.');
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: a.name,
          text
        });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  // Quando si apre l'Archivio si recuperano anche i campi chiusi da altri
  // dispositivi (quelli che questo telefono non ha mai visto).
  useEffect(() => {
    if (activeTab !== 'archivio') return;
    const CS = window.CloudSync;
    if (!CS || !CS.listArchives || !CS.isConnected()) return;
    CS.listArchives().then(remote => {
      if (!Array.isArray(remote) || !remote.length) return;
      setArchives(prev => {
        const have = new Set(prev.map(a => a.id));
        const add = remote.filter(a => !have.has(a.id));
        if (!add.length) return prev;
        return [...prev, ...add].sort((a, b) => String(b.closedAt || '').localeCompare(String(a.closedAt || '')));
      });
    }).catch(() => {});
  }, [activeTab, cloud.connected]);

  // ---------- Render ----------
  if (showSplash) {
    return /*#__PURE__*/React.createElement("div", {
      onClick: () => setShowSplash(false),
      className: "fixed inset-0 bg-[#2D392C] flex flex-col items-center justify-center text-[#F0F4F1] z-50 cursor-pointer"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-56 h-56 mb-6 rounded-full overflow-hidden shadow-2xl flex items-center justify-center border-4 border-[#8F9E8B] bg-[#F0F4F1]"
    }, /*#__PURE__*/React.createElement("img", {
      src: "./logo.png",
      alt: `Logo ${BRAND.groupName}`,
      className: "w-full h-full object-cover"
    })), /*#__PURE__*/React.createElement("h1", {
      className: "font-rustic text-3xl tracking-widest text-[#8F9E8B]"
    }, BRAND.splashLine1), /*#__PURE__*/React.createElement("h2", {
      className: "font-rustic text-xl tracking-widest text-[#F0F4F1]"
    }, BRAND.splashLine2), /*#__PURE__*/React.createElement("p", {
      className: "mt-4 text-xs uppercase tracking-widest opacity-60"
    }, BRAND.splashTagline), /*#__PURE__*/React.createElement("p", {
      className: "absolute bottom-4 left-0 right-0 text-center text-[9px] tracking-wide text-[#8F9E8B]/70 px-6"
    }, BRAND.credits));
  }
  const tabs = {
    calendario: 'Calendario',
    membri: 'Membri',
    presenze: 'Presenze',
    spesa: 'Spese Totali',
    lista: 'Lista della Spesa',
    attrezzatura: 'Attrezzatura',
    regole: 'Regole',
    dotazioni: 'Dotazioni personali',
    archivio: 'Archivio',
    gioco: 'Aiuta Bandy',
    guida: 'Come funziona'
  };
  const goTo = tab => {
    setActiveTab(tab);
    setMenuOpen(false);
  };

  // Guida: una "pill" per ogni area di lavoro.
  const GUIDE = [{
    k: 'calendario',
    icon: '📅',
    title: 'Calendario',
    body: 'Per ogni giorno: il meteo previsto di Pereto (massima, minima e probabilità di pioggia), il riepilogo cucina con quanti pasti preparare a pranzo e a cena, e uno spazio per le note su menù, legna, turni. Scorri le settimane con le frecce: meteo e cucina si aggiornano sul giorno scelto.'
  }, {
    k: 'membri',
    icon: '👥',
    title: 'Membri',
    body: 'Aggiungi tutte le persone del campo. Il pulsante Adulto/Bambino decide chi paga: i bambini mangiano gratis e il loro costo è ripartito sugli adulti. L\'elenco alimenta presenze, conti e il suggerimento dei nomi quando registri una spesa.'
  }, {
    k: 'presenze',
    icon: '🍽️',
    title: 'Presenze',
    body: 'Segna chi c\'è a pranzo e a cena, giorno per giorno: è la base del calcolo delle quote. Per fare in fretta usa "Tutti a pranzo" o "Tutti a cena" e poi togli i pochi assenti, oppure "Copia da ieri". In alto trovi il conteggio del giorno. Durante il campo l\'app si apre già sulla data di oggi.'
  }, {
    k: 'lista',
    icon: '🧾',
    title: 'Lista della Spesa',
    body: 'Due sezioni. "Da acquistare": la lista di cosa serve, con nome e quantità; ogni voce ha l\'icona 📷 per lo scontrino (foto o galleria) e il tasto "Segna come acquistata", che chiede prezzo, acquirente e tipologia e la sposta in "Acquistato". "Acquistato": la cronologia di tutte le spese, più una maschera per registrare a mano ciò che non era in lista. Hai dimenticato lo scontrino? Tocca 📷 sulla voce anche dopo: puoi scattarlo o prenderlo dalla galleria.'
  }, {
    k: 'attrezzatura',
    icon: '🪛',
    title: 'Attrezzatura',
    body: 'Elenco dell\'attrezzatura da comprare, con prezzo ed eventuale acquirente. Spunta una voce quando è acquistata: solo allora il costo entra nelle spese, come logistica. Con l\'icona 📷 alleghi lo scontrino, anche in un secondo momento. In fondo vedi il totale previsto e quello effettivamente acquistato; se indichi l\'acquirente, gli verrà rimborsata.'
  }, {
    k: 'spesa',
    icon: '💶',
    title: 'Spese Totali',
    body: 'Quattro sotto-sezioni. Totali: quanto si è speso per cibo, bevande, logistica e attrezzatura. Quote: quanto costa a testa. Saldi: chi deve dare o ricevere. Dati: backup e sincronizzazione. I totali non si scrivono a mano, nascono dalla Lista della Spesa e dall\'attrezzatura acquistata.'
  }, {
    k: 'conti',
    icon: '⚖️',
    title: 'Come si dividono',
    body: 'Cibo e bevande sono divisi per il numero di pasti: chi mangia di più paga di più. Logistica e attrezzatura sono una quota fissa uguale per ogni adulto presente: nessuno paga più di una quota. Le cifre sono arrotondate a 10 centesimi, così non servono monetine da 1, 2 o 5 cent.'
  }, {
    k: 'saldi',
    icon: '🤝',
    title: 'Saldi e rimborsi',
    body: 'Per ogni persona l\'app confronta quanto ha anticipato con quanto deve, e dice se riceve o se deve dare. Sotto, in "Chi paga chi", trovi i pochi passaggi di denaro necessari per pareggiare tutto: tocca una riga quando il rimborso è stato fatto e resta barrata. Con "Condividi resoconto" mandi il riepilogo pronto nel gruppo WhatsApp.'
  }, {
    k: 'dotazioni',
    icon: '🎒',
    title: 'Dotazioni personali',
    body: 'Cosa portarsi da casa: una dotazione base uguale per tutti (sedia personale, stoviglie e posate, borraccia, canovacci, luci LED) che non si modifica, e un elenco di aggiunte per questo campo che potete integrare quando serve.'
  }, {
    k: 'backup',
    icon: '🛟',
    title: 'Backup e sicurezza',
    body: 'Ogni giorno viene salvata da sola una copia dei dati nel cloud: se qualcosa va storto, "Ripristino di emergenza" (in Spese Totali → Dati) permette di tornare a un giorno preciso. In più puoi esportare tutto su file con Esporta e ricaricarlo con Importa. Prima di eliminare qualcosa l\'app chiede sempre conferma.'
  }, {
    k: 'sync',
    icon: '☁️',
    title: 'Sincronizzazione',
    body: 'La connessione al campo è automatica: quando c\'è linea i dati si allineano da soli fra i telefoni, in tempo reale, foto degli scontrini comprese. Senza linea si continua a lavorare normalmente e tutto viene inviato appena la rete torna. Se in due avete lavorato offline, al ritorno della linea le due versioni si uniscono voce per voce: nessuno cancella il lavoro dell\'altro. Il pallino in alto a destra indica se sei online o offline.'
  }, {
    k: 'chiusura',
    icon: '🏁',
    title: 'Chiusura e Archivio',
    body: 'A conti fatti, in Spese Totali → Dati usa "Chiudi il campo": salva tutto (un file sul telefono e una copia nel cloud), lo mette in Archivio e azzera membri, presenze, spese, lista, attrezzatura, dotazioni aggiuntive e scontrini su tutti i dispositivi. L\'app resta pronta per il campo dell\'anno dopo. In Archivio rivedi il resoconto di ogni campo chiuso e puoi riscaricarne i dati; il file scaricato alla chiusura è l\'unico che contiene anche le foto degli scontrini, quindi conservalo.'
  }, {
    k: 'installa',
    icon: '📲',
    title: 'Installa l\'app',
    body: 'Conviene installarla, così si apre a schermo intero e funziona anche senza rete. Su iPhone: Condividi (il quadrato con la freccia) e poi "Aggiungi alla schermata Home". Su Android: menu del browser e "Installa app". Quando usciamo un aggiornamento, l\'app si aggiorna da sola: se non vedi una novità, chiudila e riaprila.'
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "max-w-md mx-auto min-h-screen flex flex-col bg-[#F0F4F1] border-x border-[#8F9E8B]/30 shadow-2xl pb-24"
  }, /*#__PURE__*/React.createElement("header", {
    className: "bg-[#2D392C] text-[#F0F4F1] p-4 text-center border-b-4 border-[#5C4A3C] relative"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setMenuOpen(o => !o),
    "aria-label": "Menu",
    "aria-expanded": menuOpen,
    className: "absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex flex-col items-center justify-center gap-[3px] rounded hover:bg-white/10"
  }, /*#__PURE__*/React.createElement("span", {
    className: "block w-5 h-0.5 bg-[#F0F4F1]"
  }), /*#__PURE__*/React.createElement("span", {
    className: "block w-5 h-0.5 bg-[#F0F4F1]"
  }), /*#__PURE__*/React.createElement("span", {
    className: "block w-5 h-0.5 bg-[#F0F4F1]"
  })), /*#__PURE__*/React.createElement("h1", {
    className: "font-rustic text-2xl tracking-wide"
  }, BRAND.appTitle), /*#__PURE__*/React.createElement("p", {
    className: "text-xs uppercase tracking-wider text-[#8F9E8B]"
  }, tabs[activeTab]), /*#__PURE__*/React.createElement("span", {
    title: isOnline ? 'Online' : 'Offline',
    className: `absolute top-3 right-3 flex items-center gap-1 text-[9px] uppercase font-bold ${isOnline ? 'text-[#8F9E8B]' : 'text-[#D97706]'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: `w-2 h-2 rounded-full ${isOnline ? 'bg-[#8F9E8B]' : 'bg-[#D97706]'}`
  }), isOnline ? 'Online' : 'Offline')), /*#__PURE__*/React.createElement("div", {
    className: `fixed inset-0 z-40 ${menuOpen ? '' : 'pointer-events-none'}`
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setMenuOpen(false),
    className: `absolute inset-0 bg-black/40 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0'}`
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 max-w-md mx-auto overflow-hidden pointer-events-none"
  }, /*#__PURE__*/React.createElement("nav", {
    className: `pointer-events-auto absolute left-0 top-0 bottom-0 w-72 max-w-[80%] bg-[#F0F4F1] border-r-4 border-[#5C4A3C] shadow-2xl p-4 space-y-1 overflow-y-auto transition-transform duration-300 ease-out ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 border-b border-[#8F9E8B]/40 pb-3 mb-2"
  }, /*#__PURE__*/React.createElement("img", {
    src: "./logo.png",
    alt: "",
    className: "w-11 h-11 rounded-full object-cover border-2 border-[#8F9E8B] bg-white"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-rustic text-[#2D392C] leading-tight"
  }, BRAND.appTitle), /*#__PURE__*/React.createElement("div", {
    className: "text-[9px] uppercase tracking-wider text-[#8F9E8B]"
  }, BRAND.groupName))), Object.keys(tabs).map(tab => /*#__PURE__*/React.createElement("button", {
    key: tab,
    onClick: () => goTo(tab),
    className: `w-full text-left px-4 py-3 rounded font-bold uppercase text-sm tracking-wide transition-colors ${activeTab === tab ? 'bg-[#2D392C] text-[#F0F4F1]' : 'text-[#2D392C] hover:bg-[#E2EAE4]'}`
  }, tabs[tab]))))), showInstallHint && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/15 border-b border-[#D97706]/40 px-4 py-2.5 flex items-start gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base leading-none mt-0.5"
  }, "\uD83D\uDCF2"), /*#__PURE__*/React.createElement("p", {
    className: "flex-grow text-[11px] text-[#5C4A3C] leading-snug"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, isDesktop ? 'Installa l\'app sul computer:' : 'Installa l\'app sul telefono:'), ' ', isIOS ? 'tocca Condividi (il quadrato con la freccia in su) e poi "Aggiungi alla schermata Home".' : isDesktop ? 'clicca l\'icona di installazione nella barra degli indirizzi (o menu ⋮ → "Installa").' : 'apri il menu del browser (⋮) e tocca "Installa app" (o "Aggiungi a schermata Home").', ' ', "Una volta installata funziona anche senza linea."), /*#__PURE__*/React.createElement("button", {
    onClick: dismissInstallHint,
    "aria-label": "Chiudi avviso",
    className: "text-[#5C4A3C] font-bold px-1 shrink-0"
  }, "\xD7")), /*#__PURE__*/React.createElement("main", {
    className: "flex-grow p-4"
  }, activeTab === 'calendario' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => changeWeek(-7),
    className: "p-2 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40"
  }, "\u2190"), /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-sm text-[#2D392C] uppercase font-rustic"
  }, "Settimana Selezionata"), /*#__PURE__*/React.createElement("button", {
    onClick: () => changeWeek(7),
    className: "p-2 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40"
  }, "\u2192")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-7 gap-1"
  }, weekDays.map(d => {
    const dateStr = toDateStr(d);
    const isSelected = dateStr === selectedDateStr;
    const isCampPeriod = dateStr >= CAMP_START && dateStr <= CAMP_END;
    const label = d.toLocaleDateString('it-IT', {
      weekday: 'short'
    });
    return /*#__PURE__*/React.createElement("button", {
      key: dateStr,
      onClick: () => {
        setSelectedDateStr(dateStr);
        setCurrentDate(new Date(d));
      },
      className: `p-2 flex flex-col items-center rounded-lg border transition-all ${isSelected ? 'bg-[#5C4A3C] text-white border-[#5C4A3C]' : isCampPeriod ? 'bg-[#2D392C]/10 text-[#2D392C] border-[#2D392C]' : 'bg-white text-gray-400 border-gray-200'}`
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] uppercase font-bold"
    }, label), /*#__PURE__*/React.createElement("span", {
      className: "text-lg font-bold font-rustic"
    }, d.getDate()), isCampPeriod && /*#__PURE__*/React.createElement("span", {
      className: "w-1.5 h-1.5 bg-[#D97706] rounded-full mt-0.5"
    }));
  })), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-dashed border-[#8F9E8B] pb-1"
  }, "Note del ", parseDate(selectedDateStr).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long'
  })), (() => {
    const loc = window.CAMP_LOCATION;
    const locOk = loc && typeof loc.lat === 'number' && typeof loc.lon === 'number';
    const wx = weather.byDate[selectedDateStr];
    return /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20"
    }, !locOk ? /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] text-gray-400 italic"
    }, "Meteo: localit\xE0 del campo da impostare.") : wx ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "text-2xl leading-none"
    }, wmoInfo(wx.code).icon), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-sm font-bold text-[#2D392C]"
    }, wmoInfo(wx.code).label), loc.label && /*#__PURE__*/React.createElement("span", {
      className: "text-[9px] text-gray-400"
    }, loc.label)), /*#__PURE__*/React.createElement("span", {
      className: "ml-auto text-xs text-gray-600 font-bold"
    }, Math.round(wx.tmax), "\xB0 / ", Math.round(wx.tmin), "\xB0", wx.rain != null ? /*#__PURE__*/React.createElement("span", {
      className: "text-[#5C8AA8]"
    }, " \xB7 \uD83D\uDCA7", wx.rain, "%") : null)) : /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] text-gray-400 italic"
    }, "Previsione non ancora disponibile per questo giorno", isOnline ? ' (copre ~16 giorni in avanti)' : ' (offline)', "."));
  })(), (() => {
    const lunch = members.filter(m => getMeal(selectedDateStr, m.id).lunch).length;
    const dinner = members.filter(m => getMeal(selectedDateStr, m.id).dinner).length;
    return /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 bg-[#2D392C]/5 px-3 py-2 rounded border border-[#2D392C]/15"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-xl leading-none"
    }, "\uD83C\uDF72"), /*#__PURE__*/React.createElement("span", {
      className: "text-[11px] uppercase font-bold text-gray-500"
    }, "Cucina"), /*#__PURE__*/React.createElement("span", {
      className: "ml-auto text-sm font-bold text-[#2D392C]"
    }, lunch, " ", /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] font-normal text-gray-500"
    }, "a pranzo"), /*#__PURE__*/React.createElement("span", {
      className: "text-gray-300"
    }, " \xB7 "), dinner, " ", /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] font-normal text-gray-500"
    }, "a cena")));
  })(), /*#__PURE__*/React.createElement("textarea", {
    value: getDayData(selectedDateStr).note,
    onChange: e => updateDayData(selectedDateStr, 'note', e.target.value),
    placeholder: "Inserisci note sul menu, meteo o legna per oggi...",
    className: "w-full h-32 p-3 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded-lg text-sm focus:outline-none focus:border-[#2D392C] resize-none"
  }))), activeTab === 'membri' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Aggiungi Membro"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newMemberName,
    onChange: e => setNewMemberName(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addMember(),
    placeholder: "Nome e cognome",
    className: "flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addMember,
    className: "px-4 bg-[#2D392C] text-white rounded font-bold text-sm hover:bg-[#1F271E]"
  }, "+")), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 text-xs text-gray-600"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: newMemberChild,
    onChange: e => setNewMemberChild(e.target.checked)
  }), "Bambino (pasti gratis)")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
  }, "Membri (", members.length, ")"), members.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Nessun membro. Aggiungine uno per iniziare a segnare le presenze.") : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, members.map(m => /*#__PURE__*/React.createElement("li", {
    key: m.id,
    className: "bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-sm text-[#2D392C] truncate"
  }, m.name), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => toggleChild(m.id),
    className: `text-[9px] uppercase font-bold px-2 py-1 rounded ${m.isChild ? 'bg-[#D97706] text-white' : 'bg-gray-200 text-gray-500'}`
  }, m.isChild ? 'Bambino' : 'Adulto'), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeMember(m.id),
    className: "text-red-700 font-bold px-2 hover:text-red-900"
  }, "\xD7"))), FEATURES.equipExemption && /*#__PURE__*/React.createElement("button", {
    onClick: () => toggleEquipExempt(m.id),
    "aria-label": "Esenzione attrezzatura",
    className: "mt-1.5 flex items-center gap-2 text-left"
  }, /*#__PURE__*/React.createElement("span", {
    className: `w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-[10px] font-bold ${m.equipExempt ? 'bg-[#5C4A3C] border-[#5C4A3C] text-white' : 'bg-white border-[#8F9E8B]'}`
  }, m.equipExempt ? '✓' : ''), /*#__PURE__*/React.createElement("span", {
    className: `text-[10px] ${m.equipExempt ? 'font-bold text-[#5C4A3C]' : 'text-gray-500'}`
  }, "Esente attrezzatura"))))))), activeTab === 'presenze' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => navigateDate(-1),
    className: "px-3 py-1 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40"
  }, "\u2190"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: selectedDateStr,
    onChange: e => {
      if (e.target.value) {
        setSelectedDateStr(e.target.value);
        setCurrentDate(parseDate(e.target.value));
      }
    },
    className: "bg-transparent border-none text-sm focus:outline-none font-bold text-center w-full mx-2 text-[#5C4A3C]"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => navigateDate(1),
    className: "px-3 py-1 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40"
  }, "\u2192")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Presenze del ", parseDate(selectedDateStr).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long'
  })), members.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Aggiungi prima i membri nella scheda \"Membri\".") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setAllMeals(selectedDateStr, 'lunch'),
    className: "py-2.5 bg-[#2D392C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#1F271E]"
  }, "Tutti a pranzo"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAllMeals(selectedDateStr, 'dinner'),
    className: "py-2.5 bg-[#5C4A3C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#463628]"
  }, "Tutti a cena"), /*#__PURE__*/React.createElement("button", {
    onClick: copyFromPreviousDay,
    className: "py-2.5 bg-white border-2 border-[#8F9E8B]/50 text-[#2D392C] rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#E2EAE4]"
  }, "Copia da ieri")), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 -mt-1"
  }, "Segna tutti, poi togli i pochi assenti. Se sono gi\xE0 tutti segnati, il bottone li toglie tutti.", ' ', /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-[#5C4A3C]"
  }, "Oggi: ", members.filter(m => getMeal(selectedDateStr, m.id).lunch).length, " a pranzo \xB7 ", members.filter(m => getMeal(selectedDateStr, m.id).dinner).length, " a cena")), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, members.map(m => {
    const meal = getMeal(selectedDateStr, m.id);
    return /*#__PURE__*/React.createElement("li", {
      key: m.id,
      className: "flex items-center justify-between gap-2 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/20"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-sm font-bold text-[#2D392C] truncate flex items-center gap-1"
    }, m.name, m.isChild && /*#__PURE__*/React.createElement("span", {
      className: "text-[8px] uppercase bg-[#D97706] text-white px-1 rounded"
    }, "gratis")), /*#__PURE__*/React.createElement("div", {
      className: "flex gap-1.5 shrink-0"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleMeal(selectedDateStr, m.id, 'lunch'),
      className: `text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border ${meal.lunch ? 'bg-[#2D392C] text-white border-[#2D392C]' : 'bg-white text-gray-400 border-gray-300'}`
    }, "Pranzo"), /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleMeal(selectedDateStr, m.id, 'dinner'),
      className: `text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border ${meal.dinner ? 'bg-[#5C4A3C] text-white border-[#5C4A3C]' : 'bg-white text-gray-400 border-gray-300'}`
    }, "Cena")));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-2"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "font-rustic text-sm text-[#5C4A3C]"
  }, "Note / Ospiti del giorno"), /*#__PURE__*/React.createElement("textarea", {
    value: getDayData(selectedDateStr).guestsNames,
    onChange: e => updateDayData(selectedDateStr, 'guestsNames', e.target.value),
    placeholder: "Ospiti occasionali o note sulle presenze...",
    className: "w-full h-20 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C] resize-none"
  }))), activeTab === 'spesa' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-4 gap-1.5"
  }, [['totali', 'Totali'], ['quote', 'Quote'], ['saldi', 'Saldi'], ['dati', 'Dati']].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setSpesaSection(k),
    className: `py-2.5 rounded text-[10px] font-bold uppercase tracking-wide border-b-4 transition-all ${spesaSection === k ? 'bg-[#2D392C] text-white border-[#5C4A3C]' : 'bg-white text-[#2D392C] border-gray-300 hover:bg-[#E2EAE4]'}`
  }, l))), spesaSection === 'totali' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Cassa Globale Campo"), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500 -mt-1"
  }, "Totali generati automaticamente dalla ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Lista della Spesa"), " e dall'", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Attrezzatura"), " acquistata."), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, [['Spesa Cibo (Alimentare)', totals.totalFood], ['Spesa Bevande', totals.totalDrinks], ['Logistica', totals.logisticsPurchases], ['Attrezzatura acquistata', totals.equipBought]].map(([label, val]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    className: "flex justify-between items-center bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] uppercase font-bold text-gray-500"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-[#2D392C]"
  }, money(val), " \u20AC")))), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#2D392C]/10 p-3 rounded border border-[#2D392C]/20 flex justify-between items-center mt-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-xs uppercase"
  }, "Importo Complessivo:"), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-lg text-[#2D392C]"
  }, money(totals.overallTotal), " \u20AC"))), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md space-y-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-1"
  }, "Il Conto della Serva"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] uppercase text-[#8F9E8B] block"
  }, "Quota Singolo Pasto"), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic text-xl text-[#D97706]"
  }, money(totals.costPerMeal), " \u20AC"), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 mt-1"
  }, "Cibo+bevande (", money(totals.totalFoodDrinks), " \u20AC) / ", totals.adultMealsTotal, " pasti adulti.")), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] uppercase text-[#8F9E8B] block"
  }, "Logistica a testa"), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic text-xl text-[#D97706]"
  }, money(totals.logisticsPerAdult), " \u20AC"), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 mt-1"
  }, "Logistica (", money(totals.logisticsPurchases), " \u20AC) / ", totals.attendingAdultsCount, " adulti presenti.")), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20 col-span-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] uppercase text-[#8F9E8B] block"
  }, "Attrezzatura a testa"), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic text-xl text-[#D97706]"
  }, money(totals.equipPerAdult), " \u20AC"), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 mt-1"
  }, "Attrezzatura (", money(totals.equipBought), " \u20AC) / ", totals.equipPayersCount, " ", FEATURES.equipExemption ? totals.equipPayersCount === 1 ? 'persona non esente' : 'persone non esenti' : totals.equipPayersCount === 1 ? 'adulto presente' : 'adulti presenti', "."))), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic"
  }, "I pasti dei bambini sono gratis: il loro costo \xE8 ripartito sugli adulti."))), spesaSection === 'quote' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
  }, "Quanto deve ciascuno"), totals.overallTotal > 0 && totals.adultMealsTotal === 0 && /*#__PURE__*/React.createElement("div", {
    className: "mb-3 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-[#5C4A3C] leading-snug"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Attenzione:"), " ci sono spese per ", money(totals.overallTotal), " \u20AC ma nessun pasto registrato. Le quote restano a zero finch\xE9 non segni le presenze nella scheda ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Presenze"), ".")), totals.breakdown.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Aggiungi membri e segna le presenze per vedere la ripartizione.") : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-[#8F9E8B]/20"
  }, totals.breakdown.map(b => /*#__PURE__*/React.createElement("li", {
    key: b.id,
    className: "flex items-center justify-between py-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-bold text-[#2D392C]"
  }, b.name), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-gray-500"
  }, b.mealCount, " ", b.mealCount === 1 ? 'pasto' : 'pasti', b.isChild ? ' · bambino' : '')), /*#__PURE__*/React.createElement("span", {
    className: `font-rustic font-bold ${b.isChild ? 'text-gray-400' : 'text-[#2D392C]'}`
  }, b.isChild ? 'Gratis' : `${money(b.pay)} €`)))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center pt-2 mt-1 border-t border-[#8F9E8B]/30"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] uppercase font-bold text-gray-500"
  }, "Totale raccolto"), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C]"
  }, money(totals.collected), " \u20AC")), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic mt-2"
  }, "Quote arrotondate a 0,10 \u20AC (niente monetine da 1/2/5 cent).", Math.abs(totals.roundingDiff) >= 0.005 ? ` Scarto rispetto al totale: ${totals.roundingDiff > 0 ? '+' : ''}${money(totals.roundingDiff)} € (sotto 0,50 €, non riconciliato).` : ' Nessuno scarto.')))), spesaSection === 'saldi' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
  }, "Anticipi per acquirente"), totals.byBuyer.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Registra gli acquisti nel Taccuino per vedere chi ha anticipato quanto.") : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-[#8F9E8B]/20"
  }, totals.byBuyer.map(b => /*#__PURE__*/React.createElement("li", {
    key: b.name,
    className: "flex items-center justify-between py-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: `text-sm font-bold ${b.name === '—' ? 'text-gray-400 italic' : 'text-[#2D392C]'}`
  }, b.name === '—' ? 'Non indicato' : b.name), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C]"
  }, money(b.total), " \u20AC")))), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic mt-2"
  }, "Quanto ha anticipato ciascuno (utile per i rimborsi)."))), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 mb-3"
  }, "Saldo finale"), totals.settlement.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Registra acquisti (con acquirente) e presenze per vedere chi deve dare o ricevere.") : /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-[#8F9E8B]/20"
  }, totals.settlement.map(s => {
    const credito = s.net > 0.005;
    const debito = s.net < -0.005;
    return /*#__PURE__*/React.createElement("li", {
      key: s.name,
      className: "flex items-center justify-between py-2 gap-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col min-w-0"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-sm font-bold truncate"
    }, s.name), /*#__PURE__*/React.createElement("span", {
      className: "text-[9px] text-[#8F9E8B]"
    }, "ha anticipato ", money(s.paid), " \u20AC \xB7 deve ", money(s.owed), " \u20AC")), /*#__PURE__*/React.createElement("span", {
      className: `font-rustic font-bold text-sm shrink-0 text-right ${credito ? 'text-[#8FBF8F]' : debito ? 'text-[#D97706]' : 'text-gray-400'}`
    }, credito ? `riceve ${money(s.net)} €` : debito ? `dà ${money(-s.net)} €` : 'in pari'));
  })), totals.transfers.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-3 pt-3 border-t border-[#8F9E8B]/30"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "font-rustic text-sm text-[#8F9E8B] mb-1"
  }, "Chi paga chi"), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 mb-2"
  }, "Tocca una riga quando il rimborso \xE8 stato fatto: resta barrata. Tocca di nuovo per annullare."), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-1.5"
  }, totals.transfers.map((t, i) => {
    const key = `${t.from}→${t.to}@${Math.round(t.amount * 100)}`;
    const paid = settled.includes(key);
    return /*#__PURE__*/React.createElement("li", {
      key: key + i,
      onClick: () => toggleSettled(key),
      className: `cursor-pointer select-none flex items-center justify-between bg-[#1F271E] px-3 py-2 rounded border transition-opacity ${paid ? 'border-[#8FBF8F]/40 opacity-60' : 'border-[#8F9E8B]/20'}`
    }, /*#__PURE__*/React.createElement("span", {
      className: `text-xs ${paid ? 'line-through text-gray-400' : ''}`
    }, /*#__PURE__*/React.createElement("span", {
      className: "font-bold"
    }, t.from), /*#__PURE__*/React.createElement("span", {
      className: "text-[#8F9E8B]"
    }, " \u2192 "), /*#__PURE__*/React.createElement("span", {
      className: "font-bold"
    }, t.to)), /*#__PURE__*/React.createElement("span", {
      className: "flex items-center gap-1.5"
    }, /*#__PURE__*/React.createElement("span", {
      className: `font-rustic font-bold ${paid ? 'line-through text-gray-400' : 'text-[#D97706]'}`
    }, money(t.amount), " \u20AC"), paid && /*#__PURE__*/React.createElement("span", {
      className: "text-[#8FBF8F] text-sm font-bold"
    }, "\u2713")));
  }))), totals.unattributed > 0.005 && /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-[#D97706] italic mt-2"
  }, "Attenzione: ", money(totals.unattributed), " \u20AC di acquisti sono senza acquirente. Assegna un acquirente nel Taccuino per far quadrare i conti."), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic mt-1"
  }, "\"Riceve\" = ha anticipato pi\xF9 di quanto deve; \"d\xE0\" = deve versare la differenza.")), /*#__PURE__*/React.createElement("button", {
    onClick: shareReport,
    className: "w-full py-3 bg-[#25D366] text-white rounded font-bold uppercase text-sm tracking-wide hover:brightness-95 flex items-center justify-center gap-2"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCE4"), " Condividi resoconto"), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic text-center"
  }, "Genera un messaggio pronto con totale e \"chi paga chi\" da mandare nel gruppo.")), spesaSection === 'dati' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Backup Dati"), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500"
  }, "Ogni giorno viene salvata da sola una copia di sicurezza nel cloud. Esporta/Importa serve per un backup manuale su file."), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: exportData,
    className: "flex-1 py-2.5 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]"
  }, "Esporta"), /*#__PURE__*/React.createElement("label", {
    className: "flex-1 py-2.5 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase text-center cursor-pointer hover:bg-[#463628]"
  }, "Importa", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "application/json,.json",
    onChange: importData,
    className: "hidden"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: openRestore,
    className: "w-full py-2.5 bg-white border-2 border-[#D97706]/50 text-[#D97706] rounded text-xs font-bold uppercase hover:bg-[#D97706]/10"
  }, "Ripristino di emergenza")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#5C4A3C]/30 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Chiusura del campo"), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500"
  }, "A conti fatti e rimborsi saldati: salva tutto (file + cloud), lo mette in ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Archivio"), " e azzera membri, presenze, spese, lista, attrezzatura, dotazioni aggiuntive e scontrini. L'app resta pronta per il prossimo evento. I dati archiviati restano consultabili."), /*#__PURE__*/React.createElement("button", {
    onClick: openClose,
    className: "w-full py-3 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase tracking-wide hover:bg-[#463628]"
  }, "\uD83C\uDFC1 Chiudi il campo e archivia"), archives.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => goTo('archivio'),
    className: "w-full py-2 text-[10px] uppercase font-bold text-[#5C4A3C] hover:underline"
  }, "Vedi l'archivio (", archives.length, ")")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C]"
  }, "Sincronizzazione Cloud"), /*#__PURE__*/React.createElement("span", {
    className: `text-[9px] uppercase font-bold px-2 py-1 rounded ${cloud.connected ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`
  }, cloud.connected ? 'Connesso' : 'Non connesso')), !(window.CloudSync && window.CloudSync.isConfigured()) ? /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500 italic"
  }, "Firebase non configurato. Incolla la config del tuo progetto in ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "firebase-config.js"), " per abilitare la sincronizzazione online tra dispositivi.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500"
  }, "La sincronizzazione si attiva da sola all'avvio quando c'\xE8 linea. Offline si continua a lavorare in locale. Premi Disconnetti solo se vuoi lavorare senza condividere i dati."), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: campCodeInput,
    onChange: e => setCampCodeInput(e.target.value),
    placeholder: "Codice campo",
    disabled: cloud.connected,
    className: "flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C] disabled:opacity-60"
  }), cloud.connected ? /*#__PURE__*/React.createElement("button", {
    onClick: disconnectCloud,
    className: "px-4 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase hover:bg-[#463628]"
  }, "Disconnetti") : /*#__PURE__*/React.createElement("button", {
    onClick: () => connectCloud(campCodeInput),
    className: "px-4 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]"
  }, "Connetti")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-[10px] text-gray-500"
  }, /*#__PURE__*/React.createElement("span", null, cloud.status === 'connecting' && 'Connessione in corso…', cloud.status === 'saving' && 'Salvataggio…', cloud.status === 'connected' && (cloud.lastSync ? `Ultima sync: ${new Date(cloud.lastSync).toLocaleTimeString('it-IT')}` : 'In ascolto…'), cloud.status === 'error' && /*#__PURE__*/React.createElement("span", {
    className: "text-red-700"
  }, "Errore: ", cloud.error), cloud.status === 'idle' && (localStorage.getItem('cambusa_sync_optout') === '1' ? 'Sincronizzazione disattivata: premi Connetti per riattivarla.' : 'In attesa di connessione automatica…')), !isOnline && /*#__PURE__*/React.createElement("span", {
    className: "text-[#D97706] font-bold"
  }, "offline")))))), activeTab === 'lista' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, [['daacquistare', 'Da acquistare', toBuy.length], ['acquistato', 'Acquistato', purchases.length]].map(([k, l, n]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setListaSection(k),
    className: `py-2.5 rounded text-[11px] font-bold uppercase tracking-wide border-b-4 transition-all ${listaSection === k ? 'bg-[#2D392C] text-white border-[#5C4A3C]' : 'bg-white text-[#2D392C] border-gray-300 hover:bg-[#E2EAE4]'}`
  }, l, n > 0 ? ` (${n})` : ''))), listaSection === 'daacquistare' && /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#5C4A3C]/30 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C]"
  }, "Da Acquistare"), toBuy.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] uppercase font-bold text-gray-500"
  }, toBuy.length, " ", toBuy.length === 1 ? 'voce' : 'voci')), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newBuyName,
    onChange: e => setNewBuyName(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addToBuy(),
    placeholder: "Cosa serve\u2026",
    className: "flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newBuyQty,
    onChange: e => setNewBuyQty(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addToBuy(),
    placeholder: "Q.t\xE0",
    className: "w-20 shrink-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm text-center focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addToBuy,
    "aria-label": "Aggiungi alla lista",
    className: "shrink-0 px-3 bg-[#2D392C] text-white rounded font-bold text-lg leading-none hover:bg-[#1F271E]"
  }, "+")), toBuy.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Lista vuota. Scrivi cosa serve e premi +.") : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, toBuy.map(it => /*#__PURE__*/React.createElement("li", {
    key: it.id,
    className: "bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-grow min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-bold text-[#2D392C] truncate"
  }, it.name), it.qty && /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-gray-500"
  }, "Quantit\xE0: ", it.qty)), receipts[it.id] ? /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewReceipt(receipts[it.id]),
    "aria-label": "Vedi scontrino",
    className: "shrink-0 px-2 py-1.5 rounded border-2 border-[#2D392C] bg-[#2D392C] text-white leading-none"
  }, "\uD83D\uDCF7") : /*#__PURE__*/React.createElement("label", {
    title: "Scontrino: scatta una foto o scegli dalla galleria",
    "aria-label": "Allega scontrino",
    className: "shrink-0 cursor-pointer px-2 py-1.5 rounded border-2 border-[#8F9E8B]/50 bg-white leading-none hover:bg-[#E2EAE4]"
  }, "\uD83D\uDCF7", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: e => attachReceiptTo(e, it.id),
    className: "hidden"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeToBuy(it.id),
    "aria-label": "Rimuovi",
    className: "shrink-0 text-red-700 font-bold px-1.5 hover:text-red-900"
  }, "\xD7")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setBuying({
      id: it.id,
      name: it.name,
      qty: it.qty,
      price: '',
      buyer: '',
      type: 'alimentare'
    }),
    className: "mt-2 w-full py-2 bg-[#5C4A3C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#463628]"
  }, "Segna come acquistata")))), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic"
  }, "Con \uD83D\uDCF7 puoi scattare lo scontrino o prenderlo dalla galleria. Quando una voce viene acquistata passa in \"Acquistato\", con prezzo e acquirente.")), listaSection === 'acquistato' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C]"
  }, "Prodotto acquistato"), /*#__PURE__*/React.createElement("label", {
    title: "Scontrino: scatta una foto o scegli dalla galleria",
    "aria-label": "Allega scontrino",
    className: `cursor-pointer px-3 py-2 rounded border-2 text-lg leading-none ${pReceipt ? 'bg-[#2D392C] border-[#2D392C]' : 'bg-white border-[#8F9E8B]/50 hover:bg-[#E2EAE4]'}`
  }, "\uD83D\uDCF7", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: onReceiptFile,
    className: "hidden"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500 -mt-1"
  }, "Per un prodotto che non era in \"Da acquistare\"."), pReceipt && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/30"
  }, /*#__PURE__*/React.createElement("img", {
    src: pReceipt,
    alt: "Scontrino",
    className: "w-12 h-12 object-cover rounded"
  }), /*#__PURE__*/React.createElement("span", {
    className: "flex-grow text-xs text-[#2D392C] font-bold"
  }, "Scontrino allegato \u2713"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPReceipt(null),
    "aria-label": "Rimuovi foto",
    className: "text-red-700 font-bold px-2 hover:text-red-900"
  }, "\xD7")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Nome"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: pName,
    onChange: e => setPName(e.target.value),
    placeholder: "Es. Pasta, Acqua, Piatti\u2026",
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Acquirente"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    list: "acquirenti",
    value: pBuyer,
    onChange: e => setPBuyer(e.target.value),
    placeholder: "Chi ha acquistato",
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("datalist", {
    id: "acquirenti"
  }, members.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.id,
    value: m.name
  })))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Prezzo (\u20AC)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    step: "0.01",
    inputMode: "decimal",
    value: pPrice,
    onChange: e => setPPrice(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addPurchase(),
    placeholder: "0.00",
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Tipologia"), /*#__PURE__*/React.createElement("select", {
    value: pType,
    onChange: e => setPType(e.target.value),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold focus:outline-none focus:border-[#2D392C]"
  }, Object.keys(PURCHASE_TYPES).map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, PURCHASE_TYPES[k]))))), /*#__PURE__*/React.createElement("button", {
    onClick: addPurchase,
    className: "w-full py-3 bg-[#2D392C] text-white rounded font-bold uppercase text-sm tracking-wide hover:bg-[#1F271E]"
  }, "Salva")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C]"
  }, "Cronologia acquisti"), purchases.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C]"
  }, money(totals.overallTotal), " \u20AC")), purchases.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Nessun acquisto registrato. Compila il form qui sopra e premi Salva.") : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, purchases.slice().reverse().map(p => /*#__PURE__*/React.createElement("li", {
    key: p.id,
    className: "flex items-center gap-2 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-grow min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-bold text-[#2D392C] truncate"
  }, p.name), /*#__PURE__*/React.createElement("span", {
    className: "text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#8F9E8B] shrink-0"
  }, PURCHASE_TYPES[p.type] || p.type), p.fromList && /*#__PURE__*/React.createElement("span", {
    className: "text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#5C4A3C] shrink-0"
  }, "acquistata")), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] text-gray-400"
  }, p.buyer ? /*#__PURE__*/React.createElement("span", {
    className: "text-[#5C4A3C] font-bold"
  }, p.buyer) : /*#__PURE__*/React.createElement("span", {
    className: "italic"
  }, "acquirente non indicato"), p.at && ` · ${new Date(p.at).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short'
  })} ${new Date(p.at).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  })}`)), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C] shrink-0"
  }, money(posNum(p.price)), " \u20AC"), receipts[p.id] ? /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewReceipt(receipts[p.id]),
    "aria-label": "Vedi scontrino",
    className: "shrink-0 px-2 py-1 rounded border-2 border-[#2D392C] bg-[#2D392C] text-white text-sm leading-none"
  }, "\uD83D\uDCF7") : /*#__PURE__*/React.createElement("label", {
    title: "Scontrino: scatta una foto o scegli dalla galleria",
    "aria-label": "Allega scontrino",
    className: "shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-[#8F9E8B]/50 bg-white text-sm leading-none hover:bg-[#E2EAE4]"
  }, "\uD83D\uDCF7", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: e => attachReceiptTo(e, p.id),
    className: "hidden"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => removePurchase(p.id),
    "aria-label": "Rimuovi",
    className: "text-red-700 font-bold px-1.5 hover:text-red-900 shrink-0"
  }, "\xD7")))), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic mt-2"
  }, "Manca uno scontrino? Tocca \uD83D\uDCF7 sulla voce: puoi scattarlo o scegliere una foto dalla galleria, anche dopo. Le foto si sincronizzano tra i dispositivi del campo e sono incluse nel backup.")))), activeTab === 'attrezzatura' && (() => {
    const equipBoughtTotal = equipment.reduce((s, e) => e.bought ? s + posNum(e.price) : s, 0);
    const equipPlannedTotal = equipment.reduce((s, e) => s + posNum(e.price), 0);
    return /*#__PURE__*/React.createElement("div", {
      className: "space-y-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
    }, /*#__PURE__*/React.createElement("h3", {
      className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
    }, "Aggiungi attrezzatura"), /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: newEquipText,
      onChange: e => setNewEquipText(e.target.value),
      placeholder: "Es. Corda, gazebo, tanica\u2026",
      className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
    }), /*#__PURE__*/React.createElement("input", {
      type: "text",
      list: "acquirenti-attrezzatura",
      value: newEquipBuyer,
      onChange: e => setNewEquipBuyer(e.target.value),
      placeholder: "Acquirente (facoltativo)",
      className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
    }), /*#__PURE__*/React.createElement("datalist", {
      id: "acquirenti-attrezzatura"
    }, members.map(m => /*#__PURE__*/React.createElement("option", {
      key: m.id,
      value: m.name
    }))), /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2"
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0",
      step: "0.01",
      inputMode: "decimal",
      value: newEquipPrice,
      onChange: e => setNewEquipPrice(e.target.value),
      onKeyDown: e => e.key === 'Enter' && addEquip(),
      placeholder: "Prezzo (\u20AC)",
      className: "flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
    }), /*#__PURE__*/React.createElement("button", {
      onClick: addEquip,
      className: "shrink-0 px-3 bg-[#2D392C] text-white rounded font-bold uppercase text-xs hover:bg-[#1F271E]"
    }, "Aggiungi")), /*#__PURE__*/React.createElement("p", {
      className: "text-[9px] text-gray-400"
    }, "Spunta una voce quando l'hai acquistata: il suo prezzo entra nelle Spese Totali (come logistica). Con \uD83D\uDCF7 alleghi lo scontrino (foto o galleria), anche dopo.")), /*#__PURE__*/React.createElement("div", {
      className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3"
    }, /*#__PURE__*/React.createElement("h3", {
      className: "font-rustic text-lg text-[#2D392C]"
    }, "Attrezzatura"), equipment.length > 0 && /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] uppercase font-bold text-gray-500"
    }, equipment.filter(e => !e.bought).length, " da comprare")), equipment.length === 0 ? /*#__PURE__*/React.createElement("p", {
      className: "text-sm text-gray-400 italic"
    }, "Nessuna attrezzatura. Aggiungi la prima voce qui sopra.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("ul", {
      className: "space-y-2"
    }, equipment.map(e => /*#__PURE__*/React.createElement("li", {
      key: e.id,
      className: "flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleEquipBought(e.id),
      "aria-label": e.bought ? 'Segna da comprare' : 'Segna acquistato',
      className: `w-6 h-6 shrink-0 rounded border-2 flex items-center justify-center font-bold ${e.bought ? 'bg-[#2D392C] border-[#2D392C] text-white' : 'bg-white border-[#8F9E8B]'}`
    }, e.bought ? '✓' : ''), /*#__PURE__*/React.createElement("div", {
      className: "flex-grow min-w-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: `text-sm truncate ${e.bought ? 'line-through text-gray-400' : 'text-[#2D392C]'}`
    }, e.text), e.buyer && /*#__PURE__*/React.createElement("div", {
      className: "text-[9px] text-[#5C4A3C] font-bold truncate"
    }, e.buyer)), /*#__PURE__*/React.createElement("span", {
      className: `font-rustic font-bold shrink-0 ${e.bought ? 'text-[#2D392C]' : 'text-gray-400'}`
    }, money(posNum(e.price)), " \u20AC"), receipts[e.id] ? /*#__PURE__*/React.createElement("button", {
      onClick: () => setViewReceipt(receipts[e.id]),
      "aria-label": "Vedi scontrino",
      className: "shrink-0 px-2 py-1 rounded border-2 border-[#2D392C] bg-[#2D392C] text-white text-sm leading-none"
    }, "\uD83D\uDCF7") : /*#__PURE__*/React.createElement("label", {
      title: "Scontrino: scatta una foto o scegli dalla galleria",
      "aria-label": "Allega scontrino",
      className: "shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-[#8F9E8B]/50 bg-white text-sm leading-none hover:bg-[#E2EAE4]"
    }, "\uD83D\uDCF7", /*#__PURE__*/React.createElement("input", {
      type: "file",
      accept: "image/*",
      onChange: ev => attachReceiptTo(ev, e.id),
      className: "hidden"
    })), /*#__PURE__*/React.createElement("button", {
      onClick: () => removeEquip(e.id),
      "aria-label": "Rimuovi",
      className: "text-red-700 font-bold px-1.5 hover:text-red-900 shrink-0"
    }, "\xD7")))), /*#__PURE__*/React.createElement("div", {
      className: "mt-3 pt-2 border-t border-[#8F9E8B]/30 space-y-1"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex justify-between text-[11px] text-gray-500"
    }, /*#__PURE__*/React.createElement("span", {
      className: "uppercase font-bold"
    }, "Previsto (tutto)"), /*#__PURE__*/React.createElement("span", {
      className: "font-bold"
    }, money(equipPlannedTotal), " \u20AC")), /*#__PURE__*/React.createElement("div", {
      className: "flex justify-between items-center"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-[11px] uppercase font-bold text-[#2D392C]"
    }, "Acquistato (nelle spese)"), /*#__PURE__*/React.createElement("span", {
      className: "font-rustic font-bold text-[#2D392C]"
    }, money(equipBoughtTotal), " \u20AC"))))));
  })(), activeTab === 'regole' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
  }, "Regole dell'accampamento"), /*#__PURE__*/React.createElement("ol", {
    className: "space-y-3"
  }, CAMP_RULES.map((text, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: "flex gap-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-rustic text-lg text-[#5C4A3C] leading-none shrink-0"
  }, i + 1, "."), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] leading-relaxed uppercase underline underline-offset-2 decoration-[#8F9E8B]/70 font-bold text-[#2D392C]"
  }, text)))))), activeTab === 'dotazioni' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
  }, "Dotazione base"), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, BASE_GEAR.map(item => /*#__PURE__*/React.createElement("li", {
    key: item.text,
    className: `flex items-center gap-3 rounded border p-2.5 ${item.emphasis ? 'bg-[#D97706]/10 border-[#D97706]/40' : 'bg-[#F0F4F1]/60 border-[#8F9E8B]/20'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: `shrink-0 rounded-full bg-[#D97706] ${item.emphasis ? 'w-2 h-2' : 'w-1.5 h-1.5'}`
  }), /*#__PURE__*/React.createElement("span", {
    className: item.emphasis ? 'text-base font-bold uppercase underline decoration-2 underline-offset-2 text-[#2D392C] leading-snug' : 'text-sm text-[#2D392C]'
  }, item.text)))), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic mt-2"
  }, "Dotazione obbligatoria per ogni partecipante.")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Aggiunte per questo campo"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newGearText,
    onChange: e => setNewGearText(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addGear(),
    placeholder: "Es. costume, torcia frontale\u2026",
    className: "flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addGear,
    "aria-label": "Aggiungi dotazione",
    className: "px-4 bg-[#2D392C] text-white rounded font-bold text-lg leading-none hover:bg-[#1F271E]"
  }, "+")), gear.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Nessuna aggiunta. Inserisci qui le dotazioni extra per questo campo.") : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, gear.map(g => /*#__PURE__*/React.createElement("li", {
    key: g.id,
    className: "flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 bg-[#8F9E8B] rounded-full shrink-0"
  }), /*#__PURE__*/React.createElement("span", {
    className: "flex-grow text-sm text-[#2D392C]"
  }, g.text), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeGear(g.id),
    "aria-label": "Rimuovi",
    className: "text-red-700 font-bold px-2 hover:text-red-900"
  }, "\xD7")))))), activeTab === 'archivio' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
  }, "Archivio"), archives.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Nessun campo archiviato. Quando i conti sono chiusi, usa ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Spese Totali \u2192 Dati \u2192 Chiudi il campo"), ": tutto finisce qui e l'app riparte pulita per l'evento successivo.") : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-3"
  }, archives.map(a => /*#__PURE__*/React.createElement("li", {
    key: a.id,
    className: "bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20 space-y-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "min-w-0"
  }, /*#__PURE__*/React.createElement("p", {
    className: "font-rustic text-base text-[#2D392C] truncate"
  }, a.name), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500"
  }, a.from === a.to ? a.from : `${a.from} → ${a.to}`, " \xB7 chiuso il ", new Date(a.closedAt).toLocaleDateString('it-IT'))), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C] shrink-0"
  }, money(a.totals && a.totals.overall || 0), " \u20AC")), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500"
  }, /*#__PURE__*/React.createElement("span", null, a.totals && a.totals.members || 0, " membri"), /*#__PURE__*/React.createElement("span", null, a.totals && a.totals.purchases || 0, " spese"), /*#__PURE__*/React.createElement("span", null, a.totals && a.totals.meals || 0, " pasti"), !a.state && /*#__PURE__*/React.createElement("span", {
    className: "text-[#8F9E8B] italic"
  }, "solo cloud")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewArchive(a),
    className: "flex-1 py-2 bg-[#2D392C] text-white rounded text-[10px] font-bold uppercase hover:bg-[#1F271E]"
  }, "Resoconto"), /*#__PURE__*/React.createElement("button", {
    onClick: () => downloadArchive(a),
    className: "flex-1 py-2 bg-[#5C4A3C] text-white rounded text-[10px] font-bold uppercase hover:bg-[#463628]"
  }, "Scarica"), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeArchive(a),
    "aria-label": "Elimina archivio",
    className: "px-3 py-2 bg-white border-2 border-red-700/30 text-red-700 rounded text-[10px] font-bold uppercase hover:bg-red-50"
  }, "Elimina")))))), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic text-center px-4"
  }, "Il file scaricato alla chiusura \xE8 l'unica copia che contiene anche le foto degli scontrini: conservalo.")), activeTab === 'gioco' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, !gameRunning ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Aiuta Bandy"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("img", {
    src: "./bandy.png",
    alt: "Bandy",
    className: "w-14 h-14 rounded border-2 border-[#8F9E8B]/40 bg-[#F0F4F1]",
    style: {
      imageRendering: 'pixelated'
    }
  }), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-gray-600 leading-snug"
  }, "Bandy \xE8 in montagna e non \xE8 ancora fatto: raggiungilo con la canna pi\xF9 volte che puoi. Ogni volta che lo prendi la canna si allunga \u2014 se sbatti contro i bordi o contro te stesso, GAME OVER.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Nome giocatore"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    list: "acquirenti",
    value: gamePlayer,
    onChange: e => setGamePlayer(e.target.value),
    onKeyDown: e => e.key === 'Enter' && startGame(),
    placeholder: "Come ti chiami?",
    maxLength: 24,
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: startGame,
    className: "w-full py-3 bg-[#2D392C] text-white rounded font-bold uppercase text-sm tracking-wide hover:bg-[#1F271E]"
  }, "Gioca"), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic"
  }, "Comandi: scorri il dito sul campo o usa le frecce sotto. Da computer: frecce o WASD.")), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg"
  }, "Classifica"), /*#__PURE__*/React.createElement("button", {
    onClick: refreshLeaderboard,
    className: "text-[9px] uppercase font-bold text-[#8F9E8B] hover:text-white"
  }, "Aggiorna")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between text-xs mb-3 pb-2 border-b border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[#8F9E8B]"
  }, "Il tuo record"), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic text-[#D97706] text-lg leading-none"
  }, gameBest)), leaderboard.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-gray-400 italic"
  }, "Nessun punteggio condiviso ancora. Gioca una partita: con la linea il tuo record finisce qui per tutti.") : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-1"
  }, leaderboard.map((r, i) => /*#__PURE__*/React.createElement("li", {
    key: r.name + i,
    className: "flex items-center justify-between py-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm truncate"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[#8F9E8B] mr-2"
  }, i + 1, "."), i === 0 ? '🏆 ' : '', r.name), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#D97706]"
  }, r.score)))))) : /*#__PURE__*/React.createElement(BandyGame, {
    playerName: gamePlayer.trim(),
    bestLocal: gameBest,
    onGameOver: endGame,
    onExit: () => {
      setGameRunning(false);
      refreshLeaderboard();
    }
  })), activeTab === 'guida' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-1"
  }, "Come funziona l'app"), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-gray-500 mb-3"
  }, "Tocca un'area per vedere a cosa serve. In sintesi: segni presenze e spese, l'app calcola quanto deve ciascuno e chi rimborsa chi."), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5"
  }, GUIDE.map(g => /*#__PURE__*/React.createElement("button", {
    key: g.k,
    onClick: () => setGuideOpen(g.k),
    className: `px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${guideOpen === g.k ? 'bg-[#2D392C] text-white' : 'bg-[#F0F4F1] text-[#2D392C] border border-[#8F9E8B]/40 hover:bg-[#E2EAE4]'}`
  }, g.icon, " ", g.title))), (() => {
    const g = GUIDE.find(x => x.k === guideOpen) || GUIDE[0];
    return /*#__PURE__*/React.createElement("div", {
      className: "mt-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 mb-1"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-lg leading-none"
    }, g.icon), /*#__PURE__*/React.createElement("span", {
      className: "font-rustic text-[#2D392C]"
    }, g.title)), /*#__PURE__*/React.createElement("p", {
      className: "text-xs text-[#2D392C] leading-relaxed"
    }, g.body));
  })()), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "font-rustic text-base mb-2"
  }, "In tre passi"), /*#__PURE__*/React.createElement("ol", {
    className: "text-xs space-y-1.5 list-decimal list-inside text-[#F0F4F1]/90"
  }, /*#__PURE__*/React.createElement("li", null, "In ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Membri"), " aggiungi le persone (e segna chi \xE8 bambino)."), /*#__PURE__*/React.createElement("li", null, "Ogni giorno segna le ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Presenze"), " e registra le spese nella ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Lista della Spesa"), ": prima cosa serve in \"Da acquistare\", poi la sposti in \"Acquistato\" con prezzo e acquirente."), /*#__PURE__*/React.createElement("li", null, "In ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Spese Totali \u2192 Saldi"), " vedi chi deve dare o ricevere e chi paga chi, e con ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Condividi resoconto"), " lo mandi nel gruppo."))))), buying && /*#__PURE__*/React.createElement("div", {
    onClick: () => setBuying(null),
    className: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "bg-white rounded-lg p-4 w-full max-w-xs space-y-3 shadow-2xl"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2"
  }, "Acquistata: ", buying.name, buying.qty ? ` (${buying.qty})` : ''), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Prezzo (\u20AC)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    step: "0.01",
    inputMode: "decimal",
    autoFocus: true,
    value: buying.price,
    onChange: e => setBuying(b => ({
      ...b,
      price: e.target.value
    })),
    onKeyDown: e => e.key === 'Enter' && confirmBuy(),
    placeholder: "0.00",
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Acquirente"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    list: "acquirenti",
    value: buying.buyer,
    onChange: e => setBuying(b => ({
      ...b,
      buyer: e.target.value
    })),
    placeholder: "Chi ha acquistato",
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Tipologia"), /*#__PURE__*/React.createElement("select", {
    value: buying.type,
    onChange: e => setBuying(b => ({
      ...b,
      type: e.target.value
    })),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold"
  }, Object.keys(PURCHASE_TYPES).map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, PURCHASE_TYPES[k])))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 pt-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setBuying(null),
    className: "flex-1 py-2.5 bg-white border border-[#8F9E8B]/50 text-gray-500 rounded text-xs font-bold uppercase"
  }, "Annulla"), /*#__PURE__*/React.createElement("button", {
    onClick: confirmBuy,
    className: "flex-1 py-2.5 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]"
  }, "Conferma")))), snapList && /*#__PURE__*/React.createElement("div", {
    onClick: () => setSnapList(null),
    className: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "bg-white rounded-lg p-4 w-full max-w-xs space-y-2 max-h-[70vh] overflow-y-auto shadow-2xl"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2"
  }, "Ripristina un salvataggio"), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500"
  }, "Copie automatiche giornaliere. Scegli il giorno a cui tornare."), snapList.map(id => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => restoreSnapshot(id),
    className: "w-full py-2.5 bg-[#F0F4F1] border border-[#8F9E8B]/40 rounded text-sm font-bold text-[#2D392C] hover:bg-[#E2EAE4]"
  }, parseDate(id).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'long'
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSnapList(null),
    className: "w-full py-2 text-xs uppercase font-bold text-gray-500 hover:text-gray-700"
  }, "Annulla"))), closing && /*#__PURE__*/React.createElement("div", {
    onClick: () => setClosing(false),
    className: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "bg-white rounded-lg p-4 w-full max-w-xs space-y-3 max-h-[80vh] overflow-y-auto shadow-2xl"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2"
  }, "Chiudi il campo"), /*#__PURE__*/React.createElement("label", {
    className: "block text-[10px] uppercase font-bold text-gray-500"
  }, "Nome dell'archivio"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: closeName,
    onChange: e => setCloseName(e.target.value),
    placeholder: "Es. Prato Lungo 2026",
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#F0F4F1]/60 rounded p-3 text-[11px] text-gray-600 space-y-1"
  }, /*#__PURE__*/React.createElement("p", {
    className: "font-bold text-[#2D392C]"
  }, "Verr\xE0 archiviato:"), /*#__PURE__*/React.createElement("p", null, money(totals.overallTotal), " \u20AC di spese \xB7 ", purchases.length, " acquisti \xB7 ", members.length, " membri"), /*#__PURE__*/React.createElement("p", {
    className: "font-bold text-[#2D392C] pt-1"
  }, "Poi verranno azzerati:"), /*#__PURE__*/React.createElement("p", null, "membri, presenze, spese, lista, attrezzatura, dotazioni aggiuntive e foto degli scontrini \u2014 su tutti i dispositivi."), /*#__PURE__*/React.createElement("p", {
    className: "pt-1 italic"
  }, "Restano: archivio, classifica del gioco e impostazioni.")), /*#__PURE__*/React.createElement("button", {
    onClick: closeCamp,
    className: "w-full py-3 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase tracking-wide hover:bg-[#463628]"
  }, "Archivia e azzera"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setClosing(false),
    className: "w-full py-2 text-xs uppercase font-bold text-gray-500 hover:text-gray-700"
  }, "Annulla"))), viewArchive && /*#__PURE__*/React.createElement("div", {
    onClick: () => setViewArchive(null),
    className: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "bg-white rounded-lg p-4 w-full max-w-xs space-y-3 max-h-[80vh] overflow-y-auto shadow-2xl"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2"
  }, viewArchive.name), /*#__PURE__*/React.createElement("pre", {
    className: "text-[11px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed"
  }, viewArchive.report || 'Nessun resoconto salvato.'), /*#__PURE__*/React.createElement("button", {
    onClick: () => shareArchive(viewArchive),
    className: "w-full py-2.5 bg-[#25D366] text-white rounded text-xs font-bold uppercase hover:brightness-95"
  }, "\uD83D\uDCE4 Condividi"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewArchive(null),
    className: "w-full py-2 text-xs uppercase font-bold text-gray-500 hover:text-gray-700"
  }, "Chiudi"))), viewReceipt && /*#__PURE__*/React.createElement("div", {
    onClick: () => setViewReceipt(null),
    className: "fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-pointer"
  }, /*#__PURE__*/React.createElement("img", {
    src: viewReceipt,
    alt: "Scontrino",
    className: "max-w-full max-h-full rounded shadow-2xl"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute bottom-6 left-0 right-0 text-center text-[10px] uppercase tracking-widest text-white/60"
  }, "Tocca per chiudere")), /*#__PURE__*/React.createElement("footer", {
    className: "fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#F0F4F1] border-t-2 border-[#5C4A3C] py-3 px-4 text-center z-10"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-rustic text-[#2D392C] tracking-widest text-sm uppercase font-bold"
  }, BRAND.footerMotto)));
}
const root = createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/React.createElement(App, null));