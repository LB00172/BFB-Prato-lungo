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

// Cronologia delle modifiche per la fusione fra dispositivi (vedi sync-merge.js).
const SYNC_META_KEY = 'cambusa_syncmeta';
// Copia di scorta dello stato PRIMA dell'ultima sincronizzazione che ha tolto
// delle voci: è quello che permette di annullarla con un tocco.
const RESCUE_KEY = 'cambusa_rescue';

// Quanto indietro può essere una cancellazione perché valga ancora la pena di
// allarmare. Oltre, non è un disastro in corso: è questo telefono che si mette
// in pari con quello che gli altri hanno già fatto giorni fa, e l'avviso
// spaventerebbe per niente. La copia di scorta si mette da parte lo stesso, e
// resta in Diagnostica: si può sempre annullare.
// L'età si misura con l'orologio del telefono: se è sbagliato, l'avviso può
// comparire di troppo o di meno — non tocca MAI i dati, che dipendono solo
// dalle date delle voci.
const PERDITA_RECENTE = 6 * 60 * 60 * 1000;
// Orologi che non vanno d'accordo. Le date delle modifiche vengono
// dall'orologio di ogni telefono, e il confronto fra due voci dipende SOLO da
// quelle: è la condizione perché tutti i telefoni decidano allo stesso modo.
// Il prezzo è che un telefono con la data avanti vince ogni confronto, per
// sempre, anche con dati vecchi — e in silenzio. Non si può aggiustare
// limando le date in arrivo (due telefoni con "adesso" diverso deciderebbero
// in modo diverso e non convergerebbero più): l'unica cosa giusta è
// accorgersene e dirlo, così quella persona sistema l'ora del telefono.
const OROLOGIO_KEY = 'cambusa_orologio';
const OROLOGIO_SOGLIA = 2 * 24 * 60 * 60 * 1000;
// Le lapidi di uno stesso gesto (cancellare un membro toglie anche tutte le
// sue presenze) portano tutte lo stesso istante: si contano insieme.
const RAFFICA = 2 * 60 * 1000;
// Oltre queste ore la previsione va detta vecchia: d'estate sull'Appennino un
// bollettino di ieri e uno di oggi possono raccontare due giornate diverse, e
// chi guarda deve sapere quale delle due sta leggendo.
const METEO_VECCHIO = 12 * 60 * 60 * 1000;

// ---------- Copie di sicurezza locali ----------
// Gli snapshot giornalieri automatici stanno su Firestore, e il ripristino li
// rilegge da lì: entrambe le cose vogliono la linea. Al campo non c'è, quindi
// per tutti i giorni che contano non esisteva NESSUNA rete di recupero.
// Queste copie stanno dentro il telefono e si fanno da sole, anche in
// modalità aereo. Le foto restano fuori: hanno già il loro posto e
// riempirebbero lo spazio.
const SNAP_KEY = 'cambusa_snap_locali';
const SNAP_QUANTE = 14;                  // 7 giorni × 2 fasce
const SNAP_SPAZIO = 600 * 1024;          // tetto di memoria per l'insieme

// Due fasce al giorno. L'app gira solo quando è aperta, quindi non può
// "svegliarsi" a mezzanotte: la copia della fascia si fa al PRIMO utilizzo
// dentro quella fascia. In pratica: una copia di come stavano le cose la
// mattina, e una di come stavano a mezzogiorno.
const snapFascia = (d) => `${toDateStr(d)}T${d.getHours() < 12 ? '00' : '12'}`;

const snapLocaliLeggi = () => {
  try {
    const v = JSON.parse(localStorage.getItem(SNAP_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch (e) { return {}; }
};

// Le copie vecchie si buttano per numero E per spazio occupato: in un
// telefono con poca memoria libera è più importante non riempire lo spazio
// che tenere sette giorni di storia.
const snapPota = (tutte) => {
  let chiavi = Object.keys(tutte).sort();
  while (chiavi.length > SNAP_QUANTE) { delete tutte[chiavi[0]]; chiavi = chiavi.slice(1); }
  let peso = chiavi.reduce((s, k) => s + (tutte[k].dati || '').length, 0);
  while (peso > SNAP_SPAZIO && chiavi.length > 2) {
    peso -= (tutte[chiavi[0]].dati || '').length;
    delete tutte[chiavi[0]];
    chiavi = chiavi.slice(1);
  }
  return tutte;
};

const snapLocaleSalva = (stato, fascia, quando) => {
  const tutte = snapLocaliLeggi();
  if (tutte[fascia]) return false;
  tutte[fascia] = { at: quando || Date.now(), dati: JSON.stringify(stato) };
  snapPota(tutte);
  // Se la memoria è piena si butta la copia più vecchia e si riprova: meglio
  // perdere la storia lontana che restare senza la copia di adesso.
  for (let tentativi = 0; tentativi < 4; tentativi++) {
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(tutte)); return true; }
    catch (e) {
      const chiavi = Object.keys(tutte).sort();
      if (chiavi.length <= 1) return false;
      delete tutte[chiavi[0]];
    }
  }
  return false;
};

// Legge una copia, accettando anche il vecchio formato (solo testo).
const snapLocaleDati = (v) => (v && typeof v === 'object' ? v.dati : v) || null;

// ---------- Backup su file: quando è stato fatto l'ultimo ----------
const BACKUP_KEY = 'cambusa_backup_data';

// ---------- Registro delle modifiche ----------
// Ogni cambiamento (fatto qui o arrivato dal cloud) finisce in un diario
// locale con data e ora. Non ci sono utenti tracciati, quindi si registra
// almeno DA DOVE arriva: "questo telefono" o "sincronizzazione". Serve a
// rispondere alla domanda che ci siamo fatti dopo la perdita delle presenze:
// chi ha cambiato cosa, e quando.
const LOG_KEY = 'cambusa_registro';
const LOG_MAX = 400;              // oltre, si buttano le più vecchie
const LOG_UNISCI = 60 * 1000;     // stessa voce entro un minuto: si aggiorna

const logLeggi = () => {
  try {
    const v = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
};

// voci: [{ p: percorso, k: 'm' (modifica) | 'd' (cancellazione) }]
const logScrivi = (voci, origine, now) => {
  if (!voci || voci.length === 0) return;
  const t = now || Date.now();
  const reg = logLeggi();
  voci.forEach((v) => {
    // Scrivere in una casella di testo produce una modifica per battuta:
    // se la stessa voce è già stata registrata da poco, si aggiorna l'ora
    // invece di riempire il registro di righe identiche.
    const recente = reg.find((r) => r.p === v.p && r.o === origine && r.k === v.k && t - r.at < LOG_UNISCI);
    if (recente) { recente.at = t; return; }
    reg.unshift({ at: t, p: v.p, k: v.k, o: origine });
  });
  reg.sort((a, b) => b.at - a.at);
  try { localStorage.setItem(LOG_KEY, JSON.stringify(reg.slice(0, LOG_MAX))); }
  catch (e) { /* spazio esaurito: il registro è la prima cosa sacrificabile */ }
};

// Differenza fra due appiattimenti: cosa è nato/cambiato e cosa è sparito.
const diffFlat = (prima, dopo) => {
  const voci = [];
  Object.keys(dopo).forEach((p) => { if (prima[p] !== dopo[p]) voci.push({ p, k: 'm' }); });
  Object.keys(prima).forEach((p) => { if (!(p in dopo)) voci.push({ p, k: 'd' }); });
  return voci;
};

// Sezione dell'app a cui appartiene un percorso: serve a raggruppare il
// registro per area invece di mostrare una lista piatta di sigle.
const SEZIONE_DI = { m: 'Membri', p: 'Lista della Spesa', t: 'Da acquistare', e: 'Attrezzatura', g: 'Dotazioni', s: 'Saldi', x: 'Conto separato', f: 'Giorni gratis' };
const sezioneDiPath = (p) => {
  const parti = String(p).split('|');
  if (parti[0] === 'c') return parti[2] === 'meals' ? 'Presenze' : (parti[3] === 'note' ? 'Menù' : 'Calendario');
  return SEZIONE_DI[parti[0]] || 'Altro';
};

// Nomi dei membri eliminati (id -> nome). Le presenze sono legate all'id, non
// al nome: chi viene eliminato e riaggiunto prende un id nuovo e le sue vecchie
// presenze restano orfane. Questo elenco serve a poterle chiamare per nome.
const EX_MEMBERS_KEY = 'cambusa_exmembri';
const ricordaExMembro = (id, nome) => {
  if (!id || !nome) return;
  try {
    const m = JSON.parse(localStorage.getItem(EX_MEMBERS_KEY) || '{}');
    m[id] = nome;
    localStorage.setItem(EX_MEMBERS_KEY, JSON.stringify(m));
  } catch (e) { /* spazio esaurito: si perde solo il nome */ }
};
const exMembri = () => {
  try { return JSON.parse(localStorage.getItem(EX_MEMBERS_KEY) || '{}'); }
  catch (e) { return {}; }
};

// Traduce i "percorsi" della sincronizzazione in italiano, per poter dire cosa
// è sparito invece di mostrare sigle.
// Un singolo percorso in italiano: serve alla diagnostica, per capire COSA è
// stato cancellato e QUANDO, invece di leggere sigle tipo "c|2026-08-13|meals|k3".
const descriviPath = (p, stato) => {
  const parti = String(p).split('|');
  const nomeMembro = (id) => {
    const m = (stato.members || []).find((x) => x.id === id);
    return m ? m.name : 'una persona non più in elenco';
  };
  const giorno = (d) => {
    try { return parseDate(d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }); }
    catch (e) { return d; }
  };
  const voce = (lista, id, etichetta) => {
    const it = (stato[lista] || []).find((x) => x.id === id);
    return `${etichetta}${it && it.name ? ` "${it.name}"` : ''}`;
  };
  switch (parti[0]) {
    case 'c':
      if (parti[2] === 'meals') return `presenza di ${nomeMembro(parti[3])} — ${giorno(parti[1])}`;
      if (parti[3] === 'note') return `menù del ${giorno(parti[1])}`;
      if (parti[3] === 'appunti') return `note del ${giorno(parti[1])}`;
      if (parti[3] === 'guestsNames') return `ospiti del ${giorno(parti[1])}`;
      return `${parti[3]} del ${giorno(parti[1])}`;
    case 'm': return voce('members', parti[1], 'membro');
    case 'p': return voce('purchases', parti[1], 'spesa');
    case 't': return voce('toBuy', parti[1], 'voce da acquistare');
    case 'e': return voce('equipment', parti[1], 'attrezzatura');
    case 'g': return voce('gear', parti[1], 'dotazione');
    case 's': return 'rimborso segnato come saldato';
    case 'x': return `giorno del conto separato — ${giorno(parti[1])}`;
    case 'f': return `giorno gratis — ${giorno(parti[1])}`;
    default: return p;
  }
};

const descriviPerdite = (paths, stato) => {
  const nome = (id) => {
    const m = (stato.members || []).find((x) => x.id === id);
    return m ? m.name : 'qualcuno';
  };
  const conta = { presenze: 0, membri: 0, spese: 0, lista: 0, attrezzatura: 0, dotazioni: 0, altro: 0 };
  const giorni = new Set();
  const chi = new Set();
  paths.forEach((p) => {
    const parti = p.split('|');
    if (parti[0] === 'c' && parti[2] === 'meals') {
      conta.presenze++; giorni.add(parti[1]); chi.add(nome(parti[3]));
    } else if (parti[0] === 'm') conta.membri++;
    else if (parti[0] === 'p') conta.spese++;
    else if (parti[0] === 't') conta.lista++;
    else if (parti[0] === 'e') conta.attrezzatura++;
    else if (parti[0] === 'g') conta.dotazioni++;
    else conta.altro++;
  });
  const pezzi = [];
  if (conta.presenze) {
    pezzi.push(`${conta.presenze} presenze (${giorni.size} ${giorni.size === 1 ? 'giorno' : 'giorni'}, ${[...chi].slice(0, 4).join(', ')}${chi.size > 4 ? '…' : ''})`);
  }
  if (conta.membri) pezzi.push(`${conta.membri} membri`);
  if (conta.spese) pezzi.push(`${conta.spese} spese`);
  if (conta.lista) pezzi.push(`${conta.lista} voci da acquistare`);
  if (conta.attrezzatura) pezzi.push(`${conta.attrezzatura} attrezzature`);
  if (conta.dotazioni) pezzi.push(`${conta.dotazioni} dotazioni`);
  if (conta.altro) pezzi.push(`${conta.altro} altre voci`);
  return pezzi.join(' · ');
};

// ============================================================================
//  BLOCCO CON PASSWORD
// ============================================================================
// L'impronta della password sta in firebase-config.js (window.APP_LOCK): qui si
// ricalcola l'impronta di quello che viene digitato e si confrontano. La
// password in chiaro non viene mai salvata da nessuna parte.
const LOCK = (typeof window !== 'undefined' && window.APP_LOCK) || null;
const UNLOCK_KEY = 'cambusa_unlock';
// Modalità tecnica: la diagnostica, il registro e gli avvisi della
// sincronizzazione parlano di lapidi, cronologie e voci perse — roba che serve
// a chi tiene i conti e mette ansia a tutti gli altri. Si accende per telefono,
// con una password sua (impronta in firebase-config.js, window.APP_ADMIN).
const ADMIN_KEY = 'cambusa_admin';
const LOCK_ALWAYS_KEY = 'cambusa_lock_always';
const FAIL_KEY = 'cambusa_lock_fail';
const UNTIL_KEY = 'cambusa_lock_until';

const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (s) => new Uint8Array((String(s).match(/.{2}/g) || []).map((h) => parseInt(h, 16)));

// Ritorna l'impronta di una password secondo una configurazione {salt, iter},
// o null se il browser non offre le funzioni crittografiche (servono https
// oppure localhost). Usata sia dal blocco sia dalla modalità tecnica.
async function improntaPassword(pwd, cfg) {
  const subtle = window.crypto && window.crypto.subtle;
  if (!subtle || !cfg || !cfg.salt) return null;
  const base = await subtle.importKey('raw', new TextEncoder().encode(pwd), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(cfg.salt), iterations: cfg.iter || 200000, hash: 'SHA-256' },
    base, 256);
  return toHex(bits);
}

async function derivePassword(pwd) {
  return LOCK ? improntaPassword(pwd, LOCK) : null;
}

// Password digitata in questa sessione: serve per entrare nel database con
// l'utente condiviso. Vive solo in memoria, non viene mai salvata.
let sessionPassword = null;

const lockAlways = () => localStorage.getItem(LOCK_ALWAYS_KEY) === '1';
// Sbloccato = da qualche parte c'è l'impronta giusta. Con "chiedi ogni volta"
// si usa la memoria di sessione, che si svuota chiudendo l'app.
const isUnlocked = () => {
  if (!LOCK || !LOCK.hash) return true;
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === LOCK.hash ||
      (!lockAlways() && localStorage.getItem(UNLOCK_KEY) === LOCK.hash);
  } catch (e) {
    return false;
  }
};
const rememberUnlock = () => {
  try {
    sessionStorage.setItem(UNLOCK_KEY, LOCK.hash);
    if (!lockAlways()) localStorage.setItem(UNLOCK_KEY, LOCK.hash);
    localStorage.removeItem(FAIL_KEY);
    localStorage.removeItem(UNTIL_KEY);
  } catch (e) { /* memoria non disponibile: resta sbloccato solo per ora */ }
};
const forgetUnlock = () => {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
    localStorage.removeItem(UNLOCK_KEY);
  } catch (e) { /* ignora */ }
};

// ---------- Tema (chiaro / scuro / automatico) ----------
const THEME_KEY = 'cambusa_theme';
const readTheme = () => {
  const t = localStorage.getItem(THEME_KEY);
  return t === 'light' || t === 'dark' ? t : 'auto';
};
// Applica il tema al documento: da qui dipende il CSS in index.html.
const applyTheme = (pref) => {
  const dark = pref === 'dark' ||
    (pref === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  if (dark) root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#1a201a' : '#2D392C');
  return dark;
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const money = (n) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
// Numero >= 0 a partire da una stringa di input.
const posNum = (v) => Math.max(0, parseFloat(v) || 0);

// "note" tiene il MENÙ del giorno (la scheda Menù scrive lì da sempre);
// "appunti" sono le note libere del Calendario. Due campi distinti: unirli
// vorrebbe dire che chi scrive la lista della cena cancella il promemoria
// della legna.
const initialDayState = () => ({ note: '', appunti: '', guestsNames: '', meals: {} });

// ---- Dati per farsi rimborsare (PayPal / IBAN) ----
// L'IBAN si controlla davvero: una lettera sbagliata manda i soldi altrove (o
// li fa rimbalzare dopo giorni). Controllo standard mod-97 (ISO 13616).
const ibanClean = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const ibanPretty = (v) => ibanClean(v).replace(/(.{4})/g, '$1 ').trim();
const ibanValid = (v) => {
  const s = ibanClean(v);
  if (s.length < 15 || s.length > 34 || !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false;
  const rot = s.slice(4) + s.slice(0, 4);
  let resto = 0;
  for (let i = 0; i < rot.length; i++) {
    const c = rot.charCodeAt(i);
    const n = c >= 65 ? c - 55 : c - 48;   // A=10 … Z=35
    resto = (resto * (n > 9 ? 100 : 10) + n) % 97;
  }
  return resto === 1;
};

// Copia negli appunti, con ripiego per i browser che non danno il permesso.
const copyToClipboard = (testo) => {
  const t = String(testo || '');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(t).then(() => true).catch(() => false);
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve(ok);
  } catch (e) { return Promise.resolve(false); }
};

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

// ============================================================================
//  MINI GIOCO "Aiuta Bandy" — snake in canvas, tutto offline.
//  La canna cresce ogni volta che raccoglie Bandy. Sfondo: bosco visto
//  dall'alto, generato a pixel (nessuna immagine da scaricare).
// ============================================================================
const GAME_COLS = 15;
const BASE_STEP = 170;   // millisecondi per passo al livello 1
const BASE_LEN = 3;      // lunghezza di partenza a ogni livello
const LEVEL_EVERY = 15;  // Bandy necessari per salire di livello
const LEVEL_SPEEDUP = 1.5; // di quanto accelera a ogni livello
const MIN_STEP = 45;     // limite di velocità: sotto diventa ingiocabile
const GAME_ROWS = 19;

// I livelli hanno un nome, non un numero: si parte dal campo, si passa per la
// borgata e si finisce a Rio. Oltre il terzo si resta a Rio e cambia solo la
// velocità, quindi il nome resta quello con un'aggiunta.
const LIVELLI = [
  { nome: 'Prato Lungo', icona: '🌲' },
  { nome: 'Palmiro Togliatti', icona: '🏙️' },
  { nome: 'Rio de Janeiro', icona: '🏖️' },
  { nome: 'Thailandia', icona: '🌃' },
];
const livelloInfo = (n) => LIVELLI[Math.min(n, LIVELLI.length) - 1] || LIVELLI[0];

// Rumore deterministico: lo sfondo è sempre lo stesso ad ogni partita.
const seeded = (n) => { let s = n * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };

// Grana del disegno: quanto è grande un "pixel" dell'arte rispetto a una
// casella. Stava a cell/5 e con la tela a 360 px veniva una scacchiera da 72
// quadretti in larghezza: troppo grossa per far leggere un bosco. Ora la tela
// è a 720 (stesso rapporto, il doppio dei pixel veri, quindi nitida sui
// telefoni che hanno lo schermo denso) e la grana è più fine: 120 quadretti in
// larghezza, che è ancora pixel art ma ha lo spazio per l'ombra di un albero.
const GRANA = 8;
const pxArte = (cell) => Math.max(2, Math.round(cell / GRANA));

function drawForest(ctx, w, h, cell) {
  const rnd = seeded(7);
  const px = pxArte(cell);
  const q = (v) => Math.round(v / px) * px;

  // Disco a blocchi con una funzione di tinta: serve a chiome e cespugli.
  // Prende la distanza dal centro (0 al centro, 1 al bordo) e la direzione
  // della luce, così la chioma ha un volume invece di essere un disco piatto.
  const disco = (cx, cy, r, tinta) => {
    for (let y = cy - r; y <= cy + r; y += px) {
      for (let x = cx - r; x <= cx + r; x += px) {
        const dx = x + px / 2 - cx, dy = y + px / 2 - cy;
        const d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d > 1) continue;
        const col = tinta(d, dx / r, dy / r);
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(q(x), q(y), px, px);
      }
    }
  };

  // --- 1) Terreno: non un verde solo, ma sottobosco a chiazze con la terra
  // che si intravede. È quello che toglie l'effetto "moquette verde". ---
  const suolo = ['#233420', '#1D2B1A', '#2A3E24', '#20321D'];
  ctx.fillStyle = suolo[0];
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += px) {
    for (let x = 0; x < w; x += px) {
      const r = rnd();
      ctx.fillStyle = r > 0.88 ? suolo[2] : r > 0.72 ? suolo[1] : r > 0.62 ? suolo[3] : suolo[0];
      ctx.fillRect(x, y, px, px);
    }
  }
  // chiazze di terra battuta, dove il bosco si dirada
  for (let i = 0; i < 9; i++) {
    const cx = q(rnd() * w), cy = q(rnd() * h), r = cell * (0.5 + rnd() * 0.9);
    disco(cx, cy, r, (d) => {
      if (d > 0.75 && rnd() > 0.45) return null;      // bordo sfrangiato
      return d > 0.5 ? '#26301C' : '#2D3720';
    });
  }

  // --- 2) Ciuffi d'erba e felci: tratti corti e chiari sparsi ---
  for (let i = 0; i < 260; i++) {
    const x = q(rnd() * w), y = q(rnd() * h);
    const alto = rnd() > 0.6;
    ctx.fillStyle = rnd() > 0.5 ? '#3E6B33' : '#356029';
    ctx.fillRect(x, y, px, alto ? px * 3 : px * 2);
    if (rnd() > 0.7) ctx.fillRect(x + px, y + px, px, px * 2);
  }

  // --- 3) Sassi: piccoli gruppi grigio-verdi, con la loro ombra ---
  for (let i = 0; i < 8; i++) {
    const cx = q(rnd() * w), cy = q(rnd() * h), r = px * (1.2 + rnd() * 1.4);
    disco(cx + px, cy + px, r, () => 'rgba(10,18,10,0.45)');
    disco(cx, cy, r, (d, ux, uy) => (ux + uy < -0.3 ? '#5E6356' : d > 0.7 ? '#3C4137' : '#4B5045'));
  }

  // --- 4) Tronchi caduti: danno scala e dicono "bosco" più di mille foglie ---
  for (let i = 0; i < 3; i++) {
    const x = q(rnd() * (w - cell * 4)), y = q(cell + rnd() * (h - cell * 3));
    const lung = q(cell * (2.2 + rnd() * 1.8)), spess = q(px * 3);
    ctx.fillStyle = 'rgba(10,18,10,0.4)';
    ctx.fillRect(x + px, y + px * 2, lung, spess);
    ctx.fillStyle = '#4A3526';
    ctx.fillRect(x, y, lung, spess);
    ctx.fillStyle = '#5C4433';                       // lato illuminato
    ctx.fillRect(x, y, lung, px);
    ctx.fillStyle = '#33241A';                       // nodi e crepe, irregolari
    for (let k = x + px; k < x + lung - px; k += px) {
      if (rnd() > 0.72) ctx.fillRect(k, y + px * (1 + Math.floor(rnd() * 2)), px, px);
    }
  }

  // --- 5) Gli alberi ---
  // Tre misure, chiome con volume (bordo scuro, cuore chiaro, luce in alto a
  // sinistra), ombra portata in basso a destra e qualche ciuffo più scuro
  // dentro. Prima erano dischi piatti a scacchi: da lì l'aria da moquette.
  const specie = [
    { bordo: '#16280F', scuro: '#1F3A18', medio: '#2C5122', chiaro: '#3B6B2E', luce: '#4F8A3C' },
    { bordo: '#152412', scuro: '#1D3520', medio: '#28492B', chiaro: '#356139', luce: '#457A49' },
    { bordo: '#1B2A0E', scuro: '#264014', medio: '#365A1D', chiaro: '#487628', luce: '#5E9636' },
  ];
  const alberi = [];
  const mettiAlbero = (cx, cy, r) => {
    const sp = specie[Math.floor(rnd() * specie.length)];
    // ombra portata: è quello che stacca la chioma dal terreno
    disco(cx + r * 0.16, cy + r * 0.2, r * 0.98, (d) => (d > 0.9 ? null : 'rgba(8,16,8,0.42)'));
    // chioma
    disco(cx, cy, r, (d, ux, uy) => {
      if (d > 0.94 && rnd() > 0.5) return null;       // bordo frastagliato
      const luceQui = (-ux - uy) * 0.5;               // luce da in alto a sinistra
      const t = d - luceQui * 0.35;
      if (t > 0.86) return sp.bordo;
      if (t > 0.6) return sp.scuro;
      if (t > 0.32) return sp.medio;
      if (t > 0.05) return sp.chiaro;
      return sp.luce;
    });
    // ciuffi di fogliame più scuro, per non farla sembrare una palla liscia
    const ciuffi = 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < ciuffi; k++) {
      const a = rnd() * Math.PI * 2, dist = r * (0.25 + rnd() * 0.5);
      disco(q(cx + Math.cos(a) * dist), q(cy + Math.sin(a) * dist), r * (0.16 + rnd() * 0.13),
        (d) => (d > 0.8 ? null : d > 0.45 ? sp.medio : sp.chiaro));
    }
    alberi.push({ cx, cy, r });
  };

  // Prima i grandi, poi i medi, poi i cespugli: si sovrappongono e il bosco
  // sembra fitto invece che a pois.
  for (let i = 0; i < 9; i++) mettiAlbero(q(rnd() * w), q(rnd() * h), cell * (1.15 + rnd() * 0.55));
  for (let i = 0; i < 14; i++) mettiAlbero(q(rnd() * w), q(rnd() * h), cell * (0.7 + rnd() * 0.35));
  for (let i = 0; i < 14; i++) {
    const cx = q(rnd() * w), cy = q(rnd() * h), r = cell * (0.3 + rnd() * 0.22);
    disco(cx + r * 0.2, cy + r * 0.25, r, (d) => (d > 0.9 ? null : 'rgba(8,16,8,0.35)'));
    disco(cx, cy, r, (d, ux, uy) => {
      if (d > 0.9 && rnd() > 0.4) return null;
      const t = d - (-ux - uy) * 0.2;
      return t > 0.75 ? '#1E3618' : t > 0.4 ? '#2B4C22' : '#3A6630';
    });
  }
}

// Livello 2: strada vista dall'alto. Due corsie, rotaie del tram al centro,
// e ai bordi si intravedono i portoni dei palazzi.
function drawStreet(ctx, w, h, cell) {
  const rnd = seeded(23);
  const px = pxArte(cell);
  const edge = cell * 1.1;               // fascia dei palazzi a destra e sinistra

  // asfalto
  ctx.fillStyle = '#3A3A3E';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += px) {
    for (let x = edge; x < w - edge; x += px) {
      const r = rnd();
      if (r > 0.9) { ctx.fillStyle = '#43434A'; ctx.fillRect(x, y, px, px); }
      else if (r > 0.82) { ctx.fillStyle = '#333338'; ctx.fillRect(x, y, px, px); }
    }
  }

  // marciapiedi + palazzi ai due bordi, con portoni appena visibili
  [0, w - edge].forEach((bx, side) => {
    ctx.fillStyle = '#6E6A63';
    ctx.fillRect(bx, 0, edge, h);
    ctx.fillStyle = '#5C5851';
    for (let y = 0; y < h; y += px * 3) ctx.fillRect(bx, y, edge, px);   // lastre
    // portoni: rettangoli scuri con architrave chiara
    for (let y = cell * 1.2; y < h - cell; y += cell * 3.4) {
      const dw = edge * 0.62, dh = cell * 1.5;
      const dx = side === 0 ? bx + edge - dw : bx;
      ctx.fillStyle = '#4A3526';
      ctx.fillRect(dx, y, dw, dh);
      ctx.fillStyle = '#2E2119';
      ctx.fillRect(dx + px, y + px, dw - px * 2, dh - px * 2);
      ctx.fillStyle = '#8A8078';
      ctx.fillRect(dx, y - px, dw, px);
      ctx.fillStyle = '#C9A227';                    // maniglia
      ctx.fillRect(side === 0 ? dx + px : dx + dw - px * 2, y + dh / 2, px, px);
    }
  });

  // strisce di mezzeria tratteggiate delle due corsie
  ctx.fillStyle = '#D8D3C4';
  [w * 0.3, w * 0.7].forEach((lx) => {
    for (let y = 0; y < h; y += cell * 1.6) ctx.fillRect(lx - px / 2, y, px, cell * 0.8);
  });

  // rotaie del tram al centro
  const cx = w / 2, gauge = cell * 0.9;
  ctx.fillStyle = '#4E4A46';
  ctx.fillRect(cx - gauge / 2 - px, 0, gauge + px * 2, h);   // massicciata
  ctx.fillStyle = '#6B4A32';
  for (let y = 0; y < h; y += cell * 0.9) ctx.fillRect(cx - gauge / 2 - px, y, gauge + px * 2, px); // traversine
  [cx - gauge / 2, cx + gauge / 2].forEach((rx) => {
    ctx.fillStyle = '#B9BCC2';
    ctx.fillRect(rx - px / 2, 0, px, h);
    ctx.fillStyle = '#8E9298';
    ctx.fillRect(rx + px / 2, 0, Math.max(1, px / 2), h);
  });
}

// Livello 3: la spiaggia di Rio vista dall'alto. Fasce verticali come il
// livello 2 — mare, risacca, sabbia bagnata, sabbia asciutta, lungomare —
// così il campo da gioco resta leggibile: la sabbia chiara al centro è dove
// si gioca davvero, e il corpo scuro del livello 3 ci si stacca sopra.
const BR = { verde: '#1E9C4A', giallo: '#F5D311', blu: '#17297A', bianco: '#F4F2EA' };

// Bandiera brasiliana in miniatura, a blocchi: campo verde, rombo giallo,
// cerchio blu. Serve a dire "Rio" senza scriverlo.
function drawFlag(ctx, x, y, w, h, px) {
  const q = (v) => Math.round(v / px) * px;
  const X = q(x), Y = q(y), W = q(w), H = q(h);
  // asta
  ctx.fillStyle = '#6B5636';
  ctx.fillRect(X - px, Y, px, H + px * 3);
  ctx.fillStyle = BR.verde;
  ctx.fillRect(X, Y, W, H);
  // rombo giallo
  const cx = X + W / 2, cy = Y + H / 2, rw = W * 0.38, rh = H * 0.38;
  ctx.fillStyle = BR.giallo;
  for (let py = Y; py < Y + H; py += px) {
    for (let pxx = X; pxx < X + W; pxx += px) {
      const dx = Math.abs(pxx + px / 2 - cx) / rw;
      const dy = Math.abs(py + px / 2 - cy) / rh;
      if (dx + dy <= 1) ctx.fillRect(pxx, py, px, px);
    }
  }
  // cerchio blu
  const r = Math.min(rw, rh) * 0.62;
  ctx.fillStyle = BR.blu;
  for (let py = Y; py < Y + H; py += px) {
    for (let pxx = X; pxx < X + W; pxx += px) {
      const dx = pxx + px / 2 - cx, dy = py + px / 2 - cy;
      if (dx * dx + dy * dy <= r * r) ctx.fillRect(pxx, py, px, px);
    }
  }
  // la fascia bianca dell'"Ordem e Progresso": una riga sola, basta a leggerla
  ctx.fillStyle = BR.bianco;
  ctx.fillRect(q(cx - r * 0.8), q(cy - px / 2), q(r * 1.6), px);
}

function drawBeach(ctx, w, h, cell) {
  const rnd = seeded(41);
  const px = pxArte(cell);
  const q = (v) => Math.round(v / px) * px;

  // Le fasce sono strette ai bordi e larghe al centro: la sabbia asciutta è il
  // campo da gioco vero, e deve tenersi la parte grossa. Mare e lungomare
  // servono a dire dove siamo, non a rubare spazio.
  const mare = q(w * 0.17);        // acqua
  const risacca = q(w * 0.21);     // schiuma
  const bagnata = q(w * 0.27);     // sabbia bagnata
  const lungomare = q(w * 0.88);   // inizio del calçadão

  // --- Mare: l'acqua è fatta di onde lunghe che corrono verso riva, non di
  // rumore. Ogni colonna prende il tono dalla distanza dalla riva più una
  // sinusoide lungo y: si legge come mare mosso invece che come disturbo. ---
  const toni = ['#12557E', '#175F91', '#1B6D9E', '#2280B4', '#2E93C4', '#43A6CE'];
  for (let x = 0; x < mare; x += px) {
    const t = x / mare;
    for (let y = 0; y < h; y += px) {
      const onda = Math.sin(y / (cell * 1.9) + t * 5.2) * 0.5 + 0.5;
      const k = Math.min(toni.length - 1, Math.floor(t * 3.4 + onda * 2.2));
      ctx.fillStyle = toni[k];
      ctx.fillRect(x, y, px, px);
    }
  }
  // creste di schiuma: tre linee spesse che seguono l'onda
  for (let k = 0; k < 3; k++) {
    const base = q(mare * (0.28 + k * 0.24));
    for (let y = 0; y < h; y += px) {
      const off = q(Math.sin(y / (cell * 1.9) + k * 1.1) * cell * 0.3);
      ctx.fillStyle = '#9FDCEC';
      ctx.fillRect(base + off, y, px, px);
      ctx.fillStyle = '#D6F0F7';
      ctx.fillRect(base + off, y, px, Math.max(1, Math.round(px / 2)));
    }
  }

  // --- Risacca: schiuma bianca, bordo frastagliato ---
  for (let y = 0; y < h; y += px) {
    const off = q(Math.sin(y / (cell * 1.1)) * cell * 0.18);
    for (let x = mare; x < risacca; x += px) {
      ctx.fillStyle = rnd() > 0.3 ? BR.bianco : '#D9EDF3';
      ctx.fillRect(x + off, y, px, px);
    }
  }

  // --- Sabbia bagnata: la striscia scura appena lasciata dall\'onda ---
  for (let x = risacca; x < bagnata; x += px) {
    for (let y = 0; y < h; y += px) {
      ctx.fillStyle = rnd() > 0.8 ? '#B99A6B' : '#C6A878';
      ctx.fillRect(x, y, px, px);
    }
  }

  // --- Sabbia asciutta: chiara e poco rumorosa, ci si deve giocare sopra ---
  for (let x = bagnata; x < lungomare; x += px) {
    for (let y = 0; y < h; y += px) {
      const r = rnd();
      ctx.fillStyle = r > 0.96 ? '#F2E0BC' : r > 0.9 ? '#E3C998' : '#EAD3A6';
      ctx.fillRect(x, y, px, px);
    }
  }

  // --- Lungomare di Copacabana: il mosaico a onde bianco e nero ---
  ctx.fillStyle = BR.bianco;
  ctx.fillRect(lungomare, 0, w - lungomare, h);
  ctx.fillStyle = '#2A2A2E';
  const larg = w - lungomare;
  for (let y = 0; y < h; y += px) {
    const s = Math.sin(y / (cell * 1.1));
    ctx.fillRect(q(lungomare + larg * 0.28 + s * larg * 0.2), y, px * 2, px);
    ctx.fillRect(q(lungomare + larg * 0.74 - s * larg * 0.2), y, px * 2, px);
  }
  ctx.fillStyle = '#9A8A6E';                      // cordolo
  ctx.fillRect(lungomare - px, 0, px, h);

  // --- Ombrelloni: pochi e grandi, altrimenti sembrano girandole ---
  const tinte = [['#E23B2E', '#F4F2EA'], ['#F5D311', '#1E9C4A'], ['#1B7FC4', '#F4F2EA']];
  const posti = [[0.62, 0.09], [0.30, 0.30], [0.10, 0.56], [0.80, 0.71], [0.52, 0.91]];
  posti.forEach((pp, idx) => {
    const cx = q(bagnata + (lungomare - bagnata) * pp[0]);
    const cy = q(h * pp[1]);
    const r = cell * 1.05;
    const [a, b] = tinte[idx % tinte.length];
    // ombra portata
    ctx.fillStyle = 'rgba(150,120,80,0.28)';
    for (let y = cy - r; y < cy + r; y += px) {
      for (let x = cx - r; x < cx + r; x += px) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r) ctx.fillRect(q(x) + px * 1.5, q(y) + px * 1.5, px, px);
      }
    }
    // sei spicchi: a questa dimensione si leggono come un ombrellone
    for (let y = cy - r; y < cy + r; y += px) {
      for (let x = cx - r; x < cx + r; x += px) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const ang = Math.atan2(dy, dx) + Math.PI;
        ctx.fillStyle = Math.floor(ang / (Math.PI / 3)) % 2 ? a : b;
        ctx.fillRect(q(x), q(y), px, px);
      }
    }
    // bordo e puntale
    ctx.fillStyle = 'rgba(90,70,40,0.35)';
    for (let t = 0; t < Math.PI * 2; t += 0.12) ctx.fillRect(q(cx + Math.cos(t) * r), q(cy + Math.sin(t) * r), px, px);
    ctx.fillStyle = '#5B4A32';
    ctx.fillRect(q(cx) - px, q(cy) - px, px * 2, px * 2);
  });

  // --- Teli stesi: rettangoli con la frangia, per non lasciare la sabbia vuota ---
  [[0.14, 0.20, '#E23B2E'], [0.56, 0.58, '#1B7FC4'], [0.84, 0.90, '#F5D311']]
    .forEach((t) => {
      const x = q(bagnata + (lungomare - bagnata) * t[0]);
      const y = q(h * t[1]);
      const tw = q(cell * 1.5), th = q(cell * 1.0);
      ctx.fillStyle = 'rgba(150,120,80,0.25)';
      ctx.fillRect(x + px, y + px, tw, th);
      ctx.fillStyle = t[2];
      ctx.fillRect(x, y, tw, th);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';       // righe del telo
      for (let k = y + px; k < y + th; k += px * 3) ctx.fillRect(x, k, tw, px);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';             // frangia ai due lati corti
      ctx.fillRect(x, y, tw, px);
      ctx.fillRect(x, y + th - px, tw, px);
    });

  // --- Bandiere: due piantate nella sabbia, una sul lungomare ---
  const fw = cell * 2.1, fh = cell * 1.4;
  drawFlag(ctx, bagnata + cell * 0.5, cell * 0.5, fw, fh, px);
  drawFlag(ctx, bagnata + (lungomare - bagnata) * 0.62, h * 0.42, fw, fh, px);
  drawFlag(ctx, bagnata + cell * 0.5, h - cell * 3.1, fw, fh, px);
  drawFlag(ctx, lungomare + larg * 0.1, h * 0.06, fw * 0.62, fh * 0.62, px);
}

// Livello 4: la strada dei night club in Thailandia, di notte. Stessa
// impaginazione a fasce verticali degli altri livelli — locali ai due lati,
// asfalto in mezzo — ma al buio: l'asfalto è scuro, i locali sono insegne al
// neon e la luce si riflette sulla strada bagnata.
const TH = { rosso: '#D82B3C', blu: '#1B2C6B', bianco: '#F2F0EA' };
const NEON = ['#FF3DA5', '#2BE5F0', '#FFD93B', '#5BFF9E', '#B14CFF'];

// Bandiera thailandese: cinque bande orizzontali rosso-bianco-blu-bianco-rosso,
// con quella blu doppia. È l'unica cosa che dice "Thailandia" a colpo d'occhio.
function drawThaiFlag(ctx, x, y, w, h, px) {
  const q = (v) => Math.round(v / px) * px;
  const X = q(x), Y = q(y), W = q(w);
  const u = Math.max(px, q(h / 6));            // banda unitaria: 1-1-2-1-1
  ctx.fillStyle = '#7A6647';
  ctx.fillRect(X - px, Y, px, u * 6 + px * 3); // asta
  const bande = [[TH.rosso, 1], [TH.bianco, 1], [TH.blu, 2], [TH.bianco, 1], [TH.rosso, 1]];
  let cy = Y;
  bande.forEach(([col, n]) => {
    ctx.fillStyle = col;
    ctx.fillRect(X, cy, W, u * n);
    cy += u * n;
  });
}

function drawThai(ctx, w, h, cell) {
  const rnd = seeded(59);
  const px = pxArte(cell);
  const q = (v) => Math.round(v / px) * px;
  const bordo = q(cell * 1.9);                 // fascia dei locali, per lato

  // --- Asfalto notturno: scuro ma non nero, altrimenti il corpo ci sparisce ---
  for (let x = 0; x < w; x += px) {
    for (let y = 0; y < h; y += px) {
      const r = rnd();
      ctx.fillStyle = r > 0.93 ? '#2E2739' : r > 0.85 ? '#1B1723' : '#241F2B';
      ctx.fillRect(x, y, px, px);
    }
  }

  // --- Mezzeria tratteggiata, sbiadita: di notte si vede poco ---
  ctx.fillStyle = '#6B6350';
  for (let y = 0; y < h; y += cell * 1.7) ctx.fillRect(q(w / 2) - px / 2, y, px, q(cell * 0.9));

  // --- I locali ai due lati: facciata, porta buia, insegna al neon ---
  // L'insegna sporge sulla strada, come le tabelle luminose vere: è quello che
  // fa leggere "strada di locali" invece di "strada scura".
  const locali = [];
  [0, w - bordo].forEach((bx, lato) => {
    ctx.fillStyle = '#544A63';
    ctx.fillRect(bx, 0, bordo, h);
    ctx.fillStyle = '#463D55';
    for (let y = 0; y < h; y += px * 4) ctx.fillRect(bx, y, bordo, px);   // lastre
    // cordolo verso la strada: separa il marciapiede dall'asfalto
    ctx.fillStyle = '#6E melon';
    ctx.fillStyle = '#75688A';
    ctx.fillRect(lato === 0 ? bx + bordo - px : bx, 0, px, h);

    let y = q(cell * 0.6);
    let i = lato;
    while (y < h - cell * 1.6) {
      const alt = q(cell * (1.7 + rnd() * 0.9));
      const col = NEON[i % NEON.length];
      // facciata: ogni locale ha il suo tono, così si contano
      ctx.fillStyle = i % 2 ? '#5E5270' : '#4C4260';
      ctx.fillRect(bx, y, bordo, alt);
      ctx.fillStyle = '#3B3349';                            // divisorio fra locali
      ctx.fillRect(bx, y, bordo, px);
      // ingresso: rettangolo nero con lo stipite acceso al neon
      const pw = q(bordo * 0.66), ph = q(alt * 0.5);
      const pxx = lato === 0 ? bx + bordo - pw - px : bx + px;
      const py0 = q(y + alt * 0.25);
      ctx.fillStyle = col;
      ctx.fillRect(pxx - px, py0 - px, pw + px * 2, ph + px * 2);
      ctx.fillStyle = '#0E0A14';
      ctx.fillRect(pxx, py0, pw, ph);
      // insegna che sporge sulla strada
      const sw = q(cell * 1.15), sh = q(cell * 0.62);
      const sx = lato === 0 ? bx + bordo : bx - sw;
      const sy = q(y + alt * 0.3);
      ctx.fillStyle = '#171320';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = col;
      ctx.fillRect(sx, sy, sw, px);
      ctx.fillRect(sx, sy + sh - px, sw, px);
      ctx.fillRect(sx, sy, px, sh);
      ctx.fillRect(sx + sw - px, sy, px, sh);
      // "scritta" al neon: due righe di lettere finte. Con la grana grossa di
      // prima era un trattino solo; ora ci stanno e l'insegna si legge come
      // un'insegna invece che come un rettangolo colorato.
      ctx.fillStyle = col;
      [q(sy + sh * 0.32), q(sy + sh * 0.6)].forEach((ry, riga) => {
        for (let k = sx + px * 2; k < sx + sw - px * 2; k += px * 3) {
          if (riga === 1 && rnd() > 0.75) continue;   // seconda riga più corta
          ctx.fillRect(k, ry, px * 2, px);
        }
      });
      locali.push({ x: sx + sw / 2, y: sy + sh / 2, col, lato });
      y += alt + q(cell * 0.35);
      i++;
    }
  });

  // --- Aloni e riflessi sull'asfalto bagnato ---
  // Prima gli aloni attorno alle insegne, poi le colate verticali di luce
  // verso il centro strada: è quello che dà la notte piovosa.
  locali.forEach((l) => {
    const r = cell * 2.2;
    for (let y = l.y - r; y < l.y + r; y += px) {
      for (let x = l.x - r; x < l.x + r; x += px) {
        const dx = x - l.x, dy = y - l.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        const a = (1 - d / r) * 0.11;
        ctx.fillStyle = l.col;
        ctx.globalAlpha = a;
        ctx.fillRect(q(x), q(y), px, px);
      }
    }
    ctx.globalAlpha = 1;
    // colata sull'asfalto verso il centro
    const verso = l.lato === 0 ? 1 : -1;
    for (let k = 0; k < cell * 3.2; k += px) {
      ctx.globalAlpha = 0.10 * (1 - k / (cell * 3.2));
      ctx.fillStyle = l.col;
      const larg = q(cell * 0.5 + k * 0.25);
      ctx.fillRect(q(l.x + verso * k), q(l.y - larg / 2), px, larg);
    }
    ctx.globalAlpha = 1;
  });

  // --- Pozzanghere: asfalto bagnato che rimanda il neon ---
  // Restano scure e poco contrastate: sono atmosfera, non devono disturbare
  // la lettura del corpo che ci passa sopra.
  [[0.30, 0.42, NEON[0]], [0.70, 0.18, NEON[1]], [0.58, 0.86, NEON[3]]].forEach((pz) => {
    const cx = q(w * pz[0]), cy = q(h * pz[1]);
    const rx = cell * 1.5, ry = cell * 0.75;
    for (let y = cy - ry; y < cy + ry; y += px) {
      for (let x = cx - rx; x < cx + rx; x += px) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        ctx.fillStyle = '#1A1622';
        ctx.fillRect(q(x), q(y), px, px);
      }
    }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = pz[2];
    for (let y = cy - ry; y < cy + ry; y += px * 2) {
      const largh = q(rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)) * 0.7);
      ctx.fillRect(q(cx - largh / 2), q(y), largh, px);
    }
    ctx.globalAlpha = 1;
  });

  // --- Palme lungo il bordo strada, viste dall'alto ---
  // Un tronco e le foglie che partono a raggiera: dall'alto una palma è
  // questo, ed è il secondo segnale (dopo le bandiere) che dice dove siamo.
  const palma = (cx, cy) => {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.3;
      for (let t = px; t < cell * 1.25; t += px) {
        ctx.fillRect(q(cx + Math.cos(a) * t + px), q(cy + Math.sin(a) * t + px), px, px);
      }
    }
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + 0.3;
      const lung = cell * (0.95 + (k % 3) * 0.18);
      for (let t = px; t < lung; t += px) {
        const largo = t < lung * 0.5 ? px * 3 : t < lung * 0.8 ? px * 2 : px;
        ctx.fillStyle = t < lung * 0.45 ? '#2F6B34' : '#23522A';
        ctx.fillRect(q(cx + Math.cos(a) * t), q(cy + Math.sin(a) * t), largo, largo);
      }
    }
    ctx.fillStyle = '#5B4326';
    ctx.fillRect(q(cx) - px, q(cy) - px, px * 3, px * 3);
  };
  [0.16, 0.52, 0.88].forEach((fy, i) => {
    palma(q(bordo + cell * 1.15), q(h * fy));
    palma(q(w - bordo - cell * 1.15), q(h * (fy + (i % 2 ? -0.13 : 0.13))));
  });

  // --- Motorini in fila contro il marciapiede ---
  [[0.30, 0, '#C8342F'], [0.66, 0, '#2E7FD6'], [0.44, 1, '#D8B62A'], [0.80, 1, '#8C4FD0']].forEach((mt) => {
    const lato = mt[1];
    const cx = q(lato === 0 ? bordo + cell * 0.42 : w - bordo - cell * 0.42);
    const cy = q(h * mt[0]);
    const lu = q(cell * 0.95), la = q(cell * 0.42);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - la / 2 + px, cy - lu / 2 + px, la, lu);
    ctx.fillStyle = mt[2];
    ctx.fillRect(cx - la / 2, cy - lu / 2, la, lu);
    ctx.fillStyle = '#141019';                                  // sella
    ctx.fillRect(cx - la / 2, q(cy - lu * 0.05), la, q(lu * 0.3));
    ctx.fillStyle = '#D9D4C6';                                  // specchietti
    ctx.fillRect(cx - la / 2 - px, cy - lu / 2, px, px);
    ctx.fillRect(cx + la / 2, cy - lu / 2, px, px);
  });

  // --- Due tuk-tuk fermi in mezzo alla strada, visti dall'alto ---
  [[0.38, 0.28, '#FFD93B'], [0.62, 0.68, '#5BFF9E']].forEach((t) => {
    const cx = q(w * t[0]), cy = q(h * t[1]);
    const tw = q(cell * 1.05), th = q(cell * 1.7);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';                         // ombra
    ctx.fillRect(cx - tw / 2 + px * 2, cy - th / 2 + px * 2, tw, th);
    ctx.fillStyle = '#2A2536';                                  // ruote ai lati
    [cy - th * 0.28, cy + th * 0.3].forEach((wy) => {
      ctx.fillRect(cx - tw / 2 - px, q(wy), px, q(cell * 0.3));
      ctx.fillRect(cx + tw / 2, q(wy), px, q(cell * 0.3));
    });
    ctx.fillStyle = t[2];                                       // tettuccio
    ctx.fillRect(cx - tw / 2, cy - th / 2, tw, th);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';                         // centine del telo
    for (let k = cy - th / 2 + px * 2; k < cy + th / 2; k += px * 4) ctx.fillRect(cx - tw / 2, q(k), tw, px);
    ctx.fillStyle = '#1B1724';                                  // vano passeggeri
    ctx.fillRect(cx - tw / 2 + px, q(cy + th * 0.12), tw - px * 2, q(th * 0.32));
    ctx.fillStyle = '#FFF3C4';                                  // fari
    ctx.fillRect(cx - px * 2, cy - th / 2 - px, px * 2, px);
    ctx.fillRect(cx + px, cy - th / 2 - px, px * 2, px);
  });

  // --- Bandiere thailandesi appese alle facciate ---
  // Vanno per ultime e con un fondo scuro dietro: sopra un muro di insegne al
  // neon, senza stacco, si perderebbero fra le altre strisce colorate — e sono
  // l'unica cosa che dice "Thailandia" invece di "strada di locali".
  const fw = q(bordo * 0.78), fh = q(cell * 1.15);
  const appendi = (x, y) => {
    ctx.fillStyle = '#0E0A14';
    ctx.fillRect(q(x) - px * 2, q(y) - px * 2, fw + px * 4, fh + px * 4);
    ctx.fillStyle = '#F2F0EA';
    ctx.fillRect(q(x) - px, q(y) - px, fw + px * 2, fh + px * 2);
    drawThaiFlag(ctx, x, y, fw, fh, px);
  };
  appendi(bordo * 0.12, cell * 0.9);
  appendi(w - bordo * 0.9, h * 0.30);
  appendi(bordo * 0.12, h * 0.62);
  appendi(w - bordo * 0.9, h - cell * 2.4);
}

// Livello 2+: il corpo è un tubo cartoon a blocchi (stile fumetto, non
// realistico) con la punta arrotondata e due lobi alla base.
const SK = { skin: '#E4A882', shade: '#C98D68', light: '#F4CFAF', tip: '#E8A090', crease: '#A9714F' };
// Livello 3: stessa forma, carnagione scura. Sulla sabbia chiara si stacca
// meglio del livello 2, che sull'asfalto grigio funzionava al contrario.
const SK3 = { skin: '#8D5A3B', shade: '#6B4229', light: '#B37B50', tip: '#96543C', crease: '#472A18' };
// Livello 4: strada al buio. Serve una carnagione chiara con un filo di neon
// addosso, altrimenti sull'asfalto notturno il corpo sparisce.
const SK4 = { skin: '#D9A279', shade: '#9E6E4C', light: '#EDA6C4', tip: '#E9A9A0', crease: '#6B4530' };
// Livello 1: la canna come cilindro continuo, con brace tonda e sfumata
// e filtro in fondo (prima era una catena di quadretti staccati).
const JO = { paper: '#F6EFDF', paper2: '#E9DFC7', seam: '#DCCFB2', filter: '#B98F5E', filter2: '#9C7345' };
function drawJoint(ctx, snake, i, cell, offX, offY, dir) {
  const seg = snake[i];
  const x = offX + seg.x * cell, y = offY + seg.y * cell;
  const u = cell / 10;
  const T = cell - u * 3.6;                  // spessore della cartina
  const cx = x + cell / 2, cy = y + cell / 2;
  const total = snake.length;
  const bandTo = (nb) => {
    if (!nb) return;
    const dx = nb.x - seg.x, dy = nb.y - seg.y;
    if (dx > 0) ctx.fillRect(cx, cy - T / 2, cell / 2 + 1, T);
    else if (dx < 0) ctx.fillRect(x - 1, cy - T / 2, cell / 2 + 1, T);
    else if (dy > 0) ctx.fillRect(cx - T / 2, cy, T, cell / 2 + 1);
    else if (dy < 0) ctx.fillRect(cx - T / 2, y - 1, T, cell / 2 + 1);
  };

  if (i === 0) {
    const d = dir && (dir.x || dir.y) ? dir : { x: 0, y: -1 };
    // cartina fino alla punta
    ctx.fillStyle = JO.paper;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[1]);
    // brace: cerchio con sfumatura + alone morbido
    const ex = cx + d.x * u * 1.2, ey = cy + d.y * u * 1.2;
    const r = T * 0.5;
    const glow = ctx.createRadialGradient(ex, ey, r * 0.3, ex, ey, r * 2.1);
    glow.addColorStop(0, 'rgba(255,150,40,0.45)');
    glow.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(ex, ey, r * 2.1, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(ex - r * 0.25, ey - r * 0.25, r * 0.1, ex, ey, r);
    g.addColorStop(0, '#FFF3C4');
    g.addColorStop(0.4, '#FFB13B');
    g.addColorStop(0.8, '#E06A0C');
    g.addColorStop(1, '#8E3406');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
    return;
  }

  if (i === total - 1 && total > 2) {
    // filtro di cartoncino
    ctx.fillStyle = JO.filter;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[i - 1]);
    ctx.fillStyle = JO.filter2;
    const horizT = snake[i - 1].y === seg.y;
    if (horizT) ctx.fillRect(cx - T / 2, cy - T / 2, u * 1.2, T);
    else ctx.fillRect(cx - T / 2, cy - T / 2, T, u * 1.2);
    return;
  }

  // corpo: cartina con una leggera ombra lungo l'asse
  ctx.fillStyle = JO.paper;
  ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
  bandTo(snake[i - 1]);
  bandTo(snake[i + 1]);
  const horiz = (snake[i - 1] && snake[i - 1].y === seg.y) || (snake[i + 1] && snake[i + 1].y === seg.y);
  ctx.fillStyle = JO.paper2;
  if (horiz) ctx.fillRect(x, cy + T * 0.18, cell, u * 1.1);
  else ctx.fillRect(cx + T * 0.18, y, u * 1.1, cell);
  ctx.fillStyle = JO.seam;                    // cucitura della cartina
  if (i % 3 === 0) {
    if (horiz) ctx.fillRect(cx - u * 0.4, cy - T / 2, u * 0.8, T);
    else ctx.fillRect(cx - T / 2, cy - u * 0.4, T, u * 0.8);
  }
}

function drawBody(ctx, snake, i, cell, offX, offY, dir, pal) {
  const SKIN = pal || SK;
  const seg = snake[i];
  const x = offX + seg.x * cell, y = offY + seg.y * cell;
  const u = cell / 10;
  const T = cell - u * 2.6;                 // spessore unico per tutto il fusto
  const cx = x + cell / 2, cy = y + cell / 2;
  const total = snake.length;

  // banda dal centro della cella verso un segmento vicino: garantisce
  // spessore uniforme anche nelle curve (niente gradini)
  const bandTo = (n) => {
    if (!n) return;
    const dx = n.x - seg.x, dy = n.y - seg.y;
    if (dx > 0) ctx.fillRect(cx, cy - T / 2, cell / 2 + 1, T);
    else if (dx < 0) ctx.fillRect(x - 1, cy - T / 2, cell / 2 + 1, T);
    else if (dy > 0) ctx.fillRect(cx - T / 2, cy, T, cell / 2 + 1);
    else if (dy < 0) ctx.fillRect(cx - T / 2, y - 1, T, cell / 2 + 1);
  };

  if (i === 0) {
    // Punta a mezza sfera orientata nel senso di marcia
    const d = dir && (dir.x || dir.y) ? dir : { x: 0, y: -1 };
    const th = Math.atan2(d.y, d.x);
    ctx.fillStyle = SKIN.skin;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[1]);
    ctx.fillStyle = SKIN.tip;
    ctx.beginPath();
    ctx.arc(cx, cy, T / 2, th - Math.PI / 2, th + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SKIN.light;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(th - 0.7) * T * 0.22, cy + Math.sin(th - 0.7) * T * 0.22, T * 0.12, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (i === total - 1 && total > 2) {
    // Base: due lobi ben visibili
    ctx.fillStyle = SKIN.skin;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[i - 1]);
    const prev = snake[i - 1];
    const vertical = prev.x === seg.x;      // lobi affiancati rispetto all'asse
    const r = cell * 0.34, off = cell * 0.33;
    const lobe = (a, b) => { ctx.beginPath(); ctx.arc(a, b, r, 0, Math.PI * 2); ctx.fill(); };
    ctx.fillStyle = SKIN.shade;
    if (vertical) { lobe(cx - off, cy + u * 0.8); lobe(cx + off, cy + u * 0.8); }
    else { lobe(cx + u * 0.8, cy - off); lobe(cx + u * 0.8, cy + off); }
    // piega centrale: fa leggere due lobi distinti invece di un ovale unico
    ctx.fillStyle = SKIN.crease;
    if (vertical) ctx.fillRect(cx - u * 0.25, cy - u * 0.6, u * 0.5, r * 1.5);
    else ctx.fillRect(cx - u * 0.6, cy - u * 0.25, r * 1.5, u * 0.5);
    ctx.fillStyle = SKIN.skin;                 // raccordo sopra i lobi
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    return;
  }

  // Fusto: spessore identico per ogni segmento
  ctx.fillStyle = SKIN.skin;
  ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
  bandTo(snake[i - 1]);
  bandTo(snake[i + 1]);
  // luce lungo l'asse del tubo
  const horiz = (snake[i - 1] && snake[i - 1].y === seg.y) || (snake[i + 1] && snake[i + 1].y === seg.y);
  ctx.fillStyle = SKIN.light;
  if (horiz) ctx.fillRect(x, cy - T * 0.34, cell, u * 1.2);
  else ctx.fillRect(cx - T * 0.34, y, u * 1.2, cell);
}

function BandyGame({ playerName, onExit, onGameOver, bestLocal }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const bgRef = useRef(null);
  const stateRef = useRef(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(1);
  const [levelUp, setLevelUp] = useState(false);
  useEffect(() => {
    if (level < 2) return;
    setLevelUp(true);
    const t = setTimeout(() => setLevelUp(false), 1800);
    return () => clearTimeout(t);
  }, [level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cell = Math.floor(Math.min(canvas.width / GAME_COLS, canvas.height / GAME_ROWS));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // sfondo disegnato una volta e riusato
    const mkBg = (fn) => {
      const c = document.createElement('canvas');
      c.width = canvas.width; c.height = canvas.height;
      fn(c.getContext('2d'), canvas.width, canvas.height, cell);
      return c;
    };
    const bgForest = mkBg(drawForest);
    const bgStreet = mkBg(drawStreet);
    const bgBeach = mkBg(drawBeach);
    const bgThai = mkBg(drawThai);
    bgRef.current = bgForest;

    const img = new Image();
    img.src = './bandy.png';

    const st = {
      snake: [{ x: 7, y: 12 }, { x: 7, y: 13 }, { x: 7, y: 14 }],
      dir: { x: 0, y: -1 }, queue: [],
      food: { x: 7, y: 5 }, score: 0, alive: true, acc: 0, last: 0, step: BASE_STEP, level: 1,
    };
    stateRef.current = st;
    canvas.__game = st;   // aggancio per i test automatici (non usato dall'app)

    const placeFood = () => {
      let p, tries = 0;
      do {
        p = { x: Math.floor(Math.random() * GAME_COLS), y: Math.floor(Math.random() * GAME_ROWS) };
        tries++;
      } while (tries < 200 && st.snake.some((s) => s.x === p.x && s.y === p.y));
      st.food = p;
    };

    const offX = Math.floor((canvas.width - cell * GAME_COLS) / 2);
    const offY = Math.floor((canvas.height - cell * GAME_ROWS) / 2);

    const draw = () => {
      ctx.drawImage(bgRef.current, 0, 0);
      // Bandy da raccogliere
      const f = st.food;
      const fcx = offX + f.x * cell + cell / 2, fcy = offY + f.y * cell + cell / 2;
      // alone chiaro: stacca Bandy dal verde del bosco
      ctx.beginPath();
      ctx.arc(fcx, fcy, cell * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240, 244, 241, 0.28)';
      ctx.fill();
      if (img.complete && img.naturalWidth) {
        const fs = cell * 1.34; // un filo più grande della cella per leggerlo bene
        ctx.drawImage(img, fcx - fs / 2, fcy - fs / 2, fs, fs);
      } else {
        ctx.fillStyle = '#E9B48E';
        ctx.fillRect(fcx - cell * 0.4, fcy - cell * 0.4, cell * 0.8, cell * 0.8);
      }
      // Livello 2: la fila di figure stilizzate al posto della canna.
      if (st.level >= 2) {
        // dal fondo verso la testa, così la punta resta sopra
        const pal = st.level >= 4 ? SK4 : st.level >= 3 ? SK3 : SK;
        for (let i = st.snake.length - 1; i >= 0; i--) {
          drawBody(ctx, st.snake, i, cell, offX, offY, st.dir, pal);
        }
        return;
      }
      // la canna: dal fondo verso la testa, così la brace resta sopra
      for (let i = st.snake.length - 1; i >= 0; i--) {
        drawJoint(ctx, st.snake, i, cell, offX, offY, st.dir);
      }
    };

    const tick = (ts) => {
      if (!stateRef.current) return;
      if (!st.last) st.last = ts;
      const dt = ts - st.last; st.last = ts;
      if (st.alive && !st.pause) {
        st.acc += dt;
        if (st.acc >= st.step) {
          st.acc = 0;
          if (st.queue.length) st.dir = st.queue.shift();
          const head = { x: st.snake[0].x + st.dir.x, y: st.snake[0].y + st.dir.y };
          const hitWall = head.x < 0 || head.y < 0 || head.x >= GAME_COLS || head.y >= GAME_ROWS;
          const hitSelf = st.snake.some((s) => s.x === head.x && s.y === head.y);
          if (hitWall || hitSelf) {
            st.alive = false;
            setOver(true);
            onGameOver(st.score);
          } else {
            st.snake.unshift(head);
            if (head.x === st.food.x && head.y === st.food.y) {
              st.score += 1;
              setScore(st.score);
              const nextLevel = Math.floor(st.score / LEVEL_EVERY) + 1;
              if (nextLevel > st.level) {
                st.level = nextLevel;
                // a ogni livello la velocità aumenta di una volta e mezza
                st.step = Math.max(MIN_STEP, Math.round(BASE_STEP / Math.pow(LEVEL_SPEEDUP, nextLevel - 1)));
                // si riparte dalla lunghezza base, mantenendo posizione e direzione
                st.snake = st.snake.slice(0, BASE_LEN);
                st.queue = [];
                bgRef.current = nextLevel >= 4 ? bgThai : nextLevel >= 3 ? bgBeach : nextLevel >= 2 ? bgStreet : bgForest;
                setLevel(nextLevel);
              }
              placeFood();
            } else {
              st.snake.pop();
            }
          }
        }
      }
      draw();
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);

    const turn = (x, y) => {
      // Confronto con l'ultima direzione decisa (non con quella a schermo),
      // così due comandi rapidi in sequenza funzionano entrambi.
      const last = st.queue.length ? st.queue[st.queue.length - 1] : st.dir;
      if (last.x === -x && last.y === -y) return;   // niente inversione a U
      if (last.x === x && last.y === y) return;     // già in questa direzione
      if (st.queue.length < 2) st.queue.push({ x, y });
      // Se il passo è già a metà, lo anticipo: la svolta si vede subito
      // invece di aspettare fino a un tick intero.
      if (st.acc >= st.step * 0.45) st.acc = st.step;
    };
    const onKey = (e) => {
      const k = e.key;
      if (['ArrowUp', 'w', 'W'].includes(k)) { turn(0, -1); e.preventDefault(); }
      else if (['ArrowDown', 's', 'S'].includes(k)) { turn(0, 1); e.preventDefault(); }
      else if (['ArrowLeft', 'a', 'A'].includes(k)) { turn(-1, 0); e.preventDefault(); }
      else if (['ArrowRight', 'd', 'D'].includes(k)) { turn(1, 0); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);

    let sx = 0, sy = 0, swiped = false;
    const onStart = (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; swiped = false; };
    const onMove = (e) => {
      if (swiped) return;
      const t = e.touches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
      // Svolta appena il dito ha percorso abbastanza: non aspetta il rilascio.
      if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0); else turn(0, dy > 0 ? 1 : -1);
      swiped = true;
    };
    canvas.addEventListener('touchstart', onStart, { passive: true });
    canvas.addEventListener('touchmove', onMove, { passive: true });

    stateRef.current.turn = turn;

    return () => {
      cancelAnimationFrame(st.raf);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schermo intero: su Android/desktop usa l'API Fullscreen; su iPhone quella
  // API non esiste, ma il gioco è già un overlay che copre tutto lo schermo.
  useEffect(() => {
    const el = wrapRef.current;
    const req = el && (el.requestFullscreen || el.webkitRequestFullscreen);
    if (req) { try { req.call(el); } catch (e) { /* niente fullscreen: resta l'overlay */ } }
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
        try { exit.call(document); } catch (e) { /* ignora */ }
      }
    };
  }, []);

  const nudge = (x, y) => { const st = stateRef.current; if (st && st.turn) st.turn(x, y); };
  const togglePause = () => {
    const st = stateRef.current; if (!st || !st.alive) return;
    st.pause = !st.pause; setPaused(st.pause);
  };

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 z-50 bg-[#1F271E] flex flex-col gap-2 p-2"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {/* "Palmiro Togliatti" è lungo: su un telefono stretto questa riga
          deve accorciare il nome, non spingere fuori il punteggio. */}
      <div className="flex items-center justify-between gap-2 bg-white/95 px-3 py-2 rounded-lg shrink-0">
        <span className="text-xs uppercase font-bold text-gray-500 truncate max-w-[24%]">{playerName}</span>
        <span className="font-rustic text-lg text-[#2D392C] shrink-0">{score} 🌿</span>
        <span className="text-[10px] text-gray-400 min-w-0 truncate text-right">
          {livelloInfo(level).icona} {livelloInfo(level).nome} · -{Math.max(0, level * 15 - score)} · rec {bestLocal}
        </span>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={720}
          height={912}
          className="rounded-lg border-2 border-[#2D392C]/40 touch-none max-h-full max-w-full"
          style={{ imageRendering: 'pixelated', height: '100%', width: 'auto', aspectRatio: '720 / 912' }}
        />
        {levelUp && !over && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/70 px-5 py-3 rounded-lg text-center">
              <div className="text-[10px] uppercase tracking-widest text-[#8F9E8B]">Livello {level}</div>
              <div className="font-rustic text-2xl text-[#D97706] leading-tight">
                {livelloInfo(level).icona} {livelloInfo(level).nome}
              </div>
              {level > LIVELLI.length && (
                <div className="text-[10px] uppercase tracking-widest text-[#F0F4F1]">Ancora più veloce!</div>
              )}
            </div>
          </div>
        )}
        {(over || paused) && (
          <div className="absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center text-center p-4">
            {over ? (
              <>
                <div className="font-rustic text-2xl text-[#F0F4F1]">Bandy è scappato!</div>
                <div className="text-[#D97706] font-rustic text-3xl my-2">{score}</div>
                <div className="text-[11px] text-gray-300 mb-4">
                  {score > bestLocal ? 'Nuovo record personale! 🎉' : `Il tuo record resta ${bestLocal}`}
                </div>
                <button onClick={onExit} className="px-6 py-2.5 bg-[#2D392C] text-white rounded font-bold uppercase text-xs">Chiudi</button>
              </>
            ) : (
              <div className="font-rustic text-xl text-[#F0F4F1]">In pausa</div>
            )}
          </div>
        )}
      </div>

      {/* Comandi per il telefono (in alternativa si scorre il dito sul campo) */}
      <div className="grid grid-cols-3 gap-2 max-w-[240px] w-full mx-auto shrink-0">
        <span></span>
        <button onPointerDown={(e) => { e.preventDefault(); nudge(0, -1); }} aria-label="Su" className="py-3 bg-[#2D392C] text-white rounded font-bold">▲</button>
        <span></span>
        <button onPointerDown={(e) => { e.preventDefault(); nudge(-1, 0); }} aria-label="Sinistra" className="py-3 bg-[#2D392C] text-white rounded font-bold">◀</button>
        <button onClick={togglePause} aria-label="Pausa" className="py-3 bg-[#5C4A3C] text-white rounded font-bold text-xs">{paused ? '▶' : '❚❚'}</button>
        <button onPointerDown={(e) => { e.preventDefault(); nudge(1, 0); }} aria-label="Destra" className="py-3 bg-[#2D392C] text-white rounded font-bold">▶</button>
        <span></span>
        <button onPointerDown={(e) => { e.preventDefault(); nudge(0, 1); }} aria-label="Giù" className="py-3 bg-[#2D392C] text-white rounded font-bold">▼</button>
        <span></span>
      </div>

      <button onClick={onExit} className="w-full py-1.5 text-[11px] uppercase font-bold text-[#8F9E8B] hover:text-white shrink-0">Esci dal gioco</button>
    </div>
  );
}

// ============================================================================
//  SCHERMATA DI BLOCCO
// ============================================================================
function LockScreen({ onUnlock, reason }) {
  const [pwd, setPwd] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [waitLeft, setWaitLeft] = useState(0);

  // Attesa progressiva dopo troppi tentativi sbagliati: rende inutile
  // provare le password a raffica.
  useEffect(() => {
    const tick = () => {
      const until = Number(localStorage.getItem(UNTIL_KEY) || 0);
      setWaitLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  const submit = async () => {
    if (busy || waitLeft > 0) return;
    if (!pwd) { setError('Scrivi la password.'); return; }
    setBusy(true);
    setError('');
    try {
      const digest = await derivePassword(pwd);
      if (digest === null) {
        setError('Questo browser non può verificare la password: apri l\'app su https (l\'indirizzo pubblicato) invece di una copia locale.');
        return;
      }
      if (digest === LOCK.hash) {
        sessionPassword = pwd;   // solo in memoria, per l'accesso al database
        rememberUnlock();
        setPwd('');
        onUnlock();
        return;
      }
      const fails = Number(localStorage.getItem(FAIL_KEY) || 0) + 1;
      localStorage.setItem(FAIL_KEY, String(fails));
      if (fails >= 5) {
        const secs = Math.min(600, 30 * Math.pow(2, fails - 5));
        localStorage.setItem(UNTIL_KEY, String(Date.now() + secs * 1000));
        setError(`Password sbagliata. Troppi tentativi: riprova fra ${secs} secondi.`);
      } else {
        setError(`Password sbagliata. ${5 - fails} ${5 - fails === 1 ? 'tentativo' : 'tentativi'} prima dell'attesa.`);
      }
      setPwd('');
    } catch (e) {
      setError('Verifica non riuscita. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#2D392C] flex flex-col items-center justify-center text-[#F0F4F1] z-50 px-8">
      <div className="w-28 h-28 mb-5 rounded-full overflow-hidden shadow-2xl border-4 border-[#8F9E8B] bg-[#F0F4F1] shrink-0">
        <img src="./logo.png" alt={`Logo ${BRAND.groupName}`} className="w-full h-full object-cover" />
      </div>
      <h1 className="font-rustic text-2xl tracking-widest text-[#8F9E8B] text-center">{BRAND.splashLine1}</h1>
      <h2 className="font-rustic text-lg tracking-widest text-[#F0F4F1] text-center mb-6">{BRAND.splashLine2}</h2>

      <div className="w-full max-w-xs space-y-3">
        {reason && (
          <div className="bg-[#1F271E] border border-[#8F9E8B]/30 rounded p-3 mb-1">
            <p className="text-[11px] text-[#F0F4F1] leading-snug">{reason}</p>
          </div>
        )}
        <label className="block text-[10px] uppercase tracking-widest text-[#8F9E8B] font-bold">Password del campo</label>
        <div className="flex gap-2">
          <input
            type={show ? 'text' : 'password'}
            value={pwd}
            autoFocus
            autoComplete="current-password"
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            disabled={waitLeft > 0}
            placeholder="••••••••"
            className="flex-grow min-w-0 p-3 rounded bg-[#1F271E] border-2 border-[#8F9E8B]/40 text-[#F0F4F1] placeholder-[#8F9E8B]/50 focus:outline-none focus:border-[#8F9E8B] disabled:opacity-50"
          />
          <button
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Nascondi la password' : 'Mostra la password'}
            className="shrink-0 px-3 rounded bg-[#1F271E] border-2 border-[#8F9E8B]/40 text-lg leading-none hover:border-[#8F9E8B]"
          >
            {show ? '🙈' : '👁️'}
          </button>
        </div>

        <button
          onClick={submit}
          disabled={busy || waitLeft > 0}
          className="w-full py-3 rounded bg-[#8F9E8B] text-[#1F271E] font-bold uppercase text-sm tracking-widest hover:brightness-110 disabled:opacity-50"
        >
          {busy ? 'Verifica…' : waitLeft > 0 ? `Attendi ${waitLeft} s` : 'Entra'}
        </button>

        {error && <p className="text-[11px] text-[#F0A0A0] leading-snug">{error}</p>}
        <p className="text-[10px] text-[#8F9E8B]/80 leading-snug">
          {(LOCK && LOCK.hint) || 'Chiedi la password a chi organizza il campo.'}
        </p>
      </div>

      <p className="absolute bottom-4 left-0 right-0 text-center text-[9px] tracking-wide text-[#8F9E8B]/70 px-6">
        {BRAND.credits}
      </p>
    </div>
  );
}

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
    localStorage.setItem(THEME_KEY, theme);
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
      localStorage.setItem(LOCK_ALWAYS_KEY, '1');
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
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16${quota}`)
      .then((r) => r.json())
      .then((j) => {
        const d = j && j.daily;
        if (!d || !Array.isArray(d.time)) return;
        const byDate = {};
        d.time.forEach((t, i) => {
          byDate[t] = {
            code: d.weather_code[i],
            tmax: d.temperature_2m_max[i],
            tmin: d.temperature_2m_min[i],
            rain: d.precipitation_probability_max[i],
          };
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
    localStorage.setItem('cambusa_sync_optout', '1');
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
    if (t.transfers.length > 0) {
      lines.push('');
      lines.push('👉 Chi paga chi:');
      t.transfers.forEach((x) => lines.push(`• ${x.from} → ${x.to}: ${money(x.amount)} €`));
    }
    if (t.settlement.length > 0) {
      lines.push('');
      lines.push('📋 Dettaglio a testa:');
      t.settlement.forEach((s) => {
        const stato = s.net > 0.005 ? `riceve ${money(s.net)} €` : s.net < -0.005 ? `deve dare ${money(-s.net)} €` : 'in pari';
        lines.push(`• ${s.name}: ${stato} (anticipato ${money(s.paid)} €, quota ${money(s.owed)} €)`);
      });
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
    localStorage.setItem('cambusa_player', n);
    setGameRunning(true);
  };

  const endGame = (score) => {
    if (score > gameBest) {
      setGameBest(score);
      localStorage.setItem('cambusa_best', JSON.stringify(score));
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
  // si scaricano uno a uno. Da qui l'avanzamento e il tetto di dodici.
  const MAX_RICORDO = (window.PdfRicordo && window.PdfRicordo.MAX_FOTO) || 12;

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
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_RICORDO) {
        window.alert(`Il ricordo tiene al massimo ${MAX_RICORDO} foto: oltre diventa un catalogo.\n\nTogline una per farne entrare un'altra.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const uscitaScelta = () => { setPicking(false); setPicked([]); };

  const generaRicordo = async (elenco) => {
    const PDF = window.PdfRicordo;
    if (!PDF) { window.alert('Il generatore del ricordo non è disponibile.'); return; }
    const CS = window.CloudSync;
    if (!CS || !CS.isConnected()) { window.alert('Per creare il ricordo servono le foto originali, quindi la linea.'); return; }

    const scelte = elenco.filter((p) => picked.includes(p.id));
    if (scelte.length === 0) { window.alert('Scegli almeno una foto.'); return; }

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
        <button onClick={() => changeWeek(-7)} aria-label="Settimana precedente" className="p-2 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&larr;</button>
        <span className="font-bold text-sm text-[#2D392C] uppercase font-rustic">Settimana Selezionata</span>
        <button onClick={() => changeWeek(7)} aria-label="Settimana successiva" className="p-2 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&rarr;</button>
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
    const attendingForEquip = new Set(); // presenti NON esenti da attrezzatura
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
          attendingAdults.add(m.id);
          // L'esenzione vale solo se la funzione e' attiva (vedi FEATURES).
          if (!(FEATURES.equipExemption && m.equipExempt)) attendingForEquip.add(m.id);
        }
      });
    });

    const adultMealsCommon = adultMealsTotal - adultMealsSep;

    // Cibo+bevande ripartiti sui pasti degli adulti (bambini = gratis),
    // ognuno sulla sua cassa.
    const costPerMeal = adultMealsCommon > 0 ? foodDrinksCommon / adultMealsCommon : 0;
    const costPerMealSep = adultMealsSep > 0 ? foodDrinksSep / adultMealsSep : 0;
    // Logistica: parti uguali tra tutti gli adulti presenti.
    const logisticsPerAdult = attendingAdults.size > 0 ? logisticsPurchases / attendingAdults.size : 0;
    // Attrezzatura: parti uguali tra i presenti non esenti. Se sono tutti
    // esenti, per non perdere la spesa si ripartisce su tutti i presenti.
    const equipDivisorSet = attendingForEquip.size > 0 ? attendingForEquip : attendingAdults;
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
      const present = attendingAdults.has(m.id);
      const logShare =
        (present ? logisticsPerAdult : 0) +
        (present && equipDivisorSet.has(m.id) ? equipPerAdult : 0);
      return {
        ...m, mealCount, mealsCommon: rec.common, mealsSep: rec.sep, mealsGratis: rec.gratis,
        foodShare, logShare, owed: foodShare + logShare,
      };
    });

    // --- Arrotondamento "cassa-friendly" ---
    // Ogni quota viene arrotondata a multipli di 0,10 € (niente monetine da
    // 1/2/5 cent). Lo scarto rispetto al totale reale viene riconciliato SOLO
    // se è >= 0,50 €: sotto quella soglia si lascia com'è (non vale la pena).
    const round10 = (cents) => Math.round(cents / 10) * 10;
    breakdown.forEach((b) => {
      b.payCents = b.isChild ? 0 : round10(Math.round(b.owed * 100));
    });

    // --- Soldi senza divisore: un BUCO, non un arrotondamento ---
    // Se una cassa ha dei soldi dentro ma nessun pasto (o nessun presente) su
    // cui dividerli, la sua quota a pasto viene zero e quei soldi non entrano
    // in nessuna quota. Finivano dentro lo scarto, e la riconciliazione — nata
    // per limare qualche centesimo — se li spalmava addosso a chi capitava, 10
    // cent alla volta: cento euro di "conto separato" senza giorni separati
    // spuntati diventavano cinquanta euro a testa per due persone che non
    // c'entravano niente, sotto l'etichetta "arrotondamento".
    // Ora si tengono fuori dal conto e si dicono.
    const buchi = [];
    if (foodDrinksCommon > 0.005 && adultMealsCommon === 0) {
      buchi.push({ quanto: foodDrinksCommon, perche: 'cibo e bevande del conto comune, ma nessun pasto segnato nei giorni comuni' });
    }
    if (foodDrinksSep > 0.005 && adultMealsSep === 0) {
      buchi.push({
        quanto: foodDrinksSep,
        perche: sepDays.length === 0
          ? 'spese segnate "conto separato", ma in Calendario nessun giorno è spuntato come separato'
          : sepDays.every((d) => freeSet.has(d))
          ? 'spese segnate "conto separato", ma i giorni separati sono anche segnati come gratis: non c\'è più nessun pasto su cui dividerle'
          : 'spese segnate "conto separato", ma nei giorni separati non c\'è nessuna presenza',
      });
    }
    if (logisticsPurchases > 0.005 && attendingAdults.size === 0) {
      buchi.push({ quanto: logisticsPurchases, perche: 'spese di logistica, ma nessun adulto ha presenze segnate' });
    }
    if (equipBought > 0.005 && equipDivisorSet.size === 0) {
      buchi.push({ quanto: equipBought, perche: 'attrezzatura acquistata, ma nessun adulto ha presenze segnate' });
    }
    const nonRipartito = buchi.reduce((s, b) => s + b.quanto, 0);

    // Si riconcilia solo ciò che è davvero ripartibile: così lo scarto torna a
    // essere quello che deve essere — pochi centesimi di arrotondamento.
    const targetCents = Math.round((overallTotal - nonRipartito) * 100);
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
    // Lo scarto ora è solo arrotondamento: il buco viaggia da solo, con il suo
    // nome, invece di nascondersi qui dentro.
    const roundingDiff = collected - (overallTotal - nonRipartito);

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
    // Attrezzatura acquistata: se ha un acquirente viene accreditata a lui
    // (verrà rimborsato); altrimenti è spesa comune ("non attribuita"). In
    // entrambi i casi la somma dei saldi resta zero.
    equipment.forEach((e) => {
      if (!e.bought) return;
      const price = posNum(e.price);
      if (price <= 0) return;
      const raw = (e.buyer && e.buyer.trim()) ? e.buyer.trim() : '—';
      const key = norm(raw) || '—';
      if (!paidByName[key]) paidByName[key] = { display: raw, paid: 0 };
      paidByName[key].paid += price;
    });
    const owedByName = {}; // nome membro normalizzato -> { display, owed }
    breakdown.forEach((b) => {
      const key = norm(b.name);
      if (!owedByName[key]) owedByName[key] = { display: b.name, owed: 0 };
      owedByName[key].owed += b.pay; // già arrotondato; bambini = 0
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
      costPerMeal, logisticsPerAdult, equipPerAdult, accessoryPerAdult,
      logisticsPurchases, equipBought, equipPayersCount: equipDivisorSet.size,
      adultMealsTotal, adultMealsCommon, adultMealsSep,
      foodDrinksCommon, foodDrinksSep, costPerMealSep,
      sepPeopleCount: sepPeople.size, sepDaysCount: sepDays.length,
      freeDaysCount: freeDays.length, mealsFree,
      attendingAdultsCount: attendingAdults.size, breakdown,
      collected, roundingDiff, nonRipartito, buchi,
      byBuyer, settlement, unattributed, unknownBuyers, transfers,
    };
  };

  const totals = calculateTotals();
  // Aggancio per le prove (come canvas.__game): i conti esatti, non ricavati
  // dal testo a schermo. La prova "oracolo" li confronta con un calcolo
  // indipendente e con scenari fatti a mano.
  if (typeof window !== 'undefined') window.__totali = totals;

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
    const unpaid = t.transfers.filter((x) => !settled.includes(`${x.from}→${x.to}@${Math.round(x.amount * 100)}`));
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
    { k: 'galleria', icon: '📸', title: 'Galleria', body: 'L\'album del campo, da riempire una volta riscesi: scegli il tuo nome, scegli le foto e partono. È l\'unica scheda che ha bisogno della linea — le foto stanno solo nel cloud, perché tenerle anche sul telefono riempirebbe lo spazio che serve a presenze e spese. Ognuno può caricarne un numero fisso (si cambia in Impostazioni): non è un controllo, è un modo per far scegliere le foto belle invece di svuotare il rullino. Tocca una miniatura per vederla grande; da lì si può anche eliminare, e il posto liberato torna disponibile. Si guarda in due modi: "Album" sfoglia le foto come polaroid appoggiate su un paesaggio di montagna, una spinta col dito per pagina; "Griglia" le mette tutte in fila, ed è la vista comoda per cercarne una. Il tasto "Crea album ricordo" ti fa scegliere fino a dodici foto e ne fa un PDF con lo stesso paesaggio, quattro per pagina: da mandare nel gruppo o da stampare.' },
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
          <button onClick={dismissInstallHint} aria-label="Chiudi avviso" className="text-[#5C4A3C] font-bold px-1 shrink-0">&times;</button>
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
                  <button onClick={exportData} className="px-3 py-1.5 bg-[#5C4A3C] text-white rounded text-[10px] font-bold uppercase tracking-wide">
                    Salva il backup
                  </button>
                  <button
                    onClick={() => {
                      const oggi = toDateStr(new Date());
                      try { localStorage.setItem(BACKUP_KEY, oggi); } catch (e) { /* niente */ }
                      setBackupOggi(oggi);
                    }}
                    className="px-3 py-1.5 bg-white border border-[#8F9E8B]/50 text-[#5C4A3C] rounded text-[10px] font-bold uppercase tracking-wide"
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
                className="mt-2 px-3 py-1.5 bg-white border border-[#8F9E8B]/50 text-[#5C4A3C] rounded text-[10px] font-bold uppercase tracking-wide"
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
                className="mt-2 px-3 py-1.5 bg-white border border-[#8F9E8B]/50 text-[#5C4A3C] rounded text-[10px] font-bold uppercase tracking-wide"
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
                className="mt-2 px-3 py-1.5 bg-white border border-[#8F9E8B]/50 text-[#5C4A3C] rounded text-[10px] font-bold uppercase tracking-wide"
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
                <button onClick={annullaSync} className="px-3 py-1.5 bg-[#D97706] text-white rounded text-[10px] font-bold uppercase tracking-wide">
                  Annulla la sincronizzazione
                </button>
                <button onClick={() => setLostSync(null)} className="px-3 py-1.5 bg-white border border-[#8F9E8B]/50 text-[#5C4A3C] rounded text-[10px] font-bold uppercase tracking-wide">
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
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[#E2EAE4]/60"
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
                      ) : wx ? (
                        <>
                          <span className="text-2xl leading-none">{wmoInfo(wx.code).icon}</span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-[#2D392C]">{wmoInfo(wx.code).label}</span>
                            {loc.label && <span className="text-[9px] text-gray-400">{loc.label}</span>}
                          </div>
                          <span className="ml-auto text-xs text-gray-600 font-bold shrink-0">
                            {Math.round(wx.tmax)}° / {Math.round(wx.tmin)}°{wx.rain != null ? <span className="text-[#5C8AA8]"> · 💧{wx.rain}%</span> : null}
                          </span>
                        </>
                      ) : (
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
                            <span className={`text-[9px] ${vecchia ? 'text-[#A9752F] font-bold' : 'text-gray-400'}`}>
                              {weather.fetchedAt
                                ? `${vecchia ? '⚠ Previsioni vecchie, del' : 'Previsioni del'} ${new Date(weather.fetchedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} alle ${new Date(weather.fetchedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}${vecchia ? ': altrove ne trovi di più fresche.' : ' · uguali per tutto il campo'}`
                                : 'Previsioni non ancora scaricate.'}
                            </span>
                          );
                        })()}
                        <button
                          onClick={() => fetchWeather(true)}
                          disabled={!isOnline || wxBusy}
                          className="shrink-0 text-[9px] uppercase font-bold text-[#2D392C] px-2 py-1 rounded border border-[#8F9E8B]/40 hover:bg-[#E2EAE4] disabled:opacity-40"
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
                className="w-full py-2.5 bg-white border-2 border-[#8F9E8B]/50 text-[#2D392C] rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#E2EAE4]"
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
                  className="w-full py-2 bg-[#D97706] text-white rounded text-[10px] font-bold uppercase tracking-wide"
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
                          <button onClick={() => removeMember(m.id)} className="text-red-700 font-bold px-2 hover:text-red-900">&times;</button>
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
              <button onClick={() => navigateDate(-1)} className="px-3 py-1 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&larr;</button>
              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => { if (e.target.value) { setSelectedDateStr(e.target.value); setCurrentDate(parseDate(e.target.value)); } }}
                className="bg-transparent border-none text-sm focus:outline-none font-bold text-center w-full mx-2 text-[#5C4A3C]"
              />
              <button onClick={() => navigateDate(1)} className="px-3 py-1 font-bold bg-[#8F9E8B]/20 rounded hover:bg-[#8F9E8B]/40">&rarr;</button>
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
                            className="shrink-0 px-2.5 py-2 rounded border border-red-700/40 text-red-700 text-[10px] font-bold uppercase"
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
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#E2EAE4]/70"
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
                        <button onClick={() => chiediSetAll('lunch')} className="py-2.5 bg-[#2D392C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#1F271E]">Tutti a pranzo</button>
                        <button onClick={() => chiediSetAll('dinner')} className="py-2.5 bg-[#5C4A3C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#463628]">Tutti a cena</button>
                        <button onClick={chiediCopiaDaIeri} className="py-2.5 bg-white border-2 border-[#8F9E8B]/50 text-[#2D392C] rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#E2EAE4]">Copia da ieri</button>
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
                    className="w-full py-2.5 bg-white border-2 border-[#5C4A3C]/50 text-[#5C4A3C] rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#E2EAE4]"
                  >
                    🔓 Sblocca le presenze di questo giorno
                  </button>
                ) : (
                  <button
                    onClick={() => bloccaGiorno(selectedDateStr)}
                    className="w-full py-2.5 bg-[#5C4A3C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#463628]"
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
              <p className="text-[10px] text-gray-500 -mt-1">Totali generati automaticamente dalla <span className="font-bold">Lista della Spesa</span> e dall'<span className="font-bold">Attrezzatura</span> acquistata.</p>
              <div className="space-y-2">
                {[
                  ['Spesa Cibo (Alimentare)', totals.totalFood],
                  ['Spesa Bevande', totals.totalDrinks],
                  ['Logistica', totals.logisticsPurchases],
                  ['Attrezzatura acquistata', totals.equipBought],
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
                <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20">
                  <span className="text-[10px] uppercase text-[#8F9E8B] block">Logistica a testa</span>
                  <span className="font-rustic text-xl text-[#D97706]">{money(totals.logisticsPerAdult)} €</span>
                  <p className="text-[9px] text-gray-400 mt-1">Logistica ({money(totals.logisticsPurchases)} €) / {totals.attendingAdultsCount} adulti presenti.</p>
                </div>
                <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20 col-span-2">
                  <span className="text-[10px] uppercase text-[#8F9E8B] block">Attrezzatura a testa</span>
                  <span className="font-rustic text-xl text-[#D97706]">{money(totals.equipPerAdult)} €</span>
                  <p className="text-[9px] text-gray-400 mt-1">
                    Attrezzatura ({money(totals.equipBought)} €) / {totals.equipPayersCount} {FEATURES.equipExemption
                      ? (totals.equipPayersCount === 1 ? 'persona non esente' : 'persone non esenti')
                      : (totals.equipPayersCount === 1 ? 'adulto presente' : 'adulti presenti')}.
                  </p>
                </div>
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
            {/* Ripartizione per membro */}
            <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
              <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Quanto deve ciascuno</h3>
              {/* Caso tipico da campo: spese registrate ma presenze dimenticate.
                  Senza pasti non c'è nulla su cui ripartire e le quote restano a
                  zero: meglio dirlo, invece di mostrare solo degli zeri. */}
              {totals.overallTotal > 0 && totals.adultMealsTotal === 0 && (
                <div className="mb-3 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                  <p className="text-[11px] text-[#5C4A3C] leading-snug">
                    <span className="font-bold">Attenzione:</span> ci sono spese per {money(totals.overallTotal)} € ma
                    nessun pasto registrato. Le quote restano a zero finché non segni le presenze
                    nella scheda <span className="font-bold">Presenze</span>.
                  </p>
                </div>
              )}
              {/* Spese sul conto separato ma nessun pasto in quei giorni:
                  non c'è nessuno su cui dividerle. */}
              {totals.foodDrinksSep > 0 && totals.adultMealsSep === 0 && (
                <div className="mb-3 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                  <p className="text-[11px] text-[#5C4A3C] leading-snug">
                    <span className="font-bold">Attenzione:</span> ci sono {money(totals.foodDrinksSep)} € sul
                    conto separato ma nessun pasto nei giorni spuntati. Spunta i giorni in
                    <span className="font-bold"> Calendario</span> e segna le
                    <span className="font-bold"> Presenze</span>, altrimenti quella spesa non entra nelle quote.
                  </p>
                </div>
              )}
              {/* Caso opposto: tutti i giorni con pasti sono sul conto separato,
                  ma ci sono spese comuni da dividere. */}
              {totals.foodDrinksCommon > 0 && totals.adultMealsCommon === 0 && totals.adultMealsTotal > 0 && (
                <div className="mb-3 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                  <p className="text-[11px] text-[#5C4A3C] leading-snug">
                    <span className="font-bold">Attenzione:</span> tutti i giorni con presenze sono spuntati come
                    conto separato, ma ci sono {money(totals.foodDrinksCommon)} € di cibo e bevande sul conto comune.
                    Sposta quelle spese sul conto separato, oppure togli la spunta ai giorni che sono di tutti.
                  </p>
                </div>
              )}
              {totals.breakdown.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aggiungi membri e segna le presenze per vedere la ripartizione.</p>
              ) : (
                <div>
                  <ul className="divide-y divide-[#8F9E8B]/20">
                    {totals.breakdown.map((b) => (
                      <li key={b.id} className="flex items-center justify-between py-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-[#2D392C]">{b.name}</span>
                          <span className="text-[10px] text-gray-500">
                            {b.mealCount} {b.mealCount === 1 ? 'pasto' : 'pasti'}
                            {b.mealsSep > 0 ? ` (${b.mealsCommon} comuni + ${b.mealsSep} separati)` : ''}
                            {b.mealsGratis > 0 ? ` · ${b.mealsGratis} gratis` : ''}
                            {b.isChild ? ' · bambino' : ''}
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
                  {/* Soldi che nessuno sta pagando. Prima finivano dentro lo
                      scarto e la riconciliazione se li spalmava addosso a chi
                      capitava, sotto l'etichetta "arrotondamento". */}
                  {totals.nonRipartito > 0.005 && (
                    <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5 mt-2">
                      <p className="text-[10px] text-[#5C4A3C] leading-snug">
                        <span className="font-bold">{money(totals.nonRipartito)} € non sono nelle quote di nessuno.</span>{' '}
                        Il totale dice {money(totals.overallTotal)} €, ma se ne raccolgono {money(totals.collected)} €:
                        chi ha anticipato quei soldi non li riavrebbe indietro.
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {totals.buchi.map((b) => (
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
                  {totals.freeDaysCount > 0 && (
                    <p className="text-[10px] text-[#2D392C] leading-snug mt-2 bg-[#2D392C]/8 border border-[#2D392C]/25 rounded p-2.5">
                      🎁 <span className="font-bold">{totals.freeDaysCount} {totals.freeDaysCount === 1 ? 'giorno gratis' : 'giorni gratis'}</span>:
                      {' '}{totals.mealsFree} {totals.mealsFree === 1 ? 'pasto è escluso' : 'pasti sono esclusi'} dai conti.
                      Restano segnati nel calendario per la cucina, ma nessuno li paga — per questo i pasti
                      contati qui sotto possono essere meno di quelli che vedi in Presenze.
                    </p>
                  )}
                  <p className="text-[9px] text-gray-400 italic mt-2">
                    Quote arrotondate a 0,10 € (niente monetine da 1/2/5 cent).
                    {Math.abs(totals.roundingDiff) >= 0.005
                      ? ` Scarto rispetto al ripartibile: ${totals.roundingDiff > 0 ? '+' : ''}${money(totals.roundingDiff)} € (sotto 0,50 €, non riconciliato).`
                      : ' Nessuno scarto.'}
                  </p>
                </div>
              )}
            </div>

            </div>)}

            {spesaSection === 'saldi' && (<div className="space-y-4">
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
                  <h4 className="font-rustic text-sm text-[#8F9E8B] mb-1">Chi paga chi</h4>
                  <p className="text-[9px] text-gray-400 mb-2">Tocca una riga quando il rimborso è stato fatto: resta barrata. Tocca di nuovo per annullare.</p>
                  <ul className="space-y-1.5">
                    {totals.transfers.map((t, i) => {
                      const key = `${t.from}→${t.to}@${Math.round(t.amount * 100)}`;
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
                    const senza = [...new Set(totals.transfers.map((t) => t.to))]
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
              {totals.unattributed > 0.005 && (
                <p className="text-[9px] text-[#D97706] italic mt-2">
                  Attenzione: {money(totals.unattributed)} € di acquisti sono senza acquirente. Assegna un acquirente nel Taccuino per far quadrare i conti.
                </p>
              )}
              {/* Se dei soldi non sono in nessuna quota, i rimborsi NON possono
                  quadrare: chi ha anticipato resta scoperto. Va detto qui, dove
                  si guarda chi paga chi, non solo nella scheda delle quote. */}
              {totals.nonRipartito > 0.005 && (
                <div className="mt-2 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                  <p className="text-[11px] text-[#5C4A3C] leading-snug">
                    <span className="font-bold">I rimborsi non quadrano: {money(totals.nonRipartito)} € non sono nelle quote di nessuno.</span>{' '}
                    Chi ha anticipato quella cifra resterebbe scoperto. Guarda l'avviso in
                    <span className="font-bold"> Quote</span>: dice quali spese sono e come sistemarle.
                  </p>
                </div>
              )}
              {totals.unknownBuyers.length > 0 && (
                <div className="mt-2 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                  <p className="text-[11px] text-[#5C4A3C] leading-snug">
                    <span className="font-bold">Da controllare:</span> ci sono spese intestate a{' '}
                    {totals.unknownBuyers.map((u, i) => (
                      <span key={u.name}>
                        {i > 0 ? ', ' : ''}<span className="font-bold">{u.name}</span> ({money(u.paid)} €)
                      </span>
                    ))}
                    , che non {totals.unknownBuyers.length === 1 ? 'è' : 'sono'} fra i membri. Compare comunque nei
                    rimborsi: se è un nome scritto male o una persona eliminata, correggi l'acquirente nella
                    <span className="font-bold"> Lista della Spesa</span>.
                  </p>
                </div>
              )}
              {/* Le quote arrotondate a 0,10 € fanno raccogliere qualche
                  centesimo in più (o in meno) del speso: quei centesimi non
                  hanno un destinatario, quindi l'ultimo passaggio non combacia
                  col saldo. Senza spiegarlo sembra un errore di conto. */}
              {Math.abs(totals.roundingDiff) >= 0.005 && totals.transfers.length > 0 && (
                <p className="text-[9px] text-gray-400 italic mt-2">
                  Arrotondamento: i passaggi qui sopra valgono in tutto {money(Math.abs(totals.roundingDiff))} € in meno
                  dei saldi indicati. È lo scarto delle quote arrotondate a 0,10 € (così non servono monetine da 1, 2 o 5 cent).
                </p>
              )}
              <p className="text-[9px] text-gray-400 italic mt-1">"Riceve" = ha anticipato più di quanto deve; "dà" = deve versare la differenza.</p>
            </div>

            <button onClick={shareReport} className="w-full py-3 bg-[#25D366] text-white rounded font-bold uppercase text-sm tracking-wide hover:brightness-95 flex items-center justify-center gap-2">
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
                    <button onClick={riapriConti} className="w-full py-2.5 bg-white border-2 border-[#5C4A3C]/50 text-[#5C4A3C] rounded text-xs font-bold uppercase hover:bg-[#E2EAE4]">
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
                    <button onClick={chiudiConti} className="w-full py-2.5 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase hover:bg-[#463628]">
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
                <button onClick={exportData} className="flex-1 py-2.5 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]">Esporta</button>
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
                <button onClick={openClose} className="w-full py-3 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase tracking-wide hover:bg-[#463628]">
                  🏁 Chiudi il campo e archivia
                </button>
              ) : (
                <p className="text-[10px] text-gray-400 italic">La chiusura del campo la fa chi tiene i conti.</p>
              )}
              {archives.length > 0 && (
                <button onClick={() => goTo('archivio')} className="w-full py-2 text-[10px] uppercase font-bold text-[#5C4A3C] hover:underline">
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
                <button onClick={addToBuy} aria-label="Aggiungi alla lista" className="shrink-0 px-3 bg-[#2D392C] text-white rounded font-bold text-lg leading-none hover:bg-[#1F271E]">+</button>
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
                    <button onClick={() => setToBuyQuery('')} aria-label="Azzera la ricerca" className="shrink-0 px-3 text-gray-400 font-bold hover:text-gray-600">&times;</button>
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
                          <button onClick={() => setViewReceipt(receipts[it.id])} aria-label="Vedi scontrino" className="shrink-0 px-2 py-1.5 rounded border-2 border-[#2D392C] bg-[#2D392C] text-white leading-none">📷</button>
                        )}
                        <button onClick={() => removeToBuy(it.id)} aria-label="Rimuovi" className="shrink-0 text-red-700 font-bold px-1.5 hover:text-red-900">&times;</button>
                      </div>
                      <button
                        onClick={() => setBuying({ id: it.id, name: it.name, qty: it.qty, price: '', buyer: '', type: 'alimentare', account: 'comune' })}
                        className="mt-2 w-full py-2 bg-[#5C4A3C] text-white rounded text-[10px] font-bold uppercase tracking-wide hover:bg-[#463628]"
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
                    className="px-2 py-1 text-gray-400 font-bold text-xl leading-none hover:text-gray-600"
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

              <button onClick={addPurchase} className="w-full py-3 bg-[#2D392C] text-white rounded font-bold uppercase text-sm tracking-wide hover:bg-[#1F271E]">
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
                    <button onClick={() => setPurchaseQuery('')} aria-label="Azzera la ricerca" className="shrink-0 px-3 text-gray-400 font-bold hover:text-gray-600">&times;</button>
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
                          <button onClick={() => setViewReceipt(receipts[p.id])} aria-label="Vedi scontrino" className="shrink-0 px-2 py-1 rounded border-2 border-[#2D392C] bg-[#2D392C] text-white text-sm leading-none">📷</button>
                        ) : (
                          <label title="Scontrino: scatta una foto o scegli dalla galleria" aria-label="Allega scontrino" className="shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-[#8F9E8B]/50 bg-white text-sm leading-none hover:bg-[#E2EAE4]">
                            📷
                            <input type="file" accept="image/*" onChange={(e) => attachReceiptTo(e, p.id)} className="hidden" />
                          </label>
                        )}
                        <button onClick={() => openEditPurchase(p)} aria-label="Correggi" title="Correggi questa spesa" className="shrink-0 px-1.5 text-[#8F9E8B] hover:text-[#2D392C] text-sm leading-none">✏️</button>
                        <button onClick={() => removePurchase(p.id)} aria-label="Rimuovi" className="text-red-700 font-bold px-1.5 hover:text-red-900 shrink-0">&times;</button>
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
                <button onClick={addEquip} className="shrink-0 px-3 bg-[#2D392C] text-white rounded font-bold uppercase text-xs hover:bg-[#1F271E]">Aggiungi</button>
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
                          <button onClick={() => setViewReceipt(receipts[e.id])} aria-label="Vedi scontrino" className="shrink-0 px-2 py-1 rounded border-2 border-[#2D392C] bg-[#2D392C] text-white text-sm leading-none">📷</button>
                        ) : (
                          <label title="Scontrino: scatta una foto o scegli dalla galleria" aria-label="Allega scontrino" className="shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-[#8F9E8B]/50 bg-white text-sm leading-none hover:bg-[#E2EAE4]">
                            📷
                            <input type="file" accept="image/*" onChange={(ev) => attachReceiptTo(ev, e.id)} className="hidden" />
                          </label>
                        )}
                        <button onClick={() => openEditEquip(e)} aria-label="Correggi" title="Correggi questa voce" className="shrink-0 px-2 py-1 text-[#8F9E8B] hover:text-[#2D392C] text-sm leading-none">✏️</button>
                        <button onClick={() => removeEquip(e.id)} aria-label="Rimuovi" className="text-red-700 font-bold px-2 py-1 hover:text-red-900 shrink-0 leading-none">&times;</button>
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
                    la griglia per trovarle. La scelta per il ricordo funziona
                    solo in griglia, quindi ci passa da sola. */}
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
                      ? `Tocca le foto da mettere nel ricordo (fino a ${MAX_RICORDO}). L'ordine è quello con cui le scegli.`
                      : <>Scelte <span className="font-bold">{picked.length}</span> foto su {MAX_RICORDO} · {Math.ceil(picked.length / 4)} {Math.ceil(picked.length / 4) === 1 ? 'pagina' : 'pagine'}</>}
                  </p>
                  <button
                    onClick={() => generaRicordo(photos)}
                    disabled={picked.length === 0 || !!pdfBusy}
                    className={`w-full py-3 rounded font-bold uppercase text-sm tracking-wide ${picked.length > 0 && !pdfBusy ? 'bg-[#5C4A3C] text-white hover:bg-[#463628]' : 'bg-gray-200 text-gray-400'}`}
                  >
                    {pdfBusy || `Crea album ricordo${picked.length ? ` (${picked.length})` : ''}`}
                  </button>
                  <p className="text-[9px] text-gray-400 italic leading-snug">
                    Crea un PDF con le foto scelte su uno sfondo di montagna, quattro per pagina.
                    Le foto vengono scaricate a piena qualità, quindi ci vuole qualche secondo.
                  </p>
                </div>
              )}

              {photos.length > 0 && !picking && cloud.connected && (
                <>
                  <button
                    onClick={() => { setGalleryView('griglia'); setPicking(true); }}
                    className="w-full mt-3 py-2.5 rounded border-2 border-[#5C4A3C]/40 text-[#5C4A3C] font-bold uppercase text-xs tracking-wide hover:bg-[#5C4A3C]/10"
                  >
                    📕 Crea album ricordo
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
                        <button onClick={() => setViewArchive(a)} className="flex-1 py-2 bg-[#2D392C] text-white rounded text-[10px] font-bold uppercase hover:bg-[#1F271E]">Resoconto</button>
                        {a.photos > 0 && (
                          <button onClick={() => openAlbum(a)} className="flex-1 py-2 bg-[#8F9E8B] text-white rounded text-[10px] font-bold uppercase hover:brightness-95">Album</button>
                        )}
                        <button onClick={() => downloadArchive(a)} className="flex-1 py-2 bg-[#5C4A3C] text-white rounded text-[10px] font-bold uppercase hover:bg-[#463628]">Scarica</button>
                        <button onClick={() => removeArchive(a)} aria-label="Elimina archivio" className="px-3 py-2 bg-white border-2 border-red-700/30 text-red-700 rounded text-[10px] font-bold uppercase hover:bg-red-50">Elimina</button>
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
                  <button onClick={() => setAlbum(null)} className="text-[10px] uppercase font-bold text-gray-500 shrink-0 px-2">Chiudi</button>
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
                  <button onClick={startGame} className="w-full py-3 bg-[#2D392C] text-white rounded font-bold uppercase text-sm tracking-wide hover:bg-[#1F271E]">
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
                      onClick={() => { setPhotoCap(n); localStorage.setItem(PHOTO_CAP_KEY, String(n)); }}
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
                          className="w-full mt-2 py-2 bg-[#D97706] text-white rounded text-[10px] font-bold uppercase tracking-wide"
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
                        <button onClick={annullaSync} className="w-full py-2 bg-[#D97706] text-white rounded text-[10px] font-bold uppercase tracking-wide">
                          Annulla quella sincronizzazione
                        </button>
                        <button
                          onClick={() => { if (window.confirm('Buttare la copia di scorta?\nDopo non si potrà più annullare quella sincronizzazione.')) { localStorage.removeItem(RESCUE_KEY); setLostSync(null); setDiagTick((t) => t + 1); } }}
                          className="w-full py-1.5 text-[9px] uppercase font-bold text-gray-500"
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
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[#E2EAE4]/60"
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
                        <button onClick={esportaRegistro} className="flex-1 py-2 bg-[#2D392C] text-white rounded text-[10px] font-bold uppercase">Esporta il registro</button>
                        <button
                          onClick={() => { if (window.confirm('Svuotare il registro delle modifiche?\nI dati non vengono toccati: si perde solo lo storico.')) { localStorage.removeItem(LOG_KEY); setDiagTick((t) => t + 1); } }}
                          className="flex-1 py-2 bg-white border-2 border-[#8F9E8B]/50 text-[#5C4A3C] rounded text-[10px] font-bold uppercase"
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
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[#E2EAE4]/60"
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
                  <button onClick={lockNow} className="w-full py-2.5 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase hover:bg-[#463628]">
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
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[#E2EAE4]/60"
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
                <button onClick={exportData} className="flex-1 py-2.5 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]">Esporta backup</button>
                <button onClick={() => goTo('spesa')} className="flex-1 py-2.5 bg-white border-2 border-[#8F9E8B]/50 text-[#2D392C] rounded text-xs font-bold uppercase hover:bg-[#E2EAE4]">Gestione dati</button>
              </div>
              <button onClick={wipeLocal} className="w-full py-2.5 bg-white border-2 border-red-700/40 text-red-700 rounded text-xs font-bold uppercase hover:bg-red-50">
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
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[#E2EAE4]/60"
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
                      className="w-full py-2.5 bg-white border-2 border-[#8F9E8B]/50 text-[#5C4A3C] rounded text-xs font-bold uppercase hover:bg-[#E2EAE4]"
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
                        className="shrink-0 px-4 py-2.5 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]"
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
                  className="shrink-0 px-3 py-2 rounded border-2 border-[#2D392C] bg-[#2D392C] text-white text-lg leading-none"
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
              <button onClick={() => setBuying(null)} className="flex-1 py-2.5 bg-white border border-[#8F9E8B]/50 text-gray-500 rounded text-xs font-bold uppercase">Annulla</button>
              <button onClick={confirmBuy} className="flex-1 py-2.5 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]">Conferma</button>
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
                <button onClick={() => setViewReceipt(receipts[editing.id])} aria-label="Vedi scontrino" className="shrink-0 px-3 py-2 rounded border-2 border-[#2D392C] bg-[#2D392C] text-white text-lg leading-none">📷</button>
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

            {editing.kind === 'purchase' && editing.type !== 'logistica' && (
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
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 bg-white border border-[#8F9E8B]/50 text-gray-500 rounded text-xs font-bold uppercase">Annulla</button>
              <button onClick={saveEdit} className="flex-1 py-2.5 bg-[#2D392C] text-white rounded text-xs font-bold uppercase hover:bg-[#1F271E]">Salva</button>
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
            <button onClick={() => setSnapList(null)} className="w-full py-2 text-xs uppercase font-bold text-gray-500 hover:text-gray-700">Annulla</button>
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
            <button onClick={closeCamp} className="w-full py-3 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase tracking-wide hover:bg-[#463628]">
              Archivia e azzera
            </button>
            <button onClick={() => setClosing(false)} className="w-full py-2 text-xs uppercase font-bold text-gray-500 hover:text-gray-700">Annulla</button>
          </div>
        </div>
      )}

      {/* Resoconto di un campo archiviato */}
      {viewArchive && (
        <div onClick={() => setViewArchive(null)} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-lg p-4 w-full max-w-xs space-y-3 max-h-[80vh] overflow-y-auto shadow-2xl">
            <h3 className="font-rustic text-lg text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2">{viewArchive.name}</h3>
            <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{viewArchive.report || 'Nessun resoconto salvato.'}</pre>
            <button onClick={() => shareArchive(viewArchive)} className="w-full py-2.5 bg-[#25D366] text-white rounded text-xs font-bold uppercase hover:brightness-95">📤 Condividi</button>
            <button onClick={() => setViewArchive(null)} className="w-full py-2 text-xs uppercase font-bold text-gray-500 hover:text-gray-700">Chiudi</button>
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

const root = createRoot(document.getElementById('root'));
root.render(<App />);
