// Calendario: note libere del giorno (distinte dal menù) e riga "Conto
// separato" che si apre solo quando serve.
const { apri, ok, fine } = require('../lib/app');

(async () => {
  const { browser, page: p, menu, errori } = await apri();

  await menu('Calendario');

  // ---- Conto separato: contratto di suo ----
  const riga = p.locator('button', { hasText: 'Conto separato' }).first();
  ok('la riga "Conto separato" c\'è', (await riga.count()) > 0);
  ok('parte chiusa', (await p.locator('main input[type="checkbox"]').count()) === 0);
  ok('la riga dice subito quanti giorni sono', /nessun giorno/.test(await riga.innerText()));

  await riga.click();
  await p.waitForTimeout(300);
  const spunte = p.locator('main input[type="checkbox"]');
  ok('aprendola compaiono i sette giorni da spuntare', (await spunte.count()) === 7);

  await spunte.nth(2).click();
  await p.waitForTimeout(300);
  ok('spuntare un giorno lo registra', (await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_sepdays') || '[]').length)) === 1);
  ok('il conteggio compare sulla riga anche da chiusa', /1 giorno/.test(await riga.innerText()));

  await riga.click();
  await p.waitForTimeout(300);
  ok('si richiude', (await p.locator('main input[type="checkbox"]').count()) === 0);

  // ---- Note del giorno ----
  const note = p.locator('textarea').first();
  // innerText restituisce il testo COME È DISEGNATO: l'etichetta ha la classe
  // uppercase, quindi arriva in maiuscolo.
  ok('la sezione "Note del giorno" c\'è', /note del giorno/i.test(await p.locator('main').innerText()));
  await note.fill('Legna da prendere al bosco');
  await p.waitForTimeout(400);
  ok('le note vengono salvate', /Legna da prendere/.test(await p.evaluate(() => localStorage.getItem('cambusa_camp_data') || '')));
  ok('la sezione segnala che sono scritte', /✔ scritte/.test(await p.locator('main').innerText()));

  // ---- Le note NON sono il menù: due campi distinti ----
  await menu('Menù');
  const menuBox = p.locator('textarea.lined-paper');
  await menuBox.fill('Pranzo: pasta al pomodoro');
  await p.waitForTimeout(400);
  await menu('Calendario');
  await p.waitForTimeout(300);
  ok('scrivere il menù non cancella le note del giorno',
    (await p.locator('textarea').first().inputValue()) === 'Legna da prendere al bosco');
  await menu('Menù');
  await p.waitForTimeout(300);
  ok('e le note non cancellano il menù',
    (await p.locator('textarea.lined-paper').inputValue()) === 'Pranzo: pasta al pomodoro');

  // ---- Sopravvivono alla riapertura dell'app ----
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await menu('Calendario');
  ok('le note restano dopo la riapertura',
    (await p.locator('textarea').first().inputValue()) === 'Legna da prendere al bosco');
  ok('il conto separato resta chiuso alla riapertura', (await p.locator('main input[type="checkbox"]').count()) === 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
