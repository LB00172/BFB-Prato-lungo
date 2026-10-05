// I rimborsi fatti: soldi che si sono mossi davvero (30 settembre).
//
// Prima un rimborso segnato era una spunta sopra un passaggio calcolato, e la
// spunta era legata alla cifra (`Carla→Anna@4000`). Bastava uno scontrino
// dimenticato registrato dopo perche' tutti i passaggi si ricalcolassero: le
// spunte non combaciavano piu' e chi aveva gia' pagato tornava debitore
// dell'intera cifra. Con quattro persone e otto euro in piu', l'app chiedeva
// 76 € di bonifici che nessuno doveva.
//
// Adesso un rimborso segnato e' un PAGAMENTO: entra nel saldo di chi l'ha
// fatto e di chi l'ha ricevuto, e «chi paga chi» mostra solo quello che manca.
// Se dopo cambia una spesa, compare la differenza e basta.
//
// conti.js non si tocca (deve restare identico a main): questo file lavora
// SOPRA i suoi saldi. Le spunte gia' salvate valgono subito come pagamenti,
// perche' la chiave dice gia' tutto — chi, a chi, quanto e in quale cassa.
//
// Le due viste. Un pagamento e' denaro, e vale in tutte e due. Ma le due viste
// non trattano allo stesso modo quello che nessuno paga — i centesimi
// dell'arrotondamento, una spesa senza acquirente, un buco —: per cassa
// restano dove sono, nella vista unica si compensano fra le casse. Quindi:
//   - un pagamento fatto nella vista unica non si puo' spezzare fra le casse
//     senza inventare qualcosa (un bonifico solo puo' aver chiuso un debito di
//     qua e un credito di la'): la vista per cassa lo dice e rimanda a quella;
//   - fatti i pagamenti per cassa, la vista unica rimescolerebbe gli avanzi
//     delle due casse in bonifici che nessuno ha mai visto: rimanda lei.
// Chi paga, paga in una vista; l'altra dice dove guardare.
(function (root) {
  'use strict';

  const norm = (s) => String(s || '').trim().toLowerCase();

  // La chiave di un rimborso. La stessa di sempre, con un'aggiunta: se la
  // stessa chiave c'e' gia' (Carla ha gia' dato 40 € ad Anna, e dopo una
  // correzione le deve di nuovo 40 €), il secondo pagamento prende `#2`.
  // Senza, toccare il secondo annullerebbe il primo.
  function chiave(t) {
    const prefisso = t.cassa === 'separata' ? 'sep:' : t.cassa === 'tutte' ? 'opt:' : '';
    return `${prefisso}${t.from}→${t.to}@${Math.round(t.amount * 100)}`;
  }

  function nuovaChiave(t, settled) {
    const gia = settled || [];
    const base = chiave(t);
    if (gia.indexOf(base) < 0) return base;
    let n = 2;
    while (gia.indexOf(base + '#' + n) >= 0) n++;
    return base + '#' + n;
  }

  // Da una chiave al pagamento. Una chiave che non si legge non vale niente:
  // meglio un rimborso da rifare che un pagamento inventato.
  function leggi(k) {
    const m = /^(sep:|opt:)?(.+?)→(.+)@(\d+)(?:#\d+)?$/.exec(String(k));
    if (!m) return null;
    const cents = Number(m[4]);
    if (!(cents > 0)) return null;
    return {
      chiave: String(k),
      cassa: m[1] === 'sep:' ? 'separata' : m[1] === 'opt:' ? 'tutte' : 'comune',
      from: m[2], to: m[3], cents,
    };
  }

  // Chi paga chi, col minor numero di giri: lo stesso conto di conti.js.
  // E' ricopiato perche' conti.js non lo esporta e non si tocca; che le due
  // copie diano gli stessi passaggi lo controlla unita/rimborsi, su scenari
  // a caso — senza pagamenti, qui deve uscire esattamente quello che esce la'.
  function pareggia(elenco, nomeCassa) {
    const creditori = elenco.filter((s) => s.net > 0.005).map((s) => ({ name: s.name, cents: Math.round(s.net * 100) }));
    const debitori = elenco.filter((s) => s.net < -0.005).map((s) => ({ name: s.name, cents: Math.round(-s.net * 100) }));
    const passaggi = [];
    let ci = 0, di = 0;
    while (ci < creditori.length && di < debitori.length) {
      const amt = Math.min(creditori[ci].cents, debitori[di].cents);
      if (amt > 0) passaggi.push({ from: debitori[di].name, to: creditori[ci].name, amount: amt / 100, cassa: nomeCassa });
      creditori[ci].cents -= amt;
      debitori[di].cents -= amt;
      if (creditori[ci].cents === 0) ci++;
      if (debitori[di].cents === 0) di++;
    }
    return passaggi;
  }

  // I saldi dopo i pagamenti: chi ha pagato ha un debito in meno, chi ha
  // ricevuto un credito in meno. Chi compare solo in un pagamento (un membro
  // tolto dopo) entra con saldo zero, cosi' il pagamento non si perde.
  function sconta(settlement, pagamenti) {
    const per = {};
    const ordine = [];
    (settlement || []).forEach((s) => {
      const k = norm(s.name);
      if (!per[k]) { per[k] = { name: s.name, net: 0 }; ordine.push(k); }
      per[k].net += s.net;
    });
    pagamenti.forEach((p) => {
      [[p.from, p.cents / 100], [p.to, -p.cents / 100]].forEach(([nome, d]) => {
        const k = norm(nome);
        if (!per[k]) { per[k] = { name: nome, net: 0 }; ordine.push(k); }
        per[k].net += d;
      });
    });
    // Ordinamento stabile: senza pagamenti l'ordine resta quello di conti.js,
    // e quindi restano gli stessi passaggi.
    return ordine.map((k) => per[k]).sort((a, b) => b.net - a.net);
  }

  const fatto = (p) => ({ chiave: p.chiave, from: p.from, to: p.to, amount: p.cents / 100, cassa: p.cassa });

  // Quello che manca, vista per vista. `totali` e' il risultato di
  // Conti.calcola, `settled` l'elenco delle chiavi segnate.
  //   comune, separata: la vista per cassa;
  //   tutte: la vista unica, che sconta ogni pagamento;
  //   unica: ci sono pagamenti fatti nella vista unica, che la vista per
  //          cassa non sa spezzare: quanto manca lo dice la vista unica;
  //   perCassa: ci sono solo pagamenti fatti per cassa: lo dice quella.
  function residui(totali, settled) {
    const pagamenti = (settled || []).map(leggi).filter(Boolean);
    const casse = (totali && totali.casse) || {};
    const comune = casse.comune || { settlement: [] };
    const separata = casse.separata || { settlement: [] };
    const di = (c) => pagamenti.filter((p) => p.cassa === c);
    // Con una cassa sola le due viste sono la stessa cosa: un pagamento della
    // vista unica e' un pagamento della cassa comune, e non c'e' niente da
    // spezzare.
    const sepVuota = separata.settlement.length === 0 && di('separata').length === 0;
    const perComune = sepVuota ? di('comune').concat(di('tutte')) : di('comune');
    const unica = !sepVuota && di('tutte').length > 0;
    const perCassa = !sepVuota && !unica && (di('comune').length > 0 || di('separata').length > 0);
    return {
      comune: { transfers: pareggia(sconta(comune.settlement, perComune), 'comune'), fatti: perComune.map(fatto) },
      separata: { transfers: pareggia(sconta(separata.settlement, di('separata')), 'separata'), fatti: di('separata').map(fatto) },
      tutte: { transfers: pareggia(sconta(totali && totali.settlement, pagamenti), 'tutte'), fatti: pagamenti.map(fatto) },
      unica,
      perCassa,
    };
  }

  // Quale vista sa quanto manca: quella in cui si e' pagato, e senza
  // pagamenti quella che si preferisce.
  function vistaUnica(r, preferita) {
    return r.unica || (!!preferita && !r.perCassa);
  }

  // I rimborsi ancora da fare, nella vista che sa quanto manca. La usano la
  // chiusura del campo, il resoconto e la Panoramica.
  function daFare(r, preferita) {
    return vistaUnica(r, preferita) ? r.tutte.transfers : r.comune.transfers.concat(r.separata.transfers);
  }

  // Il link per pagare con PayPal, con la cifra gia' scritta. Solo per gli
  // indirizzi paypal.me: e' PayPal stesso a leggere la cifra dal link
  // (paypal.me/nome/12.50EUR). Un'email PayPal non ha un link cosi', e si
  // copia come prima. Niente passa da noi: il link lo apre il telefono.
  function linkPaypal(valore, cifra) {
    const v = String(valore || '').trim();
    const m = /^(?:https?:\/\/)?(?:www\.)?paypal\.me\/([A-Za-z0-9._-]{1,40})\/?$/i.exec(v);
    const n = Number(cifra);
    if (!m || !isFinite(n) || n <= 0) return null;
    return `https://paypal.me/${m[1]}/${(Math.round(n * 100) / 100).toFixed(2)}EUR`;
  }

  root.Rimborsi = { chiave, nuovaChiave, leggi, pareggia, sconta, residui, vistaUnica, daFare, linkPaypal };
})(typeof window !== 'undefined' ? window : globalThis);
