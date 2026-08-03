const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await (await b.newContext()).newPage();
  await p.addInitScript((h) => localStorage.setItem('cambusa_unlock', h), require('../lib/app').SBLOCCO);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const dialogs = []; p.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  const go = async (label) => { await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(350); await p.locator(`nav button:has-text("${label}")`).click(); await p.waitForTimeout(200); };

  await go('Membri');
  for (const n of ['Alice','Bruno','Carlo']) { await p.fill('input[placeholder="Nome e cognome"]', n); await p.click('button:has-text("+")'); await p.waitForTimeout(70); }

  await go('Presenze');
  // "Segna in blocco" ora è una riga richiudibile: va aperta prima.
  await p.locator('button:has-text("Segna in blocco")').click(); await p.waitForTimeout(300);
  // "Tutti a pranzo"
  await p.locator('button:has-text("Tutti a pranzo")').click(); await p.waitForTimeout(150);
  const lunchOn = await p.locator('li button.bg-\\[\\#2D392C\\]:has-text("Pranzo")').count();
  const counter1 = await p.locator('text=3 a pranzo').count();
  // Togli uno (Bruno), poi "Tutti a pranzo" di nuovo -> li segna tutti (non toglie)
  await p.locator('li:has-text("Bruno") button:has-text("Pranzo")').click(); await p.waitForTimeout(100);
  await p.locator('button:has-text("Tutti a pranzo")').click(); await p.waitForTimeout(100);
  const lunchAllAgain = await p.locator('li button.bg-\\[\\#2D392C\\]:has-text("Pranzo")').count();
  // Ora tutti segnati: nuovo tap -> toglie tutti
  await p.locator('button:has-text("Tutti a pranzo")').click(); await p.waitForTimeout(100);
  const lunchAllOff = await p.locator('li button.bg-\\[\\#2D392C\\]:has-text("Pranzo")').count();

  // Prepara ieri: naviga indietro, segna tutti a cena, torna avanti e copia
  await p.locator('button:has-text("Tutti a cena")').click(); await p.waitForTimeout(100); // oggi (11/8): tutti a cena
  await p.locator('main button:has-text("→")').click(); await p.waitForTimeout(150);      // 12/8
  await p.locator('button:has-text("Copia da ieri")').click(); await p.waitForTimeout(200);
  const copied = await p.locator('li button.bg-\\[\\#5C4A3C\\]:has-text("Cena")').count();
  const counterCopied = await p.locator('text=3 a cena').count();

  console.log('tutti a pranzo -> 3 segnati:', lunchOn === 3, '| contatore:', counter1 > 0);
  console.log('con 1 assente, ri-tap segna tutti:', lunchAllAgain === 3);
  console.log('tutti segnati, ri-tap toglie tutti:', lunchAllOff === 0);
  console.log('copia da ieri -> 3 a cena il giorno dopo:', copied === 3, '| contatore:', counterCopied > 0);
  console.log('dialoghi:', JSON.stringify(dialogs));
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
