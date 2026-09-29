// Il tasto «+ Spesa» e il foglio «Registra una spesa» (bozze A1 e A2).
//
// Registrare una spesa era a quattro tocchi dalla scheda in cui ci si trova:
// menu, Lista della Spesa, Acquistato, «Aggiungi un prodotto a mano». E'
// la cosa che si fa piu' spesso al campo, alla cassa, con le borse in mano.
// Adesso c'e' un tasto su ogni scheda del campo, e il foglio chiede le cose
// nell'ordine del gesto vero: prima QUANTO, poi chi ha pagato — che parte gia'
// da qualcuno —, poi cosa e di che tipo. Il conto separato compare solo se ci
// sono giorni separati: altrimenti e' una domanda senza senso.
//
// E il Calendario mostra le spese del giorno, cosi' si vede subito che quella
// appena registrata c'e'.
const { apri, ok, fine, attendi } = require('../lib/app');

const CODICE = 'K7RX2MQP';
const GIORNI = ['2027-07-12', '2027-07-13', '2027-07-14'];

const scena = (o) => [(s) => {
  const o = JSON.parse(s);
  let vero;
  Object.defineProperty(window, 'APP_CONFIG', {
    configurable: true,
    get() { return vero; },
    set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { rooms: true, auth: true }) }); },
  });
  window.APP_CONFIG = {};
  localStorage.setItem('cambusa_stanza', o.codice);
  localStorage.setItem('cambusa_sync_optout', '1');
  localStorage.setItem('cambusa_campi', JSON.stringify([{ codice: o.codice, nome: 'Campo', inizio: o.giorni[0], fine: o.giorni[2], ruolo: 'proprietario' }]));
  const membri = [['m1', 'Giulia Ferri'], ['m2', 'Marco Bellini'], ['m3', 'Anna Riva']];
  localStorage.setItem('cambusa_members', JSON.stringify(membri.map(([id, name]) => ({ id, name, isChild: false }))));
  const meals = {};
  membri.forEach(([id]) => { meals[id] = { lunch: true, dinner: true }; });
  const campData = {};
  o.giorni.forEach((d) => { campData[d] = { note: '', guestsNames: '', meals }; });
  localStorage.setItem('cambusa_camp_data', JSON.stringify(campData));
  if (o.separati) localStorage.setItem('cambusa_sepdays', JSON.stringify([o.giorni[1]]));
  // Una spesa per giorno, a mezzogiorno, e una fuori dal campo.
  const mezzodi = (d) => new Date(d + 'T12:00:00').getTime();
  localStorage.setItem('cambusa_purchases', JSON.stringify(
    o.giorni.map((d, i) => ({ id: 'p' + i, name: 'Spesa-' + d, price: 10 + i, type: 'alimentare', buyer: 'Anna Riva', at: mezzodi(d) }))
      .concat([{ id: 'px', name: 'Spesa-fuori', price: 5, type: 'alimentare', buyer: 'Anna Riva', at: mezzodi('2027-06-01') }]),
  ));
  const utente = { uid: 'giulia', email: 'g@example.com', nome: 'Giulia Ferri', isAnonimo: false, emailVerificata: true };
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true, utente: () => utente,
    osserva: (cb) => { cb(utente); return () => {}; },
    conGoogle: async () => utente, esci: async () => {}, stanzeDelProfilo: async () => [o.codice],
  };
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (c) => c, leggi: async () => null, motivo: () => 'stanza.nonRiuscito',
    membri: async () => [{ uid: 'giulia', ruolo: 'proprietario', nome: 'Giulia Ferri' }],
    statoDi: async (codici) => codici.map((c) => ({ codice: c, membro: true, proprietario: true, nome: 'Campo', inizio: o.giorni[0], fine: o.giorni[2] })),
    impostaStanza: async () => {},
  };
}, JSON.stringify(Object.assign({ codice: CODICE, giorni: GIORNI }, o))];

(async () => {
  const a = await apri({ admin: false, initScript: scena({}) });
  const p = a.page;
  const tasto = p.locator('[data-tasto-spesa]');
  const foglio = p.locator('[data-foglio-spesa]');
  const scheda = async (voce) => {
    await p.click('button[aria-label="Menu"]');
    await p.waitForTimeout(250);
    await p.locator(`nav button[data-voce="${voce}"]`).first().click();
    await attendi(p, () => !!document.querySelector('main'));
  };

  // ---------- A1: il tasto c'e' su ogni scheda del campo ----------
  const dove = [];
  for (const v of ['calendario', 'presenze', 'membri', 'lista', 'spesa']) {
    await scheda(v);
    dove.push([v, await tasto.isVisible()]);
  }
  ok(`il tasto «+ Spesa» è su ogni scheda del campo (${dove.map(([v, s]) => v + (s ? '' : ' NO')).join(', ')})`, dove.every(([, s]) => s));
  // Nella home dei campi no: li' non c'e' un campo in cui registrarla.
  await scheda('campi');
  ok('nella home «I miei campi» il tasto non c\'è', !(await tasto.isVisible()));

  // ---------- Il Calendario: le spese del giorno ----------
  await scheda('calendario');
  const delGiorno = async () => p.evaluate(() => {
    const box = document.querySelector('[data-spese-del-giorno]');
    return box ? box.innerText.match(/Spesa-[\w-]+/g) || [] : [];
  });
  const primo = await delGiorno();
  ok(`il Calendario mostra la spesa del giorno scelto, e solo quella (${primo.join(', ')})`,
    primo.length === 1 && GIORNI.some((d) => primo[0] === 'Spesa-' + d));
  ok('e non quella di un giorno fuori dal campo', !primo.includes('Spesa-fuori'));
  const testoBox = await p.locator('[data-spese-del-giorno]').innerText();
  ok(`con chi ha pagato e la cifra scritta nella lingua dell'app (${testoBox.replace(/\s+/g, ' ')})`,
    /Anna Riva/.test(testoBox) && /1\d,00 €/.test(testoBox.replace(/[  ]/g, ' ')));

  // ---------- A2: il foglio ----------
  await tasto.click();
  await attendi(p, () => !!document.querySelector('[data-foglio-spesa]'));
  ok('toccando il tasto sale il foglio «Registra una spesa»', /registra una spesa/i.test(await foglio.innerText()));
  ok('e il tasto si toglie di mezzo finché il foglio è aperto', !(await tasto.isVisible()));
  // L'ordine del gesto alla cassa: quanto, chi, cosa, tipo.
  const ordine = await p.evaluate(() => {
    const f = document.querySelector('[data-foglio-spesa]');
    const pezzi = [
      ['quanto', f.querySelector('input[data-cifra]')],
      ['chi', f.querySelector('select')],
      ['cosa', f.querySelector('input[type=text]')],
      ['tipo', f.querySelector('[data-tipo]')],
    ];
    return pezzi.filter(([, el]) => el).sort(([, x], [, y]) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).map(([n]) => n);
  });
  ok(`i campi nell'ordine del gesto: quanto, chi, cosa, tipo (${ordine.join(', ')})`, ordine.join(',') === 'quanto,chi,cosa,tipo');
  ok('il cursore è già sulla cifra', await p.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-cifra')));
  // Chi ha pagato parte da chi ha il telefono in mano.
  const chi = await foglio.locator('select').first().inputValue();
  ok(`chi ha pagato è già «Giulia Ferri», il nome dell'account (${chi})`, chi === 'Giulia Ferri');
  ok('e lo dice anche il chip acceso', (await foglio.locator('[data-acquirente="Giulia Ferri"]').getAttribute('aria-pressed')) === 'true');
  ok('senza giorni separati il conto non si chiede', (await foglio.locator('[data-conto]').count()) === 0);

  // Si registra: cifra, un altro acquirente dal chip, cosa, un tipo dal chip.
  await foglio.locator('input[data-cifra]').fill('23.40');
  await foglio.locator('[data-acquirente="Marco Bellini"]').click();
  await foglio.locator('input[type=text]').fill('Gas');
  await foglio.locator('[data-tipo="logistica"]').click();
  await foglio.locator('button', { hasText: /^salva$/i }).click();
  await attendi(p, () => !document.querySelector('[data-foglio-spesa]'));
  const salvata = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases')).find((x) => x.name === 'Gas'));
  ok(`la spesa è salvata con cifra, chi e tipo scelti (${JSON.stringify(salvata && [salvata.price, salvata.buyer, salvata.type])})`,
    !!salvata && salvata.price === 23.4 && salvata.buyer === 'Marco Bellini' && salvata.type === 'logistica');
  ok('salvando il foglio si chiude e il tasto torna', await tasto.isVisible());
  ok('e si resta sulla scheda in cui si era', /Calendario/i.test(await p.locator('header').innerText()));

  // La volta dopo parte da chi ha pagato l'ultima volta: la spesa grossa la
  // fa spesso la stessa persona, piu' volte di fila.
  await tasto.click();
  await attendi(p, () => !!document.querySelector('[data-foglio-spesa]'));
  const ancora = await foglio.locator('select').first().inputValue();
  ok(`la volta dopo chi ha pagato parte dall'ultimo (${ancora})`, ancora === 'Marco Bellini');
  // Si chiude toccando fuori, senza salvare niente.
  const n = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases')).length);
  await p.mouse.click(10, 10);
  await attendi(p, () => !document.querySelector('[data-foglio-spesa]'));
  ok('toccando fuori il foglio si chiude senza salvare',
    (await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases')).length)) === n);
  ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await a.browser.close();

  // ---------- Con un giorno separato il conto si chiede ----------
  const b = await apri({ admin: false, initScript: scena({ separati: true }) });
  await b.page.locator('[data-tasto-spesa]').click();
  await attendi(b.page, () => !!document.querySelector('[data-foglio-spesa]'));
  const f = b.page.locator('[data-foglio-spesa]');
  ok('con un giorno separato il foglio chiede il conto', (await f.locator('[data-conto]').count()) === 2);
  ok('e parte dal conto comune', (await f.locator('[data-conto="comune"]').getAttribute('aria-pressed')) === 'true');
  await f.locator('[data-tipo="logistica"]').click();
  ok('ma non per la logistica, che è sempre comune', (await f.locator('[data-conto]').count()) === 0);
  await f.locator('[data-tipo="alimentare"]').click();
  await f.locator('input[data-cifra]').fill('30');
  await f.locator('input[type=text]').fill('Cena fuori');
  await f.locator('[data-conto="sep"]').click();
  await f.locator('button', { hasText: /^salva$/i }).click();
  await attendi(b.page, () => !document.querySelector('[data-foglio-spesa]'));
  const sep = await b.page.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases')).find((x) => x.name === 'Cena fuori'));
  ok(`la spesa va sul conto separato (${sep && sep.account})`, !!sep && sep.account === 'sep');
  ok('nessun errore JavaScript' + (b.errori.length ? ': ' + b.errori.join(' | ') : ''), b.errori.length === 0);
  await b.browser.close();
  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
