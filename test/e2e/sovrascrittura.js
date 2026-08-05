// Il caso che finora restava scoperto: la fusione girava solo in LETTURA.
// In scrittura si faceva setDoc e basta, quindi un telefono che aveva
// lavorato offline cancellava dal cloud il lavoro di chi era rientrato prima
// di lui — senza potersene accorgere, perché le proprie scritture le ignora.
//
// Qui il cloud finto si comporta come Firestore: runTransaction legge il
// documento vero e la scrittura può essere annullata da dentro.
const { apri, ok, fine } = require('../lib/app');

function cloudFinto() {
  // Il "documento" nel cloud, con dentro il lavoro di un ALTRO telefono.
  window.__doc = null;
  window.__tentativiScrittura = [];
  window.__annullate = 0;

  Object.defineProperty(window, 'CloudSync', {
    configurable: true,
    get() { return window.__cs; },
    set(v) {
      window.__cs = Object.assign({}, v, {
        isConfigured: () => true,
        isConnected: () => !!window.__connesso,
        savedCode: () => 'TEST',
        connect: (cfg, code, cb) => {
          window.__remoteCb = cb;
          window.__connesso = true;
          if (window.__status) window.__status({ connected: true, status: 'connected', code, empty: !window.__doc });
          return Promise.resolve();
        },
        onStatus: (cb) => { window.__status = cb; cb({ connected: true, status: 'connected', code: 'TEST' }); },
        onReceipts: () => {}, onWeather: () => {},

        // Riproduce inviaOra() del modulo vero: legge, e se nel documento c'è
        // qualcosa che questo telefono non ha mai visto NON scrive.
        pushState: (obj) => {
          const json = JSON.stringify(obj);
          window.__tentativiScrittura.push(json);
          const cur = window.__doc;
          const maiVisto = cur && cur.data !== window.__applicato && cur.data !== window.__scritto && cur.updatedBy !== 'io';
          if (maiVisto) {
            window.__annullate++;
            // Come il listener vero: consegna il documento non ancora visto,
            // così la app lo fonde e rimanda l'unione.
            window.__applicato = cur.data;
            if (window.__remoteCb) window.__remoteCb(JSON.parse(cur.data));
            return;
          }
          window.__doc = { data: json, updatedBy: 'io' };
          window.__scritto = json;
        },

        riprova: () => false,
        inSospeso: () => false,
        fotoInCoda: () => 0,
        putReceipt: () => {}, deleteReceipt: () => {},
        putArchive: () => Promise.resolve(true), listArchives: () => Promise.resolve([]),
        listSnapshots: () => Promise.resolve([]), listScores: () => Promise.resolve([]),
        submitScore: () => Promise.resolve(),
        watchPhotos: () => () => {}, listPhotos: () => Promise.resolve([]),
        archivePhotos: () => Promise.resolve(0), putPhoto: () => Promise.resolve(true),
        getPhotoFull: () => Promise.resolve(null), deletePhoto: () => Promise.resolve(true),
      });
    },
  });
}

const nomi = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]').map((x) => x.name).sort());
const nelCloud = (p) => p.evaluate(() => (window.__doc ? JSON.parse(window.__doc.data).members.map((x) => x.name).sort() : []));

const aggiungi = async (p, nome) => {
  await p.fill('input[placeholder="Nome e cognome"]', nome);
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(250);
};

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: cloudFinto });

  // --- Questo telefono lavora "offline": tre membri, mai spediti ---
  await menu('Membri');
  await aggiungi(p, 'Lorenzo');
  await aggiungi(p, 'Bruno');
  await p.waitForTimeout(600);
  ok('il lavoro di questo telefono è nel cloud', (await nelCloud(p)).join() === 'Bruno,Lorenzo');

  // --- Nel frattempo un ALTRO telefono ha pubblicato il suo lavoro ---
  // Rientrato prima, ha aggiunto Anna. Questo telefono non l'ha mai visto.
  const suo = await p.evaluate(() => {
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    const anna = { id: 'altro-1', name: 'Anna', isChild: false };
    const stato = {
      members: membri.concat([anna]), campData: {}, purchases: [], toBuy: [],
      equipment: [], gear: [], settled: [], sepDays: [],
      _meta: { v: 2, rev: { 'm|altro-1': Date.now() }, del: {}, hi: Date.now() },
    };
    window.__doc = { data: JSON.stringify(stato), updatedBy: 'altro' };
    return stato.members.length;
  });
  ok(`nel cloud c'è il lavoro di un altro telefono (${suo} membri)`, suo === 3);

  // --- Questo telefono fa un'altra modifica: NON deve sovrascrivere ---
  const scrittePrima = await p.evaluate(() => window.__tentativiScrittura.length);
  await aggiungi(p, 'Carlo');
  await p.waitForTimeout(1500);

  const annullate = await p.evaluate(() => window.__annullate);
  ok(`la scrittura che avrebbe cancellato il lavoro altrui viene annullata (${annullate})`, annullate >= 1);

  // E il risultato: nessuno perde niente. Anna (l'altro) e Carlo (questo).
  const finali = await nomi(p);
  ok(`su questo telefono ci sono tutti (${finali.join(', ')})`, finali.join() === 'Anna,Bruno,Carlo,Lorenzo');

  const cloud = await nelCloud(p);
  ok(`e nel cloud finisce l'UNIONE, non la sostituzione (${cloud.join(', ')})`, cloud.join() === 'Anna,Bruno,Carlo,Lorenzo');
  ok('e ci sono voluti più tentativi: il primo è stato rifiutato',
    (await p.evaluate(() => window.__tentativiScrittura.length)) > scrittePrima + 1);

  // --- Il caso opposto: se non c'è niente di nuovo, si scrive subito ---
  const prima = await p.evaluate(() => window.__annullate);
  await aggiungi(p, 'Dario');
  await p.waitForTimeout(900);
  ok('quando il cloud non ha novità, la scrittura passa al primo colpo',
    (await p.evaluate(() => window.__annullate)) === prima);
  ok('e Dario è nel cloud', (await nelCloud(p)).indexOf('Dario') >= 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
