// Due controlli che non riguardano la fusione ma il mondo reale.
//
// 1) OROLOGI. Il confronto fra due voci dipende SOLO dalle date, ed è la
//    condizione perché tutti i telefoni decidano allo stesso modo. Il prezzo è
//    che un telefono con la data avanti vince ogni confronto, per sempre,
//    anche con dati vecchi. Non si può limare le date in arrivo senza spaccare
//    l'accordo fra i telefoni: l'unica cosa giusta è accorgersene e dirlo.
//
// 2) PREZZI. L'errore più probabile del campo non è nella sincronizzazione: è
//    un 870 digitato al posto di 87. Non fa fallire niente, si spalma sulle
//    quote di tutti e non si nota più.
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
        pushState: () => {},
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
  await p.waitForTimeout(180);
};

const spesa = async (p, nome, prezzo) => {
  const b = p.locator('main button', { hasText: 'Registra una spesa' });
  if (await b.count()) { await b.first().click(); await p.waitForTimeout(280); }
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', nome);
  await p.locator('input[data-cifra]').first().fill(String(prezzo));
  await p.locator('button', { hasText: /Salva/ }).first().click();
  await p.waitForTimeout(420);
};

const quante = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases') || '[]').length);
const totale = (p) => p.evaluate(() => (window.__totali ? Math.round(window.__totali.overallTotal * 100) : -1));

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: cloudFinto });
  const chiesto = [];
  let rispondi = true;
  p.removeAllListeners('dialog');
  p.on('dialog', async (d) => { chiesto.push(d.message()); if (rispondi) await d.accept(); else await d.dismiss(); });

  // ============ 1) OROLOGIO AVANTI ============
  await menu('Membri');
  await aggiungi(p, 'Anna');
  await p.waitForTimeout(400);

  ok('all\'inizio nessun avviso sugli orologi', !/orologio avanti/i.test(await p.locator('body').innerText()));

  // Arriva uno stato con date di un anno nel futuro: qualcuno ha la data sbagliata.
  await p.evaluate(() => {
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    const futuro = Date.now() + 365 * 24 * 3600 * 1000;
    window.__remoteCb({
      members: membri.concat([{ id: 'altro', name: 'Bruno', isChild: false }]),
      campData: {}, purchases: [], toBuy: [], equipment: [], gear: [], settled: [], sepDays: [], freeDays: [], blocchi: [],
      _meta: { v: 2, rev: { 'm|altro': futuro }, del: {}, hi: futuro },
    });
  });
  await p.waitForTimeout(800);

  const avviso = await p.locator('body').innerText();
  ok('l\'app si accorge che un telefono ha l\'orologio avanti', /orologio avanti di 36[0-9] giorni/i.test(avviso));
  ok('e spiega la conseguenza vera: le sue modifiche vincono comunque',
    /vincono su tutte le altre/i.test(avviso) && /scartate/i.test(avviso));
  ok('e dice cosa fare', /chi ha la data sbagliata/i.test(avviso));

  // L'avviso resta anche dopo aver chiuso e riaperto: è un problema che non
  // si risolve da solo, e sparire sarebbe peggio che non comparire.
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await p.waitForTimeout(500);
  ok('l\'avviso sopravvive alla riapertura', /orologio avanti/i.test(await p.locator('body').innerText()));

  await p.locator('button', { hasText: 'Sistemato' }).first().click();
  await p.waitForTimeout(400);
  ok('e si può chiudere quando è stato sistemato', !/orologio avanti/i.test(await p.locator('body').innerText()));

  // Un utente normale non lo vede: la cosa da fare è chiedere in giro, e la fa
  // chi tiene i conti.
  await p.addInitScript(() => localStorage.removeItem('cambusa_admin'));
  await p.evaluate(() => localStorage.setItem('cambusa_orologio', JSON.stringify({ avanti: 400 * 86400000, at: Date.now() })));
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await p.waitForTimeout(400);
  ok('senza modalità tecnica l\'avviso non compare', !/orologio avanti/i.test(await p.locator('body').innerText()));
  await p.evaluate(() => { localStorage.removeItem('cambusa_orologio'); localStorage.setItem('cambusa_admin', '1'); });
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });

  // ============ 2) PREZZI FUORI SCALA ============
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);

  // Spese normali: non devono generare nessuna domanda.
  chiesto.length = 0;
  for (const [n, v] of [['Pasta', 24.5], ['Pane', 12], ['Acqua', 18.3], ['Carne', 46.2]]) await spesa(p, n, v);
  ok(`quattro spese normali non fanno nessuna domanda (${await quante(p)} registrate)`,
    chiesto.length === 0 && (await quante(p)) === 4);

  // Una cifra fuori scala: dieci volte la mediana e sopra i 300 €.
  chiesto.length = 0;
  rispondi = false;                      // prima si annulla
  await spesa(p, 'Spesa grossa', 870);
  ok('una cifra fuori scala fa scattare la domanda', chiesto.length === 1);
  ok('la domanda dice quanto stanno le altre spese', /intorno a \d/.test(chiesto[0] || ''));
  ok('e spiega perché è pericoloso', /si spalma sulle quote/i.test(chiesto[0] || ''));
  ok(`annullando la spesa NON entra (${await quante(p)})`, (await quante(p)) === 4);

  const primaDelSi = await totale(p);
  chiesto.length = 0;
  rispondi = true;                       // stavolta è davvero giusta
  await spesa(p, 'Spesa grossa', 870);
  ok(`confermando entra (${await quante(p)} spese)`, (await quante(p)) === 5);
  ok(`e il totale cresce di 870 € (${(await totale(p) - primaDelSi) / 100})`, (await totale(p)) - primaDelSi === 87000);

  // Sopra i mille scatta comunque, anche senza altre spese con cui confrontare.
  await p.evaluate(() => localStorage.setItem('cambusa_purchases', '[]'));
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  chiesto.length = 0;
  rispondi = false;
  await spesa(p, 'Prima spesa', 1500);
  ok('sopra i mille euro chiede conferma anche come prima spesa', chiesto.length === 1);
  ok('e suggerisce la virgola fuori posto', /virgola fuori posto/i.test(chiesto[0] || ''));
  ok('annullando non entra', (await quante(p)) === 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
