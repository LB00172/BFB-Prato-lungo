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
const { archivioStaDentro, punteggioMigliore, sessioneDelCampo, percorso } = global.window.CloudSync;

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

console.log("3) La sessione aperta e' quella del campo, non quella della persona");
{
  // La regola che impedisce al login personale (§ 1) di spegnere la
  // sincronizzazione senza dirlo. auth.js e firebase-sync.js condividono una
  // sola sessione Firebase: appena qualcuno entra col proprio account Google
  // diventa lui il currentUser non anonimo. Il vecchio controllo — "c'e' un
  // utente e non e' anonimo" — lo scambiava per l'utente condiviso, saltava
  // l'accesso al database, e le regole Firestore negavano tutto. L'app si
  // svuotava e non lo diceva nessuno.
  //
  // Le regole guardano request.auth.token.email: qui si guarda la stessa cosa.
  const CAMPO = 'campo@brigatabandone.it';

  ok(sessioneDelCampo({ email: CAMPO, isAnonymous: false }, CAMPO) === true,
    "l'utente condiviso e' la sessione del campo");
  // IL caso: la persona entrata col suo account. Non e' anonima, ma per
  // Firestore e' un estraneo.
  ok(sessioneDelCampo({ email: 'lorenzo@gmail.com', isAnonymous: false }, CAMPO) === false,
    'un account personale NON vale come sessione del campo');
  ok(sessioneDelCampo({ uid: 'anon-1', email: '', isAnonymous: true }, CAMPO) === false,
    'una sessione anonima nemmeno');
  // Questa e' la verifica che tiene in vita il controllo su isAnonymous. Un
  // anonimo di Firebase non ha indirizzo, quindi quella sopra sarebbe verde
  // anche togliendo la guardia — passerebbe per il confronto sull'email, non
  // per il motivo che dice. Qui l'indirizzo c'e': se la guardia sparisce,
  // questa diventa rossa. Un caso che in Firebase non capita, messo apposta
  // per far fallire un sabotaggio che altrimenti nessuno vedrebbe.
  ok(sessioneDelCampo({ uid: 'anon-1', email: CAMPO, isAnonymous: true }, CAMPO) === false,
    'un anonimo resta anonimo anche se porta l\'indirizzo giusto');
  ok(sessioneDelCampo(null, CAMPO) === false, 'e nessuna sessione tantomeno');

  // Firebase restituisce l'indirizzo come e' stato scritto alla creazione, e
  // le regole confrontano stringhe: "Campo@..." e "campo@..." sono lo stesso
  // utente e devono valere uguale, altrimenti la sincronizzazione si fermerebbe
  // su un telefono e non sull'altro.
  ok(sessioneDelCampo({ email: 'Campo@BrigataBandone.it', isAnonymous: false }, CAMPO) === true,
    'le maiuscole nell\'indirizzo non cambiano niente');
  ok(sessioneDelCampo({ email: ' ' + CAMPO + ' ', isAnonymous: false }, CAMPO) === true,
    'e nemmeno uno spazio di troppo');

  // Senza utente condiviso configurato non c'e' niente da riconoscere: si
  // ricade sull'accesso anonimo di prima, che e' la strada gia' prevista.
  ok(sessioneDelCampo({ email: CAMPO, isAnonymous: false }, '') === false,
    'senza dbEmail configurata non si dichiara nessuna sessione buona');
  ok(sessioneDelCampo({ email: '', isAnonymous: false }, CAMPO) === false,
    'un utente senza indirizzo non e\' quello del campo');
}

console.log("4) I dati di un campo stanno dove le regole se li aspettano");
{
  // Le due versioni dell'app mettono i dati in posti diversi, e il percorso
  // deve combaciare con quello che dicono le regole Firestore. Se non
  // combacia non c'e' un errore: c'e' un permesso negato su OGNI scrittura, e
  // l'app sembra rotta senza dire perche'. Era scritto 'camps' in trentasette
  // punti; adesso e' una funzione sola, e questa prova la guarda.
  delete global.window.APP_CONFIG;
  ok(JSON.stringify(percorso('Bandone')) === '["camps","Bandone"]',
    'senza configurazione si resta sul modello di sempre: camps/<codice>');
  ok(JSON.stringify(percorso('Bandone', 'receipts', 'x')) === '["camps","Bandone","receipts","x"]',
    'e le sotto-collezioni gli vanno dietro');

  global.window.APP_CONFIG = { dati: 'rooms' };
  // IL caso della versione pubblica: i dati stanno DENTRO la stanza, sotto
  // `dati/`, che e' esattamente il match scritto in firestore.rules.
  ok(JSON.stringify(percorso('K7RX2MQP')) === '["rooms","K7RX2MQP","dati","stato"]',
    'con le stanze si scrive in rooms/<codice>/dati/stato');
  ok(JSON.stringify(percorso('K7RX2MQP', 'receipts', 'x')) === '["rooms","K7RX2MQP","dati","stato","receipts","x"]',
    'e le sotto-collezioni stanno sotto dati/, dove le regole le permettono');
  // Firestore vuole un numero PARI di pezzi per un documento e dispari per
  // una collezione: rooms/<id>/dati e' dispari, quindi e' una collezione, e
  // sopra ci si appende un documento. Se fosse pari, ogni doc() sballerebbe.
  // Firestore vuole un numero PARI di pezzi per un documento e dispari per
  // una collezione. E' la verifica che ha trovato l'errore: la radice
  // pubblica era rooms/<id>/dati, tre pezzi, quindi una COLLEZIONE — e ogni
  // doc() sopra ci sarebbe esploso. Vale per tutte e due le versioni.
  const pari = (n) => n % 2 === 0;
  delete global.window.APP_CONFIG;
  ok(pari(percorso('X').length) && pari(percorso('X', 'receipts', 'y').length)
     && !pari(percorso('X', 'receipts').length),
    `privata: radice e documenti pari, collezioni dispari (${percorso('X').length})`);
  global.window.APP_CONFIG = { dati: 'rooms' };
  ok(pari(percorso('X').length) && pari(percorso('X', 'receipts', 'y').length)
     && !pari(percorso('X', 'receipts').length),
    `pubblica: radice e documenti pari, collezioni dispari (${percorso('X').length})`);

  // Un valore che non si conosce non inventa una strada nuova: si torna al
  // modello di sempre, che al massimo fa negare i permessi a chi ha le regole
  // nuove — invece di scrivere in una collezione che non esiste per nessuno.
  global.window.APP_CONFIG = { dati: 'qualcosa-di-strano' };
  ok(JSON.stringify(percorso('X')) === '["camps","X"]',
    'un valore mai visto non inventa una collezione nuova');
  delete global.window.APP_CONFIG;
}

// ---------- Quando si stacca e si riattacca ----------
// I due difetti che questa regola mette insieme sono nati separati, e nessuno
// dei due si vedeva da solo.
//
// Il primo: entrare nella PRIMA stanza non riagganciava niente. L'effetto che
// staccava confrontava la stanza di prima con quella di adesso, ma "nessuna
// stanza" era scritta `null` come il valore di partenza del riferimento —
// quindi il passaggio che conta di piu' non lo vedeva nessuno, e l'app
// restava a scrivere nel campo predefinito mentre a schermo diceva di essere
// dentro la stanza appena creata.
//
// Il secondo: entrando con Google DOPO esserti gia' agganciato da anonimo,
// la connessione continua a parlare per l'uid anonimo. Le regole Firestore
// guardano l'uid, e quello non e' membro di niente.
{
  const { vaRiagganciato } = global.window.CloudSync;
  const nessuno = { connesso: false, codice: null, uid: null };

  ok(vaRiagganciato(nessuno, { codice: 'ABCD1234', uid: null }) === true,
    'da fermi ci si aggancia');
  ok(vaRiagganciato(nessuno, { codice: '', uid: 'g' }) === false,
    'ma senza un codice non si aggancia niente');

  // IL caso che era rotto.
  ok(vaRiagganciato({ connesso: true, codice: 'CampOpsProva', uid: 'anon1' },
                    { codice: 'TS9N-TC43', uid: 'anon1' }) === true,
    'entrando nella prima stanza si riaggancia');
  ok(vaRiagganciato({ connesso: true, codice: 'STANZA-A', uid: 'g' },
                    { codice: 'STANZA-B', uid: 'g' }) === true,
    'e cambiando stanza pure');

  // L'altro caso che era rotto: cambia CHI sei, non dove scrivi.
  ok(vaRiagganciato({ connesso: true, codice: 'TS9N-TC43', uid: 'anon1' },
                    { codice: 'TS9N-TC43', uid: 'google1' }) === true,
    'entrando con Google si riaggancia con il tuo uid');

  // E le due che devono restare ferme, o si stacca e riattacca a ogni
  // disegno: un uid che non si conosce non e' un uid diverso.
  ok(vaRiagganciato({ connesso: true, codice: 'TS9N-TC43', uid: 'anon1' },
                    { codice: 'TS9N-TC43', uid: null }) === false,
    'un uid che non si conosce non fa riagganciare');
  ok(vaRiagganciato({ connesso: true, codice: 'TS9N-TC43', uid: null },
                    { codice: 'TS9N-TC43', uid: 'google1' }) === false,
    'e nemmeno un collegamento di cui non si sa l\'uid');
  ok(vaRiagganciato({ connesso: true, codice: 'TS9N-TC43', uid: 'g' },
                    { codice: 'TS9N-TC43', uid: 'g' }) === false,
    'stessa stanza e stesso uid: si resta dove si e\'');

  // Questa l'ha trovata un sabotaggio che NON produceva rosso: nessuna
  // verifica copriva l'essere connessi senza sapere a cosa (capita mentre la
  // connessione sta salendo). Nel dubbio si riaggancia — restare appesi a un
  // posto che non si sa nominare e' peggio di un giro di rete in piu'.
  ok(vaRiagganciato({ connesso: true, codice: null, uid: 'g' },
                    { codice: 'TS9N-TC43', uid: 'g' }) === true,
    'connessi senza sapere a cosa: si riaggancia');
}

console.log(`\n${checks} verifiche — ${fails ? fails + ' FALLITE' : 'nessun problema'}`);
process.exit(fails ? 1 : 0);
