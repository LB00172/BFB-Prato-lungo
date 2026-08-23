// Le foto degli scontrini lasciano la memoria del telefono ai conti.
//
// Alla chiusura del campo 2026 l'export pesava 3,2 MB, di cui 3,18 erano 29
// foto di scontrini dentro localStorage — che di spazio ne ha circa 5. I dati
// che contano davvero (membri, presenze, spese, saldi) ne pesavano 35 KB in
// tutto: le foto occupavano NOVANTA VOLTE i dati che avrebbero dovuto
// proteggere. E quando lo spazio finisce, salvaLocale sacrifica le copie di
// sicurezza, mai le foto: era il percorso esatto per perdere una presenza per
// colpa di uno scontrino.
//
// Qui si semina la situazione vera — foto pesanti nella vecchia chiave — e si
// controllano le quattro cose che devono succedere:
//   1. le foto si spostano nel magazzino e la chiave vecchia sparisce;
//   2. non si perde una foto per strada, nemmeno dopo un riavvio;
//   3. localStorage torna piccolo, cioe' i conti hanno di nuovo posto;
//   4. senza magazzino (browser che non lo concede) l'app non crolla e lo dice.
const { apri, ok, fine } = require('../lib/app');

// Tre foto da circa 1 MB l'una: la stessa scala del campo vero.
const semina = () => {
  const foto = (n) => 'data:image/jpeg;base64,' + 'A'.repeat(n);
  localStorage.setItem('cambusa_members', JSON.stringify([
    { id: 'a', name: 'Alice', isChild: false },
    { id: 'b', name: 'Bruno', isChild: false },
  ]));
  localStorage.setItem('cambusa_camp_data', JSON.stringify({
    '2026-08-11': { note: '', guestsNames: '', meals: { a: { lunch: true, dinner: false } } },
  }));
  localStorage.setItem('cambusa_purchases', JSON.stringify([
    { id: 'p1', name: 'Spesa uno', price: 30, type: 'alimentare', buyer: 'Alice', at: 1 },
    { id: 'p2', name: 'Spesa due', price: 20, type: 'alimentare', buyer: 'Bruno', at: 2 },
    { id: 'p3', name: 'Spesa tre', price: 10, type: 'alimentare', buyer: 'Alice', at: 3 },
  ]));
  // La vecchia chiave, esattamente com'era prima: tutte le foto in un JSON.
  // "orfana" e' la foto di una voce che non esiste piu': succede quando la
  // spesa viene cancellata da un ALTRO telefono. Qui i tre acquisti non
  // cambiano mai, quindi solo la potatura legata alle foto puo' toglierla.
  localStorage.setItem('cambusa_receipts', JSON.stringify({
    p1: foto(1024 * 1024), p2: foto(1024 * 1024), p3: foto(1024 * 1024),
    orfana: foto(1024 * 512),
  }));
};

// Quanto occupa localStorage in tutto, in KB.
const pesoLocale = (p) => p.evaluate(() => Math.round(
  Object.keys(localStorage).reduce((s, k) => s + k.length + (localStorage.getItem(k) || '').length, 0) / 1024
));

// Cosa c'e' davvero nel magazzino: chiave -> lunghezza. null se non esiste.
const magazzino = (p) => p.evaluate(() => new Promise((ris) => {
  let req;
  try { req = indexedDB.open('cambusa-foto', 1); } catch (e) { ris(null); return; }
  req.onerror = () => ris(null);
  req.onsuccess = () => {
    let neg;
    try { neg = req.result.transaction('scontrini', 'readonly').objectStore('scontrini'); }
    catch (e) { ris(null); return; }
    const out = {};
    const c = neg.openCursor();
    c.onsuccess = () => {
      const cur = c.result;
      if (!cur) { ris(out); return; }
      out[cur.key] = String(cur.value || '').length;
      cur.continue();
    };
    c.onerror = () => ris(out);
  };
}));

(async () => {
  const { browser, page: p, ctx, menu, errori } = await apri({ initScript: semina });
  await p.waitForTimeout(1500);

  // --- 1. Le foto si sono spostate, la chiave vecchia non c'e' piu' ---
  const restaVecchia = await p.evaluate(() => localStorage.getItem('cambusa_receipts'));
  ok('la vecchia chiave di localStorage è sparita', restaVecchia === null);

  const mag = await magazzino(p);
  ok(`le tre foto stanno nel magazzino (${mag ? Object.keys(mag).sort().join(',') : 'nessun magazzino'})`,
    !!mag && Object.keys(mag).sort().join(',') === 'p1,p2,p3');
  ok(`e sono intere, non troncate (${mag ? Object.values(mag).map((n) => Math.round(n / 1024) + ' KB').join(' ') : '—'})`,
    !!mag && Object.values(mag).every((n) => n > 1024 * 1024));
  ok('la foto di una voce che non esiste più non resta nel magazzino',
    !!mag && !Object.prototype.hasOwnProperty.call(mag, 'orfana'));

  // --- 3. localStorage è tornato piccolo: i conti hanno posto ---
  const kb = await pesoLocale(p);
  ok(`localStorage è tornato a ${kb} KB (con 3 MB di foto in casa)`, kb < 200);

  // --- 2. L'app le vede: gli scontrini sono ancora attaccati alle spese ---
  await menu('Lista della Spesa');
  await p.locator('main button', { hasText: /^Acquistato/ }).first().click();
  await p.waitForTimeout(500);
  const macchine = await p.locator('main button[aria-label="Vedi scontrino"]').count();
  ok(`le tre spese mostrano ancora il loro scontrino (${macchine})`, macchine === 3);

  // --- 2-bis. E dopo un riavvio dell'app ci sono ancora ---
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const magDopo = await magazzino(p);
  ok(`riaprendo l'app le foto sono ancora tre (${magDopo ? Object.keys(magDopo).length : '—'})`,
    !!magDopo && Object.keys(magDopo).length === 3);
  const kbDopo = await pesoLocale(p);
  ok(`e localStorage non è tornato a gonfiarsi (${kbDopo} KB)`, kbDopo < 200);

  // --- Una spesa cancellata porta via la sua foto ---
  // Altrimenti il magazzino cresce per sempre con le foto di voci che non
  // esistono piu': lo stesso problema di prima, in un posto diverso. Si
  // cancella dall'app, non da localStorage: togliere una voce a mano fa
  // scattare — giustamente — la protezione contro le perdite, che la
  // rimetterebbe al suo posto.
  await menu('Lista della Spesa');
  await p.locator('main button', { hasText: /^Acquistato/ }).first().click();
  await p.waitForTimeout(400);
  await p.locator('main button[aria-label="Rimuovi"]').last().click();
  await p.waitForTimeout(1200);
  const magPotato = await magazzino(p);
  ok(`tolta una spesa, la sua foto esce dal magazzino (${magPotato ? Object.keys(magPotato).sort().join(',') : '—'})`,
    !!magPotato && Object.keys(magPotato).length === 2);

  // --- La diagnostica dice quanto pesano e dove stanno ---
  await menu('Impostazioni');
  await p.waitForTimeout(600);
  const diag = await p.locator('main').innerText();
  ok(`in modalità tecnica si legge quante foto e dove (${(diag.match(/\d+\s*foto di scontrini[^\n]*/i) || ['—'])[0].slice(0, 80)})`,
    /foto di scontrini/i.test(diag) && /nel magazzino/i.test(diag));

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await ctx.close();
  await browser.close();

  // --- 4. Senza magazzino: l'app non crolla, e lo dice ---
  // Safari in navigazione privata ha gia' fatto di peggio che mancare. Se qui
  // l'app si piantasse, il rimedio al problema di memoria sarebbe peggiore
  // del problema.
  const senzaIdb = await apri({
    initScript: [(s) => {
      // eslint-disable-next-line no-new-func
      new Function(s)();
      try { Object.defineProperty(window, 'indexedDB', { get() { return undefined; } }); } catch (e) { /* niente */ }
    }, '(' + semina.toString() + ')()'],
  });
  await senzaIdb.page.waitForTimeout(1500);
  await senzaIdb.menu('Lista della Spesa');
  await senzaIdb.page.locator('main button', { hasText: /^Acquistato/ }).first().click();
  await senzaIdb.page.waitForTimeout(500);
  const macchine2 = await senzaIdb.page.locator('main button[aria-label="Vedi scontrino"]').count();
  ok(`senza magazzino le foto restano dov'erano e si vedono lo stesso (${macchine2})`, macchine2 === 3);
  const vecchiaResta = await senzaIdb.page.evaluate(() => (localStorage.getItem('cambusa_receipts') || '').length);
  ok(`e restano in localStorage invece di sparire (${Math.round(vecchiaResta / 1024)} KB)`, vecchiaResta > 1024 * 1024);

  await senzaIdb.menu('Impostazioni');
  await senzaIdb.page.waitForTimeout(600);
  const diag2 = await senzaIdb.page.locator('main').innerText();
  ok('e la diagnostica lo dice invece di far finta di niente',
    /nella memoria del telefono/i.test(diag2));

  ok('nessun errore JavaScript senza magazzino' + (senzaIdb.errori.length ? ': ' + senzaIdb.errori.join(' | ') : ''),
    senzaIdb.errori.length === 0);
  await fine(senzaIdb.browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
