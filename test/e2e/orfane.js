// Presenze rimaste senza padrone: quando un membro viene eliminato e
// riaggiunto, l'app gli dà un id nuovo e i pasti segnati prima restano
// attaccati al vecchio. Sparirebbero dai conti in silenzio.
const { apri, ok, fine } = require('../lib/app');

const contaPresenzeDi = (page, nome) => page.evaluate((n) => {
  const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
  const m = membri.find((x) => x.name === n);
  if (!m) return -1;
  const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
  let tot = 0;
  Object.keys(cd).forEach((g) => {
    const meals = (cd[g] && cd[g].meals) || {};
    const v = meals[m.id];
    if (v) tot += (v.lunch ? 1 : 0) + (v.dinner ? 1 : 0);
  });
  return tot;
}, nome);

(async () => {
  const { browser, page: p, menu, errori } = await apri();

  // --- Tre membri, presenze su due giorni ---
  await menu('Membri');
  for (const n of ['Lorenzo', 'Bruno', 'Anna']) {
    await p.fill('input[placeholder="Nome e cognome"]', n);
    await p.locator('button', { hasText: /^\+$/ }).first().click();
    await p.waitForTimeout(120);
  }
  await menu('Presenze');
  await p.locator('button', { hasText: 'Segna in blocco' }).first().click();
  await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'Tutti a pranzo' }).first().click();
  await p.waitForTimeout(250);
  await p.locator('button', { hasText: 'Tutti a cena' }).first().click();
  await p.waitForTimeout(400);
  ok('Bruno parte con 2 pasti', (await contaPresenzeDi(p, 'Bruno')) === 2);
  ok('nessun avviso finché è tutto in ordine', !/presenze senza padrone/i.test(await p.locator('main').innerText()));

  // --- Bruno viene eliminato e riaggiunto: è il caso vero ---
  await menu('Membri');
  await p.locator('li', { hasText: 'Bruno' }).locator('button[aria-label^="Togli"]').first().click();
  await p.waitForTimeout(300);
  await p.fill('input[placeholder="Nome e cognome"]', 'Bruno');
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(300);
  ok('il Bruno nuovo è in elenco ma senza pasti', (await contaPresenzeDi(p, 'Bruno')) === 0);

  // --- L'app se ne accorge ---
  await menu('Presenze');
  const avviso = await p.locator('main').innerText();
  ok('compare l\'avviso delle presenze senza padrone', /presenze senza padrone/i.test(avviso));
  ok('dice di chi erano, per nome', /Bruno/.test(avviso));
  ok('dice quanti pasti e quanti giorni', /2 pasti su 1 giorno/i.test(avviso));

  // Anche il Calendario lo segnala, per chi non apre Presenze.
  await menu('Calendario');
  ok('il Calendario lo segnala', /presenze non contano nei conti/i.test(await p.locator('main').innerText()));
  await menu('Presenze');
  await p.waitForTimeout(300);

  // --- Riassegnazione ---
  ok('senza scegliere la persona non si può riassegnare',
    await p.locator('button', { hasText: 'Riassegna' }).first().isDisabled());
  await p.locator('main select').first().selectOption({ label: 'Bruno' });
  await p.waitForTimeout(200);
  await p.locator('button', { hasText: 'Riassegna' }).first().click();
  await p.waitForTimeout(600);

  ok('i pasti tornano al Bruno giusto', (await contaPresenzeDi(p, 'Bruno')) === 2);
  ok('l\'avviso sparisce', !/presenze senza padrone/i.test(await p.locator('main').innerText()));
  ok('gli altri non sono stati toccati', (await contaPresenzeDi(p, 'Anna')) === 2 && (await contaPresenzeDi(p, 'Lorenzo')) === 2);

  // --- I pasti già segnati non vengono sovrascritti, si sommano ---
  await menu('Membri');
  await p.locator('li', { hasText: 'Anna' }).locator('button[aria-label^="Togli"]').first().click();
  await p.waitForTimeout(300);
  await p.fill('input[placeholder="Nome e cognome"]', 'Anna');
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(300);
  await menu('Presenze');
  // La nuova Anna viene segnata solo a pranzo; le orfane hanno pranzo E cena.
  await p.locator('li', { hasText: 'Anna' }).locator('button', { hasText: 'Pranzo' }).first().click();
  await p.waitForTimeout(300);
  ok('la nuova Anna ha 1 pasto', (await contaPresenzeDi(p, 'Anna')) === 1);
  await p.locator('main select').first().selectOption({ label: 'Anna' });
  await p.waitForTimeout(200);
  await p.locator('button', { hasText: 'Riassegna' }).first().click();
  await p.waitForTimeout(600);
  ok('riassegnando i pasti si sommano invece di sostituirsi', (await contaPresenzeDi(p, 'Anna')) === 2);

  // --- "Butta" toglie le orfane senza toccare nessun altro ---
  await menu('Membri');
  await p.locator('li', { hasText: 'Lorenzo' }).locator('button[aria-label^="Togli"]').first().click();
  await p.waitForTimeout(300);
  await menu('Presenze');
  ok('anche senza riaggiungerlo, le sue presenze risultano senza padrone',
    /presenze senza padrone/i.test(await p.locator('main').innerText()));
  await p.locator('button', { hasText: 'Butta' }).first().click();
  await p.waitForTimeout(600);
  ok('buttandole l\'avviso sparisce', !/presenze senza padrone/i.test(await p.locator('main').innerText()));
  ok('e gli altri restano intatti', (await contaPresenzeDi(p, 'Bruno')) === 2 && (await contaPresenzeDi(p, 'Anna')) === 2);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
