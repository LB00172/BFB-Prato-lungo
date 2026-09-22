// ---------- L'account ----------
//
// Quarto pezzo di stato che esce da App() (ROADMAP.md § 14), e il primo
// mattone della versione pubblica (§ 1). Tiene lo stato del login e niente
// altro: chi sei, cosa stai scrivendo nella maschera, e se qualcosa e' andato
// storto. Le REGOLE — cosa ti lascia fare l'app, se la registrazione e'
// valida, come si traduce un codice d'errore di Firebase — stanno in auth.js,
// fuori da src/, e si provano senza browser.
//
// La cosa da non dimenticare leggendo questo file: **non e' un muro**.
// L'account non serve per usare l'app. Chi apre l'app e digita il codice del
// campo segna presenze e spese come ha sempre fatto, e questo hook resta uno
// stato che nessuno guarda. Serve per CREARE e AMMINISTRARE un campo, cioe'
// per le cose che nella versione pubblica avranno un proprietario.
const usaAccount = () => {
  // L'utente com'e' adesso: null vuol dire ospite. Ci pensa AuthCloud ad
  // aggiornarlo, e parte da quello che sa gia' (di solito null) per non
  // lasciare la scheda vuota mentre l'SDK arriva da gstatic.
  const [utente, setUtente] = useState(null);
  // Quale maschera e' aperta: 'entra' | 'registra'. Chiusa di default, perche'
  // il tasto Google e' la strada breve e le due caselle sono la lunga.
  const [modo, setModo] = useState('');
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Una chiave del dizionario, non una frase: i messaggi li sceglie il disegno
  // (§ 18). null vuol dire che non c'e' niente da dire.
  const [problema, setProblema] = useState(null);
  const [occupato, setOccupato] = useState(false);
  // Una riga verde dopo un'azione riuscita: "email rimandata", "ti abbiamo
  // scritto". Senza, l'utente tocca due volte e riceve due email.
  const [fatto, setFatto] = useState(null);

  const AC = () => (typeof window !== 'undefined' && window.AuthCloud) || null;

  // Il profilo su users/<uid>: si allinea a ogni cambio di accesso, non a
  // ogni disegno. Chi entra per la prima volta lo fa nascere; chi rientra di
  // solito non scrive niente — la decisione sta in Auth.profiloDaSalvare, e
  // dice di no quando non e' cambiato nulla.
  //
  // Si ignora quello che torna, apposta: il profilo e' roba di servizio e
  // non deve mai far comparire un errore rosso a chi e' appena entrato.
  // sincronizzaProfilo non alza eccezioni per lo stesso motivo — una dentro
  // l'osservatore dell'accesso porterebbe via l'app intera.
  useEffect(() => {
    const ac = AC();
    if (!ac) return undefined;
    return ac.osserva((u) => {
      setUtente(u);
      if (u && ac.sincronizzaProfilo) ac.sincronizzaProfilo(u);
    });
  }, []);

  const stato = window.Auth ? window.Auth.stato(utente) : 'ospite';

  const pulisci = () => { setProblema(null); setFatto(null); };
  const chiudi = () => { setModo(''); setPassword(''); pulisci(); };

  // Ogni azione passa di qui: una sola strada per "occupato", per l'errore
  // tradotto e per il caso in cui Firebase non sia configurato affatto. Senza,
  // ogni tasto avrebbe il suo try/catch e uno di loro se lo dimenticherebbe.
  const prova = async (azione, dopo) => {
    const ac = AC();
    if (!ac || !ac.disponibile()) { setProblema('auth.senzaFirebase'); return false; }
    setOccupato(true);
    pulisci();
    try {
      await azione(ac);
      if (dopo) setFatto(dopo);
      return true;
    } catch (e) {
      // motivo() restituisce null quando non c'e' niente da dire (la finestra
      // di Google chiusa con la X e' un ripensamento, non un guasto).
      const chiave = window.Auth ? window.Auth.motivo(e) : 'auth.nonRiuscito';
      if (chiave) setProblema(chiave);
      return false;
    } finally {
      setOccupato(false);
    }
  };

  const entraConGoogle = () => prova((ac) => ac.conGoogle());

  const entraConEmail = async () => {
    if (!email.trim() || !password) { setProblema('auth.serveEmailEPassword'); return; }
    if (await prova((ac) => ac.entra(email, password))) chiudi();
  };

  const registrati = async () => {
    const dati = { nome, cognome, email, password };
    const problemi = window.Auth ? window.Auth.validaRegistrazione(dati) : [];
    // Si mostra il primo: un elenco di cinque righe rosse sotto una maschera
    // di quattro caselle e' piu' scoraggiante del problema che descrive.
    if (problemi.length) { setProblema(problemi[0]); setFatto(null); return; }
    if (await prova((ac) => ac.registra(dati))) { setPassword(''); setModo(''); setFatto('auth.controllaEmail'); }
  };

  const esci = () => prova((ac) => ac.esci());

  const reimposta = async () => {
    if (!email.trim()) { setProblema('auth.serveEmail'); return; }
    await prova((ac) => ac.reimposta(email), 'auth.emailReimpostaInviata');
  };

  const rimandaVerifica = () => prova((ac) => ac.inviaVerifica(), 'auth.emailVerificaInviata');

  // Firebase non si accorge da solo che l'utente ha cliccato il link: l'oggetto
  // in memoria resta "da verificare" finche' non lo si ricarica. Senza questo
  // tasto, chi verifica e torna nell'app pensa che non abbia funzionato.
  const controllaVerifica = () => prova((ac) => ac.ricarica());

  return {
    utente, stato, modo, setModo, nome, setNome, cognome, setCognome,
    email, setEmail, password, setPassword,
    problema, fatto, occupato, chiudi,
    entraConGoogle, entraConEmail, registrati, esci, reimposta,
    rimandaVerifica, controllaVerifica,
  };
};
