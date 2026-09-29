// Il luogo del campo, per il meteo: lo sceglie il capogruppo.
//
// Nell'app pubblica il meteo era spento: il luogo stava scritto a mano in
// firebase-config.js (quello di Prato Lungo), e un gruppo che campeggiava
// altrove non aveva modo di dirlo. Adesso il luogo sta nella stanza
// (`rooms/<codice>.luogo`), lo scrive il capogruppo, e il meteo di tutti
// parte da li'. Qui si prova il giro a schermo: il capogruppo trova dove
// sceglierlo, lo cerca per nome o incolla un link, corregge la quota, e la
// previsione viene chiesta per QUEL punto a QUELLA quota. E che chi non e'
// capogruppo non venga rimproverato per una cosa che non puo' fare.
//
// Open-Meteo non si chiama davvero: le due strade (ricerca e previsioni) si
// intercettano, e la prova guarda cosa l'app ha chiesto.
const { apri, ok, fine, attendi } = require('../lib/app');

const CODICE = 'K7RX2MQP';
const GIORNI = ['2027-07-12', '2027-07-13', '2027-07-14'];

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
  // Campi Pro: il meteo live e' del Pro (test/e2e/pro.js prova il resto).
  localStorage.setItem('cambusa_campi', JSON.stringify([{ codice: o.codice, nome: 'Campo di luglio', inizio: o.giorni[0], fine: o.giorni[2], ruolo: o.capo ? 'proprietario' : 'redattore', pro: { attivo: true } }]));
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true, utente: () => o.utente,
    osserva: (cb) => { cb(o.utente); return () => {}; },
    conGoogle: async () => o.utente, esci: async () => {}, stanzeDelProfilo: async () => [o.codice],
  };
  window.__stanza = Object.assign({}, o.stanza);
  window.__scritture = [];
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (c) => window.Stanza.normalizza(c),
    leggi: async () => null,
    motivo: () => 'stanza.nonRiuscito',
    membri: async () => [],
    statoDi: async (codici) => codici.map((c) => ({
      codice: c, membro: true, proprietario: o.capo, nome: 'Campo di luglio',
      inizio: o.giorni[0], fine: o.giorni[2], luogo: window.__stanza.luogo || null, pro: { attivo: true },
    })),
    impostaStanza: async (c, campi) => {
      window.__scritture.push(campi);
      Object.assign(window.__stanza, campi);
    },
  };
}, JSON.stringify(Object.assign({ codice: CODICE, giorni: GIORNI }, o))];

// Open-Meteo, finto. Si ricorda cosa gli si e' chiesto.
async function openMeteoFinto(page) {
  const chieste = { ricerche: [], previsioni: [] };
  await page.route('https://geocoding-api.open-meteo.com/**', (r) => {
    chieste.ricerche.push(r.request().url());
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ results: [
        { name: 'Pereto', latitude: 42.0583, longitude: 13.1024, elevation: 800, admin1: 'Abruzzo', admin2: "L'Aquila", country: 'Italia', country_code: 'IT' },
        { name: 'Pereto', latitude: 43.9, longitude: 12.4, elevation: 300, admin1: 'Emilia-Romagna', admin2: 'Rimini', country: 'Italia', country_code: 'IT' },
      ] }),
    });
  });
  await page.route('https://api.open-meteo.com/**', (r) => {
    chieste.previsioni.push(r.request().url());
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        elevation: 1330,
        daily: {
          time: GIORNI, weather_code: [0, 0, 0],
          temperature_2m_max: [24, 25, 26], temperature_2m_min: [9, 10, 11],
          precipitation_probability_max: [0, 0, 0],
        },
      }),
    });
  });
  return chieste;
}

const main = (a) => a.page.locator('main').innerText();
const riquadro = (a) => a.page.locator('[data-riquadro="luogo"]');

(async () => {
  // ---------- 1. Il capogruppo, in un campo senza luogo ----------
  {
    const a = await apri({
      admin: false,
      initScript: scena({ capo: true, utente: { uid: 'anna', email: 'anna@example.com', nome: 'Anna', isAnonimo: false, emailVerificata: true } }),
    });
    const chieste = await openMeteoFinto(a.page);

    await a.menu('Calendario');
    await attendi(a.page, () => !!document.querySelector('[data-luogo-manca]'));
    ok('al capogruppo, senza luogo, il calendario dice dove si sceglie', true);
    await a.page.locator('[data-luogo-manca]').click();
    await attendi(a.page, () => !!document.querySelector('[data-riquadro="luogo"]'));
    ok('e il tasto porta al riquadro del luogo', /nessun luogo scelto/i.test(await riquadro(a).innerText()));

    // Un link corto: si dice perche' non va, e non si cerca come nome.
    await riquadro(a).locator('button', { hasText: /scegli il luogo/i }).click();
    await a.page.locator('[data-cerca-luogo]').fill('https://maps.app.goo.gl/AbCdEf123');
    await riquadro(a).locator('button', { hasText: /^cerca$/i }).click();
    await attendi(a.page, () => /link corto/i.test(document.querySelector('[data-riquadro="luogo"]').innerText));
    ok('un link corto si riconosce, e si dice come fare', chieste.ricerche.length === 0);

    // Un link lungo: il punto si legge subito, senza chiedere a nessuno.
    await a.page.locator('[data-cerca-luogo]').fill('https://www.google.com/maps/place/Prato/@42.05,13.1,15z/data=!3m1!4b1!8m2!3d42.0486!4d13.14855');
    await riquadro(a).locator('button', { hasText: /^cerca$/i }).click();
    await attendi(a.page, () => !!document.querySelector('[data-candidato]'));
    ok('un link lungo di Google Maps dà il punto subito, senza cercare in rete',
      /42\.0486, 13\.14855/.test(await a.page.locator('[data-candidato]').innerText()) && chieste.ricerche.length === 0);

    // Un nome: si cerca, e si sceglie fra gli omonimi.
    await a.page.locator('[data-cerca-luogo]').fill('Pereto');
    await riquadro(a).locator('button', { hasText: /^cerca$/i }).click();
    await attendi(a.page, () => document.querySelectorAll('[data-trovato]').length === 2);
    const trovati = await a.page.locator('[data-trovato]').allInnerTexts();
    ok(`un nome si cerca, e gli omonimi si distinguono (${trovati.map((t) => t.replace(/\s+/g, ' ')).join(' | ')})`,
      /Pereto \(L'Aquila\)/.test(trovati[0]) && /Pereto \(Rimini\)/.test(trovati[1]));
    ok('la ricerca parla la lingua dell\'app', /[?&]language=it\b/.test(chieste.ricerche[0] || '') && /name=Pereto/.test(chieste.ricerche[0] || ''));
    await a.page.locator('[data-trovato="0"]').click();
    await attendi(a.page, () => document.querySelector('[data-quota-luogo]') && document.querySelector('[data-quota-luogo]').value === '800');
    ok('scelto un posto, la sua quota arriva già scritta', true);
    // La quota del paese non e' quella del prato: il capogruppo la corregge.
    await a.page.locator('[data-quota-luogo]').fill('1337');
    await a.page.locator('[data-nome-luogo]').fill('Prato Lungo');
    // Nell'istante in cui il riquadro mostra il luogo salvato, il meteo lo
    // deve gia' sapere: se aspetta il salvataggio dell'elenco, parte solo al
    // prossimo ridisegno, cioe' quando capita.
    await a.page.evaluate(() => {
      new MutationObserver((_, oss) => {
        if (!document.querySelector('[data-luogo-scelto]')) return;
        window.__luogoAlDisegno = window.CAMP_LOCATION ? window.CAMP_LOCATION.lat : null;
        oss.disconnect();
      }).observe(document.body, { childList: true, subtree: true });
    });
    await a.page.locator('[data-salva-luogo]').click();
    await attendi(a.page, () => window.__scritture.some((x) => x.luogo));
    const scritto = await a.page.evaluate(() => window.__scritture.find((x) => x.luogo).luogo);
    ok(`il luogo va nella stanza, con la quota corretta a mano (${JSON.stringify(scritto)})`,
      JSON.stringify(scritto) === JSON.stringify({ lat: 42.0583, lon: 13.1024, alt: 1337, label: 'Prato Lungo' }));
    await attendi(a.page, () => !!document.querySelector('[data-luogo-scelto]'));
    ok('e il riquadro dice quale luogo è scelto', /Prato Lungo/.test(await riquadro(a).innerText()) && /1337 m/.test(await riquadro(a).innerText()));
    const alDisegno = await a.page.evaluate(() => window.__luogoAlDisegno);
    ok(`appena salvato, il meteo sa già il luogo nuovo (${alDisegno})`, alDisegno === 42.0583);

    // Il meteo: parte da solo, per quel punto e quella quota.
    await a.menu('Calendario');
    await attendi(a.page, () => /24° \/ 9°/.test(document.querySelector('main').innerText), null, 20000);
    const url = chieste.previsioni[chieste.previsioni.length - 1] || '';
    ok(`il meteo compare, chiesto per il luogo scelto (${url.slice(0, 90)}…)`,
      /latitude=42\.0583/.test(url) && /longitude=13\.1024/.test(url));
    ok('e alla quota del prato, non a quella del paese', /elevation=1337/.test(url));
    ok('il nome del luogo si legge sotto la previsione', /Prato Lungo/.test(await main(a)));
    ok('e l\'invito a scegliere il luogo non c\'è più', (await a.page.locator('[data-luogo-manca]').count()) === 0);

    // Togliere il luogo: il meteo sparisce per tutti.
    // Il luogo sta in «Il campo», nella sua riga: la riga resta aperta
    // tornandoci, ma si apre se non lo e'.
    await a.menu('Il campo');
    if (!(await riquadro(a).count())) await a.page.click('[data-riga="luogo"]');
    await riquadro(a).locator('button', { hasText: /^togli$/i }).click();
    await attendi(a.page, () => window.__scritture.some((x) => 'luogo' in x && x.luogo === null));
    ok('il luogo si può togliere', true);
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  // ---------- 2. Un membro, in un campo senza luogo ----------
  {
    const a = await apri({
      admin: false,
      initScript: scena({ capo: false, utente: { uid: 'bruno', email: 'bruno@example.com', nome: 'Bruno', isAnonimo: false, emailVerificata: true } }),
    });
    await a.menu('Calendario');
    await attendi(a.page, () => /12 luglio/i.test(document.querySelector('main').innerText));
    ok('a chi non è capogruppo nessun rimprovero per il luogo che manca',
      (await a.page.locator('[data-luogo-manca]').count()) === 0 && !/meteo|luogo del campo/i.test(await main(a)));
    await a.menu('Il campo');
    await a.page.waitForTimeout(300);
    ok('e nemmeno il riquadro per sceglierlo', (await riquadro(a).count()) === 0 && (await a.page.locator('[data-riga="luogo"]').count()) === 0);
    await a.browser.close();
  }

  // ---------- 3. Un membro, in un campo col luogo ----------
  {
    let chieste;
    const a = await apri({
      admin: false,
      // Qui il meteo parte all'apertura: il finto va messo prima.
      prima: async (page) => { chieste = await openMeteoFinto(page); },
      initScript: scena({
        capo: false,
        utente: { uid: 'bruno', email: 'bruno@example.com', nome: 'Bruno', isAnonimo: false, emailVerificata: true },
        stanza: { luogo: { lat: 42.0486, lon: 13.14855, alt: 1337, label: 'Prato Lungo' } },
      }),
    });
    await a.menu('Calendario');
    await attendi(a.page, () => /24° \/ 9°/.test(document.querySelector('main').innerText), null, 20000);
    ok('il luogo scelto dal capogruppo arriva a tutti, e il meteo con lui',
      /latitude=42\.0486/.test(chieste.previsioni[chieste.previsioni.length - 1] || ''));
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
