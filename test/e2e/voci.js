// Voci di spesa spente, a schermo (ROADMAP.md § 8).
//
// I numeri li prova unita/voci con i conti veri. Qui si prova il collegamento:
// che la scelta della STANZA arrivi ai conti dell'app, che il fuori conto si
// veda nei totali e nel resoconto, che non compaia il falso allarme dei soldi
// non ripartiti, e che a conti chiusi l'interruttore non si muova.
const { apri, ok, fine, attendi } = require('../lib/app');

const CODICE = 'K7RX2MQP';

const scena = (o) => [(s) => {
  const o = JSON.parse(s);
  let vero;
  Object.defineProperty(window, 'APP_CONFIG', {
    configurable: true,
    get() { return vero; },
    set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { rooms: true, auth: true }) }); },
  });
  window.APP_CONFIG = {};
  if (!sessionStorage.getItem('seminato')) {
    sessionStorage.setItem('seminato', '1');
    localStorage.setItem('cambusa_stanza', o.codice);
    const P = { lunch: true, dinner: false };
    localStorage.setItem('cambusa_members', JSON.stringify([
      { id: 'a', name: 'Anna', isChild: false }, { id: 'b', name: 'Bruno', isChild: false },
    ]));
    localStorage.setItem('cambusa_camp_data', JSON.stringify({ '2026-08-11': { note: '', guestsNames: '', meals: { a: P, b: P } } }));
    localStorage.setItem('cambusa_purchases', JSON.stringify([
      { id: 'p1', name: 'Pasta', price: 30, type: 'alimentare', buyer: 'Anna', at: 1 },
      { id: 'p2', name: 'Gasolio', price: 45, type: 'logistica', buyer: 'Bruno', at: 2 },
    ]));
    if (o.contiChiusi) localStorage.setItem('cambusa_blocchi', JSON.stringify([{ id: 'conti', at: 1 }]));
  }
  // Il resoconto si legge da qui: navigator.share lo riceve intero.
  window.__condiviso = null;
  navigator.share = async (d) => { window.__condiviso = d; };

  const utente = { uid: 'anna', email: 'anna@example.com', nome: 'Anna', isAnonimo: false, emailVerificata: true };
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true, utente: () => utente,
    osserva: (cb) => { cb(utente); return () => {}; },
    conGoogle: async () => utente, esci: async () => {}, stanzeDelProfilo: async () => [o.codice],
  };
  window.__voci = o.voci || null;
  window.__scritture = [];
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (c) => window.Stanza.normalizza(c),
    leggi: async () => null, membri: async () => [], motivo: () => 'stanza.nonRiuscito',
    statoDi: async (codici) => codici.map((c) => ({
      codice: c, membro: true, proprietario: true, nome: 'Campo di prova', voci: window.__voci,
    })),
    impostaStanza: async (c, campi) => { window.__scritture.push(campi); if (campi.voci) window.__voci = campi.voci; },
  };
}, JSON.stringify(Object.assign({ codice: CODICE }, o))];

(async () => {
  // ---------- 1. La logistica la gestisce il gruppo ----------
  {
    const a = await apri({ admin: false, initScript: scena({ voci: { logistica: 'fuori' } }) });
    await attendi(a.page, () => window.__fuoriConto && window.__fuoriConto.totale === 45);
    const t = await a.page.evaluate(() => ({ totale: window.__totali.overallTotal, buco: window.__totali.nonRipartito }));
    ok(`la scelta della stanza arriva ai conti: si divide la pasta, non il gasolio (${t.totale} €)`, t.totale === 30);
    ok('e il gasolio non diventa un buco', !(t.buco > 0.005));

    await a.menu('Spese Totali');
    const riga = a.page.locator('[data-fuori-conto]');
    ok('nei totali il fuori conto si dichiara, con la sua cifra',
      (await riga.count()) === 1 && /45[.,]00/.test(await riga.innerText()));

    await a.page.locator('main button', { hasText: /^saldi$/i }).click();
    await a.page.locator('main button', { hasText: /condividi resoconto/i }).click();
    await attendi(a.page, () => !!window.__condiviso);
    const r = await a.page.evaluate(() => window.__condiviso);
    ok('e nel resoconto per il gruppo, perché non racconti un campo più economico', /fuori conto.*45[.,]00/i.test(r.text));
    ok(`il resoconto non porta più il nome del campo della Brigata (${r.title})`, !/prato lungo/i.test(r.title));

    // ---------- 2. Il capogruppo spegne un'altra voce ----------
    await a.menu('Impostazioni');
    const inter = a.page.locator('[data-riquadro="voci"] [data-voce="attrezzatura"]');
    await inter.click();
    await attendi(a.page, () => window.__scritture.some((x) => x.voci));
    const scritta = await a.page.evaluate(() => window.__scritture.find((x) => x.voci).voci);
    ok(`nella stanza si scrive la mappa intera (${JSON.stringify(scritta)})`,
      scritta.logistica === 'fuori' && scritta.attrezzatura === 'fuori' && Object.keys(scritta).length === 2);
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  // ---------- 3. A conti chiusi l'interruttore sta fermo ----------
  {
    const a = await apri({ admin: false, initScript: scena({ voci: null, contiChiusi: true }) });
    await a.menu('Impostazioni');
    await attendi(a.page, () => !!document.querySelector('[data-riquadro="voci"] [data-voce="logistica"]'));
    const inter = a.page.locator('[data-riquadro="voci"] [data-voce="logistica"]');
    ok('a conti chiusi gli interruttori sono fermi', await inter.isDisabled());
    ok('e si dice perché', /conti sono chiusi/i.test(await a.page.locator('[data-riquadro="voci"]').innerText()));
    await inter.click({ force: true }).catch(() => {});
    await a.page.waitForTimeout(400);
    ok('e toccarli non scrive niente', (await a.page.evaluate(() => window.__scritture.length)) === 0);
    await a.browser.close();
  }

  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
