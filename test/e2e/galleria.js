const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await (await b.newContext()).newPage();
  await p.addInitScript(() => localStorage.setItem('cambusa_unlock', '432631a6d9164150bff2cef2afebf83fc36f43fe04c658bac55ec89dbeda8a14'));
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', async d => { await d.accept(); });
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  const go = async (label) => { await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(350); await p.locator(`nav button:has-text("${label}")`).click(); await p.waitForTimeout(250); };

  // 1) nessun input deve forzare la fotocamera
  const inputs = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('input[type=file]').forEach(i => out.push({ accept: i.accept, capture: i.getAttribute('capture') }));
    return out;
  });

  // 2) i quattro punti: lista da acquistare, form manuale, cronologia, attrezzatura
  await go('Lista della Spesa');
  await p.fill('input[placeholder="Cosa serve…"]', 'Pane');
  await p.click('button[aria-label="Aggiungi alla lista"]'); await p.waitForTimeout(150);
  // La foto ora si allega nella maschera che si apre confermando l'acquisto
  await p.locator('li:has-text("Pane") button:has-text("Segna come acquistata")').click();
  await p.waitForTimeout(400);
  const capToBuy = await p.locator('div.fixed:has-text("Acquistata:") input[type=file]').getAttribute('capture');
  // carico un file "dalla galleria" (setInputFiles simula la scelta di un file)
  await p.setInputFiles('div.fixed:has-text("Acquistata:") input[type=file]', require('path').join(__dirname,'..','fixture','scontrino.png'));
  await p.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('cambusa_receipts') || '{}')).length >= 1, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(250);
  const okToBuy = await p.locator('div.fixed:has-text("Acquistata:") button[aria-label="Vedi scontrino"]').count();
  await p.locator('button:has-text("Annulla")').first().click();
  await p.waitForTimeout(300);

  await p.locator('main button:has-text("Acquistato")').click(); await p.waitForTimeout(200);
  // la maschera manuale ora parte chiusa: la apro
  {
    const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' });
    if (await b.count()) { await b.first().click(); await p.waitForTimeout(350); }
  }
  const capForm = await p.locator('h3:has-text("Prodotto acquistato")').locator('..').locator('input[type=file]').getAttribute('capture');
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Sale');
  await p.fill('input[placeholder="0.00"]', '2');
  await p.click('button:has-text("Salva")'); await p.waitForTimeout(250);
  const capHist = await p.locator('li:has-text("Sale") input[type=file]').getAttribute('capture');
  await p.setInputFiles('li:has-text("Sale") input[type=file]', require('path').join(__dirname,'..','fixture','scontrino.png'));
  await p.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('cambusa_receipts') || '{}')).length >= 2, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(250);
  const okHist = await p.locator('li:has-text("Sale") button[aria-label="Vedi scontrino"]').count();

  await go('Attrezzatura');
  await p.fill('input[placeholder="Es. Corda, gazebo, tanica…"]', 'Corda');
  await p.fill('input[placeholder="Prezzo (€)"]', '10');
  await p.click('button:has-text("Aggiungi")'); await p.waitForTimeout(150);
  const capEq = await p.locator('li:has-text("Corda") input[type=file]').getAttribute('capture');
  await p.setInputFiles('li:has-text("Corda") input[type=file]', require('path').join(__dirname,'..','fixture','scontrino.png'));
  await p.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('cambusa_receipts') || '{}')).length >= 3, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(250);
  const okEq = await p.locator('li:has-text("Corda") button[aria-label="Vedi scontrino"]').count();

  const forced = inputs.filter(i => i.capture !== null);
  console.log('input file totali:', inputs.length, '| che forzano la fotocamera:', forced.length);
  console.log('capture: maschera acquisto', capToBuy, '| form', capForm, '| cronologia', capHist, '| attrezzatura', capEq, '(null = si può scegliere dalla galleria)');
  console.log('caricamento da file riuscito -> maschera acquisto:', okToBuy > 0, '| cronologia:', okHist > 0, '| attrezzatura:', okEq > 0);
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
