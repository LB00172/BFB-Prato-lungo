// ---------- Le foto degli scontrini ----------
//
// Terzo pezzo di stato che esce da App() (ROADMAP.md § 14), e il naturale
// seguito del § 19: le foto non stanno piu' in localStorage ma nel magazzino
// (IndexedDB), e tutto quello che serve a farle vivere — la migrazione dalla
// vecchia chiave, la scrittura del solo cambiamento, la potatura delle
// orfane, l'arrivo dal cloud, lo scatto — era sparso in mezzo ai conti.
//
// Riceve le tre liste che POSSONO avere uno scontrino. Servono a una cosa
// sola: sapere quali foto non appartengono piu' a niente. Se se ne dimentica
// una, le foto di quelle voci spariscono al primo giro — ed e' capitato.
const usaScontrini = ({ purchases, toBuy, equipment }) => {
  // Parte VUOTA e si riempie subito dopo, perche' il magazzino si legge in
  // modo asincrono. Prima si partiva da localStorage, che si legge di colpo:
  // comodo, ma erano 3,18 MB di foto dentro i 5 disponibili, e i conti
  // rischiavano di non avere piu' posto dove salvarsi.
  const [receipts, setReceipts] = useState({});
  const receiptsRef = useRef({});
  // Cosa risulta gia' scritto nel magazzino: serve a scrivere SOLO le foto
  // nuove invece di riversare ogni volta l'intera mappa.
  const receiptsSalvatiRef = useRef({});
  // Le scritture nel magazzino si mettono in fila. Due in volo insieme
  // vedrebbero lo stesso punto di partenza: aggiungi una foto e cancellala
  // subito dopo, e la cancellazione parte da uno stato in cui quella foto non
  // c'era ancora — resta nel magazzino per sempre.
  const codaMagazzinoRef = useRef(Promise.resolve());
  // Dove sono finite davvero le foto: nel magazzino o, se quello non e'
  // disponibile, nella memoria del telefono come prima. In modalita' tecnica
  // va detto, perche' cambia quanto spazio resta ai conti.
  const [fotoDove, setFotoDove] = useState('magazzino');
  // Foto scontrino in attesa di Salva, e foto aperta a schermo intero.
  const [pReceipt, setPReceipt] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);

  // All'avvio: si sposta la vecchia chiave di localStorage nel magazzino (una
  // volta sola, e solo se le foto si rileggono identiche) e si carica quello
  // che c'e'. Le foto gia' arrivate dal cloud nel frattempo hanno la
  // precedenza: sono le stesse, ma non ha senso sovrascriverle all'indietro.
  useEffect(() => {
    const MF = window.MagazzinoFoto;
    if (!MF) return;
    let vivo = true;
    codaMagazzinoRef.current = codaMagazzinoRef.current.then(() => MF.migra()).then((esito) => {
      if (!vivo) return;
      receiptsSalvatiRef.current = esito.mappa || {};
      setReceipts((prev) => ({ ...(esito.mappa || {}), ...prev }));
      setFotoDove(esito.ripiego || !MF.disponibile() ? 'memoria del telefono' : 'magazzino');
    });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    receiptsRef.current = receipts;
    const MF = window.MagazzinoFoto;
    if (!MF) return;
    codaMagazzinoRef.current = codaMagazzinoRef.current
      // Il punto di partenza si legge quando tocca a noi, non quando ci si
      // mette in coda: chi ci precede lo ha appena spostato.
      .then(() => MF.applica(receiptsSalvatiRef.current, receipts))
      .then((esito) => {
        // Il segnaposto si sposta SOLO a scrittura riuscita: segnarlo prima
        // vorrebbe dire che una scrittura fallita non viene piu' ritentata —
        // lo stesso errore gia' fatto con lastPushedJson in firebase-sync.js.
        if (esito.salvato) receiptsSalvatiRef.current = receipts;
        if (esito.ripiego) setFotoDove('memoria del telefono');
      })
      // Una scrittura andata male non deve rompere la fila: chi viene dopo
      // riparte dall'ultimo punto di partenza buono e riprova.
      .catch(() => { /* si riprova al prossimo cambiamento */ });
  }, [receipts]);

  // Pulizia: elimina le foto locali di voci che non esistono più (es. acquisto
  // cancellato da un altro dispositivo). Vanno considerate TUTTE le liste che
  // possono avere uno scontrino, altrimenti si perdono le foto delle voci
  // ancora da acquistare o dell'attrezzatura.
  useEffect(() => {
    setReceipts((prev) => {
      const ids = new Set([
        ...purchases.map((p) => p.id),
        ...toBuy.map((t) => t.id),
        ...equipment.map((e) => e.id),
      ]);
      const keys = Object.keys(prev);
      if (keys.every((k) => ids.has(k))) return prev;
      const copy = {};
      keys.forEach((k) => { if (ids.has(k)) copy[k] = prev[k]; });
      return copy;
    });
    // "receipts" fra le dipendenze e' voluto: le foto arrivano dal magazzino
    // DOPO il primo disegno, quindi al primo giro non c'e' ancora niente da
    // potare. Senza, la foto di una spesa cancellata altrove resterebbe nel
    // magazzino per sempre. Non fa cicli: quando non c'e' niente da togliere
    // la funzione restituisce lo stesso oggetto di prima.
  }, [purchases, toBuy, equipment, receipts]);

  // Foto scontrini in arrivo dal cloud: merge con le locali, e upload di
  // quelle presenti solo in locale (es. scattate prima della connessione).
  // Si aggancia una volta sola all'avvio, quindi legge dal riferimento e non
  // dallo stato: lo stato che vedrebbe sarebbe quello del primo disegno.
  const handleCloudReceipts = (cloudMap) => {
    const local = receiptsRef.current;
    const CS = window.CloudSync;
    Object.keys(local).forEach((id) => {
      if (!cloudMap[id] && CS && CS.isConnected()) CS.putReceipt(id, local[id]);
    });
    setReceipts((prev) => ({ ...prev, ...cloudMap }));
  };

  // Allega una foto scontrino a un id qualsiasi (voce da acquistare o acquisto
  // già registrato: le foto sono indicizzate per id).
  const attachReceiptTo = async (e, id) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      let dataUrl = await compressImage(file, 1000, 0.6);
      if (dataUrl.length > 900000) dataUrl = await compressImage(file, 800, 0.4);
      setReceipts((prev) => ({ ...prev, [id]: dataUrl }));
      if (window.CloudSync) window.CloudSync.putReceipt(id, dataUrl);
    } catch (err) {
      window.alert(L.t('scontrino.fotoIllegibile'));
    }
  };

  // La foto scattata nella maschera di registrazione: resta in attesa finche'
  // non si preme Salva, perche' prima l'acquisto non ha ancora un id.
  const onReceiptFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      // Comprimi; se ancora troppo grande per un documento Firestore (1MB),
      // ricomprimi più aggressivamente.
      let dataUrl = await compressImage(file, 1000, 0.6);
      if (dataUrl.length > 900000) dataUrl = await compressImage(file, 800, 0.4);
      setPReceipt(dataUrl);
    } catch (err) {
      window.alert(L.t('scontrino.fotoIllegibile'));
    }
  };

  return {
    receipts, setReceipts, fotoDove,
    pReceipt, setPReceipt, viewReceipt, setViewReceipt,
    handleCloudReceipts, attachReceiptTo, onReceiptFile,
  };
};
