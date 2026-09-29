// La foto dello scontrino si allega nella maschera di conferma acquisto,
// non più sulla mini scheda della lista.
const { campoDiProva } = require('../lib/app');
const { chromium } = require('playwright-core');
const { scontriniSalvati, fotoSalvate } = require('../lib/app');
// L'impronta del blocco si LEGGE da firebase-config.js (test/lib/app.js).
// Ricopiata qui, il giorno in cui cambia la password del campo questa prova
// diventa rossa per un motivo che non c'entra niente con quello che prova —
// e' successo davvero, a diciannove prove insieme.
const H = require('../lib/app').SBLOCCO;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 820 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.addInitScript((h) => {
    localStorage.setItem('cambusa_unlock', h);
    localStorage.setItem('cambusa_sync_optout', '1');
    localStorage.setItem('cambusa_install_hint_off', '1');
    localStorage.setItem('cambusa_tobuy', JSON.stringify([{ id: 't1', name: 'Carbonella', qty: '2 sacchi' }]));
  }, H);
  await p.addInitScript(...campoDiProva());
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(300);
  await p.locator('nav button', { hasText: 'Lista della Spesa' }).first().click(); await p.waitForTimeout(350);

  // 1. Sulla mini scheda NON deve esserci il bottone foto
  const scheda = p.locator('ul li', { hasText: 'Carbonella' }).first();
  const fotoInLista = await scheda.locator('input[type="file"]').count();
  console.log('bottone foto sulla mini scheda:', fotoInLista === 0 ? 'rimosso -> OK' : 'PROBLEMA (ancora presente)');
  console.log('resta il tasto acquisto:', (await scheda.locator('button', { hasText: 'Segna come acquistata' }).count()) > 0 ? 'OK' : 'PROBLEMA');

  // 2. Nella maschera di conferma DEVE esserci
  await scheda.locator('button', { hasText: 'Segna come acquistata' }).click();
  await p.waitForTimeout(400);
  const modale = p.locator('div.fixed', { hasText: 'Acquistata:' }).last();
  console.log('maschera aperta sul prodotto giusto:', /Carbonella/.test(await modale.innerText()) ? 'OK' : 'PROBLEMA');
  const inputFoto = modale.locator('input[type="file"]');
  console.log('bottone foto nella maschera:', (await inputFoto.count()) > 0 ? 'OK' : 'PROBLEMA');
  console.log('istruzione presente:', /Tocca 📷 per allegare lo scontrino/.test(await modale.innerText()) ? 'OK' : 'PROBLEMA');

  // 3. Allego la foto e confermo: deve restare attaccata all'acquisto
  await inputFoto.setInputFiles({ name: 's.png', mimeType: 'image/png', buffer: PNG });
  // L'immagine va decodificata e ridimensionata: si aspetta il fatto compiuto.
  await scontriniSalvati(p, 1).catch(() => {});
  await p.waitForTimeout(250);
  console.log('dopo l\'allegato la maschera lo segnala:', /Scontrino allegato/.test(await modale.innerText()) ? 'OK' : 'PROBLEMA');
  await p.locator('input[data-cifra]').first().fill('12');
  await p.locator('button', { hasText: 'Conferma' }).first().click();
  await p.waitForTimeout(600);

  const stato = await p.evaluate(() => ({
    acquisti: JSON.parse(localStorage.getItem('cambusa_purchases') || '[]'),
    lista: JSON.parse(localStorage.getItem('cambusa_tobuy') || '[]').length,
  }));
  stato.scontrini = await fotoSalvate(p);
  console.log('acquisto registrato:', stato.acquisti.length === 1 && stato.acquisti[0].id === 't1' ? 'OK' : 'PROBLEMA');
  console.log('scontrino collegato all\'acquisto:', stato.scontrini.includes('t1') ? 'OK' : 'PROBLEMA', JSON.stringify(stato.scontrini));
  console.log('voce tolta da "Da acquistare":', stato.lista === 0 ? 'OK' : 'PROBLEMA');

  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(400);
  const inCronologia = await p.locator('ul li', { hasText: 'Carbonella' }).first().innerText();
  console.log('in cronologia con la foto:', /📷/.test(inCronologia) ? 'OK' : 'PROBLEMA');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-scontrino.png') });
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
