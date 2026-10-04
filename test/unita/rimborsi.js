// I rimborsi fatti sono soldi pagati (rimborsi.js, 30 settembre).
//
// Prima una spunta era legata alla cifra del passaggio: uno scontrino
// dimenticato registrato dopo ricalcolava tutto, le spunte non combaciavano
// piu' e chi aveva gia' pagato tornava debitore dell'intera cifra. Con
// quattro persone e 8 € in piu' l'app chiedeva 76 € di bonifici che nessuno
// doveva. Qui lo scenario vero, e poi le regole: senza pagamenti gli stessi
// passaggi di conti.js, pagati tutti non manca niente, le chiavi vecchie
// valgono, la stessa cifra pagata due volte non si annulla da sola, e la
// vista unica sa sempre quanto manca.
const path = require('path');
const { ok, fine } = require('../lib/app');

const RADICE = path.join(__dirname, '..', '..');
require(path.join(RADICE, 'conti.js'));
require(path.join(RADICE, 'rimborsi.js'));
const C = global.Conti;
const R = global.Rimborsi;
ok('rimborsi.js si carica', !!(R && typeof R.residui === 'function'));

const P = { lunch: true, dinner: true };
const membri = (nomi) => nomi.map((n, i) => ({ id: 'm' + i, name: n, isChild: false }));
const giorni = (ms, date, sep) => {
  const cd = {};
  date.forEach((d) => { cd[d] = { meals: {} }; ms.forEach((m) => { cd[d].meals[m.id] = P; }); });
  return cd;
};
const calcola = (o) => C.calcola(Object.assign({ equipment: [], sepDays: [], freeDays: [], equipExemption: false }, o));
const righe = (tr) => tr.map((x) => `${x.from}→${x.to} ${x.amount}`).join(', ');
// Quanto ha in mano ognuno alla fine: saldo dei conti + bonifici fatti e da fare.
const chiude = (t, fatti, daFare) => {
  const n = {};
  t.settlement.forEach((s) => { n[s.name] = (n[s.name] || 0) + s.net; });
  fatti.concat(daFare).forEach((x) => { n[x.from] = (n[x.from] || 0) + x.amount; n[x.to] = (n[x.to] || 0) - x.amount; });
  return Object.keys(n).every((k) => Math.abs(n[k]) < 0.01);
};

// ---------- Lo scenario che ha fatto nascere tutto questo ----------
{
  const ms = membri(['Anna', 'Bruno', 'Carla', 'Dario']);
  const cd = giorni(ms, ['2027-08-10', '2027-08-11']);
  const prima = [
    { id: 'a', price: 120, type: 'alimentare', buyer: 'Anna' },
    { id: 'b', price: 40, type: 'bevande', buyer: 'Bruno' },
  ];
  const t1 = calcola({ members: ms, campData: cd, purchases: prima });
  const settled = [];
  t1.transfers.forEach((x) => settled.push(R.nuovaChiave(x, settled)));
  ok(`pagati i rimborsi, non ne manca nessuno (${righe(t1.transfers)})`,
    R.residui(t1, settled).comune.transfers.length === 0);

  const t2 = calcola({ members: ms, campData: cd, purchases: prima.concat([{ id: 'c', price: 8, type: 'alimentare', buyer: 'Carla' }]) });
  const r = R.residui(t2, settled);
  const daFare = r.comune.transfers;
  const muovere = daFare.reduce((n, x) => n + x.amount, 0);
  // 168 € su 16 pasti = 42 a testa. Carla ha dato 8 + 40 = 48: riceve 6.
  ok(`uno scontrino dimenticato dopo: compare solo la differenza (${righe(daFare)})`,
    Math.abs(muovere - 6) < 0.005 && daFare.every((x) => x.to === 'Carla' && Math.abs(x.amount - 2) < 0.005));
  ok('e i rimborsi di prima restano fatti', r.comune.fatti.length === 2);
  ok('fatti e da fare insieme chiudono i conti di tutti', chiude(t2, r.comune.fatti, daFare));
}

// ---------- Senza pagamenti, esattamente i passaggi di conti.js ----------
// pareggia e' ricopiato: se un giorno le due copie divergono, qui si vede.
{
  let seme = 7;
  const caso = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
  let uguali = true, chiusi = true, vuoti = true;
  for (let giro = 0; giro < 200; giro++) {
    const ms = membri(['Anna', 'Bruno', 'Carla', 'Dario', 'Elsa', 'Fabio'].slice(0, 2 + Math.floor(caso() * 5)));
    const date = ['2027-08-10', '2027-08-11', '2027-08-12'];
    const cd = {};
    date.forEach((d) => { cd[d] = { meals: {} }; ms.forEach((m) => { cd[d].meals[m.id] = { lunch: caso() > 0.3, dinner: caso() > 0.3 }; }); });
    const purchases = [];
    for (let i = 0; i < 1 + Math.floor(caso() * 6); i++) {
      purchases.push({
        id: 'p' + i, price: Math.round(caso() * 9000) / 100,
        type: ['alimentare', 'bevande', 'logistica'][Math.floor(caso() * 3)],
        buyer: caso() > 0.1 ? ms[Math.floor(caso() * ms.length)].name : '',
        ...(caso() > 0.6 ? { account: 'sep' } : {}),
      });
    }
    const t = calcola({ members: ms, campData: cd, purchases, sepDays: caso() > 0.5 ? ['2027-08-12'] : [] });
    const r = R.residui(t, []);
    if (righe(r.comune.transfers) !== righe(t.casse.comune.transfers)
      || righe(r.separata.transfers) !== righe(t.casse.separata.transfers)
      || righe(r.tutte.transfers) !== righe(t.transfersOttimizzati)) uguali = false;
    // Pagato tutto quello che dice l'app, nella vista per cassa e in quella
    // unica: non resta niente da fare.
    const perCassa = [];
    t.transfers.forEach((x) => perCassa.push(R.nuovaChiave(x, perCassa)));
    const rc = R.residui(t, perCassa);
    if (rc.comune.transfers.length || rc.separata.transfers.length) vuoti = false;
    if (R.daFare(rc, true).length) vuoti = false;
    const unica = [];
    t.transfersOttimizzati.forEach((x) => unica.push(R.nuovaChiave(x, unica)));
    if (R.residui(t, unica).tutte.transfers.length) vuoti = false;
    // A meta': fatti e da fare insieme fanno quanto dicevano i conti.
    const meta = perCassa.slice(0, Math.floor(perCassa.length / 2));
    const rm = R.residui(t, meta);
    const somma = (tr) => tr.reduce((n, x) => n + x.amount, 0);
    if (Math.abs(somma(rm.comune.fatti) + somma(rm.separata.fatti) + somma(rm.comune.transfers) + somma(rm.separata.transfers) - somma(t.transfers)) > 0.02) chiusi = false;
  }
  ok('senza pagamenti escono gli stessi passaggi di conti.js, in tutte e due le viste (200 campi a caso)', uguali);
  ok('pagato tutto quello che l\'app dice, non resta niente da fare', vuoti);
  ok('a metà dei pagamenti, fatti più da fare fanno quanto dicevano i conti', chiusi);
}

// ---------- Le chiavi ----------
{
  const t = { from: 'Carla', to: 'Anna', amount: 40, cassa: 'comune' };
  ok('la chiave è quella di sempre', R.chiave(t) === 'Carla→Anna@4000'
    && R.chiave({ ...t, cassa: 'separata' }) === 'sep:Carla→Anna@4000' && R.chiave({ ...t, cassa: 'tutte' }) === 'opt:Carla→Anna@4000');
  const letta = R.leggi('sep:Carla→Anna@4000');
  ok('una chiave salvata prima vale come pagamento', !!letta && letta.cassa === 'separata' && letta.from === 'Carla' && letta.to === 'Anna' && letta.cents === 4000);
  ok('la stessa cifra pagata due volte prende una chiave nuova', R.nuovaChiave(t, ['Carla→Anna@4000']) === 'Carla→Anna@4000#2'
    && R.nuovaChiave(t, ['Carla→Anna@4000', 'Carla→Anna@4000#2']) === 'Carla→Anna@4000#3');
  ok('e si legge anche lei', R.leggi('Carla→Anna@4000#2').cents === 4000);
  ok('una chiave storta non vale niente', R.leggi('boh') === null && R.leggi('A→B@0') === null && R.leggi('A→B@x') === null);
}

// ---------- Due casse, e un pagamento dalla vista unica ----------
{
  const ms = membri(['Anna', 'Bruno', 'Carla']);
  const cd = giorni(ms, ['2027-08-10', '2027-08-11']);
  const t = calcola({ members: ms, campData: cd, sepDays: ['2027-08-11'], purchases: [
    { id: '1', price: 90, type: 'alimentare', buyer: 'Anna' },
    { id: '2', price: 30, type: 'alimentare', account: 'sep', buyer: 'Bruno' },
  ] });
  const r0 = R.residui(t, []);
  ok('senza pagamenti la vista per cassa sa quanto manca', r0.unica === false);
  // Un bonifico dalla vista unica: vale anche per la vista per cassa?
  const una = [R.nuovaChiave(t.transfersOttimizzati[0], [])];
  const r1 = R.residui(t, una);
  ok('pagato dalla vista unica, la vista per cassa rimanda a quella', r1.unica === true);
  ok('e la vista unica lo sconta', r1.tutte.transfers.length === t.transfersOttimizzati.length - 1 && r1.tutte.fatti.length === 1);
  ok('chi deve ancora qualcosa lo dice la vista unica', R.daFare(r1, false).length === r1.tutte.transfers.length);
  // Pagato per cassa: la vista unica li conta anche lei.
  const perCassa = [];
  t.transfers.forEach((x) => perCassa.push(R.nuovaChiave(x, perCassa)));
  const r2 = R.residui(t, perCassa);
  ok('pagati per cassa, anche chi guarda la vista unica non ha più niente da fare', R.daFare(r2, true).length === 0 && r2.perCassa === true);
  ok('perché la vista unica rimanda a quella per cassa', R.vistaUnica(r2, true) === false && R.vistaUnica(r0, true) === true);
}

// ---------- Con una cassa sola le viste sono la stessa ----------
{
  const ms = membri(['Anna', 'Bruno']);
  const cd = giorni(ms, ['2027-08-10']);
  const t = calcola({ members: ms, campData: cd, purchases: [{ id: '1', price: 40, type: 'alimentare', buyer: 'Anna' }] });
  const r = R.residui(t, ['opt:Bruno→Anna@2000']);
  ok('un pagamento della vista unica vale per la cassa comune, se è l\'unica', r.unica === false && r.comune.transfers.length === 0 && r.comune.fatti.length === 1);
}

// ---------- Il link PayPal con la cifra ----------
{
  ok('paypal.me con la cifra già scritta, nel formato che PayPal legge',
    R.linkPaypal('paypal.me/lorenzo', 12.5) === 'https://paypal.me/lorenzo/12.50EUR'
    && R.linkPaypal('https://www.paypal.me/l.b/', 3) === 'https://paypal.me/l.b/3.00EUR');
  ok('un\'email PayPal, una cifra a zero o un indirizzo storto non danno un link',
    R.linkPaypal('anna@example.com', 5) === null && R.linkPaypal('paypal.me/anna', 0) === null
    && R.linkPaypal('paypal.me/anna/../../x', 5) === null && R.linkPaypal('evil.com/paypal.me/anna', 5) === null);
}

fine();
