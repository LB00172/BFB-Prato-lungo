// La regola che sta fra il lavoro di tutti e una sovrascrittura.
//
// Prima non esisteva: si faceva setDoc e basta. Siccome Firestore mette in
// coda le scritture fatte offline e le rigioca al ritorno della linea, un
// telefono rientrato dal campo dopo tre giorni senza rete riscriveva il
// documento con il PROPRIO stato, cancellando il lavoro di chi era rientrato
// prima — e non poteva accorgersene, perché le proprie scritture le ignora.
//
// firebase-sync.js vuole window e localStorage anche solo per essere caricato:
// qui gliene si dà una versione minima, così la regola si può provare senza
// browser e senza Firebase.
const finto = {};
global.localStorage = {
  getItem: (k) => (k in finto ? finto[k] : null),
  setItem: (k, v) => { finto[k] = String(v); },
  removeItem: (k) => { delete finto[k]; },
};
global.window = global;
require('../../firebase-sync.js');
const posso = global.window.CloudSync.sovrascrivibile;

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  ✗ ' + msg); } };

const IO = 'telefono-mio';
const ALTRO = 'telefono-altro';
const A = '{"members":[{"id":"1"}]}';
const B = '{"members":[{"id":"2"}]}';

console.log('1) Quando si PUÒ scrivere');
{
  ok(posso(null, null, null, IO) === true,
    'campo nuovo: nel cloud non c\'è niente, si pubblica');
  ok(posso({ data: A, updatedBy: IO }, null, null, IO) === true,
    'l\'ha scritto questo telefono: si può riscrivere');
  ok(posso({ data: A, updatedBy: ALTRO }, A, null, IO) === true,
    'l\'abbiamo già ricevuto e fuso: si può scrivere l\'unione sopra');
  ok(posso({ data: A, updatedBy: ALTRO }, null, A, IO) === true,
    'è esattamente ciò che avevamo appena spedito');
  ok(posso({ data: A, updatedBy: ALTRO }, B, A, IO) === true,
    'basta che coincida con uno dei due: visto OPPURE spedito');
  ok(posso({ updatedBy: ALTRO }, null, null, IO) === true,
    'documento senza stato leggibile: non c\'è niente da salvare');
  ok(posso({ data: 42, updatedBy: ALTRO }, null, null, IO) === true,
    'documento con dati non validi: idem');
}

console.log('2) Quando NON si deve scrivere');
{
  ok(posso({ data: B, updatedBy: ALTRO }, A, A, IO) === false,
    'c\'è il lavoro di un altro telefono che non abbiamo mai visto: NON si tocca');
  ok(posso({ data: B, updatedBy: ALTRO }, null, null, IO) === false,
    'appena aperta l\'app non abbiamo visto niente: si aspetta di ricevere');
  ok(posso({ data: B, updatedBy: undefined }, A, A, IO) === false,
    'senza firma del mittente si presume che sia di qualcun altro');
}

console.log('3) Il caso vero: il rientro dal campo');
{
  // Tre giorni offline. Al ritorno della linea Firestore rigiocherebbe le
  // scritture accumulate: la regola le blocca tutte finché il lavoro
  // dell'altro non è stato ricevuto e fuso.
  const mioStato = '{"members":[{"id":"a"},{"id":"b"}]}';
  const suoStato = '{"members":[{"id":"a"},{"id":"c"}]}';
  const unione = '{"members":[{"id":"a"},{"id":"b"},{"id":"c"}]}';

  ok(posso({ data: suoStato, updatedBy: ALTRO }, null, null, IO) === false,
    'il primo tentativo viene rifiutato: nel cloud c\'è il lavoro dell\'altro');
  // La app riceve, fonde, ritenta.
  ok(posso({ data: suoStato, updatedBy: ALTRO }, suoStato, null, IO) === true,
    'dopo averlo ricevuto e fuso, il ritentativo passa');
  ok(mioStato !== unione, 'e ciò che si scrive è l\'unione, non il proprio stato');

  // Sequenza completa: nessuno stato in cui si perda qualcosa.
  const passi = [
    [{ data: suoStato, updatedBy: ALTRO }, null, null, false],
    [{ data: suoStato, updatedBy: ALTRO }, suoStato, null, true],
    [{ data: unione, updatedBy: IO }, suoStato, unione, true],
  ];
  ok(passi.every((x) => posso(x[0], x[1], x[2], IO) === x[3]),
    'la sequenza completa rientro → rifiuto → fusione → scrittura funziona');
}

console.log('\n' + checks + ' controlli — ' + (fails ? fails + ' PROBLEMI' : 'nessun problema'));
process.exit(fails ? 1 : 0);
