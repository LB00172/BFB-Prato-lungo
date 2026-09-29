// "Chi fa cosa": i compiti assegnati.
//
// Al campo 2026 queste righe stavano negli appunti del giorno, scritte a mano
// in un campo libero: «Arrosticini Eleonora», «Pecora/Ugo», «Carne da
// ritirare: Federica». Erano compiti concordati PRIMA di partire, e le spese
// che ne sono nate stanno gia' fra gli acquisti — ma le due cose non si
// toccavano, e nessuno sapeva quale compito fosse ancora scoperto.
//
// Le due regole che questa prova difende, e che sono la ragione d'essere
// della scheda:
//   1. un compito NON e' una spesa: assegnarlo non muove un euro;
//   2. il ponte verso la spesa esiste, ma e' facoltativo e viene dopo — il
//      prezzo alla cassa non si sa ancora quando ci si divide i compiti.
const { apri, ok, fine } = require('../lib/app');

const semina = () => {
  localStorage.setItem('cambusa_members', JSON.stringify([
    { id: 'a', name: 'Alice', isChild: false },
    { id: 'b', name: 'Bruno', isChild: false },
  ]));
  localStorage.setItem('cambusa_camp_data', JSON.stringify({
    '2026-08-11': { note: '', guestsNames: '', meals: { a: { lunch: true, dinner: false }, b: { lunch: true, dinner: false } } },
  }));
  localStorage.setItem('cambusa_purchases', JSON.stringify([
    { id: 'p1', name: 'Spesa di tutti', price: 40, type: 'alimentare', buyer: 'Alice', at: 1 },
  ]));
};

const compitiSalvati = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_compiti') || '[]'));
const totale = (p) => p.evaluate(() => (window.__totali ? window.__totali.overallTotal : null));

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: semina });

  // --- La voce c'è, ed è prima della Lista: e' l'ordine dei fatti ---
  await p.locator('button[aria-label="Menu"]').click();
  await p.waitForTimeout(300);
  const voci = await p.locator('nav button, aside button').allInnerTexts().catch(() => []);
  const testoMenu = await p.locator('body').innerText();
  ok(`nel menu c'è "Chi fa cosa" (${/Chi fa cosa/i.test(testoMenu) ? 'sì' : 'no'})`, /Chi fa cosa/i.test(testoMenu));
  const iCompiti = testoMenu.indexOf('CHI FA COSA');
  const iLista = testoMenu.indexOf('LISTA DELLA SPESA');
  ok(`e viene prima della Lista della Spesa (${iCompiti} < ${iLista})`,
    iCompiti >= 0 && iLista >= 0 && iCompiti < iLista);
  void voci;
  await p.keyboard.press('Escape').catch(() => {});

  await menu('Chi fa cosa');
  await p.waitForTimeout(400);

  const prima = await totale(p);
  ok(`si parte con 40,00 € di spese (${prima})`, Math.abs(prima - 40) < 0.001);

  // --- Assegnare ---
  await p.fill('main input[placeholder*="arrosticini" i]', 'Prendere gli arrosticini');
  await p.locator('main select').first().selectOption('Bruno');
  await p.locator('main button', { hasText: /^Assegna$/ }).first().click();
  await p.waitForTimeout(400);

  const dopo1 = await compitiSalvati(p);
  ok(`il compito è salvato (${JSON.stringify(dopo1.map((c) => c.testo + '→' + c.chi))})`,
    dopo1.length === 1 && dopo1[0].testo === 'Prendere gli arrosticini' && dopo1[0].chi === 'Bruno' && dopo1[0].fatto === false);

  // LA REGOLA NUMERO UNO: assegnare un compito non muove un euro.
  ok(`assegnare un compito non tocca i conti (${await totale(p)})`,
    Math.abs((await totale(p)) - 40) < 0.001);

  // --- Chi resta selezionato: si assegnano piu' cose alla stessa persona ---
  const chiRimasto = await p.locator('main select').first().inputValue();
  ok(`dopo l'assegnazione la persona resta scelta (${chiRimasto})`, chiRimasto === 'Bruno');
  await p.fill('main input[placeholder*="arrosticini" i]', 'Prenotare il rifugio');
  await p.locator('main button', { hasText: /^Assegna$/ }).first().click();
  await p.waitForTimeout(400);
  const dopo2 = await compitiSalvati(p);
  ok(`il secondo va alla stessa persona senza risceglierla (${dopo2.length} compiti, chi: ${dopo2.map((c) => c.chi).join('/')})`,
    dopo2.length === 2 && dopo2.every((c) => c.chi === 'Bruno'));

  // --- Segnare fatto ---
  const testoPrima = await p.locator('main').innerText();
  ok(`sono due da fare (${(testoPrima.match(/Da fare/) || []).length ? 'sezione presente' : 'manca'})`,
    /Da fare/i.test(testoPrima) && !/Fatti/i.test(testoPrima));

  await p.locator('main button[aria-label="Segna come fatto"]').first().click();
  await p.waitForTimeout(400);
  const dopoFatto = await compitiSalvati(p);
  ok(`uno risulta fatto (${dopoFatto.filter((c) => c.fatto).length} su ${dopoFatto.length})`,
    dopoFatto.filter((c) => c.fatto).length === 1);
  ok('e compare la sezione "Fatti"', /Fatti/i.test(await p.locator('main').innerText()));
  ok(`i conti restano quelli (${await totale(p)})`, Math.abs((await totale(p)) - 40) < 0.001);

  // --- Modificare il testo di un compito già scritto ---
  // Si tocca quello DA FARE (il rifugio) e si controlla che sia cambiato solo
  // lui: con un "some" qualsiasi la prova passerebbe anche modificando l'altro,
  // ed è esattamente lo sbaglio che ha fatto questa prova la prima volta.
  const daFareInput = p.locator('main li input').first();
  ok(`la prima riga da fare è quella che resta (${await daFareInput.inputValue()})`,
    /rifugio/i.test(await daFareInput.inputValue()));
  await daFareInput.fill('Prenotare il rifugio (2 notti)');
  await p.waitForTimeout(500);
  const modificati = await compitiSalvati(p);
  const rifugio = modificati.find((c) => /rifugio/i.test(c.testo));
  const arrosticini = modificati.find((c) => /arrosticini/i.test(c.testo));
  ok(`il testo si corregge strada facendo (${rifugio && rifugio.testo})`,
    !!rifugio && /\(2 notti\)/.test(rifugio.testo));
  ok(`e l'altro compito resta com'era (${arrosticini && arrosticini.testo})`,
    !!arrosticini && arrosticini.testo === 'Prendere gli arrosticini');

  // --- Il ponte verso la spesa ---
  await p.locator('main button', { hasText: /Registra la spesa/ }).first().click();
  await p.waitForTimeout(700);
  const intestazione = await p.locator('header').innerText();
  ok(`si finisce nella Lista della Spesa (${intestazione.replace(/\s+/g, ' ').slice(0, 60)})`,
    /Lista della Spesa/i.test(intestazione));
  const campi = await p.evaluate(() => {
    const nome = document.querySelector('main input[placeholder="Es. Pasta, Acqua, Piatti…"]');
    const prezzo = document.querySelector('main input[data-cifra]');
    const chi = [...document.querySelectorAll('main select')].map((s) => s.value);
    return { nome: nome && nome.value, prezzo: prezzo && prezzo.value, chi };
  });
  ok(`col nome del compito già scritto (${campi.nome})`, /arrosticini/i.test(campi.nome || ''));
  ok(`e chi l'ha fatto già scelto (${JSON.stringify(campi.chi)})`, (campi.chi || []).includes('Bruno'));
  ok(`ma il prezzo vuoto, perché alla cassa non si sapeva ("${campi.prezzo}")`, !campi.prezzo);

  // --- Il compito resta fatto anche se la spesa non la si registra ---
  await menu('Chi fa cosa');
  await p.waitForTimeout(400);
  const ancora = await compitiSalvati(p);
  ok(`tornando indietro il compito è ancora fatto (${ancora.filter((c) => c.fatto).length})`,
    ancora.filter((c) => c.fatto).length === 1);
  ok(`e la spesa non registrata non è entrata nei conti (${await totale(p)})`,
    Math.abs((await totale(p)) - 40) < 0.001);

  // --- Togliere ---
  await p.locator('main button[aria-label="Rimuovi"]').first().click();
  await p.waitForTimeout(400);
  const rimasti = await compitiSalvati(p);
  ok(`un compito si toglie (${rimasti.length} rimasti)`, rimasti.length === 1);

  // --- Sopravvive alla chiusura dell'app ---
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(900);
  await menu('Chi fa cosa');
  await p.waitForTimeout(400);
  const dopoRiavvio = await compitiSalvati(p);
  ok(`riaprendo l'app i compiti ci sono ancora (${dopoRiavvio.length})`, dopoRiavvio.length === 1);
  ok('e viaggiano con gli altri dati verso gli altri telefoni',
    await p.evaluate(() => {
      const SM = window.SyncMerge;
      if (!SM) return false;
      const f = SM.flatten({ compiti: [{ id: 'x', testo: 'prova' }] });
      return Object.keys(f).some((k) => k.endsWith('|x'));
    }));

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await browser.close();

  // --- Con la bandiera spenta la scheda non esiste ---
  // Sulla versione pubblica resta spenta finche' non ci sono le Room: senza
  // un gestore, "assegnare" un compito non vuol dire niente.
  const spenta = await apri({
    initScript: [(s) => {
      // firebase-config.js assegna window.APP_CONFIG per intero, e lo fa DOPO
      // di noi: impostarlo e basta non servirebbe a niente. Si intercetta
      // l'assegnazione e si spegne la bandiera su qualunque cosa arrivi.
      let vero;
      Object.defineProperty(window, 'APP_CONFIG', {
        configurable: true,
        get() { return vero; },
        set(v) {
          vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { compiti: false }) });
        },
      });
      window.APP_CONFIG = {};
      // eslint-disable-next-line no-new-func
      new Function(s)();
    }, '(' + semina.toString() + ')()'],
  });
  await spenta.page.waitForTimeout(900);
  await spenta.page.locator('button[aria-label="Menu"]').click();
  await spenta.page.waitForTimeout(400);
  const menuSpento = await spenta.page.locator('body').innerText();
  ok(`con la bandiera spenta la voce sparisce dal menu (${/Chi fa cosa/i.test(menuSpento) ? 'c\'è ancora' : 'sparita'})`,
    !/Chi fa cosa/i.test(menuSpento));
  ok('e la Lista della Spesa resta al suo posto', /LISTA DELLA SPESA/i.test(menuSpento));
  ok('nessun errore JavaScript con la bandiera spenta' + (spenta.errori.length ? ': ' + spenta.errori.join(' | ') : ''),
    spenta.errori.length === 0);

  await fine(spenta.browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
