// I rimborsi fatti sono soldi pagati, a schermo (rimborsi.js, 30 settembre).
//
// Il caso che ha fatto nascere tutto: quattro persone, due rimborsi pagati e
// segnati, poi Carla registra uno scontrino da 8 € che si era dimenticata.
// Prima le spunte sparivano e l'app chiedeva 34 € a Carla e 42 a Dario, che
// avevano gia' pagato. Adesso compare solo la differenza — Carla riceve 6 € —
// e i due rimborsi restano fatti. Il resoconto da mandare nel gruppo dice
// quali sono gia' fatti, invece di rimetterli fra i bonifici.
const { apri, ok, fine } = require('../lib/app');

const semina = () => {
  const P = { lunch: true, dinner: true };
  const membri = [['a', 'Anna'], ['b', 'Bruno'], ['c', 'Carla'], ['d', 'Dario']];
  localStorage.setItem('cambusa_members', JSON.stringify(membri.map(([id, name]) => ({ id, name, isChild: false }))));
  const meals = {};
  membri.forEach(([id]) => { meals[id] = P; });
  localStorage.setItem('cambusa_camp_data', JSON.stringify({
    '2026-08-11': { note: '', guestsNames: '', meals },
    '2026-08-12': { note: '', guestsNames: '', meals },
  }));
  if (!sessionStorage.getItem('__seminato')) {
    sessionStorage.setItem('__seminato', '1');
    localStorage.setItem('cambusa_purchases', JSON.stringify([
      { id: 'p1', name: 'Spesa grossa', price: 120, type: 'alimentare', buyer: 'Anna', at: 1 },
      { id: 'p2', name: 'Vino', price: 40, type: 'bevande', buyer: 'Bruno', at: 2 },
    ]));
    localStorage.setItem('cambusa_settled', '[]');
  }
  window.__mandati = [];
  navigator.share = async (d) => { window.__mandati.push(d.text); };
};

const righe = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)]
  .map((li) => li.textContent.replace(/\s+/g, ' ').replace(/[  ]/g, ' ').trim()), sel);

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: semina });
  const saldi = async () => {
    await menu('Spese Totali');
    await p.locator('main button:has-text("Saldi")').click();
    await p.waitForSelector('main h3');
  };

  // ---------- Si paga ----------
  await saldi();
  const prima = await righe(p, 'main li[data-da-fare]');
  ok(`da fare: Carla e Dario danno 40 € ad Anna (${prima.join(' | ')})`,
    prima.length === 2 && prima.every((r) => /→ Anna/.test(r) && /40[.,]00 €/.test(r)));
  for (let i = 0; i < 2; i++) {
    await p.locator('main li[data-da-fare]').first().click();
    await p.waitForFunction((n) => document.querySelectorAll('main li[data-pagato]').length === n, i + 1);
  }
  ok('pagati tutti e due, non manca niente', (await p.locator('main [data-tutti-fatti]').count()) === 1
    && (await p.locator('main li[data-da-fare]').count()) === 0);

  // ---------- Lo scontrino dimenticato ----------
  // Su main lo scontrino si registra a mano, dalla Lista.
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  { const m = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' }); if (await m.count()) await m.first().click(); }
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Pane');
  await p.locator('input[placeholder="0.00"]').first().fill('8');
  await p.locator('select').filter({ has: p.locator('option', { hasText: 'Carla' }) }).first().selectOption({ label: 'Carla' });
  await p.locator('button', { hasText: /Salva/ }).first().click();
  await p.waitForFunction(() => JSON.parse(localStorage.getItem('cambusa_purchases') || '[]').length === 3);
  await saldi();
  await p.waitForFunction(() => document.querySelectorAll('main li[data-da-fare]').length > 0);
  const dopo = await righe(p, 'main li[data-da-fare]');
  // 168 € su 16 pasti: 42 a testa. Carla ha dato 8 + 40: riceve 6.
  ok(`dopo lo scontrino compare solo la differenza: Carla riceve 6 € (${dopo.join(' | ')})`,
    dopo.length === 3 && dopo.every((r) => /→ Carla/.test(r) && /2[.,]00 €/.test(r)));
  ok('e i due rimborsi di prima restano fatti', (await p.locator('main li[data-pagato]').count()) === 2);

  // ---------- Il resoconto ----------
  await p.locator('main button', { hasText: /condividi/i }).first().click();
  await p.waitForFunction(() => window.__mandati.length > 0);
  const testo = (await p.evaluate(() => window.__mandati[0])).replace(/[  ]/g, ' ');
  const chiPaga = testo.split(/Già fatti/)[0];
  ok('il resoconto elenca i rimborsi già fatti a parte', /Già fatti/.test(testo) && /Carla → Anna: 40[.,]00 € ✓/.test(testo));
  ok('e fra quelli da fare mette solo quello che manca', !/→ Anna: 40[.,]00/.test(chiPaga) && /Dario → Carla: 2[.,]00 €/.test(chiPaga));

  // Annullare un rimborso segnato per sbaglio lo rimette fra quelli da fare.
  await p.locator('main li[data-pagato]').first().click();
  await p.waitForFunction(() => document.querySelectorAll('main li[data-pagato]').length === 1);
  const settled = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_settled')));
  ok(`toccando un rimborso fatto si annulla (${JSON.stringify(settled)})`, settled.length === 1);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
