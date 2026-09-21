// Il codice della stanza, e chi puo' fare cosa dentro.
//
// Il codice d'ingresso e' una serratura, non un'etichetta: la decisione del
// § 2 e' che a verificarlo siano le REGOLE Firestore invece di una Cloud
// Function, quindi non c'e' nessun server che conti i tentativi. Quello che
// tiene in piedi la scelta e' l'entropia del codice — e l'entropia sta tutta
// in due cose che si provano qui: l'alfabeto e il generatore.
//
// L'altra regola che conta e' la normalizzazione. Chi digita un codice lo
// scrive minuscolo, senza trattino, con uno spazio in mezzo e con la U al
// posto della V. Sono tutti LO STESSO codice. Se normalizzare e generare non
// vanno d'accordo, l'impronta calcolata sul telefono non combacia con quella
// custodita in Firestore e nessuno entra piu' — senza che una riga di codice
// sembri sbagliata.
const path = require('path');
const { ok, fine } = require('../lib/app');
require(path.resolve(__dirname, '..', '..', 'stanza.js'));
const S = (typeof globalThis !== 'undefined' && globalThis.Stanza) || null;

ok('stanza.js si carica ed espone le regole',
  !!(S && typeof S.generaCodice === 'function' && typeof S.normalizza === 'function'
     && typeof S.codiceValido === 'function' && typeof S.validaModulo === 'function'));
if (!S) { fine(); }

// ---------- L'alfabeto ----------
{
  // Le lettere che si confondono su un foglio appeso in cucina. Ognuna di
  // queste, se entrasse, produrrebbe codici che la gente ricopia sbagliati —
  // e un codice ricopiato sbagliato non e' un errore dell'utente, e' una
  // scelta sbagliata di chi ha fatto l'alfabeto.
  const vietate = ['0', '1', 'I', 'L', 'O', 'U'];
  const dentro = vietate.filter((c) => S.ALFABETO.indexOf(c) >= 0);
  ok(`le lettere che si confondono restano fuori (${S.ALFABETO})`
    + (dentro.length ? ' — DENTRO: ' + dentro.join(', ') : ''), dentro.length === 0);

  // Niente vocali: senza, dal generatore non escono parole per caso. Un
  // codice che si legge come una parolaccia va rifatto, e chi lo rifa' e'
  // quello che ha appena finito di appenderlo in cucina.
  const vocali = ['A', 'E', 'I', 'O', 'U'].filter((v) => S.ALFABETO.indexOf(v) >= 0);
  ok('e nemmeno le vocali' + (vocali.length ? ' — DENTRO: ' + vocali.join(', ') : ''),
    vocali.length === 0);

  ok('nessun carattere ripetuto nell\'alfabeto',
    new Set(S.ALFABETO.split('')).size === S.ALFABETO.length);

  // Il numero che regge la decisione di non avere un backend. Sotto il
  // miliardo la forza bruta diventa una cosa che si puo' fare davvero, e
  // allora la Cloud Function tornerebbe obbligatoria.
  ok(`le combinazioni sono abbastanza (${S.COMBINAZIONI.toExponential(2)})`,
    S.COMBINAZIONI > 1e11);
}

// ---------- Il generatore ----------
{
  // Con un generatore finto si guarda COSA esce, non solo che la forma torni.
  let i = 0;
  const finto = () => [0, 1, 2, 3, 4, 5, 6, 27][i++] / S.ALFABETO.length;
  const c = S.generaCodice(finto);
  ok(`il codice esce a gruppi col trattino (${c})`, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c));
  ok('e prende i caratteri dall\'alfabeto, in ordine',
    c.replace('-', '') === S.ALFABETO.slice(0, 7) + S.ALFABETO[27]);

  // Il caso vero: cento codici, tutti validi e tutti diversi. Non prova la
  // casualita' — quella non si prova cosi' — ma prende il guasto che capita
  // davvero, cioe' un generatore che restituisce sempre la stessa cosa.
  const cento = [];
  for (let n = 0; n < 100; n++) cento.push(S.generaCodice());
  const nulli = cento.filter((x) => !x).length;
  ok(`cento codici veri si generano tutti (${100 - nulli}/100)`, nulli === 0);
  ok('sono tutti validi', cento.every((x) => S.codiceValido(x)));
  ok(`e tutti diversi (${new Set(cento).size}/100)`, new Set(cento).size === 100);

  // Senza crypto non si ripiega su Math.random(): un codice prevedibile
  // sembrerebbe casuale, e sarebbe peggio di un errore perche' nessuno se ne
  // accorgerebbe. Si restituisce null e chi chiama lo dice.
  ok('un generatore che non sa dare un numero non produce un codice',
    S.generaCodice(() => null) === null
    && S.generaCodice(() => NaN) === null
    && S.generaCodice(() => 1) === null
    && S.generaCodice(() => -0.5) === null);
}

// ---------- Come si legge un codice digitato ----------
{
  const vero = 'K7RX-2MQP';
  const stessi = ['k7rx-2mqp', 'K7RX2MQP', ' K7RX - 2MQP ', 'k7rx 2mqp', 'K7RX–2MQP'];
  const diversi = stessi.filter((x) => S.normalizza(x) !== S.normalizza(vero));
  ok(`lo stesso codice scritto in cinque modi da' la stessa impronta (${stessi.length - diversi.length}/5)`
    + (diversi.length ? ' — FUORI: ' + diversi.join(', ') : ''), diversi.length === 0);

  // La V scritta a mano si legge U, e la V nell'alfabeto c'e': questa
  // sostituzione salva chi ricopia da un foglio.
  ok('la U digitata vale la V', S.normalizza('VVVV-VVVV') === S.normalizza('uuuu-uuuu'));

  // E questa e' la contro-prova. A proteggere la Q non e' la tabella delle
  // confusioni — l'ho scoperto sabotandola: aggiungere Q -> 0 non rompe
  // niente, perche' la tabella viene consultata solo per i caratteri che
  // nell'alfabeto NON ci sono. A proteggerla e' quella precedenza. Girarla
  // (`CONFUSE[c] || c` per primo) corrompe i codici con la Q dentro, e il
  // guasto si vedrebbe solo il giorno in cui a qualcuno ne esce uno.
  ok('la Q resta Q: e\' una lettera dell\'alfabeto, non una confusione',
    S.normalizza('QQQQ-QQQQ') === 'QQQQQQQQ');

  // Le confusioni che NON portano a un carattere valido non si indovinano.
  // Chi ha scritto una O ha ricopiato male: dirglielo e' meglio che entrare
  // in una stanza a caso, o non entrare in nessuna senza sapere perche'.
  ok('un codice con le lettere vietate non e\' valido',
    !S.codiceValido('OOOO-OOOO') && !S.codiceValido('1111-1111') && !S.codiceValido('AAAA-EEEE'));

  ok('e nemmeno uno lungo o corto',
    !S.codiceValido('K7RX-2MQ') && !S.codiceValido('K7RX-2MQPP') && !S.codiceValido(''));
  ok('niente non e\' un codice', !S.codiceValido(null) && !S.codiceValido(undefined));

  ok(`si rimette in forma per mostrarlo (${S.bello('k7rx2mqp')})`,
    S.bello('k7rx2mqp') === 'K7RX-2MQP');
}

// ---------- Il modulo di creazione ----------
{
  const buono = { nome: 'Prato Lungo 2027', inizio: '2027-08-11', fine: '2027-08-16' };
  ok(`un modulo completo non ha problemi (${S.validaModulo(buono).length})`,
    S.validaModulo(buono).length === 0);

  ok('senza nome lo dice', S.validaModulo(Object.assign({}, buono, { nome: '' })).includes('stanza.serveNome'));
  ok('un nome di soli spazi non conta',
    S.validaModulo(Object.assign({}, buono, { nome: '   ' })).includes('stanza.serveNome'));
  ok('un nome lunghissimo lo dice',
    S.validaModulo(Object.assign({}, buono, { nome: 'x'.repeat(61) })).includes('stanza.nomeLungo'));

  ok('senza date lo dice',
    S.validaModulo(Object.assign({}, buono, { inizio: '' })).includes('stanza.serveInizio')
    && S.validaModulo(Object.assign({}, buono, { fine: '' })).includes('stanza.serveFine'));

  // Le date arrivano come 'AAAA-MM-GG': in quella forma il confronto fra
  // stringhe e' il confronto fra date, e non c'e' nessun new Date() che possa
  // far diventare il 1970 una data vera (CLAUDE.md).
  ok('una data di un\'altra forma non passa',
    S.validaModulo(Object.assign({}, buono, { inizio: '11/08/2027' })).includes('stanza.inizioNonValido'));

  // IL caso: un campo che finisce prima di cominciare produrrebbe un
  // calendario vuoto, e nessuno collegherebbe le due cose.
  ok('un campo che finisce prima di cominciare lo dice',
    S.validaModulo({ nome: 'x', inizio: '2027-08-16', fine: '2027-08-11' }).includes('stanza.finePrimaDiInizio'));
  ok('ma un campo di un giorno solo va bene',
    S.validaModulo({ nome: 'x', inizio: '2027-08-11', fine: '2027-08-11' }).length === 0);
  // Il confronto deve reggere il cambio di mese e di anno: '2027-09-01' e'
  // dopo '2027-08-31' anche se 01 < 31, e in forma AAAA-MM-GG lo e' davvero.
  ok('e il confronto regge il cambio di mese',
    S.validaModulo({ nome: 'x', inizio: '2027-08-31', fine: '2027-09-01' }).length === 0
    && S.validaModulo({ nome: 'x', inizio: '2027-09-01', fine: '2027-08-31' }).includes('stanza.finePrimaDiInizio'));

  // Il luogo e' facoltativo. Ma se c'e' e non e' un punto sulla Terra, il
  // meteo non dice "non lo so": non arriva e basta.
  ok('senza luogo va bene lo stesso', S.validaModulo(buono).length === 0);
  ok('un luogo vero passa',
    S.validaModulo(Object.assign({}, buono, { luogo: { lat: 42.05, lon: 13.1 } })).length === 0);
  ok('una coordinata con la virgola non passa',
    S.validaModulo(Object.assign({}, buono, { luogo: { lat: '42,05', lon: '13,1' } })).includes('stanza.luogoNonValido'));
  ok('e nemmeno una fuori dal mondo',
    S.validaModulo(Object.assign({}, buono, { luogo: { lat: 91, lon: 0 } })).includes('stanza.luogoNonValido')
    && S.validaModulo(Object.assign({}, buono, { luogo: { lat: 0, lon: 181 } })).includes('stanza.luogoNonValido'));
  // Lo zero e' una coordinata vera (golfo di Guinea): scartarlo perche' e'
  // falso in JavaScript sarebbe il classico errore che nessuno prova.
  ok('la coordinata zero e\' un posto vero',
    S.validaModulo(Object.assign({}, buono, { luogo: { lat: 0, lon: 0 } })).length === 0);

  ok('il modulo regge anche senza niente',
    S.validaModulo().length === 3 && S.validaModulo({}).length === 3);
}

// ---------- I ruoli ----------
{
  ok('il proprietario puo\' tutto',
    S.puo('amministrare', 'proprietario') && S.puo('modificare', 'proprietario') && S.puo('guardare', 'proprietario'));
  ok('il redattore modifica ma non amministra',
    S.puo('modificare', 'redattore') && !S.puo('amministrare', 'redattore'));
  // Il lettore serve a far vedere i conti a chi ha pagato senza lasciargli
  // riscrivere le presenze di tutti.
  ok('il lettore guarda e basta',
    S.puo('guardare', 'lettore') && !S.puo('modificare', 'lettore') && !S.puo('amministrare', 'lettore'));
  ok('chi non ha ruolo non puo\' niente',
    !S.puo('guardare', null) && !S.puo('modificare', '') && !S.puo('amministrare', 'ospite'));
  // Stessa regola di auth.js, e per lo stesso motivo: un refuso nel nome
  // dell'azione non deve concedere tutto a tutti.
  ok('un\'azione che non esiste non si concede',
    !S.puo('amministare', 'proprietario') && !S.puo('', 'proprietario') && !S.puo(undefined, 'proprietario'));

  // ---------- Cosa si scrive entrando ----------
  // Questa decisione sta nelle regole e non nel trasporto perche' la prova a
  // schermo il trasporto lo SOSTITUISCE con un finto: lasciata li', sarebbe
  // una regola che nessuna prova guarda davvero.
  const ingresso = S.schedaIngresso('Anna', 'impronta123', 1000);
  ok(`chi entra e' redattore, e non se lo sceglie (${ingresso.ruolo})`, ingresso.ruolo === 'redattore');
  ok('e porta la prova d\'ingresso', ingresso.prova === 'impronta123');
  const padrone = S.schedaProprietario('Anna', 1000);
  ok(`chi crea la stanza ne e' il proprietario (${padrone.ruolo})`, padrone.ruolo === 'proprietario');
  // Il proprietario il segreto l'ha appena scritto lui: non deve portarne
  // copia nella propria scheda, che i membri leggono.
  ok('e non si porta dietro nessuna prova', !('prova' in padrone));
  ok('nessuna delle due porta in giro altro',
    Object.keys(ingresso).sort().join() === 'entratoIl,nome,prova,ruolo'
    && Object.keys(padrone).sort().join() === 'entratoIl,nome,ruolo');

  // Una stanza senza proprietario non la amministra piu' nessuno e non si
  // puo' nemmeno cancellare: e' il vicolo cieco da cui non si esce.
  ok('il proprietario non si toglie se e\' l\'unico', !S.rimuovibile('proprietario', 'proprietario', 1));
  ok('ma con due proprietari si puo\'', S.rimuovibile('proprietario', 'proprietario', 2));
  ok('un redattore lo toglie il proprietario', S.rimuovibile('proprietario', 'redattore', 1));
  ok('e un redattore non toglie nessuno',
    !S.rimuovibile('redattore', 'lettore', 1) && !S.rimuovibile('lettore', 'lettore', 1));
}

// ---------- Il trasporto: solo quello che si puo' provare senza Firebase ----
// StanzaCloud parla con Firestore e quasi tutto vuole una rete. Due cose pero'
// decidono da sole, e sono quelle che rompono in silenzio.
{
  const C = globalThis.StanzaCloud;
  ok('stanza.js espone anche il trasporto',
    !!(C && typeof C.impronta === 'function' && typeof C.motivo === 'function'));

  // 1. L'IMPRONTA. Il sale e' il codice normalizzato: se normalizzazione e
  // sale non vanno d'accordo, due telefoni con lo STESSO codice calcolano
  // impronte diverse, Firestore dice di no a tutti e due, e non c'e' una riga
  // che sembri sbagliata. Qui improntaPassword viene finta, cosi' si guarda
  // COSA le viene passato invece del risultato.
  const visti = [];
  globalThis.improntaPassword = async (pwd, cfg) => { visti.push({ pwd, salt: cfg.salt, iter: cfg.iter }); return 'finta'; };

  (async () => {
    await C.impronta('K7RX-2MQP');
    await C.impronta(' k7rx 2mqp ');
    await C.impronta('UUUU-VVVV');
    await C.impronta('VVVV-VVVV');

    ok(`lo stesso codice scritto in due modi da' la stessa password e lo stesso sale`
      + ` (${visti[0].pwd}/${visti[1].pwd})`,
      visti[0].pwd === visti[1].pwd && visti[0].salt === visti[1].salt);
    ok('e la U vale la V anche qui, non solo a schermo',
      visti[2].pwd === visti[3].pwd && visti[2].salt === visti[3].salt);
    // Il sale non e' fisso: una tabella precalcolata per una stanza non deve
    // valere per tutte le altre.
    ok(`il sale cambia con il codice (${visti[0].salt.slice(0, 8)}… / ${visti[2].salt.slice(0, 8)}…)`,
      visti[0].salt !== visti[2].salt);
    ok('e il codice non finisce nel sale in chiaro',
      visti[0].salt.indexOf('K7RX') < 0 && /^[0-9a-f]+$/.test(visti[0].salt));
    ok(`i giri di PBKDF2 sono quelli del blocco (${visti[0].iter})`, visti[0].iter === 200000);

    // Senza improntaPassword non si inventa niente: un ripiego piu' debole
    // sarebbe invisibile, e produrrebbe stanze che sembrano chiuse.
    delete globalThis.improntaPassword;
    const senza = await C.impronta('K7RX-2MQP');
    ok('senza improntaPassword non si inventa un\'impronta piu\' debole', senza === null);
    const vuota = await C.impronta('');
    ok('e un codice vuoto non ha impronta', vuota === null);

    // 2. I MOTIVI. Un permission-denied qui vuol dire quasi sempre una cosa
    // sola — il codice e' sbagliato — e dirlo cosi' evita di far cercare un
    // guasto dove non c'e'.
    ok(`un permission-denied diventa "codice sbagliato" (${C.motivo({ code: 'permission-denied' })})`,
      C.motivo({ code: 'permission-denied' }) === 'stanza.codiceSbagliato');
    ok('la mancanza di linea si riconosce',
      C.motivo({ code: 'unavailable' }) === 'stanza.senzaLinea');
    ok('Firebase non configurato pure',
      C.motivo(new Error('firebase-non-configurato')) === 'stanza.senzaFirebase');
    ok('e un guasto mai visto ha comunque un messaggio',
      C.motivo({ code: 'qualcosa-di-nuovo' }) === 'stanza.nonRiuscito'
      && C.motivo(null) === 'stanza.nonRiuscito');

    fine();
  })();
}
