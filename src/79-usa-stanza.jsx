// ---------- La stanza ----------
//
// Quinto pezzo di stato fuori da App() (ROADMAP § 14), e il modulo del § 9.
// Tiene: quale stanza sei dentro, cosa stai scrivendo nel modulo, e cosa e'
// andato storto. Le REGOLE — l'alfabeto del codice, come si legge un codice
// digitato a mano, se il modulo e' valido — stanno in stanza.js, fuori da
// src/, e si provano senza browser.
//
// Due cose da non dimenticare leggendo questo file.
//
// **Non e' un muro**, come l'account. Chi apre l'app e usa il campo che ha
// gia' non incontra niente di tutto questo: la stanza serve a chi ne crea una
// nuova o entra in quella di un altro, e sta dietro FEATURES.rooms.
//
// **La guardia vera non e' qui.** Questo hook calcola l'impronta e prova a
// scrivere; a dire di no sono le regole Firestore. Un controllo in piu' scritto
// qui non aggiunge sicurezza — aggiunge un posto dove sbagliare — ma un
// controllo che manca QUI si vede solo come un permission-denied, quindi le
// cose che l'utente puo' correggere da solo (un codice della forma sbagliata,
// una data storta) si dicono prima di disturbare la rete.
// La stanza salvata si legge SUBITO, nello stato iniziale. Si leggeva in un
// effetto, cioe' dopo il primo disegno: per quel primo disegno l'app credeva
// di non essere in nessuna stanza, prendeva il codice predefinito e — da
// quando ogni campo ha il suo cassetto (cassetti.js) — cambiava cassetto
// verso il campo sbagliato, per poi tornare indietro al giro dopo.
const leggiStanzaSalvata = () => {
  try {
    const c = localStorage.getItem('cambusa_stanza');
    return c ? { codice: c } : null;
  } catch (e) { return null; /* niente: si resta senza stanza */ }
};

// I miei campi, come li ricorda questo telefono (Stanza.ricordaCampo). E'
// una chiave del TELEFONO, non del campo (cassetti.js): e' proprio l'elenco
// che serve a scegliere quale cassetto aprire.
const CAMPI_KEY = 'cambusa_campi';
const leggiCampi = () => {
  try {
    const v = JSON.parse(localStorage.getItem(CAMPI_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
};

const usaStanza = () => {
  // La stanza di adesso: null vuol dire "nessuna", che e' il caso normale
  // finche' la versione pubblica non esiste davvero.
  const [stanza, setStanza] = useState(leggiStanzaSalvata);
  const [membri, setMembri] = useState([]);
  // La bozza delle regole mentre il capogruppo le scrive (null: non le sta
  // scrivendo), e chi sta scegliendo come aiutante.
  const [bozzaRegole, setBozzaRegole] = useState(null);
  const [sceltaAiutante, setSceltaAiutante] = useState('');
  // Chi aveva gia' una stanza prima che la home esistesse la ritrova in
  // elenco: la stanza salvata entra da sola.
  const [campi, setCampi] = useState(() => {
    const s = leggiStanzaSalvata();
    const l = leggiCampi();
    return s && window.Stanza ? window.Stanza.ricordaCampo(l, { codice: s.codice }) : l;
  });
  useEffect(() => { scriviLocale(CAMPI_KEY, JSON.stringify(campi)); }, [campi]);
  const segnaCampo = (voce) => {
    if (window.Stanza) setCampi((l) => window.Stanza.ricordaCampo(l, voce));
  };
  // Quale maschera e' aperta: '' | 'crea' | 'entra'.
  const [modo, setModo] = useState('');
  const [nome, setNome] = useState('');
  const [inizio, setInizio] = useState('');
  const [fine, setFine] = useState('');
  const [codice, setCodice] = useState('');
  // Chiavi del dizionario, non frasi: le sceglie il disegno (§ 18).
  const [problema, setProblema] = useState(null);
  const [fatto, setFatto] = useState(null);
  const [occupato, setOccupato] = useState(false);

  const SC = () => (typeof window !== 'undefined' && window.StanzaCloud) || null;
  const S = () => (typeof window !== 'undefined' && window.Stanza) || null;

  // La stanza in cui si era entrati si ricorda: riaprire l'app e ritrovarsi
  // fuori sarebbe come non esserci mai entrati. Si scrive con scriviLocale
  // (10-fondamenta), che ha il try/catch: un setItem nudo dentro un effetto
  // smonta React quando la quota e' piena (CLAUDE.md). NON salvaLocale —
  // quello vive dentro App() e da un hook non si vede. Si RILEGGE invece
  // nello stato iniziale (leggiStanzaSalvata, sopra), non in un effetto.

  // ---------- L'invito arrivato da un link ----------
  // Chi apre "…#stanza=K7RX-2MQP" ha un invito in mano. NON lo si accetta da
  // soli: si mostra e si chiede. Entrare di nascosto in una stanza perche'
  // qualcuno ha inoltrato un messaggio e' esattamente il genere di cosa che
  // fa disinstallare un'app — e chi tocca un link non ha per forza deciso
  // di cambiare campo.
  const [invito, setInvito] = useState(null);

  useEffect(() => {
    const regole = S();
    if (!regole || typeof window === 'undefined') return;
    const c = regole.leggiInvito(window.location.href);
    if (!c) return;
    setInvito(c);
    // Il codice si toglie subito dalla barra: resterebbe nella cronologia del
    // telefono, e da li' lo rilegge chiunque lo prenda in mano. Si sostituisce
    // la voce invece di aggiungerne una, cosi' il tasto indietro non ci
    // riporta dentro.
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) { /* niente: il link resta in barra, non e' un guasto */ }
  }, []);

  const pulisci = () => { setProblema(null); setFatto(null); };
  const chiudi = () => { setModo(''); pulisci(); };

  // Una sola strada per "occupato", per l'errore tradotto e per il caso in cui
  // Firebase non sia configurato. Senza, ogni tasto avrebbe il suo try/catch e
  // uno di loro se lo dimenticherebbe.
  const prova = async (azione) => {
    const c = SC();
    if (!c || !c.disponibile()) { setProblema('stanza.senzaFirebase'); return null; }
    setOccupato(true);
    pulisci();
    try {
      return await azione(c);
    } catch (e) {
      setProblema(c.motivo ? c.motivo(e) : 'stanza.nonRiuscito');
      return null;
    } finally {
      setOccupato(false);
    }
  };

  // `voce`: quello che si sa del campo in questo momento (il nome e le date
  // se lo si e' appena creato, il ruolo con cui si e' entrati).
  const ricorda = (cod, voce) => {
    setStanza({ codice: cod });
    scriviLocale('cambusa_stanza', cod);
    segnaCampo(Object.assign({ codice: cod }, voce || {}));
  };

  // Aprire un campo dell'elenco: e' gia' tuo, quindi non si chiede niente
  // alla rete — in montagna deve funzionare senza linea. Se la scheda nella
  // stanza non ci fosse piu', lo diranno le regole alla sincronizzazione.
  const apriCampo = (cod) => {
    pulisci();
    setModo('');
    ricorda(cod);
  };

  // L'elenco dal cloud: il profilo (solo per chi e' registrato: lo segue su
  // ogni telefono) e la lettura di ogni stanza, per nome, date e se si e'
  // ancora dentro. Senza linea non si tocca niente e non si dice niente: la
  // home resta quella di ieri, che e' la cosa giusta da mostrare al campo.
  const aggiornaCampi = async (utente, conProfilo) => {
    const c = SC();
    const regole = S();
    if (!c || !c.disponibile() || !regole || !utente || !utente.uid) return;
    try {
      let profilo = [];
      if (conProfilo && window.AuthCloud && window.AuthCloud.stanzeDelProfilo) {
        profilo = await window.AuthCloud.stanzeDelProfilo();
      }
      const codici = leggiCampi().map((v) => v.codice).concat(profilo || []);
      const stati = await c.statoDi(codici, utente);
      setCampi((l) => regole.aggiornaCampi(l, profilo, stati));
    } catch (e) { /* senza linea: l'elenco resta quello che era */ }
  };

  const crea = async (utente) => {
    const regole = S();
    // Creare una stanza vuol dire diventarne il proprietario: e' la riga
    // della tabella di auth.js, e la ripetono anche le regole Firestore. Qui
    // si dice prima, perche' un permission-denied non spiega niente.
    if (!window.Auth || !window.Auth.puo('creare', window.Auth.stato(utente))) {
      setProblema('stanza.serveAccount');
      return;
    }
    const problemi = regole.validaModulo({ nome, inizio, fine });
    // Si mostra il primo: un elenco di righe rosse sotto una maschera di
    // quattro caselle scoraggia piu' del problema che descrive.
    if (problemi.length) { setProblema(problemi[0]); setFatto(null); return; }

    const nuovo = regole.generaCodice();
    // generaCodice torna null quando il browser non sa dare numeri casuali
    // sicuri. Non si ripiega su Math.random(): un codice prevedibile e' una
    // serratura finta, e nessuno se ne accorgerebbe.
    if (!nuovo) { setProblema('stanza.senzaCaso'); return; }

    const cod = await prova((c) => c.crea({ nome, inizio, fine, codice: nuovo }, utente));
    if (cod) {
      ricorda(cod, { nome, inizio, fine, ruolo: 'proprietario' });
      setModo('');
      setFatto('stanza.creata');
    }
  };

  const entra = async (utente) => {
    const regole = S();
    // La forma del codice la puo' correggere l'utente da solo: dirglielo qui
    // e' meglio che fargli aspettare un giro di rete per sentirsi dire "non
    // consentito", che suona come un guasto e non come un refuso.
    if (!regole.codiceValido(codice)) { setProblema('stanza.codiceNonValido'); return; }
    const cod = await prova((c) => c.entra(codice, utente));
    if (cod) {
      ricorda(cod, { ruolo: 'redattore' });
      setModo('');
      setCodice('');
      setFatto('stanza.entrato');
    }
  };

  // Accettare l'invito e' entrare, con il codice che portava il link.
  const accettaInvito = async (utente) => {
    const cod = await prova((c) => c.entra(invito, utente));
    if (cod) {
      ricorda(cod, { ruolo: 'redattore' });
      setInvito(null);
      setFatto('stanza.entrato');
    }
  };
  const rifiutaInvito = () => { setInvito(null); pulisci(); };

  // Rientrare nella stanza in cui si e' gia', con il codice salvato sul
  // telefono, a nome dell'utente che si e' adesso. Serve a "tieni il tuo
  // posto" quando il collegamento a Google fa DIVENTARE un altro account
  // (quello gia' usato sul telefono di prima): il nuovo uid la scheda nella
  // stanza puo' non averla ancora. Se ce l'ha, entra() non scrive niente.
  //
  // Solo su richiesta, mai da un effetto che scatta a ogni cambio d'identita':
  // chi entra con un altro account su questo telefono non deve ritrovarsi
  // iscritto al campo di chi c'era prima senza averlo chiesto.
  const riagganciaStanza = async (utente) => {
    if (!stanza || !stanza.codice) return;
    const cod = await prova((c) => c.entra(stanza.codice, utente));
    if (cod) setFatto('stanza.postoTenuto');
  };

  // Il link da mandare agli altri. Si costruisce sull'indirizzo di questa
  // pagina senza quello che c'era dopo ? o # — ci pensa linkInvito.
  const linkDaMandare = () => {
    const regole = S();
    if (!regole || !stanza || typeof window === 'undefined') return '';
    return regole.linkInvito(window.location.origin + window.location.pathname, stanza.codice);
  };

  const aggiornaMembri = async () => {
    if (!stanza) return;
    const elenco = await prova((c) => c.membri(stanza.codice));
    if (elenco) setMembri(elenco);
  };

  // Uscire da una stanza qui vuol dire solo smettere di guardarla: la scheda
  // su Firestore la toglie chi amministra, o se stessi da un'altra strada.
  // Cancellarla da qui, con un tasto che sembra "chiudi", farebbe perdere il
  // posto a chi voleva solo tornare al campo di prima.
  const esci = () => {
    setStanza(null);
    setMembri([]);
    pulisci();
    scriviLocale('cambusa_stanza', '');
    // Il codice del campo salvato dalla sincronizzazione e' quello della
    // stanza da cui si esce (collegandosi lo scrive lei): lasciarlo li'
    // vorrebbe dire restare in quel campo — dati a schermo e collegamento —
    // dopo aver premuto «Esci».
    try {
      if (stanza && localStorage.getItem('cambusa_camp_code') === stanza.codice) localStorage.removeItem('cambusa_camp_code');
    } catch (e) { /* niente: al peggio si resta dove si era */ }
  };

  // «Questo campo e' Pro?» — l'unica domanda che le funzioni Pro devono fare
  // (Stanza.campoPro). Guarda il campo aperto, mai la persona. E' letta
  // dall'elenco sul telefono, quindi chi smonta l'app puo' falsarla per se':
  // vale per quello che il telefono fa da solo. Quello che costa (spazio,
  // server) lo decidono le regole Firestore, che leggono la stanza vera.
  const voceAperta = stanza && window.Stanza
    ? campi.find((v) => window.Stanza.normalizza(v.codice) === window.Stanza.normalizza(stanza.codice))
    : null;
  const pro = !!(window.Stanza && window.Stanza.campoPro(voceAperta, toDateStr(new Date())));
  // Cosa si sa del campo aperto: le sue regole, e chi lo guida. Come il Pro,
  // arriva dall'elenco sul telefono e si corregge a ogni lettura del cloud;
  // a decidere davvero chi puo' cambiare cosa sono le regole Firestore.
  const regole = (voceAperta && voceAperta.regole) || [];
  const capogruppo = !!(voceAperta && voceAperta.ruolo === 'proprietario');
  const aiutante = !!(voceAperta && voceAperta.aiutante);
  const vice = (voceAperta && voceAperta.vice) || '';

  // Si scrive nel documento della stanza e, subito, nell'elenco sul telefono:
  // chi ha appena salvato deve vedere quello che ha scritto, anche senza
  // linea (Firestore mette la scrittura in coda da solo).
  const aggiornaVoceAperta = (campi) => {
    if (!stanza) return;
    const c = window.Stanza.normalizza(stanza.codice);
    setCampi((l) => l.map((v) => (window.Stanza.normalizza(v.codice) === c ? Object.assign({}, v, campi) : v)));
  };
  const salvaRegole = async (testo) => {
    if (!stanza) return false;
    const elenco = window.Stanza.regoleDaTesto(testo);
    const fatto = await prova((c) => c.impostaStanza(stanza.codice, { regole: elenco }).then(() => true));
    if (fatto) aggiornaVoceAperta({ regole: elenco });
    return !!fatto;
  };
  const nominaAiutante = async (uid) => {
    if (!stanza || !uid) return;
    const fatto = await prova((c) => c.impostaStanza(stanza.codice, { vice: uid }).then(() => true));
    if (!fatto) return;
    aggiornaVoceAperta({ vice: uid });
    setFatto('stanza.aiutanteNominato');
  };
  // Il capogruppo se ne va: il campo passa all'aiutante (senza il Pro), e
  // su questo telefono il campo sparisce dall'elenco e si esce.
  // `prima`: quello che chi chiama vuole fare prima di uscire (portare la
  // scheda alla home). Deve stare nello stesso giro dell'uscita: uscire
  // cambia cassetto e rimonta l'app, e dopo non c'e' piu' nessuno a cui
  // chiederlo.
  const lasciaCampo = async (utente, prima) => {
    if (!stanza) return false;
    const c = window.Stanza.normalizza(stanza.codice);
    const fatto = await prova((sc) => sc.lasciaAllAiutante(stanza.codice, utente).then(() => true));
    if (!fatto) return false;
    setCampi((l) => l.filter((v) => window.Stanza.normalizza(v.codice) !== c));
    if (prima) prima();
    esci();
    setFatto('stanza.campoLasciato');
    return true;
  };

  return {
    pro, regole, capogruppo, aiutante, vice, salvaRegole, nominaAiutante, lasciaCampo,
    bozzaRegole, setBozzaRegole, sceltaAiutante, setSceltaAiutante,
    stanza, membri, modo, setModo,
    nome, setNome, inizio, setInizio, fine, setFine, codice, setCodice,
    problema, fatto, occupato, chiudi,
    crea, entra, esci, aggiornaMembri,
    invito, accettaInvito, rifiutaInvito, linkDaMandare, riagganciaStanza,
    campi, apriCampo, aggiornaCampi,
  };
};
