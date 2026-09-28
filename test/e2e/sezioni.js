const { campoDiProva } = require('../lib/app');
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await (await b.newContext()).newPage();
  await p.addInitScript((h) => localStorage.setItem('cambusa_unlock', h), require('../lib/app').SBLOCCO);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', async d => { await d.accept(); });
  await p.addInitScript(...campoDiProva());
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  const go = async (label) => { await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(350); await p.locator(`nav button:has-text("${label}")`).click(); await p.waitForTimeout(200); };

  await go('Lista della Spesa');
  // All'apertura: "Da acquistare" attivo -> form manuale e cronologia NON visibili
  const daAcqVisible = await p.locator('h3:has-text("Da Acquistare")').count();
  const formHiddenAtStart = await p.locator('h3:has-text("Prodotto acquistato")').count();
  const cronoHiddenAtStart = await p.locator('h3:has-text("Cronologia acquisti")').count();

  // aggiungo una voce da acquistare (resta in lista, non la compro)
  await p.fill('input[placeholder="Cosa serve…"]', 'Pane');
  await p.click('button[aria-label="Aggiungi alla lista"]'); await p.waitForTimeout(150);

  // passo ad "Acquistato": deve mostrare form manuale + cronologia, e sparire la lista
  await p.locator('main button:has-text("Acquistato")').click(); await p.waitForTimeout(200);
  // la maschera manuale ora parte chiusa: la apro
  {
    const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' });
    if (await b.count()) { await b.first().click(); await p.waitForTimeout(350); }
  }
  const formVisible = await p.locator('h3:has-text("Prodotto acquistato")').count();
  const cronoVisible = await p.locator('h3:has-text("Cronologia acquisti")').count();
  const daAcqHidden = await p.locator('h3:has-text("Da Acquistare")').count();
  // 📷 nella maschera manuale
  const camInForm = await p.locator('h3:has-text("Prodotto acquistato")').locator('..').locator('label[aria-label="Allega scontrino"]').count();

  // registro un acquisto manuale SENZA foto
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Sale');
  await p.fill('input[placeholder="0.00"]', '2');
  await p.click('button:has-text("Salva")'); await p.waitForTimeout(200);
  // la mini scheda deve avere 📷 per allegare DOPO
  const camOnCard = await p.locator('li:has-text("Sale") label[aria-label="Allega scontrino"]').count();
  await p.setInputFiles('li:has-text("Sale") input[type="file"]', require('path').join(__dirname,'..','fixture','scontrino.png'));
  await p.waitForTimeout(500);
  const nowViewable = await p.locator('li:has-text("Sale") button[aria-label="Vedi scontrino"]').count();

  // contatori sui bottoni
  const btnLabels = await p.locator('main button:has-text("acquist")').allInnerTexts();

  // torno a "Da acquistare": Pane deve essere ancora lì
  await p.locator('main button:has-text("Da acquistare")').click(); await p.waitForTimeout(200);
  const paneStill = await p.locator('li:has-text("Pane")').count();

  console.log('start: DaAcquistare visibile:', daAcqVisible > 0, '| form nascosto:', formHiddenAtStart === 0, '| cronologia nascosta:', cronoHiddenAtStart === 0);
  console.log('Acquistato: form visibile:', formVisible > 0, '| cronologia visibile:', cronoVisible > 0, '| lista nascosta:', daAcqHidden === 0);
  console.log('📷 nella maschera manuale:', camInForm > 0);
  console.log('📷 sulla mini scheda acquisto:', camOnCard > 0, '| dopo allegato diventa visualizzabile:', nowViewable > 0);
  console.log('bottoni:', JSON.stringify(btnLabels.filter(t => /acquist/i.test(t))));
  console.log('ritorno a Da acquistare, voce conservata:', paneStill > 0);
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
