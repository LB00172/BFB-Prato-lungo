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

// Impronta della password del campo: la scrivo in localStorage così i test
// entrano già sbloccati, senza passare dalla schermata di blocco.
const SBLOCCO = '432631a6d9164150bff2cef2afebf83fc36f43fe04c658bac55ec89dbeda8a14';

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
  }, { h: SBLOCCO, admin: o.admin !== false });
  // initScript: una funzione, oppure [funzione, argomento] se le serve un dato.
  if (o.initScript) await page.addInitScript(...[].concat(o.initScript));

  const errori = [];
  page.on('pageerror', (e) => errori.push(e.message));
  page.on('dialog', (d) => d.accept());

  await page.goto(URL_APP + '/index.html', { waitUntil: 'load' });
  await page.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });

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

module.exports = { chromium, apri, ok, fine, attendi, scontriniSalvati, fotoSalvate, URL_APP, SBLOCCO };
