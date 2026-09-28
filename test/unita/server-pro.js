// Il server del Pro: chi paga, cosa gli si da', fino a quando.
//
// functions/pro.js e' la parte che decide; qui Google Play e Firestore sono
// finti, e si prova ogni decisione sui numeri: la data di scadenza, chi puo'
// attivare, un gettone che vale una volta sola, l'abbonamento che copre i
// campi di dopo, il rimborso che spegne. La parte che collega (index.js) e'
// trasporto: la prova vera e' comprare davvero, in test chiuso su Play.
const path = require('path');
const { ok, fine } = require('../lib/app');
const P = require(path.resolve(__dirname, '..', '..', 'functions', 'pro.js'));

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ORA = Date.UTC(2027, 6, 13, 10, 0);        // 13 luglio 2027, mattina
const TRA = (giorni) => ORA + giorni * 86400000;

// ---------- Le date ----------
ok('tre mesi dopo il 16 agosto è il 16 novembre', P.aggiungiMesi('2027-08-16', 3) === '2027-11-16');
ok('tre mesi dopo il 31 agosto è il 30 novembre, non il 1° dicembre', P.aggiungiMesi('2027-08-31', 3) === '2027-11-30');
ok('e dopo il 30 novembre si passa d\'anno', P.aggiungiMesi('2027-11-30', 3) === '2028-02-29');
ok('il Pro di un campo vale fino a tre mesi dopo la sua fine', P.finoPerCampo('2027-08-16', '2027-07-13') === '2027-11-16');
ok('un campo già finito conta da oggi: chi paga ha tre mesi davanti', P.finoPerCampo('2027-06-01', '2027-07-13') === '2027-10-13');
ok('e anche un campo senza date', P.finoPerCampo('', '2027-07-13') === '2027-10-13' && P.finoPerCampo(undefined, '2027-07-13') === '2027-10-13');
ok('«fino al 16 novembre» vale per tutto il 16', P.scadeDa('2027-11-16') === Date.UTC(2027, 10, 17));

const campo = (scade) => ({ attivo: true, fino: 'x', scade, fonte: 'campo' });
ok('di due Pro si tiene il più lungo', P.piuLungo(campo(10), campo(20)).scade === 20 && P.piuLungo(campo(20), campo(10)).scade === 20);
ok('uno spento non vince mai', P.piuLungo({ attivo: false, scade: 99 }, campo(10)).scade === 10);
ok('senza scadenza è il più lungo di tutti', P.piuLungo({ attivo: true }, campo(10)).scade === undefined);
ok('senza niente, niente', P.piuLungo(null, null) === null);

// ---------- Cosa dice Google ----------
ok('un acquisto pagato vale', P.leggiAcquisto({ purchaseState: 0, orderId: 'GPA.1' }).ok === true);
ok('uno in attesa di pagamento no', P.leggiAcquisto({ purchaseState: 2 }).motivo === 'pagamento-in-attesa');
ok('uno annullato no', P.leggiAcquisto({ purchaseState: 1 }).motivo === 'acquisto-annullato');
const abb = (stato, scade, prodotto) => ({ subscriptionState: stato, latestOrderId: 'GPA.9', lineItems: [{ productId: prodotto || 'pro_anno', expiryTime: new Date(scade).toISOString() }] });
ok('un abbonamento attivo vale', P.leggiAbbonamento(abb('SUBSCRIPTION_STATE_ACTIVE', TRA(365)), ORA).ok === true);
ok('uno disdetto vale fino alla fine del periodo pagato', P.leggiAbbonamento(abb('SUBSCRIPTION_STATE_CANCELED', TRA(100)), ORA).ok === true);
ok('uno scaduto no', P.leggiAbbonamento(abb('SUBSCRIPTION_STATE_EXPIRED', TRA(-1)), ORA).motivo === 'abbonamento-scaduto');
ok('uno sospeso no, anche se la data non è passata', P.leggiAbbonamento(abb('SUBSCRIPTION_STATE_ON_HOLD', TRA(10)), ORA).motivo === 'abbonamento-non-attivo');
ok('un altro prodotto non è il nostro abbonamento', P.leggiAbbonamento(abb('SUBSCRIPTION_STATE_ACTIVE', TRA(10), 'altro'), ORA).motivo === 'prodotto-sbagliato');

// ---------- Un mondo finto ----------
// Firestore e Google Play, in memoria. Il registro dei gettoni e la scrittura
// del Pro vanno insieme, come nella transazione vera di index.js.
function mondo() {
  const m = {
    stanze: {
      CAMPOAAA: { proprietario: 'anna', fine: '2027-08-16' },
      CAMPOBBB: { proprietario: 'anna', fine: '2027-09-01' },
      CAMPOCCC: { proprietario: 'bruno', fine: '2027-08-01' },
    },
    registro: {},
    abbonati: {},
    play: { prodotti: {}, abbonamenti: {}, confermati: [] },
  };
  m.dip = {
    ora: () => ORA,
    leggiStanza: async (c) => (m.stanze[c] ? Object.assign({}, m.stanze[c]) : null),
    leggiRegistro: async (t) => m.registro[t] || null,
    concedi: async ({ token, registro, pro }) => {
      if (m.registro[token]) return false;
      m.registro[token] = registro;
      Object.keys(pro).forEach((c) => { m.stanze[c].pro = pro[c]; });
      return true;
    },
    scriviPro: async (pro) => {
      Object.keys(pro).forEach((c) => { if (pro[c]) m.stanze[c].pro = pro[c]; else delete m.stanze[c].pro; });
    },
    stanzeDi: async (uid) => Object.keys(m.stanze).filter((c) => m.stanze[c].proprietario === uid)
      .map((c) => ({ codice: c, pro: m.stanze[c].pro || null })),
    salvaAbbonato: async (uid, a) => { m.abbonati[uid] = a; },
    play: {
      prodotto: async (sku, t) => m.play.prodotti[t] || null,
      // Come Google: una volta confermato, l'acquisto lo dice.
      confermaProdotto: async (sku, t) => { m.play.confermati.push(t); m.play.prodotti[t].acknowledgementState = 1; },
      abbonamento: async (t) => m.play.abbonamenti[t] || null,
      confermaAbbonamento: async (sku, t) => { m.play.confermati.push(t); },
    },
  };
  return m;
}

(async () => {
  // ---------- Una tantum: un campo ----------
  {
    const m = mondo();
    m.play.prodotti.T1 = { purchaseState: 0, orderId: 'GPA.1' };
    let r = await P.attiva({ uid: 'anna', codice: 'CAMPOAAA', token: 'T1', prodotto: 'pro_campo' }, m.dip);
    ok(`il capogruppo che ha pagato ha il campo Pro fino a tre mesi dopo la fine (${JSON.stringify(r)})`,
      r.ok && r.fino === '2027-11-16' && m.stanze.CAMPOAAA.pro.fino === '2027-11-16');
    ok('con la scadenza vera che leggono le regole', m.stanze.CAMPOAAA.pro.scade === Date.UTC(2027, 10, 17));
    ok('e l\'acquisto viene confermato a Google (altrimenti lo rimborsa da sé)', eq(m.play.confermati, ['T1']));
    ok('solo quel campo: gli altri suoi restano com\'erano', !m.stanze.CAMPOBBB.pro);

    // La conferma a Google era caduta: la richiesta ripetuta la rifà.
    delete m.play.prodotti.T1.acknowledgementState;
    m.play.confermati = [];
    r = await P.attiva({ uid: 'anna', codice: 'CAMPOAAA', token: 'T1', prodotto: 'pro_campo' }, m.dip);
    ok(`la stessa richiesta ripetuta (la rete era caduta) risponde di sì (${JSON.stringify(r)})`, r.ok === true && r.fino === '2027-11-16');
    ok('e rifà la conferma a Google che era mancata', eq(m.play.confermati, ['T1']));
    r = await P.attiva({ uid: 'anna', codice: 'CAMPOBBB', token: 'T1', prodotto: 'pro_campo' }, m.dip);
    ok('ma lo stesso gettone non rende Pro un secondo campo', r.motivo === 'gettone-gia-usato' && !m.stanze.CAMPOBBB.pro);
    r = await P.attiva({ uid: 'bruno', codice: 'CAMPOCCC', token: 'T1', prodotto: 'pro_campo' }, m.dip);
    ok('né un campo di un altro', r.motivo === 'gettone-gia-usato' && !m.stanze.CAMPOCCC.pro);

    // Anna e' gia' abbonata (il Pro di CAMPOBBB dura un anno) e compra lo
    // stesso anche il Pro del solo campo, che durerebbe meno: non deve
    // ritrovarsi con meno di prima.
    m.stanze.CAMPOBBB.pro = { attivo: true, fino: '2028-07-12', scade: TRA(365), fonte: 'anno' };
    m.play.prodotti.T4 = { purchaseState: 0, orderId: 'GPA.4' };
    r = await P.attiva({ uid: 'anna', codice: 'CAMPOBBB', token: 'T4', prodotto: 'pro_campo' }, m.dip);
    ok(`comprare un Pro più corto non accorcia quello che c'è (${m.stanze.CAMPOBBB.pro.fino})`,
      r.ok && m.stanze.CAMPOBBB.pro.scade === TRA(365));
    delete m.stanze.CAMPOBBB.pro;
    m.play.confermati = m.play.confermati.filter((t) => t !== 'T4');

    m.play.prodotti.T2 = { purchaseState: 0, orderId: 'GPA.2' };
    r = await P.attiva({ uid: 'bruno', codice: 'CAMPOAAA', token: 'T2', prodotto: 'pro_campo' }, m.dip);
    ok('chi non è il capogruppo non rende Pro il campo di un altro', r.motivo === 'non-capogruppo');
    r = await P.attiva({ uid: '', codice: 'CAMPOAAA', token: 'T2', prodotto: 'pro_campo' }, m.dip);
    ok('senza essere autenticati non si attiva niente', r.motivo === 'non-autenticato');
    r = await P.attiva({ uid: 'anna', codice: 'NONCE', token: 'T2', prodotto: 'pro_campo' }, m.dip);
    ok('una stanza che non esiste non diventa Pro', r.motivo === 'stanza-inesistente');
    r = await P.attiva({ uid: 'anna', codice: 'CAMPOBBB', token: 'T2', prodotto: 'pro_tutto' }, m.dip);
    ok('un prodotto che non vendiamo non si attiva', r.motivo === 'prodotto-sconosciuto');

    m.play.prodotti.T3 = { purchaseState: 2 };
    r = await P.attiva({ uid: 'anna', codice: 'CAMPOBBB', token: 'T3', prodotto: 'pro_campo' }, m.dip);
    ok('un pagamento ancora in attesa non accende il Pro', r.motivo === 'pagamento-in-attesa' && !m.stanze.CAMPOBBB.pro);
    r = await P.attiva({ uid: 'anna', codice: 'CAMPOBBB', token: 'INVENTATO', prodotto: 'pro_campo' }, m.dip);
    ok('un gettone inventato non vale niente', r.ok === false && !m.stanze.CAMPOBBB.pro);
    ok('e niente di quello che non vale viene confermato a Google, né due volte', eq(m.play.confermati, ['T1']));

    // Il rimborso: Google avvisa, il Pro di quel campo si spegne.
    let n = await P.notifica({ voidedPurchaseNotification: { purchaseToken: 'T1', productType: 2 } }, m.dip);
    ok(`un acquisto rimborsato spegne il Pro del suo campo (${JSON.stringify(n)})`, n.fatto === 'rimborso' && !m.stanze.CAMPOAAA.pro);
    n = await P.notifica({ voidedPurchaseNotification: { purchaseToken: 'MAI-VISTO' } }, m.dip);
    ok('una notifica di un gettone mai visto non concede e non toglie niente', n.fatto === 'sconosciuto');
  }

  // ---------- Due richieste insieme con lo stesso gettone ----------
  // Tutte e due leggono il registro prima che l'altra scriva: il controllo
  // iniziale non le ferma. Le ferma la transazione (concedi).
  {
    const m = mondo();
    m.play.prodotti.T9 = { purchaseState: 0, orderId: 'GPA.9' };
    const [r1, r2] = await Promise.all([
      P.attiva({ uid: 'anna', codice: 'CAMPOAAA', token: 'T9', prodotto: 'pro_campo' }, m.dip),
      P.attiva({ uid: 'anna', codice: 'CAMPOBBB', token: 'T9', prodotto: 'pro_campo' }, m.dip),
    ]);
    ok(`due richieste insieme: un gettone, un campo solo (${r1.ok}/${r2.ok})`,
      [r1.ok, r2.ok].filter(Boolean).length === 1 && [m.stanze.CAMPOAAA.pro, m.stanze.CAMPOBBB.pro].filter(Boolean).length === 1);
  }

  // ---------- L'abbonamento del capogruppo ----------
  {
    const m = mondo();
    m.play.abbonamenti.A1 = abb('SUBSCRIPTION_STATE_ACTIVE', TRA(365));
    let r = await P.attiva({ uid: 'anna', token: 'A1', prodotto: 'pro_anno' }, m.dip);
    ok(`l'abbonamento rende Pro tutti i campi del capogruppo (${JSON.stringify(r)})`,
      r.ok && r.campi === 2 && m.stanze.CAMPOAAA.pro.fonte === 'anno' && m.stanze.CAMPOBBB.pro.fonte === 'anno');
    ok('e solo i suoi', !m.stanze.CAMPOCCC.pro);
    ok('fino alla scadenza del periodo pagato', m.stanze.CAMPOAAA.pro.scade === TRA(365));
    ok('e ci si ricorda che è abbonato, per i campi di dopo', m.abbonati.anna && m.abbonati.anna.scade === TRA(365));
    ok('un campo creato dopo nasce già Pro', P.proPerStanzaNuova(m.abbonati.anna, TRA(30)).attivo === true);
    ok('ma non se l\'abbonamento è finito', P.proPerStanzaNuova(m.abbonati.anna, TRA(366)) === null && P.proPerStanzaNuova(null, ORA) === null);

    // Il rinnovo allunga.
    m.play.abbonamenti.A1 = abb('SUBSCRIPTION_STATE_ACTIVE', TRA(730));
    let n = await P.notifica({ subscriptionNotification: { notificationType: 2, purchaseToken: 'A1', subscriptionId: 'pro_anno' } }, m.dip);
    ok(`il rinnovo allunga il Pro di tutti i suoi campi (${JSON.stringify(n)})`, n.fatto === 'rinnovo' && m.stanze.CAMPOBBB.pro.scade === TRA(730));

    // Un campo pagato a parte che dura di piu' non si accorcia.
    m.stanze.CAMPOAAA.pro = { attivo: true, fino: '2099-01-01', scade: TRA(9999), fonte: 'campo', ordine: 'GPA.x' };
    await P.notifica({ subscriptionNotification: { notificationType: 2, purchaseToken: 'A1' } }, m.dip);
    ok('un Pro pagato a parte che dura di più non viene accorciato dall\'abbonamento', m.stanze.CAMPOAAA.pro.fonte === 'campo');

    // La revoca: si spegne subito il Pro che veniva dall'abbonamento, non l'altro.
    n = await P.notifica({ subscriptionNotification: { notificationType: 12, purchaseToken: 'A1' } }, m.dip);
    ok(`la revoca spegne il Pro dell'abbonamento (${JSON.stringify(n)})`, n.fatto === 'revoca' && !m.stanze.CAMPOBBB.pro);
    ok('ma non quello pagato a parte', m.stanze.CAMPOAAA.pro && m.stanze.CAMPOAAA.pro.fonte === 'campo');
    ok('e i campi di dopo non nascono più Pro', P.proPerStanzaNuova(m.abbonati.anna, TRA(1)) === null);

    m.play.abbonamenti.A2 = abb('SUBSCRIPTION_STATE_ON_HOLD', TRA(30));
    r = await P.attiva({ uid: 'bruno', token: 'A2', prodotto: 'pro_anno' }, m.dip);
    ok('un abbonamento sospeso non accende niente', r.motivo === 'abbonamento-non-attivo' && !m.stanze.CAMPOCCC.pro);
    r = await P.attiva({ uid: 'bruno', token: 'A1', prodotto: 'pro_anno' }, m.dip);
    ok('e l\'abbonamento di un altro non si prende in prestito', r.motivo === 'gettone-gia-usato' && !m.stanze.CAMPOCCC.pro);
  }

  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
