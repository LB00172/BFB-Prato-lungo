// L'account c'è, e non è un muro.
//
// La prova unitaria (unita/auth) controlla le regole; questa controlla che a
// schermo succeda quello che dicono, e soprattutto che **l'app continui a
// funzionare senza account**. È la nota di prodotto del § 1, ed è il difetto
// che non si vede scrivendo il codice: si vede in montagna il primo giorno di
// campo, quando metà del gruppo non ha voglia di registrarsi e non c'è linea
// per farlo. Lì non si sistema.
//
// Firebase qui è finto. Non per comodità: un Firebase vero richiede provider
// accesi in console, domini autorizzati e email che partono davvero — cose
// che non stanno in una prova. Il finto però registra QUALE strada prende la
// registrazione, ed è il punto: con una sessione anonima aperta si deve
// PROMUOVERE (stesso uid, i dati restano), non creare un account nuovo.
const { apri, ok, fine, attendi } = require('../lib/app');

// La bandiera si accende intercettando APP_CONFIG, come in e2e/lingue:
// firebase-config.js lo riscrive per intero DOPO di noi.
const conAuth = (acceso, anonimo, profilo) => [(s) => {
  const o = JSON.parse(s);
  let vero;
  Object.defineProperty(window, 'APP_CONFIG', {
    configurable: true,
    get() { return vero; },
    set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { auth: o.acceso }) }); },
  });
  window.APP_CONFIG = {};

  // Il Firebase finto. Tiene traccia di tutto quello che gli viene chiesto,
  // così la prova può guardare COME è stato chiamato e non solo il risultato.
  window.__auth = { chiamate: [], utente: o.anonimo ? { uid: 'anon-1', email: '', nome: '', isAnonimo: true, emailVerificata: false } : null };
  let osservatori = [];
  const annuncia = () => osservatori.forEach((cb) => cb(window.__auth.utente ? Object.assign({}, window.__auth.utente) : null));
  Object.defineProperty(window, 'AuthCloud', {
    configurable: true,
    get() { return window.__ac; },
    set() { /* il modulo vero si assegna e viene ignorato: comanda il finto */ },
  });
  window.__ac = {
    disponibile: () => true,
    utente: () => window.__auth.utente,
    osserva: (cb) => { osservatori.push(cb); cb(window.__auth.utente); return () => { osservatori = osservatori.filter((x) => x !== cb); }; },
    registra: async (dati) => {
      // La decisione la prende la REGOLA vera (auth.js), non il finto: se
      // fosse il finto a guardare isAnonimo, questa prova verificherebbe se
      // stessa e la promozione potrebbe rompersi senza che nessuno se ne
      // accorga. Il finto fa solo quello che Firebase farebbe.
      const promuove = window.Auth.promuovibile(window.__auth.utente);
      window.__auth.chiamate.push({ che: promuove ? 'promuove' : 'crea', email: dati.email, citta: dati.citta, paese: dati.paese, lingua: dati.lingua });
      if (dati.email === 'presa@example.com') { const e = new Error('x'); e.code = 'auth/email-already-in-use'; throw e; }
      const uid = (window.__auth.utente && window.__auth.utente.uid) || 'nuovo-1';
      window.__auth.utente = { uid, email: dati.email, nome: [dati.nome, dati.cognome].join(' ').trim(), isAnonimo: false, emailVerificata: false };
      annuncia();
      return window.__auth.utente;
    },
    entra: async (email) => {
      window.__auth.chiamate.push({ che: 'entra', email });
      window.__auth.utente = { uid: 'u-1', email, nome: '', isAnonimo: false, emailVerificata: true };
      annuncia();
      return window.__auth.utente;
    },
    conGoogle: async () => {
      window.__auth.chiamate.push({ che: window.Auth.promuovibile(window.__auth.utente) ? 'collega-google' : 'google' });
      window.__auth.utente = { uid: (window.__auth.utente && window.__auth.utente.uid) || 'g-1', email: 'tizio@gmail.com', nome: 'Tizio Caio', isAnonimo: false, emailVerificata: true };
      annuncia();
      return window.__auth.utente;
    },
    // Il profilo che il vero Firestore restituirebbe: la lingua preferita di
    // chi entra, per vedere se l'app la rimette.
    leggiProfilo: async () => (window.__auth.utente && !window.__auth.utente.isAnonimo ? (o.profilo || null) : null),
    esci: async () => { window.__auth.chiamate.push({ che: 'esci' }); window.__auth.utente = null; annuncia(); },
    reimposta: async (email) => { window.__auth.chiamate.push({ che: 'reimposta', email }); },
    inviaVerifica: async () => { window.__auth.chiamate.push({ che: 'rimanda' }); },
    // Come Firebase: l'oggetto in memoria resta "da verificare" finché non si
    // ricarica. Qui la ricarica trova l'email confermata.
    ricarica: async () => {
      window.__auth.chiamate.push({ che: 'ricarica' });
      if (window.__auth.utente) { window.__auth.utente.emailVerificata = true; annuncia(); }
      return window.__auth.utente;
    },
  };
}, JSON.stringify({ acceso, anonimo, profilo })];

// I bottoni dell'app sono in maiuscolo per CSS (uppercase), quindi innerText
// restituisce "ENTRA CON GOOGLE" e un confronto sensibile alle maiuscole non
// aggancia niente. E' una trappola in cui il progetto e' gia' cascato tre
// volte: qui si guarda senza distinguere maiuscole e minuscole, sempre.
const impostazioni = async (a) => {
  await a.menu('Impostazioni');
  await a.page.waitForTimeout(400);
  return a.page.locator('main').innerText();
};

(async () => {
  // ---------- 1. Con la bandiera spenta non esiste, e l'app va ----------
  {
    const a = await apri({ initScript: conAuth(false, false) });
    const imp = await impostazioni(a);
    ok(`con FEATURES.auth spenta la tessera non c'è (${/entra con google/i.test(imp) ? "c'è ancora" : 'assente'})`,
      !/entra con google/i.test(imp));
    ok('nessun errore JavaScript con la bandiera spenta' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''),
      a.errori.length === 0);
    await a.browser.close();
  }

  // ---------- 2. Accesa: c'è, ma non sbarra la strada ----------
  // apri() aspetta il tasto del menu: se qualcuno mettesse il login davanti
  // all'app, quel tasto non ci sarebbe e la prova morirebbe su un timeout
  // senza dire perché. Si prende l'errore e gli si dà un nome — è la stessa
  // lezione di test/lib/schermate.js, dove una scheda che non si apre viene
  // annotata invece di far scadere l'attesa in silenzio.
  let a = null;
  try {
    a = await apri({ initScript: conAuth(true, false) });
  } catch (e) {
    a = null;
  }
  ok('con un account possibile, l\'app si apre lo stesso: nessun muro davanti'
    + (a ? '' : ' — L\'APP NON SI È APERTA: qualcuno ha messo il login davanti'), !!a);
  if (!a) { fine(); }

  // E non è un muro nemmeno più in là: si apre sul campo, non su un login.
  const primo = await a.page.locator('main').innerText();
  ok(`l'app si apre sul campo, non su un login (${primo.slice(0, 22).replace(/\n/g, ' ')}…)`,
    !/entra con google/i.test(primo));

  await a.menu('Membri');
  await a.page.waitForTimeout(300);
  await a.page.locator('main input[placeholder]').first().fill('Senza Account');
  await a.page.locator('main button', { hasText: /^\+$/ }).first().click();
  await a.page.waitForTimeout(400);
  const membri = await a.page.locator('main').innerText();
  ok(`da ospite si aggiunge un membro (${/Senza Account/.test(membri) ? 'aggiunto' : 'NON aggiunto'})`,
    /Senza Account/.test(membri));

  const imp = await impostazioni(a);
  ok('con la bandiera accesa la tessera c\'è', /entra con google/i.test(imp));
  ok('e dice a cosa serve l\'account', /creare/i.test(imp) && /amministrarlo/i.test(imp));

  // ---------- 3. La validazione parla prima di Firebase ----------
  await a.page.locator('main button', { hasText: /Crea un account/ }).click();
  await a.page.waitForTimeout(300);
  const campo = (segno) => a.page.locator(`main input[placeholder="${segno}"]`).first();
  await campo('Nome').fill('Mario');
  await campo('Cognome').fill('Rossi');
  await campo('Città').fill('Pescara');
  await a.page.locator('main select[data-paese]').selectOption('IT');
  await campo('Email').fill('mario@example.com');
  await campo('Password').fill('corta');
  await campo('Ripeti la password').fill('corta');
  await a.page.locator('main button', { hasText: /^Registrati$/ }).click();
  await a.page.waitForTimeout(300);
  const corta = await a.page.locator('main').innerText();
  ok(`una password corta lo dice, in italiano (${/otto caratteri/.test(corta) ? 'detto' : 'NON detto'})`,
    /almeno otto caratteri/.test(corta));
  const chiamate1 = await a.page.evaluate(() => window.__auth.chiamate.length);
  ok(`e Firebase non viene nemmeno disturbato (${chiamate1} chiamate)`, chiamate1 === 0);

  // ---------- 4. Un codice di Firebase diventa una frase ----------
  await campo('Email').fill('presa@example.com');
  await campo('Password').fill('cavallo-batteria');
  await campo('Ripeti la password').fill('cavallo-batteria');
  await a.page.locator('main button', { hasText: /^Registrati$/ }).click();
  await a.page.waitForTimeout(400);
  const presa = await a.page.locator('main').innerText();
  ok(`"email-already-in-use" diventa una frase (${/già un account/.test(presa) ? 'tradotto' : 'NON tradotto'})`,
    /ha già un account/.test(presa) && !/auth\//.test(presa));

  // ---------- 5. Registrazione riuscita: si resta da verificare ----------
  await campo('Email').fill('mario@example.com');
  await campo('Password').fill('cavallo-batteria');
  await campo('Ripeti la password').fill('cavallo-batteria');
  await a.page.locator('main button', { hasText: /^Registrati$/ }).click();
  await a.page.waitForTimeout(500);
  const dopo = await a.page.locator('main').innerText();
  ok(`dopo la registrazione si chiede di verificare l'indirizzo (${/ho verificato/i.test(dopo) ? 'chiesto' : 'NON chiesto'})`,
    /ho verificato/i.test(dopo) && /mario@example\.com/.test(dopo));

  // Firebase non si accorge da solo del link cliccato: serve la ricarica.
  await a.page.locator('main button', { hasText: /^Ho verificato$/ }).click();
  await a.page.waitForTimeout(500);
  const verificato = await a.page.locator('main').innerText();
  ok(`toccando "Ho verificato" si diventa registrati (${/sei entrato come/i.test(verificato) ? 'sì' : 'no'})`,
    /sei entrato come/i.test(verificato) && /Mario Rossi/i.test(verificato));
  // Si cerca il BOTTONE, non la parola nel testo della pagina: innerText
  // incolla i bottoni affiancati senza spazio, e da quando sotto "Esci" c'e'
  // "Cancella l'account" il testo diceva "ESCICANCELLA L'ACCOUNT" — e
  // \besci\b non trovava piu' il confine di parola, con il bottone li'.
  ok('e compare il tasto per uscire',
    (await a.page.locator('main button', { hasText: /^esci$/i }).count()) >= 1);

  ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await a.browser.close();

  // ---------- 6. La promozione: stesso uid, i dati restano ----------
  // È la differenza fra "chi usa l'app oggi non perde niente" e "chi usa
  // l'app oggi riparte da zero": su Firestore i dati sono appesi all'uid.
  {
    const b = await apri({ initScript: conAuth(true, true) });
    await impostazioni(b);
    await b.page.locator('main button', { hasText: /Crea un account/ }).click();
    await b.page.waitForTimeout(300);
    const c = (segno) => b.page.locator(`main input[placeholder="${segno}"]`).first();
    await c('Nome').fill('Anna');
    await c('Cognome').fill('Bianchi');
    await c('Città').fill('Roma');
    await b.page.locator('main select[data-paese]').selectOption('IT');
    await c('Email').fill('anna@example.com');
    await c('Password').fill('cavallo-batteria');
    await c('Ripeti la password').fill('cavallo-batteria');
    await b.page.locator('main button', { hasText: /^Registrati$/ }).click();
    await b.page.waitForTimeout(500);
    const esito = await b.page.evaluate(() => ({ chiamate: window.__auth.chiamate, uid: window.__auth.utente && window.__auth.utente.uid }));
    ok(`con una sessione anonima aperta si PROMUOVE, non si crea (${(esito.chiamate[0] || {}).che})`,
      esito.chiamate.length === 1 && esito.chiamate[0].che === 'promuove');
    ok(`e l'uid non cambia (${esito.uid})`, esito.uid === 'anon-1');
    ok('nessun errore JavaScript nella promozione' + (b.errori.length ? ': ' + b.errori.join(' | ') : ''),
      b.errori.length === 0);
    await b.browser.close();
  }

  // ---------- 7. Il modulo completo, e la lingua preferita ----------
  // Il 30 settembre la registrazione e' diventata il modulo classico: nome,
  // cognome, citta', paese, email, password due volte, lingua preferita. La
  // lingua scelta si prende subito, e torna su un telefono nuovo entrando.
  {
    const d = await apri({ initScript: conAuth(true, false) });
    await impostazioni(d);
    await d.page.locator('main button', { hasText: /Crea un account/ }).click();
    await d.page.waitForSelector('[data-modulo-registrazione]');
    const c = (segno) => d.page.locator(`main input[placeholder="${segno}"]`).first();
    // L'ordine del modulo: chi sei, dove stai, come entri, che lingua parli.
    const ordine = await d.page.evaluate(() => {
      const sel = [['nome', 'input[autocomplete="given-name"]'], ['cognome', 'input[autocomplete="family-name"]'], ['città', '[data-citta]'],
        ['paese', '[data-paese]'], ['email', 'input[type=email]'], ['password', 'input[autocomplete="new-password"]:not([data-ripeti])'],
        ['ripeti', '[data-ripeti]'], ['lingua', '[data-lingua-preferita]']];
      return sel.map(([n, q]) => [n, document.querySelector('main ' + q)]).filter(([, el]) => el)
        .sort(([, x], [, y]) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).map(([n]) => n);
    });
    ok(`il modulo ha tutto, in quest'ordine (${ordine.join(', ')})`,
      ordine.join(',') === 'nome,cognome,città,paese,email,password,ripeti,lingua');
    ok('i paesi si leggono nella lingua dell\'app', /Spagna/.test(await d.page.locator('main select[data-paese]').innerText()));
    ok('la lingua preferita parte da quella dell\'app', (await d.page.locator('[data-lingua-preferita="it"]').getAttribute('aria-pressed')) === 'true');
    ok('e chi si registra sa a chi scrivere se l\'email non arriva',
      /darkpsyco87@gmail\.com/.test(await d.page.evaluate(() => { const x = document.querySelector('[data-email-sistema]'); return x ? x.innerText : ''; })));

    await c('Nome').fill('Ana');
    await c('Cognome').fill('García');
    await c('Città').fill('Sevilla');
    await d.page.locator('main select[data-paese]').selectOption('ES');
    await c('Email').fill('ana@example.com');
    await c('Password').fill('girasoles-8');
    await c('Ripeti la password').fill('girasoles-9');
    await d.page.locator('[data-lingua-preferita="es"]').click();
    await d.page.locator('main button', { hasText: /^Registrati$/ }).click();
    await d.page.waitForTimeout(300);   // qui si verifica che NON parta niente
    ok('due password diverse si dicono, e non si registra niente',
      /non sono uguali/.test(await d.page.locator('main').innerText())
      && (await d.page.evaluate(() => window.__auth.chiamate.length)) === 0);
    await c('Ripeti la password').fill('girasoles-8');
    await d.page.locator('main button', { hasText: /^Registrati$/ }).click();
    await attendi(d.page, () => window.__auth.chiamate.length > 0).catch(() => {});
    const chiamata = await d.page.evaluate(() => window.__auth.chiamate[0]);
    ok(`alla registrazione arrivano città, paese e lingua (${JSON.stringify([chiamata.citta, chiamata.paese, chiamata.lingua])})`,
      chiamata.citta === 'Sevilla' && chiamata.paese === 'ES' && chiamata.lingua === 'es');
    await attendi(d.page, () => localStorage.getItem('cambusa_lingua') === 'es').catch(() => {});
    ok('e l\'app passa subito alla lingua preferita', /ajustes/i.test(await d.page.locator('header').innerText()) && (await d.page.evaluate(() => localStorage.getItem('cambusa_lingua'))) === 'es');
    ok('nessun errore JavaScript nel modulo' + (d.errori.length ? ': ' + d.errori.join(' | ') : ''), d.errori.length === 0);
    await d.browser.close();
  }

  // ---------- 8. Su un telefono nuovo la lingua torna entrando ----------
  {
    const e = await apri({ initScript: conAuth(true, false, { lingua: 'fr' }) });
    await impostazioni(e);
    await e.page.locator('main button', { hasText: /ho già un account/i }).click();
    await e.page.locator('main input[type=email]').fill('ana@example.com');
    await e.page.locator('main input[type=password]').fill('girasoles-8');
    await e.page.locator('main button', { hasText: /^entra$/i }).click();
    await attendi(e.page, () => localStorage.getItem('cambusa_lingua') === 'fr').catch(() => {});
    ok('entrando, l\'app prende la lingua preferita del profilo', /réglages/i.test(await e.page.locator('header').innerText()));
    await e.browser.close();
  }

  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
