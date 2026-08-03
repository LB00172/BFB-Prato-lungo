const { chromium } = require('playwright-core');
const H = '432631a6d9164150bff2cef2afebf83fc36f43fe04c658bac55ec89dbeda8a14';
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 850 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  const lista = [
    { id: 't1', name: 'Pomodori pelati', qty: '6 scatole' },
    { id: 't2', name: 'Pasta corta', qty: '5 kg' },
    { id: 't3', name: 'Pane', qty: '' },
    { id: 't4', name: 'Carbonella', qty: '2 sacchi' },
    { id: 't5', name: 'Acqua naturale', qty: '24 bottiglie' },
    { id: 't6', name: 'Caffè', qty: '' },
  ];
  await p.addInitScript((d) => {
    localStorage.setItem('cambusa_unlock', d.H);
    localStorage.setItem('cambusa_sync_optout', '1');
    localStorage.setItem('cambusa_install_hint_off', '1');
    localStorage.setItem('cambusa_tobuy', JSON.stringify(d.lista));
    localStorage.setItem('cambusa_members', JSON.stringify([{ id: 'a', name: 'Alice' }]));
  }, { H, lista });
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(300);
  await p.locator('nav button', { hasText: 'Lista della Spesa' }).first().click(); await p.waitForTimeout(400);

  const cerca = p.locator('input[placeholder="Cerca nella lista…"]');
  console.log('campo di ricerca presente:', (await cerca.count()) > 0 ? 'OK' : 'PROBLEMA');
  const card = p.locator('h3:has-text("Da Acquistare")').locator('xpath=../..');
  console.log('voci mostrate senza filtro:', await card.locator('ul li').count(), '-> atteso 6');

  await cerca.fill('pa'); await p.waitForTimeout(350);
  let nomi = (await card.locator('ul li').allInnerTexts()).map(t => t.split('\n')[0]);
  console.log('cercando "pa":', JSON.stringify(nomi), '->', nomi.length === 2 ? 'OK (Pasta, Pane)' : 'PROBLEMA');
  console.log('mostra il conteggio:', /2 voci trovate su 6/i.test(await card.innerText()) ? 'OK' : 'PROBLEMA');

  await cerca.fill('sacchi'); await p.waitForTimeout(350);
  nomi = (await card.locator('ul li').allInnerTexts()).map(t => t.split('\n')[0]);
  console.log('ricerca per quantità:', JSON.stringify(nomi), '->', nomi.length === 1 && /Carbonella/.test(nomi[0]) ? 'OK' : 'PROBLEMA');

  // il tasto acquisto deve funzionare anche su una voce filtrata
  await card.locator('ul li button:has-text("Segna come acquistata")').first().click();
  await p.waitForTimeout(400);
  const modale = p.locator('div.fixed', { hasText: 'Acquistata:' }).last();
  console.log('acquisto da lista filtrata:', /Carbonella/.test(await modale.innerText()) ? 'OK' : 'PROBLEMA');
  await modale.locator('input[placeholder="0.00"]').fill('9');
  await modale.locator('select').first().selectOption({ label: 'Alice' });
  await modale.locator('button', { hasText: 'Conferma' }).click();
  await p.waitForTimeout(500);
  const dopo = await p.evaluate(() => ({
    lista: JSON.parse(localStorage.getItem('cambusa_tobuy')).map(x => x.name),
    spese: JSON.parse(localStorage.getItem('cambusa_purchases')).map(x => x.name),
  }));
  console.log('voce spostata negli acquisti:', dopo.spese.includes('Carbonella (2 sacchi)') && !dopo.lista.includes('Carbonella') ? 'OK' : 'PROBLEMA', JSON.stringify(dopo));
  console.log('le altre voci della lista sono intatte:', dopo.lista.length === 5 ? 'OK' : 'PROBLEMA');

  await cerca.fill('zzz'); await p.waitForTimeout(350);
  console.log('ricerca a vuoto:', /Niente in lista corrisponde/i.test(await card.innerText()) ? 'OK' : 'PROBLEMA');
  await cerca.fill(''); await p.waitForTimeout(350);
  console.log('azzerando torna tutto:', (await card.locator('ul li').count()) === 5 ? 'OK' : 'PROBLEMA');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-cerca-lista.png') });
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
