// Quando una sincronizzazione va detta, e quando no.
//
// Sono le due decisioni piu' delicate dell'app, e fino a oggi si potevano
// provare solo aprendo un browser. Stanno fuori da src/ come conti.js e
// presenze.js: sono regole, non idraulica.
//
// Il problema che risolvono non e' "accorgersi di una perdita": quello lo fa
// gia' la fusione. E' decidere se **svegliare qualcuno**. Un allarme che
// suona quando non serve e' peggio di nessun allarme, perche' dopo due volte
// non lo guarda piu' nessuno — ed e' successo davvero: togliere un membro
// cancella anche le sue presenze di tutti i giorni, un gesto solo che produce
// sette "voci perse", e un telefono rimasto indietro lo scopriva tre giorni
// dopo gridando al disastro.
(function (root) {
  'use strict';

  // ---------- Orologi sballati ----------
  // Si guarda la data piu' alta che arriva dall'altro telefono. Se e' avanti
  // di giorni rispetto a qui, uno dei due ha l'ora sbagliata — e chi ce l'ha
  // avanti sta vincendo tutti i confronti senza saperlo.
  //
  // NOTA: questo e' solo l'AVVISO. Il freno vero sta in sync-merge.js, e
  // frena l'orologio locale, mai il confronto fra due voci: frenare anche il
  // confronto farebbe smettere di convergere due telefoni con ore diverse.
  function orologioAvanti(rmeta, adesso, soglia) {
    if (!rmeta || (!rmeta.rev && !rmeta.del)) return null;
    let piuAlta = 0;
    [rmeta.rev, rmeta.del].forEach(function (m) {
      if (!m) return;
      Object.keys(m).forEach(function (k) {
        if (typeof m[k] === 'number' && m[k] > piuAlta) piuAlta = m[k];
      });
    });
    var avanti = piuAlta - adesso;
    return avanti > soglia ? { avanti: avanti, at: adesso } : null;
  }

  // ---------- Perdite che meritano un allarme ----------
  // Due situazioni opposte che prima venivano annunciate allo stesso modo:
  //
  //   qualcuno sta cancellando ADESSO          -> va fermato, e' un allarme;
  //   questo telefono era indietro e scopre
  //   ora cancellazioni fatte giorni fa        -> non manca niente a nessuno,
  //                                               e' solo il recupero del
  //                                               ritardo.
  //
  // Si guarda QUANDO, non solo quante. E si contano solo quelle dello stesso
  // gesto: le lapidi di una raffica portano tutte lo stesso istante, quindi
  // "sette voci in due minuti" e' UNA cancellazione, non sette.
  //
  // perse:  i percorsi spariti
  // quando: la data di cancellazione di ognuno, nello stesso ordine
  function perditeDaAnnunciare(perse, quando, adesso, opz) {
    var o = opz || {};
    var raffica = typeof o.raffica === 'number' ? o.raffica : 2 * 60 * 1000;
    var recente = typeof o.recente === 'number' ? o.recente : 6 * 60 * 60 * 1000;
    var minimo = typeof o.minimo === 'number' ? o.minimo : 3;
    var elenco = perse || [];
    if (elenco.length === 0) return { fresche: [], piuRecente: 0, eta: 0, annuncia: false };

    var date = quando || [];
    var piuRecente = 0;
    date.forEach(function (t) { if (typeof t === 'number' && t > piuRecente) piuRecente = t; });
    // Dello stesso gesto: entro la finestra della raffica dalla piu' recente.
    var fresche = elenco.filter(function (p, i) { return piuRecente - date[i] <= raffica; });
    var eta = adesso - piuRecente;
    return {
      fresche: fresche,
      piuRecente: piuRecente,
      eta: eta,
      // Sotto il minimo non si disturba nessuno: una voce sola che sparisce e'
      // quasi sempre qualcuno che ha corretto una spesa.
      annuncia: fresche.length >= minimo && eta <= recente,
    };
  }

  root.Allarmi = {
    orologioAvanti: orologioAvanti,
    perditeDaAnnunciare: perditeDaAnnunciare,
  };
})(typeof window !== 'undefined' ? window : globalThis);
