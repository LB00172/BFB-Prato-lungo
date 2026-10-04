// L'informativa e la pagina di cancellazione: ci sono, si leggono, e dicono
// la verita' sull'app di oggi.
//
// Google Play le vuole tutte e due (ROADMAP § 3). Il rischio vero non e' che
// manchino: e' che l'app cambi e loro restino indietro. Un'informativa che
// descrive un bottone che si chiama in un altro modo, o un percorso che non
// esiste piu', e' peggio di nessuna informativa: rassicura a vuoto.
const fs = require('fs');
const path = require('path');
const { apri, ok, fine, URL_APP } = require('../lib/app');

require(path.resolve(__dirname, '..', '..', 'lingue.js'));
const IT = globalThis.Lingue.DIZIONARI.it;

(async () => {
  const { browser, page, menu, errori } = await apri({});

  // ---------- L'informativa ----------
  await page.goto(URL_APP + '/privacy.html', { waitUntil: 'load' });
  const testo = await page.locator('main').innerText();
  ok('l\'informativa si apre', /informativa sulla privacy/i.test(testo));
  ok('il titolare lo prende dalla configurazione', /Lorenzo Ballerini/.test(testo));
  // Il percorso descritto DEVE essere il nome vero del bottone: se qualcuno
  // lo rinomina nel dizionario, l'informativa comincia a descrivere un tasto
  // che non c'e'.
  ok(`descrive il percorso vero per cancellarsi («${IT['auth.cancellaAccount']}»)`,
    testo.toLowerCase().indexOf(IT['auth.cancellaAccount'].toLowerCase()) >= 0);
  // Un contatto che manca si dice, non si inventa.
  const manca = await page.locator('[data-campo="contatto"]').first().getAttribute('class');
  const contatto = await page.evaluate(() => (window.APP_CONFIG && window.APP_CONFIG.privacy || {}).contatto || '');
  ok(contatto ? `il contatto c'e' (${contatto})` : 'il contatto non c\'e\' ancora, e la pagina lo dice in rosso',
    contatto ? manca !== 'manca' : manca === 'manca');

  // ---------- La pagina di cancellazione ----------
  await page.goto(URL_APP + '/cancella-account.html', { waitUntil: 'load' });
  const canc = await page.locator('main').innerText();
  ok('la pagina di cancellazione si apre', /cancellare l'account/i.test(canc));
  ok('e anche lei descrive il bottone vero', canc.toLowerCase().indexOf(IT['auth.cancellaAccount'].toLowerCase()) >= 0);
  ok('e rimanda all\'informativa', (await page.locator('a[href="privacy.html"]').count()) === 1);

  // ---------- Spagnolo e francese ----------
  // Le traduzioni descrivono gli stessi tasti, coi nomi che l'app usa in
  // quella lingua: se il dizionario cambia, l'informativa tradotta deve
  // cambiare con lui.
  for (const [c, pagina, canc] of [['es', '/privacy.es.html', '/cancella-account.es.html'], ['fr', '/privacy.fr.html', '/cancella-account.fr.html']]) {
    const D = globalThis.Lingue.DIZIONARI[c];
    await page.goto(URL_APP + pagina, { waitUntil: 'load' });
    const t = await page.locator('main').innerText();
    const percorso = [D['area.impostazioni'], D['auth.titolo'], D['auth.cancellaAccount']].join(' → ');
    ok(`l'informativa in ${c} descrive il percorso vero («${percorso}»)`, t.toLowerCase().indexOf(percorso.toLowerCase()) >= 0);
    const esporta = [D['area.spesa'], D['spesa.dati'], D['backup.esporta']].join(' → ');
    ok(`e quello per esportare («${esporta}»)`, t.toLowerCase().indexOf(esporta.toLowerCase()) >= 0);
    const data = (t.match(/\d{1,2} [^\n]{0,15}2026/) || [''])[0];
    ok(`e la data nella sua lingua (${data})`, !!data && !/ottobre/.test(data));
    await page.goto(URL_APP + canc, { waitUntil: 'load' });
    ok(`la pagina di cancellazione in ${c} descrive il tasto vero`, (await page.locator('main').innerText()).toLowerCase().indexOf(D['auth.cancellaAccount'].toLowerCase()) >= 0);
  }

  // ---------- Dentro l'app ----------
  // Google la vuole raggiungibile anche dall'app, non solo dallo store.
  await page.goto(URL_APP + '/index.html', { waitUntil: 'load' });
  await page.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await menu('Impostazioni');
  ok('dalle Impostazioni si arriva all\'informativa',
    (await page.locator('main a[href="./privacy.html"]').count()) === 1);
  // In spagnolo il link porta all'informativa in spagnolo.
  await page.evaluate(() => localStorage.setItem('cambusa_lingua', 'es'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await menu(globalThis.Lingue.DIZIONARI.es['area.impostazioni']);
  await page.waitForSelector('main a[href^="./privacy"]', { timeout: 20000 });
  ok('con l\'app in spagnolo, l\'informativa è quella in spagnolo',
    (await page.locator('main a[href="./privacy.es.html"]').count()) === 1 && (await page.locator('main a[href="./privacy.html"]').count()) === 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await browser.close();
  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
