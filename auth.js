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
  function profilo(utente, dati) {
    const d = dati || {};
    const testo = (v) => String(v === null || v === undefined ? '' : v).trim();
    return {
      nome: testo(d.nome),
      cognome: testo(d.cognome),
      email: testo((utente && utente.email) || d.email).toLowerCase(),
      creatoIl: d.creatoIl || Date.now(),
    };
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
    nomeVisibile: nomeVisibile,
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
      await f.linkWithPopup(a.currentUser, provider);
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

  async function reimposta(email) {
    const f = await sdk();
    const a = await init();
    await f.sendPasswordResetEmail(a, String(email || '').trim());
  }

  async function inviaVerifica() {
    const f = await sdk();
    const a = await init();
    if (!a.currentUser) return;
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

  root.AuthCloud = {
    disponibile: disponibile,
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
