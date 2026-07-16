// ============================================================================
//  CONFIGURAZIONE FIREBASE  (solo per la sincronizzazione online — opzionale)
// ============================================================================
// Incolla qui la config del TUO progetto Firebase:
//   console.firebase.google.com  ->  Impostazioni progetto  ->  "Le tue app" (Web)
//   ->  copia l'oggetto firebaseConfig.
//
// NOTA: l'apiKey di Firebase NON e' un segreto. E' un identificatore pubblico
// lato client; la sicurezza vera sta nelle Regole di Firestore. Puoi committarla.
//
// Finche' i campi restano "INCOLLA_QUI", la app funziona normalmente in locale
// (offline) e la sezione "Sincronizzazione Cloud" resta disattivata.
// ============================================================================

window.FIREBASE_CONFIG = {
  apiKey: "INCOLLA_QUI",
  authDomain: "INCOLLA_QUI",
  projectId: "INCOLLA_QUI",
  storageBucket: "INCOLLA_QUI",
  messagingSenderId: "INCOLLA_QUI",
  appId: "INCOLLA_QUI"
};

// Codice del campo: chi conosce questo codice accede ai dati condivisi.
window.CAMP_CODE_DEFAULT = "Bandone";
