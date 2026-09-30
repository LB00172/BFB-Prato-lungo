// La Panoramica: il riassunto di un campo, con i conti veri.
//
// Le cifre devono essere le STESSE che il campo mostra a chi ci sta dentro:
// per questo il riassunto chiama Conti.calcola invece di rifare i conti, e qui
// si confronta con Conti.calcola chiamato a mano. Poi le due cose che la
// Panoramica aggiunge: i rimborsi ancora aperti (nella vista che il gruppo
// usa, non in tutte e due) e l'abbonamento che la apre.
const path = require('path');
const { ok, fine } = require('../lib/app');
const RADICE = path.resolve(__dirname, '..', '..');
require(path.join(RADICE, 'conti.js'));
require(path.join(RADICE, 'voci.js'));
require(path.join(RADICE, 'rimborsi.js'));
require(path.join(RADICE, 'panoramica.js'));
const C = globalThis.Conti;
const P = globalThis.Panoramica;

ok('panoramica.js si carica', !!(P && typeof P.riassunto === 'function'));
if (!P) { fine(); }

const pasto = { lunch: true, dinner: true };
const stato = {
  members: [
    { id: 'a', name: 'Anna', isChild: false },
    { id: 'b', name: 'Bruno', isChild: false },
    { id: 'c', name: 'Carla', isChild: false },
    { id: 'd', name: 'Dino', isChild: true },
  ],
  campData: {
    '2027-08-11': { note: '', guestsNames: '', meals: { a: pasto, b: pasto, c: pasto, d: pasto } },
    '2027-08-12': { note: '', guestsNames: '', meals: { a: pasto, b: pasto, c: pasto, d: pasto } },
  },
  purchases: [
    { id: 'p1', name: 'Spesa', price: 90, type: 'alimentare', buyer: 'Anna', at: 1000 },
    { id: 'p2', name: 'Gas', price: 30, type: 'logistica', buyer: 'Bruno', at: 3000 },
    { id: 'p3', name: 'Vino', price: 24, type: 'bevande', buyer: 'Anna', at: 2000 },
  ],
  equipment: [], sepDays: [], freeDays: [], settled: [],
};

// ---------- Le cifre sono quelle del campo ----------
{
  const r = P.riassunto(stato, null);
  const t = C.calcola({ members: stato.members, campData: stato.campData, purchases: stato.purchases, equipment: [], sepDays: [], freeDays: [], equipExemption: false });
  ok(`il totale è quello dei conti del campo (${r.speso} = ${t.overallTotal})`, Math.abs(r.speso - t.overallTotal) < 0.005 && r.speso === 144);
  ok(`le persone si contano, bambini a parte (${r.persone}, ${r.adulti} adulti, ${r.bambini} bambini)`, r.persone === 4 && r.adulti === 3 && r.bambini === 1);
  ok(`a testa è il totale diviso gli adulti (${r.aTesta})`, r.aTesta === 48);
  ok(`i rimborsi da fare sono quelli dei conti (${r.rimborsiAperti}, ${r.daMuovere} €)`,
    r.rimborsiAperti === t.transfers.length && r.rimborsiAperti > 0
    && Math.abs(r.daMuovere - t.transfers.reduce((n, x) => n + x.amount, 0)) < 0.005);
  ok(`l'ultima spesa è la più recente, non l'ultima della lista (${r.ultimaSpesa})`, r.ultimaSpesa === 3000);
  ok('senza buchi nei conti non se ne segnalano', r.buchi === 0);

  // Segnati i rimborsi per cassa, non resta niente da fare.
  const fatti = Object.assign({}, stato, { settled: t.transfers.map(P.chiaveRimborso) });
  ok('segnati i rimborsi, non ne resta nessuno aperto', P.riassunto(fatti, null).rimborsiAperti === 0);
  // Se il gruppo paga dalla vista ottimizzata, si contano quelli: i rimborsi
  // per cassa non segnati non sono bonifici da fare.
  const ott = Object.assign({}, stato, { settled: t.transfersOttimizzati.map(P.chiaveRimborso) });
  ok('pagati dalla vista ottimizzata, contano quelli', P.riassunto(ott, null).rimborsiAperti === 0);
  const unoSolo = Object.assign({}, stato, { settled: [P.chiaveRimborso(t.transfers[0])] });
  ok('uno segnato, gli altri restano aperti', P.riassunto(unoSolo, null).rimborsiAperti === t.transfers.length - 1);

  // Una voce spenta si toglie dai conti e si dichiara, come nel campo.
  const spenta = P.riassunto(stato, { logistica: 'fuori' });
  ok(`una voce spenta esce dal totale e si dichiara (${spenta.speso} + ${spenta.fuoriConto})`, spenta.speso === 114 && spenta.fuoriConto === 30);
}

// ---------- Un campo vuoto, o uno storto ----------
{
  const v = P.riassunto({}, null);
  ok('un campo vuoto non esplode, e a testa non c\'è', v.speso === 0 && v.persone === 0 && v.aTesta === null && v.ultimaSpesa === null);
  ok('nemmeno senza niente', P.riassunto(null, null).speso === 0);
  const buco = P.riassunto({ members: stato.members, campData: {}, purchases: [stato.purchases[0]] }, null);
  ok(`una spesa senza nessuno a tavola è un buco da guardare (${buco.buchi})`, buco.buchi > 0);
}

// ---------- L'abbonamento ----------
{
  const ora = Date.parse('2027-01-10T12:00:00Z');
  ok('un abbonamento che scade dopo vale', P.abbonamentoAttivo({ scade: ora + 1000 }, ora));
  ok('scaduto no', !P.abbonamentoAttivo({ scade: ora - 1 }, ora));
  ok('senza documento no, né con una scadenza scritta male', !P.abbonamentoAttivo(null, ora) && !P.abbonamentoAttivo({ scade: '2099-01-01' }, ora));
}

// ---------- I totali ----------
{
  const r1 = { riassunto: P.riassunto(stato, null) };
  const t = P.totali([r1, r1, { errore: 'x' }]);
  ok(`i totali contano solo i campi letti (${t.campi} campi, ${t.speso} €)`, t.campi === 2 && t.speso === 288);
}

fine();
