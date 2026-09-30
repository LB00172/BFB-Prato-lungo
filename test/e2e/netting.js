const { campoDiProva } = require('../lib/app');
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  // Misura di un telefono: senza, Chromium apre a 1280 px e l'app si mette
  // nella forma da computer, senza il tasto del menu.
  const p = await (await b.newContext({ viewport: { width: 390, height: 840 } })).newPage();
  await p.addInitScript((h) => localStorage.setItem('cambusa_unlock', h), require('../lib/app').SBLOCCO);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(...campoDiProva());
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  const go = async (label) => { await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(350); await p.locator(`nav button:has-text("${label}")`).click(); await p.waitForTimeout(200); };

  await go('Membri');
  for (const n of ['Alice','Bruno','Carlo']) { await p.fill('input[placeholder="Nome e cognome"]', n); await p.click('button:has-text("+")'); await p.waitForTimeout(70); }
  // Tutti e 3 mangiano 1 pasto (Alice INCLUSA)
  await go('Presenze');
  for (const n of ['Alice','Bruno','Carlo']) await p.locator(`li:has-text("${n}") button:has-text("Pranzo")`).click();
  // Alice compra 90 di cibo
  await go('Lista della Spesa');
  await p.locator('main button:has-text("Acquistato")').click(); await p.waitForTimeout(200);
  // la maschera manuale ora parte chiusa: la apro
  {
    const b = p.locator('main button', { hasText: 'Registra una spesa' });
    if (await b.count()) { await b.first().click(); await p.waitForTimeout(350); }
  }
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Cambusa');
  await p.locator('[data-foglio-spesa]').locator('select').first().selectOption({ label: 'Alice' });
  await p.fill('input[data-cifra]', '90');
  await p.click('button:has-text("Salva")'); await p.waitForTimeout(150);

  await go('Spese Totali');
  await p.locator('main button:has-text("Quote")').click(); await p.waitForTimeout(150);
  const quote = (await p.locator('h3:has-text("Quote cassa comune")').locator('..').innerText()).replace(/\s+/g,' ');
  await p.locator('main button:has-text("Saldi")').click(); await p.waitForTimeout(150);
  const saldo = (await p.locator('h3:has-text("Saldo finale")').locator('..').innerText()).replace(/\s+/g,' ');

  console.log('QUOTE (quanto deve ciascuno):', quote);
  console.log('-> atteso: Alice 30, Bruno 30, Carlo 30 (Alice PAGA la sua quota come gli altri)');
  console.log('SALDO:', saldo);
  console.log('-> atteso: Alice anticipa 90 deve 30 = riceve 60; Bruno/Carlo danno 30; Bruno->Alice 30, Carlo->Alice 30');
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
