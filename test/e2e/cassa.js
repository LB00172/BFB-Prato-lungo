// La cassa del campo, a schermo (4 ottobre).
//
// Il capogruppo scrive una quota uguale per tutti quelli che pagano (gli
// esenti restano senza), incassa una quota con un tocco, registra un
// contributo del gruppo, e scarica il rendiconto. Le cifre in cima sono
// quelle di cassa.js. Gli incassi viaggiano verso gli altri telefoni come
// il resto dei dati del campo — e, gia' che c'eravamo, anche i compiti: fino
// a oggi un compito segnato da solo non partiva finche' qualcos'altro non
// cambiava.
const fs = require('fs');
const { apri, ok, fine, attendi } = require('../lib/app');

const cloudFinto = () => {
  localStorage.setItem('cambusa_members', JSON.stringify([
    { id: 'r1', name: 'Luca', isChild: false }, { id: 'r2', name: 'Sara', isChild: false }, { id: 'c1', name: 'Capo Anna', isChild: true },
  ]));
  if (!sessionStorage.getItem('__seminato')) {
    sessionStorage.setItem('__seminato', '1');
    localStorage.setItem('cambusa_purchases', JSON.stringify([{ id: 'p1', name: 'Spesa grande', price: 120, type: 'alimentare', buyer: 'Capo Anna', at: Date.parse('2026-08-11T10:00:00') }]));
  }
  Object.defineProperty(window, 'CloudSync', {
    configurable: true,
    get() { return window.__cs; },
    set(v) {
      window.__pushes = [];
      window.__cs = Object.assign({}, v, {
        isConfigured: () => true, isConnected: () => true, savedCode: () => 'TEST',
        connect: (cfg, code, cb) => { window.__remoteCb = cb; return Promise.resolve(); },
        onStatus: (cb) => { cb({ connected: true, status: 'connected', code: 'TEST' }); },
        onReceipts: () => {}, onWeather: () => {},
        pushState: (obj) => { window.__pushes.push(JSON.parse(JSON.stringify(obj))); },
        putReceipt: () => {}, deleteReceipt: () => {},
        putArchive: () => Promise.resolve(true), listArchives: () => Promise.resolve([]),
        listSnapshots: () => Promise.resolve([]), listScores: () => Promise.resolve([]), submitScore: () => Promise.resolve(),
        watchPhotos: () => () => {}, listPhotos: () => Promise.resolve([]), archivePhotos: () => Promise.resolve(0),
        putPhoto: () => Promise.resolve(true), getPhotoFull: () => Promise.resolve(null), deletePhoto: () => Promise.resolve(true),
      });
    },
  });
};
const ultimo = (p, chiave) => p.evaluate((k) => { const x = window.__pushes[window.__pushes.length - 1]; return x ? (x[k] || []) : null; }, chiave);
const numero = async (p, sel, attr) => Number(await p.locator(sel).getAttribute(attr));

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: cloudFinto });
  await menu('Cassa');
  await attendi(p, () => !!document.querySelector('[data-scheda="cassa"]'));
  ok('nel menu c\'è la Cassa, e apre la sua scheda', true);
  ok(`all'inizio niente entrate, e le uscite sono le spese (${await numero(p, '[data-uscite]', 'data-uscite')})`,
    (await numero(p, '[data-entrate]', 'data-entrate')) === 0 && (await numero(p, '[data-uscite]', 'data-uscite')) === 120);

  // Una quota per tutti quelli che pagano.
  await p.fill('[data-cifra-tutti]', '150');
  await p.locator('button', { hasText: /^applica$/i }).click();
  await attendi(p, () => JSON.parse(localStorage.getItem('cambusa_members')).filter((m) => m.quota === 150).length === 2);
  const capo = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members')).find((m) => m.id === 'c1'));
  ok('la quota uguale va a chi paga, e l\'esente resta senza', capo.quota == null);
  ok('e la cassa dice quanto c\'è da incassare', /300,00 €/.test((await p.locator('[data-da-incassare]').innerText()).replace(/[  ]/g, ' ')));

  // Una quota in un tocco.
  const prima = await p.evaluate(() => window.__pushes.length);
  await p.locator('[data-incassa="Luca"]').click();
  await attendi(p, () => JSON.parse(localStorage.getItem('cambusa_incassi') || '[]').length === 1);
  ok('«Incassa» segna la quota che manca', (await numero(p, '[data-entrate]', 'data-entrate')) === 150
    && (await p.locator('[data-persona-cassa="Luca"] [data-pagata]').count()) === 1);
  await attendi(p, (n) => window.__pushes.length > n && (window.__pushes[window.__pushes.length - 1].incassi || []).length === 1, prima);
  ok('e l\'incasso parte verso gli altri telefoni', (await ultimo(p, 'incassi')).length === 1);

  // Un contributo del gruppo.
  await p.selectOption('[data-incasso-chi]', '');
  await p.fill('[data-incasso-da]', 'Contributo del gruppo');
  await p.fill('[data-incasso-quanto]', '80');
  await p.locator('button', { hasText: /^registra$/i }).click();
  await attendi(p, () => JSON.parse(localStorage.getItem('cambusa_incassi') || '[]').length === 2);
  ok(`entrate 230, uscite 120: avanzano 110 € (${await numero(p, '[data-saldo]', 'data-saldo')})`,
    (await numero(p, '[data-entrate]', 'data-entrate')) === 230 && (await numero(p, '[data-saldo]', 'data-saldo')) === 110);

  // Il rendiconto.
  const [scarico] = await Promise.all([p.waitForEvent('download'), p.locator('[data-rendiconto]').click()]);
  const testo = fs.readFileSync(await scarico.path(), 'utf8');
  ok(`il rendiconto è un CSV con intestazione, movimenti e totali (${scarico.suggestedFilename()})`,
    /\.csv$/.test(scarico.suggestedFilename()) && testo.charCodeAt(0) === 0xfeff
    && /Entrata;[^;]*;[^;]*;Luca;[^;]*;150,00/.test(testo) && /Uscita;2026-08-11;Spesa grande;Capo Anna;[^;]*;-120,00/.test(testo) && /;110,00\r\n/.test(testo));

  // I compiti partono da soli, come la cassa.
  await menu('Chi fa cosa');
  await p.fill('input[placeholder]', 'Prendere la legna');
  const primaC = await p.evaluate(() => window.__pushes.length);
  await p.locator('button', { hasText: /^assegna$/i }).click();
  await attendi(p, (n) => window.__pushes.length > n && (window.__pushes[window.__pushes.length - 1].compiti || []).length === 1, primaC);
  ok('un compito da solo parte verso gli altri telefoni', (await ultimo(p, 'compiti')).length === 1);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
