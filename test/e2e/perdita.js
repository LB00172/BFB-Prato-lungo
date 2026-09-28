// Perdita di dati in sincronizzazione: il freno, l'annullamento e la
// diagnostica. Riproduce il caso vero — arriva dal cloud uno stato con
// cancellazioni datate che spazzano via le presenze, mentre membri e spese
// restano identici.
const { apri, ok, fine } = require('../lib/app');

function cloudFinto() {
  Object.defineProperty(window, 'CloudSync', {
    configurable: true,
    get() { return window.__cs; },
    set(v) {
      window.__cs = Object.assign({}, v, {
        isConfigured: () => true,
        // Prima della connessione deve dire di NON essere connesso, altrimenti
        // l'app salta l'aggancio automatico e non consegna mai la callback.
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

const presenti = (page) => page.evaluate(() => {
  const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
  let n = 0;
  Object.keys(cd).forEach((g) => {
    const meals = (cd[g] && cd[g].meals) || {};
    Object.keys(meals).forEach((id) => { if (meals[id] && (meals[id].lunch || meals[id].dinner)) n++; });
  });
  return n;
});

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: cloudFinto, blocco: true });

  // --- Dati di partenza: tre membri, presenze su due giorni, una spesa ---
  await menu('Membri');
  for (const n of ['Lorenzo', 'Bruno', 'Anna']) {
    await p.fill('input[placeholder="Nome e cognome"]', n);
    await p.locator('button', { hasText: /^\+$/ }).first().click();
    await p.waitForTimeout(120);
  }
  await menu('Presenze');

  // --- Le azioni in blocco stanno chiuse e chiedono conferma ---
  ok('"Tutti a pranzo" non è in vista: la riga è chiusa', (await p.locator('button', { hasText: 'Tutti a pranzo' }).count()) === 0);
  ok('la riga mostra comunque il conteggio', /0 a pranzo · 0 a cena/.test(await p.locator('main').innerText()));
  await p.locator('button', { hasText: 'Segna in blocco' }).first().click();
  await p.waitForTimeout(300);
  ok('aprendola compaiono i tre tasti',
    (await p.locator('button', { hasText: 'Tutti a pranzo' }).count()) === 1 &&
    (await p.locator('button', { hasText: 'Tutti a cena' }).count()) === 1 &&
    (await p.locator('button', { hasText: 'Copia da ieri' }).count()) === 1);

  // Annullare la conferma non deve cambiare niente.
  p.removeAllListeners('dialog');
  const chiesto = [];
  p.on('dialog', async (d) => { chiesto.push(d.message()); await d.dismiss(); });
  await p.locator('button', { hasText: 'Tutti a pranzo' }).first().click();
  await p.waitForTimeout(400);
  ok('"Tutti a pranzo" chiede conferma', chiesto.length === 1 && /Segnare tutti e 3 i membri a PRANZO/.test(chiesto[0]));
  ok('la conferma avvisa che cambia per tutti', /anche sugli altri telefoni/.test(chiesto[0] || ''));
  ok('annullando non cambia niente', (await presenti(p)) === 0);

  // Confermando, invece, procede.
  p.removeAllListeners('dialog');
  p.on('dialog', async (d) => { chiesto.push(d.message()); await d.accept(); });
  await p.locator('button', { hasText: 'Tutti a pranzo' }).first().click();
  await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'Tutti a cena' }).first().click();
  await p.waitForTimeout(400);
  ok('confermando le presenze vengono segnate', (await presenti(p)) === 3);

  const prima = await presenti(p);
  ok(`si parte con ${prima} presenze segnate`, prima === 3);

  // --- Arriva dal cloud una cancellazione datata di TUTTE le presenze ---
  // È quello che produce un ripristino, un'importazione o un "Copia da ieri":
  // membri e spese restano identici, spariscono solo le presenze.
  const spazzate = await p.evaluate(() => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    const giorno = Object.keys(cd)[0];
    const now = Date.now() + 60000;
    const del = {};
    Object.keys((cd[giorno] || {}).meals || {}).forEach((id) => { del['c|' + giorno + '|meals|' + id] = now; });
    window.__remoteCb({
      members: membri, campData: {}, purchases: [], toBuy: [], equipment: [], gear: [], settled: [], sepDays: [],
      _meta: { v: 2, rev: {}, del },
    });
    return Object.keys(del).length;
  });
  await p.waitForTimeout(700);

  const dopo = await presenti(p);
  ok(`la cancellazione arriva davvero (${spazzate} presenze tolte, ne restano ${dopo})`, dopo === 0);
  ok('i membri NON vengono toccati', (await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]').length)) === 3);

  // --- Il freno: l'app lo dice, invece di lasciarlo scoprire ai conti ---
  const avviso = await p.locator('body').innerText();
  ok('compare l\'avviso della perdita', /appena cancellato \d+ voci/i.test(avviso));
  ok('l\'avviso dice cosa è sparito', /presenze/i.test(avviso));
  ok('e dice a che ora è successo', /\d{1,2}:\d{2}/.test(avviso));
  ok('c\'è il tasto per annullare', (await p.locator('button', { hasText: 'Annulla la sincronizzazione' }).count()) > 0);

  const scorta = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_rescue') || 'null'));
  ok('la copia di scorta è stata salvata prima di applicare', !!scorta && scorta.perse === spazzate);

  // La diagnostica deve dire COSA riporterebbe indietro, non solo quante voci.
  await menu('Impostazioni');
  await p.waitForTimeout(400);
  const box = await p.locator('main').innerText();
  ok('il riquadro della copia di scorta spiega a cosa serve', /rete di sicurezza/i.test(box));
  ok('e dice cosa tornerebbe indietro', /presenze/i.test(box) && /su tutti i telefoni/i.test(box));
  await menu('Presenze');
  await p.waitForTimeout(300);

  // --- L'annullamento riporta tutto, e lo ripubblica ---
  await p.locator('button', { hasText: 'Annulla la sincronizzazione' }).click();
  await p.waitForTimeout(800);
  const tornate = await presenti(p);
  ok(`annullando tornano le presenze (${tornate})`, tornate === 3);
  ok('l\'avviso sparisce', !/appena cancellato \d+ voci/i.test(await p.locator('body').innerText()));

  // Le voci tornate devono essere RIDATATE, altrimenti la cancellazione le
  // rimangerebbe al prossimo giro.
  const rimandato = await p.evaluate(() => {
    const pu = window.__pushed;
    if (!pu || !pu._meta) return null;
    const chiavi = Object.keys(pu._meta.rev).filter((k) => k.indexOf('|meals|') > 0);
    const lapidi = Object.keys(pu._meta.del).filter((k) => k.indexOf('|meals|') > 0);
    return { ridatate: chiavi.length, lapidi: lapidi.length };
  });
  ok(`le presenze tornate sono ridatate (${rimandato && rimandato.ridatate})`, !!rimandato && rimandato.ridatate === 3);
  ok('e le lapidi che le avevano tolte sono state rimosse', rimandato.lapidi === 0);

  // Rimandando lo stesso stato remoto, le presenze NON devono risparire.
  await p.evaluate(() => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const giorno = Object.keys(cd)[0];
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    const del = {};
    Object.keys((cd[giorno] || {}).meals || {}).forEach((id) => { del['c|' + giorno + '|meals|' + id] = Date.now() - 5000; });
    window.__remoteCb({
      members: membri, campData: {}, purchases: [], toBuy: [], equipment: [], gear: [], settled: [], sepDays: [],
      _meta: { v: 2, rev: {}, del },
    });
  });
  await p.waitForTimeout(700);
  ok('la vecchia cancellazione non se le riprende', (await presenti(p)) === 3);

  // --- Diagnostica: dice cosa è stato cancellato e quando ---
  await menu('Impostazioni');
  await p.waitForTimeout(400);
  const diag = await p.locator('main').innerText();
  ok('la diagnostica c\'è', /diagnostica sincronizzazione/i.test(diag));
  ok('conta le voci datate e le cancellazioni', /voci datate/i.test(diag) && /cancellazioni registrate/i.test(diag));

  // --- Le due sezioni "da impostare una volta" stanno chiuse e in fondo ---
  ok('"Blocca ora" non è in vista: la sezione è chiusa', (await p.locator('button', { hasText: 'Blocca ora' }).count()) === 0);
  ok('"Cancella i dati" non è in vista: la sezione è chiusa', (await p.locator('button', { hasText: 'Cancella i dati' }).count()) === 0);
  const ordine = await p.evaluate(() => {
    const t = document.querySelector('main').innerText;
    return {
      diag: t.search(/diagnostica sincronizzazione/i),
      blocco: t.search(/blocco con password/i),
      dati: t.search(/dati su questo telefono/i),
    };
  });
  ok('stanno in fondo, dopo la diagnostica', ordine.blocco > ordine.diag && ordine.dati > ordine.blocco);

  await p.locator('button', { hasText: 'Blocco con password' }).first().click();
  await p.waitForTimeout(300);
  ok('aprendo la riga compare "Blocca ora"', (await p.locator('button', { hasText: 'Blocca ora' }).count()) > 0);
  await p.locator('button', { hasText: 'Blocco con password' }).first().click();
  await p.waitForTimeout(300);
  ok('e si richiude', (await p.locator('button', { hasText: 'Blocca ora' }).count()) === 0);

  await p.locator('button', { hasText: 'Dati su questo telefono' }).first().click();
  await p.waitForTimeout(300);
  ok('aprendo la riga dei dati compare "Esporta backup"', (await p.locator('button', { hasText: 'Esporta backup' }).count()) > 0);

  // --- "Copia da ieri" non deve cancellare le presenze degli altri ---
  // Caso vero: ieri c'era solo Anna, oggi qualcun altro ha segnato Lorenzo.
  // Chi preme "Copia da ieri" si aspetta di sovrascrivere, non di CANCELLARE
  // Lorenzo su tutti i telefoni.
  const giornoStriscia = async (i) => {
    await menu('Calendario');
    await p.locator('.grid.grid-cols-7 button').nth(i).click();
    await p.waitForTimeout(250);
    await menu('Presenze');
    await p.waitForTimeout(250);
  };
  const segna = async (nome) => {
    await p.locator('li', { hasText: nome }).locator('button', { hasText: 'Pranzo' }).first().click();
    await p.waitForTimeout(250);
  };

  await giornoStriscia(4);
  await segna('Anna');
  await giornoStriscia(5);
  await segna('Lorenzo');

  const lapidiPrima = await p.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('cambusa_syncmeta') || '{}');
    return Object.keys(m.del || {}).filter((k) => k.indexOf('|meals|') > 0).length;
  });

  await p.locator('button', { hasText: 'Copia da ieri' }).first().click();
  await p.waitForTimeout(700);

  const esito = await p.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('cambusa_syncmeta') || '{}');
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const giorni = Object.keys(cd).sort();
    const oggi = cd[giorni[giorni.length - 1]] || {};
    return {
      lapidi: Object.keys(m.del || {}).filter((k) => k.indexOf('|meals|') > 0).length,
      voci: Object.keys(oggi.meals || {}).length,
    };
  });
  ok(`"Copia da ieri" non cancella le presenze di nessuno (lapidi: ${lapidiPrima} → ${esito.lapidi})`, esito.lapidi === lapidiPrima);
  ok(`chi ieri non c'era resta in elenco, azzerato (${esito.voci} voci)`, esito.voci >= 2);

  // --- Recupero del ritardo: NON è una perdita ---
  // Il caso che generava il falso allarme. Un telefono rimasto indietro si
  // riaggancia e viene a sapere di cancellazioni fatte giorni prima: le voci
  // spariscono (giustamente, non ci sono più per nessuno), ma non è un
  // disastro in corso — e un solo membro tolto porta con sé le presenze di
  // tutti i giorni, cioè da solo fa numero.
  // Si invecchia la cronologia di questo telefono e si riapre l'app: è
  // esattamente un telefono che ha lavorato giorni fa e non si è più
  // riagganciato.
  await p.evaluate(() => {
    localStorage.removeItem('cambusa_rescue');
    const m = JSON.parse(localStorage.getItem('cambusa_syncmeta') || '{}');
    const DIECI = Date.now() - 10 * 24 * 3600 * 1000;
    Object.keys(m.rev || {}).forEach((k) => { m.rev[k] = DIECI; });
    m.hi = DIECI;
    localStorage.setItem('cambusa_syncmeta', JSON.stringify(m));
  });
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await p.waitForTimeout(600);

  const vecchie = await p.evaluate(() => {
    const TRE_GIORNI = Date.now() - 3 * 24 * 3600 * 1000;
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    const via = membri[0].id;
    const del = { ['m|' + via]: TRE_GIORNI };
    Object.keys(cd).forEach((g) => {
      if ((cd[g].meals || {})[via]) del['c|' + g + '|meals|' + via] = TRE_GIORNI;
    });
    // Il cloud non ha più quel membro né le sue presenze: le tolse tre giorni fa.
    const campData = {};
    Object.keys(cd).forEach((g) => {
      campData[g] = Object.assign({}, cd[g]);
      if (campData[g].meals) {
        campData[g].meals = Object.assign({}, campData[g].meals);
        delete campData[g].meals[via];
      }
    });
    window.__remoteCb({
      members: membri.filter((m) => m.id !== via), campData,
      purchases: [], toBuy: [], equipment: [], gear: [], settled: [], sepDays: [],
      _meta: { v: 2, rev: {}, del },
    });
    return Object.keys(del).length;
  });
  await p.waitForTimeout(800);

  const testo = await p.locator('body').innerText();
  ok(`la cancellazione vecchia viene comunque applicata (${vecchie} voci)`, vecchie >= 3 &&
    (await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]').length)) === 2);
  ok('ma NON compare l\'allarme: è solo un recupero del ritardo', !/appena cancellato/i.test(testo));

  // La rete di sicurezza resta: la copia di scorta c'è lo stesso, e la
  // diagnostica spiega che la cancellazione non è di adesso.
  const scortaVecchia = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_rescue') || 'null'));
  ok('la copia di scorta viene messa da parte lo stesso', !!scortaVecchia && scortaVecchia.perse === vecchie);
  ok('e si sa quando è stata fatta la cancellazione', !!scortaVecchia && scortaVecchia.quando > 0);

  await menu('Impostazioni');
  await p.waitForTimeout(400);
  const diagVecchia = await p.locator('main').innerText();
  ok('la diagnostica dice che il telefono era indietro', /era indietro e l'ha saputo solo ora/i.test(diagVecchia));
  ok('e si può annullare comunque', (await p.locator('button', { hasText: 'Annulla quella sincronizzazione' }).count()) > 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
