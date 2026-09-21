// L'acquirente si sceglie dai membri: niente più nomi digitati a mano.
const { chromium } = require('playwright-core');
// L'impronta del blocco si LEGGE da firebase-config.js (test/lib/app.js).
// Ricopiata qui, il giorno in cui cambia la password del campo questa prova
// diventa rossa per un motivo che non c'entra niente con quello che prova —
// e' successo davvero, a diciannove prove insieme.
const H = require('../lib/app').SBLOCCO;
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 850 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.addInitScript((h) => {
    localStorage.setItem('cambusa_unlock', h);
    localStorage.setItem('cambusa_sync_optout', '1');
    localStorage.setItem('cambusa_install_hint_off', '1');
    localStorage.setItem('cambusa_members', JSON.stringify([
      { id: 'a', name: 'Alice' }, { id: 'b', name: 'Bruno Rossi' }, { id: 'k', name: 'Lea', isChild: true },
    ]));
    localStorage.setItem('cambusa_tobuy', JSON.stringify([{ id: 't1', name: 'Carbonella' }]));
    localStorage.setItem('cambusa_purchases', JSON.stringify([
      { id: 'v1', name: 'Vecchia spesa', price: 20, type: 'alimentare', buyer: 'Carlo', at: Date.now() },
    ]));
  }, H);
  const menu = async (v) => { await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(280); await p.locator('nav button', { hasText: v }).first().click(); await p.waitForTimeout(300); };
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });

  const opzioni = async (loc) => (await loc.locator('option').allInnerTexts()).map(t => t.trim());

  // 1) maschera manuale
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click(); await p.waitForTimeout(300);
  { const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' }); if (await b.count()) { await b.first().click(); await p.waitForTimeout(350); } }
  const form = p.locator('h3:has-text("Prodotto acquistato")').locator('xpath=../..');
  const selForm = form.locator('select').first();
  console.log('maschera manuale: è una tendina:', await selForm.evaluate(e => e.tagName) === 'SELECT' ? 'OK' : 'PROBLEMA');
  console.log('  opzioni:', JSON.stringify(await opzioni(selForm)));
  console.log('  niente campo libero per l\'acquirente:', (await form.locator('input[placeholder="Chi ha acquistato"]').count()) === 0 ? 'OK' : 'PROBLEMA');

  // registro una spesa scegliendo dalla tendina
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Pane');
  await p.locator('input[placeholder="0.00"]').first().fill('6');
  await selForm.selectOption({ label: 'Bruno Rossi' });
  await p.locator('button', { hasText: /^Salva$/ }).first().click();
  await p.waitForTimeout(400);
  const salvata = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases')).find(x => x.name === 'Pane'));
  console.log('acquirente salvato esattamente:', salvata && salvata.buyer === 'Bruno Rossi' ? 'OK' : 'PROBLEMA (' + JSON.stringify(salvata && salvata.buyer) + ')');

  // 2) maschera di conferma acquisto
  await p.locator('button', { hasText: 'Da acquistare' }).first().click(); await p.waitForTimeout(300);
  await p.locator('li:has-text("Carbonella") button:has-text("Segna come acquistata")').click(); await p.waitForTimeout(400);
  const modale = p.locator('div.fixed', { hasText: 'Acquistata:' }).last();
  const selModale = modale.locator('select').first();
  console.log('maschera acquisto: è una tendina:', await selModale.evaluate(e => e.tagName) === 'SELECT' ? 'OK' : 'PROBLEMA');
  console.log('  opzioni:', JSON.stringify(await opzioni(selModale)));
  await selModale.selectOption({ label: 'Alice' });
  await modale.locator('input[placeholder="0.00"]').fill('9');
  await modale.locator('button', { hasText: 'Conferma' }).click();
  await p.waitForTimeout(400);
  const carb = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases')).find(x => x.name === 'Carbonella'));
  console.log('acquirente dalla maschera acquisto:', carb && carb.buyer === 'Alice' ? 'OK' : 'PROBLEMA');

  // 3) attrezzatura
  await menu('Attrezzatura');
  const selEq = p.locator('main select').first();
  console.log('attrezzatura: è una tendina:', await selEq.evaluate(e => e.tagName) === 'SELECT' ? 'OK' : 'PROBLEMA');
  console.log('  opzioni:', JSON.stringify(await opzioni(selEq)));

  // 4) un acquirente registrato prima e non più fra i membri resta selezionabile
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click(); await p.waitForTimeout(300);
  { const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' }); if (await b.count()) { await b.first().click(); await p.waitForTimeout(350); } }
  await menu('Spese Totali');
  await p.getByRole('button', { name: 'Saldi', exact: true }).click(); await p.waitForTimeout(400);
  const saldi = await p.locator('h3:has-text("Saldo finale")').locator('xpath=../..').innerText();
  console.log('avviso su "Carlo" non fra i membri:', /Carlo/.test(saldi) && /non è fra i membri/.test(saldi.replace(/\s+/g, ' ')) ? 'OK' : 'PROBLEMA');

  // 5) doppione fra i membri: deve avvisare
  await menu('Membri');
  let chiesto = false;
  p.on('dialog', () => { chiesto = true; });
  await p.fill('input[placeholder="Nome e cognome"]', 'alice');
  await p.locator('main button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(400);
  console.log('nome doppio: chiede conferma:', chiesto ? 'OK' : 'PROBLEMA');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-acquirente.png') });
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
