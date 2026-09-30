// Verifica la fusione DENTRO l'app vera: si finge il cloud e si consegna
// all'app lo stato di un secondo telefono.
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  await p.addInitScript((h) => localStorage.setItem('cambusa_unlock', h), require('../lib/app').SBLOCCO);
  await p.addInitScript((g) => localStorage.setItem('cambusa_menu_gruppi', g), require('../lib/app').TUTTI_I_GRUPPI);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());

  // Finto cloud: cattura la callback dei dati remoti e ciò che l'app spedisce.
  await p.addInitScript(() => {
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
            if (window.__status) window.__status({ connected: true, status: 'connected', code, lastSync: Date.now() });
            return Promise.resolve();
          },
          onStatus: (cb) => { window.__status = cb; cb({ connected: true, status: 'connected', code: 'TEST' }); },
          onReceipts: () => {},
          pushState: (obj) => { window.__pushed = obj; },
          putReceipt: () => {}, deleteReceipt: () => {},
          putArchive: () => Promise.resolve(true),
          listArchives: () => Promise.resolve([]),
          listSnapshots: () => Promise.resolve([]),
          listScores: () => Promise.resolve([]),
          submitScore: () => Promise.resolve(),
        });
      },
    });
  });

  const menu = async (voce) => {
    await p.click('button[aria-label="Menu"]');
    await p.waitForTimeout(250);
    await p.locator('nav button', { hasText: voce }).first().click();
    await p.waitForTimeout(250);
  };

  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });

  // --- Questo telefono registra una spesa ---
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  { const b = p.locator('main button', { hasText: 'Registra una spesa' }); if (await b.count()) { await b.first().click(); await p.waitForTimeout(350); } }
  await p.waitForTimeout(200);
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Pasta');
  // l'acquirente ora è una tendina alimentata dai membri (qui non ce ne sono ancora)
  await p.locator('input[data-cifra]').first().fill('30');
  await p.locator('button', { hasText: /Salva/ }).first().click();
  await p.waitForTimeout(400);

  const pushed = await p.evaluate(() => window.__pushed || null);
  console.log('lo stato inviato porta la cronologia:', !!(pushed && pushed._meta && pushed._meta.v === 2),
    '| voci datate:', pushed && pushed._meta ? Object.keys(pushed._meta.rev).length : 0);

  // --- Arriva l'altro telefono, che offline aveva registrato un'altra spesa ---
  const res1 = await p.evaluate(() => {
    const now = Date.now();
    const remote = {
      members: [], campData: {}, gear: [], settled: [], equipment: [], toBuy: [],
      purchases: [{ id: 'remoto1', name: 'Birra', price: 20, type: 'bevande', buyer: 'Bruno', at: now }],
      _meta: { v: 2, rev: { 'p|remoto1': now }, del: {} },
    };
    window.__remoteCb(remote);
    return null;
  });
  await p.waitForTimeout(500);
  const dopoUnione = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases') || '[]').map((x) => x.name).sort());
  console.log('spese dopo la fusione:', JSON.stringify(dopoUnione), '->', dopoUnione.length === 2 ? 'OK: nessuna persa' : 'PROBLEMA');

  const rimandato = await p.evaluate(() => (window.__pushed && window.__pushed.purchases || []).map((x) => x.name).sort());
  console.log('rimandato al cloud:', JSON.stringify(rimandato), '->', rimandato.length === 2 ? 'OK: anche l\'altro le riceve' : 'PROBLEMA');

  // --- Il vecchio comportamento avrebbe cancellato: verifica che NON accada ---
  await p.evaluate(() => {
    const vecchio = { members: [], campData: {}, gear: [], settled: [], equipment: [], toBuy: [], purchases: [], _meta: { v: 2, rev: {}, del: {} } };
    window.__remoteCb(vecchio);
  });
  await p.waitForTimeout(400);
  const dopoVuoto = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases') || '[]').length);
  console.log('un telefono con stato vuoto NON cancella:', dopoVuoto === 2 ? 'OK (' + dopoVuoto + ' spese)' : 'PROBLEMA (' + dopoVuoto + ')');

  // --- Ma una cancellazione vera (datata) deve passare ---
  await p.evaluate(() => {
    const now = Date.now() + 1000;
    const canc = { members: [], campData: {}, gear: [], settled: [], equipment: [], toBuy: [], purchases: [], _meta: { v: 2, rev: {}, del: { 'p|remoto1': now } } };
    window.__remoteCb(canc);
  });
  await p.waitForTimeout(400);
  const dopoCanc = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases') || '[]').map((x) => x.name));
  console.log('cancellazione vera propagata:', JSON.stringify(dopoCanc), '->', dopoCanc.length === 1 && dopoCanc[0] === 'Pasta' ? 'OK' : 'PROBLEMA');

  // --- Presenze dello stesso giorno da due telefoni ---
  await menu('Membri');
  for (const n of ['Lorenzo', 'Bruno']) {
    await p.fill('input[placeholder="Nome e cognome"]', n);
    await p.locator('button', { hasText: /^\+$/ }).first().click();
    await p.waitForTimeout(150);
  }
  await menu('Presenze');
  // "Segna in blocco" ora è una riga richiudibile: va aperta prima.
  { const b = p.locator('button', { hasText: 'Segna in blocco' }); if (await b.count()) { await b.first().click(); await p.waitForTimeout(300); } }
  await p.locator('button', { hasText: 'Tutti a pranzo' }).first().click();
  await p.waitForTimeout(400);
  const giorno = await p.evaluate(() => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    return Object.keys(cd)[0];
  });
  await p.evaluate((g) => {
    const now = Date.now() + 2000;
    const remote = {
      members: [], gear: [], settled: [], equipment: [], toBuy: [], purchases: [],
      campData: { [g]: { meals: { altro: { lunch: false, dinner: true } }, notes: 'legna dal bosco' } },
      _meta: { v: 2, rev: { ['c|' + g + '|meals|altro']: now, ['c|' + g + '|f|notes']: now }, del: {} },
    };
    window.__remoteCb(remote);
  }, giorno);
  await p.waitForTimeout(400);
  const presenze = await p.evaluate((g) => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const d = cd[g] || {};
    return { pasti: Object.keys(d.meals || {}).length, note: d.notes || '' };
  }, giorno);
  console.log('presenze fuse:', presenze.pasti, 'persone | nota arrivata:', presenze.note || 'NESSUNA',
    '->', presenze.pasti === 3 && presenze.note === 'legna dal bosco' ? 'OK' : 'PROBLEMA');

  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
