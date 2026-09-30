// Voci di spesa che si possono spegnere (ROADMAP.md § 8).
//
// Un gruppo compra il gasolio con la cassa dell'associazione, o
// l'attrezzatura una volta per tutte, e non vuole vederla comparire come
// tassa a testa. Spegnere una voce vuol dire: **registrata, ma non si divide
// qui — la gestisce il gruppo.**
//
// Due regole, e la seconda e' quella che conta.
//
// 1. **I conti non si toccano.** conti.js deve restare identico nelle due
//    versioni (CLAUDE.md: la logica dei soldi non si duplica). Qui non si
//    cambia come si divide: si sceglie COSA gli si da' da dividere. Le voci
//    spente escono prima, da tutte e due le casse — non sono uno sconto sulla
//    cassa comune, sono una terza colonna.
//
// 2. **Si puo' togliere una voce dal conto, non si puo' far sparire un euro
//    dalla vista.** Quello che esce si somma a parte e si dichiara: a schermo
//    e nel resoconto. Altrimenti chi legge «Totale spese» crede che il campo
//    sia costato meno di quanto e' costato — e se invece lo si lasciasse
//    dentro senza dividerlo, i conti lo dichiarerebbero come un buco
//    (`nonRipartito`), cioe' un errore che non c'e'.
//
// La scelta e' della STANZA, non del telefono: le quote devono essere le
// stesse per tutti. Sta in rooms/<codice>.voci e la cambia solo chi
// amministra (firestore.rules). Qui si ragiona su una mappa gia' letta.
(function (root) {
  'use strict';

  // Le categorie: le tre tipologie degli acquisti piu' l'attrezzatura. Una
  // mappa, non due bandierine: una categoria nuova domani non chiede codice
  // nuovo qui.
  var CATEGORIE = ['alimentare', 'bevande', 'logistica', 'attrezzatura'];
  // I tipi di spesa che conti.js sa dividere (sumByType). Una prova
  // (unita/voci) pretende che PURCHASE_TYPES non ne abbia altri.
  var TIPI_SPESA = ['alimentare', 'bevande', 'logistica'];

  // Solo 'fuori' spegne. Qualunque altra cosa — una categoria sconosciuta, un
  // valore storto arrivato da una versione vecchia — vuol dire «si divide»:
  // nel dubbio si fa come l'app ha sempre fatto.
  function spente(voci) {
    var fuori = {};
    CATEGORIE.forEach(function (c) {
      if (voci && voci[c] === 'fuori') fuori[c] = true;
    });
    return fuori;
  }

  function importo(v) {
    var n = Number(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  // Divide cio' che entra nei conti da cio' che resta fuori.
  //   purchases, equipment: le liste dell'app, come le riceve Conti.calcola;
  //   voci: la mappa della stanza (o niente).
  // Restituisce le due liste da passare ai conti, e il fuori conto: il totale
  // e la cifra per categoria. L'attrezzatura conta solo se comprata — la
  // stessa regola di conti.js, altrimenti il fuori conto dichiarerebbe soldi
  // che nessuno ha ancora speso.
  function separa(purchases, equipment, voci) {
    var off = spente(voci);
    var perCategoria = {};
    var totale = 0;
    var aggiungi = function (c, v) {
      perCategoria[c] = (perCategoria[c] || 0) + v;
      totale += v;
    };
    var dentro = (purchases || []).filter(function (p) {
      if (!off[p && p.type]) return true;
      aggiungi(p.type, importo(p.price));
      return false;
    }).map(function (p) {
      // Una spesa senza tipo, o con un tipo che i conti non conoscono (un
      // file importato, una versione vecchia, una categoria nuova domani),
      // conti.js la rimborsava a chi l'aveva pagata ma non la divideva fra
      // nessuno: saldi che non tornano a zero, e sul conto separato quote
      // negative. Si divide come cibo — lo stesso tipo che le da' la maschera
      // di correzione quando la apre —, cosi' conti e schermo dicono la
      // stessa cosa.
      return p && TIPI_SPESA.indexOf(p.type) < 0 ? Object.assign({}, p, { type: 'alimentare' }) : p;
    });
    var attrezzatura = equipment || [];
    if (off.attrezzatura) {
      attrezzatura.forEach(function (e) { if (e && e.bought) aggiungi('attrezzatura', importo(e.price)); });
      attrezzatura = [];
    }
    return {
      purchases: dentro,
      equipment: attrezzatura,
      fuori: { totale: Math.round(totale * 100) / 100, perCategoria: perCategoria },
    };
  }

  root.Voci = { CATEGORIE: CATEGORIE, TIPI_SPESA: TIPI_SPESA, spente: spente, separa: separa };
})(typeof window !== 'undefined' ? window : globalThis);
