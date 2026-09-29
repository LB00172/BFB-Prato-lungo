// La maschera manuale parte chiusa e si apre a comando.
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
    localStorage.setItem('cambusa_members', JSON.stringify([{ id: 'a', name: 'Alice' }]));
    localStorage.setItem('cambusa_purchases', JSON.stringify([
      { id: 'v1', name: 'Spesa di ieri', price: 20, type: 'alimentare', buyer: 'Alice', at: Date.now() },
    ]));
  }, H);
  await p.addInitScript(...campoDiProva());
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(300);
  await p.locator('nav button', { hasText: 'Lista della Spesa' }).first().click(); await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'Acquistato' }).first().click(); await p.waitForTimeout(400);

  // 1) chiusa all'apertura
  console.log('maschera chiusa all\'apertura:', (await p.locator('input[placeholder="Es. Pasta, Acqua, Piatti…"]').count()) === 0 ? 'OK' : 'PROBLEMA');
  const bottone = p.locator('main button', { hasText: 'Registra una spesa' });
  console.log('bottone per aprirla:', (await bottone.count()) > 0 ? 'OK' : 'PROBLEMA');
  const yCrono = (await p.locator('h3:has-text("Cronologia acquisti")').boundingBox()).y;
  console.log('cronologia subito visibile a', Math.round(yCrono) + 'px ->', yCrono < 400 ? 'OK' : 'PROBLEMA');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-maschera-chiusa.png') });

  // 2) si apre
  await bottone.click(); await p.waitForTimeout(400);
  console.log('dopo il tocco la maschera si apre:', (await p.locator('input[placeholder="Es. Pasta, Acqua, Piatti…"]').count()) > 0 ? 'OK' : 'PROBLEMA');
  const campi = await p.locator('[data-foglio-spesa]').evaluate((el) => ({
    nome: !!el.querySelector('input[placeholder*="Pasta"]'),
    acquirente: el.querySelectorAll('select').length >= 1,
    prezzo: !!el.querySelector('input[data-cifra]'),
    foto: !!el.querySelector('input[type=file]'),
    salva: Array.from(el.querySelectorAll('button')).some(b => b.innerText.trim() === 'Salva'),
    chiudi: Array.from(el.querySelectorAll('button')).some(b => b.getAttribute('aria-label') === 'Chiudi la maschera'),
  }));
  console.log('campi presenti:', JSON.stringify(campi));
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-maschera-aperta.png') });

  // 3) si richiude con la ✕ senza salvare
  await p.locator('button[aria-label="Chiudi la maschera"]').click(); await p.waitForTimeout(350);
  console.log('la ✕ la richiude:', (await p.locator('input[placeholder="Es. Pasta, Acqua, Piatti…"]').count()) === 0 ? 'OK' : 'PROBLEMA');

  // 4) salvando si richiude e la spesa compare in cronologia
  await bottone.click(); await p.waitForTimeout(350);
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Ghiaccio');
  await p.locator('input[data-cifra]').first().fill('3.5');
  await p.locator('[data-foglio-spesa]').locator('select').first().selectOption({ label: 'Alice' });
  await p.locator('button', { hasText: /^Salva$/ }).first().click();
  await p.waitForTimeout(500);
  console.log('dopo Salva si richiude:', (await p.locator('input[placeholder="Es. Pasta, Acqua, Piatti…"]').count()) === 0 ? 'OK' : 'PROBLEMA');
  const crono = await p.locator('h3:has-text("Cronologia acquisti")').locator('xpath=../..').innerText();
  console.log('la spesa è in cronologia:', /Ghiaccio/.test(crono) && /3,50/.test(crono) ? 'OK' : 'PROBLEMA');
  const salvata = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases')).find(x => x.name === 'Ghiaccio'));
  console.log('acquirente corretto:', salvata && salvata.buyer === 'Alice' ? 'OK' : 'PROBLEMA');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-maschera-dopo.png') });
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
