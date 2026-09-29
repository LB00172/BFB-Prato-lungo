// Registro delle modifiche + comportamento di chi lavora offline e torna
// online. Il cloud è finto: si controlla cosa l'app spedisce e cosa fa con
// quello che riceve.
const { apri, ok, fine } = require('../lib/app');

function cloudFinto() {
  Object.defineProperty(window, 'CloudSync', {
    configurable: true,
    get() { return window.__cs; },
    set(v) {
      window.__pushes = [];
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
        pushState: (obj) => { window.__pushes.push(JSON.parse(JSON.stringify(obj))); },
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

const registro = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cambusa_registro') || '[]'));
const spese = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases') || '[]').map((x) => x.name).sort());

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: cloudFinto });

  // --- Qualche modifica locale ---
  await menu('Membri');
  for (const n of ['Lorenzo', 'Bruno']) {
    await p.fill('input[placeholder="Nome e cognome"]', n);
    await p.locator('button', { hasText: /^\+$/ }).first().click();
    await p.waitForTimeout(150);
  }
  // Il registro lo scrive un effetto di React: sotto carico può arrivare dopo.
  // Si aspetta la condizione invece di sperare in un'attesa fissa, altrimenti
  // la prova cade a caso quando la macchina è occupata.
  await p.waitForFunction(
    () => JSON.parse(localStorage.getItem('cambusa_registro') || '[]').length >= 2,
    null, { timeout: 8000 },
  );

  let reg = await registro(p);
  ok(`le modifiche locali finiscono nel registro (${reg.length})`, reg.length >= 2);
  ok('sono marcate come fatte qui', reg.every((r) => r.o === 'io'));
  ok('hanno data e ora', reg.every((r) => typeof r.at === 'number' && r.at > 0));
  ok('riguardano i membri', reg.some((r) => r.p.indexOf('m|') === 0));

  // --- Una modifica in arrivo dal cloud ---
  await p.evaluate(() => {
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    window.__remoteCb({
      members: membri, campData: {}, gear: [], settled: [], equipment: [], toBuy: [], sepDays: [],
      purchases: [{ id: 'remota1', name: 'Birra', price: 20, type: 'bevande', buyer: 'Bruno', at: Date.now() }],
      _meta: { v: 2, rev: { 'p|remota1': Date.now() }, del: {} },
    });
  });
  await p.waitForFunction(
    () => JSON.parse(localStorage.getItem('cambusa_registro') || '[]').some((r) => r.o === 'cloud'),
    null, { timeout: 8000 },
  ).catch(() => {});

  reg = await registro(p);
  ok('anche ciò che arriva dagli altri viene registrato', reg.some((r) => r.o === 'cloud'));
  ok('la voce arrivata è la spesa remota', reg.some((r) => r.o === 'cloud' && r.p === 'p|remota1'));

  // --- Il registro si vede in Impostazioni ---
  await menu('Impostazioni');
  await p.waitForTimeout(400);
  ok('la riga "Registro modifiche" c\'è ed è chiusa', /registro modifiche/i.test(await p.locator('main').innerText()));
  ok('il contenuto non è in vista finché non si apre', (await p.locator('button', { hasText: 'Svuota' }).count()) === 0);
  await p.locator('button', { hasText: 'Registro modifiche' }).first().click();
  await p.waitForTimeout(400);
  const testo = await p.locator('main').innerText();
  ok('aprendola compaiono le voci', /membri/i.test(testo) && /lista della spesa/i.test(testo));
  ok('si distingue cosa è stato fatto qui e cosa è arrivato', /qui/i.test(testo) && /sync/i.test(testo));
  ok('c\'è l\'orario', /\d{2}:\d{2}/.test(testo));

  const [scarico] = await Promise.all([
    p.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    p.locator('button', { hasText: 'Esporta il registro' }).click(),
  ]);
  ok('il registro si esporta come file: ' + (scarico ? scarico.suggestedFilename() : 'NO'),
    !!scarico && /^registro-\d{4}-\d{2}-\d{2}\.txt$/.test(scarico.suggestedFilename()));

  // --- Chi lavora offline e torna online ---
  // Si stacca la linea, si lavora, poi arriva lo stato del cloud: il lavoro
  // offline deve sopravvivere E vincere sulle versioni più vecchie.
  await menu('Lista della Spesa');
  await p.evaluate(() => { window.__connesso = false; if (window.__status) window.__status({ connected: false, status: 'idle', code: 'TEST' }); });
  await p.waitForTimeout(300);

  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  { const m = p.locator('main button', { hasText: 'Registra una spesa' }); if (await m.count()) { await m.first().click(); await p.waitForTimeout(350); } }
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Carbone');
  await p.locator('input[data-cifra]').first().fill('7');
  await p.locator('button', { hasText: /Salva/ }).first().click();
  await p.waitForTimeout(500);

  ok('offline la spesa si registra lo stesso', (await spese(p)).indexOf('Carbone') >= 0);

  // Torna la linea e arriva uno stato del cloud VECCHIO, che non conosce il
  // Carbone e ha una versione superata della Birra.
  await p.evaluate(() => {
    window.__connesso = true;
    if (window.__status) window.__status({ connected: true, status: 'connected', code: 'TEST' });
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    window.__remoteCb({
      members: membri, campData: {}, gear: [], settled: [], equipment: [], toBuy: [], sepDays: [],
      purchases: [{ id: 'remota1', name: 'Birra', price: 20, type: 'bevande', buyer: 'Bruno', at: 1 }],
      _meta: { v: 2, rev: { 'p|remota1': Date.now() - 3600000 }, del: {} },
    });
  });
  // Qui c'erano 800 millisecondi fissi, ed e' il punto in cui la prova cadeva
  // a caso da quando la suite gira in parallelo: la fusione la fa un effetto
  // di React, e con otto browser accesi puo' arrivare piu' tardi. Si aspetta
  // che le due spese ci siano davvero — e la verifica sotto resta, perche' il
  // timeout scaduto lascia l'elenco incompleto e la fa diventare rossa lo
  // stesso, con scritto cosa mancava.
  await p.waitForFunction(() => {
    const a = JSON.parse(localStorage.getItem('cambusa_purchases') || '[]').map((x) => x.name);
    return a.indexOf('Carbone') >= 0 && a.indexOf('Birra') >= 0;
  }, null, { timeout: 8000 }).catch(() => {});

  const dopo = await spese(p);
  ok(`il lavoro offline non viene cancellato (${dopo.join(', ')})`, dopo.indexOf('Carbone') >= 0 && dopo.indexOf('Birra') >= 0);

  const ultimo = await p.evaluate(() => (window.__pushes || [])[window.__pushes.length - 1] || null);
  ok('e viene ripubblicato agli altri', !!ultimo && (ultimo.purchases || []).some((x) => x.name === 'Carbone'));
  ok('la cronologia spedita non contiene date a zero',
    !!ultimo && Object.values(ultimo._meta.rev).every((v) => v > 0));

  // --- Uno stato remoto identico non deve far rimbalzare niente ---
  // Si conta da fermi: sotto carico l'invio del passo di prima puo' arrivare
  // in ritardo, e contato dopo sembrerebbe un rimbalzo che non c'e'. Si
  // aspetta che il numero di invii resti uguale per un secondo intero.
  for (let prec = -1, giri = 0; giri < 20; giri++) {
    const n = await p.evaluate(() => window.__pushes.length);
    if (n === prec) break;
    prec = n;
    await p.waitForTimeout(1000);
  }
  const primaPush = await p.evaluate(() => window.__pushes.length);
  await p.evaluate(() => {
    const u = window.__pushes[window.__pushes.length - 1];
    window.__remoteCb(JSON.parse(JSON.stringify(u)));
  });
  await p.waitForTimeout(800);
  const dopoPush = await p.evaluate(() => window.__pushes.length);
  ok(`ricevere ciò che si è appena spedito non produce un altro invio (${primaPush} → ${dopoPush})`, dopoPush === primaPush);

  // --- Un telefono con l'app VECCHIA non deve riportare indietro nulla ---
  await p.evaluate(() => {
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    // Nessun _meta: è quello che manda una versione precedente dell'app.
    window.__remoteCb({
      members: membri, campData: {}, gear: [], settled: [], equipment: [], toBuy: [], sepDays: [],
      purchases: [{ id: 'remota1', name: 'Birra', price: 20, type: 'bevande', buyer: 'Bruno', at: 1 }],
    });
  });
  // Stesso motivo di sopra: si aspetta che la Birra remota sia entrata, non
  // un numero di millisecondi. Quello che si verifica e' un'altra cosa — che
  // il Carbone NON sia sparito — ma per poterlo dire bisogna essere sicuri
  // che la fusione sia avvenuta, o si misura un momento in cui non era
  // ancora successo niente e la prova passa per il motivo sbagliato.
  await p.waitForFunction(
    () => JSON.parse(localStorage.getItem('cambusa_purchases') || '[]').some((x) => x.name === 'Birra'),
    null, { timeout: 8000 },
  ).catch(() => {});
  const finale = await spese(p);
  ok(`l'app vecchia non cancella il lavoro degli altri (${finale.join(', ')})`, finale.indexOf('Carbone') >= 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
