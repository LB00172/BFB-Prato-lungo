// Dotazioni personali: la lista fissa di base più le aggiunte del campo,
// che devono sopravvivere alla chiusura e riapertura dell'app.
const { apri, ok, fine } = require('../lib/app');

(async () => {
  const { browser, page: p, menu, errori } = await apri();

  await menu('Dotazioni');

  const base = p.locator('h3:has-text("Dotazione base")').locator('..').locator('li');
  const nBase = await base.count();
  // Le voci fisse sono BASE_GEAR in App.jsx: se ne aggiungi una, aggiorna qui.
  ok(`la dotazione base mostra le 5 voci fisse (viste: ${nBase})`, nBase === 5);

  await p.fill('input[placeholder="Es. costume, torcia frontale…"]', 'Torcia frontale');
  await p.click('button[aria-label="Aggiungi dotazione"]');
  await p.waitForTimeout(200);
  ok('si può aggiungere una dotazione per il campo', (await p.locator('li:has-text("Torcia frontale")').count()) > 0);

  // Spunta: serve a segnare cosa si è già messo nello zaino.
  const spunta = p.locator('li:has-text("Torcia frontale") input[type="checkbox"]');
  if (await spunta.count()) {
    await spunta.first().click();
    await p.waitForTimeout(200);
    ok('la voce si può spuntare', await spunta.first().isChecked());
  }

  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await menu('Dotazioni');
  ok('la dotazione aggiunta resta dopo la riapertura', (await p.locator('li:has-text("Torcia frontale")').count()) > 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
