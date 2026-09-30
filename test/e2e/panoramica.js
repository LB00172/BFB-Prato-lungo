// La Panoramica dei campi (30 settembre), per chi ha il Pro annuale.
//
// Tre campi nell'elenco: uno con le spese in ordine, uno con una spesa che non
// ha nessuno fra cui dividersi (un buco nei conti, da guardare per primo), uno
// che non si riesce a leggere. La Panoramica deve dire di ognuno la cosa
// giusta — e il campo illeggibile non deve sparire, ne' valere zero nei
// totali. Senza abbonamento, dice cos'e' e basta.
//
// Chi ha l'abbonamento lo decide la regola vera (Panoramica.abbonamentoAttivo),
// non il finto: il finto restituisce solo il documento che il server avrebbe
// scritto, con la sua scadenza.
const { apri, ok, fine, attendi } = require('../lib/app');

const scena = (o) => [(s) => {
  const o = JSON.parse(s);
  let vero;
  Object.defineProperty(window, 'APP_CONFIG', {
    configurable: true,
    get() { return vero; },
    set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { rooms: true, auth: true }) }); },
  });
  window.APP_CONFIG = {};
  localStorage.setItem('cambusa_stanza', 'AAAAAAAA');
  localStorage.setItem('cambusa_sync_optout', '1');
  localStorage.setItem('cambusa_campi', JSON.stringify([
    { codice: 'AAAAAAAA', nome: 'Campo in ordine', inizio: '2027-08-10', fine: '2027-08-12', ruolo: 'redattore', aiutante: true },
    { codice: 'BBBBBBBB', nome: 'Campo col buco', inizio: '2027-07-01', fine: '2027-07-05', ruolo: 'proprietario' },
    { codice: 'CCCCCCCC', nome: 'Campo lontano', inizio: '2027-09-01', fine: '2027-09-03', ruolo: 'redattore' },
  ]));
  const pasto = { lunch: true, dinner: true };
  const stati = {
    AAAAAAAA: {
      members: [{ id: 'a', name: 'Anna', isChild: false }, { id: 'b', name: 'Bruno', isChild: false }, { id: 'c', name: 'Carla', isChild: false }, { id: 'd', name: 'Dino', isChild: true }],
      campData: { '2027-08-11': { meals: { a: pasto, b: pasto, c: pasto, d: pasto } }, '2027-08-12': { meals: { a: pasto, b: pasto, c: pasto, d: pasto } } },
      purchases: [
        { id: 'p1', name: 'Spesa', price: 90, type: 'alimentare', buyer: 'Anna', at: Date.parse('2027-08-11T10:00:00') },
        { id: 'p2', name: 'Gas', price: 30, type: 'logistica', buyer: 'Bruno', at: Date.parse('2027-08-12T10:00:00') },
        { id: 'p3', name: 'Vino', price: 24, type: 'bevande', buyer: 'Anna', at: Date.parse('2027-08-11T18:00:00') },
      ],
      equipment: [], sepDays: [], freeDays: [], settled: [],
    },
    // Una spesa di cibo, ma nessun pasto segnato: nessuno fra cui dividerla.
    BBBBBBBB: { members: [{ id: 'x', name: 'Xavi', isChild: false }], campData: {}, purchases: [{ id: 'q', name: 'Pane', price: 12, type: 'alimentare', buyer: 'Xavi', at: 5 }] },
  };
  window.__letture = [];
  const utente = { uid: 'org', email: 'org@example.com', nome: 'Orsola Ganzi', isAnonimo: false, emailVerificata: true };
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true, utente: () => utente,
    osserva: (cb) => { cb(utente); return () => {}; },
    conGoogle: async () => utente, esci: async () => {}, stanzeDelProfilo: async () => [],
  };
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (c) => c, leggi: async () => null, motivo: () => 'stanza.nonRiuscito', membri: async () => [],
    statoDi: async () => { throw new Error('senza linea, per questa prova'); },
    impostaStanza: async () => {},
    abbonamento: async () => (o.abbonato ? { scade: Date.now() + 86400000 * 200, stato: 'SUBSCRIPTION_STATE_ACTIVE' } : (o.scaduto ? { scade: Date.now() - 1000 } : null)),
    statoCampo: async (c) => {
      window.__letture.push(c);
      if (c === 'CCCCCCCC') { const e = new Error('permesso negato'); e.code = 'permission-denied'; throw e; }
      return stati[c] || null;
    },
  };
}, JSON.stringify(o)];

const menu = async (p) => {
  await p.click('button[aria-label="Menu"]');
  await p.waitForTimeout(300);
  await p.locator('nav button[data-voce="panoramica"]').click();
  await attendi(p, () => !!document.querySelector('[data-scheda="panoramica"]'));
};

(async () => {
  // ---------- Senza abbonamento ----------
  for (const [nome, o] of [['senza abbonamento', {}], ['con l\'abbonamento scaduto', { scaduto: true }]]) {
    const a = await apri({ admin: false, initScript: scena(o) });
    await menu(a.page);
    await attendi(a.page, () => !!document.querySelector('[data-pro-bloccata="panoramica"]'));
    const t = await a.page.locator('[data-scheda="panoramica"]').innerText();
    ok(`${nome} la Panoramica dice cos'è, e che è del Pro annuale`, /colpo d'occhio/i.test(t) && /annuale/i.test(t));
    ok(`${nome} non legge nessun campo`, (await a.page.evaluate(() => window.__letture.length)) === 0);
    await a.browser.close();
  }

  // ---------- Con l'abbonamento ----------
  const a = await apri({ admin: false, initScript: scena({ abbonato: true }) });
  const p = a.page;
  await menu(p);
  await attendi(p, () => document.querySelectorAll('[data-panoramica-campo]').length === 3);
  ok('con l\'abbonamento compaiono tutti i campi dell\'elenco, anche quello illeggibile', true);
  const speso = await p.locator('[data-panoramica-campo="AAAAAAAA"] [data-speso]').getAttribute('data-speso');
  // 90 + 30 + 24: gli stessi conti del campo (conti.js), non rifatti qui.
  ok(`un campo dice quanto si è speso, con i conti del campo (${speso})`, Number(speso) === 144);
  const a1 = (await p.locator('[data-panoramica-campo="AAAAAAAA"]').innerText()).replace(/[  ]/g, ' ');
  ok(`e le persone, bambini a parte, e quanto costa a testa (${a1.replace(/\s+/g, ' ').slice(0, 120)}…)`, /3 \+ 1 bambini/.test(a1) && /48,00 €/.test(a1));
  ok('e i rimborsi ancora da fare', /rimborsi? da fare/i.test(a1));
  ok('e che è il secondo capogruppo', /secondo capogruppo/i.test(a1));
  ok('il campo col buco lo dice', (await p.locator('[data-panoramica-campo="BBBBBBBB"] [data-buchi]').count()) === 1
    && (await p.locator('[data-panoramica-campo="AAAAAAAA"] [data-buchi]').count()) === 0);
  ok('il campo che non si legge resta, e dice perché', /non riesco a leggerlo/i.test(await p.locator('[data-panoramica-campo="CCCCCCCC"]').innerText()));
  const tot = (await p.locator('[data-totali]').innerText()).replace(/\s+/g, ' ').replace(/[  ]/g, ' ');
  // Due campi letti: 144 + 12. Quello illeggibile non vale zero: non vale.
  ok(`i totali contano i campi letti (${tot})`, /\b2\b/.test(tot) && /156,00 €/.test(tot));

  // Aprire un campo dalla Panoramica: si entra in quello.
  await p.locator('[data-apri="BBBBBBBB"]').click();
  await attendi(p, () => localStorage.getItem('cambusa_stanza') === 'BBBBBBBB');
  ok('«Apri» porta dentro quel campo', true);
  ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await a.browser.close();
  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
