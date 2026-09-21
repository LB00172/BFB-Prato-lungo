const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await (await b.newContext()).newPage();
  await p.addInitScript((h) => localStorage.setItem('cambusa_unlock', h), require('../lib/app').SBLOCCO);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', async d => { await d.accept(); });
  await p.addInitScript(() => localStorage.setItem('cambusa_members', JSON.stringify([{ id: 'a', name: 'Alice' }])));
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  const go = async (label) => { await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(350); await p.locator(`nav button:has-text("${label}")`).click(); await p.waitForTimeout(200); };

  // ===== A) DA ACQUISTARE -> CRONOLOGIA =====
  await go('Lista della Spesa');
  await p.fill('input[placeholder="Cosa serve…"]', 'Pomodori');
  await p.fill('input[placeholder="Q.tà"]', '3 kg');
  await p.click('button[aria-label="Aggiungi alla lista"]'); await p.waitForTimeout(150);
  const inList = await p.locator('li:has-text("Pomodori")').count();
  const qtyShown = await p.locator('text=Quantità: 3 kg').count();
  // allega scontrino sulla mini scheda
  // la foto si allega nella maschera di conferma acquisto
  await p.locator('li:has-text("Pomodori") button:has-text("Segna come acquistata")').click();
  await p.waitForTimeout(400);
  await p.setInputFiles('div.fixed:has-text("Acquistata:") input[type="file"]', require('path').join(__dirname,'..','fixture','scontrino.png'));
  await p.waitForTimeout(500);
  await p.locator('button:has-text("Annulla")').first().click();
  await p.waitForTimeout(300);
  await p.waitForTimeout(400);
  const receiptOnCard = await p.locator('li:has-text("Pomodori") button[aria-label="Vedi scontrino"]').count();
  // segna come acquistata
  await p.locator('li:has-text("Pomodori") button:has-text("Segna come acquistata")').click();
  await p.waitForTimeout(250);
  const modal = p.locator('div.fixed.z-50').filter({ hasText: 'Acquistata:' });
  await modal.locator('input[placeholder="0.00"]').fill('12.50');
  await modal.locator('select').first().selectOption({ label: 'Alice' });
  await modal.locator('button:has-text("Conferma")').click();
  await p.waitForTimeout(300);
  const goneFromList = (await p.locator('button:has-text("Segna come acquistata")').count()) === 0;
  await p.locator('main button:has-text("Acquistato")').click(); await p.waitForTimeout(250);
  // la maschera manuale ora parte chiusa: la apro
  {
    const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' });
    if (await b.count()) { await b.first().click(); await p.waitForTimeout(350); }
  }
  const histRow = await p.locator('li:has-text("Pomodori")').first().innerText();
  const receiptCarried = await p.locator('li:has-text("Pomodori") button[aria-label="Vedi scontrino"]').count();
  // il form diretto NON deve piu' avere il bottone scontrino
  const formHasCamera = await p.locator('h3:has-text("Prodotto acquistato")').locator('..').locator('input[type="file"]').count();

  console.log('[A] voce in lista:', inList > 0, '| quantità mostrata:', qtyShown > 0, '| 📷 sulla scheda:', receiptOnCard > 0);
  console.log('[A] uscita dalla lista:', goneFromList, '| riga cronologia:', histRow.replace(/\s+/g, ' '));
  console.log('[A] scontrino trasferito in cronologia:', receiptCarried > 0);
  console.log('[A] 📷 presente nella maschera manuale:', formHasCamera > 0);

  // (la sezione sull'esenzione attrezzatura e' stata tolta: la funzione non esiste piu')

  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
