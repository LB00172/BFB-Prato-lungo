// La lista dei membri a righe sottili, e la scheda di ogni persona (4 ottobre).
//
// Le righe erano riquadri alti quanto tre bottoni pieni: con venti persone la
// lista era tre schermate. Adesso sono righe con un filo in mezzo, e i tasti
// tengono il posto da toccare di 44 px ma un disegno piccolo.
//
// La «i» apre la scheda della persona: nome, cognome, email, telefono, e
// IBAN, Satispay e PayPal per farsi rimborsare. La compilano la persona
// stessa e il capogruppo; gli altri la LEGGONO — serve a sapere dove fare il
// bonifico —, e quando NON deve comparire la casella, non compare.
// «La persona stessa» e' la scheda legata al suo account: se l'e' aggiunta
// con «sono io», o l'ha presa dopo con «questa scheda sono io».
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
  localStorage.setItem('cambusa_stanza', o.codice);
  localStorage.setItem('cambusa_sync_optout', '1');
  const mio = o.ruolo === 'proprietario';
  localStorage.setItem('cambusa_campi', JSON.stringify([{ codice: o.codice, nome: 'Campo', inizio: '2027-07-12', fine: '2027-07-13', ruolo: o.ruolo }]));
  if (!sessionStorage.getItem('__seminato')) {
    sessionStorage.setItem('__seminato', '1');
    localStorage.setItem('cambusa_members', JSON.stringify(o.membri));
    const P = { lunch: true, dinner: true };
    const meals = {};
    o.membri.forEach((m) => { meals[m.id] = P; });
    localStorage.setItem('cambusa_camp_data', JSON.stringify({ '2027-07-12': { note: '', guestsNames: '', meals } }));
    localStorage.setItem('cambusa_purchases', JSON.stringify([{ id: 'p1', name: 'Spesa', price: 60, type: 'alimentare', buyer: 'Marco Bellini', at: 1 }]));
  }
  const utente = { uid: o.uid, email: 'x@example.com', nome: o.nome, isAnonimo: false, emailVerificata: true };
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
    statoDi: async (codici) => codici.map((c) => ({ codice: c, membro: true, proprietario: mio, nome: 'Campo', inizio: '2027-07-12', fine: '2027-07-13' })),
    impostaStanza: async () => {},
  };
}, JSON.stringify(Object.assign({ codice: CODICE, ruolo: 'proprietario', uid: 'giulia', nome: 'Giulia Ferri' }, o))];

const TRE = [
  { id: 'm1', name: 'Giulia Ferri', isChild: false, uid: 'giulia' },
  { id: 'm2', name: 'Marco Bellini', isChild: false },
  { id: 'm3', name: 'Anna Riva', isChild: false },
];
const membri = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members')));
const apriScheda = async (p, nome) => {
  await p.locator(`[data-membro="${nome}"] button[aria-label*="${nome}"]`).first().click();
  await attendi(p, (n) => !!document.querySelector(`[data-scheda-membro="${n}"]`), nome);
  return p.locator(`[data-scheda-membro="${nome}"]`);
};

(async () => {
  // ---------- Il capogruppo ----------
  const a = await apri({ admin: false, initScript: scena({ membri: TRE }) });
  const p = a.page;
  await a.menu('Membri');
  await attendi(p, () => document.querySelectorAll('[data-membro]').length === 3);
  const altezze = await p.evaluate(() => [...document.querySelectorAll('[data-membro]')].map((li) => Math.round(li.getBoundingClientRect().height)));
  ok(`le righe sono sottili (${altezze.join(', ')} px)`, altezze.every((h) => h <= 60));
  const tasti = await p.evaluate(() => [...document.querySelectorAll('[data-membro] button')].map((b) => { const r = b.getBoundingClientRect(); return Math.min(Math.round(r.width), Math.round(r.height)); }));
  ok(`ma i tasti restano da 44 px da toccare (minimo ${Math.min(...tasti)})`, Math.min(...tasti) >= 44);

  const sm = await apriScheda(p, 'Marco Bellini');
  const campi = await sm.locator('input[data-dato]').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-dato')));
  ok(`il capogruppo compila la scheda di un altro: ${campi.join(', ')}`,
    campi.join(',') === 'nome,cognome,email,telefono,iban,satispay,paypal');
  await sm.locator('input[data-dato="nome"]').fill('Marco');
  await sm.locator('input[data-dato="cognome"]').fill('Bellini');
  await sm.locator('input[data-dato="email"]').fill('marco@example.com');
  await sm.locator('input[data-dato="telefono"]').fill('+39 333 1234567');
  await sm.locator('input[data-dato="satispay"]').fill('+39 333 1234567');
  await attendi(p, () => (JSON.parse(localStorage.getItem('cambusa_members')).find((m) => m.id === 'm2') || {}).satispay === '+39 333 1234567');
  const marco = (await membri(p)).find((m) => m.id === 'm2');
  ok(`e i dati restano sulla persona (${[marco.nome, marco.cognome, marco.email, marco.telefono].join(' · ')})`,
    marco.nome === 'Marco' && marco.cognome === 'Bellini' && marco.email === 'marco@example.com' && marco.telefono === '+39 333 1234567');
  ok('il nome nel campo non cambia: è quello delle spese', marco.name === 'Marco Bellini');

  // Il Satispay compare dove serve: accanto a chi deve ricevere.
  await a.menu('Spese Totali');
  await p.locator('main button:has-text("Saldi")').click();
  await attendi(p, () => !!document.querySelector('main li[data-da-fare]'));
  ok('nei Saldi accanto a chi riceve c\'è il suo Satispay', /satispay/i.test(await p.locator('main li[data-da-fare]').first().innerText())
    && /\+39 333 1234567/.test(await p.locator('main li[data-da-fare]').first().innerText()));
  ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await a.browser.close();

  // ---------- Un membro con la sua scheda ----------
  const conMarco = TRE.map((m) => (m.id === 'm2' ? { ...m, uid: 'marco' } : m));
  const b = await apri({ admin: false, initScript: scena({ membri: conMarco, ruolo: 'redattore', uid: 'marco', nome: 'Marco Bellini' }) });
  const q = b.page;
  await b.menu('Membri');
  await attendi(q, () => document.querySelectorAll('[data-membro]').length === 3);
  ok('la sua riga dice «tu», e solo la sua', (await q.locator('[data-membro="Marco Bellini"] [data-tu]').count()) === 1 && (await q.locator('[data-tu]').count()) === 1);
  const sua = await apriScheda(q, 'Marco Bellini');
  ok('la sua scheda la compila', (await sua.locator('input[data-dato]').count()) === 7);
  await sua.locator('input[data-dato="paypal"]').fill('paypal.me/marco');
  await attendi(q, () => (JSON.parse(localStorage.getItem('cambusa_members')).find((m) => m.id === 'm2') || {}).paypal === 'paypal.me/marco');
  const altra = await apriScheda(q, 'Giulia Ferri');
  ok('quella di un altro la legge e basta: nessuna casella', (await altra.locator('input').count()) === 0
    && (await altra.locator('[data-sola-lettura]').count()) === 1);
  ok('e non può dire che è lui: ha già la sua', (await altra.locator('[data-prendi]').count()) === 0);
  ok('«sono io» non si offre a chi ha già la sua scheda', (await q.locator('[data-sono-io]').count()) === 0);
  ok('nessun errore JavaScript' + (b.errori.length ? ': ' + b.errori.join(' | ') : ''), b.errori.length === 0);
  await b.browser.close();

  // ---------- Un membro senza scheda: la prende ----------
  const c = await apri({ admin: false, initScript: scena({ membri: TRE, ruolo: 'redattore', uid: 'marco', nome: 'Marco Bellini' }) });
  const r = c.page;
  await c.menu('Membri');
  await attendi(r, () => document.querySelectorAll('[data-membro]').length === 3);
  ok('chi non ha ancora una scheda può aggiungersi con «sono io»', (await r.locator('[data-sono-io]').count()) === 1);
  const prima = await apriScheda(r, 'Marco Bellini');
  ok('prima di prenderla, la scheda si legge e basta', (await prima.locator('input').count()) === 0);
  await prima.locator('[data-prendi]').click();
  await attendi(r, () => !!document.querySelector('[data-scheda-membro="Marco Bellini"] input[data-dato]'));
  ok('con «questa scheda sono io» diventa sua, e la compila', (await membri(r)).find((m) => m.id === 'm2').uid === 'marco');
  ok('e le altre no: una scheda a testa', (await r.locator('[data-prendi]').count()) === 0 && (await r.locator('[data-sono-io]').count()) === 0);
  ok('nessun errore JavaScript' + (c.errori.length ? ': ' + c.errori.join(' | ') : ''), c.errori.length === 0);
  await c.browser.close();
  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
