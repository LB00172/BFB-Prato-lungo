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
    auth: false,   // login con Google / email+password (roadmap settembre)
    rooms: false,  // creazione "room" con ID e password (roadmap settembre)
  },
};
