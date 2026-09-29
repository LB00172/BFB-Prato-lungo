// Soldi che non finiscono nella quota di nessuno.
//
// Se una cassa ha dentro dei soldi ma nessun pasto su cui dividerli, la sua
// quota a pasto viene zero e quei soldi restano fuori da tutte le quote.
// Finivano dentro lo "scarto", e la riconciliazione — nata per limare qualche
// centesimo — se li spalmava addosso a chi capitava, 10 cent alla volta:
// 100 € di "conto separato" senza giorni separati spuntati diventavano 50 € a
// testa per due persone che non c'entravano niente, sotto l'etichetta
// "arrotondamento". Nessun avviso, conti sbagliati, e nessuno in grado di
// accorgersene.
const { apri, ok, fine } = require('../lib/app');

const aggiungi = async (p, nome) => {
  await p.fill('input[placeholder="Nome e cognome"]', nome);
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(200);
};

// Registra una spesa a mano scegliendo il conto (comune o separato).
const spesa = async (p, nome, prezzo, conto) => {
  const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' });
  if (await b.count()) { await b.first().click(); await p.waitForTimeout(300); }
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', nome);
  await p.locator('input[data-cifra]').first().fill(String(prezzo));
  if (conto) await p.locator('select').filter({ hasText: 'Conto comune' }).first().selectOption(conto);
  await p.locator('button', { hasText: /Salva/ }).first().click();
  await p.waitForTimeout(500);
};

const quote = (p) => p.evaluate(() => {
  const righe = [...document.querySelectorAll('li')]
    .filter((li) => /€/.test(li.textContent) && /pasti|pasto/.test(li.textContent));
  return righe.map((li) => li.textContent.replace(/\s+/g, ' ').trim());
});

(async () => {
  const { browser, page: p, menu, errori } = await apri();

  await menu('Membri');
  await aggiungi(p, 'Anna');
  await aggiungi(p, 'Bruno');

  // Due giorni, tutti e due a pranzo e cena: 8 pasti in tutto. Piu' avanti uno
  // dei due diventera' "conto separato", cosi' entrambe le casse hanno pasti.
  const segnaGiorno = async (i) => {
    await menu('Calendario');
    await p.locator('.grid.grid-cols-7 button').nth(i).click();
    await p.waitForTimeout(250);
    await menu('Presenze');
    await p.waitForTimeout(250);
    for (const n of ['Anna', 'Bruno']) {
      for (const pasto of ['Pranzo', 'Cena']) {
        await p.locator('li', { hasText: n }).locator('button', { hasText: pasto }).first().click();
        await p.waitForTimeout(150);
      }
    }
  };
  await segnaGiorno(2);
  await segnaGiorno(3);

  // 60 € sul conto comune + 100 € sul conto separato, ma NESSUN giorno
  // spuntato come separato in Calendario.
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  await spesa(p, 'Spesa comune', 60);
  await spesa(p, 'Cena fuori', 100, 'sep');

  await menu('Spese Totali');
  await p.locator('button', { hasText: /^Quote$/ }).first().click();
  await p.waitForTimeout(500);
  const testo = await p.locator('main').innerText();

  // --- Le quote devono restare quelle giuste: 30 € a testa, non 80 ---
  const q = await quote(p);
  ok(`le quote non vengono gonfiate dai soldi non ripartiti (${q.join(' | ')})`,
    q.some((r) => /30[.,]00 €/.test(r)) && !q.some((r) => /80[.,]00 €/.test(r)));

  // --- E il buco si deve VEDERE, con la cifra e il motivo ---
  ok('l\'app dice che dei soldi non sono nelle quote di nessuno', /100[.,]00 € non sono nelle quote di nessuno/i.test(testo));
  ok('dice il motivo esatto', /nessun giorno è spuntato come separato/i.test(testo));
  ok('e dice che chi ha anticipato resta scoperto', /non li riavrebbe indietro|resterebbe scoperto/i.test(testo));
  ok('NON lo chiama arrotondamento', !/arrotondamento/i.test(testo.split('non sono nelle quote')[1] || ''));

  // --- Anche nei Saldi, dove si guarda chi paga chi ---
  await p.locator('button', { hasText: 'Saldi' }).first().click();
  await p.waitForTimeout(400);
  const saldi = await p.locator('main').innerText();
  ok('nei Saldi si dice che i rimborsi non quadrano', /rimborsi non quadrano/i.test(saldi));

  // --- E nel resoconto che finisce nel gruppo ---
  const report = await p.evaluate(() => {
    // Il resoconto esce dal tasto "Condividi": senza navigator.share la app
    // apre WhatsApp con il testo nell'indirizzo. Si intercetta quello.
    let preso = '';
    delete navigator.share;
    window.open = (url) => { preso = decodeURIComponent(String(url).split('text=')[1] || ''); return null; };
    const b = [...document.querySelectorAll('button')].find((x) => /condividi/i.test(x.textContent));
    if (b) b.click();
    return new Promise((r) => setTimeout(() => r(preso), 500));
  });
  if (report) {
    ok('il resoconto avvisa che i conti non sono completi', /CONTI NON COMPLETI/.test(report));
    ok('e riporta la cifra', /100[.,]00 €/.test(report));
  } else {
    ok('il resoconto è stato generato', false);
  }

  // --- Ora si spunta il giorno come separato: il buco si chiude ---
  await menu('Calendario');
  await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'Conto separato' }).first().click();
  await p.waitForTimeout(400);
  const oggi = await p.evaluate(() => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const con = Object.keys(cd).filter((g) => Object.keys((cd[g] || {}).meals || {}).length).sort();
    return con[con.length - 1] || '';
  });
  const spuntato = await p.evaluate((g) => {
    const giorno = String(parseInt(g.slice(8), 10));
    const et = [...document.querySelectorAll('label')]
      .filter((l) => l.querySelector('input[type="checkbox"]'));
    const mio = et.find((l) => l.textContent.trim() === giorno);
    if (!mio) return { trovati: et.length, fatto: false };
    mio.querySelector('input[type="checkbox"]').click();
    return { trovati: et.length, fatto: true };
  }, oggi);
  ok(`il riquadro del conto separato si apre e si spunta il giorno (${spuntato.trovati} caselle)`, spuntato.fatto);
  await p.waitForTimeout(700);

  await menu('Spese Totali');
  await p.locator('button', { hasText: /^Quote$/ }).first().click();
  await p.waitForTimeout(500);
  const dopo = await p.locator('main').innerText();
  ok('spuntando il giorno separato il buco si chiude', !/non sono nelle quote di nessuno/i.test(dopo));
  // Le quote stanno in due casse: la somma delle due deve fare 80 a testa, e
  // la scheda "Totale a persona" deve dirlo senza farlo fare a mente.
  const q2 = await quote(p);
  const sommaQuote = (nome) => q2
    .filter((r) => r.startsWith(nome))
    .reduce((a2, r) => {
      const mm = r.match(/(\d+[.,]\d{2}) €/);
      return a2 + (mm ? parseFloat(mm[1].replace(',', '.')) : 0);
    }, 0);
  const totPersona = await p.locator('h3:has-text("Totale a persona")').locator('..').innerText();
  ok(`e ora le quote comprendono tutto (${q2.join(' | ')})`,
    sommaQuote('Anna') === 80 && sommaQuote('Bruno') === 80 && /80,00 €/.test(totPersona));

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
