// Le spese divise solo fra alcuni, a schermo (4 ottobre).
//
// Su main dal modulo a mano della Lista (Acquistato): «solo alcuni», si toccano i nomi, si salva. La spesa
// si ricorda fra chi va divisa, il conto separato non si chiede piu' (non
// c'entra), le Quote la mostrano con quanto tocca a ciascuno e i Saldi fanno
// pagare solo chi c'era. E dalla maschera di correzione si torna a «come
// sempre». Quando NON deve succedere niente: senza scegliere nessun nome, la
// spesa non si salva.
const { apri, ok, fine, attendi } = require('../lib/app');

const semina = () => {
  const P = { lunch: true, dinner: true };
  const membri = [['a', 'Anna'], ['b', 'Bruno'], ['c', 'Carla'], ['d', 'Dario']];
  localStorage.setItem('cambusa_members', JSON.stringify(membri.map(([id, name]) => ({ id, name, isChild: false }))));
  const meals = {};
  membri.forEach(([id]) => { meals[id] = P; });
  localStorage.setItem('cambusa_camp_data', JSON.stringify({ '2026-08-11': { note: '', guestsNames: '', meals }, '2026-08-12': { note: '', guestsNames: '', meals } }));
  localStorage.setItem('cambusa_sepdays', JSON.stringify(['2026-08-12']));
  if (!sessionStorage.getItem('__seminato')) {
    sessionStorage.setItem('__seminato', '1');
    localStorage.setItem('cambusa_purchases', JSON.stringify([{ id: 'p1', name: 'Spesa grossa', price: 160, type: 'alimentare', buyer: 'Anna', at: 1 }]));
  }
};
const acquisto = (p, nome) => p.evaluate((n) => JSON.parse(localStorage.getItem('cambusa_purchases')).find((x) => x.name === n), nome);

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: semina });
  await menu('Lista della Spesa');

  // ---------- Dal modulo a mano ----------
  await p.locator('main button', { hasText: /^acquistato/i }).first().click();
  { const m = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' }); if (await m.count()) await m.first().click(); }
  await p.waitForSelector('[data-fra-chi]');
  const f = p.locator('main');
  const conto = () => f.locator('label', { hasText: /^conto$/i }).count();
  ok('il modulo chiede fra chi si divide, e parte da «come sempre»', (await f.locator('[data-fra="tutti"]').getAttribute('aria-pressed')) === 'true');
  ok('e con un giorno separato chiede anche il conto', (await conto()) === 1);
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Benzina');
  await p.locator('input[placeholder="0.00"]').first().fill('30');
  await p.locator('select').filter({ has: p.locator('option', { hasText: 'Bruno' }) }).first().selectOption({ label: 'Bruno' });
  await f.locator('[data-fra="alcuni"]').click();
  ok('«solo alcuni» apre i nomi, e il conto separato non si chiede più', (await f.locator('[data-partecipante]').count()) === 4 && (await conto()) === 0);
  // Senza nomi non si salva.
  await f.locator('button', { hasText: /^salva$/i }).first().click();
  await p.waitForTimeout(400);   // qui si verifica che una spesa NON si salvi
  ok('senza nessun nome scelto la spesa non si salva', !(await acquisto(p, 'Benzina')));
  for (const n of ['Bruno', 'Carla', 'Dario']) await f.locator(`[data-partecipante="${n}"]`).click();
  ok('il modulo dice fra quanti', /fra 3 persone/i.test(await f.locator('[data-fra-chi]').innerText()));
  await f.locator('button', { hasText: /^salva$/i }).first().click();
  await attendi(p, () => JSON.parse(localStorage.getItem('cambusa_purchases')).some((x) => x.name === 'Benzina'));
  const benzina = await acquisto(p, 'Benzina');
  ok(`la spesa si ricorda fra chi va divisa (${JSON.stringify(benzina && benzina.per)})`, !!benzina && benzina.per.join(',') === 'b,c,d' && !benzina.account);
  await p.waitForSelector('[data-etichetta-fra]');
  ok('in cronologia ha la sua etichetta', /fra 3/i.test(await p.locator('li', { hasText: 'Benzina' }).first().innerText()));

  // ---------- Quote e saldi ----------
  await menu('Spese Totali');
  await p.locator('main button:has-text("Quote")').first().click();
  await attendi(p, () => !!document.querySelector('[data-quote-fra-alcuni]'));
  const q = (await p.locator('[data-quote-fra-alcuni]').innerText()).replace(/[  ]/g, ' ');
  ok(`le Quote mostrano la spesa e quanto tocca a ciascuno (${q.replace(/\s+/g, ' ').slice(0, 90)}…)`, /Benzina/.test(q) && /Carla 10[.,]00 €/.test(q) && !/Anna 10/.test(q));
  const pay = await p.evaluate(() => Object.fromEntries(window.__totali.breakdown.map((b) => [b.name, b.pay])));
  // 160 € su 16 pasti: 40 a testa. Benzina 10 a testa per i tre in macchina.
  ok(`e nei conti la paga solo chi c'era (${JSON.stringify(pay)})`, pay.Anna === 40 && pay.Bruno === 50 && pay.Carla === 50 && pay.Dario === 50);

  // ---------- Si torna a «come sempre» dalla correzione ----------
  await menu('Lista della Spesa');
  await p.locator('main button', { hasText: /^acquistato/i }).first().click();
  await p.waitForSelector('[data-etichetta-fra]');
  await p.locator('li', { hasText: 'Benzina' }).locator('button[aria-label="Correggi"]').first().click();
  await attendi(p, () => !!document.querySelector('[data-fra-chi]'));
  ok('la correzione riparte da «solo alcuni», con i nomi accesi', (await p.locator('[data-fra="alcuni"]').getAttribute('aria-pressed')) === 'true'
    && (await p.locator('[data-partecipante][aria-pressed="true"]').count()) === 3);
  await p.locator('[data-fra="tutti"]').click();
  await p.locator('button', { hasText: /^salva$/i }).last().click();
  await attendi(p, () => !JSON.parse(localStorage.getItem('cambusa_purchases')).find((x) => x.name === 'Benzina').per);
  ok('tornata «come sempre», la spesa non ha più chi', true);
  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
