// ============================================================================
//  SINCRONIZZAZIONE CLOUD (opzionale, solo online) — Firebase Firestore
// ============================================================================
// Espone window.CloudSync. Il codice Firebase viene scaricato in modo DINAMICO
// (import) solo quando ci si connette: se sei offline o non hai configurato
// Firebase, questo file non fa nulla e la app resta 100% locale.
//
// Modello dati: collezione "camps", documento con id = codice campo (es.
// "Bandone"), contenente { data: <stato JSON>, updatedBy, updatedAt }.
// Strategia: lo stato viaggia insieme alla data di ultima modifica di ogni
// singola voce (campo _meta). Chi riceve FONDE le due versioni voce per voce
// (vedi sync-merge.js), cosi' due telefoni che hanno lavorato offline non si
// cancellano il lavoro a vicenda. Guardia anti-loop tramite deviceId.
// ============================================================================
(function () {
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';

  let fb = null;              // moduli Firebase caricati
  let app, db, auth, unsub;   // handle Firebase
  let receiptsUnsub = null;   // listener sotto-collezione scontrini
  let weatherUnsub = null;    // listener meteo condiviso
  let onRemote = null;        // callback quando arrivano dati remoti
  let onReceiptsCb = null;    // callback quando arrivano foto scontrini
  let onWeatherCb = null;     // callback quando arriva il meteo condiviso
  let onStatusCb = null;      // callback di stato per la UI
  let pushTimer = null;
  let lastAppliedJson = null; // ultimo stato ricevuto/applicato dal cloud
  let lastPushedJson = null;  // ultimo stato inviato al cloud CON SUCCESSO
  let pendingJson = null;     // stato in attesa di essere scritto (o ritentato)
  let tentativi = 0;          // invii falliti di fila: allunga l'attesa
  let authMode = 'anon';      // anon | shared | anon-fallback | anon-nopass

  let deviceId = localStorage.getItem('cambusa_device_id');
  if (!deviceId) {
    deviceId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('cambusa_device_id', deviceId);
  }

  const state = { connected: false, code: null, status: 'idle', lastSync: null, error: null, authMode: 'anon', empty: false, pending: false };
  const emit = (patch) => {
    Object.assign(state, patch || {});
    state.pending = !!pendingJson;   // c'è qualcosa che non è ancora arrivato
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

  // Accesso al database. Se in firebase-config.js e' configurato un utente
  // condiviso (APP_LOCK.dbEmail), l'app entra con quello usando la password
  // digitata nella schermata di blocco: la password non e' nel codice e non
  // viene salvata, quindi senza di essa i dati non si leggono nemmeno
  // interrogando Firestore direttamente. Se l'utente non esiste ancora (o il
  // metodo Email/Password non e' abilitato) si ricade sull'accesso anonimo,
  // cosi' il passaggio si puo' fare con calma senza rompere niente.
  async function signIn(creds) {
    const lock = (typeof window !== 'undefined' && window.APP_LOCK) || {};
    const email = lock.dbEmail;
    if (!email) { authMode = 'anon'; await fb.signInAnonymously(auth); return; }

    // Sessione gia' aperta su questo dispositivo: niente password da chiedere.
    try {
      if (auth.authStateReady) await auth.authStateReady();
    } catch (e) { /* SDK piu' vecchio: si prosegue */ }
    if (auth.currentUser && !auth.currentUser.isAnonymous) { authMode = 'shared'; return; }

    if (creds && creds.password) {
      try {
        await fb.signInWithEmailAndPassword(auth, email, creds.password);
        authMode = 'shared';
        return;
      } catch (e) {
        const code = (e && e.code) || '';
        // Utente non ancora creato o metodo non abilitato: si continua come prima.
        if (/user-not-found|operation-not-allowed|invalid-credential|wrong-password|invalid-email/.test(code)) {
          authMode = 'anon-fallback';
          await fb.signInAnonymously(auth);
          return;
        }
        throw e;
      }
    }

    // Nessuna password a disposizione (app sbloccata in una sessione
    // precedente): si prova comunque, ma lo stato lo segnala alla UI.
    authMode = 'anon-nopass';
    await fb.signInAnonymously(auth);
  }

  async function connect(config, code, remoteCb, creds) {
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
      await signIn(creds);
      emit({ authMode });

      const ref = fb.doc(db, 'camps', code);
      if (unsub) unsub();
      unsub = fb.onSnapshot(
        ref,
        (snap) => {
          // "vuoto" = nel cloud non c'è ancora niente per questo campo: chi ha
          // dei dati in locale deve pubblicarli, altrimenti restano fermi lì
          // finché qualcuno non tocca qualcosa.
          emit({ connected: true, code, status: 'connected', empty: !snap.exists() });
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

      watchWeather(code);

      localStorage.setItem('cambusa_camp_code', code);
      emit({ connected: true, code, status: 'connected', error: null });
    } catch (e) {
      // Anche quando l'accesso fallisce va detto COME si e' provato a entrare:
      // senza, un telefono che resta fuori (es. accesso anonimo disattivato in
      // console) mostrerebbe solo un errore, invece di farsi chiedere la
      // password dall'app.
      emit({ status: 'error', error: e.message || String(e), connected: false, authMode });
      throw e;
    }
  }

  // Limite di Firestore: 1 MiB per documento. Sopra i 900 KB si avvisa, perche'
  // oltre il limite la scrittura fallisce e la sincronizzazione si ferma senza
  // che nessuno se ne accorga.
  const MAX_DOC = 900 * 1024;

  function pushState(obj, forza) {
    if (!state.connected || !db || !fb) return;
    const json = JSON.stringify(obj);
    // Non reinviare cio' che abbiamo appena ricevuto o gia' inviato. Se pero'
    // l'ultimo invio e' FALLITO (pendingJson pieno) si riprova comunque.
    if (!forza && !pendingJson && (json === lastAppliedJson || json === lastPushedJson)) return;
    pendingJson = json;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { inviaOra(); }, 1500);
  }

  // Invio vero e proprio. "lastPushedJson" si aggiorna SOLO a scrittura
  // riuscita: segnarlo prima significava che una scrittura fallita (regole,
  // quota, documento troppo grande) non veniva piu' ritentata, e i dati di quel
  // telefono restavano solo li' senza che niente lo dicesse.
  async function inviaOra() {
    if (!pendingJson || !state.connected || !db || !fb) return;
    const json = pendingJson;
    try {
      emit({ status: 'saving' });
      if (json.length > MAX_DOC) {
        emit({ status: 'error', error: 'Dati troppo grandi per il cloud (' + Math.round(json.length / 1024) + ' KB): fai un backup e chiudi il campo.' });
        return;
      }
      const ref = fb.doc(db, 'camps', state.code);
      await fb.setDoc(ref, { data: json, updatedBy: deviceId, updatedAt: fb.serverTimestamp() });
      // Riuscita: solo ora si puo' dire "questo l'ho gia' mandato".
      lastPushedJson = json;
      if (pendingJson === json) pendingJson = null;
      tentativi = 0;
      emit({ status: 'connected', lastSync: Date.now(), error: null });
      maybeDailySnapshot(json);
    } catch (e) {
      // Resta in sospeso e si riprova, con attese crescenti.
      tentativi++;
      emit({ status: 'error', error: e.message || String(e) });
      const attesa = Math.min(60000, 2000 * Math.pow(2, Math.min(tentativi, 5)));
      clearTimeout(pushTimer);
      pushTimer = setTimeout(function () { inviaOra(); }, attesa);
    }
  }

  // Ritenta subito ciò che è rimasto in sospeso (al ritorno della linea, o
  // quando la app fa il suo controllo periodico).
  function riprova() {
    if (!pendingJson) return false;
    clearTimeout(pushTimer);
    inviaOra();
    return true;
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

  // --- Meteo condiviso ---
  // camps/<code>/meta/weather: una sola copia delle previsioni per tutto il
  // campo, così tutti vedono gli stessi numeri invece di quelli scaricati dal
  // proprio telefono in momenti diversi. Chi ha linea la aggiorna, gli altri
  // la ricevono (anche chi è offline se la riceve prima di perdere la rete).
  async function putWeather(obj) {
    if (!state.connected || !db || !fb) return;
    try {
      await fb.setDoc(fb.doc(db, 'camps', state.code, 'meta', 'weather'), {
        data: JSON.stringify(obj), updatedBy: deviceId, updatedAt: fb.serverTimestamp(),
      });
    } catch (e) { /* offline o regole: riprovera' al prossimo aggiornamento */ }
  }

  function watchWeather(code) {
    if (weatherUnsub) weatherUnsub();
    weatherUnsub = fb.onSnapshot(
      fb.doc(db, 'camps', code, 'meta', 'weather'),
      (snap) => {
        if (!snap.exists() || !onWeatherCb) return;
        const v = snap.data();
        if (!v || typeof v.data !== 'string') return;
        try { onWeatherCb(JSON.parse(v.data)); } catch (e) { /* dati non validi */ }
      },
      () => { /* regole non aggiornate: il resto continua */ }
    );
  }

  // --- Archivio dei campi chiusi ---
  // camps/<code>/archives/<id> = { meta: <riepilogo JSON>, data: <stato JSON> }.
  // Il riepilogo e' piccolo e serve per l'elenco; lo stato completo si scarica
  // solo quando serve. Le foto NON entrano qui (restano nel file scaricato).
  async function putArchive(id, meta, data) {
    if (!state.connected || !db || !fb) return false;
    try {
      await fb.setDoc(fb.doc(db, 'camps', state.code, 'archives', id), {
        meta: JSON.stringify(meta),
        data: JSON.stringify(data),
        savedBy: deviceId,
        savedAt: fb.serverTimestamp(),
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async function listArchives() {
    if (!state.connected || !db || !fb) return [];
    try {
      const snap = await fb.getDocs(fb.collection(db, 'camps', state.code, 'archives'));
      const out = [];
      snap.forEach((d) => {
        const v = d.data();
        if (!v || typeof v.meta !== 'string') return;
        try { out.push(Object.assign(JSON.parse(v.meta), { id: d.id })); } catch (e) { /* ignora */ }
      });
      return out.sort((a, b) => String(b.closedAt || '').localeCompare(String(a.closedAt || '')));
    } catch (e) {
      return [];
    }
  }

  async function getArchive(id) {
    if (!state.connected || !db || !fb) return null;
    try {
      const s = await fb.getDoc(fb.doc(db, 'camps', state.code, 'archives', id));
      return s.exists() ? JSON.parse(s.data().data) : null;
    } catch (e) {
      return null;
    }
  }

  async function deleteArchive(id) {
    if (!state.connected || !db || !fb) return;
    try {
      await fb.deleteDoc(fb.doc(db, 'camps', state.code, 'archives', id));
    } catch (e) { /* ignora */ }
  }

  // --- Galleria del campo ---
  // Due documenti per foto, di proposito:
  //   camps/<code>/photos/<id>    = { thumb, by, at }   miniatura, ~15 KB
  //   camps/<code>/photofull/<id> = { data }            foto intera, ~200 KB
  // La griglia ascolta SOLO le miniature (100 foto = ~1,5 MB invece di 20 MB);
  // la foto intera si scarica quando la si apre. Senza questa separazione la
  // galleria sarebbe inguardabile da telefono.
  //
  // Le foto NON stanno in localStorage e NON entrano nella fusione degli
  // stati: vivono solo nel cloud. Si caricano a casa, con la linea; al campo
  // non servono.
  async function putPhoto(id, thumb, full, by) {
    if (!state.connected || !db || !fb) return false;
    try {
      // Prima la foto intera: se fallisce, non resta una miniatura orfana.
      await fb.setDoc(fb.doc(db, 'camps', state.code, 'photofull', id), { data: full });
      await fb.setDoc(fb.doc(db, 'camps', state.code, 'photos', id), {
        thumb, by: String(by || '').slice(0, 40), at: Date.now(), updatedBy: deviceId,
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Ascolta le miniature del campo IN CORSO. Restituisce la funzione per
  // smettere: la galleria si mette in ascolto quando la apri e smette quando
  // la lasci. Le foto dei campi chiusi portano il timbro "archive" e restano
  // fuori: si vedono solo dall'Archivio.
  function watchPhotos(cb) {
    if (!state.connected || !db || !fb) return () => {};
    try {
      return fb.onSnapshot(
        fb.collection(db, 'camps', state.code, 'photos'),
        (snap) => {
          const out = [];
          snap.forEach((d) => {
            const v = d.data();
            if (v && typeof v.thumb === 'string' && !v.archive) {
              out.push({ id: d.id, thumb: v.thumb, by: v.by || '', at: v.at || 0 });
            }
          });
          out.sort((a, b) => b.at - a.at);
          cb(out);
        },
        () => { /* regole non aggiornate: il resto dell'app continua */ }
      );
    } catch (e) {
      return () => {};
    }
  }

  // Chiusura del campo: le foto non si cancellano, si timbrano. Restano
  // consultabili dall'Archivio e la galleria del campo nuovo riparte vuota.
  // Un timbro per foto e' molto meno lavoro che spostare 100 documenti.
  async function archivePhotos(archiveId) {
    if (!state.connected || !db || !fb) return 0;
    try {
      const snap = await fb.getDocs(fb.collection(db, 'camps', state.code, 'photos'));
      const da = [];
      snap.forEach((d) => { if (!d.data().archive) da.push(d.id); });
      for (const id of da) {
        await fb.setDoc(fb.doc(db, 'camps', state.code, 'photos', id), { archive: archiveId }, { merge: true });
      }
      return da.length;
    } catch (e) {
      return 0;
    }
  }

  // Miniature di un campo chiuso (una lettura sola, niente ascolto continuo).
  async function listPhotos(archiveId) {
    if (!state.connected || !db || !fb) return [];
    try {
      const snap = await fb.getDocs(fb.collection(db, 'camps', state.code, 'photos'));
      const out = [];
      snap.forEach((d) => {
        const v = d.data();
        if (v && typeof v.thumb === 'string' && v.archive === archiveId) {
          out.push({ id: d.id, thumb: v.thumb, by: v.by || '', at: v.at || 0 });
        }
      });
      return out.sort((a, b) => b.at - a.at);
    } catch (e) {
      return [];
    }
  }

  async function getPhotoFull(id) {
    if (!state.connected || !db || !fb) return null;
    try {
      const s = await fb.getDoc(fb.doc(db, 'camps', state.code, 'photofull', id));
      return s.exists() ? s.data().data : null;
    } catch (e) {
      return null;
    }
  }

  async function deletePhoto(id) {
    if (!state.connected || !db || !fb) return false;
    try {
      await fb.deleteDoc(fb.doc(db, 'camps', state.code, 'photos', id));
      await fb.deleteDoc(fb.doc(db, 'camps', state.code, 'photofull', id));
      return true;
    } catch (e) {
      return false;
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
    if (weatherUnsub) { weatherUnsub(); weatherUnsub = null; }
    clearTimeout(pushTimer);
    localStorage.removeItem('cambusa_camp_code');
    lastAppliedJson = null;
    lastPushedJson = null;
    pendingJson = null;
    tentativi = 0;
    emit({ connected: false, code: null, status: 'idle', error: null });
  }

  window.CloudSync = {
    connect,
    pushState,
    riprova,
    inSospeso: () => !!pendingJson,
    putReceipt,
    deleteReceipt,
    putPhoto,
    watchPhotos,
    listPhotos,
    archivePhotos,
    getPhotoFull,
    deletePhoto,
    listSnapshots,
    getSnapshot,
    putWeather,
    putArchive,
    listArchives,
    getArchive,
    deleteArchive,
    submitScore,
    listScores,
    disconnect,
    onStatus: (cb) => { onStatusCb = cb; cb({ ...state }); },
    onReceipts: (cb) => { onReceiptsCb = cb; },
    onWeather: (cb) => { onWeatherCb = cb; },
    isConnected: () => state.connected,
    authMode: () => authMode,
    needsPassword: () => {
      const lock = (typeof window !== 'undefined' && window.APP_LOCK) || {};
      return !!lock.dbEmail && authMode === 'anon-nopass';
    },
    savedCode: () => localStorage.getItem('cambusa_camp_code'),
    isConfigured: () => {
      const c = window.FIREBASE_CONFIG;
      return !!(c && c.apiKey && c.apiKey !== 'INCOLLA_QUI' && c.projectId && c.projectId !== 'INCOLLA_QUI');
    },
  };
})();
