// La corsa fra una spunta e un aggiornamento in arrivo.
//
// Tutti online, quindici persone che segnano presenze mentre dal cloud
// arrivano di continuo aggiornamenti. Se una spunta capita nello stesso
// istante di un aggiornamento remoto, React le mette nello stesso giro di
// disegno: se in quel giro la datazione delle modifiche viene saltata, la
// spunta resta SENZA DATA — e la prima volta che qualcun altro tocca quella
// stessa presenza, la spunta sparisce senza lasciare traccia.
const { apri, ok, fine } = require('../lib/app');

function cloudFinto() {
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
          if (window.__status) window.__status({ connected: true, status: 'connected', code });
          return Promise.resolve();
        },
        onStatus: (cb) => { window.__status = cb; cb({ connected: true, status: 'connected', code: 'TEST' }); },
        onReceipts: () => {}, onWeather: () => {},
        pushState: (obj) => { window.__inviati = (window.__inviati || []).concat([obj]); },
        riprova: () => false, inSospeso: () => false, fotoInCoda: () => 0,
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

const aggiungi = async (p, nome) => {
  await p.fill('input[placeholder="Nome e cognome"]', nome);
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(200);
};

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: cloudFinto });

  await menu('Membri');
  await aggiungi(p, 'Lorenzo');
  await aggiungi(p, 'Anna');
  await menu('Presenze');
  await p.waitForTimeout(500);

  // Un aggiornamento che tocca un'ALTRA cosa (una spesa), e nello stesso
  // identico giro la spunta del pranzo di Anna. È la fotografia del momento in
  // cui i due eventi si accavallano.
  const esito = await p.evaluate(() => {
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const anna = membri.find((m) => m.name === 'Anna');
    const now = Date.now();

    // Il bottone "Pranzo" nella riga di Anna.
    const riga = [...document.querySelectorAll('li')].find((li) => li.textContent.indexOf('Anna') >= 0);
    const pranzo = riga && [...riga.querySelectorAll('button')].find((b) => /pranzo/i.test(b.textContent));
    if (!pranzo) return { errore: 'bottone Pranzo non trovato' };

    // I due eventi nello stesso giro: prima arriva il dato dal cloud, poi il dito.
    window.__remoteCb({
      members: membri, campData: cd,
      purchases: [{ id: 'remota-1', name: 'Pane', price: 3, type: 'alimentare', buyer: 'Lorenzo', at: now }],
      toBuy: [], equipment: [], gear: [], settled: [], sepDays: [],
      _meta: { v: 2, rev: { 'p|remota-1': now }, del: {}, hi: now },
    });
    pranzo.click();

    return { anna: anna.id };
  });
  ok('la riga di Anna con il tasto Pranzo esiste', !esito.errore);
  await p.waitForTimeout(1200);

  const giorno = await p.evaluate(() => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    return Object.keys(cd).sort()[0] || '';
  });

  // 1) La spunta si vede: questo funzionava anche prima.
  const segnata = await p.evaluate((x) => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const v = ((cd[x.g] || {}).meals || {})[x.id];
    return !!(v && v.lunch);
  }, { g: giorno, id: esito.anna });
  ok('la spunta si vede sullo schermo', segnata);

  // 2) Ma è DATATA? Senza data perde qualsiasi confronto futuro.
  const percorso = `c|${giorno}|meals|${esito.anna}`;
  const datata = await p.evaluate((pth) => {
    const m = JSON.parse(localStorage.getItem('cambusa_syncmeta') || '{}');
    return !!(m.rev || {})[pth];
  }, percorso);
  ok('la spunta è DATATA nella cronologia', datata);

  // 3) Ed è partita verso gli altri?
  const spedita = await p.evaluate((x) => {
    const inviati = window.__inviati || [];
    return inviati.some((s) => {
      const v = (((s.campData || {})[x.g] || {}).meals || {})[x.id];
      return !!(v && v.lunch);
    });
  }, { g: giorno, id: esito.anna });
  ok('la spunta è stata spedita agli altri', spedita);

  // 4) La prova del nove: un altro telefono tocca la STESSA presenza poco
  //    dopo. Se la spunta non era datata, qui sparisce senza lasciare traccia.
  await p.evaluate((x) => {
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const meals = Object.assign({}, (cd[x.g] || {}).meals || {});
    meals[x.id] = { lunch: false, dinner: false };   // l'altro ce l'ha ancora vuota
    const now = Date.now();
    window.__remoteCb({
      members: membri,
      campData: Object.assign({}, cd, { [x.g]: Object.assign({}, cd[x.g], { meals }) }),
      purchases: [{ id: 'remota-1', name: 'Pane', price: 3, type: 'alimentare', buyer: 'Lorenzo', at: now }],
      toBuy: [], equipment: [], gear: [], settled: [], sepDays: [],
      _meta: { v: 2, rev: { 'p|remota-1': now, ['c|' + x.g + '|meals|' + x.id]: now - 60000 }, del: {}, hi: now },
    });
  }, { g: giorno, id: esito.anna });
  await p.waitForTimeout(900);

  const sopravvissuta = await p.evaluate((x) => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const v = ((cd[x.g] || {}).meals || {})[x.id];
    return !!(v && v.lunch);
  }, { g: giorno, id: esito.anna });
  ok('la spunta sopravvive a un aggiornamento più VECCHIO che la contraddice', sopravvissuta);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
