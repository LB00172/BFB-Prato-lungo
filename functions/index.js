// Il server del Pro su Firebase: tre funzioni, e nessuna decisione.
//
// Le decisioni stanno in pro.js (provate da test/unita/server-pro.js). Qui si
// collega: Firestore con l'SDK di amministrazione, Google Play con la sua API
// REST. E si traduce: il Pro in pro.js ha `scade` in millisecondi, nel
// database e' un Timestamp — perche' le regole Firestore lo confrontano con
// l'ora del server (proAttivo in firestore.rules), e un numero non lo sanno
// confrontare con un'ora.
//
// NESSUNA CHIAVE. Le funzioni girano con l'identita' del loro account di
// servizio, che Google da' da solo: e' quello che si autorizza in Play
// Console (PLAY-STORE.md, «Il server del Pro»). Un file di chiave qui dentro
// non ci deve mai entrare (CLAUDE.md, regola 3).
'use strict';
const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onMessagePublished } = require('firebase-functions/v2/pubsub');
const { defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { GoogleAuth } = require('google-auth-library');
const Pro = require('./pro');

initializeApp();
const db = getFirestore();

// Il database sta a Torino (europe-west12): le funzioni gli stanno accanto,
// e il trigger sulle stanze nuove deve per forza stare nella sua regione.
const REGIONE = 'europe-west12';
// Il nome del pacchetto Android, quello della scheda Play (es.
// app.campops.twa). Si chiede al primo `firebase deploy`, e resta in
// functions/.env.<progetto> — che non e' un segreto, ma sta fuori da git con
// gli altri .env.
const PACCHETTO = defineString('PACCHETTO_ANDROID');
// Il nome dell'argomento Pub/Sub che si indica in Play Console per le
// notifiche in tempo reale.
const ARGOMENTO_PLAY = 'play-billing';

// ---------- Google Play ----------
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
async function chiedi(metodo, percorso) {
  const client = await auth.getClient();
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACCHETTO.value()}/purchases`;
  try {
    const r = await client.request({ url: base + percorso, method: metodo });
    return r.data || {};
  } catch (e) {
    // 404/400: il gettone non esiste per Google. Non e' un guasto: e' un no.
    const stato = e && e.response && e.response.status;
    if (stato === 404 || stato === 400 || stato === 410) return null;
    throw e;
  }
}
const play = {
  prodotto: (sku, token) => chiedi('GET', `/products/${sku}/tokens/${encodeURIComponent(token)}`),
  confermaProdotto: (sku, token) => chiedi('POST', `/products/${sku}/tokens/${encodeURIComponent(token)}:acknowledge`),
  abbonamento: (token) => chiedi('GET', `/subscriptionsv2/tokens/${encodeURIComponent(token)}`),
  confermaAbbonamento: (sku, token) => chiedi('POST', `/subscriptions/${sku}/tokens/${encodeURIComponent(token)}:acknowledge`),
};

// ---------- Firestore ----------
// Il registro dei gettoni e gli abbonati stanno in raccolte che le regole
// chiudono a tutti i telefoni (il diniego in fondo a firestore.rules): li
// legge e scrive solo il server. Il gettone non si usa come nome del
// documento: e' lungo e non e' fatto per stare in un percorso.
const idGettone = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const registroDi = (token) => db.collection('acquisti').doc(idGettone(token));

const daDb = (p) => {
  if (!p) return null;
  const out = Object.assign({}, p);
  if (p.scade && typeof p.scade.toMillis === 'function') out.scade = p.scade.toMillis();
  return out;
};
const perDb = (p) => {
  if (!p) return FieldValue.delete();
  const out = Object.assign({}, p);
  if (typeof p.scade === 'number') out.scade = Timestamp.fromMillis(p.scade);
  return out;
};

const dip = {
  ora: () => Date.now(),
  leggiStanza: async (codice) => {
    const s = await db.collection('rooms').doc(String(codice)).get();
    if (!s.exists) return null;
    const d = s.data();
    return { proprietario: d.proprietario, fine: d.fine || '', pro: daDb(d.pro) };
  },
  leggiRegistro: async (token) => {
    const s = await registroDi(token).get();
    return s.exists ? s.data() : null;
  },
  // Registro e Pro in una transazione sola: due richieste con lo stesso
  // gettone non possono passare tutte e due.
  concedi: ({ token, registro, pro }) => db.runTransaction(async (t) => {
    const rif = registroDi(token);
    if ((await t.get(rif)).exists) return false;
    t.set(rif, registro);
    Object.keys(pro).forEach((c) => t.update(db.collection('rooms').doc(c), { pro: perDb(pro[c]) }));
    return true;
  }),
  scriviPro: async (pro) => {
    const lotto = db.batch();
    Object.keys(pro).forEach((c) => lotto.update(db.collection('rooms').doc(c), { pro: perDb(pro[c]) }));
    await lotto.commit();
  },
  stanzeDi: async (uid) => {
    const q = await db.collection('rooms').where('proprietario', '==', uid).get();
    return q.docs.map((d) => ({ codice: d.id, pro: daDb(d.data().pro) }));
  },
  salvaAbbonato: (uid, a) => db.collection('abbonati').doc(uid).set(a),
  play,
};

// ---------- 1. L'app attiva il Pro dopo un acquisto ----------
exports.attivaPro = onCall({ region: REGIONE }, async (req) => {
  const uid = req.auth && req.auth.uid;
  const d = req.data || {};
  const esito = await Pro.attiva({ uid, codice: d.codice, token: d.token, prodotto: d.prodotto }, dip);
  // Il motivo torna all'app come codice: la frase la sceglie lei, nella
  // lingua di chi guarda (lingue.js, 'pro.errore.*').
  if (!esito.ok) throw new HttpsError('failed-precondition', esito.motivo, { motivo: esito.motivo });
  return esito;
});

// ---------- 2. Un campo nuovo di chi e' abbonato nasce Pro ----------
exports.proAlCampoNuovo = onDocumentCreated({ region: REGIONE, document: 'rooms/{codice}' }, async (evento) => {
  const stanza = evento.data && evento.data.data();
  if (!stanza || !stanza.proprietario) return;
  const a = await db.collection('abbonati').doc(stanza.proprietario).get();
  const pro = Pro.proPerStanzaNuova(a.exists ? a.data() : null, Date.now());
  if (pro) await evento.data.ref.update({ pro: perDb(pro) });
});

// ---------- 3. Le notifiche di Google Play ----------
exports.notifichePlay = onMessagePublished({ region: REGIONE, topic: ARGOMENTO_PLAY }, async (evento) => {
  const messaggio = evento.data && evento.data.message && evento.data.message.json;
  // Play manda anche un messaggio di prova quando si configura l'argomento.
  if (!messaggio || messaggio.testNotification) return;
  if (messaggio.packageName && messaggio.packageName !== PACCHETTO.value()) return;
  await Pro.notifica(messaggio, dip);
});
