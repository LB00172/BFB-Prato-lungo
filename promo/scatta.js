// Gli screenshot per lo store, e la grafica in evidenza.
//
//   node promo/scatta.js            -> promo/screenshot/*.png (1080×1920)
//                                     promo/grafica-in-evidenza.png (1024×500)
//
// L'app si apre su un campo d'ESEMPIO con dati inventati: persone, spese e
// pasti che non esistono. Mai un campo vero — le foto finiscono sullo store,
// e i nomi e le cifre di un gruppo vero non ci devono stare. Firebase e la
// stanza sono finti come nelle prove (test/lib/app.js): qui non si scrive
// niente da nessuna parte, si fotografa e basta.
//
// Rifarle dopo ogni cambio d'aspetto: e' un comando solo.
const fs = require('fs');
const path = require('path');
const { chromium: pw } = require('playwright-core');
const { chromium } = require('../test/lib/app');
const { avvia } = require('../test/lib/server');

const PORTA = 8093;
const URL = `http://localhost:${PORTA}/index.html`;
const USCITA = path.join(__dirname, 'screenshot');
const CODICE = 'K7RX2MQP';

// ---------- Il campo d'esempio ----------
const INIZIO = '2027-07-12';
const GIORNI = ['2027-07-12', '2027-07-13', '2027-07-14', '2027-07-15', '2027-07-16'];
const PERSONE = [
  ['m1', 'Giulia Ferri'], ['m2', 'Marco Bellini'], ['m3', 'Sara Conti'], ['m4', 'Luca Moretti'],
  ['m5', 'Elena Rizzo'], ['m6', 'Davide Galli'], ['m7', 'Chiara Longo'], ['m8', 'Tommaso Ferri', true],
];
const esempio = () => {
  const members = PERSONE.map(([id, name, isChild]) => ({ id, name, isChild: !!isChild }));
  const campData = {};
  GIORNI.forEach((d, i) => {
    const meals = {};
    PERSONE.forEach(([id], k) => {
      // Qualcuno arriva il secondo giorno, qualcuno salta una cena: i pasti
      // veri non sono una griglia piena.
      if (k === 6 && i === 0) return;
      meals[id] = { lunch: !(k === 3 && i === 2), dinner: !(k === 5 && i === 4) };
    });
    campData[d] = { note: i === 0 ? 'Pasta al ragù\nInsalata\nAnguria' : i === 1 ? 'Grigliata\nPatate al forno' : '', guestsNames: '', meals };
  });
  const purchases = [
    { id: 'p1', name: 'Spesa grande al supermercato', price: 184.6, type: 'alimentare', buyer: 'Giulia Ferri', at: 1 },
    { id: 'p2', name: 'Carne per la grigliata', price: 96.5, type: 'alimentare', buyer: 'Marco Bellini', at: 2 },
    { id: 'p3', name: 'Vino e birra', price: 58.4, type: 'bevande', buyer: 'Sara Conti', at: 3 },
    { id: 'p4', name: 'Gas per i fornelli', price: 38, type: 'logistica', buyer: 'Luca Moretti', at: 4 },
    { id: 'p5', name: 'Frutta e verdura', price: 42.8, type: 'alimentare', buyer: 'Elena Rizzo', at: 5 },
    { id: 'p6', name: 'Pane e colazioni', price: 27.3, type: 'alimentare', buyer: 'Davide Galli', at: 6 },
  ];
  return { members, campData, purchases };
};

const scena = [(o) => {
  let vero;
  Object.defineProperty(window, 'APP_CONFIG', {
    configurable: true,
    get() { return vero; },
    set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { rooms: true, auth: true }) }); },
  });
  window.APP_CONFIG = {};
  if (!sessionStorage.getItem('seminato')) {
    sessionStorage.setItem('seminato', '1');
    localStorage.setItem('cambusa_install_hint_off', '1');
    localStorage.setItem('cambusa_stanza', o.codice);
    localStorage.setItem('cambusa_campi', JSON.stringify([
      { codice: o.codice, nome: 'Campo estivo 2027', inizio: o.inizio, fine: o.fine, ruolo: 'proprietario' },
      { codice: 'BCDFGHJK', nome: 'Weekend in rifugio', inizio: '2027-10-08', fine: '2027-10-10', ruolo: 'redattore' },
      { codice: 'MNPQRSTV', nome: 'Capodanno in baita', inizio: '2026-12-30', fine: '2027-01-02', ruolo: 'proprietario' },
    ]));
    localStorage.setItem('cambusa_members', JSON.stringify(o.dati.members));
    localStorage.setItem('cambusa_camp_data', JSON.stringify(o.dati.campData));
    localStorage.setItem('cambusa_purchases', JSON.stringify(o.dati.purchases));
  }
  const utente = { uid: 'giulia', email: 'giulia@example.com', nome: 'Giulia Ferri', isAnonimo: false, emailVerificata: true };
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true, utente: () => utente,
    osserva: (cb) => { cb(utente); return () => {}; },
    conGoogle: async () => utente, esci: async () => {}, stanzeDelProfilo: async () => [],
  };
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (c) => c, leggi: async () => null, motivo: () => 'stanza.nonRiuscito',
    membri: async () => [],
    // Niente rete: l'elenco dei campi resta quello seminato, e la stanza aperta
    // porta le sue regole e la sua lista di cose da portare.
    statoDi: async (codici) => codici.map((c) => (c === o.codice ? {
      codice: c, membro: true, proprietario: true, nome: 'Campo estivo 2027', inizio: o.inizio, fine: o.fine,
      regole: [
        'Si cucina a turno: la tabella dei turni è in «Chi fa cosa».',
        'Chi anticipa una spesa la registra subito, con la foto dello scontrino.',
        'Dopo le 23 si abbassa la voce: il bosco dorme.',
        'Si lascia il prato più pulito di come lo si è trovato.',
      ],
      dotazioni: [{ testo: 'Sacco a pelo e materassino', evidenza: true }, { testo: 'Borraccia' }, { testo: 'Torcia frontale' }, { testo: 'Stoviglie personali' }],
    } : { codice: c, membro: true, proprietario: false })),
  };
  // Niente Firestore: la sincronizzazione resta ferma.
  localStorage.setItem('cambusa_sync_optout', '1');
}, { codice: CODICE, inizio: INIZIO, fine: GIORNI[GIORNI.length - 1], dati: esempio() }];

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

async function scatta() {
  fs.mkdirSync(USCITA, { recursive: true });
  const server = await avvia(PORTA);
  const browser = await pw.launch({ executablePath: chromium(), args: ['--no-sandbox', '--lang=it-IT'], env: Object.assign({}, process.env, { LANG: 'it_IT.UTF-8', LANGUAGE: 'it' }) });
  // 360×640 a densita' 3: 1080×1920, il 9:16 che Play accetta per i telefoni.
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, locale: 'it-IT', timezoneId: 'Europe/Rome' });
  const p = await ctx.newPage();
  await p.addInitScript(...scena);
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await attendi(800);

  const menu = async (voce) => {
    await p.click('button[aria-label="Menu"]');
    await attendi(300);
    await p.locator('nav button', { hasText: voce }).first().click();
    await attendi(700);
    await p.evaluate(() => window.scrollTo(0, 0));
  };
  const foto = async (nome) => {
    await attendi(300);
    await p.screenshot({ path: path.join(USCITA, nome + '.png') });
    console.log('  ' + nome + '.png');
  };

  await menu('I miei campi');
  await foto('1-i-miei-campi');
  await menu('Calendario');
  await foto('2-calendario');
  await menu('Presenze');
  await foto('3-presenze');
  await menu('Spese Totali');
  await foto('4-spese-totali');
  await p.locator('main button', { hasText: /^quote$/i }).click();
  await attendi(500);
  await foto('5-quote');
  await p.locator('main button', { hasText: /^saldi$/i }).click();
  await attendi(500);
  await foto('6-saldi');
  await menu('Regole');
  await foto('7-regole');

  // ---------- La grafica in evidenza: 1024×500 ----------
  const logo = fs.readFileSync(path.join(__dirname, '..', 'logo.png')).toString('base64');
  const g = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  // Dall'indirizzo dell'app, non da about:blank: altrimenti i caratteri di
  // vendor/fonts.css non arrivano e si fotografa un Times di ripiego.
  await g.goto(`http://localhost:${PORTA}/manifest.json`);
  await g.setContent(`<!doctype html><html><head><meta charset="utf-8">
    <link href="/vendor/fonts.css" rel="stylesheet">
    <style>
      body { margin:0; width:1024px; height:500px; background:#FAF0D8; font-family:'Special Elite', serif; color:#00494A;
             display:flex; align-items:center; gap:48px; padding:0 72px; box-sizing:border-box; }
      img { width:320px; height:320px; mix-blend-mode:darken; }
      h1 { font-size:76px; margin:0; letter-spacing:4px; }
      p { font-family:'Courier Prime', monospace; font-size:32px; margin:18px 0 0; color:#7A4A2A; line-height:1.25; }
      .riga { width:120px; height:6px; background:#B4470F; margin-top:26px; border-radius:3px; }
    </style></head><body>
    <img src="data:image/png;base64,${logo}">
    <div><h1>CAMP OPS</h1><p>Le spese del campo,<br>divise bene.</p><div class="riga"></div></div>
    </body></html>`, { waitUntil: 'load' });
  await g.evaluate(() => document.fonts.ready);
  // Lo sfondo e' il colore dell'angolo del logo: se differisce anche di poco,
  // attorno al logo si vede un riquadro.
  await g.evaluate(() => {
    const img = document.querySelector('img');
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const [r, v, b] = x.getImageData(2, 2, 1, 1).data;
    document.body.style.background = `rgb(${r},${v},${b})`;
    img.style.mixBlendMode = 'normal';
  });
  await attendi(300);
  await g.screenshot({ path: path.join(__dirname, 'grafica-in-evidenza.png') });
  console.log('  grafica-in-evidenza.png');

  await browser.close();
  server.close();
}

scatta().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
