function App() {
  const [locked, setLocked] = useState(() => !isUnlocked());
  const [lockReason, setLockReason] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('calendario');
  const [currentDate, setCurrentDate] = useState(() => parseDate(defaultDateStr()));
  const [selectedDateStr, setSelectedDateStr] = useState(defaultDateStr());

  const [members, setMembers] = useState(() => load('cambusa_members', []));
  const [campData, setCampData] = useState(() => load('cambusa_camp_data', {}));
  // Taccuino delle spese: ogni voce è un acquisto { id, name, price, type, at }.
  // I totali della scheda Spesa sono calcolati da qui.
  const [purchases, setPurchases] = useState(() => {
    const saved = load('cambusa_purchases', null);
    if (Array.isArray(saved)) return saved;
    // Migrazione una-tantum dai vecchi totali manuali, se presenti.
    const g = load('cambusa_global_expenses', null);
    const seed = [];
    if (g) {
      const mk = (amt, type, name) => {
        const n = Math.max(0, parseFloat(amt) || 0);
        if (n > 0) seed.push({ id: uid(), name, price: n, type, at: Date.now() });
      };
      mk(g.food, 'alimentare', 'Totale cibo (importato)');
      mk(g.drinks, 'bevande', 'Totale bevande (importato)');
      mk(g.accessory, 'logistica', 'Totale accessori (importato)');
    }
    return seed;
  });

  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberChild, setNewMemberChild] = useState(false);
  const [infoMember, setInfoMember] = useState(null); // membro con la scheda pagamenti aperta
  const [copied, setCopied] = useState('');            // ultima cosa copiata (feedback)
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pType, setPType] = useState('alimentare');
  const [pBuyer, setPBuyer] = useState('');
  const [pAccount, setPAccount] = useState('comune'); // conto della spesa in corso
  const [pReceipt, setPReceipt] = useState(null); // foto scontrino in attesa di Salva
  const [viewReceipt, setViewReceipt] = useState(null); // foto aperta a schermo intero
  const [snapList, setSnapList] = useState(null); // elenco snapshot per il ripristino
  // Giorno dell'ultimo backup su file (o del "ho già fatto"): serve al promemoria.
  const [backupOggi, setBackupOggi] = useState(() => localStorage.getItem(BACKUP_KEY) || '');
  const [spesaSection, setSpesaSection] = useState('totali'); // sotto-sezione attiva in Spesa
  const [guideOpen, setGuideOpen] = useState('calendario'); // pill aperta nella guida

  // Rimborsi segnati come "saldati" (solo barrati, non rimossi). Condivisi via sync.
  const [settled, setSettled] = useState(() => load('cambusa_settled', []));
  // Vista dei rimborsi: per cassa (spiega) oppure ottimizzata (si paga). E'
  // una scelta del singolo telefono, non del campo: non va in sincronia.
  const [saldiOttimizzati, setSaldiOttimizzati] = useState(() => load('cambusa_saldi_ottimizzati', false));

  // Cache meteo (Open-Meteo, 16 giorni). Aggiornata al massimo una volta all'ora.
  const [weather, setWeather] = useState(() => load('cambusa_weather', { fetchedAt: 0, byDate: {} }));

  // Foto scontrini: sincronizzate via Firestore (sotto-collezione dedicata,
  // un documento per foto) + copia locale in localStorage.
  const [receipts, setReceipts] = useState(() => load('cambusa_receipts', {}));
  const receiptsRef = useRef({});

  // Dotazioni aggiuntive (box editabile), condivise via sync.
  const [gear, setGear] = useState(() => load('cambusa_gear', []));
  const [newGearText, setNewGearText] = useState('');

  // Attrezzatura da acquistare: { id, text, price, bought }. Quelle spuntate
  // (acquistate) entrano nelle spese totali come logistica. Condivisa via sync.
  const [equipment, setEquipment] = useState(() => load('cambusa_equipment', []));

  // Lista "Da Acquistare": { id, name, qty }. Quando viene acquistata la voce
  // passa nella cronologia (diventa un acquisto con lo stesso id, così l'even-
  // tuale foto dello scontrino resta collegata).
  const [toBuy, setToBuy] = useState(() => load('cambusa_tobuy', []));
  // Conto separato: giorni le cui presenze fanno cassa a parte. Il cibo e le
  // bevande marcati "separato" si dividono solo sui pasti di questi giorni;
  // gli altri giorni restano nel conto comune. Vuoto = tutto in comune.
  const [sepDays, setSepDays] = useState(() => load('cambusa_sepdays', []));
  // Giorni gratis: le presenze restano (la cucina deve sapere per quanti
  // cucinare) ma non entrano in NESSUN conto — né nel divisore dei pasti né
  // fra i presenti per logistica e attrezzatura. Serve per la sera che offre
  // qualcuno o per la cena fuori pagata a parte.
  const [freeDays, setFreeDays] = useState(() => load('cambusa_freedays', []));
  // Blocchi: voci che congelano una parte dei dati. Per ora una sola, "conti",
  // che chiude la contabilità a fine campo. Si sincronizza come le altre liste.
  const [blocchi, setBlocchi] = useState(() => load('cambusa_blocchi', []));
  // Modifiche arrivate dagli altri DOPO la chiusura dei conti e respinte: non
  // si buttano in silenzio, si mettono da parte e si dicono.
  const [respinte, setRespinte] = useState([]);
  // Persone che un altro telefono ha eliminato mentre avevano presenze in un
  // giorno bloccato: rimesse in elenco, e lo si dice a chi guarda.
  const [membriSalvati, setMembriSalvati] = useState([]);

  const [newBuyName, setNewBuyName] = useState('');
  const [newBuyQty, setNewBuyQty] = useState('');
  const [buying, setBuying] = useState(null); // voce in fase di registrazione acquisto
  // La maschera di inserimento manuale è chiusa: da aprire quando serve, così
  // la cronologia degli acquisti resta subito sotto le due linguette.
  const [manualOpen, setManualOpen] = useState(false);
  // Voce in correzione (spesa o attrezzatura). Al campo si registra in fretta:
  // un prezzo sbagliato dev'essere correggibile senza cancellare e rifare,
  // che porterebbe via anche la foto dello scontrino.
  const [editing, setEditing] = useState(null);
  // Ricerca nella cronologia: con un centinaio di voci serve per ritrovarle.
  const [purchaseQuery, setPurchaseQuery] = useState('');
  const [toBuyQuery, setToBuyQuery] = useState('');
  const [listaSection, setListaSection] = useState('daacquistare'); // sotto-sezione Lista della Spesa

  // Campi chiusi e archiviati: restano consultabili e scaricabili, ma non
  // fanno più parte dei dati di lavoro.
  const [archives, setArchives] = useState(() => load('cambusa_archives', []));
  const [closing, setClosing] = useState(false);   // modale "Chiudi il campo"
  const [closeName, setCloseName] = useState('');
  const [viewArchive, setViewArchive] = useState(null); // resoconto aperto

  // ---------- Galleria del campo ----------
  // Le foto NON stanno in localStorage (100 foto lo farebbero scoppiare, e con
  // esso il salvataggio di presenze e spese) e NON entrano nella fusione degli
  // stati: vivono solo nel cloud. Si caricano a casa, con la linea.
  const [photos, setPhotos] = useState([]);          // miniature, dal cloud
  const [photosReady, setPhotosReady] = useState(false);
  const [photoWho, setPhotoWho] = useState('');      // a nome di chi si carica
  const [photoBusy, setPhotoBusy] = useState('');    // messaggio di avanzamento
  const [viewPhoto, setViewPhoto] = useState(null);  // { id, by, at, full }
  const [album, setAlbum] = useState(null);          // album di un campo chiuso
  // Ultima sincronizzazione che ha tolto delle voci: banner + annulla.
  const [lostSync, setLostSync] = useState(null);
  // Modifiche arrivate con una data nel futuro: qualcuno ha l'orologio avanti.
  const [orologioFuori, setOrologioFuori] = useState(() => load(OROLOGIO_KEY, null));
  // Ridisegna la diagnostica dopo che si butta la copia di scorta.
  const [diagTick, setDiagTick] = useState(0);
  // Presenze: le azioni "in blocco" stanno chiuse.
  const [azioniOpen, setAzioniOpen] = useState(false);
  // A chi riassegnare le presenze rimaste senza padrone (id orfano -> id membro).
  const [orfanoScelte, setOrfanoScelte] = useState({});
  // Impostazioni: le sezioni che si toccano una volta sola stanno chiuse.
  const [logOpen, setLogOpen] = useState(false);
  const [bloccoOpen, setBloccoOpen] = useState(false);
  const [datiOpen, setDatiOpen] = useState(false);
  // Modalità tecnica: attiva o no su QUESTO telefono. La scelta resta salvata,
  // così chi tiene i conti la accende una volta sola.
  const [admin, setAdmin] = useState(() => {
    try { return localStorage.getItem(ADMIN_KEY) === '1'; } catch (e) { return false; }
  });
  const [tecnicaOpen, setTecnicaOpen] = useState(false);
  const [adminPwd, setAdminPwd] = useState('');
  const [adminErr, setAdminErr] = useState('');

  // window.APP_ADMIN si legge al momento del controllo, non all'avvio: così
  // una configurazione mancante si può aggiungere senza rompere niente.
  const entraAdmin = async () => {
    const cfg = window.APP_ADMIN;
    if (!cfg || !cfg.hash) { setAdminErr('Modalità tecnica non configurata su questa installazione.'); return; }
    const im = await improntaPassword(adminPwd, cfg);
    if (im && im === cfg.hash) {
      try { localStorage.setItem(ADMIN_KEY, '1'); } catch (e) { /* resta accesa solo finché l'app è aperta */ }
      setAdmin(true);
      setAdminPwd('');
      setAdminErr('');
    } else {
      setAdminErr(im ? 'Password sbagliata.' : 'Serve https (o localhost) per verificare la password.');
    }
  };
  const esciAdmin = () => {
    try { localStorage.removeItem(ADMIN_KEY); } catch (e) { /* niente */ }
    setAdmin(false);
    setAdminPwd('');
    setAdminErr('');
  };
  const [sepOpen, setSepOpen] = useState(false);     // riga "Conto separato" aperta
  const [galleryView, setGalleryView] = useState('album'); // album | griglia
  const [albumPage, setAlbumPage] = useState(0);
  const albumRef = useRef(null);
  const [picking, setPicking] = useState(false);     // modalità "scegli le foto"
  const [picked, setPicked] = useState([]);          // id scelti per il ricordo
  const [pdfBusy, setPdfBusy] = useState('');        // avanzamento della stampa
  const [photoCap, setPhotoCap] = useState(() => {
    const v = parseInt(localStorage.getItem(PHOTO_CAP_KEY), 10);
    return Number.isFinite(v) && v > 0 ? v : PHOTO_CAP_DEFAULT;
  });

  // ---------- Mini gioco "Aiuta Bandy" ----------
  const [gamePlayer, setGamePlayer] = useState(() => localStorage.getItem('cambusa_player') || '');
  const [gameRunning, setGameRunning] = useState(false);
  const [gameBest, setGameBest] = useState(() => Number(load('cambusa_best', 0)) || 0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [newEquipText, setNewEquipText] = useState('');
  const [newEquipPrice, setNewEquipPrice] = useState('');
  const [newEquipBuyer, setNewEquipBuyer] = useState('');

  const [menuOpen, setMenuOpen] = useState(false);

  // ---------- Aspetto ----------
  const [theme, setTheme] = useState(readTheme);
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  useEffect(() => {
    // L'UNICO setItem dell'app dentro un effetto. Senza rete di sicurezza,
    // memoria piena qui vuol dire schermo bianco: l'eccezione risale a React e
    // smonta l'albero. E' la trappola in cui siamo gia' cascati una volta.
    scriviLocale(THEME_KEY, theme);
    setIsDark(applyTheme(theme));
    // Con "automatico" si segue il telefono anche se cambia mentre l'app è aperta.
    if (theme !== 'auto' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setIsDark(applyTheme('auto'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  // Blocco: "chiedi la password ogni volta che apro l'app".
  const [askAlways, setAskAlways] = useState(lockAlways);
  const toggleAskAlways = () => {
    const next = !askAlways;
    setAskAlways(next);
    if (next) {
      scriviLocale(LOCK_ALWAYS_KEY, '1');
      try { localStorage.removeItem(UNLOCK_KEY); } catch (e) { /* ignora */ }
    } else {
      localStorage.removeItem(LOCK_ALWAYS_KEY);
      if (LOCK && LOCK.hash) { try { localStorage.setItem(UNLOCK_KEY, LOCK.hash); } catch (e) { /* ignora */ } }
    }
  };
  const lockNow = (reason) => {
    forgetUnlock();
    sessionPassword = null;
    setLockReason(typeof reason === 'string' ? reason : '');
    // Stacca anche la sincronizzazione: al rientro si riparte dalla password
    // appena digitata, che è quella che apre il database con l'utente del
    // campo. Senza questo si resterebbe agganciati con l'accesso di ripiego.
    if (window.CloudSync && window.CloudSync.isConnected()) window.CloudSync.disconnect();
    setMenuOpen(false);
    setLocked(true);
  };

  // Suggerimento installazione PWA: mostrato finché l'app non è installata
  // (o finché l'utente non lo chiude). Su iOS l'installazione è solo manuale.
  const [showInstallHint, setShowInstallHint] = useState(() => {
    const standalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
    return !standalone && !localStorage.getItem('cambusa_install_hint_off');
  });
  const dismissInstallHint = () => {
    scriviLocale('cambusa_install_hint_off', '1');
    setShowInstallHint(false);
  };
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // Desktop = puntatore fine e nessun touch primario: cambia solo i testi
  // delle istruzioni, non la grafica.
  const isDesktop = !/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

  // Chiusura del menu laterale con Esc (comodo da tastiera).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ---------- Stato sincronizzazione cloud (Firebase) ----------
  const [cloud, setCloud] = useState({ connected: false, status: 'idle', code: null, lastSync: null, error: null });
  const [campCodeInput, setCampCodeInput] = useState((typeof window !== 'undefined' && window.CAMP_CODE_DEFAULT) || '');
  const cloudConnectedRef = useRef(false);
  const suppressPushRef = useRef(false);

  // Stato sincronizzato sempre aggiornato: serve alla fusione, che deve
  // partire dai dati di ADESSO e non da quelli di quando ci si è connessi.
  const syncStateRef = useRef(null);
  syncStateRef.current = { members, campData, purchases, gear, settled, equipment, toBuy, sepDays, freeDays, blocchi };

  // Cronologia delle modifiche (data di ultima modifica/cancellazione per ogni
  // voce). Al primo avvio i dati già presenti restano "senza data": qualsiasi
  // modifica altrui, essendo datata, ha la precedenza.
  const spazioPienoRef = useRef(false);
  // Stato com'era prima dell'ultima modifica: serve alle copie di sicurezza.
  const statoPrecedenteRef = useRef(null);
  const metaRef = useRef(null);
  if (metaRef.current === null) {
    const saved = load(SYNC_META_KEY, null);
    const SM = window.SyncMerge;
    // "hi" va riletto: è l'orologio logico, cioè la data più alta che questo
    // telefono ha mai visto. Perdendolo a ogni riapertura, un telefono con
    // l'ora indietro tornava a marcare le proprie modifiche con date vecchie e
    // a perdere confronti che doveva vincere.
    metaRef.current = saved && saved.rev
      ? { flat: saved.flat || {}, rev: saved.rev, del: saved.del || {}, hi: saved.hi || 0 }
      : { flat: SM ? SM.flatten(syncStateRef.current) : {}, rev: {}, del: {}, hi: 0 };
  }
  // Se il salvataggio della cronologia fallisce (memoria del telefono piena),
  // alla riapertura le modifiche di questo telefono risulterebbero "senza
  // data" e perderebbero ogni confronto. È un guasto silenzioso: va detto.
  const [spazioPieno, setSpazioPieno] = useState(false);
  // La cronologia è il pezzo di localStorage che NON si può perdere: senza,
  // questo telefono riparte "senza date" e qualsiasi cancellazione altrui gli
  // porta via delle voci. Vale più di tutto il resto che sta lì dentro, quindi
  // se lo spazio manca si sacrifica il resto — prima le copie di sicurezza
  // vecchie, poi il registro — e si riprova.
  const saveMeta = (m) => {
    metaRef.current = m;
    const testo = JSON.stringify(m);
    const sacrifici = [
      () => {
        const tutte = snapLocaliLeggi();
        const chiavi = Object.keys(tutte).sort();
        if (chiavi.length === 0) return false;
        delete tutte[chiavi[0]];
        try { localStorage.setItem(SNAP_KEY, JSON.stringify(tutte)); } catch (e) { localStorage.removeItem(SNAP_KEY); }
        return true;
      },
      () => { localStorage.removeItem(SNAP_KEY); return true; },
      () => { localStorage.removeItem(LOG_KEY); return true; },
    ];
    for (let i = 0; i <= sacrifici.length; i++) {
      try {
        localStorage.setItem(SYNC_META_KEY, testo);
        if (spazioPienoRef.current) { spazioPienoRef.current = false; setSpazioPieno(false); }
        return;
      } catch (e) {
        if (i === sacrifici.length || !sacrifici[i]()) break;
      }
    }
    if (!spazioPienoRef.current) { spazioPienoRef.current = true; setSpazioPieno(true); }
  };

  // ---------- Persistenza ----------
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Salvataggio dei dati sul telefono. Se la memoria è piena, setItem SOLLEVA
  // un'eccezione: lasciata scappare da dentro un effetto, React smonta tutta
  // l'app (schermata bianca) e gli effetti successivi — fra cui la datazione
  // delle modifiche e l'invio agli altri — non partono nemmeno. Si prende, si
  // libera spazio dove si può e lo si dice, ma l'app resta in piedi.
  const salvaLocale = (chiave, valore) => {
    try { localStorage.setItem(chiave, JSON.stringify(valore)); }
    catch (e) {
      try { localStorage.removeItem(SNAP_KEY); localStorage.setItem(chiave, JSON.stringify(valore)); }
      catch (e2) { if (!spazioPienoRef.current) { spazioPienoRef.current = true; setSpazioPieno(true); } }
    }
  };
  useEffect(() => salvaLocale('cambusa_members', members), [members]);
  useEffect(() => salvaLocale('cambusa_camp_data', campData), [campData]);
  useEffect(() => salvaLocale('cambusa_purchases', purchases), [purchases]);
  useEffect(() => salvaLocale('cambusa_gear', gear), [gear]);
  useEffect(() => salvaLocale('cambusa_settled', settled), [settled]);
  useEffect(() => salvaLocale('cambusa_saldi_ottimizzati', saldiOttimizzati), [saldiOttimizzati]);
  useEffect(() => salvaLocale('cambusa_equipment', equipment), [equipment]);
  useEffect(() => salvaLocale('cambusa_tobuy', toBuy), [toBuy]);
  useEffect(() => salvaLocale('cambusa_sepdays', sepDays), [sepDays]);
  useEffect(() => salvaLocale('cambusa_freedays', freeDays), [freeDays]);
  useEffect(() => salvaLocale('cambusa_blocchi', blocchi), [blocchi]);
  useEffect(() => salvaLocale('cambusa_weather', weather), [weather]);
  useEffect(() => {
    try { localStorage.setItem('cambusa_archives', JSON.stringify(archives)); }
    catch (e) { console.warn('Spazio esaurito: l\'archivio resta nel cloud e nei file scaricati.'); }
  }, [archives]);

  // ---------- Meteo ----------
  // Servizio: Open-Meteo (gratuito, senza chiave), modello ICON per l'Europa,
  // 16 giorni, fuso orario della località. Le previsioni sono UNA SOLA per
  // tutto il campo: chi ha linea le scarica e le mette nel cloud, gli altri
  // le ricevono. Prima ogni telefono scaricava per conto suo in momenti
  // diversi e si vedevano numeri diversi.
  const [wxBusy, setWxBusy] = useState(false);
  const weatherRef = useRef(weather);
  useEffect(() => { weatherRef.current = weather; }, [weather]);

  const fetchWeather = (force) => {
    const loc = window.CAMP_LOCATION;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return;
    if (!navigator.onLine) return;
    // L'età va misurata, non sottratta e basta: se la previsione in cache è
    // datata nel futuro (orologio sballato, nostro o di chi l'ha spedita) la
    // differenza viene negativa, cade sotto l'ora di attesa e il meteo non si
    // aggiorna più. Una foto col futuro addosso è sempre da rifare.
    const eta = Date.now() - (weatherRef.current.fetchedAt || 0);
    if (!force && eta >= 0 && eta < 60 * 60 * 1000) return;
    setWxBusy(true);
    // Se in firebase-config.js c'è l'altitudine del campo la si passa: senza,
    // Open-Meteo usa la quota media della sua cella (~1 km di lato), e in
    // montagna qualche centinaio di metri di differenza vale gradi veri.
    const quota = typeof loc.alt === 'number' ? `&elevation=${loc.alt}` : '';
    // Oltre ai massimi giornalieri si chiede la MISURA della pioggia
    // (millimetri e ore) e la previsione oraria, da cui si ricava com'e' fatta
    // la giornata. La probabilita' giornaliera di Open-Meteo e' quella dell'ora
    // peggiore: da sola fa sembrare un pomeriggio di temporali un giorno perso.
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}`
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_probability_mean,precipitation_sum,precipitation_hours'
      + '&hourly=weather_code,precipitation_probability'
      + `&timezone=auto&forecast_days=16${quota}`)
      .then((r) => r.json())
      .then((j) => {
        const d = j && j.daily;
        if (!d || !Array.isArray(d.time)) return;
        // Le ore, raggruppate per data. Servono solo a formaDelGiorno: nel dato
        // salvato non entrano.
        const perData = {};
        const h = j.hourly;
        if (h && Array.isArray(h.time)) {
          h.time.forEach((t, i) => {
            const g = String(t).slice(0, 10);
            if (!perData[g]) perData[g] = [];
            perData[g].push({
              ora: Number(String(t).slice(11, 13)),
              code: h.weather_code ? h.weather_code[i] : null,
              p: h.precipitation_probability ? h.precipitation_probability[i] : null,
            });
          });
        }
        const num = (a, i) => (Array.isArray(a) && typeof a[i] === 'number' ? a[i] : null);
        const byDate = {};
        d.time.forEach((t, i) => {
          byDate[t] = Object.assign({
            code: d.weather_code[i],
            tmax: d.temperature_2m_max[i],
            tmin: d.temperature_2m_min[i],
            rain: d.precipitation_probability_max[i],
            rmed: num(d.precipitation_probability_mean, i),
            mm: num(d.precipitation_sum, i),
            oreP: num(d.precipitation_hours, i),
          }, formaDelGiorno(perData[t]));
        });
        // "stampa" è la data messa da chi ha scaricato, così com'è: serve solo
        // a riconoscere la nostra eco di ritorno dal cloud. "fetchedAt" è la
        // data di cui ci si fida, ed è quella limitata da quandoMeteo.
        const ora = Date.now();
        // La quota che il modello ha usato davvero. È l'unico modo di
        // accorgersi che stiamo guardando il meteo del paese invece che quello
        // del prato: se qui compaiono 850 metri e il campo sta a 1100, i gradi
        // sono di un altro posto. Si vede solo in modalità tecnica.
        const next = {
          fetchedAt: ora, stampa: ora, byDate, lat: loc.lat, lon: loc.lon,
          quota: typeof j.elevation === 'number' ? j.elevation : null,
        };
        setWeather(next);
        // Condivide la stessa previsione con tutto il campo.
        if (window.CloudSync && window.CloudSync.putWeather) window.CloudSync.putWeather(next);
      })
      .catch(() => { /* offline o API non raggiungibile: resta la cache */ })
      .finally(() => setWxBusy(false));
  };

  useEffect(() => {
    fetchWeather(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, selectedDateStr]);

  // Previsioni in arrivo da un altro dispositivo: si adottano se più recenti
  // delle nostre, così tutti guardano gli stessi numeri.
  const handleCloudWeather = (remote, serverMs) => {
    if (!remote || typeof remote.fetchedAt !== 'number' || !remote.byDate) return;
    // La nostra stessa previsione che ci torna indietro dal cloud: stessa
    // foto, niente da fare. Senza questo controllo la data limitata a "adesso"
    // risulterebbe sempre un filo più nuova e ci si riscriverebbe addosso.
    if (remote.stampa && remote.stampa === weatherRef.current.stampa) return;
    const quando = quandoMeteo(remote, serverMs);
    if (quando <= (weatherRef.current.fetchedAt || 0)) return;
    const next = Object.assign({}, remote, { fetchedAt: quando, stampa: remote.fetchedAt });
    weatherRef.current = next;
    setWeather(next);
  };
  useEffect(() => {
    receiptsRef.current = receipts;
    try {
      localStorage.setItem('cambusa_receipts', JSON.stringify(receipts));
    } catch (e) {
      console.warn('localStorage pieno: le foto restano comunque nella cache di Firestore.');
    }
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
  }, [purchases, toBuy, equipment]);

  useEffect(() => {
    const on = () => {
      setIsOnline(true);
      // Al ritorno della linea, se non siamo connessi (e la sync non è stata
      // disattivata a mano), riconnette da solo col codice salvato o predefinito.
      const CS = window.CloudSync;
      const optedOut = localStorage.getItem('cambusa_sync_optout') === '1';
      if (CS && CS.isConfigured() && !cloudConnectedRef.current && !optedOut) {
        const code = CS.savedCode() || window.CAMP_CODE_DEFAULT || '';
        if (code) CS.connect(window.FIREBASE_CONFIG, code, applyRemote, { password: sessionPassword }).catch(() => {});
      }
    };
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Sincronizzazione cloud ----------
  // Arrivano i dati di un altro dispositivo: si FONDONO con i nostri voce per
  // voce (vedi sync-merge.js). Senza questa fusione, due telefoni che hanno
  // lavorato offline al campo si cancellerebbero il lavoro a vicenda: il
  // secondo che torna online sovrascriverebbe tutto.
  const applyRemote = (remote) => {
    const SM = window.SyncMerge;
    const rmeta = remote && remote._meta;
    const local = syncStateRef.current;

    if (!SM) return;

    const remoteState = { ...remote };
    delete remoteState._meta;

    // Dati senza cronologia (telefono fermo a una versione vecchia dell'app):
    // NON si prendono per buoni. Entrano nella fusione come voci "di data
    // ignota", quindi qualsiasi modifica datata — di chiunque — ha la
    // precedenza, e le voci che quel telefono non ha non vengono cancellate
    // (per cancellare serve una lapide, e lui non ne produce). Prima qui si
    // sovrascriveva tutto: bastava un telefono rimasto indietro per riportare
    // l'intero campo a giorni prima.
    const metaRemota = (rmeta && rmeta.v === SM.VERSION)
      ? rmeta
      : SM.emptyMeta();

    // Orologi: si guarda la data più alta che arriva. Se è avanti di giorni
    // rispetto a questo telefono, uno dei due ha l'ora sbagliata — e chi ce
    // l'ha avanti sta vincendo tutti i confronti senza saperlo.
    if (rmeta && (rmeta.rev || rmeta.del)) {
      let piuAlta = 0;
      [rmeta.rev, rmeta.del].forEach((m) => {
        if (!m) return;
        Object.keys(m).forEach((k) => { if (typeof m[k] === 'number' && m[k] > piuAlta) piuAlta = m[k]; });
      });
      const avanti = piuAlta - Date.now();
      if (avanti > OROLOGIO_SOGLIA) {
        const v = { avanti, at: Date.now() };
        setOrologioFuori(v);
        try { localStorage.setItem(OROLOGIO_KEY, JSON.stringify(v)); } catch (e) { /* niente */ }
      }
    }

    const res = SM.merge(local, metaRef.current, remoteState, metaRemota, Date.now());

    // FRENO DI SICUREZZA. Una fusione può togliere voci solo se dall'altra
    // parte c'è una cancellazione datata; è legittimo (qualcuno ha cancellato
    // una spesa), ma è anche il modo in cui un ripristino, un'importazione o
    // una spunta sbagliata cancellano il lavoro di tutti. Prima di applicarla
    // si mette da parte una copia di scorta, e se le voci perse sono tante lo
    // si dice, con un tasto per annullare.
    // Registro: cosa è cambiato per effetto di questa sincronizzazione.
    const primaFlat = SM.flatten(local);
    logScrivi(diffFlat(primaFlat, res.meta.flat), 'cloud');

    const perse = Object.keys(primaFlat).filter((p) => !(p in res.meta.flat));
    if (perse.length > 0) {
      // QUANDO sono state cancellate, non solo quante. È la differenza fra due
      // situazioni opposte che prima venivano annunciate allo stesso modo:
      //   - qualcuno sta cancellando ADESSO -> va fermato, ed è un allarme;
      //   - questo telefono era indietro e sta venendo a sapere ora di
      //     cancellazioni fatte giorni fa -> non manca niente a nessuno, è
      //     soltanto il recupero del ritardo, e gridare al disastro per un
      //     membro tolto tre giorni fa (che porta con sé le sue presenze di
      //     tutti i giorni: un solo gesto, sette "voci") è un falso allarme.
      const quando = perse.map((p) => SM.quandoCancellata(p, metaRef.current, metaRemota));
      const piuRecente = Math.max(0, ...quando);
      const fresche = perse.filter((p, i) => piuRecente - quando[i] <= RAFFICA);
      const eta = Date.now() - piuRecente;

      try {
        localStorage.setItem(RESCUE_KEY, JSON.stringify({
          at: Date.now(), perse: perse.length, paths: perse.slice(0, 200),
          quando: piuRecente, state: local, meta: metaRef.current,
        }));
      } catch (e) { /* spazio esaurito: si prosegue senza scorta */ }

      // Si avvisa solo per le cancellazioni recenti, e si contano quelle dello
      // stesso gesto: le lapidi di una raffica portano tutte lo stesso istante.
      if (fresche.length >= 3 && eta <= PERDITA_RECENTE) {
        setLostSync({ n: fresche.length, at: Date.now(), quando: piuRecente, che: descriviPerdite(fresche, local) });
      }
    }
    // Se il risultato è già identico a quello ricevuto non c'è niente da
    // rimandare indietro; altrimenti il push riporta all'altro ciò che gli manca.
    suppressPushRef.current = SM.sameAs(res.meta, remoteState, rmeta);
    // I blocchi vincono su quello che arriva. Un giorno chiuso rimette i suoi
    // pasti com'erano; a conti chiusi, spese e attrezzatura tornano a com'erano
    // alla chiusura. Le correzioni vengono poi ripubblicate, così i blocchi
    // valgono su tutti i telefoni e non solo su questo.
    const conBlocchi = applicaBloccoConti(res.state);
    if (conBlocchi.respinte.length) setRespinte((prev) => [...conBlocchi.respinte, ...prev].slice(0, 40));
    const cdBloccata = applicaBlocchi(res.state.campData);
    const conMembri = applicaBlocchiMembri(res.state.members, cdBloccata);
    if (conMembri.salvati.length) setMembriSalvati((prev) => [...conMembri.salvati, ...prev].slice(0, 20));
    setMembers(conMembri.members);
    setCampData(cdBloccata);
    setPurchases(conBlocchi.stato.purchases);
    setGear(res.state.gear);
    setSettled(res.state.settled);
    setEquipment(conBlocchi.stato.equipment);
    setToBuy(res.state.toBuy);
    const giorni = applicaBlocchiGiorni(cdBloccata, res.state.freeDays, res.state.sepDays);
    setSepDays(giorni.sepDays);
    setFreeDays(giorni.freeDays);
    setBlocchi(res.state.blocchi);
    saveMeta(res.meta);
    setTimeout(() => { suppressPushRef.current = false; }, 0);
  };

  // ---------- Sostituzioni in blocco (ripristino, importazione) ----------
  // Un ripristino e un'importazione non "aggiungono": rimpiazzano lo stato, e
  // tutto ciò che c'era e non c'è più diventa una cancellazione datata che
  // parte verso TUTTI i telefoni. È l'operazione più pericolosa dell'app, e
  // finora chi la faceva era l'unico a non avere una via d'uscita: la copia di
  // scorta si salvava solo su chi RICEVEVA il disastro.
  // Qui si conta il danno PRIMA di chiedere conferma, e si mette da parte la
  // copia di scorta anche su questo telefono.
  const perditeSeApplico = (nuovo) => {
    const SM = window.SyncMerge;
    if (!SM) return [];
    const prima = SM.flatten(syncStateRef.current);
    const dopo = SM.flatten(nuovo);
    return Object.keys(prima).filter((p) => !(p in dopo));
  };

  const scortaPrimaDi = (perse) => {
    if (!perse.length) return;
    try {
      localStorage.setItem(RESCUE_KEY, JSON.stringify({
        at: Date.now(), perse: perse.length, paths: perse.slice(0, 200),
        quando: Date.now(), state: syncStateRef.current, meta: metaRef.current,
      }));
    } catch (e) { /* spazio esaurito: si prosegue senza scorta */ }
    setLostSync(null);
    setDiagTick((t) => t + 1);
  };

  // Frase da mettere nella conferma: dice cosa sparirà, in italiano.
  const avvisoPerdite = (perse) => {
    if (!perse.length) return 'Non sparisce nessuna voce: il ripristino aggiunge soltanto.';
    const che = descriviPerdite(perse, syncStateRef.current);
    return `ATTENZIONE: spariranno ${perse.length} voci da TUTTI i telefoni` +
      (che ? `\n(${che})` : '') +
      '\n\nSi potrà annullare da Impostazioni → Diagnostica.';
  };

  // Il registro come file di testo: comodo da mandare quando si deve capire
  // cosa è successo, senza doverlo leggere sullo schermo del telefono.
  const esportaRegistro = () => {
    const st = syncStateRef.current;
    const righe = logLeggi().map((r) => [
      new Date(r.at).toLocaleString('it-IT'),
      r.o === 'io' ? 'questo telefono' : 'sincronizzazione',
      r.k === 'd' ? 'cancellata' : 'modificata',
      sezioneDiPath(r.p),
      descriviPath(r.p, st),
      r.p,
    ].join('\t'));
    const testo = `Registro modifiche — ${BRAND.appTitle}\nGenerato il ${new Date().toLocaleString('it-IT')}\n\n` +
      'Data e ora\tOrigine\tAzione\tSezione\tVoce\tPercorso\n' + righe.join('\n') + '\n';
    const blob = new Blob([testo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registro-${toDateStr(new Date())}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // Annulla l'ultima sincronizzazione che ha tolto delle voci: rimette lo stato
  // di prima e lo ripubblica. Le voci che tornano vengono ridatate ad ADESSO,
  // quindi vincono sulle cancellazioni che le avevano tolte, su tutti i
  // telefoni. È la via d'uscita quando un ripristino o un'importazione
  // sbagliata cancella il lavoro di tutti.
  const annullaSync = () => {
    const r = load(RESCUE_KEY, null);
    if (!r || !r.state) { window.alert('Non c\'è nessuna copia di scorta da ripristinare.'); return; }
    const quando = new Date(r.at).toLocaleString('it-IT');
    if (!window.confirm(
      `Annullare la sincronizzazione del ${quando}?\n\n` +
      `${r.perse === 1 ? 'Tornerà 1 voce che era sparita' : `Torneranno ${r.perse} voci che erano sparite`}, e la copia di prima verrà ` +
      'ripubblicata su TUTTI i dispositivi.\n\n' +
      'Le modifiche fatte dopo, da chiunque, restano.'
    )) return;
    const s = r.state;
    setMembers(Array.isArray(s.members) ? s.members : []);
    setCampData(applicaBlocchi(s.campData && typeof s.campData === 'object' ? s.campData : {}));
    setPurchases(Array.isArray(s.purchases) ? s.purchases : []);
    setGear(Array.isArray(s.gear) ? s.gear : []);
    setSettled(Array.isArray(s.settled) ? s.settled : []);
    setEquipment(Array.isArray(s.equipment) ? s.equipment : []);
    setToBuy(Array.isArray(s.toBuy) ? s.toBuy : []);
    setSepDays(Array.isArray(s.sepDays) ? s.sepDays : []);
    setFreeDays(Array.isArray(s.freeDays) ? s.freeDays : []);
    setBlocchi(Array.isArray(s.blocchi) ? s.blocchi : []);
    setLostSync(null);
    localStorage.removeItem(RESCUE_KEY);
    window.alert('Fatto: fra qualche secondo i dati tornano anche sugli altri telefoni.');
  };

  const connectCloud = async (code) => {
    const CS = window.CloudSync;
    if (!CS || !CS.isConfigured()) {
      window.alert('Firebase non è configurato. Incolla la config del tuo progetto in firebase-config.js.');
      return;
    }
    const c = (code || '').trim();
    if (!c) { window.alert('Inserisci il codice del campo.'); return; }
    localStorage.removeItem('cambusa_sync_optout'); // riattiva l'auto-connessione
    try {
      await CS.connect(window.FIREBASE_CONFIG, c, applyRemote, { password: sessionPassword });
    } catch (e) {
      window.alert('Connessione fallita: ' + (e && e.message ? e.message : e));
    }
  };

  const disconnectCloud = () => {
    // Scelta esplicita: niente riconnessione automatica finché non si riattiva.
    scriviLocale('cambusa_sync_optout', '1');
    if (window.CloudSync) window.CloudSync.disconnect();
  };

  // Foto scontrini in arrivo dal cloud: merge con le locali, e upload di
  // quelle presenti solo in locale (es. scattate prima della connessione).
  const handleCloudReceipts = (cloudMap) => {
    const local = receiptsRef.current;
    const CS = window.CloudSync;
    Object.keys(local).forEach((id) => {
      if (!cloudMap[id] && CS && CS.isConnected()) CS.putReceipt(id, local[id]);
    });
    setReceipts((prev) => ({ ...prev, ...cloudMap }));
  };

  // All'avvio: aggancia lo stato e si connette DA SOLO col codice campo
  // (salvato o predefinito). Chi ha premuto Disconnetti resta fuori finché
  // non riattiva manualmente (flag cambusa_sync_optout).
  useEffect(() => {
    const CS = window.CloudSync;
    if (!CS) return;
    CS.onStatus((s) => { cloudConnectedRef.current = s.connected; setCloud(s); });
    if (CS.onReceipts) CS.onReceipts(handleCloudReceipts);
    if (CS.onWeather) CS.onWeather(handleCloudWeather);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La connessione parte DOPO lo sblocco: la password appena digitata serve
  // anche per entrare nel database con l'utente condiviso.
  useEffect(() => {
    if (locked) return;
    const CS = window.CloudSync;
    if (!CS) return;
    const optedOut = localStorage.getItem('cambusa_sync_optout') === '1';
    const code = CS.savedCode() || window.CAMP_CODE_DEFAULT || '';
    if (code && CS.isConfigured() && !optedOut && !CS.isConnected()) {
      setCampCodeInput(code);
      CS.connect(window.FIREBASE_CONFIG, code, applyRemote, { password: sessionPassword }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  // Se il database è protetto dall'utente condiviso ma questo telefono si è
  // agganciato con l'accesso di ripiego (capita a chi era già sbloccato da
  // prima), la password serve e l'app la chiede DA SOLA, una volta: nessuno
  // deve sapere che esiste un utente, un menu o un pulsante da premere.
  const dbAskedRef = useRef(false);
  useEffect(() => {
    const lock = window.APP_LOCK || {};
    if (!lock.dbEmail || !lock.hash) return;
    if (locked || dbAskedRef.current) return;
    if (cloud.authMode !== 'anon-nopass') return;
    dbAskedRef.current = true;
    lockNow('Per sincronizzare con gli altri serve di nuovo la password del campo. È la stessa di sempre.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud.authMode, locked]);

  // Ogni modifica viene datata (anche offline: è proprio lì che serve, perché
  // al ritorno della linea si sappia cosa è più recente) e poi inviata.
  // Se offline, Firestore mette la scrittura in coda e la invia da solo.
  useEffect(() => {
    const SM = window.SyncMerge;
    const st = syncStateRef.current;

    // Prima la cronologia, poi la copia di sicurezza: se la memoria è al limite
    // deve restare fuori la copia, non le date delle modifiche. Al contrario —
    // com'era prima — una copia da qualche decina di KB poteva prendersi gli
    // ultimi byte liberi e far fallire il salvataggio della cronologia: alla
    // riapertura questo telefono ripartiva "senza date" e la prima
    // sincronizzazione gli portava via le voci cancellate dagli altri.
    // La datazione si fa SEMPRE, anche subito dopo una fusione. Prima si
    // saltava quando la fusione aveva appena scritto la cronologia, e c'era un
    // buco: se una spunta finiva nello stesso giro di disegno di un
    // aggiornamento in arrivo — cosa che con quindici persone online capita —
    // quella spunta restava SENZA DATA, e la prima volta che qualcun altro
    // toccava la stessa presenza spariva senza lasciare traccia.
    // Farla sempre non costa nulla: se non è cambiato niente rispetto a quanto
    // la fusione ha appena salvato, bump non trova differenze e non tocca nulla.
    let mioCambiamento = false;
    if (SM) {
      const prima = metaRef.current.flat || {};
      const nuovo = SM.bump(st, metaRef.current, Date.now());
      mioCambiamento = !SM.equalMap(prima, nuovo.flat);
      // Registro: cosa ha cambiato QUESTO telefono.
      logScrivi(diffFlat(prima, nuovo.flat), 'io');
      saveMeta(nuovo);
    }

    // Copia di sicurezza locale della fascia (mattina/pomeriggio). Si salva lo
    // stato PRECEDENTE, non quello appena modificato: la copia deve contenere
    // com'erano le cose all'inizio della mezza giornata, cioè il punto a cui
    // si vuole tornare. Salvando quello attuale ci finirebbe dentro anche la
    // modifica che ha fatto scattare la copia.
    const ora = new Date();
    snapLocaleSalva(statoPrecedenteRef.current || st, snapFascia(ora), ora.getTime());
    statoPrecedenteRef.current = st;

    if (!cloudConnectedRef.current) return;
    // Si tace solo se questo giro non ha aggiunto niente di nostro: quello che
    // è appena arrivato dal cloud non va rimandato indietro. Ma se in mezzo
    // c'era anche una nostra modifica, quella deve partire.
    if (suppressPushRef.current && !mioCambiamento) return;
    const m = metaRef.current;
    if (window.CloudSync) {
      window.CloudSync.pushState({ ...st, _meta: { v: SM ? SM.VERSION : 0, rev: m.rev, del: m.del, hi: m.hi || 0 } });
    }
  }, [members, campData, purchases, gear, settled, equipment, toBuy, sepDays, freeDays, blocchi]);

  // ---------- Rete di sicurezza della sincronizzazione ----------
  // Tre casi in cui i dati resterebbero fermi su un telefono senza che nessuno
  // se ne accorga, chiusi qui:
  //   1. nel cloud non c'è ancora niente per questo campo: chi ha dati locali
  //      deve pubblicarli, altrimenti aspettano che qualcuno tocchi qualcosa;
  //   2. una scrittura è fallita (regole, quota, rete a singhiozzo): va
  //      ritentata da sola, non alla prossima modifica;
  //   3. l'app è rimasta aperta a lungo: un controllo periodico verifica che
  //      non ci sia rimasto niente in sospeso.
  useEffect(() => {
    const CS = window.CloudSync;
    if (!CS || !cloud.connected) return undefined;

    const pubblica = (forza) => {
      const SM = window.SyncMerge;
      const m = metaRef.current;
      CS.pushState({ ...syncStateRef.current, _meta: { v: SM ? SM.VERSION : 0, rev: m.rev, del: m.del, hi: m.hi || 0 } }, forza);
    };

    // 1) Campo vuoto nel cloud: pubblica quello che abbiamo.
    if (cloud.empty) {
      const st = syncStateRef.current;
      const qualcosa = (st.members || []).length || (st.purchases || []).length ||
        (st.toBuy || []).length || (st.equipment || []).length || Object.keys(st.campData || {}).length;
      if (qualcosa) pubblica(true);
    }

    // 2 e 3) Ritenta ciò che è rimasto in sospeso, subito e poi ogni due minuti.
    if (CS.riprova) CS.riprova();
    const t = window.setInterval(() => {
      if (!CS.isConnected()) return;
      if (CS.inSospeso && CS.inSospeso()) { CS.riprova(); return; }
      pubblica(false);   // no-op se è già tutto allineato
    }, 120000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud.connected, cloud.empty]);

  // ---------- Dati per giorno ----------
  const getDayData = (dateStr) => ({ ...initialDayState(), ...(campData[dateStr] || {}) });

  const updateDayData = (dateStr, field, value) => {
    setCampData((prev) => ({
      ...prev,
      [dateStr]: { ...(prev[dateStr] || {}), [field]: value },
    }));
  };

  // ---------- Presenze bloccate ----------
  // Quando un giorno è chiuso, le sue presenze non si toccano più: né col dito
  // né da una sincronizzazione. Il blocco si porta dietro una COPIA dei pasti
  // (`bloccato.meals`) e quella copia è l'unica verità: è un solo valore, con
  // una sua data, quindi si fonde come qualsiasi altra voce e tutti i telefoni
  // arrivano allo stesso risultato. Se un aggiornamento in arrivo cambia i
  // pasti di un giorno bloccato, l'app li rimette com'erano e ripubblica la
  // correzione, così il blocco vale davvero ovunque e non solo qui.
  const giornoBloccato = (dateStr) => {
    const b = (campData[dateStr] || {}).bloccato;
    return b && typeof b === 'object' ? b : null;
  };

  // Rimette a posto i pasti dei giorni bloccati. Restituisce lo stesso oggetto
  // se non c'era niente da correggere, così non si scatenano giri a vuoto.
  const applicaBlocchi = (cd) => {
    let toccato = false;
    const out = {};
    Object.keys(cd || {}).forEach((d) => {
      const day = cd[d];
      out[d] = day;
      const b = day && day.bloccato;
      if (!b || typeof b !== 'object' || !b.meals) return;
      if (JSON.stringify(day.meals || {}) === JSON.stringify(b.meals)) return;
      out[d] = { ...day, meals: { ...b.meals } };
      toccato = true;
    });
    return toccato ? out : cd;
  };

  // Applica una nuova mappa di pasti tenendo allineata la copia bloccata:
  // le riparazioni d'identità (doppioni, presenze orfane) devono valere anche
  // sui giorni chiusi, altrimenti quelle presenze sparirebbero dai conti.
  const conBlocco = (day, meals) => (day.bloccato && typeof day.bloccato === 'object'
    ? { ...day, meals, bloccato: { ...day.bloccato, meals } }
    : { ...day, meals });

  // ---------- Il blocco protegge il giorno, non solo la sua riga ----------
  // Le quote non escono dai pasti: escono da pasti PER membri. Congelare i
  // pasti e lasciare libero l'elenco dei membri vuol dire promettere che quel
  // giorno non cambia e poi lasciarlo cambiare lo stesso — basta eliminare una
  // persona, o dichiararla bambina, e le quote di quel giorno si riscrivono
  // tutte. Il blocco, per valere qualcosa, deve fermare anche questo.
  const giorniBloccatiDi = (id) => Object.keys(campData).filter((d) => {
    const b = (campData[d] || {}).bloccato;
    const v = b && typeof b === 'object' && b.meals && b.meals[String(id)];
    return !!(v && (v.lunch || v.dinner));
  }).sort();

  // Guardia per i tasti che toccano un membro: dice di no e spiega quali
  // giorni lo trattengono.
  const membroIntoccabile = (id, azione) => {
    const g = giorniBloccatiDi(id);
    if (!g.length) return false;
    const m = members.find((x) => x.id === id);
    window.alert(
      `${m ? m.name : 'Questa persona'}: ${azione} non è possibile.\n\n` +
      `Ha presenze in ${g.length === 1 ? 'un giorno con le presenze bloccate' : `${g.length} giorni con le presenze bloccate`} ` +
      `(${g.map(nomeGiorno).join(', ')}). Cambiarla adesso riscriverebbe le quote di quei giorni, ` +
      'che invece devono restare come sono.\n\n' +
      'Se serve davvero, prima sblocca quei giorni dalla scheda Presenze.'
    );
    return true;
  };

  // Stessa difesa sul versante sincronizzazione: se un altro telefono elimina
  // una persona che ha presenze in un giorno bloccato, l'eliminazione si
  // respinge e la persona torna in elenco. Si ripesca prima dalla fotografia
  // dentro il blocco (è la più fedele a quel giorno), poi da quello che
  // abbiamo ancora noi. La correzione viene poi ripubblicata, quindi torna
  // anche sul telefono che l'aveva tolta.
  const applicaBlocchiMembri = (elenco, cd) => {
    const protetti = new Set();
    const congelati = new Map();
    Object.keys(cd || {}).forEach((d) => {
      const b = (cd[d] || {}).bloccato;
      if (!b || typeof b !== 'object' || !b.meals) return;
      Object.keys(b.meals).forEach((id) => {
        const v = b.meals[id];
        if (v && (v.lunch || v.dinner)) protetti.add(String(id));
      });
      (Array.isArray(b.membri) ? b.membri : []).forEach((m) => {
        if (m && m.id != null && !congelati.has(String(m.id))) congelati.set(String(m.id), m);
      });
    });
    if (!protetti.size) return { members: elenco, salvati: [] };
    const ci = new Set((elenco || []).map((m) => String(m && m.id)));
    const torna = [];
    protetti.forEach((id) => {
      if (ci.has(id)) return;
      const dal = congelati.get(id) || (syncStateRef.current.members || []).find((m) => m && String(m.id) === id);
      if (dal) torna.push({ ...dal });
    });
    if (!torna.length) return { members: elenco, salvati: [] };
    return { members: [...(elenco || []), ...torna], salvati: torna.map((m) => m.name || '—') };
  };

  // Terzo versante: COME quel giorno entra nei conti. "Gratis per tutti" e
  // "conto separato" non toccano nemmeno una presenza, ma spostano soldi
  // esattamente quanto toccarle — e "conto separato" lo può premere chiunque
  // dal Calendario, senza modalità tecnica. Il blocco fotografa anche quei due
  // interruttori e li rimette com'erano. I blocchi vecchi non hanno la
  // fotografia: si riconoscono da `gratis` mancante e si lasciano stare.
  const applicaBlocchiGiorni = (cd, free, sep) => {
    let f = Array.isArray(free) ? free : [];
    let s = Array.isArray(sep) ? sep : [];
    const cambiati = [];
    Object.keys(cd || {}).forEach((d) => {
      const b = (cd[d] || {}).bloccato;
      if (!b || typeof b !== 'object' || b.gratis === undefined) return;
      if (f.includes(d) !== !!b.gratis) {
        f = b.gratis ? [...f, d].sort() : f.filter((x) => x !== d);
        cambiati.push(d);
      }
      if (s.includes(d) !== !!b.separato) {
        s = b.separato ? [...s, d].sort() : s.filter((x) => x !== d);
        cambiati.push(d);
      }
    });
    return { freeDays: f, sepDays: s, cambiati };
  };

  // Una sostituzione in blocco (ripristino, importazione) non "aggiunge":
  // rimpiazza. Se i dati che entrano non hanno i blocchi che abbiamo adesso,
  // quei giorni tornano modificabili e le loro presenze cambiano — in
  // silenzio. Non si vieta (a volte il ripristino serve proprio a questo), ma
  // si dice prima, con i giorni per nome.
  const bloccatiInPericolo = (nuovo) => {
    const dopo = (nuovo && nuovo.campData) || {};
    return Object.keys(campData).filter((d) => {
      const b = (campData[d] || {}).bloccato;
      if (!b || typeof b !== 'object') return false;
      const nb = (dopo[d] || {}).bloccato;
      return !nb || JSON.stringify(nb.meals || {}) !== JSON.stringify(b.meals || {});
    }).sort();
  };

  const avvisoBlocchi = (nuovo) => {
    const g = bloccatiInPericolo(nuovo);
    if (!g.length) return '';
    return `\n\nATTENZIONE: ${g.length === 1 ? 'un giorno con le presenze bloccate' : `${g.length} giorni con le presenze bloccate`} ` +
      `(${g.map(nomeGiorno).join(', ')}) ${g.length === 1 ? 'verrà sbloccato o cambiato' : 'verranno sbloccati o cambiati'}. ` +
      'Le quote di quei giorni possono cambiare.';
  };

  // Guardia per i due interruttori del giorno.
  const giornoIntoccabile = (dateStr, azione) => {
    if (!giornoBloccato(dateStr)) return false;
    window.alert(
      `${nomeGiorno(dateStr)}: ${azione} non è possibile.\n\n` +
      'Le presenze di questo giorno sono bloccate, e questo interruttore ne cambierebbe le quote.\n\n' +
      'Se serve davvero: sblocca il giorno qui in Presenze, cambia, e ribloccalo.'
    );
    return true;
  };

  const giornoGratis = (dateStr) => (freeDays || []).includes(dateStr);

  const chiediGiornoGratis = (dateStr) => {
    if (giornoIntoccabile(dateStr, 'cambiare "giorno gratis"')) return;
    const gia = giornoGratis(dateStr);
    const meals = (campData[dateStr] || {}).meals || {};
    const quanti = Object.values(meals).filter((v) => v && (v.lunch || v.dinner)).length;
    if (gia) {
      if (!window.confirm(
        `Rimettere ${nomeGiorno(dateStr)} nei conti?\n\n` +
        'I pasti di quel giorno tornano a contare nelle quote di tutti.'
      )) return;
    } else if (!window.confirm(
      `Rendere ${nomeGiorno(dateStr)} gratis per tutti?\n\n` +
      `I pasti di quel giorno (${quanti} ${quanti === 1 ? 'persona' : 'persone'}) restano segnati per la cucina, ` +
      'ma escono da TUTTI i conti: nessuno li paga, e chi è venuto solo quel giorno non deve niente.\n\n' +
      'Attenzione: la spesa già registrata non sparisce. Se hai comprato del cibo per quel giorno, ' +
      'quel costo si divide sugli altri giorni e le quote degli altri salgono. Serve quando quel ' +
      'giorno lo ha offerto qualcuno o si è mangiato fuori a spese proprie.'
    )) return;
    setFreeDays((prev) => (gia ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()));
  };

  const bloccaGiorno = (dateStr) => {
    const meals = (campData[dateStr] || {}).meals || {};
    const n = Object.values(meals).filter((v) => v && (v.lunch || v.dinner)).length;
    if (!window.confirm(
      `Bloccare le presenze di ${nomeGiorno(dateStr)}?\n\n` +
      `Restano congelate così come sono adesso (${n} ${n === 1 ? 'persona' : 'persone'} con almeno un pasto). ` +
      'Da quel momento non si toccano più: né dai tasti, né da quello che arriva dagli altri telefoni.\n\n' +
      'Si può sbloccare da qui, in modalità tecnica.'
    )) return;
    setCampData((prev) => {
      const day = { ...(prev[dateStr] || {}) };
      const copia = { ...(day.meals || {}) };
      // Nel blocco entra anche la scheda di chi ha mangiato quel giorno: se
      // qualcuno viene eliminato altrove, è da qui che lo si rimette a posto
      // con i suoi attributi veri (adulto o bambino su tutti), invece di
      // ricostruirlo a occhio e sbagliare i conti nel modo opposto.
      const dentro = Object.keys(copia).filter((id) => copia[id] && (copia[id].lunch || copia[id].dinner));
      const schede = members.filter((m) => dentro.includes(String(m.id))).map((m) => ({ ...m }));
      return { ...prev, [dateStr]: { ...day, meals: copia, bloccato: {
        at: Date.now(), meals: copia, membri: schede,
        gratis: giornoGratis(dateStr), separato: (sepDays || []).includes(dateStr),
      } } };
    });
  };

  const sbloccaGiorno = (dateStr) => {
    if (!window.confirm(
      `Sbloccare le presenze di ${nomeGiorno(dateStr)}?\n\n` +
      'Tornano modificabili da tutti, e riprendono a sincronizzarsi.'
    )) return;
    setCampData((prev) => {
      const day = { ...(prev[dateStr] || {}) };
      const b = day.bloccato;
      if (b && typeof b === 'object' && b.meals) day.meals = { ...b.meals };
      delete day.bloccato;
      return { ...prev, [dateStr]: day };
    });
  };

  // ---------- Conti chiusi ----------
  // Il gemello del blocco delle presenze, ma per i soldi — e serve DOPO il
  // campo, quando la gente comincia a pagarsi.
  // Il problema: i passaggi di pareggio sono segnati come saldati con una
  // chiave che contiene l'importo (`Anna→Bruno@4530`). Basta che qualcuno
  // aggiunga uno scontrino dimenticato o corregga un prezzo, e TUTTI gli
  // importi si ricalcolano: le chiavi non combaciano più, e i bonifici già
  // fatti spariscono dall'elenco come se non fossero mai avvenuti. Chi aveva
  // pagato risulta di nuovo debitore, con cifre diverse.
  // Chiudendo i conti, spese e attrezzatura si congelano: quello che arriva
  // dopo viene respinto e messo da parte, invece di rimescolare i pagamenti.
  const bloccoConti = () => (blocchi || []).find((b) => b && b.id === 'conti') || null;

  const chiudiConti = () => {
    const giorniAperti = Object.keys(campData).filter((d) => {
      const meals = (campData[d] || {}).meals || {};
      return Object.values(meals).some((v) => v && (v.lunch || v.dinner)) && !(campData[d] || {}).bloccato;
    });
    if (!window.confirm(
      'Chiudere i conti del campo?\n\n' +
      `Spese e attrezzatura si congelano (${purchases.length} spese, ${money(totals.overallTotal)} €), ` +
      `e le presenze dei giorni ancora aperti vengono bloccate (${giorniAperti.length}).\n\n` +
      'Da quel momento gli importi di "chi paga chi" non cambiano più, così i rimborsi già ' +
      'segnati come saldati restano validi. Quello che arriva dopo dagli altri telefoni viene ' +
      'messo da parte e te lo si dice.\n\n' +
      'Si può riaprire da qui, in modalità tecnica.'
    )) return;
    const adesso = Date.now();
    // Prima i giorni: le quote dipendono dalle presenze quanto dalle spese.
    if (giorniAperti.length) {
      setCampData((prev) => {
        const out = { ...prev };
        giorniAperti.forEach((d) => {
          const day = { ...(out[d] || {}) };
          const copia = { ...(day.meals || {}) };
          out[d] = { ...day, meals: copia, bloccato: { at: adesso, meals: copia } };
        });
        return out;
      });
    }
    setBlocchi((prev) => [
      ...prev.filter((b) => !b || b.id !== 'conti'),
      { id: 'conti', at: adesso, purchases: purchases.map((x) => ({ ...x })), equipment: equipment.map((x) => ({ ...x })) },
    ]);
    setRespinte([]);
  };

  const riapriConti = () => {
    if (!window.confirm(
      'Riaprire i conti?\n\n' +
      'Spese e attrezzatura tornano modificabili, e gli importi di "chi paga chi" ' +
      'si ricalcolano: i rimborsi già segnati come saldati potrebbero non combaciare più.\n\n' +
      'Le presenze restano bloccate: si sbloccano una per una dalla scheda Presenze.'
    )) return;
    setBlocchi((prev) => prev.filter((b) => !b || b.id !== 'conti'));
    setRespinte([]);
  };

  // Rimette spese e attrezzatura come stavano alla chiusura, e riporta cosa è
  // stato respinto. Le foto degli scontrini non si toccano: quelle possono
  // sempre arrivare.
  const applicaBloccoConti = (stato) => {
    const b = (stato.blocchi || []).find((x) => x && x.id === 'conti');
    if (!b || !Array.isArray(b.purchases)) return { stato, respinte: [] };
    const fuori = [];
    const confronta = (attuali, congelate, che) => {
      const per = new Map(congelate.map((x) => [String(x.id), x]));
      (attuali || []).forEach((x) => {
        if (!x || x.id == null) return;
        const vecchia = per.get(String(x.id));
        if (!vecchia) fuori.push({ che, azione: 'aggiunta', nome: x.name || x.text || '—', quanto: posNum(x.price) });
        else if (JSON.stringify(vecchia) !== JSON.stringify(x)) fuori.push({ che, azione: 'modificata', nome: x.name || x.text || '—', quanto: posNum(x.price) });
      });
      const ora = new Set((attuali || []).map((x) => String(x && x.id)));
      congelate.forEach((x) => {
        if (!ora.has(String(x.id))) fuori.push({ che, azione: 'cancellata', nome: x.name || x.text || '—', quanto: posNum(x.price) });
      });
    };
    confronta(stato.purchases, b.purchases, 'spesa');
    confronta(stato.equipment, b.equipment || [], 'attrezzatura');
    if (fuori.length === 0) return { stato, respinte: [] };
    return {
      stato: { ...stato, purchases: b.purchases.map((x) => ({ ...x })), equipment: (b.equipment || []).map((x) => ({ ...x })) },
      respinte: fuori,
    };
  };

  // Guardia per i tasti: dice di no e spiega perché.
  const contiChiusi = (azione) => {
    if (!bloccoConti()) return false;
    window.alert(
      `I conti del campo sono chiusi: ${azione} non è possibile.\n\n` +
      'Serve per non far cambiare gli importi dei rimborsi già in corso. ' +
      'Per modificare, riapri i conti da Spese Totali → Dati (modalità tecnica).'
    );
    return true;
  };

  const getMeal = (dateStr, memberId) => {
    const day = campData[dateStr];
    return (day && day.meals && day.meals[memberId]) || { lunch: false, dinner: false };
  };

  const toggleMeal = (dateStr, memberId, mealType) => {
    if (giornoBloccato(dateStr)) return;
    setCampData((prev) => {
      const day = { ...(prev[dateStr] || {}) };
      const meals = { ...(day.meals || {}) };
      const cur = meals[memberId] || { lunch: false, dinner: false };
      meals[memberId] = { ...cur, [mealType]: !cur[mealType] };
      return { ...prev, [dateStr]: { ...day, meals } };
    });
  };

  // Segna (o toglie) TUTTI i membri a pranzo/cena per il giorno: se sono già
  // tutti segnati, li toglie tutti; altrimenti li segna tutti.
  const setAllMeals = (dateStr, mealType) => {
    if (members.length === 0) return;
    if (giornoBloccato(dateStr)) return;
    setCampData((prev) => {
      const day = { ...(prev[dateStr] || {}) };
      const meals = { ...(day.meals || {}) };
      const allOn = members.every((m) => meals[m.id] && meals[m.id][mealType]);
      members.forEach((m) => {
        const cur = meals[m.id] || { lunch: false, dinner: false };
        meals[m.id] = { ...cur, [mealType]: !allOn };
      });
      return { ...prev, [dateStr]: { ...day, meals } };
    });
  };

  // ---------- Presenze rimaste senza padrone ----------
  // Le presenze sono legate all'ID del membro, non al nome. Chi viene eliminato
  // e riaggiunto prende un id nuovo: le sue vecchie presenze restano appese al
  // vecchio, spariscono dall'elenco e dai conti senza che nessuno se ne accorga.
  // È esattamente il modo in cui i pasti "svaniscono" pur avendo l'elenco
  // membri giusto. Qui si trovano e si riattaccano alla persona giusta.
  const presenzeOrfane = () => {
    const vivi = new Set(members.map((m) => m.id));
    const ex = exMembri();
    const per = new Map();
    Object.keys(campData).forEach((d) => {
      const meals = (campData[d] && campData[d].meals) || {};
      Object.keys(meals).forEach((id) => {
        if (vivi.has(id)) return;
        const v = meals[id];
        if (!v || (!v.lunch && !v.dinner)) return;  // voce a zero: non è una presenza
        const cur = per.get(id) || { id, nome: ex[id] || '', pasti: 0, giorni: [] };
        cur.pasti += (v.lunch ? 1 : 0) + (v.dinner ? 1 : 0);
        cur.giorni.push(d);
        per.set(id, cur);
      });
    });
    return [...per.values()].sort((a, b) => b.pasti - a.pasti);
  };

  const riassegnaOrfane = (orfano, nuovoId) => {
    const dest = members.find((m) => m.id === nuovoId);
    if (!dest) { window.alert('Scegli a chi assegnarle.'); return; }
    const chi = orfano.nome ? `di ${orfano.nome}` : 'senza padrone';
    if (!window.confirm(
      `Assegnare a ${dest.name} le ${orfano.pasti} presenze ${chi}?\n\n` +
      `Riguardano ${orfano.giorni.length} ${orfano.giorni.length === 1 ? 'giorno' : 'giorni'}. ` +
      'Se in quei giorni ha già dei pasti segnati, si sommano (non si perde niente).'
    )) return;
    setCampData((prev) => {
      const out = { ...prev };
      Object.keys(out).forEach((d) => {
        const day = out[d];
        if (!day || !day.meals || !day.meals[orfano.id]) return;
        const meals = { ...day.meals };
        const vecchio = meals[orfano.id] || {};
        const attuale = meals[nuovoId] || { lunch: false, dinner: false };
        meals[nuovoId] = { lunch: !!(attuale.lunch || vecchio.lunch), dinner: !!(attuale.dinner || vecchio.dinner) };
        delete meals[orfano.id];
        // Anche sui giorni bloccati: rimettere una presenza sulla persona
        // giusta non cambia CHI ha mangiato, e se la si saltasse quella
        // presenza sparirebbe dai conti.
        out[d] = conBlocco(day, meals);
      });
      return out;
    });
    setOrfanoScelte((prev) => { const n = { ...prev }; delete n[orfano.id]; return n; });
  };

  // ---------- Stessa persona inserita due volte ----------
  // Non è un difetto della fusione: è la fusione che funziona e produce un
  // risultato sbagliato. Due telefoni offline che aggiungono "Anna Rossi"
  // creano due membri con id diversi, ed entrambi sono voci nuove legittime:
  // nessuna regola può scartarne una. Il controllo che c'è all'inserimento non
  // può vederlo, perché in quel momento l'elenco dell'altro non è ancora
  // arrivato.
  // Il danno non è estetico: Anna entra DUE VOLTE nel divisore delle quote,
  // quindi sbagliano i conti di tutti, e le sue presenze si dividono fra i due
  // id. Va trovato e unito.
  const nomeChiave = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const membriDoppi = () => {
    const per = new Map();
    members.forEach((m) => {
      const k = nomeChiave(m.name);
      if (!k) return;
      per.set(k, (per.get(k) || []).concat([m]));
    });
    return [...per.values()].filter((g) => g.length > 1);
  };

  // Pasti segnati per un id, su tutti i giorni: serve a decidere quale delle
  // due schede tenere (si tiene quella con più roba attaccata).
  const pastiDi = (id) => {
    let n = 0;
    Object.keys(campData).forEach((d) => {
      const v = ((campData[d] || {}).meals || {})[id];
      if (v) n += (v.lunch ? 1 : 0) + (v.dinner ? 1 : 0);
    });
    return n;
  };

  const unisciDoppi = (gruppo) => {
    // Si tiene la scheda con più presenze; a parità, quella che ha i dati di
    // pagamento; a parità ancora, la prima.
    const ordinati = [...gruppo].sort((a, b) => {
      const d = pastiDi(b.id) - pastiDi(a.id);
      if (d) return d;
      const pa = (a.paypal || a.iban) ? 1 : 0;
      const pb = (b.paypal || b.iban) ? 1 : 0;
      return pb - pa;
    });
    const tengo = ordinati[0];
    const butto = ordinati.slice(1);
    const pasti = butto.reduce((s, m) => s + pastiDi(m.id), 0);
    if (!window.confirm(
      `"${tengo.name}" è in elenco ${gruppo.length} volte.\n\n` +
      'Succede quando due telefoni senza linea aggiungono la stessa persona: ' +
      'per i conti diventano due persone diverse, e la quota sbaglia per tutti.\n\n' +
      `Unendole resta una scheda sola${pasti ? `, e le ${pasti} presenze segnate sull'altra si sommano a queste` : ''}. ` +
      'Non si perde niente.'
    )) return;

    // Le presenze delle schede scartate si SOMMANO a quelle della tenuta: chi
    // ha segnato il pranzo su una e la cena sull'altra deve ritrovarsi con
    // entrambi.
    setCampData((prev) => {
      const out = { ...prev };
      Object.keys(out).forEach((d) => {
        const day = out[d];
        if (!day || !day.meals) return;
        if (!butto.some((m) => day.meals[m.id])) return;
        const meals = { ...day.meals };
        const base = meals[tengo.id] || { lunch: false, dinner: false };
        let lunch = !!base.lunch;
        let dinner = !!base.dinner;
        butto.forEach((m) => {
          const v = meals[m.id];
          if (!v) return;
          lunch = lunch || !!v.lunch;
          dinner = dinner || !!v.dinner;
          delete meals[m.id];
        });
        meals[tengo.id] = { lunch, dinner };
        out[d] = conBlocco(day, meals);
      });
      return out;
    });

    // I campi compilati su una scheda e non sull'altra non vanno persi.
    setMembers((prev) => {
      const scartati = new Set(butto.map((m) => m.id));
      return prev
        .map((m) => {
          if (m.id !== tengo.id) return m;
          const unito = { ...m };
          butto.forEach((b) => {
            if (!unito.paypal && b.paypal) unito.paypal = b.paypal;
            if (!unito.iban && b.iban) unito.iban = b.iban;
            if (b.isChild) unito.isChild = true;
          });
          return unito;
        })
        .filter((m) => !scartati.has(m.id));
    });

    // Se qualche presenza dovesse restare appesa a un id scartato, l'elenco
    // degli ex serve a poterla chiamare per nome.
    butto.forEach((m) => ricordaExMembro(m.id, m.name));
  };

  // ---------- Stessa spesa registrata due volte ----------
  // Anche questa la fusione non può prevenirla: due persone che registrano lo
  // stesso carrello creano due voci nuove, entrambe legittime. Qui però ci
  // sono di mezzo i soldi — il totale si gonfia e le quote di tutti salgono —
  // quindi si segnala e basta: quale delle due buttare lo decide una persona,
  // non l'app. Sospette: stesso nome e stesso prezzo.
  const spesePotenzialmenteDoppie = () => {
    const per = new Map();
    purchases.forEach((p) => {
      const k = nomeChiave(p.name) + '@' + Math.round(posNum(p.price) * 100);
      if (!nomeChiave(p.name)) return;
      per.set(k, (per.get(k) || []).concat([p]));
    });
    return [...per.values()].filter((g) => g.length > 1);
  };

  // ---------- Prezzi che non tornano ----------
  // L'errore più probabile di tutti non è nella fusione né nei conti: è una
  // cifra digitata male. Un 870 al posto di 87 non fa fallire niente, si
  // spalma su tutte le quote e nessuno se ne accorge finché non si paga.
  // Si confronta con la MEDIANA delle spese già registrate (non con la media,
  // che una cifra sbagliata precedente sposterebbe da sola) e si chiede
  // conferma solo quando è davvero fuori scala: meglio zero domande inutili
  // che una domanda a ogni spesa, altrimenti si impara a rispondere sì.
  const prezzoSospetto = (prezzo) => {
    const p = posNum(prezzo);
    if (p <= 0) return null;
    const altri = purchases.map((x) => posNum(x.price)).filter((x) => x > 0).sort((a, b) => a - b);
    if (p >= 1000) return { p, mediana: altri.length ? altri[Math.floor(altri.length / 2)] : 0, perche: 'assoluto' };
    if (altri.length < 3) return null;
    const mediana = altri[Math.floor(altri.length / 2)];
    if (mediana > 0 && p >= mediana * 10 && p >= 300) return { p, mediana, perche: 'relativo' };
    return null;
  };

  // Vero se si può procedere.
  const confermaPrezzo = (prezzo) => {
    const s = prezzoSospetto(prezzo);
    if (!s) return true;
    return window.confirm(
      `${money(s.p)} € è una cifra alta.\n\n` +
      (s.perche === 'relativo'
        ? `Le altre spese del campo stanno intorno a ${money(s.mediana)} €: questa è più di dieci volte tanto.`
        : 'Controlla che non ci sia una virgola fuori posto.') +
      '\n\nUna cifra sbagliata qui si spalma sulle quote di tutti e non si nota più.\n\nÈ giusta?'
    );
  };

  const scartaOrfane = (orfano) => {
    const chi = orfano.nome ? `di ${orfano.nome}` : 'senza padrone';
    // I giorni bloccati non si svuotano nemmeno da qui. Riattaccare una
    // presenza alla persona giusta è una riparazione e passa (non cambia CHI
    // ha mangiato); buttarla via è una perdita, e su un giorno chiuso cambia
    // le quote di tutti. Si dice quante ne restano e perché.
    const protetti = giorniBloccatiDi(orfano.id);
    if (!window.confirm(
      `Buttare via le ${orfano.pasti} presenze ${chi}?\nNon si potranno recuperare.` +
      (protetti.length
        ? `\n\nQuelle dei giorni bloccati (${protetti.map(nomeGiorno).join(', ')}) restano dove sono: ` +
          'per toglierle bisogna prima sbloccare quei giorni.'
        : '')
    )) return;
    setCampData((prev) => {
      const out = { ...prev };
      Object.keys(out).forEach((d) => {
        const day = out[d];
        if (!day || !day.meals || !day.meals[orfano.id]) return;
        if (day.bloccato && typeof day.bloccato === 'object') return;
        const meals = { ...day.meals };
        delete meals[orfano.id];
        out[d] = conBlocco(day, meals);
      });
      return out;
    });
  };

  // Nome del giorno per i messaggi di conferma.
  const nomeGiorno = (ds) => parseDate(ds).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  // "Tutti a pranzo/cena" cambia le presenze di TUTTI in un colpo solo, e la
  // modifica arriva su ogni telefono: prima di farlo si chiede.
  const chiediSetAll = (mealType) => {
    if (members.length === 0) return;
    const pasto = mealType === 'lunch' ? 'pranzo' : 'cena';
    const gia = members.every((m) => getMeal(selectedDateStr, m.id)[mealType]);
    const testo = gia
      ? `Togliere il ${pasto.toUpperCase()} a tutti e ${members.length} i membri di ${nomeGiorno(selectedDateStr)}?`
      : `Segnare tutti e ${members.length} i membri a ${pasto.toUpperCase()} di ${nomeGiorno(selectedDateStr)}?`;
    if (!window.confirm(`${testo}\n\nCambia le presenze di tutti, anche sugli altri telefoni.`)) return;
    setAllMeals(selectedDateStr, mealType);
  };

  // Copia le presenze (pranzo e cena) dal giorno precedente.
  const chiediCopiaDaIeri = () => {
    if (giornoBloccato(selectedDateStr)) {
      window.alert(`Le presenze di ${nomeGiorno(selectedDateStr)} sono bloccate: prima vanno sbloccate.`);
      return;
    }
    const d = parseDate(selectedDateStr);
    d.setDate(d.getDate() - 1);
    const prevStr = toDateStr(d);
    const prevMeals = (campData[prevStr] && campData[prevStr].meals) || {};
    if (!Object.keys(prevMeals).length) {
      window.alert('Nessuna presenza registrata il giorno precedente.');
      return;
    }
    const conta = (meals) => {
      const v = Object.values(meals || {});
      return { p: v.filter((x) => x && x.lunch).length, c: v.filter((x) => x && x.dinner).length };
    };
    const ieri = conta(prevMeals);
    const oggi = conta((campData[selectedDateStr] && campData[selectedDateStr].meals) || {});
    if (!window.confirm(
      `Copiare le presenze di ${nomeGiorno(prevStr)} su ${nomeGiorno(selectedDateStr)}?\n\n` +
      `Ieri: ${ieri.p} a pranzo, ${ieri.c} a cena.\n` +
      `Oggi diventa uguale: quello che c'è adesso (${oggi.p} a pranzo, ${oggi.c} a cena) viene sostituito, ` +
      'anche sugli altri telefoni.'
    )) return;
    setCampData((prev) => {
      const day = { ...(prev[selectedDateStr] || {}) };
      // SOVRASCRIVE le presenze di ieri su quelle di oggi, ma non CANCELLA le
      // persone che ieri non c'erano: toglierle dall'elenco creerebbe delle
      // lapidi, e quelle lapidi cancellerebbero le stesse presenze su TUTTI i
      // telefoni, anche quelle appena segnate da qualcun altro. Chi ieri non
      // c'era resta, azzerato: visivamente è la stessa cosa, ma non distrugge
      // il lavoro degli altri.
      const meals = {};
      Object.keys(day.meals || {}).forEach((id) => { meals[id] = { lunch: false, dinner: false }; });
      Object.keys(prevMeals).forEach((id) => { meals[id] = { ...prevMeals[id] }; });
      return { ...prev, [selectedDateStr]: { ...day, meals } };
    });
  };

  // ---------- Gestione membri ----------
  const addMember = () => {
    const name = newMemberName.trim();
    if (!name) return;
    // Due persone con lo stesso nome verrebbero trattate come una sola nei
    // saldi (i pagamenti si abbinano per nome): meglio dirlo subito.
    const gia = members.some((m) => m.name.trim().toLowerCase() === name.toLowerCase());
    if (gia && !window.confirm(
      `C'è già un membro che si chiama "${name}".\n\n` +
      'Nei conti finali le due persone verrebbero confuse. Aggiungi un cognome ' +
      'o un soprannome per distinguerle.\n\nVuoi aggiungerlo lo stesso?'
    )) return;
    setMembers((prev) => [...prev, { id: uid(), name, isChild: newMemberChild }]);
    setNewMemberName('');
    setNewMemberChild(false);
  };

  const removeMember = (id) => {
    if (membroIntoccabile(id, 'eliminarla')) return;
    const m = members.find((x) => x.id === id);
    if (m && !window.confirm(`Eliminare ${m.name} dai membri?\nLe sue presenze e i suoi pasti non conteranno più nei calcoli.`)) return;
    // Si tiene il nome da parte: se poi qualcuno lo riaggiunge, l'app prende un
    // id nuovo e le vecchie presenze restano appese a un id che non esiste più.
    // Senza questo elenco non si saprebbe nemmeno DI CHI erano.
    ricordaExMembro(id, m && m.name);
    setMembers((prev) => prev.filter((x) => x.id !== id));
  };

  const toggleChild = (id) => {
    // Adulto o bambino cambia quanto paga tutto il campo: su un giorno
    // bloccato vale esattamente come modificare le presenze.
    if (membroIntoccabile(id, 'cambiare adulto/bambino')) return;
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, isChild: !m.isChild } : m)));
  };

  // Dati di pagamento del membro (PayPal / IBAN): campi liberi e facoltativi.
  const setMemberField = (id, campo, valore) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, [campo]: valore } : m)));
  };

  const copiaDato = (etichetta, valore) => {
    copyToClipboard(valore).then((ok) => {
      setCopied(ok ? etichetta : '');
      if (!ok) window.alert(etichetta + ':\n\n' + valore);
    });
    window.setTimeout(() => setCopied(''), 1800);
  };

  // Esenzione dalla spesa per l'attrezzatura aggiunta.
  const toggleEquipExempt = (id) => {
    if (membroIntoccabile(id, "cambiare l'esenzione dall'attrezzatura")) return;
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, equipExempt: !m.equipExempt } : m)));
  };

  // ---------- Lista "Da Acquistare" ----------
  const addToBuy = () => {
    const name = newBuyName.trim();
    if (!name) return;
    setToBuy((prev) => [...prev, { id: uid(), name, qty: newBuyQty.trim() }]);
    setNewBuyName('');
    setNewBuyQty('');
  };

  const removeToBuy = (id) => {
    const it = toBuy.find((x) => x.id === id);
    if (it && !window.confirm(`Eliminare "${it.name}" dalla lista da acquistare?`)) return;
    setToBuy((prev) => prev.filter((x) => x.id !== id));
    setReceipts((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev }; delete copy[id]; return copy;
    });
    if (window.CloudSync) window.CloudSync.deleteReceipt(id);
  };

  // Foto scontrino allegata direttamente alla voce da acquistare.
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
      window.alert('Impossibile leggere la foto. Riprova.');
    }
  };

  // Conferma acquisto: la voce esce dalla lista ed entra nella cronologia
  // mantenendo lo stesso id (così la foto scontrino resta collegata).
  const confirmBuy = () => {
    if (contiChiusi('registrare un acquisto')) return;
    if (!buying) return;
    const price = posNum(buying.price);
    if (price <= 0) { window.alert('Inserisci un prezzo maggiore di zero.'); return; }
    if (!confermaPrezzo(price)) return;
    const fullName = buying.qty ? `${buying.name} (${buying.qty})` : buying.name;
    setPurchases((prev) => [...prev, {
      id: buying.id, name: fullName, price, type: buying.type,
      buyer: (buying.buyer || '').trim(), at: Date.now(), fromList: true,
      ...(buying.account === 'sep' && buying.type !== 'logistica' ? { account: 'sep' } : {}),
    }]);
    setToBuy((prev) => prev.filter((x) => x.id !== buying.id));
    setBuying(null);
  };

  // ---------- Taccuino delle spese ----------
  const addPurchase = () => {
    if (contiChiusi('aggiungere una spesa')) return;
    const name = pName.trim();
    const price = posNum(pPrice);
    if (!name || price <= 0) {
      window.alert('Inserisci il nome del prodotto e un prezzo maggiore di zero.');
      return;
    }
    if (!confermaPrezzo(price)) return;
    const id = uid();
    setPurchases((prev) => [...prev, {
      id, name, price, type: pType, buyer: pBuyer.trim(), at: Date.now(),
      ...(pAccount === 'sep' && pType !== 'logistica' ? { account: 'sep' } : {}),
    }]);
    if (pReceipt) {
      setReceipts((prev) => ({ ...prev, [id]: pReceipt }));
      if (window.CloudSync) window.CloudSync.putReceipt(id, pReceipt);
    }
    setPName('');
    setPPrice('');
    setPType('alimentare');
    setPBuyer('');
    setPReceipt(null);
    setManualOpen(false);   // si richiude: la spesa appena salvata si vede in cronologia
    // Il conto NON si azzera: chi sta registrando la spesa separata di solito
    // ne inserisce più di una di fila.
  };

  // ---------- Conto separato ----------
  const toggleSepDay = (dateStr) => {
    if (giornoIntoccabile(dateStr, 'cambiare il conto separato')) return;
    setSepDays((prev) => (prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()));
  };

  // ---------- Correzione di una voce già registrata ----------
  const openEditPurchase = (p) => setEditing({
    kind: 'purchase', id: p.id, name: p.name, price: String(posNum(p.price)),
    buyer: p.buyer || '', type: p.type || 'alimentare', account: p.account === 'sep' ? 'sep' : 'comune',
  });
  const openEditEquip = (e) => setEditing({
    kind: 'equip', id: e.id, name: e.text, price: String(posNum(e.price)), buyer: e.buyer || '',
  });

  const saveEdit = () => {
    if (!editing) return;
    if (contiChiusi('modificare una voce')) return;
    const name = (editing.name || '').trim();
    const price = posNum(editing.price);
    if (!name) { window.alert('Il nome non può restare vuoto.'); return; }
    if (editing.kind === 'purchase') {
      if (price <= 0) { window.alert('Inserisci un prezzo maggiore di zero.'); return; }
      if (!confermaPrezzo(price)) return;
      setPurchases((prev) => prev.map((p) => (p.id !== editing.id ? p : {
        ...p, name, price, type: editing.type, buyer: (editing.buyer || '').trim(),
        // il conto vale solo per cibo e bevande: la logistica è sempre comune
        ...(editing.account === 'sep' && editing.type !== 'logistica' ? { account: 'sep' } : { account: undefined }),
      })));
    } else {
      setEquipment((prev) => prev.map((e) => (e.id !== editing.id ? e : {
        ...e, text: name, price, buyer: (editing.buyer || '').trim(),
      })));
    }
    setEditing(null);
  };

  const removePurchase = (id) => {
    if (contiChiusi('cancellare una spesa')) return;
    const p = purchases.find((x) => x.id === id);
    if (p && !window.confirm(`Eliminare l'acquisto "${p.name}" (${money(posNum(p.price))} €)?\nVerrà tolto dai totali${receipts[id] ? ' insieme alla foto dello scontrino' : ''}.`)) return;
    setPurchases((prev) => prev.filter((x) => x.id !== id));
    setReceipts((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (window.CloudSync) window.CloudSync.deleteReceipt(id);
  };

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
      window.alert('Impossibile leggere la foto. Riprova.');
    }
  };

  // ---------- Ripristino di emergenza (snapshot giornalieri) ----------
  // Elenco dei salvataggi: PRIMA quelli dentro il telefono (ci sono sempre,
  // anche al campo senza linea), poi quelli nel cloud se si è collegati.
  const openRestore = async () => {
    const salvate = snapLocaliLeggi();
    const locali = Object.keys(salvate).sort().reverse()
      .map((id) => ({ id, dove: 'locale', at: (salvate[id] && salvate[id].at) || 0 }));
    const CS = window.CloudSync;
    let cloudIds = [];
    if (CS && CS.isConnected && CS.isConnected()) {
      try { cloudIds = await CS.listSnapshots(); } catch (e) { cloudIds = []; }
    }
    const soloCloud = cloudIds.filter((id) => !locali.some((l) => l.id === id)).map((id) => ({ id, dove: 'cloud' }));
    const tutte = locali.concat(soloCloud).sort((a, b) => b.id.localeCompare(a.id));
    if (!tutte.length) {
      window.alert('Nessun salvataggio disponibile. Se ne crea uno al giorno, dal primo utilizzo della giornata.');
      return;
    }
    setSnapList(tutte);
  };

  const restoreSnapshot = async (voce) => {
    const id = typeof voce === 'string' ? voce : voce.id;
    const dove = typeof voce === 'string' ? 'cloud' : voce.dove;
    const quando = id.slice(11) === '00' ? ' (mattina)' : id.slice(11) === '12' ? ' (pomeriggio)' : '';

    // Prima si legge la copia, poi si dice cosa costa: chiedere "sei sicuro?"
    // senza sapere quante voci spariranno è chiedere di firmare in bianco.
    let json = null;
    if (dove === 'locale') {
      json = snapLocaleDati(snapLocaliLeggi()[id]);
    } else {
      const CS = window.CloudSync;
      if (CS && CS.isConnected && CS.isConnected()) json = await CS.getSnapshot(id);
    }
    if (!json) { window.alert('Impossibile leggere questo salvataggio.'); return; }

    let d;
    try { d = JSON.parse(json); } catch (e) { window.alert('Salvataggio non valido.'); return; }
    if (!d || typeof d !== 'object') { window.alert('Salvataggio non valido.'); return; }

    const perse = perditeSeApplico(d);
    if (!window.confirm(
      `Ripristinare la copia del ${id.slice(0, 10)}${quando}?\n\n` +
      `${avvisoPerdite(perse)}${avvisoBlocchi(d)}\n\n` +
      'Se il problema è una sincronizzazione andata male, guarda prima ' +
      'Impostazioni → Diagnostica: spesso basta "Annulla la sincronizzazione".'
    )) return;
    try {
      scortaPrimaDi(perse);
      // Set "normali" (non via applyRemote): così il push parte e propaga
      // il ripristino a tutti i dispositivi.
      setMembers(Array.isArray(d.members) ? d.members : []);
      setCampData(applicaBlocchi(d.campData && typeof d.campData === 'object' ? d.campData : {}));
      setPurchases(Array.isArray(d.purchases) ? d.purchases : []);
      setGear(Array.isArray(d.gear) ? d.gear : []);
      setSettled(Array.isArray(d.settled) ? d.settled : []);
      setEquipment(Array.isArray(d.equipment) ? d.equipment : []);
      setToBuy(Array.isArray(d.toBuy) ? d.toBuy : []);
      setSepDays(Array.isArray(d.sepDays) ? d.sepDays : []);
      setFreeDays(Array.isArray(d.freeDays) ? d.freeDays : []);
      setBlocchi(Array.isArray(d.blocchi) ? d.blocchi : []);
      setSnapList(null);
      window.alert('Dati ripristinati: tra qualche secondo saranno su tutti i dispositivi.');
    } catch (e) {
      window.alert('Salvataggio non valido.');
    }
  };

  // ---------- Condividi resoconto spese ----------
  const buildReport = () => {
    const t = totals;
    const lines = [];
    lines.push(`🏕️ ${BRAND.appTitle} — Conti finali`);
    lines.push('');
    lines.push(`💶 Totale spese: ${money(t.overallTotal)} €`);
    if (t.foodDrinksSep > 0 || t.sepDaysCount > 0) {
      lines.push(`   di cui conto separato: ${money(t.foodDrinksSep)} € su ${t.sepDaysCount} ${t.sepDaysCount === 1 ? 'giorno' : 'giorni'} (${money(t.costPerMealSep)} € a pasto)`);
    }
    // Due casse, due elenchi. Un elenco solo farebbe sembrare che chi ha
    // anticipato sul conto separato debba essere rimborsato da tutti.
    const sepAttiva = t.sepDaysCount > 0 || t.foodDrinksSep > 0.005;
    const blocco = (c, titolo) => {
      if (c.transfers.length === 0 && c.settlement.length === 0) return;
      if (c.transfers.length > 0) {
        lines.push('');
        lines.push(`👉 Chi paga chi${titolo ? ` — ${titolo}` : ''}:`);
        c.transfers.forEach((x) => lines.push(`• ${x.from} → ${x.to}: ${money(x.amount)} €`));
      }
      if (c.settlement.length > 0) {
        lines.push('');
        lines.push(`📋 Dettaglio a testa${titolo ? ` — ${titolo}` : ''}:`);
        c.settlement.forEach((s) => {
          const stato = s.net > 0.005 ? `riceve ${money(s.net)} €` : s.net < -0.005 ? `deve dare ${money(-s.net)} €` : 'in pari';
          lines.push(`• ${s.name}: ${stato} (anticipato ${money(s.paid)} €, quota ${money(s.owed)} €)`);
        });
      }
    };
    // Il resoconto segue quello che si sta guardando: mandare nel gruppo un
    // elenco diverso da quello a schermo e' il modo piu' rapido di far pagare
    // due volte qualcuno.
    if (sepAttiva && saldiOttimizzati) {
      blocco({ transfers: t.transfersOttimizzati, settlement: t.settlement }, '');
    } else {
      blocco(t.casse.comune, sepAttiva ? 'cassa comune' : '');
      if (sepAttiva) blocco(t.casse.separata, 'cassa separata');
    }
    if (t.freeDaysCount > 0) {
      lines.push(`   🎁 ${t.freeDaysCount} ${t.freeDaysCount === 1 ? 'giorno gratis' : 'giorni gratis'}: ${t.mealsFree} pasti fuori dai conti`);
    }
    if (t.unattributed > 0.005) {
      lines.push('');
      lines.push(`⚠️ ${money(t.unattributed)} € di spese comuni senza acquirente.`);
    }
    // Un resoconto che non quadra non va mandato nel gruppo senza dirlo: chi
    // lo legge farebbe i bonifici sbagliati.
    if (t.nonRipartito > 0.005) {
      lines.push('');
      lines.push(`⚠️ CONTI NON COMPLETI: ${money(t.nonRipartito)} € non sono nelle quote di nessuno.`);
      t.buchi.forEach((b) => lines.push(`   • ${money(b.quanto)} € — ${b.perche}`));
      lines.push('   Chi ha anticipato quella cifra resta scoperto: da sistemare prima di pagare.');
    }
    return lines.join('\n');
  };

  const shareReport = async () => {
    if (totals.overallTotal <= 0) {
      window.alert('Nessuna spesa da condividere: registra prima gli acquisti.');
      return;
    }
    const text = buildReport();
    if (navigator.share) {
      try { await navigator.share({ title: 'Prato Lungo 2026 — Conti', text }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; /* altrimenti prova WhatsApp */ }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  // Carica la classifica quando si apre la sezione del gioco.
  useEffect(() => {
    if (activeTab === 'gioco') refreshLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, cloud.connected]);

  // ---------- Mini gioco: classifica ----------
  const refreshLeaderboard = () => {
    const CS = window.CloudSync;
    if (CS && CS.listScores) CS.listScores().then(setLeaderboard).catch(() => {});
  };

  const startGame = () => {
    const n = gamePlayer.trim();
    if (!n) { window.alert('Scrivi il tuo nome per entrare in classifica.'); return; }
    scriviLocale('cambusa_player', n);
    setGameRunning(true);
  };

  const endGame = (score) => {
    if (score > gameBest) {
      setGameBest(score);
      scriviLocale('cambusa_best', JSON.stringify(score));
    }
    const CS = window.CloudSync;
    if (CS && CS.submitScore) {
      CS.submitScore(gamePlayer.trim(), score).then(refreshLeaderboard).catch(() => {});
    }
  };

  // ---------- Galleria del campo ----------
  // Ci si mette in ascolto delle miniature SOLO mentre la galleria è aperta:
  // altrimenti ogni avvio dell'app scaricherebbe l'intero album.
  useEffect(() => {
    if (activeTab !== 'galleria') { setPhotosReady(false); return undefined; }
    const CS = window.CloudSync;
    if (!CS || !CS.watchPhotos || !CS.isConnected()) { setPhotosReady(false); return undefined; }
    const stop = CS.watchPhotos((list) => { setPhotos(list); setPhotosReady(true); });
    return () => { if (typeof stop === 'function') stop(); };
  }, [activeTab, cloud.connected]);

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
        'in alto smetta di dire "da inviare".'
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
      const r = campRange();
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

  // ---------- Rimborsi saldati (barrati) ----------
  const toggleSettled = (key) => {
    setSettled((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // ---------- Aggiunta attrezzatura ----------
  const addEquip = () => {
    const text = newEquipText.trim();
    if (!text) return;
    if (contiChiusi('aggiungere attrezzatura')) return;
    if (!confermaPrezzo(newEquipPrice)) return;
    setEquipment((prev) => [...prev, { id: uid(), text, price: posNum(newEquipPrice), bought: false, buyer: newEquipBuyer.trim() }]);
    setNewEquipText('');
    setNewEquipPrice('');
    setNewEquipBuyer('');
  };

  const toggleEquipBought = (id) => {
    if (contiChiusi('cambiare l\'attrezzatura acquistata')) return;
    setEquipment((prev) => prev.map((e) => (e.id === id ? { ...e, bought: !e.bought } : e)));
  };

  const removeEquip = (id) => {
    const e = equipment.find((x) => x.id === id);
    if (e && !window.confirm(`Eliminare "${e.text}" dall'attrezzatura?`)) return;
    if (contiChiusi('cancellare attrezzatura')) return;
    setEquipment((prev) => prev.filter((x) => x.id !== id));
    setReceipts((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev }; delete copy[id]; return copy;
    });
    if (window.CloudSync) window.CloudSync.deleteReceipt(id);
  };

  // ---------- Dotazioni aggiuntive ----------
  const addGear = () => {
    const text = newGearText.trim();
    if (!text) return;
    setGear((prev) => [...prev, { id: uid(), text }]);
    setNewGearText('');
  };

  const removeGear = (id) => {
    const g = gear.find((x) => x.id === id);
    if (g && !window.confirm(`Eliminare "${g.text}" dalle dotazioni?`)) return;
    setGear((prev) => prev.filter((x) => x.id !== id));
  };

  // ---------- Navigazione date ----------
  const changeWeek = (days) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
    setSelectedDateStr(toDateStr(newDate));
  };

  const navigateDate = (days) => {
    const d = parseDate(selectedDateStr);
    d.setDate(d.getDate() + days);
    setSelectedDateStr(toDateStr(d));
    setCurrentDate(new Date(d));
  };

  const getDaysOfWeek = (start) => {
    const days = [];
    const temp = new Date(start);
    const day = temp.getDay();
    const diff = temp.getDate() - day + (day === 0 ? -6 : 1); // lunedì come inizio settimana
    temp.setDate(diff);
    for (let i = 0; i < 7; i++) {
      days.push(new Date(temp));
      temp.setDate(temp.getDate() + 1);
    }
    return days;
  };

  const weekDays = getDaysOfWeek(currentDate);

  // Striscia dei giorni: la stessa in Calendario e in Menù, così il giorno
  // scelto in una scheda è già scelto anche nell'altra.
  const renderWeekStrip = () => (
    <>
      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm">
        <button onClick={() => changeWeek(-7)} aria-label="Settimana precedente" className={bottoneIcona('tenue')}>&larr;</button>
        <span className="font-bold text-sm text-[#2D392C] uppercase font-rustic">Settimana Selezionata</span>
        <button onClick={() => changeWeek(7)} aria-label="Settimana successiva" className={bottoneIcona('tenue')}>&rarr;</button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d) => {
          const dateStr = toDateStr(d);
          const isSelected = dateStr === selectedDateStr;
          const isCampPeriod = dateStr >= CAMP_START && dateStr <= CAMP_END;
          const label = d.toLocaleDateString('it-IT', { weekday: 'short' });
          return (
            <button
              key={dateStr}
              onClick={() => { setSelectedDateStr(dateStr); setCurrentDate(new Date(d)); }}
              className={`p-2 flex flex-col items-center rounded-lg border transition-all ${
                isSelected
                  ? 'bg-[#5C4A3C] text-white border-[#5C4A3C]'
                  : isCampPeriod
                  ? 'bg-[#2D392C]/10 text-[#2D392C] border-[#2D392C]'
                  : 'bg-white text-gray-400 border-gray-200'
              }`}
            >
              <span className="text-[10px] uppercase font-bold">{label}</span>
              <span className="text-lg font-bold font-rustic">{d.getDate()}</span>
              {isCampPeriod && <span className="w-1.5 h-1.5 bg-[#D97706] rounded-full mt-0.5"></span>}
            </button>
          );
        })}
      </div>
    </>
  );

  // ---------- Calcolo ripartizione (coerente: somma quote = totale) ----------
  const calculateTotals = () => {
    // I totali di spesa sono generati dal taccuino (per tipologia).
    const sumByType = (t) => purchases.reduce((s, p) => (p.type === t ? s + posNum(p.price) : s), 0);
    const totalFood = sumByType('alimentare');
    const totalDrinks = sumByType('bevande');
    // Logistica dagli acquisti (divisa fra tutti i presenti) e attrezzatura
    // acquistata (divisa solo fra chi NON è esente): due quote separate.
    const logisticsPurchases = sumByType('logistica');
    const equipBought = equipment.reduce((s, e) => (e.bought ? s + posNum(e.price) : s), 0);
    const totalAccessory = logisticsPurchases + equipBought;
    const totalFoodDrinks = totalFood + totalDrinks;
    const overallTotal = totalFoodDrinks + totalAccessory;

    // --- Conto separato ---
    // I giorni spuntati fanno cassa a parte: il cibo/bevande marcato
    // "separato" si divide SOLO sui pasti di quei giorni, e quei pasti escono
    // dal divisore comune (altrimenti chi c'era pagherebbe due volte).
    const sepSet = new Set(sepDays);
    // --- Giorni gratis ---
    // Un giorno gratis è INVISIBILE alla contabilità: i suoi pasti non entrano
    // in nessun divisore e non rendono nessuno "presente". Chi c'è stato solo
    // quel giorno paga zero — che è il senso di "gratis per tutti". Le presenze
    // restano scritte, perché servono alla cucina e al riepilogo del giorno.
    const freeSet = new Set(freeDays);
    const isSepPurchase = (p) => p.account === 'sep' && p.type !== 'logistica';
    const foodDrinksSep = purchases.reduce(
      (s, p) => (isSepPurchase(p) ? s + posNum(p.price) : s), 0);
    const foodDrinksCommon = totalFoodDrinks - foodDrinksSep;

    // Pasti per membro, distinti fra giorni comuni e giorni del conto separato.
    // "gratis" tiene il conto dei pasti dei giorni esclusi: non si pagano, ma
    // vanno mostrati, altrimenti uno vede "2 pasti" sulla scheda e "6" nel
    // calendario e pensa a un errore.
    const mealsByMember = {};
    members.forEach((m) => (mealsByMember[m.id] = { common: 0, sep: 0, total: 0, gratis: 0 }));
    let mealsFree = 0;

    let adultMealsTotal = 0;
    let adultMealsSep = 0;
    const attendingAdults = new Set();
    // Logistica e attrezzatura si dividono SOLO fra chi c'e' nei giorni comuni.
    // Il conto separato e' una cassa a parte: chi e' venuto unicamente in quei
    // giorni paga la sua spesa separata e basta, e la sua parte di logistica e
    // attrezzatura si spalma su chi resta nel conto comune.
    const attendingCommon = new Set();   // adulti con almeno un pasto nei giorni comuni
    const attendingForEquip = new Set(); // come sopra, meno gli esenti da attrezzatura
    const sepPeople = new Set();         // adulti che mangiano nei giorni separati

    Object.keys(campData).forEach((dateStr) => {
      const day = campData[dateStr];
      const meals = (day && day.meals) || {};
      const inSep = sepSet.has(dateStr);
      const gratis = freeSet.has(dateStr);
      members.forEach((m) => {
        const mm = meals[m.id];
        if (!mm) return;
        const count = (mm.lunch ? 1 : 0) + (mm.dinner ? 1 : 0);
        if (count === 0) return;
        const rec = mealsByMember[m.id];
        if (!rec) return;
        rec.total += count;
        // Giorno gratis: si conta e ci si ferma. Niente divisori, niente
        // presenza: quel giorno non esiste per i conti.
        if (gratis) { rec.gratis += count; if (!m.isChild) mealsFree += count; return; }
        if (inSep) rec.sep += count; else rec.common += count;
        if (!m.isChild) {
          adultMealsTotal += count;
          if (inSep) { adultMealsSep += count; sepPeople.add(m.id); }
          else {
            attendingCommon.add(m.id);
            // L'esenzione vale solo se la funzione e' attiva (vedi FEATURES).
            if (!(FEATURES.equipExemption && m.equipExempt)) attendingForEquip.add(m.id);
          }
          attendingAdults.add(m.id);
        }
      });
    });

    const adultMealsCommon = adultMealsTotal - adultMealsSep;

    // Cibo+bevande ripartiti sui pasti degli adulti (bambini = gratis),
    // ognuno sulla sua cassa.
    const costPerMeal = adultMealsCommon > 0 ? foodDrinksCommon / adultMealsCommon : 0;
    const costPerMealSep = adultMealsSep > 0 ? foodDrinksSep / adultMealsSep : 0;
    // Logistica: parti uguali fra gli adulti dei giorni COMUNI.
    const logisticsPerAdult = attendingCommon.size > 0 ? logisticsPurchases / attendingCommon.size : 0;
    // Attrezzatura: parti uguali fra quelli non esenti. Se sono tutti esenti,
    // per non perdere la spesa si ripartisce su tutti i comuni.
    const equipDivisorSet = attendingForEquip.size > 0 ? attendingForEquip : attendingCommon;
    const equipPerAdult = equipDivisorSet.size > 0 ? equipBought / equipDivisorSet.size : 0;
    // Quota "accessori" media mostrata nel riepilogo.
    const accessoryPerAdult = logisticsPerAdult + equipPerAdult;

    // Quota dovuta da ciascun membro (valore esatto).
    const breakdown = members.map((m) => {
      const rec = mealsByMember[m.id] || { common: 0, sep: 0, total: 0, gratis: 0 };
      const mealCount = rec.total;
      const foodShare = m.isChild ? 0 : rec.common * costPerMeal + rec.sep * costPerMealSep;
      // "Presente" ai fini dei conti è chi ha almeno un pasto che si paga: si
      // usa lo STESSO insieme con cui si è calcolata la quota, altrimenti la
      // somma delle quote non torna col totale. In particolare chi è venuto
      // solo in un giorno gratis non deve la quota di logistica: quel giorno
      // per lui non è costato niente, ed è il senso di "gratis per tutti".
      const present = attendingCommon.has(m.id);
      const logShare =
        (present ? logisticsPerAdult : 0) +
        (present && equipDivisorSet.has(m.id) ? equipPerAdult : 0);
      // La quota si tiene divisa fra le due casse fin da qui: la cassa
      // separata è il cibo dei giorni spuntati e basta, tutto il resto —
      // cibo comune, logistica, attrezzatura — sta nella cassa comune.
      const owedSep = m.isChild ? 0 : rec.sep * costPerMealSep;
      const owedComune = m.isChild ? 0 : rec.common * costPerMeal + logShare;
      return {
        ...m, mealCount, mealsCommon: rec.common, mealsSep: rec.sep, mealsGratis: rec.gratis,
        foodShare, logShare, owedComune, owedSep, owed: owedComune + owedSep,
      };
    });

    // --- Arrotondamento "cassa-friendly" ---
    // Ogni quota viene arrotondata a multipli di 0,10 € (niente monetine da
    // 1/2/5 cent). Lo scarto rispetto al totale reale viene riconciliato SOLO
    // se è >= 0,50 €: sotto quella soglia si lascia com'è (non vale la pena).
    // Si arrotonda una cassa alla volta: se si arrotondasse una volta sola sul
    // totale, i saldi di ciascuna cassa non tornerebbero a zero da soli e
    // "cassa separata" resterebbe solo un'etichetta.
    const round10 = (cents) => Math.round(cents / 10) * 10;
    const arrotondaCassa = (dovuto, cents, targetCents) => {
      breakdown.forEach((b) => {
        b[cents] = b.isChild ? 0 : round10(Math.round(b[dovuto] * 100));
      });
      let residuo = targetCents - breakdown.reduce((s, b) => s + b[cents], 0);
      if (Math.abs(residuo) >= 50) {
        // Redistribuisce lo scarto a passi di 10 cent, partendo da chi deve di più.
        const ordine = breakdown
          .filter((b) => !b.isChild && b[dovuto] > 0)
          .sort((a, b) => b[dovuto] - a[dovuto]);
        const passo = residuo > 0 ? 10 : -10;
        let guardia = 0;
        let idx = 0;
        while (Math.abs(residuo) >= 10 && ordine.length > 0 && guardia < 100000) {
          const t = ordine[idx % ordine.length];
          if (!(passo < 0 && t[cents] + passo < 0)) {
            t[cents] += passo;
            residuo -= passo;
          }
          idx++;
          guardia++;
        }
      }
    };

    // --- Soldi senza divisore: un BUCO, non un arrotondamento ---
    // Se una cassa ha dei soldi dentro ma nessun pasto (o nessun presente) su
    // cui dividerli, la sua quota a pasto viene zero e quei soldi non entrano
    // in nessuna quota. Finivano dentro lo scarto, e la riconciliazione — nata
    // per limare qualche centesimo — se li spalmava addosso a chi capitava, 10
    // cent alla volta: cento euro di "conto separato" senza giorni separati
    // spuntati diventavano cinquanta euro a testa per due persone che non
    // c'entravano niente, sotto l'etichetta "arrotondamento".
    // Ora si tengono fuori dal conto e si dicono.
    // Ogni buco sa a quale cassa appartiene: serve a riconciliare le due casse
    // separatamente e a mostrare l'avviso dove il buco è, non su entrambe.
    const buchi = [];
    if (foodDrinksCommon > 0.005 && adultMealsCommon === 0) {
      buchi.push({ cassa: 'comune', quanto: foodDrinksCommon, perche: 'cibo e bevande del conto comune, ma nessun pasto segnato nei giorni comuni' });
    }
    if (foodDrinksSep > 0.005 && adultMealsSep === 0) {
      buchi.push({
        cassa: 'separata',
        quanto: foodDrinksSep,
        perche: sepDays.length === 0
          ? 'spese segnate "conto separato", ma in Calendario nessun giorno è spuntato come separato'
          : sepDays.every((d) => freeSet.has(d))
          ? 'spese segnate "conto separato", ma i giorni separati sono anche segnati come gratis: non c\'è più nessun pasto su cui dividerle'
          : 'spese segnate "conto separato", ma nei giorni separati non c\'è nessuna presenza',
      });
    }
    if (logisticsPurchases > 0.005 && attendingCommon.size === 0) {
      buchi.push({ cassa: 'comune', quanto: logisticsPurchases, perche: 'spese di logistica, ma nessun adulto ha presenze nei giorni comuni' });
    }
    if (equipBought > 0.005 && equipDivisorSet.size === 0) {
      buchi.push({ cassa: 'comune', quanto: equipBought, perche: 'attrezzatura acquistata, ma nessun adulto ha presenze nei giorni comuni' });
    }
    const somma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
    const nonRipartito = somma(buchi, (b) => b.quanto);
    const nonRipartitoComune = somma(buchi.filter((b) => b.cassa === 'comune'), (b) => b.quanto);
    const nonRipartitoSep = somma(buchi.filter((b) => b.cassa === 'separata'), (b) => b.quanto);

    // Si riconcilia solo ciò che è davvero ripartibile: così lo scarto torna a
    // essere quello che deve essere — pochi centesimi di arrotondamento.
    const totaleComune = foodDrinksCommon + totalAccessory;
    arrotondaCassa('owedComune', 'payComuneCents', Math.round((totaleComune - nonRipartitoComune) * 100));
    arrotondaCassa('owedSep', 'paySepCents', Math.round((foodDrinksSep - nonRipartitoSep) * 100));

    breakdown.forEach((b) => {
      b.payCents = b.payComuneCents + b.paySepCents;
      b.payComune = b.payComuneCents / 100;
      b.paySep = b.paySepCents / 100;
      b.pay = b.payCents / 100;
    });
    const collectedComune = somma(breakdown, (b) => b.payComuneCents) / 100;
    const collectedSep = somma(breakdown, (b) => b.paySepCents) / 100;
    const collected = collectedComune + collectedSep;
    // Lo scarto ora è solo arrotondamento: il buco viaggia da solo, con il suo
    // nome, invece di nascondersi qui dentro.
    const roundingDiffComune = collectedComune - (totaleComune - nonRipartitoComune);
    const roundingDiffSep = collectedSep - (foodDrinksSep - nonRipartitoSep);
    const roundingDiff = collected - (overallTotal - nonRipartito);

    // --- Saldi di UNA cassa: chi ha anticipato, chi deve, chi paga chi ---
    // Scritto una volta e chiamato due volte. Ogni cassa deve chiudersi da
    // sola: chi ha anticipato sul conto separato viene rimborsato da chi in
    // quei giorni ha mangiato, non da chi è arrivato dopo.
    const norm = (s) => (s || '').trim().toLowerCase();

    // Passaggi di pareggio: chi paga chi, col minor numero di giri. Si scorre
    // l'elenco gia' ordinato per saldo e si accoppia a centesimi finche' uno
    // dei due lati si esaurisce. E' lo stesso conto che fa Splitwise quando
    // "semplifica i debiti": nessuno paga un centesimo in piu' o in meno, si
    // riduce solo il numero di bonifici.
    const pareggia = (elenco, nomeCassa) => {
      const creditori = elenco.filter((s) => s.net > 0.005).map((s) => ({ name: s.name, cents: Math.round(s.net * 100) }));
      const debitori = elenco.filter((s) => s.net < -0.005).map((s) => ({ name: s.name, cents: Math.round(-s.net * 100) }));
      const passaggi = [];
      let ci = 0, di = 0;
      while (ci < creditori.length && di < debitori.length) {
        const amt = Math.min(creditori[ci].cents, debitori[di].cents);
        if (amt > 0) passaggi.push({ from: debitori[di].name, to: creditori[ci].name, amount: amt / 100, cassa: nomeCassa });
        creditori[ci].cents -= amt;
        debitori[di].cents -= amt;
        if (creditori[ci].cents === 0) ci++;
        if (debitori[di].cents === 0) di++;
      }
      return passaggi;
    };

    const faiSaldi = (anticipi, campoPay, nomeCassa) => {
      const paidByName = {}; // nome normalizzato -> { display, paid }
      anticipi.forEach((a) => {
        const price = posNum(a.price);
        if (price <= 0) return;
        const raw = (a.buyer && a.buyer.trim()) ? a.buyer.trim() : '—';
        const key = norm(raw) || '—';
        if (!paidByName[key]) paidByName[key] = { display: raw, paid: 0 };
        paidByName[key].paid += price;
      });
      const owedByName = {}; // nome membro normalizzato -> { display, owed }
      breakdown.forEach((b) => {
        const key = norm(b.name);
        if (!owedByName[key]) owedByName[key] = { display: b.name, owed: 0 };
        owedByName[key].owed += b[campoPay]; // già arrotondato; bambini = 0
      });
      const unattributed = paidByName['—'] ? paidByName['—'].paid : 0;
      // Spese intestate a un nome che non è fra i membri: succede se un membro
      // viene rinominato o eliminato dopo l'acquisto. Non è un errore di calcolo
      // (i saldi restano a somma zero) ma va mostrato, perché quella persona
      // compare nei rimborsi pur non essendo del campo.
      const unknownBuyers = Object.keys(paidByName)
        .filter((k) => k !== '—' && !owedByName[k])
        .map((k) => ({ name: paidByName[k].display, paid: paidByName[k].paid }));
      const allKeys = new Set([...Object.keys(paidByName), ...Object.keys(owedByName)]);
      allKeys.delete('—');
      const settlement = [];
      allKeys.forEach((k) => {
        const paid = paidByName[k] ? paidByName[k].paid : 0;
        const owed = owedByName[k] ? owedByName[k].owed : 0;
        if (paid === 0 && owed === 0) return;
        const display = (owedByName[k] && owedByName[k].display) || (paidByName[k] && paidByName[k].display) || k;
        settlement.push({ name: display, paid, owed, net: paid - owed });
      });
      settlement.sort((a, b) => b.net - a.net); // prima chi deve ricevere
      const transfers = pareggia(settlement, nomeCassa);
      // Anticipi per acquirente di questa cassa (utile per i rimborsi).
      const byBuyer = Object.keys(paidByName)
        .map((k) => ({ name: paidByName[k].display, total: paidByName[k].paid }))
        .sort((a, b) => b.total - a.total);
      return { settlement, transfers, byBuyer, unattributed, unknownBuyers };
    };

    // La cassa separata è solo il cibo dei giorni spuntati. Tutto il resto —
    // cibo comune, logistica, attrezzatura comprata — è cassa comune.
    const cassaSep = faiSaldi(
      purchases.filter(isSepPurchase),
      'paySep', 'separata');
    const cassaComune = faiSaldi(
      [
        ...purchases.filter((p) => !isSepPurchase(p)),
        // Attrezzatura acquistata: se ha un acquirente viene accreditata a lui
        // (verrà rimborsato); altrimenti è spesa comune ("non attribuita"). In
        // entrambi i casi la somma dei saldi resta zero.
        ...equipment.filter((e) => e.bought).map((e) => ({ buyer: e.buyer, price: e.price })),
      ],
      'payComune', 'comune');
    const casse = { comune: cassaComune, separata: cassaSep };

    // Viste d'insieme: servono al resoconto da mandare nel gruppo, alla
    // chiusura del campo e alle prove. Non sostituiscono le due casse: le
    // riassumono.
    const transfers = [...cassaComune.transfers, ...cassaSep.transfers];
    const unattributed = cassaComune.unattributed + cassaSep.unattributed;
    const perNome = {};
    [cassaComune, cassaSep].forEach((c) => c.settlement.forEach((s) => {
      const k = norm(s.name);
      if (!perNome[k]) perNome[k] = { name: s.name, paid: 0, owed: 0 };
      perNome[k].paid += s.paid;
      perNome[k].owed += s.owed;
    }));
    const settlement = Object.keys(perNome)
      .map((k) => ({ ...perNome[k], net: perNome[k].paid - perNome[k].owed }))
      .sort((a, b) => b.net - a.net);
    // Gli stessi saldi pareggiati una volta sola invece che cassa per cassa:
    // le cifre dovute non cambiano di un centesimo, cambiano solo i bonifici,
    // che diventano meno. Chi era creditore di qua e debitore di la' qui si
    // compensa da solo. E' la vista che serve QUANDO SI PAGA; quella per
    // cassa resta, ed e' la vista che serve per capire PERCHE'.
    const transfersOttimizzati = pareggia(settlement, 'tutte');
    const sconosciuti = {};
    [cassaComune, cassaSep].forEach((c) => c.unknownBuyers.forEach((u) => {
      const k = norm(u.name);
      if (!sconosciuti[k]) sconosciuti[k] = { name: u.name, paid: 0 };
      sconosciuti[k].paid += u.paid;
    }));
    const unknownBuyers = Object.keys(sconosciuti).map((k) => sconosciuti[k]);
    const byBuyer = (() => {
      const m2 = {};
      [...cassaComune.byBuyer, ...cassaSep.byBuyer].forEach((b) => {
        m2[b.name] = (m2[b.name] || 0) + b.total;
      });
      return Object.keys(m2).map((name) => ({ name, total: m2[name] })).sort((a, b) => b.total - a.total);
    })();

    return {
      totalFood, totalDrinks, totalAccessory, totalFoodDrinks, overallTotal,
      costPerMeal, logisticsPerAdult, equipPerAdult, accessoryPerAdult,
      logisticsPurchases, equipBought, equipPayersCount: equipDivisorSet.size,
      adultMealsTotal, adultMealsCommon, adultMealsSep,
      foodDrinksCommon, foodDrinksSep, costPerMealSep,
      sepPeopleCount: sepPeople.size, sepDaysCount: sepDays.length,
      freeDaysCount: freeDays.length, mealsFree,
      attendingAdultsCount: attendingAdults.size,
      accessoryPayersCount: attendingCommon.size, breakdown,
      collected, roundingDiff, nonRipartito, buchi,
      totaleComune, collectedComune, collectedSep,
      roundingDiffComune, roundingDiffSep,
      nonRipartitoComune, nonRipartitoSep, casse,
      byBuyer, settlement, unattributed, unknownBuyers, transfers,
      transfersOttimizzati,
    };
  };

  const totals = calculateTotals();
  // Aggancio per le prove (come canvas.__game): i conti esatti, non ricavati
  // dal testo a schermo. La prova "oracolo" li confronta con un calcolo
  // indipendente e con scenari fatti a mano.
  if (typeof window !== 'undefined') window.__totali = totals;

  // La cassa separata esiste solo se c'è qualcosa dentro: senza giorni
  // spuntati l'app resta com'era, con una cassa sola.
  const cassaSepAttiva = totals.sepDaysCount > 0 || totals.foodDrinksSep > 0.005;

  // Chiave del rimborso segnato come saldato. La cassa separata ha il suo
  // prefisso: senza, due passaggi identici nelle due casse (stesse persone,
  // stessa cifra) si spegnerebbero a vicenda con un tocco solo.
  const chiaveRimborso = (t) =>
    `${t.cassa === 'separata' ? 'sep:' : t.cassa === 'tutte' ? 'opt:' : ''}${t.from}→${t.to}@${Math.round(t.amount * 100)}`;

  // La vista dei passaggi ottimizzati: le due casse messe insieme. Riusa i
  // saldi complessivi, che sono gia' la somma delle due.
  const cassaUnica = {
    settlement: totals.settlement,
    transfers: totals.transfersOttimizzati,
    byBuyer: totals.byBuyer,
    unattributed: totals.unattributed,
    unknownBuyers: totals.unknownBuyers,
  };
  // Quanti bonifici si risparmiano davvero: se non se ne risparmia nessuno il
  // tasto non serve e non si mostra.
  const risparmio = totals.transfers.length - totals.transfersOttimizzati.length;

  // Scheda delle quote di UNA cassa. Scritta una volta e usata due volte: se
  // le due casse si mostrassero con codice diverso, prima o poi direbbero le
  // stesse cose in due modi diversi.
  const schedaQuote = (c) => (
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">{c.titolo}</h3>
      {c.sottotitolo && <p className="text-[10px] text-gray-500 leading-snug mb-2">{c.sottotitolo}</p>}
      {c.avviso && (
        <div className="mb-3 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
          <p className="text-[11px] text-[#5C4A3C] leading-snug">{c.avviso}</p>
        </div>
      )}
      {c.elenco.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{c.vuoto || 'Aggiungi membri e segna le presenze per vedere la ripartizione.'}</p>
      ) : (
        <div>
          <ul className="divide-y divide-[#8F9E8B]/20">
            {c.elenco.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[#2D392C]">{b.name}</span>
                  <span className="text-[10px] text-gray-500">
                    {c.pastiDi(b)} {c.pastiDi(b) === 1 ? 'pasto' : 'pasti'}
                    {b.mealsGratis > 0 ? ` · ${b.mealsGratis} gratis` : ''}
                    {b.isChild ? ' · bambino' : ''}
                  </span>
                </div>
                <span className={`font-rustic font-bold ${b.isChild ? 'text-gray-400' : 'text-[#2D392C]'}`}>
                  {b.isChild ? 'Gratis' : `${money(c.quotaDi(b))} €`}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between items-center pt-2 mt-1 border-t border-[#8F9E8B]/30">
            <span className="text-[11px] uppercase font-bold text-gray-500">Totale raccolto</span>
            <span className="font-rustic font-bold text-[#2D392C]">{money(c.raccolto)} €</span>
          </div>
          <p className="text-[9px] text-gray-400 italic mt-2">
            Quote arrotondate a 0,10 € (niente monetine da 1/2/5 cent).
            {Math.abs(c.scarto) >= 0.005
              ? ` Scarto rispetto al ripartibile: ${c.scarto > 0 ? '+' : ''}${money(c.scarto)} € (sotto 0,50 €, non riconciliato).`
              : ' Nessuno scarto.'}
          </p>
        </div>
      )}
      {/* Soldi che nessuno sta pagando. Sta FUORI dall'elenco di proposito:
          il caso peggiore è proprio la cassa senza nessuno dentro, dove non
          c'è nessuna riga a cui appenderlo e il buco è tutto il contenuto.
          Prima finivano dentro lo scarto e la riconciliazione se li spalmava
          addosso a chi capitava, sotto l'etichetta "arrotondamento". */}
      {c.nonRipartito > 0.005 && (
        <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5 mt-2">
          <p className="text-[10px] text-[#5C4A3C] leading-snug">
            <span className="font-bold">{money(c.nonRipartito)} € non sono nelle quote di nessuno.</span>{' '}
            Questa cassa vale {money(c.totale)} €, ma se ne raccolgono {money(c.raccolto)} €:
            chi ha anticipato quei soldi non li riavrebbe indietro.
          </p>
          <ul className="mt-1.5 space-y-1">
            {c.buchi.map((b) => (
              <li key={b.perche} className="text-[10px] text-[#5C4A3C] leading-snug">
                <span className="font-bold">{money(b.quanto)} €</span> — {b.perche}.
              </li>
            ))}
          </ul>
          <p className="text-[9px] text-gray-500 italic mt-1.5 leading-snug">
            Si sistema segnando le presenze mancanti, spuntando i giorni del conto separato in
            Calendario, oppure rimettendo quelle spese sul conto comune (la matita nel Taccuino).
          </p>
        </div>
      )}
    </div>
  );

  // Scheda dei saldi di UNA cassa: chi ha anticipato, chi deve, chi paga chi.
  // Le tre cose stanno insieme perché insieme si leggono: separarle
  // costringerebbe a saltare avanti e indietro per capire un rimborso.
  const schedaSaldi = (c) => {
    const s = c.cassa;
    return (
      <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md">
        <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 mb-3">{c.titolo}</h3>
        {c.sottotitolo && <p className="text-[9px] text-[#8F9E8B] leading-snug mb-3">{c.sottotitolo}</p>}
        {s.byBuyer.length > 0 && (
          <div className="mb-3 pb-3 border-b border-[#8F9E8B]/30">
            <h4 className="font-rustic text-sm text-[#8F9E8B] mb-1">Anticipi per acquirente</h4>
            <ul className="divide-y divide-[#8F9E8B]/20">
              {s.byBuyer.map((b) => (
                <li key={b.name} className="flex items-center justify-between py-1.5">
                  <span className={`text-xs font-bold ${b.name === '—' ? 'text-gray-400 italic' : ''}`}>
                    {b.name === '—' ? 'Non indicato' : b.name}
                  </span>
                  <span className="font-rustic font-bold text-sm">{money(b.total)} €</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.settlement.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{c.vuoto || 'Registra acquisti (con acquirente) e presenze per vedere chi deve dare o ricevere.'}</p>
        ) : (
          <ul className="divide-y divide-[#8F9E8B]/20">
            {s.settlement.map((x) => {
              const credito = x.net > 0.005;
              const debito = x.net < -0.005;
              return (
                <li key={x.name} className="flex items-center justify-between py-2 gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold truncate">{x.name}</span>
                    <span className="text-[9px] text-[#8F9E8B]">ha anticipato {money(x.paid)} € · deve {money(x.owed)} €</span>
                  </div>
                  <span className={`font-rustic font-bold text-sm shrink-0 text-right ${credito ? 'text-[#8FBF8F]' : debito ? 'text-[#D97706]' : 'text-gray-400'}`}>
                    {credito ? `riceve ${money(x.net)} €` : debito ? `dà ${money(-x.net)} €` : 'in pari'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {s.transfers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#8F9E8B]/30">
            <h4 className="font-rustic text-sm text-[#8F9E8B] mb-1">Chi paga chi</h4>
            <p className="text-[9px] text-gray-400 mb-2">Tocca una riga quando il rimborso è stato fatto: resta barrata. Tocca di nuovo per annullare.</p>
            <ul className="space-y-1.5">
              {s.transfers.map((t, i) => {
                const key = chiaveRimborso(t);
                const paid = settled.includes(key);
                // Dati di pagamento di chi deve ricevere (scheda Membri, tasto "i").
                const dest = members.find((m) => m.name === t.to);
                const mostraDati = !paid && dest && (dest.paypal || dest.iban);
                return (
                  <li
                    key={key + i}
                    onClick={() => toggleSettled(key)}
                    className={`cursor-pointer select-none bg-[#1F271E] px-3 py-2 rounded border transition-opacity ${paid ? 'border-[#8FBF8F]/40 opacity-60' : 'border-[#8F9E8B]/20'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${paid ? 'line-through text-gray-400' : ''}`}>
                        <span className="font-bold">{t.from}</span>
                        <span className="text-[#8F9E8B]"> → </span>
                        <span className="font-bold">{t.to}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={`font-rustic font-bold ${paid ? 'line-through text-gray-400' : 'text-[#D97706]'}`}>{money(t.amount)} €</span>
                        {paid && <span className="text-[#8FBF8F] text-sm font-bold">✓</span>}
                      </span>
                    </div>
                    {mostraDati && (
                      <div className="mt-1.5 pt-1.5 border-t border-[#8F9E8B]/20 space-y-1">
                        {[['PayPal', dest.paypal], ['IBAN', dest.iban]].filter((r) => r[1]).map((r) => (
                          <div key={r[0]} className="flex items-start gap-2">
                            <span className="text-[9px] uppercase font-bold text-[#8F9E8B] w-11 shrink-0 pt-0.5">{r[0]}</span>
                            <span className={`text-[10px] text-[#F0F4F1] break-all leading-snug ${r[0] === 'IBAN' ? 'font-mono' : ''}`}>{r[1]}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); copiaDato(`${r[0]} di ${t.to}`, r[1]); }}
                              className="ml-auto shrink-0 text-[9px] uppercase font-bold px-2 py-1 rounded bg-[#2D392C] border border-[#8F9E8B]/30 text-[#8F9E8B] hover:text-white"
                            >
                              {copied === `${r[0]} di ${t.to}` ? 'copiato ✓' : 'copia'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {/* Chi deve incassare ma non ha lasciato PayPal/IBAN. */}
            {(() => {
              const senza = [...new Set(s.transfers.map((t) => t.to))]
                .filter((n) => { const d = members.find((m) => m.name === n); return d && !d.paypal && !d.iban; });
              if (senza.length === 0) return null;
              return (
                <p className="text-[9px] text-gray-400 italic mt-2">
                  {senza.join(', ')} {senza.length === 1 ? 'deve' : 'devono'} ricevere ma non {senza.length === 1 ? 'ha' : 'hanno'} inserito
                  PayPal o IBAN: si aggiungono in <span className="font-bold">Membri</span>, con la "i" accanto al nome.
                </p>
              );
            })()}
          </div>
        )}
        {s.unattributed > 0.005 && (
          <p className="text-[9px] text-[#D97706] italic mt-2">
            Attenzione: {money(s.unattributed)} € di acquisti sono senza acquirente. Assegna un acquirente nel Taccuino per far quadrare i conti.
          </p>
        )}
        {/* Se dei soldi non sono in nessuna quota, i rimborsi NON possono
            quadrare: chi ha anticipato resta scoperto. Va detto qui, dove si
            guarda chi paga chi, non solo nella scheda delle quote. */}
        {c.nonRipartito > 0.005 && (
          <div className="mt-2 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
            <p className="text-[11px] text-[#5C4A3C] leading-snug">
              <span className="font-bold">I rimborsi non quadrano: {money(c.nonRipartito)} € non sono nelle quote di nessuno.</span>{' '}
              Chi ha anticipato quella cifra resterebbe scoperto. Guarda l'avviso in
              <span className="font-bold"> Quote</span>: dice quali spese sono e come sistemarle.
            </p>
          </div>
        )}
        {s.unknownBuyers.length > 0 && (
          <div className="mt-2 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
            <p className="text-[11px] text-[#5C4A3C] leading-snug">
              <span className="font-bold">Da controllare:</span> ci sono spese intestate a{' '}
              {s.unknownBuyers.map((u, i) => (
                <span key={u.name}>
                  {i > 0 ? ', ' : ''}<span className="font-bold">{u.name}</span> ({money(u.paid)} €)
                </span>
              ))}
              , che non {s.unknownBuyers.length === 1 ? 'è' : 'sono'} fra i membri. Compare comunque nei
              rimborsi: se è un nome scritto male o una persona eliminata, correggi l'acquirente nella
              <span className="font-bold"> Lista della Spesa</span>.
            </p>
          </div>
        )}
        {/* Le quote arrotondate a 0,10 € fanno raccogliere qualche centesimo
            in più (o in meno) dello speso: quei centesimi non hanno un
            destinatario, quindi l'ultimo passaggio non combacia col saldo.
            Senza spiegarlo sembra un errore di conto. */}
        {Math.abs(c.scarto) >= 0.005 && s.transfers.length > 0 && (
          <p className="text-[9px] text-gray-400 italic mt-2">
            Arrotondamento: i passaggi qui sopra valgono in tutto {money(Math.abs(c.scarto))} € in meno
            dei saldi indicati. È lo scarto delle quote arrotondate a 0,10 € (così non servono monetine da 1, 2 o 5 cent).
          </p>
        )}
        <p className="text-[9px] text-gray-400 italic mt-1">"Riceve" = ha anticipato più di quanto deve; "dà" = deve versare la differenza.</p>
      </div>
    );
  };

  // ---------- Backup (Export / Import) ----------
  const downloadJson = (filename, payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const exportData = () => {
    downloadJson(`bandone-backup-${toDateStr(new Date())}.json`, {
      version: 6, exportedAt: new Date().toISOString(),
      members, campData, purchases, gear, settled, equipment, toBuy, sepDays, freeDays, blocchi, receipts,
    });
    // Serve al promemoria serale per sapere che oggi è già stato fatto.
    try { localStorage.setItem(BACKUP_KEY, toDateStr(new Date())); } catch (e) { /* niente */ }
    setBackupOggi(toDateStr(new Date()));
  };

  // ---------- Promemoria del backup serale ----------
  // Le copie interne proteggono dagli errori dentro l'app; il file protegge da
  // telefono perso, rotto o svuotato. Quello richiede un gesto umano — il
  // browser non può scrivere un file senza conferma — quindi glielo si ricorda.
  // Compare SOLO nei giorni del campo, di sera, e solo se oggi c'è stato
  // davvero qualcosa da salvare: se non hai toccato niente non ha senso.
  const promemoriaBackup = () => {
    const oggi = toDateStr(new Date());
    if (oggi < CAMP_START || oggi > CAMP_END) return null;   // solo durante il campo
    if (new Date().getHours() < 20) return null;             // solo di sera
    if (backupOggi === oggi) return null;                    // già fatto (o rimandato)
    // "Qualcosa da salvare" = modifiche fatte OGGI su QUESTO telefono.
    const inizio = parseDate(oggi).getTime();
    const modifiche = logLeggi().filter((r) => r.o === 'io' && r.at >= inizio).length;
    if (modifiche === 0) return null;
    return modifiche;
  };

  const importData = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!d || typeof d !== 'object' || !Array.isArray(d.members)) {
          window.alert('File non valido: non è un backup dell\'app.');
          return;
        }
        // Importare un backup non aggiunge: SOSTITUISCE, e le voci che spariscono
        // vengono cancellate su tutti i telefoni. Prima la conferma diceva solo
        // "i dati attuali verranno sostituiti": chi apriva per sbaglio un file di
        // tre giorni prima azzerava il campo per tutti senza sapere né la data del
        // file né quanto stava buttando via.
        const quando = d.exportedAt ? new Date(d.exportedAt) : null;
        const eta = quando && !isNaN(quando.getTime())
          ? `Backup del ${quando.toLocaleString('it-IT')}`
          : 'Backup senza data';
        const dentro = `Contiene ${(d.members || []).length} membri, ${(d.purchases || []).length} spese, ` +
          `${Object.keys(d.campData || {}).length} giorni.`;
        const perse = perditeSeApplico(d);
        if (!window.confirm(`${eta}.\n${dentro}\n\n${avvisoPerdite(perse)}${avvisoBlocchi(d)}\n\nImportare?`)) return;
        scortaPrimaDi(perse);
        setMembers(d.members);
        if (d.campData && typeof d.campData === 'object') setCampData(applicaBlocchi(d.campData));
        if (Array.isArray(d.purchases)) setPurchases(d.purchases);
        if (Array.isArray(d.gear)) setGear(d.gear);
        if (Array.isArray(d.settled)) setSettled(d.settled);
        if (Array.isArray(d.equipment)) setEquipment(d.equipment);
        if (Array.isArray(d.toBuy)) setToBuy(d.toBuy);
        if (Array.isArray(d.sepDays)) setSepDays(d.sepDays);
        if (Array.isArray(d.freeDays)) setFreeDays(d.freeDays);
        if (Array.isArray(d.blocchi)) setBlocchi(d.blocchi);
        if (d.receipts && typeof d.receipts === 'object') setReceipts(d.receipts);
      } catch (err) {
        window.alert('File non valido: non è un backup leggibile.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---------- Chiusura del campo e archivio ----------
  // "Chiudi il campo" salva tutto (file + cloud), lo mette in Archivio e poi
  // azzera i dati di lavoro: l'app resta pronta per l'evento successivo.
  const campRange = () => {
    const days = Object.keys(campData).filter((d) => {
      const day = campData[d];
      if (!day) return false;
      const meals = day.meals || {};
      return Object.keys(meals).some((k) => meals[k] && (meals[k].lunch || meals[k].dinner));
    }).sort();
    if (days.length) return { from: days[0], to: days[days.length - 1] };
    return { from: CAMP_START, to: CAMP_END };
  };

  const openClose = () => {
    const hasData = members.length > 0 || purchases.length > 0 || toBuy.length > 0 || equipment.length > 0;
    if (!hasData) {
      window.alert('Non c\'è niente da chiudere: membri e spese sono già vuoti.');
      return;
    }
    setCloseName(BRAND.appTitle || 'Campo');
    setClosing(true);
  };

  const closeCamp = async () => {
    const name = (closeName || '').trim() || 'Campo';
    const range = campRange();
    const t = totals;
    const daPagare = saldiOttimizzati ? t.transfersOttimizzati : t.transfers;
    const unpaid = daPagare.filter((x) => !settled.includes(chiaveRimborso(x)));
    const warn = unpaid.length > 0
      ? `\n\nATTENZIONE: ci sono ancora ${unpaid.length} rimborsi non segnati come saldati.`
      : '';
    const conferma =
      `Chiudere "${name}"?\n\n` +
      `Verrà archiviato tutto (spese ${money(t.overallTotal)} €, ${members.length} membri) ` +
      'e scaricato un file di salvataggio con foto degli scontrini comprese.\n\n' +
      'Poi membri, presenze, spese, lista, attrezzatura, dotazioni aggiuntive e ' +
      'scontrini verranno AZZERATI su tutti i dispositivi, per ripartire con il ' +
      'prossimo evento.\n\n' +
      'Le foto della Galleria non si perdono: passano nell\'Archivio insieme ai conti.' + warn;
    if (!window.confirm(conferma)) return;

    const id = toDateStr(new Date()) + '-' + uid();
    const state = { members, campData, purchases, gear, settled, equipment, toBuy, sepDays, freeDays };
    const meta = {
      id,
      name,
      closedAt: new Date().toISOString(),
      from: range.from,
      to: range.to,
      report: buildReport(),
      totals: {
        overall: t.overallTotal,
        food: t.totalFood,
        drinks: t.totalDrinks,
        logistics: t.logisticsPurchases,
        equipment: t.equipBought,
        members: members.length,
        adults: members.filter((m) => !m.isChild).length,
        meals: t.adultMealsTotal,
        purchases: purchases.length,
      },
    };

    const CS = window.CloudSync;
    const online = !!(CS && CS.isConnected && CS.isConnected());

    // 1) Galleria: le foto non si buttano, si timbrano con questo archivio.
    //    Restano consultabili dall'Archivio e il campo nuovo riparte vuoto.
    if (online && CS.archivePhotos) meta.photos = await CS.archivePhotos(id);

    // 2) Copia su file (l'unica che contiene anche le foto degli scontrini).
    downloadJson(`bandone-archivio-${toDateStr(new Date())}.json`, { version: 6, archive: meta, ...state, receipts });

    // 3) Copia nel cloud, visibile anche dagli altri dispositivi.
    let cloudOk = false;
    if (online) {
      cloudOk = await CS.putArchive(id, meta, state);
      Object.keys(receipts).forEach((rid) => CS.deleteReceipt(rid));
    }

    // 4) Copia locale (senza foto, per non riempire la memoria del telefono).
    setArchives((prev) => [{ ...meta, state, cloud: cloudOk }, ...prev]);

    // 5) Azzeramento: i dati vuoti vengono sincronizzati e puliscono anche
    //    gli altri telefoni (le cancellazioni sono datate, quindi non tornano).
    setMembers([]);
    setCampData({});
    setPurchases([]);
    setToBuy([]);
    setEquipment([]);
    setSepDays([]);
    setFreeDays([]);
    setGear([]);
    setSettled([]);
    setBlocchi([]);
    setReceipts({});
    setBuying(null);
    setSelectedDateStr(defaultDateStr());
    setClosing(false);
    setActiveTab('archivio');
    window.alert(
      'Campo chiuso e archiviato.' +
      (cloudOk ? ' La copia è anche nel cloud.' : ' (Senza linea: la copia nel cloud verrà fatta a mano quando torna la rete — il file scaricato è già completo.)')
    );
  };

  const downloadArchive = async (a) => {
    let state = a.state;
    if (!state) {
      const CS = window.CloudSync;
      if (CS && CS.isConnected && CS.isConnected()) state = await CS.getArchive(a.id);
      if (!state) { window.alert('Per scaricare questo archivio serve la connessione.'); return; }
    }
    downloadJson(`bandone-archivio-${a.id}.json`, { version: 6, archive: a, ...state });
  };

  const removeArchive = (a) => {
    if (!window.confirm(`Eliminare l'archivio "${a.name}"?\nSe non hai il file scaricato, i dati di quel campo andranno persi.`)) return;
    setArchives((prev) => prev.filter((x) => x.id !== a.id));
    const CS = window.CloudSync;
    if (CS && CS.deleteArchive) CS.deleteArchive(a.id);
  };

  const shareArchive = async (a) => {
    const text = a.report || '';
    if (!text) { window.alert('Questo archivio non ha un resoconto salvato.'); return; }
    if (navigator.share) {
      try { await navigator.share({ title: a.name, text }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  // ---------- Pronto per il campo ----------
  // A Prato Lungo non c'è linea: chi apre l'app per la prima volta lassù non
  // ha né l'app in cache né i dati. Questi tre controlli dicono, PRIMA di
  // partire, se il telefono è a posto.
  const [readiness, setReadiness] = useState({ sw: false, cache: false });
  useEffect(() => {
    let vivo = true;
    const controlla = async () => {
      const sw = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
      let cache = false;
      try {
        if (window.caches) {
          const keys = await window.caches.keys();
          cache = keys.some((k) => k.indexOf('brigata-bandone-') === 0);
        }
      } catch (e) { /* niente cache: resta false */ }
      if (vivo) setReadiness({ sw, cache });
    };
    controlla();
    const id = setInterval(controlla, 5000);
    return () => { vivo = false; clearInterval(id); };
  }, []);

  const readyChecks = [
    { ok: readiness.sw && readiness.cache, titolo: 'App scaricata sul telefono',
      no: 'Resta su questa pagina qualche secondo con la linea attiva, poi chiudi e riapri l\'app.' },
    { ok: members.length > 0, titolo: 'Dati del campo ricevuti',
      no: 'Apri l\'app con la linea: membri, spese e liste arrivano da soli.' },
    // Si segnala SOLO un ripiego accertato: 'anon' è anche il valore di
    // partenza, prima ancora di provare a collegarsi, e farebbe lampeggiare
    // un allarme falso a ogni avvio.
    { ok: !(LOCK && LOCK.dbEmail && (cloud.authMode === 'anon-nopass' || cloud.authMode === 'anon-fallback')),
      titolo: 'Accesso al database a posto',
      no: 'Serve rientrare con la password del campo: l\'app te la chiede da sola quando c\'è linea.' },
  ];
  const readyOk = readyChecks.every((c) => c.ok);

  // ---------- Impostazioni: dati locali ----------
  // Versione installata, letta dal nome della cache del service worker.
  const [swVersion, setSwVersion] = useState('');
  useEffect(() => {
    if (!window.caches) return;
    window.caches.keys()
      .then((keys) => {
        const k = keys.find((x) => x.indexOf('brigata-bandone-') === 0);
        if (k) setSwVersion(k.replace('brigata-bandone-', ''));
      })
      .catch(() => {});
  }, []);

  // Svuota questo telefono. I dati nel cloud NON vengono toccati: alla
  // riapertura, se c'è linea, tornano da soli.
  const wipeLocal = () => {
    if (!window.confirm(
      'Cancellare tutti i dati dell\'app da QUESTO telefono?\n\n' +
      'Il cloud non viene toccato: con la linea i dati tornano da soli alla riapertura. ' +
      'Senza linea invece resteresti senza dati.'
    )) return;
    if (!window.confirm('Confermi? Verrà chiesta di nuovo la password.')) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.indexOf('cambusa_') === 0)
        .forEach((k) => localStorage.removeItem(k));
      sessionStorage.removeItem(UNLOCK_KEY);
    } catch (e) { /* ignora */ }
    window.location.reload();
  };

  // Quando si apre l'Archivio si recuperano anche i campi chiusi da altri
  // dispositivi (quelli che questo telefono non ha mai visto).
  useEffect(() => {
    if (activeTab !== 'archivio') return;
    const CS = window.CloudSync;
    if (!CS || !CS.listArchives || !CS.isConnected()) return;
    CS.listArchives().then((remote) => {
      if (!Array.isArray(remote) || !remote.length) return;
      setArchives((prev) => {
        const have = new Set(prev.map((a) => a.id));
        const add = remote.filter((a) => !have.has(a.id));
        if (!add.length) return prev;
        return [...prev, ...add].sort((a, b) => String(b.closedAt || '').localeCompare(String(a.closedAt || '')));
      });
    }).catch(() => {});
  }, [activeTab, cloud.connected]);

  // ---------- Render ----------
  // Il blocco viene prima di tutto: senza password non si vede nulla.
  if (locked) return <LockScreen reason={lockReason} onUnlock={() => { setLockReason(''); setLocked(false); }} />;

  if (showSplash) {
    return (
      <div
        onClick={() => setShowSplash(false)}
        className="fixed inset-0 bg-[#2D392C] flex flex-col items-center justify-center text-[#F0F4F1] z-50 cursor-pointer"
      >
        <div className="w-56 h-56 mb-6 rounded-full overflow-hidden shadow-2xl flex items-center justify-center border-4 border-[#8F9E8B] bg-[#F0F4F1]">
          <img src="./logo.png" alt={`Logo ${BRAND.groupName}`} className="w-full h-full object-cover" />
        </div>
        <h1 className="font-rustic text-3xl tracking-widest text-[#8F9E8B]">{BRAND.splashLine1}</h1>
        <h2 className="font-rustic text-xl tracking-widest text-[#F0F4F1]">{BRAND.splashLine2}</h2>
        <p className="mt-4 text-xs uppercase tracking-widest opacity-60">{BRAND.splashTagline}</p>
        <p className="absolute bottom-4 left-0 right-0 text-center text-[9px] tracking-wide text-[#8F9E8B]/70 px-6">
          {BRAND.credits}
        </p>
      </div>
    );
  }

  const tabs = {
    calendario: 'Calendario',
    menu: 'Menù',
    membri: 'Membri',
    presenze: 'Presenze',
    spesa: 'Spese Totali',
    lista: 'Lista della Spesa',
    attrezzatura: 'Attrezzatura',
    regole: 'Regole',
    dotazioni: 'Dotazioni personali',
    galleria: 'Galleria',
    archivio: 'Archivio',
    gioco: 'Aiuta Bandy',
    guida: 'Come funziona',
    impostazioni: 'Impostazioni',
  };

  // Icona per ogni area: nel menu aiuta a trovare la voce senza leggerle tutte.
  const TAB_ICONS = {
    calendario: '📅', menu: '🍝', presenze: '🍽️',
    lista: '🧾', attrezzatura: '🪛', spesa: '💶',
    membri: '👥', regole: '📜', dotazioni: '🎒', galleria: '📸',
    gioco: '🎮', archivio: '🗄️', guida: '❓', impostazioni: '⚙️',
  };

  // Il menu raggruppa le aree per momento d'uso: prima quello che si tocca
  // ogni giorno, poi i soldi, poi le cose del gruppo, in fondo il resto.
  const MENU_GROUPS = [
    { title: 'Pianificazione', items: ['calendario', 'menu', 'presenze'] },
    { title: 'Spese', items: ['lista', 'attrezzatura', 'spesa'] },
    { title: 'Il gruppo', items: ['membri', 'regole', 'dotazioni', 'galleria'] },
    { title: 'Altro', items: ['gioco', 'archivio', 'guida', 'impostazioni'] },
  ];

  // Acquirente: si sceglie dai membri, non si scrive. Un nome digitato a mano
  // con una lettera diversa creerebbe una persona fantasma nei saldi finali.
  const renderBuyerSelect = (value, onChange, extraClass) => (
    <>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C] ${extraClass || ''}`}
      >
        <option value="">— non indicato —</option>
        {members.map((m) => (<option key={m.id} value={m.name}>{m.name}</option>))}
        {/* Un acquirente registrato prima e non più fra i membri resta
            selezionabile, altrimenti aprendo la scheda si perderebbe. */}
        {value && !members.some((m) => m.name === value) && (
          <option value={value}>{value} (non più fra i membri)</option>
        )}
      </select>
      {members.length === 0 && (
        <p className="text-[9px] text-[#D97706] mt-1">Aggiungi prima le persone nella scheda Membri.</p>
      )}
    </>
  );

  const goTo = (tab) => { setActiveTab(tab); setMenuOpen(false); };

  // Guida: una "pill" per ogni area di lavoro.
  const GUIDE = [
    { k: 'calendario', icon: '📅', title: 'Calendario', body: 'Per ogni giorno: il meteo previsto di Pereto (massima, minima e probabilità di pioggia), il riepilogo cucina con quanti pasti preparare a pranzo e a cena, le note libere del giorno (promemoria, turni, cose da ricordare — il menù invece ha la sua scheda) e il collegamento al Menù. Scorri le settimane con le frecce: meteo, note e cucina si aggiornano sul giorno scelto. In cima, la riga "Conto separato" si apre solo quando serve: dentro ci sono i giorni da spuntare per far cassa a parte.' },
    { k: 'menu', icon: '🍝', title: 'Menù', body: 'Scheda a parte per scrivere cosa si mangia, giorno per giorno. In alto c\'è la stessa striscia dei giorni del Calendario: il giorno scelto è lo stesso nelle due schede, quindi puoi passare dall\'una all\'altra senza ricercarlo. Sotto vedi quanti pasti preparare a pranzo e a cena, e il foglio a righe dove scrivere una pietanza per riga. In fondo l\'elenco dei giorni del campo con la prima riga del menù già scritto: si vede a colpo d\'occhio cosa manca. Tutto si sincronizza: chi cucina lo trova già pronto.' },
    { k: 'membri', icon: '👥', title: 'Membri', body: 'Aggiungi tutte le persone del campo. Il pulsante Adulto/Bambino decide chi paga: i bambini mangiano gratis e il loro costo è ripartito sugli adulti. L\'elenco alimenta presenze, conti e la tendina dell\'acquirente quando registri una spesa: i nomi non si scrivono a mano, si scelgono, così un refuso non può creare una persona fantasma nei saldi. La "i" accanto al nome apre PayPal e IBAN: chi li compila se li vede comparire nei Saldi, accanto al rimborso che deve ricevere, con il tasto per copiarli.' },
    { k: 'presenze', icon: '🍽️', title: 'Presenze', body: 'Segna chi c\'è a pranzo e a cena, giorno per giorno: è la base del calcolo delle quote. Per fare in fretta apri "Segna in blocco": ci sono "Tutti a pranzo", "Tutti a cena" e "Copia da ieri". Stanno chiusi e chiedono conferma, perché cambiano le presenze di tutti su tutti i telefoni in un colpo solo; il conteggio del giorno si legge sulla riga anche da chiusa. Se qualcuno viene eliminato dai Membri e poi riaggiunto, l\'app lo tratta come una persona nuova e i pasti segnati prima restano attaccati alla vecchia: in quel caso compare un avviso arancione che ti fa riassegnare quelle presenze alla persona giusta, invece di lasciarle sparire dai conti. Durante il campo l\'app si apre già sulla data di oggi.' },
    { k: 'lista', icon: '🧾', title: 'Lista della Spesa', body: 'Due sezioni. "Da acquistare": la lista di cosa serve, con nome e quantità; il tasto "Segna come acquistata" apre una maschera che chiede prezzo, acquirente, tipologia e la foto dello scontrino, e sposta la voce in "Acquistato". "Acquistato": la cronologia di tutte le spese, più una maschera per registrare a mano ciò che non era in lista. Hai dimenticato lo scontrino? Tocca 📷 sulla voce anche dopo: puoi scattarlo o prenderlo dalla galleria.' },
    { k: 'attrezzatura', icon: '🪛', title: 'Attrezzatura', body: 'Elenco dell\'attrezzatura da comprare, con prezzo ed eventuale acquirente. Spunta una voce quando è acquistata: solo allora il costo entra nelle spese, come logistica. Con l\'icona 📷 alleghi lo scontrino, anche in un secondo momento. In fondo vedi il totale previsto e quello effettivamente acquistato; se indichi l\'acquirente, gli verrà rimborsata.' },
    { k: 'spesa', icon: '💶', title: 'Spese Totali', body: 'Quattro sotto-sezioni. Totali: quanto si è speso per cibo, bevande, logistica e attrezzatura. Quote: quanto costa a testa. Saldi: chi deve dare o ricevere. Dati: backup e sincronizzazione. I totali non si scrivono a mano, nascono dalla Lista della Spesa e dall\'attrezzatura acquistata.' },
    { k: 'conti', icon: '⚖️', title: 'Come si dividono', body: 'Cibo e bevande sono divisi per il numero di pasti: chi mangia di più paga di più. Logistica e attrezzatura sono una quota fissa uguale per ogni adulto presente: nessuno paga più di una quota. Le cifre sono arrotondate a 10 centesimi, così non servono monetine da 1, 2 o 5 cent.' },
    { k: 'separato', icon: '🍽️', title: 'Conto separato', body: 'Serve quando in certi giorni un gruppo fa la spesa per conto suo. In Calendario spunta quei giorni nel riquadro "Conto separato": le presenze di quei giorni fanno cassa a parte. Poi, quando registri una spesa di cibo o bevande, nel menu "Conto" scegli "Conto separato" invece di "Conto comune". Quella spesa si dividerà solo fra chi era presente ai pasti dei giorni spuntati, e quei pasti escono dal conto comune, così nessuno paga due volte. Logistica e attrezzatura restano sempre di tutti. Se non spunti nessun giorno non cambia niente: funziona tutto come prima.' },
    { k: 'saldi', icon: '🤝', title: 'Saldi e rimborsi', body: 'Per ogni persona l\'app confronta quanto ha anticipato con quanto deve, e dice se riceve o se deve dare. Sotto, in "Chi paga chi", trovi i pochi passaggi di denaro necessari per pareggiare tutto: tocca una riga quando il rimborso è stato fatto e resta barrata. Con "Condividi resoconto" mandi il riepilogo pronto nel gruppo WhatsApp.' },
    { k: 'dotazioni', icon: '🎒', title: 'Dotazioni personali', body: 'Cosa portarsi da casa: una dotazione base uguale per tutti (sedia personale, stoviglie e posate, borraccia, canovacci, luci LED) che non si modifica, e un elenco di aggiunte per questo campo che potete integrare quando serve.' },
    { k: 'backup', icon: '🛟', title: 'Backup e sicurezza', body: 'Ogni giorno viene salvata da sola una copia dei dati nel cloud: se qualcosa va storto, "Ripristino di emergenza" (in Spese Totali → Dati) permette di tornare a un giorno preciso. In più puoi esportare tutto su file con Esporta e ricaricarlo con Importa. Prima di eliminare qualcosa l\'app chiede sempre conferma.' },
    { k: 'sync', icon: '☁️', title: 'Sincronizzazione', body: 'La connessione al campo è automatica: quando c\'è linea i dati si allineano da soli fra i telefoni, in tempo reale, foto degli scontrini comprese. Senza linea si continua a lavorare normalmente e tutto viene inviato appena la rete torna. Se in due avete lavorato offline, al ritorno della linea le due versioni si uniscono voce per voce: nessuno cancella il lavoro dell\'altro. Il pallino in alto a destra indica se sei online o offline.' },
    { k: 'chiusura', icon: '🏁', title: 'Chiusura e Archivio', body: 'A conti fatti, in Spese Totali → Dati usa "Chiudi il campo": salva tutto (un file sul telefono e una copia nel cloud), lo mette in Archivio e azzera membri, presenze, spese, lista, attrezzatura, dotazioni aggiuntive e scontrini su tutti i dispositivi. L\'app resta pronta per il campo dell\'anno dopo. In Archivio rivedi il resoconto di ogni campo chiuso e puoi riscaricarne i dati; il file scaricato alla chiusura è l\'unico che contiene anche le foto degli scontrini, quindi conservalo.' },
    { k: 'galleria', icon: '📸', title: 'Galleria', body: 'L\'album del campo, da riempire una volta riscesi: scegli il tuo nome, scegli le foto e partono. È l\'unica scheda che ha bisogno della linea — le foto stanno solo nel cloud, perché tenerle anche sul telefono riempirebbe lo spazio che serve a presenze e spese. Ognuno può caricarne un numero fisso (si cambia in Impostazioni): non è un controllo, è un modo per far scegliere le foto belle invece di svuotare il rullino. Tocca una miniatura per vederla grande; da lì si può anche eliminare, e il posto liberato torna disponibile. Si guarda in due modi: "Album" sfoglia le foto come polaroid appoggiate su un paesaggio di montagna, una spinta col dito per pagina; "Griglia" le mette tutte in fila, ed è la vista comoda per cercarne una. Il tasto "Crea album completo" fa un PDF con TUTTE le foto della galleria sullo stesso paesaggio, quattro per pagina, dalla prima all\'ultima in ordine di scatto: da mandare nel gruppo o da stampare. Se invece ne vuoi solo alcune c\'è "Scegli tu quali foto", e lì l\'ordine è quello con cui le tocchi. Le foto vengono scaricate a piena qualità una a una, quindi con tante foto ci vuole pazienza e una linea decente: sopra le venti l\'app avvisa prima di partire.' },
    { k: 'gioco', icon: '🎮', title: 'Aiuta Bandy', body: 'Il passatempo del campo, in stile snake: scrivi il tuo nome, premi Gioca e il gioco parte a schermo intero. Si guida con le frecce a fondo schermo o scorrendo il dito sul campo da gioco. Devi raggiungere Bandy più volte che puoi: ogni Bandy preso allunga la canna e fa un punto. Si perde sbattendo contro un bordo o contro sé stessi. Ogni ' + LEVEL_EVERY + ' Bandy si cambia livello: si parte da Prato Lungo, si passa per Palmiro Togliatti e Rio de Janeiro, e si finisce in Thailandia. Ogni volta la velocità aumenta di una volta e mezzo e la lunghezza riparte da capo. Il punteggio migliore di ogni giocatore finisce in classifica, condivisa con tutto il campo quando c\'è linea. Il primo classificato sarà premiato da El Presidente in una sontuosa cerimonia (regola numero 2).' },
    { k: 'impostazioni', icon: '⚙️', title: 'Impostazioni', body: 'Aspetto: tema chiaro, scuro o automatico (segue il telefono) — comodo la sera in tenda. Blocco con password: puoi chiedere la password a ogni apertura e bloccare l\'app subito con "Blocca ora". Dati su questo telefono: backup immediato e, se presti o cambi telefono, "Cancella i dati da questo telefono" — il cloud non viene toccato e con la linea i dati tornano da soli. In fondo trovi la versione installata.' },
    { k: 'pronto', icon: '🎒', title: 'Pronto per il campo', body: 'In Impostazioni, in cima, ci sono tre spie: app scaricata sul telefono, dati del campo ricevuti, accesso al database a posto. Devono essere tutte verdi PRIMA di partire, perché a Prato Lungo non c\'è linea e lassù non si sistemano. Finché qualcosa manca, in Calendario compare un avviso che porta lì. Sistemarlo è sempre la stessa cosa: apri l\'app con la linea attiva e aspetta qualche secondo.' },
    { k: 'correggi', icon: '✏️', title: 'Correggere una spesa', body: 'Sbagliato un prezzo o l\'acquirente? Nella cronologia degli acquisti, e nell\'elenco dell\'attrezzatura, ogni riga ha una matita: apre la voce e permette di correggere nome, acquirente, prezzo, tipologia e conto, tenendo la foto dello scontrino attaccata. Non serve cancellare e rifare, che invece porterebbe via anche la foto. Se le voci sono tante, sopra la cronologia degli acquisti c\'e\' un campo di ricerca che filtra per nome, acquirente o tipologia e mostra il totale di quelle trovate; lo stesso campo c\'e\' anche sopra la lista di "Da acquistare", dove cerca per nome e quantita\'.' },
    { k: 'installa', icon: '📲', title: 'Installa l\'app', body: 'Conviene installarla, così si apre a schermo intero e funziona anche senza rete. Su iPhone: Condividi (il quadrato con la freccia) e poi "Aggiungi alla schermata Home". Su Android: menu del browser e "Installa app". Quando usciamo un aggiornamento, l\'app si aggiorna da sola: se non vedi una novità, chiudila e riaprila.' },
  ];

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-[#F0F4F1] border-x border-[#8F9E8B]/30 shadow-2xl pb-24">
      <header className="bg-[#2D392C] text-[#F0F4F1] p-4 text-center border-b-4 border-[#5C4A3C] relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex flex-col items-center justify-center gap-[3px] rounded hover:bg-white/10"
        >
          <span className="block w-5 h-0.5 bg-[#F0F4F1]"></span>
          <span className="block w-5 h-0.5 bg-[#F0F4F1]"></span>
          <span className="block w-5 h-0.5 bg-[#F0F4F1]"></span>
        </button>
        <h1 className="font-rustic text-2xl tracking-wide">{BRAND.appTitle}</h1>
        <p className="text-xs uppercase tracking-wider text-[#8F9E8B]">{tabs[activeTab]}</p>
        {/* Spia in alto a destra. "Da inviare" è il caso importante: sei
            online ma qualcosa non è ancora arrivato agli altri, e prima non
            lo diceva nessuno. */}
        {(() => {
          const foto = cloud.foto || 0;
          const sospeso = !!cloud.pending || foto > 0;
          const testo = sospeso
            ? (foto > 0 ? `${foto} ${foto === 1 ? 'foto' : 'foto'} da inviare` : 'Da inviare')
            : isOnline ? 'Online' : 'Offline';
          const colore = sospeso ? 'text-[#F6C177]' : isOnline ? 'text-[#8F9E8B]' : 'text-[#D97706]';
          const pallino = sospeso ? 'bg-[#F6C177] animate-pulse' : isOnline ? 'bg-[#8F9E8B]' : 'bg-[#D97706]';
          return (
            <span
              title={sospeso ? 'Qualcosa non è ancora arrivato agli altri: riprovo da solo, non serve fare niente.' : testo}
              className={`absolute top-3 right-3 flex items-center gap-1 text-[9px] uppercase font-bold ${colore}`}
            >
              <span className={`w-2 h-2 rounded-full ${pallino}`}></span>
              {testo}
            </span>
          );
        })()}
      </header>

      {/* Menu laterale (drawer): scorre da sinistra sopra il contenuto */}
      <div className={`fixed inset-0 z-40 ${menuOpen ? '' : 'pointer-events-none'}`}>
        <div
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
        ></div>
        {/* Il pannello è ancorato alla colonna dell'app (max-w-md centrata),
            così su desktop entra dal bordo dell'app e non da quello della finestra. */}
        <div className="absolute inset-0 max-w-md mx-auto overflow-hidden pointer-events-none">
        <nav
          className={`pointer-events-auto absolute left-0 top-0 bottom-0 w-72 max-w-[80%] bg-[#F0F4F1] border-r-4 border-[#5C4A3C] shadow-2xl p-4 space-y-1 overflow-y-auto transition-transform duration-300 ease-out ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center gap-3 border-b border-[#8F9E8B]/40 pb-3 mb-2">
            <img src="./logo.png" alt="" className="w-11 h-11 rounded-full object-cover border-2 border-[#8F9E8B] bg-white" />
            <div>
              <div className="font-rustic text-[#2D392C] leading-tight">{BRAND.appTitle}</div>
              <div className="text-[9px] uppercase tracking-wider text-[#8F9E8B]">{BRAND.groupName}</div>
            </div>
          </div>
          {MENU_GROUPS.map((group) => (
            <div key={group.title} className="pt-2 first:pt-0">
              <div className="flex items-center gap-2 px-1 pb-1">
                <span className="text-[9px] uppercase tracking-widest font-bold text-[#8F9E8B] shrink-0">{group.title}</span>
                <span className="flex-grow h-px bg-[#8F9E8B]/30"></span>
              </div>
              {group.items.map((tab) => (
                <button
                  key={tab}
                  onClick={() => goTo(tab)}
                  className={`w-full text-left px-3 py-2.5 rounded font-bold uppercase text-[13px] tracking-wide transition-colors flex items-center gap-2.5 ${
                    activeTab === tab ? 'bg-[#2D392C] text-[#F0F4F1]' : 'text-[#2D392C] hover:bg-[#E2EAE4]'
                  }`}
                >
                  <span className="text-base leading-none w-5 text-center shrink-0">{TAB_ICONS[tab]}</span>
                  <span className="min-w-0 truncate">{tabs[tab]}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        </div>
      </div>

      {/* Suggerimento installazione app */}
      {showInstallHint && (
        <div className="bg-[#D97706]/15 border-b border-[#D97706]/40 px-4 py-2.5 flex items-start gap-2">
          <span className="text-base leading-none mt-0.5">📲</span>
          <p className="flex-grow text-[11px] text-[#5C4A3C] leading-snug">
            <span className="font-bold">{isDesktop ? 'Installa l\'app sul computer:' : 'Installa l\'app sul telefono:'}</span>{' '}
            {isIOS
              ? 'tocca Condividi (il quadrato con la freccia in su) e poi "Aggiungi alla schermata Home".'
              : isDesktop
              ? 'clicca l\'icona di installazione nella barra degli indirizzi (o menu ⋮ → "Installa").'
              : 'apri il menu del browser (⋮) e tocca "Installa app" (o "Aggiungi a schermata Home").'}
            {' '}Una volta installata funziona anche senza linea.
          </p>
          <button onClick={dismissInstallHint} aria-label="Chiudi avviso" className={bottoneIcona('neutro', 'shrink-0')}>&times;</button>
        </div>
      )}

      {/* Promemoria del backup serale, nei giorni del campo. Solo in modalità
          tecnica: il backup di fine giornata è un compito del telefono che
          tiene i conti, non un'ansia da distribuire a tutti. */}
      {(() => {
        if (!admin) return null;
        const modifiche = promemoriaBackup();
        if (!modifiche) return null;
        return (
          <div className="bg-[#5C4A3C]/12 border-y-2 border-[#5C4A3C]/40 px-4 py-3">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none mt-0.5">🎒</span>
              <div className="min-w-0 flex-grow">
                <p className="text-[11px] text-[#5C4A3C] leading-snug">
                  <span className="font-bold">Fine giornata.</span> Oggi hai fatto {modifiche} {modifiche === 1 ? 'modifica' : 'modifiche'}.
                  Salva il file di backup: se il telefono si perde o si rompe, è l'unica copia che resta.
                </p>
                <div className="flex gap-2 mt-2">
                  <button onClick={exportData} className={bottone('bruno', 'minuscolo')}>
                    Salva il backup
                  </button>
                  <button
                    onClick={() => {
                      const oggi = toDateStr(new Date());
                      try { localStorage.setItem(BACKUP_KEY, oggi); } catch (e) { /* niente */ }
                      setBackupOggi(oggi);
                    }}
                    className={bottone('secondario', 'minuscolo')}
                  >
                    Ho già fatto
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Memoria del telefono piena: la cronologia delle modifiche non si
          salva più, e alla riapertura questo telefono perderebbe i confronti
          con gli altri. È il tipo di guasto che non si vede: va detto. */}
      {spazioPieno && (
        <div className="bg-[#D97706]/15 border-y-2 border-[#D97706]/50 px-4 py-3">
          <p className="text-[11px] text-[#5C4A3C] leading-snug">
            <span className="font-bold">La memoria di questo telefono è piena.</span> L'app continua a
            funzionare, ma libera un po' di spazio appena puoi (bastano poche foto o un'app in meno), così
            ogni modifica resta al sicuro.
            {admin && (
              <> In dettaglio: la cronologia delle modifiche non si salva più, e alla riapertura questo
              telefono perderebbe i confronti con gli altri. Si libera qualcosa anche da
              <span className="font-bold"> Impostazioni → Registro modifiche → Svuota</span>.</>
            )}
          </p>
        </div>
      )}

      {/* Qualcuno ha eliminato una persona che aveva presenze in un giorno
          bloccato: è stata rimessa in elenco. Lo vedono tutti, come sopra:
          chi l'ha eliminata deve sapere che non è stata eliminata davvero. */}
      {membriSalvati.length > 0 && (
        <div className="bg-[#D97706]/15 border-y-2 border-[#D97706]/50 px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">🔒</span>
            <div className="min-w-0 flex-grow">
              <p className="text-[11px] text-[#5C4A3C] leading-snug">
                <span className="font-bold">
                  {membriSalvati.length === 1
                    ? `${membriSalvati[0]} è stata rimessa fra i membri.`
                    : `${membriSalvati.length} persone sono state rimesse fra i membri: ${membriSalvati.slice(0, 4).join(', ')}${membriSalvati.length > 4 ? '…' : ''}.`}
                </span>{' '}
                {membriSalvati.length === 1 ? 'Era stata eliminata' : 'Erano state eliminate'} da un altro
                telefono, ma {membriSalvati.length === 1 ? 'ha' : 'hanno'} presenze in giorni con le
                presenze bloccate: eliminarl{membriSalvati.length === 1 ? 'a' : 'e'} avrebbe cambiato le
                quote di quei giorni. Per eliminarl{membriSalvati.length === 1 ? 'a' : 'e'} davvero, prima
                si sbloccano quei giorni dalla scheda <span className="font-bold">Presenze</span>.
              </p>
              <button
                onClick={() => setMembriSalvati([])}
                className={bottone('secondario', 'minuscolo', 'mt-2')}
              >
                Ho capito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conti chiusi e qualcuno ha comunque toccato una spesa: non si butta in
          silenzio, si dice. Vale per tutti, non solo in modalità tecnica: chi
          ha registrato la spesa deve sapere che non è entrata. */}
      {respinte.length > 0 && (
        <div className="bg-[#D97706]/15 border-y-2 border-[#D97706]/50 px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">🔒</span>
            <div className="min-w-0 flex-grow">
              <p className="text-[11px] text-[#5C4A3C] leading-snug">
                <span className="font-bold">I conti sono chiusi: {respinte.length} {respinte.length === 1 ? 'modifica è stata respinta' : 'modifiche sono state respinte'}.</span>{' '}
                {respinte.slice(0, 3).map((r, i) => (
                  <span key={r.che + r.nome + i}>
                    {i > 0 ? ' · ' : ''}{r.che} "{r.nome}" {r.azione} ({money(r.quanto)} €)
                  </span>
                ))}
                {respinte.length > 3 ? ` …e altre ${respinte.length - 3}` : ''}.
                {' '}Se vanno accettate, riapri i conti da <span className="font-bold">Spese Totali → Dati</span> e rifalle.
              </p>
              <button
                onClick={() => setRespinte([])}
                className={bottone('secondario', 'minuscolo', 'mt-2')}
              >
                Ho capito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orologi che non vanno d'accordo. Va in modalità tecnica perché la
          cosa da fare è chiedere in giro chi ha la data sbagliata, e questo
          lo fa chi tiene i conti. */}
      {admin && orologioFuori && (
        <div className="bg-[#D97706]/15 border-y-2 border-[#D97706]/50 px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">🕐</span>
            <div className="min-w-0 flex-grow">
              <p className="text-[11px] text-[#5C4A3C] leading-snug">
                <span className="font-bold">
                  Un telefono ha l'orologio avanti di {Math.round(orologioFuori.avanti / 86400000)} giorni.
                </span>{' '}
                Le sue modifiche vincono su tutte le altre anche quando sono più vecchie, e le correzioni
                fatte dagli altri vengono scartate senza dirlo. Chiedete in giro chi ha la data sbagliata e
                fategliela sistemare (oppure è questo telefono a essere indietro).
              </p>
              <button
                onClick={() => { setOrologioFuori(null); try { localStorage.removeItem(OROLOGIO_KEY); } catch (e) { /* niente */ } }}
                className={bottone('secondario', 'minuscolo', 'mt-2')}
              >
                Sistemato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Una sincronizzazione ha appena tolto delle voci: si dice subito, in
          qualsiasi scheda, e si può annullare finché la copia di scorta c'è.
          Solo in modalità tecnica: la copia di scorta si salva comunque su
          ogni telefono, ma la decisione di annullare spetta a chi tiene i
          conti — quindici tasti "Annulla" in giro sono più pericolosi del
          problema che risolvono. */}
      {admin && lostSync && (
        <div className="bg-[#D97706]/15 border-y-2 border-[#D97706]/50 px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <div className="min-w-0 flex-grow">
              <p className="text-[11px] text-[#5C4A3C] leading-snug">
                <span className="font-bold">
                  Qualcuno ha appena cancellato {lostSync.n} voci
                  {lostSync.quando ? ` (${new Date(lostSync.quando).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })})` : ''}.
                </span>
                {lostSync.che ? ` ${lostSync.che}.` : ''}
                {' '}Se non è stato qualcuno di voi, annulla: torna tutto com'era, su tutti i telefoni.
              </p>
              <div className="flex gap-2 mt-2">
                <button onClick={annullaSync} className={bottone('avviso', 'minuscolo')}>
                  Annulla la sincronizzazione
                </button>
                <button onClick={() => setLostSync(null)} className={bottone('secondario', 'minuscolo')}>
                  Va bene così
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-grow p-4">
        {/* ---------- CALENDARIO ---------- */}
        {activeTab === 'calendario' && (
          <div className="space-y-4">
            {!readyOk && (
              <button
                onClick={() => goTo('impostazioni')}
                className="w-full bg-[#D97706]/10 border border-[#D97706]/40 rounded-lg p-3 text-left flex items-start gap-2 hover:bg-[#D97706]/15"
              >
                <span className="text-base leading-none mt-0.5">⚠️</span>
                <span className="text-[11px] text-[#5C4A3C] leading-snug">
                  <span className="font-bold">Questo telefono non è ancora pronto per il campo.</span>{' '}
                  Al campo non c'è linea: tocca qui per vedere cosa manca, finché sei collegato.
                </span>
              </button>
            )}
            {/* Presenze rimaste senza padrone: si vedono anche da qui, altrimenti
                se ne accorge solo chi apre Presenze. */}
            {(() => {
              const orfane = presenzeOrfane();
              if (orfane.length === 0) return null;
              const totale = orfane.reduce((s, o) => s + o.pasti, 0);
              return (
                <button
                  onClick={() => goTo('presenze')}
                  className="w-full bg-[#D97706]/10 border border-[#D97706]/40 rounded-lg p-3 text-left flex items-start gap-2 hover:bg-[#D97706]/15"
                >
                  <span className="text-base leading-none mt-0.5">🍽️</span>
                  <span className="text-[11px] text-[#5C4A3C] leading-snug">
                    <span className="font-bold">{totale} presenze non contano nei conti.</span>{' '}
                    Sono di {orfane.length === 1 ? 'una persona' : `${orfane.length} persone`} eliminate e riaggiunte fra i Membri:
                    tocca qui per riattaccarle a chi di dovere.
                  </span>
                </button>
              );
            })()}

            {renderWeekStrip()}

            {/* Giorni del conto separato: le presenze di questi giorni fanno
                cassa a parte (vedi calculateTotals). Sta chiuso: è una cosa che
                si imposta una volta, non a ogni apertura del Calendario. */}
            <div className="bg-white rounded-lg border border-[#8F9E8B]/30 shadow-sm overflow-hidden">
              <button
                onClick={() => setSepOpen((v) => !v)}
                className={bottoneRiga()}
              >
                <span className="text-[10px] uppercase font-bold text-[#5C4A3C] shrink-0">Conto separato</span>
                <span className="ml-auto text-[9px] text-gray-500 truncate">
                  {sepDays.length === 0 ? 'nessun giorno' : `${sepDays.length} ${sepDays.length === 1 ? 'giorno' : 'giorni'} in totale`}
                </span>
                <span className={`text-[10px] text-[#5C4A3C] shrink-0 transition-transform ${sepOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {sepOpen && (<div className="px-3 pb-3">
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((d) => {
                  const dateStr = toDateStr(d);
                  const on = sepDays.includes(dateStr);
                  return (
                    <label
                      key={dateStr}
                      title={`${d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}: conto separato`}
                      className={`flex flex-col items-center gap-0.5 py-1.5 rounded cursor-pointer border ${
                        on ? 'bg-[#5C4A3C]/15 border-[#5C4A3C]/50' : 'bg-[#F0F4F1]/50 border-transparent hover:bg-[#E2EAE4]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleSepDay(dateStr)}
                        className="w-3.5 h-3.5 accent-[#5C4A3C]"
                      />
                      <span className={`text-[9px] font-bold ${on ? 'text-[#5C4A3C]' : 'text-gray-400'}`}>{d.getDate()}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[9px] text-gray-400 italic mt-2 leading-snug">
                Spunta i giorni che fanno cassa a parte: cibo e bevande registrati sul
                <span className="font-bold"> conto separato</span> si dividono solo fra chi era presente ai pasti di quei giorni.
                Gli altri giorni restano nel conto comune. Logistica e attrezzatura restano sempre in comune.
              </p>
              </div>)}
            </div>

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-dashed border-[#8F9E8B] pb-1">
                {parseDate(selectedDateStr).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>

              {/* Meteo previsto per il giorno selezionato */}
              {(() => {
                const loc = window.CAMP_LOCATION;
                const locOk = loc && typeof loc.lat === 'number' && typeof loc.lon === 'number';
                const wx = weather.byDate[selectedDateStr];
                return (
                  <div className="bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20 space-y-1">
                    <div className="flex items-center gap-2">
                      {!locOk ? (
                        <span className="text-[10px] text-gray-400 italic">Meteo: località del campo da impostare.</span>
                      ) : wx ? (() => {
                        // La faccia della giornata e', quando si sa, la
                        // condizione prevalente delle ore diurne; il brutto si
                        // nomina a parte col suo momento. I millimetri dicono
                        // se e' una spruzzata o una lavata: "40%" da solo no.
                        const r = raccontaMeteo(wx);
                        return (
                        <>
                          <span className="text-2xl leading-none">{r.icon}</span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-[#2D392C] leading-tight">
                              {r.label}{r.coda ? <span className="font-normal">, {r.coda}</span> : null}
                            </span>
                            {loc.label && <span className="text-[9px] text-gray-400">{loc.label}</span>}
                          </div>
                          <span className="ml-auto text-xs text-gray-600 font-bold shrink-0 text-right">
                            {Math.round(wx.tmax)}° / {Math.round(wx.tmin)}°
                            {r.mm
                              ? <span className="text-[#5C8AA8]"> · 💧{r.mm}</span>
                              : wx.rain != null ? <span className="text-[#5C8AA8]"> · 💧{wx.rain}%</span> : null}
                          </span>
                        </>
                        );
                      })() : (
                        <span className="text-[10px] text-gray-400 italic">
                          Previsione non ancora disponibile per questo giorno{isOnline ? ' (copre 16 giorni in avanti)' : ' (offline)'}.
                        </span>
                      )}
                    </div>
                    {/* Stessa previsione per tutti: si vede quando è stata
                        scaricata, così è chiaro se qualcuno ha numeri vecchi. */}
                    {locOk && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#8F9E8B]/20">
                        {(() => {
                          const vecchia = weather.fetchedAt && Date.now() - weather.fetchedAt > METEO_VECCHIO;
                          return (
                            <span className={`text-[9px] ${vecchia ? 'text-[#D97706] font-bold' : 'text-gray-400'}`}>
                              {weather.fetchedAt
                                ? `${vecchia ? '⚠ Previsioni vecchie, del' : 'Previsioni del'} ${new Date(weather.fetchedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} alle ${new Date(weather.fetchedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}${vecchia ? ': altrove ne trovi di più fresche.' : ' · uguali per tutto il campo'}`
                                : 'Previsioni non ancora scaricate.'}
                            </span>
                          );
                        })()}
                        <button
                          onClick={() => fetchWeather(true)}
                          disabled={!isOnline || wxBusy}
                          className={bottone('secondario', 'minuscolo', 'shrink-0')}
                        >
                          {wxBusy ? '…' : 'Aggiorna'}
                        </button>
                      </div>
                    )}
                    {/* Diagnostica: da dove viene il meteo. Serve a controllare
                        che il modello stia guardando il prato e non il paese
                        giù a valle. Roba da modalità tecnica. */}
                    {admin && locOk && (
                      <div className="text-[9px] text-gray-400 font-mono pt-0.5">
                        📍 {loc.lat}, {loc.lon}
                        {typeof loc.alt === 'number' ? ` · quota dichiarata ${loc.alt} m` : ' · quota non dichiarata'}
                        {typeof weather.quota === 'number' ? ` · modello a ${Math.round(weather.quota)} m` : ''}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Riepilogo cucina del giorno: quanti pasti preparare */}
              {(() => {
                const lunch = members.filter((m) => getMeal(selectedDateStr, m.id).lunch).length;
                const dinner = members.filter((m) => getMeal(selectedDateStr, m.id).dinner).length;
                return (
                  <div className="flex items-center gap-2 bg-[#2D392C]/5 px-3 py-2 rounded border border-[#2D392C]/15">
                    <span className="text-xl leading-none">🍲</span>
                    <span className="text-[11px] uppercase font-bold text-gray-500">Cucina</span>
                    <span className="ml-auto text-sm font-bold text-[#2D392C]">
                      {lunch} <span className="text-[10px] font-normal text-gray-500">a pranzo</span>
                      <span className="text-gray-300"> · </span>
                      {dinner} <span className="text-[10px] font-normal text-gray-500">a cena</span>
                    </span>
                  </div>
                );
              })()}

              {/* Note libere del giorno: promemoria, turni, cose da ricordare.
                  Si sincronizzano come tutto il resto. */}
              <div>
                <label className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wide">Note del giorno</span>
                  {(getDayData(selectedDateStr).appunti || '').trim() && (
                    <span className="text-[9px] text-[#2D392C]">✔ scritte</span>
                  )}
                </label>
                <textarea
                  value={getDayData(selectedDateStr).appunti || ''}
                  onChange={(e) => updateDayData(selectedDateStr, 'appunti', e.target.value)}
                  rows={3}
                  placeholder="Promemoria del giorno…"
                  className="w-full p-3 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm leading-snug focus:outline-none focus:border-[#2D392C] resize-y"
                />
                <p className="text-[9px] text-gray-400 italic mt-1">
                  Promemoria del giorno, visibili a tutti. Il <span className="font-bold">menù</span> ha la sua scheda: qui ci vanno le altre cose.
                </p>
              </div>

              {/* Scorciatoia alla scheda Menù, che lavora sullo stesso giorno */}
              <button
                onClick={() => goTo('menu')}
                className={bottone('secondario', 'piccolo', 'w-full')}
              >
                🍝 Menù del giorno
                {(getDayData(selectedDateStr).note || '').trim() ? ' · già scritto' : ' · da scrivere'}
              </button>
            </div>
          </div>
        )}

        {/* ---------- MENÙ ---------- */}
        {activeTab === 'menu' && (
          <div className="space-y-4">
            {/* Stessa striscia del Calendario: il giorno scelto è condiviso */}
            {renderWeekStrip()}

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-2">
              <div className="flex items-baseline justify-between border-b border-dashed border-[#8F9E8B] pb-1">
                <h3 className="font-rustic text-lg text-[#2D392C]">
                  Menù di {parseDate(selectedDateStr).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
              </div>

              {/* Quante persone stai cucinando: serve proprio mentre scrivi */}
              {(() => {
                const lunch = members.filter((m) => getMeal(selectedDateStr, m.id).lunch).length;
                const dinner = members.filter((m) => getMeal(selectedDateStr, m.id).dinner).length;
                return (
                  <div className="flex items-center gap-2 bg-[#2D392C]/5 px-3 py-2 rounded border border-[#2D392C]/15">
                    <span className="text-xl leading-none">🍲</span>
                    <span className="text-[11px] uppercase font-bold text-gray-500">Da preparare</span>
                    <span className="ml-auto text-sm font-bold text-[#2D392C]">
                      {lunch} <span className="text-[10px] font-normal text-gray-500">a pranzo</span>
                      <span className="text-gray-300"> · </span>
                      {dinner} <span className="text-[10px] font-normal text-gray-500">a cena</span>
                    </span>
                  </div>
                );
              })()}

              <textarea
                value={getDayData(selectedDateStr).note}
                onChange={(e) => updateDayData(selectedDateStr, 'note', e.target.value)}
                placeholder="Cosa si mangia…"
                className="lined-paper w-full p-3 rounded-lg border border-[#8F9E8B]/30 focus:outline-none focus:border-[#2D392C] resize-y"
              />
              <p className="text-[9px] text-gray-400 italic">Una pietanza per riga. Si sincronizza con gli altri: chi cucina lo trova già scritto.</p>
            </div>

            {/* Colpo d'occhio sui giorni del campo con il menù già scritto */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Giorni del campo</h3>
              <ul className="space-y-1.5">
                {(() => {
                  const giorni = [];
                  for (let d = parseDate(CAMP_START); toDateStr(d) <= CAMP_END; d.setDate(d.getDate() + 1)) {
                    giorni.push(toDateStr(d));
                  }
                  return giorni.map((ds) => {
                    const testo = (getDayData(ds).note || '').trim();
                    const prima = testo.split('\n')[0] || '';
                    return (
                      <li key={ds}>
                        <button
                          onClick={() => { setSelectedDateStr(ds); setCurrentDate(parseDate(ds)); }}
                          className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded border transition-colors ${
                            ds === selectedDateStr ? 'bg-[#5C4A3C]/15 border-[#5C4A3C]/50' : 'bg-[#F0F4F1]/60 border-[#8F9E8B]/20 hover:bg-[#E2EAE4]'
                          }`}
                        >
                          <span className="text-[11px] font-bold text-[#2D392C] shrink-0 w-16">
                            {parseDate(ds).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}
                          </span>
                          <span className={`text-[10px] truncate ${testo ? 'text-gray-600' : 'text-gray-400 italic'}`}>
                            {testo ? prima : 'da scrivere'}
                          </span>
                          {testo && <span className="ml-auto text-[10px] shrink-0">✔</span>}
                        </button>
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          </div>
        )}

        {/* ---------- MEMBRI ---------- */}
        {activeTab === 'membri' && (
          <div className="space-y-4">
            {/* Stessa persona in elenco due volte: succede quando due telefoni
                senza linea la aggiungono tutti e due. Non è un errore di
                sincronizzazione — sono due voci nuove legittime — ma nei conti
                diventa due persone, e la quota sbaglia per TUTTI. */}
            {membriDoppi().map((g) => (
              <div key={g[0].id} className="bg-[#D97706]/10 border-2 border-[#D97706]/40 rounded-lg p-3 space-y-2">
                <p className="text-[11px] text-[#5C4A3C] leading-snug">
                  <span className="font-bold">"{g[0].name}" è in elenco {g.length} volte.</span>{' '}
                  Capita quando due telefoni senza linea aggiungono la stessa persona. Così nei conti
                  vale {g.length} persone: <span className="font-bold">la quota di tutti sbaglia</span>.
                </p>
                <button
                  onClick={() => unisciDoppi(g)}
                  className={bottone('avviso', 'piccolo', 'w-full')}
                >
                  Unisci in una sola scheda
                </button>
                <p className="text-[9px] text-gray-500 italic leading-snug">
                  Le presenze segnate sulle due schede si sommano: non si perde niente. Se invece sono
                  davvero due persone diverse, aggiungi un cognome o un soprannome a una delle due.
                </p>
              </div>
            ))}

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aggiungi Membro</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMember()}
                  placeholder="Nome e cognome"
                  className="flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                />
                <button onClick={addMember} className={bottoneIcona('pieno')}>+</button>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={newMemberChild} onChange={(e) => setNewMemberChild(e.target.checked)} />
                Bambino (pasti gratis)
              </label>
            </div>

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">
                Membri ({members.length})
              </h3>
              {members.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessun membro. Aggiungine uno per iniziare a segnare le presenze.</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((m) => (
                    <li key={m.id} className="bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-[#2D392C] truncate">
                          {m.name}
                          {(m.paypal || m.iban) && <span className="ml-1.5 text-[9px] text-[#8F9E8B]" title="Ha inserito i dati per il rimborso">💳</span>}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setInfoMember((v) => (v === m.id ? null : m.id))}
                            aria-label={`Dati di pagamento di ${m.name}`}
                            title="Dati per il rimborso (PayPal / IBAN)"
                            className={`w-6 h-6 rounded-full border-2 font-serif italic font-bold text-[11px] leading-none flex items-center justify-center ${infoMember === m.id ? 'bg-[#2D392C] border-[#2D392C] text-white' : 'bg-white border-[#8F9E8B] text-[#5C4A3C]'}`}
                          >
                            i
                          </button>
                          <button
                            onClick={() => toggleChild(m.id)}
                            className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${m.isChild ? 'bg-[#D97706] text-white' : 'bg-gray-200 text-gray-500'}`}
                          >
                            {m.isChild ? 'Bambino' : 'Adulto'}
                          </button>
                          <button onClick={() => removeMember(m.id)} className={bottoneIcona('distruttivo')}>&times;</button>
                        </div>
                      </div>
                      {/* Dati per farsi rimborsare dopo il campo. Si aprono con la "i". */}
                      {infoMember === m.id && (
                        <div className="mt-2.5 pt-2.5 border-t border-[#8F9E8B]/30 space-y-2">
                          <p className="text-[10px] text-gray-500 leading-snug">
                            Come farsi rimborsare a campo finito. Facoltativi: si vedono in
                            <span className="font-bold"> Spese Totali → Saldi</span>, accanto a chi deve ricevere.
                          </p>
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-gray-500 tracking-wide mb-1">PayPal</label>
                            <input
                              type="text"
                              inputMode="email"
                              value={m.paypal || ''}
                              onChange={(e) => setMemberField(m.id, 'paypal', e.target.value)}
                              placeholder="paypal.me/nome oppure email"
                              className="w-full p-2 bg-white border border-[#8F9E8B]/40 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-gray-500 tracking-wide mb-1">IBAN</label>
                            <input
                              type="text"
                              value={m.iban || ''}
                              onChange={(e) => setMemberField(m.id, 'iban', e.target.value.toUpperCase())}
                              onBlur={(e) => { const p = ibanPretty(e.target.value); if (p !== (m.iban || '')) setMemberField(m.id, 'iban', p); }}
                              placeholder="IT00 X000 0000 0000 0000 0000 000"
                              className="w-full p-2 bg-white border border-[#8F9E8B]/40 rounded text-xs font-mono focus:outline-none focus:border-[#2D392C]"
                            />
                            {/* Un IBAN sbagliato si scopre solo quando il bonifico torna indietro. */}
                            {(m.iban || '').trim() !== '' && (
                              ibanValid(m.iban)
                                ? <p className="text-[9px] text-[#2D392C] mt-1">✔ IBAN formalmente corretto</p>
                                : <p className="text-[9px] text-[#D97706] mt-1">Controlla l'IBAN: non supera la verifica standard (manca o è sbagliato un carattere).</p>
                            )}
                          </div>
                          <p className="text-[9px] text-gray-400 italic leading-snug">
                            Finiscono nel database del campo, come tutto il resto: li vede chi ha la password dell'app.
                            Alla chiusura del campo vengono azzerati insieme ai membri.
                          </p>
                        </div>
                      )}
                      {/* Esenzione attrezzatura: nascosta finche' FEATURES.equipExemption e' false */}
                      {FEATURES.equipExemption && (
                        <button
                          onClick={() => toggleEquipExempt(m.id)}
                          aria-label="Esenzione attrezzatura"
                          className="mt-1.5 flex items-center gap-2 text-left"
                        >
                          <span className={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-[10px] font-bold ${m.equipExempt ? 'bg-[#5C4A3C] border-[#5C4A3C] text-white' : 'bg-white border-[#8F9E8B]'}`}>
                            {m.equipExempt ? '✓' : ''}
                          </span>
                          <span className={`text-[10px] ${m.equipExempt ? 'font-bold text-[#5C4A3C]' : 'text-gray-500'}`}>
                            Esente attrezzatura
                          </span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ---------- PRESENZE ---------- */}
        {activeTab === 'presenze' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm">
              <button onClick={() => navigateDate(-1)} className={bottoneIcona('tenue')}>&larr;</button>
              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => { if (e.target.value) { setSelectedDateStr(e.target.value); setCurrentDate(parseDate(e.target.value)); } }}
                className="bg-transparent border-none text-sm focus:outline-none font-bold text-center w-full mx-2 text-[#5C4A3C]"
              />
              <button onClick={() => navigateDate(1)} className={bottoneIcona('tenue')}>&rarr;</button>
            </div>

            {/* Presenze appese a membri che non esistono più: succede quando
                qualcuno viene eliminato e riaggiunto. Sparirebbero dai conti in
                silenzio, quindi qui si segnalano e si riattaccano. */}
            {(() => {
              const orfane = presenzeOrfane();
              if (orfane.length === 0) return null;
              const totale = orfane.reduce((s, o) => s + o.pasti, 0);
              return (
                <div className="bg-[#D97706]/10 border-2 border-[#D97706]/50 rounded-lg p-3 space-y-3">
                  <p className="text-[11px] text-[#5C4A3C] leading-snug">
                    <span className="font-bold">Ci sono {totale} presenze senza padrone.</span> Succede quando una
                    persona viene eliminata dai Membri e poi riaggiunta: per l'app è una persona nuova, e i pasti
                    segnati prima restano attaccati alla vecchia — spariti dall'elenco e dai conti.
                    Riattaccali alla persona giusta.
                  </p>
                  <ul className="space-y-2">
                    {orfane.map((o) => (
                      <li key={o.id} className="bg-white/70 rounded border border-[#8F9E8B]/30 p-2.5 space-y-2">
                        <p className="text-[11px] text-[#2D392C] leading-snug">
                          <span className="font-bold">{o.nome || 'Persona non più in elenco'}</span>
                          {' — '}{o.pasti} {o.pasti === 1 ? 'pasto' : 'pasti'} su {o.giorni.length} {o.giorni.length === 1 ? 'giorno' : 'giorni'}
                          <span className="block text-[9px] text-gray-500">
                            {o.giorni.slice(0, 6).map((d) => parseDate(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })).join(' · ')}
                            {o.giorni.length > 6 ? ' …' : ''}
                          </span>
                        </p>
                        <div className="flex gap-2">
                          <select
                            value={orfanoScelte[o.id] || ''}
                            onChange={(e) => setOrfanoScelte((prev) => ({ ...prev, [o.id]: e.target.value }))}
                            className="flex-grow min-w-0 p-2 bg-white border border-[#8F9E8B]/40 rounded text-xs focus:outline-none focus:border-[#2D392C]"
                          >
                            <option value="">— a chi sono? —</option>
                            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                          <button
                            onClick={() => riassegnaOrfane(o, orfanoScelte[o.id])}
                            disabled={!orfanoScelte[o.id]}
                            className={`shrink-0 px-3 py-2 rounded text-[10px] font-bold uppercase ${orfanoScelte[o.id] ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-400'}`}
                          >
                            Riassegna
                          </button>
                          <button
                            onClick={() => scartaOrfane(o)}
                            aria-label="Butta via queste presenze"
                            className={bottone('distruttivo', 'minuscolo', 'shrink-0')}
                          >
                            Butta
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {members.length === 0 && (
                    <p className="text-[9px] text-[#5C4A3C] italic">Aggiungi prima le persone nella scheda Membri.</p>
                  )}
                </div>
              );
            })()}

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] flex items-center gap-2">
                <span className="min-w-0 truncate">
                  Presenze del {parseDate(selectedDateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                </span>
                {giornoBloccato(selectedDateStr) && (
                  <span className="ml-auto shrink-0 text-[9px] uppercase font-bold px-2 py-1 rounded bg-[#5C4A3C] text-white">🔒 Bloccate</span>
                )}
              </h3>

              {/* Giorno gratis: non entra in nessun conto. Lo vedono tutti —
                  chi guarda le quote deve capire perché quel giorno non pesa —
                  ma lo decide chi tiene i conti. */}
              {giornoGratis(selectedDateStr) && (
                <div className="bg-[#2D392C]/10 border border-[#2D392C]/35 rounded p-2.5">
                  <p className="text-[10px] text-[#2D392C] leading-snug">
                    <span className="font-bold">🎁 Giorno gratis.</span> Le presenze restano segnate per la cucina,
                    ma non entrano in nessun conto: nessuno paga i pasti di oggi, e chi è venuto solo oggi
                    non deve niente.
                  </p>
                </div>
              )}
              {admin && members.length > 0 && (
                <button
                  onClick={() => chiediGiornoGratis(selectedDateStr)}
                  disabled={!!giornoBloccato(selectedDateStr)}
                  className={`w-full py-2 rounded text-[10px] font-bold uppercase tracking-wide border-2 ${
                    giornoGratis(selectedDateStr)
                      ? 'bg-[#2D392C] text-white border-[#2D392C]'
                      : 'bg-white text-[#2D392C] border-[#8F9E8B]/50 hover:bg-[#E2EAE4]'
                  } ${giornoBloccato(selectedDateStr) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {giornoGratis(selectedDateStr) ? '🎁 Giorno gratis — rimettilo nei conti' : '🎁 Rendi questo giorno gratis'}
                </button>
              )}

              {/* Giorno chiuso: le presenze sono congelate. Lo si dice a tutti
                  — chi non è in modalità tecnica deve capire perché i tasti non
                  rispondono — ma solo chi tiene i conti può aprire e chiudere. */}
              {giornoBloccato(selectedDateStr) && (
                <div className="bg-[#5C4A3C]/10 border border-[#5C4A3C]/40 rounded p-2.5">
                  <p className="text-[10px] text-[#5C4A3C] leading-snug">
                    <span className="font-bold">Presenze chiuse.</span> Sono state bloccate il{' '}
                    {new Date(giornoBloccato(selectedDateStr).at).toLocaleString('it-IT')} e non cambiano più:
                    né dai tasti, né da quello che arriva dagli altri telefoni. Se un telefono prova a
                    modificarle, l'app le rimette com'erano.
                  </p>
                </div>
              )}

              {members.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aggiungi prima i membri nella scheda "Membri".</p>
              ) : (
                <>
                {/* Azioni rapide: cambiano le presenze di TUTTI in un colpo, e
                    la modifica arriva su tutti i telefoni. Stanno chiuse e
                    chiedono conferma: è il tipo di tasto che si preme per
                    sbaglio scorrendo, e poi qualcuno resta senza pasti. */}
                <div className={`bg-[#F0F4F1]/60 rounded border border-[#8F9E8B]/30 overflow-hidden ${giornoBloccato(selectedDateStr) ? 'opacity-50 pointer-events-none' : ''}`}>
                  <button
                    onClick={() => setAzioniOpen((v) => !v)}
                    className={bottoneRiga()}
                  >
                    <span className="text-[10px] uppercase font-bold text-[#5C4A3C] shrink-0">Segna in blocco</span>
                    <span className="ml-auto text-[9px] text-gray-500 truncate">
                      {members.filter((m) => getMeal(selectedDateStr, m.id).lunch).length} a pranzo · {members.filter((m) => getMeal(selectedDateStr, m.id).dinner).length} a cena
                    </span>
                    <span className={`text-[10px] text-[#5C4A3C] shrink-0 transition-transform ${azioniOpen ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {azioniOpen && (
                    <div className="px-3 pb-3 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => chiediSetAll('lunch')} className={bottone('primario', 'piccolo')}>Tutti a pranzo</button>
                        <button onClick={() => chiediSetAll('dinner')} className={bottone('bruno', 'piccolo')}>Tutti a cena</button>
                        <button onClick={chiediCopiaDaIeri} className={bottone('secondario', 'piccolo')}>Copia da ieri</button>
                      </div>
                      <p className="text-[9px] text-gray-400 leading-snug">
                        Segna tutti, poi togli i pochi assenti. Se sono già tutti segnati, il bottone li toglie tutti.
                        Ognuno di questi tasti chiede conferma: cambia le presenze di tutti, su tutti i telefoni.
                      </p>
                    </div>
                  )}
                </div>
                <ul className="space-y-2">
                  {members.map((m) => {
                    const meal = getMeal(selectedDateStr, m.id);
                    const chiuso = !!giornoBloccato(selectedDateStr);
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-2 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/20">
                        <span className="text-sm font-bold text-[#2D392C] truncate flex items-center gap-1">
                          {m.name}
                          {m.isChild && <span className="text-[8px] uppercase bg-[#D97706] text-white px-1 rounded">gratis</span>}
                        </span>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => toggleMeal(selectedDateStr, m.id, 'lunch')}
                            disabled={chiuso}
                            className={`text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border ${meal.lunch ? 'bg-[#2D392C] text-white border-[#2D392C]' : 'bg-white text-gray-400 border-gray-300'} ${chiuso ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            Pranzo
                          </button>
                          <button
                            onClick={() => toggleMeal(selectedDateStr, m.id, 'dinner')}
                            disabled={chiuso}
                            className={`text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border ${meal.dinner ? 'bg-[#5C4A3C] text-white border-[#5C4A3C]' : 'bg-white text-gray-400 border-gray-300'} ${chiuso ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            Cena
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                </>
              )}

              {/* Chiudere un giorno è la garanzia definitiva contro le presenze
                  che cambiano da sole: è una decisione di chi tiene i conti,
                  quindi sta in modalità tecnica. */}
              {admin && members.length > 0 && (
                giornoBloccato(selectedDateStr) ? (
                  <button
                    onClick={() => sbloccaGiorno(selectedDateStr)}
                    className={bottone('secondario', 'piccolo', 'w-full')}
                  >
                    🔓 Sblocca le presenze di questo giorno
                  </button>
                ) : (
                  <button
                    onClick={() => bloccaGiorno(selectedDateStr)}
                    className={bottone('bruno', 'piccolo', 'w-full')}
                  >
                    🔒 Blocca le presenze di questo giorno
                  </button>
                )
              )}
            </div>

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-2">
              <h4 className="font-rustic text-sm text-[#5C4A3C]">Note / Ospiti del giorno</h4>
              <textarea
                value={getDayData(selectedDateStr).guestsNames}
                onChange={(e) => updateDayData(selectedDateStr, 'guestsNames', e.target.value)}
                placeholder="Ospiti occasionali o note sulle presenze..."
                className="w-full h-20 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C] resize-none"
              />
            </div>
          </div>
        )}

        {/* ---------- SPESA ---------- */}
        {activeTab === 'spesa' && (
          <div className="space-y-4">
            {/* Sotto-sezioni della Spesa */}
            <div className="grid grid-cols-4 gap-1.5">
              {[['totali', 'Totali'], ['quote', 'Quote'], ['saldi', 'Saldi'], ['dati', 'Dati']].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setSpesaSection(k)}
                  className={`py-2.5 rounded text-[10px] font-bold uppercase tracking-wide border-b-4 transition-all ${
                    spesaSection === k ? 'bg-[#2D392C] text-white border-[#5C4A3C]' : 'bg-white text-[#2D392C] border-gray-300 hover:bg-[#E2EAE4]'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {spesaSection === 'totali' && (<div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-4">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Cassa Globale Campo</h3>
              <p className="text-[10px] text-gray-500 -mt-1">Totali generati automaticamente da quello che registri in <span className="font-bold">Lista della Spesa</span> e <span className="font-bold">Attrezzatura</span>.</p>
              <div className="space-y-2">
                {[
                  ['Spesa Cibo (Alimentare)', totals.totalFood],
                  ['Spesa Bevande', totals.totalDrinks],
                  ['Logistica e attrezzatura', totals.totalAccessory],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20">
                    <span className="text-[11px] uppercase font-bold text-gray-500">{label}</span>
                    <span className="font-bold text-[#2D392C]">{money(val)} €</span>
                  </div>
                ))}
              </div>
              {totals.foodDrinksSep > 0 && (
                <div className="flex justify-between items-center bg-[#5C4A3C]/10 px-3 py-2 rounded border border-[#5C4A3C]/30">
                  <span className="text-[10px] uppercase font-bold text-[#5C4A3C]">di cui sul conto separato</span>
                  <span className="font-bold text-[#5C4A3C]">{money(totals.foodDrinksSep)} €</span>
                </div>
              )}
              <div className="bg-[#2D392C]/10 p-3 rounded border border-[#2D392C]/20 flex justify-between items-center mt-2">
                <span className="font-bold text-xs uppercase">Importo Complessivo:</span>
                <span className="font-rustic font-bold text-lg text-[#2D392C]">{money(totals.overallTotal)} €</span>
              </div>
            </div>

            <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md space-y-4">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-1">Il Conto della Serva</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20">
                  <span className="text-[10px] uppercase text-[#8F9E8B] block">Quota Singolo Pasto</span>
                  <span className="font-rustic text-xl text-[#D97706]">{money(totals.costPerMeal)} €</span>
                  <p className="text-[9px] text-gray-400 mt-1">
                    Cibo+bevande ({money(totals.foodDrinksCommon)} €) / {totals.adultMealsCommon} pasti adulti
                    {totals.sepDaysCount > 0 ? ' dei giorni comuni' : ''}.
                  </p>
                </div>
                {/* Logistica e attrezzatura si dividono allo STESSO modo — a
                    testa, fra i presenti — quindi si mostrano insieme: due
                    riquadri separati facevano sembrare l'attrezzatura una
                    tassa a parte, quando e' una voce del costo del campo come
                    le altre. I numeri non cambiano di un centesimo: la somma
                    accessoryPerAdult era gia' calcolata. Il dettaglio resta
                    nella riga piccola, che e' dove va cercato quando serve.
                    Se l'esenzione per membro fosse attiva i due divisori
                    potrebbero differire: in quel caso si torna a due riquadri,
                    perche' un numero solo sarebbe una bugia. */}
                {!(FEATURES.equipExemption && totals.equipPayersCount !== totals.accessoryPayersCount) ? (
                  <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20">
                    <span className="text-[10px] uppercase text-[#8F9E8B] block">Quota a persona</span>
                    <span className="font-rustic text-xl text-[#D97706]">{money(totals.accessoryPerAdult)} €</span>
                    <p className="text-[9px] text-gray-400 mt-1">
                      Logistica e attrezzatura ({money(totals.totalAccessory)} €) / {totals.accessoryPayersCount} {totals.accessoryPayersCount === 1 ? 'adulto' : 'adulti'} dei giorni comuni.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20">
                      <span className="text-[10px] uppercase text-[#8F9E8B] block">Logistica a testa</span>
                      <span className="font-rustic text-xl text-[#D97706]">{money(totals.logisticsPerAdult)} €</span>
                      <p className="text-[9px] text-gray-400 mt-1">Logistica ({money(totals.logisticsPurchases)} €) / {totals.accessoryPayersCount} adulti dei giorni comuni.</p>
                    </div>
                    <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20">
                      <span className="text-[10px] uppercase text-[#8F9E8B] block">Attrezzatura a testa</span>
                      <span className="font-rustic text-xl text-[#D97706]">{money(totals.equipPerAdult)} €</span>
                      <p className="text-[9px] text-gray-400 mt-1">
                        Attrezzatura ({money(totals.equipBought)} €) / {totals.equipPayersCount} {totals.equipPayersCount === 1 ? 'persona non esente' : 'persone non esenti'}.
                      </p>
                    </div>
                  </>
                )}
                {(totals.sepDaysCount > 0 || totals.foodDrinksSep > 0) && (
                  <div className="bg-[#1F271E] p-3 rounded border border-[#5C4A3C] col-span-2">
                    <span className="text-[10px] uppercase text-[#8F9E8B] block">Conto separato — quota pasto</span>
                    <span className="font-rustic text-xl text-[#D97706]">{money(totals.costPerMealSep)} €</span>
                    <p className="text-[9px] text-gray-400 mt-1">
                      Cibo+bevande separati ({money(totals.foodDrinksSep)} €) / {totals.adultMealsSep} pasti adulti
                      su {totals.sepDaysCount} {totals.sepDaysCount === 1 ? 'giorno' : 'giorni'},
                      {' '}{totals.sepPeopleCount} {totals.sepPeopleCount === 1 ? 'persona' : 'persone'}.
                    </p>
                  </div>
                )}
              </div>
              <p className="text-[9px] text-gray-400 italic">I pasti dei bambini sono gratis: il loro costo è ripartito sugli adulti.</p>
            </div>

            </div>)}

            {spesaSection === 'quote' && (<div className="space-y-4">
            {/* Caso tipico da campo: spese registrate ma presenze dimenticate.
                Senza pasti non c'è nulla su cui ripartire e le quote restano a
                zero: meglio dirlo, invece di mostrare solo degli zeri. */}
            {totals.overallTotal > 0 && totals.adultMealsTotal === 0 && (
              <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                <p className="text-[11px] text-[#5C4A3C] leading-snug">
                  <span className="font-bold">Attenzione:</span> ci sono spese per {money(totals.overallTotal)} € ma
                  nessun pasto registrato. Le quote restano a zero finché non segni le presenze
                  nella scheda <span className="font-bold">Presenze</span>.
                </p>
              </div>
            )}
            {totals.freeDaysCount > 0 && (
              <p className="text-[10px] text-[#2D392C] leading-snug bg-[#2D392C]/8 border border-[#2D392C]/25 rounded p-2.5">
                🎁 <span className="font-bold">{totals.freeDaysCount} {totals.freeDaysCount === 1 ? 'giorno gratis' : 'giorni gratis'}</span>:
                {' '}{totals.mealsFree} {totals.mealsFree === 1 ? 'pasto è escluso' : 'pasti sono esclusi'} dai conti.
                Restano segnati nel calendario per la cucina, ma nessuno li paga — per questo i pasti
                contati qui sotto possono essere meno di quelli che vedi in Presenze.
              </p>
            )}

            {/* Quote cassa comune: cibo e bevande dei giorni di tutti, più
                logistica e attrezzatura. Senza giorni spuntati è l'unica
                cassa che esiste, e la scheda resta quella di sempre. */}
            {schedaQuote({
              titolo: 'Quote cassa comune',
              sottotitolo: cassaSepAttiva
                ? 'Cibo e bevande dei giorni di tutti, più logistica e attrezzatura.'
                : null,
              elenco: totals.breakdown,
              quotaDi: (b) => b.payComune,
              pastiDi: (b) => b.mealsCommon,
              raccolto: totals.collectedComune,
              totale: totals.totaleComune,
              scarto: totals.roundingDiffComune,
              buchi: totals.buchi.filter((x) => x.cassa === 'comune'),
              nonRipartito: totals.nonRipartitoComune,
              avviso: totals.foodDrinksCommon > 0 && totals.adultMealsCommon === 0 && totals.adultMealsTotal > 0 ? (
                <>
                  <span className="font-bold">Attenzione:</span> tutti i giorni con presenze sono spuntati come
                  conto separato, ma ci sono {money(totals.foodDrinksCommon)} € di cibo e bevande sul conto comune.
                  Sposta quelle spese sul conto separato, oppure togli la spunta ai giorni che sono di tutti.
                </>
              ) : null,
            })}

            {/* Quote cassa separata: solo il cibo dei giorni spuntati, diviso
                solo fra chi in quei giorni ha mangiato. */}
            {cassaSepAttiva && schedaQuote({
              titolo: 'Quote cassa separata',
              sottotitolo: `Solo cibo e bevande dei ${totals.sepDaysCount} ${totals.sepDaysCount === 1 ? 'giorno spuntato' : 'giorni spuntati'} in Calendario, a carico di chi c'era.`,
              elenco: totals.breakdown.filter((b) => b.mealsSep > 0 || b.paySep > 0.005),
              quotaDi: (b) => b.paySep,
              pastiDi: (b) => b.mealsSep,
              raccolto: totals.collectedSep,
              totale: totals.foodDrinksSep,
              scarto: totals.roundingDiffSep,
              buchi: totals.buchi.filter((x) => x.cassa === 'separata'),
              nonRipartito: totals.nonRipartitoSep,
              vuoto: 'Nessuno ha pasti nei giorni spuntati: qui non c\'è niente da dividere.',
              avviso: totals.foodDrinksSep > 0 && totals.adultMealsSep === 0 ? (
                <>
                  <span className="font-bold">Attenzione:</span> ci sono {money(totals.foodDrinksSep)} € sul
                  conto separato ma nessun pasto nei giorni spuntati. Spunta i giorni in
                  <span className="font-bold"> Calendario</span> e segna le
                  <span className="font-bold"> Presenze</span>, altrimenti quella spesa non entra nelle quote.
                </>
              ) : null,
            })}

            {/* Il totale di tutte e due, per chi vuole sapere quanto tira
                fuori in tutto senza sommare a mente. */}
            {cassaSepAttiva && totals.breakdown.length > 0 && (
              <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
                <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Totale a persona</h3>
                <p className="text-[10px] text-gray-500 leading-snug mb-2">Le due casse sommate: è la cifra che ciascuno tira fuori in tutto.</p>
                <ul className="divide-y divide-[#8F9E8B]/20">
                  {totals.breakdown.map((b) => (
                    <li key={b.id} className="flex items-center justify-between py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#2D392C]">{b.name}</span>
                        <span className="text-[10px] text-gray-500">
                          {b.isChild ? 'bambino' : `${money(b.payComune)} € comune + ${money(b.paySep)} € separata`}
                        </span>
                      </div>
                      <span className={`font-rustic font-bold ${b.isChild ? 'text-gray-400' : 'text-[#2D392C]'}`}>
                        {b.isChild ? 'Gratis' : `${money(b.pay)} €`}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-[#8F9E8B]/30">
                  <span className="text-[11px] uppercase font-bold text-gray-500">Totale raccolto</span>
                  <span className="font-rustic font-bold text-[#2D392C]">{money(totals.collected)} €</span>
                </div>
              </div>
            )}

            </div>)}

            {spesaSection === 'saldi' && (<div className="space-y-4">
            {/* Meno bonifici, stesse cifre. Compare solo se serve davvero:
                con una cassa sola le due liste sono identiche. */}
            {cassaSepAttiva && (risparmio > 0 || saldiOttimizzati) && (
              <div>
                <button
                  onClick={() => setSaldiOttimizzati(!saldiOttimizzati)}
                  className={`w-full py-2.5 rounded text-xs font-bold uppercase tracking-wide border-2 ${
                    saldiOttimizzati
                      ? 'bg-[#2D392C] text-[#F0F4F1] border-[#2D392C]'
                      : 'bg-white text-[#2D392C] border-[#2D392C]/50 hover:bg-[#E2EAE4]'
                  }`}
                >
                  {saldiOttimizzati
                    ? '↩ Torna ai saldi per cassa'
                    : `⚡ Ottimizza i passaggi (${totals.transfers.length} → ${totals.transfersOttimizzati.length})`}
                </button>
                <p className="text-[9px] text-gray-400 italic mt-1 leading-snug">
                  {saldiOttimizzati
                    ? 'Stai vedendo le due casse messe insieme. Per capire da dove viene una cifra, torna ai saldi per cassa.'
                    : 'Unisce le due casse in un elenco solo di bonifici: nessuno paga un centesimo in più o in meno, sono solo meno passaggi.'}
                </p>
              </div>
            )}
            {saldiOttimizzati ? schedaSaldi({
              cassa: cassaUnica,
              titolo: 'Passaggi ottimizzati',
              sottotitolo: 'Le due casse insieme. Le cifre dovute sono le stesse: cambia solo chi gira i soldi a chi, per farne meno. Le spunte di questa vista sono separate da quelle per cassa.',
              scarto: totals.roundingDiff,
              nonRipartito: totals.nonRipartito,
            }) : (<>
            {schedaSaldi({
              cassa: totals.casse.comune,
              titolo: cassaSepAttiva ? 'Saldi cassa comune' : 'Saldo finale',
              sottotitolo: cassaSepAttiva
                ? 'Cibo e bevande dei giorni di tutti, logistica e attrezzatura.'
                : null,
              scarto: totals.roundingDiffComune,
              nonRipartito: totals.nonRipartitoComune,
            })}
            {cassaSepAttiva && schedaSaldi({
              cassa: totals.casse.separata,
              titolo: 'Saldi cassa separata',
              sottotitolo: `Solo cibo e bevande dei ${totals.sepDaysCount} ${totals.sepDaysCount === 1 ? 'giorno spuntato' : 'giorni spuntati'}: chi ha anticipato lì viene rimborsato da chi c'era.`,
              scarto: totals.roundingDiffSep,
              nonRipartito: totals.nonRipartitoSep,
              vuoto: 'Nessun anticipo e nessuna quota su questa cassa.',
            })}
            </>)}

            <button onClick={shareReport} className={bottone('whatsapp', 'grande', 'w-full flex items-center justify-center gap-2')}>
              <span>📤</span> Condividi resoconto
            </button>
            <p className="text-[9px] text-gray-400 italic text-center">Genera un messaggio pronto con totale e "chi paga chi" da mandare nel gruppo.</p>

            </div>)}

            {spesaSection === 'dati' && (<div className="space-y-4">
            {/* Chiusura dei conti: il blocco che serve DOPO il campo, quando la
                gente comincia a pagarsi e gli importi non devono più muoversi. */}
            {admin && (
              <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
                <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] flex items-center gap-2">
                  <span>Chiusura dei conti</span>
                  {bloccoConti() && <span className="ml-auto text-[9px] uppercase font-bold px-2 py-1 rounded bg-[#5C4A3C] text-white">🔒 Chiusi</span>}
                </h3>
                {bloccoConti() ? (
                  <>
                    <p className="text-[10px] text-gray-500 leading-snug">
                      Conti chiusi il <span className="font-bold">{new Date(bloccoConti().at).toLocaleString('it-IT')}</span>.
                      Spese e attrezzatura sono congelate: gli importi di "chi paga chi" non cambiano più, quindi i
                      rimborsi già segnati come saldati restano validi. Quello che arriva dagli altri telefoni viene
                      messo da parte e segnalato qui sopra.
                    </p>
                    <button onClick={riapriConti} className={bottone('secondario', 'normale', 'w-full')}>
                      🔓 Riapri i conti
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-gray-500 leading-snug">
                      Da fare <span className="font-bold">quando i conti sono definitivi e la gente comincia a pagarsi</span>.
                      I passaggi di pareggio sono segnati come saldati con una chiave che contiene l'importo: basta
                      una spesa aggiunta dopo perché tutti gli importi si ricalcolino e i bonifici già fatti
                      spariscano dall'elenco. Chiudendo, spese e attrezzatura si congelano e le presenze ancora
                      aperte si bloccano.
                    </p>
                    <button onClick={chiudiConti} className={bottone('bruno', 'normale', 'w-full')}>
                      🔒 Chiudi i conti
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Backup dati */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Backup Dati</h3>
              <p className="text-[10px] text-gray-500">Ogni giorno viene salvata da sola una copia di sicurezza nel cloud. Esporta/Importa serve per un backup manuale su file.</p>
              {/* Esportare è innocuo e serve a chiunque voglia tenersi una
                  copia. Importare e ripristinare invece RIMPIAZZANO tutto:
                  cancellano il lavoro di tutti gli altri e possono sbloccare
                  giorni chiusi. Stanno in modalità tecnica, come il blocco. */}
              <div className="flex gap-2">
                <button onClick={exportData} className={bottone('primario', 'normale', 'flex-1')}>Esporta</button>
                {admin && (
                  <label className="flex-1 py-2.5 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase text-center cursor-pointer hover:bg-[#463628]">
                    Importa
                    <input type="file" accept="application/json,.json" onChange={importData} className="hidden" />
                  </label>
                )}
              </div>
              {admin && (
                <button onClick={openRestore} className="w-full py-2.5 bg-white border-2 border-[#D97706]/50 text-[#D97706] rounded text-xs font-bold uppercase hover:bg-[#D97706]/10">
                  Ripristino di emergenza
                </button>
              )}
            </div>

            {/* Chiusura del campo */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#5C4A3C]/30 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Chiusura del campo</h3>
              <p className="text-[10px] text-gray-500">
                A conti fatti e rimborsi saldati: salva tutto (file + cloud), lo mette in <span className="font-bold">Archivio</span> e
                azzera membri, presenze, spese, lista, attrezzatura, dotazioni aggiuntive e scontrini.
                L'app resta pronta per il prossimo evento. I dati archiviati restano consultabili.
              </p>
              {/* Azzera membri, presenze e spese: giorni bloccati compresi.
                  È l'ultimo gesto del campo e lo fa chi tiene i conti. */}
              {admin ? (
                <button onClick={openClose} className={bottone('bruno', 'grande', 'w-full')}>
                  🏁 Chiudi il campo e archivia
                </button>
              ) : (
                <p className="text-[10px] text-gray-400 italic">La chiusura del campo la fa chi tiene i conti.</p>
              )}
              {archives.length > 0 && (
                <button onClick={() => goTo('archivio')} className={bottone('testuale', 'piccolo', 'w-full')}>
                  Vedi l'archivio ({archives.length})
                </button>
              )}
            </div>

            {/* Sincronizzazione Cloud (online) */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
                <h3 className="font-rustic text-lg text-[#2D392C]">Sincronizzazione Cloud</h3>
                <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${cloud.connected ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {cloud.connected ? 'Connesso' : 'Non connesso'}
                </span>
              </div>

              {!(window.CloudSync && window.CloudSync.isConfigured()) ? (
                <p className="text-[10px] text-gray-500 italic">
                  Firebase non configurato. Incolla la config del tuo progetto in <span className="font-bold">firebase-config.js</span> per abilitare la sincronizzazione online tra dispositivi.
                </p>
              ) : (
                <>
                  <p className="text-[10px] text-gray-500">
                    La sincronizzazione si attiva da sola all'avvio quando c'è linea. Offline si continua a lavorare in locale. Premi Disconnetti solo se vuoi lavorare senza condividere i dati.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={campCodeInput}
                      onChange={(e) => setCampCodeInput(e.target.value)}
                      placeholder="Codice campo"
                      disabled={cloud.connected}
                      className="flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C] disabled:opacity-60"
                    />
                    {cloud.connected ? (
                      <button onClick={disconnectCloud} className={bottone('bruno', 'normale')}>Disconnetti</button>
                    ) : (
                      <button onClick={() => connectCloud(campCodeInput)} className={bottone('primario', 'normale')}>Connetti</button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>
                      {cloud.status === 'connecting' && 'Connessione in corso…'}
                      {cloud.status === 'saving' && 'Salvataggio…'}
                      {cloud.status === 'connected' && (cloud.lastSync ? `Ultima sync: ${new Date(cloud.lastSync).toLocaleTimeString('it-IT')}` : 'In ascolto…')}
                      {cloud.status === 'error' && <span className="text-red-700">Errore: {cloud.error}</span>}
                      {cloud.status === 'idle' && (localStorage.getItem('cambusa_sync_optout') === '1'
                        ? 'Sincronizzazione disattivata: premi Connetti per riattivarla.'
                        : 'In attesa di connessione automatica…')}
                    </span>
                    {!isOnline && <span className="text-[#D97706] font-bold">offline</span>}
                  </div>
                </>
              )}
            </div>
            </div>)}
          </div>
        )}

        {/* ---------- TACCUINO DELLE SPESE ---------- */}
        {activeTab === 'lista' && (
          <div className="space-y-4">
            {/* Sotto-sezioni: Da acquistare / Acquistato */}
            <div className="grid grid-cols-2 gap-2">
              {[['daacquistare', 'Da acquistare', toBuy.length], ['acquistato', 'Acquistato', purchases.length]].map(([k, l, n]) => (
                <button
                  key={k}
                  onClick={() => setListaSection(k)}
                  className={`py-2.5 rounded text-[11px] font-bold uppercase tracking-wide border-b-4 transition-all ${
                    listaSection === k ? 'bg-[#2D392C] text-white border-[#5C4A3C]' : 'bg-white text-[#2D392C] border-gray-300 hover:bg-[#E2EAE4]'
                  }`}
                >
                  {l}{n > 0 ? ` (${n})` : ''}
                </button>
              ))}
            </div>

            {/* ===== DA ACQUISTARE ===== */}
            {listaSection === 'daacquistare' && (
            <div className="bg-white p-4 rounded-lg border-2 border-[#5C4A3C]/30 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
                <h3 className="font-rustic text-lg text-[#2D392C]">Da Acquistare</h3>
                {toBuy.length > 0 && (
                  <span className="text-[10px] uppercase font-bold text-gray-500">{toBuy.length} {toBuy.length === 1 ? 'voce' : 'voci'}</span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBuyName}
                  onChange={(e) => setNewBuyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addToBuy()}
                  placeholder="Cosa serve…"
                  className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                />
                <input
                  type="text"
                  value={newBuyQty}
                  onChange={(e) => setNewBuyQty(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addToBuy()}
                  placeholder="Q.tà"
                  className="w-20 shrink-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm text-center focus:outline-none focus:border-[#2D392C]"
                />
                <button onClick={addToBuy} aria-label="Aggiungi alla lista" className={bottoneIcona('pieno', 'shrink-0')}>+</button>
              </div>

              {/* Ricerca: la lista della spesa arriva a decine di voci, e
                  ritrovarne una scorrendo col dito e' impraticabile. */}
              {toBuy.length > 4 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={toBuyQuery}
                    onChange={(e) => setToBuyQuery(e.target.value)}
                    placeholder="Cerca nella lista…"
                    className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                  />
                  {toBuyQuery && (
                    <button onClick={() => setToBuyQuery('')} aria-label="Azzera la ricerca" className={bottoneIcona('neutro', 'shrink-0')}>&times;</button>
                  )}
                </div>
              )}

              {toBuy.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Lista vuota. Scrivi cosa serve e premi +.</p>
              ) : (() => {
                const q = toBuyQuery.trim().toLowerCase();
                const visibili = toBuy.filter((it) => !q ||
                  (it.name || '').toLowerCase().includes(q) ||
                  (it.qty || '').toLowerCase().includes(q));
                return (
                <>
                {q && (
                  <div className="flex items-center justify-between bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20">
                    <span className="text-[10px] uppercase font-bold text-gray-500">
                      {visibili.length} {visibili.length === 1 ? 'voce trovata' : 'voci trovate'} su {toBuy.length}
                    </span>
                  </div>
                )}
                {visibili.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Niente in lista corrisponde a "{toBuyQuery}".</p>
                ) : (
                <ul className="space-y-2">
                  {visibili.map((it) => (
                    <li key={it.id} className="bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                      <div className="flex items-center gap-2">
                        <div className="flex-grow min-w-0">
                          <div className="text-sm font-bold text-[#2D392C] leading-snug break-words">{it.name}</div>
                          {it.qty && <div className="text-[10px] text-gray-500">Quantità: {it.qty}</div>}
                        </div>
                        {/* Lo scontrino si allega al momento dell'acquisto,
                            nella maschera di "Segna come acquistata": è lì che
                            si ha in mano, non mentre si scrive la lista. */}
                        {receipts[it.id] && (
                          <button onClick={() => setViewReceipt(receipts[it.id])} aria-label="Vedi scontrino" className={bottoneIcona('pieno', 'shrink-0')}>📷</button>
                        )}
                        <button onClick={() => removeToBuy(it.id)} aria-label="Rimuovi" className={bottoneIcona('distruttivo', 'shrink-0')}>&times;</button>
                      </div>
                      <button
                        onClick={() => setBuying({ id: it.id, name: it.name, qty: it.qty, price: '', buyer: '', type: 'alimentare', account: 'comune' })}
                        className={bottone('bruno', 'piccolo', 'mt-2 w-full')}
                      >
                        Segna come acquistata
                      </button>
                    </li>
                  ))}
                </ul>
                )}
                </>
                );
              })()}
              <p className="text-[9px] text-gray-400 italic">Quando una voce viene acquistata passa in "Acquistato": lì si mettono prezzo, acquirente e la foto dello scontrino.</p>
            </div>
            )}

            {/* ===== ACQUISTATO: inserimento manuale + cronologia ===== */}
            {listaSection === 'acquistato' && (<>
            {/* Inserimento manuale: chiuso, si apre a richiesta */}
            {!manualOpen ? (
              <button
                onClick={() => setManualOpen(true)}
                className="w-full bg-white p-3 rounded-lg border-2 border-dashed border-[#8F9E8B]/60 text-[#2D392C] hover:bg-[#E2EAE4] flex items-center justify-center gap-2"
              >
                <span className="text-lg leading-none">＋</span>
                <span className="font-bold uppercase text-xs tracking-wide">Aggiungi un prodotto a mano</span>
              </button>
            ) : (
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
                <h3 className="font-rustic text-lg text-[#2D392C]">Prodotto acquistato</h3>
                <div className="flex items-center gap-2 shrink-0">
                  <label
                    title="Scontrino: scatta una foto o scegli dalla galleria"
                    aria-label="Allega scontrino"
                    className={`cursor-pointer px-3 py-2 rounded border-2 text-lg leading-none ${pReceipt ? 'bg-[#2D392C] border-[#2D392C]' : 'bg-white border-[#8F9E8B]/50 hover:bg-[#E2EAE4]'}`}
                  >
                    📷
                    <input type="file" accept="image/*" onChange={onReceiptFile} className="hidden" />
                  </label>
                  <button
                    onClick={() => setManualOpen(false)}
                    aria-label="Chiudi la maschera"
                    className={bottoneIcona('neutro')}
                  >
                    &times;
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 -mt-1">Per un prodotto che non era in "Da acquistare".</p>

              {pReceipt && (
                <div className="flex items-center gap-3 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/30">
                  <img src={pReceipt} alt="Scontrino" className="w-12 h-12 object-cover rounded" />
                  <span className="flex-grow text-xs text-[#2D392C] font-bold">Scontrino allegato ✓</span>
                  <button onClick={() => setPReceipt(null)} aria-label="Rimuovi foto" className={bottoneIcona('distruttivo')}>&times;</button>
                </div>
              )}

              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Nome</label>
                <input
                  type="text"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="Es. Pasta, Acqua, Piatti…"
                  className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Acquirente</label>
                {renderBuyerSelect(pBuyer, setPBuyer)}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Prezzo (€)</label>
                  <input
                    type="number" min="0" step="0.01" inputMode="decimal"
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addPurchase()}
                    placeholder="0.00"
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Tipologia</label>
                  <select
                    value={pType}
                    onChange={(e) => setPType(e.target.value)}
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold focus:outline-none focus:border-[#2D392C]"
                  >
                    {Object.keys(PURCHASE_TYPES).map((k) => (
                      <option key={k} value={k}>{PURCHASE_TYPES[k]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conto su cui addebitare cibo e bevande. La logistica è sempre
                  comune, quindi per quella il menu non serve. */}
              {pType !== 'logistica' && (
                <div>
                  <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Conto</label>
                  <select
                    value={pAccount}
                    onChange={(e) => setPAccount(e.target.value)}
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold focus:outline-none focus:border-[#2D392C]"
                  >
                    <option value="comune">Conto comune</option>
                    <option value="sep">Conto separato</option>
                  </select>
                  {pAccount === 'sep' && (
                    <p className="text-[9px] mt-1 leading-snug text-[#5C4A3C]">
                      {sepDays.length === 0
                        ? '⚠ Nessun giorno spuntato come "conto separato": vai in Calendario e spunta i giorni, altrimenti questa spesa non sa fra chi dividersi.'
                        : `Si dividerà solo fra chi era presente ai pasti dei ${sepDays.length} giorni spuntati in Calendario.`}
                    </p>
                  )}
                </div>
              )}

              <button onClick={addPurchase} className={bottone('primario', 'grande', 'w-full')}>
                Salva
              </button>
            </div>
            )}

            {/* Cronologia acquisti */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
                <h3 className="font-rustic text-lg text-[#2D392C]">Cronologia acquisti</h3>
                {purchases.length > 0 && (
                  <span className="font-rustic font-bold text-[#2D392C]">{money(totals.overallTotal)} €</span>
                )}
              </div>

              {/* Ricerca: con un centinaio di voci ritrovarne una scorrendo
                  è impraticabile. Filtra su nome, acquirente e tipologia. */}
              {purchases.length > 4 && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={purchaseQuery}
                    onChange={(e) => setPurchaseQuery(e.target.value)}
                    placeholder="Cerca fra le spese…"
                    className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                  />
                  {purchaseQuery && (
                    <button onClick={() => setPurchaseQuery('')} aria-label="Azzera la ricerca" className={bottoneIcona('neutro', 'shrink-0')}>&times;</button>
                  )}
                </div>
              )}

              {/* Stessa spesa registrata da due persone: il totale si gonfia e
                  la quota di tutti sale. Non si tocca niente da soli — di
                  mezzo ci sono i soldi — ma si dice dov'è, con la matita e la
                  × già a portata di mano qui sotto. */}
              {spesePotenzialmenteDoppie().map((g) => (
                <div key={g[0].id} className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5 mb-3">
                  <p className="text-[10px] text-[#5C4A3C] leading-snug">
                    <span className="font-bold">"{g[0].name}" da {money(posNum(g[0].price))} € è registrata {g.length} volte</span>
                    {g.some((x) => (x.buyer || '') !== (g[0].buyer || ''))
                      ? <> (da {[...new Set(g.map((x) => x.buyer || '—'))].join(' e ')})</>
                      : null}.
                    {' '}Se è la stessa spesa messa da due persone, il totale è gonfiato e la quota di tutti sale:
                    cancellane una qui sotto con la <span className="font-bold">×</span>. Se sono due spese davvero
                    diverse, lascia stare — o cambia un nome per non ricascarci.
                  </p>
                </div>
              ))}

              {purchases.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessun acquisto registrato. Compila il form qui sopra e premi Salva.</p>
              ) : (() => {
                const q = purchaseQuery.trim().toLowerCase();
                const visibili = purchases.slice().reverse().filter((p) => !q ||
                  (p.name || '').toLowerCase().includes(q) ||
                  (p.buyer || '').toLowerCase().includes(q) ||
                  (PURCHASE_TYPES[p.type] || '').toLowerCase().includes(q));
                const sommaVisibili = visibili.reduce((s, p) => s + posNum(p.price), 0);
                return (
                <>
                {q && (
                  <div className="flex items-center justify-between bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20 mb-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">
                      {visibili.length} {visibili.length === 1 ? 'voce trovata' : 'voci trovate'} su {purchases.length}
                    </span>
                    <span className="font-rustic font-bold text-[#2D392C] text-sm">{money(sommaVisibili)} €</span>
                  </div>
                )}
                {visibili.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Nessuna spesa corrisponde a "{purchaseQuery}".</p>
                ) : (
                <ul className="space-y-2">
                  {visibili.map((p) => (
                    // Due livelli: sopra il nome del prodotto, che ha tutta la
                    // riga per sé (prima veniva tagliato dalle etichette e dal
                    // prezzo che gli stavano accanto); sotto le informazioni.
                    <li key={p.id} className="bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-[#2D392C] leading-snug break-words min-w-0">{p.name}</span>
                        <span className="font-rustic font-bold text-[#2D392C] shrink-0 whitespace-nowrap">{money(posNum(p.price))} €</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-wrap items-center gap-1 min-w-0 flex-grow">
                          <span className="text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#8F9E8B]">{PURCHASE_TYPES[p.type] || p.type}</span>
                          {p.account === 'sep' && p.type !== 'logistica' && (
                            <span className="text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#5C4A3C]">Separato</span>
                          )}
                          {p.fromList && <span className="text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#5C4A3C]">acquistata</span>}
                          <span className="text-[9px] text-gray-400 basis-full">
                            {p.buyer ? <span className="text-[#5C4A3C] font-bold">{p.buyer}</span> : <span className="italic">acquirente non indicato</span>}
                            {p.at && ` · ${new Date(p.at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} ${new Date(p.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                          </span>
                        </div>
                        {receipts[p.id] ? (
                          <button onClick={() => setViewReceipt(receipts[p.id])} aria-label="Vedi scontrino" className={bottoneIcona('pieno', 'shrink-0')}>📷</button>
                        ) : (
                          <label title="Scontrino: scatta una foto o scegli dalla galleria" aria-label="Allega scontrino" className="shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-[#8F9E8B]/50 bg-white text-sm leading-none hover:bg-[#E2EAE4]">
                            📷
                            <input type="file" accept="image/*" onChange={(e) => attachReceiptTo(e, p.id)} className="hidden" />
                          </label>
                        )}
                        <button onClick={() => openEditPurchase(p)} aria-label="Correggi" title="Correggi questa spesa" className={bottoneIcona('neutro', 'shrink-0')}>✏️</button>
                        <button onClick={() => removePurchase(p.id)} aria-label="Rimuovi" className={bottoneIcona('distruttivo', 'shrink-0')}>&times;</button>
                      </div>
                    </li>
                  ))}
                </ul>
                )}
                </>
                );
              })()}
              <p className="text-[9px] text-gray-400 italic mt-2">Manca uno scontrino? Tocca 📷 sulla voce: puoi scattarlo o scegliere una foto dalla galleria, anche dopo. Le foto si sincronizzano tra i dispositivi del campo e sono incluse nel backup.</p>
            </div>
            </>)}
          </div>
        )}

        {/* ---------- AGGIUNTA ATTREZZATURA ---------- */}
        {activeTab === 'attrezzatura' && (() => {
          const equipBoughtTotal = equipment.reduce((s, e) => (e.bought ? s + posNum(e.price) : s), 0);
          const equipPlannedTotal = equipment.reduce((s, e) => s + posNum(e.price), 0);
          return (
          <div className="space-y-4">
            {/* Form di inserimento */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aggiungi attrezzatura</h3>
              <input
                type="text"
                value={newEquipText}
                onChange={(e) => setNewEquipText(e.target.value)}
                placeholder="Es. Corda, gazebo, tanica…"
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
              />
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Acquirente (facoltativo)</label>
                {renderBuyerSelect(newEquipBuyer, setNewEquipBuyer)}
              </div>
              <div className="flex gap-2">
                <input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={newEquipPrice}
                  onChange={(e) => setNewEquipPrice(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEquip()}
                  placeholder="Prezzo (€)"
                  className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
                />
                <button onClick={addEquip} className={bottone('primario', 'normale', 'shrink-0')}>Aggiungi</button>
              </div>
              <p className="text-[9px] text-gray-400">Spunta una voce quando l'hai acquistata: il suo prezzo entra nelle Spese Totali (come logistica). Con 📷 alleghi lo scontrino (foto o galleria), anche dopo.</p>
            </div>

            {/* Elenco attrezzatura */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
                <h3 className="font-rustic text-lg text-[#2D392C]">Attrezzatura</h3>
                {equipment.length > 0 && (
                  <span className="text-[10px] uppercase font-bold text-gray-500">
                    {equipment.filter((e) => !e.bought).length} da comprare
                  </span>
                )}
              </div>
              {equipment.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessuna attrezzatura. Aggiungi la prima voce qui sopra.</p>
              ) : (
                <>
                <ul className="space-y-2">
                  {equipment.map((e) => (
                    // Nome sulla sua riga, prezzo e comandi sotto: in fila su una
                    // riga sola il titolo restava schiacciato in due centimetri e
                    // non si leggeva più.
                    <li key={e.id} className="bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleEquipBought(e.id)}
                          aria-label={e.bought ? 'Segna da comprare' : 'Segna acquistato'}
                          className={`w-6 h-6 shrink-0 rounded border-2 flex items-center justify-center font-bold mt-0.5 ${e.bought ? 'bg-[#2D392C] border-[#2D392C] text-white' : 'bg-white border-[#8F9E8B]'}`}
                        >
                          {e.bought ? '✓' : ''}
                        </button>
                        <div className="flex-grow min-w-0">
                          <div className={`text-sm leading-snug break-words ${e.bought ? 'line-through text-gray-500' : 'text-[#2D392C]'}`}>{e.text}</div>
                          {e.buyer && <div className="text-[9px] text-[#5C4A3C] font-bold break-words">{e.buyer}</div>}
                        </div>
                        <span className={`font-rustic font-bold shrink-0 ${e.bought ? 'text-[#2D392C]' : 'text-gray-400'}`}>{money(posNum(e.price))} €</span>
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[#8F9E8B]/20">
                        {receipts[e.id] ? (
                          <button onClick={() => setViewReceipt(receipts[e.id])} aria-label="Vedi scontrino" className={bottoneIcona('pieno', 'shrink-0')}>📷</button>
                        ) : (
                          <label title="Scontrino: scatta una foto o scegli dalla galleria" aria-label="Allega scontrino" className="shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-[#8F9E8B]/50 bg-white text-sm leading-none hover:bg-[#E2EAE4]">
                            📷
                            <input type="file" accept="image/*" onChange={(ev) => attachReceiptTo(ev, e.id)} className="hidden" />
                          </label>
                        )}
                        <button onClick={() => openEditEquip(e)} aria-label="Correggi" title="Correggi questa voce" className={bottoneIcona('neutro', 'shrink-0')}>✏️</button>
                        <button onClick={() => removeEquip(e.id)} aria-label="Rimuovi" className={bottoneIcona('distruttivo', 'shrink-0')}>&times;</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 pt-2 border-t border-[#8F9E8B]/30 space-y-1">
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span className="uppercase font-bold">Previsto (tutto)</span>
                    <span className="font-bold">{money(equipPlannedTotal)} €</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] uppercase font-bold text-[#2D392C]">Acquistato (nelle spese)</span>
                    <span className="font-rustic font-bold text-[#2D392C]">{money(equipBoughtTotal)} €</span>
                  </div>
                </div>
                </>
              )}
            </div>
          </div>
          );
        })()}

        {/* ---------- REGOLE ---------- */}
        {activeTab === 'regole' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Regole dell'accampamento</h3>
              <ol className="space-y-3">
                {CAMP_RULES.map((text, i) => (
                  <li key={i} className="flex gap-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20">
                    <span className="font-rustic text-lg text-[#5C4A3C] leading-none shrink-0">{i + 1}.</span>
                    <p className="text-[11px] leading-relaxed uppercase underline underline-offset-2 decoration-[#8F9E8B]/70 font-bold text-[#2D392C]">
                      {text}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* ---------- DOTAZIONI PERSONALI ---------- */}
        {activeTab === 'dotazioni' && (
          <div className="space-y-4">
            {/* Box fisso: dotazione base */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Dotazione base</h3>
              <ul className="space-y-2">
                {BASE_GEAR.map((item) => (
                  <li
                    key={item.text}
                    className={`flex items-center gap-3 rounded border p-2.5 ${
                      item.emphasis
                        ? 'bg-[#D97706]/10 border-[#D97706]/40'
                        : 'bg-[#F0F4F1]/60 border-[#8F9E8B]/20'
                    }`}
                  >
                    <span className={`shrink-0 rounded-full bg-[#D97706] ${item.emphasis ? 'w-2 h-2' : 'w-1.5 h-1.5'}`}></span>
                    <span className={item.emphasis
                      ? 'text-base font-bold uppercase underline decoration-2 underline-offset-2 text-[#2D392C] leading-snug'
                      : 'text-sm text-[#2D392C]'}>
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[9px] text-gray-400 italic mt-2">Dotazione obbligatoria per ogni partecipante.</p>
            </div>

            {/* Box editabile: aggiunte dell'occasione */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aggiunte per questo campo</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGearText}
                  onChange={(e) => setNewGearText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGear()}
                  placeholder="Es. costume, torcia frontale…"
                  className="flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                />
                <button onClick={addGear} aria-label="Aggiungi dotazione" className={bottoneIcona('pieno')}>+</button>
              </div>
              {gear.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessuna aggiunta. Inserisci qui le dotazioni extra per questo campo.</p>
              ) : (
                <ul className="space-y-2">
                  {gear.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                      <span className="w-1.5 h-1.5 bg-[#8F9E8B] rounded-full shrink-0"></span>
                      <span className="flex-grow text-sm text-[#2D392C]">{g.text}</span>
                      <button onClick={() => removeGear(g.id)} aria-label="Rimuovi" className={bottoneIcona('distruttivo')}>&times;</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ---------- GALLERIA ---------- */}
        {activeTab === 'galleria' && (
          <div className="space-y-4">
            {/* Caricamento */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Carica le tue foto</h3>

              {!cloud.connected ? (
                <p className="text-sm text-gray-500 leading-snug">
                  La galleria vive nel cloud: serve la linea. È fatta apposta per il
                  <span className="font-bold"> ritorno a casa</span> — al campo non c'è campo, e le foto
                  occuperebbero lo spazio che serve a presenze e spese.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-gray-500 tracking-wide mb-1">Chi le ha scattate</label>
                    <select
                      value={photoWho}
                      onChange={(e) => setPhotoWho(e.target.value)}
                      className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                    >
                      <option value="">— scegli il tuo nome —</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name} ({photosBy(m.name)}/{photoCap})
                        </option>
                      ))}
                    </select>
                    {members.length === 0 && (
                      <p className="text-[9px] text-[#D97706] mt-1">Aggiungi prima le persone nella scheda Membri.</p>
                    )}
                  </div>

                  {photoWho && (
                    <p className="text-[11px] text-gray-600">
                      {photosBy(photoWho) >= photoCap
                        ? <span className="text-[#D97706] font-bold">{photoWho} ha esaurito le sue {photoCap} foto. Cancellane una per farne entrare un'altra.</span>
                        : <>A {photoWho} restano <span className="font-bold">{photoCap - photosBy(photoWho)}</span> foto su {photoCap}.</>}
                    </p>
                  )}

                  <label className={`block w-full py-3 rounded font-bold uppercase text-sm tracking-wide text-center cursor-pointer ${photoWho && photosBy(photoWho) < photoCap && !photoBusy ? 'bg-[#2D392C] text-white hover:bg-[#1F271E]' : 'bg-gray-200 text-gray-400 pointer-events-none'}`}>
                    {photoBusy || '📸 Scegli le foto'}
                    <input type="file" accept="image/*" multiple onChange={addPhotos} className="hidden" />
                  </label>

                  {/* Le foto della galleria vivono solo nel cloud: la coda dei
                      caricamenti sta in memoria, quindi chiudendo l'app adesso
                      quello che non è ancora partito va rifatto. Gli scontrini
                      no: quelli hanno una copia sul telefono e si ricaricano da
                      soli al prossimo collegamento. */}
                  {(cloud.foto || 0) > 0 && (
                    <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                      <p className="text-[10px] text-[#5C4A3C] leading-snug">
                        <span className="font-bold">{cloud.foto} {cloud.foto === 1 ? 'foto ancora da caricare' : 'foto ancora da caricare'}.</span>{' '}
                        Tieni l'app aperta finché non sono partite: se la chiudi adesso, quelle vanno riscelte.
                      </p>
                    </div>
                  )}

                  <p className="text-[9px] text-gray-400 italic leading-snug">
                    Massimo <span className="font-bold">{photoCap} foto a testa</span> (si cambia in Impostazioni): serve a scegliere
                    le belle, non a svuotare il rullino. È un accordo fra noi, non un lucchetto: il nome si sceglie dalla tendina.
                    Le foto vengono rimpicciolite prima di partire.
                  </p>
                </div>
              )}
            </div>

            {/* Griglia */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3 gap-2">
                <h3 className="font-rustic text-lg text-[#2D392C] shrink-0">
                  Album {photos.length > 0 ? `(${photos.length})` : ''}
                </h3>
                {/* Due modi di guardare le stesse foto: l'album per sfogliarle,
                    la griglia per trovarle. La scelta a mano funziona solo in
                    griglia, quindi ci passa da sola. */}
                {photos.length > 0 && !picking && (
                  <div className="flex rounded border border-[#8F9E8B]/40 overflow-hidden shrink-0">
                    {[['album', '📖 Album'], ['griglia', '▦ Griglia']].map(([k, l]) => (
                      <button
                        key={k}
                        onClick={() => setGalleryView(k)}
                        className={`text-[10px] uppercase font-bold px-2.5 py-1.5 ${galleryView === k ? 'bg-[#2D392C] text-white' : 'bg-white text-[#2D392C]'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
                {picking && (
                  <button
                    onClick={uscitaScelta}
                    className="text-[10px] uppercase font-bold px-3 py-1.5 rounded border-2 shrink-0 bg-[#2D392C] text-white border-[#2D392C]"
                  >
                    Annulla
                  </button>
                )}
              </div>
              {!cloud.connected ? (
                <p className="text-sm text-gray-400 italic">Senza linea l'album non si può sfogliare.</p>
              ) : !photosReady ? (
                <p className="text-sm text-gray-400 italic">Carico l'album…</p>
              ) : photos.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Ancora nessuna foto. Comincia tu.</p>
              ) : galleryView === 'album' && !picking ? (
                <div>
                  <div className="album-sfoglio" ref={albumRef} onScroll={onScrollAlbum}>
                    {paginaAlbum(photos).map((gruppo, i) => (
                      <div key={i} className={`album-pagina ${gruppo.length === 1 ? '' : ''}`}>
                        <div className={`album-griglia ${gruppo.length === 1 ? 'una' : ''}`}>
                          {gruppo.map((p) => (
                            <button key={p.id} onClick={() => openPhoto(p)} className="polaroid" aria-label={`Foto di ${p.by || 'anonimo'}`}>
                              <img src={p.thumb} alt="" loading="lazy" />
                              {/* Solo il nome: sotto una polaroid il cognome non
                                  serve a nessuno e non ci sta. */}
                              <span className="didascalia">
                                <span className="nome">{soloNome(p.by)}</span>
                                {p.at ? <span className="quando">{new Date(p.at).toLocaleDateString('it-IT')}</span> : null}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Comandi di sfoglio: col dito basta la spinta, col mouse no. */}
                  <div className="flex items-center justify-center gap-4 mt-2">
                    <button
                      onClick={() => sfoglia(-1)}
                      disabled={albumPage <= 0}
                      aria-label="Pagina precedente"
                      className={`w-8 h-8 rounded-full border border-[#8F9E8B]/40 text-sm ${albumPage <= 0 ? 'text-gray-300' : 'text-[#2D392C]'}`}
                    >
                      ‹
                    </button>
                    <span className="text-[10px] uppercase tracking-widest text-gray-500">
                      {Math.min(albumPage + 1, paginaAlbum(photos).length)} / {paginaAlbum(photos).length}
                    </span>
                    <button
                      onClick={() => sfoglia(1)}
                      disabled={albumPage >= paginaAlbum(photos).length - 1}
                      aria-label="Pagina successiva"
                      className={`w-8 h-8 rounded-full border border-[#8F9E8B]/40 text-sm ${albumPage >= paginaAlbum(photos).length - 1 ? 'text-gray-300' : 'text-[#2D392C]'}`}
                    >
                      ›
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {photos.map((p) => {
                    const scelta = picked.indexOf(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => (picking ? togglePicked(p.id) : openPhoto(p))}
                        className={`relative aspect-square overflow-hidden rounded border bg-[#F0F4F1] ${scelta >= 0 ? 'border-[#2D392C] border-2' : 'border-[#8F9E8B]/30'}`}
                        aria-label={picking ? `Scegli la foto di ${p.by || 'anonimo'}` : `Foto di ${p.by || 'anonimo'}`}
                      >
                        <img src={p.thumb} alt="" className={`w-full h-full object-cover ${picking && scelta < 0 ? 'opacity-45' : ''}`} loading="lazy" />
                        {picking && (
                          <span className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border-2 ${scelta >= 0 ? 'bg-[#2D392C] text-white border-[#2D392C]' : 'bg-white/80 border-white'}`}>
                            {scelta >= 0 ? scelta + 1 : ''}
                          </span>
                        )}
                        {p.by && (
                          <span className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-[8px] px-1 py-0.5 truncate text-left">
                            {soloNome(p.by)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Stampa del ricordo: compare solo mentre si scelgono le foto. */}
              {picking && (
                <div className="mt-3 pt-3 border-t border-[#8F9E8B]/30 space-y-2">
                  <p className="text-[11px] text-gray-600">
                    {picked.length === 0
                      ? 'Tocca le foto da mettere nel ricordo. L\'ordine è quello con cui le scegli.'
                      : <>Scelte <span className="font-bold">{picked.length}</span> foto su {photos.length} · {Math.ceil(picked.length / PER_PAGINA_ALBUM)} {Math.ceil(picked.length / PER_PAGINA_ALBUM) === 1 ? 'pagina' : 'pagine'}</>}
                  </p>
                  <button
                    onClick={() => generaRicordo(photos, false)}
                    disabled={picked.length === 0 || !!pdfBusy}
                    className={`w-full py-3 rounded font-bold uppercase text-sm tracking-wide ${picked.length > 0 && !pdfBusy ? 'bg-[#5C4A3C] text-white hover:bg-[#463628]' : 'bg-gray-200 text-gray-400'}`}
                  >
                    {pdfBusy || `Crea album con le scelte${picked.length ? ` (${picked.length})` : ''}`}
                  </button>
                  <button
                    onClick={() => setPicked(photos.map((x) => x.id))}
                    disabled={!!pdfBusy || picked.length === photos.length}
                    className={bottone('secondario', 'piccolo', 'w-full')}
                  >
                    Scegli tutte
                  </button>
                  <p className="text-[9px] text-gray-400 italic leading-snug">
                    Crea un PDF con le foto scelte su uno sfondo di montagna, quattro per pagina.
                    Le foto vengono scaricate a piena qualità, quindi ci vuole qualche secondo.
                  </p>
                </div>
              )}

              {photos.length > 0 && !picking && cloud.connected && (
                <>
                  {/* L'album completo è la strada normale: il ricordo del campo
                      sono tutte le foto, in ordine di scatto. Scegliere a mano
                      resta possibile, ma è il caso particolare. */}
                  <button
                    onClick={() => generaRicordo(photos, true)}
                    disabled={!!pdfBusy}
                    className={`w-full mt-3 py-3 rounded font-bold uppercase text-sm tracking-wide ${pdfBusy ? 'bg-gray-200 text-gray-400' : 'bg-[#5C4A3C] text-white hover:bg-[#463628]'}`}
                  >
                    {pdfBusy || `📕 Crea album completo (${photos.length} ${photos.length === 1 ? 'foto' : 'foto'})`}
                  </button>
                  <p className="text-[9px] text-gray-400 italic mt-1.5 leading-snug">
                    Un PDF con <span className="font-bold">tutte</span> le foto della galleria su uno sfondo di
                    montagna, quattro per pagina, dalla prima all'ultima in ordine di scatto
                    ({Math.ceil(photos.length / PER_PAGINA_ALBUM)} {Math.ceil(photos.length / PER_PAGINA_ALBUM) === 1 ? 'pagina' : 'pagine'}).
                    Vengono scaricate a piena qualità, quindi ci vuole un po'.
                  </p>
                  <button
                    onClick={() => { setGalleryView('griglia'); setPicking(true); }}
                    disabled={!!pdfBusy}
                    className={bottone('secondario', 'piccolo', 'w-full mt-2')}
                  >
                    Scegli tu quali foto
                  </button>
                  <p className="text-[9px] text-gray-400 italic mt-2">
                    Tocca una foto per vederla grande. Le foto restano nel campo: alla chiusura finiscono
                    nell'archivio insieme ai conti.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ---------- ARCHIVIO (campi chiusi) ---------- */}
        {activeTab === 'archivio' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Archivio</h3>
              {archives.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  Nessun campo archiviato. Quando i conti sono chiusi, usa <span className="font-bold">Spese Totali → Dati → Chiudi il campo</span>:
                  tutto finisce qui e l'app riparte pulita per l'evento successivo.
                </p>
              ) : (
                <ul className="space-y-3">
                  {archives.map((a) => (
                    <li key={a.id} className="bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-rustic text-base text-[#2D392C] truncate">{a.name}</p>
                          <p className="text-[10px] text-gray-500">
                            {a.from === a.to ? a.from : `${a.from} → ${a.to}`} · chiuso il {new Date(a.closedAt).toLocaleDateString('it-IT')}
                          </p>
                        </div>
                        <span className="font-rustic font-bold text-[#2D392C] shrink-0">{money((a.totals && a.totals.overall) || 0)} €</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
                        <span>{(a.totals && a.totals.members) || 0} membri</span>
                        <span>{(a.totals && a.totals.purchases) || 0} spese</span>
                        <span>{(a.totals && a.totals.meals) || 0} pasti</span>
                        {a.photos > 0 && <span>{a.photos} foto</span>}
                        {!a.state && <span className="text-[#8F9E8B] italic">solo cloud</span>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setViewArchive(a)} className={bottone('primario', 'piccolo', 'flex-1')}>Resoconto</button>
                        {a.photos > 0 && (
                          <button onClick={() => openAlbum(a)} className="flex-1 py-2 bg-[#8F9E8B] text-white rounded text-[10px] font-bold uppercase hover:brightness-95">Album</button>
                        )}
                        <button onClick={() => downloadArchive(a)} className={bottone('bruno', 'piccolo', 'flex-1')}>Scarica</button>
                        <button onClick={() => removeArchive(a)} aria-label="Elimina archivio" className={bottone('distruttivo', 'minuscolo')}>Elimina</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Album di un campo chiuso: le miniature si scaricano su richiesta. */}
            {album && (
              <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
                <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
                  <h3 className="font-rustic text-lg text-[#2D392C] truncate">Album · {album.name}</h3>
                  <button onClick={() => setAlbum(null)} className={bottone('testuale', 'minuscolo', 'shrink-0')}>Chiudi</button>
                </div>
                {album.loading ? (
                  <p className="text-sm text-gray-400 italic">Carico l'album…</p>
                ) : album.photos.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Nessuna foto trovata: serve la linea per scaricarle.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {album.photos.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => openPhoto(p)}
                        className="relative aspect-square overflow-hidden rounded border border-[#8F9E8B]/30 bg-[#F0F4F1]"
                        aria-label={`Foto di ${p.by || 'anonimo'}`}
                      >
                        <img src={p.thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                        {p.by && (
                          <span className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-[8px] px-1 py-0.5 truncate text-left">{p.by}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-[9px] text-gray-400 italic text-center px-4">
              Il file scaricato alla chiusura è l'unica copia che contiene anche le foto degli scontrini: conservalo.
            </p>
          </div>
        )}

        {/* ---------- AIUTA BANDY (mini gioco) ---------- */}
        {activeTab === 'gioco' && (
          <div className="space-y-4">
            {!gameRunning ? (
              <>
                <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
                  <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aiuta Bandy</h3>
                  <div className="flex items-center gap-3">
                    <img src="./bandy.png" alt="Bandy" className="w-14 h-14 rounded border-2 border-[#8F9E8B]/40 bg-[#F0F4F1]" style={{ imageRendering: 'pixelated' }} />
                    <p className="text-[11px] text-gray-600 leading-snug">
                      Bandy è in montagna e non è ancora fatto: raggiungilo con la canna più volte che puoi. Ogni volta che lo prendi la canna si allunga — se sbatti contro i bordi o contro te stesso, GAME OVER.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Nome giocatore</label>
                    <input
                      type="text"
                      value={gamePlayer}
                      onChange={(e) => setGamePlayer(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && startGame()}
                      placeholder="Come ti chiami?"
                      maxLength={24}
                      className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                    />
                  </div>
                  <button onClick={startGame} className={bottone('primario', 'grande', 'w-full')}>
                    Gioca
                  </button>
                  <p className="text-[9px] text-gray-400 italic">Comandi: scorri il dito sul campo o usa le frecce sotto. Da computer: frecce o WASD.</p>
                </div>

                <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md">
                  <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
                    <h3 className="font-rustic text-lg">Classifica</h3>
                    <button onClick={refreshLeaderboard} className="text-[9px] uppercase font-bold text-[#8F9E8B] hover:text-white">Aggiorna</button>
                  </div>
                  <div className="flex justify-between text-xs mb-3 pb-2 border-b border-[#8F9E8B]/20">
                    <span className="text-[#8F9E8B]">Il tuo record</span>
                    <span className="font-rustic text-[#D97706] text-lg leading-none">{gameBest}</span>
                  </div>
                  {leaderboard.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic">Nessun punteggio condiviso ancora. Gioca una partita: con la linea il tuo record finisce qui per tutti.</p>
                  ) : (
                    <ul className="space-y-1">
                      {leaderboard.map((r, i) => (
                        <li key={r.name + i} className="flex items-center justify-between py-1">
                          <span className="text-sm truncate">
                            <span className="text-[#8F9E8B] mr-2">{i + 1}.</span>
                            {i === 0 ? '🏆 ' : ''}{r.name}
                          </span>
                          <span className="font-rustic font-bold text-[#D97706]">{r.score}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <BandyGame
                playerName={gamePlayer.trim()}
                bestLocal={gameBest}
                onGameOver={endGame}
                onExit={() => { setGameRunning(false); refreshLeaderboard(); }}
              />
            )}
          </div>
        )}

        {/* ---------- COME FUNZIONA (guida) ---------- */}
        {activeTab === 'guida' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-1">Come funziona l'app</h3>
              <p className="text-[11px] text-gray-500 mb-3">Tocca un'area per vedere a cosa serve. In sintesi: segni presenze e spese, l'app calcola quanto deve ciascuno e chi rimborsa chi.</p>

              {/* Pills */}
              <div className="flex flex-wrap gap-1.5">
                {GUIDE.map((g) => (
                  <button
                    key={g.k}
                    onClick={() => setGuideOpen(g.k)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                      guideOpen === g.k ? 'bg-[#2D392C] text-white' : 'bg-[#F0F4F1] text-[#2D392C] border border-[#8F9E8B]/40 hover:bg-[#E2EAE4]'
                    }`}
                  >
                    {g.icon} {g.title}
                  </button>
                ))}
              </div>

              {/* Testo della pill selezionata */}
              {(() => {
                const g = GUIDE.find((x) => x.k === guideOpen) || GUIDE[0];
                return (
                  <div className="mt-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg leading-none">{g.icon}</span>
                      <span className="font-rustic text-[#2D392C]">{g.title}</span>
                    </div>
                    <p className="text-xs text-[#2D392C] leading-relaxed">{g.body}</p>
                  </div>
                );
              })()}
            </div>

            <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md">
              <h4 className="font-rustic text-base mb-2">In tre passi</h4>
              <ol className="text-xs space-y-1.5 list-decimal list-inside text-[#F0F4F1]/90">
                <li>In <span className="font-bold">Membri</span> aggiungi le persone (e segna chi è bambino).</li>
                <li>Ogni giorno segna le <span className="font-bold">Presenze</span> e registra le spese nella <span className="font-bold">Lista della Spesa</span>: prima cosa serve in "Da acquistare", poi la sposti in "Acquistato" con prezzo e acquirente.</li>
                <li>In <span className="font-bold">Spese Totali → Saldi</span> vedi chi deve dare o ricevere e chi paga chi, e con <span className="font-bold">Condividi resoconto</span> lo mandi nel gruppo.</li>
              </ol>
            </div>
          </div>
        )}

        {/* ---------- IMPOSTAZIONI ---------- */}
        {activeTab === 'impostazioni' && (
          <div className="space-y-4">
            {/* Pronto per il campo */}
            <div className={`p-4 rounded-lg border-2 shadow-sm space-y-3 ${readyOk ? 'bg-white border-[#2D392C]/20' : 'bg-white border-[#D97706]/50'}`}>
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
                <h3 className="font-rustic text-lg text-[#2D392C]">Pronto per il campo</h3>
                <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${readyOk ? 'bg-[#2D392C] text-white' : 'bg-[#D97706] text-white'}`}>
                  {readyOk ? 'Sì' : 'Non ancora'}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 leading-snug">
                A Prato Lungo non c'è linea. Controlla queste tre cose <span className="font-bold">prima di partire</span>:
                lassù non si sistemano.
              </p>
              <ul className="space-y-2">
                {readyChecks.map((c) => (
                  <li key={c.titolo} className={`flex items-start gap-2 p-2.5 rounded border ${c.ok ? 'bg-[#F0F4F1]/60 border-[#8F9E8B]/20' : 'bg-[#D97706]/10 border-[#D97706]/40'}`}>
                    <span className="text-base leading-none shrink-0">{c.ok ? '✅' : '⚠️'}</span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-[#2D392C]">{c.titolo}</div>
                      {!c.ok && <div className="text-[10px] text-[#5C4A3C] leading-snug mt-0.5">{c.no}</div>}
                    </div>
                  </li>
                ))}
              </ul>
              {readyOk && (
                <p className="text-[9px] text-gray-400 italic">Questo telefono funziona anche senza linea. Ricontrolla il giorno della partenza.</p>
              )}
            </div>

            {/* Aspetto */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aspetto</h3>
              <div className="grid grid-cols-3 gap-2">
                {[['auto', 'Automatico', '🌗'], ['light', 'Chiaro', '☀️'], ['dark', 'Scuro', '🌙']].map(([k, l, icon]) => (
                  <button
                    key={k}
                    onClick={() => setTheme(k)}
                    className={`py-2.5 rounded text-[10px] font-bold uppercase tracking-wide border-b-4 transition-all ${
                      theme === k ? 'bg-[#2D392C] text-white border-[#5C4A3C]' : 'bg-white text-[#2D392C] border-gray-300 hover:bg-[#E2EAE4]'
                    }`}
                  >
                    <span className="block text-base leading-none mb-1">{icon}</span>
                    {l}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500">
                {theme === 'auto'
                  ? `Segue le impostazioni del telefono: adesso è ${isDark ? 'scuro' : 'chiaro'}.`
                  : `Sempre ${theme === 'dark' ? 'scuro' : 'chiaro'}, indipendentemente dal telefono.`}
                {' '}Comodo la sera in tenda: schermo scuro, meno luce in faccia a tutti.
              </p>
            </div>

            {/* Galleria */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Galleria</h3>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#2D392C]">Foto per persona</span>
                <div className="flex items-center gap-2 shrink-0">
                  {[3, 4, 5, 7].map((n) => (
                    <button
                      key={n}
                      onClick={() => { setPhotoCap(n); scriviLocale(PHOTO_CAP_KEY, String(n)); }}
                      className={`w-9 py-1.5 rounded text-xs font-bold border-b-2 ${photoCap === n ? 'bg-[#2D392C] text-white border-[#5C4A3C]' : 'bg-white text-[#2D392C] border-gray-300'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-gray-500 leading-snug">
                Quante foto può caricare ciascuno. È un accordo di gruppo che vale su questo telefono, non un
                controllo: serve a far scegliere le foto belle. Mettetevi d'accordo sullo stesso numero.
              </p>
            </div>

            {/* Diagnostica della sincronizzazione: cosa è stato cancellato e
                quando. Senza questa scheda, capire chi ha fatto sparire cosa
                vuol dire leggere il database a mano. Solo in modalità tecnica. */}
            {admin && (
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Diagnostica sincronizzazione</h3>
              {(() => {
                const m = metaRef.current || { rev: {}, del: {} };
                const st = syncStateRef.current;
                const lapidi = Object.keys(m.del || {})
                  .map((p) => ({ p, at: m.del[p] }))
                  .sort((a, b) => b.at - a.at);
                // diagTick serve solo a far ridisegnare questa scheda quando la
                // copia di scorta viene buttata: senza, resterebbe a schermo.
                void diagTick;
                const scorta = load(RESCUE_KEY, null);
                return (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
                      <span><span className="font-bold text-[#2D392C]">{Object.keys(m.rev || {}).length}</span> voci datate</span>
                      <span><span className="font-bold text-[#2D392C]">{lapidi.length}</span> cancellazioni registrate</span>
                    </div>

                    {/* Un telefono pieno di dati ma senza nemmeno una data è
                        indifeso: non può vincere un confronto e la prima
                        sincronizzazione gli porta via tutto ciò che gli altri
                        hanno cancellato. È lo stato in cui si finisce quando la
                        memoria si riempie, e non si vedeva da nessuna parte. */}
                    {Object.keys(m.rev || {}).length === 0 &&
                      ((st.members || []).length > 0 || (st.purchases || []).length > 0 || Object.keys(st.campData || {}).length > 0) && (
                      <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                        <p className="text-[10px] text-[#5C4A3C] leading-snug">
                          <span className="font-bold">Questo telefono non ha ancora la cronologia delle modifiche.</span> I dati ci
                          sono, ma sono "senza data": in una sincronizzazione perdono contro quelli degli altri. Basta
                          toccare qualcosa perché riparta. Se succede spesso, è la memoria del telefono che è piena.
                        </p>
                      </div>
                    )}

                    {/* Cosa non è ancora arrivato agli altri, e come forzarlo. */}
                    {(cloud.pending || (cloud.foto || 0) > 0) && (
                      <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                        <p className="text-[10px] text-[#5C4A3C] leading-snug">
                          <span className="font-bold">Da inviare:</span>
                          {cloud.pending ? ' le ultime modifiche' : ''}
                          {cloud.pending && (cloud.foto || 0) > 0 ? ' e' : ''}
                          {(cloud.foto || 0) > 0 ? ` ${cloud.foto} ${cloud.foto === 1 ? 'foto' : 'foto'}` : ''}.
                          {' '}L'app riprova da sola, con attese sempre più lunghe. Tieni l'app aperta e la linea
                          attiva finché la spia in alto non torna verde.
                        </p>
                        <button
                          onClick={() => { const CS = window.CloudSync; if (CS && CS.riprova) CS.riprova(); }}
                          className={bottone('avviso', 'piccolo', 'w-full mt-2')}
                        >
                          Riprova adesso
                        </button>
                      </div>
                    )}

                    {scorta && scorta.state && (
                      <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5 space-y-2">
                        <p className="text-[10px] text-[#5C4A3C] leading-snug">
                          <span className="font-bold">Rete di sicurezza.</span> Il {new Date(scorta.at).toLocaleString('it-IT')} una
                          sincronizzazione ha tolto {scorta.perse === 1 ? 'una voce' : `${scorta.perse} voci`} da questo telefono, e
                          l'app ha messo da parte una copia di com'era prima.
                          {scorta.quando ? (
                            <> La cancellazione è stata fatta il <span className="font-bold">{new Date(scorta.quando).toLocaleString('it-IT')}</span>
                              {Date.now() - scorta.quando > PERDITA_RECENTE
                                ? <> — non adesso: questo telefono era indietro e l'ha saputo solo ora.</>
                                : '.'}
                            </>
                          ) : null}
                        </p>
                        <p className="text-[10px] text-[#5C4A3C] leading-snug">
                          Annullando torna {scorta.perse === 1 ? 'quella voce' : 'quello che è sparito'}
                          {scorta.paths && scorta.paths.length
                            ? <> — <span className="font-bold">{descriviPerdite(scorta.paths, scorta.state)}</span></>
                            : null}, su tutti i telefoni. Tutto il resto, comprese le modifiche fatte dopo, rimane.
                        </p>
                        <button onClick={annullaSync} className={bottone('avviso', 'piccolo', 'w-full')}>
                          Annulla quella sincronizzazione
                        </button>
                        <button
                          onClick={() => { if (window.confirm('Buttare la copia di scorta?\nDopo non si potrà più annullare quella sincronizzazione.')) { localStorage.removeItem(RESCUE_KEY); setLostSync(null); setDiagTick((t) => t + 1); } }}
                          className={bottone('testuale', 'minuscolo', 'w-full')}
                        >
                          Va bene così, butta la copia
                        </button>
                      </div>
                    )}

                    {lapidi.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic">Nessuna cancellazione registrata su questo telefono.</p>
                    ) : (
                      <div>
                        <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Ultime cancellazioni</p>
                        <ul className="space-y-1">
                          {lapidi.slice(0, 12).map((l) => (
                            <li key={l.p} className="flex items-start justify-between gap-2 text-[10px] bg-[#F0F4F1]/60 px-2 py-1.5 rounded border border-[#8F9E8B]/20">
                              <span className="text-[#2D392C] leading-snug">{descriviPath(l.p, st)}</span>
                              <span className="text-gray-500 shrink-0">
                                {new Date(l.at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                                {' '}{new Date(l.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {lapidi.length > 12 && (
                          <p className="text-[9px] text-gray-400 italic mt-1">…e altre {lapidi.length - 12}.</p>
                        )}
                      </div>
                    )}
                    <p className="text-[9px] text-gray-400 italic leading-snug">
                      Una cancellazione è normale quando qualcuno toglie davvero una voce. Se ne vedi tante
                      tutte allo stesso minuto, è il segno di un ripristino, di un'importazione o di un
                      "Copia da ieri": in quel caso la copia di scorta qui sopra rimette tutto a posto.
                    </p>
                  </div>
                );
              })()}
            </div>
            )}

            {/* Registro delle modifiche: chi ha cambiato cosa e quando. Non ci
                sono utenti tracciati, quindi si distingue almeno fra ciò che è
                stato fatto qui e ciò che è arrivato dalla sincronizzazione.
                Solo in modalità tecnica. */}
            {admin && (
            <div className="bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden">
              <button
                onClick={() => setLogOpen((v) => !v)}
                className={bottoneRiga()}
              >
                <span className="font-rustic text-lg text-[#2D392C] shrink-0">Registro modifiche</span>
                <span className="ml-auto flex items-center gap-2 shrink-0">
                  <span className="text-[9px] uppercase font-bold px-2 py-1 rounded bg-gray-200 text-gray-500">
                    {(() => { void diagTick; const n = logLeggi().length; return n === 0 ? 'vuoto' : `${n} voci`; })()}
                  </span>
                  <span className={`text-[10px] text-[#5C4A3C] transition-transform ${logOpen ? 'rotate-180' : ''}`}>▾</span>
                </span>
              </button>
              {logOpen && (<div className="px-4 pb-4 space-y-3">
                {(() => {
                  void diagTick;
                  const reg = logLeggi();
                  const st = syncStateRef.current;
                  if (reg.length === 0) {
                    return <p className="text-[11px] text-gray-400 italic">Ancora nessuna modifica registrata su questo telefono.</p>;
                  }
                  // Raggruppate per giorno: leggere 400 righe di fila è inutile.
                  const perGiorno = [];
                  reg.forEach((r) => {
                    const g = new Date(r.at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
                    const ultimo = perGiorno[perGiorno.length - 1];
                    if (ultimo && ultimo.giorno === g) ultimo.voci.push(r);
                    else perGiorno.push({ giorno: g, voci: [r] });
                  });
                  return (
                    <>
                      <p className="text-[10px] text-gray-500 leading-snug">
                        Ogni modifica, fatta qui o arrivata dagli altri, con data e ora. Le più recenti in alto.
                        Resta su questo telefono e non viene sincronizzata.
                      </p>
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {perGiorno.map((gruppo) => (
                          <div key={gruppo.giorno}>
                            <p className="text-[9px] uppercase font-bold text-gray-500 tracking-wide mb-1">{gruppo.giorno}</p>
                            <ul className="space-y-1">
                              {gruppo.voci.map((r, i) => (
                                <li key={r.p + r.at + i} className="flex items-start gap-2 text-[10px] bg-[#F0F4F1]/60 px-2 py-1.5 rounded border border-[#8F9E8B]/20">
                                  <span className="text-gray-500 shrink-0 w-10">
                                    {new Date(r.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className={`shrink-0 w-3 text-center ${r.k === 'd' ? 'text-red-700' : 'text-[#2D392C]'}`} title={r.k === 'd' ? 'cancellata' : 'modificata'}>
                                    {r.k === 'd' ? '−' : '+'}
                                  </span>
                                  <span className="min-w-0 flex-grow leading-snug">
                                    <span className="font-bold text-[#5C4A3C]">{sezioneDiPath(r.p)}</span>
                                    <span className="text-[#2D392C]"> · {descriviPath(r.p, st)}</span>
                                  </span>
                                  <span className={`shrink-0 text-[8px] uppercase font-bold px-1.5 py-0.5 rounded ${r.o === 'io' ? 'bg-[#2D392C]/10 text-[#2D392C]' : 'bg-[#5C4A3C]/10 text-[#5C4A3C]'}`}>
                                    {r.o === 'io' ? 'qui' : 'sync'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={esportaRegistro} className={bottone('primario', 'piccolo', 'flex-1')}>Esporta il registro</button>
                        <button
                          onClick={() => { if (window.confirm('Svuotare il registro delle modifiche?\nI dati non vengono toccati: si perde solo lo storico.')) { localStorage.removeItem(LOG_KEY); setDiagTick((t) => t + 1); } }}
                          className={bottone('secondario', 'piccolo', 'flex-1')}
                        >
                          Svuota
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>)}
            </div>
            )}

            {/* Blocco con password — riga richiudibile: si imposta una volta e
                non si tocca più, quindi sta chiusa e in fondo. */}
            <div className="bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden">
              <button
                onClick={() => setBloccoOpen((v) => !v)}
                className={bottoneRiga()}
              >
                <span className="font-rustic text-lg text-[#2D392C] shrink-0">Blocco con password</span>
                <span className="ml-auto flex items-center gap-1.5 shrink-0">
                  {/* Stato del database anche da chiusa: è l'unica cosa che
                      serve vedere a colpo d'occhio. */}
                  {(() => {
                    const lock = window.APP_LOCK || {};
                    if (!lock.dbEmail || !(LOCK && LOCK.hash)) return null;
                    const protetto = cloud.authMode === 'shared';
                    const ignoto = !protetto && !cloud.connected;
                    return <span className="text-[10px]" title={protetto ? 'Database protetto' : ignoto ? 'Non collegato' : 'Database ad accesso aperto'}>{protetto ? '🔒' : ignoto ? '—' : '⚠'}</span>;
                  })()}
                  <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${LOCK && LOCK.hash ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {LOCK && LOCK.hash ? 'Attivo' : 'Non attivo'}
                  </span>
                  <span className={`text-[10px] text-[#5C4A3C] transition-transform ${bloccoOpen ? 'rotate-180' : ''}`}>▾</span>
                </span>
              </button>
              {bloccoOpen && (<div className="px-4 pb-4 space-y-3">
              {LOCK && LOCK.hash ? (
                <>
                  <p className="text-[10px] text-gray-500 leading-snug">
                    All'apertura serve la password del campo. Tienila nel gruppo, non pubblicarla altrove.
                    Serve a non lasciare spese, nomi e scontrini alla portata di chi capita sull'indirizzo:
                    non è una cassaforte, perché il controllo gira sul telefono.
                  </p>
                  {/* Stato reale della protezione del database: il blocco
                      dell'app e la chiusura del cloud sono due cose diverse. */}
                  {(() => {
                    const lock = window.APP_LOCK || {};
                    if (!lock.dbEmail) return null;
                    const protetto = cloud.authMode === 'shared';
                    // Senza collegamento non si può sapere come si entrerà nel
                    // database: meglio dirlo, invece di allarmare chi è offline.
                    const ignoto = !protetto && !cloud.connected;
                    return (
                      <div className={`p-3 rounded border ${protetto ? 'bg-[#2D392C]/5 border-[#2D392C]/25' : ignoto ? 'bg-[#F0F4F1]/60 border-[#8F9E8B]/30' : 'bg-[#D97706]/10 border-[#D97706]/40'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase font-bold text-gray-500">Database</span>
                          <span className={`text-[10px] font-bold ${protetto ? 'text-[#2D392C]' : ignoto ? 'text-gray-500' : 'text-[#D97706]'}`}>
                            {protetto ? '🔒 protetto dalla password' : ignoto ? '— non collegato' : '⚠ accesso aperto'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-snug mt-1">
                          {protetto
                            ? 'L\'app entra nel database con l\'utente del campo: senza password i dati non si leggono nemmeno da fuori.'
                            : ignoto
                            ? 'Senza linea non c\'è nulla da proteggere: si lavora in locale. Il controllo si aggiorna al prossimo collegamento.'
                            : 'I dati nel cloud sono ancora raggiungibili senza password. Per chiuderli servono i passaggi nella console Firebase (utente condiviso + regole): finché non sono fatti, il blocco protegge solo la schermata.'}
                        </p>
                      </div>
                    );
                  })()}
                  <label className="flex items-center gap-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20 cursor-pointer">
                    <input type="checkbox" checked={askAlways} onChange={toggleAskAlways} className="w-4 h-4 accent-[#2D392C] shrink-0" />
                    <span className="text-[11px] text-[#2D392C] leading-snug">
                      Chiedi la password <span className="font-bold">ogni volta</span> che apro l'app
                      <span className="block text-[9px] text-gray-500">Senza la spunta il telefono resta sbloccato fino a "Blocca ora".</span>
                    </span>
                  </label>
                  {window.CloudSync && window.CloudSync.needsPassword && window.CloudSync.needsPassword() && (
                    <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                      <p className="text-[11px] text-[#5C4A3C] leading-snug">
                        La sincronizzazione sta usando l'accesso di ripiego. L'app chiede la
                        password da sola quando serve: se non è successo, tocca
                        <span className="font-bold"> Blocca ora</span> e rientra.
                      </p>
                    </div>
                  )}
                  <button onClick={lockNow} className={bottone('bruno', 'normale', 'w-full')}>
                    🔒 Blocca ora
                  </button>
                </>
              ) : (
                <p className="text-[10px] text-gray-500">
                  Nessuna password impostata: l'app si apre a chiunque abbia l'indirizzo.
                </p>
              )}
              </div>)}
            </div>

            {/* Dati su questo telefono — riga richiudibile. */}
            <div className="bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden">
              <button
                onClick={() => setDatiOpen((v) => !v)}
                className={bottoneRiga()}
              >
                <span className="font-rustic text-lg text-[#2D392C] shrink-0">Dati su questo telefono</span>
                <span className="ml-auto flex items-center gap-2 shrink-0">
                  <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${cloud.connected ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {cloud.connected ? 'Connessa' : isOnline ? 'Non connessa' : 'Offline'}
                  </span>
                  <span className={`text-[10px] text-[#5C4A3C] transition-transform ${datiOpen ? 'rotate-180' : ''}`}>▾</span>
                </span>
              </button>
              {datiOpen && (<div className="px-4 pb-4 space-y-3">
              <div className="flex gap-2">
                <button onClick={exportData} className={bottone('primario', 'normale', 'flex-1')}>Esporta backup</button>
                <button onClick={() => goTo('spesa')} className={bottone('secondario', 'normale', 'flex-1')}>Gestione dati</button>
              </div>
              <button onClick={wipeLocal} className={bottone('distruttivo', 'normale', 'w-full')}>
                Cancella i dati da questo telefono
              </button>
              <p className="text-[9px] text-gray-400 italic leading-snug">
                Utile se presti o cambi telefono. Il cloud non viene toccato: con la linea i dati tornano da soli.
              </p>
              </div>)}
            </div>

            {/* Modalità tecnica — riga richiudibile. Si accende con una
                password sua, per telefono: gli avvisi sulle voci cancellate,
                la diagnostica, il registro e il promemoria del backup si
                vedono solo qui. Gli altri usano l'app e basta. */}
            <div className="bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden">
              <button
                onClick={() => setTecnicaOpen((v) => !v)}
                className={bottoneRiga()}
              >
                <span className="font-rustic text-lg text-[#2D392C] shrink-0">Modalità tecnica</span>
                <span className="ml-auto flex items-center gap-2 shrink-0">
                  <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${admin ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {admin ? 'Attiva' : 'Spenta'}
                  </span>
                  <span className={`text-[10px] text-[#5C4A3C] transition-transform ${tecnicaOpen ? 'rotate-180' : ''}`}>▾</span>
                </span>
              </button>
              {tecnicaOpen && (<div className="px-4 pb-4 space-y-3">
                {admin ? (
                  <>
                    <p className="text-[10px] text-gray-500 leading-snug">
                      Su questo telefono si vedono la <span className="font-bold">Diagnostica sincronizzazione</span>, il
                      <span className="font-bold"> Registro modifiche</span>, gli avvisi sulle voci cancellate e il
                      promemoria serale del backup. Sono strumenti per chi tiene i conti: sugli altri telefoni
                      non compare niente di tutto questo.
                    </p>
                    <button
                      onClick={esciAdmin}
                      className={bottone('secondario', 'normale', 'w-full')}
                    >
                      Spegni la modalità tecnica
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-gray-500 leading-snug">
                      Per chi tiene i conti del campo: mostra la diagnostica della sincronizzazione, il registro
                      delle modifiche e gli avvisi tecnici, solo su questo telefono. Ha una password dedicata,
                      diversa da quella del campo.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={adminPwd}
                        onChange={(e) => { setAdminPwd(e.target.value); setAdminErr(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && entraAdmin()}
                        placeholder="Password tecnica"
                        className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm"
                      />
                      <button
                        onClick={entraAdmin}
                        className={bottone('primario', 'normale', 'shrink-0')}
                      >
                        Attiva
                      </button>
                    </div>
                    {adminErr && <p className="text-[10px] font-bold text-red-700">{adminErr}</p>}
                  </>
                )}
              </div>)}
            </div>

            {/* Info */}
            <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md space-y-2">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-1">Info</h3>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#8F9E8B]">Versione installata</span>
                <span className="font-bold">{swVersion || '—'}</span>
              </div>
              <p className="text-[10px] text-[#F0F4F1]/70 leading-snug">
                L'app si aggiorna da sola: se non vedi una novità, chiudila e riaprila.
              </p>
              <p className="text-[9px] text-[#8F9E8B]/80 pt-1">{BRAND.credits}</p>
            </div>
          </div>
        )}
      </main>

      {/* Registrazione acquisto di una voce "Da Acquistare" */}
      {buying && (
        <div onClick={() => setBuying(null)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-3 shadow-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-[#8F9E8B]/40 pb-2">
              <h3 className="font-rustic text-lg text-[#2D392C] min-w-0 break-words">
                Acquistata: {buying.name}{buying.qty ? ` (${buying.qty})` : ''}
              </h3>
              {/* Foto dello scontrino: si allega qui, con lo scontrino in mano */}
              {receipts[buying.id] ? (
                <button
                  onClick={() => setViewReceipt(receipts[buying.id])}
                  aria-label="Vedi scontrino"
                  className={bottoneIcona('pieno', 'shrink-0')}
                >
                  📷
                </button>
              ) : (
                <label
                  title="Scontrino: scatta una foto o scegli dalla galleria"
                  aria-label="Allega scontrino"
                  className="shrink-0 cursor-pointer px-3 py-2 rounded border-2 border-[#8F9E8B]/50 bg-white text-lg leading-none hover:bg-[#E2EAE4]"
                >
                  📷
                  <input type="file" accept="image/*" onChange={(e) => attachReceiptTo(e, buying.id)} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-[10px] text-gray-500 -mt-1">
              {receipts[buying.id]
                ? 'Scontrino allegato: tocca 📷 per rivederlo.'
                : 'Tocca 📷 per allegare lo scontrino: puoi scattarlo o prenderlo dalla galleria.'}
            </p>
            <div>
              <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Prezzo (€)</label>
              <input
                type="number" min="0" step="0.01" inputMode="decimal" autoFocus
                value={buying.price}
                onChange={(e) => setBuying((b) => ({ ...b, price: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && confirmBuy()}
                placeholder="0.00"
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Acquirente</label>
              {renderBuyerSelect(buying.buyer, (v) => setBuying((b) => ({ ...b, buyer: v })))}
            </div>
            <div>
              <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Tipologia</label>
              <select
                value={buying.type}
                onChange={(e) => setBuying((b) => ({ ...b, type: e.target.value }))}
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold"
              >
                {Object.keys(PURCHASE_TYPES).map((k) => (<option key={k} value={k}>{PURCHASE_TYPES[k]}</option>))}
              </select>
            </div>
            {buying.type === 'logistica' && (
                <p className="text-[10px] text-gray-500 leading-snug bg-[#F0F4F1]/60 border border-[#8F9E8B]/25 rounded p-2">
                  La <span className="font-bold">logistica</span> si divide a testa fra chi ha pasti nei
                  giorni a conto comune, non per giorno: chi c'è stato solo nei giorni a conto separato
                  non la paga, e per questo qui il conto non si applica.
                </p>
            )}
            {buying.type !== 'logistica' && (
              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Conto</label>
                <select
                  value={buying.account || 'comune'}
                  onChange={(e) => setBuying((b) => ({ ...b, account: e.target.value }))}
                  className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold"
                >
                  <option value="comune">Conto comune</option>
                  <option value="sep">Conto separato</option>
                </select>
                {buying.account === 'sep' && sepDays.length === 0 && (
                  <p className="text-[9px] mt-1 leading-snug text-[#5C4A3C]">
                    ⚠ Nessun giorno spuntato come "conto separato" in Calendario.
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setBuying(null)} className={bottone('secondario', 'normale', 'flex-1')}>Annulla</button>
              <button onClick={confirmBuy} className={bottone('primario', 'normale', 'flex-1')}>Conferma</button>
            </div>
          </div>
        </div>
      )}

      {/* Correzione di una voce già registrata */}
      {editing && (
        <div onClick={() => setEditing(null)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-3 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-[#8F9E8B]/40 pb-2">
              <h3 className="font-rustic text-lg text-[#2D392C]">
                {editing.kind === 'purchase' ? 'Correggi la spesa' : 'Correggi la voce'}
              </h3>
              {/* Anche in correzione si può mettere o rivedere lo scontrino */}
              {receipts[editing.id] ? (
                <button onClick={() => setViewReceipt(receipts[editing.id])} aria-label="Vedi scontrino" className={bottoneIcona('pieno', 'shrink-0')}>📷</button>
              ) : (
                <label title="Scontrino: scatta una foto o scegli dalla galleria" aria-label="Allega scontrino" className="shrink-0 cursor-pointer px-3 py-2 rounded border-2 border-[#8F9E8B]/50 bg-white text-lg leading-none hover:bg-[#E2EAE4]">
                  📷
                  <input type="file" accept="image/*" onChange={(e) => attachReceiptTo(e, editing.id)} className="hidden" />
                </label>
              )}
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Nome</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))}
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Acquirente</label>
              {renderBuyerSelect(editing.buyer, (v) => setEditing((x) => ({ ...x, buyer: v })))}
            </div>

            <div className={editing.kind === 'purchase' ? 'grid grid-cols-2 gap-3' : ''}>
              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Prezzo (€)</label>
                <input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={editing.price}
                  onChange={(e) => setEditing((x) => ({ ...x, price: e.target.value }))}
                  className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
                />
              </div>
              {editing.kind === 'purchase' && (
                <div>
                  <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Tipologia</label>
                  <select
                    value={editing.type}
                    onChange={(e) => setEditing((x) => ({ ...x, type: e.target.value }))}
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold"
                  >
                    {Object.keys(PURCHASE_TYPES).map((k) => (<option key={k} value={k}>{PURCHASE_TYPES[k]}</option>))}
                  </select>
                </div>
              )}
            </div>

            {/* Il conto separato vale solo su cibo e bevande. Prima, sulla
                logistica, la riga semplicemente non compariva: chi la cercava
                non trovava niente e non poteva sapere perche'. Ora si dice. */}
            {editing.kind === 'purchase' && (editing.type !== 'logistica' ? (
              <div>
                <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Conto</label>
                <select
                  value={editing.account}
                  onChange={(e) => setEditing((x) => ({ ...x, account: e.target.value }))}
                  className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold"
                >
                  <option value="comune">Conto comune</option>
                  <option value="sep">Conto separato</option>
                </select>
              </div>
            ) : (
                <p className="text-[10px] text-gray-500 leading-snug bg-[#F0F4F1]/60 border border-[#8F9E8B]/25 rounded p-2">
                  La <span className="font-bold">logistica</span> si divide a testa fra chi ha pasti nei
                  giorni a conto comune, non per giorno: chi c'è stato solo nei giorni a conto separato
                  non la paga, e per questo qui il conto non si applica.
                </p>
            ))}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(null)} className={bottone('secondario', 'normale', 'flex-1')}>Annulla</button>
              <button onClick={saveEdit} className={bottone('primario', 'normale', 'flex-1')}>Salva</button>
            </div>
          </div>
        </div>
      )}

      {/* Scelta dello snapshot da ripristinare */}
      {snapList && (
        <div onClick={() => setSnapList(null)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-2 max-h-[70vh] overflow-y-auto shadow-2xl">
            <h3 className="font-rustic text-lg text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2">Ripristina un salvataggio</h3>
            <p className="text-[10px] text-gray-500">
              Copie automatiche: due al giorno sul telefono (una dopo mezzanotte e una dopo
              mezzogiorno, alla prima apertura), più una al giorno nel cloud.
              Quelle <span className="font-bold">sul telefono</span> ci sono anche senza linea.
            </p>
            {snapList.map((s) => {
              const giorno = parseDate(s.id.slice(0, 10)).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' });
              const fascia = s.id.slice(11) === '00' ? 'mattina' : s.id.slice(11) === '12' ? 'pomeriggio' : '';
              const ora = s.at ? new Date(s.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
              return (
                <button
                  key={s.dove + s.id}
                  onClick={() => restoreSnapshot(s)}
                  className="w-full py-2 px-3 bg-[#F0F4F1] border border-[#8F9E8B]/40 rounded text-left text-[#2D392C] hover:bg-[#E2EAE4] flex items-center justify-between gap-2"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold truncate">{giorno}</span>
                    <span className="block text-[9px] text-gray-500">
                      {fascia ? `${fascia}${ora ? ` · copia delle ${ora}` : ''}` : 'copia del cloud'}
                    </span>
                  </span>
                  <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 bg-white border border-[#8F9E8B]/40 text-gray-500">
                    {s.dove === 'locale' ? 'sul telefono' : 'cloud'}
                  </span>
                </button>
              );
            })}
            <button onClick={() => setSnapList(null)} className={bottone('testuale', 'normale', 'w-full')}>Annulla</button>
          </div>
        </div>
      )}

      {/* Chiusura del campo: nome dell'archivio e riepilogo di cosa succede */}
      {closing && (
        <div onClick={() => setClosing(false)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-3 max-h-[80vh] overflow-y-auto shadow-2xl">
            <h3 className="font-rustic text-lg text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2">Chiudi il campo</h3>
            <label className="block text-[10px] uppercase font-bold text-gray-500">Nome dell'archivio</label>
            <input
              type="text"
              value={closeName}
              onChange={(e) => setCloseName(e.target.value)}
              placeholder="Es. Prato Lungo 2026"
              className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
            />
            <div className="bg-[#F0F4F1]/60 rounded p-3 text-[11px] text-gray-600 space-y-1">
              <p className="font-bold text-[#2D392C]">Verrà archiviato:</p>
              <p>{money(totals.overallTotal)} € di spese · {purchases.length} acquisti · {members.length} membri</p>
              <p className="font-bold text-[#2D392C] pt-1">Poi verranno azzerati:</p>
              <p>membri, presenze, spese, lista, attrezzatura, dotazioni aggiuntive e foto degli scontrini — su tutti i dispositivi.</p>
              <p className="pt-1 italic">Restano: archivio, classifica del gioco e impostazioni.</p>
            </div>
            <button onClick={closeCamp} className={bottone('bruno', 'grande', 'w-full')}>
              Archivia e azzera
            </button>
            <button onClick={() => setClosing(false)} className={bottone('testuale', 'normale', 'w-full')}>Annulla</button>
          </div>
        </div>
      )}

      {/* Resoconto di un campo archiviato */}
      {viewArchive && (
        <div onClick={() => setViewArchive(null)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-3 max-h-[80vh] overflow-y-auto shadow-2xl">
            <h3 className="font-rustic text-lg text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2">{viewArchive.name}</h3>
            <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{viewArchive.report || 'Nessun resoconto salvato.'}</pre>
            <button onClick={() => shareArchive(viewArchive)} className={bottone('whatsapp', 'normale', 'w-full')}>📤 Condividi</button>
            <button onClick={() => setViewArchive(null)} className={bottone('testuale', 'normale', 'w-full')}>Chiudi</button>
          </div>
        </div>
      )}

      {/* Visualizzatore scontrino a schermo intero (tocca per chiudere) */}
      {/* Foto della galleria a schermo pieno: l'originale si scarica solo qui. */}
      {viewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="flex-grow flex items-center justify-center w-full min-h-0" onClick={() => setViewPhoto(null)}>
            {viewPhoto.full
              ? <img src={viewPhoto.full} alt={`Foto di ${viewPhoto.by || 'anonimo'}`} className="max-w-full max-h-full rounded shadow-2xl" />
              : <div className="text-center">
                  <img src={viewPhoto.thumb} alt="" className="max-w-full max-h-[60vh] rounded opacity-40 blur-sm" />
                  <p className="mt-3 text-[11px] uppercase tracking-widest text-white/60">Scarico la foto…</p>
                </div>}
          </div>
          <div className="shrink-0 w-full max-w-md flex items-center justify-between gap-3 pt-3">
            <span className="text-[11px] text-white/70 truncate">
              {viewPhoto.by || 'anonimo'}
              {viewPhoto.at ? ` · ${new Date(viewPhoto.at).toLocaleDateString('it-IT')}` : ''}
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => removePhoto(viewPhoto)}
                className="text-[10px] uppercase font-bold px-3 py-2 rounded border border-[#D97706]/60 text-[#D97706]"
              >
                Elimina
              </button>
              <button
                onClick={() => setViewPhoto(null)}
                className="text-[10px] uppercase font-bold px-3 py-2 rounded bg-[#F0F4F1] text-[#2D392C]"
              >
                Chiudi
              </button>
            </span>
          </div>
        </div>
      )}

      {viewReceipt && (
        <div
          onClick={() => setViewReceipt(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-pointer"
        >
          <img src={viewReceipt} alt="Scontrino" className="max-w-full max-h-full rounded shadow-2xl" />
          <span className="absolute bottom-6 left-0 right-0 text-center text-[10px] uppercase tracking-widest text-white/60">Tocca per chiudere</span>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#F0F4F1] border-t-2 border-[#5C4A3C] py-3 px-4 text-center z-10">
        <div className="font-rustic text-[#2D392C] tracking-widest text-sm uppercase font-bold">{BRAND.footerMotto}</div>
      </footer>
    </div>
  );
}
