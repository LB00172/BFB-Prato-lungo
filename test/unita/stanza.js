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
const RADICE = path.resolve(__dirname, '..', '..');
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

// ---------- L'invito ----------
// Il link e' il passo che decide se un gruppo adotta l'app o si ferma: far
// digitare otto caratteri a venti persone su WhatsApp non funziona. E un
// link che arriva e non apre niente e' peggio di nessun link, perche' chi lo
// riceve pensa che l'app sia rotta e non che il messaggio sia stato storpiato.
{
  const BASE = 'https://cambusa.example/app';

  const link = S.linkInvito(BASE, 'k7rx2mqp');
  ok(`l'invito e' un link solo (${link})`, link === BASE + '#stanza=K7RX-2MQP');
  // Nel FRAMMENTO, non nella query: il frammento non viene spedito al server,
  // quindi il codice non finisce nei log ne' nell'intestazione Referer. Il
  // codice E' la password della stanza: ogni posto in meno dove si deposita
  // e' un posto in meno da cui puo' uscire.
  ok('il codice sta dopo il cancelletto, non dopo il punto interrogativo',
    link.indexOf('#stanza=') > 0 && link.indexOf('?') < 0);
  // Un invito costruito sopra un altro invito porterebbe due codici, e
  // vincerebbe quello sbagliato.
  ok('un invito costruito sopra un altro non porta due codici',
    S.linkInvito(BASE + '?x=1#stanza=2345-6789', 'K7RX-2MQP') === BASE + '#stanza=K7RX-2MQP');
  ok('un codice non valido non produce nessun link',
    S.linkInvito(BASE, 'OOOO-OOOO') === '' && S.linkInvito(BASE, '') === '');
  ok('e nemmeno un indirizzo vuoto', S.linkInvito('', 'K7RX-2MQP') === '');

  // Il giro completo: quello che si costruisce si deve poter rileggere.
  ok('il link si rilegge', S.leggiInvito(link) === S.normalizza('K7RX-2MQP'));

  // Le forme in cui un link torna indietro dopo essere passato da WhatsApp,
  // da un accorciatore, o da qualcuno che l'ha ricopiato a mano. Sono tutte
  // lo STESSO invito.
  const storpiati = [
    BASE + '#stanza=k7rx-2mqp',
    BASE + '#stanza=K7RX2MQP',
    BASE + '#stanza=k7rx%202mqp',
    BASE + '#stanza=k7rx+2mqp',
    BASE + '?stanza=K7RX-2MQP',
    BASE + '#altro=1&stanza=K7RX-2MQP',
    BASE + '#stanza=K7RX-2MQP&altro=1',
  ];
  const persi = storpiati.filter((u) => S.leggiInvito(u) !== 'K7RX2MQP');
  ok(`un link storpiato per strada apre lo stesso (${storpiati.length - persi.length}/${storpiati.length})`
    + (persi.length ? ' — PERSI: ' + persi.join(', ') : ''), persi.length === 0);

  // E quello che NON deve aprire niente. Un link che apre una stanza a caso
  // sarebbe peggio di uno che non apre niente.
  ok('un link senza codice non apre niente',
    S.leggiInvito(BASE) === null && S.leggiInvito(BASE + '#altro=1') === null);
  ok('un codice storto nel link non apre niente',
    S.leggiInvito(BASE + '#stanza=OOOO-OOOO') === null
    && S.leggiInvito(BASE + '#stanza=K7RX') === null
    && S.leggiInvito(BASE + '#stanza=') === null);
  ok('niente non e\' un invito', S.leggiInvito(null) === null && S.leggiInvito('') === null);
  // Un parametro che CONTIENE la parola non e' quel parametro: "miastanza="
  // non deve essere letto come "stanza=".
  ok('un parametro che somiglia non viene scambiato',
    S.leggiInvito(BASE + '#miastanza=K7RX-2MQP') === null);
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

    // 3. ENTRARE SENZA UTENTE. Era un TypeError su utente.uid, che a schermo
    // diventava "non e' riuscito": un guasto finto al posto del motivo vero.
    let errore = null;
    try { await C.entra('K7RX-2MQP', null); } catch (e) { errore = e; }
    // Si controlla DOVE ci si ferma, non solo che ci si fermi: qui in Node
    // entra() senza il controllo cadrebbe comunque, prima, sul caricamento
    // dell'SDK da gstatic — e una verifica "non esplode" passerebbe per il
    // motivo sbagliato. Un sabotaggio l'ha mostrato.
    ok(`entrare senza un utente si ferma subito, prima della rete (${errore && errore.message})`,
      !!errore && errore.message === 'senza-utente');
    ok(`e dice il motivo vero (${C.motivo(errore)})`, C.motivo(errore) === 'stanza.senzaLinea');

    // 4. RIENTRARE. Chi e' gia' membro e rimette il codice veniva respinto:
    // riscriversi la scheda e' una modifica, e le modifiche le fa solo il
    // proprietario (test/regole § 5-quater). Si rilegge prima, e il risultato
    // si legge cosi'.
    ok('scheda riletta ed esistente: sei gia\' dentro, non si scrive',
      S.esitoRilettura({ esiste: true }, null) === 'gia-dentro');
    ok('lettura negata: non sei membro, ti scrivi',
      S.esitoRilettura(null, { code: 'permission-denied' }) === 'scriviti');
    ok('riletta ma vuota: ti scrivi',
      S.esitoRilettura({ esiste: false }, null) === 'scriviti');
    // La meta' che protegge di piu': da offline NON si scrive. Il setDoc
    // andrebbe in coda e le regole lo respingerebbero al ritorno della rete,
    // in silenzio.
    ok('senza linea non ci si scrive alla cieca',
      S.esitoRilettura(null, { code: 'unavailable' }) === 'rilancia');
    ok('e nemmeno davanti a un guasto mai visto',
      S.esitoRilettura(null, new Error('boh')) === 'rilancia');

    // 5. CANCELLARE L'ACCOUNT. Il proprietario di un campo non puo' sparire:
    // il campo resterebbe senza nessuno che lo amministra o lo cancella. La
    // meta' che conta e' la prima: se si e' proprietari anche di UN solo
    // campo, non si deve togliere NIENTE — nemmeno le altre schede.
    {
      const p1 = S.pianoCancellazione([
        { codice: 'AAAA-2222', membro: true, proprietario: true },
        { codice: 'BBBB-3333', membro: true, proprietario: false },
      ]);
      ok(`chi e' proprietario di un campo e' fermato (${p1.bloccata.join(', ')})`,
        p1.bloccata.length === 1 && p1.bloccata[0] === S.normalizza('AAAA-2222'));
      const p2 = S.pianoCancellazione([
        { codice: 'BBBB-3333', membro: true, proprietario: false },
        { codice: 'CCCC-4444', membro: false, proprietario: false },
      ]);
      ok('da semplice membro si toglie la propria scheda',
        p2.bloccata.length === 0 && p2.daTogliere.length === 1 && p2.daTogliere[0] === S.normalizza('BBBB-3333'));
      ok('e dove non si e\' piu\' membri non c\'e\' niente da togliere',
        p2.daTogliere.indexOf(S.normalizza('CCCC-4444')) < 0);
      // Lo stesso campo arriva dal profilo e dal telefono, scritto magari in
      // due modi: si conta una volta sola.
      const p3 = S.pianoCancellazione([
        { codice: 'bbbb3333', membro: true, proprietario: false },
        { codice: 'BBBB-3333', membro: true, proprietario: false },
      ]);
      ok('lo stesso campo visto due volte si toglie una volta sola', p3.daTogliere.length === 1);
      ok('senza stanze non esplode',
        JSON.stringify(S.pianoCancellazione(null)) === JSON.stringify({ bloccata: [], daCedere: [], daTogliere: [] }));
      // Dal 4 ottobre: col secondo capogruppo il campo passa a lui, e la
      // cancellazione va avanti; senza, si ferma tutto come prima.
      const p4 = S.pianoCancellazione([
        { codice: 'AAAA-2222', membro: true, proprietario: true, vice: 'u-2' },
        { codice: 'BBBB-3333', membro: true, proprietario: false },
      ]);
      ok('col secondo capogruppo il campo si cede, invece di fermarsi',
        p4.bloccata.length === 0 && p4.daCedere.join() === S.normalizza('AAAA-2222') && p4.daTogliere.length === 1);
      const p5 = S.pianoCancellazione([
        { codice: 'AAAA-2222', membro: true, proprietario: true, vice: 'u-2' },
        { codice: 'DDDD-5555', membro: true, proprietario: true, vice: '' },
      ]);
      ok('senza secondo capogruppo, quel campo ferma tutto', p5.bloccata.join() === S.normalizza('DDDD-5555') && p5.daCedere.length === 1);
    }

    // ---------- Il menu quando non sei in nessun campo ----------
    // Un menu pieno di sezioni vuote sembra un'app rotta, non un'app che
    // aspetta una cosa sola. La meta' che conta di piu' e' la prima: DENTRO
    // un campo non deve togliere niente, o il giorno che si entra in una
    // stanza mezza app sparisce e nessuno capisce perche'.
    {
      const GRUPPI = [
        { title: 'Pianificazione', items: ['calendario', 'menu', 'presenze'] },
        { title: 'Spese', items: ['lista', 'attrezzatura', 'spesa'] },
        { title: 'Altro', items: ['gioco', 'archivio', 'guida', 'impostazioni'] },
      ];
      const chiavi = (g) => g.reduce((a, x) => a.concat(x.items), []);

      const dentro = S.gruppiMenu(GRUPPI, true);
      ok(`dentro un campo il menu resta intero (${chiavi(dentro).length} voci)`,
        JSON.stringify(dentro) === JSON.stringify(GRUPPI));

      const fuori = S.gruppiMenu(GRUPPI, false);
      ok(`fuori da un campo restano solo le aree che parlano di te (${chiavi(fuori).join(', ')})`,
        JSON.stringify(chiavi(fuori)) === JSON.stringify(['impostazioni']));
      // Un titolo di sezione senza niente sotto e' peggio di una sezione che
      // non c'e': sembra che manchi qualcosa invece che sia voluto.
      ok(`e i gruppi rimasti vuoti non si disegnano (${fuori.length} invece di ${GRUPPI.length})`,
        fuori.length === 1);

      ok('senza gruppi non esplode',
        JSON.stringify(S.gruppiMenu(null, false)) === '[]'
        && JSON.stringify(S.gruppiMenu(undefined, true)) === '[]');
    }

    // ---------- I miei campi: ricordare, aggiornare, ordinare ----------
    // L'elenco della home. Si apre offline con quello che si sapeva ieri, e
    // si corregge quando il cloud risponde: le tre regole stanno qui perche'
    // sbagliarne una non da' errore — da' un campo doppio, un campo sparito,
    // o un nome cancellato da una risposta vuota.
    {
      let l = S.ricordaCampo([], { codice: 'k7rx 2mqp', ruolo: 'redattore' });
      l = S.ricordaCampo(l, { codice: 'K7RX-2MQP', nome: 'Campo di Anna' });
      ok(`lo stesso campo scritto in due modi è una voce sola (${l.length})`, l.length === 1);
      ok('e tiene sia il ruolo di prima sia il nome saputo dopo',
        l[0].codice === 'K7RX2MQP' && l[0].ruolo === 'redattore' && l[0].nome === 'Campo di Anna');
      l = S.ricordaCampo(l, { codice: 'K7RX2MQP', nome: '' });
      ok('un nome vuoto non cancella quello che si sapeva', l[0].nome === 'Campo di Anna');
      ok('un codice che non è un codice non entra', S.ricordaCampo(l, { codice: '' }).length === 1);
      // Un elenco scritto da una versione vecchia, o arrivato dal profilo,
      // puo' avere il codice come l'ha digitato la persona: lo si riconosce
      // lo stesso.
      ok('un codice già in elenco scritto a mano si riconosce lo stesso',
        S.ricordaCampo([{ codice: 'k7rx-2mqp', nome: 'Campo di Anna' }], { codice: 'K7RX2MQP' }).length === 1);

      const locali = [
        { codice: 'K7RX2MQP', nome: 'Campo di Anna', ruolo: 'redattore' },
        { codice: 'BCDFGHJK', nome: 'Campo tolto', ruolo: 'redattore' },
        { codice: 'MNPQRSTV', nome: 'Senza linea', ruolo: 'redattore' },
      ];
      const dopo = S.aggiornaCampi(locali, ['23456789'], [
        { codice: 'K7RX2MQP', membro: true, proprietario: true, nome: 'Campo di Anna', inizio: '2027-08-11', fine: '2027-08-16' },
        { codice: 'BCDFGHJK', membro: false, proprietario: false },
        { codice: '23456789', membro: true, proprietario: false, nome: 'Dal profilo' },
      ]);
      const cod = (x) => x.map((v) => v.codice).sort().join(',');
      ok(`chi non è più membro sparisce, e il profilo porta i campi degli altri telefoni (${cod(dopo)})`,
        cod(dopo) === '23456789,K7RX2MQP,MNPQRSTV');
      ok('una stanza senza risposta resta com\'era: nessuna risposta non è un «no»',
        dopo.find((v) => v.codice === 'MNPQRSTV').nome === 'Senza linea');
      const anna = dopo.find((v) => v.codice === 'K7RX2MQP');
      ok('il proprietario lo dice la stanza, e le date arrivano con lei',
        anna.ruolo === 'proprietario' && anna.inizio === '2027-08-11' && anna.fine === '2027-08-16');

      const oggi = '2027-08-13';
      const ordinati = S.ordinaCampi([
        { codice: 'A', nome: 'Senza date' },
        { codice: 'B', inizio: '2026-08-11', fine: '2026-08-16' },
        { codice: 'C', inizio: '2027-12-01', fine: '2027-12-03' },
        { codice: 'D', inizio: '2027-08-11', fine: '2027-08-16' },
        { codice: 'E', inizio: '2027-09-01', fine: '2027-09-02' },
        { codice: 'F', inizio: '2025-08-11', fine: '2025-08-16' },
      ], oggi).map((v) => v.codice).join('');
      ok(`in testa quello in corso, poi i prossimi, poi i finiti, in fondo i senza date (${ordinati})`,
        ordinati === 'DECBFA');
      ok('senza elenco non esplode', S.ordinaCampi(null, oggi).length === 0
        && S.aggiornaCampi(null, null, null).length === 0);
    }

    // ---------- Il Pro e' del campo, non della persona ----------
    {
      const oggi = '2027-08-13';
      ok('un campo senza Pro non è Pro', S.campoPro({ codice: 'K7RX2MQP' }, oggi) === false);
      ok('un campo Pro lo è', S.campoPro({ pro: { attivo: true } }, oggi) === true);
      ok('fino all\'ultimo giorno compreso', S.campoPro({ pro: { attivo: true, fino: oggi } }, oggi) === true);
      ok('e dopo non più', S.campoPro({ pro: { attivo: true, fino: '2027-08-12' } }, oggi) === false);
      ok('«attivo» deve essere proprio vero, non una stringa qualsiasi',
        S.campoPro({ pro: { attivo: 'si' } }, oggi) === false);
      ok('senza campo non esplode', S.campoPro(null, oggi) === false && S.campoPro(undefined, oggi) === false);
      // IL caso di Lorenzo: un amico Pro in un altro gruppo entra nel tuo.
      // La domanda riceve la stanza; se qualcuno le passasse la persona, o
      // la scheda del membro, non deve rispondere di si'.
      ok('la persona Pro non rende Pro il campo',
        S.campoPro({ codice: 'K7RX2MQP', utente: { pro: { attivo: true } }, membro: { pro: { attivo: true } } }, oggi) === false);

      let l = [{ codice: 'K7RX2MQP', nome: 'Pagato', pro: { attivo: true } }];
      l = S.aggiornaCampi(l, [], [{ codice: 'K7RX2MQP', membro: true, proprietario: false, nome: 'Pagato', pro: null }]);
      ok('se il cloud dice che il Pro non c\'è più, sparisce: non resta quello di ieri',
        !l[0].pro && S.campoPro(l[0], oggi) === false);
      l = S.aggiornaCampi(l, [], [{ codice: 'K7RX2MQP', membro: true, proprietario: false, pro: { attivo: true } }]);
      ok('e se c\'è, arriva', S.campoPro(l[0], oggi) === true);
      ok('una stanza senza risposta tiene il Pro che si sapeva',
        S.campoPro(S.aggiornaCampi(l, [], [])[0], oggi) === true);
    }

    // ---------- Le regole del campo e il passaggio all'aiutante ----------
    {
      const r = S.regoleDaTesto('  Si lava a turno.  \n\n\n Niente musica\n dopo mezzanotte. \n\n  ');
      ok(`una regola per paragrafo, pulita (${JSON.stringify(r)})`,
        JSON.stringify(r) === JSON.stringify(['Si lava a turno.', 'Niente musica dopo mezzanotte.']));
      ok('e si torna al testo senza perdere niente',
        JSON.stringify(S.regoleDaTesto(S.testoDaRegole(r))) === JSON.stringify(r));
      ok('un testo vuoto non fa regole vuote', S.regoleDaTesto('\n\n  \n').length === 0);
      const tante = Array.from({ length: 50 }, (_, k) => 'Regola ' + k).join('\n\n');
      ok('non più di trenta', S.regoleDaTesto(tante).length === 30);

      // Anna era capogruppo con il Pro; ha passato il campo a Bruno.
      let l = [{ codice: 'K7RX2MQP', nome: 'Campo', ruolo: 'proprietario', pro: { attivo: true }, vice: 'bruno', regole: ['Vecchia'] }];
      l = S.aggiornaCampi(l, [], [{ codice: 'K7RX2MQP', membro: true, proprietario: false, regole: [], vice: '', aiutante: false }]);
      ok('dopo il passaggio chi l\'ha ceduto non risulta più capogruppo', l[0].ruolo === 'redattore');
      ok('e il Pro e l\'aiutante di ieri non restano', !l[0].pro && !l[0].vice);
      ok('regole tolte dal capogruppo spariscono anche qui', !l[0].regole);
      l = S.aggiornaCampi(l, [], [{ codice: 'K7RX2MQP', membro: true, proprietario: false, regole: ['Nuova'], aiutante: true }]);
      ok('chi è stato nominato aiutante lo sa, e le regole nuove arrivano',
        l[0].aiutante === true && l[0].regole[0] === 'Nuova');
      l = S.aggiornaCampi(l, [], [{ codice: 'K7RX2MQP', membro: true, proprietario: true }]);
      ok('e quando il campo passa a lui, diventa capogruppo', l[0].ruolo === 'proprietario' && !l[0].aiutante);
    }

    // ---------- Le dotazioni del campo ----------
    {
      const d = S.dotazioniDaTesto('!Sedia personale\n  Borraccia \n\n!\nLuci LED');
      ok(`una voce per riga, il punto esclamativo la mette in evidenza (${JSON.stringify(d)})`,
        JSON.stringify(d) === JSON.stringify([{ testo: 'Sedia personale', evidenza: true }, { testo: 'Borraccia' }, { testo: 'Luci LED' }]));
      ok('e si torna al testo senza perdere niente',
        JSON.stringify(S.dotazioniDaTesto(S.testoDaDotazioni(d))) === JSON.stringify(d));
      let l = [{ codice: 'K7RX2MQP', dotazioni: [{ testo: 'Vecchia' }] }];
      l = S.aggiornaCampi(l, [], [{ codice: 'K7RX2MQP', membro: true, proprietario: false, dotazioni: [] }]);
      ok('dotazioni tolte dal capogruppo spariscono anche dal telefono', !l[0].dotazioni);
      l = S.aggiornaCampi(l, [], [{ codice: 'K7RX2MQP', membro: true, proprietario: false, dotazioni: d }]);
      ok('e quelle nuove arrivano', l[0].dotazioni.length === 3);
    }

    // ---------- Cosa sblocca il Pro ----------
    {
      const oggi = '2027-07-13';
      const gratis = { codice: 'AAAAAAAA', ruolo: 'proprietario', inizio: '2027-07-12', fine: '2027-07-20' };
      const pro = Object.assign({}, gratis, { codice: 'BBBBBBBB', pro: { attivo: true, fino: '2027-10-20' } });
      const scaduto = Object.assign({}, gratis, { codice: 'CCCCCCCC', pro: { attivo: true, fino: '2027-07-01' } });
      S.FUNZIONI_PRO.forEach((f) => {
        ok(`${f}: chiusa nel campo gratuito, aperta nel campo Pro, chiusa quando il Pro scade`,
          S.sbloccata(f, gratis, oggi) === false && S.sbloccata(f, pro, oggi) === true && S.sbloccata(f, scaduto, oggi) === false);
      });
      // La regola che non si negozia: i conti non sono mai del Pro.
      ['presenze', 'spese', 'quote', 'saldi', 'membri', 'lista'].forEach((f) => {
        ok(`${f} non è mai del Pro`, S.FUNZIONI_PRO.indexOf(f) < 0 && S.sbloccata(f, gratis, oggi) === true);
      });
      ok('le sette funzioni decise, e solo quelle',
        JSON.stringify(S.FUNZIONI_PRO.slice().sort()) === JSON.stringify(['archivio', 'compiti', 'dotazioni', 'fotoCloud', 'meteo', 'piuCampi', 'regole']));

      ok('senza campi se ne crea uno', S.puoCreareCampo([], oggi) === true);
      ok('con un campo gratuito in corso il secondo no', S.puoCreareCampo([gratis], oggi) === false);
      ok('un campo gratuito finito non conta',
        S.puoCreareCampo([Object.assign({}, gratis, { fine: '2027-07-12' })], oggi) === true);
      ok('un campo gratuito che deve ancora cominciare conta',
        S.puoCreareCampo([Object.assign({}, gratis, { inizio: '2027-08-01', fine: '2027-08-05' })], oggi) === false);
      ok('un campo senza date conta: non si sa quando finisce',
        S.puoCreareCampo([{ codice: 'DDDDDDDD', ruolo: 'proprietario' }], oggi) === false);
      ok('un campo Pro non conta', S.puoCreareCampo([pro], oggi) === true);
      ok('ma se il suo Pro è scaduto sì', S.puoCreareCampo([scaduto], oggi) === false);
      ok('i campi degli altri non contano: partecipare è illimitato',
        S.puoCreareCampo([Object.assign({}, gratis, { ruolo: 'redattore' }), Object.assign({}, gratis, { ruolo: 'lettore' })], oggi) === true);
    }

    // ---------- Comprare il Pro: l'app e il server parlano della stessa cosa ----------
    {
      const fs = require('fs');
      const server = require(path.join(RADICE, 'functions', 'pro.js'));
      ok(`i prodotti che l'app vende sono quelli che il server verifica (${JSON.stringify(S.PRODOTTI_PRO)})`,
        JSON.stringify(S.PRODOTTI_PRO) === JSON.stringify(server.PRODOTTI));
      // Ogni motivo che il server puo' dare ha una frase: letti dal sorgente,
      // non da un elenco ricopiato qui — un motivo nuovo senza frase diventa
      // rosso da solo.
      const sorgente = fs.readFileSync(path.join(RADICE, 'functions', 'pro.js'), 'utf8');
      const motivi = new Set([...sorgente.matchAll(/(?:errore\(|motivo: )'([a-z-]+)'/g)].map((m) => m[1]));
      const senza = [...motivi].filter((m) => !(m in S.ERRORI_PRO));
      ok(`ogni motivo del server ha la sua frase (${motivi.size} motivi${senza.length ? ' — SENZA: ' + senza.join(', ') : ''})`,
        motivi.size >= 10 && senza.length === 0);
      ok('un motivo mai visto ha comunque una frase', S.erroreDelPro('boh') === 'pro.errore.nonRiuscito');
    }

    // ---------- Il luogo del campo, per il meteo ----------
    {
      const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const pl = { lat: 42.0486, lon: 13.14855 };
      // Le forme vere, copiate da Google Maps e da OpenStreetMap.
      const link = {
        segnaposto: 'https://www.google.com/maps/place/Prato+Lungo/@42.05,13.1,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d42.0486!4d13.14855',
        centro: 'https://www.google.com/maps/@42.0486,13.14855,17z',
        ricerca: 'https://www.google.com/maps/search/?api=1&query=42.0486%2C13.14855',
        q: 'https://maps.google.com/?q=42.0486,13.14855',
        osm: 'https://www.openstreetmap.org/#map=16/42.0486/13.14855',
        mano: '42.0486, 13.14855',
        manoVirgola: '42,0486 13,14855',
      };
      Object.keys(link).forEach((k) => {
        const l = S.luogoDaTesto(link[k]);
        ok(`il luogo si legge da ${k} (${JSON.stringify(l)})`, eq(l, pl));
      });
      // Il segnaposto vince sul centro della mappa: e' il punto scelto,
      // l'altro e' solo dove era la vista.
      ok('dal segnaposto, non dal centro della vista', S.luogoDaTesto(link.segnaposto).lat === 42.0486);
      ok('un link corto si riconosce e si dice perché non va',
        S.luogoDaTesto('https://maps.app.goo.gl/AbCdEf123').errore === 'luogo.linkCorto');
      ok('un testo qualsiasi non diventa un luogo, ma si può cercare come nome',
        S.luogoDaTesto('vicino al lago').errore === 'luogo.nonCapito' && !S.luogoDaTesto('vicino al lago').link);
      ok('un link che non si capisce resta un link: non si cerca come nome',
        S.luogoDaTesto('https://www.google.com/maps/dir/Roma/Pereto').link === true
        && S.luogoDaTesto('https://maps.app.goo.gl/AbCdEf123').link === true);
      ok('il vuoto nemmeno', S.luogoDaTesto('  ').errore === 'luogo.vuoto');
      ok('una latitudine fuori scala non è un luogo strano: non è un luogo',
        S.luogoDaTesto('142.0, 13.1').errore === 'luogo.nonCapito' && S.luogoValido({ lat: 12, lon: 200 }) === null);
      ok('senza coordinate niente luogo', S.luogoValido({ label: 'Prato' }) === null
        && S.luogoValido({ lat: null, lon: null }) === null && S.luogoValido(null) === null);
      ok('cinque decimali, un\'altitudine intera e un nome pulito',
        eq(S.luogoValido({ lat: '42.048612345', lon: 13.148551, alt: '1337.4', label: '  Prato   Lungo ' }),
          { lat: 42.04861, lon: 13.14855, alt: 1337, label: 'Prato Lungo' }));
      ok('un\'altitudine assurda si lascia fuori, il luogo resta',
        eq(S.luogoValido({ lat: 42, lon: 13, alt: 40000 }), { lat: 42, lon: 13 }));
      const r = S.luogoDaRicerca({ name: 'Pereto', latitude: 42.0583, longitude: 13.1024, elevation: 800, admin1: 'Abruzzo', admin2: "L'Aquila", country: 'Italia', country_code: 'IT' });
      ok(`dalla ricerca, con la provincia per distinguere gli omonimi (${JSON.stringify(r)})`,
        eq(r, { lat: 42.0583, lon: 13.1024, alt: 800, label: "Pereto (L'Aquila)" }));
      ok('e fuori Italia anche il paese',
        S.luogoDaRicerca({ name: 'Chamonix', latitude: 45.92, longitude: 6.87, admin1: 'Auvergne-Rhône-Alpes', admin2: 'Haute-Savoie', country: 'Francia', country_code: 'FR' }).label === 'Chamonix (Haute-Savoie, Francia)');

      let l = [{ codice: 'K7RX2MQP', luogo: { lat: 1, lon: 1 } }];
      l = S.aggiornaCampi(l, [], [{ codice: 'K7RX2MQP', membro: true, proprietario: false, luogo: { lat: 42.0486, lon: 13.14855, alt: 1337 } }]);
      ok('il luogo arriva dalla stanza', eq(l[0].luogo, { lat: 42.0486, lon: 13.14855, alt: 1337 }));
      l = S.aggiornaCampi(l, [], [{ codice: 'K7RX2MQP', membro: true, proprietario: false, luogo: null }]);
      ok('e tolto dal capogruppo sparisce anche dal telefono', !l[0].luogo);
      l = S.aggiornaCampi(l, [], [{ codice: 'K7RX2MQP', membro: true, proprietario: false, luogo: { lat: 'x', lon: 13 } }]);
      ok('un luogo storto dal cloud non entra', !l[0].luogo);
    }

    fine();
  })();
}
