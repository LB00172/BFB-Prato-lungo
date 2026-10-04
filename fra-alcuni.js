// Le spese divise solo fra alcuni (4 ottobre).
//
// «La benzina della macchina di Marco la dividono i quattro che erano su»,
// «le birre solo chi le ha bevute». Fino a qui una spesa si divideva per
// pasti (cibo e bevande) o fra tutti i presenti (logistica, attrezzatura):
// non c'era modo di dire «questa, solo fra loro».
//
// Una spesa con `per: [id, id, …]` si divide in parti uguali fra quei membri,
// al centesimo — chi resta col centesimo in piu' sono i primi dell'elenco —, e
// va nella cassa comune: chi l'ha pagata riceve, chi c'era deve.
//
// conti.js NON si tocca: deve restare identico a main, e la Brigata non ha
// bisogno di questa funzione. Qui si fa come in voci.js e rimborsi.js:
//   - separa: le spese fra alcuni escono da quello che si da' a Conti.calcola;
//   - applica: se ne aggiungono gli effetti sui saldi che Conti.calcola ha
//     prodotto, e si rifanno i passaggi con lo stesso pareggio
//     (Rimborsi.pareggia). Senza spese fra alcuni il risultato e' identico,
//     oggetto per oggetto, a quello di conti.js.
//
// Una spesa fra alcuni i cui membri sono stati tolti tutti non si spalma su
// nessuno: e' un buco, come in conti.js, e si dichiara.
(function (root) {
  'use strict';

  const norm = (s) => String(s || '').trim().toLowerCase();
  const centesimi = (v) => {
    const n = Number(v);
    return isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  };
  const fraAlcuni = (p) => !!(p && Array.isArray(p.per) && p.per.length > 0);

  function separa(purchases) {
    const tutte = purchases || [];
    return { comuni: tutte.filter((p) => !fraAlcuni(p)), fraAlcuni: tutte.filter(fraAlcuni) };
  }

  // Le quote di UNA spesa: chi c'era, e quanto a testa in centesimi. I membri
  // che non esistono piu' si saltano; se non ne resta nessuno, l'elenco e'
  // vuoto e la spesa e' un buco.
  function quote(p, members) {
    const cents = centesimi(p.price);
    const visti = new Set();
    const chi = [];
    (p.per || []).forEach((id) => {
      const m = (members || []).find((x) => String(x.id) === String(id));
      if (m && !visti.has(String(m.id))) { visti.add(String(m.id)); chi.push(m); }
    });
    if (!chi.length || cents <= 0) return { cents, chi: [] };
    const base = Math.floor(cents / chi.length);
    const resto = cents - base * chi.length;
    return { cents, chi: chi.map((m, i) => ({ id: m.id, name: m.name, cents: base + (i < resto ? 1 : 0) })) };
  }

  // Un elenco di saldi (nome, pagato, dovuto) con dentro i movimenti nuovi.
  function aggiungi(settlement, pagati, dovuti) {
    const per = {};
    const ordine = [];
    const voce = (nome) => {
      const k = norm(nome);
      if (!per[k]) { per[k] = { name: nome, paid: 0, owed: 0 }; ordine.push(k); }
      return per[k];
    };
    (settlement || []).forEach((s) => { const v = voce(s.name); v.paid += s.paid; v.owed += s.owed; });
    Object.keys(pagati).forEach((k) => { voce(pagati[k].name).paid += pagati[k].cents / 100; });
    Object.keys(dovuti).forEach((k) => { voce(dovuti[k].name).owed += dovuti[k].cents / 100; });
    return ordine.map((k) => per[k])
      .filter((v) => v.paid !== 0 || v.owed !== 0)
      .map((v) => ({ ...v, net: v.paid - v.owed }))
      .sort((a, b) => b.net - a.net);
  }

  function applica(totali, voci, members) {
    const t = totali;
    const vuoto = { totale: 0, voci: [], perPersona: {} };
    if (!voci || !voci.length) return { ...t, fraAlcuni: vuoto };

    const pagati = {};   // nome normalizzato -> { name, cents }
    const dovuti = {};   // nome normalizzato -> { name, cents }
    const perPersona = {}; // id membro -> centesimi
    let totale = 0;
    let senzaNessuno = 0;
    let senzaAcquirente = 0;
    const elenco = [];
    voci.forEach((p) => {
      const q = quote(p, members);
      if (q.cents <= 0) return;
      totale += q.cents;
      const chi = String(p.buyer || '').trim();
      if (chi) {
        const k = norm(chi);
        if (!pagati[k]) pagati[k] = { name: chi, cents: 0 };
        pagati[k].cents += q.cents;
      } else senzaAcquirente += q.cents;
      if (!q.chi.length) senzaNessuno += q.cents;
      q.chi.forEach((x) => {
        const k = norm(x.name);
        if (!dovuti[k]) dovuti[k] = { name: x.name, cents: 0 };
        dovuti[k].cents += x.cents;
        perPersona[x.id] = (perPersona[x.id] || 0) + x.cents;
      });
      elenco.push({ id: p.id, name: p.name, buyer: chi, price: q.cents / 100, quote: q.chi.map((x) => ({ id: x.id, name: x.name, amount: x.cents / 100 })) });
    });
    if (!totale) return { ...t, fraAlcuni: vuoto };

    const pareggia = root.Rimborsi.pareggia;
    const membri = new Set((members || []).map((m) => norm(m.name)));

    // La cassa comune, con dentro le spese fra alcuni.
    const vecchia = t.casse.comune;
    const settlementComune = aggiungi(vecchia.settlement, pagati, dovuti);
    const byBuyer = (() => {
      const m2 = {};
      vecchia.byBuyer.forEach((b) => { m2[b.name] = (m2[b.name] || 0) + b.total; });
      Object.keys(pagati).forEach((k) => {
        const esiste = Object.keys(m2).find((n) => norm(n) === k);
        const n = esiste || pagati[k].name;
        m2[n] = (m2[n] || 0) + pagati[k].cents / 100;
      });
      if (senzaAcquirente) m2['—'] = (m2['—'] || 0) + senzaAcquirente / 100;
      return Object.keys(m2).map((name) => ({ name, total: m2[name] })).sort((a, b) => b.total - a.total);
    })();
    const sconosciuti = (lista) => {
      const out = lista.map((u) => ({ ...u }));
      Object.keys(pagati).forEach((k) => {
        if (membri.has(k)) return;
        const gia = out.find((u) => norm(u.name) === k);
        if (gia) gia.paid += pagati[k].cents / 100;
        else out.push({ name: pagati[k].name, paid: pagati[k].cents / 100 });
      });
      return out;
    };
    const comune = {
      settlement: settlementComune,
      transfers: pareggia(settlementComune, 'comune'),
      byBuyer,
      unattributed: vecchia.unattributed + senzaAcquirente / 100,
      unknownBuyers: sconosciuti(vecchia.unknownBuyers),
    };

    // Le viste d'insieme, rifatte allo stesso modo di conti.js.
    const settlement = aggiungi(t.settlement, pagati, dovuti);
    const buchi = senzaNessuno
      ? t.buchi.concat([{ cassa: 'comune', quanto: senzaNessuno / 100, perche: 'buchi.fraAlcuniSenzaNessuno' }])
      : t.buchi;
    const breakdown = t.breakdown.map((b) => {
      const c = perPersona[b.id] || 0;
      if (!c) return { ...b, payAlcuni: 0 };
      return { ...b, payAlcuni: c / 100, owed: b.owed + c / 100, pay: (b.payCents + c) / 100, payCents: b.payCents + c };
    });
    const nonRipartito = t.nonRipartito + senzaNessuno / 100;
    return {
      ...t,
      overallTotal: t.overallTotal + totale / 100,
      collected: t.collected + (totale - senzaNessuno) / 100,
      nonRipartito,
      nonRipartitoComune: t.nonRipartitoComune + senzaNessuno / 100,
      buchi,
      breakdown,
      casse: { ...t.casse, comune },
      settlement,
      transfers: [...comune.transfers, ...t.casse.separata.transfers],
      transfersOttimizzati: pareggia(settlement, 'tutte'),
      unattributed: comune.unattributed + t.casse.separata.unattributed,
      unknownBuyers: sconosciuti(t.unknownBuyers),
      byBuyer: (() => {
        const m2 = {};
        [...comune.byBuyer, ...t.casse.separata.byBuyer].forEach((b) => { m2[b.name] = (m2[b.name] || 0) + b.total; });
        return Object.keys(m2).map((name) => ({ name, total: m2[name] })).sort((a, b) => b.total - a.total);
      })(),
      fraAlcuni: { totale: totale / 100, voci: elenco, perPersona },
    };
  }

  // Tutto insieme, nell'ordine giusto: e' quello che chiamano l'app e la
  // Panoramica, cosi' non possono dividere in due modi diversi.
  //   purchases, equipment: gia' passati da Voci.separa.
  function calcola(dati) {
    const s = separa(dati.purchases);
    const t = root.Conti.calcola({ ...dati, purchases: s.comuni });
    return applica(t, s.fraAlcuni, dati.members);
  }

  root.FraAlcuni = { separa, quote, applica, calcola };
})(typeof window !== 'undefined' ? window : globalThis);
