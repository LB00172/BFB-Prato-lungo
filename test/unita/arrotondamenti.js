// Replica esatta della logica di arrotondamento/riconciliazione di App.jsx
function reconcile(owedList, overallTotal) {
  const round10 = (cents) => Math.round(cents / 10) * 10;
  const breakdown = owedList.map((owed, i) => ({ id: i, owed, isChild: owed === 0 && false }));
  breakdown.forEach((b) => { b.payCents = round10(Math.round(b.owed * 100)); });
  const targetCents = Math.round(overallTotal * 100);
  let residual = targetCents - breakdown.reduce((s, b) => s + b.payCents, 0);
  if (Math.abs(residual) >= 50) {
    const order = breakdown.filter((b) => b.owed > 0).sort((a, b) => b.owed - a.owed);
    const step = residual > 0 ? 10 : -10;
    let guard = 0, idx = 0;
    while (Math.abs(residual) >= 10 && order.length > 0 && guard < 100000) {
      const t = order[idx % order.length];
      if (!(step < 0 && t.payCents + step < 0)) { t.payCents += step; residual -= step; }
      idx++; guard++;
    }
  }
  const pays = breakdown.map((b) => b.payCents / 100);
  const collected = breakdown.reduce((s, b) => s + b.payCents, 0) / 100;
  return { pays, collected, diff: +(collected - overallTotal).toFixed(2) };
}

const { ok, fine } = require('../lib/app');

const casi = [
  { nome: 'quote esatte (nessun arrotondamento)', owed: [70, 40], total: 110, scartoAtteso: 0 },
  { nome: 'arrotonda ma lo scarto resta 0 (66.67 / 33.33)', owed: [66.666, 33.333], total: 100 },
  { nome: 'scarto di 40 cent: NON si riconcilia', owed: Array(8).fill(12.55), total: 100.40 },
  { nome: 'scarto di 50 cent: si riconcilia', owed: Array(10).fill(12.55), total: 125.50, riconcilia: true },
  { nome: 'si raccoglie qualche cent in più (arrotondamento in su)', owed: [0.08, 0.08, 0.08], total: 0.24 },
];

for (const c of casi) {
  const r = reconcile(c.owed, c.total);
  const quote = r.pays.map((p) => p.toFixed(2)).join(', ');
  // Nessuna quota deve richiedere monetine da 1, 2 o 5 cent.
  ok(`[${c.nome}] quote multiple di 0,10 € (${quote})`, r.pays.every((p) => Math.round(p * 100) % 10 === 0));
  // Sopra i 50 cent di scarto la riconciliazione deve riportarlo sotto i 10.
  if (c.riconcilia) ok(`[${c.nome}] scarto riportato sotto 0,10 € (${r.diff.toFixed(2)})`, Math.abs(r.diff) < 0.10);
  // Sotto la soglia lo scarto resta, ma non deve mai superare mezzo euro.
  else ok(`[${c.nome}] scarto entro mezzo euro (${r.diff.toFixed(2)})`, Math.abs(r.diff) < 0.50);
  if (c.scartoAtteso !== undefined) ok(`[${c.nome}] scarto esatto ${c.scartoAtteso}`, Math.abs(r.diff - c.scartoAtteso) < 0.005);
}

fine();
