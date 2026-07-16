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
  let onRemote = null;        // callback quando arrivano dati remoti
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
      db = fb.getFirestore(app);
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

  function disconnect() {
    if (unsub) { unsub(); unsub = null; }
    localStorage.removeItem('cambusa_camp_code');
    lastAppliedJson = null;
    lastPushedJson = null;
    emit({ connected: false, code: null, status: 'idle', error: null });
  }

  window.CloudSync = {
    connect,
    pushState,
    disconnect,
    onStatus: (cb) => { onStatusCb = cb; cb({ ...state }); },
    savedCode: () => localStorage.getItem('cambusa_camp_code'),
    isConfigured: () => {
      const c = window.FIREBASE_CONFIG;
      return !!(c && c.apiKey && c.apiKey !== 'INCOLLA_QUI' && c.projectId && c.projectId !== 'INCOLLA_QUI');
    },
  };
})();
