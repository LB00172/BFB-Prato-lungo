// «Tieni il tuo posto»: chi e' entrato col solo codice lega il suo posto a
// Google, e non lo perde cambiando telefono.
//
// Tre cose, e le prime due sono il motivo per cui questa prova esiste:
//
//   1. da anonimo il collegamento tiene LO STESSO uid — la scheda nella
//      stanza resta sua — e poi il posto si rilegge con il codice salvato;
//   2. se quell'account Google era gia' usato (il telefono di prima), si
//      diventa lui, e si rientra nella stanza COL NUOVO uid e il codice
//      salvato. E' il caso tipico sul secondo telefono di chi aveva gia'
//      seguito il consiglio sul primo: senza, resterebbe anonimo con un
//      messaggio d'errore in mano;
//   3. chi un account ce l'ha gia' il riquadro non lo vede.
//
// Firebase e la stanza qui sono finti (ingressoFinto): la prova guarda il
// COLLEGAMENTO fra il bottone e il rientro, non il trasporto. Le regole che
// il trasporto usa sono provate altrove — Auth.passaAllAccountEsistente da
// unita/auth, Stanza.esitoRilettura da unita/stanza, e che rientrare non
// possa riscrivere la scheda da test/regole § 5-quater.
const { apri, ingressoFinto, ok, fine } = require('../lib/app');

const CODICE = 'TS9N-TC43';
const ANONIMO = { uid: 'anon-1', email: '', nome: '', isAnonimo: true, emailVerificata: false };
const REGISTRATO = { uid: 'u-1', email: 'anna@example.com', nome: 'Anna Rossi', isAnonimo: false, emailVerificata: true };
const RIQUADRO = '[data-riquadro="tieni-il-posto"]';

const collegaESpetta = async (page) => {
  await page.locator(RIQUADRO + ' button').first().click();
  // Si aspetta la CONDIZIONE, mai un numero di millisecondi (CLAUDE.md).
  await page.waitForFunction(() => (window.__stanza.chiamate || []).length > 0, null, { timeout: 8000 }).catch(() => {});
  return page.evaluate(() => ({
    auth: window.__auth.chiamate.slice(),
    stanza: window.__stanza.chiamate.slice(),
  }));
};

(async () => {
  // ---------- 1. Anonimo: si collega, stesso uid ----------
  {
    const { browser, page, menu, errori } = await apri({
      initScript: [ingressoFinto, { utente: ANONIMO, stanza: CODICE }],
    });
    await menu('Impostazioni');
    ok('chi e\' entrato col codice vede "tieni il tuo posto"', (await page.locator(RIQUADRO).count()) === 1);
    const c = await collegaESpetta(page);
    ok(`da anonimo si COLLEGA, non si crea un account nuovo (${c.auth.join(', ')})`,
      c.auth.indexOf('collega-google') >= 0);
    ok('e il posto si rilegge con il codice salvato e lo STESSO uid',
      c.stanza.some((x) => x.che === 'entra' && x.codice === CODICE && x.uid === 'anon-1'));
    await page.waitForFunction((sel) => !document.querySelector(sel), RIQUADRO, { timeout: 8000 }).catch(() => {});
    ok('poi il riquadro sparisce: un account adesso c\'e\'', (await page.locator(RIQUADRO).count()) === 0);
    ok('e lo si dice', /legato al tuo account Google/i.test(await page.locator('main').innerText()));
    ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
    await browser.close();
  }

  // ---------- 2. Google gia' usato altrove: si diventa lui, e si rientra ----------
  {
    const { browser, page, menu } = await apri({
      initScript: [ingressoFinto, { utente: ANONIMO, stanza: CODICE, googleGiaUsato: true }],
    });
    await menu('Impostazioni');
    const c = await collegaESpetta(page);
    ok('con Google gia\' usato altrove si rientra nella stanza COL NUOVO uid',
      c.stanza.some((x) => x.che === 'entra' && x.codice === CODICE && x.uid === 'g-vecchio'));
    ok('e non con quello anonimo di prima', !c.stanza.some((x) => x.uid === 'anon-1'));
    await browser.close();
  }

  // ---------- 3. Chi ha gia' un account non lo vede ----------
  {
    const { browser, page, menu } = await apri({
      initScript: [ingressoFinto, { utente: REGISTRATO, stanza: CODICE }],
    });
    await menu('Impostazioni');
    ok('chi ha gia\' un account non vede il riquadro', (await page.locator(RIQUADRO).count()) === 0);
    await browser.close();
  }

  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
