// L'account sviluppatore, a schermo (5 ottobre).
//
// Per collaudare l'app in tutte le sue funzioni prima che esista un dato
// vero: chi ha un documento sviluppatori/<uid> (lo crea Lorenzo a mano dalla
// console) e' capogruppo e Pro in ogni campo. Qui lo stesso campo — gratuito,
// in cui si e' solo redattori — si apre due volte: da sviluppatore e da
// persona normale. La seconda meta' e' quella che conta di piu': quando NON
// deve succedere niente, non succede niente.
//
// Le regole Firestore che lo sostengono si provano in test/regole/stanze.js
// (§ 8): questa prova sostituisce StanzaCloud con un finto, quindi guarda
// solo l'interfaccia — e la risposta del finto e' la domanda vera dell'app,
// StanzaCloud.sviluppatore.
const { apri, ok, fine, attendi } = require('../lib/app');

const CODICE = 'K7RX2MQP';

const scena = (sviluppatore) => [(s) => {
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
  localStorage.setItem('cambusa_campi', JSON.stringify([{ codice: o.codice, nome: 'Campo', inizio: '2027-07-12', fine: '2027-07-13', ruolo: 'redattore' }]));
  if (!sessionStorage.getItem('__seminato')) {
    sessionStorage.setItem('__seminato', '1');
    localStorage.setItem('cambusa_members', JSON.stringify([
      { id: 'm1', name: 'Giulia Ferri', isChild: false, uid: 'giulia' },
      { id: 'm2', name: 'Marco Bellini', isChild: false, uid: 'marco' },
    ]));
  }
  const utente = { uid: 'marco', email: 'marco@example.com', nome: 'Marco Bellini', isAnonimo: false, emailVerificata: true };
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
    statoDi: async (codici) => codici.map((c) => ({ codice: c, membro: true, proprietario: false, nome: 'Campo', inizio: '2027-07-12', fine: '2027-07-13' })),
    impostaStanza: async () => {},
    sviluppatore: async (u) => o.sviluppatore && u && u.uid === 'marco',
  };
}, JSON.stringify({ codice: CODICE, sviluppatore })];

const giro = async (sviluppatore) => {
  const a = await apri({ admin: false, initScript: scena(sviluppatore) });
  const p = a.page;
  const chi = sviluppatore ? 'lo sviluppatore' : 'un redattore normale';
  if (sviluppatore) await attendi(p, () => localStorage.getItem('cambusa_sviluppatore') === 'marco');
  else await p.waitForTimeout(500);   // qui si verifica che NON diventi sviluppatore

  await a.menu('Impostazioni');
  const segnale = await p.locator('[data-sviluppatore]').count();
  ok(`${chi}: il segnale in Impostazioni ${sviluppatore ? 'c\'è' : 'non c\'è'}`, segnale === (sviluppatore ? 1 : 0));

  await a.menu('Chi fa cosa');
  // Aperta o chiusa, la scheda parla di compiti: si aspetta quello.
  await attendi(p, () => /compit/i.test(document.querySelector('main').innerText));
  const bloccata = await p.locator('main [data-pro-bloccata="compiti"]').count();
  ok(`${chi}: «Chi fa cosa» in un campo gratuito ${sviluppatore ? 'è aperta' : 'chiede il Pro'}`, bloccata === (sviluppatore ? 0 : 1));

  await a.menu('Membri');
  await attendi(p, () => document.querySelectorAll('[data-membro]').length === 2);
  await p.locator('[data-membro="Giulia Ferri"] button[aria-label*="Giulia Ferri"]').first().click();
  await attendi(p, () => !!document.querySelector('[data-scheda-membro="Giulia Ferri"]'));
  const caselle = await p.locator('[data-scheda-membro="Giulia Ferri"] input[data-dato]').count();
  ok(`${chi}: la scheda della capogruppo ${sviluppatore ? 'la compila, da capogruppo' : 'la legge e basta'} (${caselle} caselle)`, sviluppatore ? caselle === 7 : caselle === 0);

  ok(`${chi}: nessun errore JavaScript` + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await a.browser.close();
};

(async () => {
  await giro(true);
  await giro(false);
  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
