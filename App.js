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

// Tipologie di acquisto e a quale voce di spesa contribuiscono.
const PURCHASE_TYPES = {
  alimentare: 'Alimentare',
  bevande: 'Bevande',
  logistica: 'Logistica'
};
function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('calendario');
  const [currentDate, setCurrentDate] = useState(() => parseDate('2026-08-11'));
  const [selectedDateStr, setSelectedDateStr] = useState('2026-08-11');
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
  const [menuOpen, setMenuOpen] = useState(false);
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
  useEffect(() => {
    const on = () => {
      setIsOnline(true);
      // Al ritorno della linea, se avevamo un codice salvato ma non siamo
      // connessi (es. app aperta da offline), riprova a connettersi.
      const CS = window.CloudSync;
      if (CS && CS.isConfigured() && !cloudConnectedRef.current) {
        const saved = CS.savedCode();
        if (saved) CS.connect(window.FIREBASE_CONFIG, saved, applyRemote).catch(() => {});
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
    try {
      await CS.connect(window.FIREBASE_CONFIG, c, applyRemote);
    } catch (e) {
      window.alert('Connessione fallita: ' + (e && e.message ? e.message : e));
    }
  };
  const disconnectCloud = () => {
    if (window.CloudSync) window.CloudSync.disconnect();
  };

  // All'avvio: aggancia lo stato e riconnette se già usato in passato.
  useEffect(() => {
    const CS = window.CloudSync;
    if (!CS) return;
    CS.onStatus(s => {
      cloudConnectedRef.current = s.connected;
      setCloud(s);
    });
    const saved = CS.savedCode();
    if (saved && CS.isConfigured()) {
      setCampCodeInput(saved);
      CS.connect(window.FIREBASE_CONFIG, saved, applyRemote).catch(() => {});
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
      purchases
    });
  }, [members, campData, purchases]);

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
    setMembers(prev => prev.filter(m => m.id !== id));
  };
  const toggleChild = id => {
    setMembers(prev => prev.map(m => m.id === id ? {
      ...m,
      isChild: !m.isChild
    } : m));
  };

  // ---------- Taccuino delle spese ----------
  const addPurchase = () => {
    const name = pName.trim();
    const price = posNum(pPrice);
    if (!name || price <= 0) {
      window.alert('Inserisci il nome del prodotto e un prezzo maggiore di zero.');
      return;
    }
    setPurchases(prev => [...prev, {
      id: uid(),
      name,
      price,
      type: pType,
      buyer: pBuyer.trim(),
      at: Date.now()
    }]);
    setPName('');
    setPPrice('');
    setPType('alimentare');
    setPBuyer('');
  };
  const removePurchase = id => {
    setPurchases(prev => prev.filter(p => p.id !== id));
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
    const totalAccessory = sumByType('logistica');
    const totalFoodDrinks = totalFood + totalDrinks;
    const overallTotal = totalFoodDrinks + totalAccessory;

    // Pasti per membro sull'intero campo.
    const mealsByMember = {};
    members.forEach(m => mealsByMember[m.id] = 0);
    let adultMealsTotal = 0;
    const attendingAdults = new Set();
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
        }
      });
    });

    // Cibo+bevande ripartiti sui pasti degli adulti (bambini = gratis).
    const costPerMeal = adultMealsTotal > 0 ? totalFoodDrinks / adultMealsTotal : 0;
    // Accessori/logistica ripartiti in parti uguali tra gli adulti realmente presenti.
    const logisticsPerAdult = attendingAdults.size > 0 ? totalAccessory / attendingAdults.size : 0;

    // Quota dovuta da ciascun membro (valore esatto).
    const breakdown = members.map(m => {
      const mealCount = mealsByMember[m.id] || 0;
      const foodShare = m.isChild ? 0 : mealCount * costPerMeal;
      const logShare = !m.isChild && mealCount > 0 ? logisticsPerAdult : 0;
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
    return {
      totalFood,
      totalDrinks,
      totalAccessory,
      totalFoodDrinks,
      overallTotal,
      costPerMeal,
      logisticsPerAdult,
      adultMealsTotal,
      attendingAdultsCount: attendingAdults.size,
      breakdown,
      collected,
      roundingDiff
    };
  };
  const totals = calculateTotals();

  // ---------- Backup (Export / Import) ----------
  const exportData = () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      members,
      campData,
      purchases
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
      alt: "Logo Brigata Fabio Bandone",
      className: "w-full h-full object-cover"
    })), /*#__PURE__*/React.createElement("h1", {
      className: "font-rustic text-3xl tracking-widest text-[#8F9E8B]"
    }, "BRIGATA"), /*#__PURE__*/React.createElement("h2", {
      className: "font-rustic text-xl tracking-widest text-[#F0F4F1]"
    }, "FABIO BANDONE"), /*#__PURE__*/React.createElement("p", {
      className: "mt-4 text-xs uppercase tracking-widest opacity-60"
    }, "Prato Lungo Forever"));
  }
  const tabs = {
    calendario: 'Calendario',
    membri: 'Membri',
    presenze: 'Presenze',
    spesa: 'Spesa',
    lista: 'Taccuino',
    regole: 'Regole',
    dotazioni: 'Dotazioni personali'
  };
  const goTo = tab => {
    setActiveTab(tab);
    setMenuOpen(false);
  };
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
  }, "PRATO LUNGO 2026"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs uppercase tracking-wider text-[#8F9E8B]"
  }, tabs[activeTab]), /*#__PURE__*/React.createElement("span", {
    title: isOnline ? 'Online' : 'Offline',
    className: `absolute top-3 right-3 flex items-center gap-1 text-[9px] uppercase font-bold ${isOnline ? 'text-[#8F9E8B]' : 'text-[#D97706]'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: `w-2 h-2 rounded-full ${isOnline ? 'bg-[#8F9E8B]' : 'bg-[#D97706]'}`
  }), isOnline ? 'Online' : 'Offline')), menuOpen && /*#__PURE__*/React.createElement("nav", {
    className: "bg-[#F0F4F1] border-b-4 border-[#5C4A3C] shadow-md p-2 space-y-1"
  }, Object.keys(tabs).map(tab => /*#__PURE__*/React.createElement("button", {
    key: tab,
    onClick: () => goTo(tab),
    className: `w-full text-left px-4 py-3 rounded font-bold uppercase text-sm tracking-wide transition-colors ${activeTab === tab ? 'bg-[#2D392C] text-[#F0F4F1]' : 'text-[#2D392C] hover:bg-[#E2EAE4]'}`
  }, tabs[tab]))), /*#__PURE__*/React.createElement("main", {
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
    const isCampPeriod = dateStr >= '2026-08-11' && dateStr <= '2026-08-16';
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
  })), /*#__PURE__*/React.createElement("textarea", {
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
    className: "flex items-center justify-between bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-sm text-[#2D392C]"
  }, m.name), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => toggleChild(m.id),
    className: `text-[9px] uppercase font-bold px-2 py-1 rounded ${m.isChild ? 'bg-[#D97706] text-white' : 'bg-gray-200 text-gray-500'}`
  }, m.isChild ? 'Bambino' : 'Adulto'), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeMember(m.id),
    className: "text-red-700 font-bold px-2 hover:text-red-900"
  }, "\xD7"))))))), activeTab === 'presenze' && /*#__PURE__*/React.createElement("div", {
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
  }, "Aggiungi prima i membri nella scheda \"Membri\".") : /*#__PURE__*/React.createElement("ul", {
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
  }))), /*#__PURE__*/React.createElement("div", {
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
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Cassa Globale Campo"), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500 -mt-1"
  }, "Totali generati automaticamente dagli acquisti registrati nel ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, "Taccuino"), "."), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, [['Spesa Cibo (Alimentare)', totals.totalFood], ['Spesa Bevande', totals.totalDrinks], ['Accessori (Logistica)', totals.totalAccessory]].map(([label, val]) => /*#__PURE__*/React.createElement("div", {
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
  }, "Accessori (", money(totals.totalAccessory), " \u20AC) / ", totals.attendingAdultsCount, " adulti presenti."))), /*#__PURE__*/React.createElement("p", {
    className: "text-[9px] text-gray-400 italic"
  }, "I pasti dei bambini sono gratis: il loro costo \xE8 ripartito sugli adulti.")), /*#__PURE__*/React.createElement("div", {
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
  }, "Quote arrotondate a 0,10 \u20AC (niente monetine da 1/2/5 cent).", Math.abs(totals.roundingDiff) >= 0.005 ? ` Scarto rispetto al totale: ${totals.roundingDiff > 0 ? '+' : ''}${money(totals.roundingDiff)} € (sotto 0,50 €, non riconciliato).` : ' Nessuno scarto.'))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, "Backup Dati"), /*#__PURE__*/React.createElement("p", {
    className: "text-[10px] text-gray-500"
  }, "I dati restano solo su questo dispositivo. Esporta un file per salvarli o trasferirli."), /*#__PURE__*/React.createElement("div", {
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
  })))), /*#__PURE__*/React.createElement("div", {
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
  }, "Quando c'\xE8 linea, i dati si sincronizzano tra i dispositivi che usano lo stesso codice campo. Offline si continua a lavorare in locale."), /*#__PURE__*/React.createElement("div", {
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
  }, "Errore: ", cloud.error), cloud.status === 'idle' && 'Inserisci il codice e premi Connetti.'), !isOnline && /*#__PURE__*/React.createElement("span", {
    className: "text-[#D97706] font-bold"
  }, "offline"))))), activeTab === 'lista' && /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
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
  }, PURCHASE_TYPES[p.type] || p.type)), /*#__PURE__*/React.createElement("span", {
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
  }, money(posNum(p.price)), " \u20AC"), /*#__PURE__*/React.createElement("button", {
    onClick: () => removePurchase(p.id),
    "aria-label": "Rimuovi",
    className: "text-red-700 font-bold px-1.5 hover:text-red-900 shrink-0"
  }, "\xD7")))))), activeTab === 'regole' && /*#__PURE__*/React.createElement("div", {
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
    className: "bg-white p-6 rounded-lg border-2 border-[#2D392C]/20 shadow-sm text-center"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-lg text-[#2D392C] mb-2"
  }, "Dotazioni personali"), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-gray-400 italic"
  }, "Work in progress")))), /*#__PURE__*/React.createElement("footer", {
    className: "fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#F0F4F1] border-t-2 border-[#5C4A3C] py-3 px-4 text-center z-10"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-rustic text-[#2D392C] tracking-widest text-sm uppercase font-bold"
  }, "In Bandone we Trust")));
}
const root = createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/React.createElement(App, null));