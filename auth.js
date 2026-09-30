// Chi sei, e cosa ti lascia fare l'app.
//
// Sta fuori da src/ per la ragione di sempre (conti.js, presenze.js,
// allarmi.js, lingue.js): qui dentro ci sono delle REGOLE, e le regole si
// provano con una prova unitaria invece che aprendo un browser e un progetto
// Firebase vero. Il pezzo che parla con Firebase sta in fondo, separato.
//
// La nota di prodotto del § 1 e' la cosa piu' importante di questo file, ed e'
// una riga sola: **il login non deve diventare un muro**. Si entra in un campo
// con il solo codice, come oggi. L'account serve per CREARE e AMMINISTRARE un
// campo, non per usarlo. Se un giorno qualcuno inverte questa regola, l'app
// smette di funzionare per meta' del gruppo il primo giorno di campo — quando
// nessuno ha voglia di registrarsi e non c'e' linea per farlo.
//
// I messaggi non stanno qui: questo file restituisce CHIAVI del dizionario
// (ROADMAP.md § 18). Un file di regole non sa in che lingua verra' letto.
(function (root) {
  'use strict';

  // ---------- I quattro stati ----------
  // Non cinque, non tre. "ospite" e' chi non ha nemmeno un utente Firebase:
  // e' lo stato di chi apre l'app e basta. "anonimo" e' l'accesso tecnico che
  // l'app usa gia' oggi per leggere il campo — un utente c'e', ma non ha
  // nome. Tenerli distinti serve: da anonimo si puo' PROMUOVERE senza perdere
  // niente, da ospite no, perche' non c'e' niente da promuovere.
  const OSPITE = 'ospite';
  const ANONIMO = 'anonimo';
  const DA_VERIFICARE = 'daVerificare';
  const REGISTRATO = 'registrato';

  function stato(utente) {
    if (!utente) return OSPITE;
    if (utente.isAnonimo || utente.isAnonymous) return ANONIMO;
    // Google certifica l'indirizzo da solo; la registrazione classica no, e
    // finche' l'email non e' verificata l'account esiste ma non conta.
    return (utente.emailVerificata || utente.emailVerified) ? REGISTRATO : DA_VERIFICARE;
  }

  // ---------- Cosa si puo' fare, e con che stato ----------
  // Entrare in un campo con il codice resta di TUTTI, ospiti compresi: e' la
  // nota di prodotto, ed e' l'unica riga di questa tabella che non si tocca.
  const PERMESSI = {
    entrare: [OSPITE, ANONIMO, DA_VERIFICARE, REGISTRATO],
    // Vedere e modificare i dati del campo in cui si e' entrati: idem. Chi
    // segna le presenze al campo non ha un account e non deve averlo.
    modificare: [OSPITE, ANONIMO, DA_VERIFICARE, REGISTRATO],
    // Creare un campo vuol dire diventarne il proprietario: serve un indirizzo
    // che esiste davvero, altrimenti il campo non ha un padrone raggiungibile.
    creare: [REGISTRATO],
    amministrare: [REGISTRATO],
    // Uscire ha senso solo se si e' entrati con un nome.
    uscire: [DA_VERIFICARE, REGISTRATO],
  };

  function puo(azione, st) {
    const elenco = PERMESSI[azione];
    // Un'azione che non esiste non si concede per distrazione: un refuso nel
    // nome ("amministare") direbbe di si' a chiunque, e sarebbe il tipo di
    // difetto che non si vede finche' non e' tardi.
    if (!elenco) return false;
    return elenco.indexOf(st) !== -1;
  }

  // ---------- La registrazione ----------
  // Restituisce l'elenco dei problemi, uno per campo, come CHIAVI. Vuoto vuol
  // dire che si puo' provare: la parola finale resta di Firebase.
  function validaRegistrazione(dati) {
    const d = dati || {};
    const problemi = [];
    const testo = (v) => String(v === null || v === undefined ? '' : v).trim();

    if (!testo(d.nome)) problemi.push('auth.serveNome');
    if (!testo(d.cognome)) problemi.push('auth.serveCognome');
    // Citta' e paese: dove sta chi organizza. Il paese e' un codice ISO di
    // due lettere, scelto da un elenco (PAESI): scritto a mano diventerebbe
    // "Italia", "italia", "IT" e "Itaila", e un dato che non si confronta non
    // serve a niente.
    if (!testo(d.citta)) problemi.push('auth.serveCitta');
    if (!testo(d.paese)) problemi.push('auth.servePaese');
    else if (PAESI.indexOf(testo(d.paese).toUpperCase()) < 0) problemi.push('auth.paeseNonValido');

    const email = testo(d.email);
    if (!email) problemi.push('auth.serveEmail');
    // Il controllo e' volutamente largo: una chiocciola, qualcosa prima,
    // qualcosa dopo, e un punto nel dominio. Le espressioni regolari severe
    // sugli indirizzi rifiutano indirizzi validi (quelli con il +, i domini
    // lunghi, le lettere accentate) e non aggiungono niente: la verifica vera
    // e' l'email che arriva, non la forma.
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problemi.push('auth.emailNonValida');

    const pwd = String(d.password === null || d.password === undefined ? '' : d.password);
    if (!pwd) problemi.push('auth.servePassword');
    // Firebase si accontenta di sei caratteri. Qui ne servono otto: questa app
    // tiene i conti di chi deve dei soldi a chi, e sei caratteri sono un
    // pomeriggio di tentativi.
    else if (pwd.length < 8) problemi.push('auth.passwordCorta');
    // Una password fatta di soli spazi passa la lunghezza e non e' una
    // password. E una password uguale all'indirizzo e' peggio di niente,
    // perche' l'indirizzo e' l'unica cosa che l'attaccante conosce di sicuro.
    else if (!pwd.trim()) problemi.push('auth.passwordVuota');
    else if (email && pwd.toLowerCase() === email.toLowerCase()) problemi.push('auth.passwordUgualeEmail');
    // La password ripetuta: sul telefono si scrive senza vederla, e una
    // lettera sbagliata la prima volta e' un account che non si apre piu'.
    else if (d.ripeti !== undefined && String(d.ripeti) !== pwd) problemi.push('auth.passwordDiverse');

    // La lingua preferita: una di quelle che l'app parla davvero. Facoltativa
    // per chi chiama senza (Google non la chiede), obbligatoria se c'e'.
    if (d.lingua !== undefined && LINGUE_PROFILO.indexOf(testo(d.lingua)) < 0) problemi.push('auth.linguaNonValida');

    return problemi;
  }

  // ---------- Promuovere un anonimo ----------
  // Firebase sa trasformare un utente anonimo in un account registrato
  // TENENDO LO STESSO uid (linkWithCredential). E' la differenza fra "chi usa
  // l'app oggi non perde niente" e "chi usa l'app oggi riparte da zero":
  // i dati su Firestore sono appesi all'uid, e uscire per poi registrarsi ne
  // crea uno nuovo. Quindi: se c'e' una sessione anonima, si PROMUOVE. Mai
  // esci-e-registrati.
  function promuovibile(utente) {
    return stato(utente) === ANONIMO;
  }

  // ---------- I codici di Firebase, tradotti in qualcosa di umano ----------
  // Tre codici diversi diventano lo stesso messaggio, e non e' pigrizia:
  // dire "questo indirizzo non esiste" regala a chiunque un modo per sapere
  // chi e' iscritto, una email alla volta. Si dice che le credenziali non
  // vanno, e basta.
  const MOTIVI = {
    'auth/email-already-in-use': 'auth.emailGiaUsata',
    'auth/invalid-email': 'auth.emailNonValida',
    'auth/weak-password': 'auth.passwordCorta',
    'auth/user-not-found': 'auth.credenzialiSbagliate',
    'auth/wrong-password': 'auth.credenzialiSbagliate',
    'auth/invalid-credential': 'auth.credenzialiSbagliate',
    'auth/too-many-requests': 'auth.troppiTentativi',
    'auth/network-request-failed': 'auth.senzaLinea',
    'auth/operation-not-allowed': 'auth.metodoSpento',
    'auth/credential-already-in-use': 'auth.giaCollegato',
    'auth/requires-recent-login': 'auth.rientra',
    // Firestore non mette il prefisso auth/: la linea che manca durante la
    // cancellazione dell'account (profilo, stanze) arriva cosi'.
    'unavailable': 'auth.senzaLinea',
    // Il dominio da cui si apre l'app non e' fra quelli autorizzati nella
    // console Firebase. Capita ogni volta che si prova da un indirizzo nuovo
    // — un'anteprima di Vercel, un dominio appena comprato — e "riprova" e'
    // il consiglio piu' inutile possibile: riprovando succede identico.
    'auth/unauthorized-domain': 'auth.dominioNonAutorizzato',
    // La finestra di Google bloccata dal browser. NON e' un ripensamento
    // dell'utente (quello e' popup-closed-by-user, che non dice niente):
    // qui la finestra non si e' proprio aperta, e su telefono succede spesso.
    'auth/popup-blocked': 'auth.finestraBloccata',
    'auth/operation-not-supported-in-this-environment': 'auth.finestraBloccata',
    'auth/account-exists-with-different-credential': 'auth.altroModoDiEntrare',
    'auth/invalid-api-key': 'auth.senzaFirebase',
    'auth/user-disabled': 'auth.accountSospeso',
  };

  function motivo(errore) {
    const codice = (errore && (errore.code || errore)) || '';
    // La finestra di Google chiusa con la X non e' un errore: l'utente ha
    // cambiato idea. Mostrargli un avviso rosso lo convince che si e' rotto
    // qualcosa. Si restituisce null, e chi chiama non disegna niente.
    if (/popup-closed-by-user|cancelled-popup-request|user-cancelled/.test(codice)) return null;
    return MOTIVI[codice] || 'auth.nonRiuscito';
  }

  // ---------- Il profilo ----------
  // Quello che si scrive in users/<uid>. Niente di piu': la password non passa
  // di qui, e i campi a cui uno partecipa li scrive la room (§ 2), non il
  // login — se li scrivesse il login, uscire e rientrare li riscriverebbe.
  //
  // Citta', paese e lingua ci sono solo se qualcuno li ha dati: il profilo si
  // scrive in merge, e una casella vuota scritta da un accesso con Google
  // cancellerebbe quello che la persona aveva messo registrandosi.
  function profilo(utente, dati) {
    const d = dati || {};
    const testo = (v) => String(v === null || v === undefined ? '' : v).trim();
    const p = {
      nome: testo(d.nome),
      cognome: testo(d.cognome),
      email: testo((utente && utente.email) || d.email).toLowerCase(),
      creatoIl: d.creatoIl || Date.now(),
    };
    if (testo(d.citta)) p.citta = testo(d.citta);
    if (testo(d.paese)) p.paese = testo(d.paese).toUpperCase();
    if (LINGUE_PROFILO.indexOf(testo(d.lingua)) >= 0) p.lingua = testo(d.lingua);
    return p;
  }

  // ---------- I paesi ----------
  // I codici ISO 3166-1 di due lettere. I NOMI non stanno qui: li da' il
  // browser nella lingua dell'app (Intl.DisplayNames), cosi' «Germania»,
  // «Alemania» e «Allemagne» sono lo stesso DE e nessuno li traduce a mano.
  const PAESI = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ '
    + 'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR '
    + 'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP '
    + 'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT '
    + 'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW '
    + 'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG '
    + 'UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' ');

  // Il paese di partenza del modulo: quello che dice il telefono ("it-IT" ->
  // IT). Se il telefono non lo dice, nessuno: meglio una scelta da fare che
  // una sbagliata gia' fatta.
  function paeseDelTelefono(etichetta) {
    const m = /[-_]([A-Za-z]{2})\b/.exec(String(etichetta || ''));
    const c = m ? m[1].toUpperCase() : '';
    return PAESI.indexOf(c) >= 0 ? c : '';
  }

  // Le lingue che un profilo puo' preferire: quelle dei dizionari. Scritte
  // qui e non chieste a lingue.js perche' questo file si prova da solo; una
  // prova controlla che le due liste restino uguali.
  const LINGUE_PROFILO = ['it', 'es', 'fr'];

  // In che lingua Firebase scrive le email (verifica, nuova password). Firebase
  // i suoi modelli li traduce da se' se glielo si dice; senza, usa la lingua
  // della console, e a chi si e' appena registrato in spagnolo arrivava
  // «Verify your email». Una lingua che l'app non parla non si passa:
  // restituisce '' e Firebase tiene la sua.
  function linguaDelleEmail(lingua) {
    const l = String(lingua || '').trim().toLowerCase();
    return LINGUE_PROFILO.indexOf(l) >= 0 ? l : '';
  }

  // Google manda un nome intero ("Lorenzo Ballerini"), l'app ne tiene due
  // pezzi. La prima parola e' il nome, il resto il cognome: sbaglia sui nomi
  // composti, ma e' un valore di partenza che l'utente puo' correggere — e
  // una casella gia' piena si corregge, una vuota si salta.
  function spezzaNome(intero) {
    const pezzi = String(intero || '').trim().split(/\s+/).filter(Boolean);
    if (!pezzi.length) return { nome: '', cognome: '' };
    return { nome: pezzi[0], cognome: pezzi.slice(1).join(' ') };
  }

  // ---------- Se il profilo va scritto, e con cosa ----------
  // Restituisce l'oggetto da salvare, oppure **null quando non c'e' niente da
  // fare**. Quel null e' la parte utile: senza, ogni apertura dell'app
  // sarebbe una scrittura su Firestore per riscrivere le stesse tre parole.
  //
  // Le quattro regole, che non si indovinano leggendo il codice che chiama:
  //
  // 1. **Un anonimo non ha un profilo.** Non ha nome ne' indirizzo, e il suo
  //    uid muore con l'installazione: si lascerebbe dietro un documento per
  //    ogni telefono che ha aperto l'app una volta, che nessuno potra' mai
  //    piu' raggiungere ne' cancellare.
  // 2. **Quello che ha scritto l'utente batte quello che dice Google.** Chi
  //    si e' corretto il cognome non se lo vede rimettere com'era al
  //    prossimo accesso: da Google si prende solo cio' che manca.
  // 3. **`creatoIl` si scrive una volta.** E' la data d'iscrizione:
  //    riscriverla a ogni accesso la trasformerebbe in "ultima volta che sei
  //    entrato", che e' un altro dato e nessuno se ne accorgerebbe.
  // 4. **Se non cambia niente, non si scrive niente.**
  // ⚠️ Due `nome` diversi, ed e' la trappola di questa funzione. Sull'UTENTE
  // (quello di nostro(), la forma che gira per l'app) `nome` e' il nome
  // INTERO che manda Google — "Lorenzo Ballerini". Sul PROFILO `nome` e' solo
  // il primo pezzo, e il resto sta in `cognome`. Confonderli non da' nessun
  // errore: scrive "Lorenzo Ballerini Ballerini" e nessuno se ne accorge.
  //
  // E l'anonimo qui si chiama `isAnonimo`: nostro() traduce anche quello.
  // Scritto all'inglese il controllo non trova niente, passa sempre, e ogni
  // telefono che ha aperto l'app una volta si lascia dietro un documento.
  function profiloDaSalvare(utente, esistente) {
    if (!utente || !utente.uid) return null;
    if (utente.isAnonimo || utente.isAnonymous) return null;
    const vecchio = esistente || null;
    const daGoogle = spezzaNome(utente.nome || utente.displayName);
    const voluto = profilo(utente, {
      nome: (vecchio && vecchio.nome) || daGoogle.nome,
      cognome: (vecchio && vecchio.cognome) || daGoogle.cognome,
      creatoIl: (vecchio && vecchio.creatoIl) || undefined,
    });
    if (!voluto.email && !voluto.nome && !voluto.cognome) return null;
    if (vecchio
        && vecchio.nome === voluto.nome
        && vecchio.cognome === voluto.cognome
        && vecchio.email === voluto.email) return null;
    return voluto;
  }

  // ---------- Quando il collegamento a Google viene rifiutato ----------
  // "Tieni il tuo posto" collega la sessione anonima a un account Google
  // tenendo lo stesso uid. Ma se quell'account Google esiste GIA' — di solito
  // perche' la persona l'ha collegato sul telefono di prima — Firebase rifiuta
  // il collegamento: un account Google non puo' stare su due uid.
  //
  // In quel caso la cosa giusta e' diventare quell'account, non restare
  // anonimi con un messaggio d'errore: e' la persona stessa che torna. Il
  // posto nella stanza lo ritrova rientrando col codice gia' salvato sul
  // telefono (usaStanza.riagganciaStanza), e rientrare adesso non scrive
  // niente se era gia' dentro (Stanza.esitoRilettura).
  //
  // Ogni altro rifiuto resta un errore: la finestra chiusa, la rete, un
  // dominio non autorizzato non sono "un altro account che esiste".
  function passaAllAccountEsistente(errore) {
    return String((errore && errore.code) || '') === 'auth/credential-already-in-use';
  }

  // Il nome da mostrare: nome e cognome se ci sono, se no la parte davanti
  // alla chiocciola. Mai l'indirizzo intero — finisce nei saldi, accanto a
  // quanto deve, e l'indirizzo di tutti non e' un dato da spargere.
  function nomeVisibile(p) {
    const x = p || {};
    const intero = [x.nome, x.cognome].filter(Boolean).join(' ').trim();
    if (intero) return intero;
    const email = String(x.email || '');
    return email.indexOf('@') > 0 ? email.slice(0, email.indexOf('@')) : '';
  }

  root.Auth = {
    OSPITE: OSPITE,
    ANONIMO: ANONIMO,
    DA_VERIFICARE: DA_VERIFICARE,
    REGISTRATO: REGISTRATO,
    PERMESSI: PERMESSI,
    MOTIVI: MOTIVI,
    stato: stato,
    puo: puo,
    validaRegistrazione: validaRegistrazione,
    promuovibile: promuovibile,
    motivo: motivo,
    profilo: profilo,
    spezzaNome: spezzaNome,
    passaAllAccountEsistente: passaAllAccountEsistente,
    profiloDaSalvare: profiloDaSalvare,
    nomeVisibile: nomeVisibile,
    PAESI: PAESI,
    LINGUE_PROFILO: LINGUE_PROFILO,
    paeseDelTelefono: paeseDelTelefono,
    linguaDelleEmail: linguaDelleEmail,
  };
})(typeof window !== 'undefined' ? window : globalThis);

// ============================================================================
//  IL TRASPORTO — quello che parla con Firebase
// ============================================================================
// Sta sotto un altro nome (window.AuthCloud) di proposito, come CloudSync sta
// separato da Conti: le prove sostituiscono il trasporto e tengono le regole.
// Se fossero la stessa cosa, fingere Firebase vorrebbe dire rinunciare alle
// regole proprio nella prova che deve verificarle.
//
// Tre cose che questo pezzo NON fa, e non per pigrizia:
//   - non inizializza Firebase due volte. firebase-sync.js gia' lo fa: qui si
//     chiede l'app esistente, e solo se non c'e' se ne crea una. Due chiamate
//     a initializeApp con opzioni diverse fanno esplodere l'SDK.
//   - non carica niente all'avvio. L'SDK viene da gstatic: senza linea non
//     arriva, e l'app deve aprirsi lo stesso. Si carica quando serve.
//   - non decide niente. Le decisioni stanno sopra, in Auth.
(function (root) {
  'use strict';

  const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';
  let fb = null;
  let auth = null;
  let osservatori = [];
  let ultimo = null;

  const config = () => (root.FIREBASE_CONFIG || null);
  const disponibile = () => !!(config() && config().apiKey);

  async function sdk() {
    if (fb) return fb;
    const [appMod, authMod] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
    ]);
    fb = Object.assign({}, appMod, authMod);
    return fb;
  }

  // L'utente di Firebase ha una forma sua e cambia fra le versioni dell'SDK.
  // Qui diventa un oggetto nostro: il resto dell'app non deve sapere com'e'
  // fatto, e le regole in Auth lo leggono con i nomi italiani.
  function nostro(u) {
    if (!u) return null;
    return {
      uid: u.uid,
      email: u.email || '',
      nome: u.displayName || '',
      isAnonimo: !!u.isAnonymous,
      emailVerificata: !!u.emailVerified,
      provider: (u.providerData && u.providerData[0] && u.providerData[0].providerId) || '',
    };
  }

  function annuncia() {
    const copia = ultimo ? Object.assign({}, ultimo) : null;
    osservatori.forEach((cb) => { try { cb(copia); } catch (e) { /* un osservatore rotto non ferma gli altri */ } });
  }

  async function init() {
    if (auth) return auth;
    if (!disponibile()) throw new Error('firebase-non-configurato');
    const f = await sdk();
    // getApps() prima di initializeApp: e' l'unico modo di convivere con
    // firebase-sync.js senza che uno dei due faccia esplodere l'altro.
    const app = (f.getApps && f.getApps().length) ? f.getApp() : f.initializeApp(config());
    auth = f.getAuth(app);
    f.onAuthStateChanged(auth, (u) => { ultimo = nostro(u); annuncia(); });
    if (auth.authStateReady) { try { await auth.authStateReady(); } catch (e) { /* SDK vecchio */ } }
    return auth;
  }

  // Si iscrive ai cambi di stato. Chiama subito con quello che si sa gia',
  // cosi' chi disegna non resta con lo schermo vuoto ad aspettare.
  function osserva(cb) {
    if (typeof cb !== 'function') return () => {};
    osservatori.push(cb);
    try { cb(ultimo ? Object.assign({}, ultimo) : null); } catch (e) { /* niente */ }
    init().catch(() => { /* senza linea o senza config: si resta ospiti */ });
    return () => { osservatori = osservatori.filter((x) => x !== cb); };
  }

  // Registrarsi. Se c'e' gia' una sessione anonima si PROMUOVE quella: stesso
  // uid, stessi dati. Uscire e registrarsi da capo darebbe un uid nuovo e
  // staccherebbe il campo dal suo proprietario — e' il motivo per cui questa
  // funzione non ha una strada alternativa.
  async function registra(dati) {
    const f = await sdk();
    const a = await init();
    const d = dati || {};
    const email = String(d.email || '').trim();
    const pwd = String(d.password || '');

    if (root.Auth && root.Auth.promuovibile(nostro(a.currentUser))) {
      const cred = f.EmailAuthProvider.credential(email, pwd);
      await f.linkWithCredential(a.currentUser, cred);
    } else {
      await f.createUserWithEmailAndPassword(a, email, pwd);
    }
    const nome = [d.nome, d.cognome].filter(Boolean).join(' ').trim();
    if (nome && f.updateProfile) { try { await f.updateProfile(a.currentUser, { displayName: nome }); } catch (e) { /* il nome si puo' rimettere dopo */ } }
    // Il profilo completo — citta', paese, lingua — si scrive QUI, con quello
    // che la persona ha appena scritto: l'osservatore dell'accesso conosce
    // solo l'utente di Firebase, che di citta' e lingua non sa niente. Se non
    // riesce (la linea) l'account c'e' lo stesso: non si ferma per questo.
    try {
      if (root.Auth) {
        const fs = await sdkFirestore();
        const db = await dbase();
        await fs.setDoc(fs.doc(db, 'users', a.currentUser.uid), root.Auth.profilo(nostro(a.currentUser), d), { merge: true });
      }
    } catch (e) { /* il profilo si ricompone al prossimo accesso */ }
    // La verifica arriva nella lingua preferita appena scelta nel modulo.
    parlaIn(a, d.lingua);
    await f.sendEmailVerification(a.currentUser);
    ultimo = nostro(a.currentUser);
    annuncia();
    return ultimo;
  }

  async function entra(email, password) {
    const f = await sdk();
    const a = await init();
    await f.signInWithEmailAndPassword(a, String(email || '').trim(), String(password || ''));
    ultimo = nostro(a.currentUser);
    annuncia();
    return ultimo;
  }

  // Google. Anche qui, se c'e' una sessione anonima si collega invece di
  // sostituirla.
  async function conGoogle() {
    const f = await sdk();
    const a = await init();
    const provider = new f.GoogleAuthProvider();
    if (root.Auth && root.Auth.promuovibile(nostro(a.currentUser))) {
      try {
        await f.linkWithPopup(a.currentUser, provider);
      } catch (e) {
        // Quell'account Google esiste gia': si diventa lui, con la credenziale
        // che Firebase restituisce dentro l'errore — niente seconda finestra.
        const credenziale = root.Auth.passaAllAccountEsistente(e)
          && f.GoogleAuthProvider.credentialFromError
          && f.GoogleAuthProvider.credentialFromError(e);
        if (!credenziale) throw e;
        await f.signInWithCredential(a, credenziale);
      }
    } else {
      await f.signInWithPopup(a, provider);
    }
    ultimo = nostro(a.currentUser);
    annuncia();
    return ultimo;
  }

  async function esci() {
    const f = await sdk();
    const a = await init();
    await f.signOut(a);
    ultimo = null;
    annuncia();
  }

  // La lingua delle email di Firebase (Auth.linguaDelleEmail decide se vale).
  function parlaIn(a, lingua) {
    const l = root.Auth ? root.Auth.linguaDelleEmail(lingua) : '';
    if (l) a.languageCode = l;
  }

  async function reimposta(email, lingua) {
    const f = await sdk();
    const a = await init();
    parlaIn(a, lingua);
    await f.sendPasswordResetEmail(a, String(email || '').trim());
  }

  async function inviaVerifica(lingua) {
    const f = await sdk();
    const a = await init();
    if (!a.currentUser) return;
    parlaIn(a, lingua);
    await f.sendEmailVerification(a.currentUser);
  }

  // Firebase non si accorge da solo che l'utente ha cliccato il link nella
  // email: l'oggetto in memoria resta con emailVerified a false finche' non lo
  // si ricarica. Senza questa, chi verifica e torna nell'app resta "da
  // verificare" fino al prossimo avvio — e pensa che non abbia funzionato.
  async function ricarica() {
    const a = await init();
    if (!a.currentUser) return null;
    await a.currentUser.reload();
    ultimo = nostro(a.currentUser);
    annuncia();
    return ultimo;
  }

  // ---------- Il profilo su Firestore ----------
  // Sta qui e non in firebase-sync.js perche' users/<uid> e' "chi sei", non
  // i dati di un campo — e perche' CloudSync il suo db ce l'ha solo da
  // connesso, mentre il profilo serve anche a chi ha spento la
  // sincronizzazione. Il pezzo di SDK in piu' si carica solo se qualcuno
  // entra davvero: chi resta ospite non scarica niente.
  let fs = null;
  let dbProfili = null;

  async function sdkFirestore() {
    if (fs) return fs;
    const [appMod, fsMod] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-firestore.js'),
    ]);
    fs = Object.assign({}, appMod, fsMod);
    return fs;
  }

  async function dbase() {
    if (dbProfili) return dbProfili;
    const f = await sdkFirestore();
    const app = (f.getApps && f.getApps().length) ? f.getApp() : f.initializeApp(config());
    dbProfili = f.getFirestore(app);
    return dbProfili;
  }

  // Legge quello che c'e', chiede alle REGOLE (profiloDaSalvare) se serve
  // scrivere, e scrive solo se serve. Il merge lascia stare i campi che non
  // nomina: se domani la stanza scrive qualcosa dentro users/<uid>, il login
  // non glielo cancella passando di qui.
  //
  // Non alza mai un'eccezione. Un profilo che non si salva e' un fastidio;
  // un'eccezione dentro l'osservatore dell'accesso smonta React e porta via
  // l'app intera, che e' un'altra categoria di guaio.
  async function sincronizzaProfilo(utente) {
    try {
      if (!root.Auth) return null;
      // Chi non avrebbe un profilo nemmeno partendo da zero — anonimi,
      // ospiti, chi non ha ne' nome ne' indirizzo — non fa nemmeno il giro
      // di rete. Per tutti gli altri si legge, e sara' la stessa funzione,
      // con quello che c'e' davvero, a dire se poi si scrive.
      if (!root.Auth.profiloDaSalvare(utente, null)) return null;
      if (!disponibile()) return null;
      const f = await sdkFirestore();
      const d = await dbase();
      const rif = f.doc(d, 'users', utente.uid);
      let esistente = null;
      try {
        const istantanea = await f.getDoc(rif);
        if (istantanea.exists()) esistente = istantanea.data();
      } catch (e) { /* non letto: si prova a scrivere lo stesso */ }
      const daScrivere = root.Auth.profiloDaSalvare(utente, esistente);
      if (!daScrivere) return esistente;
      await f.setDoc(rif, daScrivere, { merge: true });
      return daScrivere;
    } catch (e) {
      return null;
    }
  }

  // ---------- Cancellare l'account (ROADMAP § 3, requisito di Google Play) ----------
  // Le stanze che il profilo si e' segnato (StanzaCloud.segnaNelProfilo).
  // Se il profilo non si legge — la linea, di solito — si alza l'errore: la
  // cancellazione deve sapere di quali campi sei proprietario, e non puo'
  // farlo alla cieca.
  // Il profilo di chi e' entrato, o null: serve a rimettere la sua lingua
  // preferita quando entra su un telefono nuovo. Non alza eccezioni: senza
  // profilo si resta nella lingua che c'e'.
  async function leggiProfilo() {
    try {
      const a = await init();
      const u = a.currentUser;
      if (!u || u.isAnonymous) return null;
      const fs = await sdkFirestore();
      const db = await dbase();
      const x = await fs.getDoc(fs.doc(db, 'users', u.uid));
      return x.exists() ? x.data() : null;
    } catch (e) { return null; }
  }

  async function stanzeDelProfilo() {
    const a = await init();
    const u = a.currentUser;
    if (!u) return [];
    const f = await sdkFirestore();
    const d = await dbase();
    const x = await f.getDoc(f.doc(d, 'users', u.uid));
    return (x.exists() && Array.isArray(x.data().stanze)) ? x.data().stanze : [];
  }

  // Il profilo, poi l'account. In QUEST'ORDINE per forza: senza account le
  // regole non lasciano piu' cancellare il profilo, che resterebbe li' per
  // sempre. Se la cancellazione dell'account chiede di rientrare
  // (auth/requires-recent-login), il profilo e' gia' andato e l'account no:
  // si rientra, si riprova, e il secondo giro trova niente da togliere e
  // finisce il lavoro. Ogni passo si puo' ripetere senza danni.
  async function cancellaProfiloEAccount() {
    const a = await init();
    const u = a.currentUser;
    if (!u) return;
    const f = await sdkFirestore();
    const d = await dbase();
    await f.deleteDoc(f.doc(d, 'users', u.uid));
    const fa = await sdk();
    await fa.deleteUser(u);
    ultimo = null;
    annuncia();
  }

  root.AuthCloud = {
    disponibile: disponibile,
    sincronizzaProfilo: sincronizzaProfilo,
    leggiProfilo: leggiProfilo,
    stanzeDelProfilo: stanzeDelProfilo,
    cancellaProfiloEAccount: cancellaProfiloEAccount,
    osserva: osserva,
    utente: () => (ultimo ? Object.assign({}, ultimo) : null),
    registra: registra,
    entra: entra,
    conGoogle: conGoogle,
    esci: esci,
    reimposta: reimposta,
    inviaVerifica: inviaVerifica,
    ricarica: ricarica,
  };
})(typeof window !== 'undefined' ? window : globalThis);
