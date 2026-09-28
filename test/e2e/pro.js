// Cosa sblocca il Pro, a schermo.
//
// Deciso il 28 settembre: il meteo live, «Chi fa cosa», le regole del campo,
// la lista di cosa portare, l'archivio dei campi chiusi, le foto degli
// scontrini nel cloud, e piu' di un campo gratuito attivo alla volta. Le
// regole (quali, e che il Pro e' del CAMPO) le prova test/unita/stanza.js;
// qui si prova quello che da li' non si vede: che ogni funzione chieda
// davvero al campo aperto, che il capogruppo trovi la strada per il Pro e gli
// altri no, e che quello che c'e' gia' non sparisca a nessuno.
//
// Il Pro arriva come arrivera' davvero: dalla stanza (statoDi), scritto dal
// server. Nessun telefono lo scrive.
const { apri, ok, fine, attendi } = require('../lib/app');

const CODICE = 'K7RX2MQP';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// Il campo e' senza date: cosi' conta sempre come «attivo», e la prova non
// dipende dal giorno in cui gira.
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
  localStorage.setItem('cambusa_sync_optout', '1');
  localStorage.setItem('cambusa_tobuy', JSON.stringify([{ id: 't1', name: 'Carbonella', qty: '2 sacchi' }]));
  localStorage.setItem('cambusa_campi', JSON.stringify([{ codice: o.codice, nome: 'Campo', ruolo: o.capo ? 'proprietario' : 'redattore' }]));
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true, utente: () => o.utente,
    osserva: (cb) => { cb(o.utente); return () => {}; },
    conGoogle: async () => o.utente, esci: async () => {}, stanzeDelProfilo: async () => [o.codice],
  };
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (c) => window.Stanza.normalizza(c),
    leggi: async () => null,
    motivo: () => 'stanza.nonRiuscito',
    membri: async () => [],
    statoDi: async (codici) => codici.map((c) => Object.assign({
      codice: c, membro: true, proprietario: o.capo, nome: 'Campo', inizio: '', fine: '',
    }, o.stanza)),
    impostaStanza: async () => {},
  };
}, JSON.stringify(Object.assign({ codice: CODICE }, o))];

const utente = (uid) => ({ uid, email: uid + '@example.com', nome: uid, isAnonimo: false, emailVerificata: true });
const bloccata = (a, f) => a.page.locator(`[data-pro-bloccata="${f}"]`).count();

// Allega uno scontrino dalla maschera «Segna come acquistata» e dice quante
// foto sono in coda per il cloud.
async function scontrino(a) {
  await a.menu('Lista della Spesa');
  await a.page.locator('ul li', { hasText: 'Carbonella' }).first().locator('button', { hasText: /segna come acquistata/i }).click();
  const modale = a.page.locator('div.fixed', { hasText: 'Acquistata:' }).last();
  await modale.locator('input[type="file"]').setInputFiles({ name: 's.png', mimeType: 'image/png', buffer: PNG });
  await attendi(a.page, () => /Scontrino allegato/i.test(document.body.innerText));
  // Una foto accodata si vede subito; una non accodata non si vede mai, e
  // per quella serve un'attesa fissa (e' l'unico caso in cui ha senso).
  await a.page.waitForTimeout(400);
  const inCoda = await a.page.evaluate(() => window.CloudSync.fotoInCoda());
  const nota = await a.page.locator('[data-foto-solo-qui]').count();
  await modale.locator('button', { hasText: /annulla/i }).first().click().catch(() => {});
  return { inCoda, nota };
}

(async () => {
  // ---------- 1. Il capogruppo, in un campo gratuito ----------
  {
    // La richiesta del meteo partirebbe all'apertura: si ascolta da prima.
    const meteo = [];
    const a = await apri({
      admin: false,
      initScript: scena({ capo: true, utente: utente('anna'), stanza: { luogo: { lat: 42, lon: 13 } } }),
      prima: async (page) => { page.on('request', (r) => { if (/api\.open-meteo\.com/.test(r.url())) meteo.push(r.url()); }); },
    });

    await a.menu('Calendario');
    await attendi(a.page, () => !!document.querySelector('[data-pro-bloccata="meteo"]'));
    ok('senza Pro, al posto del meteo il capogruppo trova il Pro', /scopri il pro/i.test(await a.page.locator('[data-pro-bloccata="meteo"]').innerText()));
    ok('e il meteo non si scarica, anche col luogo scelto', meteo.length === 0);

    await a.menu('Regole');
    await attendi(a.page, () => !!document.querySelector('[data-pro-bloccata="regole"]'));
    ok('le regole del campo sono del Pro', (await a.page.locator('main button', { hasText: /modifica le regole/i }).count()) === 0);
    await a.menu('Dotazioni personali');
    await attendi(a.page, () => !!document.querySelector('[data-pro-bloccata="dotazioni"]'));
    ok('e la lista di cosa portare', (await a.page.locator('main button', { hasText: /modifica la lista/i }).count()) === 0);
    await a.menu('Chi fa cosa');
    await attendi(a.page, () => !!document.querySelector('[data-pro-bloccata="compiti"]'));
    ok('e «Chi fa cosa», al posto della scheda e non accanto',
      (await a.page.locator('main input, main textarea').count()) === 0);
    await a.menu('Archivio');
    await attendi(a.page, () => !!document.querySelector('[data-pro-bloccata="archivio"]'));
    ok('e l\'archivio dei campi chiusi', true);

    const f = await scontrino(a);
    ok(`e le foto degli scontrini restano sul telefono (${f.inCoda} in coda per il cloud)`, f.inCoda === 0);
    ok('e lo si dice a chi la scatta', f.nota === 1);

    await a.menu('Impostazioni');
    await attendi(a.page, () => !!document.querySelector('[data-riquadro="pro"]'));
    const r = await a.page.locator('[data-riquadro="pro"]').innerText();
    ok('il riquadro del Pro dice che il campo è gratuito, e cosa sbloccherebbe',
      /campo gratuito/i.test(r) && /meteo live/i.test(r) && /chi fa cosa/i.test(r));
    ok('e che i conti sono sempre completi', /sempre completi/i.test(r));
    ok('il luogo per il meteo non si sceglie senza Pro',
      (await a.page.locator('[data-riquadro="luogo"]').count()) === 0 && (await bloccata(a, 'meteo')) === 1);

    // Un secondo campo gratuito: si dice prima del modulo.
    await a.menu('I miei campi');
    await a.page.locator('[data-scheda="campi"] button', { hasText: /crea una stanza/i }).click();
    await attendi(a.page, () => !!document.querySelector('[data-pro-bloccata="piuCampi"]'));
    ok('un secondo campo gratuito non si crea, e si dice perché prima di compilare',
      (await a.page.locator('[data-scheda="campi"] input[type="date"]').count()) === 0
      && /partecipare ai campi degli altri resta sempre gratis/i.test(await a.page.locator('[data-pro-bloccata="piuCampi"]').innerText()));
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  // ---------- 2. Il capogruppo, in un campo Pro ----------
  {
    const a = await apri({
      admin: false,
      initScript: scena({ capo: true, utente: utente('anna'), stanza: { pro: { attivo: true, fino: '2999-12-31' }, luogo: { lat: 42, lon: 13 } } }),
    });
    await a.menu('Regole');
    await attendi(a.page, () => /modifica le regole/i.test(document.querySelector('main').innerText));
    ok('col Pro le regole si scrivono', (await bloccata(a, 'regole')) === 0);
    await a.menu('Chi fa cosa');
    await a.page.waitForTimeout(300);
    ok('e «Chi fa cosa» c\'è', (await bloccata(a, 'compiti')) === 0 && (await a.page.locator('main').innerText()).length > 0);
    await a.menu('Archivio');
    await a.page.waitForTimeout(300);
    ok('e l\'archivio', (await bloccata(a, 'archivio')) === 0);
    await a.menu('Calendario');
    await a.page.waitForTimeout(300);
    ok('e il meteo', (await bloccata(a, 'meteo')) === 0);

    const f = await scontrino(a);
    ok(`e le foto degli scontrini vanno nel cloud (${f.inCoda} in coda)`, f.inCoda === 1 && f.nota === 0);

    await a.menu('Impostazioni');
    await attendi(a.page, () => !!document.querySelector('[data-riquadro="luogo"]'));
    ok('il capogruppo sceglie il luogo del meteo', true);
    ok('e il riquadro del Pro dice fino a quando', /campo pro fino al/i.test(await a.page.locator('[data-riquadro="pro"]').innerText()));

    await a.menu('I miei campi');
    await a.page.locator('[data-scheda="campi"] button', { hasText: /crea una stanza/i }).click();
    await a.page.waitForTimeout(300);
    ok('un campo Pro non conta: se ne crea un altro', (await bloccata(a, 'piuCampi')) === 0);
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  // ---------- 3. Un membro, in un campo gratuito che le regole le aveva ----------
  // Il Pro e' scaduto: quello che il capogruppo aveva scritto resta leggibile.
  {
    const a = await apri({
      admin: false,
      initScript: scena({ capo: false, utente: utente('bruno'), stanza: { pro: { attivo: true, fino: '2000-01-01' }, regole: ['Si lava a turno.'] } }),
    });
    await a.menu('Regole');
    await attendi(a.page, () => /si lava a turno/i.test(document.querySelector('main').innerText));
    ok('col Pro scaduto le regole scritte restano da leggere', (await bloccata(a, 'regole')) === 0);
    await a.menu('Chi fa cosa');
    await attendi(a.page, () => !!document.querySelector('[data-pro-bloccata="compiti"]'));
    const t = await a.page.locator('[data-pro-bloccata="compiti"]').innerText();
    ok('a un membro si dice chi può attivare il Pro, senza un tasto che non lo riguarda',
      /la può attivare il capogruppo/i.test(t) && !/scopri il pro/i.test(t));
    await a.menu('Calendario');
    await a.page.waitForTimeout(300);
    ok('e al posto del meteo, niente: nessun rimprovero', (await bloccata(a, 'meteo')) === 0);
    await a.menu('Impostazioni');
    await attendi(a.page, () => !!document.querySelector('[data-riquadro="pro"]'));
    ok('anche il membro sa che il campo è gratuito, e chi può cambiarlo',
      /campo gratuito/i.test(await a.page.locator('[data-riquadro="pro"]').innerText()));
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
