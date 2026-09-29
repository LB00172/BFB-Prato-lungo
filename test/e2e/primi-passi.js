// I primi passi di un campo nuovo (bozza B1), e il Pro in una riga sola.
//
// Chi crea un campo si trovava davanti un Calendario vuoto con in cima un
// riquadro arancione del Pro: la prima cosa che l'app diceva a un campo
// appena nato era di pagare. Adesso in cima ci sono le tre cose da fare —
// invitare, dire chi c'e', registrare una spesa —, ognuna si spunta da sola
// guardando i dati, e quando sono fatte tutte il riquadro se ne va. Il Pro
// del meteo resta, ma in una riga.
//
// E quando NON deve comparire: a chi entra col codice (il campo lo trova gia'
// avviato), e il passo dell'invito e' fatto anche senza aver condiviso niente
// da qui, se qualcuno nel campo c'e' gia' entrato.
const { apri, ok, fine, attendi } = require('../lib/app');

const CODICE = 'K7RX2MQP';
const GIORNI = ['2027-07-12', '2027-07-14'];

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
  localStorage.setItem('cambusa_campi', JSON.stringify([{ codice: o.codice, nome: 'Campo nuovo', inizio: o.giorni[0], fine: o.giorni[1], ruolo: o.ruolo }]));
  // Condividere: si ricorda cosa si e' mandato, invece di aprire WhatsApp.
  window.__mandati = JSON.parse(sessionStorage.getItem('__mandati') || '[]');
  navigator.share = async (d) => { window.__mandati.push(d.text); sessionStorage.setItem('__mandati', JSON.stringify(window.__mandati)); };
  const utente = { uid: 'giulia', email: 'g@example.com', nome: 'Giulia Ferri', isAnonimo: false, emailVerificata: true };
  Object.defineProperty(window, 'AuthCloud', { configurable: true, get() { return window.__ac; }, set() {} });
  window.__ac = {
    disponibile: () => true, utente: () => utente,
    osserva: (cb) => { cb(utente); return () => {}; },
    conGoogle: async () => utente, esci: async () => {}, stanzeDelProfilo: async () => [o.codice],
  };
  const dentro = [{ uid: 'giulia', ruolo: mio ? 'proprietario' : 'redattore', nome: 'Giulia Ferri' }]
    .concat(o.altri ? [{ uid: 'marco', ruolo: 'redattore', nome: 'Marco Bellini' }] : []);
  Object.defineProperty(window, 'StanzaCloud', { configurable: true, get() { return window.__sc; }, set() {} });
  window.__sc = {
    disponibile: () => true,
    entra: async (c) => c, leggi: async () => null, motivo: () => 'stanza.nonRiuscito',
    membri: async () => dentro,
    statoDi: async (codici) => codici.map((c) => ({ codice: c, membro: true, proprietario: mio, nome: 'Campo nuovo', inizio: o.giorni[0], fine: o.giorni[1] })),
    impostaStanza: async () => {},
  };
}, JSON.stringify(Object.assign({ codice: CODICE, giorni: GIORNI, ruolo: 'proprietario' }, o))];

const stato = (p) => p.evaluate(() => {
  const r = document.querySelector('[data-primi-passi]');
  if (!r) return null;
  const f = {};
  r.querySelectorAll('[data-passo]').forEach((li) => { f[li.getAttribute('data-passo')] = li.getAttribute('data-fatto') === '1'; });
  return f;
});

(async () => {
  // ---------- Il capogruppo di un campo appena creato ----------
  const a = await apri({ admin: false, initScript: scena({}) });
  const p = a.page;
  const menu = async (voce) => {
    await p.click('button[aria-label="Menu"]');
    await p.waitForTimeout(250);
    await p.locator(`nav button[data-voce="${voce}"]`).first().click();
    await attendi(p, () => !!document.querySelector('main'));
  };
  await attendi(p, () => !!document.querySelector('[data-primi-passi]'));
  const r = p.locator('[data-primi-passi]');
  ok(`in un campo nuovo il capogruppo trova i primi passi, nessuno fatto (${JSON.stringify(await stato(p))})`,
    JSON.stringify(await stato(p)) === '{"invito":false,"chi":false,"spesa":false}');
  ok('con il codice del campo da mandare', (await r.innerText()).replace(/\s/g, '').includes('K7RX-2MQP'));
  // Stanno sopra la settimana: sono la prima cosa da fare, non l'ultima.
  const sopra = await p.evaluate(() => {
    const passi = document.querySelector('[data-primi-passi]');
    const giorno = [...document.querySelectorAll('main button')].find((b) => /^(lun|mar|mer|gio|ven|sab|dom)/i.test(b.innerText.trim()));
    return !!giorno && !!(passi.compareDocumentPosition(giorno) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  ok('e stanno sopra la settimana', sopra);

  // Il Pro del meteo: una riga, non un riquadro.
  const pro = p.locator('[data-pro-bloccata="meteo"]');
  const h = Math.round((await pro.boundingBox()).height);
  ok(`il Pro del meteo sta in una riga sola (${h} px)`, h <= 56);
  ok('e porta a scoprirlo', /scopri il pro/i.test(await pro.innerText()));

  // 1. L'invito: Condividi manda il link del campo, e il passo si spunta.
  await r.locator('[data-passo="invito"] button').click();
  await attendi(p, () => window.__mandati.length > 0);
  const mandato = await p.evaluate(() => window.__mandati[0]);
  ok(`Condividi manda il link con il codice (${mandato.replace(/\s+/g, ' ').slice(0, 80)}…)`, /K7RX-?2MQP/.test(mandato) && /https?:\/\//.test(mandato));
  await attendi(p, () => document.querySelector('[data-passo="invito"]').getAttribute('data-fatto') === '1');
  ok('e il passo dell\'invito si spunta da solo', (await stato(p)).invito === true);
  ok('il contatore dice 1 di 3', /1 di 3/i.test(await r.innerText()));

  // 2. Chi c'e': due persone.
  await r.locator('[data-passo="chi"] button').click();
  await attendi(p, () => /membri/i.test(document.querySelector('header').innerText));
  for (const n of ['Giulia Ferri', 'Marco Bellini']) {
    await p.fill('input[placeholder="Nome e cognome"]', n);
    await p.locator('main button', { hasText: /^\+$/ }).first().click();
    await p.waitForTimeout(200);
  }
  await menu('calendario');
  ok('con due persone il passo «chi c\'è» è fatto', (await stato(p)).chi === true);

  // Ricaricando, l'invito resta spuntato: e' partito, non si rimanda.
  await p.reload({ waitUntil: 'load' });
  await attendi(p, () => !!document.querySelector('[data-primi-passi]'));
  ok(`ricaricando l'app i passi fatti restano fatti (${JSON.stringify(await stato(p))})`,
    JSON.stringify(await stato(p)) === '{"invito":true,"chi":true,"spesa":false}');

  // 3. La prima spesa, dal suo passo: apre il foglio.
  await p.locator('[data-passo="spesa"] button').click();
  await attendi(p, () => !!document.querySelector('[data-foglio-spesa]'));
  await p.locator('[data-foglio-spesa] input[data-cifra]').fill('12');
  await p.locator('[data-foglio-spesa] input[type=text]').fill('Pane');
  await p.locator('[data-foglio-spesa] button', { hasText: /^salva$/i }).click();
  await attendi(p, () => !document.querySelector('[data-foglio-spesa]'));
  ok('fatte tutte e tre, il riquadro se ne va', (await p.locator('[data-primi-passi]').count()) === 0);
  ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await a.browser.close();

  // ---------- Qualcuno e' gia' entrato: l'invito e' fatto ----------
  const b = await apri({ admin: false, initScript: scena({ altri: true }) });
  await attendi(b.page, () => !!document.querySelector('[data-passo="invito"][data-fatto="1"]'));
  ok('se nel campo è già entrato qualcuno, l\'invito è fatto anche senza averlo mandato da qui', true);
  ok('nessun errore JavaScript' + (b.errori.length ? ': ' + b.errori.join(' | ') : ''), b.errori.length === 0);
  await b.browser.close();

  // ---------- Chi entra col codice non li vede ----------
  const c = await apri({ admin: false, initScript: scena({ ruolo: 'redattore' }) });
  await attendi(c.page, () => !!document.querySelector('main'));
  await c.page.waitForTimeout(800);   // qui si verifica che una cosa NON compaia
  ok('chi è entrato col codice non vede i primi passi', (await c.page.locator('[data-primi-passi]').count()) === 0);
  ok('e nemmeno la riga del Pro, che non è sua', (await c.page.locator('[data-pro-bloccata="meteo"]').count()) === 0);
  await c.browser.close();
  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
