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
// `scegliLingua` e' della App (la lingua e' sua): la registrazione la usa
// per mettere l'app nella lingua preferita appena scelta, e l'accesso per
// rimetterla su un telefono nuovo.
const usaAccount = ({ scegliLingua } = {}) => {
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
  // Le caselle della registrazione, oltre a quelle dell'accesso. Il paese e la
  // lingua partono da quello che dice il telefono e da quella dell'app: una
  // scelta gia' fatta e giusta si lascia com'e', una vuota si deve pensare.
  const [ripeti, setRipeti] = useState('');
  const [citta, setCitta] = useState('');
  const [paese, setPaese] = useState(() => (window.Auth && typeof navigator !== 'undefined' ? window.Auth.paeseDelTelefono(navigator.language) : ''));
  const [linguaPreferita, setLinguaPreferita] = useState('');
  // Una chiave del dizionario, non una frase: i messaggi li sceglie il disegno
  // (§ 18). null vuol dire che non c'e' niente da dire.
  const [problema, setProblema] = useState(null);
  // Un dato da mettere DENTRO il messaggio (i campi di cui sei proprietario,
  // quando la cancellazione si ferma). Quando manca, il messaggio riceve
  // l'indirizzo della pagina, che serve a quello del dominio non autorizzato.
  const [problemaDati, setProblemaDati] = useState(null);
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

  const pulisci = () => { setProblema(null); setProblemaDati(null); setFatto(null); };
  const chiudi = () => { setModo(''); setPassword(''); setRipeti(''); pulisci(); };

  // Entrando, la lingua preferita del profilo — se c'e', e se l'app parla
  // gia' un'altra lingua. Solo a un accesso fatto adesso, non a ogni
  // apertura: chi poi cambia lingua in Impostazioni non se la vede rimettere.
  const linguaDalProfilo = async (ac) => {
    if (!scegliLingua || !ac || !ac.leggiProfilo) return;
    const p = await ac.leggiProfilo();
    if (p && p.lingua && window.Lingue && window.Lingue.LINGUE[p.lingua] && p.lingua !== L.codice) scegliLingua(p.lingua);
  };

  // Ogni azione passa di qui: una sola strada per "occupato", per l'errore
  // tradotto e per il caso in cui Firebase non sia configurato affatto. Senza,
  // ogni tasto avrebbe il suo try/catch e uno di loro se lo dimenticherebbe.
  const prova = async (azione, dopo) => {
    const ac = AC();
    if (!ac || !ac.disponibile()) { setProblema('auth.senzaFirebase'); return false; }
    setOccupato(true);
    pulisci();
    try {
      // Si restituisce quello che l'azione restituisce — l'utente, per
      // conGoogle — o true se non restituisce niente. Chi controlla solo che
      // sia riuscita (if (await prova(...))) non vede differenze; "tieni il
      // tuo posto" invece ha bisogno di sapere CHI si e' diventati, per
      // rientrare nella stanza con l'uid giusto. Restituiva sempre true, e il
      // rientro partiva a nome di un utente che non esisteva.
      const esito = await azione(ac);
      if (dopo) setFatto(dopo);
      return esito || true;
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

  const entraConGoogle = () => prova(async (ac) => { const u = await ac.conGoogle(); await linguaDalProfilo(ac); return u; });

  // ---------- Cancellare l'account (ROADMAP § 3) ----------
  // Tre passi, e il primo decide se si fanno gli altri due:
  //
  //   1. le stanze da guardare: quelle che il profilo si e' segnato, piu'
  //      quella salvata su questo telefono (che copre chi e' entrato prima
  //      che il profilo cominciasse a segnarsele);
  //   2. se sei PROPRIETARIO di un campo, il campo passa al secondo
  //      capogruppo; se un secondo non c'e', ci si ferma e non si tocca
  //      niente: il campo resterebbe senza nessuno che lo amministri o lo
  //      possa cancellare (Stanza.pianoCancellazione);
  //   3. altrimenti si toglie la tua scheda dalle stanze, poi il profilo e
  //      l'account.
  //
  // Se qualcosa si rompe a meta' (la linea, o Firebase che chiede di
  // rientrare), rifarlo e' sicuro: ogni passo trova gia' fatto quello che
  // era stato fatto.
  const cancellaAccount = async (codiceLocale) => {
    const ac = AC();
    const sc = (typeof window !== 'undefined' && window.StanzaCloud) || null;
    const S = (typeof window !== 'undefined' && window.Stanza) || null;
    if (!ac || !ac.disponibile() || !ac.cancellaProfiloEAccount) { setProblema('auth.senzaFirebase'); return false; }
    setOccupato(true);
    pulisci();
    try {
      const dalProfilo = ac.stanzeDelProfilo ? await ac.stanzeDelProfilo() : [];
      const codici = dalProfilo.concat(codiceLocale ? [codiceLocale] : []);
      if (codici.length && sc && S) {
        const piano = S.pianoCancellazione(await sc.statoDi(codici, utente));
        if (piano.bloccata.length) {
          setProblema('auth.cancellaBloccata');
          setProblemaDati(piano.bloccata.map((c) => S.bello(c)).join(', '));
          return false;
        }
        // I campi con un secondo capogruppo passano a lui, prima di tutto il
        // resto: e' l'ordine di «Lascia il campo» (prima il passaggio, poi
        // la propria scheda), e si chiede prima di farlo.
        if (piano.daCedere.length) {
          const quali = piano.daCedere.map((c) => S.bello(c)).join(', ');
          if (typeof window !== 'undefined' && window.confirm && !window.confirm(L.t('auth.confermaCedi', quali))) return false;
          for (const c of piano.daCedere) await sc.lasciaAllAiutante(c, utente);
        }
        await sc.togliMe(piano.daTogliere, utente);
      }
      await ac.cancellaProfiloEAccount();
      setFatto('auth.accountCancellato');
      return true;
    } catch (e) {
      const chiave = window.Auth ? window.Auth.motivo(e) : 'auth.nonRiuscito';
      if (chiave) setProblema(chiave);
      return false;
    } finally {
      setOccupato(false);
    }
  };

  const entraConEmail = async () => {
    if (!email.trim() || !password) { setProblema('auth.serveEmailEPassword'); return; }
    if (await prova(async (ac) => { await ac.entra(email, password); await linguaDalProfilo(ac); })) chiudi();
  };

  const registrati = async () => {
    const lingua = linguaPreferita || L.codice;
    const dati = { nome, cognome, citta, paese, email, password, ripeti, lingua };
    const problemi = window.Auth ? window.Auth.validaRegistrazione(dati) : [];
    // Si mostra il primo: un elenco di cinque righe rosse sotto una maschera
    // di quattro caselle e' piu' scoraggiante del problema che descrive.
    if (problemi.length) { setProblema(problemi[0]); setFatto(null); return; }
    if (await prova((ac) => ac.registra(dati))) {
      setPassword(''); setRipeti(''); setModo(''); setFatto('auth.controllaEmail');
      if (scegliLingua && lingua !== L.codice) scegliLingua(lingua);
    }
  };

  const esci = () => prova((ac) => ac.esci());

  const reimposta = async () => {
    if (!email.trim()) { setProblema('auth.serveEmail'); return; }
    await prova((ac) => ac.reimposta(email, L.codice), 'auth.emailReimpostaInviata');
  };

  // Le email partono nella lingua dell'app: Firebase le traduce da se'.
  const rimandaVerifica = () => prova((ac) => ac.inviaVerifica(L.codice), 'auth.emailVerificaInviata');

  // Firebase non si accorge da solo che l'utente ha cliccato il link: l'oggetto
  // in memoria resta "da verificare" finche' non lo si ricarica. Senza questo
  // tasto, chi verifica e torna nell'app pensa che non abbia funzionato.
  const controllaVerifica = () => prova((ac) => ac.ricarica());

  return {
    utente, stato, modo, setModo, nome, setNome, cognome, setCognome,
    email, setEmail, password, setPassword, ripeti, setRipeti,
    citta, setCitta, paese, setPaese, linguaPreferita, setLinguaPreferita,
    problema, problemaDati, fatto, occupato, chiudi,
    entraConGoogle, entraConEmail, registrati, esci, reimposta, cancellaAccount,
    rimandaVerifica, controllaVerifica,
  };
};
