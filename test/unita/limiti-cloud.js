// Due regole di firebase-sync.js che decidono se una scrittura si fa o no.
// Stanno qui, separate dal codice che parla con Firestore, per lo stesso
// motivo di sovrascrivibile(): la parte che decide si puo' provare, la parte
// che scrive no. Se la decisione e' giusta, il resto e' idraulica.
const finto = {};
global.localStorage = {
  getItem: (k) => (k in finto ? finto[k] : null),
  setItem: (k, v) => { finto[k] = String(v); },
  removeItem: (k) => { delete finto[k]; },
};
global.window = global;
require('../../firebase-sync.js');
const { archivioStaDentro, punteggioMigliore } = global.window.CloudSync;

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  KO ' + msg); } };

console.log("1) L'archivio sta sotto il tetto di Firestore");
{
  // Il tetto e' 900 KB, lo stesso di pushState. Sopra, Firestore rifiuta la
  // scrittura e l'archivio non esiste — ma la chiusura del campo azzera i dati
  // locali comunque, quindi il "no" va saputo PRIMA.
  const piccolo = { nome: 'campo 2026' };
  ok(archivioStaDentro(piccolo, { a: 1 }) === true, 'un archivio piccolo passa');

  const mezzo = 'x'.repeat(400 * 1024);
  ok(archivioStaDentro(mezzo, mezzo) === true, 'due pezzi da 400 KB stanno dentro');

  const grosso = 'x'.repeat(500 * 1024);
  ok(archivioStaDentro(grosso, grosso) === false, 'due pezzi da 500 KB no');

  // Il punto che rendeva il controllo facile da sbagliare: conta la SOMMA di
  // meta e data, non uno dei due. Ognuno da solo sta sotto, insieme no.
  const quasi = 'x'.repeat(600 * 1024);
  ok(archivioStaDentro(quasi, null) === true, '600 KB da soli stanno dentro');
  ok(archivioStaDentro(quasi, quasi) === false, 'ma 600 + 600 KB no: conta la somma');

  ok(archivioStaDentro(null, null) === true, 'un archivio vuoto non e\' un errore');
  // Accetta sia oggetti sia stringhe gia' serializzate: putArchive passa le
  // seconde, per non serializzare due volte gli stessi megabyte.
  ok(archivioStaDentro('{"a":1}', '{"b":2}') === true, 'accetta anche stringhe gia\' pronte');
}

console.log('2) In classifica si scrive solo se si batte il record');
{
  ok(punteggioMigliore(null, 10) === true, 'primo punteggio di questo giocatore: si scrive');
  ok(punteggioMigliore(undefined, 1) === true, 'niente in cloud vale come nessun record');
  ok(punteggioMigliore(10, 25) === true, '25 batte 10: si scrive');
  ok(punteggioMigliore(25, 10) === false, '10 non batte 25: non si tocca');
  // A parita' non si riscrive: cambierebbe solo la data, e in una classifica
  // ordinata a parita' di punteggio farebbe passare avanti chi ha rigiocato.
  ok(punteggioMigliore(25, 25) === false, 'a parita\' non si riscrive');
  ok(punteggioMigliore(0, 0) === false, 'nemmeno a zero pari');
  ok(punteggioMigliore(0, 1) === true, 'ma 1 batte 0');

  // Robustezza: un punteggio non numerico non deve mai vincere.
  // Attenzione al caso che conta: con un record gia' in cloud ci pensa il
  // confronto (NaN > 10 e' falso comunque). Il controllo sul numero serve
  // quando in cloud NON c'e' ancora niente: li' senza controllo si scriverebbe
  // "abc" in classifica, e da quel momento nessun punteggio vero lo batte.
  ok(punteggioMigliore(null, 'abc') === false, 'primo punteggio non numerico: non si scrive');
  ok(punteggioMigliore(null, NaN) === false, 'nemmeno NaN come primo punteggio');
  ok(punteggioMigliore(undefined, 'tanto') === false, 'nemmeno una parola');
  ok(punteggioMigliore(10, 'abc') === false, 'con un record in cloud, non passa lo stesso');
  ok(punteggioMigliore(10, null) === false, 'ne\' un punteggio assente');
  ok(punteggioMigliore(10, NaN) === false, 'ne\' NaN');
  // Al contrario, un valore sporco GIA' in cloud non deve bloccare per sempre.
  ok(punteggioMigliore('rotto', 5) === true, 'un valore sporco in cloud si puo\' sostituire');
}

console.log(`\n${checks} verifiche — ${fails ? fails + ' FALLITE' : 'nessun problema'}`);
process.exit(fails ? 1 : 0);
