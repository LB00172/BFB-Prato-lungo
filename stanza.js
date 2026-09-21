// La stanza: come si chiama, chi ci entra, e con che codice.
//
// Primo mattone del § 2 (ROADMAP.md). Sta fuori da src/ per lo stesso motivo
// di conti.js e auth.js: sono REGOLE, e una regola si prova con i numeri e le
// stringhe vere invece che leggendo caselle a schermo dentro un browser.
//
// Tutto qui dentro e' PURO e SINCRONO. In particolare **non c'e'
// crittografia**: l'impronta del codice la calcola chi chiama, con
// improntaPassword() che esiste gia' in src/20-blocco-password.jsx ed e' la
// stessa usata dal blocco dell'app. Mettere PBKDF2 qui dentro vorrebbe dire
// due implementazioni della stessa cosa, e il giorno che una delle due cambia
// i vecchi codici non entrano piu'.
//
// La decisione da non rimettere in discussione (ROADMAP § 2, 21 settembre):
// la password d'ingresso la verificano le REGOLE Firestore, non una Cloud
// Function. L'impronta sta in un documento che nessun client puo' leggere, e
// la regola la confronta con una get(). Niente backend, niente piano Blaze.
(function (root) {
  'use strict';

  // ---------- Il codice della stanza ----------
  // Un codice si detta al telefono, si scrive su un foglio appeso in cucina e
  // si digita con le dita sporche. Quindi:
  //   - niente lettere che si confondono: I, L, O, U (con la V a mano), e
  //     niente 0 e 1, che sono le stesse lettere viste da un'altra angolazione;
  //   - niente vocali, cosi' non escono parole per caso — "CULO-2MQP" appeso
  //     in cucina e' esattamente il genere di cosa che poi va rifatta;
  //   - due gruppi di quattro separati da un trattino, che e' la forma che la
  //     gente ricopia senza sbagliare (come i codici dei biglietti).
  const ALFABETO = '23456789BCDFGHJKMNPQRSTVWXYZ';
  const GRUPPI = 2;
  const PER_GRUPPO = 4;

  // Le combinazioni possibili: 28^8, cioe' circa 378 miliardi. E' il numero
  // che rende accettabile la decisione di non avere un backend che conti i
  // tentativi: indovinare a caso non e' una strada, e ogni tentativo costa
  // comunque una lettura di Firestore a chi lo fa.
  const COMBINAZIONI = Math.pow(ALFABETO.length, GRUPPI * PER_GRUPPO);

  // Il generatore si passa da fuori: cosi' la prova puo' dargliene uno finto e
  // controllare COSA esce, invece di limitarsi a guardare che la forma torni.
  // Di serie si usa crypto.getRandomValues — Math.random() non va: un codice
  // prevedibile e' un codice indovinabile, e qui il codice E' la serratura.
  function caso() {
    const c = root.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto);
    if (c && c.getRandomValues) {
      const a = new Uint32Array(1);
      c.getRandomValues(a);
      return a[0] / 4294967296;
    }
    // Senza crypto non si inventa un ripiego: un codice fatto con
    // Math.random() sembrerebbe casuale e non lo sarebbe, ed e' peggio di un
    // errore perche' nessuno se ne accorge.
    return null;
  }

  function generaCodice(rnd) {
    const r = typeof rnd === 'function' ? rnd : caso;
    const pezzi = [];
    for (let g = 0; g < GRUPPI; g++) {
      let s = '';
      for (let i = 0; i < PER_GRUPPO; i++) {
        const v = r();
        if (typeof v !== 'number' || !isFinite(v) || v < 0 || v >= 1) return null;
        s += ALFABETO[Math.floor(v * ALFABETO.length)];
      }
      pezzi.push(s);
    }
    return pezzi.join('-');
  }

  // ---------- Come si legge un codice digitato ----------
  // Chi lo digita scrive minuscolo, dimentica il trattino, mette uno spazio,
  // e scambia O con 0 perche' sul foglio si somigliano. Nessuna di queste e'
  // una password sbagliata: e' la stessa password scritta da un essere umano.
  // Si normalizza PRIMA di calcolare l'impronta, altrimenti due telefoni con
  // lo stesso codice producono due impronte diverse.
  //
  // Di sostituzioni sensate ce n'e' UNA sola, ed e' bene saperlo: U -> V,
  // perche' la V scritta a mano si legge U e la V nell'alfabeto c'e'. Tutte
  // le altre confusioni classiche (0/O, 1/I/L) portano a caratteri che
  // nell'alfabeto non esistono ne' da una parte ne' dall'altra: chi le ha
  // scritte ha ricopiato male, e questo si dice — non si indovina.
  //
  // A proteggere le lettere dell'alfabeto non e' questa tabella ma la
  // PRECEDENZA in normalizza(): la tabella si consulta solo per i caratteri
  // che nell'alfabeto non ci sono. Aggiungere qui Q -> 0 non romperebbe
  // niente (l'ho verificato sabotandola), ma girare quella precedenza si',
  // e corromperebbe ogni codice con la Q dentro.
  const CONFUSE = { U: 'V' };

  function normalizza(codice) {
    const grezzo = String(codice === null || codice === undefined ? '' : codice)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    // Le confusioni si risolvono verso il carattere che NELL'ALFABETO esiste.
    // O e 0 non sono nell'alfabeto ne' l'uno ne' l'altro: chi scrive O voleva
    // dire qualcosa che non c'e', e va detto, non indovinato. Si tengono pero'
    // le sostituzioni che portano a un carattere valido: U -> V.
    let fuori = '';
    for (let i = 0; i < grezzo.length; i++) {
      const c = grezzo[i];
      const sostituto = ALFABETO.indexOf(c) >= 0 ? c : (CONFUSE[c] || c);
      fuori += sostituto;
    }
    return fuori;
  }

  // Un codice e' valido se, normalizzato, e' fatto di caratteri
  // dell'alfabeto e ha la lunghezza giusta. Il trattino non conta: e'
  // decorazione per gli occhi, non parte del segreto.
  function codiceValido(codice) {
    const n = normalizza(codice);
    if (n.length !== GRUPPI * PER_GRUPPO) return false;
    for (let i = 0; i < n.length; i++) if (ALFABETO.indexOf(n[i]) < 0) return false;
    return true;
  }

  // Il codice come si mostra: a gruppi, col trattino. Si rimette in forma
  // anche quello digitato di fretta, cosi' chi lo rilegge vede la stessa cosa
  // che c'era sul foglio.
  function bello(codice) {
    const n = normalizza(codice);
    const pezzi = [];
    for (let i = 0; i < n.length; i += PER_GRUPPO) pezzi.push(n.slice(i, i + PER_GRUPPO));
    return pezzi.join('-');
  }

  // ---------- Il modulo di creazione (§ 9) ----------
  // Restituisce CHIAVI del dizionario, non frasi: questo file non sa in che
  // lingua verra' letto (CLAUDE.md, la trappola di conti.js). Si restituiscono
  // tutti i problemi, e chi disegna decide se mostrarli tutti o solo il primo.
  function validaModulo(dati) {
    const d = dati || {};
    const problemi = [];
    const testo = (v) => String(v === null || v === undefined ? '' : v).trim();

    if (!testo(d.nome)) problemi.push('stanza.serveNome');
    else if (testo(d.nome).length > 60) problemi.push('stanza.nomeLungo');

    const inizio = testo(d.inizio);
    const fine = testo(d.fine);
    if (!inizio) problemi.push('stanza.serveInizio');
    if (!fine) problemi.push('stanza.serveFine');
    // Le date arrivano come 'AAAA-MM-GG' dal campo <input type="date">: in
    // quella forma il confronto fra stringhe E' il confronto fra date, e non
    // c'e' nessun new Date() che possa trasformare un campo vuoto nel 1970
    // (CLAUDE.md). Si controlla pero' che la forma sia quella.
    const forma = /^\d{4}-\d{2}-\d{2}$/;
    if (inizio && !forma.test(inizio)) problemi.push('stanza.inizioNonValido');
    if (fine && !forma.test(fine)) problemi.push('stanza.fineNonValida');
    if (inizio && fine && forma.test(inizio) && forma.test(fine) && fine < inizio) {
      problemi.push('stanza.finePrimaDiInizio');
    }

    // Il luogo e' facoltativo: senza, il meteo non c'e' e basta. Ma se c'e',
    // dev'essere un punto sulla Terra — una virgola al posto del punto
    // decimale produce NaN, e un meteo su NaN non dice "non lo so": non arriva
    // e basta, e nessuno capisce perche'.
    if (d.luogo) {
      const la = Number(d.luogo.lat);
      const lo = Number(d.luogo.lon);
      if (!isFinite(la) || !isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) {
        problemi.push('stanza.luogoNonValido');
      }
    }
    return problemi;
  }

  // ---------- Chi puo' fare cosa dentro la stanza ----------
  // Tre ruoli e non di piu'. "viewer" non e' un ruolo che qualcuno chiede:
  // e' quello che serve a far vedere i conti a chi ha pagato senza lasciargli
  // riscrivere le presenze di tutti.
  const RUOLI = ['proprietario', 'redattore', 'lettore'];
  const POTERI = {
    // Amministrare: cambiare date, luogo, codice, e togliere qualcuno.
    amministrare: ['proprietario'],
    // Modificare i dati del campo: presenze, spese, menu'.
    modificare: ['proprietario', 'redattore'],
    // Guardare e basta.
    guardare: ['proprietario', 'redattore', 'lettore'],
  };

  function puo(azione, ruolo) {
    const elenco = POTERI[azione];
    // Un'azione che non esiste non si concede per distrazione: e' la stessa
    // regola di auth.js, e per lo stesso motivo — un refuso nel nome
    // aprirebbe tutto a chiunque, e nessuna prova se ne accorgerebbe.
    if (!elenco) return false;
    return elenco.indexOf(ruolo) !== -1;
  }

  // Il proprietario non si puo' togliere da solo: una stanza senza
  // proprietario non la amministra piu' nessuno e non si puo' nemmeno
  // cancellare. Per andarsene, prima passa il testimone.
  function rimuovibile(chiRimuove, chiViene, quantiProprietari) {
    if (chiRimuove !== 'proprietario') return false;
    if (chiViene === 'proprietario' && !(quantiProprietari > 1)) return false;
    return true;
  }

  root.Stanza = {
    ALFABETO,
    COMBINAZIONI,
    LUNGHEZZA: GRUPPI * PER_GRUPPO,
    RUOLI,
    POTERI,
    generaCodice,
    normalizza,
    codiceValido,
    bello,
    validaModulo,
    puo,
    rimuovibile,
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));
