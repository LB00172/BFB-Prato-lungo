// ---------- La mia lista (4 ottobre, ROADMAP § 6) ----------
// La checklist privata: «cosa mi porto». Quella del gruppo c'e' gia', ed e'
// «Chi fa cosa»; questa e' di una persona sola.
//
// Il punto facile da sbagliare (ROADMAP § 6): «privata» non puo' essere una
// spunta su una voce dei dati del campo, perche' quei dati sono su ogni
// telefono e finiscono nell'esportazione — trapelerebbe in silenzio. Qui sta
// in una chiave sua sul telefono (cambusa_mia_lista, nel cassetto del campo)
// e, quando c'e' un uid e una stanza, nel cloud sotto il proprio uid
// (rooms/<codice>/personali/<uid>), che le regole fanno leggere solo a te.
// NON entra nello stato sincronizzato, ne' nell'esportazione, ne'
// nell'archivio.
//
// Fra telefono e cloud vince la copia piu' recente (Stanza.listaPiuRecente).
// Si apre senza linea: prima il telefono, poi il cloud se risponde.
const MIA_LISTA_KEY = 'cambusa_mia_lista';

const usaMiaLista = ({ codice, utente }) => {
  const [lista, setLista] = useState(() => {
    const v = load(MIA_LISTA_KEY, null);
    return v && Array.isArray(v.voci) ? v : { voci: [], at: 0 };
  });
  const [nuova, setNuova] = useState('');
  const [nelCloud, setNelCloud] = useState(false);
  const uid = utente && utente.uid;
  const sc = () => (FEATURES.rooms && window.StanzaCloud && window.StanzaCloud.leggiPersonale ? window.StanzaCloud : null);

  // scriviLocale e non setItem: con la memoria piena si perde la copia, non l'app.
  useEffect(() => { scriviLocale(MIA_LISTA_KEY, JSON.stringify(lista)); }, [lista]);

  // All'ingresso nel campo (e quando arriva l'account): si confrontano le due
  // copie e vince la piu' recente.
  const listaRef = useRef(lista);
  listaRef.current = lista;
  useEffect(() => {
    const c = sc();
    if (!c || !codice || !uid) return undefined;
    let vivo = true;
    (async () => {
      try {
        const remota = await c.leggiPersonale(codice, utente);
        if (!vivo) return;
        const chi = window.Stanza.listaPiuRecente(listaRef.current, remota);
        if (chi === 'remota') setLista({ voci: Array.isArray(remota.voci) ? remota.voci : [], at: Number(remota.at) || 0 });
        else if (chi === 'locale') await c.scriviPersonale(codice, utente, listaRef.current);
        if (vivo) setNelCloud(true);
      } catch (e) { /* senza linea: resta quella del telefono, e si riprova al prossimo ingresso */ }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codice, uid]);

  // Ogni cambiamento va su, un attimo dopo: chi spunta cinque cose di fila
  // non deve fare cinque scritture.
  const timer = useRef(null);
  const cambia = (fn) => {
    setLista((prev) => {
      const nuovo = { voci: fn(prev.voci), at: Date.now() };
      const c = sc();
      if (c && codice && uid) {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          c.scriviPersonale(codice, utente, nuovo).then(() => setNelCloud(true)).catch(() => {});
        }, 700);
      }
      return nuovo;
    });
  };

  const aggiungi = () => {
    const testo = nuova.trim();
    if (!testo) return;
    cambia((v) => [...v, { id: uid_(), testo, fatto: false }]);
    setNuova('');
  };
  const spunta = (id) => cambia((v) => v.map((x) => (x.id === id ? { ...x, fatto: !x.fatto } : x)));
  const togli = (id) => cambia((v) => v.filter((x) => x.id !== id));
  const togliFatte = () => {
    const n = lista.voci.filter((x) => x.fatto).length;
    if (!n || !window.confirm(L.t('miaLista.confermaTogliFatte', n))) return;
    cambia((v) => v.filter((x) => !x.fatto));
  };

  return { lista, nuova, setNuova, aggiungi, spunta, togli, togliFatte, nelCloud, privataNelCloud: !!(sc() && codice && uid) };
};

// L'id di una voce: lo stesso generatore del resto dell'app, che qui si
// chiama `uid` come l'utente — da cui il nome.
const uid_ = () => uid();
