// Branding e funzionalità: letti da window.APP_CONFIG (firebase-config.js),
// con fallback ai valori attuali se la configurazione non è presente.
const CFG = (typeof window !== 'undefined' && window.APP_CONFIG) || {};
const BRAND = {
  appTitle: 'PRATO LUNGO 2026',
  groupName: 'Brigata Fabio Bandone',
  splashLine1: 'BRIGATA',
  splashLine2: 'FABIO BANDONE',
  splashTagline: 'Prato Lungo Forever',
  footerMotto: 'In BANDY we Trust',
  credits: 'Web app prodotta da Lorenzo Ballerini · Tutti i diritti riservati © 2026',
  ...(CFG.brand || {}),
};
const FEATURES = { auth: false, rooms: false, equipExemption: false, ...(CFG.features || {}) };

// Periodo del campo. Durante il campo l'app si apre sul giorno corrente.
const CAMP_START = '2026-08-11';
const CAMP_END = '2026-08-16';
const defaultDateStr = () => {
  const today = toDateStr(new Date());
  return today >= CAMP_START && today <= CAMP_END ? today : CAMP_START;
};

// Tipologie di acquisto e a quale voce di spesa contribuiscono.
const PURCHASE_TYPES = { alimentare: 'Alimentare', bevande: 'Bevande', logistica: 'Logistica' };

// Codici meteo WMO (Open-Meteo) -> icona e descrizione.
const wmoInfo = (code) => {
  if (code === 0) return { icon: '☀️', label: 'Sereno' };
  if (code === 1 || code === 2) return { icon: '🌤️', label: 'Poco nuvoloso' };
  if (code === 3) return { icon: '☁️', label: 'Coperto' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: 'Nebbia' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: 'Pioviggine' };
  if (code >= 61 && code <= 67) return { icon: '🌧️', label: 'Pioggia' };
  if (code >= 71 && code <= 77) return { icon: '🌨️', label: 'Neve' };
  if (code >= 80 && code <= 82) return { icon: '🌦️', label: 'Rovesci' };
  if (code === 85 || code === 86) return { icon: '🌨️', label: 'Rovesci di neve' };
  if (code >= 95) return { icon: '⛈️', label: 'Temporale' };
  return { icon: '🌡️', label: 'Meteo' };
};

// Quanto "pesa" una condizione. Serve a due cose: scegliere la faccia della
// giornata e capire se il brutto vale la pena di essere nominato.
const gravitaWmo = (c) => (c >= 95 ? 5 : c >= 80 ? 4 : c >= 71 ? 4 : c >= 61 ? 3 : c >= 51 ? 2 : c === 45 || c === 48 ? 1 : c === 3 ? 1 : 0);

// Le ore in cui si sta fuori: e' su quelle che si giudica una giornata di campo.
const ORE_FUORI = [8, 21];

const momentoDelGiorno = (ora) => (
  ora == null ? '' : ora < 6 ? 'nella notte' : ora < 12 ? 'in mattinata' : ora < 18 ? 'nel pomeriggio' : 'in serata'
);

// Come si racconta una giornata a chi deve decidere se fare la camminata.
// Il codice WMO GIORNALIERO di Open-Meteo e' il piu' severo delle 24 ore: una
// sola ora di temporale dipinge di nero un giorno con otto ore di sole. Qui la
// faccia della giornata e' la condizione PREVALENTE nelle ore diurne, e il
// brutto — se c'e' — viene detto a parte, col suo momento. Le previsioni vecchie
// non hanno questi campi: si torna al comportamento di prima senza rumore.
const raccontaMeteo = (wx) => {
  if (!wx) return null;
  const testaCode = wx.giorno != null ? wx.giorno : wx.code;
  const testa = wmoInfo(testaCode);
  const nominaBrutto = wx.peggio != null && gravitaWmo(wx.peggio) > gravitaWmo(testaCode);
  const mm = typeof wx.mm === 'number' && wx.mm >= 0.2
    ? (wx.mm < 10 ? wx.mm.toFixed(1) : String(Math.round(wx.mm))) + ' mm'
    : null;
  return {
    icon: testa.icon,
    label: testa.label,
    coda: nominaBrutto ? `${wmoInfo(wx.peggio).label.toLowerCase()} ${momentoDelGiorno(wx.ora)}`.trim() : '',
    mm,
  };
};

// Dalla previsione ORARIA si ricava la forma della giornata. Le ore non si
// conservano: 384 valori per variabile finirebbero nel documento condiviso e
// nella memoria di ogni telefono, e servono solo a questo riassunto.
const formaDelGiorno = (ore) => {
  if (!Array.isArray(ore) || !ore.length) return {};
  const diurne = ore.filter((x) => x.ora >= ORE_FUORI[0] && x.ora <= ORE_FUORI[1]);
  const base = diurne.length ? diurne : ore;
  // Condizione prevalente: la piu' frequente. A pari frequenza vince la piu'
  // mite, perche' la faccia della giornata deve dire com'e' di solito.
  const conta = new Map();
  base.forEach((x) => conta.set(x.code, (conta.get(x.code) || 0) + 1));
  let giorno = base[0].code, quante = 0;
  conta.forEach((v, c) => {
    if (v > quante || (v === quante && gravitaWmo(c) < gravitaWmo(giorno))) { quante = v; giorno = c; }
  });
  // L'ora peggiore, ma solo se c'e' davvero qualcosa da segnalare.
  let peggio = null;
  base.forEach((x) => {
    if (gravitaWmo(x.code) >= 2 && (!peggio || gravitaWmo(x.code) > gravitaWmo(peggio.code))) peggio = x;
  });
  return { giorno, peggio: peggio ? peggio.code : null, ora: peggio ? peggio.ora : null };
};

// Quando è stata scaricata davvero una previsione che arriva dal cloud.
// Qui, a differenza delle revisioni delle voci, limare le date in arrivo si
// PUÒ e si DEVE: non c'è niente da far convergere, c'è solo una foto da
// datare, e una foto non può essere stata scattata domani. Senza questo
// limite un telefono con l'orologio avanti scrive una previsione datata nel
// futuro, quella diventa per giorni la più recente per tutti, nessuno la
// sostituisce più e il campo intero resta appeso a un bollettino morto.
// Quando c'è, si preferisce l'ora del server: non dipende da nessun telefono.
const quandoMeteo = (remote, serverMs, now) => {
  const adesso = now || Date.now();
  const cliente = remote && typeof remote.fetchedAt === 'number' ? remote.fetchedAt : 0;
  const server = typeof serverMs === 'number' && serverMs > 0 ? serverMs : 0;
  return Math.min(server || cliente, adesso);
};
// Aggancio per le prove: la regola sopra si verifica senza aprire Firestore.
if (typeof window !== 'undefined') window.__meteo = { quandoMeteo };

// Dotazione personale base: uguale per tutti, non modificabile dall'app.
// Le voci con emphasis: true sono mostrate in evidenza (piu' grandi e sottolineate).
// Regole dell'accampamento (mostrate in maiuscolo e sottolineate).
// Testo VERBATIM come scritto da Lorenzo: non correggere.
const CAMP_RULES = [
  'Amici, parenti e prole al seguito sono sotto la stretta giurisdizione di chi li ha trascinati qui. Siete i domatori ufficiali delle vostre creature, grandi o piccole che siano: fate in modo che rispettino le regole dell\'accampamento. Istruiteli a dovere anche sull\' attrezzatura da portarsi.',
  'Il vincitore del minigioco Bandy, sarà premiato dal EL Presidente  in una sontuosa cerimonia',
  'Siamo in montagna, non ad Hogwarts. La griglia non si accende per magia, l\'acqua non levita fino alla cucina e le incrostazioni sulle pentole non scompaiono con un incantesimo. E\' richiesto l\'impegno di tutti, per far rilassare tutti.',
  'Il bicchiere di chi sta cuocendo sulla braticola deve essere sempre pieno, adoperatevi di conseguenza se non volete incorrere nelle ire del presidente.',
  'Gli ospiti non fanno ospiti. Niente di personale ovviamente. Per fortuna la montagna offre notevole spazio.',
  'Membri o ospiti single, di ambo i sessi, sono sempre i ben accetti nella tenda del El Presidente.',
  'Se Madre Natura ti offre gentilmente il suo bagno all\'aperto, cerca di essere educato. Usa esclusivamente prodotti che la foresta possa digerire in fretta e lascia tutto pulito e sistemato. Copri o sotterra i fazzolettini biodegradabili ad ogni utilizzo per il bene di tutti.',
];

const BASE_GEAR = [
  { text: 'SEDIA PERSONALE PER ADULTI E EVENTUALI BAMBINI', emphasis: true },
  { text: 'Stoviglie, posate personali e bicchiere riutilizzabile', emphasis: true },
  { text: 'Borraccia' },
  { text: 'Canovacci' },
  { text: 'Luci LED' },
];

// Galleria: quante foto può caricare ciascuno. È un accordo di gruppo, non un
// lucchetto (il nome si sceglie da una tendina, nessuno verifica chi sei):
// serve a far scegliere le foto belle invece di svuotare il rullino.
const PHOTO_CAP_KEY = 'cambusa_photo_cap';
const PHOTO_CAP_DEFAULT = 4;

// Da quando a quando e' durato il campo, guardando i pasti veri invece delle
// date sul calendario: un campo che finisce un giorno prima non deve
// raccontarsi piu' lungo di com'e' stato. Serve al resoconto di chiusura e al
// sottotitolo dell'album, quindi sta qui e non dentro App(): cosi' la usano
// tutti e due senza passarsela.
const intervalloCampo = (campData) => {
  const giorni = Object.keys(campData || {}).filter((d) => {
    const day = (campData || {})[d];
    if (!day) return false;
    const meals = day.meals || {};
    return Object.keys(meals).some((k) => meals[k] && (meals[k].lunch || meals[k].dinner));
  }).sort();
  if (giorni.length) return { from: giorni[0], to: giorni[giorni.length - 1] };
  return { from: CAMP_START, to: CAMP_END };
};

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

