// Cancellare l'account: il requisito di Google Play (ROADMAP § 3), e il
// campo che non deve restare senza padrone.
//
// La prova e' fatta soprattutto del caso in cui la cancellazione deve
// FERMARSI: chi e' proprietario di un campo non puo' sparire, perche' il
// campo resterebbe senza nessuno che lo amministri o lo possa cancellare. Se
// la prova guardasse solo che "cancella" funzioni, passerebbe anche con
// un'app che cancella tutto e lascia i campi orfani.
//
// Firebase e la stanza sono finti (ingressoFinto): qui si guarda il
// collegamento — il bottone, la conferma, l'ordine dei passi, cosa resta sul
// telefono. La regola vera (chi va fermato, cosa va tolto) e' pura e sta in
// Stanza.pianoCancellazione, provata da unita/stanza; e che le regole
// Firestore permettano i passi che l'app fa lo prova test/regole.
const { apri, ingressoFinto, ok, fine } = require('../lib/app');

const CODICE = 'TS9N-TC43';
const REGISTRATO = { uid: 'u-1', email: 'anna@example.com', nome: 'Anna Rossi', isAnonimo: false, emailVerificata: true };
const ANONIMO = { uid: 'anon-1', email: '', nome: '', isAnonimo: true, emailVerificata: false };
const BOTTONE = /cancella l'account/i;

const chiamate = (page) => page.evaluate(() => ({
  ordine: window.__ordine.slice(),
  auth: window.__auth.chiamate.slice(),
  stanza: window.__stanza.chiamate.slice(),
  salvata: localStorage.getItem('cambusa_stanza'),
}));

(async () => {
  // ---------- 1. Da membro: si toglie la scheda, poi l'account ----------
  {
    const { browser, page, menu, errori } = await apri({
      initScript: [ingressoFinto, { utente: REGISTRATO, stanza: CODICE, stanzeProfilo: ['BBBB3333'] }],
    });
    await menu('Impostazioni');
    await page.locator('main button', { hasText: BOTTONE }).first().click();
    await page.waitForFunction(() => window.__auth.chiamate.indexOf('cancella') >= 0, null, { timeout: 8000 }).catch(() => {});
    const c = await chiamate(page);
    const guardate = (c.stanza.find((x) => x.che === 'statoDi') || {}).codici || [];
    ok(`si guardano le stanze del profilo E quella del telefono (${guardate.join(', ')})`,
      guardate.indexOf('BBBB3333') >= 0 && guardate.indexOf(CODICE) >= 0);
    const tolte = c.stanza.find((x) => x.che === 'togliMe');
    ok('da semplice membro si toglie la propria scheda, col proprio uid',
      !!tolte && tolte.uid === 'u-1' && tolte.codici.length === 2);
    ok('e poi si cancellano profilo e account', c.auth.indexOf('cancella') >= 0);
    // L'ordine conta: senza account le regole non lasciano piu' togliere la
    // scheda, che resterebbe nella stanza per sempre.
    ok(`la scheda si toglie PRIMA dell'account (${c.ordine.join(' → ')})`,
      c.ordine.indexOf('togliMe') >= 0 && c.ordine.indexOf('togliMe') < c.ordine.indexOf('cancella'));
    await page.waitForFunction(() => localStorage.getItem('cambusa_stanza') === '' || localStorage.getItem('cambusa_stanza') === null, null, { timeout: 8000 }).catch(() => {});
    const dopo = await chiamate(page);
    ok('e il telefono esce dalla stanza, dove una scheda non c\'e\' piu\'', !dopo.salvata);
    ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
    await browser.close();
  }

  // ---------- 2. Da proprietario: ci si ferma, e non si tocca niente ----------
  {
    const { browser, page, menu } = await apri({
      initScript: [ingressoFinto, { utente: REGISTRATO, stanza: CODICE, proprietario: true }],
    });
    await menu('Impostazioni');
    await page.locator('main button', { hasText: BOTTONE }).first().click();
    await page.waitForFunction(() => window.__stanza.chiamate.some((x) => x.che === 'statoDi'), null, { timeout: 8000 }).catch(() => {});
    // Qui l'attesa fissa e' giusta: si verifica che qualcosa NON succeda.
    await page.waitForTimeout(600);
    const c = await chiamate(page);
    ok('il proprietario di un campo NON perde l\'account', c.auth.indexOf('cancella') < 0);
    ok('e nemmeno le schede nelle altre stanze', !c.stanza.some((x) => x.che === 'togliMe'));
    ok('e gli si dice di quale campo e\' proprietario, e cosa fare',
      /proprietario di TS9N-TC43/i.test(await page.locator('main').innerText()));
    ok('la stanza resta sul telefono', c.salvata === CODICE);
    await browser.close();
  }

  // ---------- 3. Un anonimo non ha un account da cancellare ----------
  {
    const { browser, page, menu } = await apri({
      initScript: [ingressoFinto, { utente: ANONIMO, stanza: CODICE }],
    });
    await menu('Impostazioni');
    ok('chi e\' entrato col solo codice non vede "cancella l\'account"',
      (await page.locator('main button', { hasText: BOTTONE }).count()) === 0);
    await browser.close();
  }

  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
