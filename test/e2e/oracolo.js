// L'oracolo dei conti: scenari con i risultati CALCOLATI A MANO, più
// invarianti che devono valere sempre, su scenari generati a caso.
//
// Le altre prove controllano che i conti non cambino; questa controlla che
// siano GIUSTI. Gli attesi non escono dal codice dell'app: sono fatti con
// carta e penna nei commenti, così un errore copiato nell'app non può
// copiarsi anche qui. Legge window.__totali (i numeri esatti, non il testo a
// schermo, dove 30.00 e 30.004 sono indistinguibili).
const { apri, ok, fine } = require('../lib/app');

// Scrive lo stato del campo direttamente e ricarica: molto più veloce che
// costruire ogni scenario a colpi di click.
const scenario = async (p, s) => {
  await p.evaluate((x) => {
    localStorage.setItem('cambusa_members', JSON.stringify(x.members || []));
    localStorage.setItem('cambusa_camp_data', JSON.stringify(x.campData || {}));
    localStorage.setItem('cambusa_purchases', JSON.stringify(x.purchases || []));
    localStorage.setItem('cambusa_equipment', JSON.stringify(x.equipment || []));
    localStorage.setItem('cambusa_sepdays', JSON.stringify(x.sepDays || []));
    localStorage.setItem('cambusa_freedays', JSON.stringify(x.freeDays || []));
    ['cambusa_settled', 'cambusa_tobuy', 'cambusa_gear', 'cambusa_blocchi'].forEach((k) => localStorage.setItem(k, '[]'));
  }, s);
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await p.waitForFunction(() => !!window.__totali, null, { timeout: 8000 });
  return p.evaluate(() => {
    const t = window.__totali;
    return {
      overallTotal: t.overallTotal,
      collected: t.collected,
      nonRipartito: t.nonRipartito || 0,
      roundingDiff: t.roundingDiff,
      pays: Object.fromEntries(t.breakdown.map((b) => [b.name, b.pay])),
      isChild: Object.fromEntries(t.breakdown.map((b) => [b.name, !!b.isChild])),
      settlement: t.settlement.map((x) => ({ name: x.name, net: x.net })),
      transfers: t.transfers,
    };
  });
};

const LD = { lunch: true, dinner: true };
const vicino = (a, b, eps) => Math.abs(a - b) < (eps || 0.005);

(async () => {
  const { browser, page: p, errori } = await apri();

  // ============= SCENARIO 1: il caso base, tutto a mano =============
  // 2 adulti, un giorno, tutti a pranzo e cena → 4 pasti.
  // Cibo 60 → 15 €/pasto → 30 a testa.
  // Logistica 30 → 15 a testa. Attrezzatura 20 → 10 a testa.
  // Quote: 55 e 55. Totale 110, raccolto 110, scarto 0.
  // Anticipi: Anna 60+20=80, Bruno 30 → saldi +25/−25 → Bruno→Anna 25.
  let r = await scenario(p, {
    members: [{ id: 'a', name: 'Anna', isChild: false }, { id: 'b', name: 'Bruno', isChild: false }],
    campData: { '2026-08-12': { meals: { a: LD, b: LD } } },
    purchases: [
      { id: 'p1', name: 'Cibo', price: 60, type: 'alimentare', buyer: 'Anna', at: 1 },
      { id: 'p2', name: 'Gas', price: 30, type: 'logistica', buyer: 'Bruno', at: 2 },
    ],
    equipment: [{ id: 'e1', text: 'Tenda', price: 20, bought: true, buyer: 'Anna' }],
  });
  ok(`S1 quote esatte: Anna 55, Bruno 55 (${r.pays.Anna}, ${r.pays.Bruno})`,
    vicino(r.pays.Anna, 55) && vicino(r.pays.Bruno, 55));
  ok('S1 raccolto = totale, nessuno scarto', vicino(r.collected, 110) && vicino(r.roundingDiff, 0));
  ok('S1 saldi: Bruno deve dare 25 ad Anna',
    r.transfers.length === 1 && r.transfers[0].from === 'Bruno' && r.transfers[0].to === 'Anna' && vicino(r.transfers[0].amount, 25));

  // ============= SCENARIO 2: bambino + giorno gratis =============
  // Giorno 1: Anna, Bruno e la piccola Ciara (bambina), tutti P+C.
  // Giorno 2 GRATIS: solo Dario.
  // Cibo 90 → pasti adulti che si pagano: 4 (Ciara è bambina, Dario è nel
  // giorno gratis) → 22,50 €/pasto → Anna 45, Bruno 45, Ciara 0, Dario 0.
  r = await scenario(p, {
    members: [
      { id: 'a', name: 'Anna', isChild: false }, { id: 'b', name: 'Bruno', isChild: false },
      { id: 'c', name: 'Ciara', isChild: true }, { id: 'd', name: 'Dario', isChild: false },
    ],
    campData: {
      '2026-08-12': { meals: { a: LD, b: LD, c: LD } },
      '2026-08-13': { meals: { d: LD } },
    },
    purchases: [{ id: 'p1', name: 'Cibo', price: 90, type: 'alimentare', buyer: 'Anna', at: 1 }],
    freeDays: ['2026-08-13'],
  });
  ok(`S2 Anna e Bruno 45 a testa (${r.pays.Anna}, ${r.pays.Bruno})`, vicino(r.pays.Anna, 45) && vicino(r.pays.Bruno, 45));
  ok('S2 la bambina paga 0', vicino(r.pays.Ciara, 0));
  ok('S2 chi è venuto solo nel giorno gratis paga 0', vicino(r.pays.Dario, 0));
  ok('S2 raccolto = totale', vicino(r.collected, 90));

  // ============= SCENARIO 3: separato + gratis sullo stesso giorno =============
  // Il giorno del conto separato è anche gratis: il gratis vince, i 30 € del
  // separato non hanno più pasti su cui dividersi → buco dichiarato da 30.
  // Il comune (40 € su 4 pasti → 10 €/pasto): Anna 20, Bruno 20.
  r = await scenario(p, {
    members: [{ id: 'a', name: 'Anna', isChild: false }, { id: 'b', name: 'Bruno', isChild: false }],
    campData: {
      '2026-08-12': { meals: { a: LD, b: LD } },
      '2026-08-13': { meals: { a: LD } },
    },
    purchases: [
      { id: 'p1', name: 'Cibo comune', price: 40, type: 'alimentare', buyer: 'Anna', at: 1 },
      { id: 'p2', name: 'Cena separata', price: 30, type: 'alimentare', buyer: 'Bruno', at: 2, account: 'sep' },
    ],
    sepDays: ['2026-08-13'],
    freeDays: ['2026-08-13'],
  });
  ok(`S3 il buco è dichiarato: 30 € non ripartiti (${r.nonRipartito})`, vicino(r.nonRipartito, 30));
  ok(`S3 le quote comuni restano giuste (${r.pays.Anna}, ${r.pays.Bruno})`, vicino(r.pays.Anna, 20) && vicino(r.pays.Bruno, 20));
  ok('S3 raccolto = totale − buco', vicino(r.collected, 40));

  // ============= SCENARIO 4: l'arrotondamento sotto la soglia =============
  // 3 adulti, 6 pasti, 100 € → 16,666 €/pasto → 33,333 a testa → 33,30.
  // Scarto −0,10: sotto i 50 cent NON si riconcilia.
  r = await scenario(p, {
    members: [
      { id: 'a', name: 'Anna', isChild: false }, { id: 'b', name: 'Bruno', isChild: false },
      { id: 'c', name: 'Carlo', isChild: false },
    ],
    campData: { '2026-08-12': { meals: { a: LD, b: LD, c: LD } } },
    purchases: [{ id: 'p1', name: 'Cibo', price: 100, type: 'alimentare', buyer: 'Anna', at: 1 }],
  });
  ok(`S4 quote 33,30 a testa (${r.pays.Anna})`, vicino(r.pays.Anna, 33.30) && vicino(r.pays.Bruno, 33.30) && vicino(r.pays.Carlo, 33.30));
  ok(`S4 scarto −0,10 lasciato stare (${r.roundingDiff})`, vicino(r.roundingDiff, -0.10));

  // ============= SCENARIO 5: conto separato normale =============
  // Giorno comune: Anna+Bruno (4 pasti, 40 € → 10/pasto).
  // Giorno separato: solo Anna (2 pasti, 30 € → 15/pasto).
  // Anna 20+30=50, Bruno 20. Totale 70.
  r = await scenario(p, {
    members: [{ id: 'a', name: 'Anna', isChild: false }, { id: 'b', name: 'Bruno', isChild: false }],
    campData: {
      '2026-08-12': { meals: { a: LD, b: LD } },
      '2026-08-13': { meals: { a: LD } },
    },
    purchases: [
      { id: 'p1', name: 'Cibo comune', price: 40, type: 'alimentare', buyer: 'Anna', at: 1 },
      { id: 'p2', name: 'Cena separata', price: 30, type: 'alimentare', buyer: 'Anna', at: 2, account: 'sep' },
    ],
    sepDays: ['2026-08-13'],
  });
  ok(`S5 Anna paga anche il separato (${r.pays.Anna}), Bruno solo il comune (${r.pays.Bruno})`,
    vicino(r.pays.Anna, 50) && vicino(r.pays.Bruno, 20));
  ok('S5 raccolto = totale', vicino(r.collected, 70));

  // ============= INVARIANTI su scenari generati a caso =============
  // Qualsiasi combinazione di membri, giorni, casse e spese deve rispettare:
  //  1. ogni quota è ≥ 0 e multipla di 10 centesimi
  //  2. i bambini pagano 0
  //  3. chi ha pasti solo nei giorni gratis paga 0
  //  4. raccolto + buco = totale speso (entro mezzo euro di arrotondamento)
  //  5. i passaggi di pareggio sono tutti positivi
  const rnd = (() => { let s = 20260812; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
  for (let giro = 0; giro < 8; giro++) {
    const nMembri = 2 + Math.floor(rnd() * 4);
    const members = [];
    for (let i = 0; i < nMembri; i++) {
      members.push({ id: 'm' + i, name: 'Pers' + i, isChild: rnd() < 0.25 });
    }
    const giorni = ['2026-08-12', '2026-08-13', '2026-08-14'].slice(0, 1 + Math.floor(rnd() * 3));
    const campData = {};
    giorni.forEach((g) => {
      const meals = {};
      members.forEach((m) => {
        if (rnd() < 0.75) meals[m.id] = { lunch: rnd() < 0.7, dinner: rnd() < 0.7 };
      });
      campData[g] = { meals };
    });
    const sepDays = giorni.filter(() => rnd() < 0.25);
    const freeDays = giorni.filter(() => rnd() < 0.25);
    const purchases = [];
    const nSpese = 1 + Math.floor(rnd() * 4);
    for (let i = 0; i < nSpese; i++) {
      const tipo = rnd() < 0.25 ? 'logistica' : rnd() < 0.5 ? 'bevande' : 'alimentare';
      purchases.push({
        id: 'p' + i, name: 'Spesa' + i, price: Math.round(rnd() * 12000) / 100,
        type: tipo, buyer: members[Math.floor(rnd() * nMembri)].name, at: i + 1,
        ...(tipo !== 'logistica' && rnd() < 0.3 ? { account: 'sep' } : {}),
      });
    }
    const equipment = rnd() < 0.5
      ? [{ id: 'e0', text: 'Attrezzo', price: Math.round(rnd() * 5000) / 100, bought: true, buyer: members[0].name }]
      : [];

    const x = await scenario(p, { members, campData, purchases, sepDays, freeDays, equipment });

    const paghe = Object.values(x.pays);
    const multipli = paghe.every((v) => v >= 0 && Math.round(v * 100) % 10 === 0);
    const bimbiZero = members.filter((m) => m.isChild).every((m) => vicino(x.pays[m.name], 0));
    const soloGratisZero = members.every((m) => {
      const pastiPagabili = giorni.some((g) => {
        if (freeDays.includes(g)) return false;
        const v = (campData[g].meals || {})[m.id];
        return v && (v.lunch || v.dinner);
      });
      return pastiPagabili || vicino(x.pays[m.name], 0);
    });
    const quadra = Math.abs(x.collected + x.nonRipartito - x.overallTotal) < 0.501;
    const trasfPositivi = x.transfers.every((t) => t.amount > 0);

    ok(`giro ${giro + 1}: quote ≥0 e multiple di 10c; bimbi 0; solo-gratis 0; raccolto+buco=totale; passaggi positivi` +
      (multipli && bimbiZero && soloGratisZero && quadra && trasfPositivi ? '' :
        ` [multipli:${multipli} bimbi:${bimbiZero} gratis:${soloGratisZero} quadra:${quadra} trasf:${trasfPositivi}` +
        ` tot:${x.overallTotal} racc:${x.collected} buco:${x.nonRipartito}]`),
      multipli && bimbiZero && soloGratisZero && quadra && trasfPositivi);
  }

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
