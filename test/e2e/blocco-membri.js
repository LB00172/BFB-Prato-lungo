// Il blocco delle presenze deve reggere anche dal lato dei MEMBRI.
// Le quote non escono dai pasti: escono da pasti per membri. Congelare i pasti
// e lasciare libero l'elenco vuol dire promettere che un giorno non cambia e
// poi lasciarlo cambiare lo stesso — basta eliminare una persona, o
// dichiararla bambina, e le quote di quel giorno si riscrivono tutte.
const { apri, ok, fine, attendi } = require('../lib/app');

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

const membri = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]').map((m) => m.name).sort().join(','));
const idDi = (p, nome) => p.evaluate((n) => (JSON.parse(localStorage.getItem('cambusa_members') || '[]').find((m) => m.name === n) || {}).id, nome);

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: cloudFinto });
  const chiesto = [];
  p.removeAllListeners('dialog');
  p.on('dialog', async (d) => { chiesto.push(d.message()); await d.accept(); });

  await menu('Membri');
  await aggiungi(p, 'Anna');
  await aggiungi(p, 'Bruno');
  await aggiungi(p, 'Carla');

  // Anna e Bruno mangiano il giorno che poi si blocca. Carla no: serve a
  // dimostrare che il blocco non trattiene chi non c'entra.
  await menu('Presenze');
  await p.locator('li', { hasText: 'Anna' }).locator('button', { hasText: 'Pranzo' }).first().click();
  await p.waitForTimeout(200);
  await p.locator('li', { hasText: 'Bruno' }).locator('button', { hasText: 'Pranzo' }).first().click();
  await p.waitForTimeout(400);

  const giorno = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}')).sort()[0] || '');
  ok('si parte con un giorno di presenze', !!giorno);

  // Una spesa, cosi' le quote esistono e si possono confrontare.
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' });
  if (await b.count()) { await b.first().click(); await p.waitForTimeout(300); }
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Pasta');
  await p.locator('input[placeholder="0.00"]').first().fill('120');
  await p.locator('button', { hasText: /Salva/ }).first().click();
  await p.waitForTimeout(500);

  const quote = () => p.evaluate(() => {
    const t = window.__totali;
    if (!t || !t.breakdown) return '';
    return t.breakdown.map((b) => `${b.name}:${b.payCents}`).sort().join(' ');
  });

  await menu('Presenze');
  await p.locator('button', { hasText: 'Blocca le presenze' }).first().click();
  await p.waitForTimeout(700);
  const quotePrima = await quote();
  ok(`con il giorno bloccato le quote sono definite (${quotePrima})`, /Anna:[1-9]/.test(quotePrima));

  // ---- 1. Il blocco si porta dietro le schede di chi c'era ----------------
  const dentro = await p.evaluate((g) => {
    const b = ((JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}'))[g] || {}).bloccato || {};
    return (b.membri || []).map((m) => m.name).sort().join(',');
  }, giorno);
  ok('nel blocco entrano le schede di chi ha mangiato quel giorno', dentro === 'Anna,Bruno');
  ok('e non quelle di chi quel giorno non c\'era', !/Carla/.test(dentro));

  // ---- 2. Col dito: eliminare non si puo' --------------------------------
  await menu('Membri');
  chiesto.length = 0;
  await p.locator('li', { hasText: 'Anna' }).locator('button', { hasText: '×' }).first().click();
  await p.waitForTimeout(500);
  ok('eliminare chi ha presenze bloccate viene rifiutato', /non è possibile/i.test(chiesto[0] || ''));
  ok('e il messaggio dice quale giorno la trattiene', /presenze bloccate/i.test(chiesto[0] || ''));
  ok('Anna resta fra i membri', (await membri(p)) === 'Anna,Bruno,Carla');

  chiesto.length = 0;
  await p.locator('li', { hasText: 'Anna' }).locator('button', { hasText: /^Adulto$/ }).first().click();
  await p.waitForTimeout(500);
  ok('nemmeno dichiararla bambina', /non è possibile/i.test(chiesto[0] || ''));
  ok('Anna resta adulta', (await p.locator('li', { hasText: 'Anna' }).locator('button', { hasText: /^Adulto$/ }).count()) === 1);

  ok('e le quote non si sono mosse', (await quote()) === quotePrima);

  // ---- 3. Chi non c'entra si elimina normalmente --------------------------
  // Un blocco che blocca tutto non protegge: paralizza.
  chiesto.length = 0;
  await p.locator('li', { hasText: 'Carla' }).locator('button', { hasText: '×' }).first().click();
  await p.waitForTimeout(500);
  ok('chi non ha presenze in giorni bloccati si elimina', (await membri(p)) === 'Anna,Bruno');
  ok('e le viene chiesta conferma come sempre', /Eliminare Carla/i.test(chiesto[0] || ''));
  // Carla non aveva pasti: toglierla non deve spostare un centesimo.
  const quoteDopoCarla = await quote();
  ok(`togliere chi non mangiava non muove le quote (${quoteDopoCarla})`,
    quoteDopoCarla === quotePrima.split(' ').filter((x) => !/^Carla:/.test(x)).join(' '));

  // ---- 4. Dalla sincronizzazione: l'eliminazione si respinge --------------
  // Un altro telefono elimina Bruno e lo dice a tutti, datato ADESSO. Senza
  // difesa vincerebbe, e le quote del giorno bloccato cambierebbero da sole.
  const idBruno = await idDi(p, 'Bruno');
  await p.evaluate((o) => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const rimasti = JSON.parse(localStorage.getItem('cambusa_members') || '[]').filter((m) => m.id !== o.id);
    const now = Date.now() + 60000;
    window.__remoteCb({
      members: rimasti,
      campData: cd,
      purchases: JSON.parse(localStorage.getItem('cambusa_purchases') || '[]'),
      toBuy: [], equipment: [], gear: [], settled: [], sepDays: [], freeDays: [], blocchi: [],
      _meta: { v: 2, rev: {}, del: { ['m|' + o.id]: now }, hi: now },
    });
  }, { id: idBruno });

  await attendi(p, () => (JSON.parse(localStorage.getItem('cambusa_members') || '[]')).some((m) => m.name === 'Bruno'), null, 8000)
    .then(() => ok('Bruno viene rimesso in elenco', true))
    .catch(() => ok('Bruno viene rimesso in elenco', false));

  ok('l\'elenco torna quello di prima', (await membri(p)) === 'Anna,Bruno');
  ok('e le quote del giorno bloccato non sono cambiate', (await quote()) === quoteDopoCarla);

  const avviso = await p.locator('body').innerText();
  ok('l\'app dice che è stata rimessa, non lo fa in silenzio', /rimessa fra i membri/i.test(avviso));
  ok('e spiega che va prima sbloccato il giorno', /sbloccano quei giorni|sbloccare/i.test(avviso));

  // La correzione va ripubblicata, altrimenti il blocco vale solo qui.
  const ripubblicato = await p.evaluate((o) => {
    const inviati = window.__inviati || [];
    const ultimo = inviati[inviati.length - 1];
    return !!(ultimo && (ultimo.members || []).some((m) => m.id === o.id));
  }, { id: idBruno });
  ok('la correzione viene rimandata agli altri telefoni', ripubblicato);

  // ---- 5. Sbloccato il giorno, si elimina davvero ------------------------
  await menu('Presenze');
  await p.locator('button', { hasText: 'Sblocca le presenze' }).first().click();
  await p.waitForTimeout(700);
  await menu('Membri');
  chiesto.length = 0;
  await p.locator('li', { hasText: 'Bruno' }).locator('button', { hasText: '×' }).first().click();
  await p.waitForTimeout(500);
  ok('sbloccato il giorno, l\'eliminazione passa', (await membri(p)) === 'Anna');

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
