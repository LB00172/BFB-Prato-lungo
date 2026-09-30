// Il giro dell'app come la vede una persona nuova, fotografato e misurato.
//
//   node test/giro-ui.js            -> test/tmp/giro/*.jpg + giro.json
//
// Non e' una prova: non dice verde o rosso. E' il materiale per decidere
// cosa cambiare nell'interfaccia (ROADMAP § 13), come RICOGNIZIONE-UI.md lo
// era per i bottoni. Per ogni schermata misura tre cose che a occhio si
// sbagliano:
//   - il CONTRASTO del testo sul suo sfondo (WCAG: 4,5 per il testo normale,
//     3 per quello grande) — Google lo controlla, e al sole in montagna
//     conta piu' che in ufficio;
//   - i TASTI troppo piccoli da toccare (Android chiede 48 dp; sotto i 40 un
//     pollice sbaglia);
//   - la pagina che esce di lato (scorrimento orizzontale).
//
// Il campo e' d'esempio, con nomi e cifre inventati; Firebase e la stanza
// sono finti come nelle prove (test/lib/app.js).
const fs = require('fs');
const path = require('path');
const { chromium: pw } = require('playwright-core');
const { chromium } = require('./lib/app');
const { avvia } = require('./lib/server');

const PORTA = 8094;
const URL = `http://localhost:${PORTA}/index.html`;
const USCITA = path.join(__dirname, 'tmp', 'giro');
const CODICE = 'K7RX2MQP';

// ---------- Il campo d'esempio ----------
const GIORNI = ['2027-07-12', '2027-07-13', '2027-07-14', '2027-07-15', '2027-07-16'];
const PERSONE = [
  ['m1', 'Giulia Ferri'], ['m2', 'Marco Bellini'], ['m3', 'Sara Conti'], ['m4', 'Luca Moretti'],
  ['m5', 'Elena Rizzo'], ['m6', 'Davide Galli'], ['m7', 'Chiara Longo'], ['m8', 'Tommaso Ferri', true],
];
const pieno = () => {
  const members = PERSONE.map(([id, name, isChild]) => ({ id, name, isChild: !!isChild }));
  const campData = {};
  GIORNI.forEach((d, i) => {
    const meals = {};
    PERSONE.forEach(([id], k) => {
      if (k === 6 && i === 0) return;
      meals[id] = { lunch: !(k === 3 && i === 2), dinner: !(k === 5 && i === 4) };
    });
    campData[d] = { note: i === 0 ? 'Pasta al ragù\nInsalata\nAnguria' : '', guestsNames: '', meals };
  });
  const purchases = [
    { id: 'p1', name: 'Spesa grande al supermercato', price: 184.6, type: 'alimentare', buyer: 'Giulia Ferri', at: 1 },
    { id: 'p2', name: 'Carne per la grigliata', price: 96.5, type: 'alimentare', buyer: 'Marco Bellini', at: 2 },
    { id: 'p3', name: 'Vino e birra', price: 58.4, type: 'bevande', buyer: 'Sara Conti', at: 3 },
    { id: 'p4', name: 'Gas per i fornelli', price: 38, type: 'logistica', buyer: 'Luca Moretti', at: 4 },
  ];
  const toBuy = [{ id: 't1', name: 'Carbonella', qty: '2 sacchi' }, { id: 't2', name: 'Latte', qty: '4 litri' }];
  return { members, campData, purchases, toBuy };
};

// La scena: chi sei (account o no), dove sei (in un campo, pieno o vuoto, o
// da nessuna parte), in che tema e in che lingua.
const scena = [(o) => {
  let vero;
  Object.defineProperty(window, 'APP_CONFIG', {
    configurable: true,
    get() { return vero; },
    set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { rooms: true, auth: true }) }); },
  });
  window.APP_CONFIG = {};
  Object.defineProperty(window, 'CAMP_CODE_DEFAULT', { value: '', writable: false, configurable: true });
  if (!sessionStorage.getItem('seminato')) {
    sessionStorage.setItem('seminato', '1');
    localStorage.setItem('cambusa_install_hint_off', '1');
    localStorage.setItem('cambusa_sync_optout', '1');
    localStorage.setItem('cambusa_theme', o.tema);
    localStorage.setItem('cambusa_lingua', o.lingua);
    if (o.campo) {
      localStorage.setItem('cambusa_stanza', o.codice);
      localStorage.setItem('cambusa_campi', JSON.stringify([
        { codice: o.codice, nome: 'Campo estivo 2027', inizio: o.inizio, fine: o.fine, ruolo: 'proprietario', pro: o.pro ? { attivo: true } : undefined },
      ]));
      if (o.dati) {
        localStorage.setItem('cambusa_members', JSON.stringify(o.dati.members));
        localStorage.setItem('cambusa_camp_data', JSON.stringify(o.dati.campData));
        localStorage.setItem('cambusa_purchases', JSON.stringify(o.dati.purchases));
        localStorage.setItem('cambusa_tobuy', JSON.stringify(o.dati.toBuy));
      }
    }
  }
  const utente = o.account ? { uid: 'giulia', email: 'giulia@example.com', nome: 'Giulia Ferri', isAnonimo: false, emailVerificata: true } : null;
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true, utente: () => utente,
    osserva: (cb) => { cb(utente); return () => {}; },
    conGoogle: async () => utente, esci: async () => {}, stanzeDelProfilo: async () => (o.campo ? [o.codice] : []),
  };
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (c) => c, leggi: async () => null, motivo: () => 'stanza.nonRiuscito',
    membri: async () => [{ uid: 'giulia', ruolo: 'proprietario', nome: 'Giulia Ferri' }],
    statoDi: async (codici) => codici.map((c) => ({
      codice: c, membro: true, proprietario: true, nome: 'Campo estivo 2027', inizio: o.inizio, fine: o.fine,
      pro: o.pro ? { attivo: true } : null,
    })),
    impostaStanza: async () => {},
  };
}];

// ---------- Le misure ----------
// Gira nella pagina. Restituisce i problemi trovati, gia' ordinati.
function misura() {
  // Il colore lo decodifica il browser: Tailwind v4 scrive i colori con
  // trasparenza come oklab(...) o color(srgb ...), e leggerne i numeri come
  // se fossero 0-255 dava contrasti inventati (i nomi dei membri, leggibili
  // benissimo, risultavano a 1,74). Un pixel di canvas li conosce tutti.
  const tela = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgb = (s) => {
    tela.clearRect(0, 0, 1, 1);
    tela.fillStyle = 'rgba(0,0,0,0)';
    tela.fillStyle = s;
    tela.fillRect(0, 0, 1, 1);
    const d = tela.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const lum = ([r, g, b]) => {
    const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  // Lo sfondo vero: il primo antenato con un colore non trasparente,
  // mescolato con quello che ha sotto se e' semitrasparente.
  const sfondo = (el) => {
    const strati = [];
    for (let e = el; e; e = e.parentElement) {
      const c = rgb(getComputedStyle(e).backgroundColor);
      const a = c.length > 3 ? c[3] : 1;
      if (a > 0) { strati.push([c[0], c[1], c[2], a]); if (a >= 1) break; }
    }
    let base = [255, 255, 255];
    for (let i = strati.length - 1; i >= 0; i--) {
      const [r, g, b, a] = strati[i];
      base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
    }
    return base;
  };
  const visibile = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
      && r.top < innerHeight && r.bottom > 0;
  };
  const contrasto = [];
  document.querySelectorAll('body *').forEach((el) => {
    const testo = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!testo || !visibile(el)) return;
    const s = getComputedStyle(el);
    const c = rgb(s.color);
    const a = c.length > 3 ? c[3] : 1;
    const bg = sfondo(el);
    const fg = [c[0] * a + bg[0] * (1 - a), c[1] * a + bg[1] * (1 - a), c[2] * a + bg[2] * (1 - a)];
    const [l1, l2] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    const rapporto = (l1 + 0.05) / (l2 + 0.05);
    const px = parseFloat(s.fontSize);
    const grande = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
    const soglia = grande ? 3 : 4.5;
    if (rapporto < soglia) contrasto.push({ testo: testo.slice(0, 60), rapporto: Math.round(rapporto * 100) / 100, soglia, px });
  });
  const tasti = [];
  document.querySelectorAll('button, a[href], input, select, textarea, label[for], [role="button"]').forEach((el) => {
    if (!visibile(el)) return;
    const r = el.getBoundingClientRect();
    const lato = Math.min(r.width, r.height);
    if (lato < 44) {
      const nome = (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.tagName).trim().replace(/\s+/g, ' ');
      tasti.push({ nome: nome.slice(0, 40), larghezza: Math.round(r.width), altezza: Math.round(r.height) });
    }
  });
  const fuori = document.documentElement.scrollWidth - innerWidth;
  return { contrasto, tasti, fuori: fuori > 1 ? fuori : 0 };
}

// ---------- Il giro ----------
// [nome, cosa si vede, opzioni della scena, passi]
const NORMALE = { tema: 'light', lingua: 'it', larghezza: 360 };
const passi = {
  menu: (voce) => async (p) => {
    await p.click('button[aria-label="Menu"]');
    await p.waitForTimeout(300);
    // I gruppi del menu sono chiusi, come per chi apre l'app: si aprono uno
    // alla volta finche' la voce non compare, come farebbe una persona.
    for (const g of await p.locator('nav button[data-gruppo][aria-expanded="false"]').all()) {
      if (await p.locator(`nav button[data-voce="${voce}"]`).count()) break;
      await g.click();
    }
    await p.locator(`nav button[data-voce="${voce}"]`).first().click();
    await p.waitForTimeout(500);
  },
  tocca: (sel) => async (p) => { await p.locator(sel).first().click(); await p.waitForTimeout(400); },
  testo: (re) => async (p) => { await p.locator('button', { hasText: re }).first().click(); await p.waitForTimeout(400); },
  soloMenu: async (p) => { await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(400); },
  intera: true,
};
const G = (...xs) => xs;
const GIRO = [
  ['01-apertura', 'La prima apertura: né account né campo', { account: false, campo: false }, G()],
  ['02-home-vuota', 'La home con l\'account, ancora senza campi', { account: true, campo: false }, G()],
  ['03-crea', 'Il modulo per creare un campo', { account: true, campo: false }, G(passi.testo(/crea una stanza/i))],
  ['04-calendario-vuoto', 'Il campo appena creato: il Calendario, vuoto', { account: true, campo: true }, G()],
  ['05-membri-vuoto', 'I membri di un campo vuoto', { account: true, campo: true }, G(passi.menu('membri'))],
  ['06-presenze-vuoto', 'Le presenze senza nessuno', { account: true, campo: true }, G(passi.menu('presenze'))],
  ['07-campo-vuoto', '«Il campo» appena creato: invito e righe', { account: true, campo: true }, G(passi.menu('campo'))],
  ['08-menu', 'Il menu', { account: true, campo: true, dati: true }, G(passi.soloMenu)],
  ['09-calendario', 'Il Calendario di un campo pieno', { account: true, campo: true, dati: true }, G()],
  ['10-membri', 'I membri', { account: true, campo: true, dati: true }, G(passi.menu('membri'))],
  ['11-presenze', 'Le presenze', { account: true, campo: true, dati: true }, G(passi.menu('presenze'))],
  ['12-menu-giorno', 'Il menù del giorno', { account: true, campo: true, dati: true }, G(passi.menu('menu'))],
  ['13-lista', 'La lista della spesa', { account: true, campo: true, dati: true }, G(passi.menu('lista'))],
  ['14-spesa-nuova', 'Registrare una spesa a mano', { account: true, campo: true, dati: true }, G(passi.menu('lista'), passi.tocca('[data-tasto-spesa]'))],
  ['15-totali', 'Spese totali', { account: true, campo: true, dati: true }, G(passi.menu('spesa'))],
  ['16-quote', 'Le quote', { account: true, campo: true, dati: true }, G(passi.menu('spesa'), passi.tocca('main button >> nth=1'))],
  ['17-saldi', 'I saldi: chi paga chi', { account: true, campo: true, dati: true }, G(passi.menu('spesa'), passi.tocca('main button >> nth=2'))],
  ['18-regole-gratis', 'Una funzione Pro in un campo gratuito', { account: true, campo: true, dati: true }, G(passi.menu('regole'))],
  ['19-impostazioni', 'Impostazioni: le cose della persona', { account: true, campo: true, dati: true }, G(passi.menu('impostazioni'))],
  ['19b-campo', '«Il campo» di un campo in corso', { account: true, campo: true, dati: true }, G(passi.menu('campo'))],
  ['19c-campo-voci', '«Il campo»: la riga di cosa si divide, aperta', { account: true, campo: true, dati: true }, G(passi.menu('campo'), passi.tocca('[data-riga="voci"]'))],
  ['20-guida', 'La guida', { account: true, campo: true, dati: true }, G(passi.menu('guida'))],
];
// Le varianti: lo stesso punto in un'altra condizione.
const VARIANTI = [
  ['01-apertura', { tema: 'dark' }], ['09-calendario', { tema: 'dark' }], ['11-presenze', { tema: 'dark' }],
  ['17-saldi', { tema: 'dark' }], ['08-menu', { tema: 'dark' }], ['19-impostazioni', { tema: 'dark' }], ['19b-campo', { tema: 'dark' }], ['14-spesa-nuova', { tema: 'dark' }],
  ['01-apertura', { larghezza: 320 }], ['11-presenze', { larghezza: 320 }], ['14-spesa-nuova', { larghezza: 320 }],
  ['17-saldi', { larghezza: 320 }], ['09-calendario', { larghezza: 320 }],
  ['01-apertura', { lingua: 'es' }], ['17-saldi', { lingua: 'es' }], ['11-presenze', { lingua: 'es' }],
  ['01-apertura', { lingua: 'fr' }], ['17-saldi', { lingua: 'fr' }], ['11-presenze', { lingua: 'fr' }],
];

async function scatta(browser, nome, cosa, sc, azioni, variante) {
  const v = Object.assign({}, NORMALE, variante || {});
  const ctx = await browser.newContext({ viewport: { width: v.larghezza, height: 740 }, deviceScaleFactor: 2, locale: 'it-IT' });
  const p = await ctx.newPage();
  const errori = [];
  p.on('pageerror', (e) => errori.push(e.message));
  p.on('dialog', (d) => d.dismiss());
  await p.addInitScript(scena[0], {
    codice: CODICE, inizio: GIORNI[0], fine: GIORNI[4], tema: v.tema, lingua: v.lingua,
    account: sc.account, campo: sc.campo, pro: sc.pro, dati: sc.dati ? pieno() : null,
  });
  await p.goto(URL, { waitUntil: 'load' });
  // Si aspetta che il saluto col logo se ne sia andato, non un numero di
  // millisecondi: con un'attesa fissa meta' delle foto prendevano il saluto.
  await p.waitForFunction(() => document.querySelector('#root > *') && !document.querySelector('[data-splash]'), null, { timeout: 10000 });
  await p.waitForTimeout(500);
  const problemi = [];
  for (const a of azioni) {
    try { await a(p); } catch (e) { problemi.push('passo non riuscito: ' + e.message.split('\n')[0]); }
  }
  await p.waitForTimeout(400);
  const suffisso = [v.tema !== 'light' && v.tema, v.larghezza !== 360 && v.larghezza + 'px', v.lingua !== 'it' && v.lingua].filter(Boolean).join('-');
  const file = nome + (suffisso ? '--' + suffisso : '') + '.jpg';
  await p.screenshot({ path: path.join(USCITA, file), type: 'jpeg', quality: 72 });
  // Anche la pagina intera, per vedere cosa c'e' sotto la piega.
  const intera = file.replace('.jpg', '--intera.jpg');
  await p.screenshot({ path: path.join(USCITA, intera), type: 'jpeg', quality: 60, fullPage: true });
  const m = await p.evaluate(misura);
  const altezza = await p.evaluate(() => document.documentElement.scrollHeight);
  await ctx.close();
  console.log(`  ${file}  contrasto:${m.contrasto.length} tasti:${m.tasti.length} fuori:${m.fuori}${errori.length ? ' ERRORI:' + errori.length : ''}`);
  return { file, intera, nome, cosa, variante: suffisso || 'base', altezza, errori, problemi, ...m };
}

(async () => {
  fs.rmSync(USCITA, { recursive: true, force: true });
  fs.mkdirSync(USCITA, { recursive: true });
  const server = await avvia(PORTA);
  const browser = await pw.launch({
    executablePath: chromium(),
    args: ['--no-sandbox', '--lang=it-IT'],
    env: Object.assign({}, process.env, { LANG: 'it_IT.UTF-8', LANGUAGE: 'it' }),
  });
  const esiti = [];
  for (const [nome, cosa, sc, azioni] of GIRO) esiti.push(await scatta(browser, nome, cosa, sc, azioni));
  for (const [nome, variante] of VARIANTI) {
    const g = GIRO.find((x) => x[0] === nome);
    esiti.push(await scatta(browser, g[0], g[1], g[2], g[3], variante));
  }
  fs.writeFileSync(path.join(USCITA, 'giro.json'), JSON.stringify(esiti, null, 1));
  await browser.close();
  server.close();
  console.log(`\n${esiti.length} schermate in ${path.relative(process.cwd(), USCITA)}`);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
