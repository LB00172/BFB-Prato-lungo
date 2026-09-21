// ============================================================================
//  CONFIGURAZIONE FIREBASE  (solo per la sincronizzazione online — opzionale)
// ============================================================================
// Config del progetto Firebase "brigata-bandone".
//
// NOTA: l'apiKey di Firebase NON e' un segreto. E' un identificatore pubblico
// lato client; la sicurezza vera sta nelle Regole di Firestore.
// ============================================================================

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAXxV4WII_quLsStOlj0_DPbqSArL7vwSQ",
  authDomain: "brigata-bandone.firebaseapp.com",
  projectId: "brigata-bandone",
  storageBucket: "brigata-bandone.firebasestorage.app",
  messagingSenderId: "981622823343",
  appId: "1:981622823343:web:daabbe8e90c7373155b75a",
  measurementId: "G-RP3PN9V17N"
};

// Codice del campo: chi conosce questo codice accede ai dati condivisi.
// Il codice del campo su cui scrive questa versione. **Deve essere diverso da
// quello della Brigata**: i due rami parlano con lo STESSO progetto Firebase,
// quindi con lo stesso codice l'anteprima pubblica scriverebbe dentro il
// documento del campo 2026 — quello di cui si stanno ancora chiudendo i
// rimborsi. Le versioni sono due: i dati pure.
window.CAMP_CODE_DEFAULT = "CampOpsProva";

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
window.APP_ADMIN = {
  salt: "dbe546cd0f8b3613730c140ea9ea1ee0",
  hash: "a82b547461e3a4b1417f812370676773afe79ecba283eb5f86dc6c32e3372c98",
  iter: 200000,
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
  // ATTENZIONE: questo e' il ramo PUBBLICO (feature/public-app). Il marchio
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
