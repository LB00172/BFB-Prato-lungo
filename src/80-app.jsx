function App() {
  // ---------- La lingua ----------
  // Dietro FEATURES.lingue finche' i dizionari non sono completi: mostrare
  // meta' app in spagnolo e meta' in italiano e' peggio che non offrirla.
  const [lingua, setLingua] = useState(() => {
    const salvata = localStorage.getItem(LINGUA_KEY);
    return salvata && window.Lingue.LINGUE[salvata] ? salvata : window.Lingue.PREDEFINITA;
  });
  // Si riassegna QUI, prima di qualunque disegno: e' cio' che fa vedere la
  // lingua nuova senza ricaricare (vedi il commento su "L" in 10-fondamenta).
  L = window.Lingue.crea(FEATURES.lingue ? lingua : window.Lingue.PREDEFINITA);

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
      mk(g.food, 'alimentare', L.t('import.totaleCibo'));
      mk(g.drinks, 'bevande', L.t('import.totaleBevande'));
      mk(g.accessory, 'logistica', L.t('import.totaleAccessori'));
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

  // ---------- Foto degli scontrini ----------
  // Stato, magazzino, migrazione, potatura e scatto stanno in
  // src/77-usa-scontrini.jsx. Le tre liste che si passano sono quelle che
  // possono avere uno scontrino: servono a sapere quali foto non
  // appartengono piu' a niente.
  const {
    receipts, setReceipts, fotoDove,
    pReceipt, setPReceipt, viewReceipt, setViewReceipt,
    handleCloudReceipts, attachReceiptTo, onReceiptFile,
  } = usaScontrini({ purchases, toBuy, equipment });

  // ---------- L'account (§ 1) ----------
  // Dietro FEATURES.auth. L'hook gira comunque: senza bandiera nessuno guarda
  // il suo stato, e senza Firebase configurato resta "ospite" e basta.
  const account = usaAccount();

  // ---------- La stanza (§ 2, § 9) ----------
  // Dietro FEATURES.rooms. Come l'account, l'hook gira comunque: senza
  // bandiera nessuno guarda il suo stato.
  const stanzaStato = usaStanza();

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
  // Compiti assegnati: { id, testo, chi, fatto }. Chi fa cosa, deciso PRIMA
  // che la spesa esista. Non entrano nei conti: nei conti entra la spesa che
  // ne nasce, se ne nasce una (ROADMAP.md § 17).
  const [compiti, setCompiti] = useState(() => load('cambusa_compiti', []));
  const [nuovoCompito, setNuovoCompito] = useState('');
  const [nuovoCompitoChi, setNuovoCompitoChi] = useState('');
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
    if (!cfg || !cfg.hash) { setAdminErr(L.t('tecnica.nonConfigurata')); return; }
    const im = await improntaPassword(adminPwd, cfg);
    if (im && im === cfg.hash) {
      try { localStorage.setItem(ADMIN_KEY, '1'); } catch (e) { /* resta accesa solo finché l'app è aperta */ }
      setAdmin(true);
      setAdminPwd('');
      setAdminErr('');
    } else {
      setAdminErr(L.t(im ? 'tecnica.passwordSbagliata' : 'tecnica.serveHttps'));
    }
  };
  const esciAdmin = () => {
    try { localStorage.removeItem(ADMIN_KEY); } catch (e) { /* niente */ }
    setAdmin(false);
    setAdminPwd('');
    setAdminErr('');
  };
  const [sepOpen, setSepOpen] = useState(false);     // riga "Conto separato" aperta

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
  syncStateRef.current = { members, campData, purchases, gear, settled, equipment, toBuy, sepDays, freeDays, blocchi, compiti };

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
  useEffect(() => salvaLocale('cambusa_compiti', compiti), [compiti]);
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

    // Orologi sballati: la regola sta in allarmi.js, qui resta cosa farne.
    const sballato = Allarmi.orologioAvanti(rmeta, Date.now(), OROLOGIO_SOGLIA);
    if (sballato) {
      setOrologioFuori(sballato);
      try { localStorage.setItem(OROLOGIO_KEY, JSON.stringify(sballato)); } catch (e) { /* niente */ }
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
      // La regola — quali perdite meritano un allarme e quali sono solo il
      // recupero di un ritardo — sta in allarmi.js.
      const verdetto = Allarmi.perditeDaAnnunciare(perse, quando, Date.now(),
        { raffica: RAFFICA, recente: PERDITA_RECENTE });

      try {
        localStorage.setItem(RESCUE_KEY, JSON.stringify({
          at: Date.now(), perse: perse.length, paths: perse.slice(0, 200),
          quando: verdetto.piuRecente, state: local, meta: metaRef.current,
        }));
      } catch (e) { /* spazio esaurito: si prosegue senza scorta */ }

      if (verdetto.annuncia) {
        setLostSync({
          n: verdetto.fresche.length, at: Date.now(), quando: verdetto.piuRecente,
          che: descriviPerdite(verdetto.fresche, local),
        });
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
    setCompiti(res.state.compiti || []);
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
    if (!perse.length) return L.t('perdite.nessuna');
    return L.t('perdite.avviso', perse.length, descriviPerdite(perse, syncStateRef.current));
  };

  // Il registro come file di testo: comodo da mandare quando si deve capire
  // cosa è successo, senza doverlo leggere sullo schermo del telefono.
  const esportaRegistro = () => {
    const st = syncStateRef.current;
    const righe = logLeggi().map((r) => [
      L.data(new Date(r.at), 'dataOra'),
      L.t(r.o === 'io' ? 'registro.questoTelefono' : 'registro.sincronizzazione'),
      L.t(r.k === 'd' ? 'registro.cancellata' : 'registro.modificata'),
      sezioneDiPath(r.p),
      descriviPath(r.p, st),
      r.p,
    ].join('\t'));
    const testo = L.t('registro.testata', BRAND.appTitle, L.data(new Date(), 'dataOra'))
      + L.t('registro.colonne') + righe.join('\n') + '\n';
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
    if (!r || !r.state) { window.alert(L.t('diag.senzaScorta')); return; }
    if (!window.confirm(L.t('diag.confermaAnnulla', L.data(new Date(r.at), 'dataOra'), r.perse))) return;
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
    window.alert(L.t('diag.annullato'));
  };

  const connectCloud = async (code) => {
    const CS = window.CloudSync;
    if (!CS || !CS.isConfigured()) {
      window.alert(L.t('cloud.senzaFirebase'));
      return;
    }
    const c = (code || '').trim();
    if (!c) { window.alert(L.t('cloud.senzaCodice')); return; }
    localStorage.removeItem('cambusa_sync_optout'); // riattiva l'auto-connessione
    try {
      await CS.connect(window.FIREBASE_CONFIG, c, applyRemote, { password: sessionPassword });
    } catch (e) {
      window.alert(L.t('cloud.connessioneFallita', e && e.message ? e.message : e));
    }
  };

  const disconnectCloud = () => {
    // Scelta esplicita: niente riconnessione automatica finché non si riattiva.
    scriviLocale('cambusa_sync_optout', '1');
    if (window.CloudSync) window.CloudSync.disconnect();
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
    // Se si e' dentro una stanza, il codice della stanza E' il codice del
    // campo: i dati stanno in rooms/<codice>/dati/stato, e quel <codice> e'
    // lo stesso che le regole Firestore guardano per decidere se sei un
    // membro. Tenerne due diversi vorrebbe dire scrivere in una stanza di
    // cui non si fa parte — permesso negato su tutto, e nessuna spiegazione.
    const code = (stanzaStato.stanza && stanzaStato.stanza.codice)
      || CS.savedCode() || window.CAMP_CODE_DEFAULT || '';
    if (code && CS.isConfigured() && !optedOut && !CS.isConnected()) {
      setCampCodeInput(code);
      CS.connect(window.FIREBASE_CONFIG, code, applyRemote, { password: sessionPassword }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, stanzaStato.stanza && stanzaStato.stanza.codice]);

  // Entrando in una stanza diversa si STACCA la connessione di prima. Senza,
  // si resterebbe agganciati al campo precedente e si continuerebbe a
  // scriverci dentro — il posto dove finiscono i dati cambierebbe solo al
  // prossimo riavvio dell'app, che e' il tipo di ritardo che nessuno collega
  // alla causa.
  const stanzaPrima = useRef(null);
  useEffect(() => {
    const adesso = (stanzaStato.stanza && stanzaStato.stanza.codice) || null;
    if (stanzaPrima.current !== null && stanzaPrima.current !== adesso) {
      const CS = window.CloudSync;
      if (CS && CS.isConnected()) CS.disconnect();
    }
    stanzaPrima.current = adesso;
  }, [stanzaStato.stanza && stanzaStato.stanza.codice]);

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
    lockNow(L.t('blocco.serveDiNuovo'));
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
  // Le regole pure delle presenze stanno in presenze.js: qui restano i
  // gestori, che sono l'unica parte che tocca lo stato.
  const getDayData = (dateStr) => Presenze.giorno(campData, dateStr);

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
  const giornoBloccato = (dateStr) => Presenze.blocco(campData, dateStr);

  const applicaBlocchi = (cd) => Presenze.applicaBlocchi(cd);

  // Applica una nuova mappa di pasti tenendo allineata la copia bloccata:
  // le riparazioni d'identità (doppioni, presenze orfane) devono valere anche
  // sui giorni chiusi, altrimenti quelle presenze sparirebbero dai conti.
  const conBlocco = (day, meals) => Presenze.conBlocco(day, meals);

  // ---------- Il blocco protegge il giorno, non solo la sua riga ----------
  // Le quote non escono dai pasti: escono da pasti PER membri. Congelare i
  // pasti e lasciare libero l'elenco dei membri vuol dire promettere che quel
  // giorno non cambia e poi lasciarlo cambiare lo stesso — basta eliminare una
  // persona, o dichiararla bambina, e le quote di quel giorno si riscrivono
  // tutte. Il blocco, per valere qualcosa, deve fermare anche questo.
  const giorniBloccatiDi = (id) => Presenze.giorniBloccatiDi(campData, id);

  // Guardia per i tasti che toccano un membro: dice di no e spiega quali
  // giorni lo trattengono.
  const membroIntoccabile = (id, azione) => {
    const g = giorniBloccatiDi(id);
    if (!g.length) return false;
    const m = members.find((x) => x.id === id);
    window.alert(L.t('blocchi.membroIntoccabile',
      m ? m.name : L.t('blocchi.questaPersona'), azione, g.length, g.map(nomeGiorno).join(', ')));
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
    return L.t('blocchi.avvisoSblocco', g.length, g.map(nomeGiorno).join(', '));
  };

  // Guardia per i due interruttori del giorno.
  const giornoIntoccabile = (dateStr, azione) => {
    if (!giornoBloccato(dateStr)) return false;
    window.alert(L.t('blocchi.giornoIntoccabile', nomeGiorno(dateStr), azione));
    return true;
  };

  const giornoGratis = (dateStr) => (freeDays || []).includes(dateStr);

  const chiediGiornoGratis = (dateStr) => {
    if (giornoIntoccabile(dateStr, L.t('gratis.azione'))) return;
    const gia = giornoGratis(dateStr);
    const meals = (campData[dateStr] || {}).meals || {};
    const quanti = Object.values(meals).filter((v) => v && (v.lunch || v.dinner)).length;
    if (gia) {
      if (!window.confirm(L.t('gratis.confermaRimetti', nomeGiorno(dateStr)))) return;
    } else if (!window.confirm(L.t('gratis.confermaRendi', nomeGiorno(dateStr), quanti))) return;
    setFreeDays((prev) => (gia ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()));
  };

  const bloccaGiorno = (dateStr) => {
    const meals = (campData[dateStr] || {}).meals || {};
    const n = Object.values(meals).filter((v) => v && (v.lunch || v.dinner)).length;
    if (!window.confirm(L.t('blocchi.confermaBlocca', nomeGiorno(dateStr), n))) return;
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
    if (!window.confirm(L.t('blocchi.confermaSblocca', nomeGiorno(dateStr)))) return;
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
    if (!window.confirm(L.t('chiusura.confermaChiudi', purchases.length, money(totals.overallTotal), giorniAperti.length))) return;
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
    if (!window.confirm(L.t('chiusura.confermaRiapri'))) return;
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
        if (!vecchia) fuori.push({ che, azione: 'azione.aggiunta', nome: x.name || x.text || '—', quanto: posNum(x.price) });
        else if (JSON.stringify(vecchia) !== JSON.stringify(x)) fuori.push({ che, azione: 'azione.modificata', nome: x.name || x.text || '—', quanto: posNum(x.price) });
      });
      const ora = new Set((attuali || []).map((x) => String(x && x.id)));
      congelate.forEach((x) => {
        if (!ora.has(String(x.id))) fuori.push({ che, azione: 'azione.cancellata', nome: x.name || x.text || '—', quanto: posNum(x.price) });
      });
    };
    // "che" e "azione" sono CHIAVI del dizionario: l'avviso si disegna dopo,
    // e deve poter parlare nella lingua scelta in quel momento.
    confronta(stato.purchases, b.purchases, 'percorso.spesa');
    confronta(stato.equipment, b.equipment || [], 'percorso.attrezzatura');
    if (fuori.length === 0) return { stato, respinte: [] };
    return {
      stato: { ...stato, purchases: b.purchases.map((x) => ({ ...x })), equipment: (b.equipment || []).map((x) => ({ ...x })) },
      respinte: fuori,
    };
  };

  // Guardia per i tasti: dice di no e spiega perché.
  const contiChiusi = (azione) => {
    if (!bloccoConti()) return false;
    window.alert(L.t('chiusura.azioneImpossibile', azione));
    return true;
  };

  const getMeal = (dateStr, memberId) => Presenze.pasto(campData, dateStr, memberId);

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
  const presenzeOrfane = () => Presenze.orfane(campData, members, exMembri());

  const riassegnaOrfane = (orfano, nuovoId) => {
    const dest = members.find((m) => m.id === nuovoId);
    if (!dest) { window.alert(L.t('orfane.scegliChi')); return; }
    const chi = orfano.nome ? L.t('orfane.di', orfano.nome) : L.t('orfane.senzaPadrone');
    if (!window.confirm(L.t('orfane.confermaAssegna', dest.name, orfano.pasti, chi, orfano.giorni.length))) return;
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
    if (!window.confirm(L.t('membri.confermaUnisci', tengo.name, gruppo.length, pasti))) return;

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
    return window.confirm(L.t('spesa.prezzoAlto', money(s.p),
      s.perche === 'relativo' ? money(s.mediana) : null));
  };

  const scartaOrfane = (orfano) => {
    const chi = orfano.nome ? L.t('orfane.di', orfano.nome) : L.t('orfane.senzaPadrone');
    // I giorni bloccati non si svuotano nemmeno da qui. Riattaccare una
    // presenza alla persona giusta è una riparazione e passa (non cambia CHI
    // ha mangiato); buttarla via è una perdita, e su un giorno chiuso cambia
    // le quote di tutti. Si dice quante ne restano e perché.
    const protetti = giorniBloccatiDi(orfano.id);
    if (!window.confirm(L.t('orfane.confermaButta', orfano.pasti, chi,
      protetti.length ? protetti.map(nomeGiorno).join(', ') : null))) return;
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
  const nomeGiorno = (ds) => L.data(parseDate(ds), 'completa');

  // "Tutti a pranzo/cena" cambia le presenze di TUTTI in un colpo solo, e la
  // modifica arriva su ogni telefono: prima di farlo si chiede.
  const chiediSetAll = (mealType) => {
    if (members.length === 0) return;
    const pasto = L.t(mealType === 'lunch' ? 'presenze.pranzo' : 'presenze.cena').toUpperCase();
    const gia = members.every((m) => getMeal(selectedDateStr, m.id)[mealType]);
    const testo = gia
      ? L.t('presenze.confermaTogli', pasto, members.length, nomeGiorno(selectedDateStr))
      : L.t('presenze.confermaSegna', members.length, pasto, nomeGiorno(selectedDateStr));
    if (!window.confirm(L.t('presenze.cambiaPerTutti', testo))) return;
    setAllMeals(selectedDateStr, mealType);
  };

  // Copia le presenze (pranzo e cena) dal giorno precedente.
  const chiediCopiaDaIeri = () => {
    if (giornoBloccato(selectedDateStr)) {
      window.alert(L.t('presenze.bloccateSblocca', nomeGiorno(selectedDateStr)));
      return;
    }
    const d = parseDate(selectedDateStr);
    d.setDate(d.getDate() - 1);
    const prevStr = toDateStr(d);
    const prevMeals = (campData[prevStr] && campData[prevStr].meals) || {};
    if (!Object.keys(prevMeals).length) {
      window.alert(L.t('presenze.nessunaIeri'));
      return;
    }
    const conta = (meals) => {
      const v = Object.values(meals || {});
      return { p: v.filter((x) => x && x.lunch).length, c: v.filter((x) => x && x.dinner).length };
    };
    const ieri = conta(prevMeals);
    const oggi = conta((campData[selectedDateStr] && campData[selectedDateStr].meals) || {});
    if (!window.confirm(L.t('presenze.confermaCopia', nomeGiorno(prevStr), nomeGiorno(selectedDateStr),
      ieri.p, ieri.c, oggi.p, oggi.c))) return;
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
    if (gia && !window.confirm(L.t('membri.confermaOmonimo', name))) return;
    setMembers((prev) => [...prev, { id: uid(), name, isChild: newMemberChild }]);
    setNewMemberName('');
    setNewMemberChild(false);
  };

  const removeMember = (id) => {
    if (membroIntoccabile(id, L.t('azione.eliminarla'))) return;
    const m = members.find((x) => x.id === id);
    if (m && !window.confirm(L.t('membri.confermaElimina', m.name))) return;
    // Si tiene il nome da parte: se poi qualcuno lo riaggiunge, l'app prende un
    // id nuovo e le vecchie presenze restano appese a un id che non esiste più.
    // Senza questo elenco non si saprebbe nemmeno DI CHI erano.
    ricordaExMembro(id, m && m.name);
    setMembers((prev) => prev.filter((x) => x.id !== id));
  };

  const toggleChild = (id) => {
    // Adulto o bambino cambia quanto paga tutto il campo: su un giorno
    // bloccato vale esattamente come modificare le presenze.
    if (membroIntoccabile(id, L.t('azione.adultoBambino'))) return;
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

  // ---------- Compiti assegnati ----------
  // Chi fa cosa, deciso PRIMA che la spesa esista. Al campo 2026 queste righe
  // stavano negli appunti del giorno ("Arrosticini Eleonora", "Pecora/Ugo"):
  // erano compiti concordati, e le spese che ne sono nate stanno gia' in
  // purchases — ma le due cose non si toccavano, e nessuno sapeva quale
  // compito fosse ancora scoperto.
  //
  // I compiti NON entrano nei conti. Nei conti entra la spesa che ne nasce,
  // e solo se qualcuno la registra: un compito fatto senza spesa e' una cosa
  // che si e' fatta, non un euro che qualcuno deve.
  const addCompito = () => {
    const testo = nuovoCompito.trim();
    if (!testo) return;
    setCompiti((prev) => [...prev, { id: uid(), testo, chi: nuovoCompitoChi.trim(), fatto: false }]);
    setNuovoCompito('');
    // "chi" NON si azzera: assegnando piu' cose alla stessa persona si
    // scrivono di fila senza risceglierla ogni volta.
  };

  const removeCompito = (id) => {
    const c = compiti.find((x) => x.id === id);
    if (c && !window.confirm(L.t('compiti.confermaTogli', c.testo))) return;
    setCompiti((prev) => prev.filter((x) => x.id !== id));
  };

  // Due soli stati, da fare e fatto. Un terzo ("in corso") e' la casella che
  // in ogni gestionale nessuno aggiorna mai.
  const toggleCompito = (id) => {
    setCompiti((prev) => prev.map((x) => (x.id === id ? { ...x, fatto: !x.fatto } : x)));
  };

  const setCompitoCampo = (id, campo, valore) => {
    setCompiti((prev) => prev.map((x) => (x.id === id ? { ...x, [campo]: valore } : x)));
  };

  // Dal compito alla spesa: facoltativo e a posteriori. Si apre la maschera
  // della Lista gia' compilata con il testo e con chi l'ha eseguito — il
  // prezzo no, quello si scopre alla cassa. Se non si fa, il compito resta
  // fatto lo stesso: registrare la spesa e' un'altra cosa.
  const daCompitoASpesa = (c) => {
    if (contiChiusi(L.t('azione.registrareSpesa'))) return;
    setPName(c.testo);
    setPBuyer(c.chi || '');
    setPPrice('');
    setPType('alimentare');
    setPAccount('comune');
    setManualOpen(true);
    setListaSection('acquistato');
    goTo('lista');
  };

  // ---------- Dal menù alla lista della spesa ----------
  // Il menù è già la spesa: al campo 2026 le quantità stavano lì e la scheda
  // "Da acquistare" aveva cinque voci. Qui si propongono le righe del menù del
  // giorno; nessuna entra senza conferma, e quelle già in lista non ricompaiono.
  const [propostaSpesa, setPropostaSpesa] = useState(null); // { voci:[], scelte:{} }

  const proponiDalMenu = () => {
    const MS = window.MenuSpesa;
    if (!MS) { window.alert(L.t('menu.senzaLettore')); return; }
    const testo = getDayData(selectedDateStr).note || '';
    const tutte = MS.vociDalMenu(testo);
    if (tutte.length === 0) {
      window.alert(L.t('menu.vuoto'));
      return;
    }
    const voci = MS.nuove(tutte, toBuy);
    if (voci.length === 0) {
      window.alert(L.t('menu.giaInLista', tutte.length));
      return;
    }
    // Tutte spuntate: la maggioranza delle righe è roba da comprare, e togliere
    // una spunta costa meno che metterne sei.
    const scelte = {};
    voci.forEach((_, i) => { scelte[i] = true; });
    setPropostaSpesa({ voci, scelte, scartate: tutte.length - voci.length });
  };

  const confermaPropostaSpesa = () => {
    const p = propostaSpesa;
    if (!p) return;
    const prese = p.voci.filter((_, i) => p.scelte[i]);
    if (prese.length === 0) { setPropostaSpesa(null); return; }
    setToBuy((prev) => [...prev, ...prese.map((v) => ({ id: uid(), name: v.nome, qty: v.qta }))]);
    setPropostaSpesa(null);
  };

  const removeToBuy = (id) => {
    const it = toBuy.find((x) => x.id === id);
    if (it && !window.confirm(L.t('lista.confermaTogliVoce', it.name))) return;
    setToBuy((prev) => prev.filter((x) => x.id !== id));
    setReceipts((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev }; delete copy[id]; return copy;
    });
    if (window.CloudSync) window.CloudSync.deleteReceipt(id);
  };

  // Conferma acquisto: la voce esce dalla lista ed entra nella cronologia
  // mantenendo lo stesso id (così la foto scontrino resta collegata).
  const confirmBuy = () => {
    if (contiChiusi(L.t('azione.registrareAcquisto'))) return;
    if (!buying) return;
    const price = posNum(buying.price);
    if (price <= 0) { window.alert(L.t('spesa.prezzoZero')); return; }
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
    if (contiChiusi(L.t('azione.aggiungereSpesa'))) return;
    const name = pName.trim();
    const price = posNum(pPrice);
    if (!name || price <= 0) {
      window.alert(L.t('spesa.nomeEPrezzo'));
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
    if (giornoIntoccabile(dateStr, L.t('azione.contoSeparato'))) return;
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
    if (contiChiusi(L.t('azione.modificareVoce'))) return;
    const name = (editing.name || '').trim();
    const price = posNum(editing.price);
    if (!name) { window.alert(L.t('spesa.nomeVuoto')); return; }
    if (editing.kind === 'purchase') {
      if (price <= 0) { window.alert(L.t('spesa.prezzoZero')); return; }
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
    if (contiChiusi(L.t('azione.cancellareSpesa'))) return;
    const p = purchases.find((x) => x.id === id);
    if (p && !window.confirm(L.t('spesa.confermaElimina', p.name, money(posNum(p.price)), !!receipts[id]))) return;
    setPurchases((prev) => prev.filter((x) => x.id !== id));
    setReceipts((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (window.CloudSync) window.CloudSync.deleteReceipt(id);
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
      window.alert(L.t('ripristino.nessunSalvataggio'));
      return;
    }
    setSnapList(tutte);
  };

  const restoreSnapshot = async (voce) => {
    const id = typeof voce === 'string' ? voce : voce.id;
    const dove = typeof voce === 'string' ? 'cloud' : voce.dove;
    const quando = id.slice(11) === '00' ? L.t('ripristino.mattina') : id.slice(11) === '12' ? L.t('ripristino.pomeriggio') : '';

    // Prima si legge la copia, poi si dice cosa costa: chiedere "sei sicuro?"
    // senza sapere quante voci spariranno è chiedere di firmare in bianco.
    let json = null;
    if (dove === 'locale') {
      json = snapLocaleDati(snapLocaliLeggi()[id]);
    } else {
      const CS = window.CloudSync;
      if (CS && CS.isConnected && CS.isConnected()) json = await CS.getSnapshot(id);
    }
    if (!json) { window.alert(L.t('ripristino.illeggibile')); return; }

    let d;
    try { d = JSON.parse(json); } catch (e) { window.alert(L.t('ripristino.nonValido')); return; }
    if (!d || typeof d !== 'object') { window.alert(L.t('ripristino.nonValido')); return; }

    const perse = perditeSeApplico(d);
    if (!window.confirm(L.t('ripristino.conferma', id.slice(0, 10), quando, avvisoPerdite(perse), avvisoBlocchi(d)))) return;
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
      window.alert(L.t('ripristino.fatto'));
    } catch (e) {
      window.alert(L.t('ripristino.nonValido'));
    }
  };

  // ---------- Condividi resoconto spese ----------
  const buildReport = () => {
    const t = totals;
    const lines = [];
    lines.push(L.t('report.titolo', BRAND.appTitle));
    lines.push('');
    lines.push(L.t('report.totale', money(t.overallTotal)));
    if (t.foodDrinksSep > 0 || t.sepDaysCount > 0) {
      lines.push(L.t('report.diCuiSeparato', money(t.foodDrinksSep), t.sepDaysCount, money(t.costPerMealSep)));
    }
    // Due casse, due elenchi. Un elenco solo farebbe sembrare che chi ha
    // anticipato sul conto separato debba essere rimborsato da tutti.
    const sepAttiva = t.sepDaysCount > 0 || t.foodDrinksSep > 0.005;
    const blocco = (c, titolo) => {
      if (c.transfers.length === 0 && c.settlement.length === 0) return;
      if (c.transfers.length > 0) {
        lines.push('');
        lines.push(L.t('report.chiPagaChi', titolo));
        c.transfers.forEach((x) => lines.push(L.t('report.riga', x.from, x.to, money(x.amount))));
      }
      if (c.settlement.length > 0) {
        lines.push('');
        lines.push(L.t('report.dettaglio', titolo));
        c.settlement.forEach((s) => {
          const stato = s.net > 0.005 ? L.t('report.riceve', money(s.net))
            : s.net < -0.005 ? L.t('report.deveDare', money(-s.net))
            : L.t('report.inPari');
          lines.push(L.t('report.rigaPersona', s.name, stato, money(s.paid), money(s.owed)));
        });
      }
    };
    // Il resoconto segue quello che si sta guardando: mandare nel gruppo un
    // elenco diverso da quello a schermo e' il modo piu' rapido di far pagare
    // due volte qualcuno.
    if (sepAttiva && saldiOttimizzati) {
      blocco({ transfers: t.transfersOttimizzati, settlement: t.settlement }, '');
    } else {
      blocco(t.casse.comune, sepAttiva ? L.t('report.cassaComune') : '');
      if (sepAttiva) blocco(t.casse.separata, L.t('report.cassaSeparata'));
    }
    if (t.freeDaysCount > 0) {
      lines.push(L.t('report.giorniGratis', t.freeDaysCount, t.mealsFree));
    }
    if (t.unattributed > 0.005) {
      lines.push('');
      lines.push(L.t('report.senzaAcquirente', money(t.unattributed)));
    }
    // Un resoconto che non quadra non va mandato nel gruppo senza dirlo: chi
    // lo legge farebbe i bonifici sbagliati.
    if (t.nonRipartito > 0.005) {
      lines.push('');
      lines.push(L.t('report.nonCompleti', money(t.nonRipartito)));
      t.buchi.forEach((b) => lines.push(L.t('report.buco', money(b.quanto), L.t(b.perche))));
      lines.push(L.t('report.scoperto'));
    }
    return lines.join('\n');
  };

  const shareReport = async () => {
    if (totals.overallTotal <= 0) {
      window.alert(L.t('report.nienteDaCondividere'));
      return;
    }
    const text = buildReport();
    if (navigator.share) {
      try { await navigator.share({ title: 'Prato Lungo 2026 — Conti', text }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; /* altrimenti prova WhatsApp */ }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  // ---------- Mini gioco "Aiuta Bandy" ----------
  // Stato, classifica e partite stanno in src/75-usa-gioco.jsx.
  const {
    gamePlayer, setGamePlayer, gameRunning, setGameRunning, gameBest,
    leaderboard, refreshLeaderboard, startGame, endGame,
  } = usaGioco({ activeTab, cloudConnesso: cloud.connected });

  // ---------- Galleria del campo ----------
  // Stato, ascolto delle miniature, caricamento, album e PDF ricordo stanno
  // in src/76-usa-galleria.jsx. Qui resta solo cosa le si passa: la scheda
  // aperta e la linea (per sapere quando ascoltare) e i giorni del campo
  // (per il sottotitolo dell'album).
  const {
    photos, photosReady, photoWho, setPhotoWho, photoBusy,
    viewPhoto, setViewPhoto, album, setAlbum,
    galleryView, setGalleryView, albumPage, albumRef,
    picking, setPicking, picked, setPicked, pdfBusy,
    photoCap, setPhotoCap,
    photosBy, addPhotos, openPhoto, removePhoto, openAlbum,
    PER_PAGINA_ALBUM, paginaAlbum, sfoglia, onScrollAlbum,
    togglePicked, uscitaScelta, generaRicordo, soloNome,
  } = usaGalleria({ activeTab, cloudConnesso: cloud.connected, campData });

  // ---------- Rimborsi saldati (barrati) ----------
  const toggleSettled = (key) => {
    setSettled((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // ---------- Aggiunta attrezzatura ----------
  const addEquip = () => {
    const text = newEquipText.trim();
    if (!text) return;
    if (contiChiusi(L.t('azione.aggiungereAttrezzatura'))) return;
    if (!confermaPrezzo(newEquipPrice)) return;
    setEquipment((prev) => [...prev, { id: uid(), text, price: posNum(newEquipPrice), bought: false, buyer: newEquipBuyer.trim() }]);
    setNewEquipText('');
    setNewEquipPrice('');
    setNewEquipBuyer('');
  };

  const toggleEquipBought = (id) => {
    if (contiChiusi(L.t('azione.attrezzaturaAcquistata'))) return;
    setEquipment((prev) => prev.map((e) => (e.id === id ? { ...e, bought: !e.bought } : e)));
  };

  const removeEquip = (id) => {
    const e = equipment.find((x) => x.id === id);
    if (e && !window.confirm(L.t('attrezzatura.confermaElimina', e.text))) return;
    if (contiChiusi(L.t('azione.cancellareAttrezzatura'))) return;
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
    if (g && !window.confirm(L.t('dotazioni.confermaElimina', g.text))) return;
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
        <button onClick={() => changeWeek(-7)} aria-label={L.t('settimana.precedente')} className={bottoneIcona('tenue')}>&larr;</button>
        <span className="font-bold text-normale text-[#2D392C] uppercase font-rustic">{L.t('settimana.selezionata')}</span>
        <button onClick={() => changeWeek(7)} aria-label={L.t('settimana.successiva')} className={bottoneIcona('tenue')}>&rarr;</button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d) => {
          const dateStr = toDateStr(d);
          const isSelected = dateStr === selectedDateStr;
          const isCampPeriod = dateStr >= CAMP_START && dateStr <= CAMP_END;
          const label = L.data(d, 'settimanaSola');
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
              <span className="text-piccolo uppercase font-bold">{label}</span>
              <span className="text-grande font-bold font-rustic">{d.getDate()}</span>
              {isCampPeriod && <span className="w-1.5 h-1.5 bg-[#D97706] rounded-full mt-0.5"></span>}
            </button>
          );
        })}
      </div>
    </>
  );

  // ---------- Calcolo ripartizione (coerente: somma quote = totale) ----------
  // ---------- I conti ----------
  // Stanno in conti.js, fuori da src/: sono una funzione pura di sei cose e
  // vanno provati sui numeri veri di un campo vero, con una prova unitaria,
  // invece che leggendo cifre a schermo. Qui resta solo cosa gli si passa.
  const totals = Conti.calcola({
    members, campData, purchases, equipment, sepDays, freeDays,
    equipExemption: FEATURES.equipExemption,
  });
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
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">{c.titolo}</h3>
      {c.sottotitolo && <p className="text-piccolo text-gray-500 leading-snug mb-2">{c.sottotitolo}</p>}
      {c.avviso && (
        <div className="mb-3 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
          <p className="text-piccolo text-[#5C4A3C] leading-snug">{c.avviso}</p>
        </div>
      )}
      {c.elenco.length === 0 ? (
        <p className="text-normale text-gray-400 italic">{c.vuoto || L.t('quote.vuoto')}</p>
      ) : (
        <div>
          <ul className="divide-y divide-[#8F9E8B]/20">
            {c.elenco.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <div className="flex flex-col">
                  <span className="text-normale font-bold text-[#2D392C]">{b.name}</span>
                  <span className="text-piccolo text-gray-500">
                    {L.t('quote.pastiRiga', c.pastiDi(b), b.mealsGratis, b.isChild)}
                  </span>
                </div>
                <span className={`font-rustic font-bold ${b.isChild ? 'text-gray-400' : 'text-[#2D392C]'}`}>
                  {b.isChild ? L.t('quote.gratis') : `${money(c.quotaDi(b))} €`}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between items-center pt-2 mt-1 border-t border-[#8F9E8B]/30">
            <span className="text-piccolo uppercase font-bold text-gray-500">{L.t('quote.totaleRaccolto')}</span>
            <span className="font-rustic font-bold text-[#2D392C]">{money(c.raccolto)} €</span>
          </div>
          <p className="text-minuto text-gray-400 italic mt-2">
            {L.t('quote.arrotondamento', Math.abs(c.scarto) >= 0.005
              ? `${c.scarto > 0 ? '+' : ''}${money(c.scarto)}`
              : null)}
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
          <p className="text-piccolo text-[#5C4A3C] leading-snug">
            {frase('quote.nonRipartito', money(c.nonRipartito), money(c.totale), money(c.raccolto))}
          </p>
          <ul className="mt-1.5 space-y-1">
            {c.buchi.map((b) => (
              <li key={b.perche} className="text-piccolo text-[#5C4A3C] leading-snug">
                {frase('quote.buco', money(b.quanto), L.t(b.perche))}
              </li>
            ))}
          </ul>
          <p className="text-minuto text-gray-500 italic mt-1.5 leading-snug">
            {L.t('quote.siSistema')}
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
        <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 mb-3">{c.titolo}</h3>
        {c.sottotitolo && <p className="text-minuto text-[#8F9E8B] leading-snug mb-3">{c.sottotitolo}</p>}
        {s.byBuyer.length > 0 && (
          <div className="mb-3 pb-3 border-b border-[#8F9E8B]/30">
            <h4 className="font-rustic text-normale text-[#8F9E8B] mb-1">{L.t('saldi.anticipiPerAcquirente')}</h4>
            <ul className="divide-y divide-[#8F9E8B]/20">
              {s.byBuyer.map((b) => (
                <li key={b.name} className="flex items-center justify-between py-1.5">
                  <span className={`text-piccolo font-bold ${b.name === '—' ? 'text-gray-400 italic' : ''}`}>
                    {b.name === '—' ? L.t('saldi.nonIndicato') : b.name}
                  </span>
                  <span className="font-rustic font-bold text-normale">{money(b.total)} €</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.settlement.length === 0 ? (
          <p className="text-normale text-gray-400 italic">{c.vuoto || L.t('saldi.vuoto')}</p>
        ) : (
          <ul className="divide-y divide-[#8F9E8B]/20">
            {s.settlement.map((x) => {
              const credito = x.net > 0.005;
              const debito = x.net < -0.005;
              return (
                <li key={x.name} className="flex items-center justify-between py-2 gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-normale font-bold truncate">{x.name}</span>
                    <span className="text-minuto text-[#8F9E8B]">{L.t('saldi.haAnticipatoDeve', money(x.paid), money(x.owed))}</span>
                  </div>
                  <span className={`font-rustic font-bold text-normale shrink-0 text-right ${credito ? 'text-[#8FBF8F]' : debito ? 'text-[#D97706]' : 'text-gray-400'}`}>
                    {credito ? L.t('saldi.riceve', money(x.net)) : debito ? L.t('saldi.da', money(-x.net)) : L.t('saldi.inPari')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {s.transfers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#8F9E8B]/30">
            <h4 className="font-rustic text-normale text-[#8F9E8B] mb-1">{L.t('saldi.chiPagaChi')}</h4>
            <p className="text-minuto text-gray-400 mb-2">{L.t('saldi.toccaRiga')}</p>
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
                      <span className={`text-piccolo ${paid ? 'line-through text-gray-400' : ''}`}>
                        <span className="font-bold">{t.from}</span>
                        <span className="text-[#8F9E8B]"> → </span>
                        <span className="font-bold">{t.to}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={`font-rustic font-bold ${paid ? 'line-through text-gray-400' : 'text-[#D97706]'}`}>{money(t.amount)} €</span>
                        {paid && <span className="text-[#8FBF8F] text-normale font-bold">✓</span>}
                      </span>
                    </div>
                    {mostraDati && (
                      <div className="mt-1.5 pt-1.5 border-t border-[#8F9E8B]/20 space-y-1">
                        {[['PayPal', dest.paypal], ['IBAN', dest.iban]].filter((r) => r[1]).map((r) => (
                          <div key={r[0]} className="flex items-start gap-2">
                            <span className="text-minuto uppercase font-bold text-[#8F9E8B] w-11 shrink-0 pt-0.5">{r[0]}</span>
                            <span className={`text-piccolo text-[#F0F4F1] break-all leading-snug ${r[0] === 'IBAN' ? 'font-mono' : ''}`}>{r[1]}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); copiaDato(`${r[0]} di ${t.to}`, r[1]); }}
                              className="ml-auto shrink-0 text-minuto uppercase font-bold px-2 py-1 rounded bg-[#2D392C] border border-[#8F9E8B]/30 text-[#8F9E8B] hover:text-white"
                            >
                              {L.t(copied === `${r[0]} di ${t.to}` ? 'saldi.copiato' : 'saldi.copia')}
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
                <p className="text-minuto text-gray-400 italic mt-2">
                  {frase('saldi.senzaDati', senza.join(', '), senza.length === 1)}
                </p>
              );
            })()}
          </div>
        )}
        {s.unattributed > 0.005 && (
          <p className="text-minuto text-[#D97706] italic mt-2">
            {L.t('saldi.senzaAcquirente', money(s.unattributed))}
          </p>
        )}
        {/* Se dei soldi non sono in nessuna quota, i rimborsi NON possono
            quadrare: chi ha anticipato resta scoperto. Va detto qui, dove si
            guarda chi paga chi, non solo nella scheda delle quote. */}
        {c.nonRipartito > 0.005 && (
          <div className="mt-2 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
            <p className="text-piccolo text-[#5C4A3C] leading-snug">
              {frase('saldi.nonQuadrano', money(c.nonRipartito))}
            </p>
          </div>
        )}
        {s.unknownBuyers.length > 0 && (
          <div className="mt-2 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
            <p className="text-piccolo text-[#5C4A3C] leading-snug">
              {frase('saldi.daControllareTesta')}{' '}
              {s.unknownBuyers.map((u, i) => (
                <span key={u.name}>
                  {i > 0 ? ', ' : ''}<span className="font-bold">{u.name}</span> ({money(u.paid)} €)
                </span>
              ))}
              {frase('saldi.daControllareCoda', s.unknownBuyers.length === 1)}
            </p>
          </div>
        )}
        {/* Le quote arrotondate a 0,10 € fanno raccogliere qualche centesimo
            in più (o in meno) dello speso: quei centesimi non hanno un
            destinatario, quindi l'ultimo passaggio non combacia col saldo.
            Senza spiegarlo sembra un errore di conto. */}
        {Math.abs(c.scarto) >= 0.005 && s.transfers.length > 0 && (
          <p className="text-minuto text-gray-400 italic mt-2">
            {L.t('saldi.arrotondamento', money(Math.abs(c.scarto)))}
          </p>
        )}
        <p className="text-minuto text-gray-400 italic mt-1">{L.t('saldi.legenda')}</p>
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
      members, campData, purchases, gear, settled, equipment, toBuy, sepDays, freeDays, blocchi, compiti, receipts,
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
          window.alert(L.t('import.nonValido'));
          return;
        }
        // Importare un backup non aggiunge: SOSTITUISCE, e le voci che spariscono
        // vengono cancellate su tutti i telefoni. Prima la conferma diceva solo
        // "i dati attuali verranno sostituiti": chi apriva per sbaglio un file di
        // tre giorni prima azzerava il campo per tutti senza sapere né la data del
        // file né quanto stava buttando via.
        const quando = d.exportedAt ? new Date(d.exportedAt) : null;
        const eta = quando && !isNaN(quando.getTime())
          ? L.t('import.backupDel', L.data(quando, 'dataOra'))
          : L.t('import.senzaData');
        const dentro = L.t('import.contiene', (d.members || []).length, (d.purchases || []).length,
          Object.keys(d.campData || {}).length);
        const perse = perditeSeApplico(d);
        if (!window.confirm(L.t('import.conferma', eta, dentro, avvisoPerdite(perse), avvisoBlocchi(d)))) return;
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
        if (Array.isArray(d.compiti)) setCompiti(d.compiti);
        if (d.receipts && typeof d.receipts === 'object') setReceipts(d.receipts);
      } catch (err) {
        window.alert(L.t('import.nonLeggibile'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---------- Chiusura del campo e archivio ----------
  // "Chiudi il campo" salva tutto (file + cloud), lo mette in Archivio e poi
  // azzera i dati di lavoro: l'app resta pronta per l'evento successivo.
  const campRange = () => intervalloCampo(campData);

  const openClose = () => {
    if (!campoInCorso) {
      window.alert(L.t('campo.nienteDaChiudere'));
      return;
    }
    setCloseName(BRAND.appTitle || L.t('campo.nomePredefinito'));
    setClosing(true);
  };

  const closeCamp = async () => {
    const name = (closeName || '').trim() || L.t('campo.nomePredefinito');
    const range = campRange();
    const t = totals;
    const daPagare = saldiOttimizzati ? t.transfersOttimizzati : t.transfers;
    const unpaid = daPagare.filter((x) => !settled.includes(chiaveRimborso(x)));
    const warn = unpaid.length > 0 ? L.t('campo.rimborsiAperti', unpaid.length) : '';
    if (!window.confirm(L.t('campo.confermaChiusura', name, money(t.overallTotal), members.length, warn))) return;

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
    setCompiti([]);
    setReceipts({});
    setBuying(null);
    setSelectedDateStr(defaultDateStr());
    setClosing(false);
    setActiveTab('archivio');
    window.alert(L.t('campo.chiuso', cloudOk));
  };

  const downloadArchive = async (a) => {
    let state = a.state;
    if (!state) {
      const CS = window.CloudSync;
      if (CS && CS.isConnected && CS.isConnected()) state = await CS.getArchive(a.id);
      if (!state) { window.alert(L.t('archivio.serveLinea')); return; }
    }
    downloadJson(`bandone-archivio-${a.id}.json`, { version: 6, archive: a, ...state });
  };

  const removeArchive = (a) => {
    if (!window.confirm(L.t('archivio.confermaElimina', a.name))) return;
    setArchives((prev) => prev.filter((x) => x.id !== a.id));
    const CS = window.CloudSync;
    if (CS && CS.deleteArchive) CS.deleteArchive(a.id);
  };

  const shareArchive = async (a) => {
    const text = a.report || '';
    if (!text) { window.alert(L.t('archivio.senzaResoconto')); return; }
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

  // Un campo c'e' quando c'e' qualcosa dentro. Serve in due posti che devono
  // dire la stessa cosa: "chiudi il campo" (non si chiude il vuoto) e i
  // controlli qui sotto (non si e' pronti per un campo che non c'e').
  const campoInCorso = members.length > 0 || purchases.length > 0
    || toBuy.length > 0 || equipment.length > 0;

  const readyChecks = [
    { ok: readiness.sw && readiness.cache, titolo: L.t('pronto.appScaricata'),
      no: L.t('pronto.appScaricataNo') },
    { ok: members.length > 0, titolo: L.t('pronto.datiRicevuti'),
      no: L.t('pronto.datiRicevutiNo') },
    // Si segnala SOLO un ripiego accertato: 'anon' è anche il valore di
    // partenza, prima ancora di provare a collegarsi, e farebbe lampeggiare
    // un allarme falso a ogni avvio.
    { ok: !(LOCK && LOCK.dbEmail && (cloud.authMode === 'anon-nopass' || cloud.authMode === 'anon-fallback')),
      titolo: L.t('pronto.accessoDb'),
      no: L.t('pronto.accessoDbNo') },
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
    if (!window.confirm(L.t('dati.confermaCancella'))) return;
    if (!window.confirm(L.t('dati.confermaCancella2'))) return;
    try {
      Object.keys(localStorage)
        .filter((k) => k.indexOf('cambusa_') === 0)
        .forEach((k) => localStorage.removeItem(k));
      sessionStorage.removeItem(UNLOCK_KEY);
    } catch (e) { /* ignora */ }
    // Le foto non stanno piu' in localStorage: svuotare solo quello lascerebbe
    // indietro i megabyte, cioe' proprio la cosa che questo tasto promette di
    // togliere. Si aspetta che il magazzino sia vuoto prima di ricaricare,
    // altrimenti la pagina se ne va a meta' cancellazione.
    const MF = window.MagazzinoFoto;
    (MF ? MF.svuota() : Promise.resolve()).then(() => window.location.reload());
    return;
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
        <h1 className="font-rustic text-titolo tracking-widest text-[#8F9E8B]">{BRAND.splashLine1}</h1>
        <h2 className="font-rustic text-titolo tracking-widest text-[#F0F4F1]">{BRAND.splashLine2}</h2>
        <p className="mt-4 text-piccolo uppercase tracking-widest opacity-60">{BRAND.splashTagline}</p>
        <p className="absolute bottom-4 left-0 right-0 text-center text-minuto tracking-wide text-[#8F9E8B]/70 px-6">
          {BRAND.credits}
        </p>
      </div>
    );
  }

  // I titoli delle aree passano dal dizionario. Si ricalcolano a ogni disegno
  // perche' "L" e' stata appena riassegnata: cambiare lingua li cambia subito.
  const tabs = {
    calendario: L.t('area.calendario'),
    menu: L.t('area.menu'),
    membri: L.t('area.membri'),
    presenze: L.t('area.presenze'),
    spesa: L.t('area.spesa'),
    compiti: L.t('area.compiti'),
    lista: L.t('area.lista'),
    attrezzatura: L.t('area.attrezzatura'),
    regole: L.t('area.regole'),
    dotazioni: L.t('area.dotazioni'),
    galleria: L.t('area.galleria'),
    archivio: L.t('area.archivio'),
    gioco: L.t('area.gioco'),
    guida: L.t('area.guida'),
    impostazioni: L.t('area.impostazioni'),
  };

  // Icona per ogni area: nel menu aiuta a trovare la voce senza leggerle tutte.
  const TAB_ICONS = {
    calendario: '📅', menu: '🍝', presenze: '🍽️',
    compiti: '✅', lista: '🧾', attrezzatura: '🪛', spesa: '💶',
    membri: '👥', regole: '📜', dotazioni: '🎒', galleria: '📸',
    gioco: '🎮', archivio: '🗄️', guida: '❓', impostazioni: '⚙️',
  };

  // Il menu raggruppa le aree per momento d'uso: prima quello che si tocca
  // ogni giorno, poi i soldi, poi le cose del gruppo, in fondo il resto.
  const MENU_GROUPS = [
    { title: L.t('menu.pianificazione'), items: ['calendario', 'menu', 'presenze'] },
    // "Chi fa cosa" viene PRIMA della lista, ed e' l'ordine dei fatti: ci si
    // divide i compiti, poi si compra, poi si registra la spesa.
    { title: L.t('menu.spese'), items: [...(FEATURES.compiti ? ['compiti'] : []), 'lista', 'attrezzatura', 'spesa'] },
    { title: L.t('menu.gruppo'), items: ['membri', 'regole', 'dotazioni', 'galleria'] },
    { title: L.t('menu.altro'), items: ['gioco', 'archivio', 'guida', 'impostazioni'] },
  ];

  // Acquirente: si sceglie dai membri, non si scrive. Un nome digitato a mano
  // con una lettera diversa creerebbe una persona fantasma nei saldi finali.
  const renderBuyerSelect = (value, onChange, extraClass) => (
    <>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C] ${extraClass || ''}`}
      >
        <option value="">{L.t('acquirente.nonIndicato')}</option>
        {members.map((m) => (<option key={m.id} value={m.name}>{m.name}</option>))}
        {/* Un acquirente registrato prima e non più fra i membri resta
            selezionabile, altrimenti aprendo la scheda si perderebbe. */}
        {value && !members.some((m) => m.name === value) && (
          <option value={value}>{L.t('acquirente.nonPiuMembro', value)}</option>
        )}
      </select>
      {members.length === 0 && (
        <p className="text-minuto text-[#D97706] mt-1">{L.t('galleria.primaMembri')}</p>
      )}
    </>
  );

  const goTo = (tab) => { setActiveTab(tab); setMenuOpen(false); };

  // Guida: una "pill" per ogni area di lavoro.
  // I testi stanno in lingue.js: qui restano la chiave e l'icona. GUIDE e'
  // una const DENTRO App(), quindi si ricostruisce a ogni disegno e la
  // lingua la segue (una const di modulo invece la congelerebbe).
  const GUIDE = [
    { k: 'calendario', icon: '📅', title: L.t('guida.calendario.titolo'), body: L.t('guida.calendario.corpo') },
    { k: 'menu', icon: '🍝', title: L.t('guida.menu.titolo'), body: L.t('guida.menu.corpo') },
    { k: 'membri', icon: '👥', title: L.t('guida.membri.titolo'), body: L.t('guida.membri.corpo') },
    { k: 'presenze', icon: '🍽️', title: L.t('guida.presenze.titolo'), body: L.t('guida.presenze.corpo') },
    { k: 'compiti', icon: '✅', title: L.t('guida.compiti.titolo'), body: L.t('guida.compiti.corpo') },
    { k: 'lista', icon: '🧾', title: L.t('guida.lista.titolo'), body: L.t('guida.lista.corpo') },
    { k: 'attrezzatura', icon: '🪛', title: L.t('guida.attrezzatura.titolo'), body: L.t('guida.attrezzatura.corpo') },
    { k: 'spesa', icon: '💶', title: L.t('guida.spesa.titolo'), body: L.t('guida.spesa.corpo') },
    { k: 'conti', icon: '⚖️', title: L.t('guida.conti.titolo'), body: L.t('guida.conti.corpo') },
    { k: 'separato', icon: '🍽️', title: L.t('guida.separato.titolo'), body: L.t('guida.separato.corpo') },
    { k: 'saldi', icon: '🤝', title: L.t('guida.saldi.titolo'), body: L.t('guida.saldi.corpo') },
    { k: 'dotazioni', icon: '🎒', title: L.t('guida.dotazioni.titolo'), body: L.t('guida.dotazioni.corpo') },
    { k: 'backup', icon: '🛟', title: L.t('guida.backup.titolo'), body: L.t('guida.backup.corpo') },
    { k: 'sync', icon: '☁️', title: L.t('guida.sync.titolo'), body: L.t('guida.sync.corpo') },
    { k: 'chiusura', icon: '🏁', title: L.t('guida.chiusura.titolo'), body: L.t('guida.chiusura.corpo') },
    { k: 'galleria', icon: '📸', title: L.t('guida.galleria.titolo'), body: L.t('guida.galleria.corpo') },
    { k: 'gioco', icon: '🎮', title: L.t('guida.gioco.titolo'), body: L.t('guida.gioco.corpo', LEVEL_EVERY) },
    { k: 'impostazioni', icon: '⚙️', title: L.t('guida.impostazioni.titolo'), body: L.t('guida.impostazioni.corpo') },
    { k: 'pronto', icon: '🎒', title: L.t('guida.pronto.titolo'), body: L.t('guida.pronto.corpo') },
    { k: 'correggi', icon: '✏️', title: L.t('guida.correggi.titolo'), body: L.t('guida.correggi.corpo') },
    { k: 'installa', icon: '📲', title: L.t('guida.installa.titolo'), body: L.t('guida.installa.corpo') },
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
        <h1 className="font-rustic text-titolo tracking-wide">{BRAND.appTitle}</h1>
        <p className="text-piccolo uppercase tracking-wider text-[#8F9E8B]">{tabs[activeTab]}</p>
        {/* Spia in alto a destra. "Da inviare" è il caso importante: sei
            online ma qualcosa non è ancora arrivato agli altri, e prima non
            lo diceva nessuno. */}
        {(() => {
          const foto = cloud.foto || 0;
          const sospeso = !!cloud.pending || foto > 0;
          const testo = sospeso
            ? (foto > 0 ? L.t('spia.fotoDaInviare', foto) : L.t('spia.daInviare'))
            : L.t(isOnline ? 'spia.online' : 'spia.offline');
          const colore = sospeso ? 'text-[#F6C177]' : isOnline ? 'text-[#8F9E8B]' : 'text-[#D97706]';
          const pallino = sospeso ? 'bg-[#F6C177] animate-pulse' : isOnline ? 'bg-[#8F9E8B]' : 'bg-[#D97706]';
          return (
            <span
              title={sospeso ? L.t('spia.sospeso') : testo}
              className={`absolute top-3 right-3 flex items-center gap-1 text-minuto uppercase font-bold ${colore}`}
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
              <div className="text-minuto uppercase tracking-wider text-[#8F9E8B]">{BRAND.groupName}</div>
            </div>
          </div>
          {MENU_GROUPS.map((group) => (
            <div key={group.title} className="pt-2 first:pt-0">
              <div className="flex items-center gap-2 px-1 pb-1">
                <span className="text-minuto uppercase tracking-widest font-bold text-[#8F9E8B] shrink-0">{group.title}</span>
                <span className="flex-grow h-px bg-[#8F9E8B]/30"></span>
              </div>
              {group.items.map((tab) => (
                <button
                  key={tab}
                  onClick={() => goTo(tab)}
                  className={`w-full text-left px-3 py-2.5 rounded font-bold uppercase text-normale tracking-wide transition-colors flex items-center gap-2.5 ${
                    activeTab === tab ? 'bg-[#2D392C] text-[#F0F4F1]' : 'text-[#2D392C] hover:bg-[#E2EAE4]'
                  }`}
                >
                  <span className="text-medio leading-none w-5 text-center shrink-0">{TAB_ICONS[tab]}</span>
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
          <span className="text-medio leading-none mt-0.5">📲</span>
          <p className="flex-grow text-piccolo text-[#5C4A3C] leading-snug">
            <span className="font-bold">{L.t(isDesktop ? 'installa.computer' : 'installa.telefono')}</span>{' '}
            {L.t(isIOS ? 'installa.ios' : isDesktop ? 'installa.desktop' : 'installa.android')}
            {' '}{L.t('installa.poi')}
          </p>
          <button onClick={dismissInstallHint} aria-label={L.t('installa.chiudi')} className={bottoneIcona('neutro', 'shrink-0')}>&times;</button>
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
              <span className="text-medio leading-none mt-0.5">🎒</span>
              <div className="min-w-0 flex-grow">
                <p className="text-piccolo text-[#5C4A3C] leading-snug">
                  {frase('backup.fineGiornata', modifiche)}
                </p>
                <div className="flex gap-2 mt-2">
                  <button onClick={exportData} className={bottone('bruno', 'minuscolo')}>
                    {L.t('backup.salva')}
                  </button>
                  <button
                    onClick={() => {
                      const oggi = toDateStr(new Date());
                      try { localStorage.setItem(BACKUP_KEY, oggi); } catch (e) { /* niente */ }
                      setBackupOggi(oggi);
                    }}
                    className={bottone('secondario', 'minuscolo')}
                  >
                    {L.t('backup.giaFatto')}
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
          <p className="text-piccolo text-[#5C4A3C] leading-snug">
            {frase('spazio.pieno')}
            {admin && <>{frase('spazio.dettaglio')}</>}
          </p>
        </div>
      )}

      {/* Qualcuno ha eliminato una persona che aveva presenze in un giorno
          bloccato: è stata rimessa in elenco. Lo vedono tutti, come sopra:
          chi l'ha eliminata deve sapere che non è stata eliminata davvero. */}
      {membriSalvati.length > 0 && (
        <div className="bg-[#D97706]/15 border-y-2 border-[#D97706]/50 px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="text-medio leading-none mt-0.5">🔒</span>
            <div className="min-w-0 flex-grow">
              <p className="text-piccolo text-[#5C4A3C] leading-snug">
                {frase('membriSalvati.avviso', membriSalvati.length,
                  membriSalvati.length === 1
                    ? membriSalvati[0]
                    : `${membriSalvati.slice(0, 4).join(', ')}${membriSalvati.length > 4 ? '…' : ''}`)}
              </p>
              <button
                onClick={() => setMembriSalvati([])}
                className={bottone('secondario', 'minuscolo', 'mt-2')}
              >
                {L.t('avviso.hoCapito')}
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
            <span className="text-medio leading-none mt-0.5">🔒</span>
            <div className="min-w-0 flex-grow">
              <p className="text-piccolo text-[#5C4A3C] leading-snug">
                {frase('respinte.testa', respinte.length)}{' '}
                {respinte.slice(0, 3).map((r, i) => (
                  <span key={r.che + r.nome + i}>
                    {i > 0 ? ' · ' : ''}{L.t('respinte.riga', L.t(r.che), r.nome, L.t(r.azione), money(r.quanto))}
                  </span>
                ))}
                {respinte.length > 3 ? L.t('respinte.altre', respinte.length - 3) : ''}.
                {' '}{frase('respinte.coda')}
              </p>
              <button
                onClick={() => setRespinte([])}
                className={bottone('secondario', 'minuscolo', 'mt-2')}
              >
                {L.t('avviso.hoCapito')}
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
            <span className="text-medio leading-none mt-0.5">🕐</span>
            <div className="min-w-0 flex-grow">
              <p className="text-piccolo text-[#5C4A3C] leading-snug">
                {frase('orologio.avviso', Math.round(orologioFuori.avanti / 86400000))}
              </p>
              <button
                onClick={() => { setOrologioFuori(null); try { localStorage.removeItem(OROLOGIO_KEY); } catch (e) { /* niente */ } }}
                className={bottone('secondario', 'minuscolo', 'mt-2')}
              >
                {L.t('orologio.sistemato')}
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
            <span className="text-medio leading-none mt-0.5">⚠️</span>
            <div className="min-w-0 flex-grow">
              <p className="text-piccolo text-[#5C4A3C] leading-snug">
                {frase('perdita.avviso', lostSync.n,
                  lostSync.quando ? L.data(new Date(lostSync.quando), 'dataOraBreve') : null,
                  lostSync.che || null)}
              </p>
              <div className="flex gap-2 mt-2">
                <button onClick={annullaSync} className={bottone('avviso', 'minuscolo')}>
                  {L.t('perdita.annulla')}
                </button>
                <button onClick={() => setLostSync(null)} className={bottone('secondario', 'minuscolo')}>
                  {L.t('perdita.vaBene')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-grow p-4">
        {/* ---------- CALENDARIO ---------- */}
        {activeTab === 'calendario' && schedaCalendario({
          admin, campoInCorso, fetchWeather, getDayData, getMeal, goTo, isOnline, members, presenzeOrfane, readyOk, renderWeekStrip, selectedDateStr, sepDays, sepOpen, setSepOpen, toggleSepDay, updateDayData, weather, weekDays, wxBusy,
        })}

        {/* ---------- MENÙ ---------- */}
        {activeTab === 'menu' && schedaMenu({
          confermaPropostaSpesa, getDayData, getMeal, members, proponiDalMenu, propostaSpesa, renderWeekStrip, selectedDateStr, setCurrentDate, setPropostaSpesa, setSelectedDateStr, toBuy, updateDayData,
        })}

        {/* ---------- CHI FA COSA ---------- */}
        {activeTab === 'compiti' && FEATURES.compiti && schedaCompiti({
          addCompito, compiti, daCompitoASpesa, members, nuovoCompito, nuovoCompitoChi,
          removeCompito, renderBuyerSelect, setCompitoCampo, setNuovoCompito, setNuovoCompitoChi, toggleCompito,
        })}

        {/* ---------- MEMBRI ---------- */}
        {activeTab === 'membri' && schedaMembri({
          addMember, infoMember, members, membriDoppi, newMemberChild, newMemberName, removeMember, setInfoMember, setMemberField, setNewMemberChild, setNewMemberName, toggleChild, toggleEquipExempt, unisciDoppi,
        })}

        {/* ---------- PRESENZE ---------- */}
        {activeTab === 'presenze' && schedaPresenze({
          admin, azioniOpen, bloccaGiorno, chiediCopiaDaIeri, chiediGiornoGratis, chiediSetAll, getDayData, getMeal, giornoBloccato, giornoGratis, members, navigateDate, orfanoScelte, presenzeOrfane, riassegnaOrfane, sbloccaGiorno, scartaOrfane, selectedDateStr, setAzioniOpen, setCurrentDate, setOrfanoScelte, setSelectedDateStr, toggleMeal, updateDayData,
        })}

        {/* ---------- SPESA ---------- */}
        {activeTab === 'spesa' && schedaSpesa({
          admin, archives, bloccoConti, campCodeInput, cassaSepAttiva, cassaUnica, chiudiConti, cloud, connectCloud, disconnectCloud, exportData, goTo, importData, isOnline, openClose, openRestore, pastiDi, riapriConti, risparmio, saldiOttimizzati, schedaQuote, schedaSaldi, setCampCodeInput, setSaldiOttimizzati, setSpesaSection, shareReport, spesaSection, totals,
        })}

        {/* ---------- TACCUINO DELLE SPESE ---------- */}
        {activeTab === 'lista' && schedaLista({
          addPurchase, addToBuy, attachReceiptTo, listaSection, manualOpen, newBuyName, newBuyQty, onReceiptFile, openEditPurchase, pAccount, pBuyer, pName, pPrice, pReceipt, pType, purchaseQuery, purchases, receipts, removePurchase, removeToBuy, renderBuyerSelect, sepDays, setBuying, setListaSection, setManualOpen, setNewBuyName, setNewBuyQty, setPAccount, setPBuyer, setPName, setPPrice, setPReceipt, setPType, setPurchaseQuery, setToBuyQuery, setViewReceipt, spesePotenzialmenteDoppie, toBuy, toBuyQuery, totals,
        })}

        {/* ---------- AGGIUNTA ATTREZZATURA ---------- */}
        {activeTab === 'attrezzatura' && schedaAttrezzatura({
          addEquip, attachReceiptTo, equipment, newEquipBuyer, newEquipPrice, newEquipText, openEditEquip, receipts, removeEquip, renderBuyerSelect, setNewEquipBuyer, setNewEquipPrice, setNewEquipText, setViewReceipt, toggleEquipBought,
        })}

        {/* ---------- REGOLE ---------- */}
        {activeTab === 'regole' && schedaRegole()}

        {/* ---------- DOTAZIONI PERSONALI ---------- */}
        {activeTab === 'dotazioni' && schedaDotazioni({
          addGear, gear, newGearText, removeGear, setNewGearText,
        })}

        {/* ---------- GALLERIA ---------- */}
        {activeTab === 'galleria' && schedaGalleria({
          PER_PAGINA_ALBUM, addPhotos, album, albumPage, albumRef, cloud, galleryView, generaRicordo, members, onScrollAlbum, openPhoto, paginaAlbum, pdfBusy, photoBusy, photoCap, photoWho, photos, photosBy, photosReady, picked, picking, setGalleryView, setPhotoWho, setPicked, setPicking, sfoglia, soloNome, togglePicked, uscitaScelta,
        })}

        {/* ---------- ARCHIVIO (campi chiusi) ---------- */}
        {activeTab === 'archivio' && schedaArchivio({
          album, archives, cloud, downloadArchive, members, openAlbum, openPhoto, photos, purchases, removeArchive, setAlbum, setViewArchive, totals,
        })}

        {/* ---------- AIUTA BANDY (mini gioco) ---------- */}
        {activeTab === 'gioco' && schedaGioco({
          endGame, gameBest, gamePlayer, gameRunning, leaderboard, refreshLeaderboard, setGamePlayer, setGameRunning, startGame,
        })}

        {/* ---------- COME FUNZIONA (guida) ---------- */}
        {activeTab === 'guida' && schedaGuida({
          GUIDE, guideOpen, setGuideOpen,
        })}

        {/* ---------- IMPOSTAZIONI ---------- */}
        {activeTab === 'impostazioni' && schedaImpostazioni({
          account, stanzaStato, admin, adminErr, adminPwd, annullaSync, askAlways, bloccoOpen, campData, campoInCorso, cloud, datiOpen, diagTick, entraAdmin, esciAdmin, esportaRegistro, exportData, fotoDove, goTo, isDark, isOnline, lingua, lockNow, logOpen, members, metaRef, photoCap, purchases, readyChecks, readyOk, receipts, setAdminErr, setAdminPwd, setBloccoOpen, setDatiOpen, setDiagTick, setLingua, setLogOpen, setLostSync, setPhotoCap, setTecnicaOpen, setTheme, swVersion, syncStateRef, tecnicaOpen, theme, toggleAskAlways, wipeLocal,
        })}
      </main>

      {/* Registrazione acquisto di una voce "Da Acquistare" */}
      {buying && (
        <div onClick={() => setBuying(null)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-3 shadow-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-[#8F9E8B]/40 pb-2">
              <h3 className="font-rustic text-grande text-[#2D392C] min-w-0 break-words">
                {L.t('lista.acquistataTitolo', buying.name, buying.qty)}
              </h3>
              {/* Foto dello scontrino: si allega qui, con lo scontrino in mano */}
              {receipts[buying.id] ? (
                <button
                  onClick={() => setViewReceipt(receipts[buying.id])}
                  aria-label={L.t('lista.vediScontrino')}
                  className={bottoneIcona('pieno', 'shrink-0')}
                >
                  📷
                </button>
              ) : (
                <label
                  title={L.t('lista.scontrinoTitolo')}
                  aria-label={L.t('lista.allegaScontrino')}
                  className="shrink-0 cursor-pointer px-3 py-2 rounded border-2 border-[#8F9E8B]/50 bg-white text-grande leading-none hover:bg-[#E2EAE4]"
                >
                  📷
                  <input type="file" accept="image/*" onChange={(e) => attachReceiptTo(e, buying.id)} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-piccolo text-gray-500 -mt-1">
              {L.t(receipts[buying.id] ? 'lista.scontrinoGiaLi' : 'lista.scontrinoDaMettere')}
            </p>
            <div>
              <label className="block text-piccolo uppercase font-bold text-gray-500 mb-1">{L.t('lista.prezzo')}</label>
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
              <label className="block text-piccolo uppercase font-bold text-gray-500 mb-1">{L.t('lista.acquirente')}</label>
              {renderBuyerSelect(buying.buyer, (v) => setBuying((b) => ({ ...b, buyer: v })))}
            </div>
            <div>
              <label className="block text-piccolo uppercase font-bold text-gray-500 mb-1">{L.t('lista.tipologia')}</label>
              <select
                value={buying.type}
                onChange={(e) => setBuying((b) => ({ ...b, type: e.target.value }))}
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale font-bold"
              >
                {Object.keys(PURCHASE_TYPES).map((k) => (<option key={k} value={k}>{tipoSpesa(k)}</option>))}
              </select>
            </div>
            {buying.type === 'logistica' && (
                <p className="text-piccolo text-gray-500 leading-snug bg-[#F0F4F1]/60 border border-[#8F9E8B]/25 rounded p-2">
                  {frase('correggi.notaLogistica')}
                </p>
            )}
            {buying.type !== 'logistica' && (
              <div>
                <label className="block text-piccolo uppercase font-bold text-gray-500 mb-1">{L.t('lista.conto')}</label>
                <select
                  value={buying.account || 'comune'}
                  onChange={(e) => setBuying((b) => ({ ...b, account: e.target.value }))}
                  className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale font-bold"
                >
                  <option value="comune">{L.t('lista.contoComune')}</option>
                  <option value="sep">{L.t('giorno.contoSeparato')}</option>
                </select>
                {buying.account === 'sep' && sepDays.length === 0 && (
                  <p className="text-minuto mt-1 leading-snug text-[#5C4A3C]">
                    {L.t('lista.senzaGiorniBreve')}
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setBuying(null)} className={bottone('secondario', 'normale', 'flex-1')}>{L.t('galleria.annulla')}</button>
              <button onClick={confirmBuy} className={bottone('primario', 'normale', 'flex-1')}>{L.t('lista.conferma')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Correzione di una voce già registrata */}
      {editing && (
        <div onClick={() => setEditing(null)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-3 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-[#8F9E8B]/40 pb-2">
              <h3 className="font-rustic text-grande text-[#2D392C]">
                {L.t(editing.kind === 'purchase' ? 'correggi.spesa' : 'correggi.voce')}
              </h3>
              {/* Anche in correzione si può mettere o rivedere lo scontrino */}
              {receipts[editing.id] ? (
                <button onClick={() => setViewReceipt(receipts[editing.id])} aria-label={L.t('lista.vediScontrino')} className={bottoneIcona('pieno', 'shrink-0')}>📷</button>
              ) : (
                <label title={L.t('lista.scontrinoTitolo')} aria-label={L.t('lista.allegaScontrino')} className="shrink-0 cursor-pointer px-3 py-2 rounded border-2 border-[#8F9E8B]/50 bg-white text-grande leading-none hover:bg-[#E2EAE4]">
                  📷
                  <input type="file" accept="image/*" onChange={(e) => attachReceiptTo(e, editing.id)} className="hidden" />
                </label>
              )}
            </div>

            <div>
              <label className="block text-piccolo uppercase font-bold text-gray-500 mb-1">Nome</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))}
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
              />
            </div>

            <div>
              <label className="block text-piccolo uppercase font-bold text-gray-500 mb-1">Acquirente</label>
              {renderBuyerSelect(editing.buyer, (v) => setEditing((x) => ({ ...x, buyer: v })))}
            </div>

            <div className={editing.kind === 'purchase' ? 'grid grid-cols-2 gap-3' : ''}>
              <div>
                <label className="block text-piccolo uppercase font-bold text-gray-500 mb-1">Prezzo (€)</label>
                <input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={editing.price}
                  onChange={(e) => setEditing((x) => ({ ...x, price: e.target.value }))}
                  className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
                />
              </div>
              {editing.kind === 'purchase' && (
                <div>
                  <label className="block text-piccolo uppercase font-bold text-gray-500 mb-1">Tipologia</label>
                  <select
                    value={editing.type}
                    onChange={(e) => setEditing((x) => ({ ...x, type: e.target.value }))}
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale font-bold"
                  >
                    {Object.keys(PURCHASE_TYPES).map((k) => (<option key={k} value={k}>{tipoSpesa(k)}</option>))}
                  </select>
                </div>
              )}
            </div>

            {/* Il conto separato vale solo su cibo e bevande. Prima, sulla
                logistica, la riga semplicemente non compariva: chi la cercava
                non trovava niente e non poteva sapere perche'. Ora si dice. */}
            {editing.kind === 'purchase' && (editing.type !== 'logistica' ? (
              <div>
                <label className="block text-piccolo uppercase font-bold text-gray-500 mb-1">{L.t('lista.conto')}</label>
                <select
                  value={editing.account}
                  onChange={(e) => setEditing((x) => ({ ...x, account: e.target.value }))}
                  className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale font-bold"
                >
                  <option value="comune">{L.t('lista.contoComune')}</option>
                  <option value="sep">{L.t('giorno.contoSeparato')}</option>
                </select>
              </div>
            ) : (
                <p className="text-piccolo text-gray-500 leading-snug bg-[#F0F4F1]/60 border border-[#8F9E8B]/25 rounded p-2">
                  {frase('correggi.notaLogistica')}
                </p>
            ))}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(null)} className={bottone('secondario', 'normale', 'flex-1')}>{L.t('galleria.annulla')}</button>
              <button onClick={saveEdit} className={bottone('primario', 'normale', 'flex-1')}>{L.t('lista.salva')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Scelta dello snapshot da ripristinare */}
      {snapList && (
        <div onClick={() => setSnapList(null)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-2 max-h-[70vh] overflow-y-auto shadow-2xl">
            <h3 className="font-rustic text-grande text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2">{L.t('ripristino.titolo')}</h3>
            <p className="text-piccolo text-gray-500">
              {frase('ripristino.nota')}
            </p>
            {snapList.map((s) => {
              const giorno = L.data(parseDate(s.id.slice(0, 10)), 'settimanaLunga');
              const fascia = s.id.slice(11) === '00' ? L.t('ripristino.fasciaMattina') : s.id.slice(11) === '12' ? L.t('ripristino.fasciaPomeriggio') : '';
              const ora = s.at ? L.data(new Date(s.at), 'ora') : '';
              return (
                <button
                  key={s.dove + s.id}
                  onClick={() => restoreSnapshot(s)}
                  className="w-full py-2 px-3 bg-[#F0F4F1] border border-[#8F9E8B]/40 rounded text-left text-[#2D392C] hover:bg-[#E2EAE4] flex items-center justify-between gap-2"
                >
                  <span className="min-w-0">
                    <span className="block text-normale font-bold truncate">{giorno}</span>
                    <span className="block text-minuto text-gray-500">
                      {fascia ? L.t('ripristino.copiaDelle', fascia, ora) : L.t('ripristino.copiaCloud')}
                    </span>
                  </span>
                  <span className="text-minuto uppercase font-bold px-1.5 py-0.5 rounded shrink-0 bg-white border border-[#8F9E8B]/40 text-gray-500">
                    {L.t(s.dove === 'locale' ? 'ripristino.sulTelefono' : 'ripristino.nelCloud')}
                  </span>
                </button>
              );
            })}
            <button onClick={() => setSnapList(null)} className={bottone('testuale', 'normale', 'w-full')}>{L.t('galleria.annulla')}</button>
          </div>
        </div>
      )}

      {/* Chiusura del campo: nome dell'archivio e riepilogo di cosa succede */}
      {closing && (
        <div onClick={() => setClosing(false)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-3 max-h-[80vh] overflow-y-auto shadow-2xl">
            <h3 className="font-rustic text-grande text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2">{L.t('chiusura.campoTitolo')}</h3>
            <label className="block text-piccolo uppercase font-bold text-gray-500">{L.t('chiusura.nomeArchivio')}</label>
            <input
              type="text"
              value={closeName}
              onChange={(e) => setCloseName(e.target.value)}
              placeholder={L.t('chiusura.esempioNome')}
              className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
            />
            <div className="bg-[#F0F4F1]/60 rounded p-3 text-piccolo text-gray-600 space-y-1">
              <p className="font-bold text-[#2D392C]">{L.t('chiusura.verraArchiviato')}</p>
              <p>{L.t('chiusura.riepilogo', money(totals.overallTotal), purchases.length, members.length)}</p>
              <p className="font-bold text-[#2D392C] pt-1">{L.t('chiusura.poiAzzerati')}</p>
              <p>{L.t('chiusura.cosaSiAzzera')}</p>
              <p className="pt-1 italic">{L.t('chiusura.cosaResta')}</p>
            </div>
            <button onClick={closeCamp} className={bottone('bruno', 'grande', 'w-full')}>
              {L.t('chiusura.archiviaEAzzera')}
            </button>
            <button onClick={() => setClosing(false)} className={bottone('testuale', 'normale', 'w-full')}>{L.t('galleria.annulla')}</button>
          </div>
        </div>
      )}

      {/* Resoconto di un campo archiviato */}
      {viewArchive && (
        <div onClick={() => setViewArchive(null)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-3 max-h-[80vh] overflow-y-auto shadow-2xl">
            <h3 className="font-rustic text-grande text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2">{viewArchive.name}</h3>
            <pre className="text-piccolo text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{viewArchive.report || L.t('archivio.nessunResoconto')}</pre>
            <button onClick={() => shareArchive(viewArchive)} className={bottone('whatsapp', 'normale', 'w-full')}>{L.t('archivio.condividi')}</button>
            <button onClick={() => setViewArchive(null)} className={bottone('testuale', 'normale', 'w-full')}>{L.t('archivio.chiudi')}</button>
          </div>
        </div>
      )}

      {/* Visualizzatore scontrino a schermo intero (tocca per chiudere) */}
      {/* Foto della galleria a schermo pieno: l'originale si scarica solo qui. */}
      {viewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="flex-grow flex items-center justify-center w-full min-h-0" onClick={() => setViewPhoto(null)}>
            {viewPhoto.full
              ? <img src={viewPhoto.full} alt={L.t('archivio.fotoDi', viewPhoto.by || L.t('archivio.anonimo'))} className="max-w-full max-h-full rounded shadow-2xl" />
              : <div className="text-center">
                  <img src={viewPhoto.thumb} alt="" className="max-w-full max-h-[60vh] rounded opacity-40 blur-sm" />
                  <p className="mt-3 text-piccolo uppercase tracking-widest text-white/60">{L.t('galleria.scaricoFoto')}</p>
                </div>}
          </div>
          <div className="shrink-0 w-full max-w-md flex items-center justify-between gap-3 pt-3">
            <span className="text-piccolo text-white/70 truncate">
              {viewPhoto.by || L.t('archivio.anonimo')}
              {viewPhoto.at ? ` · ${L.data(new Date(viewPhoto.at), 'numerica')}` : ''}
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => removePhoto(viewPhoto)}
                className="text-piccolo uppercase font-bold px-3 py-2 rounded border border-[#D97706]/60 text-[#D97706]"
              >
                {L.t('archivio.elimina')}
              </button>
              <button
                onClick={() => setViewPhoto(null)}
                className="text-piccolo uppercase font-bold px-3 py-2 rounded bg-[#F0F4F1] text-[#2D392C]"
              >
                {L.t('archivio.chiudi')}
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
          <img src={viewReceipt} alt={L.t('lista.scontrino')} className="max-w-full max-h-full rounded shadow-2xl" />
          <span className="absolute bottom-6 left-0 right-0 text-center text-piccolo uppercase tracking-widest text-white/60">{L.t('galleria.toccaPerChiudere')}</span>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#F0F4F1] border-t-2 border-[#5C4A3C] py-3 px-4 text-center z-10">
        <div className="font-rustic text-[#2D392C] tracking-widest text-normale uppercase font-bold">{BRAND.footerMotto}</div>
      </footer>
    </div>
  );
}
