// La stanza a schermo: si crea, ci si entra, e non sbarra la strada.
//
// Le regole del codice le prova `unita/stanza` senza browser; chi puo'
// entrare davvero lo prova `regole/stanze` contro l'emulatore. Qui si prova
// la terza cosa, quella che le altre due non vedono: che a schermo succeda
// quello che dicono, e **che l'app continui a funzionare senza stanza**.
//
// Firestore qui e' finto, e il finto registra COSA gli viene chiesto: e' il
// punto. Creando una stanza devono nascere tre cose (il documento, il
// segreto, la scheda del proprietario) e il segreto **non deve mai** essere
// il codice in chiaro — se un giorno qualcuno scrivesse li' il codice invece
// della sua impronta, le regole Firestore continuerebbero a funzionare e
// nessuna prova se ne accorgerebbe, ma chiunque legga il database entrerebbe
// in tutte le stanze.
const { apri, ok, fine } = require('../lib/app');

// La bandiera si accende intercettando APP_CONFIG, come in e2e/lingue e
// e2e/account: firebase-config.js lo riscrive per intero DOPO di noi.
const conStanze = (acceso, utente, esistente) => [(s) => {
  const o = JSON.parse(s);
  let vero;
  Object.defineProperty(window, 'APP_CONFIG', {
    configurable: true,
    get() { return vero; },
    set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { rooms: o.acceso, auth: o.acceso }) }); },
  });
  window.APP_CONFIG = {};

  // L'account: serve un utente registrato per creare una stanza, ed e' la
  // regola vera (auth.js) a dirlo — qui si fornisce solo la sessione.
  window.__auth = { utente: o.utente };
  Object.defineProperty(window, 'AuthCloud', {
    configurable: true,
    get() { return window.__ac; },
    set() { /* il modulo vero si assegna e viene ignorato */ },
  });
  window.__ac = {
    disponibile: () => true,
    utente: () => window.__auth.utente,
    osserva: (cb) => { cb(window.__auth.utente); return () => {}; },
    registra: async () => window.__auth.utente,
    entra: async () => window.__auth.utente,
    conGoogle: async () => window.__auth.utente,
    esci: async () => {},
    reimposta: async () => {},
    inviaVerifica: async () => {},
    ricarica: async () => window.__auth.utente,
  };

  // Il Firestore finto. Tiene tutto quello che gli viene scritto, cosi' la
  // prova puo' guardare il DATABASE e non solo lo schermo.
  // Le stanze che esistono gia' si dichiarano QUI e non con page.evaluate()
  // dopo: lo script di avvio rigira a ogni navigazione, quindi sopravvive al
  // reload. Seminarle dopo lasciava un buco — l'ingresso automatico di un
  // sabotaggio falliva perche' la stanza non c'era ancora, non perche'
  // qualcuno gliel'avesse impedito, e la prova restava verde. Se ne e'
  // accorto un sabotaggio che NON produceva rosso.
  window.__db = { scritture: [], docs: {}, note: o.esistente ? [o.esistente] : [], negaEntrata: false };
  Object.defineProperty(window, 'StanzaCloud', {
    configurable: true,
    get() { return window.__sc; },
    set() { /* comanda il finto */ },
  });
  window.__sc = {
    disponibile: () => true,
    // L'impronta la calcola la funzione VERA dell'app (improntaPassword, la
    // stessa del blocco): se la si fingesse, questa prova non potrebbe piu'
    // dire niente su cosa finisce dentro il database.
    impronta: async (codice) => {
      const n = window.Stanza.normalizza(codice);
      const salt = Array.from(n).map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
      return window.improntaPassword(n, { salt, iter: 200000 });
    },
    // L'impronta e' asincrona, quindi le stanze dichiarate si materializzano
    // alla prima occasione invece che dentro lo script di avvio.
    assicuraNote: async () => {
      for (const c of window.__db.note) {
        if (!window.__db.docs[c]) {
          window.__db.docs[c] = { nome: 'Campo di Anna', impronta: await window.__sc.impronta(c) };
        }
      }
    },
    crea: async (dati, utente) => {
      const cod = window.Stanza.normalizza(dati.codice);
      const imp = await window.__sc.impronta(cod);
      window.__db.scritture.push({ dove: `rooms/${cod}`, dati: { nome: dati.nome, proprietario: utente.uid } });
      window.__db.scritture.push({ dove: `rooms/${cod}/private/join`, dati: { impronta: imp } });
      window.__db.scritture.push({ dove: `rooms/${cod}/members/${utente.uid}`, dati: window.Stanza.schedaProprietario('Anna') });
      window.__db.docs[cod] = { nome: dati.nome, impronta: imp };
      return cod;
    },
    entra: async (codice, utente) => {
      await window.__sc.assicuraNote();
      const cod = window.Stanza.normalizza(codice);
      const imp = await window.__sc.impronta(cod);
      // Come Firestore: se l'impronta non combacia con quella custodita, la
      // scrittura torna indietro con permission-denied.
      if (window.__db.negaEntrata || !window.__db.docs[cod] || window.__db.docs[cod].impronta !== imp) {
        const e = new Error('x'); e.code = 'permission-denied'; throw e;
      }
      // La scheda la costruisce la REGOLA vera (Stanza.schedaIngresso), non
      // il finto: se fosse il finto a scrivere 'redattore', questa prova
      // verificherebbe se stessa e il ruolo potrebbe cambiare senza che
      // nessuno se ne accorga.
      window.__db.scritture.push({ dove: `rooms/${cod}/members/${utente.uid}`, dati: window.Stanza.schedaIngresso('Anna', imp) });
      return cod;
    },
    leggi: async (codice) => window.__db.docs[window.Stanza.normalizza(codice)] || null,
    membri: async () => [{ uid: 'u1', ruolo: 'proprietario', nome: 'Anna' }],
    motivo: (e) => {
      const c = String((e && (e.code || e.message)) || '');
      if (/permission-denied/.test(c)) return 'stanza.codiceSbagliato';
      return 'stanza.nonRiuscito';
    },
  };
}, JSON.stringify({ acceso, utente, esistente })];

const REGISTRATO = { uid: 'anna-1', email: 'anna@example.com', nome: 'Anna Bianchi', isAnonimo: false, emailVerificata: true };
const OSPITE = null;

// I bottoni sono in maiuscolo per CSS: innerText restituisce "CREA UNA
// STANZA", quindi si guarda sempre senza distinguere maiuscole e minuscole
// (CLAUDE.md, la trappola in cui il progetto e' gia' cascato quattro volte).
const impostazioni = async (a) => {
  await a.menu('Impostazioni');
  await a.page.waitForTimeout(400);
  return a.page.locator('main').innerText();
};

(async () => {
  // ---------- 1. Bandiera spenta: non esiste, e l'app va ----------
  {
    const a = await apri({ initScript: conStanze(false, REGISTRATO) });
    const imp = await impostazioni(a);
    ok(`con FEATURES.rooms spenta la tessera non c'è (${/entra con un codice/i.test(imp) ? "c'è ancora" : 'assente'})`,
      !/entra con un codice/i.test(imp));
    ok('nessun errore JavaScript con la bandiera spenta' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''),
      a.errori.length === 0);
    await a.browser.close();
  }

  // ---------- 2. Accesa: c'è, ma non sbarra la strada ----------
  let a = null;
  try {
    a = await apri({ initScript: conStanze(true, REGISTRATO) });
  } catch (e) {
    a = null;
  }
  ok('con le stanze accese l\'app si apre lo stesso: nessun muro davanti'
    + (a ? '' : ' — L\'APP NON SI È APERTA: qualcuno ha messo la stanza davanti'), !!a);
  if (!a) { fine(); }

  const primo = await a.page.locator('main').innerText();
  ok(`l'app si apre sul campo, non su una stanza (${primo.slice(0, 22).replace(/\n/g, ' ')}…)`,
    !/entra con un codice/i.test(primo));

  // Senza stanza si usa il campo che c'è già: è la stessa nota di prodotto
  // dell'account, e vale qui esattamente come lì.
  await a.menu('Membri');
  await a.page.waitForTimeout(300);
  await a.page.locator('main input[placeholder]').first().fill('Senza Stanza');
  await a.page.locator('main button', { hasText: /^\+$/ }).first().click();
  await a.page.waitForTimeout(400);
  ok('senza stanza si aggiunge un membro lo stesso',
    /Senza Stanza/.test(await a.page.locator('main').innerText()));

  const imp = await impostazioni(a);
  ok('con la bandiera accesa la tessera c\'è', /entra con un codice/i.test(imp));

  // ---------- 3. Il modulo parla prima di disturbare la rete ----------
  await a.page.locator('main button', { hasText: /Crea una stanza/i }).click();
  await a.page.waitForTimeout(300);
  await a.page.locator('main button', { hasText: /^Crea$/i }).click();
  await a.page.waitForTimeout(300);
  const senzaNome = await a.page.locator('main').innerText();
  ok(`senza nome lo dice, in italiano (${/bisogno di un nome/.test(senzaNome) ? 'detto' : 'NON detto'})`,
    /bisogno di un nome/.test(senzaNome));
  const scritte0 = await a.page.evaluate(() => window.__db.scritture.length);
  ok(`e il database non viene nemmeno toccato (${scritte0} scritture)`, scritte0 === 0);

  // ---------- 4. Creare: nascono tre cose, e il segreto è un'impronta ------
  await a.page.locator('main input[placeholder="Nome del campo"]').fill('Campo di Prova');
  await a.page.locator('main input[type="date"]').first().fill('2027-08-11');
  await a.page.locator('main input[type="date"]').nth(1).fill('2027-08-16');
  await a.page.locator('main button', { hasText: /^Crea$/i }).click();
  await a.page.waitForTimeout(600);

  const esito = await a.page.evaluate(() => ({
    scritture: window.__db.scritture,
    codici: Object.keys(window.__db.docs),
  }));
  ok(`creando una stanza nascono tre documenti (${esito.scritture.length})`, esito.scritture.length === 3);
  const codice = esito.codici[0] || '';
  ok(`il codice ha la forma giusta (${codice})`, /^[23456789BCDFGHJKMNPQRSTVWXYZ]{8}$/.test(codice));

  const segreto = esito.scritture.find((s) => /\/private\/join$/.test(s.dove));
  ok('il segreto finisce in private/join', !!segreto);
  // LA verifica di questa prova. Se qui finisse il codice in chiaro, le
  // regole Firestore continuerebbero a funzionare benissimo e chiunque
  // leggesse il database entrerebbe in tutte le stanze.
  ok(`in private/join c'è un'impronta, NON il codice (${String(segreto && segreto.dati.impronta).slice(0, 12)}…)`,
    !!segreto && typeof segreto.dati.impronta === 'string'
    && segreto.dati.impronta.length === 64
    && segreto.dati.impronta.indexOf(codice) < 0);
  const scheda = esito.scritture.find((s) => /\/members\//.test(s.dove));
  ok('e chi la crea ne è il proprietario', !!scheda && scheda.dati.ruolo === 'proprietario');

  const dopo = await a.page.locator('main').innerText();
  ok(`il codice si vede a schermo, leggibile (${(dopo.match(/[23456789BCDFGHJKMNPQRSTVWXYZ]{4}-[23456789BCDFGHJKMNPQRSTVWXYZ]{4}/) || [''])[0]})`,
    new RegExp(codice.slice(0, 4) + '-' + codice.slice(4)).test(dopo));

  ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await a.browser.close();

  // ---------- 5. Entrare: il codice giusto apre, quello sbagliato no ------
  {
    const b = await apri({ initScript: conStanze(true, REGISTRATO, 'K7RX2MQP') });
    await impostazioni(b);
    await b.page.locator('main button', { hasText: /Entra con un codice/i }).click();
    await b.page.waitForTimeout(300);

    // Un codice della forma sbagliata si dice subito, senza chiedere niente
    // alla rete: è un refuso, non un guasto.
    await b.page.locator('main input[placeholder="Codice"]').fill('OOOO-OOOO');
    await b.page.locator('main button', { hasText: /^Entra$/i }).click();
    await b.page.waitForTimeout(300);
    ok('un codice della forma sbagliata lo dice senza toccare la rete',
      /forma giusta/.test(await b.page.locator('main').innerText())
      && (await b.page.evaluate(() => window.__db.scritture.length)) === 0);

    // Un codice della forma giusta ma inesistente: lì risponde Firestore, e
    // "permission-denied" deve diventare una frase che si capisce.
    await b.page.locator('main input[placeholder="Codice"]').fill('2345-6789');
    await b.page.locator('main button', { hasText: /^Entra$/i }).click();
    await b.page.waitForTimeout(500);
    const sbagliato = await b.page.locator('main').innerText();
    ok(`un codice che non apre niente diventa una frase (${/non apre nessuna stanza/.test(sbagliato) ? 'tradotto' : 'NON tradotto'})`,
      /non apre nessuna stanza/.test(sbagliato) && !/permission-denied/.test(sbagliato));

    // Scritto a modo suo: minuscolo, senza trattino, con uno spazio. È lo
    // stesso codice, e deve entrare.
    await b.page.locator('main input[placeholder="Codice"]').fill('k7rx 2mqp');
    await b.page.locator('main button', { hasText: /^Entra$/i }).click();
    await b.page.waitForTimeout(600);
    const dentro = await b.page.locator('main').innerText();
    ok(`scritto a modo suo si entra lo stesso (${/sei dentro/i.test(dentro) ? 'dentro' : 'FUORI'})`,
      /sei dentro/i.test(dentro));
    const entrata = await b.page.evaluate(() => window.__db.scritture.filter((s) => /members/.test(s.dove)));
    ok('e ci si scrive da redattori, non da proprietari',
      entrata.length === 1 && entrata[0].dati.ruolo === 'redattore');

    ok('nessun errore JavaScript entrando' + (b.errori.length ? ': ' + b.errori.join(' | ') : ''),
      b.errori.length === 0);
    await b.browser.close();
  }

  // ---------- 6. Senza account non si crea una stanza ----------
  // È la stessa riga della tabella di auth.js e delle regole Firestore. Qui
  // si dice PRIMA, perché un permission-denied non spiega niente a nessuno.
  {
    const c = await apri({ initScript: conStanze(true, OSPITE) });
    await impostazioni(c);
    await c.page.locator('main button', { hasText: /Crea una stanza/i }).click();
    await c.page.waitForTimeout(300);
    await c.page.locator('main input[placeholder="Nome del campo"]').fill('Campo');
    await c.page.locator('main input[type="date"]').first().fill('2027-08-11');
    await c.page.locator('main input[type="date"]').nth(1).fill('2027-08-16');
    await c.page.locator('main button', { hasText: /^Crea$/i }).click();
    await c.page.waitForTimeout(400);
    const ospite = await c.page.locator('main').innerText();
    ok(`da ospite si viene mandati a farsi un account (${/indirizzo verificato/.test(ospite) ? 'detto' : 'NON detto'})`,
      /indirizzo verificato/.test(ospite));
    ok('e nel database non finisce niente',
      (await c.page.evaluate(() => window.__db.scritture.length)) === 0);
    await c.browser.close();
  }

  // ---------- 7. L'invito arrivato da un link ----------
  // È il passo che decide se un gruppo poco tecnologico adotta l'app: far
  // digitare otto caratteri a venti persone su WhatsApp non funziona.
  {
    const d = await apri({ initScript: conStanze(true, REGISTRATO, 'K7RX2MQP') });
    // Si arriva sul link, come chi tocca il messaggio su WhatsApp. La stanza
    // esiste già PRIMA che la pagina si apra: è la condizione in cui un
    // ingresso automatico riuscirebbe davvero, e quindi l'unica in cui la
    // verifica qui sotto significa qualcosa.
    await d.page.evaluate(() => { window.location.hash = 'stanza=K7RX-2MQP'; });
    await d.page.reload();
    await d.page.waitForTimeout(900);

    const conInvito = await impostazioni(d);
    ok(`l'invito si vede, col suo codice (${/K7RX-2MQP/.test(conInvito) ? 'visto' : 'NON visto'})`,
      /invito per la stanza/i.test(conInvito) && /K7RX-2MQP/.test(conInvito));

    // NON si entra da soli. Chi tocca un link non ha per forza deciso di
    // cambiare campo, e un'app che ti sposta di nascosto si disinstalla.
    ok('ma non si è entrati da soli',
      (await d.page.evaluate(() => window.__db.scritture.length)) === 0);

    // Il codice sparisce dalla barra: resterebbe nella cronologia del
    // telefono, e da lì lo rilegge chiunque lo prenda in mano.
    const barra = await d.page.evaluate(() => window.location.href);
    ok(`e il codice non resta nella barra (${barra.slice(-24)})`, barra.indexOf('K7RX') < 0);

    await d.page.locator('main button', { hasText: /^Entra$/i }).click();
    await d.page.waitForTimeout(700);
    const entrato = await d.page.locator('main').innerText();
    ok(`toccando "Entra" si entra (${/sei dentro/i.test(entrato) ? 'dentro' : 'FUORI'})`, /sei dentro/i.test(entrato));

    ok('nessun errore JavaScript con l\'invito' + (d.errori.length ? ': ' + d.errori.join(' | ') : ''),
      d.errori.length === 0);
    await d.browser.close();
  }

  // ---------- 8. Un link storpiato non apre una stanza a caso ----------
  {
    const e = await apri({ initScript: conStanze(true, REGISTRATO) });
    await e.page.evaluate(() => { window.location.hash = 'stanza=OOOO-OOOO'; });
    await e.page.reload();
    await e.page.waitForTimeout(900);
    const imp = await impostazioni(e);
    ok('un link con un codice storto non mostra nessun invito',
      !/invito per la stanza/i.test(imp));
    ok('e non fa entrare da nessuna parte',
      (await e.page.evaluate(() => window.__db.scritture.length)) === 0);
    await e.browser.close();
  }

  fine();
})();
