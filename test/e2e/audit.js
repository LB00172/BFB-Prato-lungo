// Audit delle funzioni logiche e di ripartizione della spesa.
// Semina i dati reali in localStorage, apre l'app e legge i numeri MOSTRATI,
// poi verifica le invarianti contabili. Nessuna logica duplicata: si testa
// il codice vero dell'app.
const { chromium } = require('playwright-core');

const DAY = '2026-08-11';
const DAY2 = '2026-08-12';
const DAY3 = '2026-08-13';
const D = { lunch: false, dinner: true };   // solo cena
const NESSUNO = { note: '', guestsNames: '', meals: {} };  // giorno senza nessuno

const m = (id, name, isChild) => ({ id, name, isChild: !!isChild });
const meals = (obj) => ({ [DAY]: { note: '', guestsNames: '', meals: obj } });
const buy = (id, name, price, type, buyer) => ({ id, name, price, type, buyer: buyer || '', at: Date.now() });
const buySep = (id, name, price, type, buyer) => ({ id, name, price, type, buyer: buyer || '', at: Date.now(), account: 'sep' });
const eq = (id, text, price, bought, buyer) => ({ id, text, price, bought: !!bought, buyer: buyer || '' });
const L = { lunch: true, dinner: false };
const LD = { lunch: true, dinner: true };

const scenari = [
  {
    nome: '1. Base: 3 adulti 1 pasto, cibo 90 anticipato da Alice',
    membri: [m('a', 'Alice'), m('b', 'Bruno'), m('c', 'Carlo')],
    presenze: meals({ a: L, b: L, c: L }),
    acquisti: [buy('p1', 'Cibo', 90, 'alimentare', 'Alice')],
    attrezzatura: [],
    attese: { totale: 90, quote: { Alice: 30, Bruno: 30, Carlo: 30 }, saldi: { Alice: 60, Bruno: -30, Carlo: -30 } },
  },
  {
    nome: '2. Bambini gratis: 2 adulti + 1 bambino, cibo 60',
    membri: [m('a', 'Alice'), m('b', 'Bruno'), m('k', 'Cleo', true)],
    presenze: meals({ a: L, b: L, k: L }),
    acquisti: [buy('p1', 'Cibo', 60, 'alimentare', 'Alice')],
    attrezzatura: [],
    attese: { totale: 60, quote: { Alice: 30, Bruno: 30, Cleo: 0 }, saldi: { Alice: 30, Bruno: -30 } },
  },
  {
    nome: '3. Logistica a quota fissa: 2 adulti, uno mangia 4 pasti',
    membri: [m('a', 'Alice'), m('b', 'Bruno')],
    presenze: { [DAY]: { note: '', guestsNames: '', meals: { a: LD, b: L } },
                [DAY2]: { note: '', guestsNames: '', meals: { a: LD } } },
    acquisti: [buy('p1', 'Cibo', 50, 'alimentare'), buy('p2', 'Generatore', 30, 'logistica')],
    attrezzatura: [],
    // cibo 50/5 pasti = 10 -> Alice 4 pasti = 40, Bruno 1 = 10; logistica 30/2 = 15 a testa
    attese: { totale: 80, quote: { Alice: 55, Bruno: 25 } },
  },
  {
    nome: '4. Attrezzatura con acquirente: gazebo 40 comprato da Alice',
    membri: [m('a', 'Alice'), m('b', 'Bruno')],
    presenze: meals({ a: L, b: L }),
    acquisti: [],
    attrezzatura: [eq('e1', 'Gazebo', 40, true, 'Alice')],
    attese: { totale: 40, quote: { Alice: 20, Bruno: 20 }, saldi: { Alice: 20, Bruno: -20 } },
  },
  {
    nome: '5. Attrezzatura NON spuntata: non deve entrare nei totali',
    membri: [m('a', 'Alice'), m('b', 'Bruno')],
    presenze: meals({ a: L, b: L }),
    acquisti: [buy('p1', 'Cibo', 20, 'alimentare', 'Alice')],
    attrezzatura: [eq('e1', 'Corda', 99, false, 'Alice')],
    attese: { totale: 20, quote: { Alice: 10, Bruno: 10 } },
  },
  {
    nome: '6. Arrotondamento sotto soglia: cibo 100 su 3 pasti',
    membri: [m('a', 'Alice'), m('b', 'Bruno'), m('c', 'Carlo')],
    presenze: meals({ a: L, b: L, c: L }),
    acquisti: [buy('p1', 'Cibo', 100, 'alimentare', 'Alice')],
    attrezzatura: [],
    // 33,333 -> 33,30 a testa = 99,90 (scarto -0,10, sotto 0,50: non riconciliato)
    attese: { totale: 100, quote: { Alice: 33.3, Bruno: 33.3, Carlo: 33.3 }, raccolto: 99.9 },
  },
  {
    nome: '7. Membro presente senza pasti: non paga nulla',
    membri: [m('a', 'Alice'), m('b', 'Bruno'), m('z', 'Zero')],
    presenze: meals({ a: L, b: L }),
    acquisti: [buy('p1', 'Cibo', 40, 'alimentare'), buy('p2', 'Gasolio', 20, 'logistica')],
    attrezzatura: [],
    attese: { totale: 60, quote: { Alice: 30, Bruno: 30, Zero: 0 } },
  },
  {
    nome: '8. Spese senza nessun pasto registrato (divisione per zero)',
    membri: [m('a', 'Alice'), m('b', 'Bruno')],
    presenze: {},
    acquisti: [buy('p1', 'Cibo', 50, 'alimentare', 'Alice')],
    attrezzatura: [],
    attese: { totale: 50, quote: { Alice: 0, Bruno: 0 } },
  },
  {
    nome: '9. Solo bambini presenti: nessun adulto su cui ripartire',
    membri: [m('k1', 'Cleo', true), m('k2', 'Dino', true)],
    presenze: meals({ k1: L, k2: L }),
    acquisti: [buy('p1', 'Cibo', 30, 'alimentare')],
    attrezzatura: [],
    attese: { totale: 30, quote: { Cleo: 0, Dino: 0 } },
  },
  {
    nome: '10. Due anticipatori diversi: pareggio incrociato',
    membri: [m('a', 'Alice'), m('b', 'Bruno'), m('c', 'Carlo')],
    presenze: meals({ a: L, b: L, c: L }),
    acquisti: [buy('p1', 'Cibo', 60, 'alimentare', 'Alice'), buy('p2', 'Bevande', 30, 'bevande', 'Bruno')],
    attrezzatura: [],
    // totale 90, quota 30 a testa: Alice +30, Bruno 0, Carlo -30
    attese: { totale: 90, quote: { Alice: 30, Bruno: 30, Carlo: 30 }, saldi: { Alice: 30, Bruno: 0, Carlo: -30 } },
  },
  {
    nome: '11. Conto separato: giorno 11 solo per Alice e Bruno, giorno 12 di tutti',
    membri: [m('a', 'Alice'), m('b', 'Bruno'), m('c', 'Carlo'), m('d', 'Dino')],
    presenze: { [DAY]:  { note: '', guestsNames: '', meals: { a: LD, b: LD } },
                [DAY2]: { note: '', guestsNames: '', meals: { a: L, b: L, c: L, d: L } } },
    giorniSeparati: [DAY],
    acquisti: [buySep('p1', 'Spesa dell-11', 80, 'alimentare', 'Alice'),
               buy('p2', 'Spesa comune', 100, 'alimentare', 'Carlo')],
    attrezzatura: [],
    // separato: 80 / 4 pasti = 20 -> Alice e Bruno 2 pasti = 40 ciascuno
    // comune:  100 / 4 pasti = 25 -> tutti e quattro 1 pasto = 25
    attese: { totale: 180,
              quote: { Alice: 65, Bruno: 65, Carlo: 25, Dino: 25 },
              saldi: { Alice: 15, Bruno: -65, Carlo: 75, Dino: -25 } },
  },
  {
    nome: '12. Chi non c-era nei giorni separati non paga quella spesa',
    membri: [m('a', 'Alice'), m('b', 'Bruno'), m('c', 'Carlo')],
    presenze: { [DAY]:  { note: '', guestsNames: '', meals: { a: L, b: L } },
                [DAY2]: { note: '', guestsNames: '', meals: { c: L } } },
    giorniSeparati: [DAY],
    acquisti: [buySep('p1', 'Spesa separata', 60, 'alimentare', 'Alice'),
               buy('p2', 'Spesa comune', 30, 'alimentare', 'Carlo')],
    attrezzatura: [],
    attese: { totale: 90, quote: { Alice: 30, Bruno: 30, Carlo: 30 },
              saldi: { Alice: 30, Bruno: -30, Carlo: 0 } },
  },
  {
    nome: '13. Logistica resta di tutti anche con i giorni separati',
    membri: [m('a', 'Alice'), m('b', 'Bruno'), m('c', 'Carlo')],
    presenze: { [DAY]:  { note: '', guestsNames: '', meals: { a: L, b: L } },
                [DAY2]: { note: '', guestsNames: '', meals: { c: L } } },
    giorniSeparati: [DAY],
    acquisti: [buySep('p1', 'Cibo separato', 40, 'alimentare', 'Alice'),
               buy('p2', 'Gasolio', 30, 'logistica', 'Carlo')],
    attrezzatura: [],
    // cibo separato 40/2 = 20 ad Alice e Bruno; logistica 30/3 presenti = 10 a testa
    attese: { totale: 70, quote: { Alice: 30, Bruno: 30, Carlo: 10 },
              saldi: { Alice: 10, Bruno: -30, Carlo: 20 } },
  },
  {
    nome: '14. Giorni separati senza spese separate: quei pasti non costano',
    membri: [m('a', 'Alice'), m('b', 'Bruno')],
    presenze: { [DAY]:  { note: '', guestsNames: '', meals: { a: L } },
                [DAY2]: { note: '', guestsNames: '', meals: { a: L, b: L } } },
    giorniSeparati: [DAY],
    acquisti: [buy('p1', 'Spesa comune', 50, 'alimentare', 'Alice')],
    attrezzatura: [],
    attese: { totale: 50, quote: { Alice: 25, Bruno: 25 }, saldi: { Alice: 25, Bruno: -25 } },
  },
  {
    nome: '15. Senza giorni spuntati tutto si comporta come prima',
    membri: [m('a', 'Alice'), m('b', 'Bruno'), m('c', 'Carlo')],
    presenze: meals({ a: L, b: L, c: L }),
    giorniSeparati: [],
    acquisti: [buy('p1', 'Cibo', 90, 'alimentare', 'Alice')],
    attrezzatura: [],
    attese: { totale: 90, quote: { Alice: 30, Bruno: 30, Carlo: 30 }, saldi: { Alice: 60, Bruno: -30, Carlo: -30 } },
  },
  {
    nome: '16. Giorni interi senza nessuno segnato: non devono contare',
    membri: [m('a', 'Alice'), m('b', 'Bruno')],
    presenze: { [DAY]:  { note: '', guestsNames: '', meals: { a: LD, b: LD } },
                [DAY2]: NESSUNO,
                [DAY3]: { note: 'nessuno a tavola', guestsNames: '', meals: { a: { lunch: false, dinner: false } } } },
    acquisti: [buy('p1', 'Cibo', 40, 'alimentare', 'Alice')],
    attrezzatura: [],
    // solo i 4 pasti dell-11 contano: 40/4 = 10 -> 20 a testa
    attese: { totale: 40, quote: { Alice: 20, Bruno: 20 }, saldi: { Alice: 20, Bruno: -20 } },
  },
  {
    nome: '17. Pranzo senza nessuno: conta solo la cena',
    membri: [m('a', 'Alice'), m('b', 'Bruno')],
    presenze: { [DAY]: { note: '', guestsNames: '', meals: { a: D, b: D } } },
    acquisti: [buy('p1', 'Cibo', 30, 'alimentare', 'Alice')],
    attrezzatura: [],
    // 2 cene, nessun pranzo: 30/2 = 15 a testa
    attese: { totale: 30, quote: { Alice: 15, Bruno: 15 }, saldi: { Alice: 15, Bruno: -15 } },
  },
  {
    nome: '18. Conto separato: giorno spuntato ma senza nessuno a tavola',
    membri: [m('a', 'Alice'), m('b', 'Bruno'), m('c', 'Carlo')],
    presenze: { [DAY]:  { note: '', guestsNames: '', meals: { a: L, b: L } },
                [DAY2]: NESSUNO,
                [DAY3]: { note: '', guestsNames: '', meals: { c: L } } },
    giorniSeparati: [DAY, DAY2],
    acquisti: [buySep('p1', 'Spesa separata', 50, 'alimentare', 'Alice'),
               buy('p2', 'Spesa comune', 10, 'alimentare', 'Carlo')],
    attrezzatura: [],
    // separato: 50 / 2 pasti (il 12 non conta) = 25 -> Alice e Bruno 25
    // comune: 10 / 1 pasto = 10 -> Carlo 10
    attese: { totale: 60, quote: { Alice: 25, Bruno: 25, Carlo: 10 },
              saldi: { Alice: 25, Bruno: -25, Carlo: 0 } },
  },
  {
    nome: '19. Acquirente scritto a mano che non e un membro: va segnalato',
    membri: [m('a', 'Alice'), m('b', 'Bruno')],
    presenze: meals({ a: L, b: L }),
    acquisti: [buy('p1', 'Cibo', 40, 'alimentare', 'Alicia')],   // refuso
    attrezzatura: [],
    attese: { totale: 40, quote: { Alice: 20, Bruno: 20 }, avvisoSconosciuto: 'Alicia' },
  },
  {
    nome: '20. Campo intero disordinato: 6 adulti, 2 bambini, 6 giorni, conto separato',
    membri: [m('a', 'Alice'), m('b', 'Bruno'), m('c', 'Carlo'), m('d', 'Dina'),
             m('e', 'Elio'), m('f', 'Fabio'), m('k1', 'Gigi', true), m('k2', 'Lea', true)],
    presenze: {
      '2026-08-11': { note: '', guestsNames: '', meals: { a: LD, b: LD, k1: LD } },
      '2026-08-12': { note: '', guestsNames: '', meals: { a: LD, b: L, k1: LD } },
      '2026-08-13': { note: '', guestsNames: '', meals: { a: LD, b: LD, c: LD, d: L, e: LD, f: D, k1: LD, k2: LD } },
      '2026-08-14': { note: '', guestsNames: '', meals: { a: L, b: LD, c: LD, d: LD, e: L, f: LD, k2: LD } },
      '2026-08-15': { note: '', guestsNames: '', meals: { c: LD, d: LD, e: LD, f: LD, k2: L } },
      '2026-08-16': { note: '', guestsNames: '', meals: { c: L, d: L, e: L } },
    },
    giorniSeparati: ['2026-08-11', '2026-08-12'],
    acquisti: [
      buySep('s1', 'Spesa dei primi due giorni', 128.4, 'alimentare', 'Alice'),
      buySep('s2', 'Birre dei primi due giorni', 31.6, 'bevande', 'Bruno'),
      buy('p1', 'Spesa grossa', 412.35, 'alimentare', 'Carlo'),
      buy('p2', 'Carne', 96.9, 'alimentare', 'Dina'),
      buy('p3', 'Acqua e bibite', 58.2, 'bevande', 'Elio'),
      buy('p4', 'Vino', 44, 'bevande', 'Alice'),
      buy('p5', 'Carbonella e ghiaccio', 37.7, 'logistica', 'Fabio'),
      buy('p6', 'Gasolio generatore', 25, 'logistica', 'Carlo'),
    ],
    attrezzatura: [eq('e1', 'Gazebo', 89.9, true, 'Dina'), eq('e2', 'Tanica', 22, true, 'Elio'), eq('e3', 'Corda', 15, false, 'Alice')],
    // 160,00 separati + 611,45 cibo/bevande comuni + 62,70 logistica + 111,90 attrezzatura
    attese: { totale: 946.05 },
  },
];

const num = (s) => {
  const t = String(s).replace(/\s/g, '').replace(',', '.');
  const mm = t.match(/-?\d+(\.\d+)?/);
  return mm ? parseFloat(mm[0]) : NaN;
};
const close = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.051 : tol);

(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  let fails = 0, checks = 0;
  const bad = (msg) => { fails++; console.log('   ✗ ' + msg); };
  const ok = () => { checks++; };

  for (const sc of scenari) {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript((s) => {
      localStorage.setItem('cambusa_sync_optout', '1');
      localStorage.setItem('cambusa_members', JSON.stringify(s.membri));
      localStorage.setItem('cambusa_camp_data', JSON.stringify(s.presenze));
      localStorage.setItem('cambusa_purchases', JSON.stringify(s.acquisti));
      localStorage.setItem('cambusa_equipment', JSON.stringify(s.attrezzatura));
      localStorage.setItem('cambusa_sepdays', JSON.stringify(s.giorniSeparati || []));
    }, sc);
    await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
    await p.evaluate(() => { try { localStorage.setItem('cambusa_unlock', window.APP_LOCK.hash); } catch(e){} });
    await p.reload({ waitUntil: 'load' });
    await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
    await p.click('button[aria-label="Menu"]');
    await p.waitForTimeout(320);
    await p.locator('nav button:has-text("Spese Totali")').click();
    await p.waitForTimeout(250);

    console.log('\n' + sc.nome);

    // --- TOTALI ---
    const cassa = await p.locator('h3:has-text("Cassa Globale Campo")').locator('..').innerText();
    const totale = num(cassa.split('IMPORTO COMPLESSIVO:')[1] || cassa.split('Importo Complessivo:')[1]);
    if (!close(totale, sc.attese.totale)) bad(`totale mostrato ${totale} invece di ${sc.attese.totale}`); else ok();
    if (/NaN|Infinity/.test(cassa)) bad('valori non numerici nei totali'); else ok();

    // --- QUOTE ---
    await p.locator('main button:has-text("Quote")').click();
    await p.waitForTimeout(200);
    const quoteBox = await p.locator('h3:has-text("Quanto deve ciascuno")').locator('..').innerText();
    if (/NaN|Infinity/.test(quoteBox)) bad('valori non numerici nelle quote'); else ok();
    let sommaQuote = 0;
    for (const [nome, atteso] of Object.entries(sc.attese.quote || {})) {
      const riga = await p.locator(`li:has-text("${nome}")`).first().innerText();
      // prendo l'importo attaccato al simbolo dell'euro: il resto della riga
      // ora contiene anche il dettaglio dei pasti comuni/separati
      const val = /Gratis/i.test(riga) ? 0 : num((riga.match(/(-?\d+[.,]\d{2})\s*€/) || [])[1]);
      sommaQuote += val;
      if (!close(val, atteso)) bad(`quota di ${nome}: ${val} invece di ${atteso}  [${riga.replace(/\s+/g, ' ')}]`); else ok();
    }
    const raccolto = num((quoteBox.split(/TOTALE RACCOLTO|Totale raccolto/)[1] || '0'));
    if (sc.attese.raccolto !== undefined && !close(raccolto, sc.attese.raccolto)) {
      bad(`totale raccolto ${raccolto} invece di ${sc.attese.raccolto}`);
    } else ok();
    // invariante: la somma delle quote mostrate = totale raccolto
    if (Object.keys(sc.attese.quote || {}).length && !close(sommaQuote, raccolto, 0.051)) {
      bad(`somma quote (${sommaQuote.toFixed(2)}) != totale raccolto (${raccolto})`);
    } else ok();

    // --- SALDI ---
    await p.locator('main button:has-text("Saldi")').click();
    await p.waitForTimeout(200);
    const saldiBox = await p.locator('h3:has-text("Saldo finale")').locator('..').innerText();
    if (/NaN|Infinity/.test(saldiBox)) bad('valori non numerici nei saldi'); else ok();

    // Leggo le righe dei saldi una per una (non a fette di testo)
    const card = p.locator('h3:has-text("Saldo finale")').locator('..');
    const liTesti = await card.locator('ul li').allInnerTexts();
    const persone = [];
    for (const t of liTesti) {
      const r = t.replace(/\s+/g, ' ').trim();
      if (r.includes('→')) continue;                    // riga di trasferimento
      const nome = r.split(' ha anticipato')[0].trim();
      if (!nome) continue;
      let netto = 0;
      if (/riceve/.test(r)) netto = num(r.split('riceve')[1]);
      else if (/dà/.test(r)) netto = -num(r.split('dà')[1]);
      const anticipato = num(r.split('ha anticipato')[1]);
      const dovuto = num(r.split('deve')[1]);
      persone.push({ nome, netto, anticipato, dovuto });
    }
    const trasferimenti = liTesti
      .filter((t) => t.includes('→'))
      .map((t) => ({ testo: t.replace(/\s+/g, ' ').trim(), val: num(t.split('€')[0].split('→').pop()) }));

    // saldo netto = anticipato - dovuto, per ogni persona
    for (const q of persone) {
      if (!close(q.netto, q.anticipato - q.dovuto, 0.051)) {
        bad(`${q.nome}: netto ${q.netto} != anticipato ${q.anticipato} - dovuto ${q.dovuto}`);
      } else ok();
    }
    for (const [nome, atteso] of Object.entries(sc.attese.saldi || {})) {
      const q = persone.find((x) => x.nome === nome);
      if (!q) { bad(`saldo di ${nome} non trovato`); continue; }
      if (!close(q.netto, atteso)) bad(`saldo di ${nome}: ${q.netto} invece di ${atteso}`); else ok();
    }

    if (sc.attese.avvisoSconosciuto) {
      const avvisa = saldiBox.includes(sc.attese.avvisoSconosciuto) && /non\s+(è|e)\s+fra i membri/i.test(saldiBox.replace(/\s+/g, ' '));
      if (!avvisa) bad(`manca l'avviso sull'acquirente "${sc.attese.avvisoSconosciuto}" che non è fra i membri`);
      else ok();
    }

    // Invariante somma-zero: vale solo se OGNI spesa ha un acquirente
    const tutteAttribuite = [...sc.acquisti, ...sc.attrezzatura.filter((e) => e.bought)]
      .every((x) => (x.buyer || '').trim().length > 0);
    const sommaNetti = persone.reduce((a, q) => a + q.netto, 0);
    const senzaPasti = /nessun pasto registrato/i.test(quoteBox);
    if (senzaPasti) {
      // niente pasti: la ripartizione non e' possibile, deve avvisare
      ok();
    } else if (!tutteAttribuite) {
      const avvisa = /senza acquirente/i.test(saldiBox);
      if (!avvisa) bad('spese senza acquirente ma nessun avviso mostrato'); else ok();
    } else {
      if (!close(sommaNetti, 0, 0.2)) bad(`somma dei saldi netti = ${sommaNetti.toFixed(2)} (con tutte le spese attribuite deve essere 0)`);
      else ok();
      // i trasferimenti devono coprire esattamente i crediti
      const crediti = persone.filter((q) => q.netto > 0.005).reduce((a, q) => a + q.netto, 0);
      const somTrasf = trasferimenti.reduce((a, t) => a + t.val, 0);
      // I trasferimenti coprono i crediti a meno dello scarto di arrotondamento
      // (chi ha anticipato assorbe fino a 0,49 €: regola voluta, niente monetine)
      const debiti = persone.filter((q) => q.netto < -0.005).reduce((a, q) => a - q.netto, 0);
      if (crediti > 0.005 && debiti > 0.005 && !close(somTrasf, Math.min(crediti, debiti), 0.051)) {
        bad(`trasferimenti ${somTrasf.toFixed(2)} != minimo tra crediti ${crediti.toFixed(2)} e debiti ${debiti.toFixed(2)}`);
      } else ok();
      if (crediti - debiti > 0.5) bad(`scarto non riconciliato troppo grande: ${(crediti - debiti).toFixed(2)} €`); else ok();

      // Ogni debitore deve pagare ESATTAMENTE il suo debito, spalmato sulle
      // righe di "chi paga chi"; ogni creditore non deve incassare piu' del
      // suo credito. Senza questo controllo un errore nell'abbinamento
      // passerebbe inosservato: i totali tornerebbero comunque.
      const uscite = {}, entrate = {};
      trasferimenti.forEach((t) => {
        const m = t.testo.match(/^(.*?)\s*→\s*(.*?)\s+[\d.,]+/);
        if (!m) return;
        uscite[m[1].trim()] = (uscite[m[1].trim()] || 0) + t.val;
        entrate[m[2].trim()] = (entrate[m[2].trim()] || 0) + t.val;
      });
      // Lo scarto di arrotondamento (voluto: quote a 0,10 €) non ha un
      // destinatario, quindi UN lato paga/incassa meno del saldo indicato,
      // esattamente di quello scarto. Tutto il resto deve combaciare.
      const scarto = Math.abs(crediti - debiti);
      let mancoTot = 0;
      for (const q of persone) {
        if (q.netto < -0.005) {
          const paga = uscite[q.nome] || 0;
          const manca = -q.netto - paga;
          mancoTot += manca;
          if (manca < -0.011 || manca > scarto + 0.011) bad(`${q.nome} deve dare ${(-q.netto).toFixed(2)} ma nelle righe paga ${paga.toFixed(2)}`);
          else ok();
        }
        if (q.netto > 0.005) {
          const riceve = entrate[q.nome] || 0;
          const manca = q.netto - riceve;
          mancoTot += manca;
          if (manca < -0.011 || manca > scarto + 0.011) bad(`${q.nome} deve ricevere ${q.netto.toFixed(2)} ma nelle righe incassa ${riceve.toFixed(2)}`);
          else ok();
        }
      }
      if (!close(mancoTot, scarto, 0.021)) bad(`i passaggi lasciano scoperti ${mancoTot.toFixed(2)} € invece dello scarto di arrotondamento ${scarto.toFixed(2)} €`);
      else ok();
    }

    if (errs.length) bad('errori JS: ' + errs.join(' | ')); else ok();
    await ctx.close();
  }

  console.log(`\n================  RISULTATO: ${checks} verifiche superate, ${fails} problemi  ================`);
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
