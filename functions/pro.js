// Il Pro, dal lato del server: chi paga, cosa gli si da', fino a quando.
//
// E' l'unico posto da cui il Pro si accende. Le regole Firestore vietano a
// ogni telefono di scriverlo, proprietario compreso (test/regole/stanze.js,
// § 8): lo scrive questo codice, che gira su Firebase con l'identita' del
// suo account di servizio e verifica l'acquisto chiedendolo a Google Play.
//
// Qui dentro non c'e' Firebase e non c'e' Google: solo le decisioni, e le
// dipendenze arrivano da fuori (`dip`). index.js le collega al mondo vero;
// test/unita/server-pro.js le sostituisce con dei finti e prova le decisioni
// sui numeri. E' la stessa divisione di stanza.js e auth.js: le regole da una
// parte, il trasporto dall'altra.
//
// Le decisioni di Lorenzo (28 settembre):
//   - due modi di pagare: una tantum per un campo, oppure l'abbonamento
//     annuale del capogruppo;
//   - una tantum: il campo e' Pro fino a TRE MESI dopo la sua fine;
//   - abbonamento: tutti i campi di cui si e' capogruppo sono Pro finche'
//     l'abbonamento e' pagato, anche quelli creati dopo;
//   - il Pro e' del CAMPO: sta nel documento della stanza, e passando il
//     campo all'aiutante si spegne (lo fa il telefono, ed e' l'unica
//     scrittura che le regole gli permettono sul Pro: toglierlo).
'use strict';

// Gli identificativi dei prodotti in Play Console. Si scrivono UGUALI la':
// un nome diverso e Play risponde «prodotto sconosciuto».
const PRODOTTI = { campo: 'pro_campo', anno: 'pro_anno' };
const MESI_DOPO_LA_FINE = 3;

const GIORNO = /^\d{4}-\d{2}-\d{2}$/;
const due = (n) => String(n).padStart(2, '0');
const dataDi = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${due(d.getUTCMonth() + 1)}-${due(d.getUTCDate())}`;
};

// «Tre mesi dopo il 31 agosto» e' il 30 novembre, non il 1° dicembre: se il
// mese d'arrivo e' piu' corto, ci si ferma al suo ultimo giorno.
function aggiungiMesi(giorno, mesi) {
  const [a, m, g] = giorno.split('-').map(Number);
  const indice = (m - 1) + mesi;
  const anno = a + Math.floor(indice / 12);
  const mese = ((indice % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(anno, mese + 1, 0)).getUTCDate();
  return `${anno}-${due(mese + 1)}-${due(Math.min(g, ultimo))}`;
}

// Fino a quando vale il Pro pagato per un campo: tre mesi dopo la sua fine.
// Un campo gia' finito, o senza date, conta da oggi: chi paga adesso deve
// avere tre mesi davanti, non un Pro gia' scaduto.
function finoPerCampo(fine, oggi) {
  const base = GIORNO.test(fine || '') && fine > oggi ? fine : oggi;
  return aggiungiMesi(base, MESI_DOPO_LA_FINE);
}

// `fino` e' il giorno compreso ('AAAA-MM-GG', quello che legge l'app).
// `scade` e' l'istante in cui smette di valere, che serve alle regole
// Firestore: un testo non lo sanno confrontare. Mezzanotte UTC del giorno
// dopo: in Italia qualche ora di margine, a favore di chi ha pagato.
function scadeDa(fino) {
  const [a, m, g] = fino.split('-').map(Number);
  return Date.UTC(a, m - 1, g + 1);
}

// Di due Pro si tiene quello che dura di piu'. Chi ha un abbonamento e paga
// anche un campo, o rinnova, non deve mai ritrovarsi con meno di prima.
// Senza `scade` un Pro non scade (quello dei campi di prova).
function piuLungo(a, b) {
  const vale = (p) => !!(p && p.attivo === true);
  if (!vale(a)) return vale(b) ? b : null;
  if (!vale(b)) return a;
  const fine = (p) => (typeof p.scade === 'number' ? p.scade : Infinity);
  return fine(b) > fine(a) ? b : a;
}

function proDaAbbonamento(scade) {
  return { attivo: true, fino: dataDi(scade - 1), scade, fonte: 'anno' };
}

// ---------- Cosa risponde Google Play ----------
// purchases.products.get: purchaseState 0 = pagato, 1 = annullato,
// 2 = in attesa (un bonifico, un contante al tabaccaio). Solo il pagato vale.
function leggiAcquisto(r) {
  if (!r) return { ok: false, motivo: 'acquisto-sconosciuto' };
  if (r.purchaseState === 2) return { ok: false, motivo: 'pagamento-in-attesa' };
  if (r.purchaseState !== 0) return { ok: false, motivo: 'acquisto-annullato' };
  return { ok: true, ordine: r.orderId || '', prova: r.purchaseType === 0, confermato: r.acknowledgementState === 1 };
}

// purchases.subscriptionsv2.get. Vale finche' e' pagato: attivo, nel periodo
// di tolleranza di un rinnovo non riuscito, oppure disdetto ma con il periodo
// gia' pagato ancora in corso — chi disdice a marzo ha pagato fino a giugno.
const STATI_BUONI = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'];
function leggiAbbonamento(r, ora) {
  if (!r || !Array.isArray(r.lineItems)) return { ok: false, motivo: 'acquisto-sconosciuto' };
  const voce = r.lineItems.find((v) => v && v.productId === PRODOTTI.anno);
  if (!voce) return { ok: false, motivo: 'prodotto-sbagliato' };
  const scade = Date.parse(voce.expiryTime || '');
  if (!isFinite(scade) || scade <= ora) return { ok: false, motivo: 'abbonamento-scaduto' };
  if (STATI_BUONI.indexOf(r.subscriptionState) < 0) return { ok: false, motivo: 'abbonamento-non-attivo' };
  return {
    ok: true, scade, ordine: r.latestOrderId || '', stato: r.subscriptionState,
    confermato: r.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
  };
}

const errore = (motivo) => ({ ok: false, motivo });

// ---------- Attivare il Pro: la chiamata dall'app ----------
// Il telefono manda il gettone dell'acquisto che Play gli ha dato, e dice per
// quale campo. Il server non si fida di niente di quello che arriva: chi
// chiede lo dice l'autenticazione (uid), se e' il capogruppo lo dice la
// stanza, se ha pagato lo dice Google.
//
// dip = {
//   ora(),                                  millisecondi
//   leggiStanza(codice)                     { proprietario, fine, pro } | null
//   leggiRegistro(token)                    { uid, codice, prodotto } | null
//   concedi({ token, registro, pro: { codice: pro } }) -> true | false
//                                           in UNA transazione: se il gettone
//                                           e' gia' registrato per altro,
//                                           false e non si scrive niente
//   stanzeDi(uid)                           [{ codice, pro }]
//   scriviPro({ codice: pro | null })       per le notifiche: null lo toglie
//   salvaAbbonato(uid, abbonamento)
//   play: { prodotto(sku, token), confermaProdotto(sku, token),
//           abbonamento(token), confermaAbbonamento(sku, token) }
// }
async function attiva(richiesta, dip) {
  const { uid, codice, token, prodotto } = richiesta || {};
  if (!uid) return errore('non-autenticato');
  if (!token || !prodotto || (prodotto === PRODOTTI.campo && !codice)) return errore('richiesta-incompleta');
  if (prodotto !== PRODOTTI.campo && prodotto !== PRODOTTI.anno) return errore('prodotto-sconosciuto');

  // Un gettone vale una volta. Se e' gia' stato usato da questa stessa
  // persona per questo stesso campo, e' la stessa richiesta ripetuta (la
  // rete e' caduta a meta'): si risponde di nuovo di si', senza rifare.
  const gia = await dip.leggiRegistro(token);
  if (gia && (gia.uid !== uid || gia.prodotto !== prodotto || (prodotto === PRODOTTI.campo && gia.codice !== codice))) {
    return errore('gettone-gia-usato');
  }

  const oggi = dataDi(dip.ora());

  if (prodotto === PRODOTTI.campo) {
    const stanza = await dip.leggiStanza(codice);
    if (!stanza) return errore('stanza-inesistente');
    // Il Pro lo paga il capogruppo, per il SUO campo. Un membro che paga
    // per il campo di un altro non e' vietato dal buon senso, ma lo e' da
    // questa decisione: il Pro e' di chi il campo lo guida.
    if (stanza.proprietario !== uid) return errore('non-capogruppo');
    const esito = leggiAcquisto(await dip.play.prodotto(prodotto, token));
    if (!esito.ok) return errore(esito.motivo);
    // La conferma a Google va fatta: un acquisto non confermato entro tre
    // giorni Play lo rimborsa da solo. Si fa DOPO la concessione — se cade
    // qui, il telefono richiama, e al secondo giro si arriva qui sotto.
    const conferma = () => (esito.confermato ? null : dip.play.confermaProdotto(prodotto, token));
    if (gia) { await conferma(); return { ok: true, fino: (stanza.pro && stanza.pro.fino) || '' }; }
    const fino = finoPerCampo(stanza.fine, oggi);
    const nuovo = { attivo: true, fino, scade: scadeDa(fino), fonte: 'campo', ordine: esito.ordine };
    const pro = piuLungo(stanza.pro, nuovo);
    const fatto = await dip.concedi({
      token,
      registro: { uid, codice, prodotto, ordine: esito.ordine, prova: esito.prova, quando: dip.ora() },
      pro: { [codice]: pro },
    });
    if (!fatto) return errore('gettone-gia-usato');
    await conferma();
    return { ok: true, fino: pro.fino };
  }

  // L'abbonamento: vale per ogni campo di cui si e' capogruppo, adesso e poi.
  const esito = leggiAbbonamento(await dip.play.abbonamento(token), dip.ora());
  if (!esito.ok) return errore(esito.motivo);
  const conferma = () => (esito.confermato ? null : dip.play.confermaAbbonamento(prodotto, token));
  const nuovo = proDaAbbonamento(esito.scade);
  if (gia) { await conferma(); return { ok: true, fino: nuovo.fino }; }
  const pro = {};
  (await dip.stanzeDi(uid)).forEach((s) => { pro[s.codice] = piuLungo(s.pro, nuovo); });
  const fatto = await dip.concedi({
    token,
    registro: { uid, prodotto, ordine: esito.ordine, quando: dip.ora() },
    pro,
  });
  if (!fatto) return errore('gettone-gia-usato');
  await dip.salvaAbbonato(uid, { scade: esito.scade, token, stato: esito.stato });
  await conferma();
  return { ok: true, fino: nuovo.fino, campi: Object.keys(pro).length };
}

// ---------- Un campo nuovo di chi e' abbonato ----------
// L'abbonamento copre anche i campi creati dopo: alla nascita della stanza,
// se chi l'ha creata ha un abbonamento in corso, il Pro c'e' gia'.
function proPerStanzaNuova(abbonato, ora) {
  if (!abbonato || typeof abbonato.scade !== 'number' || abbonato.scade <= ora) return null;
  return proDaAbbonamento(abbonato.scade);
}

// ---------- Le notifiche di Google Play ----------
// Play avvisa (Real-time developer notifications, via Pub/Sub) quando un
// abbonamento si rinnova, si disdice, viene revocato, o quando un acquisto
// viene rimborsato. Il messaggio non si crede: si rilegge da Google lo stato
// vero del gettone, come per la prima attivazione.
//
// Cosa fa:
//   - rinnovo (o qualunque cambio): si rilegge l'abbonamento e, se vale, il
//     Pro dei campi del capogruppo si allunga;
//   - revoca o rimborso: il Pro che veniva da li' si spegne subito.
// La scadenza naturale non ha bisogno di niente: `scade` passa, e le regole
// e l'app smettono di contarlo da sole.
const REVOCATO = 12; // SUBSCRIPTION_REVOKED
async function notifica(messaggio, dip) {
  const m = messaggio || {};
  const sub = m.subscriptionNotification;
  const annullato = m.voidedPurchaseNotification;
  const token = (sub && sub.purchaseToken) || (annullato && annullato.purchaseToken);
  if (!token) return { fatto: 'niente' };
  const registro = await dip.leggiRegistro(token);
  // Un gettone che non abbiamo mai visto: l'app non ha ancora chiamato
  // attiva (lo fara', e li' si decide). Non si concede niente da qui.
  if (!registro) return { fatto: 'sconosciuto' };

  const togli = async (quale) => {
    const pro = {};
    (await dip.stanzeDi(registro.uid)).forEach((s) => { if (quale(s)) pro[s.codice] = null; });
    await dip.scriviPro(pro);
    return Object.keys(pro).length;
  };

  if (annullato || (sub && sub.notificationType === REVOCATO)) {
    if (registro.prodotto === PRODOTTI.campo) {
      // Si spegne il Pro di QUEL campo, e solo se e' ancora quello pagato con
      // questo ordine: se nel frattempo e' arrivato un abbonamento, resta.
      const n = await togli((s) => s.codice === registro.codice && s.pro && s.pro.ordine === registro.ordine);
      return { fatto: 'rimborso', campi: n };
    }
    const n = await togli((s) => s.pro && s.pro.fonte === 'anno');
    await dip.salvaAbbonato(registro.uid, { scade: dip.ora(), token, stato: 'REVOCATO' });
    return { fatto: 'revoca', campi: n };
  }

  if (sub && registro.prodotto === PRODOTTI.anno) {
    const esito = leggiAbbonamento(await dip.play.abbonamento(token), dip.ora());
    if (!esito.ok) return { fatto: 'non-vale', motivo: esito.motivo };
    await dip.salvaAbbonato(registro.uid, { scade: esito.scade, token, stato: esito.stato });
    const nuovo = proDaAbbonamento(esito.scade);
    const pro = {};
    (await dip.stanzeDi(registro.uid)).forEach((s) => { pro[s.codice] = piuLungo(s.pro, nuovo); });
    await dip.scriviPro(pro);
    return { fatto: 'rinnovo', campi: Object.keys(pro).length, fino: nuovo.fino };
  }
  return { fatto: 'niente' };
}

module.exports = {
  PRODOTTI, MESI_DOPO_LA_FINE,
  aggiungiMesi, finoPerCampo, scadeDa, piuLungo, proDaAbbonamento, dataDi,
  leggiAcquisto, leggiAbbonamento,
  attiva, proPerStanzaNuova, notifica,
};
