// La stessa persona (o la stessa spesa) inserita da due telefoni offline.
//
// Non è un difetto della fusione: è la fusione che funziona e produce un
// risultato sbagliato. Due telefoni senza linea che aggiungono "Anna Rossi"
// creano due membri con id diversi, ed entrambi sono voci nuove legittime —
// nessuna regola può scartarne una. Il controllo che c'è all'inserimento non
// può vederlo, perché in quel momento l'elenco dell'altro non è ancora
// arrivato. Il danno non è estetico: Anna entra DUE VOLTE nel divisore delle
// quote, quindi sbagliano i conti di tutti.
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
        pushState: (obj) => { window.__pushed = obj; },
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

const membri = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]'));
const pastiDi = (p, nome) => p.evaluate((n) => {
  const ms = JSON.parse(localStorage.getItem('cambusa_members') || '[]').filter((x) => x.name === n);
  const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
  let tot = 0;
  Object.keys(cd).forEach((g) => {
    const meals = (cd[g] && cd[g].meals) || {};
    ms.forEach((m) => { const v = meals[m.id]; if (v) tot += (v.lunch ? 1 : 0) + (v.dinner ? 1 : 0); });
  });
  return tot;
}, nome);

const aggiungi = async (p, nome) => {
  await p.fill('input[placeholder="Nome e cognome"]', nome);
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(250);
};

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: cloudFinto });

  await menu('Membri');
  await aggiungi(p, 'Lorenzo');
  await aggiungi(p, 'Anna Rossi');
  await p.waitForTimeout(400);

  // Anna ha segnato il PRANZO su questo telefono.
  await menu('Presenze');
  await p.locator('li', { hasText: 'Anna Rossi' }).locator('button', { hasText: 'Pranzo' }).first().click();
  await p.waitForTimeout(400);

  // --- Arriva l'altro telefono: ha aggiunto la STESSA Anna, con un id suo,
  //     e le ha segnato la CENA ---
  const giorno = await p.evaluate(() => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    const g = Object.keys(cd)[0];
    const suaAnna = { id: 'altro-anna', name: 'Anna Rossi', isChild: false, iban: 'IT60X0542811101000000123456' };
    const meals = Object.assign({}, (cd[g] || {}).meals || {});
    meals['altro-anna'] = { lunch: false, dinner: true };
    const now = Date.now();
    window.__remoteCb({
      members: membri.concat([suaAnna]),
      campData: Object.assign({}, cd, { [g]: Object.assign({}, cd[g], { meals }) }),
      purchases: [], toBuy: [], equipment: [], gear: [], settled: [], sepDays: [],
      _meta: { v: 2, rev: { 'm|altro-anna': now, ['c|' + g + '|meals|altro-anna']: now }, del: {}, hi: now },
    });
    return g;
  });
  await p.waitForTimeout(800);

  const doppi = await membri(p);
  ok(`la fusione tiene ENTRAMBE: sono due voci nuove legittime (${doppi.length} membri)`, doppi.length === 3);
  ok('Anna Rossi compare due volte', doppi.filter((m) => m.name === 'Anna Rossi').length === 2);

  // --- L'app se ne accorge e lo dice, spiegando il danno vero ---
  await menu('Membri');
  await p.waitForTimeout(400);
  const avviso = await p.locator('main').innerText();
  ok('l\'app segnala il doppione', /"Anna Rossi" è in elenco 2 volte/i.test(avviso));
  ok('e dice che il danno è sui conti, non sull\'estetica', /quota di tutti sbaglia/i.test(avviso));
  ok('c\'è il tasto per unire', (await p.locator('button', { hasText: 'Unisci in una sola scheda' }).count()) > 0);

  // Prima di unire: due presenze su due schede diverse.
  ok('le presenze sono divise fra le due schede (2 pasti)', (await pastiDi(p, 'Anna Rossi')) === 2);

  // --- Unione ---
  const chiesto = [];
  p.removeAllListeners('dialog');
  p.on('dialog', async (d) => { chiesto.push(d.message()); await d.accept(); });
  await p.locator('button', { hasText: 'Unisci in una sola scheda' }).first().click();
  await p.waitForTimeout(900);

  ok('l\'unione chiede conferma spiegando cosa succede', /è in elenco 2 volte/i.test(chiesto[0] || ''));
  ok('e promette che le presenze si sommano', /si sommano/i.test(chiesto[0] || ''));

  const dopo = await membri(p);
  ok(`resta una sola Anna (${dopo.length} membri)`, dopo.length === 2 && dopo.filter((m) => m.name === 'Anna Rossi').length === 1);
  ok('le presenze delle due schede si sono SOMMATE, non sovrascritte', (await pastiDi(p, 'Anna Rossi')) === 2);

  const anna = dopo.find((m) => m.name === 'Anna Rossi');
  const meals = await p.evaluate((g) => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    return (cd[g] || {}).meals || {};
  }, giorno);
  ok('pranzo E cena sono sulla stessa scheda', !!meals[anna.id] && meals[anna.id].lunch === true && meals[anna.id].dinner === true);
  ok('l\'IBAN compilato sull\'altra scheda non è andato perso', (anna.iban || '').indexOf('IT60') === 0);
  ok('l\'avviso sparisce', !/è in elenco 2 volte/i.test(await p.locator('main').innerText()));

  // --- Stessa cosa per le spese: qui però NON si tocca niente da soli ---
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  for (let i = 0; i < 2; i++) {
    const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' });
    if (await b.count()) { await b.first().click(); await p.waitForTimeout(300); }
    await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Spesa Conad');
    await p.locator('input[placeholder="0.00"]').first().fill('87');
    await p.locator('button', { hasText: /Salva/ }).first().click();
    await p.waitForTimeout(500);
  }

  const spese = await p.locator('main').innerText();
  ok('la spesa doppia viene segnalata', /"Spesa Conad" da 87\.00 € è registrata 2 volte/i.test(spese));
  ok('spiega che gonfia il totale e le quote', /quota di tutti sale/i.test(spese));
  ok('ma NON offre di cancellarla da sola: di mezzo ci sono i soldi',
    (await p.locator('button', { hasText: /Unisci le spese/i }).count()) === 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
