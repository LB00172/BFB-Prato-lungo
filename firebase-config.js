// ============================================================================
//  CONFIGURAZIONE FIREBASE  (solo per la sincronizzazione online — opzionale)
// ============================================================================
// Config del progetto Firebase "camp-ops".
//
// **Il progetto e' SUO, e non e' quello della Brigata.** Fino al 22 settembre
// i due rami parlavano con lo stesso progetto (`brigata-bandone`), e la cosa
// si vedeva nel punto peggiore: premendo "Entra con Google" la finestra di
// consenso andava su `brigata-bandone.firebaseapp.com` e mostrava quel nome.
// Cioe' il prodotto pubblico, nel momento in cui e' piu' guardato, diceva il
// nome del gruppo privato. La guardia sui file di marchio restava verde —
// `firebase-config.js` era gia' nell'elenco DIVERSI e in effetti differiva,
// in due righe — mentre la stringa che l'utente leggeva davvero era identica.
//
// Separandoli cadono insieme altre tre cose: un file di regole solo per due
// app diverse, il raggio di un errore (uno sbaglio nelle regole pubbliche
// arrivava ai dati veri del campo 2026), e le carte del Play Store, che sono
// per progetto e si sarebbero portate dietro i dati personali di venti amici.
//
// NOTA: l'apiKey di Firebase NON e' un segreto. E' un identificatore pubblico
// lato client; la sicurezza vera sta nelle Regole di Firestore.
// ============================================================================

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDRZg0ilLE3EPgvgprQuJSy_eAJC1pIpmQ",
  authDomain: "camp-ops.firebaseapp.com",
  projectId: "camp-ops",
  storageBucket: "camp-ops.firebasestorage.app",
  messagingSenderId: "367713450118",
  appId: "1:367713450118:web:8a191efd7f62da0983f907",
  measurementId: "G-SQ0C5J8796"
};

// Nessun campo predefinito: nella versione pubblica un campo lo crei tu, o
// entri in quello di un altro col suo codice. Fino al 28 settembre qui c'era
// "CampOpsProva", un campo che c'era sempre — e con lui la schermata
// d'apertura e la home («I miei campi») non comparivano mai, cioe' l'app non
// era quella che vede chi la scarica. Le prove che hanno bisogno di un campo
// se lo danno da sole (test/lib/app.js, CAMPO_DI_PROVA).
window.CAMP_CODE_DEFAULT = "";

// ============================================================================
//  BLOCCO CON PASSWORD
// ============================================================================
// L'app non si apre senza password. Qui NON c'e' la password in chiaro: c'e'
// solo la sua impronta (PBKDF2-SHA256, 200.000 giri, con sale). Al login la
// password digitata viene ripassata nella stessa funzione e si confrontano le
// impronte: dal file non si risale alla password.
//
// Cosa protegge: impedisce a chi arriva sull'indirizzo di curiosare fra spese,
// nomi e scontrini. NON e' una cassaforte: e' un controllo che gira sul
// telefono, quindi chi ha competenze tecniche e voglia puo' aggirarlo.
// La difesa dei dati nel cloud sta nelle Regole di Firestore (vedi README).
//
// Per cambiare password: rigenera l'impronta e incolla i tre valori qui sotto.
//   node -e 'const c=require("crypto");const s=c.randomBytes(16);
//     console.log(s.toString("hex"),
//       c.pbkdf2Sync("NUOVA_PASSWORD",s,200000,32,"sha256").toString("hex"))'
// Mettere lock: null disattiva il blocco.
//
// dbEmail: utente CONDIVISO con cui l'app entra nel database, uguale per
// tutti e invisibile (nessuno lo digita). L'app ci accede con la password
// scritta nella schermata di blocco, che quindi diventa la chiave dei dati e
// non solo della schermata. Finche' l'utente non esiste in Firebase
// (Authentication -> Email/Password), l'app ricade sull'accesso anonimo di
// prima: si puo' quindi attivare senza fretta. Vedi README, "Sicurezza".
window.APP_LOCK = {
  salt: "585d27f76cbf10a88166855e1721ffc1",
  hash: "75b95d8f8b0d9645683337cb62b05f72980e806052ea5a2b7ca92b82e58d1663",
  iter: 200000,
  hint: "Password di prova di Camp Ops — chiedila a chi organizza.",
  // Su questo ramo NON c'e' utente condiviso, e non e' una dimenticanza:
  // campo@brigatabandone.it e' l'utente della Brigata, roba della versione
  // privata. Senza dbEmail l'app entra nel database in anonimo, che e' quello
  // che deve fare la versione pubblica finche' i dati non si spostano sotto
  // rooms/<id>/dati/ (ROADMAP § 2).
  dbEmail: null,
};

// ============================================================================
//  MODALITÀ TECNICA
// ============================================================================
// Impronta della password che accende la "Modalità tecnica" in Impostazioni:
// diagnostica della sincronizzazione, registro delle modifiche, avvisi sulle
// voci cancellate e promemoria del backup si vedono SOLO sui telefoni dove è
// stata attivata. Gli altri usano l'app senza messaggi tecnici.
// Come per il blocco: qui c'è solo l'impronta, non la password. Per cambiarla
// si usa lo stesso comando del blocco qui sopra.
//
// ⚠️ SU QUESTO RAMO LA PASSWORD NON C'E'. `aperta: true` vuol dire che la
// modalita' tecnica si accende con un tasto, senza niente da digitare —
// deciso il 22 settembre per lavorare sulla versione pubblica senza ridigitare
// la password a ogni rilascio dell'anteprima.
//
// **Non e' una scelta da portarsi al Play Store.** Dietro la modalita'
// tecnica non c'e' solo la diagnostica: ci sono importazione, ripristino di
// emergenza e chiusura del campo, che non modificano i dati — li RIMPIAZZANO,
// e si portano via i blocchi insieme al resto. Aperta a tutti vuol dire che
// chiunque apra Impostazioni puo' svuotare il campo di venti persone.
//
// Non e' un interruttore silenzioso: con `aperta` accesa la scheda lo dice a
// schermo, e una prova controlla che sul ramo privato la password ci sia
// ancora. Per rimetterla qui, si toglie `aperta` e si rimettono salt/hash/iter.
window.APP_ADMIN = {
  aperta: true,
};

// Località del campo per il meteo (Open-Meteo, gratuito, senza chiave).
// lat/lon: il PRATO, non il paese. In Google Maps si tiene premuto sul punto e
// le coordinate compaiono nella barra di ricerca, già pronte da copiare.
// alt: la quota in metri. Senza, il modello usa la quota media della sua cella
// (circa un chilometro di lato) e in montagna sbaglia di gradi veri. Con la
// modalità tecnica attiva, sotto il meteo del Calendario si legge la quota che
// il modello ha usato davvero: se non somiglia a quella del campo, le
// coordinate qui sotto sono da correggere.
window.CAMP_LOCATION = { lat: 42.0486, lon: 13.14855, alt: 1337, label: "Prato Lungo (Pereto, AQ)" };

// ============================================================================
//  CONFIGURAZIONE APP  (branding + funzionalità)
// ============================================================================
// Tutti i testi identitari stanno qui: per una versione neutra (es. pubblicata
// sullo store, vedi ROADMAP.md) basta modificare questo blocco, senza toccare
// il codice dell'app.
//
// "features" tiene spente le funzioni non ancora pronte: restano invisibili
// finché non vengono attivate.
// ============================================================================
window.APP_CONFIG = {
  // DOVE finiscono i dati del campo. Su questo ramo dentro la stanza
  // (rooms/<codice>/dati/stato), che e' quello che permettono le regole
  // Firestore pubblicate. Sulla versione privata questa riga non c'e' e si
  // resta su camps/<codice>. Cambiarla senza cambiare le regole vuol dire
  // permesso negato su ogni scrittura, senza nessun messaggio che lo spieghi.
  dati: "rooms",

  // ATTENZIONE: questo e' il ramo PUBBLICO (camp-ops). Il marchio
  // qui e' neutro — "Camp Ops" — e ci resta. La Brigata, Prato Lungo e Bandy
  // vivono su `main`, che e' l'app privata del gruppo: sono due prodotti, non
  // uno con il marchio cambiato (CLAUDE.md). Chi riporta qui un nome del
  // gruppo sta rimettendo insieme quello che e' stato diviso apposta.
  brand: {
    appTitle: "CAMP OPS",                // titolo nell'header
    groupName: "",                       // sottotitolo: lo scrive la stanza
    splashLine1: "CAMP",                 // splash: prima riga
    splashLine2: "OPS",                  // splash: seconda riga
    splashTagline: "Le spese del campo, divise bene",
    footerMotto: "",
    credits: "Camp Ops · Lorenzo Ballerini · © 2026",
  },
  // Chi tratta i dati, per l'informativa (privacy.html) e la pagina di
  // cancellazione (cancella-account.html): le due pagine li leggono da qui,
  // cosi' il contatto si scrive in un posto solo. Google Play vuole un modo
  // per raggiungere chi gestisce i dati; finche' `contatto` e' vuoto, le
  // pagine lo dicono in rosso invece di inventarne uno.
  privacy: {
    titolare: "Lorenzo Ballerini",
    contatto: "",
    aggiornata: "28 settembre 2026",
  },
  features: {
    // Accese il 21 settembre: i provider Google ed Email/Password sono attivi
    // nella console. Finche' le regole Firestore nuove non sono pubblicate,
    // CREARE una stanza si ferma sul permesso negato — l'interfaccia c'e' e
    // si vede, il giro completo no.
    auth: true,            // login con Google / email+password
    rooms: true,           // creazione "room" con ID e codice d'ingresso
    equipExemption: false, // esenzione per membro dalla spesa attrezzatura (da rivedere)
  },
};
