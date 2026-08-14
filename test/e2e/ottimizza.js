// "Ottimizza i passaggi": meno bonifici, stesse cifre.
//
// Con due casse lo stesso debito puo' spezzarsi in due righe: Bruno paga
// Alice 20 € per la spesa comune e altri 20 € per la cena fuori. Sono due
// bonifici per una cosa sola. Il tasto unisce le due casse in un elenco
// solo — e' il "semplifica i debiti" di Splitwise — senza che nessuno paghi
// un centesimo in piu' o in meno.
//
// Le due cose che questa prova difende: che le CIFRE non cambino, e che le
// spunte delle due viste non si pestino i piedi.
const { apri, ok, fine } = require('../lib/app');

const semina = () => {
  const L = { lunch: true, dinner: false };
  localStorage.setItem('cambusa_members', JSON.stringify([
    { id: 'a', name: 'Alice', isChild: false },
    { id: 'b', name: 'Bruno', isChild: false },
  ]));
  localStorage.setItem('cambusa_camp_data', JSON.stringify({
    '2026-08-11': { note: '', guestsNames: '', meals: { a: L, b: L } },
    '2026-08-12': { note: '', guestsNames: '', meals: { a: L, b: L } },
  }));
  localStorage.setItem('cambusa_purchases', JSON.stringify([
    { id: 'p1', name: 'Spesa di tutti', price: 40, type: 'alimentare', buyer: 'Alice', at: 1 },
    { id: 'p2', name: 'Cena fuori', price: 40, type: 'alimentare', buyer: 'Alice', at: 2, account: 'sep' },
  ]));
  localStorage.setItem('cambusa_sepdays', JSON.stringify(['2026-08-12']));
  localStorage.setItem('cambusa_settled', JSON.stringify([]));
};

// Somma degli importi delle righe "chi paga chi" a schermo.
const passaggi = (p) => p.evaluate(() => [...document.querySelectorAll('main li')]
  .filter((li) => li.textContent.includes('→'))
  .map((li) => li.textContent.replace(/\s+/g, ' ').trim()));

const totale = (righe) => righe.reduce((a, r) => {
  const mm = r.match(/(\d+[.,]\d{2})\s*€/);
  return a + (mm ? parseFloat(mm[1].replace(',', '.')) : 0);
}, 0);

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: semina });

  await menu('Spese Totali');
  await p.locator('main button:has-text("Saldi")').click();
  await p.waitForTimeout(400);

  // --- Prima: due casse, due passaggi ---
  const prima = await passaggi(p);
  ok(`per cassa i passaggi sono due (${prima.join(' | ')})`, prima.length === 2);
  const sommaPrima = totale(prima);
  ok(`e valgono 40,00 € in tutto (${sommaPrima.toFixed(2)})`, Math.abs(sommaPrima - 40) < 0.011);

  // --- Il tasto c'e' e dice quanto si risparmia ---
  const tasto = p.locator('main button', { hasText: /Ottimizza i passaggi/ });
  ok('il tasto per ottimizzare c\'è', (await tasto.count()) === 1);
  ok(`e dice da quanti a quanti (${(await tasto.first().innerText()).trim()})`,
    /\(2\s*→\s*1\)/.test(await tasto.first().innerText()));

  // --- Dopo: un passaggio solo, stessa cifra ---
  await tasto.first().click();
  await p.waitForTimeout(400);
  const dopo = await passaggi(p);
  ok(`ottimizzando resta un passaggio solo (${dopo.join(' | ')})`, dopo.length === 1);
  const sommaDopo = totale(dopo);
  ok(`che vale sempre 40,00 € (${sommaDopo.toFixed(2)})`, Math.abs(sommaDopo - sommaPrima) < 0.011);
  ok('ed è Bruno che paga Alice', /Bruno/.test(dopo[0]) && /Alice/.test(dopo[0]));

  // Le quote dovute NON cambiano: si ottimizzano i bonifici, non i conti.
  const dovuti = await p.evaluate(() => {
    const t = window.__totali;
    return t.breakdown.map((b) => `${b.name}:${b.payCents}`).sort().join(' ');
  });
  ok(`le quote restano quelle (${dovuti})`, dovuti === 'Alice:4000 Bruno:4000');

  // --- Le spunte delle due viste non si pestano i piedi ---
  await p.locator('main li').filter({ hasText: '→' }).first().click();
  await p.waitForTimeout(400);
  const chiaviOpt = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_settled') || '[]'));
  ok(`la spunta dell'ottimizzato ha la sua chiave (${JSON.stringify(chiaviOpt)})`,
    chiaviOpt.length === 1 && chiaviOpt[0].startsWith('opt:'));

  await p.locator('main button', { hasText: /Torna ai saldi per cassa/ }).first().click();
  await p.waitForTimeout(400);
  const spuntate = await p.evaluate(() => [...document.querySelectorAll('main li')]
    .filter((li) => li.textContent.includes('→'))
    .map((li) => li.textContent.includes('✓')));
  ok(`tornando alle due casse i loro rimborsi non risultano già fatti (${JSON.stringify(spuntate)})`,
    spuntate.length === 2 && spuntate.every((x) => x === false));

  // --- La scelta resta al riavvio: e' del telefono, non del campo ---
  await p.locator('main button', { hasText: /Ottimizza i passaggi/ }).first().click();
  await p.waitForTimeout(400);
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(900);
  await menu('Spese Totali');
  await p.locator('main button:has-text("Saldi")').click();
  await p.waitForTimeout(500);
  const titoli = await p.locator('main h3').allInnerTexts();
  ok(`riaprendo l'app la vista scelta è ancora quella (${titoli.join(' | ')})`,
    titoli.some((t) => /Passaggi ottimizzati/.test(t)));

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
