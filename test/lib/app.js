// Aiuti condivisi dai test: dove sta il browser, come si apre l'app già
// sbloccata, come si naviga nel menu, come si contano gli esiti.
const fs = require('fs');
const path = require('path');

// ---- Dove sta Chromium -------------------------------------------------
// Ordine: variabile d'ambiente -> cartella dei browser di Playwright ->
// browser di sistema. Così i test girano sia qui sia su un altro computer.
function chromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;

  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().reverse();
    for (const d of dirs) {
      const p = path.join(base, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chromium non trovato. Imposta CHROMIUM_PATH=/percorso/del/browser');
}

const URL_APP = process.env.APP_URL || 'http://localhost:8091';

// Il campo in cui si aprono le prove: firebase-config.js non ne ha piu' uno.
const CAMPO_DI_PROVA = 'CampoDiProva';

// Lo stesso campo per le prove che aprono il browser da sole, senza apri():
//   await pagina.addInitScript(...campoDiProva());
// va messo prima della prima navigazione. Ridefinisce la proprieta' invece
// di scriverla perche' firebase-config.js assegna "" dopo di noi.
// Il luogo del campo per il meteo: nell'app pubblica firebase-config.js non
// ne ha (il meteo e' spento). Le prove che guardano il meteo se lo danno.
const luogoDiProva = () => [(l) => {
  Object.defineProperty(window, 'CAMP_LOCATION', { configurable: true, get() { return l; }, set() {} });
}, { lat: 42.0486, lon: 13.14855, alt: 1337, label: 'Luogo di prova' }];

const campoDiProva = () => [(c) => {
  Object.defineProperty(window, 'CAMP_CODE_DEFAULT', { configurable: true, get() { return c; }, set() {} });
}, CAMPO_DI_PROVA];

// Impronta della password del campo: la scrivo in localStorage così i test
// entrano già sbloccati, senza passare dalla schermata di blocco.
//
// Si LEGGE da firebase-config.js invece di ricopiarla qui. Ricopiata, il
// giorno in cui qualcuno cambia la password del campo tutte le prove e2e
// diventano rosse insieme, e per un motivo che non c'entra niente con quello
// che stavano provando — un pomeriggio buttato a cercare un guasto che non
// c'è. Si prende la prima `hash:` del file, che è quella di APP_LOCK:
// APP_ADMIN viene dopo.
const SBLOCCO = (() => {
  const testo = fs.readFileSync(path.join(__dirname, '..', '..', 'firebase-config.js'), 'utf8');
  const soloBlocco = testo.slice(0, testo.indexOf('window.APP_ADMIN'));
  const m = soloBlocco.match(/hash:\s*"([0-9a-f]{64})"/);
  // Nell'app pubblica il blocco non c'e' (APP_LOCK = null): niente da
  // sbloccare. Le prove che attraversano il blocco se ne installano uno loro
  // (bloccoDiProva, qui sotto).
  return m ? m[1] : '';
})();

// ---- Il blocco, per le prove che ci passano davvero --------------------
// Tre prove attraversano la schermata di blocco digitando la password, e per
// farlo avevano la password VERA del campo scritta in chiaro nel repository.
// È esattamente quello che CLAUDE.md (regola 3) vieta, ed era lì da mesi.
//
// Adesso quelle prove si installano un blocco LORO: un'impronta calcolata
// per una password che non apre niente di vero. Il segreto del campo non
// serve per provare che il blocco funziona — serve solo una password di cui
// si conosce l'impronta.
const PASSWORD_PROVA = 'prova-del-blocco';
const BLOCCO_PROVA = {
  salt: '6a82a5b35d6259dac32a3e6999e1a66a',
  hash: '485326cea2e0921943eaca2202ae5a6b601f3b8558b08efeed96105e5701da8b',
  iter: 200000,
  hint: 'Password di prova.',
  // Serve: App() chiede la password del database solo se il blocco dichiara
  // un utente condiviso (`if (!lock.dbEmail || !lock.hash) return;`). Senza,
  // e2e/autochiede proverebbe un caso che non puo' succedere. L'indirizzo e'
  // finto per davvero — `.invalid` e' il dominio riservato che non risolve
  // mai — e tanto in quella prova Firebase non c'e': c'e' un finto.
  dbEmail: 'prova@campo.invalid',
};

// firebase-config.js assegna window.APP_LOCK DOPO di noi: si intercetta
// l'assegnazione e si tiene la nostra, come si fa con APP_CONFIG altrove.
const bloccoDiProva = () => [(s) => {
  const mio = JSON.parse(s);
  Object.defineProperty(window, 'APP_LOCK', {
    configurable: true,
    get() { return mio; },
    set() { /* quello vero si assegna e viene ignorato */ },
  });
  window.APP_LOCK = mio;
}, JSON.stringify(BLOCCO_PROVA)];

// ---- Conteggio degli esiti ---------------------------------------------
// Ogni test chiama ok(...) e chiude con fine(): l'uscita diversa da zero è
// ciò che fa fallire "npm test".
let superate = 0;
let fallite = 0;

function ok(descrizione, condizione) {
  if (condizione) { superate++; console.log('OK   ' + descrizione); }
  else { fallite++; console.log('KO   ' + descrizione); }
  return !!condizione;
}

function fine(browser) {
  const chiudi = browser && browser.close ? browser.close() : Promise.resolve();
  return Promise.resolve(chiudi).then(() => {
    console.log(`\n${superate + fallite} verifiche — ${fallite ? fallite + ' FALLITE' : 'nessun problema'}`);
    process.exit(fallite ? 1 : 0);
  });
}

// ---- Apertura dell'app --------------------------------------------------
// Restituisce { browser, ctx, page, menu, errori }: "errori" raccoglie le
// eccezioni JS della pagina, che nessun test deve produrre.
// ---------- Un Firebase Authentication finto, e un'app senza campo ----------
// Serve alle prove che guardano COSA vede chi entra: la schermata d'apertura,
// il menu. Firebase vero qui non c'e' — richiederebbe provider accesi e
// domini autorizzati — e comunque non e' lui l'oggetto della prova.
//
// `utente` e' quello con cui si parte: null (ospite), o un oggetto nella forma
// di auth.js (isAnonimo, nome, emailVerificata). `senzaCampo` toglie le TRE
// strade da cui l'app prende un campo — la stanza scelta, il codice salvato e
// quello predefinito — perche' toglierne una sola lascia le altre due, e la
// prova misurerebbe un'app che il campo ce l'ha.
//
// Si usa come initScript: [ingressoFinto, { utente, senzaCampo }].
function ingressoFinto(o) {
  try {
    if (o.senzaCampo) {
      localStorage.removeItem('cambusa_stanza');
      localStorage.removeItem('cambusa_camp_code');
      // Lo script d'avvio gira PRIMA di firebase-config.js, che poi riassegna:
      // si blocca la proprieta' invece di scriverla.
      Object.defineProperty(window, 'CAMP_CODE_DEFAULT', { value: '', writable: false, configurable: true });
    }
  } catch (e) { /* niente */ }
  window.__auth = { utente: o.utente || null, chiamate: [] };
  // Un registro UNICO per i due finti: le chiamate stanno in due elenchi
  // separati, e da due elenchi non si legge l'ordine in cui sono avvenute.
  window.__ordine = [];
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
    // Come Firebase: da anonimo COLLEGA (lo stesso uid resta), a meno che
    // quell'account Google non sia gia' usato altrove (`googleGiaUsato`) —
    // allora si diventa lui, con il suo uid. La scelta di COSA fare in quel
    // caso non sta qui: sta in Auth.passaAllAccountEsistente, provata da
    // unita/auth. Il finto fa solo quello che Firebase farebbe.
    conGoogle: async () => {
      const prima = window.__auth.utente;
      const collega = !!(prima && prima.isAnonimo && !o.googleGiaUsato);
      window.__auth.chiamate.push(collega ? 'collega-google' : 'google');
      window.__auth.utente = {
        uid: collega ? prima.uid : (o.googleGiaUsato ? 'g-vecchio' : 'g-1'),
        email: 'tizio@gmail.com', nome: 'Tizio Caio', isAnonimo: false, emailVerificata: true,
      };
      annuncia();
      return window.__auth.utente;
    },
    esci: async () => { window.__auth.chiamate.push('esci'); window.__auth.utente = null; annuncia(); },
    // La cancellazione: le stanze che il profilo si e' segnato, e la
    // cancellazione vera. Il finto registra, la DECISIONE (proprietario si',
    // proprietario no) la prende Stanza.pianoCancellazione, quella vera.
    stanzeDelProfilo: async () => (o.stanzeProfilo || []).slice(),
    cancellaProfiloEAccount: async () => {
      window.__auth.chiamate.push('cancella');
      window.__ordine.push('cancella');
      window.__auth.utente = null;
      annuncia();
    },
  };

  // `stanza`: il codice della stanza in cui si e' gia' (salvato sul telefono).
  // Con una stanza serve anche un StanzaCloud finto, o i bottoni parlerebbero
  // col Firestore vero del progetto. Registra le chiamate, cosi' la prova
  // guarda CHI entra e CON QUALE codice.
  if (o.stanza) {
    try { localStorage.setItem('cambusa_stanza', o.stanza); } catch (e) { /* niente */ }
    window.__stanza = { chiamate: [] };
    Object.defineProperty(window, 'StanzaCloud', {
      configurable: true,
      get() { return window.__sc; },
      set() { /* il modulo vero si assegna e viene ignorato */ },
    });
    window.__sc = {
      disponibile: () => true,
      entra: async (codice, utente) => {
        window.__stanza.chiamate.push({ che: 'entra', codice, uid: utente && utente.uid });
        return codice;
      },
      crea: async () => { throw new Error('non serve in questa prova'); },
      membri: async () => [],
      leggi: async () => null,
      impronta: async () => 'impronta-finta',
      motivo: () => 'stanza.nonRiuscito',
      // `proprietario`: se vero, di ogni stanza guardata si risulta
      // proprietari — il caso in cui la cancellazione deve fermarsi.
      statoDi: async (codici) => {
        window.__stanza.chiamate.push({ che: 'statoDi', codici: (codici || []).slice() });
        return (codici || []).map((c) => ({ codice: c, membro: true, proprietario: !!o.proprietario }));
      },
      togliMe: async (codici, utente) => {
        window.__stanza.chiamate.push({ che: 'togliMe', codici: (codici || []).slice(), uid: utente && utente.uid });
        window.__ordine.push('togliMe');
      },
    };
  }
}

async function apri(opzioni) {
  const o = opzioni || {};
  const { chromium: pw } = require('playwright-core');
  const browser = await pw.launch({ executablePath: chromium(), args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: o.viewport || { width: 390, height: 840 },
    acceptDownloads: true,
    permissions: o.permissions || [],
  });
  const page = await ctx.newPage();
  // Sbloccata e — salvo richiesta contraria — in modalità tecnica: quasi tutte
  // le prove guardano diagnostica, registro e avvisi, che un utente normale
  // non vede. Con { admin: false } si prova l'app come la vede lui.
  await page.addInitScript((o) => {
    localStorage.setItem('cambusa_unlock', o.h);
    if (o.admin) localStorage.setItem('cambusa_admin', '1');
    // Quasi tutte le prove guardano un campo, e dal 28 settembre l'app
    // pubblica non ne ha uno predefinito: glielo si da' qui. Chi vuole l'app
    // senza campo lo toglie con ingressoFinto({ senzaCampo }), che gira dopo
    // e ridefinisce la stessa proprieta'.
    Object.defineProperty(window, 'CAMP_CODE_DEFAULT', {
      configurable: true,
      get() { return o.campo; },
      set() { /* firebase-config.js assegna "" dopo di noi: vale il nostro */ },
    });
  }, { h: o.blocco ? BLOCCO_PROVA.hash : SBLOCCO, admin: o.admin !== false, campo: CAMPO_DI_PROVA });
  // `blocco`: il blocco con password, per le prove che lo attraversano.
  // Nell'app pubblica non c'e' (APP_LOCK = null): se lo installano loro.
  if (o.blocco) await page.addInitScript(...bloccoDiProva());
  // initScript: una funzione, oppure [funzione, argomento] se le serve un dato.
  if (o.initScript) await page.addInitScript(...[].concat(o.initScript));

  // prima: quello che deve essere pronto PRIMA che l'app si apra — le
  // strade di rete finte, per esempio. Installate dopo, la prima richiesta
  // (quella dell'apertura) passerebbe loro davanti.
  if (o.prima) await o.prima(page);

  const errori = [];
  page.on('pageerror', (e) => errori.push(e.message));
  page.on('dialog', (d) => d.accept());

  await page.goto(URL_APP + '/index.html', { waitUntil: 'load' });
  // Di solito si aspetta il menu, cioe' l'app pronta. Ma dal 26 settembre
  // c'e' una schermata che viene PRIMA dell'app — quella d'apertura, per chi
  // non ha ne' un account ne' un campo — e li' il menu non c'e' apposta: una
  // prova che la guarda dice lei cosa aspettare.
  await page.waitForSelector(o.aspetta || 'button[aria-label="Menu"]', { timeout: 20000 });

  const menu = async (voce, ms) => {
    const t = ms || 30000;
    await page.click('button[aria-label="Menu"]', { timeout: t });
    await page.waitForTimeout(250);
    await page.locator('nav button', { hasText: voce }).first().click({ timeout: t });
    await page.waitForTimeout(300);
  };

  return { browser, ctx, page, menu, errori };
}

// ---- Attese ------------------------------------------------------------
// Aspettare "un tanto al chilo" è la causa numero uno delle prove che cadono
// a caso: l'elaborazione di un'immagine (decodifica + ridimensionamento su
// canvas) è l'operazione più lenta della suite, e sotto carico pieno sfora
// qualsiasi attesa fissa. Meglio aspettare che la condizione diventi vera.
function attendi(page, fn, arg, ms) {
  return page.waitForFunction(fn, arg, { timeout: ms || 15000 });
}

// Gli id delle foto salvate sul telefono, da dovunque stiano.
//
// Stavano in localStorage sotto 'cambusa_receipts'; da agosto 2026 stanno nel
// magazzino (IndexedDB), e la vecchia chiave resta solo come rete di sicurezza
// per i browser che il magazzino non lo concedono (ROADMAP.md § 19). Le prove
// devono chiedere "quali foto ci sono", non "cosa c'è in quella chiave":
// altrimenti descrivono un dettaglio di implementazione e diventano rosse
// ogni volta che si sposta qualcosa.
const LEGGI_FOTO = () => new Promise((ris) => {
  const daLocale = () => {
    try { return Object.keys(JSON.parse(localStorage.getItem('cambusa_receipts') || '{}')); }
    catch (e) { return []; }
  };
  let req;
  try { req = indexedDB.open('cambusa-foto', 1); } catch (e) { ris(daLocale()); return; }
  req.onerror = () => ris(daLocale());
  req.onsuccess = () => {
    let neg;
    try { neg = req.result.transaction('scontrini', 'readonly').objectStore('scontrini'); }
    catch (e) { ris(daLocale()); return; }
    const out = [];
    const c = neg.openCursor();
    c.onsuccess = () => {
      const cur = c.result;
      if (!cur) { ris(out.length ? out : daLocale()); return; }
      out.push(cur.key);
      cur.continue();
    };
    c.onerror = () => ris(daLocale());
  };
});

function fotoSalvate(page) { return page.evaluate(LEGGI_FOTO); }

// Aspetta che gli scontrini salvati sul telefono siano almeno n.
// Si interroga da qui invece che con waitForFunction perche' la lettura del
// magazzino e' una promessa: il predicato andrebbe serializzato dentro la
// pagina, e ci si ritroverebbe la stessa funzione scritta due volte.
async function scontriniSalvati(page, n, ms) {
  const scadenza = Date.now() + (ms || 15000);
  for (;;) {
    const ids = await fotoSalvate(page);
    if (ids.length >= n) return ids;
    if (Date.now() > scadenza) throw new Error(`solo ${ids.length} foto su ${n} attese`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

module.exports = { chromium, apri, campoDiProva, luogoDiProva, CAMPO_DI_PROVA, ingressoFinto, ok, fine, attendi, scontriniSalvati, fotoSalvate, URL_APP, SBLOCCO, bloccoDiProva, PASSWORD_PROVA, BLOCCO_PROVA };
