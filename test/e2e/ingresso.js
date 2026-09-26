// La schermata d'apertura: chi la vede, chi no, e dove porta.
//
// Compare solo quando mancano TUTTE e due le cose — un account vero e un
// campo — perche' ognuna delle due basta a sapere chi sei o dove vai. La
// prova e' fatta soprattutto dei casi in cui NON deve comparire: una
// schermata di accesso che si ripresenta a chi e' gia' entrato e' la cosa
// che fa disinstallare un'app, e una prova che controllasse solo che compaia
// passerebbe anche con una schermata che compare sempre.
//
// (CLAUDE.md: ogni avviso va chiesto anche al contrario — quando NON deve
// comparire?)
const { apri, ingressoFinto, ok, fine } = require('../lib/app');

// I selettori sul testo a schermo vanno con /i: i bottoni sono in maiuscolo
// per CSS e innerText restituisce il disegnato.
const ANONIMO = { uid: 'anon-1', email: '', nome: '', isAnonimo: true, emailVerificata: false };
const REGISTRATO = { uid: 'u-1', email: 'anna@example.com', nome: 'Anna Rossi', isAnonimo: false, emailVerificata: true };
// Il segno della schermata, non il logo: il logo c'e' anche nella schermata
// di benvenuto che la precede (e che sparisce da sola dopo due secondi) e nel
// cassetto del menu. Cercando il logo la prova prendeva la schermata sbagliata
// e controllava tutto troppo presto.
const LOGO = '[data-schermata="ingresso"]';
const vedo = (page, testo) => page.locator('button', { hasText: testo }).count();

(async () => {
  // ---------- 1. Ospite, senza campo: la schermata c'e' ----------
  {
    const { browser, page, errori } = await apri({
      initScript: [ingressoFinto, { utente: null, senzaCampo: true }],
      aspetta: LOGO,
    });
    ok('a un ospite senza campo compare il logo', (await page.locator(LOGO).count()) === 1);
    ok('con l\'accesso con Google', (await vedo(page, /entra con google/i)) >= 1);
    ok('e la strada del codice, senza account', (await vedo(page, /ho un codice/i)) === 1);
    ok('e niente menu: l\'app non c\'e\' ancora', (await page.locator('button[aria-label="Menu"]').count()) === 0);

    // Entrare con Google porta DENTRO, non a un'altra schermata di accesso.
    await page.locator('button', { hasText: /entra con google/i }).first().click();
    await page.waitForSelector('button[aria-label="Menu"]', { timeout: 8000 }).catch(() => {});
    ok('entrando con Google si arriva all\'app',
      (await page.locator('button[aria-label="Menu"]').count()) === 1);
    ok('e la schermata d\'apertura sparisce', (await page.locator(LOGO).count()) === 0);
    ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
    await browser.close();
  }

  // ---------- 2. Anonimo, senza campo: e' ancora "senza account" ----------
  // L'anonimo non e' una scelta della persona: e' l'accesso che la
  // sincronizzazione fa da sola aprendo l'app. Contarlo come "entrato"
  // vorrebbe dire che la schermata d'apertura non la vede mai nessuno.
  {
    const { browser, page } = await apri({
      initScript: [ingressoFinto, { utente: ANONIMO, senzaCampo: true }],
      aspetta: LOGO,
    });
    ok('anche un anonimo senza campo vede la schermata d\'apertura', (await page.locator(LOGO).count()) === 1);

    // "Ho un codice" porta alla scheda della stanza, pronta per il codice.
    await page.locator('button', { hasText: /ho un codice/i }).first().click();
    await page.waitForSelector('button[aria-label="Menu"]', { timeout: 8000 }).catch(() => {});
    ok('"Ho un codice" apre l\'app', (await page.locator('button[aria-label="Menu"]').count()) === 1);
    ok('sulla scheda della stanza, con la casella del codice pronta',
      (await page.locator('main input[autocapitalize="characters"], main input[placeholder*="K7RX" i], main input[inputmode="text"]').count()) >= 1
      || (await page.locator('main').innerText()).match(/codice/i) !== null);
    await browser.close();
  }

  // ---------- 3. Gia' entrato, senza campo: NON deve comparire ----------
  // Il caso che conta di piu'. Chi ha fatto l'accesso resta collegato: la
  // sessione la tiene Firebase, e questa schermata non la richiede.
  {
    const { browser, page } = await apri({
      initScript: [ingressoFinto, { utente: REGISTRATO, senzaCampo: true }],
    });
    ok('chi e\' gia\' entrato non rivede la schermata d\'apertura', (await page.locator(LOGO).count()) === 0);
    ok('arriva dritto all\'app', (await page.locator('button[aria-label="Menu"]').count()) === 1);
    await browser.close();
  }

  // ---------- 4. Ospite CON un campo: NON deve comparire ----------
  // Chi ha gia' un campo — anche senza account — non deve ripassare di qui a
  // ogni apertura: sarebbe un muro davanti a una porta che ha gia' la chiave.
  {
    const { browser, page } = await apri({
      initScript: [ingressoFinto, { utente: null, senzaCampo: false }],
    });
    ok('un ospite che ha gia\' un campo non vede la schermata d\'apertura', (await page.locator(LOGO).count()) === 0);
    ok('e usa l\'app come prima', (await page.locator('button[aria-label="Menu"]').count()) === 1);
    await browser.close();
  }

  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
