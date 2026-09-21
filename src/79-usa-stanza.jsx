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
const usaStanza = () => {
  // La stanza di adesso: null vuol dire "nessuna", che e' il caso normale
  // finche' la versione pubblica non esiste davvero.
  const [stanza, setStanza] = useState(null);
  const [membri, setMembri] = useState([]);
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
  // quello vive dentro App() e da un hook non si vede.
  useEffect(() => {
    try {
      const c = localStorage.getItem('cambusa_stanza');
      if (c) setStanza({ codice: c });
    } catch (e) { /* niente: si resta senza stanza */ }
  }, []);

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

  const ricorda = (cod) => {
    setStanza({ codice: cod });
    scriviLocale('cambusa_stanza', cod);
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
      ricorda(cod);
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
      ricorda(cod);
      setModo('');
      setCodice('');
      setFatto('stanza.entrato');
    }
  };

  // Accettare l'invito e' entrare, con il codice che portava il link.
  const accettaInvito = async (utente) => {
    const cod = await prova((c) => c.entra(invito, utente));
    if (cod) {
      ricorda(cod);
      setInvito(null);
      setFatto('stanza.entrato');
    }
  };
  const rifiutaInvito = () => { setInvito(null); pulisci(); };

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
  };

  return {
    stanza, membri, modo, setModo,
    nome, setNome, inizio, setInizio, fine, setFine, codice, setCodice,
    problema, fatto, occupato, chiudi,
    crea, entra, esci, aggiornaMembri,
    invito, accettaInvito, rifiutaInvito, linkDaMandare,
  };
};
