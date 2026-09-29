// «Il campo» e Impostazioni della persona (bozze C1 e C2).
//
// Il campo stava tutto dentro Impostazioni, fra la lingua e il tema scuro:
// per mandare l'invito si scendeva oltre il proprio account, e il capogruppo
// trovava luogo, voci, aiutante e Pro in un muro di riquadri aperti. Adesso il
// campo ha la sua scheda — l'invito in cima, le sue cose una riga per una, il
// Pro in fondo — e Impostazioni e' della persona: account, lingua, aspetto,
// pronto senza linea. Il blocco con password e i dati del telefono stanno in
// modalita' tecnica.
//
// E quando NON deve comparire: a chi non e' capogruppo le righe per cambiare
// il campo non ci sono, e in Impostazioni di un utente normale non c'e' piu'
// niente del campo, ne' il blocco ne' i dati da cancellare.
const { apri, ok, fine, attendi } = require('../lib/app');

const CODICE = 'K7RX2MQP';
const GIORNI = ['2027-07-12', '2027-07-16'];

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
  const mio = o.ruolo === 'proprietario';
  localStorage.setItem('cambusa_campi', JSON.stringify([{ codice: o.codice, nome: 'Campo estivo', inizio: o.giorni[0], fine: o.giorni[1], ruolo: o.ruolo }]));
  localStorage.setItem('cambusa_members', JSON.stringify([{ id: 'm1', name: 'Giulia Ferri', isChild: false }, { id: 'm2', name: 'Marco Bellini', isChild: false }]));
  window.__scritture = [];
  const utente = { uid: mio ? 'giulia' : 'marco', email: 'x@example.com', nome: mio ? 'Giulia Ferri' : 'Marco Bellini', isAnonimo: false, emailVerificata: true };
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
    membri: async () => [{ uid: 'giulia', ruolo: 'proprietario', nome: 'Giulia Ferri' }, { uid: 'marco', ruolo: 'redattore', nome: 'Marco Bellini' }],
    statoDi: async (codici) => codici.map((c) => ({ codice: c, membro: true, proprietario: mio, nome: 'Campo estivo', inizio: o.giorni[0], fine: o.giorni[1] })),
    impostaStanza: async (c, campi) => { window.__scritture.push(campi); },
  };
}, JSON.stringify(Object.assign({ codice: CODICE, giorni: GIORNI, ruolo: 'proprietario' }, o))];

const titoli = (p) => p.locator('main h3').allInnerTexts();
const righe = (p) => p.evaluate(() => [...document.querySelectorAll('[data-riga]')].map((r) => r.getAttribute('data-riga')));

(async () => {
  // ---------- Il capogruppo ----------
  const a = await apri({ admin: false, initScript: scena({}) });
  const p = a.page;
  await a.menu('Il campo');
  await attendi(p, () => !!document.querySelector('[data-scheda="campo"]'));
  ok('nel menu c\'è «Il campo», e apre la scheda del campo', true);
  // L'ordine: invito, le cose del campo, il Pro.
  const ordine = await p.evaluate(() => {
    const pos = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().top : -1; };
    return [pos('[data-riquadro="invito"]'), pos('[data-riga]'), pos('[data-riquadro="pro"]')];
  });
  ok(`l'invito in cima, poi le righe del campo, poi il Pro (${ordine.map(Math.round).join(' < ')})`,
    ordine.every((y) => y >= 0) && ordine[0] < ordine[1] && ordine[1] < ordine[2]);
  ok('l\'invito ha il codice e Condividi', /K7RX-2MQP/.test(await p.locator('[data-riquadro="invito"]').innerText())
    && /condividi/i.test(await p.locator('[data-riquadro="invito"]').innerText()));
  const r = await righe(p);
  ok(`le cose del campo sono righe: nome e date, luogo, voci, aiutante, regole (${r.join(', ')})`,
    r.join(',') === 'nome,luogo,voci,aiutante,regole');
  ok('e all\'inizio sono tutte chiuse', (await p.locator('[data-riquadro="voci"], [data-riquadro="aiutante"], [data-riquadro="nome-date"]').count()) === 0);
  await p.click('[data-riga="voci"]');
  await attendi(p, () => !!document.querySelector('[data-riquadro="voci"]'));
  await p.click('[data-riga="aiutante"]');
  await attendi(p, () => !!document.querySelector('[data-riquadro="aiutante"]'));
  ok('se ne apre una alla volta', (await p.locator('[data-riquadro="voci"]').count()) === 0);

  // Nome e date: si correggono, con le regole del modulo di creazione.
  await p.click('[data-riga="nome"]');
  await p.click('[data-cambia-nome]');
  await p.fill('[data-nome]', 'Campo di agosto');
  await p.fill('[data-inizio]', '2027-08-10');
  await p.fill('[data-fine]', '2027-08-01');
  await p.click('[data-salva-nome]');
  await p.waitForTimeout(300);   // qui si verifica che una scrittura NON parta
  ok('una fine prima dell\'inizio si dice, e non si scrive niente',
    /finisce prima di cominciare/i.test(await p.locator('main').innerText()) && (await p.evaluate(() => window.__scritture.length)) === 0);
  await p.fill('[data-fine]', '2027-08-15');
  await p.click('[data-salva-nome]');
  await attendi(p, () => window.__scritture.length > 0);
  const scritto = await p.evaluate(() => window.__scritture[0]);
  ok(`nome e date vanno nella stanza (${JSON.stringify(scritto)})`,
    JSON.stringify(scritto) === JSON.stringify({ nome: 'Campo di agosto', inizio: '2027-08-10', fine: '2027-08-15' }));
  await attendi(p, () => /agosto/i.test(document.querySelector('[data-nome-campo]').innerText));
  ok('e la scheda li mostra subito', /10 ago/i.test(await p.locator('[data-scheda="campo"]').innerText()));

  // Il Pro dal Calendario porta qui, non in Impostazioni.
  await a.menu('Calendario');
  await p.locator('[data-pro-bloccata="meteo"]').click();
  await attendi(p, () => !!document.querySelector('[data-scheda="campo"]'));
  ok('«Scopri il Pro» dal Calendario porta a «Il campo»', true);

  // Impostazioni: della persona.
  await a.menu('Impostazioni');
  await attendi(p, () => !!document.querySelector('main h3'));
  const t = await titoli(p);
  ok(`Impostazioni non ha più niente del campo (${t.join(' | ')})`,
    (await p.locator('main [data-riquadro="invito"], main [data-riquadro="pro"], main [data-riga]').count()) === 0
    && !/k7rx-2mqp/i.test(await p.locator('main').innerText()));
  ok('né il blocco con password, né i dati del telefono', !t.some((x) => /blocco con password|dati su questo telefono/i.test(x))
    && !/blocco con password|dati su questo telefono/i.test(await p.locator('main').innerText()));
  const pos = (re) => t.findIndex((x) => re.test(x));
  ok('lingua e aspetto vengono prima di «pronto senza linea»', pos(/lingua/i) >= 0 && pos(/lingua/i) < pos(/pronto/i) && pos(/aspetto/i) < pos(/pronto/i));
  ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await a.browser.close();

  // ---------- In modalita' tecnica il blocco e i dati tornano ----------
  const b = await apri({ initScript: scena({}) });
  await b.menu('Impostazioni');
  await attendi(b.page, () => !!document.querySelector('main h3'));
  const tb = await b.page.locator('main').innerText();
  ok('in modalità tecnica ci sono il blocco con password e i dati del telefono', /blocco con password/i.test(tb) && /dati su questo telefono/i.test(tb));
  await b.browser.close();

  // ---------- Un membro ----------
  const c = await apri({ admin: false, initScript: scena({ ruolo: 'redattore' }) });
  await c.menu('Il campo');
  await attendi(c.page, () => !!document.querySelector('[data-scheda="campo"]'));
  ok('anche un membro trova «Il campo», con l\'invito', (await c.page.locator('[data-riquadro="invito"]').count()) === 1);
  ok('e le informazioni, e il Pro', /campo estivo/i.test(await c.page.locator('[data-nome-campo]').innerText())
    && (await c.page.locator('[data-riquadro="pro"]').count()) === 1);
  ok('ma nessuna riga per cambiare il campo', (await righe(c.page)).length === 0);
  ok('e gli si dice chi le sceglie', /le sceglie il capogruppo|li sceglie il capogruppo/i.test(await c.page.locator('main').innerText()));
  ok('nessun errore JavaScript' + (c.errori.length ? ': ' + c.errori.join(' | ') : ''), c.errori.length === 0);
  await c.browser.close();
  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
