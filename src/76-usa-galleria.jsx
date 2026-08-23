// ---------- La galleria del campo ----------
//
// Le foto NON stanno in localStorage (cento foto lo farebbero scoppiare, e con
// esso il salvataggio di presenze e spese) e NON entrano nella fusione degli
// stati: vivono solo nel cloud. Si caricano a casa, con la linea.
//
// Secondo pezzo di stato che esce da App() (ROADMAP.md § 14), e il primo che
// conta: dodici variabili di stato, un riferimento, un ascolto sul cloud e
// dodici gestori che prima stavano in mezzo ai conti senza avere niente a che
// farci. La galleria e' l'area piu' facile da staccare proprio per questo —
// non tocca un euro.
//
// Come per le schede: e' un hook, non un componente. L'albero disegnato resta
// identico al carattere, ed e' cosi' che lo spostamento si dimostra.
//
// Riceve solo quello che non e' suo: la scheda aperta e lo stato della linea
// (per sapere quando mettersi in ascolto) e i giorni del campo (per il
// sottotitolo dell'album). Nient'altro di App() entra qui dentro.
const usaGalleria = ({ activeTab, cloudConnesso, campData }) => {
  const [photos, setPhotos] = useState([]);          // miniature, dal cloud
  const [photosReady, setPhotosReady] = useState(false);
  const [photoWho, setPhotoWho] = useState('');      // a nome di chi si carica
  const [photoBusy, setPhotoBusy] = useState('');    // messaggio di avanzamento
  const [viewPhoto, setViewPhoto] = useState(null);  // { id, by, at, full }
  const [album, setAlbum] = useState(null);          // album di un campo chiuso
  const [galleryView, setGalleryView] = useState('album'); // album | griglia
  const [albumPage, setAlbumPage] = useState(0);
  const albumRef = useRef(null);
  const [picking, setPicking] = useState(false);     // modalita' "scegli le foto"
  const [picked, setPicked] = useState([]);          // id scelti per il ricordo
  const [pdfBusy, setPdfBusy] = useState('');        // avanzamento della stampa
  const [photoCap, setPhotoCap] = useState(() => {
    const v = parseInt(localStorage.getItem(PHOTO_CAP_KEY), 10);
    return Number.isFinite(v) && v > 0 ? v : PHOTO_CAP_DEFAULT;
  });

  // Ci si mette in ascolto delle miniature SOLO mentre la galleria e' aperta:
  // altrimenti ogni avvio dell'app scaricherebbe l'intero album.
  useEffect(() => {
    if (activeTab !== 'galleria') { setPhotosReady(false); return undefined; }
    const CS = window.CloudSync;
    if (!CS || !CS.watchPhotos || !CS.isConnected()) { setPhotosReady(false); return undefined; }
    const stop = CS.watchPhotos((list) => { setPhotos(list); setPhotosReady(true); });
    return () => { if (typeof stop === 'function') stop(); };
  }, [activeTab, cloudConnesso]);

  const photosBy = (nome) => photos.filter((p) => p.by === nome).length;

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const chi = photoWho.trim();
    if (!chi) { window.alert('Scegli prima a nome di chi stai caricando le foto.'); return; }

    const CS = window.CloudSync;
    if (!CS || !CS.isConnected()) {
      window.alert('La galleria ha bisogno della linea: le foto si caricano al ritorno a casa, non al campo.');
      return;
    }

    const restanti = photoCap - photosBy(chi);
    if (restanti <= 0) {
      window.alert(`${chi} ha già caricato le sue ${photoCap} foto.\n\nPer farne entrare altre, cancellane qualcuna: si tocca la foto e poi "Elimina".`);
      return;
    }
    const daCaricare = files.slice(0, restanti);
    if (files.length > restanti) {
      window.alert(`${chi} può caricare ancora ${restanti} ${restanti === 1 ? 'foto' : 'foto'}: ne carico ${restanti} di ${files.length}.`);
    }

    let fatte = 0;
    for (let i = 0; i < daCaricare.length; i++) {
      setPhotoBusy(`Carico ${i + 1} di ${daCaricare.length}…`);
      try {
        // Due versioni: la miniatura per la griglia, l'originale per la
        // visione a schermo pieno. Entrambe devono stare sotto il limite di
        // 1 MB per documento di Firestore.
        const thumb = await compressImage(daCaricare[i], 320, 0.5);
        let full = await compressImage(daCaricare[i], 1400, 0.7);
        if (full.length > 900000) full = await compressImage(daCaricare[i], 1100, 0.55);
        if (full.length > 900000) full = await compressImage(daCaricare[i], 900, 0.45);
        const id = uid();
        if (await CS.putPhoto(id, thumb, full, chi)) fatte++;
      } catch (err) { /* foto illeggibile: si prosegue con le altre */ }
    }
    setPhotoBusy('');
    const rimaste = daCaricare.length - fatte;
    if (rimaste > 0) {
      window.alert(
        `${fatte} ${fatte === 1 ? 'foto caricata' : 'foto caricate'} su ${daCaricare.length}.\n\n` +
        `${rimaste === 1 ? 'Quella che manca è' : `Le altre ${rimaste} sono`} in coda: ` +
        'partono da sole appena la linea regge. Puoi chiudere l\'app, ma non prima che la spia ' +
        'in alto smetta di dire "da inviare": quella coda vive solo finché l\'app è aperta, ' +
        'e chiudendola prima le foto vanno riprese dal rullino.'
      );
    }
  };

  const openPhoto = async (p) => {
    setViewPhoto({ ...p, full: null });
    const CS = window.CloudSync;
    if (!CS || !CS.getPhotoFull) return;
    const full = await CS.getPhotoFull(p.id);
    // Se nel frattempo l'utente ha chiuso o cambiato foto, non sovrascrivere.
    setViewPhoto((cur) => (cur && cur.id === p.id ? { ...cur, full } : cur));
  };

  // ---------- Foto ricordo (PDF) ----------
  // La griglia ha solo le miniature: per la stampa servono gli originali, che
  // si scaricano uno a uno. Da qui l'avanzamento — e l'avviso quando sono
  // tante, perche' su una linea di montagna e' l'attesa a pesare, non il PDF.
  const TANTE_FOTO = 20;

  // Sotto una polaroid ci sta il nome, non "Nome Cognome".
  const soloNome = (chi) => (String(chi || '').trim().split(/\s+/)[0] || 'anonimo');

  // Album: quattro foto per pagina, come nel PDF.
  const PER_PAGINA_ALBUM = (window.PdfRicordo && window.PdfRicordo.PER_PAGINA) || 4;
  const paginaAlbum = (elenco) => {
    const out = [];
    for (let i = 0; i < elenco.length; i += PER_PAGINA_ALBUM) out.push(elenco.slice(i, i + PER_PAGINA_ALBUM));
    return out;
  };

  const sfoglia = (verso) => {
    const el = albumRef.current;
    if (!el) return;
    el.scrollBy({ left: verso * (el.clientWidth + 10), behavior: 'smooth' });
  };

  const onScrollAlbum = (e) => {
    const el = e.currentTarget;
    setAlbumPage(Math.round(el.scrollLeft / (el.clientWidth + 10)));
  };

  const togglePicked = (id) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const uscitaScelta = () => { setPicking(false); setPicked([]); };

  // tutte = l'album completo, in ordine di scatto: è il ricordo del campo, e
  // un campo si racconta dal primo giorno all'ultimo. Con la scelta a mano
  // l'ordine è invece quello con cui si tocca, che è una scelta di chi compone.
  const generaRicordo = async (elenco, tutte) => {
    const PDF = window.PdfRicordo;
    if (!PDF) { window.alert('Il generatore del ricordo non è disponibile.'); return; }
    const CS = window.CloudSync;
    if (!CS || !CS.isConnected()) { window.alert('Per creare il ricordo servono le foto originali, quindi la linea.'); return; }

    const scelte = tutte
      ? [...elenco].sort((a, b) => (a.at || 0) - (b.at || 0))
      : elenco.filter((p) => picked.includes(p.id));
    if (scelte.length === 0) { window.alert(tutte ? 'Non c\'è ancora nessuna foto nella galleria.' : 'Scegli almeno una foto.'); return; }
    // Le foto si scaricano a piena qualità una a una: con molte foto è una
    // cosa lunga, e su una linea che va e viene va detto prima di partire.
    if (scelte.length >= TANTE_FOTO) {
      const pagine = Math.ceil(scelte.length / PER_PAGINA_ALBUM);
      if (!window.confirm(
        `L'album completo ha ${scelte.length} foto (${pagine} pagine).\n\n` +
        'Le foto vengono scaricate una a una a piena qualità: con una linea debole ci vogliono ' +
        'diversi minuti e il PDF sarà pesante da mandare.\n\nVado avanti?'
      )) return;
    }

    try {
      const foto = [];
      for (let i = 0; i < scelte.length; i++) {
        setPdfBusy(`Scarico ${i + 1} di ${scelte.length}…`);
        const full = await CS.getPhotoFull(scelte[i].id);
        if (!full) continue;
        foto.push({
          dataUrl: full,
          // Solo il nome, come sotto le polaroid dell'album.
          didascalia: [scelte[i].by ? soloNome(scelte[i].by) : '', scelte[i].at ? new Date(scelte[i].at).toLocaleDateString('it-IT') : '']
            .filter(Boolean).join(' · '),
        });
      }
      if (foto.length === 0) { window.alert('Non sono riuscito a scaricare le foto: riprova con una linea migliore.'); return; }

      setPdfBusy('Compongo la pagina…');
      const r = intervalloCampo(campData);
      const bytes = PDF.crea({
        titolo: BRAND.appTitle,
        sottotitolo: r.from === r.to ? r.from : `${r.from} → ${r.to}`,
        motto: BRAND.footerMotto,
        foto,
      });

      const nome = `foto-ricordo-${toDateStr(new Date())}.pdf`;
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const file = new File([blob], nome, { type: 'application/pdf' });

      // Da telefono la condivisione è più utile del download: si manda nel
      // gruppo o si salva nei file con lo stesso gesto.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: BRAND.appTitle }); uscitaScelta(); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      uscitaScelta();
    } catch (e) {
      window.alert('Non sono riuscito a creare il ricordo: ' + (e && e.message ? e.message : e));
    } finally {
      setPdfBusy('');
    }
  };

  // Album di un campo chiuso: si scarica quando lo chiedi, non all'avvio.
  const openAlbum = async (a) => {
    const CS = window.CloudSync;
    if (!CS || !CS.listPhotos || !CS.isConnected()) {
      window.alert('Per rivedere l\'album di un campo chiuso serve la linea.');
      return;
    }
    setAlbum({ id: a.id, name: a.name, photos: [], loading: true });
    const list = await CS.listPhotos(a.id);
    setAlbum((cur) => (cur && cur.id === a.id ? { ...cur, photos: list, loading: false } : cur));
  };

  const removePhoto = async (p) => {
    if (!window.confirm(`Eliminare questa foto di ${p.by || 'anonimo'}?\nLibera un posto per un'altra.`)) return;
    const CS = window.CloudSync;
    if (CS && CS.deletePhoto) await CS.deletePhoto(p.id);
    setViewPhoto(null);
    // Nella galleria del campo in corso ci pensa l'ascolto; nell'album di un
    // campo chiuso, che è una lettura sola, va tolta a mano.
    setAlbum((cur) => (cur ? { ...cur, photos: cur.photos.filter((x) => x.id !== p.id) } : cur));
  };

  return {
    photos, photosReady, photoWho, setPhotoWho, photoBusy,
    viewPhoto, setViewPhoto, album, setAlbum,
    galleryView, setGalleryView, albumPage, albumRef,
    picking, setPicking, picked, setPicked, pdfBusy,
    photoCap, setPhotoCap,
    photosBy, addPhotos, openPhoto, removePhoto, openAlbum,
    PER_PAGINA_ALBUM, paginaAlbum, sfoglia, onScrollAlbum,
    togglePicked, uscitaScelta, generaRicordo, soloNome,
  };
};
