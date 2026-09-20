// Le presenze: chi ha mangiato, quando, e cosa resta congelato.
//
// Sta fuori da src/ per lo stesso motivo di conti.js: sono le regole da cui
// dipendono le quote, e vanno provate con una prova unitaria — sui dati veri
// di un campo vero — invece che leggendo caselle a schermo dentro un browser.
//
// Tutto qui dentro e' PURO: si passano le presenze (campData) e, dove serve,
// i membri. Niente stato di React, niente localStorage. La parte che tocca lo
// stato — i tasti, i modali, le conferme — resta in App(), e chiama queste.
//
// La decisione da non rimettere in discussione (CLAUDE.md): il blocco di un
// giorno protegge TRE cose, non una. I pasti; i membri che quei pasti li
// hanno; e gli interruttori "gratis" e "conto separato".
(function (root) {
  'use strict';

  // Un giorno vuoto. "note" tiene il MENU' del giorno, "appunti" le note
  // libere del Calendario: due campi distinti, perche' unirli vorrebbe dire
  // che chi scrive la lista della cena cancella il promemoria della legna.
  const giornoVuoto = () => ({ note: '', appunti: '', guestsNames: '', meals: {} });

  // Il giorno com'e', completato con i campi che mancano.
  const giorno = (campData, dateStr) =>
    Object.assign(giornoVuoto(), (campData || {})[dateStr] || {});

  // I pasti di una persona in un giorno. Chi non c'e' non ha mangiato: si
  // restituisce la coppia a zero invece di undefined, cosi' chi chiama non
  // deve difendersi ogni volta.
  const pasto = (campData, dateStr, memberId) => {
    const day = (campData || {})[dateStr];
    return (day && day.meals && day.meals[memberId]) || { lunch: false, dinner: false };
  };

  // ---------- Il blocco ----------
  // Quando un giorno e' chiuso, le sue presenze non si toccano piu': ne' col
  // dito ne' da una sincronizzazione. Il blocco si porta dietro una COPIA dei
  // pasti, e quella copia e' l'unica verita': e' un solo valore, con una sua
  // data, quindi si fonde come qualsiasi altra voce e tutti i telefoni
  // arrivano allo stesso risultato.
  const blocco = (campData, dateStr) => {
    const b = ((campData || {})[dateStr] || {}).bloccato;
    return b && typeof b === 'object' ? b : null;
  };

  // Rimette a posto i pasti dei giorni bloccati. Restituisce LO STESSO oggetto
  // se non c'era niente da correggere: e' quello che evita i giri a vuoto —
  // un oggetto nuovo a ogni giro farebbe ripartire gli effetti che lo
  // guardano, all'infinito.
  const applicaBlocchi = (cd) => {
    let toccato = false;
    const out = {};
    Object.keys(cd || {}).forEach((d) => {
      const day = cd[d];
      out[d] = day;
      const b = day && day.bloccato;
      if (!b || typeof b !== 'object' || !b.meals) return;
      if (JSON.stringify(day.meals || {}) === JSON.stringify(b.meals)) return;
      out[d] = Object.assign({}, day, { meals: Object.assign({}, b.meals) });
      toccato = true;
    });
    return toccato ? out : cd;
  };

  // Applica una nuova mappa di pasti tenendo allineata la copia bloccata: le
  // riparazioni d'identita' (doppioni, presenze orfane) devono valere anche
  // sui giorni chiusi, altrimenti quelle presenze sparirebbero dai conti.
  const conBlocco = (day, meals) => (day.bloccato && typeof day.bloccato === 'object'
    ? Object.assign({}, day, { meals: meals, bloccato: Object.assign({}, day.bloccato, { meals: meals }) })
    : Object.assign({}, day, { meals: meals }));

  // In quali giorni bloccati compare questa persona.
  //
  // Serve perche' le quote non escono dai pasti: escono da pasti PER membri.
  // Congelare i pasti e lasciare libero l'elenco dei membri vuol dire
  // promettere che quel giorno non cambia e poi lasciarlo cambiare lo stesso —
  // basta eliminare una persona, o dichiararla bambina, e le quote di quel
  // giorno si riscrivono tutte.
  const giorniBloccatiDi = (campData, id) => Object.keys(campData || {}).filter((d) => {
    const b = (campData[d] || {}).bloccato;
    const v = b && typeof b === 'object' && b.meals && b.meals[String(id)];
    return !!(v && (v.lunch || v.dinner));
  }).sort();

  // ---------- Presenze orfane ----------
  // Pasti che appartengono a un id che fra i membri non c'e' piu': succede
  // quando qualcuno viene eliminato e riaggiunto (prende un id nuovo) e i suoi
  // pasti restano attaccati a quello vecchio. Non contano nei conti e non si
  // vedono da nessuna parte: vanno trovati e detti, o sono soldi che nessuno
  // divide.
  //
  // "nomiEx" e' il registro di chi e' stato eliminato, per poter dire un nome
  // invece di una sigla. Si passa perche' vive in localStorage, e qui dentro
  // localStorage non si legge.
  const orfane = (campData, members, nomiEx) => {
    const vivi = new Set((members || []).map((m) => m.id));
    const ex = nomiEx || {};
    const per = new Map();
    Object.keys(campData || {}).forEach((d) => {
      const meals = (campData[d] && campData[d].meals) || {};
      Object.keys(meals).forEach((id) => {
        if (vivi.has(id)) return;
        const v = meals[id];
        if (!v || (!v.lunch && !v.dinner)) return;  // voce a zero: non e' una presenza
        const cur = per.get(id) || { id: id, nome: ex[id] || '', pasti: 0, giorni: [] };
        cur.pasti += (v.lunch ? 1 : 0) + (v.dinner ? 1 : 0);
        cur.giorni.push(d);
        per.set(id, cur);
      });
    });
    return [...per.values()].sort((a, b) => b.pasti - a.pasti);
  };

  root.Presenze = {
    giornoVuoto: giornoVuoto,
    giorno: giorno,
    pasto: pasto,
    blocco: blocco,
    applicaBlocchi: applicaBlocchi,
    conBlocco: conBlocco,
    giorniBloccatiDi: giorniBloccatiDi,
    orfane: orfane,
  };
})(typeof window !== 'undefined' ? window : globalThis);
