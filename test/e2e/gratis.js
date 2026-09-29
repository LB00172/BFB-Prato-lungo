// Giorni gratis: quel giorno esce da TUTTI i conti.
//
// Serve per la sera che offre qualcuno, o per la cena fuori pagata a parte:
// le presenze restano segnate (la cucina deve sapere per quanti cucinare) ma
// nessuno le paga. Il caso che conta davvero è chi è venuto SOLO quel giorno:
// deve pagare zero, quota di logistica compresa.
const { apri, ok, fine } = require('../lib/app');

const aggiungi = async (p, nome) => {
  await p.fill('input[placeholder="Nome e cognome"]', nome);
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(200);
};

// Va sul giorno i della striscia e segna pranzo+cena alle persone indicate.
const segna = async (p, menu, i, chi) => {
  await menu('Calendario');
  await p.locator('.grid.grid-cols-7 button').nth(i).click();
  await p.waitForTimeout(250);
  await menu('Presenze');
  await p.waitForTimeout(250);
  for (const n of chi) {
    for (const pasto of ['Pranzo', 'Cena']) {
      await p.locator('li', { hasText: n }).locator('button', { hasText: pasto }).first().click();
      await p.waitForTimeout(140);
    }
  }
};

// Quota di ciascuno, letta dalla scheda Quote.
const quote = (p) => p.evaluate(() => {
  const out = {};
  [...document.querySelectorAll('li')].forEach((li) => {
    const t = li.textContent.replace(/\s+/g, ' ').trim();
    const m = t.match(/^([A-Za-zÀ-ú]+)\d+ pasti?.*?([\d.,]+) €$/);
    if (m) out[m[1]] = parseFloat(m[2].replace(',', '.'));
    else {
      const g = t.match(/^([A-Za-zÀ-ú]+)\d+ pasti?.*?Gratis$/);
      if (g) out[g[1]] = 0;
    }
  });
  return out;
});

const apriQuote = async (p, menu) => {
  await menu('Spese Totali');
  await p.locator('button', { hasText: /^Quote$/ }).first().click();
  await p.waitForTimeout(500);
};

(async () => {
  const { browser, page: p, menu, errori } = await apri();
  const chiesto = [];
  p.removeAllListeners('dialog');
  p.on('dialog', async (d) => { chiesto.push(d.message()); await d.accept(); });

  await menu('Membri');
  for (const n of ['Anna', 'Bruno', 'Carlo']) await aggiungi(p, n);

  // Giorno A: ci sono Anna e Bruno. Giorno B: c'è solo Carlo.
  await segna(p, menu, 2, ['Anna', 'Bruno']);
  await segna(p, menu, 3, ['Carlo']);

  // 120 € di cibo + 30 € di logistica.
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  const spesa = async (nome, prezzo, tipo) => {
    const b = p.locator('main button', { hasText: 'Registra una spesa' });
    if (await b.count()) { await b.first().click(); await p.waitForTimeout(300); }
    await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', nome);
    await p.locator('input[data-cifra]').first().fill(String(prezzo));
    if (tipo) await p.locator(`[data-foglio-spesa] [data-tipo="${tipo}"]`).click();
    await p.locator('button', { hasText: /Salva/ }).first().click();
    await p.waitForTimeout(500);
  };
  await spesa('Cibo', 120);
  await spesa('Gas e piatti', 30, 'logistica');

  await apriQuote(p, menu);
  const prima = await quote(p);
  ok(`si parte con le quote piene (${JSON.stringify(prima)})`,
    prima.Anna > 0 && prima.Bruno > 0 && prima.Carlo > 0);
  const totalePrima = prima.Anna + prima.Bruno + prima.Carlo;
  ok(`e la somma fa il totale speso (${totalePrima.toFixed(2)} €)`, Math.abs(totalePrima - 150) < 0.05);

  // --- Il giorno di Carlo diventa gratis ---
  await menu('Calendario');
  await p.locator('.grid.grid-cols-7 button').nth(3).click();
  await p.waitForTimeout(250);
  await menu('Presenze');
  await p.waitForTimeout(300);
  ok('il tasto c\'è (modalità tecnica)', (await p.locator('button', { hasText: 'Rendi questo giorno gratis' }).count()) > 0);

  chiesto.length = 0;
  await p.locator('button', { hasText: 'Rendi questo giorno gratis' }).first().click();
  await p.waitForTimeout(700);
  ok('chiede conferma spiegando cosa succede', /escono da TUTTI i conti/i.test(chiesto[0] || ''));
  ok('e avverte che la spesa già registrata non sparisce', /si divide sugli altri giorni/i.test(chiesto[0] || ''));

  const testo = await p.locator('main').innerText();
  ok('il giorno si vede come gratis', /giorno gratis/i.test(testo));
  ok('le presenze restano segnate per la cucina',
    (await p.evaluate(() => {
      const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
      let n = 0;
      Object.keys(cd).forEach((g) => {
        const meals = (cd[g] || {}).meals || {};
        Object.keys(meals).forEach((k) => { if (meals[k].lunch || meals[k].dinner) n++; });
      });
      return n;
    })) === 3);

  // --- L'effetto sui conti ---
  await apriQuote(p, menu);
  const dopo = await quote(p);
  ok(`Carlo, venuto solo nel giorno gratis, non paga più niente (${dopo.Carlo} €)`, dopo.Carlo === 0);
  ok('e non paga nemmeno la quota di logistica', dopo.Carlo === 0);
  ok(`Anna e Bruno si dividono tutto (${dopo.Anna} + ${dopo.Bruno})`,
    Math.abs(dopo.Anna + dopo.Bruno - 150) < 0.05);
  ok('la somma delle quote fa ancora il totale speso',
    Math.abs((dopo.Anna + dopo.Bruno + dopo.Carlo) - 150) < 0.05);

  const q = await p.locator('main').innerText();
  ok('le Quote spiegano perché i pasti contati sono meno', /1 giorno gratis/i.test(q) && /pasti sono esclusi|pasto è escluso/i.test(q));

  // --- E si torna indietro ---
  await menu('Presenze');
  await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'rimettilo nei conti' }).first().click();
  await p.waitForTimeout(700);
  await apriQuote(p, menu);
  const tornato = await quote(p);
  ok(`rimettendolo nei conti Carlo torna a pagare (${tornato.Carlo} €)`, tornato.Carlo > 0);
  ok('e le quote tornano quelle di prima',
    Math.abs(tornato.Anna - prima.Anna) < 0.05 && Math.abs(tornato.Carlo - prima.Carlo) < 0.05);

  // --- Un utente normale non può toccarlo ---
  await p.addInitScript(() => localStorage.removeItem('cambusa_admin'));
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await menu('Presenze');
  await p.waitForTimeout(400);
  ok('senza modalità tecnica il tasto non c\'è',
    (await p.locator('button', { hasText: /Rendi questo giorno gratis|rimettilo nei conti/ }).count()) === 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
