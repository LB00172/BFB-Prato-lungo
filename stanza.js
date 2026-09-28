// La stanza: come si chiama, chi ci entra, e con che codice.
//
// Primo mattone del § 2 (ROADMAP.md). Sta fuori da src/ per lo stesso motivo
// di conti.js e auth.js: sono REGOLE, e una regola si prova con i numeri e le
// stringhe vere invece che leggendo caselle a schermo dentro un browser.
//
// Il file ha due meta', come auth.js: **Stanza** (qui sopra) sono le regole,
// pure e sincrone, provate senza browser; **StanzaCloud** (in fondo) e' il
// pezzo che parla con Firestore. Separati perche' le prove sostituiscono il
// trasporto e tengono le regole.
//
// In Stanza non c'e' crittografia: l'impronta del codice la calcola
// StanzaCloud passando da improntaPassword(), che esiste gia' in
// src/20-blocco-password.jsx ed e' la stessa usata dal blocco dell'app.
// Mettere un secondo PBKDF2 qui dentro vorrebbe dire che il giorno in cui una
// delle due implementazioni cambia, i codici vecchi non entrano piu'.
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

  // ---------- L'invito (§ 9) ----------
  // Un link solo, che precompila il codice. E' il passo che decide se un
  // gruppo poco tecnologico adotta l'app o si ferma al primo tentativo: far
  // digitare otto caratteri a venti persone su WhatsApp non funziona.
  //
  // **Il codice sta nel FRAMMENTO (#), non nella query (?).** Non e' un
  // vezzo: il frammento non viene spedito al server — non finisce nei log di
  // Vercel, non entra nell'intestazione Referer quando si apre un link verso
  // un altro sito, e non compare nelle statistiche. Il codice E' la password
  // della stanza, quindi ogni posto in meno dove si deposita e' un posto in
  // meno da cui puo' uscire.
  //
  // La scelta dichiarata (ROADMAP § 9): **il link porta il codice**, quindi
  // chi inoltra il messaggio inoltra l'ingresso. Per un gruppo di amici e'
  // accettabile ed e' l'unica forma che la gente usa davvero; la difesa e'
  // che il proprietario puo' cambiare il codice quando serve. Un invito
  // monouso a scadenza resta la strada per dopo, e non cambia questo formato.
  const CHIAVE_INVITO = 'stanza';

  function linkInvito(base, codice) {
    const c = bello(codice);
    if (!codiceValido(c)) return '';
    // Si butta via quello che c'era dopo ? o #: un invito costruito sopra un
    // altro invito porterebbe due codici, e vincerebbe quello sbagliato.
    const pulito = String(base || '').split('#')[0].split('?')[0];
    if (!pulito) return '';
    return `${pulito}#${CHIAVE_INVITO}=${c}`;
  }

  // Il contrario: da un indirizzo al codice. Legge il frammento e anche la
  // query, perche' un link ricopiato a mano o passato da un accorciatore puo'
  // arrivare in tutte e due le forme, e rifiutarlo sarebbe pedanteria.
  function leggiInvito(indirizzo) {
    const testo = String(indirizzo || '');
    // Si guarda PRIMA il frammento: e' li' che lo mettiamo noi.
    const pezzi = [testo.split('#')[1] || '', testo.split('#')[0].split('?')[1] || ''];
    for (let i = 0; i < pezzi.length; i++) {
      const re = new RegExp('(?:^|&)' + CHIAVE_INVITO + '=([^&]*)');
      const m = pezzi[i].match(re);
      if (!m) continue;
      let grezzo = m[1];
      // %20, + al posto dello spazio, %2D al posto del trattino: un link che
      // passa da WhatsApp e da un accorciatore torna indietro cosi'.
      try { grezzo = decodeURIComponent(grezzo.replace(/\+/g, ' ')); } catch (e) { /* si tiene il grezzo */ }
      const c = normalizza(grezzo);
      if (codiceValido(c)) return c;
    }
    return null;
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

  // ---------- Cosa si scrive nella scheda di un membro ----------
  // Sta QUI, e non dentro StanzaCloud, per una ragione che ho scoperto
  // sbagliando: la prova e2e sostituisce StanzaCloud con un finto, quindi
  // qualunque decisione presa li' dentro la prova non la vede — verificava il
  // finto e si dichiarava soddisfatta. Le decisioni stanno nelle regole, il
  // trasporto le chiama, e cosi' le prova sia la prova unitaria sia quella a
  // schermo.
  //
  // La riga che conta: chi ENTRA e' redattore. Non se lo sceglie. Se si
  // scegliesse il ruolo, il primo che entra con un codice si scrive
  // proprietario e amministra il campo di un altro. Anche le regole Firestore
  // lo vietano — questa e' la seconda serratura, non l'unica.
  function schedaIngresso(nome, impronta, quando) {
    return {
      ruolo: 'redattore',
      nome: String(nome || ''),
      prova: String(impronta || ''),
      entratoIl: quando || Date.now(),
    };
  }

  // Chi CREA la stanza ne e' il proprietario, e non porta nessuna prova: il
  // segreto l'ha appena scritto lui.
  function schedaProprietario(nome, quando) {
    return {
      ruolo: 'proprietario',
      nome: String(nome || ''),
      entratoIl: quando || Date.now(),
    };
  }

  // ---------- Rientrare: che cosa vuol dire la rilettura della scheda ----------
  // Prima di scriversi fra i membri si rilegge la propria scheda (vedi
  // StanzaCloud.entra, e test/regole § 5-quater). Il risultato si legge cosi':
  //
  //   - riletta ed esiste      -> gia' dentro: non si scrive niente, perche'
  //                               riscriverla e' una modifica e verrebbe negata;
  //   - "permesso negato"      -> non sei membro (le regole la scheda la fanno
  //                               leggere solo ai membri): scriviti;
  //   - qualunque altro errore -> NON si scrive. Soprattutto la linea che
  //                               manca: da offline il setDoc andrebbe in coda
  //                               e verrebbe respinto al ritorno, in silenzio.
  //
  // Sta qui e non nel trasporto perche' il trasporto nelle prove e' finto, e
  // una decisione dentro il finto non la verifica nessuno.
  function esitoRilettura(scheda, errore) {
    if (errore) {
      const codice = String((errore.code || errore.message) || '');
      return /permission-denied/.test(codice) ? 'scriviti' : 'rilancia';
    }
    return scheda && scheda.esiste ? 'gia-dentro' : 'scriviti';
  }

  // ---------- Cancellare l'account: cosa si fa con le stanze ----------
  // Google Play chiede che chi ha un account possa cancellarlo, con i suoi
  // dati (ROADMAP § 3). Il nodo e' quello che il § 1 aveva gia' scritto: e'
  // una domanda sulla stanza, non sull'account. Chi e' PROPRIETARIO di un
  // campo non puo' sparire: il campo resterebbe senza nessuno che lo
  // amministra, e senza nessuno che possa nemmeno cancellarlo — le regole
  // Firestore non lasciano togliere la scheda del proprietario proprio per
  // questo. Allora ci si ferma PRIMA di toccare qualunque cosa, e si dice
  // quali sono i campi da cedere o cancellare.
  //
  // Dove si e' solo membro, invece, si toglie la propria scheda: e' il dato
  // personale che sta dentro la stanza. Le spese e le presenze che hai
  // scritto restano al campo — sono i conti del gruppo, come i messaggi in
  // una chat di gruppo — e l'informativa lo dice.
  //
  // `stanze`: [{ codice, membro, proprietario }], da StanzaCloud.statoDi.
  // Lo stesso campo puo' arrivare due volte (dal profilo e dal telefono): si
  // conta una volta sola.
  function pianoCancellazione(stanze) {
    const visti = {};
    const bloccata = [];
    const daTogliere = [];
    (stanze || []).forEach((x) => {
      if (!x || !x.codice) return;
      const c = normalizza(x.codice);
      if (visti[c]) return;
      visti[c] = true;
      if (x.proprietario) bloccata.push(c);
      else if (x.membro) daTogliere.push(c);
    });
    return { bloccata, daTogliere };
  }

  // ---------- Cosa si puo' fare quando non sei in nessun campo ----------
  // Finche' non sei dentro un campo, quasi tutte le aree dell'app parlano di
  // dati che non esistono: Calendario mostra una settimana vuota, Saldi dei
  // conti a zero, Galleria nessuna foto. Un menu pieno di sezioni vuote non
  // e' generoso, e' confuso — sembra un'app rotta invece di un'app che sta
  // aspettando una cosa sola.
  //
  // Restano le aree che parlano di TE e non del campo. Tutto il resto compare
  // quando c'e' qualcosa da mostrarci dentro.
  const FUORI_DAL_CAMPO = ['impostazioni'];

  function gruppiMenu(gruppi, dentroUnCampo) {
    if (dentroUnCampo) return gruppi || [];
    return (gruppi || [])
      .map((g) => ({ ...g, items: (g.items || []).filter((k) => FUORI_DAL_CAMPO.indexOf(k) >= 0) }))
      .filter((g) => g.items.length);
  }

  // ---------- I miei campi ----------
  // L'elenco dei campi di una persona, che la home mostra. Una voce e'
  // { codice, nome, inizio, fine, ruolo }: il codice e' l'unica cosa sempre
  // vera, il resto e' quello che si sapeva l'ultima volta — il nome di un campo
  // in cui si e' entrati col codice si scopre solo leggendo la stanza, e al
  // campo in montagna la linea non c'e'. Per questo l'elenco sta anche sul
  // telefono: la home deve aprirsi offline, con i nomi di ieri.
  //
  // Tre regole, tutte pure.

  // Ricordare un campo: se c'e' gia', si aggiorna con quello che di nuovo si
  // sa; un valore vuoto non cancella uno pieno. Il codice si normalizza: lo
  // stesso campo scritto in due modi non deve comparire due volte.
  function ricordaCampo(lista, voce) {
    const c = normalizza(voce && voce.codice);
    if (!c) return lista || [];
    const pulita = { codice: c };
    ['nome', 'inizio', 'fine', 'ruolo'].forEach((k) => {
      if (voce[k]) pulita[k] = String(voce[k]);
    });
    const fuori = [];
    let trovata = false;
    (lista || []).forEach((v) => {
      if (normalizza(v.codice) === c) {
        trovata = true;
        fuori.push(Object.assign({}, v, pulita));
      } else {
        fuori.push(v);
      }
    });
    if (!trovata) fuori.push(pulita);
    return fuori;
  }

  // Quello che dice il cloud. `codiciProfilo` sono le stanze che il profilo
  // di chi e' registrato si e' segnato (lo seguono su ogni telefono);
  // `stati` e' la lettura di ogni stanza (StanzaCloud.statoDi). Chi non e'
  // piu' membro — tolto dal proprietario, o stanza cancellata — sparisce
  // dall'elenco: lasciarlo vorrebbe dire una voce che, toccata, non apre
  // niente. Una stanza che non si e' potuta leggere (niente linea) resta
  // com'era: l'assenza di una risposta non e' un "no".
  function aggiornaCampi(lista, codiciProfilo, stati) {
    let fuori = (lista || []).slice();
    (codiciProfilo || []).forEach((c) => { fuori = ricordaCampo(fuori, { codice: c }); });
    (stati || []).forEach((st) => {
      const c = normalizza(st && st.codice);
      if (!c) return;
      if (st.membro === false) {
        fuori = fuori.filter((v) => normalizza(v.codice) !== c);
        return;
      }
      fuori = ricordaCampo(fuori, {
        codice: c, nome: st.nome, inizio: st.inizio, fine: st.fine,
        // Il ruolo si sa per certo solo dal proprietario: gli altri restano
        // come li si era segnati entrando.
        ruolo: st.proprietario ? 'proprietario' : undefined,
      });
      // Il Pro invece si prende com'e', anche quando manca: qui il vuoto e'
      // una risposta. Tenere il Pro di ieri perche' oggi «non c'e' niente»
      // vorrebbe dire non farlo scadere mai.
      fuori = fuori.map((v) => {
        if (normalizza(v.codice) !== c) return v;
        const senza = Object.assign({}, v);
        delete senza.pro;
        return st.pro ? Object.assign(senza, { pro: st.pro }) : senza;
      });
    });
    return fuori;
  }

  // In che ordine mostrarli: prima quelli in corso, poi quelli che devono
  // ancora cominciare (il piu' vicino in testa), poi quelli finiti (il piu'
  // recente in testa), in fondo quelli di cui non si sanno le date. Le date
  // sono stringhe 'AAAA-MM-GG', che si confrontano bene come testo; `oggi`
  // si passa da fuori perche' una regola che guarda l'orologio da se' non
  // si puo' provare.
  function ordinaCampi(lista, oggi) {
    const fase = (v) => {
      if (!v.inizio) return 3;
      const fine = v.fine || v.inizio;
      if (v.inizio <= oggi && oggi <= fine) return 0;
      return v.inizio > oggi ? 1 : 2;
    };
    const confronta = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
    return (lista || []).slice().sort((a, b) => {
      const fa = fase(a);
      const fb = fase(b);
      if (fa !== fb) return fa - fb;
      if (fa === 1) return confronta(a.inizio, b.inizio);
      if (fa === 2) return confronta(b.fine || b.inizio, a.fine || a.inizio);
      return String(a.nome || a.codice).localeCompare(String(b.nome || b.codice));
    });
  }

  // ---------- Il Pro e' del campo ----------
  // La domanda e' una sola, e le funzioni Pro la fanno tutte qui: «questo
  // CAMPO e' Pro?». Non «questa persona e' Pro?»: il Pro lo paga chi crea il
  // campo, e vale per tutti quelli che ci sono dentro. Chi e' Pro in un altro
  // gruppo non porta niente con se', perche' questa funzione la persona non
  // la guarda nemmeno — riceve la stanza, e basta.
  //
  // `pro` sta nel documento della stanza e lo scrive solo il server che
  // verifica l'acquisto: le regole Firestore lo vietano a ogni telefono,
  // proprietario compreso (test/regole/stanze.js, § 8). `fino` e' facoltativo
  // ('AAAA-MM-GG', compreso): senza, il Pro non scade. `oggi` si passa da
  // fuori, come in ordinaCampi.
  function campoPro(stanza, oggi) {
    const p = stanza && stanza.pro;
    if (!p || p.attivo !== true) return false;
    if (p.fino && oggi && oggi > p.fino) return false;
    return true;
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
    schedaIngresso,
    schedaProprietario,
    FUORI_DAL_CAMPO,
    gruppiMenu,
    esitoRilettura,
    pianoCancellazione,
    ricordaCampo,
    aggiornaCampi,
    campoPro,
    ordinaCampi,
    linkInvito,
    leggiInvito,
    CHIAVE_INVITO,
  };
}(typeof globalThis !== 'undefined' ? globalThis : this));

// ============================================================================
//  IL TRASPORTO — StanzaCloud
// ============================================================================
// Stessa divisione di auth.js: sopra le REGOLE, qui il pezzo che parla con
// Firestore. Separati perche' le prove sostituiscono il trasporto e tengono le
// regole: se fossero la stessa cosa, fingere Firebase vorrebbe dire rinunciare
// alle regole proprio nella prova che deve verificarle.
//
// Tre cose che questo pezzo NON fa:
//   - non inizializza Firebase due volte (firebase-sync.js lo fa gia': qui si
//     chiede l'app esistente, e solo se non c'e' se ne crea una);
//   - non carica niente all'avvio — l'SDK viene da gstatic, e senza linea
//     l'app si deve aprire lo stesso;
//   - non decide niente. Le decisioni stanno sopra, in Stanza.
//
// La cosa importante da sapere leggendolo: **la vera guardia non e' qui**.
// Un client puo' provare a scriversi in members/<uid> quanto vuole: a dire di
// no sono le regole Firestore (firestore.rules, provate con `npm run regole`).
// Qui si calcola l'impronta e si prova a scrivere; se il codice e' sbagliato
// torna indietro un permission-denied, e va tradotto in una frase.
(function (root) {
  'use strict';

  const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';
  let fb = null;
  let db = null;

  const config = () => (root.FIREBASE_CONFIG || null);
  const disponibile = () => !!(config() && config().apiKey);

  async function sdk() {
    if (fb) return fb;
    const [appMod, fsMod] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-firestore.js'),
    ]);
    fb = Object.assign({}, appMod, fsMod);
    return fb;
  }

  async function init() {
    if (db) return db;
    if (!disponibile()) throw new Error('firebase-non-configurato');
    const f = await sdk();
    const app = (f.getApps && f.getApps().length) ? f.getApp() : f.initializeApp(config());
    db = f.getFirestore(app);
    return db;
  }

  // L'impronta del codice. Si passa da improntaPassword(), che e' la stessa
  // funzione del blocco dell'app: una seconda implementazione di PBKDF2
  // vorrebbe dire che il giorno in cui una delle due cambia i codici vecchi
  // non entrano piu', e nessuno capirebbe perche'.
  //
  // Il sale e' il codice della stanza stesso, non un valore a caso: il sale
  // dev'essere lo stesso su tutti i telefoni che calcolano l'impronta di quel
  // codice, altrimenti le impronte non combaciano mai. Serve a impedire che
  // una tabella precalcolata valga per tutte le stanze, e per quello basta.
  async function impronta(codice) {
    const n = root.Stanza.normalizza(codice);
    if (!n) return null;
    const salt = Array.from(n).map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    if (typeof root.improntaPassword !== 'function') return null;
    return root.improntaPassword(n, { salt, iter: 200000 });
  }

  // Creare una stanza: il documento, il segreto e la scheda del proprietario.
  // Non e' una transazione, e va saputo: se il telefono muore a meta', resta
  // una stanza senza segreto — nessuno ci entra, nemmeno chi l'ha creata, e
  // si rifa'. E' il male minore rispetto a una Cloud Function.
  // Il profilo si ricorda in quali stanze sei entrato o che hai creato. Serve
  // a una cosa sola: cancellare l'account. Le regole non lasciano ELENCARE le
  // stanze di qualcuno (una query su rooms/ non si puo' dimostrare sicura, e
  // viene negata), quindi senza questo elenco la cancellazione non saprebbe
  // di quali campi sei proprietario — e ne lascerebbe qualcuno senza padrone.
  //
  // Solo per chi ha un account vero: un anonimo non ha profilo (vedi
  // Auth.profiloDaSalvare), e scriverglielo qui lo farebbe nascere lo stesso.
  // E non e' una condizione per entrare: se non riesce, si entra comunque —
  // la cancellazione guarda anche la stanza salvata sul telefono.
  async function segnaNelProfilo(f, d, utente, c) {
    if (!utente || !utente.uid || utente.isAnonimo || utente.isAnonymous) return;
    try {
      await f.setDoc(f.doc(d, 'users', utente.uid), { stanze: f.arrayUnion(c) }, { merge: true });
    } catch (e) { /* un aiuto per la cancellazione, non un requisito per entrare */ }
  }

  async function crea(dati, utente) {
    const f = await sdk();
    const d = await init();
    const codice = root.Stanza.normalizza(dati.codice);
    const imp = await impronta(codice);
    if (!imp) throw new Error('senza-impronta');
    await f.setDoc(f.doc(d, 'rooms', codice), {
      nome: String(dati.nome || '').trim(),
      inizio: dati.inizio || '',
      fine: dati.fine || '',
      luogo: dati.luogo || null,
      proprietario: utente.uid,
      creataIl: Date.now(),
    });
    await f.setDoc(f.doc(d, 'rooms', codice, 'private', 'join'), { impronta: imp });
    await f.setDoc(f.doc(d, 'rooms', codice, 'members', utente.uid),
      root.Stanza.schedaProprietario((root.Auth && root.Auth.nomeVisibile(utente)) || ''));
    await segnaNelProfilo(f, d, utente, codice);
    return codice;
  }

  // Entrare: ci si scrive da soli, portando l'impronta. A dire di no e'
  // Firestore, non questo codice.
  async function entra(codice, utente) {
    // Senza un utente non c'e' un uid sotto cui scriversi fra i membri. Qui
    // c'era un utente.uid secco, e un utente nullo lo faceva esplodere in un
    // TypeError che arrivava a schermo come "non e' riuscito" — cioe' come un
    // guasto, quando il motivo e' un altro. Succede quando l'accesso anonimo
    // non e' ancora avvenuto: la sincronizzazione lo fa aprendo l'app, e se
    // non c'era linea non l'ha fatto. Il controllo sta PRIMA di caricare
    // l'SDK: senza utente non serve nemmeno provarci.
    if (!utente || !utente.uid) throw new Error('senza-utente');
    const f = await sdk();
    const d = await init();
    const c = root.Stanza.normalizza(codice);
    const imp = await impronta(c);
    if (!imp) throw new Error('senza-impronta');
    const scheda = f.doc(d, 'rooms', c, 'members', utente.uid);

    // Gia' dentro? Chi cambia telefono, o rimette il codice di un campo in cui
    // e' gia' entrato, arriva qui con la scheda che esiste gia'. Riscriverla
    // per le regole e' una MODIFICA, che fa solo il proprietario: il setDoc
    // veniva negato e a schermo usciva "codice sbagliato" a chi il codice
    // giusto ce l'aveva in mano (test/regole, § 5-quater). Si rilegge prima:
    // le regole lasciano leggere la propria scheda solo a chi e' membro,
    // quindi se la lettura riesce e la scheda c'e', si e' gia' dentro.
    //
    // Come leggere il risultato lo dice Stanza.esitoRilettura, qui sopra.
    let letta = null;
    let errore = null;
    try { const x = await f.getDoc(scheda); letta = { esiste: x.exists() }; } catch (e) { errore = e; }
    const esito = root.Stanza.esitoRilettura(letta, errore);
    if (esito === 'gia-dentro') { await segnaNelProfilo(f, d, utente, c); return c; }
    if (esito === 'rilancia') throw errore;
    await f.setDoc(scheda,
      root.Stanza.schedaIngresso((root.Auth && root.Auth.nomeVisibile(utente)) || '', imp));
    await segnaNelProfilo(f, d, utente, c);
    return c;
  }

  async function leggi(codice) {
    const f = await sdk();
    const d = await init();
    const s = await f.getDoc(f.doc(d, 'rooms', root.Stanza.normalizza(codice)));
    return s.exists() ? Object.assign({ codice: root.Stanza.normalizza(codice) }, s.data()) : null;
  }

  async function membri(codice) {
    const f = await sdk();
    const d = await init();
    const s = await f.getDocs(f.collection(d, 'rooms', root.Stanza.normalizza(codice), 'members'));
    // La prova d'ingresso non serve a chi disegna, e un'impronta che gira per
    // l'interfaccia e' un'impronta che prima o poi finisce in un registro.
    return s.docs.map((x) => {
      const dati = x.data() || {};
      return { uid: x.id, ruolo: dati.ruolo || '', nome: dati.nome || '' };
    });
  }

  // Un permission-denied qui vuol dire quasi sempre una cosa sola: il codice
  // e' sbagliato. Dirlo cosi' e' piu' utile di "operazione non consentita",
  // che manda a cercare un guasto dove non c'e'.
  // Per ogni codice: ci sei dentro? ne sei il proprietario? Si legge il
  // documento della stanza: le regole lo fanno leggere solo ai membri, quindi
  // "permesso negato" vuol dire "non sei membro". Ogni altro errore — la linea
  // soprattutto — ferma tutto: una cancellazione non si fa alla cieca, e
  // saltare un campo di cui sei proprietario vorrebbe dire lasciarlo orfano.
  async function statoDi(codici, utente) {
    if (!utente || !utente.uid) throw new Error('senza-utente');
    const f = await sdk();
    const d = await init();
    const out = [];
    for (const cod of (codici || [])) {
      const c = root.Stanza.normalizza(cod);
      if (!c) continue;
      try {
        const x = await f.getDoc(f.doc(d, 'rooms', c));
        const dati = x.exists() ? x.data() : {};
        // Se la lettura e' riuscita, per le regole sei membro — anche se la
        // stanza nel frattempo non c'e' piu' e la tua scheda si'.
        // Nome e date servono alla home («I miei campi»): sono gia' nel
        // documento che si sta leggendo, e non costano una lettura in piu'.
        out.push({
          codice: c, membro: true, proprietario: dati.proprietario === utente.uid,
          nome: dati.nome || '', inizio: dati.inizio || '', fine: dati.fine || '',
          pro: dati.pro || null,
        });
      } catch (e) {
        if (/permission-denied/.test(String((e && (e.code || e.message)) || ''))) {
          out.push({ codice: c, membro: false, proprietario: false });
        } else {
          throw e;
        }
      }
    }
    return out;
  }

  // Si toglie la propria scheda da ogni stanza dove si e' solo membri. Le
  // regole lo permettono a se stessi, e lo vietano al proprietario — che qui
  // non arriva mai, perche' Stanza.pianoCancellazione lo ha gia' fermato.
  async function togliMe(codici, utente) {
    if (!utente || !utente.uid) throw new Error('senza-utente');
    const f = await sdk();
    const d = await init();
    for (const c of (codici || [])) {
      await f.deleteDoc(f.doc(d, 'rooms', c, 'members', utente.uid));
    }
  }

  function motivo(errore) {
    const codice = String((errore && (errore.code || errore.message)) || '');
    if (/permission-denied/.test(codice)) return 'stanza.codiceSbagliato';
    // "senza-utente" vuol dire che l'accesso anonimo non c'e' stato, e il
    // motivo quasi sempre e' la linea: si dice quello, che l'utente capisce e
    // puo' risolvere da solo, invece di un "non e' riuscito" che sa di guasto.
    if (/unavailable|network|senza-utente/.test(codice)) return 'stanza.senzaLinea';
    if (/firebase-non-configurato/.test(codice)) return 'stanza.senzaFirebase';
    if (/senza-impronta/.test(codice)) return 'stanza.senzaCaso';
    return 'stanza.nonRiuscito';
  }

  root.StanzaCloud = { disponibile, crea, entra, leggi, membri, impronta, statoDi, togliMe, motivo };
}(typeof globalThis !== 'undefined' ? globalThis : this));
