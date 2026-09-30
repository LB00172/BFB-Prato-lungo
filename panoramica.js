// La Panoramica: tutti i propri campi in un colpo d'occhio (30 settembre).
//
// Per chi tiene d'occhio piu' campi insieme — un organizzatore che e' nel
// gruppo con il codice come tutti, spesso come secondo capogruppo accanto al
// capo sul posto. Si paga con l'abbonamento Pro annuale, che e' della
// persona: e' l'unica funzione che guarda la persona e non il campo, perche'
// non riguarda un campo solo.
//
// Sta fuori da src/ per la ragione di conti.js: sono regole, e si provano con
// i numeri (test/unita/panoramica.js). Qui non si parla con Firebase e non si
// disegna niente: si riceve lo stato di un campo — lo stesso JSON che la
// sincronizzazione tiene in rooms/<codice>/dati/stato — e se ne ricava il
// riassunto. I conti non si rifanno: si chiamano (Conti.calcola, dopo
// Voci.separa), cosi' la Panoramica dice le stesse cifre che il campo dice
// a chi ci sta dentro.
(function (root) {
  'use strict';

  const lista = (v) => (Array.isArray(v) ? v : []);

  // La chiave di un rimborso segnato come fatto. Stava dentro App(); e' uscita
  // qui perche' la Panoramica deve riconoscere gli stessi rimborsi, e due
  // copie della stessa chiave divergono alla prima correzione — un rimborso
  // fatto che nella Panoramica risultasse ancora aperto. La cassa separata e
  // la vista ottimizzata hanno il loro prefisso: due passaggi identici nelle
  // due casse non si devono spegnere a vicenda.
  function chiaveRimborso(t) {
    const prefisso = t.cassa === 'separata' ? 'sep:' : t.cassa === 'tutte' ? 'opt:' : '';
    return `${prefisso}${t.from}→${t.to}@${Math.round(t.amount * 100)}`;
  }

  // Il riassunto di un campo. `voci` sono le voci spente della stanza
  // (voci.js); `opzioni.equipExemption` come FEATURES.equipExemption.
  //
  // I rimborsi aperti si contano nella vista che il gruppo usa: se almeno un
  // rimborso e' stato segnato in quella ottimizzata (prefisso opt:), si pagano
  // quelli; altrimenti quelli per cassa. Contarli in tutte e due darebbe il
  // doppio dei bonifici da fare.
  function riassunto(stato, voci, opzioni) {
    const s = stato || {};
    const o = opzioni || {};
    const members = lista(s.members);
    const purchases = lista(s.purchases);
    const equipment = lista(s.equipment);
    const per = root.Voci
      ? root.Voci.separa(purchases, equipment, voci || null)
      : { purchases, equipment, fuori: { totale: 0, perCategoria: {} } };
    const t = root.Conti.calcola({
      members,
      campData: s.campData && typeof s.campData === 'object' ? s.campData : {},
      purchases: per.purchases,
      equipment: per.equipment,
      sepDays: lista(s.sepDays),
      freeDays: lista(s.freeDays),
      equipExemption: !!o.equipExemption,
    });
    const settled = lista(s.settled).map(String);
    const ottimizzata = settled.some((k) => k.indexOf('opt:') === 0);
    const daPagare = lista(ottimizzata ? t.transfersOttimizzati : t.transfers);
    const aperti = daPagare.filter((x) => settled.indexOf(chiaveRimborso(x)) < 0);
    const adulti = members.filter((m) => m && !m.isChild).length;
    const ultima = purchases.reduce((max, p) => (p && typeof p.at === 'number' && p.at > max ? p.at : max), 0);
    const tondo = (n) => Math.round((Number(n) || 0) * 100) / 100;
    return {
      persone: members.length,
      adulti,
      bambini: members.length - adulti,
      spese: purchases.length,
      speso: tondo(t.overallTotal),
      fuoriConto: tondo(per.fuori && per.fuori.totale),
      // Quanto costa a testa, in media: quello che si e' diviso fra chi paga,
      // diviso per chi paga. Senza adulti non c'e' una media da dire.
      aTesta: adulti > 0 ? tondo(t.overallTotal / adulti) : null,
      rimborsiAperti: aperti.length,
      daMuovere: tondo(aperti.reduce((n, x) => n + (Number(x.amount) || 0), 0)),
      // I conti che non tornano (una spesa senza nessuno a cui attribuirla):
      // in una Panoramica e' il campo da guardare per primo.
      buchi: lista(t.buchi).length,
      ultimaSpesa: ultima || null,
    };
  }

  // L'abbonamento annuale di chi guarda: vale finche' la scadenza non e'
  // passata. `a` e' il documento abbonati/<uid> che scrive il server
  // (functions/pro.js); `scade` in millisecondi. Nient'altro lo accende.
  function abbonamentoAttivo(a, ora) {
    return !!(a && typeof a.scade === 'number' && isFinite(a.scade) && a.scade > (ora || Date.now()));
  }

  // I numeri di tutti i campi insieme, per la testata. Solo quelli letti:
  // un campo che non si e' potuto leggere non vale zero, non vale e basta.
  function totali(righe) {
    const lette = lista(righe).filter((r) => r && r.riassunto);
    return {
      campi: lette.length,
      speso: Math.round(lette.reduce((n, r) => n + r.riassunto.speso, 0) * 100) / 100,
      rimborsiAperti: lette.reduce((n, r) => n + r.riassunto.rimborsiAperti, 0),
      buchi: lette.reduce((n, r) => n + r.riassunto.buchi, 0),
    };
  }

  root.Panoramica = { riassunto, chiaveRimborso, abbonamentoAttivo, totali };
})(typeof window !== 'undefined' ? window : globalThis);
