// Comprare il Pro dall'app: Google Play Billing, dentro l'app Android.
//
// Google Play e il server sono finti. Le decisioni del server (chi puo'
// attivare, fino a quando, un gettone vale una volta) le prova
// test/unita/server-pro.js sui numeri; qui si prova l'app: che mostri i
// prezzi che dice Google, che chieda al server PRIMA di consumare
// l'acquisto, che non consumi niente quando il server dice no, che non
// spaventi chi chiude la finestra di Google, e che un acquisto pagato ma
// rimasto a meta' venga ritrovato. E che fuori dall'app Android il Pro si
// spieghi invece di mostrare tasti che non possono funzionare.
const { apri, ok, fine, attendi } = require('../lib/app');

const CODICE = 'K7RX2MQP';

const scena = (o) => [(s) => {
  const o = JSON.parse(s);
  let vero;
  Object.defineProperty(window, 'APP_CONFIG', {
    configurable: true,
    get() { return vero; },
    set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { rooms: true, auth: true }) }); },
  });
  window.APP_CONFIG = {};
  localStorage.setItem('cambusa_stanza', o.codice);
  localStorage.setItem('cambusa_campi', JSON.stringify([{ codice: o.codice, nome: 'Campo', ruolo: o.capo ? 'proprietario' : 'redattore' }]));
  const utente = { uid: o.capo ? 'anna' : 'bruno', email: 'x@example.com', nome: 'X', isAnonimo: false, emailVerificata: true };
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true, utente: () => utente,
    osserva: (cb) => { cb(utente); return () => {}; },
    conGoogle: async () => utente, esci: async () => {}, stanzeDelProfilo: async () => [o.codice],
  };
  // Cosa succede, in ordine: e' l'ordine che la prova guarda.
  window.__giro = [];
  window.__pro = null;
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (c) => c, leggi: async () => null, motivo: () => 'stanza.nonRiuscito', membri: async () => [],
    statoDi: async (codici) => codici.map((c) => ({ codice: c, membro: true, proprietario: o.capo, nome: 'Campo', pro: window.__pro })),
    impostaStanza: async () => {},
    attivaPro: async (richiesta) => {
      window.__giro.push({ che: 'server', richiesta });
      if (!o.server.ok) return o.server;
      window.__pro = { attivo: true, fino: '2027-11-16' };
      return o.server;
    },
  };
  // Google Play, finto. Senza `android`, l'app gira in un browser qualunque.
  if (o.android) {
    window.getDigitalGoodsService = async (url) => (url !== 'https://play.google.com/billing' ? null : {
      getDetails: async (ids) => ids.map((id) => ({ itemId: id, price: { currency: 'EUR', value: id === 'pro_campo' ? '4.99' : '14.99' } })),
      listPurchases: async () => o.rimasti || [],
      consume: async (t) => { window.__giro.push({ che: 'consumato', token: t }); },
    });
    window.PaymentRequest = class {
      constructor(metodi) { this.sku = metodi[0].data.sku; window.__giro.push({ che: 'paga', metodo: metodi[0].supportedMethods, sku: this.sku }); }
      async show() {
        if (o.chiude) { const e = new Error('chiusa'); e.name = 'AbortError'; throw e; }
        return {
          details: { purchaseToken: 'GETTONE-' + this.sku },
          complete: async (x) => { window.__giro.push({ che: 'concluso', come: x }); },
        };
      }
    };
  }
}, JSON.stringify(Object.assign({ codice: CODICE, server: { ok: true, fino: '2027-11-16' } }, o))];

const giro = (a) => a.page.evaluate(() => window.__giro);
const riquadro = (a) => a.page.locator('[data-riquadro="pro"]');
// Il Pro sta in fondo a «Il campo».
async function impostazioni(a) {
  await a.menu('Il campo');
  await attendi(a.page, () => !!document.querySelector('[data-riquadro="pro"]'));
}

(async () => {
  // ---------- 1. Il Pro per un campo, e va tutto bene ----------
  {
    const a = await apri({ admin: false, initScript: scena({ capo: true, android: true }) });
    await impostazioni(a);
    await attendi(a.page, () => !!document.querySelector('[data-compra="pro_campo"]'));
    const tasti = await riquadro(a).locator('[data-compra]').allInnerTexts();
    ok(`i prezzi sono quelli che dice Google, nella lingua dell'app (${tasti.join(' | ')})`,
      /4,99\s*€/.test(tasti[0]) && /14,99\s*€/.test(tasti[1]));
    await a.page.locator('[data-compra="pro_campo"]').click();
    await attendi(a.page, () => window.__giro.some((x) => x.che === 'concluso'));
    const g = await giro(a);
    const ordine = g.map((x) => x.che).join(' → ');
    ok(`prima si paga, poi il server, poi si consuma, poi si chiude (${ordine})`, ordine === 'paga → server → consumato → concluso');
    ok('si paga con Google Play, per il prodotto giusto', g[0].metodo === 'https://play.google.com/billing' && g[0].sku === 'pro_campo');
    ok(`al server va il gettone di Google, per QUESTO campo (${JSON.stringify(g[1].richiesta)})`,
      g[1].richiesta.token === 'GETTONE-pro_campo' && g[1].richiesta.codice === CODICE && g[1].richiesta.prodotto === 'pro_campo');
    ok('si consuma proprio quel gettone', g[2].token === 'GETTONE-pro_campo');
    ok('e a Google si dice che è andata', g[3].come === 'success');
    await attendi(a.page, () => /campo pro fino al/i.test(document.querySelector('[data-riquadro="pro"]').innerText));
    ok('il campo diventa Pro, e il riquadro lo dice', /fatto: il campo è pro/i.test(await riquadro(a).innerText()));
    ok('e i tasti per comprarlo spariscono', (await a.page.locator('[data-compra]').count()) === 0);
    await a.menu('Regole');
    await attendi(a.page, () => /modifica le regole/i.test(document.querySelector('main').innerText));
    ok('le funzioni Pro si aprono subito, senza riaprire l\'app', true);
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  // ---------- 2. L'abbonamento: non si consuma ----------
  {
    const a = await apri({ admin: false, initScript: scena({ capo: true, android: true }) });
    await impostazioni(a);
    await attendi(a.page, () => !!document.querySelector('[data-compra="pro_anno"]'));
    await a.page.locator('[data-compra="pro_anno"]').click();
    await attendi(a.page, () => window.__giro.some((x) => x.che === 'concluso'));
    const g = await giro(a);
    ok(`l'abbonamento va al server senza un campo: è della persona (${JSON.stringify(g[1].richiesta)})`,
      g[1].richiesta.prodotto === 'pro_anno' && !('codice' in g[1].richiesta));
    ok('e non si consuma: un abbonamento resta finché lo si paga', !g.some((x) => x.che === 'consumato'));
    await a.browser.close();
  }

  // ---------- 3. Il server dice no ----------
  {
    const a = await apri({ admin: false, initScript: scena({ capo: true, android: true, server: { ok: false, motivo: 'pagamento-in-attesa' } }) });
    await impostazioni(a);
    await attendi(a.page, () => !!document.querySelector('[data-compra="pro_campo"]'));
    await a.page.locator('[data-compra="pro_campo"]').click();
    await attendi(a.page, () => window.__giro.some((x) => x.che === 'concluso'));
    const g = await giro(a);
    ok('se il server dice no, l\'acquisto NON si consuma: resta da riprendere', !g.some((x) => x.che === 'consumato'));
    ok('e a Google si dice che non è andata', g.find((x) => x.che === 'concluso').come === 'fail');
    await attendi(a.page, () => !!document.querySelector('[data-pro-esito]'));
    ok('e si dice perché, in parole che si capiscono', /ancora in attesa/i.test(await riquadro(a).innerText()));
    ok('il campo resta gratuito', /campo gratuito/i.test(await riquadro(a).innerText()));
    await a.browser.close();
  }

  // ---------- 4. Chi chiude la finestra di Google ----------
  {
    const a = await apri({ admin: false, initScript: scena({ capo: true, android: true, chiude: true }) });
    await impostazioni(a);
    await attendi(a.page, () => !!document.querySelector('[data-compra="pro_campo"]'));
    await a.page.locator('[data-compra="pro_campo"]').click();
    await a.page.waitForTimeout(500);   // si verifica che NON succeda niente
    const g = await giro(a);
    ok('chi chiude la finestra di Google senza pagare non chiama il server', !g.some((x) => x.che === 'server'));
    ok('e non si sente dire che qualcosa è andato storto', (await a.page.locator('[data-pro-esito]').count()) === 0);
    await a.browser.close();
  }

  // ---------- 5. Un acquisto pagato e rimasto a metà ----------
  // La volta scorsa il server non ha risposto (in montagna, senza linea):
  // Google lo tiene in elenco finche' non si consuma. Aprendo il campo lo si
  // ritrova, e si finisce il lavoro.
  {
    const a = await apri({
      admin: false,
      initScript: scena({ capo: true, android: true, rimasti: [{ itemId: 'pro_campo', purchaseToken: 'VECCHIO' }] }),
    });
    await attendi(a.page, () => window.__giro.some((x) => x.che === 'consumato'));
    const g = await giro(a);
    ok(`un acquisto rimasto a metà si riprende da solo (${g.map((x) => x.che).join(' → ')})`,
      g[0].che === 'server' && g[0].richiesta.token === 'VECCHIO' && g[0].richiesta.codice === CODICE && g[1].token === 'VECCHIO');
    await impostazioni(a);
    await attendi(a.page, () => /campo pro/i.test(document.querySelector('[data-riquadro="pro"]').innerText));
    ok('e il campo è Pro senza ripagare', !(await giro(a)).some((x) => x.che === 'paga'));
    await a.browser.close();
  }

  // ---------- 6. Fuori dall'app Android ----------
  {
    const a = await apri({ admin: false, initScript: scena({ capo: true, android: false }) });
    await impostazioni(a);
    await attendi(a.page, () => !!document.querySelector('[data-pro-solo-android]'));
    ok('dal browser o dall\'iPhone si dice dove si compra il Pro, e che poi vale per tutti',
      /app camp ops per android/i.test(await riquadro(a).innerText()) && /anche su iphone/i.test(await riquadro(a).innerText()));
    ok('senza tasti che non possono funzionare', (await a.page.locator('[data-compra]').count()) === 0);
    await a.browser.close();
  }

  // ---------- 7. Un membro ----------
  {
    // Ha un acquisto in sospeso sul suo telefono (magari per un campo suo):
    // qui, nel campo di un altro, non va speso.
    const a = await apri({ admin: false, initScript: scena({ capo: false, android: true, rimasti: [{ itemId: 'pro_campo', purchaseToken: 'DI-BRUNO' }] }) });
    await impostazioni(a);
    await a.page.waitForTimeout(400);
    ok('un membro non trova i tasti per comprare il Pro del campo',
      (await a.page.locator('[data-compra]').count()) === 0 && (await a.page.locator('[data-pro-solo-android]').count()) === 0);
    ok('e non si riprende niente a suo nome', (await giro(a)).length === 0);
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
