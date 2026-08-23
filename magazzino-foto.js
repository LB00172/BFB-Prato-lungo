// Dove stanno le foto degli scontrini.
//
// Stavano in localStorage, in Base64, dentro una chiave sola. Alla chiusura
// del campo 2026 quella chiave pesava 3,18 MB su un tetto di circa 5, mentre
// i dati che contano davvero — membri, presenze, spese, saldi — ne pesavano
// 35 in tutto. Le foto occupavano novanta volte i dati che avrebbero dovuto
// proteggere, e il salvataggio dei conti, quando lo spazio finisce, sacrifica
// le istantanee ma non le foto: era il percorso esatto per perdere una
// presenza per colpa di uno scontrino.
//
// In piu' riscrivere quella chiave voleva dire un JSON.stringify da 3 MB a
// ogni foto aggiunta: 53 ms misurati su un portatile, quattro decimi di
// secondo di interfaccia ferma su un telefono.
//
// Qui le foto passano in IndexedDB: niente tetto dei 5 MB, niente tassa del
// +33% del Base64 se un giorno si passera' ai Blob, e scritture asincrone che
// non fermano il disegno. localStorage torna a contenere solo i conti.
//
// Sta fuori da src/ per lo stesso motivo di menu-spesa.js: le REGOLE qui
// dentro (cosa scrivere, cosa cancellare, quando la migrazione si puo' dire
// riuscita) si provano con una prova unitaria, senza aprire un browser.
(function (root) {
  'use strict';

  var DB_NOME = 'cambusa-foto';
  var NEGOZIO = 'scontrini';
  var CHIAVE_VECCHIA = 'cambusa_receipts';

  // ------------------------------------------------------------------
  // Regole pure — provabili senza IndexedDB e senza browser.
  // ------------------------------------------------------------------

  // Cosa cambia fra due mappe di foto. Si scrive SOLO cio' che e' nato o
  // cambiato: riscrivere tutto a ogni foto e' esattamente il difetto da cui
  // veniamo. Le foto sono grandi e non cambiano mai una volta scattate,
  // quindi il confronto per identita' basta e costa niente.
  function daScrivere(prima, dopo) {
    prima = prima || {};
    dopo = dopo || {};
    var scrivi = [];
    var cancella = [];
    Object.keys(dopo).forEach(function (id) {
      if (prima[id] !== dopo[id]) scrivi.push(id);
    });
    Object.keys(prima).forEach(function (id) {
      if (!Object.prototype.hasOwnProperty.call(dopo, id)) cancella.push(id);
    });
    return { scrivi: scrivi, cancella: cancella };
  }

  // La migrazione si puo' dichiarare finita — e quindi si puo' cancellare la
  // copia vecchia — solo se ogni foto e' stata RILETTA dal posto nuovo ed e'
  // identica all'originale. Scrivere e cancellare fidandosi e' come potare le
  // istantanee prima di aver salvato la storia della sincronizzazione: se la
  // scrittura non e' andata, i byte non tornano indietro.
  //
  // Il caso vuoto e' riuscito: non c'era niente da spostare.
  function migrazioneRiuscita(originali, rilette) {
    originali = originali || {};
    rilette = rilette || {};
    var ids = Object.keys(originali);
    for (var i = 0; i < ids.length; i++) {
      if (rilette[ids[i]] !== originali[ids[i]]) return false;
    }
    return true;
  }

  // Quanto pesa una mappa di foto, in byte. Serve alla diagnostica in
  // modalita' tecnica: e' il numero che ha fatto nascere tutto questo.
  function peso(mappa) {
    mappa = mappa || {};
    return Object.keys(mappa).reduce(function (s, id) {
      return s + String(mappa[id] || '').length;
    }, 0);
  }

  // ------------------------------------------------------------------
  // IndexedDB, con localStorage come rete di sicurezza.
  // ------------------------------------------------------------------
  // Safari in navigazione privata ha gia' fatto di peggio che mancare: c'e'
  // l'oggetto indexedDB ma aprire un database fallisce. Quindi non basta
  // guardare se esiste, bisogna provarci — una volta sola — e ricordarsi
  // com'e' andata.
  var db = null;
  var rotto = false;
  var apertura = null;

  function apri() {
    if (db) return Promise.resolve(db);
    if (rotto) return Promise.resolve(null);
    if (apertura) return apertura;
    apertura = new Promise(function (risolvi) {
      var idb = root.indexedDB;
      if (!idb) { rotto = true; risolvi(null); return; }
      var req;
      try { req = idb.open(DB_NOME, 1); }
      catch (e) { rotto = true; risolvi(null); return; }
      // Un'apertura che non torna piu' (permessi, quota, tab bloccata) non
      // deve lasciare l'app senza foto per sempre: dopo qualche secondo si
      // ripiega su localStorage e si va avanti.
      var scaduta = setTimeout(function () { rotto = true; risolvi(null); }, 4000);
      req.onupgradeneeded = function () {
        try { req.result.createObjectStore(NEGOZIO); } catch (e) { /* c'e' gia' */ }
      };
      req.onsuccess = function () {
        clearTimeout(scaduta);
        db = req.result;
        // Se il database viene chiuso da fuori (svuotamento dati del browser)
        // non si tiene un riferimento morto: si riapre alla prossima.
        db.onclose = function () { db = null; apertura = null; };
        risolvi(db);
      };
      req.onerror = function () { clearTimeout(scaduta); rotto = true; risolvi(null); };
      req.onblocked = function () { clearTimeout(scaduta); rotto = true; risolvi(null); };
    });
    return apertura;
  }

  function disponibile() { return !!db && !rotto; }

  function transazione(modo) {
    return apri().then(function (d) {
      if (!d) return null;
      try { return d.transaction(NEGOZIO, modo).objectStore(NEGOZIO); }
      catch (e) { rotto = true; return null; }
    });
  }

  function attendi(req) {
    return new Promise(function (risolvi, rifiuta) {
      req.onsuccess = function () { risolvi(req.result); };
      req.onerror = function () { rifiuta(req.error || new Error('IndexedDB')); };
    });
  }

  // ---- Copia vecchia in localStorage: lettura e cancellazione -------------
  function vecchiaLeggi() {
    try {
      var v = JSON.parse(root.localStorage.getItem(CHIAVE_VECCHIA) || '{}');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) { return {}; }
  }

  function vecchiaScrivi(mappa) {
    try { root.localStorage.setItem(CHIAVE_VECCHIA, JSON.stringify(mappa || {})); return true; }
    catch (e) { return false; }
  }

  function vecchiaCancella() {
    try { root.localStorage.removeItem(CHIAVE_VECCHIA); } catch (e) { /* niente */ }
  }

  // ---- Lettura di tutto il magazzino -------------------------------------
  function leggiTutte() {
    return transazione('readonly').then(function (neg) {
      if (!neg) return vecchiaLeggi();
      // openCursor invece di getAll(): getAll costruisce l'intero array di
      // megabyte in un colpo solo, il cursore le consegna una per volta.
      return new Promise(function (risolvi) {
        var mappa = {};
        var req = neg.openCursor();
        req.onsuccess = function () {
          var c = req.result;
          if (!c) { risolvi(mappa); return; }
          if (typeof c.value === 'string') mappa[c.key] = c.value;
          c.continue();
        };
        req.onerror = function () { risolvi(mappa); };
      });
    }).catch(function () { return vecchiaLeggi(); });
  }

  // ---- Scrittura del solo cambiamento ------------------------------------
  // Ritorna la mappa che risulta davvero salvata: se il magazzino non c'e' e
  // anche localStorage rifiuta (memoria piena), chi chiama deve sapere che le
  // foto vivono solo nella memoria dell'app e nella cache di Firestore.
  function applica(prima, dopo) {
    var d = daScrivere(prima, dopo);
    if (d.scrivi.length === 0 && d.cancella.length === 0) {
      return Promise.resolve({ salvato: true, scritte: 0, cancellate: 0 });
    }
    return transazione('readwrite').then(function (neg) {
      if (!neg) {
        return { salvato: vecchiaScrivi(dopo), scritte: d.scrivi.length, cancellate: d.cancella.length, ripiego: true };
      }
      var attese = d.scrivi.map(function (id) { return attendi(neg.put(dopo[id], id)); })
        .concat(d.cancella.map(function (id) { return attendi(neg.delete(id)); }));
      return Promise.all(attese).then(function () {
        return { salvato: true, scritte: d.scrivi.length, cancellate: d.cancella.length };
      });
    }).catch(function () {
      return { salvato: vecchiaScrivi(dopo), scritte: 0, cancellate: 0, ripiego: true };
    });
  }

  // ---- Migrazione dalla vecchia chiave -----------------------------------
  // L'ordine e' quello che conta, ed e' sempre lo stesso di tutto il resto:
  // 1) si legge la copia vecchia;
  // 2) si scrive nel posto nuovo;
  // 3) si RILEGGE dal posto nuovo e si confronta;
  // 4) solo se torna tutto, si cancella la copia vecchia.
  // Se il passo 3 non convince, la chiave vecchia resta dov'e': si occupa
  // spazio per un altro giro, ma non si perde una foto.
  function migra() {
    var vecchie = vecchiaLeggi();
    var quante = Object.keys(vecchie).length;
    if (quante === 0) {
      // Niente da spostare, ma la chiave potrebbe esserci vuota: si toglie.
      vecchiaCancella();
      return leggiTutte().then(function (m) { return { mappa: m, migrate: 0, riuscita: true }; });
    }
    return transazione('readwrite').then(function (neg) {
      if (!neg) return { mappa: vecchie, migrate: 0, riuscita: false, ripiego: true };
      var attese = Object.keys(vecchie).map(function (id) { return attendi(neg.put(vecchie[id], id)); });
      return Promise.all(attese)
        .then(function () { return leggiTutte(); })
        .then(function (rilette) {
          if (!migrazioneRiuscita(vecchie, rilette)) {
            return { mappa: rilette, migrate: 0, riuscita: false };
          }
          vecchiaCancella();
          return { mappa: rilette, migrate: quante, riuscita: true };
        });
    }).catch(function () {
      return { mappa: vecchie, migrate: 0, riuscita: false, ripiego: true };
    });
  }

  // ---- Svuotamento (chiusura del campo) ----------------------------------
  function svuota() {
    vecchiaCancella();
    return transazione('readwrite').then(function (neg) {
      if (!neg) return false;
      return attendi(neg.clear()).then(function () { return true; });
    }).catch(function () { return false; });
  }

  root.MagazzinoFoto = {
    daScrivere: daScrivere,
    migrazioneRiuscita: migrazioneRiuscita,
    peso: peso,
    leggiTutte: leggiTutte,
    applica: applica,
    migra: migra,
    svuota: svuota,
    disponibile: disponibile,
    CHIAVE_VECCHIA: CHIAVE_VECCHIA,
  };
})(typeof window !== 'undefined' ? window : globalThis);
