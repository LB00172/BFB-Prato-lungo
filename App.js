/* File GENERATO da App.jsx tramite Babel (node build.js). Non modificare a mano. */
const {
  useState,
  useEffect,
  useRef
} = React;
const {
  createRoot
} = ReactDOM;

// ---------- Utility ----------

// Formatta una Date in 'YYYY-MM-DD' usando l'ora LOCALE (niente UTC),
// evitando lo sfasamento di un giorno dei fusi orari.
const pad = n => String(n).padStart(2, '0');
const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Interpreta 'YYYY-MM-DD' come data locale (non UTC).
const parseDate = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Lettura sicura da localStorage: se i dati sono corrotti non fa crashare l'app.
const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn('Dati corrotti in', key, '- uso i valori di default.', e);
    return fallback;
  }
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const money = n => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
// Numero >= 0 a partire da una stringa di input.
const posNum = v => Math.max(0, parseFloat(v) || 0);
const initialDayState = () => ({
  note: '',
  guestsNames: '',
  meals: {}
});

// Branding e funzionalità: letti da window.APP_CONFIG (firebase-config.js),
// con fallback ai valori attuali se la configurazione non è presente.
const CFG = typeof window !== 'undefined' && window.APP_CONFIG || {};
const BRAND = {
  appTitle: 'PRATO LUNGO 2026',
  groupName: 'Brigata Fabio Bandone',
  splashLine1: 'BRIGATA',
  splashLine2: 'FABIO BANDONE',
  splashTagline: 'Prato Lungo Forever',
  footerMotto: 'In BANDY we Trust',
  credits: 'Web app prodotta da Lorenzo Ballerini · Tutti i diritti riservati © 2026',
  ...(CFG.brand || {})
};
const FEATURES = {
  auth: false,
  rooms: false,
  ...(CFG.features || {})
};

// Periodo del campo. Durante il campo l'app si apre sul giorno corrente.
const CAMP_START = '2026-08-11';
const CAMP_END = '2026-08-16';
const defaultDateStr = () => {
  const today = toDateStr(new Date());
  return today >= CAMP_START && today <= CAMP_END ? today : CAMP_START;
};

// Tipologie di acquisto e a quale voce di spesa contribuiscono.
const PURCHASE_TYPES = {
  alimentare: 'Alimentare',
  bevande: 'Bevande',
  logistica: 'Logistica'
};

// Codici meteo WMO (Open-Meteo) -> icona e descrizione.
const wmoInfo = code => {
  if (code === 0) return {
    icon: '☀️',
    label: 'Sereno'
  };
  if (code === 1 || code === 2) return {
    icon: '🌤️',
    label: 'Poco nuvoloso'
  };
  if (code === 3) return {
    icon: '☁️',
    label: 'Coperto'
  };
  if (code === 45 || code === 48) return {
    icon: '🌫️',
    label: 'Nebbia'
  };
  if (code >= 51 && code <= 57) return {
    icon: '🌦️',
    label: 'Pioviggine'
  };
  if (code >= 61 && code <= 67) return {
    icon: '🌧️',
    label: 'Pioggia'
  };
  if (code >= 71 && code <= 77) return {
    icon: '🌨️',
    label: 'Neve'
  };
  if (code >= 80 && code <= 82) return {
    icon: '🌦️',
    label: 'Rovesci'
  };
  if (code === 85 || code === 86) return {
    icon: '🌨️',
    label: 'Rovesci di neve'
  };
  if (code >= 95) return {
    icon: '⛈️',
    label: 'Temporale'
  };
  return {
    icon: '🌡️',
    label: 'Meteo'
  };
};

// Dotazione personale base: uguale per tutti, non modificabile dall'app.
const BASE_GEAR = ['Tenda', 'Stoviglie, posate personali e bicchiere riutilizzabile', 'Sacchi a pelo', 'Borraccia', 'Cuscini', 'Canovacci', 'Materassino', 'Luci LED'];

// Comprime una foto (scontrino) ridimensionandola e convertendola in JPEG,
// così da poterla salvare in localStorage senza esaurire lo spazio.
const compressImage = (file, maxDim = 1200, quality = 0.6) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = reader.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});
function App() {
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
        if (n > 0) seed.push({
          id: uid(),
          name,
          price: n,
          type,
          at: Date.now()
        });
      };
      mk(g.food, 'alimentare', 'Totale cibo (importato)');
      mk(g.drinks, 'bevande', 'Totale bevande (importato)');
      mk(g.accessory, 'logistica', 'Totale accessori (importato)');
    }
    return seed;
  });
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberChild, setNewMemberChild] = useState(false);
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pType, setPType] = useState('alimentare');
  const [pBuyer, setPBuyer] = useState('');
  const [pReceipt, setPReceipt] = useState(null); // foto scontrino in attesa di Salva
  const [viewReceipt, setViewReceipt] = useState(null); // foto aperta a schermo intero
  const [snapList, setSnapList] = useState(null); // elenco snapshot per il ripristino
  const [spesaSection, setSpesaSection] = useState('totali'); // sotto-sezione attiva in Spesa
  const [guideOpen, setGuideOpen] = useState('calendario'); // pill aperta nella guida

  // Rimborsi segnati come "saldati" (solo barrati, non rimossi). Condivisi via sync.
  const [settled, setSettled] = useState(() => load('cambusa_settled', []));

  // Cache meteo (Open-Meteo, 16 giorni). Aggiornata al massimo una volta all'ora.
  const [weather, setWeather] = useState(() => load('cambusa_weather', {
    fetchedAt: 0,
    byDate: {}
  }));

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
  const [newBuyName, setNewBuyName] = useState('');
  const [newBuyQty, setNewBuyQty] = useState('');
  const [buying, setBuying] = useState(null); // voce in fase di registrazione acquisto
  const [newEquipText, setNewEquipText] = useState('');
  const [newEquipPrice, setNewEquipPrice] = useState('');
  const [newEquipBuyer, setNewEquipBuyer] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  // Suggerimento installazione PWA: mostrato finché l'app non è installata
  // (o finché l'utente non lo chiude). Su iOS l'installazione è solo manuale.
  const [showInstallHint, setShowInstallHint] = useState(() => {
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    return !standalone && !localStorage.getItem('cambusa_install_hint_off');
  });
  const dismissInstallHint = () => {
    localStorage.setItem('cambusa_install_hint_off', '1');
    setShowInstallHint(false);
  };
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // Desktop = puntatore fine e nessun touch primario: cambia solo i testi
  // delle istruzioni, non la grafica.
  const isDesktop = !/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

  // Chiusura del menu laterale con Esc (comodo da tastiera).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = e => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ---------- Stato sincronizzazione cloud (Firebase) ----------
  const [cloud, setCloud] = useState({
    connected: false,
    status: 'idle',
    code: null,
    lastSync: null,
    error: null
  });
  const [campCodeInput, setCampCodeInput] = useState(typeof window !== 'undefined' && window.CAMP_CODE_DEFAULT || '');
  const cloudConnectedRef = useRef(false);
  const suppressPushRef = useRef(false);

  // ---------- Persistenza ----------
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => localStorage.setItem('cambusa_members', JSON.stringify(members)), [members]);
  useEffect(() => localStorage.setItem('cambusa_camp_data', JSON.stringify(campData)), [campData]);
  useEffect(() => localStorage.setItem('cambusa_purchases', JSON.stringify(purchases)), [purchases]);
  useEffect(() => localStorage.setItem('cambusa_gear', JSON.stringify(gear)), [gear]);
  useEffect(() => localStorage.setItem('cambusa_settled', JSON.stringify(settled)), [settled]);
  useEffect(() => localStorage.setItem('cambusa_equipment', JSON.stringify(equipment)), [equipment]);
  useEffect(() => localStorage.setItem('cambusa_tobuy', JSON.stringify(toBuy)), [toBuy]);
  useEffect(() => localStorage.setItem('cambusa_weather', JSON.stringify(weather)), [weather]);

  // Scarica le previsioni (16 giorni) se c'è linea, la località è impostata e
  // la cache ha più di un'ora. Navigando tra i giorni i dati sono già pronti.
  useEffect(() => {
    const loc = window.CAMP_LOCATION;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return;
    if (!navigator.onLine) return;
    if (Date.now() - weather.fetchedAt < 60 * 60 * 1000) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`).then(r => r.json()).then(j => {
      const d = j && j.daily;
      if (!d || !Array.isArray(d.time)) return;
      const byDate = {};
      d.time.forEach((t, i) => {
        byDate[t] = {
          code: d.weather_code[i],
          tmax: d.temperature_2m_max[i],
          tmin: d.temperature_2m_min[i],
          rain: d.precipitation_probability_max[i]
        };
      });
      setWeather({
        fetchedAt: Date.now(),
        byDate
      });
    }).catch(() => {/* offline o API non raggiungibile: resta la cache */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, selectedDateStr]);
  useEffect(() => {
    receiptsRef.current = receipts;
    try {
      localStorage.setItem('cambusa_receipts', JSON.stringify(receipts));
    } catch (e) {
      console.warn('localStorage pieno: le foto restano comunque nella cache di Firestore.');
    }
  }, [receipts]);

  // Pulizia: elimina le foto locali di acquisti che non esistono più
  // (es. acquisto cancellato da un altro dispositivo).
  useEffect(() => {
    setReceipts(prev => {
      const ids = new Set(purchases.map(p => p.id));
      const keys = Object.keys(prev);
      if (keys.every(k => ids.has(k))) return prev;
      const copy = {};
      keys.forEach(k => {
        if (ids.has(k)) copy[k] = prev[k];
      });
      return copy;
    });
  }, [purchases]);
  useEffect(() => {
    const on = () => {
      setIsOnline(true);
      // Al ritorno della linea, se non siamo connessi (e la sync non è stata
      // disattivata a mano), riconnette da solo col codice salvato o predefinito.
      const CS = window.CloudSync;
      const optedOut = localStorage.getItem('cambusa_sync_optout') === '1';
      if (CS && CS.isConfigured() && !cloudConnectedRef.current && !optedOut) {
        const code = CS.savedCode() || window.CAMP_CODE_DEFAULT || '';
        if (code) CS.connect(window.FIREBASE_CONFIG, code, applyRemote).catch(() => {});
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
  // Applica al locale i dati arrivati dal cloud (senza rimbalzarli indietro).
  const applyRemote = remote => {
    suppressPushRef.current = true;
    if (Array.isArray(remote.members)) setMembers(remote.members);
    if (remote.campData && typeof remote.campData === 'object') setCampData(remote.campData);
    if (Array.isArray(remote.purchases)) setPurchases(remote.purchases);
    if (Array.isArray(remote.gear)) setGear(remote.gear);
    if (Array.isArray(remote.settled)) setSettled(remote.settled);
    if (Array.isArray(remote.equipment)) setEquipment(remote.equipment);
    if (Array.isArray(remote.toBuy)) setToBuy(remote.toBuy);
    setTimeout(() => {
      suppressPushRef.current = false;
    }, 0);
  };
  const connectCloud = async code => {
    const CS = window.CloudSync;
    if (!CS || !CS.isConfigured()) {
      window.alert('Firebase non è configurato. Incolla la config del tuo progetto in firebase-config.js.');
      return;
    }
    const c = (code || '').trim();
    if (!c) {
      window.alert('Inserisci il codice del campo.');
      return;
    }
    localStorage.removeItem('cambusa_sync_optout'); // riattiva l'auto-connessione
    try {
      await CS.connect(window.FIREBASE_CONFIG, c, applyRemote);
    } catch (e) {
      window.alert('Connessione fallita: ' + (e && e.message ? e.message : e));
    }
  };
  const disconnectCloud = () => {
    // Scelta esplicita: niente riconnessione automatica finché non si riattiva.
    localStorage.setItem('cambusa_sync_optout', '1');
    if (window.CloudSync) window.CloudSync.disconnect();
  };

  // Foto scontrini in arrivo dal cloud: merge con le locali, e upload di
  // quelle presenti solo in locale (es. scattate prima della connessione).
  const handleCloudReceipts = cloudMap => {
    const local = receiptsRef.current;
    const CS = window.CloudSync;
    Object.keys(local).forEach(id => {
      if (!cloudMap[id] && CS && CS.isConnected()) CS.putReceipt(id, local[id]);
    });
    setReceipts(prev => ({
      ...prev,
      ...cloudMap
    }));
  };

  // All'avvio: aggancia lo stato e si connette DA SOLO col codice campo
  // (salvato o predefinito). Chi ha premuto Disconnetti resta fuori finché
  // non riattiva manualmente (flag cambusa_sync_optout).
  useEffect(() => {
    const CS = window.CloudSync;
    if (!CS) return;
    CS.onStatus(s => {
      cloudConnectedRef.current = s.connected;
      setCloud(s);
    });
    if (CS.onReceipts) CS.onReceipts(handleCloudReceipts);
    const optedOut = localStorage.getItem('cambusa_sync_optout') === '1';
    const code = CS.savedCode() || window.CAMP_CODE_DEFAULT || '';
    if (code && CS.isConfigured() && !optedOut) {
      setCampCodeInput(code);
      CS.connect(window.FIREBASE_CONFIG, code, applyRemote).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push verso il cloud quando i dati cambiano. Se offline, Firestore mette la
  // scrittura in coda e la invia da solo al ritorno della linea.
  useEffect(() => {
    if (!cloudConnectedRef.current) return;
    if (suppressPushRef.current) return;
    if (window.CloudSync) window.CloudSync.pushState({
      members,
      campData,
      purchases,
      gear,
      settled,
      equipment,
      toBuy
    });
  }, [members, campData, purchases, gear, settled, equipment, toBuy]);

  // ---------- Dati per giorno ----------
  const getDayData = dateStr => ({
    ...initialDayState(),
    ...(campData[dateStr] || {})
  });
  const updateDayData = (dateStr, field, value) => {
    setCampData(prev => ({
      ...prev,
      [dateStr]: {
        ...initialDayState(),
        ...(prev[dateStr] || {}),
        [field]: value
      }
    }));
  };
  const getMeal = (dateStr, memberId) => {
    const day = campData[dateStr];
    return day && day.meals && day.meals[memberId] || {
      lunch: false,
      dinner: false
    };
  };
  const toggleMeal = (dateStr, memberId, mealType) => {
    setCampData(prev => {
      const day = {
        ...initialDayState(),
        ...(prev[dateStr] || {})
      };
      const meals = {
        ...(day.meals || {})
      };
      const cur = meals[memberId] || {
        lunch: false,
        dinner: false
      };
      meals[memberId] = {
        ...cur,
        [mealType]: !cur[mealType]
      };
      return {
        ...prev,
        [dateStr]: {
          ...day,
          meals
        }
      };
    });
  };

  // Segna (o toglie) TUTTI i membri a pranzo/cena per il giorno: se sono già
  // tutti segnati, li toglie tutti; altrimenti li segna tutti.
  const setAllMeals = (dateStr, mealType) => {
    if (members.length === 0) return;
    setCampData(prev => {
      const day = {
        ...initialDayState(),
        ...(prev[dateStr] || {})
      };
      const meals = {
        ...(day.meals || {})
      };
      const allOn = members.every(m => meals[m.id] && meals[m.id][mealType]);
      members.forEach(m => {
        const cur = meals[m.id] || {
          lunch: false,
          dinner: false
        };
        meals[m.id] = {
          ...cur,
          [mealType]: !allOn
        };
      });
      return {
        ...prev,
        [dateStr]: {
          ...day,
          meals
        }
      };
    });
  };

  // Copia le presenze (pranzo e cena) dal giorno precedente.
  const copyFromPreviousDay = () => {
    const d = parseDate(selectedDateStr);
    d.setDate(d.getDate() - 1);
    const prevStr = toDateStr(d);
    const prevMeals = campData[prevStr] && campData[prevStr].meals || {};
    if (!Object.keys(prevMeals).length) {
      window.alert('Nessuna presenza registrata il giorno precedente.');
      return;
    }
    const curMeals = campData[selectedDateStr] && campData[selectedDateStr].meals || {};
    const hasAny = Object.values(curMeals).some(m => m && (m.lunch || m.dinner));
    if (hasAny && !window.confirm('Questo giorno ha già delle presenze: sostituirle con quelle di ieri?')) return;
    setCampData(prev => {
      const day = {
        ...initialDayState(),
        ...(prev[selectedDateStr] || {})
      };
      return {
        ...prev,
        [selectedDateStr]: {
          ...day,
          meals: JSON.parse(JSON.stringify(prevMeals))
        }
      };
    });
  };

  // ---------- Gestione membri ----------
  const addMember = () => {
    const name = newMemberName.trim();
    if (!name) return;
    setMembers(prev => [...prev, {
      id: uid(),
      name,
      isChild: newMemberChild
    }]);
    setNewMemberName('');
    setNewMemberChild(false);
  };
  const removeMember = id => {
    const m = members.find(x => x.id === id);
    if (m && !window.confirm(`Eliminare ${m.name} dai membri?\nLe sue presenze e i suoi pasti non conteranno più nei calcoli.`)) return;
    setMembers(prev => prev.filter(x => x.id !== id));
  };
  const toggleChild = id => {
    setMembers(prev => prev.map(m => m.id === id ? {
      ...m,
      isChild: !m.isChild
    } : m));
  };

  // Esenzione dalla spesa per l'attrezzatura aggiunta.
  const toggleEquipExempt = id => {
    setMembers(prev => prev.map(m => m.id === id ? {
      ...m,
      equipExempt: !m.equipExempt
    } : m));
  };

  // ---------- Lista "Da Acquistare" ----------
  const addToBuy = () => {
    const name = newBuyName.trim();
    if (!name) return;
    setToBuy(prev => [...prev, {
      id: uid(),
      name,
      qty: newBuyQty.trim()
    }]);
    setNewBuyName('');
    setNewBuyQty('');
  };
  const removeToBuy = id => {
    const it = toBuy.find(x => x.id === id);
    if (it && !window.confirm(`Eliminare "${it.name}" dalla lista da acquistare?`)) return;
    setToBuy(prev => prev.filter(x => x.id !== id));
    setReceipts(prev => {
      if (!prev[id]) return prev;
      const copy = {
        ...prev
      };
      delete copy[id];
      return copy;
    });
    if (window.CloudSync) window.CloudSync.deleteReceipt(id);
  };

  // Foto scontrino allegata direttamente alla voce da acquistare.
  const onToBuyReceipt = async (e, id) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      let dataUrl = await compressImage(file, 1000, 0.6);
      if (dataUrl.length > 900000) dataUrl = await compressImage(file, 800, 0.4);
      setReceipts(prev => ({
        ...prev,
        [id]: dataUrl
      }));
      if (window.CloudSync) window.CloudSync.putReceipt(id, dataUrl);
    } catch (err) {
      window.alert('Impossibile leggere la foto. Riprova.');
    }
  };

  // Conferma acquisto: la voce esce dalla lista ed entra nella cronologia
  // mantenendo lo stesso id (così la foto scontrino resta collegata).
  const confirmBuy = () => {
    if (!buying) return;
    const price = posNum(buying.price);
    if (price <= 0) {
      window.alert('Inserisci un prezzo maggiore di zero.');
      return;
    }
    const fullName = buying.qty ? `${buying.name} (${buying.qty})` : buying.name;
    setPurchases(prev => [...prev, {
      id: buying.id,
      name: fullName,
      price,
      type: buying.type,
      buyer: (buying.buyer || '').trim(),
      at: Date.now(),
      fromList: true
    }]);
    setToBuy(prev => prev.filter(x => x.id !== buying.id));
    setBuying(null);
  };

  // ---------- Taccuino delle spese ----------
  const addPurchase = () => {
    const name = pName.trim();
    const price = posNum(pPrice);
    if (!name || price <= 0) {
      window.alert('Inserisci il nome del prodotto e un prezzo maggiore di zero.');
      return;
    }
    const id = uid();
    setPurchases(prev => [...prev, {
      id,
      name,
      price,
      type: pType,
      buyer: pBuyer.trim(),
      at: Date.now()
    }]);
    if (pReceipt) {
      setReceipts(prev => ({
        ...prev,
        [id]: pReceipt
      }));
      if (window.CloudSync) window.CloudSync.putReceipt(id, pReceipt);
    }
    setPName('');
    setPPrice('');
    setPType('alimentare');
    setPBuyer('');
    setPReceipt(null);
  };
  const removePurchase = id => {
    const p = purchases.find(x => x.id === id);
    if (p && !window.confirm(`Eliminare l'acquisto "${p.name}" (${money(posNum(p.price))} €)?\nVerrà tolto dai totali${receipts[id] ? ' insieme alla foto dello scontrino' : ''}.`)) return;
    setPurchases(prev => prev.filter(x => x.id !== id));
    setReceipts(prev => {
      if (!prev[id]) return prev;
      const copy = {
        ...prev
      };
      delete copy[id];
      return copy;
    });
    if (window.CloudSync) window.CloudSync.deleteReceipt(id);
  };
  const onReceiptFile = async e => {
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
  const openRestore = async () => {
    const CS = window.CloudSync;
    if (!CS || !CS.isConnected || !CS.isConnected()) {
      window.alert('Serve la connessione al cloud per il ripristino. Riprova quando c\'è linea.');
      return;
    }
    const ids = await CS.listSnapshots();
    if (!ids.length) {
      window.alert('Nessun salvataggio automatico disponibile (se ne crea uno al giorno).');
      return;
    }
    setSnapList(ids);
  };
  const restoreSnapshot = async id => {
    if (!window.confirm(`Ripristinare i dati salvati il ${id}?\nI dati attuali verranno sostituiti su TUTTI i dispositivi connessi.`)) return;
    const CS = window.CloudSync;
    const json = await CS.getSnapshot(id);
    if (!json) {
      window.alert('Impossibile leggere questo salvataggio.');
      return;
    }
    try {
      const d = JSON.parse(json);
      // Set "normali" (non via applyRemote): così il push parte e propaga
      // il ripristino a tutti i dispositivi.
      setMembers(Array.isArray(d.members) ? d.members : []);
      setCampData(d.campData && typeof d.campData === 'object' ? d.campData : {});
      setPurchases(Array.isArray(d.purchases) ? d.purchases : []);
      setGear(Array.isArray(d.gear) ? d.gear : []);
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
    if (t.transfers.length > 0) {
      lines.push('');
      lines.push('👉 Chi paga chi:');
      t.transfers.forEach(x => lines.push(`• ${x.from} → ${x.to}: ${money(x.amount)} €`));
    }
    if (t.settlement.length > 0) {
      lines.push('');
      lines.push('📋 Dettaglio a testa:');
      t.settlement.forEach(s => {
        const stato = s.net > 0.005 ? `riceve ${money(s.net)} €` : s.net < -0.005 ? `deve dare ${money(-s.net)} €` : 'in pari';
        lines.push(`• ${s.name}: ${stato} (anticipato ${money(s.paid)} €, quota ${money(s.owed)} €)`);
      });
    }
    if (t.unattributed > 0.005) {
      lines.push('');
      lines.push(`⚠️ ${money(t.unattributed)} € di spese comuni senza acquirente.`);
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
      try {
        await navigator.share({
          title: 'Prato Lungo 2026 — Conti',
          text
        });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; /* altrimenti prova WhatsApp */
      }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  // ---------- Rimborsi saldati (barrati) ----------
  const toggleSettled = key => {
    setSettled(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // ---------- Aggiunta attrezzatura ----------
  const addEquip = () => {
    const text = newEquipText.trim();
    if (!text) return;
    setEquipment(prev => [...prev, {
      id: uid(),
      text,
      price: posNum(newEquipPrice),
      bought: false,
      buyer: newEquipBuyer.trim()
    }]);
    setNewEquipText('');
    setNewEquipPrice('');
    setNewEquipBuyer('');
  };
  const toggleEquipBought = id => {
    setEquipment(prev => prev.map(e => e.id === id ? {
      ...e,
      bought: !e.bought
    } : e));
  };
  const removeEquip = id => {
    const e = equipment.find(x => x.id === id);
    if (e && !window.confirm(`Eliminare "${e.text}" dall'attrezzatura?`)) return;
    setEquipment(prev => prev.filter(x => x.id !== id));
  };

  // ---------- Dotazioni aggiuntive ----------
  const addGear = () => {
    const text = newGearText.trim();
    if (!text) return;
    setGear(prev => [...prev, {
      id: uid(),
      text
    }]);
    setNewGearText('');
  };
  const removeGear = id => {
    const g = gear.find(x => x.id === id);
    if (g && !window.confirm(`Eliminare "${g.text}" dalle dotazioni?`)) return;
    setGear(prev => prev.filter(x => x.id !== id));
  };

  // ---------- Navigazione date ----------
  const changeWeek = days => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
    setSelectedDateStr(toDateStr(newDate));
  };
  const navigateDate = days => {
    const d = parseDate(selectedDateStr);
    d.setDate(d.getDate() + days);
    setSelectedDateStr(toDateStr(d));
    setCurrentDate(new Date(d));
  };
  const getDaysOfWeek = start => {
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

  // ---------- Calcolo ripartizione (coerente: somma quote = totale) ----------
  const calculateTotals = () => {
    // I totali di spesa sono generati dal taccuino (per tipologia).
    const sumByType = t => purchases.reduce((s, p) => p.type === t ? s + posNum(p.price) : s, 0);
    const totalFood = sumByType('alimentare');
    const totalDrinks = sumByType('bevande');
    // Logistica dagli acquisti (divisa fra tutti i presenti) e attrezzatura
    // acquistata (divisa solo fra chi NON è esente): due quote separate.
    const logisticsPurchases = sumByType('logistica');
    const equipBought = equipment.reduce((s, e) => e.bought ? s + posNum(e.price) : s, 0);
    const totalAccessory = logisticsPurchases + equipBought;
    const totalFoodDrinks = totalFood + totalDrinks;
    const overallTotal = totalFoodDrinks + totalAccessory;

    // Pasti per membro sull'intero campo.
    const mealsByMember = {};
    members.forEach(m => mealsByMember[m.id] = 0);
    let adultMealsTotal = 0;
    const attendingAdults = new Set();
    const attendingForEquip = new Set(); // presenti NON esenti da attrezzatura

    Object.values(campData).forEach(day => {
      const meals = day && day.meals || {};
      members.forEach(m => {
        const mm = meals[m.id];
        if (!mm) return;
        const count = (mm.lunch ? 1 : 0) + (mm.dinner ? 1 : 0);
        if (count === 0) return;
        mealsByMember[m.id] += count;
        if (!m.isChild) {
          adultMealsTotal += count;
          attendingAdults.add(m.id);
          if (!m.equipExempt) attendingForEquip.add(m.id);
        }
      });
    });

    // Cibo+bevande ripartiti sui pasti degli adulti (bambini = gratis).
    const costPerMeal = adultMealsTotal > 0 ? totalFoodDrinks / adultMealsTotal : 0;
    // Logistica: parti uguali tra tutti gli adulti presenti.
    const logisticsPerAdult = attendingAdults.size > 0 ? logisticsPurchases / attendingAdults.size : 0;
    // Attrezzatura: parti uguali tra i presenti non esenti. Se sono tutti
    // esenti, per non perdere la spesa si ripartisce su tutti i presenti.
    const equipDivisorSet = attendingForEquip.size > 0 ? attendingForEquip : attendingAdults;
    const equipPerAdult = equipDivisorSet.size > 0 ? equipBought / equipDivisorSet.size : 0;
    // Quota "accessori" media mostrata nel riepilogo.
    const accessoryPerAdult = logisticsPerAdult + equipPerAdult;

    // Quota dovuta da ciascun membro (valore esatto).
    const breakdown = members.map(m => {
      const mealCount = mealsByMember[m.id] || 0;
      const foodShare = m.isChild ? 0 : mealCount * costPerMeal;
      const present = !m.isChild && mealCount > 0;
      const logShare = (present ? logisticsPerAdult : 0) + (present && equipDivisorSet.has(m.id) ? equipPerAdult : 0);
      return {
        ...m,
        mealCount,
        foodShare,
        logShare,
        owed: foodShare + logShare
      };
    });

    // --- Arrotondamento "cassa-friendly" ---
    // Ogni quota viene arrotondata a multipli di 0,10 € (niente monetine da
    // 1/2/5 cent). Lo scarto rispetto al totale reale viene riconciliato SOLO
    // se è >= 0,50 €: sotto quella soglia si lascia com'è (non vale la pena).
    const round10 = cents => Math.round(cents / 10) * 10;
    breakdown.forEach(b => {
      b.payCents = b.isChild ? 0 : round10(Math.round(b.owed * 100));
    });
    const targetCents = Math.round(overallTotal * 100);
    let residual = targetCents - breakdown.reduce((s, b) => s + b.payCents, 0);
    if (Math.abs(residual) >= 50) {
      // Redistribuisce lo scarto a passi di 10 cent, partendo da chi deve di più.
      const order = breakdown.filter(b => !b.isChild && b.owed > 0).sort((a, b) => b.owed - a.owed);
      const step = residual > 0 ? 10 : -10;
      let guard = 0;
      let idx = 0;
      while (Math.abs(residual) >= 10 && order.length > 0 && guard < 100000) {
        const t = order[idx % order.length];
        if (!(step < 0 && t.payCents + step < 0)) {
          t.payCents += step;
          residual -= step;
        }
        idx++;
        guard++;
      }
    }
    breakdown.forEach(b => {
      b.pay = b.payCents / 100;
    });
    const collected = breakdown.reduce((s, b) => s + b.payCents, 0) / 100;
    const roundingDiff = collected - overallTotal;

    // Anticipi per acquirente: quanto ha speso ciascuno (per i rimborsi).
    const buyerMap = {};
    purchases.forEach(p => {
      const key = p.buyer && p.buyer.trim() ? p.buyer.trim() : '—';
      buyerMap[key] = (buyerMap[key] || 0) + posNum(p.price);
    });
    const byBuyer = Object.keys(buyerMap).map(name => ({
      name,
      total: buyerMap[name]
    })).sort((a, b) => b.total - a.total);

    // --- Saldo netto per persona (stile Splitwise): anticipato - dovuto ---
    const norm = s => (s || '').trim().toLowerCase();
    const paidByName = {}; // nome normalizzato -> { display, paid }
    purchases.forEach(p => {
      const raw = p.buyer && p.buyer.trim() ? p.buyer.trim() : '—';
      const key = norm(raw) || '—';
      if (!paidByName[key]) paidByName[key] = {
        display: raw,
        paid: 0
      };
      paidByName[key].paid += posNum(p.price);
    });
    // Attrezzatura acquistata: se ha un acquirente viene accreditata a lui
    // (verrà rimborsato); altrimenti è spesa comune ("non attribuita"). In
    // entrambi i casi la somma dei saldi resta zero.
    equipment.forEach(e => {
      if (!e.bought) return;
      const price = posNum(e.price);
      if (price <= 0) return;
      const raw = e.buyer && e.buyer.trim() ? e.buyer.trim() : '—';
      const key = norm(raw) || '—';
      if (!paidByName[key]) paidByName[key] = {
        display: raw,
        paid: 0
      };
      paidByName[key].paid += price;
    });
    const owedByName = {}; // nome membro normalizzato -> { display, owed }
    breakdown.forEach(b => {
      const key = norm(b.name);
      if (!owedByName[key]) owedByName[key] = {
        display: b.name,
        owed: 0
      };
      owedByName[key].owed += b.pay; // già arrotondato; bambini = 0
    });
    const unattributed = paidByName['—'] ? paidByName['—'].paid : 0;
    const allKeys = new Set([...Object.keys(paidByName), ...Object.keys(owedByName)]);
    allKeys.delete('—');
    const settlement = [];
    allKeys.forEach(k => {
      const paid = paidByName[k] ? paidByName[k].paid : 0;
      const owed = owedByName[k] ? owedByName[k].owed : 0;
      if (paid === 0 && owed === 0) return;
      const display = owedByName[k] && owedByName[k].display || paidByName[k] && paidByName[k].display || k;
      settlement.push({
        name: display,
        paid,
        owed,
        net: paid - owed
      });
    });
    settlement.sort((a, b) => b.net - a.net); // prima chi deve ricevere

    // Transazioni di pareggio: chi paga chi, col minor numero di giri.
    // Greedy sui centesimi: il debitore più grosso paga il creditore più grosso.
    const creditors = settlement.filter(s => s.net > 0.005).map(s => ({
      name: s.name,
      cents: Math.round(s.net * 100)
    }));
    const debtors = settlement.filter(s => s.net < -0.005).map(s => ({
      name: s.name,
      cents: Math.round(-s.net * 100)
    }));
    const transfers = [];
    let ci = 0,
      di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const amt = Math.min(creditors[ci].cents, debtors[di].cents);
      if (amt > 0) transfers.push({
        from: debtors[di].name,
        to: creditors[ci].name,
        amount: amt / 100
      });
      creditors[ci].cents -= amt;
      debtors[di].cents -= amt;
      if (creditors[ci].cents === 0) ci++;
      if (debtors[di].cents === 0) di++;
    }
    return {
      totalFood,
      totalDrinks,
      totalAccessory,
      totalFoodDrinks,
      overallTotal,
      costPerMeal,
      logisticsPerAdult,
      equipPerAdult,
      accessoryPerAdult,
      logisticsPurchases,
      equipBought,
      equipPayersCount: equipDivisorSet.size,
      adultMealsTotal,
      attendingAdultsCount: attendingAdults.size,
      breakdown,
      collected,
      roundingDiff,
      byBuyer,
      settlement,
      unattributed,
      transfers
    };
  };
  const totals = calculateTotals();

  // ---------- Backup (Export / Import) ----------
  const exportData = () => {
    const payload = {
      version: 6,
      exportedAt: new Date().toISOString(),
      members,
      campData,
      purchases,
      gear,
      settled,
      equipment,
      toBuy,
      receipts
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bandone-backup-${toDateStr(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importData = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!window.confirm('Importare questo backup? I dati attuali verranno sostituiti.')) return;
        if (Array.isArray(d.members)) setMembers(d.members);
        if (d.campData && typeof d.campData === 'object') setCampData(d.campData);
        if (Array.isArray(d.purchases)) setPurchases(d.purchases);
        if (Array.isArray(d.gear)) setGear(d.gear);
        if (Array.isArray(d.settled)) setSettled(d.settled);
        if (Array.isArray(d.equipment)) setEquipment(d.equipment);
        if (Array.isArray(d.toBuy)) setToBuy(d.toBuy);
        if (d.receipts && typeof d.receipts === 'object') setReceipts(d.receipts);
      } catch (err) {
        window.alert('File non valido: non è un backup leggibile.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---------- Render ----------
  if (showSplash) {
    return /*#__PURE__*/React.createElement("div", {
      onClick: () => setShowSplash(false),
      className: "fixed inset-0 bg-[#2D392C] flex flex-col items-center justify-center text-[#F0F4F1] z-50 cursor-pointer"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-56 h-56 mb-6 rounded-full overflow-hidden shadow-2xl flex items-center justify-center border-4 border-[#8F9E8B] bg-[#F0F4F1]"
    }, /*#__PURE__*/React.createElement("img", {
      src: "./logo.png",
      alt: `Logo ${BRAND.groupName}`,
      className: "w-full h-full object-cover"
    })), /*#__PURE__*/React.createElement("h1", {
      className: "font-rustic text-3xl tracking-widest text-[#8F9E8B]"
    }, BRAND.splashLine1), /*#__PURE__*/React.createElement("h2", {
      className: "font-rustic text-xl tracking-widest text-[#F0F4F1]"
    }, BRAND.splashLine2), /*#__PURE__*/React.createElement("p", {
      className: "mt-4 text-xs uppercase tracking-widest opacity-60"
    }, BRAND.splashTagline), /*#__PURE__*/React.createElement("p", {
      className: "absolute bottom-4 left-0 right-0 text-center text-[9px] tracking-wide text-[#8F9E8B]/70 px-6"
    }, BRAND.credits));
  }
  const tabs = {
    calendario: 'Calendario',
    membri: 'Membri',
    presenze: 'Presenze',
    spesa: 'Spese Totali',
    lista: 'Lista della Spesa',
    attrezzatura: 'Aggiunta Attrezzatura',
    regole: 'Regole',
    dotazioni: 'Dotazioni personali',
    guida: 'Come funziona'
  };
  const goTo = tab => {
    setActiveTab(tab);
    setMenuOpen(false);
  };

  // Guida: una "pill" per ogni area di lavoro.
  const GUIDE = [{
    k: 'calendario',
    icon: '📅',
    title: 'Calendario',
    body: 'Per ogni giorno vedi il meteo previsto di Pereto e il riepilogo cucina (quanti pasti preparare a pranzo e a cena). Sotto puoi scrivere note libere su menù, legna, ecc. Scorri le settimane con le frecce.'
  }, {
    k: 'membri',
    icon: '👥',
    title: 'Membri',
    body: 'Aggiungi tutte le persone del campo. Segna "Bambino" chi non paga i pasti (mangia gratis). L\'elenco serve alle presenze e ai conti.'
  }, {
    k: 'presenze',
    icon: '🍽️',
    title: 'Presenze',
    body: 'Per ogni giorno segna chi c\'è a pranzo e a cena. Usa "Tutti a pranzo/cena" per fare in fretta e poi togli gli assenti, oppure "Copia da ieri". Il conto dei pasti serve a calcolare la quota.'
  }, {
    k: 'lista',
    icon: '🧾',
    title: 'Lista della Spesa',
    body: 'Registra ogni acquisto: nome, chi l\'ha pagato, prezzo e tipologia (Alimentare/Bevande/Logistica). Puoi allegare la foto dello scontrino. Da qui si generano i totali.'
  }, {
    k: 'attrezzatura',
    icon: '🪛',
    title: 'Aggiunta Attrezzatura',
    body: 'Elenco dell\'attrezzatura da comprare con prezzo. Spunta una voce quando è acquistata: il suo costo entra nelle spese come logistica. Se metti l\'acquirente, verrà rimborsato.'
  }, {
    k: 'spesa',
    icon: '💶',
    title: 'Spese Totali',
    body: 'Quattro sezioni: Totali (quanto si è speso), Quote (quanto costa a testa), Saldi (chi deve dare/ricevere e "chi paga chi", con Condividi resoconto), Dati (backup e ripristino). Cibo diviso per i pasti, logistica in parti uguali.'
  }, {
    k: 'dotazioni',
    icon: '🎒',
    title: 'Dotazioni personali',
    body: 'La lista di cosa portarsi da casa: una parte fissa uguale per tutti e una parte aggiuntiva per questo campo che potete modificare.'
  }, {
    k: 'sync',
    icon: '☁️',
    title: 'Sincronizzazione',
    body: 'Con la linea i dati si allineano da soli tra i telefoni che usano lo stesso campo. Al campo, senza linea, si continua a lavorare: tutto si sincronizza appena torna la rete.'
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "max-w-md mx-auto min-h-screen flex flex-col bg-[#F0F4F1] border-x border-[#8F9E8B]/30 shadow-2xl pb-24"
  }, /*#__PURE__*/React.createElement("header", {
    className: "bg-[#2D392C] text-[#F0F4F1] p-4 text-center border-b-4 border-[#5C4A3C] relative"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setMenuOpen(o => !o),
    "aria-label": "Menu",
    "aria-expanded": menuOpen,
    className: "absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex flex-col items-center justify-center gap-[3px] rounded hover:bg-white/10"
  }, /*#__PURE__*/React.createElement("span", {
    className: "block w-5 h-0.5 bg-[#F0F4F1]"
  }), /*#__PURE__*/React.createElement("span", {
    className: "block w-5 h-0.5 bg-[#F0F4F1]"
  }), /*#__PURE__*/React.createElement("span", {
    className: "block w-5 h-0.5 bg-[#F0F4F1]"
  })), /*#__PURE__*/React.createElement("h1", {
    className: "font-rustic text-2xl tracking-wide"
  }, BRAND.appTitle), /*#__PURE__*/React.createElement("p", {
    className: "text-xs uppercase tracking-wider text-[#8F9E8B]"
  }, tabs[activeTab]), /*#__PURE__*/React.createElement("span", {
    title: isOnline ? 'Online' : 'Offline',
    className: `absolute top-3 right-3 flex items-center gap-1 text-[9px] uppercase font-bold ${isOnline ? 'text-[#8F9E8B]' : 'text-[#D97706]'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: `w-2 h-2 rounded-full ${isOnline ? 'bg-[#8F9E8B]' : 'bg-[#D97706]'}`
  }), isOnline ? 'Online' : 'Offline')), /*#__PURE__*/React.createElement("div", {
    className: `fixed inset-0 z-40 ${menuOpen ? '' : 'pointer-events-none'}`
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setMenuOpen(false),
    className: `absolute inset-0 bg-black/40 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'opacity-0'}`
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 max-w-md mx-auto overflow-hidden pointer-events-none"
  }, /*#__PURE__*/React.createElement("nav", {
    className: `pointer-events-auto absolute left-0 top-0 bottom-0 w-72 max-w-[80%] bg-[#F0F4F1] border-r-4 border-[#5C4A3C] shadow-2xl p-4 space-y-1 overflow-y-auto transition-transform duration-300 ease-out ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 border-b border-[#8F9E8B]/40 pb-3 mb-2"
  }, /*#__PURE__*/React.createElement("img", {
    src: "./logo.png",
    alt: "",
    className: "w-11 h-11 rounded-full object-cover border-2 border-[#8F9E8B] bg-white"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-rustic text-[#2D392C] leading-tight"
  }, BRAND.appTitle), /*#__PURE__*/React.createElement("div", {
    className: "text-[9px] uppercase tracking-wider text-[#8F9E8B]"
  }, BRAND.groupName))), Object.keys(tabs).map(tab => /*#__PURE__*/React.createElement("button", {
    key: tab,
    onClick: () => goTo(tab),
    className: `w-full text-left px-4 py-3 rounded font-bold uppercase text-sm tracking-wide transition-colors ${activeTab === tab ? 'bg-[#2D392C] text-[#F0F4F1]' : 'text-[#2D392C] hover:bg-[#E2EAE4]'}`
  }, tabs[tab]))))), showInstallHint && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/15 border-b border-[#D97706]/40 px-4 py-2.5 flex items-start gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base leading-none mt-0.5"
  }, "\uD83D\uDCF2"), /*#__PURE__*/React.createElement("p", {
    className: "flex-grow text-[11px] text-[#5C4A3C] leading-snug"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, isDesktop ? 'Installa l\'app sul computer:' : 'Installa l\'app sul telefono:'), ' ', isIOS ? 'tocca Condividi (il quadrato con la freccia in su) e poi "Aggiungi alla schermata Home".' : isDesktop ? 'clicca l\'icona di installazione nella barra degli indirizzi (o menu ⋮ → "Installa").' : 'apri il menu del browser (⋮) e tocca "Installa app" (o "Aggiungi a schermata Home").', ' ', "Una volta installata funziona anche senza linea."), /*#__PURE__*/React.createElement("button", {
    onClick: dismissInstallHint,
    "aria-label": "Chiudi avviso",
    className: "text-[#5C4A3C] font-bold px-1 shrink-0"
  }, "\xD7")), /*#__PURE__*/React.createElement("main", {
    className: "flex-grow p-4"
  }, activeTab === 'calendario' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => changeWeek(-7),
    className: "p-2 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40"
  }, "\u2190"), /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-sm text-[#2D392C] uppercase font-rustic"
  }, "Settimana Selezionata"), /*#__PURE__*/React.createElement("button", {
    onClick: () => changeWeek(7),
    className: "p-2 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40"
  }, "\u2192")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-7 gap-1"
  }, weekDays.map(d => {
    const dateStr = toDateStr(d);
    const isSelected = dateStr === selectedDateStr;
    const isCampPeriod = dateStr >= CAMP_START && dateStr <= CAMP_END;
    const label = d.toLocaleDateString('it-IT', {
      weekday: 'short'
    });
    return /*#__PURE__*/React.createElement("button", {
      key: dateStr,
      onClick: () => {
        setSelectedDateStr(dateStr);
        setCurrentDate(new Date(d));
      },
      className: `p-2 flex flex-col items-center rounded-lg border transition-all ${isSelected ? 'bg-[#5C4A3C] text-white border-[#5C4A3C]' : isCampPeriod ? 'bg-[#2D392C]/10 text-[#2D392C] border-[#2D392C]' : 'bg-white text-gray-400 border-gray-200'}`
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] uppercase font-bold"
    }, label), /*#__PURE__*/React.createElement("span", {
      className: "text-lg font-bold font-rustic"
    }, d.getDate()), isCampPeriod && /*#__PURE__*/React.createElement("span", {
      className: "w-1.5 h-1.5 bg-[#D97706] rounded-full mt-0.5"
    }));
  })), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-dashed border-[#8F9E8B] pb-1"
  }, "Note del ", parseDate(selectedDateStr).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long'
  })), (() => {
    const loc = window.CAMP_LOCATION;
    const locOk = loc && typeof loc.lat === 'number' && typeof loc.lon === 'number';
    const wx = weather.byDate[selectedDateStr];
    return /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20"
    }, !locOk ? /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] text-gray-400 italic"
    }, "Meteo: localit\xE0 del campo da impostare.") : wx ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "text-2xl leading-none"
    }, wmoInfo(wx.code).icon), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-sm font-bold text-[#2D392C]"
    }, wmoInfo(wx.code).label), loc.label && /*#__PURE__*/React.createElement("span", {
      className: "text-[9px] text-gray-400"
    }, loc.label)), /*#__PURE__*/React.createElement("span", {
      className: "ml-auto text-xs text-gray-600 font-bold"
    }, Math.round(wx.tmax), "\xB0 / ", Math.round(wx.tmin), "\xB0", wx.rain != null ? /*#__PURE__*/React.createElement("span", {
      className: "text-[#5C8AA8]"
    }, " \xB7 \uD83D\uDCA7", wx.rain, "%") : null)) : /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] text-gray-400 italic"
    }, "Previsione non ancora disponibile per questo giorno", isOnline ? ' (copre ~16 giorni in avanti)' : ' (offline)', "."));
  })(), (() => {
    const lunch = members.filter(m => getMeal(selectedDateStr, m.id).lunch).length;
    const dinner = members.filter(m => getMeal(selectedDateStr, m.id).dinner).length;
    return /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 bg-[#2D392C]/5 px-3 py-2 rounded border border-[#2D392C]/15"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-xl leading-none"
    }, "\uD83C\uDF72"), /*#__PURE__*/React.createElement("span", {
      className: "text-[11px] uppercase font-bold text-gray-500"
    }, "Cucina"), /*#__PURE__*/React.createElement("span", {
      className: "ml-auto text-sm font-bold text-[#2D392C]"
    }, lunch, " ", /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] font-normal text-gray-500"
    }, "a pranzo"), /*#__PURE__*/React.createElement("span", {
      className: "text-gray-300"
    }, " \xB7 "), dinner, " ", /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] font-normal text-gray-500"
    }, "a cena")));
  })(), /*#__PURE__*/React.createElement("textarea", {
    value: getDayData(selectedDateStr).note,
    onChange: e => updateDayData(selectedDateStr, 'note', e.target.value),
    placeholder: "Inserisci note sul menu, meteo o legna per oggi...",
    className: "w-full h-32 p-3 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded-lg text-sm focus:outline-none focus:border-[#2D392C] resize-none"
  }))), activeTab === 'membri' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Aggiungi Membro"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newMemberName,
    onChange: e => setNewMemberName(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addMember(),
    placeholder: "Nome e cognome",
    className: "flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addMember,
    className: "px-4 bg-[#2D392C] text-white rounded font-bold text-sm hover:bg-[#1F271E]"
  }, "+")), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-2 text-xs text-gray-600"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: newMemberChild,
    onChange: e => setNewMemberChild(e.target.checked)
  }), "Bambino (pasti gratis)")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
  }, "Membri (", members.length, ")"), members.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Nessun membro. Aggiungine uno per iniziare a segnare le presenze.") : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, members.map(m => /*#__PURE__*/React.createElement("li", {
    key: m.id,
    className: "bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-sm text-[#2D392C] truncate"
  }, m.name), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => toggleChild(m.id),
    className: `text-[9px] uppercase font-bold px-2 py-1 rounded ${m.isChild ? 'bg-[#D97706] text-white' : 'bg-gray-200 text-gray-500'}`
  }, m.isChild ? 'Bambino' : 'Adulto'), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeMember(m.id),
    className: "text-red-700 font-bold px-2 hover:text-red-900"
  }, "\xD7"))), /*#__PURE__*/React.createElement("button", {
    onClick: () => toggleEquipExempt(m.id),
    "aria-label": "Esenzione attrezzatura",
    className: "mt-1.5 flex items-center gap-2 text-left"
  }, /*#__PURE__*/React.createElement("span", {
    className: `w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-[10px] font-bold ${m.equipExempt ? 'bg-[#5C4A3C] border-[#5C4A3C] text-white' : 'bg-white border-[#8F9E8B]'}`
  }, m.equipExempt ? '✓' : ''), /*#__PURE__*/React.createElement("span", {
    className: `text-[10px] ${m.equipExempt ? 'font-bold text-[#5C4A3C]' : 'text-gray-500'}`
  }, "Esente attrezzatura"))))))), activeTab === 'presenze' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => navigateDate(-1),
    className: "px-3 py-1 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40"
  }, "\u2190"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: selectedDateStr,
    onChange: e => {
      if (e.target.value) {
        setSelectedDateStr(e.target.value);
        setCurrentDate(parseDate(e.target.value));
      }
    },
    className: "bg-transparent border-none text-sm focus:outline-none font-bold text-center w-full mx-2 text-[#5C4A3C]"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => navigateDate(1),
    className: "px-3 py-1 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40"
  }, "\u2192")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Presenze del ", parseDate(selectedDateStr).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long'
  })), members.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Aggiungi prima i membri nella scheda \"Membri\".") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setAllMeals(selectedDateStr, 'lunch'),
    className: "py-2.5 bg-[#2D392C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#1F271E]"
  }, "Tutti a pranzo"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAllMeals(selectedDateStr, 'dinner'),
    className: "py-2.5 bg-[#5C4A3C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#463628]"
  }, "Tutti a cena"), /*#__PURE__*/React.createElement("button", {
    onClick: copyFromPreviousDay,
    className: "py-2.5 bg-white border-2 border-[#8F9E8B]/50 text-[#2D392C] rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#E2EAE4]"
  }, "Copia da ieri")), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 -mt-1"
  }, "Segna tutti, poi togli i pochi assenti. Se sono gi\xE0 tutti segnati, il bottone li toglie tutti.", ' ', /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-[#5C4A3C]"
  }, "Oggi: ", members.filter(m => getMeal(selectedDateStr, m.id).lunch).length, " a pranzo \xB7 ", members.filter(m => getMeal(selectedDateStr, m.id).dinner).length, " a cena")), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, members.map(m => {
    const meal = getMeal(selectedDateStr, m.id);
    return /*#__PURE__*/React.createElement("li", {
      key: m.id,
      className: "flex items-center justify-between gap-2 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/20"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-sm font-bold text-[#2D392C] truncate flex items-center gap-1"
    }, m.name, m.isChild && /*#__PURE__*/React.createElement("span", {
      className: "text-[8px] uppercase bg-[#D97706] text-white px-1 rounded"
    }, "gratis")), /*#__PURE__*/React.createElement("div", {
      className: "flex gap-1.5 shrink-0"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleMeal(selectedDateStr, m.id, 'lunch'),
      className: `text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border ${meal.lunch ? 'bg-[#2D392C] text-white border-[#2D392C]' : 'bg-white text-gray-400 border-gray-300'}`
    }, "Pranzo"), /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleMeal(selectedDateStr, m.id, 'dinner'),
      className: `text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border ${meal.dinner ? 'bg-[#5C4A3C] text-white border-[#5C4A3C]' : 'bg-white text-gray-400 border-gray-300'}`
    }, "Cena")));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-2"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "font-rustic text-sm text-[#5C4A3C]"
  }, "Note / Ospiti del giorno"), /*#__PURE__*/React.createElement("textarea", {
    value: getDayData(selectedDateStr).guestsNames,
    onChange: e => updateDayData(selectedDateStr, 'guestsNames', e.target.value),
    placeholder: "Ospiti occasionali o note sulle presenze...",
    className: "w-full h-20 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C] resize-none"
  }))), activeTab === 'spesa' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-4 gap-1.5"
  }, [['totali', 'Totali'], ['quote', 'Quote'], ['saldi', 'Saldi'], ['dati', 'Dati']].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setSpesaSection(k),
    className: `py-2.5 rounded text-[10px] font-bold uppercase tracking-wide border-b-4 transition-all ${spesaSection === k ? 'bg-[#2D392C] text-white border-[#5C4A3C]' : 'bg-white text-[#2D392C] border-gray-300 hover:bg-[#E2EAE4]'}`
  }, l))), spesaSection === 'totali' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Cassa Globale Campo"), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500 -mt-1"
  }, "Totali generati automaticamente dalla ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Lista della Spesa"), " e dall'", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Attrezzatura"), " acquistata."), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, [['Spesa Cibo (Alimentare)', totals.totalFood], ['Spesa Bevande', totals.totalDrinks], ['Logistica', totals.logisticsPurchases], ['Attrezzatura acquistata', totals.equipBought]].map(([label, val]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    className: "flex justify-between items-center bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] uppercase font-bold text-gray-500"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-[#2D392C]"
  }, money(val), " \u20AC")))), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#2D392C]/10 p-3 rounded border border-[#2D392C]/20 flex justify-between items-center mt-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-xs uppercase"
  }, "Importo Complessivo:"), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-lg text-[#2D392C]"
  }, money(totals.overallTotal), " \u20AC"))), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md space-y-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-1"
  }, "Il Conto della Serva"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] uppercase text-[#8F9E8B] block"
  }, "Quota Singolo Pasto"), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic text-xl text-[#D97706]"
  }, money(totals.costPerMeal), " \u20AC"), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 mt-1"
  }, "Cibo+bevande (", money(totals.totalFoodDrinks), " \u20AC) / ", totals.adultMealsTotal, " pasti adulti.")), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] uppercase text-[#8F9E8B] block"
  }, "Logistica a testa"), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic text-xl text-[#D97706]"
  }, money(totals.logisticsPerAdult), " \u20AC"), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 mt-1"
  }, "Logistica (", money(totals.logisticsPurchases), " \u20AC) / ", totals.attendingAdultsCount, " adulti presenti.")), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20 col-span-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] uppercase text-[#8F9E8B] block"
  }, "Attrezzatura a testa"), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic text-xl text-[#D97706]"
  }, money(totals.equipPerAdult), " \u20AC"), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 mt-1"
  }, "Attrezzatura (", money(totals.equipBought), " \u20AC) / ", totals.equipPayersCount, " ", totals.equipPayersCount === 1 ? 'persona non esente' : 'persone non esenti', "."))), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic"
  }, "I pasti dei bambini sono gratis: il loro costo \xE8 ripartito sugli adulti."))), spesaSection === 'quote' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
  }, "Quanto deve ciascuno"), totals.breakdown.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Aggiungi membri e segna le presenze per vedere la ripartizione.") : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-[#8F9E8B]/20"
  }, totals.breakdown.map(b => /*#__PURE__*/React.createElement("li", {
    key: b.id,
    className: "flex items-center justify-between py-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-bold text-[#2D392C]"
  }, b.name), /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] text-gray-500"
  }, b.mealCount, " ", b.mealCount === 1 ? 'pasto' : 'pasti', b.isChild ? ' · bambino' : '')), /*#__PURE__*/React.createElement("span", {
    className: `font-rustic font-bold ${b.isChild ? 'text-gray-400' : 'text-[#2D392C]'}`
  }, b.isChild ? 'Gratis' : `${money(b.pay)} €`)))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center pt-2 mt-1 border-t border-[#8F9E8B]/30"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[11px] uppercase font-bold text-gray-500"
  }, "Totale raccolto"), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C]"
  }, money(totals.collected), " \u20AC")), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic mt-2"
  }, "Quote arrotondate a 0,10 \u20AC (niente monetine da 1/2/5 cent).", Math.abs(totals.roundingDiff) >= 0.005 ? ` Scarto rispetto al totale: ${totals.roundingDiff > 0 ? '+' : ''}${money(totals.roundingDiff)} € (sotto 0,50 €, non riconciliato).` : ' Nessuno scarto.')))), spesaSection === 'saldi' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
  }, "Anticipi per acquirente"), totals.byBuyer.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Registra gli acquisti nel Taccuino per vedere chi ha anticipato quanto.") : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-[#8F9E8B]/20"
  }, totals.byBuyer.map(b => /*#__PURE__*/React.createElement("li", {
    key: b.name,
    className: "flex items-center justify-between py-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: `text-sm font-bold ${b.name === '—' ? 'text-gray-400 italic' : 'text-[#2D392C]'}`
  }, b.name === '—' ? 'Non indicato' : b.name), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C]"
  }, money(b.total), " \u20AC")))), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic mt-2"
  }, "Quanto ha anticipato ciascuno (utile per i rimborsi)."))), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 mb-3"
  }, "Saldo finale"), totals.settlement.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Registra acquisti (con acquirente) e presenze per vedere chi deve dare o ricevere.") : /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-[#8F9E8B]/20"
  }, totals.settlement.map(s => {
    const credito = s.net > 0.005;
    const debito = s.net < -0.005;
    return /*#__PURE__*/React.createElement("li", {
      key: s.name,
      className: "flex items-center justify-between py-2 gap-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col min-w-0"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-sm font-bold truncate"
    }, s.name), /*#__PURE__*/React.createElement("span", {
      className: "text-[9px] text-[#8F9E8B]"
    }, "ha anticipato ", money(s.paid), " \u20AC \xB7 deve ", money(s.owed), " \u20AC")), /*#__PURE__*/React.createElement("span", {
      className: `font-rustic font-bold text-sm shrink-0 text-right ${credito ? 'text-[#8FBF8F]' : debito ? 'text-[#D97706]' : 'text-gray-400'}`
    }, credito ? `riceve ${money(s.net)} €` : debito ? `dà ${money(-s.net)} €` : 'in pari'));
  })), totals.transfers.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-3 pt-3 border-t border-[#8F9E8B]/30"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "font-rustic text-sm text-[#8F9E8B] mb-1"
  }, "Chi paga chi"), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 mb-2"
  }, "Tocca una riga quando il rimborso \xE8 stato fatto: resta barrata. Tocca di nuovo per annullare."), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-1.5"
  }, totals.transfers.map((t, i) => {
    const key = `${t.from}→${t.to}@${Math.round(t.amount * 100)}`;
    const paid = settled.includes(key);
    return /*#__PURE__*/React.createElement("li", {
      key: key + i,
      onClick: () => toggleSettled(key),
      className: `cursor-pointer select-none flex items-center justify-between bg-[#1F271E] px-3 py-2 rounded border transition-opacity ${paid ? 'border-[#8FBF8F]/40 opacity-60' : 'border-[#8F9E8B]/20'}`
    }, /*#__PURE__*/React.createElement("span", {
      className: `text-xs ${paid ? 'line-through text-gray-400' : ''}`
    }, /*#__PURE__*/React.createElement("span", {
      className: "font-bold"
    }, t.from), /*#__PURE__*/React.createElement("span", {
      className: "text-[#8F9E8B]"
    }, " \u2192 "), /*#__PURE__*/React.createElement("span", {
      className: "font-bold"
    }, t.to)), /*#__PURE__*/React.createElement("span", {
      className: "flex items-center gap-1.5"
    }, /*#__PURE__*/React.createElement("span", {
      className: `font-rustic font-bold ${paid ? 'line-through text-gray-400' : 'text-[#D97706]'}`
    }, money(t.amount), " \u20AC"), paid && /*#__PURE__*/React.createElement("span", {
      className: "text-[#8FBF8F] text-sm font-bold"
    }, "\u2713")));
  }))), totals.unattributed > 0.005 && /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-[#D97706] italic mt-2"
  }, "Attenzione: ", money(totals.unattributed), " \u20AC di acquisti sono senza acquirente. Assegna un acquirente nel Taccuino per far quadrare i conti."), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic mt-1"
  }, "\"Riceve\" = ha anticipato pi\xF9 di quanto deve; \"d\xE0\" = deve versare la differenza.")), /*#__PURE__*/React.createElement("button", {
    onClick: shareReport,
    className: "w-full py-3 bg-[#25D366] text-white rounded font-bold uppercase text-sm tracking-wide hover:brightness-95 flex items-center justify-center gap-2"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCE4"), " Condividi resoconto"), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic text-center"
  }, "Genera un messaggio pronto con totale e \"chi paga chi\" da mandare nel gruppo.")), spesaSection === 'dati' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Backup Dati"), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500"
  }, "Ogni giorno viene salvata da sola una copia di sicurezza nel cloud. Esporta/Importa serve per un backup manuale su file."), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: exportData,
    className: "flex-1 py-2.5 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]"
  }, "Esporta"), /*#__PURE__*/React.createElement("label", {
    className: "flex-1 py-2.5 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase text-center cursor-pointer hover:bg-[#463628]"
  }, "Importa", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "application/json,.json",
    onChange: importData,
    className: "hidden"
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: openRestore,
    className: "w-full py-2.5 bg-white border-2 border-[#D97706]/50 text-[#D97706] rounded text-xs font-bold uppercase hover:bg-[#D97706]/10"
  }, "Ripristino di emergenza")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C]"
  }, "Sincronizzazione Cloud"), /*#__PURE__*/React.createElement("span", {
    className: `text-[9px] uppercase font-bold px-2 py-1 rounded ${cloud.connected ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`
  }, cloud.connected ? 'Connesso' : 'Non connesso')), !(window.CloudSync && window.CloudSync.isConfigured()) ? /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500 italic"
  }, "Firebase non configurato. Incolla la config del tuo progetto in ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "firebase-config.js"), " per abilitare la sincronizzazione online tra dispositivi.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500"
  }, "La sincronizzazione si attiva da sola all'avvio quando c'\xE8 linea. Offline si continua a lavorare in locale. Premi Disconnetti solo se vuoi lavorare senza condividere i dati."), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: campCodeInput,
    onChange: e => setCampCodeInput(e.target.value),
    placeholder: "Codice campo",
    disabled: cloud.connected,
    className: "flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C] disabled:opacity-60"
  }), cloud.connected ? /*#__PURE__*/React.createElement("button", {
    onClick: disconnectCloud,
    className: "px-4 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase hover:bg-[#463628]"
  }, "Disconnetti") : /*#__PURE__*/React.createElement("button", {
    onClick: () => connectCloud(campCodeInput),
    className: "px-4 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]"
  }, "Connetti")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between text-[10px] text-gray-500"
  }, /*#__PURE__*/React.createElement("span", null, cloud.status === 'connecting' && 'Connessione in corso…', cloud.status === 'saving' && 'Salvataggio…', cloud.status === 'connected' && (cloud.lastSync ? `Ultima sync: ${new Date(cloud.lastSync).toLocaleTimeString('it-IT')}` : 'In ascolto…'), cloud.status === 'error' && /*#__PURE__*/React.createElement("span", {
    className: "text-red-700"
  }, "Errore: ", cloud.error), cloud.status === 'idle' && (localStorage.getItem('cambusa_sync_optout') === '1' ? 'Sincronizzazione disattivata: premi Connetti per riattivarla.' : 'In attesa di connessione automatica…')), !isOnline && /*#__PURE__*/React.createElement("span", {
    className: "text-[#D97706] font-bold"
  }, "offline")))))), activeTab === 'lista' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#5C4A3C]/30 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C]"
  }, "Da Acquistare"), toBuy.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "text-[10px] uppercase font-bold text-gray-500"
  }, toBuy.length, " ", toBuy.length === 1 ? 'voce' : 'voci')), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newBuyName,
    onChange: e => setNewBuyName(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addToBuy(),
    placeholder: "Cosa serve\u2026",
    className: "flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newBuyQty,
    onChange: e => setNewBuyQty(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addToBuy(),
    placeholder: "Q.t\xE0",
    className: "w-20 shrink-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm text-center focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addToBuy,
    "aria-label": "Aggiungi alla lista",
    className: "shrink-0 px-3 bg-[#2D392C] text-white rounded font-bold text-lg leading-none hover:bg-[#1F271E]"
  }, "+")), toBuy.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Lista vuota. Scrivi cosa serve e premi +.") : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, toBuy.map(it => /*#__PURE__*/React.createElement("li", {
    key: it.id,
    className: "bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-grow min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-bold text-[#2D392C] truncate"
  }, it.name), it.qty && /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-gray-500"
  }, "Quantit\xE0: ", it.qty)), receipts[it.id] ? /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewReceipt(receipts[it.id]),
    "aria-label": "Vedi scontrino",
    className: "shrink-0 px-2 py-1.5 rounded border-2 border-[#2D392C] bg-[#2D392C] text-white leading-none"
  }, "\uD83D\uDCF7") : /*#__PURE__*/React.createElement("label", {
    title: "Foto scontrino",
    "aria-label": "Allega scontrino",
    className: "shrink-0 cursor-pointer px-2 py-1.5 rounded border-2 border-[#8F9E8B]/50 bg-white leading-none hover:bg-[#E2EAE4]"
  }, "\uD83D\uDCF7", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    capture: "environment",
    onChange: e => onToBuyReceipt(e, it.id),
    className: "hidden"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeToBuy(it.id),
    "aria-label": "Rimuovi",
    className: "shrink-0 text-red-700 font-bold px-1.5 hover:text-red-900"
  }, "\xD7")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setBuying({
      id: it.id,
      name: it.name,
      qty: it.qty,
      price: '',
      buyer: '',
      type: 'alimentare'
    }),
    className: "mt-2 w-full py-2 bg-[#5C4A3C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#463628]"
  }, "Segna come acquistata")))), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic"
  }, "Quando una voce viene acquistata passa nella cronologia qui sotto, con prezzo e acquirente.")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Prodotto acquistato"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Nome"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: pName,
    onChange: e => setPName(e.target.value),
    placeholder: "Es. Pasta, Acqua, Piatti\u2026",
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Acquirente"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    list: "acquirenti",
    value: pBuyer,
    onChange: e => setPBuyer(e.target.value),
    placeholder: "Chi ha acquistato",
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("datalist", {
    id: "acquirenti"
  }, members.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.id,
    value: m.name
  })))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Prezzo (\u20AC)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    step: "0.01",
    inputMode: "decimal",
    value: pPrice,
    onChange: e => setPPrice(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addPurchase(),
    placeholder: "0.00",
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Tipologia"), /*#__PURE__*/React.createElement("select", {
    value: pType,
    onChange: e => setPType(e.target.value),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold focus:outline-none focus:border-[#2D392C]"
  }, Object.keys(PURCHASE_TYPES).map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, PURCHASE_TYPES[k]))))), /*#__PURE__*/React.createElement("button", {
    onClick: addPurchase,
    className: "w-full py-3 bg-[#2D392C] text-white rounded font-bold uppercase text-sm tracking-wide hover:bg-[#1F271E]"
  }, "Salva")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C]"
  }, "Cronologia acquisti"), purchases.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C]"
  }, money(totals.overallTotal), " \u20AC")), purchases.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Nessun acquisto registrato. Compila il form qui sopra e premi Salva.") : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, purchases.slice().reverse().map(p => /*#__PURE__*/React.createElement("li", {
    key: p.id,
    className: "flex items-center gap-2 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-grow min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-bold text-[#2D392C] truncate"
  }, p.name), /*#__PURE__*/React.createElement("span", {
    className: "text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#8F9E8B] shrink-0"
  }, PURCHASE_TYPES[p.type] || p.type), p.fromList && /*#__PURE__*/React.createElement("span", {
    className: "text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#5C4A3C] shrink-0"
  }, "acquistata")), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] text-gray-400"
  }, p.buyer ? /*#__PURE__*/React.createElement("span", {
    className: "text-[#5C4A3C] font-bold"
  }, p.buyer) : /*#__PURE__*/React.createElement("span", {
    className: "italic"
  }, "acquirente non indicato"), p.at && ` · ${new Date(p.at).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short'
  })} ${new Date(p.at).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  })}`)), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C] shrink-0"
  }, money(posNum(p.price)), " \u20AC"), receipts[p.id] && /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewReceipt(receipts[p.id]),
    "aria-label": "Vedi scontrino",
    className: "px-1 shrink-0 hover:opacity-70"
  }, "\uD83D\uDCF7"), /*#__PURE__*/React.createElement("button", {
    onClick: () => removePurchase(p.id),
    "aria-label": "Rimuovi",
    className: "text-red-700 font-bold px-1.5 hover:text-red-900 shrink-0"
  }, "\xD7")))), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic mt-2"
  }, "Le foto degli scontrini si sincronizzano tra i dispositivi connessi al campo (e sono incluse nel backup Esporta)."))), activeTab === 'attrezzatura' && (() => {
    const equipBoughtTotal = equipment.reduce((s, e) => e.bought ? s + posNum(e.price) : s, 0);
    const equipPlannedTotal = equipment.reduce((s, e) => s + posNum(e.price), 0);
    return /*#__PURE__*/React.createElement("div", {
      className: "space-y-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
    }, /*#__PURE__*/React.createElement("h3", {
      className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
    }, "Aggiungi attrezzatura"), /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: newEquipText,
      onChange: e => setNewEquipText(e.target.value),
      placeholder: "Es. Corda, gazebo, tanica\u2026",
      className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
    }), /*#__PURE__*/React.createElement("input", {
      type: "text",
      list: "acquirenti-attrezzatura",
      value: newEquipBuyer,
      onChange: e => setNewEquipBuyer(e.target.value),
      placeholder: "Acquirente (facoltativo)",
      className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
    }), /*#__PURE__*/React.createElement("datalist", {
      id: "acquirenti-attrezzatura"
    }, members.map(m => /*#__PURE__*/React.createElement("option", {
      key: m.id,
      value: m.name
    }))), /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2"
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "0",
      step: "0.01",
      inputMode: "decimal",
      value: newEquipPrice,
      onChange: e => setNewEquipPrice(e.target.value),
      onKeyDown: e => e.key === 'Enter' && addEquip(),
      placeholder: "Prezzo (\u20AC)",
      className: "flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
    }), /*#__PURE__*/React.createElement("button", {
      onClick: addEquip,
      className: "shrink-0 px-3 bg-[#2D392C] text-white rounded font-bold uppercase text-xs hover:bg-[#1F271E]"
    }, "Aggiungi")), /*#__PURE__*/React.createElement("p", {
      className: "text-[9px] text-gray-400"
    }, "Spunta una voce quando l'hai acquistata: il suo prezzo entra nelle Spese Totali (come logistica).")), /*#__PURE__*/React.createElement("div", {
      className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3"
    }, /*#__PURE__*/React.createElement("h3", {
      className: "font-rustic text-lg text-[#2D392C]"
    }, "Attrezzatura"), equipment.length > 0 && /*#__PURE__*/React.createElement("span", {
      className: "text-[10px] uppercase font-bold text-gray-500"
    }, equipment.filter(e => !e.bought).length, " da comprare")), equipment.length === 0 ? /*#__PURE__*/React.createElement("p", {
      className: "text-sm text-gray-400 italic"
    }, "Nessuna attrezzatura. Aggiungi la prima voce qui sopra.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("ul", {
      className: "space-y-2"
    }, equipment.map(e => /*#__PURE__*/React.createElement("li", {
      key: e.id,
      className: "flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleEquipBought(e.id),
      "aria-label": e.bought ? 'Segna da comprare' : 'Segna acquistato',
      className: `w-6 h-6 shrink-0 rounded border-2 flex items-center justify-center font-bold ${e.bought ? 'bg-[#2D392C] border-[#2D392C] text-white' : 'bg-white border-[#8F9E8B]'}`
    }, e.bought ? '✓' : ''), /*#__PURE__*/React.createElement("div", {
      className: "flex-grow min-w-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: `text-sm truncate ${e.bought ? 'line-through text-gray-400' : 'text-[#2D392C]'}`
    }, e.text), e.buyer && /*#__PURE__*/React.createElement("div", {
      className: "text-[9px] text-[#5C4A3C] font-bold truncate"
    }, e.buyer)), /*#__PURE__*/React.createElement("span", {
      className: `font-rustic font-bold shrink-0 ${e.bought ? 'text-[#2D392C]' : 'text-gray-400'}`
    }, money(posNum(e.price)), " \u20AC"), /*#__PURE__*/React.createElement("button", {
      onClick: () => removeEquip(e.id),
      "aria-label": "Rimuovi",
      className: "text-red-700 font-bold px-1.5 hover:text-red-900 shrink-0"
    }, "\xD7")))), /*#__PURE__*/React.createElement("div", {
      className: "mt-3 pt-2 border-t border-[#8F9E8B]/30 space-y-1"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex justify-between text-[11px] text-gray-500"
    }, /*#__PURE__*/React.createElement("span", {
      className: "uppercase font-bold"
    }, "Previsto (tutto)"), /*#__PURE__*/React.createElement("span", {
      className: "font-bold"
    }, money(equipPlannedTotal), " \u20AC")), /*#__PURE__*/React.createElement("div", {
      className: "flex justify-between items-center"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-[11px] uppercase font-bold text-[#2D392C]"
    }, "Acquistato (nelle spese)"), /*#__PURE__*/React.createElement("span", {
      className: "font-rustic font-bold text-[#2D392C]"
    }, money(equipBoughtTotal), " \u20AC"))))));
  })(), activeTab === 'regole' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-6 rounded-lg border-2 border-[#2D392C]/20 shadow-sm text-center"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C] mb-2"
  }, "Regole"), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Work in progress"))), activeTab === 'dotazioni' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
  }, "Dotazione base"), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, BASE_GEAR.map(item => /*#__PURE__*/React.createElement("li", {
    key: item,
    className: "flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 bg-[#D97706] rounded-full shrink-0"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-[#2D392C]"
  }, item)))), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic mt-2"
  }, "Dotazione obbligatoria per ogni partecipante.")), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Aggiunte per questo campo"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newGearText,
    onChange: e => setNewGearText(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addGear(),
    placeholder: "Es. costume, torcia frontale\u2026",
    className: "flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addGear,
    "aria-label": "Aggiungi dotazione",
    className: "px-4 bg-[#2D392C] text-white rounded font-bold text-lg leading-none hover:bg-[#1F271E]"
  }, "+")), gear.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Nessuna aggiunta. Inserisci qui le dotazioni extra per questo campo.") : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, gear.map(g => /*#__PURE__*/React.createElement("li", {
    key: g.id,
    className: "flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 bg-[#8F9E8B] rounded-full shrink-0"
  }), /*#__PURE__*/React.createElement("span", {
    className: "flex-grow text-sm text-[#2D392C]"
  }, g.text), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeGear(g.id),
    "aria-label": "Rimuovi",
    className: "text-red-700 font-bold px-2 hover:text-red-900"
  }, "\xD7")))))), activeTab === 'guida' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-1"
  }, "Come funziona l'app"), /*#__PURE__*/React.createElement("p", {
    className: "text-[11px] text-gray-500 mb-3"
  }, "Tocca un'area per vedere a cosa serve. In sintesi: segni presenze e spese, l'app calcola quanto deve ciascuno e chi rimborsa chi."), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5"
  }, GUIDE.map(g => /*#__PURE__*/React.createElement("button", {
    key: g.k,
    onClick: () => setGuideOpen(g.k),
    className: `px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${guideOpen === g.k ? 'bg-[#2D392C] text-white' : 'bg-[#F0F4F1] text-[#2D392C] border border-[#8F9E8B]/40 hover:bg-[#E2EAE4]'}`
  }, g.icon, " ", g.title))), (() => {
    const g = GUIDE.find(x => x.k === guideOpen) || GUIDE[0];
    return /*#__PURE__*/React.createElement("div", {
      className: "mt-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 mb-1"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-lg leading-none"
    }, g.icon), /*#__PURE__*/React.createElement("span", {
      className: "font-rustic text-[#2D392C]"
    }, g.title)), /*#__PURE__*/React.createElement("p", {
      className: "text-xs text-[#2D392C] leading-relaxed"
    }, g.body));
  })()), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "font-rustic text-base mb-2"
  }, "In tre passi"), /*#__PURE__*/React.createElement("ol", {
    className: "text-xs space-y-1.5 list-decimal list-inside text-[#F0F4F1]/90"
  }, /*#__PURE__*/React.createElement("li", null, "In ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Membri"), " aggiungi le persone."), /*#__PURE__*/React.createElement("li", null, "Ogni giorno segna le ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Presenze"), " e registra le spese nella ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Lista della Spesa"), "."), /*#__PURE__*/React.createElement("li", null, "In ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Spese Totali \u2192 Saldi"), " vedi chi deve dare o ricevere, e con ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Condividi resoconto"), " lo mandi nel gruppo."))))), buying && /*#__PURE__*/React.createElement("div", {
    onClick: () => setBuying(null),
    className: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "bg-white rounded-lg p-4 w-full max-w-xs space-y-3 shadow-2xl"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2"
  }, "Acquistata: ", buying.name, buying.qty ? ` (${buying.qty})` : ''), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Prezzo (\u20AC)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    step: "0.01",
    inputMode: "decimal",
    autoFocus: true,
    value: buying.price,
    onChange: e => setBuying(b => ({
      ...b,
      price: e.target.value
    })),
    onKeyDown: e => e.key === 'Enter' && confirmBuy(),
    placeholder: "0.00",
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Acquirente"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    list: "acquirenti",
    value: buying.buyer,
    onChange: e => setBuying(b => ({
      ...b,
      buyer: e.target.value
    })),
    placeholder: "Chi ha acquistato",
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-[11px] uppercase font-bold text-gray-500 mb-1"
  }, "Tipologia"), /*#__PURE__*/React.createElement("select", {
    value: buying.type,
    onChange: e => setBuying(b => ({
      ...b,
      type: e.target.value
    })),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold"
  }, Object.keys(PURCHASE_TYPES).map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, PURCHASE_TYPES[k])))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 pt-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setBuying(null),
    className: "flex-1 py-2.5 bg-white border border-[#8F9E8B]/50 text-gray-500 rounded text-xs font-bold uppercase"
  }, "Annulla"), /*#__PURE__*/React.createElement("button", {
    onClick: confirmBuy,
    className: "flex-1 py-2.5 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]"
  }, "Conferma")))), snapList && /*#__PURE__*/React.createElement("div", {
    onClick: () => setSnapList(null),
    className: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "bg-white rounded-lg p-4 w-full max-w-xs space-y-2 max-h-[70vh] overflow-y-auto shadow-2xl"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2"
  }, "Ripristina un salvataggio"), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500"
  }, "Copie automatiche giornaliere. Scegli il giorno a cui tornare."), snapList.map(id => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => restoreSnapshot(id),
    className: "w-full py-2.5 bg-[#F0F4F1] border border-[#8F9E8B]/40 rounded text-sm font-bold text-[#2D392C] hover:bg-[#E2EAE4]"
  }, parseDate(id).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'long'
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSnapList(null),
    className: "w-full py-2 text-xs uppercase font-bold text-gray-500 hover:text-gray-700"
  }, "Annulla"))), viewReceipt && /*#__PURE__*/React.createElement("div", {
    onClick: () => setViewReceipt(null),
    className: "fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-pointer"
  }, /*#__PURE__*/React.createElement("img", {
    src: viewReceipt,
    alt: "Scontrino",
    className: "max-w-full max-h-full rounded shadow-2xl"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute bottom-6 left-0 right-0 text-center text-[10px] uppercase tracking-widest text-white/60"
  }, "Tocca per chiudere")), /*#__PURE__*/React.createElement("footer", {
    className: "fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#F0F4F1] border-t-2 border-[#5C4A3C] py-3 px-4 text-center z-10"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-rustic text-[#2D392C] tracking-widest text-sm uppercase font-bold"
  }, BRAND.footerMotto)));
}
const root = createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/React.createElement(App, null));