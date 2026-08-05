// Modalità tecnica: gli avvisi della sincronizzazione, la diagnostica e il
// registro si vedono solo sul telefono di chi tiene i conti. Un utente
// normale non deve vedere né lapidi né "voci perse" — la rete di sicurezza
// però deve lavorare lo stesso, in silenzio, anche per lui.
const { apri, ok, fine } = require('../lib/app');

// Cloud finto (per far arrivare una cancellazione) + impronta finta della
// password tecnica: quella vera non sta nel repo, quindi la prova ne usa una
// propria ("prova123") resa non sovrascrivibile, così firebase-config.js non
// la rimpiazza al caricamento.
function finto() {
  Object.defineProperty(window, 'APP_ADMIN', {
    value: {
      salt: 'aabbccddeeff00112233445566778899',
      hash: 'c068a6b86be5c2578506da62ca2121f16bc44180fbe192660e12e91db77bc937',
      iter: 200000,
    },
    writable: false,
    configurable: false,
  });
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

(async () => {
  // Un utente NORMALE: niente modalità tecnica.
  const { browser, page: p, menu, errori } = await apri({ admin: false, initScript: finto });

  // --- 1) In Impostazioni non c'è niente di tecnico, solo la riga chiusa ---
  await menu('Impostazioni');
  await p.waitForTimeout(400);
  let testo = await p.locator('main').innerText();
  ok('l\'utente normale NON vede la diagnostica', !/diagnostica sincronizzazione/i.test(testo));
  ok('e NON vede il registro delle modifiche', !/registro modifiche/i.test(testo));
  ok('vede solo la riga "Modalità tecnica", chiusa', /modalità tecnica/i.test(testo) && /spenta/i.test(testo));

  // --- 2) Arriva una cancellazione fresca: per lui, silenzio ---
  await menu('Membri');
  for (const n of ['Lorenzo', 'Bruno', 'Anna']) {
    await p.fill('input[placeholder="Nome e cognome"]', n);
    await p.locator('button', { hasText: /^\+$/ }).first().click();
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    const now = Date.now() + 60000;
    const del = {};
    membri.forEach((m) => { del['m|' + m.id] = now; });
    window.__remoteCb({
      members: [], campData: {}, purchases: [], toBuy: [], equipment: [], gear: [], settled: [], sepDays: [],
      _meta: { v: 2, rev: {}, del },
    });
  });
  await p.waitForTimeout(700);

  ok('la cancellazione arriva davvero', (await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]').length)) === 0);
  ok('ma all\'utente normale non compare NESSUN allarme', !/appena cancellato/i.test(await p.locator('body').innerText()));
  const scorta = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_rescue') || 'null'));
  ok('la copia di scorta si salva lo stesso, in silenzio', !!scorta && scorta.perse === 3);

  // --- 3) La password sbagliata non apre niente ---
  await menu('Impostazioni');
  await p.waitForTimeout(400);
  await p.locator('button', { hasText: 'Modalità tecnica' }).first().click();
  await p.waitForTimeout(300);
  await p.fill('input[placeholder="Password tecnica"]', 'sbagliata');
  await p.locator('button', { hasText: /^Attiva$/i }).first().click();
  await p.waitForTimeout(800);
  testo = await p.locator('main').innerText();
  ok('con la password sbagliata resta tutto nascosto', /password sbagliata/i.test(testo) && !/diagnostica sincronizzazione/i.test(testo));

  // --- 4) Con quella giusta si accende, e si vede tutto ---
  await p.fill('input[placeholder="Password tecnica"]', 'prova123');
  await p.locator('button', { hasText: /^Attiva$/i }).first().click();
  await p.waitForTimeout(1000);
  testo = await p.locator('main').innerText();
  ok('con la password giusta la modalità si accende', /attiva/i.test(testo));
  ok('compare la diagnostica', /diagnostica sincronizzazione/i.test(testo));
  ok('compare il registro', /registro modifiche/i.test(testo));
  ok('e l\'allarme sulla cancellazione di poco fa ORA si vede', /appena cancellato \d+ voci/i.test(await p.locator('body').innerText()));

  // --- 5) La scelta sopravvive alla chiusura dell'app ---
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await menu('Impostazioni');
  await p.waitForTimeout(400);
  ok('riaprendo l\'app la modalità tecnica è ancora attiva', /diagnostica sincronizzazione/i.test(await p.locator('main').innerText()));

  // --- 6) E si spegne ---
  await p.locator('button', { hasText: 'Modalità tecnica' }).first().click();
  await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'Spegni la modalità tecnica' }).first().click();
  await p.waitForTimeout(500);
  testo = await p.locator('main').innerText();
  ok('spegnendola, la diagnostica sparisce di nuovo', !/diagnostica sincronizzazione/i.test(testo));

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
