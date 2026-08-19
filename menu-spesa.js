// Dal menù del giorno alle voci della lista della spesa.
//
// PERCHE' ESISTE. Nei menù del campo 2026 c'era già tutta la spesa, scritta
// a mano con le quantità e a volte con i prezzi:
//
//     Cena :
//     150 arrosticini
//     40 COSCE pollo
//     50 salsiccie
//     Pannocchie
//
// Nel frattempo la scheda "Da acquistare", che esiste esattamente per questo,
// conteneva CINQUE voci in tutto. Non è disciplina che manca: è che chi pensa
// al cibo scrive nel campo che ha davanti. Questo lettore prende quelle righe
// e le propone di là.
//
// PERCHE' NON C'E' UNA TABELLA DI INGREDIENTI. Il piano era tradurre "pasta al
// pomodoro" in "pasta, pomodoro". I menù veri dicono che non serve: la gente
// scrive già gli ingredienti per le cose da comprare, e i nomi dei piatti solo
// per ricordarsi cosa si cucina. Una tabella avrebbe indovinato dove non serve
// e sbagliato dove serve.
//
// LA REGOLA: propone, non scrive. Nessuna riga entra nella lista senza che
// qualcuno la confermi, e nessuna riga viene buttata perché "non sembra cibo":
// filtrare richiederebbe un dizionario alimentare — la cosa che si è deciso di
// non costruire — e una spunta da togliere costa meno di una voce persa.
(function (root) {
  'use strict';

  // Le intestazioni dei pasti. Possono stare da sole ("PRANZO:") oppure avere
  // il piatto attaccato sulla stessa riga ("Pranzo: CORDICELLE AL SUGO").
  var PASTO = /^(pranzo|cena|colazione|merenda|spuntino|aperitivo)\s*:?\s*/i;
  // I segni d'elenco che la gente mette davanti alle righe.
  var ELENCO = /^[-–—•*·+]\s*/;
  // Le unità che si vedono davvero su una lista della spesa.
  var UNITA = '(?:kg|kilo|kili|chili|g|gr|hg|etti?|l|lt|litri?|ml|cl|pz|pezzi?|conf|confezioni?|bottiglie?|bott|forme?|mazzi?|teste?|scatole?|barattoli?|vasetti?)';
  var TESTA = new RegExp('^(\\d+(?:[.,]\\d+)?\\s*' + UNITA + '?)\\s+(.+)$', 'i');
  var CODA = new RegExp('^(.+?)\\s+(\\d+(?:[.,]\\d+)?\\s*' + UNITA + ')$', 'i');

  function normalizza(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  }

  // Divide una riga in nome e quantità. Tre forme, in ordine di certezza:
  //   "Vongole: 1,5 kg 6€ al kg"  -> i due punti separano, e quello che segue
  //                                  resta VERBATIM: se chi cucina ha scritto
  //                                  anche il prezzo, è un'informazione sua e
  //                                  non tocca a noi buttarla.
  //   "150 arrosticini"           -> numero in testa.
  //   "FIORENTINA 5kg"            -> numero in coda, ma solo se ha l'unità
  //                                  attaccata: senza unità, un numero in coda
  //                                  è più probabilmente parte del nome.
  function dividi(riga) {
    var r = normalizza(riga);
    var c = r.indexOf(':');
    if (c > 0 && c < r.length - 1) {
      return { nome: normalizza(r.slice(0, c)), qta: normalizza(r.slice(c + 1)) };
    }
    var m = r.match(TESTA);
    if (m) return { nome: normalizza(m[2]), qta: normalizza(m[1]) };
    m = r.match(CODA);
    if (m) return { nome: normalizza(m[1]), qta: normalizza(m[2]) };
    return { nome: r, qta: '' };
  }

  // Legge il testo di un menù e restituisce [{ nome, qta }].
  function vociDalMenu(testo) {
    var out = [];
    String(testo == null ? '' : testo).split(/\r?\n/).forEach(function (riga) {
      var r = normalizza(riga);
      if (!r) return;
      r = normalizza(r.replace(ELENCO, ''));
      if (!r) return;
      var m = r.match(PASTO);
      if (m) { r = normalizza(r.slice(m[0].length)); if (!r) return; }
      var v = dividi(r);
      if (!v.nome) return;
      // Le virgole separano cose diverse SOLO se non c'è una quantità: con una
      // quantità non si saprebbe a quale pezzo appartiene, e indovinare qui
      // vorrebbe dire sbagliare le quantità della spesa.
      if (!v.qta && v.nome.indexOf(',') >= 0) {
        v.nome.split(',').forEach(function (p) {
          var n = normalizza(p);
          if (n) out.push({ nome: n, qta: '' });
        });
        return;
      }
      out.push(v);
    });
    return out;
  }

  // Scarta quello che è già in lista. Il confronto ignora maiuscole e spazi,
  // perché "SCAMORZE" e " scamorze " sono la stessa cosa per chi fa la spesa.
  function nuove(voci, giaInLista) {
    var visti = {};
    (Array.isArray(giaInLista) ? giaInLista : []).forEach(function (x) {
      var n = normalizza(x && (x.name != null ? x.name : x)).toLowerCase();
      if (n) visti[n] = true;
    });
    return (Array.isArray(voci) ? voci : []).filter(function (v) {
      var n = normalizza(v && v.nome).toLowerCase();
      if (!n || visti[n]) return false;
      visti[n] = true;   // niente doppioni nemmeno dentro la stessa proposta
      return true;
    });
  }

  root.MenuSpesa = { vociDalMenu: vociDalMenu, nuove: nuove, dividi: dividi };
})(typeof window !== 'undefined' ? window : globalThis);
