// Le spese divise solo fra alcuni (fra-alcuni.js, 4 ottobre), con i numeri.
//
// Le cose che devono valere: senza spese fra alcuni, esattamente i conti di
// conti.js (che non si tocca); una spesa fra alcuni la paga solo chi c'era,
// al centesimo, senza perdere centesimi per strada; se chi c'era non esiste
// piu', e' un buco dichiarato e non una spesa spalmata; e i rimborsi ci
// lavorano sopra come su tutto il resto.
const path = require('path');
const { ok, fine } = require('../lib/app');

const RADICE = path.join(__dirname, '..', '..');
require(path.join(RADICE, 'conti.js'));
require(path.join(RADICE, 'rimborsi.js'));
require(path.join(RADICE, 'fra-alcuni.js'));
const C = global.Conti;
const F = global.FraAlcuni;
const R = global.Rimborsi;
ok('fra-alcuni.js si carica', !!(F && typeof F.calcola === 'function'));

const P = { lunch: true, dinner: true };
const membri = (nomi) => nomi.map((n, i) => ({ id: 'm' + i, name: n, isChild: false }));
const giorni = (ms, date) => {
  const cd = {};
  date.forEach((d) => { cd[d] = { meals: {} }; ms.forEach((m) => { cd[d].meals[m.id] = P; }); });
  return cd;
};
const base = { equipment: [], sepDays: [], freeDays: [], equipExemption: false };
const somma = (xs, f) => xs.reduce((n, x) => n + f(x), 0);
const netto = (t, nome) => (t.settlement.find((s) => s.name === nome) || { net: 0 }).net;

// ---------- Senza spese fra alcuni: conti.js, identico ----------
{
  let seme = 11;
  const caso = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
  let uguali = true;
  for (let giro = 0; giro < 150; giro++) {
    const ms = membri(['Anna', 'Bruno', 'Carla', 'Dario', 'Elsa'].slice(0, 2 + Math.floor(caso() * 4)));
    const cd = {};
    ['2027-08-10', '2027-08-11'].forEach((d) => { cd[d] = { meals: {} }; ms.forEach((m) => { cd[d].meals[m.id] = { lunch: caso() > 0.3, dinner: caso() > 0.3 }; }); });
    const purchases = [];
    for (let i = 0; i < 1 + Math.floor(caso() * 5); i++) {
      purchases.push({ id: 'p' + i, price: Math.round(caso() * 8000) / 100, type: ['alimentare', 'bevande', 'logistica'][Math.floor(caso() * 3)], buyer: ms[Math.floor(caso() * ms.length)].name });
    }
    const dati = { ...base, members: ms, campData: cd, purchases, sepDays: caso() > 0.5 ? ['2027-08-11'] : [] };
    const a = C.calcola(dati);
    const b = F.calcola(dati);
    const { fraAlcuni, ...resto } = b;
    if (JSON.stringify(resto) !== JSON.stringify(a) || fraAlcuni.totale !== 0) uguali = false;
  }
  ok('senza spese fra alcuni, gli stessi conti di conti.js, al carattere (150 campi a caso)', uguali);
}

// ---------- La benzina della macchina di Bruno ----------
{
  const ms = membri(['Anna', 'Bruno', 'Carla', 'Dario']);
  const cd = giorni(ms, ['2027-08-10']);
  // Cibo 80 € su 8 pasti: 20 a testa. Benzina 30 € solo fra Bruno, Carla e Dario.
  const purchases = [
    { id: 'c', price: 80, type: 'alimentare', buyer: 'Anna' },
    { id: 'b', price: 30, type: 'logistica', buyer: 'Bruno', per: ['m1', 'm2', 'm3'] },
  ];
  const t = F.calcola({ ...base, members: ms, campData: cd, purchases });
  const dovuto = (n) => t.breakdown.find((b) => b.name === n).pay;
  ok(`la benzina la pagano solo i tre in macchina (Anna ${dovuto('Anna')}, Bruno ${dovuto('Bruno')}, Carla ${dovuto('Carla')}, Dario ${dovuto('Dario')})`,
    dovuto('Anna') === 20 && dovuto('Bruno') === 30 && dovuto('Carla') === 30 && dovuto('Dario') === 30);
  ok(`chi l'ha pagata riceve la differenza (Bruno ${netto(t, 'Bruno')}, Anna ${netto(t, 'Anna')})`,
    Math.abs(netto(t, 'Bruno') - 0) < 0.005 && Math.abs(netto(t, 'Anna') - 60) < 0.005);
  ok('il totale speso la conta', Math.abs(t.overallTotal - 110) < 0.005);
  ok('i saldi tornano a zero', Math.abs(somma(t.settlement, (s) => s.net)) < 0.005);
  const passi = t.transfers.map((x) => `${x.from}→${x.to} ${x.amount}`).join(', ');
  ok(`e i passaggi lo dicono (${passi})`, /Carla→Anna 30/.test(passi) && /Dario→Anna 30/.test(passi) && t.transfers.length === 2);
  ok('la spesa fra alcuni sta nell\'elenco con le sue quote', t.fraAlcuni.voci.length === 1 && t.fraAlcuni.voci[0].quote.length === 3);
}

// ---------- I centesimi non si perdono ----------
{
  const ms = membri(['Anna', 'Bruno', 'Carla']);
  const q = F.quote({ price: 10, per: ['m0', 'm1', 'm2'] }, ms);
  ok(`10 € fra tre: ${q.chi.map((x) => x.cents).join(' + ')} centesimi, e fanno 10 €`,
    q.chi.map((x) => x.cents).join(',') === '334,333,333' && somma(q.chi, (x) => x.cents) === 1000);
  const doppio = F.quote({ price: 9, per: ['m0', 'm0', 'm1'] }, ms);
  ok('un nome scelto due volte conta una volta', doppio.chi.length === 2 && doppio.chi[0].cents === 450);
}

// ---------- Chi c'era non c'e' piu' ----------
{
  const ms = membri(['Anna', 'Bruno']);
  const cd = giorni(ms, ['2027-08-10']);
  const t = F.calcola({ ...base, members: ms, campData: cd, purchases: [
    { id: 'c', price: 40, type: 'alimentare', buyer: 'Anna' },
    { id: 'x', price: 12, type: 'bevande', buyer: 'Bruno', per: ['tolto'] },
  ] });
  ok(`una spesa fra alcuni senza più nessuno è un buco dichiarato (${t.nonRipartito} €)`,
    Math.abs(t.nonRipartito - 12) < 0.005 && t.buchi.some((b) => b.perche === 'buchi.fraAlcuniSenzaNessuno'));
  ok('e non si spalma su chi non c\'era', t.breakdown.every((b) => b.pay === 20));
}

// ---------- I rimborsi ci lavorano sopra ----------
{
  const ms = membri(['Anna', 'Bruno', 'Carla', 'Dario']);
  const cd = giorni(ms, ['2027-08-10', '2027-08-11']);
  const t = F.calcola({ ...base, members: ms, campData: cd, sepDays: ['2027-08-11'], purchases: [
    { id: 'c', price: 90, type: 'alimentare', buyer: 'Anna' },
    { id: 's', price: 40, type: 'alimentare', buyer: 'Carla', account: 'sep' },
    { id: 'b', price: 25, type: 'bevande', buyer: 'Dario', per: ['m0', 'm1'] },
  ] });
  const settled = [];
  t.transfers.forEach((x) => settled.push(R.nuovaChiave(x, settled)));
  const r = R.residui(t, settled);
  ok('pagato quello che dice l\'app, non resta niente da fare', R.daFare(r, false).length === 0 && R.daFare(r, true).length === 0);
}

fine();
