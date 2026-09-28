const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 400, height: 900 } });
  await p.addInitScript((h) => localStorage.setItem('cambusa_unlock', h), require('../lib/app').SBLOCCO);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const dialogs = []; p.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
  await p.addInitScript(...require('../lib/app').campoDiProva());
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(350);
  const menuHasGame = await p.locator('nav button:has-text("Aiuta Bandy")').count();
  await p.locator('nav button:has-text("Aiuta Bandy")').click(); await p.waitForTimeout(300);

  // 1) senza nome non deve partire
  await p.click('button:has-text("Gioca")'); await p.waitForTimeout(200);
  const blockedNoName = dialogs.some(d => /nome/i.test(d));
  const stillOnForm = await p.locator('button:has-text("Gioca")').count();

  // 2) col nome parte
  await p.fill('input[placeholder="Come ti chiami?"]', 'Lorenzo');
  await p.click('button:has-text("Gioca")'); await p.waitForTimeout(400);
  const canvas = await p.locator('canvas').count();
  const hud = await p.locator('text=Lorenzo').count();

  // 3) il gioco gira: catturo due frame e verifico che cambino (serpente in movimento)
  const frame = async () => await p.evaluate(() => document.querySelector('canvas').toDataURL().slice(-120));
  const f1 = await frame(); await p.waitForTimeout(700); const f2 = await frame();
  const moving = f1 !== f2;

  // 4) comandi: freccia sinistra non deve crashare
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250);
  await p.locator('button[aria-label="Giù"]').click(); await p.waitForTimeout(250);

  // 5) game over: vado dritto contro il muro
  await p.locator('button[aria-label="Su"]').click();
  await p.waitForTimeout(4000);
  const gameOver = await p.locator('text=Bandy è scappato').count();
  const scoreShown = await p.locator('canvas').isVisible();

  // 6) uscita e persistenza nome
  if (gameOver) { await p.click('button:has-text("Chiudi")'); await p.waitForTimeout(300); }
  const backOnForm = await p.locator('button:has-text("Gioca")').count();
  const nameKept = await p.locator('input[placeholder="Come ti chiami?"]').inputValue();

  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','gioco.png') });
  console.log('voce menu presente:', menuHasGame > 0);
  console.log('blocco senza nome:', blockedNoName, '| resta sul form:', stillOnForm > 0);
  console.log('canvas attivo:', canvas > 0, '| HUD col nome:', hud > 0);
  console.log('il gioco anima (frame diversi):', moving);
  console.log('game over dopo muro:', gameOver > 0);
  console.log('ritorno al form:', backOnForm > 0, '| nome ricordato:', nameKept);
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
