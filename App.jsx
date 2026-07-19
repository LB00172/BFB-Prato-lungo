const { useState, useEffect, useRef } = React;
const { createRoot } = ReactDOM;

// ---------- Utility ----------

// Formatta una Date in 'YYYY-MM-DD' usando l'ora LOCALE (niente UTC),
// evitando lo sfasamento di un giorno dei fusi orari.
const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Interpreta 'YYYY-MM-DD' come data locale (non UTC).
const parseDate = (s) => {
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
const money = (n) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
// Numero >= 0 a partire da una stringa di input.
const posNum = (v) => Math.max(0, parseFloat(v) || 0);

const initialDayState = () => ({ note: '', guestsNames: '', meals: {} });

// Tipologie di acquisto e a quale voce di spesa contribuiscono.
const PURCHASE_TYPES = { alimentare: 'Alimentare', bevande: 'Bevande', logistica: 'Logistica' };

// Dotazione personale base: uguale per tutti, non modificabile dall'app.
const BASE_GEAR = [
  'Tenda',
  'Stoviglie, posate personali e bicchiere riutilizzabile',
  'Sacchi a pelo',
  'Borraccia',
  'Cuscini',
  'Canovacci',
  'Materassino',
  'Luci LED',
];

// Comprime una foto (scontrino) ridimensionandola e convertendola in JPEG,
// così da poterla salvare in localStorage senza esaurire lo spazio.
const compressImage = (file, maxDim = 1200, quality = 0.6) =>
  new Promise((resolve, reject) => {
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
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pType, setPType] = useState('alimentare');
  const [pBuyer, setPBuyer] = useState('');
  const [pReceipt, setPReceipt] = useState(null); // foto scontrino in attesa di Salva
  const [viewReceipt, setViewReceipt] = useState(null); // foto aperta a schermo intero

  // Foto scontrini: SOLO su questo dispositivo (non sincronizzate: troppo
  // pesanti per il documento cloud condiviso).
  const [receipts, setReceipts] = useState(() => load('cambusa_receipts', {}));

  // Dotazioni aggiuntive (box editabile), condivise via sync.
  const [gear, setGear] = useState(() => load('cambusa_gear', []));
  const [newGearText, setNewGearText] = useState('');

  const [menuOpen, setMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ---------- Stato sincronizzazione cloud (Firebase) ----------
  const [cloud, setCloud] = useState({ connected: false, status: 'idle', code: null, lastSync: null, error: null });
  const [campCodeInput, setCampCodeInput] = useState((typeof window !== 'undefined' && window.CAMP_CODE_DEFAULT) || '');
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
  useEffect(() => {
    try {
      localStorage.setItem('cambusa_receipts', JSON.stringify(receipts));
    } catch (e) {
      window.alert('Spazio del dispositivo quasi esaurito: l\'ultima foto scontrino potrebbe non essere stata salvata. Elimina qualche vecchia foto.');
    }
  }, [receipts]);

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
  const applyRemote = (remote) => {
    suppressPushRef.current = true;
    if (Array.isArray(remote.members)) setMembers(remote.members);
    if (remote.campData && typeof remote.campData === 'object') setCampData(remote.campData);
    if (Array.isArray(remote.purchases)) setPurchases(remote.purchases);
    if (Array.isArray(remote.gear)) setGear(remote.gear);
    setTimeout(() => { suppressPushRef.current = false; }, 0);
  };

  const connectCloud = async (code) => {
    const CS = window.CloudSync;
    if (!CS || !CS.isConfigured()) {
      window.alert('Firebase non è configurato. Incolla la config del tuo progetto in firebase-config.js.');
      return;
    }
    const c = (code || '').trim();
    if (!c) { window.alert('Inserisci il codice del campo.'); return; }
    try {
      await CS.connect(window.FIREBASE_CONFIG, c, applyRemote);
    } catch (e) {
      window.alert('Connessione fallita: ' + (e && e.message ? e.message : e));
    }
  };

  const disconnectCloud = () => { if (window.CloudSync) window.CloudSync.disconnect(); };

  // All'avvio: aggancia lo stato e riconnette se già usato in passato.
  useEffect(() => {
    const CS = window.CloudSync;
    if (!CS) return;
    CS.onStatus((s) => { cloudConnectedRef.current = s.connected; setCloud(s); });
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
    if (window.CloudSync) window.CloudSync.pushState({ members, campData, purchases, gear });
  }, [members, campData, purchases, gear]);

  // ---------- Dati per giorno ----------
  const getDayData = (dateStr) => ({ ...initialDayState(), ...(campData[dateStr] || {}) });

  const updateDayData = (dateStr, field, value) => {
    setCampData((prev) => ({
      ...prev,
      [dateStr]: { ...initialDayState(), ...(prev[dateStr] || {}), [field]: value },
    }));
  };

  const getMeal = (dateStr, memberId) => {
    const day = campData[dateStr];
    return (day && day.meals && day.meals[memberId]) || { lunch: false, dinner: false };
  };

  const toggleMeal = (dateStr, memberId, mealType) => {
    setCampData((prev) => {
      const day = { ...initialDayState(), ...(prev[dateStr] || {}) };
      const meals = { ...(day.meals || {}) };
      const cur = meals[memberId] || { lunch: false, dinner: false };
      meals[memberId] = { ...cur, [mealType]: !cur[mealType] };
      return { ...prev, [dateStr]: { ...day, meals } };
    });
  };

  // ---------- Gestione membri ----------
  const addMember = () => {
    const name = newMemberName.trim();
    if (!name) return;
    setMembers((prev) => [...prev, { id: uid(), name, isChild: newMemberChild }]);
    setNewMemberName('');
    setNewMemberChild(false);
  };

  const removeMember = (id) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleChild = (id) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, isChild: !m.isChild } : m)));
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
    setPurchases((prev) => [...prev, { id, name, price, type: pType, buyer: pBuyer.trim(), at: Date.now() }]);
    if (pReceipt) setReceipts((prev) => ({ ...prev, [id]: pReceipt }));
    setPName('');
    setPPrice('');
    setPType('alimentare');
    setPBuyer('');
    setPReceipt(null);
  };

  const removePurchase = (id) => {
    setPurchases((prev) => prev.filter((p) => p.id !== id));
    setReceipts((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const onReceiptFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPReceipt(await compressImage(file));
    } catch (err) {
      window.alert('Impossibile leggere la foto. Riprova.');
    }
  };

  // ---------- Dotazioni aggiuntive ----------
  const addGear = () => {
    const text = newGearText.trim();
    if (!text) return;
    setGear((prev) => [...prev, { id: uid(), text }]);
    setNewGearText('');
  };

  const removeGear = (id) => {
    setGear((prev) => prev.filter((g) => g.id !== id));
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

  // ---------- Calcolo ripartizione (coerente: somma quote = totale) ----------
  const calculateTotals = () => {
    // I totali di spesa sono generati dal taccuino (per tipologia).
    const sumByType = (t) => purchases.reduce((s, p) => (p.type === t ? s + posNum(p.price) : s), 0);
    const totalFood = sumByType('alimentare');
    const totalDrinks = sumByType('bevande');
    const totalAccessory = sumByType('logistica');
    const totalFoodDrinks = totalFood + totalDrinks;
    const overallTotal = totalFoodDrinks + totalAccessory;

    // Pasti per membro sull'intero campo.
    const mealsByMember = {};
    members.forEach((m) => (mealsByMember[m.id] = 0));

    let adultMealsTotal = 0;
    const attendingAdults = new Set();

    Object.values(campData).forEach((day) => {
      const meals = (day && day.meals) || {};
      members.forEach((m) => {
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
    const breakdown = members.map((m) => {
      const mealCount = mealsByMember[m.id] || 0;
      const foodShare = m.isChild ? 0 : mealCount * costPerMeal;
      const logShare = !m.isChild && mealCount > 0 ? logisticsPerAdult : 0;
      return { ...m, mealCount, foodShare, logShare, owed: foodShare + logShare };
    });

    // --- Arrotondamento "cassa-friendly" ---
    // Ogni quota viene arrotondata a multipli di 0,10 € (niente monetine da
    // 1/2/5 cent). Lo scarto rispetto al totale reale viene riconciliato SOLO
    // se è >= 0,50 €: sotto quella soglia si lascia com'è (non vale la pena).
    const round10 = (cents) => Math.round(cents / 10) * 10;
    breakdown.forEach((b) => {
      b.payCents = b.isChild ? 0 : round10(Math.round(b.owed * 100));
    });

    const targetCents = Math.round(overallTotal * 100);
    let residual = targetCents - breakdown.reduce((s, b) => s + b.payCents, 0);

    if (Math.abs(residual) >= 50) {
      // Redistribuisce lo scarto a passi di 10 cent, partendo da chi deve di più.
      const order = breakdown
        .filter((b) => !b.isChild && b.owed > 0)
        .sort((a, b) => b.owed - a.owed);
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

    breakdown.forEach((b) => { b.pay = b.payCents / 100; });
    const collected = breakdown.reduce((s, b) => s + b.payCents, 0) / 100;
    const roundingDiff = collected - overallTotal;

    // Anticipi per acquirente: quanto ha speso ciascuno (per i rimborsi).
    const buyerMap = {};
    purchases.forEach((p) => {
      const key = (p.buyer && p.buyer.trim()) ? p.buyer.trim() : '—';
      buyerMap[key] = (buyerMap[key] || 0) + posNum(p.price);
    });
    const byBuyer = Object.keys(buyerMap)
      .map((name) => ({ name, total: buyerMap[name] }))
      .sort((a, b) => b.total - a.total);

    // --- Saldo netto per persona (stile Splitwise): anticipato - dovuto ---
    const norm = (s) => (s || '').trim().toLowerCase();
    const paidByName = {}; // nome normalizzato -> { display, paid }
    purchases.forEach((p) => {
      const raw = (p.buyer && p.buyer.trim()) ? p.buyer.trim() : '—';
      const key = norm(raw) || '—';
      if (!paidByName[key]) paidByName[key] = { display: raw, paid: 0 };
      paidByName[key].paid += posNum(p.price);
    });
    const owedByName = {}; // nome membro normalizzato -> { display, owed }
    breakdown.forEach((b) => {
      const key = norm(b.name);
      if (!owedByName[key]) owedByName[key] = { display: b.name, owed: 0 };
      owedByName[key].owed += b.pay; // già arrotondato; bambini = 0
    });
    const unattributed = paidByName['—'] ? paidByName['—'].paid : 0;
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

    // Transazioni di pareggio: chi paga chi, col minor numero di giri.
    // Greedy sui centesimi: il debitore più grosso paga il creditore più grosso.
    const creditors = settlement.filter((s) => s.net > 0.005).map((s) => ({ name: s.name, cents: Math.round(s.net * 100) }));
    const debtors = settlement.filter((s) => s.net < -0.005).map((s) => ({ name: s.name, cents: Math.round(-s.net * 100) }));
    const transfers = [];
    let ci = 0, di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const amt = Math.min(creditors[ci].cents, debtors[di].cents);
      if (amt > 0) transfers.push({ from: debtors[di].name, to: creditors[ci].name, amount: amt / 100 });
      creditors[ci].cents -= amt;
      debtors[di].cents -= amt;
      if (creditors[ci].cents === 0) ci++;
      if (debtors[di].cents === 0) di++;
    }

    return {
      totalFood, totalDrinks, totalAccessory, totalFoodDrinks, overallTotal,
      costPerMeal, logisticsPerAdult, adultMealsTotal,
      attendingAdultsCount: attendingAdults.size, breakdown,
      collected, roundingDiff, byBuyer, settlement, unattributed, transfers,
    };
  };

  const totals = calculateTotals();

  // ---------- Backup (Export / Import) ----------
  const exportData = () => {
    const payload = { version: 3, exportedAt: new Date().toISOString(), members, campData, purchases, gear, receipts };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bandone-backup-${toDateStr(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
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
    return (
      <div
        onClick={() => setShowSplash(false)}
        className="fixed inset-0 bg-[#2D392C] flex flex-col items-center justify-center text-[#F0F4F1] z-50 cursor-pointer"
      >
        <div className="w-56 h-56 mb-6 rounded-full overflow-hidden shadow-2xl flex items-center justify-center border-4 border-[#8F9E8B] bg-[#F0F4F1]">
          <img src="./logo.png" alt="Logo Brigata Fabio Bandone" className="w-full h-full object-cover" />
        </div>
        <h1 className="font-rustic text-3xl tracking-widest text-[#8F9E8B]">BRIGATA</h1>
        <h2 className="font-rustic text-xl tracking-widest text-[#F0F4F1]">FABIO BANDONE</h2>
        <p className="mt-4 text-xs uppercase tracking-widest opacity-60">Prato Lungo Forever</p>
        <p className="absolute bottom-4 left-0 right-0 text-center text-[9px] tracking-wide text-[#8F9E8B]/70 px-6">
          Web app prodotta da Lorenzo Ballerini · Tutti i diritti riservati © 2026
        </p>
      </div>
    );
  }

  const tabs = {
    calendario: 'Calendario',
    membri: 'Membri',
    presenze: 'Presenze',
    spesa: 'Spesa',
    lista: 'Taccuino',
    regole: 'Regole',
    dotazioni: 'Dotazioni personali',
  };

  const goTo = (tab) => { setActiveTab(tab); setMenuOpen(false); };

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
        <h1 className="font-rustic text-2xl tracking-wide">PRATO LUNGO 2026</h1>
        <p className="text-xs uppercase tracking-wider text-[#8F9E8B]">{tabs[activeTab]}</p>
        <span
          title={isOnline ? 'Online' : 'Offline'}
          className={`absolute top-3 right-3 flex items-center gap-1 text-[9px] uppercase font-bold ${isOnline ? 'text-[#8F9E8B]' : 'text-[#D97706]'}`}
        >
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#8F9E8B]' : 'bg-[#D97706]'}`}></span>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </header>

      {/* Menu a tendina (hamburger): scende sotto l'header, che resta visibile */}
      {menuOpen && (
        <nav className="bg-[#F0F4F1] border-b-4 border-[#5C4A3C] shadow-md p-2 space-y-1">
          {Object.keys(tabs).map((tab) => (
            <button
              key={tab}
              onClick={() => goTo(tab)}
              className={`w-full text-left px-4 py-3 rounded font-bold uppercase text-sm tracking-wide transition-colors ${
                activeTab === tab ? 'bg-[#2D392C] text-[#F0F4F1]' : 'text-[#2D392C] hover:bg-[#E2EAE4]'
              }`}
            >
              {tabs[tab]}
            </button>
          ))}
        </nav>
      )}

      <main className="flex-grow p-4">
        {/* ---------- CALENDARIO ---------- */}
        {activeTab === 'calendario' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm">
              <button onClick={() => changeWeek(-7)} className="p-2 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&larr;</button>
              <span className="font-bold text-sm text-[#2D392C] uppercase font-rustic">Settimana Selezionata</span>
              <button onClick={() => changeWeek(7)} className="p-2 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&rarr;</button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((d) => {
                const dateStr = toDateStr(d);
                const isSelected = dateStr === selectedDateStr;
                const isCampPeriod = dateStr >= '2026-08-11' && dateStr <= '2026-08-16';
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

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-dashed border-[#8F9E8B] pb-1">
                Note del {parseDate(selectedDateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
              </h3>
              <textarea
                value={getDayData(selectedDateStr).note}
                onChange={(e) => updateDayData(selectedDateStr, 'note', e.target.value)}
                placeholder="Inserisci note sul menu, meteo o legna per oggi..."
                className="w-full h-32 p-3 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded-lg text-sm focus:outline-none focus:border-[#2D392C] resize-none"
              />
            </div>
          </div>
        )}

        {/* ---------- MEMBRI ---------- */}
        {activeTab === 'membri' && (
          <div className="space-y-4">
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
                <button onClick={addMember} className="px-4 bg-[#2D392C] text-white rounded font-bold text-sm hover:bg-[#1F271E]">+</button>
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
                    <li key={m.id} className="flex items-center justify-between bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                      <span className="font-bold text-sm text-[#2D392C]">{m.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleChild(m.id)}
                          className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${m.isChild ? 'bg-[#D97706] text-white' : 'bg-gray-200 text-gray-500'}`}
                        >
                          {m.isChild ? 'Bambino' : 'Adulto'}
                        </button>
                        <button onClick={() => removeMember(m.id)} className="text-red-700 font-bold px-2 hover:text-red-900">&times;</button>
                      </div>
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
              <button onClick={() => navigateDate(-1)} className="px-3 py-1 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&larr;</button>
              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => { if (e.target.value) { setSelectedDateStr(e.target.value); setCurrentDate(parseDate(e.target.value)); } }}
                className="bg-transparent border-none text-sm focus:outline-none font-bold text-center w-full mx-2 text-[#5C4A3C]"
              />
              <button onClick={() => navigateDate(1)} className="px-3 py-1 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&rarr;</button>
            </div>

            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">
                Presenze del {parseDate(selectedDateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
              </h3>

              {members.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aggiungi prima i membri nella scheda "Membri".</p>
              ) : (
                <ul className="space-y-2">
                  {members.map((m) => {
                    const meal = getMeal(selectedDateStr, m.id);
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-2 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/20">
                        <span className="text-sm font-bold text-[#2D392C] truncate flex items-center gap-1">
                          {m.name}
                          {m.isChild && <span className="text-[8px] uppercase bg-[#D97706] text-white px-1 rounded">gratis</span>}
                        </span>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => toggleMeal(selectedDateStr, m.id, 'lunch')}
                            className={`text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border ${meal.lunch ? 'bg-[#2D392C] text-white border-[#2D392C]' : 'bg-white text-gray-400 border-gray-300'}`}
                          >
                            Pranzo
                          </button>
                          <button
                            onClick={() => toggleMeal(selectedDateStr, m.id, 'dinner')}
                            className={`text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border ${meal.dinner ? 'bg-[#5C4A3C] text-white border-[#5C4A3C]' : 'bg-white text-gray-400 border-gray-300'}`}
                          >
                            Cena
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
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
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-4">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Cassa Globale Campo</h3>
              <p className="text-[10px] text-gray-500 -mt-1">Totali generati automaticamente dagli acquisti registrati nel <span className="font-bold">Taccuino</span>.</p>
              <div className="space-y-2">
                {[
                  ['Spesa Cibo (Alimentare)', totals.totalFood],
                  ['Spesa Bevande', totals.totalDrinks],
                  ['Accessori (Logistica)', totals.totalAccessory],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20">
                    <span className="text-[11px] uppercase font-bold text-gray-500">{label}</span>
                    <span className="font-bold text-[#2D392C]">{money(val)} €</span>
                  </div>
                ))}
              </div>
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
                  <p className="text-[9px] text-gray-400 mt-1">Cibo+bevande ({money(totals.totalFoodDrinks)} €) / {totals.adultMealsTotal} pasti adulti.</p>
                </div>
                <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20">
                  <span className="text-[10px] uppercase text-[#8F9E8B] block">Logistica a testa</span>
                  <span className="font-rustic text-xl text-[#D97706]">{money(totals.logisticsPerAdult)} €</span>
                  <p className="text-[9px] text-gray-400 mt-1">Accessori ({money(totals.totalAccessory)} €) / {totals.attendingAdultsCount} adulti presenti.</p>
                </div>
              </div>
              <p className="text-[9px] text-gray-400 italic">I pasti dei bambini sono gratis: il loro costo è ripartito sugli adulti.</p>
            </div>

            {/* Ripartizione per membro */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Quanto deve ciascuno</h3>
              {totals.breakdown.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aggiungi membri e segna le presenze per vedere la ripartizione.</p>
              ) : (
                <div>
                  <ul className="divide-y divide-[#8F9E8B]/20">
                    {totals.breakdown.map((b) => (
                      <li key={b.id} className="flex items-center justify-between py-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-[#2D392C]">{b.name}</span>
                          <span className="text-[10px] text-gray-500">{b.mealCount} {b.mealCount === 1 ? 'pasto' : 'pasti'}{b.isChild ? ' · bambino' : ''}</span>
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
                  <p className="text-[9px] text-gray-400 italic mt-2">
                    Quote arrotondate a 0,10 € (niente monetine da 1/2/5 cent).
                    {Math.abs(totals.roundingDiff) >= 0.005
                      ? ` Scarto rispetto al totale: ${totals.roundingDiff > 0 ? '+' : ''}${money(totals.roundingDiff)} € (sotto 0,50 €, non riconciliato).`
                      : ' Nessuno scarto.'}
                  </p>
                </div>
              )}
            </div>

            {/* Anticipi per acquirente */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Anticipi per acquirente</h3>
              {totals.byBuyer.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Registra gli acquisti nel Taccuino per vedere chi ha anticipato quanto.</p>
              ) : (
                <div>
                  <ul className="divide-y divide-[#8F9E8B]/20">
                    {totals.byBuyer.map((b) => (
                      <li key={b.name} className="flex items-center justify-between py-2">
                        <span className={`text-sm font-bold ${b.name === '—' ? 'text-gray-400 italic' : 'text-[#2D392C]'}`}>
                          {b.name === '—' ? 'Non indicato' : b.name}
                        </span>
                        <span className="font-rustic font-bold text-[#2D392C]">{money(b.total)} €</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[9px] text-gray-400 italic mt-2">Quanto ha anticipato ciascuno (utile per i rimborsi).</p>
                </div>
              )}
            </div>

            {/* Saldo finale (stile Splitwise) */}
            <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 mb-3">Saldo finale</h3>
              {totals.settlement.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Registra acquisti (con acquirente) e presenze per vedere chi deve dare o ricevere.</p>
              ) : (
                <ul className="divide-y divide-[#8F9E8B]/20">
                  {totals.settlement.map((s) => {
                    const credito = s.net > 0.005;
                    const debito = s.net < -0.005;
                    return (
                      <li key={s.name} className="flex items-center justify-between py-2 gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold truncate">{s.name}</span>
                          <span className="text-[9px] text-[#8F9E8B]">ha anticipato {money(s.paid)} € · deve {money(s.owed)} €</span>
                        </div>
                        <span className={`font-rustic font-bold text-sm shrink-0 text-right ${credito ? 'text-[#8FBF8F]' : debito ? 'text-[#D97706]' : 'text-gray-400'}`}>
                          {credito ? `riceve ${money(s.net)} €` : debito ? `dà ${money(-s.net)} €` : 'in pari'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {totals.transfers.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#8F9E8B]/30">
                  <h4 className="font-rustic text-sm text-[#8F9E8B] mb-2">Chi paga chi</h4>
                  <ul className="space-y-1.5">
                    {totals.transfers.map((t, i) => (
                      <li key={i} className="flex items-center justify-between bg-[#1F271E] px-3 py-2 rounded border border-[#8F9E8B]/20">
                        <span className="text-xs">
                          <span className="font-bold">{t.from}</span>
                          <span className="text-[#8F9E8B]"> → </span>
                          <span className="font-bold">{t.to}</span>
                        </span>
                        <span className="font-rustic font-bold text-[#D97706]">{money(t.amount)} €</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {totals.unattributed > 0.005 && (
                <p className="text-[9px] text-[#D97706] italic mt-2">
                  Attenzione: {money(totals.unattributed)} € di acquisti sono senza acquirente. Assegna un acquirente nel Taccuino per far quadrare i conti.
                </p>
              )}
              <p className="text-[9px] text-gray-400 italic mt-1">"Riceve" = ha anticipato più di quanto deve; "dà" = deve versare la differenza.</p>
            </div>

            {/* Backup dati */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Backup Dati</h3>
              <p className="text-[10px] text-gray-500">I dati restano solo su questo dispositivo. Esporta un file per salvarli o trasferirli.</p>
              <div className="flex gap-2">
                <button onClick={exportData} className="flex-1 py-2.5 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]">Esporta</button>
                <label className="flex-1 py-2.5 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase text-center cursor-pointer hover:bg-[#463628]">
                  Importa
                  <input type="file" accept="application/json,.json" onChange={importData} className="hidden" />
                </label>
              </div>
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
                    Quando c'è linea, i dati si sincronizzano tra i dispositivi che usano lo stesso codice campo. Offline si continua a lavorare in locale.
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
                      <button onClick={disconnectCloud} className="px-4 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase hover:bg-[#463628]">Disconnetti</button>
                    ) : (
                      <button onClick={() => connectCloud(campCodeInput)} className="px-4 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]">Connetti</button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>
                      {cloud.status === 'connecting' && 'Connessione in corso…'}
                      {cloud.status === 'saving' && 'Salvataggio…'}
                      {cloud.status === 'connected' && (cloud.lastSync ? `Ultima sync: ${new Date(cloud.lastSync).toLocaleTimeString('it-IT')}` : 'In ascolto…')}
                      {cloud.status === 'error' && <span className="text-red-700">Errore: {cloud.error}</span>}
                      {cloud.status === 'idle' && 'Inserisci il codice e premi Connetti.'}
                    </span>
                    {!isOnline && <span className="text-[#D97706] font-bold">offline</span>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ---------- TACCUINO DELLE SPESE ---------- */}
        {activeTab === 'lista' && (
          <div className="space-y-4">
            {/* Form di inserimento */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
                <h3 className="font-rustic text-lg text-[#2D392C]">Prodotto acquistato</h3>
                <label
                  title="Foto scontrino"
                  className={`cursor-pointer px-3 py-2 rounded border-2 text-lg leading-none ${pReceipt ? 'bg-[#2D392C] border-[#2D392C]' : 'bg-white border-[#8F9E8B]/50 hover:bg-[#E2EAE4]'}`}
                >
                  📷
                  <input type="file" accept="image/*" capture="environment" onChange={onReceiptFile} className="hidden" />
                </label>
              </div>

              {pReceipt && (
                <div className="flex items-center gap-3 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/30">
                  <img src={pReceipt} alt="Scontrino" className="w-12 h-12 object-cover rounded" />
                  <span className="flex-grow text-xs text-[#2D392C] font-bold">Scontrino allegato ✓</span>
                  <button onClick={() => setPReceipt(null)} aria-label="Rimuovi foto" className="text-red-700 font-bold px-2 hover:text-red-900">&times;</button>
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
                <input
                  type="text"
                  list="acquirenti"
                  value={pBuyer}
                  onChange={(e) => setPBuyer(e.target.value)}
                  placeholder="Chi ha acquistato"
                  className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                />
                <datalist id="acquirenti">
                  {members.map((m) => (<option key={m.id} value={m.name} />))}
                </datalist>
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

              <button onClick={addPurchase} className="w-full py-3 bg-[#2D392C] text-white rounded font-bold uppercase text-sm tracking-wide hover:bg-[#1F271E]">
                Salva
              </button>
            </div>

            {/* Cronologia acquisti */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
                <h3 className="font-rustic text-lg text-[#2D392C]">Cronologia acquisti</h3>
                {purchases.length > 0 && (
                  <span className="font-rustic font-bold text-[#2D392C]">{money(totals.overallTotal)} €</span>
                )}
              </div>

              {purchases.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessun acquisto registrato. Compila il form qui sopra e premi Salva.</p>
              ) : (
                <ul className="space-y-2">
                  {purchases.slice().reverse().map((p) => (
                    <li key={p.id} className="flex items-center gap-2 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[#2D392C] truncate">{p.name}</span>
                          <span className="text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#8F9E8B] shrink-0">{PURCHASE_TYPES[p.type] || p.type}</span>
                        </div>
                        <span className="text-[9px] text-gray-400">
                          {p.buyer ? <span className="text-[#5C4A3C] font-bold">{p.buyer}</span> : <span className="italic">acquirente non indicato</span>}
                          {p.at && ` · ${new Date(p.at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} ${new Date(p.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                      </div>
                      <span className="font-rustic font-bold text-[#2D392C] shrink-0">{money(posNum(p.price))} €</span>
                      {receipts[p.id] && (
                        <button onClick={() => setViewReceipt(receipts[p.id])} aria-label="Vedi scontrino" className="px-1 shrink-0 hover:opacity-70">📷</button>
                      )}
                      <button onClick={() => removePurchase(p.id)} aria-label="Rimuovi" className="text-red-700 font-bold px-1.5 hover:text-red-900 shrink-0">&times;</button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[9px] text-gray-400 italic mt-2">Le foto degli scontrini restano solo su questo dispositivo (incluse nel backup Esporta).</p>
            </div>
          </div>
        )}

        {/* ---------- REGOLE ---------- */}
        {activeTab === 'regole' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg border-2 border-[#2D392C]/20 shadow-sm text-center">
              <h3 className="font-rustic text-lg text-[#2D392C] mb-2">Regole</h3>
              <p className="text-sm text-gray-400 italic">Work in progress</p>
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
                  <li key={item} className="flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                    <span className="w-1.5 h-1.5 bg-[#D97706] rounded-full shrink-0"></span>
                    <span className="text-sm text-[#2D392C]">{item}</span>
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
                <button onClick={addGear} aria-label="Aggiungi dotazione" className="px-4 bg-[#2D392C] text-white rounded font-bold text-lg leading-none hover:bg-[#1F271E]">+</button>
              </div>
              {gear.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nessuna aggiunta. Inserisci qui le dotazioni extra per questo campo.</p>
              ) : (
                <ul className="space-y-2">
                  {gear.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
                      <span className="w-1.5 h-1.5 bg-[#8F9E8B] rounded-full shrink-0"></span>
                      <span className="flex-grow text-sm text-[#2D392C]">{g.text}</span>
                      <button onClick={() => removeGear(g.id)} aria-label="Rimuovi" className="text-red-700 font-bold px-2 hover:text-red-900">&times;</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Visualizzatore scontrino a schermo intero (tocca per chiudere) */}
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
        <div className="font-rustic text-[#2D392C] tracking-widest text-sm uppercase font-bold">In Bandone we Trust</div>
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
