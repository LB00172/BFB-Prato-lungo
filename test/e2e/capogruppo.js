// Il capogruppo: le regole del campo e l'aiutante.
//
// Chi puo' scrivere cosa lo decidono le regole Firestore, provate contro
// l'emulatore (test/regole/stanze.js, § 9 e § 10). Qui si prova quello che da
// li' non si vede: che nell'app pubblica non restino le regole della Brigata;
// che il capogruppo trovi i tasti e gli altri no; e che i tasti chiedano al
// cloud la cosa giusta — le regole come elenco, l'aiutante per uid, e il
// passaggio del campo con la domanda che avvisa del Pro.
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
  window.__dialoghi = [];
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true,
    utente: () => o.utente,
    osserva: (cb) => { cb(o.utente); return () => {}; },
    conGoogle: async () => o.utente, esci: async () => {},
    stanzeDelProfilo: async () => [o.codice],
  };
  // La stanza come la vede il cloud; il finto registra quello che gli si
  // chiede di scrivere.
  window.__stanza = Object.assign({ regole: [], vice: '' }, o.stanza);
  window.__scritture = [];
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (c) => window.Stanza.normalizza(c),
    leggi: async () => null,
    motivo: () => 'stanza.nonRiuscito',
    membri: async () => [
      { uid: 'anna', ruolo: 'proprietario', nome: 'Anna' },
      { uid: 'bruno', ruolo: 'redattore', nome: 'Bruno' },
    ],
    // Come le regole: chi ha tolto la propria scheda la stanza non la legge
    // piu', e statoDi lo dice «non membro».
    statoDi: async (codici, utente) => codici.map((c) => (window.__stanza.fuori ? { codice: c, membro: false, proprietario: false } : {
      codice: c, membro: true,
      proprietario: window.__stanza.proprietario === utente.uid,
      nome: 'Campo di prova', pro: window.__stanza.pro || null,
      regole: window.__stanza.regole,
      vice: window.__stanza.proprietario === utente.uid ? window.__stanza.vice : '',
      aiutante: window.__stanza.vice === utente.uid,
    })),
    impostaStanza: async (c, campi) => {
      window.__scritture.push({ che: 'imposta', campi });
      Object.assign(window.__stanza, campi);
    },
    lasciaAllAiutante: async (c, utente) => {
      window.__scritture.push({ che: 'lascia', uid: utente.uid, a: window.__stanza.vice });
      window.__stanza.fuori = true;
      return window.__stanza.vice;
    },
  };
}, JSON.stringify(Object.assign({ codice: CODICE }, o))];

const testo = (a) => a.page.locator('main').innerText();

(async () => {
  // ---------- 1. Il capogruppo ----------
  {
    const a = await apri({
      admin: false,
      initScript: scena({
        utente: { uid: 'anna', email: 'anna@example.com', nome: 'Anna', isAnonimo: false, emailVerificata: true },
        stanza: { proprietario: 'anna', pro: { attivo: true } },
      }),
    });
    const dialoghi = [];
    a.page.on('dialog', (d) => dialoghi.push(d.message()));

    await a.menu('Regole');
    await attendi(a.page, () => /scrivile tu/i.test(document.querySelector('main').innerText));
    const t = await testo(a);
    ok('nell\'app pubblica non restano le regole della Brigata', !/presidente|bandy|hogwarts|braticola/i.test(t));
    ok('al capogruppo senza regole si propone di scriverle', /scrivile tu/i.test(t));

    await a.page.locator('main button', { hasText: /modifica le regole/i }).click();
    await a.page.locator('main textarea').fill('Si lava a turno.\n\nNiente musica\ndopo mezzanotte.');
    await a.page.locator('main button', { hasText: /^salva$/i }).click();
    await attendi(a.page, () => window.__scritture.some((x) => x.che === 'imposta' && x.campi.regole));
    const regole = await a.page.evaluate(() => window.__scritture.find((x) => x.campi && x.campi.regole).campi.regole);
    ok(`le regole vanno nella stanza, una per paragrafo (${JSON.stringify(regole)})`,
      JSON.stringify(regole) === JSON.stringify(['Si lava a turno.', 'Niente musica dopo mezzanotte.']));
    await attendi(a.page, () => document.querySelectorAll('[data-scheda="regole"] li').length === 2);
    ok('e si vedono subito, numerate', true);

    await a.menu('Impostazioni');
    await attendi(a.page, () => !!document.querySelector('[data-riquadro="aiutante"] option[value="bruno"]'));
    const riquadro = a.page.locator('[data-riquadro="aiutante"]');
    ok('il capogruppo trova il riquadro dell\'aiutante, con chi c\'è ma senza se stesso',
      (await riquadro.locator('option[value="anna"]').count()) === 0);
    ok('prima di nominarlo non si può lasciare il campo a nessuno',
      (await riquadro.locator('button', { hasText: /lascia il campo/i }).count()) === 0);
    await riquadro.locator('select').selectOption('bruno');
    await riquadro.locator('button', { hasText: /nomina aiutante/i }).click();
    await attendi(a.page, () => window.__scritture.some((x) => x.campi && x.campi.vice === 'bruno'));
    ok('l\'aiutante si nomina per uid', true);
    await attendi(a.page, () => /Bruno/.test(document.querySelector('[data-riquadro="aiutante"]').innerText)
      && !!document.querySelector('[data-riquadro="aiutante"] button.w-full'));
    ok('e il riquadro dice chi è', /il tuo aiutante è bruno/i.test(await riquadro.innerText()));

    await riquadro.locator('button', { hasText: /lascia il campo a bruno/i }).click();
    await attendi(a.page, () => window.__scritture.some((x) => x.che === 'lascia'));
    ok(`prima di lasciarlo si chiede, e si dice che il Pro non passa (${(dialoghi[0] || '').slice(0, 60)}…)`,
      dialoghi.length === 1 && /pro non passa/i.test(dialoghi[0]));
    const lascia = await a.page.evaluate(() => window.__scritture.find((x) => x.che === 'lascia'));
    ok('il campo passa all\'aiutante nominato', lascia.a === 'bruno' && lascia.uid === 'anna');
    await attendi(a.page, () => !!document.querySelector('[data-scheda="campi"]'));
    ok('e chi l\'ha lasciato torna alla home, fuori da quel campo',
      (await a.page.evaluate(() => localStorage.getItem('cambusa_stanza'))) === ''
      && !(await home(a)).includes('Campo di prova'));
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  // ---------- 2. Un membro, che è anche l'aiutante ----------
  {
    const a = await apri({
      admin: false,
      initScript: scena({
        utente: { uid: 'bruno', email: 'bruno@example.com', nome: 'Bruno', isAnonimo: false, emailVerificata: true },
        stanza: { proprietario: 'anna', vice: 'bruno', regole: ['Si lava a turno.'] },
      }),
    });
    await a.menu('Regole');
    await attendi(a.page, () => /si lava a turno/i.test(document.querySelector('main').innerText));
    ok('un membro legge le regole del campo', true);
    ok('ma non trova il tasto per cambiarle',
      (await a.page.locator('main button', { hasText: /modifica le regole/i }).count()) === 0);
    await a.menu('Impostazioni');
    await attendi(a.page, () => /sei l'aiutante/i.test(document.querySelector('main').innerText));
    ok('l\'aiutante sa di esserlo', true);
    ok('e il riquadro del capogruppo non c\'è', (await a.page.locator('[data-riquadro="aiutante"]').count()) === 0);
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });

async function home(a) {
  const h = a.page.locator('[data-scheda="campi"]');
  return (await h.count()) ? h.innerText() : '';
}
