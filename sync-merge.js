// ============================================================================
//  FUSIONE DEGLI STATI — serve quando due telefoni lavorano offline
// ============================================================================
// Problema: al campo non c'è linea. Se due dispositivi modificano i dati
// offline e poi tornano online, con la vecchia regola "vince l'ultimo che
// scrive" il secondo cancellava il lavoro del primo.
//
// Soluzione: ogni voce (membro, acquisto, voce di lista, attrezzatura,
// dotazione, pasto di un giorno, rimborso saldato) viene marcata con l'istante
// della sua ultima modifica ("rev") e, se cancellata, con l'istante della
// cancellazione ("del", una lapide). Quando arriva lo stato dell'altro
// telefono le due versioni si FONDONO voce per voce:
//   - voce presente solo da una parte  -> si tiene
//   - voce presente da entrambe        -> vince quella modificata più tardi
//   - voce cancellata                  -> sparisce solo se la cancellazione è
//                                         successiva all'ultima modifica nota
//
// Il risultato è identico su tutti i dispositivi (le regole non dipendono da
// "chi sta facendo il calcolo"), quindi la sincronizzazione converge.
//
// Espone window.SyncMerge. Nessuna dipendenza: funziona anche in Node (test).
// ============================================================================
(function (root) {
  'use strict';

  // Elenchi sincronizzati: prefisso del percorso -> campo dello stato.
  var LISTS = [
    ['m', 'members'],
    ['p', 'purchases'],
    ['t', 'toBuy'],
    ['e', 'equipment'],
    ['g', 'gear'],
  ];

  // Insiemi di chiavi (niente id: la chiave e' il valore stesso).
  var SETS = [
    ['s', 'settled'],   // rimborsi segnati come saldati
    ['x', 'sepDays'],   // giorni assegnati al conto separato
  ];

  // Le lapidi si tengono 90 giorni: oltre, la voce è cancellata ovunque da un
  // pezzo e la lapide diventa solo peso morto.
  var TOMB_TTL = 90 * 24 * 60 * 60 * 1000;

  // ---- Orologio: il punto fragile di tutto il meccanismo -------------------
  // Le date vengono dall'orologio di ogni telefono. Due difetti da chiudere:
  //
  // 1) un telefono INDIETRO marcherebbe le sue modifiche con date vecchie e
  //    perderebbe sempre, anche quando ha ragione. Rimedio: ogni dispositivo
  //    tiene "hi", la data più alta che ha mai visto (sua o altrui), e non
  //    marca mai una modifica con una data inferiore. Così una modifica fatta
  //    DOPO aver visto qualcosa batte sempre quel qualcosa: l'ordine segue le
  //    cause, non l'ora del telefono.
  // 2) un telefono AVANTI (data sbagliata di mesi) trascinerebbe in avanti
  //    l'orologio di tutti gli altri, che adotterebbero la sua data. Rimedio:
  //    non si adottano date oltre una settimana nel futuro.
  //
  // NOTA IMPORTANTE: il freno vale solo per l'orologio che ogni dispositivo si
  // porta dietro, MAI per il confronto fra due voci. Il confronto deve
  // dipendere solo dai dati, altrimenti due telefoni con "adesso" diverso
  // deciderebbero in modo diverso e la sincronizzazione non convergerebbe più:
  // si rimbalzerebbero le versioni all'infinito. Meglio un telefono con l'ora
  // sbagliata che vince un confronto, che due telefoni che non si accordano.
  var MAX_AVANTI = 7 * 24 * 60 * 60 * 1000;

  function altezza(meta) { return (meta && meta.hi) || 0; }

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  // ---- Appiattimento: stato -> mappa "percorso" -> valore serializzato ----
  // Il percorso identifica la singola voce; il confronto fra due appiattimenti
  // dice esattamente cosa è cambiato, indipendentemente dall'ordine.
  function flatten(st) {
    var f = {};
    st = st || {};
    LISTS.forEach(function (pair) {
      arr(st[pair[1]]).forEach(function (it) {
        if (it && it.id != null) f[pair[0] + '|' + it.id] = JSON.stringify(it);
      });
    });
    SETS.forEach(function (pair) {
      arr(st[pair[1]]).forEach(function (k) { f[pair[0] + '|' + k] = '1'; });
    });
    if (isObj(st.campData)) {
      Object.keys(st.campData).forEach(function (date) {
        var day = st.campData[date];
        if (!isObj(day)) return;
        Object.keys(day).forEach(function (field) {
          if (field === 'meals') {
            var meals = day.meals;
            if (!isObj(meals)) return;
            Object.keys(meals).forEach(function (mid) {
              f['c|' + date + '|meals|' + mid] = JSON.stringify(meals[mid]);
            });
          } else {
            f['c|' + date + '|f|' + field] = JSON.stringify(day[field]);
          }
        });
      });
    }
    return f;
  }

  // ---- Datazione delle modifiche ----
  // Confronta lo stato attuale con l'ultimo conosciuto e marca con "adesso"
  // ciò che è nato o cambiato, e con una lapide ciò che è sparito.
  function bump(state, prev, now) {
    prev = prev || emptyMeta();
    var flat = flatten(state);
    var rev = {}, del = {};
    var p;
    for (p in prev.rev) if (has(prev.rev, p)) rev[p] = prev.rev[p];
    for (p in prev.del) if (has(prev.del, p)) del[p] = prev.del[p];

    // Data della modifica: mai inferiore a ciò che questo dispositivo ha già
    // visto. Con l'orologio a posto è semplicemente "adesso".
    var data = Math.max(now, altezza(prev) + 1);
    var cambiato = false;

    for (p in flat) {
      if (!has(flat, p)) continue;
      if (prev.flat[p] !== flat[p]) { rev[p] = data; delete del[p]; cambiato = true; }
    }
    for (p in prev.flat) {
      if (!has(prev.flat, p)) continue;
      if (!has(flat, p)) { del[p] = data; delete rev[p]; cambiato = true; }
    }
    // Le voci mai toccate da questo dispositivo restano senza data (0):
    // qualsiasi modifica altrui, essendo datata, avrà la precedenza.
    var cutoff = now - TOMB_TTL;
    for (p in del) if (has(del, p) && del[p] < cutoff) delete del[p];

    return {
      flat: flat, rev: rev, del: del,
      hi: cambiato ? Math.max(altezza(prev), data) : altezza(prev),
    };
  }

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function emptyMeta() { return { flat: {}, rev: {}, del: {}, hi: 0 }; }

  // Scelta fra la versione locale e quella remota di una singola voce.
  // Deterministica: entrambi i dispositivi arrivano allo stesso risultato.
  function pick(hasL, l, lr, hasR, r, rr, d) {
    var val, vr;
    if (hasL && hasR) {
      if (lr > rr) { val = l; vr = lr; }
      else if (rr > lr) { val = r; vr = rr; }
      else {
        // Stesso istante e valori diversi (raro): si sceglie in modo fisso,
        // uguale sui due telefoni, altrimenti continuerebbero a rimbalzarsi.
        vr = lr;
        val = JSON.stringify(r) < JSON.stringify(l) ? r : l;
      }
    } else if (hasL) { val = l; vr = lr; }
    else { val = r; vr = rr; }
    if (d > vr) return null;          // cancellata dopo l'ultima modifica nota
    return { val: val, rev: vr };
  }

  function maxDel(path, lmeta, rmeta) {
    var a = (lmeta.del && lmeta.del[path]) || 0;
    var b = (rmeta.del && rmeta.del[path]) || 0;
    return a > b ? a : b;
  }

  function revOf(meta, path) { return (meta.rev && meta.rev[path]) || 0; }

  // ---- Fusione vera e propria ----
  // local/remote: { members, campData, purchases, gear, settled, equipment, toBuy }
  // lmeta/rmeta:  { rev, del }
  // Restituisce { state, meta } con meta.flat già allineato allo stato fuso.
  function merge(local, lmeta, remote, rmeta, now) {
    local = local || {};
    remote = remote || {};
    lmeta = lmeta || emptyMeta();
    rmeta = rmeta || emptyMeta();
    // Nuova altezza dell'orologio logico: la data più alta vista da una delle
    // due parti. Le date assurdamente nel futuro non si adottano — servirebbero
    // solo a spostare in avanti anche il nostro orologio.
    var hi = altezza(lmeta);
    var limite = Math.max(now || Date.now(), hi) + MAX_AVANTI;
    [lmeta.rev, lmeta.del, rmeta.rev, rmeta.del].forEach(function (m) {
      if (!m) return;
      Object.keys(m).forEach(function (k) {
        var v = m[k];
        if (typeof v === 'number' && v <= limite && v > hi) hi = v;
      });
    });

    var rev = {}, del = {};
    // Le lapidi si conservano (unione), servono a non far "resuscitare" le
    // voci cancellate quando l'altro telefono ripropone il suo vecchio stato.
    [lmeta.del, rmeta.del].forEach(function (m) {
      if (!m) return;
      Object.keys(m).forEach(function (p) { if (!del[p] || m[p] > del[p]) del[p] = m[p]; });
    });

    var state = {};

    LISTS.forEach(function (pair) {
      var prefix = pair[0], key = pair[1];
      var byId = new Map();
      arr(local[key]).forEach(function (it) {
        if (it && it.id != null) byId.set(String(it.id), { l: it });
      });
      arr(remote[key]).forEach(function (it) {
        if (!it || it.id == null) return;
        var k = String(it.id);
        var e = byId.get(k) || {};
        e.r = it;
        byId.set(k, e);
      });
      var out = [];
      byId.forEach(function (e, id) {
        var path = prefix + '|' + id;
        var res = pick(!!e.l, e.l, revOf(lmeta, path), !!e.r, e.r, revOf(rmeta, path), maxDel(path, lmeta, rmeta));
        if (!res) return;
        out.push(res.val);
        // Le voci mai datate da nessuno non finiscono nella cronologia: uno
        // zero occupa spazio, viaggia a ogni sincronizzazione e — non essendo
        // presente nella mappa di chi ce l'ha mandata — fa sembrare diverso
        // uno stato identico, costringendo a rimandarlo indietro ogni volta.
        if (res.rev) rev[path] = res.rev;
        delete del[path];
      });
      state[key] = out;
    });

    // Insiemi di chiavi (rimborsi saldati, giorni del conto separato): stessa
    // logica, dove la voce e' la chiave stessa.
    SETS.forEach(function (pair) {
      var prefix = pair[0], key = pair[1];
      var keys = new Map();
      arr(local[key]).forEach(function (k) { keys.set(String(k), { l: true }); });
      arr(remote[key]).forEach(function (k) {
        var e = keys.get(String(k)) || {};
        e.r = true;
        keys.set(String(k), e);
      });
      var out = [];
      keys.forEach(function (e, k) {
        var path = prefix + '|' + k;
        var res = pick(!!e.l, k, revOf(lmeta, path), !!e.r, k, revOf(rmeta, path), maxDel(path, lmeta, rmeta));
        if (!res) return;
        out.push(k);
        if (res.rev) rev[path] = res.rev;
        delete del[path];
      });
      state[key] = out;
    });

    // Giorni del campo: si fondono presenza per presenza (un membro alla
    // volta) e campo per campo (note, menù…), non giorno intero: così due
    // persone possono segnare presenze diverse dello stesso giorno.
    var lc = isObj(local.campData) ? local.campData : {};
    var rc = isObj(remote.campData) ? remote.campData : {};
    var camp = {};
    var dates = new Set(Object.keys(lc).concat(Object.keys(rc)));
    dates.forEach(function (date) {
      var L = isObj(lc[date]) ? lc[date] : {};
      var R = isObj(rc[date]) ? rc[date] : {};
      var day = {};
      var fields = new Set(Object.keys(L).concat(Object.keys(R)));
      fields.forEach(function (field) {
        if (field === 'meals') return;
        var path = 'c|' + date + '|f|' + field;
        var res = pick(has(L, field), L[field], revOf(lmeta, path), has(R, field), R[field], revOf(rmeta, path), maxDel(path, lmeta, rmeta));
        if (!res) return;
        day[field] = res.val;
        if (res.rev) rev[path] = res.rev;
        delete del[path];
      });
      var ml = isObj(L.meals) ? L.meals : {};
      var mr = isObj(R.meals) ? R.meals : {};
      var ids = new Set(Object.keys(ml).concat(Object.keys(mr)));
      var meals = {};
      ids.forEach(function (mid) {
        var path = 'c|' + date + '|meals|' + mid;
        var res = pick(has(ml, mid), ml[mid], revOf(lmeta, path), has(mr, mid), mr[mid], revOf(rmeta, path), maxDel(path, lmeta, rmeta));
        if (!res) return;
        meals[mid] = res.val;
        if (res.rev) rev[path] = res.rev;
        delete del[path];
      });
      if (Object.keys(meals).length > 0) day.meals = meals;
      // Un giorno rimasto senza niente (es. dopo la chiusura del campo) non
      // viene riproposto: sparisce del tutto.
      if (Object.keys(day).length > 0) camp[date] = day;
    });
    state.campData = camp;

    return { state: state, meta: { flat: flatten(state), rev: rev, del: del, hi: hi } };
  }

  function equalMap(a, b) {
    a = a || {}; b = b || {};
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      if (a[ka[i]] !== b[ka[i]]) return false;
    }
    return true;
  }

  // Vero se lo stato fuso è già identico (voci e date) a quello ricevuto:
  // in quel caso non c'è niente da rimandare indietro.
  function sameAs(mergedMeta, remoteState, remoteMeta) {
    return equalMap(mergedMeta.flat, flatten(remoteState)) &&
      equalMap(mergedMeta.rev, remoteMeta && remoteMeta.rev) &&
      equalMap(mergedMeta.del, remoteMeta && remoteMeta.del);
  }

  root.SyncMerge = {
    VERSION: 2,
    flatten: flatten,
    bump: bump,
    merge: merge,
    emptyMeta: emptyMeta,
    equalMap: equalMap,
    sameAs: sameAs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
