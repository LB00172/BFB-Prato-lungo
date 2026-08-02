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
window.CAMP_CODE_DEFAULT = "Bandone";

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
  salt: "43fae8e332f167f7b612255eec80a82a",
  hash: "432631a6d9164150bff2cef2afebf83fc36f43fe04c658bac55ec89dbeda8a14",
  iter: 200000,
  hint: "Password del campo — chiedila a chi organizza.",
  dbEmail: "campo@brigatabandone.it",
};

// Località del campo per il meteo (Open-Meteo, gratuito, senza chiave).
window.CAMP_LOCATION = { lat: 42.059, lon: 13.1, label: "Pereto (AQ)" };

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
  brand: {
    appTitle: "PRATO LUNGO 2026",        // titolo nell'header
    groupName: "Brigata Fabio Bandone",  // sottotitolo / nome gruppo
    splashLine1: "BRIGATA",              // splash: prima riga
    splashLine2: "FABIO BANDONE",        // splash: seconda riga
    splashTagline: "Prato Lungo Forever",
    footerMotto: "In BANDY we Trust",
    credits: "Web app prodotta da Lorenzo Ballerini · Tutti i diritti riservati © 2026",
  },
  features: {
    auth: false,           // login con Google / email+password (roadmap settembre)
    rooms: false,          // creazione "room" con ID e password (roadmap settembre)
    equipExemption: false, // esenzione per membro dalla spesa attrezzatura (da rivedere)
  },
};
