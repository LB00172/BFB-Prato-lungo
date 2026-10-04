// La mia lista: la checklist privata (4 ottobre, ROADMAP § 6).
//
// Il punto che conta e' che sia DAVVERO privata: non deve entrare nei dati
// del campo — che ogni telefono tiene interi e che l'esportazione scarica —
// ma stare in una chiave sua sul telefono e, sotto il proprio uid, nel cloud.
// Qui si guarda che: le voci si scrivono e si spuntano; vanno nel cloud sotto
// il proprio uid; NON finiscono nell'esportazione del campo; dal cloud arriva
// la copia piu' recente (un altro telefono della stessa persona); e senza
// stanza la lista resta sul telefono, e lo si dice.
const fs = require('fs');
const { apri, ok, fine, attendi } = require('../lib/app');

const CODICE = 'K7RX2MQP';
const scena = (o) => [(s) => {
  const o = JSON.parse(s);
  if (o.stanza) {
    let vero;
    Object.defineProperty(window, 'APP_CONFIG', {
      configurable: true,
      get() { return vero; },
      set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { rooms: true, auth: true }) }); },
    });
    window.APP_CONFIG = {};
    localStorage.setItem('cambusa_stanza', o.codice);
    localStorage.setItem('cambusa_sync_optout', '1');
    localStorage.setItem('cambusa_campi', JSON.stringify([{ codice: o.codice, nome: 'Campo', inizio: '2027-07-12', fine: '2027-07-13', ruolo: 'redattore' }]));
  }
  localStorage.setItem('cambusa_members', JSON.stringify([{ id: 'm1', name: 'Marco', isChild: false }]));
  if (o.locale && !sessionStorage.getItem('__seminato')) {
    sessionStorage.setItem('__seminato', '1');
    localStorage.setItem('cambusa_mia_lista', JSON.stringify(o.locale));
  }
  window.__scritte = [];
  const utente = { uid: 'marco', email: 'm@example.com', nome: 'Marco', isAnonimo: false, emailVerificata: true };
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true, utente: () => utente, osserva: (cb) => { cb(utente); return () => {}; },
    conGoogle: async () => utente, esci: async () => {}, stanzeDelProfilo: async () => [o.codice],
  };
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true, entra: async (c) => c, leggi: async () => null, motivo: () => 'stanza.nonRiuscito',
    membri: async () => [{ uid: 'marco', ruolo: 'redattore', nome: 'Marco' }],
    statoDi: async (codici) => codici.map((c) => ({ codice: c, membro: true, proprietario: false, nome: 'Campo', inizio: '2027-07-12', fine: '2027-07-13' })),
    impostaStanza: async () => {},
    leggiPersonale: async (c, u) => { window.__letta = [c, u && u.uid]; return o.remota || null; },
    scriviPersonale: async (c, u, lista) => { window.__scritte.push({ codice: c, uid: u && u.uid, lista: JSON.parse(JSON.stringify(lista)) }); return true; },
  };
}, JSON.stringify(Object.assign({ codice: CODICE, stanza: true }, o))];
const voci = (p) => p.evaluate(() => [...document.querySelectorAll('[data-voce-mia]')].map((li) => li.getAttribute('data-voce-mia')));

(async () => {
  // ---------- Nel campo, con l'account ----------
  const a = await apri({ admin: false, initScript: scena({}) });
  const p = a.page;
  await a.menu('La mia lista');
  await attendi(p, () => !!document.querySelector('[data-scheda="mia-lista"]'));
  ok('dice chi la vede: solo tu', /solo tu/i.test(await p.locator('[data-chi-la-vede]').innerText()) && /capogruppo/i.test(await p.locator('[data-chi-la-vede]').innerText()));
  for (const t of ['Torcia', 'Sacco a pelo']) {
    await p.fill('[data-nuova-voce]', t);
    await p.locator('[data-nuova-voce]').press('Enter');
  }
  await attendi(p, () => document.querySelectorAll('[data-voce-mia]').length === 2);
  await p.locator('[data-voce-mia="Torcia"] button[aria-pressed]').click();
  await attendi(p, () => window.__scritte.some((x) => x.lista.voci.some((v) => v.testo === 'Torcia' && v.fatto)));
  const ultima = await p.evaluate(() => window.__scritte[window.__scritte.length - 1]);
  ok(`va nel cloud sotto il proprio uid, nel proprio campo (${ultima.uid}, ${ultima.codice})`, ultima.uid === 'marco' && ultima.codice.replace(/-/g, '') === CODICE);
  ok('spuntata, la voce passa fra le fatte', /fatte \(1\)/i.test(await p.locator('[data-scheda="mia-lista"]').innerText()));

  // Privata davvero: l'esportazione del campo non la contiene.
  await a.menu('Spese Totali');
  await p.locator('main button', { hasText: /^dati$/i }).first().click();
  const [scarico] = await Promise.all([p.waitForEvent('download'), p.locator('main button', { hasText: /^esporta$/i }).first().click()]);
  const esportato = fs.readFileSync(await scarico.path(), 'utf8');
  ok('l\'esportazione del campo non contiene la lista privata', esportato.length > 50 && !/Torcia|Sacco a pelo/.test(esportato));
  ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await a.browser.close();

  // ---------- Dal cloud arriva la copia più recente ----------
  const b = await apri({ admin: false, initScript: scena({
    locale: { voci: [{ id: 'x', testo: 'Vecchia', fatto: false }], at: 1000 },
    remota: { voci: [{ id: 'y', testo: 'Borraccia', fatto: false }], at: 2000 },
  }) });
  await b.menu('La mia lista');
  await attendi(b.page, () => !!document.querySelector('[data-voce-mia="Borraccia"]'));
  ok(`la copia più recente del cloud vince su quella del telefono (${(await voci(b.page)).join(', ')})`, (await voci(b.page)).join() === 'Borraccia');
  await b.browser.close();

  // ---------- Senza stanza resta sul telefono ----------
  const c = await apri({ admin: false, initScript: scena({ stanza: false }) });
  await c.menu('La mia lista');
  await attendi(c.page, () => !!document.querySelector('[data-scheda="mia-lista"]'));
  ok('fuori da una stanza dice che resta su questo telefono', /questo telefono/i.test(await c.page.locator('[data-chi-la-vede]').innerText()));
  await c.page.fill('[data-nuova-voce]', 'Coltellino');
  await c.page.locator('[data-nuova-voce]').press('Enter');
  await c.page.waitForTimeout(1000);   // qui si verifica che una scrittura NON parta
  ok('e nel cloud non va niente', (await c.page.evaluate(() => window.__scritte.length)) === 0
    && /Coltellino/.test(await c.page.evaluate(() => localStorage.getItem('cambusa_mia_lista'))));
  await c.browser.close();
  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
