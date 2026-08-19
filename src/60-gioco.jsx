// ============================================================================
//  MINI GIOCO "Aiuta Bandy" — snake in canvas, tutto offline.
//  La canna cresce ogni volta che raccoglie Bandy. Sfondo: bosco visto
//  dall'alto, generato a pixel (nessuna immagine da scaricare).
// ============================================================================
const GAME_COLS = 15;
const BASE_STEP = 170;   // millisecondi per passo al livello 1
const BASE_LEN = 3;      // lunghezza di partenza a ogni livello
const LEVEL_EVERY = 15;  // Bandy necessari per salire di livello
const LEVEL_SPEEDUP = 1.5; // di quanto accelera a ogni livello
const MIN_STEP = 45;     // limite di velocità: sotto diventa ingiocabile
const GAME_ROWS = 19;

// I livelli hanno un nome, non un numero: si parte dal campo, si passa per la
// borgata e si finisce a Rio. Oltre il terzo si resta a Rio e cambia solo la
// velocità, quindi il nome resta quello con un'aggiunta.
const LIVELLI = [
  { nome: 'Prato Lungo', icona: '🌲' },
  { nome: 'Palmiro Togliatti', icona: '🏙️' },
  { nome: 'Rio de Janeiro', icona: '🏖️' },
  { nome: 'Thailandia', icona: '🌃' },
];
const livelloInfo = (n) => LIVELLI[Math.min(n, LIVELLI.length) - 1] || LIVELLI[0];

// Rumore deterministico: lo sfondo è sempre lo stesso ad ogni partita.
const seeded = (n) => { let s = n * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };

// Grana del disegno: quanto è grande un "pixel" dell'arte rispetto a una
// casella. Stava a cell/5 e con la tela a 360 px veniva una scacchiera da 72
// quadretti in larghezza: troppo grossa per far leggere un bosco. Ora la tela
// è a 720 (stesso rapporto, il doppio dei pixel veri, quindi nitida sui
// telefoni che hanno lo schermo denso) e la grana è più fine: 120 quadretti in
// larghezza, che è ancora pixel art ma ha lo spazio per l'ombra di un albero.
const GRANA = 8;
const pxArte = (cell) => Math.max(2, Math.round(cell / GRANA));

function drawForest(ctx, w, h, cell) {
  const rnd = seeded(7);
  const px = pxArte(cell);
  const q = (v) => Math.round(v / px) * px;

  // Disco a blocchi con una funzione di tinta: serve a chiome e cespugli.
  // Prende la distanza dal centro (0 al centro, 1 al bordo) e la direzione
  // della luce, così la chioma ha un volume invece di essere un disco piatto.
  const disco = (cx, cy, r, tinta) => {
    for (let y = cy - r; y <= cy + r; y += px) {
      for (let x = cx - r; x <= cx + r; x += px) {
        const dx = x + px / 2 - cx, dy = y + px / 2 - cy;
        const d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d > 1) continue;
        const col = tinta(d, dx / r, dy / r);
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(q(x), q(y), px, px);
      }
    }
  };

  // --- 1) Terreno: non un verde solo, ma sottobosco a chiazze con la terra
  // che si intravede. È quello che toglie l'effetto "moquette verde". ---
  const suolo = ['#233420', '#1D2B1A', '#2A3E24', '#20321D'];
  ctx.fillStyle = suolo[0];
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += px) {
    for (let x = 0; x < w; x += px) {
      const r = rnd();
      ctx.fillStyle = r > 0.88 ? suolo[2] : r > 0.72 ? suolo[1] : r > 0.62 ? suolo[3] : suolo[0];
      ctx.fillRect(x, y, px, px);
    }
  }
  // chiazze di terra battuta, dove il bosco si dirada
  for (let i = 0; i < 9; i++) {
    const cx = q(rnd() * w), cy = q(rnd() * h), r = cell * (0.5 + rnd() * 0.9);
    disco(cx, cy, r, (d) => {
      if (d > 0.75 && rnd() > 0.45) return null;      // bordo sfrangiato
      return d > 0.5 ? '#26301C' : '#2D3720';
    });
  }

  // --- 2) Ciuffi d'erba e felci: tratti corti e chiari sparsi ---
  for (let i = 0; i < 260; i++) {
    const x = q(rnd() * w), y = q(rnd() * h);
    const alto = rnd() > 0.6;
    ctx.fillStyle = rnd() > 0.5 ? '#3E6B33' : '#356029';
    ctx.fillRect(x, y, px, alto ? px * 3 : px * 2);
    if (rnd() > 0.7) ctx.fillRect(x + px, y + px, px, px * 2);
  }

  // --- 3) Sassi: piccoli gruppi grigio-verdi, con la loro ombra ---
  for (let i = 0; i < 8; i++) {
    const cx = q(rnd() * w), cy = q(rnd() * h), r = px * (1.2 + rnd() * 1.4);
    disco(cx + px, cy + px, r, () => 'rgba(10,18,10,0.45)');
    disco(cx, cy, r, (d, ux, uy) => (ux + uy < -0.3 ? '#5E6356' : d > 0.7 ? '#3C4137' : '#4B5045'));
  }

  // --- 4) Tronchi caduti: danno scala e dicono "bosco" più di mille foglie ---
  for (let i = 0; i < 3; i++) {
    const x = q(rnd() * (w - cell * 4)), y = q(cell + rnd() * (h - cell * 3));
    const lung = q(cell * (2.2 + rnd() * 1.8)), spess = q(px * 3);
    ctx.fillStyle = 'rgba(10,18,10,0.4)';
    ctx.fillRect(x + px, y + px * 2, lung, spess);
    ctx.fillStyle = '#4A3526';
    ctx.fillRect(x, y, lung, spess);
    ctx.fillStyle = '#5C4433';                       // lato illuminato
    ctx.fillRect(x, y, lung, px);
    ctx.fillStyle = '#33241A';                       // nodi e crepe, irregolari
    for (let k = x + px; k < x + lung - px; k += px) {
      if (rnd() > 0.72) ctx.fillRect(k, y + px * (1 + Math.floor(rnd() * 2)), px, px);
    }
  }

  // --- 5) Gli alberi ---
  // Tre misure, chiome con volume (bordo scuro, cuore chiaro, luce in alto a
  // sinistra), ombra portata in basso a destra e qualche ciuffo più scuro
  // dentro. Prima erano dischi piatti a scacchi: da lì l'aria da moquette.
  const specie = [
    { bordo: '#16280F', scuro: '#1F3A18', medio: '#2C5122', chiaro: '#3B6B2E', luce: '#4F8A3C' },
    { bordo: '#152412', scuro: '#1D3520', medio: '#28492B', chiaro: '#356139', luce: '#457A49' },
    { bordo: '#1B2A0E', scuro: '#264014', medio: '#365A1D', chiaro: '#487628', luce: '#5E9636' },
  ];
  const alberi = [];
  const mettiAlbero = (cx, cy, r) => {
    const sp = specie[Math.floor(rnd() * specie.length)];
    // ombra portata: è quello che stacca la chioma dal terreno
    disco(cx + r * 0.16, cy + r * 0.2, r * 0.98, (d) => (d > 0.9 ? null : 'rgba(8,16,8,0.42)'));
    // chioma
    disco(cx, cy, r, (d, ux, uy) => {
      if (d > 0.94 && rnd() > 0.5) return null;       // bordo frastagliato
      const luceQui = (-ux - uy) * 0.5;               // luce da in alto a sinistra
      const t = d - luceQui * 0.35;
      if (t > 0.86) return sp.bordo;
      if (t > 0.6) return sp.scuro;
      if (t > 0.32) return sp.medio;
      if (t > 0.05) return sp.chiaro;
      return sp.luce;
    });
    // ciuffi di fogliame più scuro, per non farla sembrare una palla liscia
    const ciuffi = 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < ciuffi; k++) {
      const a = rnd() * Math.PI * 2, dist = r * (0.25 + rnd() * 0.5);
      disco(q(cx + Math.cos(a) * dist), q(cy + Math.sin(a) * dist), r * (0.16 + rnd() * 0.13),
        (d) => (d > 0.8 ? null : d > 0.45 ? sp.medio : sp.chiaro));
    }
    alberi.push({ cx, cy, r });
  };

  // Prima i grandi, poi i medi, poi i cespugli: si sovrappongono e il bosco
  // sembra fitto invece che a pois.
  for (let i = 0; i < 9; i++) mettiAlbero(q(rnd() * w), q(rnd() * h), cell * (1.15 + rnd() * 0.55));
  for (let i = 0; i < 14; i++) mettiAlbero(q(rnd() * w), q(rnd() * h), cell * (0.7 + rnd() * 0.35));
  for (let i = 0; i < 14; i++) {
    const cx = q(rnd() * w), cy = q(rnd() * h), r = cell * (0.3 + rnd() * 0.22);
    disco(cx + r * 0.2, cy + r * 0.25, r, (d) => (d > 0.9 ? null : 'rgba(8,16,8,0.35)'));
    disco(cx, cy, r, (d, ux, uy) => {
      if (d > 0.9 && rnd() > 0.4) return null;
      const t = d - (-ux - uy) * 0.2;
      return t > 0.75 ? '#1E3618' : t > 0.4 ? '#2B4C22' : '#3A6630';
    });
  }
}

// Livello 2: strada vista dall'alto. Due corsie, rotaie del tram al centro,
// e ai bordi si intravedono i portoni dei palazzi.
function drawStreet(ctx, w, h, cell) {
  const rnd = seeded(23);
  const px = pxArte(cell);
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

// Livello 3: la spiaggia di Rio vista dall'alto. Fasce verticali come il
// livello 2 — mare, risacca, sabbia bagnata, sabbia asciutta, lungomare —
// così il campo da gioco resta leggibile: la sabbia chiara al centro è dove
// si gioca davvero, e il corpo scuro del livello 3 ci si stacca sopra.
const BR = { verde: '#1E9C4A', giallo: '#F5D311', blu: '#17297A', bianco: '#F4F2EA' };

// Bandiera brasiliana in miniatura, a blocchi: campo verde, rombo giallo,
// cerchio blu. Serve a dire "Rio" senza scriverlo.
function drawFlag(ctx, x, y, w, h, px) {
  const q = (v) => Math.round(v / px) * px;
  const X = q(x), Y = q(y), W = q(w), H = q(h);
  // asta
  ctx.fillStyle = '#6B5636';
  ctx.fillRect(X - px, Y, px, H + px * 3);
  ctx.fillStyle = BR.verde;
  ctx.fillRect(X, Y, W, H);
  // rombo giallo
  const cx = X + W / 2, cy = Y + H / 2, rw = W * 0.38, rh = H * 0.38;
  ctx.fillStyle = BR.giallo;
  for (let py = Y; py < Y + H; py += px) {
    for (let pxx = X; pxx < X + W; pxx += px) {
      const dx = Math.abs(pxx + px / 2 - cx) / rw;
      const dy = Math.abs(py + px / 2 - cy) / rh;
      if (dx + dy <= 1) ctx.fillRect(pxx, py, px, px);
    }
  }
  // cerchio blu
  const r = Math.min(rw, rh) * 0.62;
  ctx.fillStyle = BR.blu;
  for (let py = Y; py < Y + H; py += px) {
    for (let pxx = X; pxx < X + W; pxx += px) {
      const dx = pxx + px / 2 - cx, dy = py + px / 2 - cy;
      if (dx * dx + dy * dy <= r * r) ctx.fillRect(pxx, py, px, px);
    }
  }
  // la fascia bianca dell'"Ordem e Progresso": una riga sola, basta a leggerla
  ctx.fillStyle = BR.bianco;
  ctx.fillRect(q(cx - r * 0.8), q(cy - px / 2), q(r * 1.6), px);
}

function drawBeach(ctx, w, h, cell) {
  const rnd = seeded(41);
  const px = pxArte(cell);
  const q = (v) => Math.round(v / px) * px;

  // Le fasce sono strette ai bordi e larghe al centro: la sabbia asciutta è il
  // campo da gioco vero, e deve tenersi la parte grossa. Mare e lungomare
  // servono a dire dove siamo, non a rubare spazio.
  const mare = q(w * 0.17);        // acqua
  const risacca = q(w * 0.21);     // schiuma
  const bagnata = q(w * 0.27);     // sabbia bagnata
  const lungomare = q(w * 0.88);   // inizio del calçadão

  // --- Mare: l'acqua è fatta di onde lunghe che corrono verso riva, non di
  // rumore. Ogni colonna prende il tono dalla distanza dalla riva più una
  // sinusoide lungo y: si legge come mare mosso invece che come disturbo. ---
  const toni = ['#12557E', '#175F91', '#1B6D9E', '#2280B4', '#2E93C4', '#43A6CE'];
  for (let x = 0; x < mare; x += px) {
    const t = x / mare;
    for (let y = 0; y < h; y += px) {
      const onda = Math.sin(y / (cell * 1.9) + t * 5.2) * 0.5 + 0.5;
      const k = Math.min(toni.length - 1, Math.floor(t * 3.4 + onda * 2.2));
      ctx.fillStyle = toni[k];
      ctx.fillRect(x, y, px, px);
    }
  }
  // creste di schiuma: tre linee spesse che seguono l'onda
  for (let k = 0; k < 3; k++) {
    const base = q(mare * (0.28 + k * 0.24));
    for (let y = 0; y < h; y += px) {
      const off = q(Math.sin(y / (cell * 1.9) + k * 1.1) * cell * 0.3);
      ctx.fillStyle = '#9FDCEC';
      ctx.fillRect(base + off, y, px, px);
      ctx.fillStyle = '#D6F0F7';
      ctx.fillRect(base + off, y, px, Math.max(1, Math.round(px / 2)));
    }
  }

  // --- Risacca: schiuma bianca, bordo frastagliato ---
  for (let y = 0; y < h; y += px) {
    const off = q(Math.sin(y / (cell * 1.1)) * cell * 0.18);
    for (let x = mare; x < risacca; x += px) {
      ctx.fillStyle = rnd() > 0.3 ? BR.bianco : '#D9EDF3';
      ctx.fillRect(x + off, y, px, px);
    }
  }

  // --- Sabbia bagnata: la striscia scura appena lasciata dall\'onda ---
  for (let x = risacca; x < bagnata; x += px) {
    for (let y = 0; y < h; y += px) {
      ctx.fillStyle = rnd() > 0.8 ? '#B99A6B' : '#C6A878';
      ctx.fillRect(x, y, px, px);
    }
  }

  // --- Sabbia asciutta: chiara e poco rumorosa, ci si deve giocare sopra ---
  for (let x = bagnata; x < lungomare; x += px) {
    for (let y = 0; y < h; y += px) {
      const r = rnd();
      ctx.fillStyle = r > 0.96 ? '#F2E0BC' : r > 0.9 ? '#E3C998' : '#EAD3A6';
      ctx.fillRect(x, y, px, px);
    }
  }

  // --- Lungomare di Copacabana: il mosaico a onde bianco e nero ---
  ctx.fillStyle = BR.bianco;
  ctx.fillRect(lungomare, 0, w - lungomare, h);
  ctx.fillStyle = '#2A2A2E';
  const larg = w - lungomare;
  for (let y = 0; y < h; y += px) {
    const s = Math.sin(y / (cell * 1.1));
    ctx.fillRect(q(lungomare + larg * 0.28 + s * larg * 0.2), y, px * 2, px);
    ctx.fillRect(q(lungomare + larg * 0.74 - s * larg * 0.2), y, px * 2, px);
  }
  ctx.fillStyle = '#9A8A6E';                      // cordolo
  ctx.fillRect(lungomare - px, 0, px, h);

  // --- Ombrelloni: pochi e grandi, altrimenti sembrano girandole ---
  const tinte = [['#E23B2E', '#F4F2EA'], ['#F5D311', '#1E9C4A'], ['#1B7FC4', '#F4F2EA']];
  const posti = [[0.62, 0.09], [0.30, 0.30], [0.10, 0.56], [0.80, 0.71], [0.52, 0.91]];
  posti.forEach((pp, idx) => {
    const cx = q(bagnata + (lungomare - bagnata) * pp[0]);
    const cy = q(h * pp[1]);
    const r = cell * 1.05;
    const [a, b] = tinte[idx % tinte.length];
    // ombra portata
    ctx.fillStyle = 'rgba(150,120,80,0.28)';
    for (let y = cy - r; y < cy + r; y += px) {
      for (let x = cx - r; x < cx + r; x += px) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r) ctx.fillRect(q(x) + px * 1.5, q(y) + px * 1.5, px, px);
      }
    }
    // sei spicchi: a questa dimensione si leggono come un ombrellone
    for (let y = cy - r; y < cy + r; y += px) {
      for (let x = cx - r; x < cx + r; x += px) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const ang = Math.atan2(dy, dx) + Math.PI;
        ctx.fillStyle = Math.floor(ang / (Math.PI / 3)) % 2 ? a : b;
        ctx.fillRect(q(x), q(y), px, px);
      }
    }
    // bordo e puntale
    ctx.fillStyle = 'rgba(90,70,40,0.35)';
    for (let t = 0; t < Math.PI * 2; t += 0.12) ctx.fillRect(q(cx + Math.cos(t) * r), q(cy + Math.sin(t) * r), px, px);
    ctx.fillStyle = '#5B4A32';
    ctx.fillRect(q(cx) - px, q(cy) - px, px * 2, px * 2);
  });

  // --- Teli stesi: rettangoli con la frangia, per non lasciare la sabbia vuota ---
  [[0.14, 0.20, '#E23B2E'], [0.56, 0.58, '#1B7FC4'], [0.84, 0.90, '#F5D311']]
    .forEach((t) => {
      const x = q(bagnata + (lungomare - bagnata) * t[0]);
      const y = q(h * t[1]);
      const tw = q(cell * 1.5), th = q(cell * 1.0);
      ctx.fillStyle = 'rgba(150,120,80,0.25)';
      ctx.fillRect(x + px, y + px, tw, th);
      ctx.fillStyle = t[2];
      ctx.fillRect(x, y, tw, th);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';       // righe del telo
      for (let k = y + px; k < y + th; k += px * 3) ctx.fillRect(x, k, tw, px);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';             // frangia ai due lati corti
      ctx.fillRect(x, y, tw, px);
      ctx.fillRect(x, y + th - px, tw, px);
    });

  // --- Bandiere: due piantate nella sabbia, una sul lungomare ---
  const fw = cell * 2.1, fh = cell * 1.4;
  drawFlag(ctx, bagnata + cell * 0.5, cell * 0.5, fw, fh, px);
  drawFlag(ctx, bagnata + (lungomare - bagnata) * 0.62, h * 0.42, fw, fh, px);
  drawFlag(ctx, bagnata + cell * 0.5, h - cell * 3.1, fw, fh, px);
  drawFlag(ctx, lungomare + larg * 0.1, h * 0.06, fw * 0.62, fh * 0.62, px);
}

// Livello 4: la strada dei night club in Thailandia, di notte. Stessa
// impaginazione a fasce verticali degli altri livelli — locali ai due lati,
// asfalto in mezzo — ma al buio: l'asfalto è scuro, i locali sono insegne al
// neon e la luce si riflette sulla strada bagnata.
const TH = { rosso: '#D82B3C', blu: '#1B2C6B', bianco: '#F2F0EA' };
// Insegne: gli stessi cinque colori di prima, ma tirati giù di saturazione e
// di luce. Il neon acceso al massimo su asfalto quasi nero è il contrasto
// cromatico più aggressivo che ci sia, e dopo dieci minuti di partita gli
// occhi se ne accorgono. Le tinte restano riconoscibili — rosa, ciano, ambra,
// verde, viola — ma nessun canale passa i 200 invece di sfiorare 255.
const NEON = ['#C9628E', '#5BAEB8', '#C9A85C', '#6FB98C', '#9A72C4'];

// Bandiera thailandese: cinque bande orizzontali rosso-bianco-blu-bianco-rosso,
// con quella blu doppia. È l'unica cosa che dice "Thailandia" a colpo d'occhio.
function drawThaiFlag(ctx, x, y, w, h, px) {
  const q = (v) => Math.round(v / px) * px;
  const X = q(x), Y = q(y), W = q(w);
  const u = Math.max(px, q(h / 6));            // banda unitaria: 1-1-2-1-1
  ctx.fillStyle = '#7A6647';
  ctx.fillRect(X - px, Y, px, u * 6 + px * 3); // asta
  const bande = [[TH.rosso, 1], [TH.bianco, 1], [TH.blu, 2], [TH.bianco, 1], [TH.rosso, 1]];
  let cy = Y;
  bande.forEach(([col, n]) => {
    ctx.fillStyle = col;
    ctx.fillRect(X, cy, W, u * n);
    cy += u * n;
  });
}

function drawThai(ctx, w, h, cell) {
  const rnd = seeded(59);
  const px = pxArte(cell);
  const q = (v) => Math.round(v / px) * px;
  const bordo = q(cell * 1.9);                 // fascia dei locali, per lato

  // --- Asfalto notturno: scuro ma non nero, altrimenti il corpo ci sparisce ---
  for (let x = 0; x < w; x += px) {
    for (let y = 0; y < h; y += px) {
      const r = rnd();
      ctx.fillStyle = r > 0.93 ? '#332C3F' : r > 0.85 ? '#221E2A' : '#2A2532';
      ctx.fillRect(x, y, px, px);
    }
  }

  // --- Mezzeria tratteggiata, sbiadita: di notte si vede poco ---
  ctx.fillStyle = '#6B6350';
  for (let y = 0; y < h; y += cell * 1.7) ctx.fillRect(q(w / 2) - px / 2, y, px, q(cell * 0.9));

  // --- I locali ai due lati: facciata, porta buia, insegna al neon ---
  // L'insegna sporge sulla strada, come le tabelle luminose vere: è quello che
  // fa leggere "strada di locali" invece di "strada scura".
  const locali = [];
  [0, w - bordo].forEach((bx, lato) => {
    ctx.fillStyle = '#544A63';
    ctx.fillRect(bx, 0, bordo, h);
    ctx.fillStyle = '#463D55';
    for (let y = 0; y < h; y += px * 4) ctx.fillRect(bx, y, bordo, px);   // lastre
    // cordolo verso la strada: separa il marciapiede dall'asfalto
    ctx.fillStyle = '#75688A';
    ctx.fillRect(lato === 0 ? bx + bordo - px : bx, 0, px, h);

    let y = q(cell * 0.6);
    let i = lato;
    while (y < h - cell * 1.6) {
      const alt = q(cell * (1.7 + rnd() * 0.9));
      const col = NEON[i % NEON.length];
      // facciata: ogni locale ha il suo tono, così si contano
      ctx.fillStyle = i % 2 ? '#5E5270' : '#4C4260';
      ctx.fillRect(bx, y, bordo, alt);
      ctx.fillStyle = '#3B3349';                            // divisorio fra locali
      ctx.fillRect(bx, y, bordo, px);
      // ingresso: rettangolo nero con lo stipite acceso al neon
      const pw = q(bordo * 0.66), ph = q(alt * 0.5);
      const pxx = lato === 0 ? bx + bordo - pw - px : bx + px;
      const py0 = q(y + alt * 0.25);
      ctx.fillStyle = col;
      ctx.fillRect(pxx - px, py0 - px, pw + px * 2, ph + px * 2);
      ctx.fillStyle = '#0E0A14';
      ctx.fillRect(pxx, py0, pw, ph);
      // insegna che sporge sulla strada
      const sw = q(cell * 1.15), sh = q(cell * 0.62);
      const sx = lato === 0 ? bx + bordo : bx - sw;
      const sy = q(y + alt * 0.3);
      ctx.fillStyle = '#171320';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = col;
      ctx.fillRect(sx, sy, sw, px);
      ctx.fillRect(sx, sy + sh - px, sw, px);
      ctx.fillRect(sx, sy, px, sh);
      ctx.fillRect(sx + sw - px, sy, px, sh);
      // "scritta" al neon: due righe di lettere finte. Con la grana grossa di
      // prima era un trattino solo; ora ci stanno e l'insegna si legge come
      // un'insegna invece che come un rettangolo colorato.
      ctx.fillStyle = col;
      [q(sy + sh * 0.32), q(sy + sh * 0.6)].forEach((ry, riga) => {
        for (let k = sx + px * 2; k < sx + sw - px * 2; k += px * 3) {
          if (riga === 1 && rnd() > 0.75) continue;   // seconda riga più corta
          ctx.fillRect(k, ry, px * 2, px);
        }
      });
      locali.push({ x: sx + sw / 2, y: sy + sh / 2, col, lato });
      y += alt + q(cell * 0.35);
      i++;
    }
  });

  // --- Aloni e riflessi sull'asfalto bagnato ---
  // Prima gli aloni attorno alle insegne, poi le colate verticali di luce
  // verso il centro strada: è quello che dà la notte piovosa.
  locali.forEach((l) => {
    const r = cell * 2.2;
    for (let y = l.y - r; y < l.y + r; y += px) {
      for (let x = l.x - r; x < l.x + r; x += px) {
        const dx = x - l.x, dy = y - l.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        const a = (1 - d / r) * 0.07;
        ctx.fillStyle = l.col;
        ctx.globalAlpha = a;
        ctx.fillRect(q(x), q(y), px, px);
      }
    }
    ctx.globalAlpha = 1;
    // colata sull'asfalto verso il centro
    const verso = l.lato === 0 ? 1 : -1;
    for (let k = 0; k < cell * 3.2; k += px) {
      ctx.globalAlpha = 0.06 * (1 - k / (cell * 3.2));
      ctx.fillStyle = l.col;
      const larg = q(cell * 0.5 + k * 0.25);
      ctx.fillRect(q(l.x + verso * k), q(l.y - larg / 2), px, larg);
    }
    ctx.globalAlpha = 1;
  });

  // --- Pozzanghere: asfalto bagnato che rimanda il neon ---
  // Restano scure e poco contrastate: sono atmosfera, non devono disturbare
  // la lettura del corpo che ci passa sopra.
  [[0.30, 0.42, NEON[0]], [0.70, 0.18, NEON[1]], [0.58, 0.86, NEON[3]]].forEach((pz) => {
    const cx = q(w * pz[0]), cy = q(h * pz[1]);
    const rx = cell * 1.5, ry = cell * 0.75;
    for (let y = cy - ry; y < cy + ry; y += px) {
      for (let x = cx - rx; x < cx + rx; x += px) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        ctx.fillStyle = '#1A1622';
        ctx.fillRect(q(x), q(y), px, px);
      }
    }
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = pz[2];
    for (let y = cy - ry; y < cy + ry; y += px * 2) {
      const largh = q(rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)) * 0.7);
      ctx.fillRect(q(cx - largh / 2), q(y), largh, px);
    }
    ctx.globalAlpha = 1;
  });

  // --- Palme lungo il bordo strada, viste dall'alto ---
  // Un tronco e le foglie che partono a raggiera: dall'alto una palma è
  // questo, ed è il secondo segnale (dopo le bandiere) che dice dove siamo.
  const palma = (cx, cy) => {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.3;
      for (let t = px; t < cell * 1.25; t += px) {
        ctx.fillRect(q(cx + Math.cos(a) * t + px), q(cy + Math.sin(a) * t + px), px, px);
      }
    }
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.3;
      const lung = cell * (0.95 + (k % 3) * 0.18);
      for (let t = px; t < lung; t += px) {
        const largo = t < lung * 0.5 ? px * 3 : t < lung * 0.8 ? px * 2 : px;
        ctx.fillStyle = t < lung * 0.45 ? '#2F6B34' : '#23522A';
        ctx.fillRect(q(cx + Math.cos(a) * t), q(cy + Math.sin(a) * t), largo, largo);
      }
    }
    ctx.fillStyle = '#5B4326';
    ctx.fillRect(q(cx) - px, q(cy) - px, px * 3, px * 3);
  };
  [0.16, 0.52, 0.88].forEach((fy, i) => {
    palma(q(bordo + cell * 1.15), q(h * fy));
    palma(q(w - bordo - cell * 1.15), q(h * (fy + (i % 2 ? -0.13 : 0.13))));
  });

  // --- Motorini in fila contro il marciapiede ---
  [[0.30, 0, '#A8443F'], [0.66, 0, '#3E6FA8'], [0.44, 1, '#AE9440'], [0.80, 1, '#7A55A0']].forEach((mt) => {
    const lato = mt[1];
    const cx = q(lato === 0 ? bordo + cell * 0.42 : w - bordo - cell * 0.42);
    const cy = q(h * mt[0]);
    const lu = q(cell * 0.95), la = q(cell * 0.42);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - la / 2 + px, cy - lu / 2 + px, la, lu);
    ctx.fillStyle = mt[2];
    ctx.fillRect(cx - la / 2, cy - lu / 2, la, lu);
    ctx.fillStyle = '#141019';                                  // sella
    ctx.fillRect(cx - la / 2, q(cy - lu * 0.05), la, q(lu * 0.3));
    ctx.fillStyle = '#D9D4C6';                                  // specchietti
    ctx.fillRect(cx - la / 2 - px, cy - lu / 2, px, px);
    ctx.fillRect(cx + la / 2, cy - lu / 2, px, px);
  });

  // --- Due tuk-tuk fermi in mezzo alla strada, visti dall'alto ---
  // I tettucci pescano dalla tavolozza invece di avere i colori scritti a
  // mano: erano rimasti indietro con i vecchi neon accesi al massimo, ed
  // essendo in mezzo alla carreggiata erano la cosa che stancava di più.
  [[0.38, 0.28, NEON[2]], [0.62, 0.68, NEON[3]]].forEach((t) => {
    const cx = q(w * t[0]), cy = q(h * t[1]);
    const tw = q(cell * 1.05), th = q(cell * 1.7);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';                         // ombra
    ctx.fillRect(cx - tw / 2 + px * 2, cy - th / 2 + px * 2, tw, th);
    ctx.fillStyle = '#2A2536';                                  // ruote ai lati
    [cy - th * 0.28, cy + th * 0.3].forEach((wy) => {
      ctx.fillRect(cx - tw / 2 - px, q(wy), px, q(cell * 0.3));
      ctx.fillRect(cx + tw / 2, q(wy), px, q(cell * 0.3));
    });
    ctx.fillStyle = t[2];                                       // tettuccio
    ctx.fillRect(cx - tw / 2, cy - th / 2, tw, th);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';                         // centine del telo
    for (let k = cy - th / 2 + px * 2; k < cy + th / 2; k += px * 4) ctx.fillRect(cx - tw / 2, q(k), tw, px);
    ctx.fillStyle = '#1B1724';                                  // vano passeggeri
    ctx.fillRect(cx - tw / 2 + px, q(cy + th * 0.12), tw - px * 2, q(th * 0.32));
    ctx.fillStyle = '#FFF3C4';                                  // fari
    ctx.fillRect(cx - px * 2, cy - th / 2 - px, px * 2, px);
    ctx.fillRect(cx + px, cy - th / 2 - px, px * 2, px);
  });

  // --- Bandiere thailandesi appese alle facciate ---
  // Vanno per ultime e con un fondo scuro dietro: sopra un muro di insegne al
  // neon, senza stacco, si perderebbero fra le altre strisce colorate — e sono
  // l'unica cosa che dice "Thailandia" invece di "strada di locali".
  const fw = q(bordo * 0.78), fh = q(cell * 1.15);
  const appendi = (x, y) => {
    ctx.fillStyle = '#0E0A14';
    ctx.fillRect(q(x) - px * 2, q(y) - px * 2, fw + px * 4, fh + px * 4);
    ctx.fillStyle = '#F2F0EA';
    ctx.fillRect(q(x) - px, q(y) - px, fw + px * 2, fh + px * 2);
    drawThaiFlag(ctx, x, y, fw, fh, px);
  };
  appendi(bordo * 0.12, cell * 0.9);
  appendi(w - bordo * 0.9, h * 0.30);
  appendi(bordo * 0.12, h * 0.62);
  appendi(w - bordo * 0.9, h - cell * 2.4);
}

// Livello 2+: il corpo è un tubo cartoon a blocchi (stile fumetto, non
// realistico) con la punta arrotondata e due lobi alla base.
const SK = { skin: '#E4A882', shade: '#C98D68', light: '#F4CFAF', tip: '#E8A090', crease: '#A9714F' };
// Livello 3: stessa forma, carnagione scura. Sulla sabbia chiara si stacca
// meglio del livello 2, che sull'asfalto grigio funzionava al contrario.
const SK3 = { skin: '#8D5A3B', shade: '#6B4229', light: '#B37B50', tip: '#96543C', crease: '#472A18' };
// Livello 4: strada al buio. Serve una carnagione chiara con un filo di neon
// addosso, altrimenti sull'asfalto notturno il corpo sparisce.
const SK4 = { skin: '#D9A279', shade: '#9E6E4C', light: '#EDA6C4', tip: '#E9A9A0', crease: '#6B4530' };
// Livello 1: la canna come cilindro continuo, con brace tonda e sfumata
// e filtro in fondo (prima era una catena di quadretti staccati).
const JO = { paper: '#F6EFDF', paper2: '#E9DFC7', seam: '#DCCFB2', filter: '#B98F5E', filter2: '#9C7345' };
function drawJoint(ctx, snake, i, cell, offX, offY, dir) {
  const seg = snake[i];
  const x = offX + seg.x * cell, y = offY + seg.y * cell;
  const u = cell / 10;
  const T = cell - u * 3.6;                  // spessore della cartina
  const cx = x + cell / 2, cy = y + cell / 2;
  const total = snake.length;
  const bandTo = (nb) => {
    if (!nb) return;
    const dx = nb.x - seg.x, dy = nb.y - seg.y;
    if (dx > 0) ctx.fillRect(cx, cy - T / 2, cell / 2 + 1, T);
    else if (dx < 0) ctx.fillRect(x - 1, cy - T / 2, cell / 2 + 1, T);
    else if (dy > 0) ctx.fillRect(cx - T / 2, cy, T, cell / 2 + 1);
    else if (dy < 0) ctx.fillRect(cx - T / 2, y - 1, T, cell / 2 + 1);
  };

  if (i === 0) {
    const d = dir && (dir.x || dir.y) ? dir : { x: 0, y: -1 };
    // cartina fino alla punta
    ctx.fillStyle = JO.paper;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[1]);
    // brace: cerchio con sfumatura + alone morbido
    const ex = cx + d.x * u * 1.2, ey = cy + d.y * u * 1.2;
    const r = T * 0.5;
    const glow = ctx.createRadialGradient(ex, ey, r * 0.3, ex, ey, r * 2.1);
    glow.addColorStop(0, 'rgba(255,150,40,0.45)');
    glow.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(ex, ey, r * 2.1, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(ex - r * 0.25, ey - r * 0.25, r * 0.1, ex, ey, r);
    g.addColorStop(0, '#FFF3C4');
    g.addColorStop(0.4, '#FFB13B');
    g.addColorStop(0.8, '#E06A0C');
    g.addColorStop(1, '#8E3406');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
    return;
  }

  if (i === total - 1 && total > 2) {
    // filtro di cartoncino
    ctx.fillStyle = JO.filter;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[i - 1]);
    ctx.fillStyle = JO.filter2;
    const horizT = snake[i - 1].y === seg.y;
    if (horizT) ctx.fillRect(cx - T / 2, cy - T / 2, u * 1.2, T);
    else ctx.fillRect(cx - T / 2, cy - T / 2, T, u * 1.2);
    return;
  }

  // corpo: cartina con una leggera ombra lungo l'asse
  ctx.fillStyle = JO.paper;
  ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
  bandTo(snake[i - 1]);
  bandTo(snake[i + 1]);
  const horiz = (snake[i - 1] && snake[i - 1].y === seg.y) || (snake[i + 1] && snake[i + 1].y === seg.y);
  ctx.fillStyle = JO.paper2;
  if (horiz) ctx.fillRect(x, cy + T * 0.18, cell, u * 1.1);
  else ctx.fillRect(cx + T * 0.18, y, u * 1.1, cell);
  ctx.fillStyle = JO.seam;                    // cucitura della cartina
  if (i % 3 === 0) {
    if (horiz) ctx.fillRect(cx - u * 0.4, cy - T / 2, u * 0.8, T);
    else ctx.fillRect(cx - T / 2, cy - u * 0.4, T, u * 0.8);
  }
}

function drawBody(ctx, snake, i, cell, offX, offY, dir, pal) {
  const SKIN = pal || SK;
  const seg = snake[i];
  const x = offX + seg.x * cell, y = offY + seg.y * cell;
  const u = cell / 10;
  const T = cell - u * 2.6;                 // spessore unico per tutto il fusto
  const cx = x + cell / 2, cy = y + cell / 2;
  const total = snake.length;

  // banda dal centro della cella verso un segmento vicino: garantisce
  // spessore uniforme anche nelle curve (niente gradini)
  const bandTo = (n) => {
    if (!n) return;
    const dx = n.x - seg.x, dy = n.y - seg.y;
    if (dx > 0) ctx.fillRect(cx, cy - T / 2, cell / 2 + 1, T);
    else if (dx < 0) ctx.fillRect(x - 1, cy - T / 2, cell / 2 + 1, T);
    else if (dy > 0) ctx.fillRect(cx - T / 2, cy, T, cell / 2 + 1);
    else if (dy < 0) ctx.fillRect(cx - T / 2, y - 1, T, cell / 2 + 1);
  };

  if (i === 0) {
    // Punta a mezza sfera orientata nel senso di marcia
    const d = dir && (dir.x || dir.y) ? dir : { x: 0, y: -1 };
    const th = Math.atan2(d.y, d.x);
    ctx.fillStyle = SKIN.skin;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[1]);
    ctx.fillStyle = SKIN.tip;
    ctx.beginPath();
    ctx.arc(cx, cy, T / 2, th - Math.PI / 2, th + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SKIN.light;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(th - 0.7) * T * 0.22, cy + Math.sin(th - 0.7) * T * 0.22, T * 0.12, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (i === total - 1 && total > 2) {
    // Base: due lobi ben visibili
    ctx.fillStyle = SKIN.skin;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[i - 1]);
    const prev = snake[i - 1];
    const vertical = prev.x === seg.x;      // lobi affiancati rispetto all'asse
    const r = cell * 0.34, off = cell * 0.33;
    const lobe = (a, b) => { ctx.beginPath(); ctx.arc(a, b, r, 0, Math.PI * 2); ctx.fill(); };
    ctx.fillStyle = SKIN.shade;
    if (vertical) { lobe(cx - off, cy + u * 0.8); lobe(cx + off, cy + u * 0.8); }
    else { lobe(cx + u * 0.8, cy - off); lobe(cx + u * 0.8, cy + off); }
    // piega centrale: fa leggere due lobi distinti invece di un ovale unico
    ctx.fillStyle = SKIN.crease;
    if (vertical) ctx.fillRect(cx - u * 0.25, cy - u * 0.6, u * 0.5, r * 1.5);
    else ctx.fillRect(cx - u * 0.6, cy - u * 0.25, r * 1.5, u * 0.5);
    ctx.fillStyle = SKIN.skin;                 // raccordo sopra i lobi
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    return;
  }

  // Fusto: spessore identico per ogni segmento
  ctx.fillStyle = SKIN.skin;
  ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
  bandTo(snake[i - 1]);
  bandTo(snake[i + 1]);
  // luce lungo l'asse del tubo
  const horiz = (snake[i - 1] && snake[i - 1].y === seg.y) || (snake[i + 1] && snake[i + 1].y === seg.y);
  ctx.fillStyle = SKIN.light;
  if (horiz) ctx.fillRect(x, cy - T * 0.34, cell, u * 1.2);
  else ctx.fillRect(cx - T * 0.34, y, u * 1.2, cell);
}

function BandyGame({ playerName, onExit, onGameOver, bestLocal }) {
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
    const mkBg = (fn) => {
      const c = document.createElement('canvas');
      c.width = canvas.width; c.height = canvas.height;
      fn(c.getContext('2d'), canvas.width, canvas.height, cell);
      return c;
    };
    const bgForest = mkBg(drawForest);
    const bgStreet = mkBg(drawStreet);
    const bgBeach = mkBg(drawBeach);
    const bgThai = mkBg(drawThai);
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
        // dal fondo verso la testa, così la punta resta sopra
        const pal = st.level >= 4 ? SK4 : st.level >= 3 ? SK3 : SK;
        for (let i = st.snake.length - 1; i >= 0; i--) {
          drawBody(ctx, st.snake, i, cell, offX, offY, st.dir, pal);
        }
        return;
      }
      // la canna: dal fondo verso la testa, così la brace resta sopra
      for (let i = st.snake.length - 1; i >= 0; i--) {
        drawJoint(ctx, st.snake, i, cell, offX, offY, st.dir);
      }
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
                // a ogni livello la velocità aumenta di una volta e mezza
                st.step = Math.max(MIN_STEP, Math.round(BASE_STEP / Math.pow(LEVEL_SPEEDUP, nextLevel - 1)));
                // si riparte dalla lunghezza base, mantenendo posizione e direzione
                st.snake = st.snake.slice(0, BASE_LEN);
                st.queue = [];
                bgRef.current = nextLevel >= 4 ? bgThai : nextLevel >= 3 ? bgBeach : nextLevel >= 2 ? bgStreet : bgForest;
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

    // Il dito deve poter fare due svolte di fila come la tastiera. Prima una
    // strisciata valeva una svolta sola: per girare di nuovo bisognava alzare
    // il dito e riappoggiarlo, e dal livello 3 in poi quel tempo morto vale
    // due o tre caselle. Ora dopo ogni svolta il punto di partenza si sposta
    // dov'è il dito adesso, così la seconda gamba di una L conta come una
    // strisciata nuova senza staccare.
    // Il prezzo di questa libertà è il trascinamento in diagonale, che
    // altrimenti farebbe zigzagare Bandy da solo: dalla seconda svolta in poi
    // serve un gesto più lungo e con una direzione chiaramente prevalente.
    const SOGLIA_1 = 16;    // px per la prima svolta: deve rispondere subito
    const SOGLIA_N = 26;    // px per quelle successive, dito ancora giù
    const NETTEZZA = 1.6;   // quanto la direzione deve battere l'altra
    let sx = 0, sy = 0, girato = false;
    const onStart = (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; girato = false; };
    const onMove = (e) => {
      const t = e.touches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < (girato ? SOGLIA_N : SOGLIA_1) && ay < (girato ? SOGLIA_N : SOGLIA_1)) return;
      if (girato && Math.max(ax, ay) < Math.min(ax, ay) * NETTEZZA) return;
      // Svolta appena il dito ha percorso abbastanza: non aspetta il rilascio.
      if (ax > ay) turn(dx > 0 ? 1 : -1, 0); else turn(0, dy > 0 ? 1 : -1);
      sx = t.clientX; sy = t.clientY;
      girato = true;
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

  // Schermo intero: su Android/desktop usa l'API Fullscreen; su iPhone quella
  // API non esiste, ma il gioco è già un overlay che copre tutto lo schermo.
  useEffect(() => {
    const el = wrapRef.current;
    const req = el && (el.requestFullscreen || el.webkitRequestFullscreen);
    if (req) { try { req.call(el); } catch (e) { /* niente fullscreen: resta l'overlay */ } }
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
        try { exit.call(document); } catch (e) { /* ignora */ }
      }
    };
  }, []);

  const nudge = (x, y) => { const st = stateRef.current; if (st && st.turn) st.turn(x, y); };
  const togglePause = () => {
    const st = stateRef.current; if (!st || !st.alive) return;
    st.pause = !st.pause; setPaused(st.pause);
  };

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 z-50 bg-[#1F271E] flex flex-col gap-2 p-2"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {/* "Palmiro Togliatti" è lungo: su un telefono stretto questa riga
          deve accorciare il nome, non spingere fuori il punteggio. */}
      <div className="flex items-center justify-between gap-2 bg-white/95 px-3 py-2 rounded-lg shrink-0">
        <span className="text-xs uppercase font-bold text-gray-500 truncate max-w-[24%]">{playerName}</span>
        <span className="font-rustic text-lg text-[#2D392C] shrink-0">{score} 🌿</span>
        <span className="text-[10px] text-gray-400 min-w-0 truncate text-right">
          {livelloInfo(level).icona} {livelloInfo(level).nome} · -{Math.max(0, level * 15 - score)} · rec {bestLocal}
        </span>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={720}
          height={912}
          className="rounded-lg border-2 border-[#2D392C]/40 touch-none max-h-full max-w-full"
          style={{ imageRendering: 'pixelated', height: '100%', width: 'auto', aspectRatio: '720 / 912' }}
        />
        {levelUp && !over && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/70 px-5 py-3 rounded-lg text-center">
              <div className="text-[10px] uppercase tracking-widest text-[#8F9E8B]">Livello {level}</div>
              <div className="font-rustic text-2xl text-[#D97706] leading-tight">
                {livelloInfo(level).icona} {livelloInfo(level).nome}
              </div>
              {level > LIVELLI.length && (
                <div className="text-[10px] uppercase tracking-widest text-[#F0F4F1]">Ancora più veloce!</div>
              )}
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
      <div className="grid grid-cols-3 gap-2 max-w-[240px] w-full mx-auto shrink-0">
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

      <button onClick={onExit} className="w-full py-1.5 text-[11px] uppercase font-bold text-[#8F9E8B] hover:text-white shrink-0">Esci dal gioco</button>
    </div>
  );
}

