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
  await page.addInitScript((h) => localStorage.setItem('cambusa_unlock', h), SBLOCCO);
  // initScript: una funzione, oppure [funzione, argomento] se le serve un dato.
  if (o.initScript) await page.addInitScript(...[].concat(o.initScript));

  const errori = [];
  page.on('pageerror', (e) => errori.push(e.message));
  page.on('dialog', (d) => d.accept());

  await page.goto(URL_APP + '/index.html', { waitUntil: 'load' });
  await page.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });

  const menu = async (voce) => {
    await page.click('button[aria-label="Menu"]');
    await page.waitForTimeout(250);
    await page.locator('nav button', { hasText: voce }).first().click();
    await page.waitForTimeout(300);
  };

  return { browser, ctx, page, menu, errori };
}

module.exports = { chromium, apri, ok, fine, URL_APP, SBLOCCO };
