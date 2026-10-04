// La cassa del campo: le entrate accanto alle uscite (4 ottobre).
//
// Un campo scout non divide le spese fra chi ha mangiato: incassa una quota
// dalle famiglie — fissa, decisa prima —, magari un contributo del gruppo, e
// poi spende. Al cassiere servono quattro numeri: quanto doveva entrare,
// quanto e' entrato, quanto si e' speso, quanto avanza. E un rendiconto da
// consegnare al tesoriere del gruppo, non un messaggio WhatsApp.
//
// La cassa NON tocca i conti. Le quote dei Saldi restano quello che sono —
// chi ha anticipato, chi deve —; la cassa racconta i soldi entrati, che sono
// un'altra domanda. E' la stessa distanza che c'e' fra un compito e una spesa.
//
// Pura, fuori da src/: si prova coi numeri (test/unita/cassa.js).
(function (root) {
  'use strict';

  const lista = (v) => (Array.isArray(v) ? v : []);
  const cifra = (v) => {
    const n = Number(v);
    return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  };
  const tondo = (n) => Math.round((Number(n) || 0) * 100) / 100;

  // Un incasso: { id, chi (id del membro, o vuoto), da (chi, se non e' un
  // membro: «Contributo del gruppo»), quanto, nota, at }.
  function riassunto({ incassi, members, totali, fuoriConto }) {
    const membri = lista(members);
    const voci = lista(incassi).filter((x) => x && cifra(x.quanto) > 0);
    const versatoDa = {};
    voci.forEach((x) => { if (x.chi) versatoDa[x.chi] = (versatoDa[x.chi] || 0) + cifra(x.quanto); });
    // Le quote previste: una per persona, scritta sul membro (m.quota). Chi
    // non ne ha una non e' «in ritardo»: semplicemente non gli si chiede
    // niente — vale per i capi, che spesso non pagano.
    const persone = membri.map((m) => {
      const previsto = cifra(m.quota);
      const versato = tondo(versatoDa[m.id] || 0);
      return { id: m.id, name: m.name, previsto, versato, manca: tondo(Math.max(0, previsto - versato)), oltre: tondo(Math.max(0, versato - previsto)) };
    });
    const entrate = tondo(voci.reduce((n, x) => n + cifra(x.quanto), 0));
    const previste = tondo(persone.reduce((n, p) => n + p.previsto, 0));
    const daIncassare = tondo(persone.reduce((n, p) => n + p.manca, 0));
    // Le uscite sono tutto quello che si e' speso: anche il fuori conto, che
    // non si divide nei Saldi ma dalla cassa esce lo stesso.
    const spese = tondo((totali && totali.overallTotal) || 0);
    const fuori = tondo((fuoriConto && fuoriConto.totale) || 0);
    const uscite = tondo(spese + fuori);
    const altri = tondo(voci.filter((x) => !x.chi).reduce((n, x) => n + cifra(x.quanto), 0));
    return {
      entrate, previste, daIncassare, altri, spese, fuori, uscite,
      saldo: tondo(entrate - uscite),
      // Quello che ci sarebbe in cassa a quote tutte versate: e' la domanda
      // che si fa il cassiere a meta' campo («ci stiamo dentro?»).
      saldoAtteso: tondo(entrate + daIncassare - uscite),
      persone,
      incassi: voci.slice().sort((a, b) => (b.at || 0) - (a.at || 0)),
    };
  }

  // ---------- Il rendiconto ----------
  // Un CSV con il punto e virgola e la virgola dei decimali: e' quello che il
  // foglio di calcolo di un tesoriere italiano apre senza chiedere niente.
  // Le intestazioni e le etichette arrivano gia' tradotte (`t`): un file puro
  // non sa in che lingua verra' letto.
  const cella = (v) => {
    const s = String(v == null ? '' : v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const importo = (n) => tondo(n).toFixed(2).replace('.', ',');
  const giorno = (at) => {
    if (!at) return '';
    const d = new Date(at);
    if (isNaN(d.getTime())) return '';
    const p = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  function rendiconto({ riassunto: r, purchases, equipment, members, t }) {
    const nome = (id) => ((lista(members).find((m) => m.id === id) || {}).name) || '';
    const righe = [[t.tipo, t.data, t.descrizione, t.chi, t.categoria, t.importo]];
    r.incassi.slice().sort((a, b) => (a.at || 0) - (b.at || 0)).forEach((x) => {
      righe.push([t.entrata, giorno(x.at), x.nota || '', x.chi ? nome(x.chi) : (x.da || ''), t.quota, importo(cifra(x.quanto))]);
    });
    lista(purchases).slice().sort((a, b) => (a.at || 0) - (b.at || 0)).forEach((p) => {
      if (!(cifra(p.price) > 0)) return;
      righe.push([t.uscita, giorno(p.at), p.name || '', p.buyer || '', t.tipi[p.type] || t.tipi.alimentare, '-' + importo(cifra(p.price))]);
    });
    lista(equipment).forEach((e) => {
      if (!e || !e.bought || !(cifra(e.price) > 0)) return;
      righe.push([t.uscita, '', e.text || '', e.buyer || '', t.attrezzatura, '-' + importo(cifra(e.price))]);
    });
    righe.push([]);
    righe.push([t.totaleEntrate, '', '', '', '', importo(r.entrate)]);
    righe.push([t.totaleUscite, '', '', '', '', '-' + importo(r.uscite)]);
    righe.push([t.saldo, '', '', '', '', importo(r.saldo)]);
    if (r.daIncassare > 0) righe.push([t.daIncassare, '', '', '', '', importo(r.daIncassare)]);
    return righe.map((x) => x.map(cella).join(';')).join('\r\n') + '\r\n';
  }

  root.Cassa = { riassunto, rendiconto };
})(typeof window !== 'undefined' ? window : globalThis);
