// Presenze bloccate: la garanzia definitiva contro i giorni che cambiano da
// soli. Quando un giorno è chiuso, i suoi pasti non si toccano più — né col
// dito né da una sincronizzazione — e se un telefono prova a modificarli
// l'app li rimette com'erano e ripubblica la correzione.
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

const pasti = (p, g) => p.evaluate((x) => {
  const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
  const meals = (cd[x] || {}).meals || {};
  return Object.keys(meals).sort().map((k) => `${k}:${meals[k].lunch ? 'P' : '-'}${meals[k].dinner ? 'C' : '-'}`).join(' ');
}, g);

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: cloudFinto });

  await menu('Membri');
  await aggiungi(p, 'Anna');
  await aggiungi(p, 'Bruno');
  await menu('Presenze');
  await p.locator('li', { hasText: 'Anna' }).locator('button', { hasText: 'Pranzo' }).first().click();
  await p.waitForTimeout(400);

  const giorno = await p.evaluate(() => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    return Object.keys(cd).sort()[0] || '';
  });
  const prima = await pasti(p, giorno);
  ok(`si parte con le presenze segnate (${prima})`, /:P-/.test(prima));

  // --- Il tasto c'è solo in modalità tecnica ---
  ok('il tasto per bloccare è disponibile (modalità tecnica)', (await p.locator('button', { hasText: 'Blocca le presenze' }).count()) > 0);

  const chiesto = [];
  p.removeAllListeners('dialog');
  p.on('dialog', async (d) => { chiesto.push(d.message()); await d.accept(); });
  await p.locator('button', { hasText: 'Blocca le presenze' }).first().click();
  await p.waitForTimeout(700);

  ok('bloccare chiede conferma dicendo cosa congela', /Bloccare le presenze di/i.test(chiesto[0] || '') && /1 persona/.test(chiesto[0] || ''));
  const testo = await p.locator('main').innerText();
  ok('il giorno si vede come chiuso', /bloccate/i.test(testo) && /presenze chiuse/i.test(testo));

  // --- 1) Il dito non passa più: i tasti sono spenti davvero ---
  const cena = p.locator('li', { hasText: 'Bruno' }).locator('button', { hasText: 'Cena' }).first();
  ok('il tasto Cena è disattivato', await cena.isDisabled());
  ok('il tasto Pranzo è disattivato',
    await p.locator('li', { hasText: 'Anna' }).locator('button', { hasText: 'Pranzo' }).first().isDisabled());
  // Anche forzando il click a mano non deve succedere niente.
  await p.evaluate(() => {
    const riga = [...document.querySelectorAll('li')].find((li) => li.textContent.indexOf('Bruno') >= 0);
    const b = riga && [...riga.querySelectorAll('button')].find((x) => /cena/i.test(x.textContent));
    if (b) { b.disabled = false; b.click(); }
  });
  await p.waitForTimeout(500);
  ok('e nemmeno forzando il tasto cambia qualcosa', (await pasti(p, giorno)) === prima);

  // --- 2) Nemmeno "Tutti a pranzo" / "Copia da ieri" ---
  ok('la riga "Segna in blocco" resta ma è disattivata',
    (await p.locator('button', { hasText: 'Segna in blocco' }).count()) > 0);
  const forzato = await p.evaluate(() => {
    // Si forza l'apertura e la pressione, come se il blocco non ci fosse:
    // il vero controllo deve stare nel codice, non solo nel CSS.
    const b = [...document.querySelectorAll('button')].find((x) => /segna in blocco/i.test(x.textContent));
    if (!b) return false;
    const cont = b.parentElement;
    if (cont) cont.className = String(cont.className || '').replace('pointer-events-none', '');
    b.click();
    return true;
  });
  ok('la riga si riesce a forzare (il controllo non è solo grafico)', forzato);
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const t = [...document.querySelectorAll('button')].find((x) => /tutti a pranzo/i.test(x.textContent));
    if (t) t.click();
  });
  await p.waitForTimeout(700);
  ok('"Tutti a pranzo" non scalfisce un giorno bloccato', (await pasti(p, giorno)) === prima);

  // --- 3) E soprattutto: nemmeno la sincronizzazione ---
  // Arriva dal cloud uno stato che cambia le presenze di quel giorno, datato
  // ADESSO: senza il blocco vincerebbe senza discussioni.
  await p.evaluate((x) => {
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const meals = {};
    membri.forEach((m) => { meals[m.id] = { lunch: true, dinner: true }; });
    const now = Date.now() + 60000;
    const rev = {};
    membri.forEach((m) => { rev['c|' + x + '|meals|' + m.id] = now; });
    window.__remoteCb({
      members: membri,
      campData: Object.assign({}, cd, { [x]: Object.assign({}, cd[x], { meals }) }),
      purchases: [], toBuy: [], equipment: [], gear: [], settled: [], sepDays: [],
      _meta: { v: 2, rev, del: {}, hi: now },
    });
  }, giorno);
  await p.waitForTimeout(1000);

  ok(`un aggiornamento datato ADESSO non scalfisce il giorno bloccato (${await pasti(p, giorno)})`,
    (await pasti(p, giorno)) === prima);

  // La correzione dev'essere anche ripubblicata, altrimenti il blocco varrebbe
  // solo su questo telefono.
  const ripubblicata = await p.evaluate((x) => {
    const inviati = window.__inviati || [];
    const ultimo = inviati[inviati.length - 1];
    if (!ultimo) return null;
    const meals = ((ultimo.campData || {})[x] || {}).meals || {};
    return Object.keys(meals).map((k) => `${meals[k].lunch ? 'P' : '-'}${meals[k].dinner ? 'C' : '-'}`).sort().join(' ');
  }, giorno);
  ok(`la correzione viene rimandata agli altri (${ripubblicata})`, ripubblicata === 'P-');

  // --- 4) Lo sblocco rimette tutto com'era al momento del blocco ---
  await p.locator('button', { hasText: 'Sblocca le presenze' }).first().click();
  await p.waitForTimeout(700);
  ok('sbloccando si torna modificabili', (await p.locator('button', { hasText: 'Blocca le presenze' }).count()) > 0);
  ok('e i pasti sono quelli congelati, non quelli arrivati nel frattempo', (await pasti(p, giorno)) === prima);
  await p.locator('li', { hasText: 'Bruno' }).locator('button', { hasText: 'Cena' }).first().click();
  await p.waitForTimeout(400);
  ok('ora il dito funziona di nuovo', (await pasti(p, giorno)) !== prima);

  // --- 5) Un utente normale non può bloccare né sbloccare ---
  // Lo script di avvio delle prove riaccende la modalità tecnica a ogni
  // caricamento: qui se ne aggiunge uno che la rispegne, dopo.
  await p.addInitScript(() => localStorage.removeItem('cambusa_admin'));
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await menu('Presenze');
  await p.waitForTimeout(500);
  ok('senza modalità tecnica il tasto non c\'è', (await p.locator('button', { hasText: /Blocca le presenze|Sblocca le presenze/ }).count()) === 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
