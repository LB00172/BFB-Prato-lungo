// Percorso completo dell'utente: spunta i giorni in Calendario, registra una
// spesa sul conto separato e controlla che le quote cambino di conseguenza.
const { chromium } = require('playwright-core');

const DAY = '2026-08-11';   // giorno del conto separato
const DAY2 = '2026-08-12';  // giorno comune
const L = { lunch: true, dinner: false };

(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 820 } });
  await p.addInitScript(() => localStorage.setItem('cambusa_unlock', '432631a6d9164150bff2cef2afebf83fc36f43fe04c658bac55ec89dbeda8a14'));
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());

  await p.addInitScript((d) => {
    localStorage.setItem('cambusa_sync_optout', '1');
    localStorage.setItem('cambusa_install_hint_off', '1');
    localStorage.setItem('cambusa_members', JSON.stringify([
      { id: 'a', name: 'Alice' }, { id: 'b', name: 'Bruno' }, { id: 'c', name: 'Carlo' },
    ]));
    localStorage.setItem('cambusa_camp_data', JSON.stringify({
      [d.DAY]: { note: '', guestsNames: '', meals: { a: d.L, b: d.L } },
      [d.DAY2]: { note: '', guestsNames: '', meals: { a: d.L, b: d.L, c: d.L } },
    }));
  }, { DAY, DAY2, L });

  const menu = async (voce) => {
    await p.click('button[aria-label="Menu"]');
    await p.waitForTimeout(280);
    await p.locator('nav button', { hasText: voce }).first().click();
    await p.waitForTimeout(280);
  };

  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });

  // --- 1. Calendario: c'è il riquadro con una checkbox per ogni giorno ---
  await menu('Calendario');
  // La riga del conto separato ora sta chiusa: si apre a comando.
  await p.locator('button', { hasText: 'Conto separato' }).first().click();
  await p.waitForTimeout(300);
  const nCheck = await p.locator('input[type="checkbox"]').count();
  console.log('checkbox nella settimana visualizzata:', nCheck, '->', nCheck === 7 ? 'OK (una per giorno)' : 'PROBLEMA');

  // Mi sposto sulla settimana del campo e spunto l'11 agosto.
  for (let i = 0; i < 8 && !(await p.locator('label[title*="11 agosto"]').count()); i++) {
    await p.locator('button', { hasText: '→' }).first().click();
    await p.waitForTimeout(200);
  }
  const cella11 = p.locator('label[title*="11 agosto"]');
  console.log('trovato l\'11 agosto nella striscia:', (await cella11.count()) > 0);
  await cella11.locator('input').check();
  await p.waitForTimeout(300);
  const salvati = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_sepdays') || '[]'));
  console.log('giorni sul conto separato salvati:', JSON.stringify(salvati), '->', salvati.includes('2026-08-11') ? 'OK' : 'PROBLEMA');

  // --- 2. Spesa sul conto separato ---
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  { const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' }); if (await b.count()) { await b.first().click(); await p.waitForTimeout(350); } }
  await p.waitForTimeout(200);
  // la maschera manuale ora parte chiusa: la apro
  {
    const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' });
    if (await b.count()) { await b.first().click(); await p.waitForTimeout(350); }
  }
  const tendina = p.locator('select').filter({ hasText: 'Conto comune' });
  console.log('menu a tendina "Conto" presente:', (await tendina.count()) > 0);
  console.log('valore di partenza:', await tendina.first().inputValue(), '->', (await tendina.first().inputValue()) === 'comune' ? 'OK (conto comune)' : 'PROBLEMA');

  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Spesa dell 11');
  await p.locator('h3:has-text("Prodotto acquistato")').locator('xpath=../..').locator('select').first().selectOption({ label: 'Alice' });
  await p.locator('input[placeholder="0.00"]').first().fill('60');
  await tendina.first().selectOption('sep');
  await p.waitForTimeout(200);
  await p.locator('button', { hasText: /^Salva$/ }).first().click();
  await p.waitForTimeout(350);

  // seconda spesa, comune (dopo il salvataggio la maschera si richiude)
  { const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' }); if (await b.count()) { await b.first().click(); await p.waitForTimeout(350); } }
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Spesa comune');
  await p.locator('h3:has-text("Prodotto acquistato")').locator('xpath=../..').locator('select').first().selectOption({ label: 'Carlo' });
  await p.locator('input[placeholder="0.00"]').first().fill('30');
  await tendina.first().selectOption('comune');
  await p.locator('button', { hasText: /^Salva$/ }).first().click();
  await p.waitForTimeout(350);

  const etichette = await p.locator('ul li', { hasText: 'Spesa dell 11' }).first().innerText();
  console.log('la spesa è etichettata:', /SEPARATO/i.test(etichette) ? 'OK (badge "Separato")' : 'PROBLEMA');

  // --- 3. Quote: separato 60/2 = 30 ad Alice e Bruno; comune 30/3 = 10 a testa ---
  await menu('Spese Totali');
  await p.getByRole('button', { name: 'Quote', exact: true }).first().click();
  await p.waitForTimeout(300);
  const righe = await p.locator('h3:has-text("Quanto deve ciascuno")').locator('..').locator('ul li').allInnerTexts();
  const quota = (nome) => {
    const r = righe.find((x) => x.includes(nome)) || '';
    const mm = r.match(/(\d+[.,]\d{2})\s*€/);
    return mm ? parseFloat(mm[1].replace(',', '.')) : NaN;
  };
  const q = { Alice: quota('Alice'), Bruno: quota('Bruno'), Carlo: quota('Carlo') };
  console.log('quote:', JSON.stringify(q), '-> attese Alice 40, Bruno 40, Carlo 10');
  const okQuote = q.Alice === 40 && q.Bruno === 40 && q.Carlo === 10;
  console.log('ripartizione corretta:', okQuote ? 'OK' : 'PROBLEMA');
  console.log('dettaglio pasti mostrato:', /comuni \+ 1 separati/.test(righe.join(' ')) ? 'OK' : 'PROBLEMA');

  // --- 4. Riquadro della quota separata nei Totali ---
  await p.getByRole('button', { name: 'Totali', exact: true }).first().click();
  await p.waitForTimeout(300);
  const testoTot = await p.locator('body').innerText();
  console.log('riquadro "conto separato" nei totali:', /CONTO SEPARATO — QUOTA PASTO/i.test(testoTot) ? 'OK' : 'PROBLEMA');
  console.log('sottototale separato mostrato:', /DI CUI SUL CONTO SEPARATO/i.test(testoTot) ? 'OK' : 'PROBLEMA');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-separato.png'), fullPage: true });

  // --- 5. Spesa separata rimasta senza giorni: deve avvisare, non passare in sordina ---
  await menu('Calendario');
  await p.locator('label[title*="11 agosto"]').locator('input').uncheck();
  await p.waitForTimeout(300);
  await menu('Spese Totali');
  await p.getByRole('button', { name: 'Quote', exact: true }).first().click();
  await p.waitForTimeout(300);
  const testoQuote = await p.locator('body').innerText();
  const avvisa = /sul\s+conto separato ma nessun pasto nei giorni spuntati/i.test(testoQuote.replace(/\s+/g, ' '));
  console.log('avviso "spesa separata senza giorni":', avvisa ? 'OK' : 'PROBLEMA');
  const raccolto = (testoQuote.match(/TOTALE RACCOLTO\s*([\d.,]+)/i) || [])[1];
  console.log('totale raccolto:', raccolto, '-> deve restare pari al totale speso (90,00)');

  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
