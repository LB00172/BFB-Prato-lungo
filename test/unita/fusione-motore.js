// Test della fusione degli stati: due telefoni offline che poi si sincronizzano.
require('../../sync-merge.js');
const SM = globalThis.SyncMerge;

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  ✗ ' + msg); } };
const clone = (o) => JSON.parse(JSON.stringify(o));

// Un "dispositivo" simulato: tiene stato + meta, come fa la app.
class Dev {
  constructor(name, state, meta) {
    this.name = name;
    this.state = state || { members: [], campData: {}, purchases: [], gear: [], settled: [], equipment: [], toBuy: [] };
    this.meta = meta || { flat: SM.flatten(this.state), rev: {}, del: {} };
  }
  edit(fn, t) {                       // modifica locale, datata
    fn(this.state);
    this.meta = SM.bump(this.state, this.meta, t);
    return this;
  }
  payload() {                         // ciò che viene spedito al cloud
    return Object.assign(clone(this.state), { _meta: { v: 2, rev: this.meta.rev, del: this.meta.del } });
  }
  receive(payload, now) {             // arriva lo stato dell'altro
    const remote = clone(payload);
    const rmeta = remote._meta; delete remote._meta;
    const res = SM.merge(this.state, this.meta, remote, rmeta, now);
    this.state = res.state;
    this.meta = res.meta;
    this.pushed = !SM.sameAs(res.meta, remote, rmeta);   // deve rimandare?
    return this;
  }
  names(list) { return this.state[list].map((x) => x.name || x.text).sort(); }
}

const T = 1000000;

console.log('1) Due telefoni offline aggiungono spese diverse');
{
  const base = { members: [{ id: 'u1', name: 'Lorenzo' }], campData: {}, purchases: [], gear: [], settled: [], equipment: [], toBuy: [] };
  const A = new Dev('A', clone(base));
  const B = new Dev('B', clone(base));
  A.edit((s) => s.purchases.push({ id: 'p1', name: 'Pasta', price: 12, type: 'alimentare', buyer: 'Lorenzo' }), T + 10);
  B.edit((s) => s.purchases.push({ id: 'p2', name: 'Birra', price: 20, type: 'bevande', buyer: 'Bruno' }), T + 20);

  // B torna online per primo, poi A: prima si scrivevano addosso.
  const fromB = B.payload();
  A.receive(fromB);
  ok(A.names('purchases').join() === 'Birra,Pasta', 'A deve avere entrambe le spese, ha ' + A.names('purchases'));
  ok(A.pushed === true, 'A deve rimandare lo stato fuso');
  B.receive(A.payload());
  ok(B.names('purchases').join() === 'Birra,Pasta', 'B deve avere entrambe le spese, ha ' + B.names('purchases'));
  ok(B.pushed === false, 'B non deve rimandare nulla (convergenza)');
  ok(SM.equalMap(SM.flatten(A.state), SM.flatten(B.state)), 'i due stati devono coincidere');
}

console.log('2) Cancellazione: non deve resuscitare');
{
  const base = { members: [], campData: {}, purchases: [{ id: 'p1', name: 'Pasta', price: 12 }], gear: [], settled: [], equipment: [], toBuy: [] };
  const A = new Dev('A', clone(base));
  const B = new Dev('B', clone(base));
  A.edit((s) => { s.purchases = []; }, T + 50);                       // A la cancella
  B.edit((s) => s.purchases.push({ id: 'p2', name: 'Vino', price: 8 }), T + 60);
  A.receive(B.payload());
  ok(A.names('purchases').join() === 'Vino', 'la voce cancellata non deve tornare, ho ' + A.names('purchases'));
  B.receive(A.payload());
  ok(B.names('purchases').join() === 'Vino', 'anche su B la voce deve sparire, ho ' + B.names('purchases'));
}

console.log('3) Cancello io, ma l\'altro l\'ha modificata dopo: vince la modifica');
{
  const base = { members: [], campData: {}, purchases: [{ id: 'p1', name: 'Pasta', price: 12 }], gear: [], settled: [], equipment: [], toBuy: [] };
  const A = new Dev('A', clone(base));
  const B = new Dev('B', clone(base));
  A.edit((s) => { s.purchases = []; }, T + 50);
  B.edit((s) => { s.purchases[0].price = 14; }, T + 90);              // prezzo corretto dopo
  A.receive(B.payload());
  ok(A.state.purchases.length === 1 && A.state.purchases[0].price === 14, 'deve vincere la correzione più recente');
}

console.log('4) Stessa voce modificata da entrambi: vince la più recente');
{
  const base = { members: [], campData: {}, purchases: [{ id: 'p1', name: 'Pasta', price: 12 }], gear: [], settled: [], equipment: [], toBuy: [] };
  const A = new Dev('A', clone(base));
  const B = new Dev('B', clone(base));
  A.edit((s) => { s.purchases[0].price = 13; }, T + 100);
  B.edit((s) => { s.purchases[0].price = 15; }, T + 200);
  A.receive(B.payload());
  ok(A.state.purchases[0].price === 15, 'prezzo atteso 15, trovato ' + A.state.purchases[0].price);
  B.receive(A.payload());
  ok(B.state.purchases[0].price === 15, 'anche B deve restare a 15');
}

console.log('5) Presenze dello stesso giorno segnate da due persone');
{
  const base = {
    members: [{ id: 'u1', name: 'Lorenzo' }, { id: 'u2', name: 'Bruno' }],
    campData: { '2026-08-12': { meals: {}, notes: '' } },
    purchases: [], gear: [], settled: [], equipment: [], toBuy: [],
  };
  const A = new Dev('A', clone(base));
  const B = new Dev('B', clone(base));
  A.edit((s) => { s.campData['2026-08-12'].meals.u1 = { lunch: true, dinner: true }; }, T + 10);
  B.edit((s) => { s.campData['2026-08-12'].meals.u2 = { lunch: false, dinner: true }; }, T + 20);
  A.receive(B.payload());
  const m = A.state.campData['2026-08-12'].meals;
  ok(m.u1 && m.u1.lunch === true, 'deve restare la presenza segnata da A');
  ok(m.u2 && m.u2.dinner === true, 'deve arrivare la presenza segnata da B');
  B.receive(A.payload());
  ok(Object.keys(B.state.campData['2026-08-12'].meals).length === 2, 'entrambe le presenze su B');
}

console.log('6) Note dello stesso giorno: vince la più recente, il resto si somma');
{
  const base = { members: [], campData: { '2026-08-13': { meals: {}, notes: 'legna' } }, purchases: [], gear: [], settled: [], equipment: [], toBuy: [] };
  const A = new Dev('A', clone(base));
  const B = new Dev('B', clone(base));
  A.edit((s) => { s.campData['2026-08-13'].notes = 'legna + acqua'; }, T + 10);
  B.edit((s) => { s.campData['2026-08-14'] = { meals: {}, notes: 'turni' }; }, T + 20);
  A.receive(B.payload());
  ok(A.state.campData['2026-08-13'].notes === 'legna + acqua', 'nota di A conservata');
  ok(A.state.campData['2026-08-14'] && A.state.campData['2026-08-14'].notes === 'turni', 'giorno nuovo di B arrivato');
}

console.log('7) Liste, attrezzatura, dotazioni e rimborsi saldati');
{
  const base = { members: [], campData: {}, purchases: [], gear: [], settled: [], equipment: [], toBuy: [] };
  const A = new Dev('A', clone(base));
  const B = new Dev('B', clone(base));
  A.edit((s) => { s.toBuy.push({ id: 't1', name: 'Pane' }); s.equipment.push({ id: 'e1', text: 'Gazebo', price: 40, bought: false }); s.settled.push('Bruno>Lorenzo'); }, T + 10);
  B.edit((s) => { s.toBuy.push({ id: 't2', name: 'Latte' }); s.gear.push({ id: 'g1', text: 'Pila frontale' }); s.settled.push('Anna>Lorenzo'); }, T + 20);
  A.receive(B.payload());
  ok(A.names('toBuy').join() === 'Latte,Pane', 'lista fusa: ' + A.names('toBuy'));
  ok(A.names('equipment').join() === 'Gazebo', 'attrezzatura conservata');
  ok(A.names('gear').join() === 'Pila frontale', 'dotazione di B arrivata');
  ok(A.state.settled.sort().join() === 'Anna>Lorenzo,Bruno>Lorenzo', 'rimborsi saldati fusi: ' + A.state.settled);
}

console.log('8) Tre telefoni offline, sincronizzazione a catena');
{
  const base = { members: [{ id: 'u1', name: 'Lorenzo' }], campData: {}, purchases: [], gear: [], settled: [], equipment: [], toBuy: [] };
  const A = new Dev('A', clone(base)), B = new Dev('B', clone(base)), C = new Dev('C', clone(base));
  A.edit((s) => s.purchases.push({ id: 'p1', name: 'Pasta', price: 10 }), T + 1);
  B.edit((s) => s.purchases.push({ id: 'p2', name: 'Birra', price: 20 }), T + 2);
  C.edit((s) => s.purchases.push({ id: 'p3', name: 'Carne', price: 30 }), T + 3);
  // Il cloud fa da tramite: ognuno legge l'ultimo stato e riscrive il fuso.
  let cloudDoc = A.payload();
  B.receive(cloudDoc); cloudDoc = B.payload();
  C.receive(cloudDoc); cloudDoc = C.payload();
  A.receive(cloudDoc);
  B.receive(cloudDoc);
  ok(A.names('purchases').join() === 'Birra,Carne,Pasta', 'A: ' + A.names('purchases'));
  ok(B.names('purchases').join() === 'Birra,Carne,Pasta', 'B: ' + B.names('purchases'));
  ok(C.names('purchases').join() === 'Birra,Carne,Pasta', 'C: ' + C.names('purchases'));
  const tot = A.state.purchases.reduce((s, p) => s + p.price, 0);
  ok(tot === 60, 'totale spese atteso 60, trovato ' + tot);
}

console.log('9) Convergenza: niente rimbalzi infiniti');
{
  const base = { members: [], campData: {}, purchases: [{ id: 'p1', name: 'Pasta', price: 12 }], gear: [], settled: [], equipment: [], toBuy: [] };
  const A = new Dev('A', clone(base));
  const B = new Dev('B', clone(base));
  A.edit((s) => s.purchases.push({ id: 'p2', name: 'Vino', price: 8 }), T + 10);
  B.edit((s) => s.purchases.push({ id: 'p3', name: 'Olio', price: 6 }), T + 11);
  let rounds = 0, doc = A.payload(), turn = B;
  while (rounds < 20) {
    turn.receive(doc);
    rounds++;
    if (!turn.pushed) break;
    doc = turn.payload();
    turn = turn === A ? B : A;
  }
  ok(rounds < 10, 'la sincronizzazione si deve fermare, giri usati: ' + rounds);
  ok(A.state.purchases.length === 3 && B.state.purchases.length === 3, 'entrambi con 3 spese');
}

console.log('10) Chiusura del campo: azzerare deve propagarsi, non tornare indietro');
{
  const full = {
    members: [{ id: 'u1', name: 'Lorenzo' }, { id: 'u2', name: 'Bruno' }],
    campData: { '2026-08-12': { meals: { u1: { lunch: true, dinner: true } }, notes: 'ok' } },
    purchases: [{ id: 'p1', name: 'Pasta', price: 12 }],
    gear: [{ id: 'g1', text: 'Pila' }], settled: ['Bruno>Lorenzo'],
    equipment: [{ id: 'e1', text: 'Gazebo', price: 40, bought: true }],
    toBuy: [{ id: 't1', name: 'Pane' }],
  };
  const A = new Dev('A', clone(full));
  const B = new Dev('B', clone(full));
  A.edit((s) => {
    s.members = []; s.campData = {}; s.purchases = []; s.gear = []; s.settled = []; s.equipment = []; s.toBuy = [];
  }, T + 500);
  B.receive(A.payload());
  const empty = ['members', 'purchases', 'gear', 'settled', 'equipment', 'toBuy'].every((k) => B.state[k].length === 0);
  ok(empty, 'anche B deve risultare azzerato');
  ok(Object.keys(B.state.campData).length === 0 || !B.state.campData['2026-08-12'] || Object.keys(B.state.campData['2026-08-12']).length === 0, 'presenze azzerate su B');
  // E se B era offline e nel frattempo aggiunge una spesa dopo la chiusura?
  const C = new Dev('C', clone(full));
  C.edit((s) => s.purchases.push({ id: 'p9', name: 'Ghiaccio', price: 3 }), T + 900);
  C.receive(A.payload());
  ok(C.names('purchases').join() === 'Ghiaccio', 'la spesa fatta dopo la chiusura resta: ' + C.names('purchases'));
}

console.log('11) Client vecchio (senza cronologia): nessun crash');
{
  const A = new Dev('A', { members: [{ id: 'u1', name: 'Lorenzo' }], campData: {}, purchases: [], gear: [], settled: [], equipment: [], toBuy: [] });
  const res = SM.merge(A.state, A.meta, { members: [{ id: 'u2', name: 'Bruno' }] }, null);
  ok(res.state.members.length === 2, 'unione anche senza meta remoto');
  ok(Array.isArray(res.state.purchases) && res.state.purchases.length === 0, 'campi mancanti gestiti');
}

console.log('12) Lapidi: pulizia dopo 90 giorni');
{
  const A = new Dev('A', { members: [{ id: 'u1', name: 'X' }], campData: {}, purchases: [], gear: [], settled: [], equipment: [], toBuy: [] });
  const now = Date.now();
  A.edit((s) => { s.members = []; }, now - 100 * 24 * 3600 * 1000);
  ok(Object.keys(A.meta.del).length === 1, 'lapide creata');
  A.edit((s) => { s.purchases.push({ id: 'p1', name: 'Y', price: 1 }); }, now);
  ok(Object.keys(A.meta.del).length === 0, 'lapide vecchia rimossa, ne restano ' + Object.keys(A.meta.del).length);
}

console.log('13) Telefono con l\'orologio INDIETRO: le sue modifiche valgono lo stesso');
{
  // A ha l'ora giusta, B è indietro di un mese. B vede la modifica di A e poi
  // la corregge: la sua correzione DEVE vincere, anche se il suo orologio
  // marcherebbe una data più vecchia.
  const base = { members: [{ id: 'u1', name: 'Lorenzo' }], campData: {}, purchases: [{ id: 'p1', name: 'Pasta', price: 10 }], gear: [], settled: [], equipment: [], toBuy: [] };
  const ora = Date.parse('2026-08-03T12:00:00Z');
  const indietro = ora - 2 * 24 * 3600 * 1000;   // due giorni indietro

  const A = new Dev('A', clone(base));
  const B = new Dev('B', clone(base));

  A.edit((s) => { s.purchases[0].price = 20; }, ora);
  B.receive(A.payload(), indietro);
  ok(B.state.purchases[0].price === 20, 'B riceve la modifica di A');

  // B corregge col SUO orologio, indietro di un mese.
  B.edit((s) => { s.purchases[0].price = 25; }, indietro);
  ok(B.meta.hi > ora, 'B data la sua modifica dopo quella che ha visto (hi=' + B.meta.hi + ')');

  A.receive(B.payload(), ora);
  ok(A.state.purchases[0].price === 25, 'la correzione di B vince, malgrado l\'orologio indietro');
}

console.log('14) Telefono con l\'orologio AVANTI: non trascina l\'orologio degli altri');
{
  const base = { members: [], campData: {}, purchases: [{ id: 'p1', name: 'Pasta', price: 10 }], gear: [], settled: [], equipment: [], toBuy: [] };
  const ora = Date.parse('2026-08-03T12:00:00Z');
  const avanti = ora + 365 * 24 * 3600 * 1000;   // un anno nel futuro

  const A = new Dev('A', clone(base));
  const B = new Dev('B', clone(base));

  B.edit((s) => { s.purchases[0].price = 99; }, avanti);
  A.receive(B.payload(), ora);
  ok(A.state.purchases[0].price === 99, 'la modifica arriva comunque: non si butta via niente');
  ok(A.meta.hi < ora + 8 * 24 * 3600 * 1000, 'ma A non adotta un orologio assurdo (hi=' + A.meta.hi + ')');

  // E soprattutto: A e B restano d'accordo. Un telefono con l'ora sbagliata
  // può vincere un confronto, ma non deve spaccare la sincronizzazione.
  A.edit((s) => { s.purchases[0].price = 12; }, ora + 60000);
  B.receive(A.payload(), avanti);
  A.receive(B.payload(), ora);
  ok(A.state.purchases[0].price === B.state.purchases[0].price,
    'i due telefoni restano d\'accordo (' + A.state.purchases[0].price + ' / ' + B.state.purchases[0].price + ')');
  B.receive(A.payload(), avanti);
  ok(A.state.purchases[0].price === B.state.purchases[0].price, 'e non si rimbalzano le versioni');
}

console.log('15) Chi torna online non riporta indietro i dati degli altri');
{
  // A resta offline tre giorni con dati vecchi; nel frattempo B lavora.
  const base = {
    members: [{ id: 'u1', name: 'Lorenzo' }], campData: {},
    purchases: [{ id: 'p1', name: 'Pasta', price: 10 }],
    gear: [], settled: [], equipment: [], toBuy: [],
  };
  const t0 = Date.parse('2026-08-03T12:00:00Z');
  const A = new Dev('A', clone(base));
  const B = new Dev('B', clone(base));

  B.edit((s) => { s.purchases.push({ id: 'p2', name: 'Birra', price: 20 }); }, t0 + 1000);
  B.edit((s) => { s.members.push({ id: 'u2', name: 'Bruno' }); }, t0 + 2000);

  // A rientra: non ha toccato niente, ha solo dati vecchi.
  A.receive(B.payload(), t0 + 5000);
  ok(A.names('purchases').join() === 'Birra,Pasta', 'A riceve tutto il lavoro di B');
  ok(A.pushed === false, 'e non rimanda indietro niente: non ha nulla da aggiungere');

  // E se A avesse anche lavorato offline, le due cose si sommano.
  const C = new Dev('C', clone(base));
  C.edit((s) => { s.purchases.push({ id: 'p3', name: 'Carbone', price: 5 }); }, t0 + 500);
  C.receive(B.payload(), t0 + 5000);
  ok(C.names('purchases').join() === 'Birra,Carbone,Pasta', 'niente si perde da nessuna delle due parti');
  ok(C.pushed === true, 'e C ripubblica l\'unione');
}

console.log('16) Telefono con l\'app VECCHIA (dati senza cronologia) non cancella nulla');
{
  // È il caso che aveva riportato indietro il campo: un telefono con una
  // versione vecchia pubblica il suo stato senza date. Trattato come "voci di
  // data ignota", non può vincere su niente e non può cancellare niente.
  const t0 = Date.parse('2026-08-03T12:00:00Z');
  const B = new Dev('B', {
    members: [{ id: 'u1', name: 'Lorenzo' }], campData: {},
    purchases: [{ id: 'p1', name: 'Pasta', price: 10 }],
    gear: [], settled: [], equipment: [], toBuy: [],
  });
  B.edit((s) => { s.purchases.push({ id: 'p2', name: 'Birra', price: 20 }); }, t0);
  B.edit((s) => { s.purchases[0].price = 15; }, t0 + 1000);

  // Il vecchio manda solo la Pasta a 10, senza _meta.
  const vecchio = {
    members: [{ id: 'u1', name: 'Lorenzo' }], campData: {},
    purchases: [{ id: 'p1', name: 'Pasta', price: 10 }],
    gear: [], settled: [], equipment: [], toBuy: [],
  };
  const res = SM.merge(B.state, B.meta, vecchio, SM.emptyMeta(), t0 + 2000);
  ok(res.state.purchases.length === 2, 'la Birra non sparisce');
  ok(res.state.purchases.find((x) => x.id === 'p1').price === 15, 'il prezzo aggiornato non torna indietro');
}

console.log('\n' + checks + ' controlli — ' + (fails ? fails + ' PROBLEMI' : 'nessun problema'));
process.exit(fails ? 1 : 0);
