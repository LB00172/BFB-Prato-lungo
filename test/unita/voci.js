// Voci di spesa spente: le regole, con i conti veri.
//
// Le tre prove che ROADMAP.md § 8 chiede prima di dire fatto, qui sui numeri:
// con una voce spenta le quote scendono di esattamente quella cifra, la somma
// dei saldi resta a zero, e non compare l'avviso del buco. La cifra spenta si
// dichiara. (Che l'interruttore stia fermo a conti chiusi lo prova e2e/voci.)
//
// I conti si chiamano davvero: conti.js non e' toccato da questa funzione, e
// l'unico modo di sapere che basta togliere le voci PRIMA e' guardare cosa
// ne esce dopo.
const path = require('path');
const { ok, fine } = require('../lib/app');
const RADICE = path.resolve(__dirname, '..', '..');
require(path.join(RADICE, 'conti.js'));
require(path.join(RADICE, 'voci.js'));
const C = globalThis.Conti;
const V = globalThis.Voci;

ok('voci.js si carica', !!(V && typeof V.separa === 'function'));
if (!V || !C) { fine(); }

// Tre adulti, due giorni a pranzo; uno dei due giorni a conto separato.
const P = { lunch: true, dinner: false };
const members = [
  { id: 'a', name: 'Anna', isChild: false },
  { id: 'b', name: 'Bruno', isChild: false },
  { id: 'c', name: 'Carla', isChild: false },
];
const campData = {
  '2027-08-11': { note: '', guestsNames: '', meals: { a: P, b: P, c: P } },
  '2027-08-12': { note: '', guestsNames: '', meals: { a: P, b: P } },
};
const purchases = [
  { id: 'p1', name: 'Pasta', price: 30, type: 'alimentare', buyer: 'Anna' },
  { id: 'p2', name: 'Vino', price: 12, type: 'bevande', buyer: 'Bruno' },
  { id: 'p3', name: 'Gasolio', price: 45, type: 'logistica', buyer: 'Carla' },
  { id: 'p4', name: 'Cena fuori', price: 20, type: 'alimentare', buyer: 'Anna', account: 'sep' },
];
const equipment = [
  { id: 'e1', name: 'Tenda', price: 60, bought: true, buyer: 'Bruno' },
  { id: 'e2', name: 'Pentola', price: 25, bought: false, buyer: '' },
];
const base = { members, campData, sepDays: ['2027-08-12'], freeDays: [] };
const conti = (voci) => {
  const s = V.separa(purchases, equipment, voci);
  return { s, t: C.calcola(Object.assign({}, base, { purchases: s.purchases, equipment: s.equipment })) };
};
const sommaSaldi = (t) => t.settlement.reduce((x, r) => x + r.net, 0);

// ---------- Niente spento: i conti di sempre ----------
{
  const { s, t } = conti(undefined);
  const prima = C.calcola(Object.assign({}, base, { purchases, equipment }));
  ok('senza voci spente i conti sono identici a prima, al centesimo',
    JSON.stringify(t) === JSON.stringify(prima));
  ok('e fuori conto non c\'è niente', s.fuori.totale === 0);
}

// ---------- La logistica spenta ----------
{
  const prima = conti({}).t;
  const { s, t } = conti({ logistica: 'fuori' });
  ok(`il fuori conto dichiara il gasolio (${s.fuori.totale} €)`, s.fuori.totale === 45 && s.fuori.perCategoria.logistica === 45);
  ok(`il totale diviso scende di esattamente quella cifra (${prima.overallTotal} → ${t.overallTotal})`,
    Math.abs((prima.overallTotal - t.overallTotal) - 45) < 0.001);
  ok(`i saldi sommano sempre a zero (${sommaSaldi(t).toFixed(2)})`, Math.abs(sommaSaldi(t)) < 0.05);
  ok('e non compare nessun buco: quei soldi non sono un errore', !(t.nonRipartito > 0.005) && t.buchi.length === 0);
  ok('Carla, che ha pagato il gasolio, non se lo vede rimborsare dall\'app: lo gestisce il gruppo',
    t.settlement.find((r) => r.name === 'Carla').paid === 0);
}

// ---------- L'attrezzatura spenta: conta solo quella comprata ----------
{
  const { s, t } = conti({ attrezzatura: 'fuori' });
  ok(`la tenda comprata esce, la pentola da comprare no (${s.fuori.perCategoria.attrezzatura} €)`,
    s.fuori.perCategoria.attrezzatura === 60 && s.equipment.length === 0);
  ok('i saldi sommano a zero anche qui', Math.abs(sommaSaldi(t)) < 0.05);
}

// ---------- Una voce spenta esce da tutte e due le casse ----------
{
  const { s, t } = conti({ alimentare: 'fuori' });
  ok(`anche la cena della cassa separata esce: è una terza colonna, non uno sconto (${s.fuori.perCategoria.alimentare} €)`,
    s.fuori.perCategoria.alimentare === 50 && t.foodDrinksSep === 0);
}

// ---------- Nel dubbio, si divide ----------
{
  const s = V.separa(purchases, equipment, { logistica: 'si', bevande: true, nonEsiste: 'fuori' });
  ok('solo «fuori» spegne: valori storti e categorie sconosciute non tolgono niente',
    s.fuori.totale === 0 && s.purchases.length === purchases.length && s.equipment.length === equipment.length);
  ok('senza liste non esplode', V.separa(null, null, { logistica: 'fuori' }).fuori.totale === 0);
}

// ---------- Tipi di spesa che i conti non conoscono ----------
// Una spesa senza tipo veniva rimborsata a chi l'aveva pagata ma non divisa
// fra nessuno: 30 € di credito che nessuno doveva, e sul conto separato quote
// negative. Adesso si divide come cibo.
{
  const fs = require('fs');
  const conf = fs.readFileSync(path.join(RADICE, 'src', '40-configurazione.jsx'), 'utf8');
  const m = /const PURCHASE_TYPES = \{([^}]*)\}/.exec(conf);
  const tipi = m ? m[1].split(',').map((x) => x.split(':')[0].trim()).filter(Boolean) : [];
  const conti = fs.readFileSync(path.join(RADICE, 'conti.js'), 'utf8');
  const sommati = [...conti.matchAll(/sumByType\('([a-z]+)'\)/g)].map((x) => x[1]);
  ok(`i tipi dell'app sono quelli che i conti dividono (${tipi.join(', ')})`,
    tipi.length > 0 && tipi.join(',') === V.TIPI_SPESA.join(',') && tipi.every((t) => sommati.includes(t)));

  const membri = [{ id: 'a', name: 'Anna', isChild: false }, { id: 'b', name: 'Bruno', isChild: false }, { id: 'c', name: 'Carla', isChild: false }];
  const P = { lunch: true, dinner: true };
  const campData = { '2027-08-10': { meals: { a: P, b: P, c: P } }, '2027-08-11': { meals: { a: P, b: P, c: P } } };
  const conta = (purchases, sepDays) => {
    const d = V.separa(purchases, [], null);
    return global.Conti.calcola({ members: membri, campData, purchases: d.purchases, equipment: d.equipment, sepDays: sepDays || [], freeDays: [], equipExemption: false });
  };
  const t = conta([
    { id: '1', price: 60, type: 'alimentare', buyer: 'Anna' },
    { id: '2', price: 30, buyer: 'Bruno' },
    { id: '3', price: 12, type: 'altro', buyer: 'Carla' },
  ]);
  const somma = t.settlement.reduce((n, x) => n + x.net, 0);
  ok(`una spesa senza tipo si divide, e i saldi tornano a zero (${t.overallTotal} €, somma ${somma.toFixed(2)})`,
    Math.abs(t.overallTotal - 102) < 0.005 && Math.abs(somma) < 0.005);
  const sep = conta([
    { id: '1', price: 40, type: 'alimentare', buyer: 'Anna' },
    { id: '2', price: 50, type: 'altro', account: 'sep', buyer: 'Bruno' },
  ], ['2027-08-11']);
  ok(`sul conto separato nessuna quota negativa (${sep.breakdown.map((b) => b.pay).join(', ')})`,
    sep.breakdown.every((b) => b.pay >= 0) && sep.foodDrinksCommon >= 0 && Math.abs(sep.overallTotal - 90) < 0.005);
  const orig = [{ id: '9', price: 5, buyer: 'Anna' }];
  V.separa(orig, [], null);
  ok('e la spesa salvata non si tocca: si corregge solo cosa si dà ai conti', orig[0].type === undefined);
}

fine();
