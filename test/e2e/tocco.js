// Ogni cosa da toccare e' almeno 44×44, e il tasto del menu si vede.
//
// Il giro dell'interfaccia (test/giro-ui.js, 29 settembre) aveva misurato i
// tasti piu' usati come i piu' piccoli: PRANZO e CENA alti 31 px, il menu 36,
// le frecce della settimana 30, la × per togliere 30, i dati di pagamento 24.
// Android chiede 48 dp, Apple 44; sotto, un pollice sbaglia — e al campo lo
// si usa con le mani fredde, in piedi, col telefono in una mano.
//
// Qui si misura quello che il browser disegna davvero, su una ventina di
// schermate di un campo pieno e Pro (cosi' compaiono tutte le schede), su
// TUTTA la pagina e non solo sulla parte visibile. Un'eccezione sola, e
// dichiarata nel codice con data-tocco-stretto: i sette giorni della
// settimana, che a 320 px non stanno in riga a 44 di larghezza e si
// rifanno in altezza.
//
// E il tasto del menu nel tema scuro: le sue righe erano bg-carta, il tema
// scuro ridipinge di scuro tutto quello che ha bg-carta, e il tasto da cui
// passa tutta l'app era nero su verde scuro. La misura del contrasto del
// testo non poteva vederlo: non e' testo, e' un disegno.
const { apri, ok, fine, attendi } = require('../lib/app');

const CODICE = 'K7RX2MQP';
const GIORNI = ['2027-07-12', '2027-07-13', '2027-07-14'];

const scena = (o) => [(s) => {
  const o = JSON.parse(s);
  let vero;
  Object.defineProperty(window, 'APP_CONFIG', {
    configurable: true,
    get() { return vero; },
    set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { rooms: true, auth: true }) }); },
  });
  window.APP_CONFIG = {};
  if (o.tema) localStorage.setItem('cambusa_theme', o.tema);
  localStorage.setItem('cambusa_stanza', o.codice);
  localStorage.setItem('cambusa_sync_optout', '1');
  localStorage.setItem('cambusa_campi', JSON.stringify([{ codice: o.codice, nome: 'Campo', inizio: o.giorni[0], fine: o.giorni[2], ruolo: 'proprietario', pro: { attivo: true } }]));
  const membri = [['m1', 'Giulia Ferri'], ['m2', 'Marco Bellini'], ['m3', 'Tommaso Ferri', true]];
  localStorage.setItem('cambusa_members', JSON.stringify(membri.map(([id, name, c]) => ({ id, name, isChild: !!c }))));
  const meals = {};
  membri.forEach(([id]) => { meals[id] = { lunch: true, dinner: true }; });
  const campData = {};
  o.giorni.forEach((d) => { campData[d] = { note: '', guestsNames: '', meals }; });
  localStorage.setItem('cambusa_camp_data', JSON.stringify(campData));
  localStorage.setItem('cambusa_purchases', JSON.stringify([
    { id: 'p1', name: 'Spesa grande', price: 184.6, type: 'alimentare', buyer: 'Giulia Ferri', at: 1 },
    { id: 'p2', name: 'Gas', price: 38, type: 'logistica', buyer: 'Marco Bellini', at: 2 },
  ]));
  localStorage.setItem('cambusa_tobuy', JSON.stringify([{ id: 't1', name: 'Carbonella', qty: '2 sacchi' }]));
  localStorage.setItem('cambusa_compiti', JSON.stringify([{ id: 'c1', testo: 'Prenotare il rifugio', chi: 'Giulia Ferri', fatto: false }]));
  const utente = { uid: 'giulia', email: 'g@example.com', nome: 'Giulia Ferri', isAnonimo: false, emailVerificata: true };
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true, utente: () => utente,
    osserva: (cb) => { cb(utente); return () => {}; },
    conGoogle: async () => utente, esci: async () => {}, stanzeDelProfilo: async () => [o.codice],
  };
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (c) => c, leggi: async () => null, motivo: () => 'stanza.nonRiuscito',
    membri: async () => [{ uid: 'giulia', ruolo: 'proprietario', nome: 'Giulia Ferri' }, { uid: 'marco', ruolo: 'redattore', nome: 'Marco Bellini' }],
    statoDi: async (codici) => codici.map((c) => ({
      codice: c, membro: true, proprietario: true, nome: 'Campo', inizio: o.giorni[0], fine: o.giorni[2],
      pro: { attivo: true }, regole: ['Si cucina a turno.'], dotazioni: [{ testo: 'Borraccia' }],
    })),
    impostaStanza: async () => {},
  };
}, JSON.stringify(Object.assign({ codice: CODICE, giorni: GIORNI }, o))];

// Gira nella pagina: ogni cosa da toccare, visibile, su tutta la pagina.
function piccoli() {
  const fuori = [];
  const sel = 'button, a[href], select, textarea, [role="button"], input:not([type="hidden"])';
  document.querySelectorAll(sel).forEach((el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return;
    // Il menu laterale chiuso sta fuori dallo schermo: non si tocca.
    if (el.closest('nav') && !document.querySelector('nav[data-aperto="1"]')) {
      const n = el.closest('nav').getBoundingClientRect();
      if (n.right <= 0) return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    // Le spunte e i pallini: si tocca la loro etichetta, e si misura quella.
    let box = r;
    let nome = (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.type || el.tagName).trim().replace(/\s+/g, ' ');
    if (el.type === 'checkbox' || el.type === 'radio') {
      const l = el.closest('label');
      if (!l) { fuori.push({ nome: 'spunta senza etichetta: ' + nome, l: Math.round(r.width), a: Math.round(r.height) }); return; }
      box = l.getBoundingClientRect();
      nome = 'etichetta di ' + (l.innerText || '').trim().slice(0, 30);
    }
    if (el.type === 'file') return;   // nascosto dietro il suo bottone
    const stretto = el.hasAttribute('data-tocco-stretto');
    const basta = stretto ? (box.width >= 36 && box.height >= 60) : (box.width >= 44 && box.height >= 44);
    if (!basta) fuori.push({ nome: nome.slice(0, 40), l: Math.round(box.width), a: Math.round(box.height) });
  });
  return fuori;
}

(async () => {
  const a = await apri({ admin: false, initScript: scena({}) });
  const p = a.page;
  const giro = [];
  const guarda = async (dove) => {
    await p.waitForTimeout(250);
    const f = await p.evaluate(piccoli);
    giro.push([dove, f]);
  };
  const scheda = async (voce) => {
    await p.click('button[aria-label="Menu"]');
    await p.waitForTimeout(250);
    await p.locator(`nav button[data-voce="${voce}"]`).first().click();
    await attendi(p, () => !!document.querySelector('main'));
  };

  await guarda('calendario');
  await p.click('button[aria-label="Menu"]');
  await p.waitForTimeout(350);
  await guarda('menu aperto');
  await p.locator('nav button[data-voce="presenze"]').first().click();
  await guarda('presenze');
  // PRANZO e CENA: i piu' toccati dell'app, e quindi 48, non 44.
  const pasti = await p.evaluate(() => [...document.querySelectorAll('main button')]
    .filter((b) => /^(pranzo|cena)$/i.test(b.innerText.trim()))
    .map((b) => Math.round(b.getBoundingClientRect().height)));
  ok(`PRANZO e CENA sono alti almeno 48 px (${[...new Set(pasti)].join(', ')})`, pasti.length >= 6 && pasti.every((h) => h >= 48));

  for (const v of ['menu', 'compiti', 'lista', 'attrezzatura', 'spesa', 'membri', 'regole', 'dotazioni', 'galleria', 'archivio', 'guida', 'impostazioni', 'campi']) {
    await scheda(v);
    await guarda(v);
  }
  // Le sotto-schede: la lista acquistata con la maschera a mano, e i conti.
  await scheda('lista');
  await p.locator('main button').nth(1).click();
  await p.locator('main button', { hasText: /aggiungi un prodotto a mano/i }).click();
  await guarda('lista, spesa a mano');
  await scheda('spesa');
  for (const [i, nome] of [[1, 'quote'], [2, 'saldi'], [3, 'dati']]) {
    await p.locator('main button').nth(i).click();
    await guarda('spesa, ' + nome);
  }

  giro.forEach(([dove, f]) => {
    ok(`${dove}: tutto quello che si tocca è almeno 44×44`
      + (f.length ? ' — TROPPO PICCOLI: ' + f.slice(0, 6).map((x) => `${x.nome} ${x.l}×${x.a}`).join(' | ') + (f.length > 6 ? ` (+${f.length - 6})` : '') : ''),
    f.length === 0);
  });
  ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await a.browser.close();

  // ---------- Il tasto del menu, nei due temi ----------
  for (const tema of ['light', 'dark']) {
    const b = await apri({ admin: false, initScript: scena({ tema }) });
    const c = await b.page.evaluate(() => {
      const tela = document.createElement('canvas').getContext('2d');
      const rgb = (col) => { tela.clearRect(0, 0, 1, 1); tela.fillStyle = col; tela.fillRect(0, 0, 1, 1); return [...tela.getImageData(0, 0, 1, 1).data]; };
      const lum = ([r, g, bb]) => {
        const k = [r, g, bb].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
        return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
      };
      const riga = document.querySelector('button[aria-label="Menu"] span');
      const testata = document.querySelector('header');
      const [x, y] = [lum(rgb(getComputedStyle(riga).backgroundColor)), lum(rgb(getComputedStyle(testata).backgroundColor))].sort((m, n) => n - m);
      return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
    });
    // 3:1 e' la soglia WCAG per le icone e gli elementi grafici.
    ok(`tema ${tema === 'dark' ? 'scuro' : 'chiaro'}: il tasto del menu si stacca dalla testata (contrasto ${c}, serve 3)`, c >= 3);
    await b.browser.close();
  }

  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
