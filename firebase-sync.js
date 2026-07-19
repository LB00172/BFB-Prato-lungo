// ============================================================================
//  SINCRONIZZAZIONE CLOUD (opzionale, solo online) — Firebase Firestore
// ============================================================================
// Espone window.CloudSync. Il codice Firebase viene scaricato in modo DINAMICO
// (import) solo quando ci si connette: se sei offline o non hai configurato
// Firebase, questo file non fa nulla e la app resta 100% locale.
//
// Modello dati: collezione "camps", documento con id = codice campo (es.
// "Bandone"), contenente { data: <stato JSON>, updatedBy, updatedAt }.
// Strategia: last-write-wins, con guardia anti-loop (ignora gli echi dei
// propri stessi salvataggi tramite un deviceId).
// ============================================================================
(function () {
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';

  let fb = null;              // moduli Firebase caricati
  let app, db, auth, unsub;   // handle Firebase
  let receiptsUnsub = null;   // listener sotto-collezione scontrini
  let onRemote = null;        // callback quando arrivano dati remoti
  let onReceiptsCb = null;    // callback quando arrivano foto scontrini
  let onStatusCb = null;      // callback di stato per la UI
  let pushTimer = null;
  let lastAppliedJson = null; // ultimo stato ricevuto/applicato dal cloud
  let lastPushedJson = null;  // ultimo stato inviato al cloud

  let deviceId = localStorage.getItem('cambusa_device_id');
  if (!deviceId) {
    deviceId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('cambusa_device_id', deviceId);
  }

  const state = { connected: false, code: null, status: 'idle', lastSync: null, error: null };
  const emit = (patch) => {
    Object.assign(state, patch || {});
    if (onStatusCb) onStatusCb({ ...state });
  };

  async function loadSdk() {
    if (fb) return fb;
    const [appMod, authMod, fsMod] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js'),
    ]);
    fb = { ...appMod, ...authMod, ...fsMod };
    return fb;
  }

  async function connect(config, code, remoteCb) {
    onRemote = remoteCb;
    emit({ status: 'connecting', error: null });
    try {
      await loadSdk();
      app = fb.getApps().length ? fb.getApp() : fb.initializeApp(config);
      auth = fb.getAuth(app);
      // Cache persistente: offline si legge/scrive dalla cache locale e le
      // scritture vengono messe in coda e inviate da sole al ritorno della rete.
      if (!db) {
        try {
          db = fb.initializeFirestore(app, {
            localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }),
          });
        } catch (e) {
          db = fb.getFirestore(app); // fallback (già inizializzato o persistenza non disponibile)
        }
      }
      await fb.signInAnonymously(auth);

      const ref = fb.doc(db, 'camps', code);
      if (unsub) unsub();
      unsub = fb.onSnapshot(
        ref,
        (snap) => {
          emit({ connected: true, code, status: 'connected' });
          if (!snap.exists()) return;
          const d = snap.data();
          if (d.updatedBy === deviceId) { emit({ lastSync: Date.now() }); return; }
          if (typeof d.data === 'string' && d.data !== lastAppliedJson) {
            lastAppliedJson = d.data;
            try { if (onRemote) onRemote(JSON.parse(d.data)); } catch (e) { /* ignora dati non validi */ }
            emit({ lastSync: Date.now() });
          }
        },
        (err) => emit({ status: 'error', error: err.message })
      );

      // Foto scontrini: sotto-collezione camps/<code>/receipts, un documento
      // per foto (dataURL compresso, sotto il limite di 1MB per documento).
      if (receiptsUnsub) receiptsUnsub();
      receiptsUnsub = fb.onSnapshot(
        fb.collection(db, 'camps', code, 'receipts'),
        (snap) => {
          const map = {};
          snap.forEach((d) => {
            const v = d.data();
            if (v && typeof v.data === 'string') map[d.id] = v.data;
          });
          if (onReceiptsCb) onReceiptsCb(map);
        },
        () => { /* es. regole non aggiornate: la sync principale continua */ }
      );

      localStorage.setItem('cambusa_camp_code', code);
      emit({ connected: true, code, status: 'connected', error: null });
    } catch (e) {
      emit({ status: 'error', error: e.message || String(e), connected: false });
      throw e;
    }
  }

  function pushState(obj) {
    if (!state.connected || !db || !fb) return;
    const json = JSON.stringify(obj);
    // Non reinviare cio' che abbiamo appena ricevuto o gia' inviato.
    if (json === lastAppliedJson || json === lastPushedJson) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try {
        emit({ status: 'saving' });
        lastPushedJson = json;
        const ref = fb.doc(db, 'camps', state.code);
        await fb.setDoc(ref, { data: json, updatedBy: deviceId, updatedAt: fb.serverTimestamp() });
        emit({ status: 'connected', lastSync: Date.now() });
      } catch (e) {
        emit({ status: 'error', error: e.message || String(e) });
      }
    }, 1500);
  }

  // Carica/aggiorna la foto di uno scontrino nel cloud (fire-and-forget:
  // offline la scrittura resta in coda nella cache persistente di Firestore).
  async function putReceipt(purchaseId, dataUrl) {
    if (!state.connected || !db || !fb) return;
    try {
      const ref = fb.doc(db, 'camps', state.code, 'receipts', purchaseId);
      await fb.setDoc(ref, { data: dataUrl, updatedBy: deviceId, updatedAt: fb.serverTimestamp() });
    } catch (e) { /* regole mancanti o rete: si riprova alla prossima connessione */ }
  }

  async function deleteReceipt(purchaseId) {
    if (!state.connected || !db || !fb) return;
    try {
      await fb.deleteDoc(fb.doc(db, 'camps', state.code, 'receipts', purchaseId));
    } catch (e) { /* ignora */ }
  }

  function disconnect() {
    if (unsub) { unsub(); unsub = null; }
    if (receiptsUnsub) { receiptsUnsub(); receiptsUnsub = null; }
    localStorage.removeItem('cambusa_camp_code');
    lastAppliedJson = null;
    lastPushedJson = null;
    emit({ connected: false, code: null, status: 'idle', error: null });
  }

  window.CloudSync = {
    connect,
    pushState,
    putReceipt,
    deleteReceipt,
    disconnect,
    onStatus: (cb) => { onStatusCb = cb; cb({ ...state }); },
    onReceipts: (cb) => { onReceiptsCb = cb; },
    isConnected: () => state.connected,
    savedCode: () => localStorage.getItem('cambusa_camp_code'),
    isConfigured: () => {
      const c = window.FIREBASE_CONFIG;
      return !!(c && c.apiKey && c.apiKey !== 'INCOLLA_QUI' && c.projectId && c.projectId !== 'INCOLLA_QUI');
    },
  };
})();
