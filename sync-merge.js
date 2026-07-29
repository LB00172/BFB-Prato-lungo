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

  // Le lapidi si tengono 90 giorni: oltre, la voce è cancellata ovunque da un
  // pezzo e la lapide diventa solo peso morto.
  var TOMB_TTL = 90 * 24 * 60 * 60 * 1000;

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
    arr(st.settled).forEach(function (k) { f['s|' + k] = '1'; });
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

    for (p in flat) {
      if (!has(flat, p)) continue;
      if (prev.flat[p] !== flat[p]) { rev[p] = now; delete del[p]; }
    }
    for (p in prev.flat) {
      if (!has(prev.flat, p)) continue;
      if (!has(flat, p)) { del[p] = now; delete rev[p]; }
    }
    // Le voci mai toccate da questo dispositivo restano senza data (0):
    // qualsiasi modifica altrui, essendo datata, avrà la precedenza.
    var cutoff = now - TOMB_TTL;
    for (p in del) if (has(del, p) && del[p] < cutoff) delete del[p];

    return { flat: flat, rev: rev, del: del };
  }

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function emptyMeta() { return { flat: {}, rev: {}, del: {} }; }

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
  function merge(local, lmeta, remote, rmeta) {
    local = local || {};
    remote = remote || {};
    lmeta = lmeta || emptyMeta();
    rmeta = rmeta || emptyMeta();

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
        rev[path] = res.rev;
        delete del[path];
      });
      state[key] = out;
    });

    // Rimborsi saldati: insieme di chiavi, stessa logica (presente/cancellato).
    var settledKeys = new Map();
    arr(local.settled).forEach(function (k) { settledKeys.set(String(k), { l: true }); });
    arr(remote.settled).forEach(function (k) {
      var e = settledKeys.get(String(k)) || {};
      e.r = true;
      settledKeys.set(String(k), e);
    });
    var settled = [];
    settledKeys.forEach(function (e, k) {
      var path = 's|' + k;
      var res = pick(!!e.l, k, revOf(lmeta, path), !!e.r, k, revOf(rmeta, path), maxDel(path, lmeta, rmeta));
      if (!res) return;
      settled.push(k);
      rev[path] = res.rev;
      delete del[path];
    });
    state.settled = settled;

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
        rev[path] = res.rev;
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
        rev[path] = res.rev;
        delete del[path];
      });
      if (Object.keys(meals).length > 0) day.meals = meals;
      // Un giorno rimasto senza niente (es. dopo la chiusura del campo) non
      // viene riproposto: sparisce del tutto.
      if (Object.keys(day).length > 0) camp[date] = day;
    });
    state.campData = camp;

    return { state: state, meta: { flat: flatten(state), rev: rev, del: del } };
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
