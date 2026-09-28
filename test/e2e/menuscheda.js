// Il Menù è una scheda a sé ma condivide il giorno con il Calendario.
const { campoDiProva } = require('../lib/app');
const { chromium } = require('playwright-core');
// L'impronta del blocco si LEGGE da firebase-config.js (test/lib/app.js).
// Ricopiata qui, il giorno in cui cambia la password del campo questa prova
// diventa rossa per un motivo che non c'entra niente con quello che prova —
// e' successo davvero, a diciannove prove insieme.
const H = require('../lib/app').SBLOCCO;
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 820 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.addInitScript((h) => {
    localStorage.setItem('cambusa_unlock', h);
    localStorage.setItem('cambusa_sync_optout', '1');
    localStorage.setItem('cambusa_install_hint_off', '1');
    localStorage.setItem('cambusa_members', JSON.stringify([{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bruno' }]));
    localStorage.setItem('cambusa_camp_data', JSON.stringify({
      '2026-08-11': { note: '', guestsNames: '', meals: { a: { lunch: true, dinner: true }, b: { lunch: true, dinner: false } } },
      '2026-08-13': { note: 'Cena: porchetta\nPatate', guestsNames: '', meals: {} },
    }));
  }, H);
  const menu = async (voce) => {
    await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(280);
    await p.locator('nav button', { hasText: voce }).first().click(); await p.waitForTimeout(300);
  };
  await p.addInitScript(...campoDiProva());
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });

  const voci = await p.evaluate(() => Array.from(document.querySelectorAll('nav button')).map(b => b.innerText.trim()));
  console.log('voci di menu:', JSON.stringify(voci));

  // 1. In Calendario scelgo il 13 agosto
  await menu('Calendario');
  // Ci si sposta finché la striscia mostra il 13 agosto. (Prima si guardava la
  // checkbox del conto separato, che ora sta dentro una riga chiusa.)
  const haIl13 = async () => (await p.locator('.grid.grid-cols-7 button').filter({ hasText: /(^|\D)13(\D|$)/ }).count()) > 0;
  for (let i = 0; i < 8 && !(await haIl13()); i++) {
    await p.locator('button', { hasText: '→' }).first().click(); await p.waitForTimeout(200);
  }
  await p.locator('.grid.grid-cols-7 button', { hasText: '13' }).first().click();
  await p.waitForTimeout(300);
  const titoloCal = await p.locator('main h3').first().innerText();
  console.log('giorno scelto in Calendario:', titoloCal);
  console.log('scorciatoia al Menù presente:', (await p.locator('main button', { hasText: 'Menù del giorno' }).count()) > 0 ? 'OK' : 'PROBLEMA');
  const stato = await p.locator('main button', { hasText: 'Menù del giorno' }).first().innerText();
  console.log('la scorciatoia dice se è scritto:', /già scritto/i.test(stato) ? 'OK (' + stato.trim() + ')' : 'PROBLEMA (' + stato.trim() + ')');

  // 2. Passo a Menù dalla scorciatoia: deve arrivare sullo stesso giorno
  await p.locator('main button', { hasText: 'Menù del giorno' }).first().click();
  await p.waitForTimeout(400);
  const titoloMenu = await p.locator('main h3').first().innerText();
  console.log('la scheda Menù si apre su:', titoloMenu, '->', /13 agosto/.test(titoloMenu) ? 'OK: stesso giorno' : 'PROBLEMA');
  const testo = await p.locator('textarea').first().inputValue();
  console.log('menù del 13 già presente:', JSON.stringify(testo), '->', testo.indexOf('porchetta') >= 0 ? 'OK' : 'PROBLEMA');
  console.log('striscia dei giorni anche qui:', (await p.locator('.grid.grid-cols-7 button').count()) === 7 ? 'OK' : 'PROBLEMA');

  // 3. Cambio giorno DALLA scheda Menù e torno in Calendario
  await p.locator('.grid.grid-cols-7 button', { hasText: '11' }).first().click();
  await p.waitForTimeout(300);
  const cucina = await p.locator('main').innerText();
  console.log('mostra i pasti da preparare:', /2\s+a pranzo/.test(cucina.replace(/\s+/g, ' ')) ? 'OK' : 'PROBLEMA');
  await p.locator('textarea').first().fill('Pranzo: pasta\nCena: zuppa');
  await p.waitForTimeout(400);
  await menu('Calendario');
  const titoloCal2 = await p.locator('main h3').first().innerText();
  console.log('il Calendario segue il giorno scelto nel Menù:', titoloCal2, '->', /11 agosto/.test(titoloCal2) ? 'OK' : 'PROBLEMA');

  // 4. Elenco dei giorni del campo
  await menu('Menù');
  const elenco = await p.locator('h3:has-text("Giorni del campo")').locator('xpath=../..').innerText();
  console.log('elenco giorni del campo:', /mar 11/.test(elenco) && /gio 13/.test(elenco) ? 'OK' : 'PROBLEMA');
  console.log('anteprima del menù scritto:', /Pranzo: pasta/.test(elenco) && /Cena: porchetta/.test(elenco) ? 'OK' : 'PROBLEMA');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-scheda-menu.png'), fullPage: true });
  console.log('nessuno sbordamento:', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth) ? 'OK' : 'PROBLEMA');
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
