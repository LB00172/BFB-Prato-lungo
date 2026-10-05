// Ogni campo ha il suo cassetto.
//
// Sul telefono i dati del campo — membri, presenze, spese, la cronologia della
// sincronizzazione — stavano in un posto solo, senza scritto a quale campo
// appartenessero. Finche' il campo era uno non importava. Con le stanze no:
// entrando in un secondo campo l'app si collegava al codice nuovo e FONDEVA
// quello che aveva in memoria con quello che arrivava, poi rimandava su il
// risultato. I membri e le spese di A finivano in B, per tutti quelli di B;
// una stanza appena creata, vuota, si prendeva l'intero campo di prima; e le
// foto degli scontrini di A venivano caricate nella stanza di B. La fusione
// voce per voce fa esattamente il suo mestiere: e' che le si davano da fondere
// due campi diversi.
//
// La cura non cambia il posto in cui l'app legge e scrive: cambia COSA c'e'
// in quel posto. Le chiavi restano quelle di sempre e contengono i dati del
// campo in gioco; quelli degli altri campi stanno messi da parte, ognuno
// sotto il suo codice. Passare da un campo all'altro e' uno scambio di
// cassetti, e si fa con l'app SMONTATA (src/90-avvio.jsx): cosi' nessun
// effetto rimasto acceso puo' scrivere i dati di A nel cassetto di B mentre
// lo si sta aprendo.
//
// Sta fuori da src/ per lo stesso motivo di conti.js: le regole si provano
// senza browser (test/unita/cassetti.js), su un magazzino finto che sa anche
// riempirsi.
(function (root) {
  'use strict';

  // ---- Quali chiavi sono del campo e quali del telefono -------------------
  // L'elenco e' scritto a mano, ed e' il punto debole: una chiave nuova che
  // nessuno aggiunge resterebbe condivisa fra tutti i campi, cioe' il
  // difetto di prima in piccolo. Per questo c'e' anche l'elenco opposto, e una
  // prova (unita/cassetti) cerca ogni 'cambusa_…' scritto nei sorgenti e
  // pretende che stia in uno dei due. Chi aggiunge una chiave deve decidere
  // di chi e'.
  var DEL_CAMPO = [
    'cambusa_members', 'cambusa_camp_data', 'cambusa_purchases',
    'cambusa_global_expenses', 'cambusa_settled', 'cambusa_saldi_ottimizzati',
    'cambusa_gear', 'cambusa_equipment', 'cambusa_tobuy', 'cambusa_sepdays',
    'cambusa_freedays', 'cambusa_blocchi', 'cambusa_compiti', 'cambusa_incassi', 'cambusa_mia_lista',
    'cambusa_archives', 'cambusa_weather',
    // La cronologia della fusione: portarla in un altro campo vorrebbe dire
    // date e lapidi di voci che li' non sono mai esistite.
    'cambusa_syncmeta', 'cambusa_rescue', 'cambusa_orologio',
    'cambusa_snap_locali', 'cambusa_snap_date', 'cambusa_backup_data',
    'cambusa_registro', 'cambusa_exmembri',
    // Chi ha pagato l'ultima spesa registrata da questo telefono: nel foglio
    // della spesa si parte da lui. I nomi sono del campo.
    'cambusa_acquirente',
    // L'invito e' partito da qui (i primi passi di un campo nuovo).
    'cambusa_invito_mandato',
    // Le foto della vecchia strada (e del ripiego, quando IndexedDB manca).
    'cambusa_receipts',
  ];
  var DEL_TELEFONO = [
    // I gruppi del menu aperti: un'abitudine di chi tiene il telefono.
    'cambusa_menu_gruppi',
    // Dove si e': sono le chiavi che DECIDONO il cassetto, non ci stanno dentro.
    'cambusa_stanza', 'cambusa_camp_code', 'cambusa_sync_optout',
    // Quali campi ha questa persona: serve a scegliere il cassetto.
    'cambusa_campi',
    // L'account sviluppatore e' della persona (del suo uid), non del campo.
    'cambusa_sviluppatore',
    'cambusa_device_id', 'cambusa_theme', 'cambusa_lingua', 'cambusa_photo_cap',
    'cambusa_unlock', 'cambusa_admin', 'cambusa_lock_always', 'cambusa_lock_fail',
    'cambusa_lock_until', 'cambusa_install_hint_off',
    // Il gioco e' della persona che tiene il telefono, non del campo.
    'cambusa_player', 'cambusa_best',
  ];

  // Di chi sono i dati che stanno adesso nelle chiavi di sempre.
  var PROPRIETARIO = 'cambusa_cassetto_di';
  // Di chi sono le foto che stanno adesso nel magazzino (IndexedDB). E' una
  // chiave separata perche' le foto si spostano DOPO, in modo asincrono: fra
  // i due momenti possono non essere dello stesso campo, e va saputo.
  var FOTO_DI = 'cambusa_cassetto_foto';
  var PREFISSO = 'cambusa_cassetto:';

  function riposta(codice, chiave) { return PREFISSO + codice + ':' + chiave; }

  // ---- Il codice in gioco --------------------------------------------------
  // Lo stesso ordine di App(): la stanza, poi il codice salvato, poi quello
  // predefinito. Il codice salvato si chiede a CloudSync se c'e', perche' e'
  // lui a tenerlo (e le prove lo sostituiscono).
  function codiceInGioco(magazzino, cloud, predefinito) {
    var stanza = leggi(magazzino, 'cambusa_stanza');
    if (stanza) return stanza;
    var salvato = null;
    try { salvato = cloud && cloud.savedCode ? cloud.savedCode() : leggi(magazzino, 'cambusa_camp_code'); }
    catch (e) { salvato = null; }
    return salvato || predefinito || '';
  }

  function leggi(magazzino, chiave) {
    try { return magazzino.getItem(chiave); } catch (e) { return null; }
  }

  // ---- Lo scambio ----------------------------------------------------------
  // Si SPOSTA, non si copia: una chiave alla volta, cosi' lo spazio in piu'
  // che serve e' quello della chiave piu' grande, non di tutto il campo. Se
  // il magazzino si riempie a meta', si rimette tutto com'era e lo si dice:
  // meglio restare nel campo di prima che aprire quello nuovo con dentro
  // mezzo campo vecchio.
  function scambia(magazzino, da, a) {
    var mosse = [];
    var annulla = function () {
      for (var i = mosse.length - 1; i >= 0; i--) {
        var m = mosse[i];
        try {
          if (m.valore === null) magazzino.removeItem(m.chiave);
          else magazzino.setItem(m.chiave, m.valore);
        } catch (e) { /* si fa il possibile: il valore era gia' li' un attimo fa */ }
      }
    };
    var scrivi = function (chiave, valore) {
      var prima = leggi(magazzino, chiave);
      if (valore === null) magazzino.removeItem(chiave);
      else magazzino.setItem(chiave, valore);
      mosse.push({ chiave: chiave, valore: prima });
    };
    try {
      // 1) Si mette da parte il campo che se ne va.
      DEL_CAMPO.forEach(function (k) {
        var v = leggi(magazzino, k);
        if (v === null) return;
        scrivi(riposta(da, k), v);
        scrivi(k, null);
      });
      // 2) Si tira fuori quello che arriva (se non c'e', si parte vuoti).
      DEL_CAMPO.forEach(function (k) {
        var v = leggi(magazzino, riposta(a, k));
        if (v === null) return;
        scrivi(k, v);
        scrivi(riposta(a, k), null);
      });
      scrivi(PROPRIETARIO, a);
      return { esito: 'fatto', da: da, a: a };
    } catch (e) {
      annulla();
      return { esito: 'pieno', da: da, a: a };
    }
  }

  // Tre casi, e solo uno sposta qualcosa:
  //   - nessun proprietario scritto: e' un telefono che c'era gia' prima dei
  //     cassetti, e i dati che ha sono del campo in cui era. Si ADOTTANO,
  //     non si spostano — spostarli li farebbe sparire a chi li aveva;
  //   - stesso campo: niente;
  //   - campo diverso: scambio.
  function allinea(magazzino, codice) {
    var di = leggi(magazzino, PROPRIETARIO);
    if (di === null) {
      try { magazzino.setItem(PROPRIETARIO, codice); } catch (e) { /* si riprova al prossimo giro */ }
      return { esito: 'adottato', a: codice };
    }
    if (di === codice) return { esito: 'uguale', a: codice };
    return scambia(magazzino, di, codice);
  }

  // Di chi sono i dati nelle chiavi di sempre, adesso. Senza proprietario
  // scritto (spazio pieno al primo avvio) valgono per il campo in gioco: e'
  // l'adozione, e non si deve scambiare niente.
  function di(magazzino, inGioco) {
    var v = leggi(magazzino, PROPRIETARIO);
    return v === null ? inGioco : v;
  }

  // ---- Le foto ---------------------------------------------------------------
  // Stanno nel magazzino delle foto (magazzino-foto.js), che e' uno solo e
  // non si tocca: deve restare identico a quello della versione privata. Le
  // foto degli altri campi stanno messe da parte in un database a se',
  // `cambusa-cassetti`, un record per campo.
  //
  // L'ordine e' quello di sempre (magazzino-foto.js, migra): prima si mette
  // da parte e si RILEGGE, e solo se torna tutto si svuota il magazzino. Il
  // record si UNISCE a quello che c'era invece di sovrascriverlo: se l'app si
  // chiude a meta' e lo scambio riparte, sovrascrivere metterebbe le foto
  // del campo nuovo al posto di quelle del vecchio.
  var DB_RIPOSTE = 'cambusa-cassetti';
  var NEGOZIO = 'foto';

  function apriRiposte() {
    return new Promise(function (risolvi) {
      var idb = root.indexedDB;
      if (!idb) { risolvi(null); return; }
      var req;
      try { req = idb.open(DB_RIPOSTE, 1); } catch (e) { risolvi(null); return; }
      var scaduta = setTimeout(function () { risolvi(null); }, 4000);
      req.onupgradeneeded = function () {
        try { req.result.createObjectStore(NEGOZIO); } catch (e) { /* c'e' gia' */ }
      };
      req.onsuccess = function () { clearTimeout(scaduta); risolvi(req.result); };
      req.onerror = function () { clearTimeout(scaduta); risolvi(null); };
      req.onblocked = function () { clearTimeout(scaduta); risolvi(null); };
    });
  }

  function richiesta(db, modo, fai) {
    return new Promise(function (risolvi, rifiuta) {
      var r;
      try { r = fai(db.transaction(NEGOZIO, modo).objectStore(NEGOZIO)); }
      catch (e) { rifiuta(e); return; }
      r.onsuccess = function () { risolvi(r.result); };
      r.onerror = function () { rifiuta(r.error || new Error('IndexedDB')); };
    });
  }

  // Il magazzino delle foto e' del campo `a`? Se no, lo diventa. Ritorna
  // quando le foto giuste sono al loro posto: chi carica le foto nell'app
  // deve aspettare questo, o caricherebbe quelle del campo di prima.
  function allineaFoto(magazzino, MF, a) {
    var foto = leggi(magazzino, FOTO_DI);
    var fissa = function () { try { magazzino.setItem(FOTO_DI, a); } catch (e) { /* al prossimo giro */ } };
    if (foto === null) { fissa(); return Promise.resolve({ esito: 'adottato' }); }
    if (foto === a) return Promise.resolve({ esito: 'uguale' });
    if (!MF) return Promise.resolve({ esito: 'senza-magazzino' });
    var db = null;
    return apriRiposte().then(function (d) {
      db = d;
      return MF.leggiTutte();
    }).then(function (attuali) {
      // Senza IndexedDB le foto stanno nella vecchia chiave, che e' del campo
      // ed e' gia' stata scambiata con le altre.
      if (!db || !MF.disponibile()) { fissa(); return { esito: 'ripiego' }; }
      return richiesta(db, 'readonly', function (n) { return n.get(foto); }).then(function (vecchie) {
        var unite = Object.assign({}, vecchie || {}, attuali || {});
        return richiesta(db, 'readwrite', function (n) { return n.put(unite, foto); })
          .then(function () { return richiesta(db, 'readonly', function (n) { return n.get(foto); }); })
          .then(function (rilette) {
            if (!MF.migrazioneRiuscita(attuali, rilette)) return { esito: 'non-riuscito' };
            return richiesta(db, 'readonly', function (n) { return n.get(a); }).then(function (nuove) {
              return MF.applica(attuali, nuove || {}).then(function (r) {
                if (!r.salvato) return { esito: 'non-riuscito' };
                fissa();
                return richiesta(db, 'readwrite', function (n) { return n.delete(a); })
                  .then(function () { return { esito: 'fatto' }; });
              });
            });
          });
      });
    }).catch(function () { return { esito: 'non-riuscito' }; })
      .then(function (r) { if (db) { try { db.close(); } catch (e) { /* niente */ } } return r; });
  }

  // Svuotare il telefono vuol dire anche i cassetti degli altri campi.
  function svuotaFoto() {
    return apriRiposte().then(function (db) {
      if (!db) return false;
      return richiesta(db, 'readwrite', function (n) { return n.clear(); })
        .then(function () { db.close(); return true; });
    }).catch(function () { return false; });
  }

  root.Cassetti = {
    DEL_CAMPO: DEL_CAMPO,
    DEL_TELEFONO: DEL_TELEFONO,
    PROPRIETARIO: PROPRIETARIO,
    FOTO_DI: FOTO_DI,
    PREFISSO: PREFISSO,
    riposta: riposta,
    codiceInGioco: codiceInGioco,
    scambia: scambia,
    allinea: allinea,
    di: di,
    allineaFoto: allineaFoto,
    svuotaFoto: svuotaFoto,
  };
})(typeof window !== 'undefined' ? window : globalThis);
