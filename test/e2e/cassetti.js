// Ogni campo ha il suo cassetto: passare da un campo all'altro non mescola.
//
// Sul telefono i dati del campo stavano in un posto solo, senza scritto a
// quale campo appartenessero. Entrando in un secondo campo l'app si
// collegava al codice nuovo e FONDEVA quello che aveva in memoria con quello
// che arrivava — poi rimandava su il risultato. I membri e le spese del campo
// A finivano nel campo B, per tutti quelli di B; e le foto degli scontrini di
// A venivano caricate nella stanza di B, dove le vedeva chiunque. Nessuno se
// n'e' accorto perche' al campo di agosto il campo era uno solo.
//
// Qui il cloud e' finto e registra DOVE gli viene scritto cosa: la prova
// guarda quello che parte verso ciascun campo, non soltanto lo schermo.
const { apri, ok, fine, fotoSalvate, attendi } = require('../lib/app');

const A = 'BCDFGHJK';
const B = 'K7RX2MQP';

const scena = [(s) => {
  const o = JSON.parse(s);
  // Le stanze e l'account accesi, come in e2e/stanza.
  let vero;
  Object.defineProperty(window, 'APP_CONFIG', {
    configurable: true,
    get() { return vero; },
    set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { rooms: true, auth: true }) }); },
  });
  window.APP_CONFIG = {};

  // Lo stato di partenza si semina UNA volta: lo script di avvio rigira a
  // ogni navigazione, e riseminare cancellerebbe proprio quello che la prova
  // vuole guardare.
  if (!sessionStorage.getItem('seminato')) {
    sessionStorage.setItem('seminato', '1');
    localStorage.setItem('cambusa_stanza', o.A);
    localStorage.setItem('cambusa_members', JSON.stringify([{ id: 'm-anna', name: 'Anna Rossi', isChild: false }]));
    localStorage.setItem('cambusa_purchases', JSON.stringify([
      { id: 'p-a1', name: 'Pane di A', price: 12, type: 'alimentare', buyer: 'Anna Rossi', at: 1 },
    ]));
    // La foto passa dalla vecchia chiave: all'avvio il magazzino la migra da
    // solo, ed e' la strada che fa anche un telefono vero.
    localStorage.setItem('cambusa_receipts', JSON.stringify({ 'p-a1': 'data:image/png;base64,QUFBQQ==' }));
  }

  const utente = { uid: 'anna-1', email: 'anna@example.com', nome: 'Anna Rossi', isAnonimo: false, emailVerificata: true };
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true,
    utente: () => utente,
    osserva: (cb) => { cb(utente); return () => {}; },
    conGoogle: async () => utente, esci: async () => {},
  };
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (codice) => window.Stanza.normalizza(codice),
    membri: async () => [],
    leggi: async () => null,
    motivo: () => 'stanza.nonRiuscito',
  };

  // Il cloud finto. Il registro sopravvive ai rimontaggi dell'app ma non
  // alle navigazioni: la prova non ne fa.
  window.__cloud = { agganci: [], spinte: [], foto: [] };
  let collegato = null;
  let alStato = null;
  let alleFoto = null;
  // Come Firestore: finche' si e' collegati arriva l'elenco delle foto del
  // campo (qui sempre vuoto), ed e' li' che l'app carica quelle che ha solo
  // lei. Se in memoria avesse le foto di un altro campo, partirebbero. Arriva
  // di continuo perche' il magazzino si legge dopo il collegamento, non prima.
  setInterval(() => { if (alleFoto && collegato) alleFoto({}); }, 200);
  Object.defineProperty(window, 'CloudSync', {
    configurable: true,
    get() { return window.__cs; },
    set(v) {
      window.__cs = Object.assign({}, v, {
        isConfigured: () => true,
        isConnected: () => !!collegato,
        codiceCollegato: () => collegato,
        uidCollegato: () => 'anna-1',
        savedCode: () => localStorage.getItem('cambusa_camp_code'),
        connect: (cfg, code) => {
          collegato = code;
          window.__cloud.agganci.push(code);
          localStorage.setItem('cambusa_camp_code', code);
          // Una stanza appena creata nel cloud e' vuota, e l'app pubblica
          // quello che ha: e' la strada piu' corta per portare i dati di un
          // campo dentro un altro.
          if (alStato) alStato({ connected: true, status: 'connected', code, empty: code !== o.A });
          return Promise.resolve();
        },
        disconnect: () => {
          collegato = null;
          localStorage.removeItem('cambusa_camp_code');
          if (alStato) alStato({ connected: false, status: 'idle' });
        },
        onStatus: (cb) => { alStato = cb; cb({ connected: !!collegato, status: collegato ? 'connected' : 'idle' }); },
        onReceipts: (cb) => { alleFoto = cb; },
        onWeather: () => {},
        pushState: (obj) => { window.__cloud.spinte.push({ code: collegato, json: JSON.stringify(obj) }); },
        putReceipt: (id) => { window.__cloud.foto.push({ code: collegato, id }); },
        deleteReceipt: () => {}, putWeather: () => {},
        listArchives: () => Promise.resolve([]), listSnapshots: () => Promise.resolve([]), listScores: () => Promise.resolve([]),
        needsPassword: () => false, authMode: () => 'anon',
      });
    },
  });
}, JSON.stringify({ A })];

const testo = (a) => a.page.locator('main').innerText();

const entraNellaStanza = async (a, codice) => {
  await a.menu('Impostazioni');
  // Da dentro una stanza non si entra in un'altra: prima si esce.
  const esci = a.page.locator('main button', { hasText: /Esci dalla stanza/i });
  if (await esci.count()) await esci.first().click();
  await a.page.locator('main button', { hasText: /Entra con un codice/i }).click();
  await a.page.locator('main input[placeholder="Codice"]').fill(codice);
  await a.page.locator('main button', { hasText: /^Entra$/i }).click();
};

const aggancio = (a, codice) => attendi(a.page, (c) => window.__cloud.agganci.includes(c), codice);

(async () => {
  const a = await apri({ initScript: scena });

  // ---------- 1. Il campo A com'era ----------
  await aggancio(a, A);
  await a.menu('Membri');
  ok('nel campo A c\'è Anna', /Anna Rossi/.test(await testo(a)));
  await attendi(a.page, () => window.__cloud.foto.some((f) => f.id === 'p-a1'));
  ok('la foto dello scontrino di A parte verso A (è sua)',
    (await a.page.evaluate(() => window.__cloud.foto)).every((f) => f.code === 'BCDFGHJK'));

  // ---------- 2. Si entra nel campo B ----------
  await entraNellaStanza(a, 'K7RX-2MQP');
  await aggancio(a, B);
  // Qui si aspetta che qualcosa NON succeda: l'attesa fissa e' l'unica
  // possibile (CLAUDE.md). Copre la spinta ritardata e l'arrivo delle foto.
  await a.page.waitForTimeout(2500);

  const fotoVersoB = await a.page.evaluate((b) => window.__cloud.foto.filter((f) => f.code === b).map((f) => f.id), B);
  ok(`la foto di A non viene caricata nella stanza di B (${JSON.stringify(fotoVersoB)})`,
    fotoVersoB.length === 0);

  await a.menu('Membri');
  ok('nel campo B Anna non c\'è', !/Anna Rossi/.test(await testo(a)));
  await a.menu('Spese Totali');
  // I dodici euro del pane di A non devono entrare nei totali di B.
  ok('e i totali di B non contano la spesa di A', !/12[.,]00\s*€/.test(await testo(a)));

  const fotoQui = await fotoSalvate(a.page);
  ok(`il magazzino delle foto non tiene quella di A mentre si è in B (${JSON.stringify(fotoQui)})`,
    !fotoQui.includes('p-a1'));

  // Nel campo B si lavora: un membro nuovo.
  await a.menu('Membri');
  await a.page.locator('main input[placeholder]').first().fill('Bruno Bianchi');
  await a.page.locator('main button', { hasText: /^\+$/ }).first().click();
  await attendi(a.page, () => /Bruno Bianchi/.test(document.querySelector('main').innerText));
  // Il cloud di B deve ricevere il lavoro fatto in B: senza, la verifica
  // "niente di A verso B" sarebbe vera anche con la sincronizzazione ferma.
  await attendi(a.page, (b) => window.__cloud.spinte.some((s) => s.code === b && /Bruno Bianchi/.test(s.json)), B);
  const versoB = await a.page.evaluate((b) => window.__cloud.spinte.filter((s) => s.code === b), B);
  const macchiate = versoB.filter((s) => /Anna Rossi|Pane di A/.test(s.json));
  ok(`nessun dato di A parte verso B (${macchiate.length} spedizioni su ${versoB.length} lo contenevano)`,
    versoB.length > 0 && macchiate.length === 0);

  // ---------- 3. Si torna nel campo A ----------
  await entraNellaStanza(a, 'BCDF-GHJK');
  await attendi(a.page, (c) => window.__cloud.agganci.filter((x) => x === c).length >= 2, A);
  await a.page.waitForTimeout(1500);

  await a.menu('Membri');
  const tornato = await testo(a);
  ok('tornati in A, Anna è ancora lì', /Anna Rossi/.test(tornato));
  ok('e Bruno, che è di B, non c\'è', !/Bruno Bianchi/.test(tornato));
  const versoA = await a.page.evaluate((c) => window.__cloud.spinte.filter((s) => s.code === c), A);
  ok('niente di B parte verso A', versoA.every((s) => !/Bruno Bianchi/.test(s.json)));
  const fotoTornate = await fotoSalvate(a.page);
  ok(`la foto di A è tornata nel magazzino (${JSON.stringify(fotoTornate)})`, fotoTornate.includes('p-a1'));

  ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await fine(a.browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
