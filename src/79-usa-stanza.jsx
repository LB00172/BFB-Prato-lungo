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

// L'invito e' partito da questo telefono. E' una chiave del CAMPO: in un
// campo nuovo l'invito va rimandato.
const INVITO_KEY = 'cambusa_invito_mandato';
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
  const [bozzaDotazioni, setBozzaDotazioni] = useState(null);
  const [sceltaAiutante, setSceltaAiutante] = useState('');
  // Il luogo del campo, mentre il capogruppo lo sceglie: quello che ha
  // scritto, cosa ha trovato la ricerca, e il candidato da salvare.
  const [cercaLuogo, setCercaLuogo] = useState(null);   // null = riquadro chiuso
  const [trovatiLuogo, setTrovatiLuogo] = useState([]);
  const [candidatoLuogo, setCandidatoLuogo] = useState(null);
  const [erroreLuogo, setErroreLuogo] = useState('');
  // Il negozio di Google Play: null finche' non si sa, 'assente' fuori
  // dall'app Android, altrimenti il servizio con i prezzi nella valuta di chi
  // compra (li dice Google, non si scrivono qui).
  const [negozio, setNegozio] = useState(null);
  const [acquistando, setAcquistando] = useState('');
  const [esitoPro, setEsitoPro] = useState(null);      // { fatto } | { errore }
  const [cercandoLuogo, setCercandoLuogo] = useState(false);
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
    // Un campo gratuito attivo alla volta (Stanza.puoCreareCampo): il
    // secondo lo crea chi ha reso Pro il primo, o chi aspetta che finisca.
    // Si dice prima di scrivere il modulo, non dopo averlo compilato.
    if (!regole.puoCreareCampo(campi, toDateStr(new Date()))) { setProblema('pro.unCampoGratis'); return; }
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

  // Mandare l'invito: e' la stessa cosa da Impostazioni e dai primi passi,
  // quindi sta qui una volta. "Condividi" sul telefono apre WhatsApp,
  // Telegram, SMS e mail con un gesto solo; al computer, dove navigator.share
  // spesso non c'e', si apre WhatsApp nel browser. E si ricorda che e'
  // partito: e' il primo dei primi passi, e un invito mandato da qui non si
  // vede altrimenti finche' qualcuno non entra davvero.
  const [invitoMandato, setInvitoMandato] = useState(() => {
    try { return localStorage.getItem(INVITO_KEY) === '1'; } catch (e) { return false; }
  });
  const mandaInvito = () => {
    if (!stanza) return;
    const link = linkDaMandare();
    const testo = L.t('stanza.invitoTesto', stanza.nome || S().bello(stanza.codice), link);
    if (navigator.share) { navigator.share({ text: testo }).catch(() => { /* annullato: non e' un guasto */ }); }
    else { window.open('https://wa.me/?text=' + encodeURIComponent(testo), '_blank'); }
    setInvitoMandato(true);
    try { localStorage.setItem(INVITO_KEY, '1'); } catch (e) { /* niente: resta per questo giro */ }
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
  const oggi = toDateStr(new Date());
  const pro = !!(window.Stanza && window.Stanza.campoPro(voceAperta, oggi));
  // Fino a quando (compreso), se il Pro ha una scadenza.
  const proFino = (pro && voceAperta.pro && voceAperta.pro.fino) || '';
  // «Questa funzione e' aperta qui?» (Stanza.sbloccata). Senza stanza — la
  // versione privata, o un campo entrato col vecchio codice — non c'e' un
  // Pro da chiedere, e tutto resta com'era: aperto.
  const sbloccata = (funzione) => !stanza || !window.Stanza || window.Stanza.sbloccata(funzione, voceAperta, oggi);
  // Si puo' creare un altro campo? Si chiede prima di aprire il modulo.
  const puoCreare = !window.Stanza || window.Stanza.puoCreareCampo(campi, oggi);
  // Cosa si sa del campo aperto: le sue regole, e chi lo guida. Come il Pro,
  // arriva dall'elenco sul telefono e si corregge a ogni lettura del cloud;
  // a decidere davvero chi puo' cambiare cosa sono le regole Firestore.
  const regole = (voceAperta && voceAperta.regole) || [];
  const dotazioni = (voceAperta && voceAperta.dotazioni) || [];
  // Quali voci di spesa si dividono qui (voci.js). E' della stanza: le quote
  // devono essere le stesse su tutti i telefoni.
  const voci = (voceAperta && voceAperta.voci) || null;
  // Due capigruppo (30 settembre). Il PRIMO e' chi ha creato il campo (o
  // l'ha ricevuto): sceglie il secondo, compra il Pro, puo' lasciare il campo.
  // Il SECONDO (aiutante, il vice della stanza) amministra con lui tutto il
  // resto. `capogruppo` vuol dire «amministra»: e' vero per tutti e due.
  // Come per il Pro, lo dice l'elenco sul telefono; chi puo' davvero lo
  // decidono le regole Firestore (amministra e primoCapo).
  const primoCapo = !!(voceAperta && voceAperta.ruolo === 'proprietario');
  const aiutante = !!(voceAperta && voceAperta.aiutante);
  const capogruppo = primoCapo || aiutante;
  const vice = (voceAperta && voceAperta.vice) || '';
  // Il luogo per il meteo. Passa da luogoValido anche qui: l'elenco sul
  // telefono lo scrive un'app, e un'app puo' essere vecchia.
  const luogo = (voceAperta && window.Stanza.luogoValido(voceAperta.luogo)) || null;

  // Si scrive nel documento della stanza e, subito, nell'elenco sul telefono:
  // chi ha appena salvato deve vedere quello che ha scritto, anche senza
  // linea (Firestore mette la scrittura in coda da solo).
  const aggiornaVoceAperta = (campi) => {
    if (!stanza) return;
    const c = window.Stanza.normalizza(stanza.codice);
    setCampi((l) => l.map((v) => (window.Stanza.normalizza(v.codice) === c ? Object.assign({}, v, campi) : v)));
  };
  // ---------- La scheda «Il campo» ----------
  // Le righe si aprono una alla volta: e' l'elenco delle cose del campo, e
  // aperte tutte insieme tornerebbe il muro di riquadri che c'era in
  // Impostazioni. Quale riga e' aperta sta qui e non nella scheda: le schede
  // disegnano e non tengono stato.
  const [rigaCampo, setRigaCampo] = useState('');
  const apriRigaCampo = (k) => setRigaCampo((v) => (v === k ? '' : k));

  // Nome e date: il capogruppo li corregge. Le regole sono quelle del modulo
  // di creazione (Stanza.validaModulo), e le date sono quelle che il
  // Calendario usa per tutti: a correggerle si sposta il campo di ognuno.
  const [bozzaCampo, setBozzaCampo] = useState(null);
  const apriBozzaCampo = () => {
    const v = voceAperta || {};
    setBozzaCampo({ nome: v.nome || (stanza && stanza.nome) || '', inizio: v.inizio || '', fine: v.fine || '' });
    pulisci();
  };
  const salvaNomeDate = async () => {
    if (!stanza || !bozzaCampo) return false;
    const dati = { nome: String(bozzaCampo.nome || '').trim(), inizio: bozzaCampo.inizio, fine: bozzaCampo.fine };
    const problemi = window.Stanza.validaModulo(dati);
    if (problemi.length) { setProblema(problemi[0]); return false; }
    const fatto = await prova((c) => c.impostaStanza(stanza.codice, dati).then(() => true));
    if (!fatto) return false;
    aggiornaVoceAperta(dati);
    setBozzaCampo(null);
    return true;
  };

  const salvaRegole = async (testo) => {
    if (!stanza) return false;
    const elenco = window.Stanza.regoleDaTesto(testo);
    const fatto = await prova((c) => c.impostaStanza(stanza.codice, { regole: elenco }).then(() => true));
    if (fatto) aggiornaVoceAperta({ regole: elenco });
    return !!fatto;
  };
  const salvaDotazioni = async (testo) => {
    if (!stanza) return false;
    const elenco = window.Stanza.dotazioniDaTesto(testo);
    const fatto = await prova((c) => c.impostaStanza(stanza.codice, { dotazioni: elenco }).then(() => true));
    if (fatto) aggiornaVoceAperta({ dotazioni: elenco });
    return !!fatto;
  };
  // Una voce accesa o spenta. Si scrive la mappa intera: e' piccola, e cosi'
  // quello che resta nella stanza e' esattamente quello che si vede qui.
  const cambiaVoce = async (categoria, fuori) => {
    if (!stanza) return;
    const mappa = Object.assign({}, voci || {});
    if (fuori) mappa[categoria] = 'fuori'; else delete mappa[categoria];
    const fatto = await prova((c) => c.impostaStanza(stanza.codice, { voci: mappa }).then(() => true));
    if (fatto) aggiornaVoceAperta({ voci: mappa });
  };
  // ---------- Il luogo del campo ----------
  // Una casella sola per due cose: se quello che si scrive e' un link di
  // Google Maps o due coordinate, il luogo c'e' gia'; altrimenti e' un nome,
  // e si chiede a Open-Meteo (lo stesso servizio del meteo, gratuito e senza
  // chiave) quali posti si chiamano cosi'.
  const apriLuogo = () => {
    setCercaLuogo('');
    setTrovatiLuogo([]);
    setCandidatoLuogo(luogo ? Object.assign({}, luogo) : null);
    setErroreLuogo('');
  };
  const chiudiLuogo = () => { setCercaLuogo(null); setTrovatiLuogo([]); setCandidatoLuogo(null); setErroreLuogo(''); };
  const trovaLuogo = async () => {
    const testo = String(cercaLuogo || '').trim();
    setTrovatiLuogo([]);
    setErroreLuogo('');
    if (!testo) { setErroreLuogo('luogo.vuoto'); return; }
    const letto = window.Stanza.luogoDaTesto(testo);
    if (!letto.errore) { setCandidatoLuogo(letto); return; }
    if (letto.link) { setErroreLuogo(letto.errore); return; }
    if (!navigator.onLine) { setErroreLuogo('luogo.senzaLinea'); return; }
    setCercandoLuogo(true);
    try {
      const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=6&format=json'
        + '&language=' + encodeURIComponent(L.codice) + '&name=' + encodeURIComponent(testo));
      const j = await r.json();
      const trovati = ((j && j.results) || []).map(window.Stanza.luogoDaRicerca).filter(Boolean);
      setTrovatiLuogo(trovati);
      if (!trovati.length) setErroreLuogo('luogo.nessuno');
    } catch (e) {
      setErroreLuogo('luogo.senzaLinea');
    } finally {
      setCercandoLuogo(false);
    }
  };
  const salvaLuogo = async (l) => {
    if (!stanza) return false;
    // null toglie il luogo; un luogo storto non si scrive, nemmeno per errore.
    const pulito = l === null ? null : window.Stanza.luogoValido(l);
    if (l !== null && !pulito) { setErroreLuogo('luogo.nonCapito'); return false; }
    const fatto = await prova((c) => c.impostaStanza(stanza.codice, { luogo: pulito }).then(() => true));
    if (!fatto) return false;
    aggiornaVoceAperta({ luogo: pulito });
    chiudiLuogo();
    return true;
  };

  // ---------- Comprare il Pro (Google Play Billing) ----------
  // Dentro l'app Android (una TWA) la pagina ha la Digital Goods API, che
  // parla con Google Play. Fuori — il browser, l'iPhone — non c'e': il Pro si
  // compra dall'app Android, e poi vale per tutti, ovunque.
  //
  // L'ordine e' quello che fa perdere meno soldi a chi paga:
  //   1. Google Play fa pagare e da' un gettone;
  //   2. il server verifica il gettone con Google e accende il Pro;
  //   3. SOLO ALLORA si «consuma» l'acquisto una tantum (cosi' si puo'
  //      ricomprare per un altro campo) e si dice a Play che e' andata.
  // Se il 2 cade (la linea, soprattutto), l'acquisto resta pagato e non
  // consumato: al prossimo giro lo si ritrova (riprendiAcquisti) e si
  // riprova. Il server risponde di si' anche la seconda volta.
  const utenteOra = () => (window.AuthCloud && window.AuthCloud.utente && window.AuthCloud.utente()) || null;
  const concludi = async (servizio, prodotto, token, ripresa) => {
    const P = window.Stanza.PRODOTTI_PRO;
    // L'abbonamento e' della persona, non di un campo: il codice non serve.
    const richiesta = { token, prodotto };
    if (prodotto === P.campo) richiesta.codice = stanza.codice;
    const r = await SC().attivaPro(richiesta);
    // Un gettone gia' registrato, ritrovato fra gli acquisti di questo
    // telefono, e' nostro e gia' concesso: si consuma e basta.
    const giaNostro = !!ripresa && r && r.motivo === 'gettone-gia-usato';
    if (r && (r.ok || giaNostro) && prodotto === P.campo) {
      try { await servizio.consume(token); } catch (e) { /* si riprova al prossimo giro */ }
    }
    return r || { ok: false, motivo: 'non-riuscito' };
  };
  const compraPro = async (prodotto) => {
    if (!stanza || !negozio || negozio === 'assente' || acquistando) return;
    setEsitoPro(null);
    setAcquistando(prodotto);
    let risposta = null;
    try {
      // Il totale lo decide Google, non questa richiesta: si passa zero,
      // come dice la documentazione di Chrome per Play Billing.
      const richiesta = new PaymentRequest(
        [{ supportedMethods: window.Stanza.PLAY_BILLING, data: { sku: prodotto } }],
        { total: { label: 'Total', amount: { currency: 'EUR', value: '0' } } },
      );
      risposta = await richiesta.show();
      const token = risposta.details && risposta.details.purchaseToken;
      const r = await concludi(negozio.servizio, prodotto, token);
      await risposta.complete(r.ok ? 'success' : 'fail');
      if (r.ok) {
        setEsitoPro({ fatto: 'pro.attivato' });
        await aggiornaCampi(utenteOra());
      } else {
        setEsitoPro({ errore: window.Stanza.erroreDelPro(r.motivo) });
      }
    } catch (e) {
      // Chi chiude la finestra di Google senza pagare non ha sbagliato
      // niente: nessun messaggio. Il resto si dice.
      if (risposta) { try { await risposta.complete('fail'); } catch (e2) { /* niente */ } }
      if (!(e && e.name === 'AbortError')) setEsitoPro({ errore: 'pro.errore.nonRiuscito' });
    } finally {
      setAcquistando('');
    }
  };
  // Acquisti pagati ma non conclusi (il server non aveva risposto): Google li
  // tiene in elenco finche' non si consumano. Si ritrovano aprendo il campo.
  const riprendiAcquisti = async (servizio) => {
    let rimasti = [];
    try { rimasti = await servizio.listPurchases(); } catch (e) { return; }
    const P = window.Stanza.PRODOTTI_PRO;
    let qualcosa = false;
    for (const a of rimasti || []) {
      if (a.itemId !== P.campo && a.itemId !== P.anno) continue;
      const r = await concludi(servizio, a.itemId, a.purchaseToken, true);
      if (r.ok) qualcosa = true;
    }
    if (qualcosa) { setEsitoPro({ fatto: 'pro.attivato' }); await aggiornaCampi(utenteOra()); }
  };
  // Il negozio si apre per il capogruppo di un campo, una volta per campo.
  const codiceNegozio = stanza ? stanza.codice : '';
  useEffect(() => {
    if (!codiceNegozio || !capogruppo || !window.Stanza) return undefined;
    let vivo = true;
    (async () => {
      if (typeof window.getDigitalGoodsService !== 'function') { setNegozio('assente'); return; }
      try {
        const servizio = await window.getDigitalGoodsService(window.Stanza.PLAY_BILLING);
        if (!servizio) { if (vivo) setNegozio('assente'); return; }
        const P = window.Stanza.PRODOTTI_PRO;
        const prezzi = {};
        try {
          (await servizio.getDetails([P.campo, P.anno])).forEach((d) => {
            prezzi[d.itemId] = new Intl.NumberFormat(L.locale, { style: 'currency', currency: d.price.currency }).format(Number(d.price.value));
          });
        } catch (e) { /* senza prezzi i tasti ci sono lo stesso: Google li dira' pagando */ }
        if (!vivo) return;
        setNegozio({ servizio, prezzi });
        await riprendiAcquisti(servizio);
      } catch (e) {
        if (vivo) setNegozio('assente');
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codiceNegozio, capogruppo]);

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
    pro, proFino, sbloccata, puoCreare, regole, capogruppo, primoCapo,
    negozio, acquistando, esitoPro, compraPro, aiutante, vice, salvaRegole, nominaAiutante, lasciaCampo,
    bozzaRegole, setBozzaRegole, sceltaAiutante, setSceltaAiutante,
    dotazioni, bozzaDotazioni, setBozzaDotazioni, salvaDotazioni,
    voci, cambiaVoce,
    luogo, salvaLuogo, apriLuogo, chiudiLuogo, trovaLuogo,
    cercaLuogo, setCercaLuogo, trovatiLuogo, candidatoLuogo, setCandidatoLuogo, erroreLuogo, cercandoLuogo,
    stanza, membri, modo, setModo,
    nome, setNome, inizio, setInizio, fine, setFine, codice, setCodice,
    problema, fatto, occupato, chiudi,
    crea, entra, esci, aggiornaMembri,
    invito, accettaInvito, rifiutaInvito, linkDaMandare, riagganciaStanza, mandaInvito, invitoMandato,
    rigaCampo, apriRigaCampo, setRigaCampo, bozzaCampo, setBozzaCampo, apriBozzaCampo, salvaNomeDate, voceAperta,
    campi, apriCampo, aggiornaCampi,
  };
};
