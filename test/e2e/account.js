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
const { apri, ok, fine } = require('../lib/app');

// La bandiera si accende intercettando APP_CONFIG, come in e2e/lingue:
// firebase-config.js lo riscrive per intero DOPO di noi.
const conAuth = (acceso, anonimo) => [(s) => {
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
      window.__auth.chiamate.push({ che: promuove ? 'promuove' : 'crea', email: dati.email });
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
}, JSON.stringify({ acceso, anonimo })];

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
  await campo('Email').fill('mario@example.com');
  await campo('Password').fill('corta');
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
  await a.page.locator('main button', { hasText: /^Registrati$/ }).click();
  await a.page.waitForTimeout(400);
  const presa = await a.page.locator('main').innerText();
  ok(`"email-already-in-use" diventa una frase (${/già un account/.test(presa) ? 'tradotto' : 'NON tradotto'})`,
    /ha già un account/.test(presa) && !/auth\//.test(presa));

  // ---------- 5. Registrazione riuscita: si resta da verificare ----------
  await campo('Email').fill('mario@example.com');
  await campo('Password').fill('cavallo-batteria');
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
  ok('e compare il tasto per uscire', /\besci\b/i.test(verificato));

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
    await c('Email').fill('anna@example.com');
    await c('Password').fill('cavallo-batteria');
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

  fine();
})();
