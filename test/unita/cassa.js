// La cassa del campo (cassa.js, 4 ottobre), con i numeri.
//
// Un campo scout: quota di 150 € a testa per i ragazzi, i capi esenti e
// senza quota, un contributo del gruppo, le spese di sempre. La cassa deve
// dire quanto doveva entrare, quanto e' entrato, quanto si e' speso (fuori
// conto compreso) e quanto avanza — e il rendiconto deve dire le stesse
// cifre, con la virgola dei decimali che il tesoriere si aspetta.
const path = require('path');
const { ok, fine } = require('../lib/app');

const RADICE = path.join(__dirname, '..', '..');
require(path.join(RADICE, 'cassa.js'));
const K = global.Cassa;
ok('cassa.js si carica', !!(K && typeof K.riassunto === 'function'));

const membri = [
  { id: 'r1', name: 'Luca', quota: 150 },
  { id: 'r2', name: 'Sara', quota: '150' },
  { id: 'r3', name: 'Matteo', quota: 120 },   // fratello: quota ridotta
  { id: 'c1', name: 'Capo Anna', isChild: true },   // esente, nessuna quota
];
const incassi = [
  { id: 'i1', chi: 'r1', quanto: 150, nota: 'Quota', at: Date.parse('2027-06-01T10:00:00') },
  { id: 'i2', chi: 'r2', quanto: 100, nota: 'Acconto', at: Date.parse('2027-06-02T10:00:00') },
  { id: 'i3', chi: '', da: 'Contributo del gruppo', quanto: 80, at: Date.parse('2027-06-03T10:00:00') },
  { id: 'i4', chi: 'r3', quanto: 0, at: 5 },   // una cifra a zero non conta
];
const totali = { overallTotal: 390 };
const fuoriConto = { totale: 30 };
const r = K.riassunto({ incassi, members: membri, totali, fuoriConto });

ok(`entrate: quote versate più il contributo (${r.entrate})`, r.entrate === 330);
ok(`previste: solo chi ha una quota (${r.previste})`, r.previste === 420);
ok(`da incassare: Sara 50 e Matteo 120 (${r.daIncassare})`, r.daIncassare === 170);
ok(`uscite: le spese più il fuori conto (${r.uscite})`, r.uscite === 420);
ok(`saldo: 330 − 420 = −90 (${r.saldo})`, r.saldo === -90);
ok(`a quote tutte versate avanzerebbero 80 € (${r.saldoAtteso})`, r.saldoAtteso === 80);
const p = Object.fromEntries(r.persone.map((x) => [x.name, x]));
ok('Luca ha pagato tutto, a Sara mancano 50, Matteo deve tutto', p.Luca.manca === 0 && p.Sara.manca === 50 && p.Matteo.manca === 120);
ok('il capo esente senza quota non deve niente alla cassa', p['Capo Anna'].previsto === 0 && p['Capo Anna'].manca === 0);
ok('gli incassi vanno dal più recente, e quello a zero non c\'è', r.incassi.map((x) => x.id).join(',') === 'i3,i2,i1');

// ---------- Il rendiconto ----------
const T = {
  tipo: 'Tipo', data: 'Data', descrizione: 'Descrizione', chi: 'Chi', categoria: 'Categoria', importo: 'Importo (€)',
  entrata: 'Entrata', uscita: 'Uscita', quota: 'Incasso', attrezzatura: 'Attrezzatura',
  tipi: { alimentare: 'Cibo', bevande: 'Bevande', logistica: 'Logistica' },
  totaleEntrate: 'Entrate', totaleUscite: 'Uscite', saldo: 'Saldo', daIncassare: 'Da incassare',
};
const purchases = [
  { id: 'p1', name: 'Spesa; grande', price: 300, type: 'alimentare', buyer: 'Capo Anna', at: Date.parse('2027-07-10T10:00:00') },
  { id: 'p2', name: 'Gas "blu"', price: 90, type: 'logistica', buyer: 'Capo Anna', at: Date.parse('2027-07-11T10:00:00') },
  { id: 'p3', name: 'Pullman', price: 30, type: 'logistica', buyer: '', at: Date.parse('2027-07-09T10:00:00') },
];
const csv = K.rendiconto({ riassunto: r, purchases, equipment: [], members: membri, t: T });
const righe = csv.trim().split('\r\n');
ok(`una riga di intestazione, una per movimento, e i totali (${righe.length} righe)`, righe[0] === 'Tipo;Data;Descrizione;Chi;Categoria;Importo (€)' && righe.length === 1 + 3 + 3 + 1 + 4);
ok('le entrate prima, in ordine di data, con chi le ha date', /^Entrata;2027-06-01;Quota;Luca;Incasso;150,00$/.test(righe[1]) && /Contributo del gruppo;Incasso;80,00$/.test(righe[3]));
ok('le uscite col segno meno e la virgola dei decimali', righe.includes('Uscita;2027-07-10;"Spesa; grande";Capo Anna;Cibo;-300,00'));
ok('le virgolette dentro una descrizione si raddoppiano', righe.some((x) => x.includes('"Gas ""blu"""')));
ok('in fondo gli stessi totali del riepilogo', righe.includes('Saldo;;;;;-90,00') && righe.includes('Da incassare;;;;;170,00'));
const uscite = righe.filter((x) => x.startsWith('Uscita;')).reduce((n, x) => n + Number(x.split(';').pop().replace(',', '.')), 0);
ok(`le uscite del file sommano le spese registrate (${uscite})`, Math.abs(uscite + 420) < 0.005);

fine();
