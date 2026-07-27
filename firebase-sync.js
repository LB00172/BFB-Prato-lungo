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
            maybeDailySnapshot(d.data);
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
        maybeDailySnapshot(json);
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

  // --- Snapshot di sicurezza giornaliero ---
  // Una volta al giorno salva una copia dei dati in camps/<code>/snapshots/<data>.
  // "Il primo del giorno vince": se il documento del giorno esiste gia' non lo
  // sovrascrive (protegge dal caso di un dispositivo con dati vecchi).
  async function maybeDailySnapshot(json) {
    if (!state.connected || !db || !fb || !navigator.onLine) return;
    const now = new Date();
    const key = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    if (localStorage.getItem('cambusa_snap_date') === key) return;
    try {
      const ref = fb.doc(db, 'camps', state.code, 'snapshots', key);
      const existing = await fb.getDoc(ref);
      if (!existing.exists()) {
        await fb.setDoc(ref, { data: json, savedBy: deviceId, savedAt: fb.serverTimestamp() });
        // Pulizia: tiene solo gli ultimi 10 giorni.
        try {
          const all = await fb.getDocs(fb.collection(db, 'camps', state.code, 'snapshots'));
          const ids = [];
          all.forEach((d) => ids.push(d.id));
          ids.sort();
          for (const id of ids.slice(0, Math.max(0, ids.length - 10))) {
            await fb.deleteDoc(fb.doc(db, 'camps', state.code, 'snapshots', id));
          }
        } catch (e) { /* pulizia best-effort */ }
      }
      localStorage.setItem('cambusa_snap_date', key);
    } catch (e) { /* offline o regole mancanti: riprovera' */ }
  }

  // Elenco degli snapshot disponibili (date, dalla piu' recente).
  async function listSnapshots() {
    if (!state.connected || !db || !fb) return [];
    try {
      const all = await fb.getDocs(fb.collection(db, 'camps', state.code, 'snapshots'));
      const ids = [];
      all.forEach((d) => ids.push(d.id));
      return ids.sort().reverse();
    } catch (e) {
      return [];
    }
  }

  // Contenuto (JSON) di uno snapshot.
  async function getSnapshot(id) {
    if (!state.connected || !db || !fb) return null;
    try {
      const s = await fb.getDoc(fb.doc(db, 'camps', state.code, 'snapshots', id));
      return s.exists() ? s.data().data : null;
    } catch (e) {
      return null;
    }
  }

  // --- Classifica del mini gioco ---
  // Un documento per giocatore: camps/<code>/scores/<nome normalizzato>,
  // aggiornato solo se il nuovo punteggio è migliore.
  async function submitScore(name, score) {
    if (!state.connected || !db || !fb) return;
    const key = String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    if (!key) return;
    try {
      const ref = fb.doc(db, 'camps', state.code, 'scores', key);
      const cur = await fb.getDoc(ref);
      if (cur.exists() && (cur.data().score || 0) >= score) return;
      await fb.setDoc(ref, { name: String(name).trim().slice(0, 24), score, at: fb.serverTimestamp() });
    } catch (e) { /* offline o regole: riprovera' */ }
  }

  async function listScores() {
    if (!state.connected || !db || !fb) return [];
    try {
      const snap = await fb.getDocs(fb.collection(db, 'camps', state.code, 'scores'));
      const out = [];
      snap.forEach((d) => { const v = d.data(); if (v && v.name) out.push({ name: v.name, score: v.score || 0 }); });
      return out.sort((a, b) => b.score - a.score).slice(0, 20);
    } catch (e) {
      return [];
    }
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
    listSnapshots,
    getSnapshot,
    submitScore,
    listScores,
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
