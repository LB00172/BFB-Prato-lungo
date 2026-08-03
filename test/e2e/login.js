// Blocco con password, tema scuro e sezione Impostazioni.
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 820 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.addInitScript(() => localStorage.setItem('cambusa_sync_optout', '1'));

  const entra = async (pwd) => {
    await p.fill('input[placeholder="••••••••"]', pwd);
    await p.locator('button', { hasText: /Entra|Verifica/ }).first().click();
    await p.waitForTimeout(700);
  };

  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(600);

  // --- 1. Senza password non si entra ---
  const bloccata = await p.locator('input[placeholder="••••••••"]').count();
  const appVisibile = await p.locator('button[aria-label="Menu"]').count();
  console.log('schermata di blocco all\'avvio:', bloccata > 0 ? 'OK' : 'PROBLEMA');
  console.log('app nascosta dietro il blocco:', appVisibile === 0 ? 'OK' : 'PROBLEMA');
  const testoBlocco = await p.locator('body').innerText();
  console.log('la password NON è scritta nella pagina:', !/Bandy2026/.test(testoBlocco) ? 'OK' : 'PROBLEMA');
  const sorgente = await p.evaluate(async () => {
    const f = await Promise.all(['App.js', 'firebase-config.js', 'index.html'].map((u) => fetch(u).then((r) => r.text())));
    return f.join('\n');
  });
  console.log('la password NON è nel codice scaricato:', !/Bandy2026/.test(sorgente) ? 'OK' : 'PROBLEMA');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-blocco.png') });

  // --- 2. Password sbagliata ---
  await entra('sbagliata');
  const err = await p.locator('body').innerText();
  console.log('password sbagliata respinta:', /Password sbagliata/.test(err) ? 'OK' : 'PROBLEMA');
  console.log('mostra i tentativi rimasti:', /tentativi prima dell/.test(err) ? 'OK' : 'PROBLEMA');
  console.log('app ancora chiusa:', (await p.locator('button[aria-label="Menu"]').count()) === 0 ? 'OK' : 'PROBLEMA');

  // --- 3. Password giusta ---
  await entra('Bandy2026#');
  await p.waitForTimeout(500);
  const dentro = await p.locator('button[aria-label="Menu"]').count();
  console.log('password giusta -> entra:', dentro > 0 ? 'OK' : 'PROBLEMA');

  // --- 4. Ricarica: resta sbloccata ---
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(600);
  const splash = await p.locator('h1', { hasText: 'BRIGATA' }).count();
  await p.waitForTimeout(2200);   // lo splash dura 2 secondi
  console.log('dopo lo sblocco si vede lo splash, non il blocco:', splash > 0 && (await p.locator('input[placeholder="••••••••"]').count()) === 0 ? 'OK' : 'PROBLEMA');
  console.log('dopo il ricarico resta sbloccata:', (await p.locator('button[aria-label="Menu"]').count()) > 0 ? 'OK' : 'PROBLEMA');

  const menu = async (voce) => {
    await p.click('button[aria-label="Menu"]');
    await p.waitForTimeout(300);
    await p.locator('nav button', { hasText: voce }).first().click();
    await p.waitForTimeout(300);
  };

  // --- 5. Impostazioni: tema scuro ---
  await menu('Impostazioni');
  const vociImp = await p.locator('main h3').allInnerTexts();
  console.log('sezioni in Impostazioni:', JSON.stringify(vociImp));
  await p.locator('main button', { hasText: 'Scuro' }).first().click();
  await p.waitForTimeout(400);
  const stato = await p.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    salvato: localStorage.getItem('cambusa_theme'),
    fondo: getComputedStyle(document.body).backgroundColor,
    metaTema: (document.querySelector('meta[name="theme-color"]') || {}).content,
    testo: getComputedStyle(document.querySelector('main h3')).color,
  }));
  console.log('tema scuro attivo:', JSON.stringify(stato));
  const scuroOk = stato.attr === 'dark' && stato.salvato === 'dark' && /rgb\(26, 32, 26\)/.test(stato.fondo);
  console.log('fondo e attributo corretti:', scuroOk ? 'OK' : 'PROBLEMA');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-impostazioni-scuro.png'), fullPage: true });

  // Contrasto: il testo deve essere chiaro sul fondo scuro
  const chiaro = /rgb\((2[0-9][0-9]|1[5-9][0-9]), /.test(stato.testo);
  console.log('testo leggibile sul fondo scuro:', chiaro ? 'OK' : 'PROBLEMA (' + stato.testo + ')');

  // --- 6. Il tema scuro sopravvive al ricarico senza lampo chiaro ---
  await p.reload({ waitUntil: 'domcontentloaded' });
  const subito = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  console.log('tema applicato prima del disegno:', subito === 'dark' ? 'OK' : 'PROBLEMA');
  await p.waitForTimeout(800);

  // --- 7. Giro delle schermate in scuro, cercando testo illeggibile ---
  const sezioni = ['Calendario', 'Membri', 'Presenze', 'Spese Totali', 'Lista della Spesa', 'Attrezzatura', 'Regole', 'Dotazioni personali', 'Archivio', 'Come funziona'];
  for (const s of sezioni) {
    await menu(s);
    const guai = await p.evaluate(() => {
      const problemi = [];
      document.querySelectorAll('main *').forEach((el) => {
        if (!el.childNodes.length || !el.innerText || el.children.length) return;
        const c = getComputedStyle(el).color.match(/\d+/g);
        if (!c) return;
        const lum = (Number(c[0]) * 299 + Number(c[1]) * 587 + Number(c[2]) * 114) / 1000;
        if (lum < 90) problemi.push(el.innerText.slice(0, 30) + ' [' + getComputedStyle(el).color + ']');
      });
      return problemi.slice(0, 3);
    });
    console.log('  ' + s + ':', guai.length ? 'testo scuro su scuro -> ' + JSON.stringify(guai) : 'ok');
  }
  await menu('Spese Totali');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-spese-scuro.png'), fullPage: true });

  // --- 8. "Chiedi ogni volta" + Blocca ora ---
  await menu('Impostazioni');
  // "Blocco con password" ora è una riga richiudibile, chiusa di suo.
  await p.locator('button', { hasText: 'Blocco con password' }).first().click();
  await p.waitForTimeout(300);
  await p.locator('input[type="checkbox"]').first().check();
  await p.waitForTimeout(250);
  console.log('flag "chiedi ogni volta" salvato:', (await p.evaluate(() => localStorage.getItem('cambusa_lock_always'))) === '1' ? 'OK' : 'PROBLEMA');
  await p.locator('button', { hasText: 'Blocca ora' }).first().click();
  await p.waitForTimeout(500);
  console.log('"Blocca ora" richiude l\'app:', (await p.locator('input[placeholder="••••••••"]').count()) > 0 ? 'OK' : 'PROBLEMA');
  console.log('la schermata di blocco segue il tema scuro:', (await p.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark' ? 'OK' : 'PROBLEMA');

  await entra('Bandy2026#');
  // con "chiedi ogni volta" il ricarico (nuova sessione) deve richiedere la password
  await ctx.newPage();  // non tocca la sessione della prima pagina
  const p2 = await ctx.newPage();
  await p2.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p2.waitForTimeout(900);
  console.log('in una nuova finestra chiede di nuovo la password:', (await p2.locator('input[placeholder="••••••••"]').count()) > 0 ? 'OK' : 'PROBLEMA');

  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
