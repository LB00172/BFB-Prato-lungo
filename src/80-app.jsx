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
  // un documento per foto) + copia locale nel magazzino (IndexedDB).
  //
  // Parte VUOTA e si riempie subito dopo, perche' il magazzino si legge in
  // modo asincrono. Prima si partiva da localStorage, che si legge di colpo:
  // comodo, ma erano 3,18 MB di foto dentro i 5 disponibili, e i conti
  // rischiavano di non avere piu' posto dove salvarsi (ROADMAP.md § 19).
  const [receipts, setReceipts] = useState({});
  const receiptsRef = useRef({});
  // Cosa risulta gia' scritto nel magazzino: serve a scrivere SOLO le foto
  // nuove invece di riversare ogni volta l'intera mappa.
  const receiptsSalvatiRef = useRef({});
  // Le scritture nel magazzino si mettono in fila. Due in volo insieme
  // vedrebbero lo stesso punto di partenza: aggiungi una foto e cancellala
  // subito dopo, e la cancellazione parte da uno stato in cui quella foto non
  // c'era ancora — resta nel magazzino per sempre, che e' proprio il problema
  // che questa sezione doveva chiudere.
  const codaMagazzinoRef = useRef(Promise.resolve());

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
  // Dove sono finite davvero le foto: nel magazzino (IndexedDB) o, se quello
  // non e' disponibile, nella memoria del telefono come prima. In modalita'
  // tecnica va detto, perche' cambia quanto spazio resta ai conti.
  const [fotoDove, setFotoDove] = useState('magazzino');
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
    // "receipts" fra le dipendenze e' voluto: le foto adesso arrivano dal
    // magazzino DOPO il primo disegno, quindi al primo giro non c'e' ancora
    // niente da potare. Senza, la foto di una spesa cancellata altrove
    // resterebbe nel magazzino per sempre. Non fa cicli: quando non c'e'
    // niente da togliere la funzione restituisce lo stesso oggetto di prima.
  }, [purchases, toBuy, equipment, receipts]);

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

  // ---------- Dal menù alla lista della spesa ----------
  // Il menù è già la spesa: al campo 2026 le quantità stavano lì e la scheda
  // "Da acquistare" aveva cinque voci. Qui si propongono le righe del menù del
  // giorno; nessuna entra senza conferma, e quelle già in lista non ricompaiono.
  const [propostaSpesa, setPropostaSpesa] = useState(null); // { voci:[], scelte:{} }

  const proponiDalMenu = () => {
    const MS = window.MenuSpesa;
    if (!MS) { window.alert('Il lettore dei menù non è disponibile.'); return; }
    const testo = getDayData(selectedDateStr).note || '';
    const tutte = MS.vociDalMenu(testo);
    if (tutte.length === 0) {
      window.alert('Il menù di questo giorno è vuoto: scrivi cosa si mangia e riprova.');
      return;
    }
    const voci = MS.nuove(tutte, toBuy);
    if (voci.length === 0) {
      window.alert(`Le ${tutte.length} ${tutte.length === 1 ? 'voce' : 'voci'} di questo menù sono già nella lista della spesa.`);
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
  const campRange = () => intervalloCampo(campData);

  const openClose = () => {
    if (!campoInCorso) {
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

  // Un campo c'e' quando c'e' qualcosa dentro. Serve in due posti che devono
  // dire la stessa cosa: "chiudi il campo" (non si chiude il vuoto) e i
  // controlli qui sotto (non si e' pronti per un campo che non c'e').
  const campoInCorso = members.length > 0 || purchases.length > 0
    || toBuy.length > 0 || equipment.length > 0;

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
        {activeTab === 'calendario' && schedaCalendario({
          admin, calculateTotals, campoInCorso, fetchWeather, getDayData, getMeal, goTo, isOnline, members, presenzeOrfane, readyOk, renderWeekStrip, selectedDateStr, sepDays, sepOpen, setSepOpen, toggleSepDay, updateDayData, weather, weekDays, wxBusy,
        })}

        {/* ---------- MENÙ ---------- */}
        {activeTab === 'menu' && schedaMenu({
          confermaPropostaSpesa, getDayData, getMeal, members, proponiDalMenu, propostaSpesa, renderWeekStrip, selectedDateStr, setCurrentDate, setPropostaSpesa, setSelectedDateStr, toBuy, updateDayData,
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
          admin, adminErr, adminPwd, annullaSync, askAlways, bloccoOpen, campData, campoInCorso, cloud, datiOpen, diagTick, entraAdmin, esciAdmin, esportaRegistro, exportData, fotoDove, goTo, isDark, isOnline, lockNow, logOpen, members, metaRef, photoCap, purchases, readyChecks, readyOk, receipts, setAdminErr, setAdminPwd, setBloccoOpen, setDatiOpen, setDiagTick, setLogOpen, setLostSync, setPhotoCap, setTecnicaOpen, setTheme, swVersion, syncStateRef, tecnicaOpen, theme, toggleAskAlways, wipeLocal,
        })}
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
