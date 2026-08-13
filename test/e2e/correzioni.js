// Matita per correggere, ricerca in cronologia, controllo "pronto per il campo".
const { chromium } = require('playwright-core');
const H = '432631a6d9164150bff2cef2afebf83fc36f43fe04c658bac55ec89dbeda8a14';
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 850 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  const spese = [];
  for (let i = 1; i <= 8; i++) spese.push({ id: 'p' + i, name: 'Voce ' + i, price: 10 + i, type: 'alimentare', buyer: 'Alice', at: Date.now() - i * 1000 });
  spese.push({ id: 'px', name: 'Carbonella', price: 12.5, type: 'logistica', buyer: 'Bruno', at: Date.now() });
  await p.addInitScript((d) => {
    localStorage.setItem('cambusa_unlock', d.H);
    localStorage.setItem('cambusa_sync_optout', '1');
    localStorage.setItem('cambusa_install_hint_off', '1');
    localStorage.setItem('cambusa_members', JSON.stringify([{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bruno' }]));
    localStorage.setItem('cambusa_purchases', JSON.stringify(d.spese));
    localStorage.setItem('cambusa_equipment', JSON.stringify([{ id: 'e1', text: 'Gazebo', price: 40, bought: true, buyer: 'Alice' }]));
    localStorage.setItem('cambusa_camp_data', JSON.stringify({ '2026-08-11': { meals: { a: { lunch: true, dinner: true }, b: { lunch: true, dinner: true } } } }));
  }, { H, spese });
  const menu = async (v) => { await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(280); await p.locator('nav button', { hasText: v }).first().click(); await p.waitForTimeout(320); };
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });

  // ---- 1. Correzione di una spesa ----
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click(); await p.waitForTimeout(350);
  const riga = p.locator('ul li', { hasText: 'Carbonella' }).first();
  console.log('matita sulla riga:', (await riga.locator('button[aria-label="Correggi"]').count()) > 0 ? 'OK' : 'PROBLEMA');
  await riga.locator('button[aria-label="Correggi"]').click(); await p.waitForTimeout(400);
  const modale = p.locator('div.fixed', { hasText: 'Correggi la spesa' }).last();
  const precompilato = await modale.evaluate((el) => ({
    nome: el.querySelector('input[type=text]').value,
    prezzo: el.querySelector('input[type=number]').value,
    acquirente: el.querySelectorAll('select')[0].value,
    tipologia: el.querySelectorAll('select')[1].value,
  }));
  console.log('campi precompilati:', JSON.stringify(precompilato));

  // ---- Conto separato: c'e' solo dove ha senso, e dove non c'e' si spiega ----
  // La logistica si divide a testa fra chi ha pasti nei giorni a conto comune,
  // non per giorno: il conto separato non si applica. Prima la riga spariva
  // senza dire niente, e chi la cercava non poteva sapere perche'.
  const testoModale = await modale.innerText();
  console.log('sulla logistica il selettore del conto non c\'e\':',
    !/Conto comune/.test(testoModale) ? 'OK' : 'PROBLEMA');
  console.log('ma l\'app spiega perche\':',
    /si divide a testa/.test(testoModale) && /giorni a conto comune/.test(testoModale)
      && /non si applica/.test(testoModale) ? 'OK' : 'PROBLEMA');
  await modale.locator('input[type=number]').fill('125');
  await modale.locator('select').first().selectOption({ label: 'Alice' });
  await modale.locator('button', { hasText: /^Salva$/ }).click();
  await p.waitForTimeout(500);
  const corretta = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases')).find(x => x.id === 'px'));
  console.log('spesa corretta:', corretta.price === 125 && corretta.buyer === 'Alice' ? 'OK' : 'PROBLEMA', JSON.stringify({ prezzo: corretta.price, acquirente: corretta.buyer }));
  console.log('id e data conservati:', corretta.id === 'px' && !!corretta.at ? 'OK' : 'PROBLEMA');
  const nSpese = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases')).length);
  console.log('nessuna voce duplicata o persa:', nSpese === 9 ? 'OK' : 'PROBLEMA (' + nSpese + ')');

  // Su una spesa alimentare invece il selettore ci deve essere.
  const rigaCibo = p.locator('ul li', { hasText: 'Voce 3' }).first();
  await rigaCibo.locator('button[aria-label="Correggi"]').click(); await p.waitForTimeout(400);
  const modaleCibo = p.locator('div.fixed', { hasText: 'Correggi la spesa' }).last();
  const testoCibo = await modaleCibo.innerText();
  console.log('su cibo e bevande il selettore del conto c\'e\':',
    /Conto comune/.test(testoCibo) ? 'OK' : 'PROBLEMA');
  console.log('e non compare la spiegazione della logistica:',
    !/si divide a testa/.test(testoCibo) ? 'OK' : 'PROBLEMA');
  await modaleCibo.locator('button', { hasText: /^Annulla$/ }).click(); await p.waitForTimeout(350);

  // ---- 2. Ricerca ----
  const cerca = p.locator('input[placeholder="Cerca fra le spese…"]');
  console.log('campo di ricerca presente:', (await cerca.count()) > 0 ? 'OK' : 'PROBLEMA');
  await cerca.fill('carbon'); await p.waitForTimeout(400);
  let visibili = await p.locator('h3:has-text("Cronologia acquisti")').locator('xpath=../..').locator('ul li').count();
  console.log('cercando "carbon":', visibili, 'risultato ->', visibili === 1 ? 'OK' : 'PROBLEMA');
  const riepilogo = await p.locator('h3:has-text("Cronologia acquisti")').locator('xpath=../..').innerText();
  console.log('mostra conteggio e totale dei trovati:', /1 voce trovata su 9/i.test(riepilogo) && /125\.00/.test(riepilogo) ? 'OK' : 'PROBLEMA');
  await cerca.fill('bruno'); await p.waitForTimeout(350);
  console.log('ricerca per acquirente (Bruno, corretto ad Alice):', (await p.locator('h3:has-text("Cronologia acquisti")').locator('xpath=../..').innerText()).includes('Nessuna spesa corrisponde') ? 'OK' : 'PROBLEMA');
  await cerca.fill('alimentare'); await p.waitForTimeout(350);
  visibili = await p.locator('h3:has-text("Cronologia acquisti")').locator('xpath=../..').locator('ul li').count();
  console.log('ricerca per tipologia:', visibili === 8 ? 'OK' : 'PROBLEMA (' + visibili + ')');
  await cerca.fill(''); await p.waitForTimeout(350);

  // ---- 3. Correzione attrezzatura ----
  await menu('Attrezzatura');
  const rigaEq = p.locator('ul li', { hasText: 'Gazebo' }).first();
  await rigaEq.locator('button[aria-label="Correggi"]').click(); await p.waitForTimeout(400);
  const modaleEq = p.locator('div.fixed', { hasText: 'Correggi la voce' }).last();
  await modaleEq.locator('input[type=number]').fill('55.5');
  await modaleEq.locator('button', { hasText: /^Salva$/ }).click();
  await p.waitForTimeout(450);
  const eq = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_equipment'))[0]);
  console.log('attrezzatura corretta:', eq.price === 55.5 && eq.bought === true ? 'OK' : 'PROBLEMA', JSON.stringify(eq));

  // ---- 4. Pronto per il campo ----
  await menu('Impostazioni');
  const testo = await p.locator('main').innerText();
  console.log('scheda "Pronto per il campo":', /PRONTO PER IL CAMPO/i.test(testo) ? 'OK' : 'PROBLEMA');
  const spie = await p.locator('h3:has-text("Pronto per il campo")').locator('xpath=../..').locator('ul li').allInnerTexts();
  console.log('spie:', JSON.stringify(spie.map(t => t.split('\n')[0])));
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-pronto.png'), fullPage: true });
  await menu('Calendario');
  const cal = await p.locator('main').innerText();
  console.log('avviso in Calendario quando manca qualcosa:', /non è ancora pronto per il campo/i.test(cal) ? 'presente' : 'assente (telefono già pronto)');
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
