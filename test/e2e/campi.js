// I miei campi: la home.
//
// Le regole dell'elenco (ricordare, aggiornare, ordinare) le prova
// unita/stanza senza browser. Qui si prova quello che da li' non si vede:
// che chi non ha un campo arrivi alla home e non a un'app vuota; che l'elenco
// venga dal profilo e dal telefono; che toccando un campo si apra QUELLO; e
// che senza linea la home si apra lo stesso, con i nomi di ieri.
const { apri, ok, fine, attendi } = require('../lib/app');

const ANNA = { uid: 'anna-1', email: 'anna@example.com', nome: 'Anna Rossi', isAnonimo: false, emailVerificata: true };
const ANONIMO = { uid: 'anon-1', isAnonimo: true };

// `stanze`: come le vede il cloud ({ codice: { nome, inizio, fine, proprietario, membro } }).
// `profilo`: i codici che il profilo si e' segnato. `locali`: l'elenco gia'
// sul telefono. `senzaLinea`: ogni lettura del cloud fallisce come in montagna.
const scena = (o) => [(s) => {
  const o = JSON.parse(s);
  let vero;
  Object.defineProperty(window, 'APP_CONFIG', {
    configurable: true,
    get() { return vero; },
    set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { rooms: true, auth: true }) }); },
  });
  window.APP_CONFIG = {};
  // Nessun campo: niente stanza, niente codice salvato, niente predefinito.
  Object.defineProperty(window, 'CAMP_CODE_DEFAULT', { value: '', writable: false, configurable: true });
  if (!sessionStorage.getItem('seminato')) {
    sessionStorage.setItem('seminato', '1');
    localStorage.removeItem('cambusa_stanza');
    localStorage.removeItem('cambusa_camp_code');
    if (o.locali) localStorage.setItem('cambusa_campi', JSON.stringify(o.locali));
  }
  window.__letture = 0;
  const giu = () => { const e = new Error('offline'); e.code = 'unavailable'; return e; };
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true,
    utente: () => o.utente,
    osserva: (cb) => { cb(o.utente); return () => {}; },
    conGoogle: async () => o.utente, esci: async () => {},
    stanzeDelProfilo: async () => { if (o.senzaLinea) throw giu(); return (o.profilo || []).slice(); },
  };
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (codice) => window.Stanza.normalizza(codice),
    membri: async () => [],
    leggi: async () => null,
    motivo: () => 'stanza.nonRiuscito',
    statoDi: async (codici, utente) => {
      window.__letture++;
      if (o.senzaLinea) throw giu();
      return (codici || []).map((c) => {
        const st = (o.stanze || {})[c];
        if (!st || st.membro === false) return { codice: c, membro: false, proprietario: false };
        return { codice: c, membro: true, proprietario: st.proprietario === utente.uid, nome: st.nome, inizio: st.inizio, fine: st.fine };
      });
    },
  };
}, JSON.stringify(o)];

const testo = (a) => a.page.locator('main').innerText();
const home = (a) => a.page.locator('[data-scheda="campi"]');
const vociMenu = async (a) => {
  await a.page.click('button[aria-label="Menu"]');
  await a.page.waitForTimeout(300);
  const v = await a.page.locator('nav button').allInnerTexts();
  // Si chiude toccando il velo a destra del cassetto.
  await a.page.mouse.click(380, 400);
  await a.page.waitForTimeout(300);
  return v.map((x) => x.trim().toLowerCase());
};

(async () => {
  // ---------- 1. Registrata, senza campo aperto: la home, dal profilo ----------
  {
    const a = await apri({
      admin: false,
      initScript: scena({
        utente: ANNA,
        profilo: ['K7RX2MQP', 'BCDFGHJK'],
        stanze: {
          K7RX2MQP: { nome: 'Estate in Abruzzo', inizio: '2027-08-11', fine: '2027-08-16', proprietario: 'anna-1' },
          BCDFGHJK: { nome: 'Capodanno in baita', inizio: '2026-12-30', fine: '2027-01-02', proprietario: 'altri' },
        },
      }),
    });
    ok('senza un campo si arriva alla home, non a un\'app vuota', (await home(a).count()) === 1);
    await attendi(a.page, () => /Estate in Abruzzo/.test(document.querySelector('main').innerText));
    const t = await testo(a);
    ok('l\'elenco arriva dal profilo, con i nomi letti dalle stanze',
      /Estate in Abruzzo/.test(t) && /Capodanno in baita/.test(t));
    ok('con il ruolo di ognuno', /organizzi tu/i.test(t) && /partecipi/i.test(t));
    ok('e la nota giusta per chi è registrato', /ti segue su ogni telefono/i.test(t));
    ok('le due strade per un campo nuovo ci sono', /crea una stanza/i.test(t) && /entra con un codice/i.test(t));

    const menu = await vociMenu(a);
    ok(`nel menu: i miei campi, crea, partecipa, impostazioni (${menu.join(' | ')})`,
      menu.length === 4 && menu[0] === 'i miei campi' && menu.includes('impostazioni'));

    // ---------- 2. Toccare un campo lo apre ----------
    await a.page.locator('[data-campo="K7RX2MQP"]').click();
    await attendi(a.page, () => !document.querySelector('[data-scheda="campi"]'));
    ok('toccando un campo si apre l\'app, sul calendario',
      /calendario/i.test(await a.page.locator('header').innerText()));
    ok('dentro quel campo', (await a.page.evaluate(() => localStorage.getItem('cambusa_stanza'))) === 'K7RX2MQP');
    const dentro = await vociMenu(a);
    ok(`dentro un campo il menu è intero, e la home resta raggiungibile (${dentro.length} voci)`,
      dentro.length >= 14 && dentro[0] === 'i miei campi' && !dentro.includes('crea un campo'));

    // ---------- 3. Dalla home a un altro campo ----------
    await a.menu('I miei campi');
    await attendi(a.page, () => !!document.querySelector('[data-scheda="campi"]'));
    ok('dalla home si vede dove si è', /sei qui/i.test(await home(a).innerText()));
    await a.page.locator('[data-campo="BCDFGHJK"]').click();
    await attendi(a.page, () => localStorage.getItem('cambusa_stanza') === 'BCDFGHJK'
      && localStorage.getItem('cambusa_cassetto_di') === 'BCDFGHJK');
    ok('e se ne apre un altro: col suo cassetto', true);
    await attendi(a.page, () => !!document.querySelector('button[aria-label="Menu"]'));
    ok('sul calendario anche dopo il cambio di cassetto',
      /calendario/i.test(await a.page.locator('header').innerText()));
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  // ---------- 4. Senza linea: la home si apre lo stesso, con i nomi di ieri ----------
  {
    const a = await apri({
      admin: false,
      initScript: scena({
        utente: ANNA,
        senzaLinea: true,
        locali: [{ codice: 'K7RX2MQP', nome: 'Estate in Abruzzo', inizio: '2027-08-11', fine: '2027-08-16', ruolo: 'proprietario' }],
      }),
    });
    await attendi(a.page, () => window.__letture > 0);
    const t = await testo(a);
    ok('senza linea la home mostra l\'elenco che il telefono ricorda', /Estate in Abruzzo/.test(t));
    ok('e non si spaventa nessuno: niente errori a schermo', !/non riuscit|errore/i.test(t));
    await a.page.locator('[data-campo="K7RX2MQP"]').click();
    await attendi(a.page, () => localStorage.getItem('cambusa_stanza') === 'K7RX2MQP');
    ok('e un campo si apre anche senza linea', true);
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  // ---------- 5. Entrato col codice: l'elenco sta sul telefono ----------
  // Chi è stato tolto da un campo non lo trova più; chi entra in uno nuovo
  // ce lo ritrova. E la nota dice dove sta l'elenco.
  {
    const a = await apri({
      admin: false,
      initScript: scena({
        utente: ANONIMO,
        locali: [
          { codice: 'MNPQRSTV', nome: 'Da cui mi hanno tolto', ruolo: 'redattore' },
          { codice: 'K7RX2MQP', ruolo: 'redattore' },
        ],
        stanze: {
          MNPQRSTV: { membro: false },
          K7RX2MQP: { nome: 'Estate in Abruzzo', inizio: '2027-08-11', fine: '2027-08-16', proprietario: 'altri' },
          '23456789': { nome: 'Il campo nuovo' },
        },
      }),
    });
    await attendi(a.page, () => /Estate in Abruzzo/.test(document.querySelector('main').innerText));
    const t = await testo(a);
    ok('il nome che il telefono non sapeva arriva dalla stanza', /Estate in Abruzzo/.test(t));
    ok('il campo da cui si è stati tolti sparisce', !/Da cui mi hanno tolto/.test(t));
    ok('la nota dice che l\'elenco sta su questo telefono', /sta su questo telefono/i.test(t));

    await home(a).locator('button', { hasText: /Entra con un codice/i }).click();
    await home(a).locator('input[placeholder="Codice"]').fill('2345-6789');
    await home(a).locator('button', { hasText: /^Entra$/i }).click();
    await attendi(a.page, () => localStorage.getItem('cambusa_stanza') === '23456789');
    const elenco = await a.page.evaluate(() => JSON.parse(localStorage.getItem('cambusa_campi') || '[]').map((v) => v.codice));
    ok(`entrando dalla home il campo nuovo si aggiunge all'elenco (${elenco.join(', ')})`,
      elenco.includes('23456789') && elenco.includes('K7RX2MQP'));
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }

  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
