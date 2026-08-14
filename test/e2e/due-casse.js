// Due casse, due rimborsi identici: spuntarne uno non deve spuntare l'altro.
//
// La cassa comune e la cassa separata producono ognuna il suo "chi paga chi".
// Puo' capitare — e capita, perche' le persone sono sempre le stesse — che le
// due casse generino lo stesso identico passaggio: stesse persone, stessa
// cifra. Se la riga saldata si riconosce solo da "chi → chi @ quanto", quei
// due passaggi diventano la stessa cosa: si spunta il rimborso della cena
// fuori e sparisce anche quello della spesa comune, o viceversa. Sono soldi
// veri che nessuno rivede.
//
// Qui si costruisce apposta la collisione e si controlla che le due righe
// restino indipendenti.
const { apri, ok, fine } = require('../lib/app');

const COMUNE = '2026-08-11';
const SEPARATO = '2026-08-12';

// Due giorni, due persone, due spese da 40 € anticipate sempre da Alice: in
// tutte e due le casse viene fuori "Bruno → Alice 20,00 €".
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

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: semina });

  await menu('Spese Totali');
  await p.locator('main button:has-text("Saldi")').click();
  await p.waitForTimeout(400);

  // Le due schede ci sono e ognuna ha il suo passaggio.
  const titoli = await p.locator('main h3').allInnerTexts();
  ok('ci sono le due casse (' + titoli.join(' | ') + ')',
    titoli.some((t) => /Saldi cassa comune/.test(t)) && titoli.some((t) => /Saldi cassa separata/.test(t)));

  const righe = p.locator('main li').filter({ hasText: '→' });
  const nRighe = await righe.count();
  const testi = await righe.allInnerTexts();
  ok(`due passaggi identici, uno per cassa (${testi.map((t) => t.replace(/\s+/g, ' ').trim()).join(' | ')})`,
    nRighe === 2 && testi.every((t) => /Bruno/.test(t) && /Alice/.test(t) && /20\.00/.test(t)));

  // Si spunta SOLO il primo.
  await righe.first().click();
  await p.waitForTimeout(400);

  const spuntate = await p.evaluate(() => [...document.querySelectorAll('main li')]
    .filter((li) => li.textContent.includes('→'))
    .map((li) => li.textContent.includes('✓')));
  ok(`spuntando il primo rimborso si segna solo quello (${JSON.stringify(spuntate)})`,
    spuntate.length === 2 && spuntate[0] === true && spuntate[1] === false);

  // E in memoria resta una chiave sola: quella della cassa toccata.
  const salvati = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_settled') || '[]'));
  ok(`in memoria c'è una chiave sola (${JSON.stringify(salvati)})`, salvati.length === 1);

  // Spuntando anche il secondo, le chiavi devono essere DUE e diverse: se
  // fossero uguali la seconda spunta cancellerebbe la prima.
  await righe.nth(1).click();
  await p.waitForTimeout(400);
  const salvati2 = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_settled') || '[]'));
  ok(`le due casse hanno chiavi distinte (${JSON.stringify(salvati2)})`,
    salvati2.length === 2 && salvati2[0] !== salvati2[1]);

  const spuntate2 = await p.evaluate(() => [...document.querySelectorAll('main li')]
    .filter((li) => li.textContent.includes('→'))
    .map((li) => li.textContent.includes('✓')));
  ok('e alla fine sono segnati tutti e due', spuntate2.length === 2 && spuntate2.every(Boolean));

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
