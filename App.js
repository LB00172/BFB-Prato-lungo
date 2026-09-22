/* File GENERATO dai sorgenti in src/ tramite Babel (node build.js). Non modificare a mano. */
const {
  useState,
  useEffect,
  useRef
} = React;

// ---------- La lingua corrente ----------
// "L" e' il traduttore in uso: L.t(chiave) per i testi, L.data(d, forma) per
// le date. Vive qui perche' serve anche fuori da App() (il registro delle
// modifiche formatta le date, e non e' un componente).
//
// LA RIASSEGNA App() A OGNI DISEGNO, dal suo stato. E' questo che la rende
// corretta: cambiare lingua cambia uno stato di React, React ridisegna, e il
// disegno legge il valore appena messo. Non e' "una variabile globale letta a
// caso" — e' una variabile globale SCRITTA DAL DISEGNO, prima che le schede
// la leggano.
//
// Cosa la romperebbe: trasformare una scheda in un componente memoizzato.
// Quello salterebbe il ridisegno e resterebbe con la lingua di prima. Le
// schede non sono componenti, ed e' anche per questo (ROADMAP.md § 14).
let L = window.Lingue.crea(window.Lingue.PREDEFINITA);
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

// Scrittura "secca" in localStorage che non fa saltare l'app se la memoria e'
// piena. Vale per i valori che non passano da salvaLocale: stringhe singole,
// preferenze, contatori. Se non c'e' spazio il dato si perde — l'app no.
const scriviLocale = (chiave, valore) => {
  try {
    localStorage.setItem(chiave, valore);
    return true;
  } catch (e) {
    return false;
  }
};
const SNAP_QUANTE = 14; // 7 giorni × 2 fasce
const SNAP_SPAZIO = 600 * 1024; // tetto di memoria per l'insieme

// Due fasce al giorno. L'app gira solo quando è aperta, quindi non può
// "svegliarsi" a mezzanotte: la copia della fascia si fa al PRIMO utilizzo
// dentro quella fascia. In pratica: una copia di come stavano le cose la
// mattina, e una di come stavano a mezzogiorno.
const snapFascia = d => `${toDateStr(d)}T${d.getHours() < 12 ? '00' : '12'}`;
const snapLocaliLeggi = () => {
  try {
    const v = JSON.parse(localStorage.getItem(SNAP_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch (e) {
    return {};
  }
};

// Le copie vecchie si buttano per numero E per spazio occupato: in un
// telefono con poca memoria libera è più importante non riempire lo spazio
// che tenere sette giorni di storia.
const snapPota = tutte => {
  let chiavi = Object.keys(tutte).sort();
  while (chiavi.length > SNAP_QUANTE) {
    delete tutte[chiavi[0]];
    chiavi = chiavi.slice(1);
  }
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
  tutte[fascia] = {
    at: quando || Date.now(),
    dati: JSON.stringify(stato)
  };
  snapPota(tutte);
  // Se la memoria è piena si butta la copia più vecchia e si riprova: meglio
  // perdere la storia lontana che restare senza la copia di adesso.
  for (let tentativi = 0; tentativi < 4; tentativi++) {
    try {
      localStorage.setItem(SNAP_KEY, JSON.stringify(tutte));
      return true;
    } catch (e) {
      const chiavi = Object.keys(tutte).sort();
      if (chiavi.length <= 1) return false;
      delete tutte[chiavi[0]];
    }
  }
  return false;
};

// Legge una copia, accettando anche il vecchio formato (solo testo).
const snapLocaleDati = v => (v && typeof v === 'object' ? v.dati : v) || null;

// ---------- Backup su file: quando è stato fatto l'ultimo ----------
const BACKUP_KEY = 'cambusa_backup_data';

// ---------- Registro delle modifiche ----------
// Ogni cambiamento (fatto qui o arrivato dal cloud) finisce in un diario
// locale con data e ora. Non ci sono utenti tracciati, quindi si registra
// almeno DA DOVE arriva: "questo telefono" o "sincronizzazione". Serve a
// rispondere alla domanda che ci siamo fatti dopo la perdita delle presenze:
// chi ha cambiato cosa, e quando.
const LOG_KEY = 'cambusa_registro';
const LOG_MAX = 400; // oltre, si buttano le più vecchie
const LOG_UNISCI = 60 * 1000; // stessa voce entro un minuto: si aggiorna

const logLeggi = () => {
  try {
    const v = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
};

// voci: [{ p: percorso, k: 'm' (modifica) | 'd' (cancellazione) }]
const logScrivi = (voci, origine, now) => {
  if (!voci || voci.length === 0) return;
  const t = now || Date.now();
  const reg = logLeggi();
  voci.forEach(v => {
    // Scrivere in una casella di testo produce una modifica per battuta:
    // se la stessa voce è già stata registrata da poco, si aggiorna l'ora
    // invece di riempire il registro di righe identiche.
    const recente = reg.find(r => r.p === v.p && r.o === origine && r.k === v.k && t - r.at < LOG_UNISCI);
    if (recente) {
      recente.at = t;
      return;
    }
    reg.unshift({
      at: t,
      p: v.p,
      k: v.k,
      o: origine
    });
  });
  reg.sort((a, b) => b.at - a.at);
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(reg.slice(0, LOG_MAX)));
  } catch (e) {/* spazio esaurito: il registro è la prima cosa sacrificabile */}
};

// Differenza fra due appiattimenti: cosa è nato/cambiato e cosa è sparito.
const diffFlat = (prima, dopo) => {
  const voci = [];
  Object.keys(dopo).forEach(p => {
    if (prima[p] !== dopo[p]) voci.push({
      p,
      k: 'm'
    });
  });
  Object.keys(prima).forEach(p => {
    if (!(p in dopo)) voci.push({
      p,
      k: 'd'
    });
  });
  return voci;
};

// Sezione dell'app a cui appartiene un percorso: serve a raggruppare il
// registro per area invece di mostrare una lista piatta di sigle.
// La tabella tiene le CHIAVI, non i nomi: e' una costante, e si valuta una
// volta sola al caricamento — se ci mettessimo i nomi tradotti resterebbero
// per sempre nella lingua di quel momento. Il nome si chiede al disegno.
const SEZIONE_DI = {
  m: 'sezione.membri',
  p: 'sezione.lista',
  t: 'sezione.daAcquistare',
  e: 'sezione.attrezzatura',
  g: 'sezione.dotazioni',
  s: 'sezione.saldi',
  x: 'sezione.contoSeparato',
  f: 'sezione.giorniGratis'
};
const sezioneDiPath = p => {
  const parti = String(p).split('|');
  if (parti[0] === 'c') return L.t(parti[2] === 'meals' ? 'sezione.presenze' : parti[3] === 'note' ? 'sezione.menu' : 'sezione.calendario');
  return L.t(SEZIONE_DI[parti[0]] || 'sezione.altro');
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
  } catch (e) {/* spazio esaurito: si perde solo il nome */}
};
const exMembri = () => {
  try {
    return JSON.parse(localStorage.getItem(EX_MEMBERS_KEY) || '{}');
  } catch (e) {
    return {};
  }
};

// Traduce i "percorsi" della sincronizzazione in italiano, per poter dire cosa
// è sparito invece di mostrare sigle.
// Un singolo percorso in italiano: serve alla diagnostica, per capire COSA è
// stato cancellato e QUANDO, invece di leggere sigle tipo "c|2026-08-13|meals|k3".
const descriviPath = (p, stato) => {
  const parti = String(p).split('|');
  const nomeMembro = id => {
    const m = (stato.members || []).find(x => x.id === id);
    return m ? m.name : L.t('percorso.exMembro');
  };
  const giorno = d => {
    try {
      return L.data(parseDate(d), 'settimana');
    } catch (e) {
      return d;
    }
  };
  const voce = (lista, id, etichetta) => {
    const it = (stato[lista] || []).find(x => x.id === id);
    return `${etichetta}${it && it.name ? ` "${it.name}"` : ''}`;
  };
  switch (parti[0]) {
    case 'c':
      if (parti[2] === 'meals') return L.t('percorso.presenzaDi', nomeMembro(parti[3]), giorno(parti[1]));
      if (parti[3] === 'note') return L.t('percorso.menuDel', giorno(parti[1]));
      if (parti[3] === 'appunti') return L.t('percorso.noteDel', giorno(parti[1]));
      if (parti[3] === 'guestsNames') return L.t('percorso.ospitiDel', giorno(parti[1]));
      return L.t('percorso.campoDel', parti[3], giorno(parti[1]));
    case 'm':
      return voce('members', parti[1], L.t('percorso.membro'));
    case 'p':
      return voce('purchases', parti[1], L.t('percorso.spesa'));
    case 't':
      return voce('toBuy', parti[1], L.t('percorso.daAcquistare'));
    case 'e':
      return voce('equipment', parti[1], L.t('percorso.attrezzatura'));
    case 'g':
      return voce('gear', parti[1], L.t('percorso.dotazione'));
    case 's':
      return L.t('percorso.rimborsoSaldato');
    case 'x':
      return L.t('percorso.giornoSeparato', giorno(parti[1]));
    case 'f':
      return L.t('percorso.giornoGratis', giorno(parti[1]));
    default:
      return p;
  }
};
const descriviPerdite = (paths, stato) => {
  const nome = id => {
    const m = (stato.members || []).find(x => x.id === id);
    return m ? m.name : L.t('percorso.qualcuno');
  };
  const conta = {
    presenze: 0,
    membri: 0,
    spese: 0,
    lista: 0,
    attrezzatura: 0,
    dotazioni: 0,
    altro: 0
  };
  const giorni = new Set();
  const chi = new Set();
  paths.forEach(p => {
    const parti = p.split('|');
    if (parti[0] === 'c' && parti[2] === 'meals') {
      conta.presenze++;
      giorni.add(parti[1]);
      chi.add(nome(parti[3]));
    } else if (parti[0] === 'm') conta.membri++;else if (parti[0] === 'p') conta.spese++;else if (parti[0] === 't') conta.lista++;else if (parti[0] === 'e') conta.attrezzatura++;else if (parti[0] === 'g') conta.dotazioni++;else conta.altro++;
  });
  const pezzi = [];
  if (conta.presenze) {
    pezzi.push(L.t('perdite.presenze', conta.presenze, giorni.size, `${[...chi].slice(0, 4).join(', ')}${chi.size > 4 ? '…' : ''}`));
  }
  if (conta.membri) pezzi.push(L.t('perdite.membri', conta.membri));
  if (conta.spese) pezzi.push(L.t('perdite.spese', conta.spese));
  if (conta.lista) pezzi.push(L.t('perdite.lista', conta.lista));
  if (conta.attrezzatura) pezzi.push(L.t('perdite.attrezzatura', conta.attrezzatura));
  if (conta.dotazioni) pezzi.push(L.t('perdite.dotazioni', conta.dotazioni));
  if (conta.altro) pezzi.push(L.t('perdite.altro', conta.altro));
  return pezzi.join(' · ');
};

// ============================================================================
//  BLOCCO CON PASSWORD
// ============================================================================
// L'impronta della password sta in firebase-config.js (window.APP_LOCK): qui si
// ricalcola l'impronta di quello che viene digitato e si confrontano. La
// password in chiaro non viene mai salvata da nessuna parte.
const LOCK = typeof window !== 'undefined' && window.APP_LOCK || null;
const UNLOCK_KEY = 'cambusa_unlock';
// Modalità tecnica: la diagnostica, il registro e gli avvisi della
// sincronizzazione parlano di lapidi, cronologie e voci perse — roba che serve
// a chi tiene i conti e mette ansia a tutti gli altri. Si accende per telefono,
// con una password sua (impronta in firebase-config.js, window.APP_ADMIN).
const ADMIN_KEY = 'cambusa_admin';
const LOCK_ALWAYS_KEY = 'cambusa_lock_always';
const FAIL_KEY = 'cambusa_lock_fail';
const UNTIL_KEY = 'cambusa_lock_until';
const toHex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = s => new Uint8Array((String(s).match(/.{2}/g) || []).map(h => parseInt(h, 16)));

// Ritorna l'impronta di una password secondo una configurazione {salt, iter},
// o null se il browser non offre le funzioni crittografiche (servono https
// oppure localhost). Usata sia dal blocco sia dalla modalità tecnica.
async function improntaPassword(pwd, cfg) {
  const subtle = window.crypto && window.crypto.subtle;
  if (!subtle || !cfg || !cfg.salt) return null;
  const base = await subtle.importKey('raw', new TextEncoder().encode(pwd), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({
    name: 'PBKDF2',
    salt: fromHex(cfg.salt),
    iterations: cfg.iter || 200000,
    hash: 'SHA-256'
  }, base, 256);
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
    return sessionStorage.getItem(UNLOCK_KEY) === LOCK.hash || !lockAlways() && localStorage.getItem(UNLOCK_KEY) === LOCK.hash;
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
  } catch (e) {/* memoria non disponibile: resta sbloccato solo per ora */}
};
const forgetUnlock = () => {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
    localStorage.removeItem(UNLOCK_KEY);
  } catch (e) {/* ignora */}
};

// ---------- Tema (chiaro / scuro / automatico) ----------
const THEME_KEY = 'cambusa_theme';
const readTheme = () => {
  const t = localStorage.getItem(THEME_KEY);
  return t === 'light' || t === 'dark' ? t : 'auto';
};
// Applica il tema al documento: da qui dipende il CSS in index.html.
const applyTheme = pref => {
  const dark = pref === 'dark' || pref === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const root = document.documentElement;
  if (dark) root.setAttribute('data-theme', 'dark');else root.removeAttribute('data-theme');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#1a201a' : '#2D392C');
  return dark;
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Formato dei soldi e numero non negativo: stanno in conti.js insieme a chi
// li usa di piu'. Qui si riprendono da li' invece di riscriverli, perche' due
// copie della stessa regola sui soldi prima o poi divergono — e l'app e i
// conti mostrerebbero due cifre diverse per la stessa spesa.
const money = window.Conti.money;
const posNum = window.Conti.posNum;

// "note" tiene il MENÙ del giorno (la scheda Menù scrive lì da sempre);
// "appunti" sono le note libere del Calendario. Due campi distinti: unirli
// vorrebbe dire che chi scrive la lista della cena cancella il promemoria
// della legna.
const initialDayState = () => ({
  note: '',
  appunti: '',
  guestsNames: '',
  meals: {}
});

// ---- Dati per farsi rimborsare (PayPal / IBAN) ----
// L'IBAN si controlla davvero: una lettera sbagliata manda i soldi altrove (o
// li fa rimbalzare dopo giorni). Controllo standard mod-97 (ISO 13616).
const ibanClean = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const ibanPretty = v => ibanClean(v).replace(/(.{4})/g, '$1 ').trim();
const ibanValid = v => {
  const s = ibanClean(v);
  if (s.length < 15 || s.length > 34 || !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false;
  const rot = s.slice(4) + s.slice(0, 4);
  let resto = 0;
  for (let i = 0; i < rot.length; i++) {
    const c = rot.charCodeAt(i);
    const n = c >= 65 ? c - 55 : c - 48; // A=10 … Z=35
    resto = (resto * (n > 9 ? 100 : 10) + n) % 97;
  }
  return resto === 1;
};

// Copia negli appunti, con ripiego per i browser che non danno il permesso.
const copyToClipboard = testo => {
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
  } catch (e) {
    return Promise.resolve(false);
  }
};

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
// "compiti" e' acceso qui e spento sulla versione pubblica finche' non
// esistono le Room (ROADMAP.md § 2): assegnare un compito presuppone un
// gestore, e senza gestore assegna chiunque. In un gruppo di amici va
// benissimo — e' come funzionava sugli appunti a mano — ma venderlo cosi' no.
// "lingue" e' accesa da settembre 2026: i dizionari coprono tutte e
// diciannove le schermate (ROADMAP.md § 18). L'italiano resta la lingua
// predefinita — si cambia da Impostazioni, e la scelta resta sul telefono.
// Quello che scrive l'utente (nomi, menu', spese) non si traduce mai.
const FEATURES = {
  auth: false,
  rooms: false,
  equipExemption: false,
  compiti: true,
  lingue: true,
  ...(CFG.features || {})
};
const LINGUA_KEY = 'cambusa_lingua';

// Periodo del campo. Durante il campo l'app si apre sul giorno corrente.
const CAMP_START = '2026-08-11';
const CAMP_END = '2026-08-16';
const defaultDateStr = () => {
  const today = toDateStr(new Date());
  return today >= CAMP_START && today <= CAMP_END ? today : CAMP_START;
};

// Tipologie di acquisto e a quale voce di spesa contribuiscono.
// La tabella tiene le CHIAVI del dizionario, non i nomi: e' una costante, e
// si valuta al caricamento — prima che App() assegni L. Con i nomi dentro
// resterebbero per sempre nella lingua di quel momento. Il nome si chiede a
// tipoSpesa(), che gira al disegno.
const PURCHASE_TYPES = {
  alimentare: 'tipoSpesa.alimentare',
  bevande: 'tipoSpesa.bevande',
  logistica: 'tipoSpesa.logistica'
};
const tipoSpesa = k => PURCHASE_TYPES[k] ? L.t(PURCHASE_TYPES[k]) : '';

// Codici meteo WMO (Open-Meteo) -> icona e descrizione.
const wmoInfo = code => {
  if (code === 0) return {
    icon: '☀️',
    label: L.t('cielo.sereno')
  };
  if (code === 1 || code === 2) return {
    icon: '🌤️',
    label: L.t('cielo.pocoNuvoloso')
  };
  if (code === 3) return {
    icon: '☁️',
    label: L.t('cielo.coperto')
  };
  if (code === 45 || code === 48) return {
    icon: '🌫️',
    label: L.t('cielo.nebbia')
  };
  if (code >= 51 && code <= 57) return {
    icon: '🌦️',
    label: L.t('cielo.pioviggine')
  };
  if (code >= 61 && code <= 67) return {
    icon: '🌧️',
    label: L.t('cielo.pioggia')
  };
  if (code >= 71 && code <= 77) return {
    icon: '🌨️',
    label: L.t('cielo.neve')
  };
  if (code >= 80 && code <= 82) return {
    icon: '🌦️',
    label: L.t('cielo.rovesci')
  };
  if (code === 85 || code === 86) return {
    icon: '🌨️',
    label: L.t('cielo.rovesciNeve')
  };
  if (code >= 95) return {
    icon: '⛈️',
    label: L.t('cielo.temporale')
  };
  return {
    icon: '🌡️',
    label: L.t('cielo.ignoto')
  };
};

// Quanto "pesa" una condizione. Serve a due cose: scegliere la faccia della
// giornata e capire se il brutto vale la pena di essere nominato.
const gravitaWmo = c => c >= 95 ? 5 : c >= 80 ? 4 : c >= 71 ? 4 : c >= 61 ? 3 : c >= 51 ? 2 : c === 45 || c === 48 ? 1 : c === 3 ? 1 : 0;

// Le ore in cui si sta fuori: e' su quelle che si giudica una giornata di campo.
const ORE_FUORI = [8, 21];
const momentoDelGiorno = ora => ora == null ? '' : L.t(ora < 6 ? 'momento.notte' : ora < 12 ? 'momento.mattina' : ora < 18 ? 'momento.pomeriggio' : 'momento.sera');

// Come si racconta una giornata a chi deve decidere se fare la camminata.
// Il codice WMO GIORNALIERO di Open-Meteo e' il piu' severo delle 24 ore: una
// sola ora di temporale dipinge di nero un giorno con otto ore di sole. Qui la
// faccia della giornata e' la condizione PREVALENTE nelle ore diurne, e il
// brutto — se c'e' — viene detto a parte, col suo momento. Le previsioni vecchie
// non hanno questi campi: si torna al comportamento di prima senza rumore.
const raccontaMeteo = wx => {
  if (!wx) return null;
  const testaCode = wx.giorno != null ? wx.giorno : wx.code;
  const testa = wmoInfo(testaCode);
  const nominaBrutto = wx.peggio != null && gravitaWmo(wx.peggio) > gravitaWmo(testaCode);
  const mm = typeof wx.mm === 'number' && wx.mm >= 0.2 ? (wx.mm < 10 ? wx.mm.toFixed(1) : String(Math.round(wx.mm))) + ' mm' : null;
  return {
    icon: testa.icon,
    label: testa.label,
    coda: nominaBrutto ? `${wmoInfo(wx.peggio).label.toLowerCase()} ${momentoDelGiorno(wx.ora)}`.trim() : '',
    mm
  };
};

// Dalla previsione ORARIA si ricava la forma della giornata. Le ore non si
// conservano: 384 valori per variabile finirebbero nel documento condiviso e
// nella memoria di ogni telefono, e servono solo a questo riassunto.
const formaDelGiorno = ore => {
  if (!Array.isArray(ore) || !ore.length) return {};
  const diurne = ore.filter(x => x.ora >= ORE_FUORI[0] && x.ora <= ORE_FUORI[1]);
  const base = diurne.length ? diurne : ore;
  // Condizione prevalente: la piu' frequente. A pari frequenza vince la piu'
  // mite, perche' la faccia della giornata deve dire com'e' di solito.
  const conta = new Map();
  base.forEach(x => conta.set(x.code, (conta.get(x.code) || 0) + 1));
  let giorno = base[0].code,
    quante = 0;
  conta.forEach((v, c) => {
    if (v > quante || v === quante && gravitaWmo(c) < gravitaWmo(giorno)) {
      quante = v;
      giorno = c;
    }
  });
  // L'ora peggiore, ma solo se c'e' davvero qualcosa da segnalare.
  let peggio = null;
  base.forEach(x => {
    if (gravitaWmo(x.code) >= 2 && (!peggio || gravitaWmo(x.code) > gravitaWmo(peggio.code))) peggio = x;
  });
  return {
    giorno,
    peggio: peggio ? peggio.code : null,
    ora: peggio ? peggio.ora : null
  };
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
if (typeof window !== 'undefined') window.__meteo = {
  quandoMeteo
};

// Dotazione personale base: uguale per tutti, non modificabile dall'app.
// Le voci con emphasis: true sono mostrate in evidenza (piu' grandi e sottolineate).
// Regole dell'accampamento (mostrate in maiuscolo e sottolineate).
// Testo VERBATIM come scritto da Lorenzo: non correggere.
const CAMP_RULES = ['Amici, parenti e prole al seguito sono sotto la stretta giurisdizione di chi li ha trascinati qui. Siete i domatori ufficiali delle vostre creature, grandi o piccole che siano: fate in modo che rispettino le regole dell\'accampamento. Istruiteli a dovere anche sull\' attrezzatura da portarsi.', 'Il vincitore del minigioco Bandy, sarà premiato dal EL Presidente  in una sontuosa cerimonia', 'Siamo in montagna, non ad Hogwarts. La griglia non si accende per magia, l\'acqua non levita fino alla cucina e le incrostazioni sulle pentole non scompaiono con un incantesimo. E\' richiesto l\'impegno di tutti, per far rilassare tutti.', 'Il bicchiere di chi sta cuocendo sulla braticola deve essere sempre pieno, adoperatevi di conseguenza se non volete incorrere nelle ire del presidente.', 'Gli ospiti non fanno ospiti. Niente di personale ovviamente. Per fortuna la montagna offre notevole spazio.', 'Membri o ospiti single, di ambo i sessi, sono sempre i ben accetti nella tenda del El Presidente.', 'Se Madre Natura ti offre gentilmente il suo bagno all\'aperto, cerca di essere educato. Usa esclusivamente prodotti che la foresta possa digerire in fretta e lascia tutto pulito e sistemato. Copri o sotterra i fazzolettini biodegradabili ad ogni utilizzo per il bene di tutti.'];
const BASE_GEAR = [{
  text: 'SEDIA PERSONALE PER ADULTI E EVENTUALI BAMBINI',
  emphasis: true
}, {
  text: 'Stoviglie, posate personali e bicchiere riutilizzabile',
  emphasis: true
}, {
  text: 'Borraccia'
}, {
  text: 'Canovacci'
}, {
  text: 'Luci LED'
}];

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
const intervalloCampo = campData => {
  const giorni = Object.keys(campData || {}).filter(d => {
    const day = (campData || {})[d];
    if (!day) return false;
    const meals = day.meals || {};
    return Object.keys(meals).some(k => meals[k] && (meals[k].lunch || meals[k].dinner));
  }).sort();
  if (giorni.length) return {
    from: giorni[0],
    to: giorni[giorni.length - 1]
  };
  return {
    from: CAMP_START,
    to: CAMP_END
  };
};

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

// ---------- Vocabolario dei bottoni ----------
// Misurato in RICOGNIZIONE-UI.md: 121 bottoni, 45 forme diverse fra quelle a
// classi fisse, di cui una ventina usate una volta sola. Sei altezze per un
// elemento che ne vuole tre. Non e' una tavolozza nuova: e' un nome dato a
// quello che gia' c'era, scegliendo come regola la forma piu' usata.
//
// La divisione degli assi e' la parte che conta:
//   - qui dentro sta COM'E' FATTO il bottone (pieno, bordo, colore, altezza);
//   - al posto di chiamata resta DOVE STA (w-full, flex-1, gap, margini).
// Mescolare i due era proprio il motivo per cui c'erano 45 forme.

// Quattro misure, non sei. La quarta — "piccolo" — esiste perche' nell'app ci
// sono molti bottoni a piena larghezza con l'etichetta a 10px: hanno il corpo
// di un bottone normale ma la scritta minuta, e portarli a 12px avrebbe
// cambiato l'aspetto di mezza applicazione senza che nessuno l'avesse chiesto.
// La scala sale davvero: minuscolo < piccolo < normale < grande.
//
// La larghezza del bordo sta qui e non nel ruolo perche' nel codice era gia'
// cosi': i bottoni minuti hanno il filo sottile, gli altri quello doppio. Non
// l'ho deciso io, l'ho solo scritto.
// TRE misure, non quattro. La quarta — "piccolo" — esisteva perche' aveva il
// corpo di un bottone normale ma la scritta a 10px invece di 12. La scala del
// testo (index.html, ROADMAP.md § 13) dice che fra 10 e 12 non c'era una
// regola: adesso sono la stessa misura, e le due voci erano diventate la
// stessa identica riga. Cancellarla e' il § 13 che arriva alla sua diagnosi
// di agosto: "sei altezze per un elemento che ne vuole tre".
//
// Quello che resta le distingue davvero, ed e' il corpo: px-3 py-1.5,
// px-4 py-2.5, px-4 py-3.
const BOTTONE_MISURA = {
  minuscolo: 'px-3 py-1.5 text-piccolo border',
  normale: 'px-4 py-2.5 text-piccolo border-2',
  grande: 'px-4 py-3 text-normale border-2'
};

// I ruoli veri, guardando cosa fanno i bottoni e non come sono scritti.
// Il pieno marrone NON e' un doppione del verde: nell'app segna le azioni di
// secondo livello (chiudere il campo, creare l'album), ed e' usato abbastanza
// da essere una scelta, non una svista.
const BOTTONE_RUOLO = {
  primario: 'bg-[#2D392C] border-transparent text-white hover:bg-[#1F271E]',
  bruno: 'bg-[#5C4A3C] border-transparent text-white hover:bg-[#463628]',
  secondario: 'bg-white border-[#8F9E8B]/50 text-[#5C4A3C] hover:bg-[#E2EAE4]',
  testuale: 'border-transparent text-[#5C4A3C] hover:text-[#2D392C]',
  distruttivo: 'bg-white border-red-700/40 text-red-700 hover:bg-red-50',
  // L'ambra e' il colore degli avvisi in tutta l'app (86 usi): un bottone
  // ambra e' un'azione che nasce da un problema, non un'azione qualsiasi.
  avviso: 'bg-[#D97706] border-transparent text-white hover:brightness-95',
  // Verde WhatsApp: e' un marchio altrui, non una nostra scelta di tavolozza.
  // Sta qui per non farlo sembrare un colore dell'app usato a caso.
  whatsapp: 'bg-[#25D366] border-transparent text-white hover:brightness-95'
};

// Le icone sono un terzo dei bottoni e non entrano in nessun ruolo: sono
// quadrate, senza maiuscolo, senza etichetta. Forzarle dentro "testuale" le
// farebbe diventare rettangoli con dentro un simbolo. Nel codice la stessa
// "x" di eliminazione esisteva in quattro varianti diverse.
const BOTTONE_ICONA = {
  neutro: 'text-[#8F9E8B] hover:text-[#2D392C]',
  distruttivo: 'text-red-700 hover:text-red-900',
  pieno: 'bg-[#2D392C] text-white hover:bg-[#1F271E]',
  tenue: 'bg-[#8F9E8B]/20 text-[#2D392C] hover:bg-[#8F9E8B]/40'
};
const bottoneIcona = (tono, extra) => ['px-2.5 py-2 rounded font-bold leading-none disabled:opacity-40', BOTTONE_ICONA[tono] || BOTTONE_ICONA.neutro, extra || ''].filter(Boolean).join(' ');

// La riga richiudibile non e' un bottone con un altro colore: e' una forma
// diversa — larga, allineata a sinistra, senza maiuscolo, con il contenuto ai
// due estremi. Passa da qui perche' e' un ruolo, non un caso particolare.
const bottoneRiga = extra => ['w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[#E2EAE4]/60', extra || ''].filter(Boolean).join(' ');

// Uso: className={bottone('primario', 'grande', 'w-full mt-3')}
const bottone = (ruolo, misura, extra) => ['rounded font-bold uppercase tracking-wide disabled:opacity-40', BOTTONE_MISURA[misura] || BOTTONE_MISURA.normale, BOTTONE_RUOLO[ruolo] || BOTTONE_RUOLO.primario, extra || ''].filter(Boolean).join(' ');

// ---------- Chip di scelta ----------
// Il sesto ruolo (RICOGNIZIONE-UI.md, §13): non un'azione, ma una scelta che
// resta accesa. Nel codice erano quindici forme scritte a mano, tutte con lo
// stesso schema `${acceso ? 'verde e bianco' : 'bianco e verde'}` e ogni volta
// un pixel diverso: chi py-2 e chi py-2.5, chi border-b-2 e chi border-b-4,
// chi text-white e chi text-[#F0F4F1] — che a occhio sono lo stesso colore.
//
// Due assi, come per i bottoni:
//   - la FORMA dice com'e' fatto e quanto e' spesso (linguetta, pillola…);
//   - il TONO dice di che colore e' da acceso e da spento.
// Servono tutte e due perche' la stessa forma cambia colore secondo il
// significato: il chip del pranzo e' verde, quello della cena bruno, e non
// e' un vezzo — sono i due colori con cui l'app distingue i pasti ovunque.
const SCELTA_FORMA = {
  // Linguetta: in quale sezione sto. Il filo spesso sotto dice dove sei.
  linguetta: 'py-2.5 rounded font-bold uppercase tracking-wide border-b-4 transition-all',
  // Interruttore: una cosa sola, accesa o spenta, a piena larghezza.
  interruttore: 'py-2.5 rounded font-bold uppercase tracking-wide border-2',
  // Spunta: chip minuto in riga, quello dei pasti.
  spunta: 'px-2.5 py-1.5 rounded font-bold uppercase border',
  // Pillola: scelta leggera in un gruppo che va a capo.
  pillola: 'px-3 py-1.5 rounded-full font-bold transition-colors',
  // Giunta: due chip attaccati dentro una cornice sola. Niente angoli
  // propri: glieli da' il contenitore, altrimenti si vedono due bordi.
  giunta: 'px-2.5 py-1.5 font-bold uppercase',
  // Etichetta: dice cos'e' una cosa (adulto/bambino), non cosa succede.
  etichetta: 'px-2 py-1 rounded font-bold uppercase',
  // Casella: la spunta quadrata di una lista di cose da fare. Non e' un chip
  // con dentro una parola — e' un quadrato con dentro un segno — ma il
  // meccanismo e' lo stesso: acceso o spento, e si tocca per cambiare.
  // E' entrata nel vocabolario quando e' comparsa la seconda volta.
  casella: 'w-6 h-6 shrink-0 rounded border-2 flex items-center justify-center font-bold'
};
const SCELTA_TONO = {
  // Da acceso il bordo sotto e' bruno, non verde: e' quello che fa sembrare
  // la linguetta una linguetta invece di un bottone premuto.
  sezione: {
    acceso: 'bg-[#2D392C] text-white border-[#5C4A3C]',
    spento: 'bg-white text-[#2D392C] border-gray-300 hover:bg-[#E2EAE4]'
  },
  bordato: {
    acceso: 'bg-[#2D392C] text-white border-[#2D392C]',
    spento: 'bg-white text-[#2D392C] border-[#8F9E8B]/50 hover:bg-[#E2EAE4]'
  },
  // Pranzo e cena: spento e' GRIGIO, non bianco. Qui "spento" vuol dire "non
  // c'era", e deve sparire dall'occhio — a colpo d'occhio si contano i
  // presenti, non si legge riga per riga.
  pranzo: {
    acceso: 'bg-[#2D392C] text-white border-[#2D392C]',
    spento: 'bg-white text-gray-400 border-gray-300'
  },
  cena: {
    acceso: 'bg-[#5C4A3C] text-white border-[#5C4A3C]',
    spento: 'bg-white text-gray-400 border-gray-300'
  },
  tenue: {
    acceso: 'bg-[#2D392C] text-white',
    spento: 'bg-[#F0F4F1] text-[#2D392C] border border-[#8F9E8B]/40 hover:bg-[#E2EAE4]'
  },
  piatto: {
    acceso: 'bg-[#2D392C] text-white',
    spento: 'bg-white text-[#2D392C]'
  },
  // Spunta: da spenta e' un quadrato vuoto col filo sage. Il segno di spunta
  // c'e' sempre ma e' trasparente: cosi' la casella non cambia dimensione
  // quando la si tocca, e la riga non salta.
  casella: {
    acceso: 'bg-[#2D392C] border-[#2D392C] text-white',
    spento: 'bg-white border-[#8F9E8B] text-transparent'
  },
  // Ambra: il colore con cui l'app segna le cose fuori dai conti. Un bambino
  // non paga, e quel chip lo dice con lo stesso colore degli avvisi.
  ambra: {
    acceso: 'bg-[#D97706] text-white',
    spento: 'bg-gray-200 text-gray-500'
  }
};

// Le misure di testo, le stesse che c'erano gia'.
// Stessa storia dei bottoni: erano cinque misure di testo (9, 10, 11, 12, 16)
// e la scala ne riconosce tre. "piccolo" e "normale" erano diventati la copia
// di "minuscolo", quindi sono spariti.
const SCELTA_TESTO = {
  minimo: 'text-minuto',
  minuscolo: 'text-piccolo',
  // Per i chip che contengono un SEGNO invece di una parola: una spunta non
  // e' un'etichetta minuta, e rimpicciolirla dentro un quadrato da 24 px la
  // fa sembrare sbiadita.
  simbolo: 'text-medio'
};

// Uso: className={bottoneScelta('linguetta', 'sezione', spesaSection === k, 'minuscolo')}
const bottoneScelta = (forma, tono, acceso, misura, extra) => {
  const t = SCELTA_TONO[tono] || SCELTA_TONO.sezione;
  return [SCELTA_FORMA[forma] || SCELTA_FORMA.linguetta, SCELTA_TESTO[misura] || SCELTA_TESTO.minuscolo, acceso ? t.acceso : t.spento, extra || ''].filter(Boolean).join(' ');
};

// ---------- Frasi con una parte in grassetto ----------
// Il dizionario tiene la frase intera, con la parte da evidenziare fra
// asterischi: 'Il compito dice *chi fa cosa*, non quanto costa'. Spezzarla in
// tre stringhe non funzionerebbe — l'ordine delle parole cambia da lingua a
// lingua e il pezzo in mezzo finirebbe nel posto sbagliato.
//
// Uso: {frase('compiti.spiegazione')}
// Il grassetto non e' sempre vestito uguale: dentro un paragrafo grigio il
// pezzo in evidenza a volte e' anche verde. Il vestito sta qui, non nel
// dizionario: il traduttore dice DOVE va l'enfasi, non di che colore e'.
const fraseVestita = (classe, chiave, ...resto) => L.pezzi(chiave, ...resto).map((p, i) => p.grassetto ? /*#__PURE__*/React.createElement("span", {
  key: i,
  className: classe
}, p.testo) : /*#__PURE__*/React.createElement(React.Fragment, {
  key: i
}, p.testo));
const frase = (chiave, ...resto) => fraseVestita('font-bold', chiave, ...resto);
// ============================================================================
//  MINI GIOCO "Aiuta Bandy" — snake in canvas, tutto offline.
//  La canna cresce ogni volta che raccoglie Bandy. Sfondo: bosco visto
//  dall'alto, generato a pixel (nessuna immagine da scaricare).
// ============================================================================
const GAME_COLS = 15;
const BASE_STEP = 170; // millisecondi per passo al livello 1
const BASE_LEN = 3; // lunghezza di partenza a ogni livello
const LEVEL_EVERY = 15; // Bandy necessari per salire di livello
const LEVEL_SPEEDUP = 1.5; // di quanto accelera a ogni livello
const MIN_STEP = 45; // limite di velocità: sotto diventa ingiocabile
const GAME_ROWS = 19;

// I livelli hanno un nome, non un numero: si parte dal campo, si passa per la
// borgata e si finisce a Rio. Oltre il terzo si resta a Rio e cambia solo la
// velocità, quindi il nome resta quello con un'aggiunta.
const LIVELLI = [{
  nome: 'Prato Lungo',
  icona: '🌲'
}, {
  nome: 'Palmiro Togliatti',
  icona: '🏙️'
}, {
  nome: 'Rio de Janeiro',
  icona: '🏖️'
}, {
  nome: 'Thailandia',
  icona: '🌃'
}];
const livelloInfo = n => LIVELLI[Math.min(n, LIVELLI.length) - 1] || LIVELLI[0];

// Rumore deterministico: lo sfondo è sempre lo stesso ad ogni partita.
const seeded = n => {
  let s = n * 9301 + 49297;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
};

// Grana del disegno: quanto è grande un "pixel" dell'arte rispetto a una
// casella. Stava a cell/5 e con la tela a 360 px veniva una scacchiera da 72
// quadretti in larghezza: troppo grossa per far leggere un bosco. Ora la tela
// è a 720 (stesso rapporto, il doppio dei pixel veri, quindi nitida sui
// telefoni che hanno lo schermo denso) e la grana è più fine: 120 quadretti in
// larghezza, che è ancora pixel art ma ha lo spazio per l'ombra di un albero.
const GRANA = 8;
const pxArte = cell => Math.max(2, Math.round(cell / GRANA));
function drawForest(ctx, w, h, cell) {
  const rnd = seeded(7);
  const px = pxArte(cell);
  const q = v => Math.round(v / px) * px;

  // Disco a blocchi con una funzione di tinta: serve a chiome e cespugli.
  // Prende la distanza dal centro (0 al centro, 1 al bordo) e la direzione
  // della luce, così la chioma ha un volume invece di essere un disco piatto.
  const disco = (cx, cy, r, tinta) => {
    for (let y = cy - r; y <= cy + r; y += px) {
      for (let x = cx - r; x <= cx + r; x += px) {
        const dx = x + px / 2 - cx,
          dy = y + px / 2 - cy;
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
    const cx = q(rnd() * w),
      cy = q(rnd() * h),
      r = cell * (0.5 + rnd() * 0.9);
    disco(cx, cy, r, d => {
      if (d > 0.75 && rnd() > 0.45) return null; // bordo sfrangiato
      return d > 0.5 ? '#26301C' : '#2D3720';
    });
  }

  // --- 2) Ciuffi d'erba e felci: tratti corti e chiari sparsi ---
  for (let i = 0; i < 260; i++) {
    const x = q(rnd() * w),
      y = q(rnd() * h);
    const alto = rnd() > 0.6;
    ctx.fillStyle = rnd() > 0.5 ? '#3E6B33' : '#356029';
    ctx.fillRect(x, y, px, alto ? px * 3 : px * 2);
    if (rnd() > 0.7) ctx.fillRect(x + px, y + px, px, px * 2);
  }

  // --- 3) Sassi: piccoli gruppi grigio-verdi, con la loro ombra ---
  for (let i = 0; i < 8; i++) {
    const cx = q(rnd() * w),
      cy = q(rnd() * h),
      r = px * (1.2 + rnd() * 1.4);
    disco(cx + px, cy + px, r, () => 'rgba(10,18,10,0.45)');
    disco(cx, cy, r, (d, ux, uy) => ux + uy < -0.3 ? '#5E6356' : d > 0.7 ? '#3C4137' : '#4B5045');
  }

  // --- 4) Tronchi caduti: danno scala e dicono "bosco" più di mille foglie ---
  for (let i = 0; i < 3; i++) {
    const x = q(rnd() * (w - cell * 4)),
      y = q(cell + rnd() * (h - cell * 3));
    const lung = q(cell * (2.2 + rnd() * 1.8)),
      spess = q(px * 3);
    ctx.fillStyle = 'rgba(10,18,10,0.4)';
    ctx.fillRect(x + px, y + px * 2, lung, spess);
    ctx.fillStyle = '#4A3526';
    ctx.fillRect(x, y, lung, spess);
    ctx.fillStyle = '#5C4433'; // lato illuminato
    ctx.fillRect(x, y, lung, px);
    ctx.fillStyle = '#33241A'; // nodi e crepe, irregolari
    for (let k = x + px; k < x + lung - px; k += px) {
      if (rnd() > 0.72) ctx.fillRect(k, y + px * (1 + Math.floor(rnd() * 2)), px, px);
    }
  }

  // --- 5) Gli alberi ---
  // Tre misure, chiome con volume (bordo scuro, cuore chiaro, luce in alto a
  // sinistra), ombra portata in basso a destra e qualche ciuffo più scuro
  // dentro. Prima erano dischi piatti a scacchi: da lì l'aria da moquette.
  const specie = [{
    bordo: '#16280F',
    scuro: '#1F3A18',
    medio: '#2C5122',
    chiaro: '#3B6B2E',
    luce: '#4F8A3C'
  }, {
    bordo: '#152412',
    scuro: '#1D3520',
    medio: '#28492B',
    chiaro: '#356139',
    luce: '#457A49'
  }, {
    bordo: '#1B2A0E',
    scuro: '#264014',
    medio: '#365A1D',
    chiaro: '#487628',
    luce: '#5E9636'
  }];
  const alberi = [];
  const mettiAlbero = (cx, cy, r) => {
    const sp = specie[Math.floor(rnd() * specie.length)];
    // ombra portata: è quello che stacca la chioma dal terreno
    disco(cx + r * 0.16, cy + r * 0.2, r * 0.98, d => d > 0.9 ? null : 'rgba(8,16,8,0.42)');
    // chioma
    disco(cx, cy, r, (d, ux, uy) => {
      if (d > 0.94 && rnd() > 0.5) return null; // bordo frastagliato
      const luceQui = (-ux - uy) * 0.5; // luce da in alto a sinistra
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
      const a = rnd() * Math.PI * 2,
        dist = r * (0.25 + rnd() * 0.5);
      disco(q(cx + Math.cos(a) * dist), q(cy + Math.sin(a) * dist), r * (0.16 + rnd() * 0.13), d => d > 0.8 ? null : d > 0.45 ? sp.medio : sp.chiaro);
    }
    alberi.push({
      cx,
      cy,
      r
    });
  };

  // Prima i grandi, poi i medi, poi i cespugli: si sovrappongono e il bosco
  // sembra fitto invece che a pois.
  for (let i = 0; i < 9; i++) mettiAlbero(q(rnd() * w), q(rnd() * h), cell * (1.15 + rnd() * 0.55));
  for (let i = 0; i < 14; i++) mettiAlbero(q(rnd() * w), q(rnd() * h), cell * (0.7 + rnd() * 0.35));
  for (let i = 0; i < 14; i++) {
    const cx = q(rnd() * w),
      cy = q(rnd() * h),
      r = cell * (0.3 + rnd() * 0.22);
    disco(cx + r * 0.2, cy + r * 0.25, r, d => d > 0.9 ? null : 'rgba(8,16,8,0.35)');
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
  const edge = cell * 1.1; // fascia dei palazzi a destra e sinistra

  // asfalto
  ctx.fillStyle = '#3A3A3E';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += px) {
    for (let x = edge; x < w - edge; x += px) {
      const r = rnd();
      if (r > 0.9) {
        ctx.fillStyle = '#43434A';
        ctx.fillRect(x, y, px, px);
      } else if (r > 0.82) {
        ctx.fillStyle = '#333338';
        ctx.fillRect(x, y, px, px);
      }
    }
  }

  // marciapiedi + palazzi ai due bordi, con portoni appena visibili
  [0, w - edge].forEach((bx, side) => {
    ctx.fillStyle = '#6E6A63';
    ctx.fillRect(bx, 0, edge, h);
    ctx.fillStyle = '#5C5851';
    for (let y = 0; y < h; y += px * 3) ctx.fillRect(bx, y, edge, px); // lastre
    // portoni: rettangoli scuri con architrave chiara
    for (let y = cell * 1.2; y < h - cell; y += cell * 3.4) {
      const dw = edge * 0.62,
        dh = cell * 1.5;
      const dx = side === 0 ? bx + edge - dw : bx;
      ctx.fillStyle = '#4A3526';
      ctx.fillRect(dx, y, dw, dh);
      ctx.fillStyle = '#2E2119';
      ctx.fillRect(dx + px, y + px, dw - px * 2, dh - px * 2);
      ctx.fillStyle = '#8A8078';
      ctx.fillRect(dx, y - px, dw, px);
      ctx.fillStyle = '#C9A227'; // maniglia
      ctx.fillRect(side === 0 ? dx + px : dx + dw - px * 2, y + dh / 2, px, px);
    }
  });

  // strisce di mezzeria tratteggiate delle due corsie
  ctx.fillStyle = '#D8D3C4';
  [w * 0.3, w * 0.7].forEach(lx => {
    for (let y = 0; y < h; y += cell * 1.6) ctx.fillRect(lx - px / 2, y, px, cell * 0.8);
  });

  // rotaie del tram al centro
  const cx = w / 2,
    gauge = cell * 0.9;
  ctx.fillStyle = '#4E4A46';
  ctx.fillRect(cx - gauge / 2 - px, 0, gauge + px * 2, h); // massicciata
  ctx.fillStyle = '#6B4A32';
  for (let y = 0; y < h; y += cell * 0.9) ctx.fillRect(cx - gauge / 2 - px, y, gauge + px * 2, px); // traversine
  [cx - gauge / 2, cx + gauge / 2].forEach(rx => {
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
const BR = {
  verde: '#1E9C4A',
  giallo: '#F5D311',
  blu: '#17297A',
  bianco: '#F4F2EA'
};

// Bandiera brasiliana in miniatura, a blocchi: campo verde, rombo giallo,
// cerchio blu. Serve a dire "Rio" senza scriverlo.
function drawFlag(ctx, x, y, w, h, px) {
  const q = v => Math.round(v / px) * px;
  const X = q(x),
    Y = q(y),
    W = q(w),
    H = q(h);
  // asta
  ctx.fillStyle = '#6B5636';
  ctx.fillRect(X - px, Y, px, H + px * 3);
  ctx.fillStyle = BR.verde;
  ctx.fillRect(X, Y, W, H);
  // rombo giallo
  const cx = X + W / 2,
    cy = Y + H / 2,
    rw = W * 0.38,
    rh = H * 0.38;
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
      const dx = pxx + px / 2 - cx,
        dy = py + px / 2 - cy;
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
  const q = v => Math.round(v / px) * px;

  // Le fasce sono strette ai bordi e larghe al centro: la sabbia asciutta è il
  // campo da gioco vero, e deve tenersi la parte grossa. Mare e lungomare
  // servono a dire dove siamo, non a rubare spazio.
  const mare = q(w * 0.17); // acqua
  const risacca = q(w * 0.21); // schiuma
  const bagnata = q(w * 0.27); // sabbia bagnata
  const lungomare = q(w * 0.88); // inizio del calçadão

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
  ctx.fillStyle = '#9A8A6E'; // cordolo
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
        const dx = x - cx,
          dy = y - cy;
        if (dx * dx + dy * dy <= r * r) ctx.fillRect(q(x) + px * 1.5, q(y) + px * 1.5, px, px);
      }
    }
    // sei spicchi: a questa dimensione si leggono come un ombrellone
    for (let y = cy - r; y < cy + r; y += px) {
      for (let x = cx - r; x < cx + r; x += px) {
        const dx = x - cx,
          dy = y - cy;
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
  [[0.14, 0.20, '#E23B2E'], [0.56, 0.58, '#1B7FC4'], [0.84, 0.90, '#F5D311']].forEach(t => {
    const x = q(bagnata + (lungomare - bagnata) * t[0]);
    const y = q(h * t[1]);
    const tw = q(cell * 1.5),
      th = q(cell * 1.0);
    ctx.fillStyle = 'rgba(150,120,80,0.25)';
    ctx.fillRect(x + px, y + px, tw, th);
    ctx.fillStyle = t[2];
    ctx.fillRect(x, y, tw, th);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; // righe del telo
    for (let k = y + px; k < y + th; k += px * 3) ctx.fillRect(x, k, tw, px);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; // frangia ai due lati corti
    ctx.fillRect(x, y, tw, px);
    ctx.fillRect(x, y + th - px, tw, px);
  });

  // --- Bandiere: due piantate nella sabbia, una sul lungomare ---
  const fw = cell * 2.1,
    fh = cell * 1.4;
  drawFlag(ctx, bagnata + cell * 0.5, cell * 0.5, fw, fh, px);
  drawFlag(ctx, bagnata + (lungomare - bagnata) * 0.62, h * 0.42, fw, fh, px);
  drawFlag(ctx, bagnata + cell * 0.5, h - cell * 3.1, fw, fh, px);
  drawFlag(ctx, lungomare + larg * 0.1, h * 0.06, fw * 0.62, fh * 0.62, px);
}

// Livello 4: la strada dei night club in Thailandia, di notte. Stessa
// impaginazione a fasce verticali degli altri livelli — locali ai due lati,
// asfalto in mezzo — ma al buio: l'asfalto è scuro, i locali sono insegne al
// neon e la luce si riflette sulla strada bagnata.
const TH = {
  rosso: '#D82B3C',
  blu: '#1B2C6B',
  bianco: '#F2F0EA'
};
// Insegne: gli stessi cinque colori di prima, ma tirati giù di saturazione e
// di luce. Il neon acceso al massimo su asfalto quasi nero è il contrasto
// cromatico più aggressivo che ci sia, e dopo dieci minuti di partita gli
// occhi se ne accorgono. Le tinte restano riconoscibili — rosa, ciano, ambra,
// verde, viola — ma nessun canale passa i 200 invece di sfiorare 255.
const NEON = ['#C9628E', '#5BAEB8', '#C9A85C', '#6FB98C', '#9A72C4'];

// Bandiera thailandese: cinque bande orizzontali rosso-bianco-blu-bianco-rosso,
// con quella blu doppia. È l'unica cosa che dice "Thailandia" a colpo d'occhio.
function drawThaiFlag(ctx, x, y, w, h, px) {
  const q = v => Math.round(v / px) * px;
  const X = q(x),
    Y = q(y),
    W = q(w);
  const u = Math.max(px, q(h / 6)); // banda unitaria: 1-1-2-1-1
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
  const q = v => Math.round(v / px) * px;
  const bordo = q(cell * 1.9); // fascia dei locali, per lato

  // --- Asfalto notturno: scuro ma non nero, altrimenti il corpo ci sparisce ---
  for (let x = 0; x < w; x += px) {
    for (let y = 0; y < h; y += px) {
      const r = rnd();
      ctx.fillStyle = r > 0.93 ? '#332C3F' : r > 0.85 ? '#221E2A' : '#2A2532';
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
    for (let y = 0; y < h; y += px * 4) ctx.fillRect(bx, y, bordo, px); // lastre
    // cordolo verso la strada: separa il marciapiede dall'asfalto
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
      ctx.fillStyle = '#3B3349'; // divisorio fra locali
      ctx.fillRect(bx, y, bordo, px);
      // ingresso: rettangolo nero con lo stipite acceso al neon
      const pw = q(bordo * 0.66),
        ph = q(alt * 0.5);
      const pxx = lato === 0 ? bx + bordo - pw - px : bx + px;
      const py0 = q(y + alt * 0.25);
      ctx.fillStyle = col;
      ctx.fillRect(pxx - px, py0 - px, pw + px * 2, ph + px * 2);
      ctx.fillStyle = '#0E0A14';
      ctx.fillRect(pxx, py0, pw, ph);
      // insegna che sporge sulla strada
      const sw = q(cell * 1.15),
        sh = q(cell * 0.62);
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
          if (riga === 1 && rnd() > 0.75) continue; // seconda riga più corta
          ctx.fillRect(k, ry, px * 2, px);
        }
      });
      locali.push({
        x: sx + sw / 2,
        y: sy + sh / 2,
        col,
        lato
      });
      y += alt + q(cell * 0.35);
      i++;
    }
  });

  // --- Aloni e riflessi sull'asfalto bagnato ---
  // Prima gli aloni attorno alle insegne, poi le colate verticali di luce
  // verso il centro strada: è quello che dà la notte piovosa.
  locali.forEach(l => {
    const r = cell * 2.2;
    for (let y = l.y - r; y < l.y + r; y += px) {
      for (let x = l.x - r; x < l.x + r; x += px) {
        const dx = x - l.x,
          dy = y - l.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        const a = (1 - d / r) * 0.07;
        ctx.fillStyle = l.col;
        ctx.globalAlpha = a;
        ctx.fillRect(q(x), q(y), px, px);
      }
    }
    ctx.globalAlpha = 1;
    // colata sull'asfalto verso il centro
    const verso = l.lato === 0 ? 1 : -1;
    for (let k = 0; k < cell * 3.2; k += px) {
      ctx.globalAlpha = 0.06 * (1 - k / (cell * 3.2));
      ctx.fillStyle = l.col;
      const larg = q(cell * 0.5 + k * 0.25);
      ctx.fillRect(q(l.x + verso * k), q(l.y - larg / 2), px, larg);
    }
    ctx.globalAlpha = 1;
  });

  // --- Pozzanghere: asfalto bagnato che rimanda il neon ---
  // Restano scure e poco contrastate: sono atmosfera, non devono disturbare
  // la lettura del corpo che ci passa sopra.
  [[0.30, 0.42, NEON[0]], [0.70, 0.18, NEON[1]], [0.58, 0.86, NEON[3]]].forEach(pz => {
    const cx = q(w * pz[0]),
      cy = q(h * pz[1]);
    const rx = cell * 1.5,
      ry = cell * 0.75;
    for (let y = cy - ry; y < cy + ry; y += px) {
      for (let x = cx - rx; x < cx + rx; x += px) {
        const dx = (x - cx) / rx,
          dy = (y - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        ctx.fillStyle = '#1A1622';
        ctx.fillRect(q(x), q(y), px, px);
      }
    }
    ctx.globalAlpha = 0.20;
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
      const a = k / 9 * Math.PI * 2 + 0.3;
      for (let t = px; t < cell * 1.25; t += px) {
        ctx.fillRect(q(cx + Math.cos(a) * t + px), q(cy + Math.sin(a) * t + px), px, px);
      }
    }
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2 + 0.3;
      const lung = cell * (0.95 + k % 3 * 0.18);
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
  [[0.30, 0, '#A8443F'], [0.66, 0, '#3E6FA8'], [0.44, 1, '#AE9440'], [0.80, 1, '#7A55A0']].forEach(mt => {
    const lato = mt[1];
    const cx = q(lato === 0 ? bordo + cell * 0.42 : w - bordo - cell * 0.42);
    const cy = q(h * mt[0]);
    const lu = q(cell * 0.95),
      la = q(cell * 0.42);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - la / 2 + px, cy - lu / 2 + px, la, lu);
    ctx.fillStyle = mt[2];
    ctx.fillRect(cx - la / 2, cy - lu / 2, la, lu);
    ctx.fillStyle = '#141019'; // sella
    ctx.fillRect(cx - la / 2, q(cy - lu * 0.05), la, q(lu * 0.3));
    ctx.fillStyle = '#D9D4C6'; // specchietti
    ctx.fillRect(cx - la / 2 - px, cy - lu / 2, px, px);
    ctx.fillRect(cx + la / 2, cy - lu / 2, px, px);
  });

  // --- Due tuk-tuk fermi in mezzo alla strada, visti dall'alto ---
  // I tettucci pescano dalla tavolozza invece di avere i colori scritti a
  // mano: erano rimasti indietro con i vecchi neon accesi al massimo, ed
  // essendo in mezzo alla carreggiata erano la cosa che stancava di più.
  [[0.38, 0.28, NEON[2]], [0.62, 0.68, NEON[3]]].forEach(t => {
    const cx = q(w * t[0]),
      cy = q(h * t[1]);
    const tw = q(cell * 1.05),
      th = q(cell * 1.7);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; // ombra
    ctx.fillRect(cx - tw / 2 + px * 2, cy - th / 2 + px * 2, tw, th);
    ctx.fillStyle = '#2A2536'; // ruote ai lati
    [cy - th * 0.28, cy + th * 0.3].forEach(wy => {
      ctx.fillRect(cx - tw / 2 - px, q(wy), px, q(cell * 0.3));
      ctx.fillRect(cx + tw / 2, q(wy), px, q(cell * 0.3));
    });
    ctx.fillStyle = t[2]; // tettuccio
    ctx.fillRect(cx - tw / 2, cy - th / 2, tw, th);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; // centine del telo
    for (let k = cy - th / 2 + px * 2; k < cy + th / 2; k += px * 4) ctx.fillRect(cx - tw / 2, q(k), tw, px);
    ctx.fillStyle = '#1B1724'; // vano passeggeri
    ctx.fillRect(cx - tw / 2 + px, q(cy + th * 0.12), tw - px * 2, q(th * 0.32));
    ctx.fillStyle = '#FFF3C4'; // fari
    ctx.fillRect(cx - px * 2, cy - th / 2 - px, px * 2, px);
    ctx.fillRect(cx + px, cy - th / 2 - px, px * 2, px);
  });

  // --- Bandiere thailandesi appese alle facciate ---
  // Vanno per ultime e con un fondo scuro dietro: sopra un muro di insegne al
  // neon, senza stacco, si perderebbero fra le altre strisce colorate — e sono
  // l'unica cosa che dice "Thailandia" invece di "strada di locali".
  const fw = q(bordo * 0.78),
    fh = q(cell * 1.15);
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
const SK = {
  skin: '#E4A882',
  shade: '#C98D68',
  light: '#F4CFAF',
  tip: '#E8A090',
  crease: '#A9714F'
};
// Livello 3: stessa forma, carnagione scura. Sulla sabbia chiara si stacca
// meglio del livello 2, che sull'asfalto grigio funzionava al contrario.
const SK3 = {
  skin: '#8D5A3B',
  shade: '#6B4229',
  light: '#B37B50',
  tip: '#96543C',
  crease: '#472A18'
};
// Livello 4: strada al buio. Serve una carnagione chiara con un filo di neon
// addosso, altrimenti sull'asfalto notturno il corpo sparisce.
const SK4 = {
  skin: '#D9A279',
  shade: '#9E6E4C',
  light: '#EDA6C4',
  tip: '#E9A9A0',
  crease: '#6B4530'
};
// Livello 1: la canna come cilindro continuo, con brace tonda e sfumata
// e filtro in fondo (prima era una catena di quadretti staccati).
const JO = {
  paper: '#F6EFDF',
  paper2: '#E9DFC7',
  seam: '#DCCFB2',
  filter: '#B98F5E',
  filter2: '#9C7345'
};
function drawJoint(ctx, snake, i, cell, offX, offY, dir) {
  const seg = snake[i];
  const x = offX + seg.x * cell,
    y = offY + seg.y * cell;
  const u = cell / 10;
  const T = cell - u * 3.6; // spessore della cartina
  const cx = x + cell / 2,
    cy = y + cell / 2;
  const total = snake.length;
  const bandTo = nb => {
    if (!nb) return;
    const dx = nb.x - seg.x,
      dy = nb.y - seg.y;
    if (dx > 0) ctx.fillRect(cx, cy - T / 2, cell / 2 + 1, T);else if (dx < 0) ctx.fillRect(x - 1, cy - T / 2, cell / 2 + 1, T);else if (dy > 0) ctx.fillRect(cx - T / 2, cy, T, cell / 2 + 1);else if (dy < 0) ctx.fillRect(cx - T / 2, y - 1, T, cell / 2 + 1);
  };
  if (i === 0) {
    const d = dir && (dir.x || dir.y) ? dir : {
      x: 0,
      y: -1
    };
    // cartina fino alla punta
    ctx.fillStyle = JO.paper;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[1]);
    // brace: cerchio con sfumatura + alone morbido
    const ex = cx + d.x * u * 1.2,
      ey = cy + d.y * u * 1.2;
    const r = T * 0.5;
    const glow = ctx.createRadialGradient(ex, ey, r * 0.3, ex, ey, r * 2.1);
    glow.addColorStop(0, 'rgba(255,150,40,0.45)');
    glow.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ex, ey, r * 2.1, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(ex - r * 0.25, ey - r * 0.25, r * 0.1, ex, ey, r);
    g.addColorStop(0, '#FFF3C4');
    g.addColorStop(0.4, '#FFB13B');
    g.addColorStop(0.8, '#E06A0C');
    g.addColorStop(1, '#8E3406');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (i === total - 1 && total > 2) {
    // filtro di cartoncino
    ctx.fillStyle = JO.filter;
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    bandTo(snake[i - 1]);
    ctx.fillStyle = JO.filter2;
    const horizT = snake[i - 1].y === seg.y;
    if (horizT) ctx.fillRect(cx - T / 2, cy - T / 2, u * 1.2, T);else ctx.fillRect(cx - T / 2, cy - T / 2, T, u * 1.2);
    return;
  }

  // corpo: cartina con una leggera ombra lungo l'asse
  ctx.fillStyle = JO.paper;
  ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
  bandTo(snake[i - 1]);
  bandTo(snake[i + 1]);
  const horiz = snake[i - 1] && snake[i - 1].y === seg.y || snake[i + 1] && snake[i + 1].y === seg.y;
  ctx.fillStyle = JO.paper2;
  if (horiz) ctx.fillRect(x, cy + T * 0.18, cell, u * 1.1);else ctx.fillRect(cx + T * 0.18, y, u * 1.1, cell);
  ctx.fillStyle = JO.seam; // cucitura della cartina
  if (i % 3 === 0) {
    if (horiz) ctx.fillRect(cx - u * 0.4, cy - T / 2, u * 0.8, T);else ctx.fillRect(cx - T / 2, cy - u * 0.4, T, u * 0.8);
  }
}
function drawBody(ctx, snake, i, cell, offX, offY, dir, pal) {
  const SKIN = pal || SK;
  const seg = snake[i];
  const x = offX + seg.x * cell,
    y = offY + seg.y * cell;
  const u = cell / 10;
  const T = cell - u * 2.6; // spessore unico per tutto il fusto
  const cx = x + cell / 2,
    cy = y + cell / 2;
  const total = snake.length;

  // banda dal centro della cella verso un segmento vicino: garantisce
  // spessore uniforme anche nelle curve (niente gradini)
  const bandTo = n => {
    if (!n) return;
    const dx = n.x - seg.x,
      dy = n.y - seg.y;
    if (dx > 0) ctx.fillRect(cx, cy - T / 2, cell / 2 + 1, T);else if (dx < 0) ctx.fillRect(x - 1, cy - T / 2, cell / 2 + 1, T);else if (dy > 0) ctx.fillRect(cx - T / 2, cy, T, cell / 2 + 1);else if (dy < 0) ctx.fillRect(cx - T / 2, y - 1, T, cell / 2 + 1);
  };
  if (i === 0) {
    // Punta a mezza sfera orientata nel senso di marcia
    const d = dir && (dir.x || dir.y) ? dir : {
      x: 0,
      y: -1
    };
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
    const vertical = prev.x === seg.x; // lobi affiancati rispetto all'asse
    const r = cell * 0.34,
      off = cell * 0.33;
    const lobe = (a, b) => {
      ctx.beginPath();
      ctx.arc(a, b, r, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.fillStyle = SKIN.shade;
    if (vertical) {
      lobe(cx - off, cy + u * 0.8);
      lobe(cx + off, cy + u * 0.8);
    } else {
      lobe(cx + u * 0.8, cy - off);
      lobe(cx + u * 0.8, cy + off);
    }
    // piega centrale: fa leggere due lobi distinti invece di un ovale unico
    ctx.fillStyle = SKIN.crease;
    if (vertical) ctx.fillRect(cx - u * 0.25, cy - u * 0.6, u * 0.5, r * 1.5);else ctx.fillRect(cx - u * 0.6, cy - u * 0.25, r * 1.5, u * 0.5);
    ctx.fillStyle = SKIN.skin; // raccordo sopra i lobi
    ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
    return;
  }

  // Fusto: spessore identico per ogni segmento
  ctx.fillStyle = SKIN.skin;
  ctx.fillRect(cx - T / 2, cy - T / 2, T, T);
  bandTo(snake[i - 1]);
  bandTo(snake[i + 1]);
  // luce lungo l'asse del tubo
  const horiz = snake[i - 1] && snake[i - 1].y === seg.y || snake[i + 1] && snake[i + 1].y === seg.y;
  ctx.fillStyle = SKIN.light;
  if (horiz) ctx.fillRect(x, cy - T * 0.34, cell, u * 1.2);else ctx.fillRect(cx - T * 0.34, y, u * 1.2, cell);
}
function BandyGame({
  playerName,
  onExit,
  onGameOver,
  bestLocal
}) {
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
    const mkBg = fn => {
      const c = document.createElement('canvas');
      c.width = canvas.width;
      c.height = canvas.height;
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
      snake: [{
        x: 7,
        y: 12
      }, {
        x: 7,
        y: 13
      }, {
        x: 7,
        y: 14
      }],
      dir: {
        x: 0,
        y: -1
      },
      queue: [],
      food: {
        x: 7,
        y: 5
      },
      score: 0,
      alive: true,
      acc: 0,
      last: 0,
      step: BASE_STEP,
      level: 1
    };
    stateRef.current = st;
    canvas.__game = st; // aggancio per i test automatici (non usato dall'app)

    const placeFood = () => {
      let p,
        tries = 0;
      do {
        p = {
          x: Math.floor(Math.random() * GAME_COLS),
          y: Math.floor(Math.random() * GAME_ROWS)
        };
        tries++;
      } while (tries < 200 && st.snake.some(s => s.x === p.x && s.y === p.y));
      st.food = p;
    };
    const offX = Math.floor((canvas.width - cell * GAME_COLS) / 2);
    const offY = Math.floor((canvas.height - cell * GAME_ROWS) / 2);
    const draw = () => {
      ctx.drawImage(bgRef.current, 0, 0);
      // Bandy da raccogliere
      const f = st.food;
      const fcx = offX + f.x * cell + cell / 2,
        fcy = offY + f.y * cell + cell / 2;
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
    const tick = ts => {
      if (!stateRef.current) return;
      if (!st.last) st.last = ts;
      const dt = ts - st.last;
      st.last = ts;
      if (st.alive && !st.pause) {
        st.acc += dt;
        if (st.acc >= st.step) {
          st.acc = 0;
          if (st.queue.length) st.dir = st.queue.shift();
          const head = {
            x: st.snake[0].x + st.dir.x,
            y: st.snake[0].y + st.dir.y
          };
          const hitWall = head.x < 0 || head.y < 0 || head.x >= GAME_COLS || head.y >= GAME_ROWS;
          const hitSelf = st.snake.some(s => s.x === head.x && s.y === head.y);
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
      if (last.x === -x && last.y === -y) return; // niente inversione a U
      if (last.x === x && last.y === y) return; // già in questa direzione
      if (st.queue.length < 2) st.queue.push({
        x,
        y
      });
      // Se il passo è già a metà, lo anticipo: la svolta si vede subito
      // invece di aspettare fino a un tick intero.
      if (st.acc >= st.step * 0.45) st.acc = st.step;
    };
    const onKey = e => {
      const k = e.key;
      if (['ArrowUp', 'w', 'W'].includes(k)) {
        turn(0, -1);
        e.preventDefault();
      } else if (['ArrowDown', 's', 'S'].includes(k)) {
        turn(0, 1);
        e.preventDefault();
      } else if (['ArrowLeft', 'a', 'A'].includes(k)) {
        turn(-1, 0);
        e.preventDefault();
      } else if (['ArrowRight', 'd', 'D'].includes(k)) {
        turn(1, 0);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);

    // Il dito deve poter fare due svolte di fila come la tastiera. Prima una
    // strisciata valeva una svolta sola: per girare di nuovo bisognava alzare
    // il dito e riappoggiarlo, e dal livello 3 in poi quel tempo morto vale
    // due o tre caselle. Ora dopo ogni svolta il punto di partenza si sposta
    // dov'è il dito adesso, così la seconda gamba di una L conta come una
    // strisciata nuova senza staccare.
    // Il prezzo di questa libertà è il trascinamento in diagonale, che
    // altrimenti farebbe zigzagare Bandy da solo: dalla seconda svolta in poi
    // serve un gesto più lungo e con una direzione chiaramente prevalente.
    const SOGLIA_1 = 16; // px per la prima svolta: deve rispondere subito
    const SOGLIA_N = 26; // px per quelle successive, dito ancora giù
    const NETTEZZA = 1.6; // quanto la direzione deve battere l'altra
    let sx = 0,
      sy = 0,
      girato = false;
    const onStart = e => {
      const t = e.touches[0];
      sx = t.clientX;
      sy = t.clientY;
      girato = false;
    };
    const onMove = e => {
      const t = e.touches[0];
      const dx = t.clientX - sx,
        dy = t.clientY - sy;
      const ax = Math.abs(dx),
        ay = Math.abs(dy);
      if (ax < (girato ? SOGLIA_N : SOGLIA_1) && ay < (girato ? SOGLIA_N : SOGLIA_1)) return;
      if (girato && Math.max(ax, ay) < Math.min(ax, ay) * NETTEZZA) return;
      // Svolta appena il dito ha percorso abbastanza: non aspetta il rilascio.
      if (ax > ay) turn(dx > 0 ? 1 : -1, 0);else turn(0, dy > 0 ? 1 : -1);
      sx = t.clientX;
      sy = t.clientY;
      girato = true;
    };
    canvas.addEventListener('touchstart', onStart, {
      passive: true
    });
    canvas.addEventListener('touchmove', onMove, {
      passive: true
    });
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
    if (req) {
      try {
        req.call(el);
      } catch (e) {/* niente fullscreen: resta l'overlay */}
    }
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
        try {
          exit.call(document);
        } catch (e) {/* ignora */}
      }
    };
  }, []);
  const nudge = (x, y) => {
    const st = stateRef.current;
    if (st && st.turn) st.turn(x, y);
  };
  const togglePause = () => {
    const st = stateRef.current;
    if (!st || !st.alive) return;
    st.pause = !st.pause;
    setPaused(st.pause);
  };
  return /*#__PURE__*/React.createElement("div", {
    ref: wrapRef,
    className: "fixed inset-0 z-50 bg-[#1F271E] flex flex-col gap-2 p-2",
    style: {
      paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
      paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2 bg-white/95 px-3 py-2 rounded-lg shrink-0"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo uppercase font-bold text-gray-500 truncate max-w-[24%]"
  }, playerName), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic text-grande text-[#2D392C] shrink-0"
  }, score, " \uD83C\uDF3F"), /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo text-gray-400 min-w-0 truncate text-right"
  }, livelloInfo(level).icona, " ", livelloInfo(level).nome, " \xB7 -", Math.max(0, level * 15 - score), " \xB7 rec ", bestLocal)), /*#__PURE__*/React.createElement("div", {
    className: "relative flex-1 min-h-0 flex items-center justify-center"
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef,
    width: 720,
    height: 912,
    className: "rounded-lg border-2 border-[#2D392C]/40 touch-none max-h-full max-w-full",
    style: {
      imageRendering: 'pixelated',
      height: '100%',
      width: 'auto',
      aspectRatio: '720 / 912'
    }
  }), levelUp && !over && /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 flex items-center justify-center pointer-events-none"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-black/70 px-5 py-3 rounded-lg text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-piccolo uppercase tracking-widest text-[#8F9E8B]"
  }, L.t('gioco.livello', level)), /*#__PURE__*/React.createElement("div", {
    className: "font-rustic text-titolo text-[#D97706] leading-tight"
  }, livelloInfo(level).icona, " ", livelloInfo(level).nome), level > LIVELLI.length && /*#__PURE__*/React.createElement("div", {
    className: "text-piccolo uppercase tracking-widest text-[#F0F4F1]"
  }, L.t('gioco.ancoraPiuVeloce')))), (over || paused) && /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 bg-black/70 rounded-lg flex flex-col items-center justify-center text-center p-4"
  }, over ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "font-rustic text-titolo text-[#F0F4F1]"
  }, L.t('gioco.scappato')), /*#__PURE__*/React.createElement("div", {
    className: "text-[#D97706] font-rustic text-titolo my-2"
  }, score), /*#__PURE__*/React.createElement("div", {
    className: "text-piccolo text-gray-300 mb-4"
  }, score > bestLocal ? L.t('gioco.nuovoRecord') : L.t('gioco.recordResta', bestLocal)), /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    className: "px-6 py-2.5 bg-[#2D392C] text-white rounded font-bold uppercase text-piccolo"
  }, L.t('archivio.chiudi'))) : /*#__PURE__*/React.createElement("div", {
    className: "font-rustic text-titolo text-[#F0F4F1]"
  }, L.t('gioco.inPausa')))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2 max-w-[240px] w-full mx-auto shrink-0"
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      nudge(0, -1);
    },
    "aria-label": L.t('gioco.su'),
    className: "py-3 bg-[#2D392C] text-white rounded font-bold"
  }, "\u25B2"), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      nudge(-1, 0);
    },
    "aria-label": L.t('gioco.sinistra'),
    className: "py-3 bg-[#2D392C] text-white rounded font-bold"
  }, "\u25C0"), /*#__PURE__*/React.createElement("button", {
    onClick: togglePause,
    "aria-label": L.t('gioco.pausa'),
    className: "py-3 bg-[#5C4A3C] text-white rounded font-bold text-piccolo"
  }, paused ? '▶' : '❚❚'), /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      nudge(1, 0);
    },
    "aria-label": L.t('gioco.destra'),
    className: "py-3 bg-[#2D392C] text-white rounded font-bold"
  }, "\u25B6"), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      nudge(0, 1);
    },
    "aria-label": L.t('gioco.giu'),
    className: "py-3 bg-[#2D392C] text-white rounded font-bold"
  }, "\u25BC"), /*#__PURE__*/React.createElement("span", null)), /*#__PURE__*/React.createElement("button", {
    onClick: onExit,
    className: "w-full py-1.5 text-piccolo uppercase font-bold text-[#8F9E8B] hover:text-white shrink-0"
  }, L.t('gioco.esci')));
}

// ============================================================================
//  SCHERMATA DI BLOCCO
// ============================================================================
function LockScreen({
  onUnlock,
  reason
}) {
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
    if (!pwd) {
      setError(L.t('blocco.scrivi'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const digest = await derivePassword(pwd);
      if (digest === null) {
        setError(L.t('blocco.senzaHttps'));
        return;
      }
      if (digest === LOCK.hash) {
        sessionPassword = pwd; // solo in memoria, per l'accesso al database
        rememberUnlock();
        setPwd('');
        onUnlock();
        return;
      }
      const fails = Number(localStorage.getItem(FAIL_KEY) || 0) + 1;
      scriviLocale(FAIL_KEY, String(fails));
      if (fails >= 5) {
        const secs = Math.min(600, 30 * Math.pow(2, fails - 5));
        scriviLocale(UNTIL_KEY, String(Date.now() + secs * 1000));
        setError(L.t('blocco.attesa', secs));
      } else {
        setError(L.t('blocco.restano', 5 - fails));
      }
      setPwd('');
    } catch (e) {
      setError(L.t('blocco.nonRiuscita'));
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-[#2D392C] flex flex-col items-center justify-center text-[#F0F4F1] z-50 px-8"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-28 h-28 mb-5 rounded-full overflow-hidden shadow-2xl border-4 border-[#8F9E8B] bg-[#F0F4F1] shrink-0"
  }, /*#__PURE__*/React.createElement("img", {
    src: "./logo.png",
    alt: L.t('blocco.logo', BRAND.groupName),
    className: "w-full h-full object-cover"
  })), /*#__PURE__*/React.createElement("h1", {
    className: "font-rustic text-titolo tracking-widest text-[#8F9E8B] text-center"
  }, BRAND.splashLine1), /*#__PURE__*/React.createElement("h2", {
    className: "font-rustic text-grande tracking-widest text-[#F0F4F1] text-center mb-6"
  }, BRAND.splashLine2), /*#__PURE__*/React.createElement("div", {
    className: "w-full max-w-xs space-y-3"
  }, reason && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#1F271E] border border-[#8F9E8B]/30 rounded p-3 mb-1"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#F0F4F1] leading-snug"
  }, reason)), /*#__PURE__*/React.createElement("label", {
    className: "block text-piccolo uppercase tracking-widest text-[#8F9E8B] font-bold"
  }, L.t('blocco.password')), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: show ? 'text' : 'password',
    value: pwd,
    autoFocus: true,
    autoComplete: "current-password",
    onChange: e => setPwd(e.target.value),
    onKeyDown: e => e.key === 'Enter' && submit(),
    disabled: waitLeft > 0,
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    className: "flex-grow min-w-0 p-3 rounded bg-[#1F271E] border-2 border-[#8F9E8B]/40 text-[#F0F4F1] placeholder-[#8F9E8B]/50 focus:outline-none focus:border-[#8F9E8B] disabled:opacity-50"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShow(s => !s),
    "aria-label": L.t(show ? 'blocco.nascondi' : 'blocco.mostra'),
    className: "shrink-0 px-3 rounded bg-[#1F271E] border-2 border-[#8F9E8B]/40 text-grande leading-none hover:border-[#8F9E8B]"
  }, show ? '🙈' : '👁️')), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: busy || waitLeft > 0,
    className: "w-full py-3 rounded bg-[#8F9E8B] text-[#1F271E] font-bold uppercase text-normale tracking-widest hover:brightness-110 disabled:opacity-50"
  }, busy ? L.t('blocco.verifica') : waitLeft > 0 ? L.t('blocco.attendi', waitLeft) : L.t('blocco.entra')), error && /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#F0A0A0] leading-snug"
  }, error), /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#8F9E8B]/80 leading-snug"
  }, LOCK && LOCK.hint || L.t('blocco.chiedi'))), /*#__PURE__*/React.createElement("p", {
    className: "absolute bottom-4 left-0 right-0 text-center text-minuto tracking-wide text-[#8F9E8B]/70 px-6"
  }, BRAND.credits));
}

// ---------- "Aiuta Bandy": stato, classifica, inizio e fine partita ----------
//
// Primo pezzo di stato che esce da App() (ROADMAP.md § 14). Si comincia da
// qui perche' il gioco e' l'unica parte dell'app che non tocca i conti: se
// qualcosa va storto si vede subito e non si porta via una presenza.
//
// NON e' un componente React: e' un hook, cioe' una funzione che chiama altri
// hook. La differenza conta — un componente aggiungerebbe un confine di
// riconciliazione e cambierebbe quando le cose si ridisegnano; un hook no,
// l'albero prodotto resta identico. E' la stessa scelta fatta per le schede.
//
// L'ordine delle chiamate a useState non cambia fra un disegno e l'altro:
// e' l'unica regola che React impone, ed e' rispettata perche' l'hook si
// chiama sempre, in un punto fisso di App().
const usaGioco = ({
  activeTab,
  cloudConnesso
}) => {
  const [gamePlayer, setGamePlayer] = useState(() => localStorage.getItem('cambusa_player') || '');
  const [gameRunning, setGameRunning] = useState(false);
  const [gameBest, setGameBest] = useState(() => Number(load('cambusa_best', 0)) || 0);
  const [leaderboard, setLeaderboard] = useState([]);
  const refreshLeaderboard = () => {
    const CS = window.CloudSync;
    if (CS && CS.listScores) CS.listScores().then(setLeaderboard).catch(() => {});
  };

  // Si scarica la classifica solo entrando nella sezione del gioco: all'avvio
  // dell'app non interessa a nessuno, e in montagna ogni lettura si paga.
  useEffect(() => {
    if (activeTab === 'gioco') refreshLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, cloudConnesso]);
  const startGame = () => {
    const n = gamePlayer.trim();
    if (!n) {
      window.alert(L.t('gioco.scriviNome'));
      return;
    }
    scriviLocale('cambusa_player', n);
    setGameRunning(true);
  };
  const endGame = score => {
    if (score > gameBest) {
      setGameBest(score);
      scriviLocale('cambusa_best', JSON.stringify(score));
    }
    const CS = window.CloudSync;
    if (CS && CS.submitScore) {
      CS.submitScore(gamePlayer.trim(), score).then(refreshLeaderboard).catch(() => {});
    }
  };
  return {
    gamePlayer,
    setGamePlayer,
    gameRunning,
    setGameRunning,
    gameBest,
    leaderboard,
    refreshLeaderboard,
    startGame,
    endGame
  };
};
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
const usaGalleria = ({
  activeTab,
  cloudConnesso,
  campData
}) => {
  const [photos, setPhotos] = useState([]); // miniature, dal cloud
  const [photosReady, setPhotosReady] = useState(false);
  const [photoWho, setPhotoWho] = useState(''); // a nome di chi si carica
  const [photoBusy, setPhotoBusy] = useState(''); // messaggio di avanzamento
  const [viewPhoto, setViewPhoto] = useState(null); // { id, by, at, full }
  const [album, setAlbum] = useState(null); // album di un campo chiuso
  const [galleryView, setGalleryView] = useState('album'); // album | griglia
  const [albumPage, setAlbumPage] = useState(0);
  const albumRef = useRef(null);
  const [picking, setPicking] = useState(false); // modalita' "scegli le foto"
  const [picked, setPicked] = useState([]); // id scelti per il ricordo
  const [pdfBusy, setPdfBusy] = useState(''); // avanzamento della stampa
  const [photoCap, setPhotoCap] = useState(() => {
    const v = parseInt(localStorage.getItem(PHOTO_CAP_KEY), 10);
    return Number.isFinite(v) && v > 0 ? v : PHOTO_CAP_DEFAULT;
  });

  // Ci si mette in ascolto delle miniature SOLO mentre la galleria e' aperta:
  // altrimenti ogni avvio dell'app scaricherebbe l'intero album.
  useEffect(() => {
    if (activeTab !== 'galleria') {
      setPhotosReady(false);
      return undefined;
    }
    const CS = window.CloudSync;
    if (!CS || !CS.watchPhotos || !CS.isConnected()) {
      setPhotosReady(false);
      return undefined;
    }
    const stop = CS.watchPhotos(list => {
      setPhotos(list);
      setPhotosReady(true);
    });
    return () => {
      if (typeof stop === 'function') stop();
    };
  }, [activeTab, cloudConnesso]);
  const photosBy = nome => photos.filter(p => p.by === nome).length;
  const addPhotos = async e => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    const chi = photoWho.trim();
    if (!chi) {
      window.alert(L.t('galleria.diChi'));
      return;
    }
    const CS = window.CloudSync;
    if (!CS || !CS.isConnected()) {
      window.alert(L.t('galleria.servelaLinea'));
      return;
    }
    const restanti = photoCap - photosBy(chi);
    if (restanti <= 0) {
      window.alert(L.t('galleria.giaPiene', chi, photoCap));
      return;
    }
    const daCaricare = files.slice(0, restanti);
    if (files.length > restanti) {
      window.alert(L.t('galleria.soloAlcune', chi, restanti, files.length));
    }
    let fatte = 0;
    for (let i = 0; i < daCaricare.length; i++) {
      setPhotoBusy(L.t('galleria.carico', i + 1, daCaricare.length));
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
      } catch (err) {/* foto illeggibile: si prosegue con le altre */}
    }
    setPhotoBusy('');
    const rimaste = daCaricare.length - fatte;
    if (rimaste > 0) {
      window.alert(L.t('galleria.rimasteInCoda', fatte, daCaricare.length, rimaste));
    }
  };
  const openPhoto = async p => {
    setViewPhoto({
      ...p,
      full: null
    });
    const CS = window.CloudSync;
    if (!CS || !CS.getPhotoFull) return;
    const full = await CS.getPhotoFull(p.id);
    // Se nel frattempo l'utente ha chiuso o cambiato foto, non sovrascrivere.
    setViewPhoto(cur => cur && cur.id === p.id ? {
      ...cur,
      full
    } : cur);
  };

  // ---------- Foto ricordo (PDF) ----------
  // La griglia ha solo le miniature: per la stampa servono gli originali, che
  // si scaricano uno a uno. Da qui l'avanzamento — e l'avviso quando sono
  // tante, perche' su una linea di montagna e' l'attesa a pesare, non il PDF.
  const TANTE_FOTO = 20;

  // Sotto una polaroid ci sta il nome, non "Nome Cognome".
  const soloNome = chi => String(chi || '').trim().split(/\s+/)[0] || 'anonimo';

  // Album: quattro foto per pagina, come nel PDF.
  const PER_PAGINA_ALBUM = window.PdfRicordo && window.PdfRicordo.PER_PAGINA || 4;
  const paginaAlbum = elenco => {
    const out = [];
    for (let i = 0; i < elenco.length; i += PER_PAGINA_ALBUM) out.push(elenco.slice(i, i + PER_PAGINA_ALBUM));
    return out;
  };
  const sfoglia = verso => {
    const el = albumRef.current;
    if (!el) return;
    el.scrollBy({
      left: verso * (el.clientWidth + 10),
      behavior: 'smooth'
    });
  };
  const onScrollAlbum = e => {
    const el = e.currentTarget;
    setAlbumPage(Math.round(el.scrollLeft / (el.clientWidth + 10)));
  };
  const togglePicked = id => {
    setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const uscitaScelta = () => {
    setPicking(false);
    setPicked([]);
  };

  // tutte = l'album completo, in ordine di scatto: è il ricordo del campo, e
  // un campo si racconta dal primo giorno all'ultimo. Con la scelta a mano
  // l'ordine è invece quello con cui si tocca, che è una scelta di chi compone.
  const generaRicordo = async (elenco, tutte) => {
    const PDF = window.PdfRicordo;
    if (!PDF) {
      window.alert(L.t('galleria.senzaGeneratore'));
      return;
    }
    const CS = window.CloudSync;
    if (!CS || !CS.isConnected()) {
      window.alert(L.t('galleria.ricordoSenzaLinea'));
      return;
    }
    const scelte = tutte ? [...elenco].sort((a, b) => (a.at || 0) - (b.at || 0)) : elenco.filter(p => picked.includes(p.id));
    if (scelte.length === 0) {
      window.alert(L.t(tutte ? 'galleria.nessunaInGalleria' : 'galleria.almenoUna'));
      return;
    }
    // Le foto si scaricano a piena qualità una a una: con molte foto è una
    // cosa lunga, e su una linea che va e viene va detto prima di partire.
    if (scelte.length >= TANTE_FOTO) {
      const pagine = Math.ceil(scelte.length / PER_PAGINA_ALBUM);
      if (!window.confirm(L.t('galleria.tanteFoto', scelte.length, pagine))) return;
    }
    try {
      const foto = [];
      for (let i = 0; i < scelte.length; i++) {
        setPdfBusy(L.t('galleria.scarico', i + 1, scelte.length));
        const full = await CS.getPhotoFull(scelte[i].id);
        if (!full) continue;
        foto.push({
          dataUrl: full,
          // Solo il nome, come sotto le polaroid dell'album.
          didascalia: [scelte[i].by ? soloNome(scelte[i].by) : '', scelte[i].at ? L.data(new Date(scelte[i].at), 'numerica') : ''].filter(Boolean).join(' · ')
        });
      }
      if (foto.length === 0) {
        window.alert(L.t('galleria.nessunaScaricata'));
        return;
      }
      setPdfBusy(L.t('galleria.compongo'));
      const r = intervalloCampo(campData);
      const bytes = PDF.crea({
        titolo: BRAND.appTitle,
        sottotitolo: r.from === r.to ? r.from : `${r.from} → ${r.to}`,
        motto: BRAND.footerMotto,
        foto
      });
      const nome = `foto-ricordo-${toDateStr(new Date())}.pdf`;
      const blob = new Blob([bytes], {
        type: 'application/pdf'
      });
      const file = new File([blob], nome, {
        type: 'application/pdf'
      });

      // Da telefono la condivisione è più utile del download: si manda nel
      // gruppo o si salva nei file con lo stesso gesto.
      if (navigator.canShare && navigator.canShare({
        files: [file]
      })) {
        try {
          await navigator.share({
            files: [file],
            title: BRAND.appTitle
          });
          uscitaScelta();
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
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
  const openAlbum = async a => {
    const CS = window.CloudSync;
    if (!CS || !CS.listPhotos || !CS.isConnected()) {
      window.alert(L.t('galleria.albumChiusoSenzaLinea'));
      return;
    }
    setAlbum({
      id: a.id,
      name: a.name,
      photos: [],
      loading: true
    });
    const list = await CS.listPhotos(a.id);
    setAlbum(cur => cur && cur.id === a.id ? {
      ...cur,
      photos: list,
      loading: false
    } : cur);
  };
  const removePhoto = async p => {
    if (!window.confirm(L.t('galleria.confermaElimina', p.by || L.t('archivio.anonimo')))) return;
    const CS = window.CloudSync;
    if (CS && CS.deletePhoto) await CS.deletePhoto(p.id);
    setViewPhoto(null);
    // Nella galleria del campo in corso ci pensa l'ascolto; nell'album di un
    // campo chiuso, che è una lettura sola, va tolta a mano.
    setAlbum(cur => cur ? {
      ...cur,
      photos: cur.photos.filter(x => x.id !== p.id)
    } : cur);
  };
  return {
    photos,
    photosReady,
    photoWho,
    setPhotoWho,
    photoBusy,
    viewPhoto,
    setViewPhoto,
    album,
    setAlbum,
    galleryView,
    setGalleryView,
    albumPage,
    albumRef,
    picking,
    setPicking,
    picked,
    setPicked,
    pdfBusy,
    photoCap,
    setPhotoCap,
    photosBy,
    addPhotos,
    openPhoto,
    removePhoto,
    openAlbum,
    PER_PAGINA_ALBUM,
    paginaAlbum,
    sfoglia,
    onScrollAlbum,
    togglePicked,
    uscitaScelta,
    generaRicordo,
    soloNome
  };
};
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
const usaScontrini = ({
  purchases,
  toBuy,
  equipment
}) => {
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
    codaMagazzinoRef.current = codaMagazzinoRef.current.then(() => MF.migra()).then(esito => {
      if (!vivo) return;
      receiptsSalvatiRef.current = esito.mappa || {};
      setReceipts(prev => ({
        ...(esito.mappa || {}),
        ...prev
      }));
      setFotoDove(esito.ripiego || !MF.disponibile() ? 'memoria del telefono' : 'magazzino');
    });
    return () => {
      vivo = false;
    };
  }, []);
  useEffect(() => {
    receiptsRef.current = receipts;
    const MF = window.MagazzinoFoto;
    if (!MF) return;
    codaMagazzinoRef.current = codaMagazzinoRef.current
    // Il punto di partenza si legge quando tocca a noi, non quando ci si
    // mette in coda: chi ci precede lo ha appena spostato.
    .then(() => MF.applica(receiptsSalvatiRef.current, receipts)).then(esito => {
      // Il segnaposto si sposta SOLO a scrittura riuscita: segnarlo prima
      // vorrebbe dire che una scrittura fallita non viene piu' ritentata —
      // lo stesso errore gia' fatto con lastPushedJson in firebase-sync.js.
      if (esito.salvato) receiptsSalvatiRef.current = receipts;
      if (esito.ripiego) setFotoDove('memoria del telefono');
    })
    // Una scrittura andata male non deve rompere la fila: chi viene dopo
    // riparte dall'ultimo punto di partenza buono e riprova.
    .catch(() => {/* si riprova al prossimo cambiamento */});
  }, [receipts]);

  // Pulizia: elimina le foto locali di voci che non esistono più (es. acquisto
  // cancellato da un altro dispositivo). Vanno considerate TUTTE le liste che
  // possono avere uno scontrino, altrimenti si perdono le foto delle voci
  // ancora da acquistare o dell'attrezzatura.
  useEffect(() => {
    setReceipts(prev => {
      const ids = new Set([...purchases.map(p => p.id), ...toBuy.map(t => t.id), ...equipment.map(e => e.id)]);
      const keys = Object.keys(prev);
      if (keys.every(k => ids.has(k))) return prev;
      const copy = {};
      keys.forEach(k => {
        if (ids.has(k)) copy[k] = prev[k];
      });
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

  // Allega una foto scontrino a un id qualsiasi (voce da acquistare o acquisto
  // già registrato: le foto sono indicizzate per id).
  const attachReceiptTo = async (e, id) => {
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
      window.alert(L.t('scontrino.fotoIllegibile'));
    }
  };

  // La foto scattata nella maschera di registrazione: resta in attesa finche'
  // non si preme Salva, perche' prima l'acquisto non ha ancora un id.
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
      window.alert(L.t('scontrino.fotoIllegibile'));
    }
  };
  return {
    receipts,
    setReceipts,
    fotoDove,
    pReceipt,
    setPReceipt,
    viewReceipt,
    setViewReceipt,
    handleCloudReceipts,
    attachReceiptTo,
    onReceiptFile
  };
};
// ---------- L'account ----------
//
// Quarto pezzo di stato che esce da App() (ROADMAP.md § 14), e il primo
// mattone della versione pubblica (§ 1). Tiene lo stato del login e niente
// altro: chi sei, cosa stai scrivendo nella maschera, e se qualcosa e' andato
// storto. Le REGOLE — cosa ti lascia fare l'app, se la registrazione e'
// valida, come si traduce un codice d'errore di Firebase — stanno in auth.js,
// fuori da src/, e si provano senza browser.
//
// La cosa da non dimenticare leggendo questo file: **non e' un muro**.
// L'account non serve per usare l'app. Chi apre l'app e digita il codice del
// campo segna presenze e spese come ha sempre fatto, e questo hook resta uno
// stato che nessuno guarda. Serve per CREARE e AMMINISTRARE un campo, cioe'
// per le cose che nella versione pubblica avranno un proprietario.
const usaAccount = () => {
  // L'utente com'e' adesso: null vuol dire ospite. Ci pensa AuthCloud ad
  // aggiornarlo, e parte da quello che sa gia' (di solito null) per non
  // lasciare la scheda vuota mentre l'SDK arriva da gstatic.
  const [utente, setUtente] = useState(null);
  // Quale maschera e' aperta: 'entra' | 'registra'. Chiusa di default, perche'
  // il tasto Google e' la strada breve e le due caselle sono la lunga.
  const [modo, setModo] = useState('');
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Una chiave del dizionario, non una frase: i messaggi li sceglie il disegno
  // (§ 18). null vuol dire che non c'e' niente da dire.
  const [problema, setProblema] = useState(null);
  const [occupato, setOccupato] = useState(false);
  // Una riga verde dopo un'azione riuscita: "email rimandata", "ti abbiamo
  // scritto". Senza, l'utente tocca due volte e riceve due email.
  const [fatto, setFatto] = useState(null);
  const AC = () => typeof window !== 'undefined' && window.AuthCloud || null;

  // Il profilo su users/<uid>: si allinea a ogni cambio di accesso, non a
  // ogni disegno. Chi entra per la prima volta lo fa nascere; chi rientra di
  // solito non scrive niente — la decisione sta in Auth.profiloDaSalvare, e
  // dice di no quando non e' cambiato nulla.
  //
  // Si ignora quello che torna, apposta: il profilo e' roba di servizio e
  // non deve mai far comparire un errore rosso a chi e' appena entrato.
  // sincronizzaProfilo non alza eccezioni per lo stesso motivo — una dentro
  // l'osservatore dell'accesso porterebbe via l'app intera.
  useEffect(() => {
    const ac = AC();
    if (!ac) return undefined;
    return ac.osserva(u => {
      setUtente(u);
      if (u && ac.sincronizzaProfilo) ac.sincronizzaProfilo(u);
    });
  }, []);
  const stato = window.Auth ? window.Auth.stato(utente) : 'ospite';
  const pulisci = () => {
    setProblema(null);
    setFatto(null);
  };
  const chiudi = () => {
    setModo('');
    setPassword('');
    pulisci();
  };

  // Ogni azione passa di qui: una sola strada per "occupato", per l'errore
  // tradotto e per il caso in cui Firebase non sia configurato affatto. Senza,
  // ogni tasto avrebbe il suo try/catch e uno di loro se lo dimenticherebbe.
  const prova = async (azione, dopo) => {
    const ac = AC();
    if (!ac || !ac.disponibile()) {
      setProblema('auth.senzaFirebase');
      return false;
    }
    setOccupato(true);
    pulisci();
    try {
      await azione(ac);
      if (dopo) setFatto(dopo);
      return true;
    } catch (e) {
      // motivo() restituisce null quando non c'e' niente da dire (la finestra
      // di Google chiusa con la X e' un ripensamento, non un guasto).
      const chiave = window.Auth ? window.Auth.motivo(e) : 'auth.nonRiuscito';
      if (chiave) setProblema(chiave);
      return false;
    } finally {
      setOccupato(false);
    }
  };
  const entraConGoogle = () => prova(ac => ac.conGoogle());
  const entraConEmail = async () => {
    if (!email.trim() || !password) {
      setProblema('auth.serveEmailEPassword');
      return;
    }
    if (await prova(ac => ac.entra(email, password))) chiudi();
  };
  const registrati = async () => {
    const dati = {
      nome,
      cognome,
      email,
      password
    };
    const problemi = window.Auth ? window.Auth.validaRegistrazione(dati) : [];
    // Si mostra il primo: un elenco di cinque righe rosse sotto una maschera
    // di quattro caselle e' piu' scoraggiante del problema che descrive.
    if (problemi.length) {
      setProblema(problemi[0]);
      setFatto(null);
      return;
    }
    if (await prova(ac => ac.registra(dati))) {
      setPassword('');
      setModo('');
      setFatto('auth.controllaEmail');
    }
  };
  const esci = () => prova(ac => ac.esci());
  const reimposta = async () => {
    if (!email.trim()) {
      setProblema('auth.serveEmail');
      return;
    }
    await prova(ac => ac.reimposta(email), 'auth.emailReimpostaInviata');
  };
  const rimandaVerifica = () => prova(ac => ac.inviaVerifica(), 'auth.emailVerificaInviata');

  // Firebase non si accorge da solo che l'utente ha cliccato il link: l'oggetto
  // in memoria resta "da verificare" finche' non lo si ricarica. Senza questo
  // tasto, chi verifica e torna nell'app pensa che non abbia funzionato.
  const controllaVerifica = () => prova(ac => ac.ricarica());
  return {
    utente,
    stato,
    modo,
    setModo,
    nome,
    setNome,
    cognome,
    setCognome,
    email,
    setEmail,
    password,
    setPassword,
    problema,
    fatto,
    occupato,
    chiudi,
    entraConGoogle,
    entraConEmail,
    registrati,
    esci,
    reimposta,
    rimandaVerifica,
    controllaVerifica
  };
};
// ---------- La stanza ----------
//
// Quinto pezzo di stato fuori da App() (ROADMAP § 14), e il modulo del § 9.
// Tiene: quale stanza sei dentro, cosa stai scrivendo nel modulo, e cosa e'
// andato storto. Le REGOLE — l'alfabeto del codice, come si legge un codice
// digitato a mano, se il modulo e' valido — stanno in stanza.js, fuori da
// src/, e si provano senza browser.
//
// Due cose da non dimenticare leggendo questo file.
//
// **Non e' un muro**, come l'account. Chi apre l'app e usa il campo che ha
// gia' non incontra niente di tutto questo: la stanza serve a chi ne crea una
// nuova o entra in quella di un altro, e sta dietro FEATURES.rooms.
//
// **La guardia vera non e' qui.** Questo hook calcola l'impronta e prova a
// scrivere; a dire di no sono le regole Firestore. Un controllo in piu' scritto
// qui non aggiunge sicurezza — aggiunge un posto dove sbagliare — ma un
// controllo che manca QUI si vede solo come un permission-denied, quindi le
// cose che l'utente puo' correggere da solo (un codice della forma sbagliata,
// una data storta) si dicono prima di disturbare la rete.
const usaStanza = () => {
  // La stanza di adesso: null vuol dire "nessuna", che e' il caso normale
  // finche' la versione pubblica non esiste davvero.
  const [stanza, setStanza] = useState(null);
  const [membri, setMembri] = useState([]);
  // Quale maschera e' aperta: '' | 'crea' | 'entra'.
  const [modo, setModo] = useState('');
  const [nome, setNome] = useState('');
  const [inizio, setInizio] = useState('');
  const [fine, setFine] = useState('');
  const [codice, setCodice] = useState('');
  // Chiavi del dizionario, non frasi: le sceglie il disegno (§ 18).
  const [problema, setProblema] = useState(null);
  const [fatto, setFatto] = useState(null);
  const [occupato, setOccupato] = useState(false);
  const SC = () => typeof window !== 'undefined' && window.StanzaCloud || null;
  const S = () => typeof window !== 'undefined' && window.Stanza || null;

  // La stanza in cui si era entrati si ricorda: riaprire l'app e ritrovarsi
  // fuori sarebbe come non esserci mai entrati. Si scrive con scriviLocale
  // (10-fondamenta), che ha il try/catch: un setItem nudo dentro un effetto
  // smonta React quando la quota e' piena (CLAUDE.md). NON salvaLocale —
  // quello vive dentro App() e da un hook non si vede.
  useEffect(() => {
    try {
      const c = localStorage.getItem('cambusa_stanza');
      if (c) setStanza({
        codice: c
      });
    } catch (e) {/* niente: si resta senza stanza */}
  }, []);

  // ---------- L'invito arrivato da un link ----------
  // Chi apre "…#stanza=K7RX-2MQP" ha un invito in mano. NON lo si accetta da
  // soli: si mostra e si chiede. Entrare di nascosto in una stanza perche'
  // qualcuno ha inoltrato un messaggio e' esattamente il genere di cosa che
  // fa disinstallare un'app — e chi tocca un link non ha per forza deciso
  // di cambiare campo.
  const [invito, setInvito] = useState(null);
  useEffect(() => {
    const regole = S();
    if (!regole || typeof window === 'undefined') return;
    const c = regole.leggiInvito(window.location.href);
    if (!c) return;
    setInvito(c);
    // Il codice si toglie subito dalla barra: resterebbe nella cronologia del
    // telefono, e da li' lo rilegge chiunque lo prenda in mano. Si sostituisce
    // la voce invece di aggiungerne una, cosi' il tasto indietro non ci
    // riporta dentro.
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) {/* niente: il link resta in barra, non e' un guasto */}
  }, []);
  const pulisci = () => {
    setProblema(null);
    setFatto(null);
  };
  const chiudi = () => {
    setModo('');
    pulisci();
  };

  // Una sola strada per "occupato", per l'errore tradotto e per il caso in cui
  // Firebase non sia configurato. Senza, ogni tasto avrebbe il suo try/catch e
  // uno di loro se lo dimenticherebbe.
  const prova = async azione => {
    const c = SC();
    if (!c || !c.disponibile()) {
      setProblema('stanza.senzaFirebase');
      return null;
    }
    setOccupato(true);
    pulisci();
    try {
      return await azione(c);
    } catch (e) {
      setProblema(c.motivo ? c.motivo(e) : 'stanza.nonRiuscito');
      return null;
    } finally {
      setOccupato(false);
    }
  };
  const ricorda = cod => {
    setStanza({
      codice: cod
    });
    scriviLocale('cambusa_stanza', cod);
  };
  const crea = async utente => {
    const regole = S();
    // Creare una stanza vuol dire diventarne il proprietario: e' la riga
    // della tabella di auth.js, e la ripetono anche le regole Firestore. Qui
    // si dice prima, perche' un permission-denied non spiega niente.
    if (!window.Auth || !window.Auth.puo('creare', window.Auth.stato(utente))) {
      setProblema('stanza.serveAccount');
      return;
    }
    const problemi = regole.validaModulo({
      nome,
      inizio,
      fine
    });
    // Si mostra il primo: un elenco di righe rosse sotto una maschera di
    // quattro caselle scoraggia piu' del problema che descrive.
    if (problemi.length) {
      setProblema(problemi[0]);
      setFatto(null);
      return;
    }
    const nuovo = regole.generaCodice();
    // generaCodice torna null quando il browser non sa dare numeri casuali
    // sicuri. Non si ripiega su Math.random(): un codice prevedibile e' una
    // serratura finta, e nessuno se ne accorgerebbe.
    if (!nuovo) {
      setProblema('stanza.senzaCaso');
      return;
    }
    const cod = await prova(c => c.crea({
      nome,
      inizio,
      fine,
      codice: nuovo
    }, utente));
    if (cod) {
      ricorda(cod);
      setModo('');
      setFatto('stanza.creata');
    }
  };
  const entra = async utente => {
    const regole = S();
    // La forma del codice la puo' correggere l'utente da solo: dirglielo qui
    // e' meglio che fargli aspettare un giro di rete per sentirsi dire "non
    // consentito", che suona come un guasto e non come un refuso.
    if (!regole.codiceValido(codice)) {
      setProblema('stanza.codiceNonValido');
      return;
    }
    const cod = await prova(c => c.entra(codice, utente));
    if (cod) {
      ricorda(cod);
      setModo('');
      setCodice('');
      setFatto('stanza.entrato');
    }
  };

  // Accettare l'invito e' entrare, con il codice che portava il link.
  const accettaInvito = async utente => {
    const cod = await prova(c => c.entra(invito, utente));
    if (cod) {
      ricorda(cod);
      setInvito(null);
      setFatto('stanza.entrato');
    }
  };
  const rifiutaInvito = () => {
    setInvito(null);
    pulisci();
  };

  // Il link da mandare agli altri. Si costruisce sull'indirizzo di questa
  // pagina senza quello che c'era dopo ? o # — ci pensa linkInvito.
  const linkDaMandare = () => {
    const regole = S();
    if (!regole || !stanza || typeof window === 'undefined') return '';
    return regole.linkInvito(window.location.origin + window.location.pathname, stanza.codice);
  };
  const aggiornaMembri = async () => {
    if (!stanza) return;
    const elenco = await prova(c => c.membri(stanza.codice));
    if (elenco) setMembri(elenco);
  };

  // Uscire da una stanza qui vuol dire solo smettere di guardarla: la scheda
  // su Firestore la toglie chi amministra, o se stessi da un'altra strada.
  // Cancellarla da qui, con un tasto che sembra "chiudi", farebbe perdere il
  // posto a chi voleva solo tornare al campo di prima.
  const esci = () => {
    setStanza(null);
    setMembri([]);
    pulisci();
    scriviLocale('cambusa_stanza', '');
  };
  return {
    stanza,
    membri,
    modo,
    setModo,
    nome,
    setNome,
    inizio,
    setInizio,
    fine,
    setFine,
    codice,
    setCodice,
    problema,
    fatto,
    occupato,
    chiudi,
    crea,
    entra,
    esci,
    aggiornaMembri,
    invito,
    accettaInvito,
    rifiutaInvito,
    linkDaMandare
  };
};
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
        if (n > 0) seed.push({
          id: uid(),
          name,
          price: n,
          type,
          at: Date.now()
        });
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
  const [copied, setCopied] = useState(''); // ultima cosa copiata (feedback)
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
  const [weather, setWeather] = useState(() => load('cambusa_weather', {
    fetchedAt: 0,
    byDate: {}
  }));

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
    receipts,
    setReceipts,
    fotoDove,
    pReceipt,
    setPReceipt,
    viewReceipt,
    setViewReceipt,
    handleCloudReceipts,
    attachReceiptTo,
    onReceiptFile
  } = usaScontrini({
    purchases,
    toBuy,
    equipment
  });

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
  const [closing, setClosing] = useState(false); // modale "Chiudi il campo"
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
    try {
      return localStorage.getItem(ADMIN_KEY) === '1';
    } catch (e) {
      return false;
    }
  });
  const [tecnicaOpen, setTecnicaOpen] = useState(false);
  const [adminPwd, setAdminPwd] = useState('');
  const [adminErr, setAdminErr] = useState('');

  // window.APP_ADMIN si legge al momento del controllo, non all'avvio: così
  // una configurazione mancante si può aggiungere senza rompere niente.
  const accendiAdmin = () => {
    try {
      localStorage.setItem(ADMIN_KEY, '1');
    } catch (e) {/* resta accesa solo finché l'app è aperta */}
    setAdmin(true);
    setAdminPwd('');
    setAdminErr('');
  };
  const entraAdmin = async () => {
    const cfg = window.APP_ADMIN;
    // `aperta` vuol dire che su questa versione non c'è niente da digitare.
    // Sta in firebase-config.js con scritto accanto cosa apre, e la scheda lo
    // dice a schermo: una serratura tolta di nascosto è peggio di una
    // serratura che non c'è.
    if (cfg && cfg.aperta) {
      accendiAdmin();
      return;
    }
    if (!cfg || !cfg.hash) {
      setAdminErr(L.t('tecnica.nonConfigurata'));
      return;
    }
    const im = await improntaPassword(adminPwd, cfg);
    if (im && im === cfg.hash) {
      accendiAdmin();
    } else {
      setAdminErr(L.t(im ? 'tecnica.passwordSbagliata' : 'tecnica.serveHttps'));
    }
  };
  const esciAdmin = () => {
    try {
      localStorage.removeItem(ADMIN_KEY);
    } catch (e) {/* niente */}
    setAdmin(false);
    setAdminPwd('');
    setAdminErr('');
  };
  const [sepOpen, setSepOpen] = useState(false); // riga "Conto separato" aperta

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
      try {
        localStorage.removeItem(UNLOCK_KEY);
      } catch (e) {/* ignora */}
    } else {
      localStorage.removeItem(LOCK_ALWAYS_KEY);
      if (LOCK && LOCK.hash) {
        try {
          localStorage.setItem(UNLOCK_KEY, LOCK.hash);
        } catch (e) {/* ignora */}
      }
    }
  };
  const lockNow = reason => {
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
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
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

  // Stato sincronizzato sempre aggiornato: serve alla fusione, che deve
  // partire dai dati di ADESSO e non da quelli di quando ci si è connessi.
  const syncStateRef = useRef(null);
  syncStateRef.current = {
    members,
    campData,
    purchases,
    gear,
    settled,
    equipment,
    toBuy,
    sepDays,
    freeDays,
    blocchi,
    compiti
  };

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
    metaRef.current = saved && saved.rev ? {
      flat: saved.flat || {},
      rev: saved.rev,
      del: saved.del || {},
      hi: saved.hi || 0
    } : {
      flat: SM ? SM.flatten(syncStateRef.current) : {},
      rev: {},
      del: {},
      hi: 0
    };
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
  const saveMeta = m => {
    metaRef.current = m;
    const testo = JSON.stringify(m);
    const sacrifici = [() => {
      const tutte = snapLocaliLeggi();
      const chiavi = Object.keys(tutte).sort();
      if (chiavi.length === 0) return false;
      delete tutte[chiavi[0]];
      try {
        localStorage.setItem(SNAP_KEY, JSON.stringify(tutte));
      } catch (e) {
        localStorage.removeItem(SNAP_KEY);
      }
      return true;
    }, () => {
      localStorage.removeItem(SNAP_KEY);
      return true;
    }, () => {
      localStorage.removeItem(LOG_KEY);
      return true;
    }];
    for (let i = 0; i <= sacrifici.length; i++) {
      try {
        localStorage.setItem(SYNC_META_KEY, testo);
        if (spazioPienoRef.current) {
          spazioPienoRef.current = false;
          setSpazioPieno(false);
        }
        return;
      } catch (e) {
        if (i === sacrifici.length || !sacrifici[i]()) break;
      }
    }
    if (!spazioPienoRef.current) {
      spazioPienoRef.current = true;
      setSpazioPieno(true);
    }
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
    try {
      localStorage.setItem(chiave, JSON.stringify(valore));
    } catch (e) {
      try {
        localStorage.removeItem(SNAP_KEY);
        localStorage.setItem(chiave, JSON.stringify(valore));
      } catch (e2) {
        if (!spazioPienoRef.current) {
          spazioPienoRef.current = true;
          setSpazioPieno(true);
        }
      }
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
    try {
      localStorage.setItem('cambusa_archives', JSON.stringify(archives));
    } catch (e) {
      console.warn('Spazio esaurito: l\'archivio resta nel cloud e nei file scaricati.');
    }
  }, [archives]);

  // ---------- Meteo ----------
  // Servizio: Open-Meteo (gratuito, senza chiave), modello ICON per l'Europa,
  // 16 giorni, fuso orario della località. Le previsioni sono UNA SOLA per
  // tutto il campo: chi ha linea le scarica e le mette nel cloud, gli altri
  // le ricevono. Prima ogni telefono scaricava per conto suo in momenti
  // diversi e si vedevano numeri diversi.
  const [wxBusy, setWxBusy] = useState(false);
  const weatherRef = useRef(weather);
  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);
  const fetchWeather = force => {
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
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_probability_mean,precipitation_sum,precipitation_hours' + '&hourly=weather_code,precipitation_probability' + `&timezone=auto&forecast_days=16${quota}`).then(r => r.json()).then(j => {
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
            p: h.precipitation_probability ? h.precipitation_probability[i] : null
          });
        });
      }
      const num = (a, i) => Array.isArray(a) && typeof a[i] === 'number' ? a[i] : null;
      const byDate = {};
      d.time.forEach((t, i) => {
        byDate[t] = Object.assign({
          code: d.weather_code[i],
          tmax: d.temperature_2m_max[i],
          tmin: d.temperature_2m_min[i],
          rain: d.precipitation_probability_max[i],
          rmed: num(d.precipitation_probability_mean, i),
          mm: num(d.precipitation_sum, i),
          oreP: num(d.precipitation_hours, i)
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
        fetchedAt: ora,
        stampa: ora,
        byDate,
        lat: loc.lat,
        lon: loc.lon,
        quota: typeof j.elevation === 'number' ? j.elevation : null
      };
      setWeather(next);
      // Condivide la stessa previsione con tutto il campo.
      if (window.CloudSync && window.CloudSync.putWeather) window.CloudSync.putWeather(next);
    }).catch(() => {/* offline o API non raggiungibile: resta la cache */}).finally(() => setWxBusy(false));
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
    const next = Object.assign({}, remote, {
      fetchedAt: quando,
      stampa: remote.fetchedAt
    });
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
        if (code) CS.connect(window.FIREBASE_CONFIG, code, applyRemote, {
          password: sessionPassword
        }).catch(() => {});
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
  const applyRemote = remote => {
    const SM = window.SyncMerge;
    const rmeta = remote && remote._meta;
    const local = syncStateRef.current;
    if (!SM) return;
    const remoteState = {
      ...remote
    };
    delete remoteState._meta;

    // Dati senza cronologia (telefono fermo a una versione vecchia dell'app):
    // NON si prendono per buoni. Entrano nella fusione come voci "di data
    // ignota", quindi qualsiasi modifica datata — di chiunque — ha la
    // precedenza, e le voci che quel telefono non ha non vengono cancellate
    // (per cancellare serve una lapide, e lui non ne produce). Prima qui si
    // sovrascriveva tutto: bastava un telefono rimasto indietro per riportare
    // l'intero campo a giorni prima.
    const metaRemota = rmeta && rmeta.v === SM.VERSION ? rmeta : SM.emptyMeta();

    // Orologi sballati: la regola sta in allarmi.js, qui resta cosa farne.
    const sballato = Allarmi.orologioAvanti(rmeta, Date.now(), OROLOGIO_SOGLIA);
    if (sballato) {
      setOrologioFuori(sballato);
      try {
        localStorage.setItem(OROLOGIO_KEY, JSON.stringify(sballato));
      } catch (e) {/* niente */}
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
    const perse = Object.keys(primaFlat).filter(p => !(p in res.meta.flat));
    if (perse.length > 0) {
      // QUANDO sono state cancellate, non solo quante. È la differenza fra due
      // situazioni opposte che prima venivano annunciate allo stesso modo:
      //   - qualcuno sta cancellando ADESSO -> va fermato, ed è un allarme;
      //   - questo telefono era indietro e sta venendo a sapere ora di
      //     cancellazioni fatte giorni fa -> non manca niente a nessuno, è
      //     soltanto il recupero del ritardo, e gridare al disastro per un
      //     membro tolto tre giorni fa (che porta con sé le sue presenze di
      //     tutti i giorni: un solo gesto, sette "voci") è un falso allarme.
      const quando = perse.map(p => SM.quandoCancellata(p, metaRef.current, metaRemota));
      // La regola — quali perdite meritano un allarme e quali sono solo il
      // recupero di un ritardo — sta in allarmi.js.
      const verdetto = Allarmi.perditeDaAnnunciare(perse, quando, Date.now(), {
        raffica: RAFFICA,
        recente: PERDITA_RECENTE
      });
      try {
        localStorage.setItem(RESCUE_KEY, JSON.stringify({
          at: Date.now(),
          perse: perse.length,
          paths: perse.slice(0, 200),
          quando: verdetto.piuRecente,
          state: local,
          meta: metaRef.current
        }));
      } catch (e) {/* spazio esaurito: si prosegue senza scorta */}
      if (verdetto.annuncia) {
        setLostSync({
          n: verdetto.fresche.length,
          at: Date.now(),
          quando: verdetto.piuRecente,
          che: descriviPerdite(verdetto.fresche, local)
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
    if (conBlocchi.respinte.length) setRespinte(prev => [...conBlocchi.respinte, ...prev].slice(0, 40));
    const cdBloccata = applicaBlocchi(res.state.campData);
    const conMembri = applicaBlocchiMembri(res.state.members, cdBloccata);
    if (conMembri.salvati.length) setMembriSalvati(prev => [...conMembri.salvati, ...prev].slice(0, 20));
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
    setTimeout(() => {
      suppressPushRef.current = false;
    }, 0);
  };

  // ---------- Sostituzioni in blocco (ripristino, importazione) ----------
  // Un ripristino e un'importazione non "aggiungono": rimpiazzano lo stato, e
  // tutto ciò che c'era e non c'è più diventa una cancellazione datata che
  // parte verso TUTTI i telefoni. È l'operazione più pericolosa dell'app, e
  // finora chi la faceva era l'unico a non avere una via d'uscita: la copia di
  // scorta si salvava solo su chi RICEVEVA il disastro.
  // Qui si conta il danno PRIMA di chiedere conferma, e si mette da parte la
  // copia di scorta anche su questo telefono.
  const perditeSeApplico = nuovo => {
    const SM = window.SyncMerge;
    if (!SM) return [];
    const prima = SM.flatten(syncStateRef.current);
    const dopo = SM.flatten(nuovo);
    return Object.keys(prima).filter(p => !(p in dopo));
  };
  const scortaPrimaDi = perse => {
    if (!perse.length) return;
    try {
      localStorage.setItem(RESCUE_KEY, JSON.stringify({
        at: Date.now(),
        perse: perse.length,
        paths: perse.slice(0, 200),
        quando: Date.now(),
        state: syncStateRef.current,
        meta: metaRef.current
      }));
    } catch (e) {/* spazio esaurito: si prosegue senza scorta */}
    setLostSync(null);
    setDiagTick(t => t + 1);
  };

  // Frase da mettere nella conferma: dice cosa sparirà, in italiano.
  const avvisoPerdite = perse => {
    if (!perse.length) return L.t('perdite.nessuna');
    return L.t('perdite.avviso', perse.length, descriviPerdite(perse, syncStateRef.current));
  };

  // Il registro come file di testo: comodo da mandare quando si deve capire
  // cosa è successo, senza doverlo leggere sullo schermo del telefono.
  const esportaRegistro = () => {
    const st = syncStateRef.current;
    const righe = logLeggi().map(r => [L.data(new Date(r.at), 'dataOra'), L.t(r.o === 'io' ? 'registro.questoTelefono' : 'registro.sincronizzazione'), L.t(r.k === 'd' ? 'registro.cancellata' : 'registro.modificata'), sezioneDiPath(r.p), descriviPath(r.p, st), r.p].join('\t'));
    const testo = L.t('registro.testata', BRAND.appTitle, L.data(new Date(), 'dataOra')) + L.t('registro.colonne') + righe.join('\n') + '\n';
    const blob = new Blob([testo], {
      type: 'text/plain;charset=utf-8'
    });
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
    if (!r || !r.state) {
      window.alert(L.t('diag.senzaScorta'));
      return;
    }
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
  const connectCloud = async code => {
    const CS = window.CloudSync;
    if (!CS || !CS.isConfigured()) {
      window.alert(L.t('cloud.senzaFirebase'));
      return;
    }
    const c = (code || '').trim();
    if (!c) {
      window.alert(L.t('cloud.senzaCodice'));
      return;
    }
    localStorage.removeItem('cambusa_sync_optout'); // riattiva l'auto-connessione
    try {
      await CS.connect(window.FIREBASE_CONFIG, c, applyRemote, {
        password: sessionPassword
      });
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
    CS.onStatus(s => {
      cloudConnectedRef.current = s.connected;
      setCloud(s);
    });
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
    const code = stanzaStato.stanza && stanzaStato.stanza.codice || CS.savedCode() || window.CAMP_CODE_DEFAULT || '';
    if (!code || !CS.isConfigured() || optedOut) return;

    // DOVE si scrive (la stanza) e CHI scrive (l'uid) decidono insieme se la
    // connessione di adesso va ancora bene. La regola e' pura e sta in
    // firebase-sync.js: erano due effetti qui dentro, e il passaggio piu'
    // importante di tutti — da nessuna stanza alla prima — non lo prendeva
    // nessuno dei due.
    const voluto = {
      codice: code,
      uid: account.utente && account.utente.uid || null
    };
    const collegato = {
      connesso: CS.isConnected(),
      codice: CS.codiceCollegato(),
      uid: CS.uidCollegato()
    };
    if (!CS.vaRiagganciato(collegato, voluto)) return;

    // Staccare prima di riattaccare: restare appesi al campo di prima vuol
    // dire continuare a scriverci dentro, e il posto dove finiscono i dati
    // cambierebbe solo al riavvio — il tipo di ritardo che nessuno collega
    // alla causa.
    if (CS.isConnected()) CS.disconnect();
    setCampCodeInput(code);
    CS.connect(window.FIREBASE_CONFIG, code, applyRemote, {
      password: sessionPassword
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, stanzaStato.stanza && stanzaStato.stanza.codice, account.utente && account.utente.uid]);

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
      window.CloudSync.pushState({
        ...st,
        _meta: {
          v: SM ? SM.VERSION : 0,
          rev: m.rev,
          del: m.del,
          hi: m.hi || 0
        }
      });
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
    const pubblica = forza => {
      const SM = window.SyncMerge;
      const m = metaRef.current;
      CS.pushState({
        ...syncStateRef.current,
        _meta: {
          v: SM ? SM.VERSION : 0,
          rev: m.rev,
          del: m.del,
          hi: m.hi || 0
        }
      }, forza);
    };

    // 1) Campo vuoto nel cloud: pubblica quello che abbiamo.
    if (cloud.empty) {
      const st = syncStateRef.current;
      const qualcosa = (st.members || []).length || (st.purchases || []).length || (st.toBuy || []).length || (st.equipment || []).length || Object.keys(st.campData || {}).length;
      if (qualcosa) pubblica(true);
    }

    // 2 e 3) Ritenta ciò che è rimasto in sospeso, subito e poi ogni due minuti.
    if (CS.riprova) CS.riprova();
    const t = window.setInterval(() => {
      if (!CS.isConnected()) return;
      if (CS.inSospeso && CS.inSospeso()) {
        CS.riprova();
        return;
      }
      pubblica(false); // no-op se è già tutto allineato
    }, 120000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud.connected, cloud.empty]);

  // ---------- Dati per giorno ----------
  // Le regole pure delle presenze stanno in presenze.js: qui restano i
  // gestori, che sono l'unica parte che tocca lo stato.
  const getDayData = dateStr => Presenze.giorno(campData, dateStr);
  const updateDayData = (dateStr, field, value) => {
    setCampData(prev => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {}),
        [field]: value
      }
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
  const giornoBloccato = dateStr => Presenze.blocco(campData, dateStr);
  const applicaBlocchi = cd => Presenze.applicaBlocchi(cd);

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
  const giorniBloccatiDi = id => Presenze.giorniBloccatiDi(campData, id);

  // Guardia per i tasti che toccano un membro: dice di no e spiega quali
  // giorni lo trattengono.
  const membroIntoccabile = (id, azione) => {
    const g = giorniBloccatiDi(id);
    if (!g.length) return false;
    const m = members.find(x => x.id === id);
    window.alert(L.t('blocchi.membroIntoccabile', m ? m.name : L.t('blocchi.questaPersona'), azione, g.length, g.map(nomeGiorno).join(', ')));
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
    Object.keys(cd || {}).forEach(d => {
      const b = (cd[d] || {}).bloccato;
      if (!b || typeof b !== 'object' || !b.meals) return;
      Object.keys(b.meals).forEach(id => {
        const v = b.meals[id];
        if (v && (v.lunch || v.dinner)) protetti.add(String(id));
      });
      (Array.isArray(b.membri) ? b.membri : []).forEach(m => {
        if (m && m.id != null && !congelati.has(String(m.id))) congelati.set(String(m.id), m);
      });
    });
    if (!protetti.size) return {
      members: elenco,
      salvati: []
    };
    const ci = new Set((elenco || []).map(m => String(m && m.id)));
    const torna = [];
    protetti.forEach(id => {
      if (ci.has(id)) return;
      const dal = congelati.get(id) || (syncStateRef.current.members || []).find(m => m && String(m.id) === id);
      if (dal) torna.push({
        ...dal
      });
    });
    if (!torna.length) return {
      members: elenco,
      salvati: []
    };
    return {
      members: [...(elenco || []), ...torna],
      salvati: torna.map(m => m.name || '—')
    };
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
    Object.keys(cd || {}).forEach(d => {
      const b = (cd[d] || {}).bloccato;
      if (!b || typeof b !== 'object' || b.gratis === undefined) return;
      if (f.includes(d) !== !!b.gratis) {
        f = b.gratis ? [...f, d].sort() : f.filter(x => x !== d);
        cambiati.push(d);
      }
      if (s.includes(d) !== !!b.separato) {
        s = b.separato ? [...s, d].sort() : s.filter(x => x !== d);
        cambiati.push(d);
      }
    });
    return {
      freeDays: f,
      sepDays: s,
      cambiati
    };
  };

  // Una sostituzione in blocco (ripristino, importazione) non "aggiunge":
  // rimpiazza. Se i dati che entrano non hanno i blocchi che abbiamo adesso,
  // quei giorni tornano modificabili e le loro presenze cambiano — in
  // silenzio. Non si vieta (a volte il ripristino serve proprio a questo), ma
  // si dice prima, con i giorni per nome.
  const bloccatiInPericolo = nuovo => {
    const dopo = nuovo && nuovo.campData || {};
    return Object.keys(campData).filter(d => {
      const b = (campData[d] || {}).bloccato;
      if (!b || typeof b !== 'object') return false;
      const nb = (dopo[d] || {}).bloccato;
      return !nb || JSON.stringify(nb.meals || {}) !== JSON.stringify(b.meals || {});
    }).sort();
  };
  const avvisoBlocchi = nuovo => {
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
  const giornoGratis = dateStr => (freeDays || []).includes(dateStr);
  const chiediGiornoGratis = dateStr => {
    if (giornoIntoccabile(dateStr, L.t('gratis.azione'))) return;
    const gia = giornoGratis(dateStr);
    const meals = (campData[dateStr] || {}).meals || {};
    const quanti = Object.values(meals).filter(v => v && (v.lunch || v.dinner)).length;
    if (gia) {
      if (!window.confirm(L.t('gratis.confermaRimetti', nomeGiorno(dateStr)))) return;
    } else if (!window.confirm(L.t('gratis.confermaRendi', nomeGiorno(dateStr), quanti))) return;
    setFreeDays(prev => gia ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort());
  };
  const bloccaGiorno = dateStr => {
    const meals = (campData[dateStr] || {}).meals || {};
    const n = Object.values(meals).filter(v => v && (v.lunch || v.dinner)).length;
    if (!window.confirm(L.t('blocchi.confermaBlocca', nomeGiorno(dateStr), n))) return;
    setCampData(prev => {
      const day = {
        ...(prev[dateStr] || {})
      };
      const copia = {
        ...(day.meals || {})
      };
      // Nel blocco entra anche la scheda di chi ha mangiato quel giorno: se
      // qualcuno viene eliminato altrove, è da qui che lo si rimette a posto
      // con i suoi attributi veri (adulto o bambino su tutti), invece di
      // ricostruirlo a occhio e sbagliare i conti nel modo opposto.
      const dentro = Object.keys(copia).filter(id => copia[id] && (copia[id].lunch || copia[id].dinner));
      const schede = members.filter(m => dentro.includes(String(m.id))).map(m => ({
        ...m
      }));
      return {
        ...prev,
        [dateStr]: {
          ...day,
          meals: copia,
          bloccato: {
            at: Date.now(),
            meals: copia,
            membri: schede,
            gratis: giornoGratis(dateStr),
            separato: (sepDays || []).includes(dateStr)
          }
        }
      };
    });
  };
  const sbloccaGiorno = dateStr => {
    if (!window.confirm(L.t('blocchi.confermaSblocca', nomeGiorno(dateStr)))) return;
    setCampData(prev => {
      const day = {
        ...(prev[dateStr] || {})
      };
      const b = day.bloccato;
      if (b && typeof b === 'object' && b.meals) day.meals = {
        ...b.meals
      };
      delete day.bloccato;
      return {
        ...prev,
        [dateStr]: day
      };
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
  const bloccoConti = () => (blocchi || []).find(b => b && b.id === 'conti') || null;
  const chiudiConti = () => {
    const giorniAperti = Object.keys(campData).filter(d => {
      const meals = (campData[d] || {}).meals || {};
      return Object.values(meals).some(v => v && (v.lunch || v.dinner)) && !(campData[d] || {}).bloccato;
    });
    if (!window.confirm(L.t('chiusura.confermaChiudi', purchases.length, money(totals.overallTotal), giorniAperti.length))) return;
    const adesso = Date.now();
    // Prima i giorni: le quote dipendono dalle presenze quanto dalle spese.
    if (giorniAperti.length) {
      setCampData(prev => {
        const out = {
          ...prev
        };
        giorniAperti.forEach(d => {
          const day = {
            ...(out[d] || {})
          };
          const copia = {
            ...(day.meals || {})
          };
          out[d] = {
            ...day,
            meals: copia,
            bloccato: {
              at: adesso,
              meals: copia
            }
          };
        });
        return out;
      });
    }
    setBlocchi(prev => [...prev.filter(b => !b || b.id !== 'conti'), {
      id: 'conti',
      at: adesso,
      purchases: purchases.map(x => ({
        ...x
      })),
      equipment: equipment.map(x => ({
        ...x
      }))
    }]);
    setRespinte([]);
  };
  const riapriConti = () => {
    if (!window.confirm(L.t('chiusura.confermaRiapri'))) return;
    setBlocchi(prev => prev.filter(b => !b || b.id !== 'conti'));
    setRespinte([]);
  };

  // Rimette spese e attrezzatura come stavano alla chiusura, e riporta cosa è
  // stato respinto. Le foto degli scontrini non si toccano: quelle possono
  // sempre arrivare.
  const applicaBloccoConti = stato => {
    const b = (stato.blocchi || []).find(x => x && x.id === 'conti');
    if (!b || !Array.isArray(b.purchases)) return {
      stato,
      respinte: []
    };
    const fuori = [];
    const confronta = (attuali, congelate, che) => {
      const per = new Map(congelate.map(x => [String(x.id), x]));
      (attuali || []).forEach(x => {
        if (!x || x.id == null) return;
        const vecchia = per.get(String(x.id));
        if (!vecchia) fuori.push({
          che,
          azione: 'azione.aggiunta',
          nome: x.name || x.text || '—',
          quanto: posNum(x.price)
        });else if (JSON.stringify(vecchia) !== JSON.stringify(x)) fuori.push({
          che,
          azione: 'azione.modificata',
          nome: x.name || x.text || '—',
          quanto: posNum(x.price)
        });
      });
      const ora = new Set((attuali || []).map(x => String(x && x.id)));
      congelate.forEach(x => {
        if (!ora.has(String(x.id))) fuori.push({
          che,
          azione: 'azione.cancellata',
          nome: x.name || x.text || '—',
          quanto: posNum(x.price)
        });
      });
    };
    // "che" e "azione" sono CHIAVI del dizionario: l'avviso si disegna dopo,
    // e deve poter parlare nella lingua scelta in quel momento.
    confronta(stato.purchases, b.purchases, 'percorso.spesa');
    confronta(stato.equipment, b.equipment || [], 'percorso.attrezzatura');
    if (fuori.length === 0) return {
      stato,
      respinte: []
    };
    return {
      stato: {
        ...stato,
        purchases: b.purchases.map(x => ({
          ...x
        })),
        equipment: (b.equipment || []).map(x => ({
          ...x
        }))
      },
      respinte: fuori
    };
  };

  // Guardia per i tasti: dice di no e spiega perché.
  const contiChiusi = azione => {
    if (!bloccoConti()) return false;
    window.alert(L.t('chiusura.azioneImpossibile', azione));
    return true;
  };
  const getMeal = (dateStr, memberId) => Presenze.pasto(campData, dateStr, memberId);
  const toggleMeal = (dateStr, memberId, mealType) => {
    if (giornoBloccato(dateStr)) return;
    setCampData(prev => {
      const day = {
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
    if (giornoBloccato(dateStr)) return;
    setCampData(prev => {
      const day = {
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

  // ---------- Presenze rimaste senza padrone ----------
  // Le presenze sono legate all'ID del membro, non al nome. Chi viene eliminato
  // e riaggiunto prende un id nuovo: le sue vecchie presenze restano appese al
  // vecchio, spariscono dall'elenco e dai conti senza che nessuno se ne accorga.
  // È esattamente il modo in cui i pasti "svaniscono" pur avendo l'elenco
  // membri giusto. Qui si trovano e si riattaccano alla persona giusta.
  const presenzeOrfane = () => Presenze.orfane(campData, members, exMembri());
  const riassegnaOrfane = (orfano, nuovoId) => {
    const dest = members.find(m => m.id === nuovoId);
    if (!dest) {
      window.alert(L.t('orfane.scegliChi'));
      return;
    }
    const chi = orfano.nome ? L.t('orfane.di', orfano.nome) : L.t('orfane.senzaPadrone');
    if (!window.confirm(L.t('orfane.confermaAssegna', dest.name, orfano.pasti, chi, orfano.giorni.length))) return;
    setCampData(prev => {
      const out = {
        ...prev
      };
      Object.keys(out).forEach(d => {
        const day = out[d];
        if (!day || !day.meals || !day.meals[orfano.id]) return;
        const meals = {
          ...day.meals
        };
        const vecchio = meals[orfano.id] || {};
        const attuale = meals[nuovoId] || {
          lunch: false,
          dinner: false
        };
        meals[nuovoId] = {
          lunch: !!(attuale.lunch || vecchio.lunch),
          dinner: !!(attuale.dinner || vecchio.dinner)
        };
        delete meals[orfano.id];
        // Anche sui giorni bloccati: rimettere una presenza sulla persona
        // giusta non cambia CHI ha mangiato, e se la si saltasse quella
        // presenza sparirebbe dai conti.
        out[d] = conBlocco(day, meals);
      });
      return out;
    });
    setOrfanoScelte(prev => {
      const n = {
        ...prev
      };
      delete n[orfano.id];
      return n;
    });
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
  const nomeChiave = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const membriDoppi = () => {
    const per = new Map();
    members.forEach(m => {
      const k = nomeChiave(m.name);
      if (!k) return;
      per.set(k, (per.get(k) || []).concat([m]));
    });
    return [...per.values()].filter(g => g.length > 1);
  };

  // Pasti segnati per un id, su tutti i giorni: serve a decidere quale delle
  // due schede tenere (si tiene quella con più roba attaccata).
  const pastiDi = id => {
    let n = 0;
    Object.keys(campData).forEach(d => {
      const v = ((campData[d] || {}).meals || {})[id];
      if (v) n += (v.lunch ? 1 : 0) + (v.dinner ? 1 : 0);
    });
    return n;
  };
  const unisciDoppi = gruppo => {
    // Si tiene la scheda con più presenze; a parità, quella che ha i dati di
    // pagamento; a parità ancora, la prima.
    const ordinati = [...gruppo].sort((a, b) => {
      const d = pastiDi(b.id) - pastiDi(a.id);
      if (d) return d;
      const pa = a.paypal || a.iban ? 1 : 0;
      const pb = b.paypal || b.iban ? 1 : 0;
      return pb - pa;
    });
    const tengo = ordinati[0];
    const butto = ordinati.slice(1);
    const pasti = butto.reduce((s, m) => s + pastiDi(m.id), 0);
    if (!window.confirm(L.t('membri.confermaUnisci', tengo.name, gruppo.length, pasti))) return;

    // Le presenze delle schede scartate si SOMMANO a quelle della tenuta: chi
    // ha segnato il pranzo su una e la cena sull'altra deve ritrovarsi con
    // entrambi.
    setCampData(prev => {
      const out = {
        ...prev
      };
      Object.keys(out).forEach(d => {
        const day = out[d];
        if (!day || !day.meals) return;
        if (!butto.some(m => day.meals[m.id])) return;
        const meals = {
          ...day.meals
        };
        const base = meals[tengo.id] || {
          lunch: false,
          dinner: false
        };
        let lunch = !!base.lunch;
        let dinner = !!base.dinner;
        butto.forEach(m => {
          const v = meals[m.id];
          if (!v) return;
          lunch = lunch || !!v.lunch;
          dinner = dinner || !!v.dinner;
          delete meals[m.id];
        });
        meals[tengo.id] = {
          lunch,
          dinner
        };
        out[d] = conBlocco(day, meals);
      });
      return out;
    });

    // I campi compilati su una scheda e non sull'altra non vanno persi.
    setMembers(prev => {
      const scartati = new Set(butto.map(m => m.id));
      return prev.map(m => {
        if (m.id !== tengo.id) return m;
        const unito = {
          ...m
        };
        butto.forEach(b => {
          if (!unito.paypal && b.paypal) unito.paypal = b.paypal;
          if (!unito.iban && b.iban) unito.iban = b.iban;
          if (b.isChild) unito.isChild = true;
        });
        return unito;
      }).filter(m => !scartati.has(m.id));
    });

    // Se qualche presenza dovesse restare appesa a un id scartato, l'elenco
    // degli ex serve a poterla chiamare per nome.
    butto.forEach(m => ricordaExMembro(m.id, m.name));
  };

  // ---------- Stessa spesa registrata due volte ----------
  // Anche questa la fusione non può prevenirla: due persone che registrano lo
  // stesso carrello creano due voci nuove, entrambe legittime. Qui però ci
  // sono di mezzo i soldi — il totale si gonfia e le quote di tutti salgono —
  // quindi si segnala e basta: quale delle due buttare lo decide una persona,
  // non l'app. Sospette: stesso nome e stesso prezzo.
  const spesePotenzialmenteDoppie = () => {
    const per = new Map();
    purchases.forEach(p => {
      const k = nomeChiave(p.name) + '@' + Math.round(posNum(p.price) * 100);
      if (!nomeChiave(p.name)) return;
      per.set(k, (per.get(k) || []).concat([p]));
    });
    return [...per.values()].filter(g => g.length > 1);
  };

  // ---------- Prezzi che non tornano ----------
  // L'errore più probabile di tutti non è nella fusione né nei conti: è una
  // cifra digitata male. Un 870 al posto di 87 non fa fallire niente, si
  // spalma su tutte le quote e nessuno se ne accorge finché non si paga.
  // Si confronta con la MEDIANA delle spese già registrate (non con la media,
  // che una cifra sbagliata precedente sposterebbe da sola) e si chiede
  // conferma solo quando è davvero fuori scala: meglio zero domande inutili
  // che una domanda a ogni spesa, altrimenti si impara a rispondere sì.
  const prezzoSospetto = prezzo => {
    const p = posNum(prezzo);
    if (p <= 0) return null;
    const altri = purchases.map(x => posNum(x.price)).filter(x => x > 0).sort((a, b) => a - b);
    if (p >= 1000) return {
      p,
      mediana: altri.length ? altri[Math.floor(altri.length / 2)] : 0,
      perche: 'assoluto'
    };
    if (altri.length < 3) return null;
    const mediana = altri[Math.floor(altri.length / 2)];
    if (mediana > 0 && p >= mediana * 10 && p >= 300) return {
      p,
      mediana,
      perche: 'relativo'
    };
    return null;
  };

  // Vero se si può procedere.
  const confermaPrezzo = prezzo => {
    const s = prezzoSospetto(prezzo);
    if (!s) return true;
    return window.confirm(L.t('spesa.prezzoAlto', money(s.p), s.perche === 'relativo' ? money(s.mediana) : null));
  };
  const scartaOrfane = orfano => {
    const chi = orfano.nome ? L.t('orfane.di', orfano.nome) : L.t('orfane.senzaPadrone');
    // I giorni bloccati non si svuotano nemmeno da qui. Riattaccare una
    // presenza alla persona giusta è una riparazione e passa (non cambia CHI
    // ha mangiato); buttarla via è una perdita, e su un giorno chiuso cambia
    // le quote di tutti. Si dice quante ne restano e perché.
    const protetti = giorniBloccatiDi(orfano.id);
    if (!window.confirm(L.t('orfane.confermaButta', orfano.pasti, chi, protetti.length ? protetti.map(nomeGiorno).join(', ') : null))) return;
    setCampData(prev => {
      const out = {
        ...prev
      };
      Object.keys(out).forEach(d => {
        const day = out[d];
        if (!day || !day.meals || !day.meals[orfano.id]) return;
        if (day.bloccato && typeof day.bloccato === 'object') return;
        const meals = {
          ...day.meals
        };
        delete meals[orfano.id];
        out[d] = conBlocco(day, meals);
      });
      return out;
    });
  };

  // Nome del giorno per i messaggi di conferma.
  const nomeGiorno = ds => L.data(parseDate(ds), 'completa');

  // "Tutti a pranzo/cena" cambia le presenze di TUTTI in un colpo solo, e la
  // modifica arriva su ogni telefono: prima di farlo si chiede.
  const chiediSetAll = mealType => {
    if (members.length === 0) return;
    const pasto = L.t(mealType === 'lunch' ? 'presenze.pranzo' : 'presenze.cena').toUpperCase();
    const gia = members.every(m => getMeal(selectedDateStr, m.id)[mealType]);
    const testo = gia ? L.t('presenze.confermaTogli', pasto, members.length, nomeGiorno(selectedDateStr)) : L.t('presenze.confermaSegna', members.length, pasto, nomeGiorno(selectedDateStr));
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
    const prevMeals = campData[prevStr] && campData[prevStr].meals || {};
    if (!Object.keys(prevMeals).length) {
      window.alert(L.t('presenze.nessunaIeri'));
      return;
    }
    const conta = meals => {
      const v = Object.values(meals || {});
      return {
        p: v.filter(x => x && x.lunch).length,
        c: v.filter(x => x && x.dinner).length
      };
    };
    const ieri = conta(prevMeals);
    const oggi = conta(campData[selectedDateStr] && campData[selectedDateStr].meals || {});
    if (!window.confirm(L.t('presenze.confermaCopia', nomeGiorno(prevStr), nomeGiorno(selectedDateStr), ieri.p, ieri.c, oggi.p, oggi.c))) return;
    setCampData(prev => {
      const day = {
        ...(prev[selectedDateStr] || {})
      };
      // SOVRASCRIVE le presenze di ieri su quelle di oggi, ma non CANCELLA le
      // persone che ieri non c'erano: toglierle dall'elenco creerebbe delle
      // lapidi, e quelle lapidi cancellerebbero le stesse presenze su TUTTI i
      // telefoni, anche quelle appena segnate da qualcun altro. Chi ieri non
      // c'era resta, azzerato: visivamente è la stessa cosa, ma non distrugge
      // il lavoro degli altri.
      const meals = {};
      Object.keys(day.meals || {}).forEach(id => {
        meals[id] = {
          lunch: false,
          dinner: false
        };
      });
      Object.keys(prevMeals).forEach(id => {
        meals[id] = {
          ...prevMeals[id]
        };
      });
      return {
        ...prev,
        [selectedDateStr]: {
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
    // Due persone con lo stesso nome verrebbero trattate come una sola nei
    // saldi (i pagamenti si abbinano per nome): meglio dirlo subito.
    const gia = members.some(m => m.name.trim().toLowerCase() === name.toLowerCase());
    if (gia && !window.confirm(L.t('membri.confermaOmonimo', name))) return;
    setMembers(prev => [...prev, {
      id: uid(),
      name,
      isChild: newMemberChild
    }]);
    setNewMemberName('');
    setNewMemberChild(false);
  };
  const removeMember = id => {
    if (membroIntoccabile(id, L.t('azione.eliminarla'))) return;
    const m = members.find(x => x.id === id);
    if (m && !window.confirm(L.t('membri.confermaElimina', m.name))) return;
    // Si tiene il nome da parte: se poi qualcuno lo riaggiunge, l'app prende un
    // id nuovo e le vecchie presenze restano appese a un id che non esiste più.
    // Senza questo elenco non si saprebbe nemmeno DI CHI erano.
    ricordaExMembro(id, m && m.name);
    setMembers(prev => prev.filter(x => x.id !== id));
  };
  const toggleChild = id => {
    // Adulto o bambino cambia quanto paga tutto il campo: su un giorno
    // bloccato vale esattamente come modificare le presenze.
    if (membroIntoccabile(id, L.t('azione.adultoBambino'))) return;
    setMembers(prev => prev.map(m => m.id === id ? {
      ...m,
      isChild: !m.isChild
    } : m));
  };

  // Dati di pagamento del membro (PayPal / IBAN): campi liberi e facoltativi.
  const setMemberField = (id, campo, valore) => {
    setMembers(prev => prev.map(m => m.id === id ? {
      ...m,
      [campo]: valore
    } : m));
  };
  const copiaDato = (etichetta, valore) => {
    copyToClipboard(valore).then(ok => {
      setCopied(ok ? etichetta : '');
      if (!ok) window.alert(etichetta + ':\n\n' + valore);
    });
    window.setTimeout(() => setCopied(''), 1800);
  };

  // Esenzione dalla spesa per l'attrezzatura aggiunta.
  const toggleEquipExempt = id => {
    if (membroIntoccabile(id, "cambiare l'esenzione dall'attrezzatura")) return;
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
    setCompiti(prev => [...prev, {
      id: uid(),
      testo,
      chi: nuovoCompitoChi.trim(),
      fatto: false
    }]);
    setNuovoCompito('');
    // "chi" NON si azzera: assegnando piu' cose alla stessa persona si
    // scrivono di fila senza risceglierla ogni volta.
  };
  const removeCompito = id => {
    const c = compiti.find(x => x.id === id);
    if (c && !window.confirm(L.t('compiti.confermaTogli', c.testo))) return;
    setCompiti(prev => prev.filter(x => x.id !== id));
  };

  // Due soli stati, da fare e fatto. Un terzo ("in corso") e' la casella che
  // in ogni gestionale nessuno aggiorna mai.
  const toggleCompito = id => {
    setCompiti(prev => prev.map(x => x.id === id ? {
      ...x,
      fatto: !x.fatto
    } : x));
  };
  const setCompitoCampo = (id, campo, valore) => {
    setCompiti(prev => prev.map(x => x.id === id ? {
      ...x,
      [campo]: valore
    } : x));
  };

  // Dal compito alla spesa: facoltativo e a posteriori. Si apre la maschera
  // della Lista gia' compilata con il testo e con chi l'ha eseguito — il
  // prezzo no, quello si scopre alla cassa. Se non si fa, il compito resta
  // fatto lo stesso: registrare la spesa e' un'altra cosa.
  const daCompitoASpesa = c => {
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
    if (!MS) {
      window.alert(L.t('menu.senzaLettore'));
      return;
    }
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
    voci.forEach((_, i) => {
      scelte[i] = true;
    });
    setPropostaSpesa({
      voci,
      scelte,
      scartate: tutte.length - voci.length
    });
  };
  const confermaPropostaSpesa = () => {
    const p = propostaSpesa;
    if (!p) return;
    const prese = p.voci.filter((_, i) => p.scelte[i]);
    if (prese.length === 0) {
      setPropostaSpesa(null);
      return;
    }
    setToBuy(prev => [...prev, ...prese.map(v => ({
      id: uid(),
      name: v.nome,
      qty: v.qta
    }))]);
    setPropostaSpesa(null);
  };
  const removeToBuy = id => {
    const it = toBuy.find(x => x.id === id);
    if (it && !window.confirm(L.t('lista.confermaTogliVoce', it.name))) return;
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

  // Conferma acquisto: la voce esce dalla lista ed entra nella cronologia
  // mantenendo lo stesso id (così la foto scontrino resta collegata).
  const confirmBuy = () => {
    if (contiChiusi(L.t('azione.registrareAcquisto'))) return;
    if (!buying) return;
    const price = posNum(buying.price);
    if (price <= 0) {
      window.alert(L.t('spesa.prezzoZero'));
      return;
    }
    if (!confermaPrezzo(price)) return;
    const fullName = buying.qty ? `${buying.name} (${buying.qty})` : buying.name;
    setPurchases(prev => [...prev, {
      id: buying.id,
      name: fullName,
      price,
      type: buying.type,
      buyer: (buying.buyer || '').trim(),
      at: Date.now(),
      fromList: true,
      ...(buying.account === 'sep' && buying.type !== 'logistica' ? {
        account: 'sep'
      } : {})
    }]);
    setToBuy(prev => prev.filter(x => x.id !== buying.id));
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
    setPurchases(prev => [...prev, {
      id,
      name,
      price,
      type: pType,
      buyer: pBuyer.trim(),
      at: Date.now(),
      ...(pAccount === 'sep' && pType !== 'logistica' ? {
        account: 'sep'
      } : {})
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
    setManualOpen(false); // si richiude: la spesa appena salvata si vede in cronologia
    // Il conto NON si azzera: chi sta registrando la spesa separata di solito
    // ne inserisce più di una di fila.
  };

  // ---------- Conto separato ----------
  const toggleSepDay = dateStr => {
    if (giornoIntoccabile(dateStr, L.t('azione.contoSeparato'))) return;
    setSepDays(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort());
  };

  // ---------- Correzione di una voce già registrata ----------
  const openEditPurchase = p => setEditing({
    kind: 'purchase',
    id: p.id,
    name: p.name,
    price: String(posNum(p.price)),
    buyer: p.buyer || '',
    type: p.type || 'alimentare',
    account: p.account === 'sep' ? 'sep' : 'comune'
  });
  const openEditEquip = e => setEditing({
    kind: 'equip',
    id: e.id,
    name: e.text,
    price: String(posNum(e.price)),
    buyer: e.buyer || ''
  });
  const saveEdit = () => {
    if (!editing) return;
    if (contiChiusi(L.t('azione.modificareVoce'))) return;
    const name = (editing.name || '').trim();
    const price = posNum(editing.price);
    if (!name) {
      window.alert(L.t('spesa.nomeVuoto'));
      return;
    }
    if (editing.kind === 'purchase') {
      if (price <= 0) {
        window.alert(L.t('spesa.prezzoZero'));
        return;
      }
      if (!confermaPrezzo(price)) return;
      setPurchases(prev => prev.map(p => p.id !== editing.id ? p : {
        ...p,
        name,
        price,
        type: editing.type,
        buyer: (editing.buyer || '').trim(),
        // il conto vale solo per cibo e bevande: la logistica è sempre comune
        ...(editing.account === 'sep' && editing.type !== 'logistica' ? {
          account: 'sep'
        } : {
          account: undefined
        })
      }));
    } else {
      setEquipment(prev => prev.map(e => e.id !== editing.id ? e : {
        ...e,
        text: name,
        price,
        buyer: (editing.buyer || '').trim()
      }));
    }
    setEditing(null);
  };
  const removePurchase = id => {
    if (contiChiusi(L.t('azione.cancellareSpesa'))) return;
    const p = purchases.find(x => x.id === id);
    if (p && !window.confirm(L.t('spesa.confermaElimina', p.name, money(posNum(p.price)), !!receipts[id]))) return;
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

  // ---------- Ripristino di emergenza (snapshot giornalieri) ----------
  // Elenco dei salvataggi: PRIMA quelli dentro il telefono (ci sono sempre,
  // anche al campo senza linea), poi quelli nel cloud se si è collegati.
  const openRestore = async () => {
    const salvate = snapLocaliLeggi();
    const locali = Object.keys(salvate).sort().reverse().map(id => ({
      id,
      dove: 'locale',
      at: salvate[id] && salvate[id].at || 0
    }));
    const CS = window.CloudSync;
    let cloudIds = [];
    if (CS && CS.isConnected && CS.isConnected()) {
      try {
        cloudIds = await CS.listSnapshots();
      } catch (e) {
        cloudIds = [];
      }
    }
    const soloCloud = cloudIds.filter(id => !locali.some(l => l.id === id)).map(id => ({
      id,
      dove: 'cloud'
    }));
    const tutte = locali.concat(soloCloud).sort((a, b) => b.id.localeCompare(a.id));
    if (!tutte.length) {
      window.alert(L.t('ripristino.nessunSalvataggio'));
      return;
    }
    setSnapList(tutte);
  };
  const restoreSnapshot = async voce => {
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
    if (!json) {
      window.alert(L.t('ripristino.illeggibile'));
      return;
    }
    let d;
    try {
      d = JSON.parse(json);
    } catch (e) {
      window.alert(L.t('ripristino.nonValido'));
      return;
    }
    if (!d || typeof d !== 'object') {
      window.alert(L.t('ripristino.nonValido'));
      return;
    }
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
        c.transfers.forEach(x => lines.push(L.t('report.riga', x.from, x.to, money(x.amount))));
      }
      if (c.settlement.length > 0) {
        lines.push('');
        lines.push(L.t('report.dettaglio', titolo));
        c.settlement.forEach(s => {
          const stato = s.net > 0.005 ? L.t('report.riceve', money(s.net)) : s.net < -0.005 ? L.t('report.deveDare', money(-s.net)) : L.t('report.inPari');
          lines.push(L.t('report.rigaPersona', s.name, stato, money(s.paid), money(s.owed)));
        });
      }
    };
    // Il resoconto segue quello che si sta guardando: mandare nel gruppo un
    // elenco diverso da quello a schermo e' il modo piu' rapido di far pagare
    // due volte qualcuno.
    if (sepAttiva && saldiOttimizzati) {
      blocco({
        transfers: t.transfersOttimizzati,
        settlement: t.settlement
      }, '');
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
      t.buchi.forEach(b => lines.push(L.t('report.buco', money(b.quanto), L.t(b.perche))));
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

  // ---------- Mini gioco "Aiuta Bandy" ----------
  // Stato, classifica e partite stanno in src/75-usa-gioco.jsx.
  const {
    gamePlayer,
    setGamePlayer,
    gameRunning,
    setGameRunning,
    gameBest,
    leaderboard,
    refreshLeaderboard,
    startGame,
    endGame
  } = usaGioco({
    activeTab,
    cloudConnesso: cloud.connected
  });

  // ---------- Galleria del campo ----------
  // Stato, ascolto delle miniature, caricamento, album e PDF ricordo stanno
  // in src/76-usa-galleria.jsx. Qui resta solo cosa le si passa: la scheda
  // aperta e la linea (per sapere quando ascoltare) e i giorni del campo
  // (per il sottotitolo dell'album).
  const {
    photos,
    photosReady,
    photoWho,
    setPhotoWho,
    photoBusy,
    viewPhoto,
    setViewPhoto,
    album,
    setAlbum,
    galleryView,
    setGalleryView,
    albumPage,
    albumRef,
    picking,
    setPicking,
    picked,
    setPicked,
    pdfBusy,
    photoCap,
    setPhotoCap,
    photosBy,
    addPhotos,
    openPhoto,
    removePhoto,
    openAlbum,
    PER_PAGINA_ALBUM,
    paginaAlbum,
    sfoglia,
    onScrollAlbum,
    togglePicked,
    uscitaScelta,
    generaRicordo,
    soloNome
  } = usaGalleria({
    activeTab,
    cloudConnesso: cloud.connected,
    campData
  });

  // ---------- Rimborsi saldati (barrati) ----------
  const toggleSettled = key => {
    setSettled(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // ---------- Aggiunta attrezzatura ----------
  const addEquip = () => {
    const text = newEquipText.trim();
    if (!text) return;
    if (contiChiusi(L.t('azione.aggiungereAttrezzatura'))) return;
    if (!confermaPrezzo(newEquipPrice)) return;
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
    if (contiChiusi(L.t('azione.attrezzaturaAcquistata'))) return;
    setEquipment(prev => prev.map(e => e.id === id ? {
      ...e,
      bought: !e.bought
    } : e));
  };
  const removeEquip = id => {
    const e = equipment.find(x => x.id === id);
    if (e && !window.confirm(L.t('attrezzatura.confermaElimina', e.text))) return;
    if (contiChiusi(L.t('azione.cancellareAttrezzatura'))) return;
    setEquipment(prev => prev.filter(x => x.id !== id));
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
    if (g && !window.confirm(L.t('dotazioni.confermaElimina', g.text))) return;
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

  // Striscia dei giorni: la stessa in Calendario e in Menù, così il giorno
  // scelto in una scheda è già scelto anche nell'altra.
  const renderWeekStrip = () => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => changeWeek(-7),
    "aria-label": L.t('settimana.precedente'),
    className: bottoneIcona('tenue')
  }, "\u2190"), /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-normale text-[#2D392C] uppercase font-rustic"
  }, L.t('settimana.selezionata')), /*#__PURE__*/React.createElement("button", {
    onClick: () => changeWeek(7),
    "aria-label": L.t('settimana.successiva'),
    className: bottoneIcona('tenue')
  }, "\u2192")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-7 gap-1"
  }, weekDays.map(d => {
    const dateStr = toDateStr(d);
    const isSelected = dateStr === selectedDateStr;
    const isCampPeriod = dateStr >= CAMP_START && dateStr <= CAMP_END;
    const label = L.data(d, 'settimanaSola');
    return /*#__PURE__*/React.createElement("button", {
      key: dateStr,
      onClick: () => {
        setSelectedDateStr(dateStr);
        setCurrentDate(new Date(d));
      },
      className: `p-2 flex flex-col items-center rounded-lg border transition-all ${isSelected ? 'bg-[#5C4A3C] text-white border-[#5C4A3C]' : isCampPeriod ? 'bg-[#2D392C]/10 text-[#2D392C] border-[#2D392C]' : 'bg-white text-gray-400 border-gray-200'}`
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-piccolo uppercase font-bold"
    }, label), /*#__PURE__*/React.createElement("span", {
      className: "text-grande font-bold font-rustic"
    }, d.getDate()), isCampPeriod && /*#__PURE__*/React.createElement("span", {
      className: "w-1.5 h-1.5 bg-[#D97706] rounded-full mt-0.5"
    }));
  })));

  // ---------- Calcolo ripartizione (coerente: somma quote = totale) ----------
  // ---------- I conti ----------
  // Stanno in conti.js, fuori da src/: sono una funzione pura di sei cose e
  // vanno provati sui numeri veri di un campo vero, con una prova unitaria,
  // invece che leggendo cifre a schermo. Qui resta solo cosa gli si passa.
  const totals = Conti.calcola({
    members,
    campData,
    purchases,
    equipment,
    sepDays,
    freeDays,
    equipExemption: FEATURES.equipExemption
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
  const chiaveRimborso = t => `${t.cassa === 'separata' ? 'sep:' : t.cassa === 'tutte' ? 'opt:' : ''}${t.from}→${t.to}@${Math.round(t.amount * 100)}`;

  // La vista dei passaggi ottimizzati: le due casse messe insieme. Riusa i
  // saldi complessivi, che sono gia' la somma delle due.
  const cassaUnica = {
    settlement: totals.settlement,
    transfers: totals.transfersOttimizzati,
    byBuyer: totals.byBuyer,
    unattributed: totals.unattributed,
    unknownBuyers: totals.unknownBuyers
  };
  // Quanti bonifici si risparmiano davvero: se non se ne risparmia nessuno il
  // tasto non serve e non si mostra.
  const risparmio = totals.transfers.length - totals.transfersOttimizzati.length;

  // Scheda delle quote di UNA cassa. Scritta una volta e usata due volte: se
  // le due casse si mostrassero con codice diverso, prima o poi direbbero le
  // stesse cose in due modi diversi.
  const schedaQuote = c => /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
  }, c.titolo), c.sottotitolo && /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-gray-500 leading-snug mb-2"
  }, c.sottotitolo), c.avviso && /*#__PURE__*/React.createElement("div", {
    className: "mb-3 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, c.avviso)), c.elenco.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-normale text-gray-400 italic"
  }, c.vuoto || L.t('quote.vuoto')) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("ul", {
    className: "divide-y divide-[#8F9E8B]/20"
  }, c.elenco.map(b => /*#__PURE__*/React.createElement("li", {
    key: b.id,
    className: "flex items-center justify-between py-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-normale font-bold text-[#2D392C]"
  }, b.name), /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo text-gray-500"
  }, L.t('quote.pastiRiga', c.pastiDi(b), b.mealsGratis, b.isChild))), /*#__PURE__*/React.createElement("span", {
    className: `font-rustic font-bold ${b.isChild ? 'text-gray-400' : 'text-[#2D392C]'}`
  }, b.isChild ? L.t('quote.gratis') : `${money(c.quotaDi(b))} €`)))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center pt-2 mt-1 border-t border-[#8F9E8B]/30"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo uppercase font-bold text-gray-500"
  }, L.t('quote.totaleRaccolto')), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C]"
  }, money(c.raccolto), " \u20AC")), /*#__PURE__*/React.createElement("p", {
    className: "text-minuto text-gray-400 italic mt-2"
  }, L.t('quote.arrotondamento', Math.abs(c.scarto) >= 0.005 ? `${c.scarto > 0 ? '+' : ''}${money(c.scarto)}` : null))), c.nonRipartito > 0.005 && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5 mt-2"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('quote.nonRipartito', money(c.nonRipartito), money(c.totale), money(c.raccolto))), /*#__PURE__*/React.createElement("ul", {
    className: "mt-1.5 space-y-1"
  }, c.buchi.map(b => /*#__PURE__*/React.createElement("li", {
    key: b.perche,
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('quote.buco', money(b.quanto), L.t(b.perche))))), /*#__PURE__*/React.createElement("p", {
    className: "text-minuto text-gray-500 italic mt-1.5 leading-snug"
  }, L.t('quote.siSistema'))));

  // Scheda dei saldi di UNA cassa: chi ha anticipato, chi deve, chi paga chi.
  // Le tre cose stanno insieme perché insieme si leggono: separarle
  // costringerebbe a saltare avanti e indietro per capire un rimborso.
  const schedaSaldi = c => {
    const s = c.cassa;
    return /*#__PURE__*/React.createElement("div", {
      className: "bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md"
    }, /*#__PURE__*/React.createElement("h3", {
      className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 mb-3"
    }, c.titolo), c.sottotitolo && /*#__PURE__*/React.createElement("p", {
      className: "text-minuto text-[#8F9E8B] leading-snug mb-3"
    }, c.sottotitolo), s.byBuyer.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "mb-3 pb-3 border-b border-[#8F9E8B]/30"
    }, /*#__PURE__*/React.createElement("h4", {
      className: "font-rustic text-normale text-[#8F9E8B] mb-1"
    }, L.t('saldi.anticipiPerAcquirente')), /*#__PURE__*/React.createElement("ul", {
      className: "divide-y divide-[#8F9E8B]/20"
    }, s.byBuyer.map(b => /*#__PURE__*/React.createElement("li", {
      key: b.name,
      className: "flex items-center justify-between py-1.5"
    }, /*#__PURE__*/React.createElement("span", {
      className: `text-piccolo font-bold ${b.name === '—' ? 'text-gray-400 italic' : ''}`
    }, b.name === '—' ? L.t('saldi.nonIndicato') : b.name), /*#__PURE__*/React.createElement("span", {
      className: "font-rustic font-bold text-normale"
    }, money(b.total), " \u20AC"))))), s.settlement.length === 0 ? /*#__PURE__*/React.createElement("p", {
      className: "text-normale text-gray-400 italic"
    }, c.vuoto || L.t('saldi.vuoto')) : /*#__PURE__*/React.createElement("ul", {
      className: "divide-y divide-[#8F9E8B]/20"
    }, s.settlement.map(x => {
      const credito = x.net > 0.005;
      const debito = x.net < -0.005;
      return /*#__PURE__*/React.createElement("li", {
        key: x.name,
        className: "flex items-center justify-between py-2 gap-2"
      }, /*#__PURE__*/React.createElement("div", {
        className: "flex flex-col min-w-0"
      }, /*#__PURE__*/React.createElement("span", {
        className: "text-normale font-bold truncate"
      }, x.name), /*#__PURE__*/React.createElement("span", {
        className: "text-minuto text-[#8F9E8B]"
      }, L.t('saldi.haAnticipatoDeve', money(x.paid), money(x.owed)))), /*#__PURE__*/React.createElement("span", {
        className: `font-rustic font-bold text-normale shrink-0 text-right ${credito ? 'text-[#8FBF8F]' : debito ? 'text-[#D97706]' : 'text-gray-400'}`
      }, credito ? L.t('saldi.riceve', money(x.net)) : debito ? L.t('saldi.da', money(-x.net)) : L.t('saldi.inPari')));
    })), s.transfers.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "mt-3 pt-3 border-t border-[#8F9E8B]/30"
    }, /*#__PURE__*/React.createElement("h4", {
      className: "font-rustic text-normale text-[#8F9E8B] mb-1"
    }, L.t('saldi.chiPagaChi')), /*#__PURE__*/React.createElement("p", {
      className: "text-minuto text-gray-400 mb-2"
    }, L.t('saldi.toccaRiga')), /*#__PURE__*/React.createElement("ul", {
      className: "space-y-1.5"
    }, s.transfers.map((t, i) => {
      const key = chiaveRimborso(t);
      const paid = settled.includes(key);
      // Dati di pagamento di chi deve ricevere (scheda Membri, tasto "i").
      const dest = members.find(m => m.name === t.to);
      const mostraDati = !paid && dest && (dest.paypal || dest.iban);
      return /*#__PURE__*/React.createElement("li", {
        key: key + i,
        onClick: () => toggleSettled(key),
        className: `cursor-pointer select-none bg-[#1F271E] px-3 py-2 rounded border transition-opacity ${paid ? 'border-[#8FBF8F]/40 opacity-60' : 'border-[#8F9E8B]/20'}`
      }, /*#__PURE__*/React.createElement("div", {
        className: "flex items-center justify-between"
      }, /*#__PURE__*/React.createElement("span", {
        className: `text-piccolo ${paid ? 'line-through text-gray-400' : ''}`
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
        className: "text-[#8FBF8F] text-normale font-bold"
      }, "\u2713"))), mostraDati && /*#__PURE__*/React.createElement("div", {
        className: "mt-1.5 pt-1.5 border-t border-[#8F9E8B]/20 space-y-1"
      }, [['PayPal', dest.paypal], ['IBAN', dest.iban]].filter(r => r[1]).map(r => /*#__PURE__*/React.createElement("div", {
        key: r[0],
        className: "flex items-start gap-2"
      }, /*#__PURE__*/React.createElement("span", {
        className: "text-minuto uppercase font-bold text-[#8F9E8B] w-11 shrink-0 pt-0.5"
      }, r[0]), /*#__PURE__*/React.createElement("span", {
        className: `text-piccolo text-[#F0F4F1] break-all leading-snug ${r[0] === 'IBAN' ? 'font-mono' : ''}`
      }, r[1]), /*#__PURE__*/React.createElement("button", {
        onClick: e => {
          e.stopPropagation();
          copiaDato(`${r[0]} di ${t.to}`, r[1]);
        },
        className: "ml-auto shrink-0 text-minuto uppercase font-bold px-2 py-1 rounded bg-[#2D392C] border border-[#8F9E8B]/30 text-[#8F9E8B] hover:text-white"
      }, L.t(copied === `${r[0]} di ${t.to}` ? 'saldi.copiato' : 'saldi.copia'))))));
    })), (() => {
      const senza = [...new Set(s.transfers.map(t => t.to))].filter(n => {
        const d = members.find(m => m.name === n);
        return d && !d.paypal && !d.iban;
      });
      if (senza.length === 0) return null;
      return /*#__PURE__*/React.createElement("p", {
        className: "text-minuto text-gray-400 italic mt-2"
      }, frase('saldi.senzaDati', senza.join(', '), senza.length === 1));
    })()), s.unattributed > 0.005 && /*#__PURE__*/React.createElement("p", {
      className: "text-minuto text-[#D97706] italic mt-2"
    }, L.t('saldi.senzaAcquirente', money(s.unattributed))), c.nonRipartito > 0.005 && /*#__PURE__*/React.createElement("div", {
      className: "mt-2 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5"
    }, /*#__PURE__*/React.createElement("p", {
      className: "text-piccolo text-[#5C4A3C] leading-snug"
    }, frase('saldi.nonQuadrano', money(c.nonRipartito)))), s.unknownBuyers.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "mt-2 bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5"
    }, /*#__PURE__*/React.createElement("p", {
      className: "text-piccolo text-[#5C4A3C] leading-snug"
    }, frase('saldi.daControllareTesta'), ' ', s.unknownBuyers.map((u, i) => /*#__PURE__*/React.createElement("span", {
      key: u.name
    }, i > 0 ? ', ' : '', /*#__PURE__*/React.createElement("span", {
      className: "font-bold"
    }, u.name), " (", money(u.paid), " \u20AC)")), frase('saldi.daControllareCoda', s.unknownBuyers.length === 1))), Math.abs(c.scarto) >= 0.005 && s.transfers.length > 0 && /*#__PURE__*/React.createElement("p", {
      className: "text-minuto text-gray-400 italic mt-2"
    }, L.t('saldi.arrotondamento', money(Math.abs(c.scarto)))), /*#__PURE__*/React.createElement("p", {
      className: "text-minuto text-gray-400 italic mt-1"
    }, L.t('saldi.legenda')));
  };

  // ---------- Backup (Export / Import) ----------
  const downloadJson = (filename, payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const exportData = () => {
    downloadJson(`bandone-backup-${toDateStr(new Date())}.json`, {
      version: 6,
      exportedAt: new Date().toISOString(),
      members,
      campData,
      purchases,
      gear,
      settled,
      equipment,
      toBuy,
      sepDays,
      freeDays,
      blocchi,
      compiti,
      receipts
    });
    // Serve al promemoria serale per sapere che oggi è già stato fatto.
    try {
      localStorage.setItem(BACKUP_KEY, toDateStr(new Date()));
    } catch (e) {/* niente */}
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
    if (oggi < CAMP_START || oggi > CAMP_END) return null; // solo durante il campo
    if (new Date().getHours() < 20) return null; // solo di sera
    if (backupOggi === oggi) return null; // già fatto (o rimandato)
    // "Qualcosa da salvare" = modifiche fatte OGGI su QUESTO telefono.
    const inizio = parseDate(oggi).getTime();
    const modifiche = logLeggi().filter(r => r.o === 'io' && r.at >= inizio).length;
    if (modifiche === 0) return null;
    return modifiche;
  };
  const importData = e => {
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
        const eta = quando && !isNaN(quando.getTime()) ? L.t('import.backupDel', L.data(quando, 'dataOra')) : L.t('import.senzaData');
        const dentro = L.t('import.contiene', (d.members || []).length, (d.purchases || []).length, Object.keys(d.campData || {}).length);
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
    const unpaid = daPagare.filter(x => !settled.includes(chiaveRimborso(x)));
    const warn = unpaid.length > 0 ? L.t('campo.rimborsiAperti', unpaid.length) : '';
    if (!window.confirm(L.t('campo.confermaChiusura', name, money(t.overallTotal), members.length, warn))) return;
    const id = toDateStr(new Date()) + '-' + uid();
    const state = {
      members,
      campData,
      purchases,
      gear,
      settled,
      equipment,
      toBuy,
      sepDays,
      freeDays
    };
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
        adults: members.filter(m => !m.isChild).length,
        meals: t.adultMealsTotal,
        purchases: purchases.length
      }
    };
    const CS = window.CloudSync;
    const online = !!(CS && CS.isConnected && CS.isConnected());

    // 1) Galleria: le foto non si buttano, si timbrano con questo archivio.
    //    Restano consultabili dall'Archivio e il campo nuovo riparte vuoto.
    if (online && CS.archivePhotos) meta.photos = await CS.archivePhotos(id);

    // 2) Copia su file (l'unica che contiene anche le foto degli scontrini).
    downloadJson(`bandone-archivio-${toDateStr(new Date())}.json`, {
      version: 6,
      archive: meta,
      ...state,
      receipts
    });

    // 3) Copia nel cloud, visibile anche dagli altri dispositivi.
    let cloudOk = false;
    if (online) {
      cloudOk = await CS.putArchive(id, meta, state);
      Object.keys(receipts).forEach(rid => CS.deleteReceipt(rid));
    }

    // 4) Copia locale (senza foto, per non riempire la memoria del telefono).
    setArchives(prev => [{
      ...meta,
      state,
      cloud: cloudOk
    }, ...prev]);

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
  const downloadArchive = async a => {
    let state = a.state;
    if (!state) {
      const CS = window.CloudSync;
      if (CS && CS.isConnected && CS.isConnected()) state = await CS.getArchive(a.id);
      if (!state) {
        window.alert(L.t('archivio.serveLinea'));
        return;
      }
    }
    downloadJson(`bandone-archivio-${a.id}.json`, {
      version: 6,
      archive: a,
      ...state
    });
  };
  const removeArchive = a => {
    if (!window.confirm(L.t('archivio.confermaElimina', a.name))) return;
    setArchives(prev => prev.filter(x => x.id !== a.id));
    const CS = window.CloudSync;
    if (CS && CS.deleteArchive) CS.deleteArchive(a.id);
  };
  const shareArchive = async a => {
    const text = a.report || '';
    if (!text) {
      window.alert(L.t('archivio.senzaResoconto'));
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: a.name,
          text
        });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };

  // ---------- Pronto per il campo ----------
  // A Prato Lungo non c'è linea: chi apre l'app per la prima volta lassù non
  // ha né l'app in cache né i dati. Questi tre controlli dicono, PRIMA di
  // partire, se il telefono è a posto.
  const [readiness, setReadiness] = useState({
    sw: false,
    cache: false
  });
  useEffect(() => {
    let vivo = true;
    const controlla = async () => {
      const sw = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
      let cache = false;
      try {
        if (window.caches) {
          const keys = await window.caches.keys();
          cache = keys.some(k => k.indexOf('brigata-bandone-') === 0);
        }
      } catch (e) {/* niente cache: resta false */}
      if (vivo) setReadiness({
        sw,
        cache
      });
    };
    controlla();
    const id = setInterval(controlla, 5000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  // Un campo c'e' quando c'e' qualcosa dentro. Serve in due posti che devono
  // dire la stessa cosa: "chiudi il campo" (non si chiude il vuoto) e i
  // controlli qui sotto (non si e' pronti per un campo che non c'e').
  const campoInCorso = members.length > 0 || purchases.length > 0 || toBuy.length > 0 || equipment.length > 0;
  const readyChecks = [{
    ok: readiness.sw && readiness.cache,
    titolo: L.t('pronto.appScaricata'),
    no: L.t('pronto.appScaricataNo')
  }, {
    ok: members.length > 0,
    titolo: L.t('pronto.datiRicevuti'),
    no: L.t('pronto.datiRicevutiNo')
  },
  // Si segnala SOLO un ripiego accertato: 'anon' è anche il valore di
  // partenza, prima ancora di provare a collegarsi, e farebbe lampeggiare
  // un allarme falso a ogni avvio.
  {
    ok: !(LOCK && LOCK.dbEmail && (cloud.authMode === 'anon-nopass' || cloud.authMode === 'anon-fallback')),
    titolo: L.t('pronto.accessoDb'),
    no: L.t('pronto.accessoDbNo')
  }];
  const readyOk = readyChecks.every(c => c.ok);

  // ---------- Impostazioni: dati locali ----------
  // Versione installata, letta dal nome della cache del service worker.
  const [swVersion, setSwVersion] = useState('');
  useEffect(() => {
    if (!window.caches) return;
    window.caches.keys().then(keys => {
      const k = keys.find(x => x.indexOf('brigata-bandone-') === 0);
      if (k) setSwVersion(k.replace('brigata-bandone-', ''));
    }).catch(() => {});
  }, []);

  // Svuota questo telefono. I dati nel cloud NON vengono toccati: alla
  // riapertura, se c'è linea, tornano da soli.
  const wipeLocal = () => {
    if (!window.confirm(L.t('dati.confermaCancella'))) return;
    if (!window.confirm(L.t('dati.confermaCancella2'))) return;
    try {
      Object.keys(localStorage).filter(k => k.indexOf('cambusa_') === 0).forEach(k => localStorage.removeItem(k));
      sessionStorage.removeItem(UNLOCK_KEY);
    } catch (e) {/* ignora */}
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
    CS.listArchives().then(remote => {
      if (!Array.isArray(remote) || !remote.length) return;
      setArchives(prev => {
        const have = new Set(prev.map(a => a.id));
        const add = remote.filter(a => !have.has(a.id));
        if (!add.length) return prev;
        return [...prev, ...add].sort((a, b) => String(b.closedAt || '').localeCompare(String(a.closedAt || '')));
      });
    }).catch(() => {});
  }, [activeTab, cloud.connected]);

  // ---------- Render ----------
  // Il blocco viene prima di tutto: senza password non si vede nulla.
  if (locked) return /*#__PURE__*/React.createElement(LockScreen, {
    reason: lockReason,
    onUnlock: () => {
      setLockReason('');
      setLocked(false);
    }
  });
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
      className: "font-rustic text-titolo tracking-widest text-[#8F9E8B]"
    }, BRAND.splashLine1), /*#__PURE__*/React.createElement("h2", {
      className: "font-rustic text-titolo tracking-widest text-[#F0F4F1]"
    }, BRAND.splashLine2), /*#__PURE__*/React.createElement("p", {
      className: "mt-4 text-piccolo uppercase tracking-widest opacity-60"
    }, BRAND.splashTagline), /*#__PURE__*/React.createElement("p", {
      className: "absolute bottom-4 left-0 right-0 text-center text-minuto tracking-wide text-[#8F9E8B]/70 px-6"
    }, BRAND.credits));
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
    impostazioni: L.t('area.impostazioni')
  };

  // Icona per ogni area: nel menu aiuta a trovare la voce senza leggerle tutte.
  const TAB_ICONS = {
    calendario: '📅',
    menu: '🍝',
    presenze: '🍽️',
    compiti: '✅',
    lista: '🧾',
    attrezzatura: '🪛',
    spesa: '💶',
    membri: '👥',
    regole: '📜',
    dotazioni: '🎒',
    galleria: '📸',
    gioco: '🎮',
    archivio: '🗄️',
    guida: '❓',
    impostazioni: '⚙️'
  };

  // Il menu raggruppa le aree per momento d'uso: prima quello che si tocca
  // ogni giorno, poi i soldi, poi le cose del gruppo, in fondo il resto.
  const MENU_GROUPS = [{
    title: L.t('menu.pianificazione'),
    items: ['calendario', 'menu', 'presenze']
  },
  // "Chi fa cosa" viene PRIMA della lista, ed e' l'ordine dei fatti: ci si
  // divide i compiti, poi si compra, poi si registra la spesa.
  {
    title: L.t('menu.spese'),
    items: [...(FEATURES.compiti ? ['compiti'] : []), 'lista', 'attrezzatura', 'spesa']
  }, {
    title: L.t('menu.gruppo'),
    items: ['membri', 'regole', 'dotazioni', 'galleria']
  }, {
    title: L.t('menu.altro'),
    items: ['gioco', 'archivio', 'guida', 'impostazioni']
  }];

  // Acquirente: si sceglie dai membri, non si scrive. Un nome digitato a mano
  // con una lettera diversa creerebbe una persona fantasma nei saldi finali.
  const renderBuyerSelect = (value, onChange, extraClass) => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("select", {
    value: value || '',
    onChange: e => onChange(e.target.value),
    className: `w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C] ${extraClass || ''}`
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, L.t('acquirente.nonIndicato')), members.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.id,
    value: m.name
  }, m.name)), value && !members.some(m => m.name === value) && /*#__PURE__*/React.createElement("option", {
    value: value
  }, L.t('acquirente.nonPiuMembro', value))), members.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "text-minuto text-[#D97706] mt-1"
  }, L.t('galleria.primaMembri')));
  const goTo = tab => {
    setActiveTab(tab);
    setMenuOpen(false);
  };

  // Guida: una "pill" per ogni area di lavoro.
  // I testi stanno in lingue.js: qui restano la chiave e l'icona. GUIDE e'
  // una const DENTRO App(), quindi si ricostruisce a ogni disegno e la
  // lingua la segue (una const di modulo invece la congelerebbe).
  const GUIDE = [{
    k: 'calendario',
    icon: '📅',
    title: L.t('guida.calendario.titolo'),
    body: L.t('guida.calendario.corpo')
  }, {
    k: 'menu',
    icon: '🍝',
    title: L.t('guida.menu.titolo'),
    body: L.t('guida.menu.corpo')
  }, {
    k: 'membri',
    icon: '👥',
    title: L.t('guida.membri.titolo'),
    body: L.t('guida.membri.corpo')
  }, {
    k: 'presenze',
    icon: '🍽️',
    title: L.t('guida.presenze.titolo'),
    body: L.t('guida.presenze.corpo')
  }, {
    k: 'compiti',
    icon: '✅',
    title: L.t('guida.compiti.titolo'),
    body: L.t('guida.compiti.corpo')
  }, {
    k: 'lista',
    icon: '🧾',
    title: L.t('guida.lista.titolo'),
    body: L.t('guida.lista.corpo')
  }, {
    k: 'attrezzatura',
    icon: '🪛',
    title: L.t('guida.attrezzatura.titolo'),
    body: L.t('guida.attrezzatura.corpo')
  }, {
    k: 'spesa',
    icon: '💶',
    title: L.t('guida.spesa.titolo'),
    body: L.t('guida.spesa.corpo')
  }, {
    k: 'conti',
    icon: '⚖️',
    title: L.t('guida.conti.titolo'),
    body: L.t('guida.conti.corpo')
  }, {
    k: 'separato',
    icon: '🍽️',
    title: L.t('guida.separato.titolo'),
    body: L.t('guida.separato.corpo')
  }, {
    k: 'saldi',
    icon: '🤝',
    title: L.t('guida.saldi.titolo'),
    body: L.t('guida.saldi.corpo')
  }, {
    k: 'dotazioni',
    icon: '🎒',
    title: L.t('guida.dotazioni.titolo'),
    body: L.t('guida.dotazioni.corpo')
  }, {
    k: 'backup',
    icon: '🛟',
    title: L.t('guida.backup.titolo'),
    body: L.t('guida.backup.corpo')
  }, {
    k: 'sync',
    icon: '☁️',
    title: L.t('guida.sync.titolo'),
    body: L.t('guida.sync.corpo')
  }, {
    k: 'chiusura',
    icon: '🏁',
    title: L.t('guida.chiusura.titolo'),
    body: L.t('guida.chiusura.corpo')
  }, {
    k: 'galleria',
    icon: '📸',
    title: L.t('guida.galleria.titolo'),
    body: L.t('guida.galleria.corpo')
  }, {
    k: 'gioco',
    icon: '🎮',
    title: L.t('guida.gioco.titolo'),
    body: L.t('guida.gioco.corpo', LEVEL_EVERY)
  }, {
    k: 'impostazioni',
    icon: '⚙️',
    title: L.t('guida.impostazioni.titolo'),
    body: L.t('guida.impostazioni.corpo')
  }, {
    k: 'pronto',
    icon: '🎒',
    title: L.t('guida.pronto.titolo'),
    body: L.t('guida.pronto.corpo')
  }, {
    k: 'correggi',
    icon: '✏️',
    title: L.t('guida.correggi.titolo'),
    body: L.t('guida.correggi.corpo')
  }, {
    k: 'installa',
    icon: '📲',
    title: L.t('guida.installa.titolo'),
    body: L.t('guida.installa.corpo')
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
    className: "font-rustic text-titolo tracking-wide"
  }, BRAND.appTitle), /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo uppercase tracking-wider text-[#8F9E8B]"
  }, tabs[activeTab]), (() => {
    const foto = cloud.foto || 0;
    const sospeso = !!cloud.pending || foto > 0;
    const testo = sospeso ? foto > 0 ? L.t('spia.fotoDaInviare', foto) : L.t('spia.daInviare') : L.t(isOnline ? 'spia.online' : 'spia.offline');
    const colore = sospeso ? 'text-[#F6C177]' : isOnline ? 'text-[#8F9E8B]' : 'text-[#D97706]';
    const pallino = sospeso ? 'bg-[#F6C177] animate-pulse' : isOnline ? 'bg-[#8F9E8B]' : 'bg-[#D97706]';
    return /*#__PURE__*/React.createElement("span", {
      title: sospeso ? L.t('spia.sospeso') : testo,
      className: `absolute top-3 right-3 flex items-center gap-1 text-minuto uppercase font-bold ${colore}`
    }, /*#__PURE__*/React.createElement("span", {
      className: `w-2 h-2 rounded-full ${pallino}`
    }), testo);
  })()), /*#__PURE__*/React.createElement("div", {
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
    className: "text-minuto uppercase tracking-wider text-[#8F9E8B]"
  }, BRAND.groupName))), MENU_GROUPS.map(group => /*#__PURE__*/React.createElement("div", {
    key: group.title,
    className: "pt-2 first:pt-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 px-1 pb-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-minuto uppercase tracking-widest font-bold text-[#8F9E8B] shrink-0"
  }, group.title), /*#__PURE__*/React.createElement("span", {
    className: "flex-grow h-px bg-[#8F9E8B]/30"
  })), group.items.map(tab => /*#__PURE__*/React.createElement("button", {
    key: tab,
    onClick: () => goTo(tab),
    className: `w-full text-left px-3 py-2.5 rounded font-bold uppercase text-normale tracking-wide transition-colors flex items-center gap-2.5 ${activeTab === tab ? 'bg-[#2D392C] text-[#F0F4F1]' : 'text-[#2D392C] hover:bg-[#E2EAE4]'}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-medio leading-none w-5 text-center shrink-0"
  }, TAB_ICONS[tab]), /*#__PURE__*/React.createElement("span", {
    className: "min-w-0 truncate"
  }, tabs[tab])))))))), showInstallHint && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/15 border-b border-[#D97706]/40 px-4 py-2.5 flex items-start gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-medio leading-none mt-0.5"
  }, "\uD83D\uDCF2"), /*#__PURE__*/React.createElement("p", {
    className: "flex-grow text-piccolo text-[#5C4A3C] leading-snug"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, L.t(isDesktop ? 'installa.computer' : 'installa.telefono')), ' ', L.t(isIOS ? 'installa.ios' : isDesktop ? 'installa.desktop' : 'installa.android'), ' ', L.t('installa.poi')), /*#__PURE__*/React.createElement("button", {
    onClick: dismissInstallHint,
    "aria-label": L.t('installa.chiudi'),
    className: bottoneIcona('neutro', 'shrink-0')
  }, "\xD7")), (() => {
    if (!admin) return null;
    const modifiche = promemoriaBackup();
    if (!modifiche) return null;
    return /*#__PURE__*/React.createElement("div", {
      className: "bg-[#5C4A3C]/12 border-y-2 border-[#5C4A3C]/40 px-4 py-3"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-start gap-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-medio leading-none mt-0.5"
    }, "\uD83C\uDF92"), /*#__PURE__*/React.createElement("div", {
      className: "min-w-0 flex-grow"
    }, /*#__PURE__*/React.createElement("p", {
      className: "text-piccolo text-[#5C4A3C] leading-snug"
    }, frase('backup.fineGiornata', modifiche)), /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2 mt-2"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: exportData,
      className: bottone('bruno', 'minuscolo')
    }, L.t('backup.salva')), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        const oggi = toDateStr(new Date());
        try {
          localStorage.setItem(BACKUP_KEY, oggi);
        } catch (e) {/* niente */}
        setBackupOggi(oggi);
      },
      className: bottone('secondario', 'minuscolo')
    }, L.t('backup.giaFatto'))))));
  })(), spazioPieno && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/15 border-y-2 border-[#D97706]/50 px-4 py-3"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('spazio.pieno'), admin && /*#__PURE__*/React.createElement(React.Fragment, null, frase('spazio.dettaglio')))), membriSalvati.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/15 border-y-2 border-[#D97706]/50 px-4 py-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-medio leading-none mt-0.5"
  }, "\uD83D\uDD12"), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0 flex-grow"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('membriSalvati.avviso', membriSalvati.length, membriSalvati.length === 1 ? membriSalvati[0] : `${membriSalvati.slice(0, 4).join(', ')}${membriSalvati.length > 4 ? '…' : ''}`)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setMembriSalvati([]),
    className: bottone('secondario', 'minuscolo', 'mt-2')
  }, L.t('avviso.hoCapito'))))), respinte.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/15 border-y-2 border-[#D97706]/50 px-4 py-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-medio leading-none mt-0.5"
  }, "\uD83D\uDD12"), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0 flex-grow"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('respinte.testa', respinte.length), ' ', respinte.slice(0, 3).map((r, i) => /*#__PURE__*/React.createElement("span", {
    key: r.che + r.nome + i
  }, i > 0 ? ' · ' : '', L.t('respinte.riga', L.t(r.che), r.nome, L.t(r.azione), money(r.quanto)))), respinte.length > 3 ? L.t('respinte.altre', respinte.length - 3) : '', ".", ' ', frase('respinte.coda')), /*#__PURE__*/React.createElement("button", {
    onClick: () => setRespinte([]),
    className: bottone('secondario', 'minuscolo', 'mt-2')
  }, L.t('avviso.hoCapito'))))), admin && orologioFuori && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/15 border-y-2 border-[#D97706]/50 px-4 py-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-medio leading-none mt-0.5"
  }, "\uD83D\uDD50"), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0 flex-grow"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('orologio.avviso', Math.round(orologioFuori.avanti / 86400000))), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setOrologioFuori(null);
      try {
        localStorage.removeItem(OROLOGIO_KEY);
      } catch (e) {/* niente */}
    },
    className: bottone('secondario', 'minuscolo', 'mt-2')
  }, L.t('orologio.sistemato'))))), admin && lostSync && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/15 border-y-2 border-[#D97706]/50 px-4 py-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-medio leading-none mt-0.5"
  }, "\u26A0\uFE0F"), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0 flex-grow"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('perdita.avviso', lostSync.n, lostSync.quando ? L.data(new Date(lostSync.quando), 'dataOraBreve') : null, lostSync.che || null)), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mt-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: annullaSync,
    className: bottone('avviso', 'minuscolo')
  }, L.t('perdita.annulla')), /*#__PURE__*/React.createElement("button", {
    onClick: () => setLostSync(null),
    className: bottone('secondario', 'minuscolo')
  }, L.t('perdita.vaBene')))))), /*#__PURE__*/React.createElement("main", {
    className: "flex-grow p-4"
  }, activeTab === 'calendario' && schedaCalendario({
    admin,
    campoInCorso,
    fetchWeather,
    getDayData,
    getMeal,
    goTo,
    isOnline,
    members,
    presenzeOrfane,
    readyOk,
    renderWeekStrip,
    selectedDateStr,
    sepDays,
    sepOpen,
    setSepOpen,
    toggleSepDay,
    updateDayData,
    weather,
    weekDays,
    wxBusy
  }), activeTab === 'menu' && schedaMenu({
    confermaPropostaSpesa,
    getDayData,
    getMeal,
    members,
    proponiDalMenu,
    propostaSpesa,
    renderWeekStrip,
    selectedDateStr,
    setCurrentDate,
    setPropostaSpesa,
    setSelectedDateStr,
    toBuy,
    updateDayData
  }), activeTab === 'compiti' && FEATURES.compiti && schedaCompiti({
    addCompito,
    compiti,
    daCompitoASpesa,
    members,
    nuovoCompito,
    nuovoCompitoChi,
    removeCompito,
    renderBuyerSelect,
    setCompitoCampo,
    setNuovoCompito,
    setNuovoCompitoChi,
    toggleCompito
  }), activeTab === 'membri' && schedaMembri({
    addMember,
    infoMember,
    members,
    membriDoppi,
    newMemberChild,
    newMemberName,
    removeMember,
    setInfoMember,
    setMemberField,
    setNewMemberChild,
    setNewMemberName,
    toggleChild,
    toggleEquipExempt,
    unisciDoppi
  }), activeTab === 'presenze' && schedaPresenze({
    admin,
    azioniOpen,
    bloccaGiorno,
    chiediCopiaDaIeri,
    chiediGiornoGratis,
    chiediSetAll,
    getDayData,
    getMeal,
    giornoBloccato,
    giornoGratis,
    members,
    navigateDate,
    orfanoScelte,
    presenzeOrfane,
    riassegnaOrfane,
    sbloccaGiorno,
    scartaOrfane,
    selectedDateStr,
    setAzioniOpen,
    setCurrentDate,
    setOrfanoScelte,
    setSelectedDateStr,
    toggleMeal,
    updateDayData
  }), activeTab === 'spesa' && schedaSpesa({
    admin,
    archives,
    bloccoConti,
    campCodeInput,
    cassaSepAttiva,
    cassaUnica,
    chiudiConti,
    cloud,
    connectCloud,
    disconnectCloud,
    exportData,
    goTo,
    importData,
    isOnline,
    openClose,
    openRestore,
    pastiDi,
    riapriConti,
    risparmio,
    saldiOttimizzati,
    schedaQuote,
    schedaSaldi,
    setCampCodeInput,
    setSaldiOttimizzati,
    setSpesaSection,
    shareReport,
    spesaSection,
    totals
  }), activeTab === 'lista' && schedaLista({
    addPurchase,
    addToBuy,
    attachReceiptTo,
    listaSection,
    manualOpen,
    newBuyName,
    newBuyQty,
    onReceiptFile,
    openEditPurchase,
    pAccount,
    pBuyer,
    pName,
    pPrice,
    pReceipt,
    pType,
    purchaseQuery,
    purchases,
    receipts,
    removePurchase,
    removeToBuy,
    renderBuyerSelect,
    sepDays,
    setBuying,
    setListaSection,
    setManualOpen,
    setNewBuyName,
    setNewBuyQty,
    setPAccount,
    setPBuyer,
    setPName,
    setPPrice,
    setPReceipt,
    setPType,
    setPurchaseQuery,
    setToBuyQuery,
    setViewReceipt,
    spesePotenzialmenteDoppie,
    toBuy,
    toBuyQuery,
    totals
  }), activeTab === 'attrezzatura' && schedaAttrezzatura({
    addEquip,
    attachReceiptTo,
    equipment,
    newEquipBuyer,
    newEquipPrice,
    newEquipText,
    openEditEquip,
    receipts,
    removeEquip,
    renderBuyerSelect,
    setNewEquipBuyer,
    setNewEquipPrice,
    setNewEquipText,
    setViewReceipt,
    toggleEquipBought
  }), activeTab === 'regole' && schedaRegole(), activeTab === 'dotazioni' && schedaDotazioni({
    addGear,
    gear,
    newGearText,
    removeGear,
    setNewGearText
  }), activeTab === 'galleria' && schedaGalleria({
    PER_PAGINA_ALBUM,
    addPhotos,
    album,
    albumPage,
    albumRef,
    cloud,
    galleryView,
    generaRicordo,
    members,
    onScrollAlbum,
    openPhoto,
    paginaAlbum,
    pdfBusy,
    photoBusy,
    photoCap,
    photoWho,
    photos,
    photosBy,
    photosReady,
    picked,
    picking,
    setGalleryView,
    setPhotoWho,
    setPicked,
    setPicking,
    sfoglia,
    soloNome,
    togglePicked,
    uscitaScelta
  }), activeTab === 'archivio' && schedaArchivio({
    album,
    archives,
    cloud,
    downloadArchive,
    members,
    openAlbum,
    openPhoto,
    photos,
    purchases,
    removeArchive,
    setAlbum,
    setViewArchive,
    totals
  }), activeTab === 'gioco' && schedaGioco({
    endGame,
    gameBest,
    gamePlayer,
    gameRunning,
    leaderboard,
    refreshLeaderboard,
    setGamePlayer,
    setGameRunning,
    startGame
  }), activeTab === 'guida' && schedaGuida({
    GUIDE,
    guideOpen,
    setGuideOpen
  }), activeTab === 'impostazioni' && schedaImpostazioni({
    account,
    stanzaStato,
    admin,
    adminErr,
    adminPwd,
    annullaSync,
    askAlways,
    bloccoOpen,
    campData,
    campoInCorso,
    cloud,
    datiOpen,
    diagTick,
    entraAdmin,
    esciAdmin,
    esportaRegistro,
    exportData,
    fotoDove,
    goTo,
    isDark,
    isOnline,
    lingua,
    lockNow,
    logOpen,
    members,
    metaRef,
    photoCap,
    purchases,
    readyChecks,
    readyOk,
    receipts,
    setAdminErr,
    setAdminPwd,
    setBloccoOpen,
    setDatiOpen,
    setDiagTick,
    setLingua,
    setLogOpen,
    setLostSync,
    setPhotoCap,
    setTecnicaOpen,
    setTheme,
    swVersion,
    syncStateRef,
    tecnicaOpen,
    theme,
    toggleAskAlways,
    wipeLocal
  })), buying && /*#__PURE__*/React.createElement("div", {
    onClick: () => setBuying(null),
    className: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "bg-white rounded-lg p-4 w-full max-w-xs space-y-3 shadow-2xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-2 border-b border-[#8F9E8B]/40 pb-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-grande text-[#2D392C] min-w-0 break-words"
  }, L.t('lista.acquistataTitolo', buying.name, buying.qty)), receipts[buying.id] ? /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewReceipt(receipts[buying.id]),
    "aria-label": L.t('lista.vediScontrino'),
    className: bottoneIcona('pieno', 'shrink-0')
  }, "\uD83D\uDCF7") : /*#__PURE__*/React.createElement("label", {
    title: L.t('lista.scontrinoTitolo'),
    "aria-label": L.t('lista.allegaScontrino'),
    className: "shrink-0 cursor-pointer px-3 py-2 rounded border-2 border-[#8F9E8B]/50 bg-white text-grande leading-none hover:bg-[#E2EAE4]"
  }, "\uD83D\uDCF7", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: e => attachReceiptTo(e, buying.id),
    className: "hidden"
  }))), /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-gray-500 -mt-1"
  }, L.t(receipts[buying.id] ? 'lista.scontrinoGiaLi' : 'lista.scontrinoDaMettere')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
  }, L.t('lista.prezzo')), /*#__PURE__*/React.createElement("input", {
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
    className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
  }, L.t('lista.acquirente')), renderBuyerSelect(buying.buyer, v => setBuying(b => ({
    ...b,
    buyer: v
  })))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
  }, L.t('lista.tipologia')), /*#__PURE__*/React.createElement("select", {
    value: buying.type,
    onChange: e => setBuying(b => ({
      ...b,
      type: e.target.value
    })),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale font-bold"
  }, Object.keys(PURCHASE_TYPES).map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, tipoSpesa(k))))), buying.type === 'logistica' && /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-gray-500 leading-snug bg-[#F0F4F1]/60 border border-[#8F9E8B]/25 rounded p-2"
  }, frase('correggi.notaLogistica')), buying.type !== 'logistica' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
  }, L.t('lista.conto')), /*#__PURE__*/React.createElement("select", {
    value: buying.account || 'comune',
    onChange: e => setBuying(b => ({
      ...b,
      account: e.target.value
    })),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale font-bold"
  }, /*#__PURE__*/React.createElement("option", {
    value: "comune"
  }, L.t('lista.contoComune')), /*#__PURE__*/React.createElement("option", {
    value: "sep"
  }, L.t('giorno.contoSeparato'))), buying.account === 'sep' && sepDays.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "text-minuto mt-1 leading-snug text-[#5C4A3C]"
  }, L.t('lista.senzaGiorniBreve'))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 pt-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setBuying(null),
    className: bottone('secondario', 'normale', 'flex-1')
  }, L.t('galleria.annulla')), /*#__PURE__*/React.createElement("button", {
    onClick: confirmBuy,
    className: bottone('primario', 'normale', 'flex-1')
  }, L.t('lista.conferma'))))), editing && /*#__PURE__*/React.createElement("div", {
    onClick: () => setEditing(null),
    className: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-5"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "bg-white rounded-lg p-4 w-full max-w-xs space-y-3 max-h-[85vh] overflow-y-auto shadow-2xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-2 border-b border-[#8F9E8B]/40 pb-2"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-grande text-[#2D392C]"
  }, L.t(editing.kind === 'purchase' ? 'correggi.spesa' : 'correggi.voce')), receipts[editing.id] ? /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewReceipt(receipts[editing.id]),
    "aria-label": L.t('lista.vediScontrino'),
    className: bottoneIcona('pieno', 'shrink-0')
  }, "\uD83D\uDCF7") : /*#__PURE__*/React.createElement("label", {
    title: L.t('lista.scontrinoTitolo'),
    "aria-label": L.t('lista.allegaScontrino'),
    className: "shrink-0 cursor-pointer px-3 py-2 rounded border-2 border-[#8F9E8B]/50 bg-white text-grande leading-none hover:bg-[#E2EAE4]"
  }, "\uD83D\uDCF7", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: e => attachReceiptTo(e, editing.id),
    className: "hidden"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
  }, "Nome"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: editing.name,
    onChange: e => setEditing(x => ({
      ...x,
      name: e.target.value
    })),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
  }, "Acquirente"), renderBuyerSelect(editing.buyer, v => setEditing(x => ({
    ...x,
    buyer: v
  })))), /*#__PURE__*/React.createElement("div", {
    className: editing.kind === 'purchase' ? 'grid grid-cols-2 gap-3' : ''
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
  }, "Prezzo (\u20AC)"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    step: "0.01",
    inputMode: "decimal",
    value: editing.price,
    onChange: e => setEditing(x => ({
      ...x,
      price: e.target.value
    })),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
  })), editing.kind === 'purchase' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
  }, "Tipologia"), /*#__PURE__*/React.createElement("select", {
    value: editing.type,
    onChange: e => setEditing(x => ({
      ...x,
      type: e.target.value
    })),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale font-bold"
  }, Object.keys(PURCHASE_TYPES).map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, tipoSpesa(k)))))), editing.kind === 'purchase' && (editing.type !== 'logistica' ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
  }, L.t('lista.conto')), /*#__PURE__*/React.createElement("select", {
    value: editing.account,
    onChange: e => setEditing(x => ({
      ...x,
      account: e.target.value
    })),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale font-bold"
  }, /*#__PURE__*/React.createElement("option", {
    value: "comune"
  }, L.t('lista.contoComune')), /*#__PURE__*/React.createElement("option", {
    value: "sep"
  }, L.t('giorno.contoSeparato')))) : /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-gray-500 leading-snug bg-[#F0F4F1]/60 border border-[#8F9E8B]/25 rounded p-2"
  }, frase('correggi.notaLogistica'))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 pt-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditing(null),
    className: bottone('secondario', 'normale', 'flex-1')
  }, L.t('galleria.annulla')), /*#__PURE__*/React.createElement("button", {
    onClick: saveEdit,
    className: bottone('primario', 'normale', 'flex-1')
  }, L.t('lista.salva'))))), snapList && /*#__PURE__*/React.createElement("div", {
    onClick: () => setSnapList(null),
    className: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "bg-white rounded-lg p-4 w-full max-w-xs space-y-2 max-h-[70vh] overflow-y-auto shadow-2xl"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-grande text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2"
  }, L.t('ripristino.titolo')), /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-gray-500"
  }, frase('ripristino.nota')), snapList.map(s => {
    const giorno = L.data(parseDate(s.id.slice(0, 10)), 'settimanaLunga');
    const fascia = s.id.slice(11) === '00' ? L.t('ripristino.fasciaMattina') : s.id.slice(11) === '12' ? L.t('ripristino.fasciaPomeriggio') : '';
    const ora = s.at ? L.data(new Date(s.at), 'ora') : '';
    return /*#__PURE__*/React.createElement("button", {
      key: s.dove + s.id,
      onClick: () => restoreSnapshot(s),
      className: "w-full py-2 px-3 bg-[#F0F4F1] border border-[#8F9E8B]/40 rounded text-left text-[#2D392C] hover:bg-[#E2EAE4] flex items-center justify-between gap-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: "min-w-0"
    }, /*#__PURE__*/React.createElement("span", {
      className: "block text-normale font-bold truncate"
    }, giorno), /*#__PURE__*/React.createElement("span", {
      className: "block text-minuto text-gray-500"
    }, fascia ? L.t('ripristino.copiaDelle', fascia, ora) : L.t('ripristino.copiaCloud'))), /*#__PURE__*/React.createElement("span", {
      className: "text-minuto uppercase font-bold px-1.5 py-0.5 rounded shrink-0 bg-white border border-[#8F9E8B]/40 text-gray-500"
    }, L.t(s.dove === 'locale' ? 'ripristino.sulTelefono' : 'ripristino.nelCloud')));
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSnapList(null),
    className: bottone('testuale', 'normale', 'w-full')
  }, L.t('galleria.annulla')))), closing && /*#__PURE__*/React.createElement("div", {
    onClick: () => setClosing(false),
    className: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "bg-white rounded-lg p-4 w-full max-w-xs space-y-3 max-h-[80vh] overflow-y-auto shadow-2xl"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-grande text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2"
  }, L.t('chiusura.campoTitolo')), /*#__PURE__*/React.createElement("label", {
    className: "block text-piccolo uppercase font-bold text-gray-500"
  }, L.t('chiusura.nomeArchivio')), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: closeName,
    onChange: e => setCloseName(e.target.value),
    placeholder: L.t('chiusura.esempioNome'),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("div", {
    className: "bg-[#F0F4F1]/60 rounded p-3 text-piccolo text-gray-600 space-y-1"
  }, /*#__PURE__*/React.createElement("p", {
    className: "font-bold text-[#2D392C]"
  }, L.t('chiusura.verraArchiviato')), /*#__PURE__*/React.createElement("p", null, L.t('chiusura.riepilogo', money(totals.overallTotal), purchases.length, members.length)), /*#__PURE__*/React.createElement("p", {
    className: "font-bold text-[#2D392C] pt-1"
  }, L.t('chiusura.poiAzzerati')), /*#__PURE__*/React.createElement("p", null, L.t('chiusura.cosaSiAzzera')), /*#__PURE__*/React.createElement("p", {
    className: "pt-1 italic"
  }, L.t('chiusura.cosaResta'))), /*#__PURE__*/React.createElement("button", {
    onClick: closeCamp,
    className: bottone('bruno', 'grande', 'w-full')
  }, L.t('chiusura.archiviaEAzzera')), /*#__PURE__*/React.createElement("button", {
    onClick: () => setClosing(false),
    className: bottone('testuale', 'normale', 'w-full')
  }, L.t('galleria.annulla')))), viewArchive && /*#__PURE__*/React.createElement("div", {
    onClick: () => setViewArchive(null),
    className: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    className: "bg-white rounded-lg p-4 w-full max-w-xs space-y-3 max-h-[80vh] overflow-y-auto shadow-2xl"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-grande text-[#2D392C] border-b border-[#8F9E8B]/40 pb-2"
  }, viewArchive.name), /*#__PURE__*/React.createElement("pre", {
    className: "text-piccolo text-gray-700 whitespace-pre-wrap font-sans leading-relaxed"
  }, viewArchive.report || L.t('archivio.nessunResoconto')), /*#__PURE__*/React.createElement("button", {
    onClick: () => shareArchive(viewArchive),
    className: bottone('whatsapp', 'normale', 'w-full')
  }, L.t('archivio.condividi')), /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewArchive(null),
    className: bottone('testuale', 'normale', 'w-full')
  }, L.t('archivio.chiudi')))), viewPhoto && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-grow flex items-center justify-center w-full min-h-0",
    onClick: () => setViewPhoto(null)
  }, viewPhoto.full ? /*#__PURE__*/React.createElement("img", {
    src: viewPhoto.full,
    alt: L.t('archivio.fotoDi', viewPhoto.by || L.t('archivio.anonimo')),
    className: "max-w-full max-h-full rounded shadow-2xl"
  }) : /*#__PURE__*/React.createElement("div", {
    className: "text-center"
  }, /*#__PURE__*/React.createElement("img", {
    src: viewPhoto.thumb,
    alt: "",
    className: "max-w-full max-h-[60vh] rounded opacity-40 blur-sm"
  }), /*#__PURE__*/React.createElement("p", {
    className: "mt-3 text-piccolo uppercase tracking-widest text-white/60"
  }, L.t('galleria.scaricoFoto')))), /*#__PURE__*/React.createElement("div", {
    className: "shrink-0 w-full max-w-md flex items-center justify-between gap-3 pt-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo text-white/70 truncate"
  }, viewPhoto.by || L.t('archivio.anonimo'), viewPhoto.at ? ` · ${L.data(new Date(viewPhoto.at), 'numerica')}` : ''), /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-2 shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => removePhoto(viewPhoto),
    className: "text-piccolo uppercase font-bold px-3 py-2 rounded border border-[#D97706]/60 text-[#D97706]"
  }, L.t('archivio.elimina')), /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewPhoto(null),
    className: "text-piccolo uppercase font-bold px-3 py-2 rounded bg-[#F0F4F1] text-[#2D392C]"
  }, L.t('archivio.chiudi'))))), viewReceipt && /*#__PURE__*/React.createElement("div", {
    onClick: () => setViewReceipt(null),
    className: "fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-pointer"
  }, /*#__PURE__*/React.createElement("img", {
    src: viewReceipt,
    alt: L.t('lista.scontrino'),
    className: "max-w-full max-h-full rounded shadow-2xl"
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute bottom-6 left-0 right-0 text-center text-piccolo uppercase tracking-widest text-white/60"
  }, L.t('galleria.toccaPerChiudere'))), /*#__PURE__*/React.createElement("footer", {
    className: "fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#F0F4F1] border-t-2 border-[#5C4A3C] py-3 px-4 text-center z-10"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-rustic text-[#2D392C] tracking-widest text-normale uppercase font-bold"
  }, BRAND.footerMotto)));
}
// ---------- Schede del giorno: Calendario, Menu', Presenze ----------
// Uscite da 80-app.jsx. Sono funzioni che restituiscono JSX, non componenti
// React: nessun confine di riconciliazione nuovo, nessun hook spostato,
// l'albero prodotto e' identico. L'elenco delle dipendenze in cima a ognuna e'
// il punto del lavoro: sono le cose che quel disegno si prendeva dalla
// chiusura di App() senza dirlo.

const schedaCalendario = ({
  admin,
  fetchWeather,
  getDayData,
  getMeal,
  goTo,
  isOnline,
  members,
  presenzeOrfane,
  campoInCorso,
  readyOk,
  renderWeekStrip,
  selectedDateStr,
  sepDays,
  sepOpen,
  setSepOpen,
  toggleSepDay,
  updateDayData,
  weather,
  weekDays,
  wxBusy
}) => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, campoInCorso && !readyOk && /*#__PURE__*/React.createElement("button", {
  onClick: () => goTo('impostazioni'),
  className: "w-full bg-[#D97706]/10 border border-[#D97706]/40 rounded-lg p-3 text-left flex items-start gap-2 hover:bg-[#D97706]/15"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-medio leading-none mt-0.5"
}, "\u26A0\uFE0F"), /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo text-[#5C4A3C] leading-snug"
}, frase('giorno.nonPronto'))), (() => {
  const orfane = presenzeOrfane();
  if (orfane.length === 0) return null;
  const totale = orfane.reduce((s, o) => s + o.pasti, 0);
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => goTo('presenze'),
    className: "w-full bg-[#D97706]/10 border border-[#D97706]/40 rounded-lg p-3 text-left flex items-start gap-2 hover:bg-[#D97706]/15"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-medio leading-none mt-0.5"
  }, "\uD83C\uDF7D\uFE0F"), /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('giorno.orfaneAvviso', totale, orfane.length)));
})(), renderWeekStrip(), /*#__PURE__*/React.createElement("div", {
  className: "bg-white rounded-lg border border-[#8F9E8B]/30 shadow-sm overflow-hidden"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => setSepOpen(v => !v),
  className: bottoneRiga()
}, /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase font-bold text-[#5C4A3C] shrink-0"
}, L.t('giorno.contoSeparato')), /*#__PURE__*/React.createElement("span", {
  className: "ml-auto text-minuto text-gray-500 truncate"
}, sepDays.length === 0 ? L.t('giorno.nessunGiorno') : L.t('giorno.giorniInTotale', sepDays.length)), /*#__PURE__*/React.createElement("span", {
  className: `text-piccolo text-[#5C4A3C] shrink-0 transition-transform ${sepOpen ? 'rotate-180' : ''}`
}, "\u25BE")), sepOpen && /*#__PURE__*/React.createElement("div", {
  className: "px-3 pb-3"
}, /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-7 gap-1"
}, weekDays.map(d => {
  const dateStr = toDateStr(d);
  const on = sepDays.includes(dateStr);
  return /*#__PURE__*/React.createElement("label", {
    key: dateStr,
    title: L.t('giorno.separatoTitolo', L.data(d, 'completa')),
    className: `flex flex-col items-center gap-0.5 py-1.5 rounded cursor-pointer border ${on ? 'bg-[#5C4A3C]/15 border-[#5C4A3C]/50' : 'bg-[#F0F4F1]/50 border-transparent hover:bg-[#E2EAE4]'}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: on,
    onChange: () => toggleSepDay(dateStr),
    className: "w-3.5 h-3.5 accent-[#5C4A3C]"
  }), /*#__PURE__*/React.createElement("span", {
    className: `text-minuto font-bold ${on ? 'text-[#5C4A3C]' : 'text-gray-400'}`
  }, d.getDate()));
})), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic mt-2 leading-snug"
}, frase('giorno.separatoNota')))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-dashed border-[#8F9E8B] pb-1"
}, L.data(parseDate(selectedDateStr), 'completa')), (() => {
  const loc = window.CAMP_LOCATION;
  const locOk = loc && typeof loc.lat === 'number' && typeof loc.lon === 'number';
  const wx = weather.byDate[selectedDateStr];
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20 space-y-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, !locOk ? /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo text-gray-400 italic"
  }, L.t('meteo.senzaLuogo')) : wx ? (() => {
    // La faccia della giornata e', quando si sa, la
    // condizione prevalente delle ore diurne; il brutto si
    // nomina a parte col suo momento. I millimetri dicono
    // se e' una spruzzata o una lavata: "40%" da solo no.
    const r = raccontaMeteo(wx);
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "text-titolo leading-none"
    }, r.icon), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-col min-w-0"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-normale font-bold text-[#2D392C] leading-tight"
    }, r.label, r.coda ? /*#__PURE__*/React.createElement("span", {
      className: "font-normal"
    }, ", ", r.coda) : null), loc.label && /*#__PURE__*/React.createElement("span", {
      className: "text-minuto text-gray-400"
    }, loc.label)), /*#__PURE__*/React.createElement("span", {
      className: "ml-auto text-piccolo text-gray-600 font-bold shrink-0 text-right"
    }, Math.round(wx.tmax), "\xB0 / ", Math.round(wx.tmin), "\xB0", r.mm ? /*#__PURE__*/React.createElement("span", {
      className: "text-[#5C8AA8]"
    }, " \xB7 \uD83D\uDCA7", r.mm) : wx.rain != null ? /*#__PURE__*/React.createElement("span", {
      className: "text-[#5C8AA8]"
    }, " \xB7 \uD83D\uDCA7", wx.rain, "%") : null));
  })() : /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo text-gray-400 italic"
  }, L.t('meteo.nonDisponibile', isOnline))), locOk && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2 pt-1 border-t border-[#8F9E8B]/20"
  }, (() => {
    const vecchia = weather.fetchedAt && Date.now() - weather.fetchedAt > METEO_VECCHIO;
    return /*#__PURE__*/React.createElement("span", {
      className: `text-minuto ${vecchia ? 'text-[#D97706] font-bold' : 'text-gray-400'}`
    }, weather.fetchedAt ? L.t('meteo.previsioniDel', vecchia, L.data(new Date(weather.fetchedAt), 'breve'), L.data(new Date(weather.fetchedAt), 'ora')) : L.t('meteo.nonScaricate'));
  })(), /*#__PURE__*/React.createElement("button", {
    onClick: () => fetchWeather(true),
    disabled: !isOnline || wxBusy,
    className: bottone('secondario', 'minuscolo', 'shrink-0')
  }, wxBusy ? '…' : L.t('gioco.aggiorna'))), admin && locOk && /*#__PURE__*/React.createElement("div", {
    className: "text-minuto text-gray-400 font-mono pt-0.5"
  }, "\uD83D\uDCCD ", loc.lat, ", ", loc.lon, L.t('meteo.quote', loc.alt, weather.quota)));
})(), (() => {
  const lunch = members.filter(m => getMeal(selectedDateStr, m.id).lunch).length;
  const dinner = members.filter(m => getMeal(selectedDateStr, m.id).dinner).length;
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 bg-[#2D392C]/5 px-3 py-2 rounded border border-[#2D392C]/15"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-titolo leading-none"
  }, "\uD83C\uDF72"), /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo uppercase font-bold text-gray-500"
  }, L.t('giorno.cucina')), /*#__PURE__*/React.createElement("span", {
    className: "ml-auto text-normale font-bold text-[#2D392C]"
  }, lunch, " ", /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo font-normal text-gray-500"
  }, L.t('giorno.aPranzo')), /*#__PURE__*/React.createElement("span", {
    className: "text-gray-300"
  }, " \xB7 "), dinner, " ", /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo font-normal text-gray-500"
  }, L.t('giorno.aCena'))));
})(), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
  className: "flex items-center justify-between mb-1"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase font-bold text-gray-500 tracking-wide"
}, L.t('giorno.note')), (getDayData(selectedDateStr).appunti || '').trim() && /*#__PURE__*/React.createElement("span", {
  className: "text-minuto text-[#2D392C]"
}, L.t('giorno.scritte'))), /*#__PURE__*/React.createElement("textarea", {
  value: getDayData(selectedDateStr).appunti || '',
  onChange: e => updateDayData(selectedDateStr, 'appunti', e.target.value),
  rows: 3,
  placeholder: L.t('giorno.promemoria'),
  className: "w-full p-3 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale leading-snug focus:outline-none focus:border-[#2D392C] resize-y"
}), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic mt-1"
}, frase('giorno.noteNota'))), /*#__PURE__*/React.createElement("button", {
  onClick: () => goTo('menu'),
  className: bottone('secondario', 'normale', 'w-full')
}, L.t('giorno.vaiAlMenu', !!(getDayData(selectedDateStr).note || '').trim()))));
const schedaMenu = ({
  confermaPropostaSpesa,
  getDayData,
  getMeal,
  members,
  proponiDalMenu,
  propostaSpesa,
  renderWeekStrip,
  selectedDateStr,
  setCurrentDate,
  setPropostaSpesa,
  setSelectedDateStr,
  toBuy,
  updateDayData
}) => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, renderWeekStrip(), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-2"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-baseline justify-between border-b border-dashed border-[#8F9E8B] pb-1"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande text-[#2D392C]"
}, L.t('menu.diGiorno', L.data(parseDate(selectedDateStr), 'completa')))), (() => {
  const lunch = members.filter(m => getMeal(selectedDateStr, m.id).lunch).length;
  const dinner = members.filter(m => getMeal(selectedDateStr, m.id).dinner).length;
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 bg-[#2D392C]/5 px-3 py-2 rounded border border-[#2D392C]/15"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-titolo leading-none"
  }, "\uD83C\uDF72"), /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo uppercase font-bold text-gray-500"
  }, L.t('menu.daPreparare')), /*#__PURE__*/React.createElement("span", {
    className: "ml-auto text-normale font-bold text-[#2D392C]"
  }, lunch, " ", /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo font-normal text-gray-500"
  }, L.t('giorno.aPranzo')), /*#__PURE__*/React.createElement("span", {
    className: "text-gray-300"
  }, " \xB7 "), dinner, " ", /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo font-normal text-gray-500"
  }, L.t('giorno.aCena'))));
})(), /*#__PURE__*/React.createElement("textarea", {
  value: getDayData(selectedDateStr).note,
  onChange: e => updateDayData(selectedDateStr, 'note', e.target.value),
  placeholder: L.t('menu.cosaSiMangia'),
  className: "lined-paper w-full p-3 rounded-lg border border-[#8F9E8B]/30 focus:outline-none focus:border-[#2D392C] resize-y"
}), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic"
}, L.t('menu.unaPerRiga')), /*#__PURE__*/React.createElement("button", {
  onClick: proponiDalMenu,
  className: bottone('secondario', 'normale', 'w-full mt-1')
}, L.t('menu.portaInLista')), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic"
}, frase('menu.ponteNota', toBuy.length))), propostaSpesa && /*#__PURE__*/React.createElement("div", {
  className: "fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-3 z-50",
  onClick: () => setPropostaSpesa(null)
}, /*#__PURE__*/React.createElement("div", {
  className: "bg-white rounded-lg w-full max-w-md max-h-[85vh] flex flex-col shadow-xl",
  onClick: e => e.stopPropagation()
}, /*#__PURE__*/React.createElement("div", {
  className: "p-4 border-b border-[#8F9E8B]/30"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande text-[#2D392C]"
}, L.t('menu.dallaSpesa')), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug mt-1"
}, L.t('menu.trovate', propostaSpesa.voci.length, L.data(parseDate(selectedDateStr), 'lunga'), propostaSpesa.scartate))), /*#__PURE__*/React.createElement("ul", {
  className: "overflow-y-auto divide-y divide-[#8F9E8B]/15 px-4"
}, propostaSpesa.voci.map((v, i) => /*#__PURE__*/React.createElement("li", {
  key: i
}, /*#__PURE__*/React.createElement("label", {
  className: "flex items-center gap-3 py-2.5 cursor-pointer"
}, /*#__PURE__*/React.createElement("input", {
  type: "checkbox",
  checked: !!propostaSpesa.scelte[i],
  onChange: () => setPropostaSpesa(p => ({
    ...p,
    scelte: {
      ...p.scelte,
      [i]: !p.scelte[i]
    }
  })),
  className: "w-4 h-4 shrink-0 accent-[#2D392C]"
}), /*#__PURE__*/React.createElement("span", {
  className: "text-normale text-[#2D392C] min-w-0 flex-1 truncate"
}, v.nome), v.qta && /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo font-bold text-[#5C4A3C] shrink-0"
}, v.qta))))), /*#__PURE__*/React.createElement("div", {
  className: "p-4 border-t border-[#8F9E8B]/30 flex gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => setPropostaSpesa(null),
  className: bottone('testuale', 'normale', 'flex-1')
}, L.t('galleria.annulla')), /*#__PURE__*/React.createElement("button", {
  onClick: confermaPropostaSpesa,
  className: bottone('primario', 'normale', 'flex-1')
}, L.t('menu.aggiungiN', propostaSpesa.voci.filter((_, i) => propostaSpesa.scelte[i]).length))))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
}, L.t('menu.giorniDelCampo')), /*#__PURE__*/React.createElement("ul", {
  className: "space-y-1.5"
}, (() => {
  const giorni = [];
  for (let d = parseDate(CAMP_START); toDateStr(d) <= CAMP_END; d.setDate(d.getDate() + 1)) {
    giorni.push(toDateStr(d));
  }
  return giorni.map(ds => {
    const testo = (getDayData(ds).note || '').trim();
    const prima = testo.split('\n')[0] || '';
    return /*#__PURE__*/React.createElement("li", {
      key: ds
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setSelectedDateStr(ds);
        setCurrentDate(parseDate(ds));
      },
      className: `w-full text-left flex items-center gap-2 px-3 py-2 rounded border transition-colors ${ds === selectedDateStr ? 'bg-[#5C4A3C]/15 border-[#5C4A3C]/50' : 'bg-[#F0F4F1]/60 border-[#8F9E8B]/20 hover:bg-[#E2EAE4]'}`
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-piccolo font-bold text-[#2D392C] shrink-0 w-16"
    }, L.data(parseDate(ds), 'settimanaGiorno')), /*#__PURE__*/React.createElement("span", {
      className: `text-piccolo truncate ${testo ? 'text-gray-600' : 'text-gray-400 italic'}`
    }, testo ? prima : L.t('menu.daScrivere')), testo && /*#__PURE__*/React.createElement("span", {
      className: "ml-auto text-piccolo shrink-0"
    }, "\u2714")));
  });
})())));
const schedaPresenze = ({
  admin,
  azioniOpen,
  bloccaGiorno,
  chiediCopiaDaIeri,
  chiediGiornoGratis,
  chiediSetAll,
  getDayData,
  getMeal,
  giornoBloccato,
  giornoGratis,
  members,
  navigateDate,
  orfanoScelte,
  presenzeOrfane,
  riassegnaOrfane,
  sbloccaGiorno,
  scartaOrfane,
  selectedDateStr,
  setAzioniOpen,
  setCurrentDate,
  setOrfanoScelte,
  setSelectedDateStr,
  toggleMeal,
  updateDayData
}) => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => navigateDate(-1),
  className: bottoneIcona('tenue')
}, "\u2190"), /*#__PURE__*/React.createElement("input", {
  type: "date",
  value: selectedDateStr,
  onChange: e => {
    if (e.target.value) {
      setSelectedDateStr(e.target.value);
      setCurrentDate(parseDate(e.target.value));
    }
  },
  className: "bg-transparent border-none text-normale focus:outline-none font-bold text-center w-full mx-2 text-[#5C4A3C]"
}), /*#__PURE__*/React.createElement("button", {
  onClick: () => navigateDate(1),
  className: bottoneIcona('tenue')
}, "\u2192")), (() => {
  const orfane = presenzeOrfane();
  if (orfane.length === 0) return null;
  const totale = orfane.reduce((s, o) => s + o.pasti, 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/10 border-2 border-[#D97706]/50 rounded-lg p-3 space-y-3"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('presenze.orfaneTitolo', totale)), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, orfane.map(o => /*#__PURE__*/React.createElement("li", {
    key: o.id,
    className: "bg-white/70 rounded border border-[#8F9E8B]/30 p-2.5 space-y-2"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#2D392C] leading-snug"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, o.nome || L.t('presenze.personaSparita')), ' — ', L.t('presenze.pastiSuGiorni', o.pasti, o.giorni.length), /*#__PURE__*/React.createElement("span", {
    className: "block text-minuto text-gray-500"
  }, o.giorni.slice(0, 6).map(d => L.data(parseDate(d), 'breve')).join(' · '), o.giorni.length > 6 ? ' …' : '')), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("select", {
    value: orfanoScelte[o.id] || '',
    onChange: e => setOrfanoScelte(prev => ({
      ...prev,
      [o.id]: e.target.value
    })),
    className: "flex-grow min-w-0 p-2 bg-white border border-[#8F9E8B]/40 rounded text-piccolo focus:outline-none focus:border-[#2D392C]"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, L.t('presenze.aChiSono')), members.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.id,
    value: m.id
  }, m.name))), /*#__PURE__*/React.createElement("button", {
    onClick: () => riassegnaOrfane(o, orfanoScelte[o.id]),
    disabled: !orfanoScelte[o.id],
    className: bottone('primario', 'minuscolo', 'shrink-0')
  }, L.t('presenze.riassegna')), /*#__PURE__*/React.createElement("button", {
    onClick: () => scartaOrfane(o),
    "aria-label": L.t('presenze.buttaVia'),
    className: bottone('distruttivo', 'minuscolo', 'shrink-0')
  }, L.t('presenze.butta')))))), members.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "text-minuto text-[#5C4A3C] italic"
  }, L.t('galleria.primaMembri')));
})(), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] flex items-center gap-2"
}, /*#__PURE__*/React.createElement("span", {
  className: "min-w-0 truncate"
}, L.t('presenze.delGiorno', L.data(parseDate(selectedDateStr), 'lunga'))), giornoBloccato(selectedDateStr) && /*#__PURE__*/React.createElement("span", {
  className: "ml-auto shrink-0 text-minuto uppercase font-bold px-2 py-1 rounded bg-[#5C4A3C] text-white"
}, L.t('presenze.bloccate'))), giornoGratis(selectedDateStr) && /*#__PURE__*/React.createElement("div", {
  className: "bg-[#2D392C]/10 border border-[#2D392C]/35 rounded p-2.5"
}, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#2D392C] leading-snug"
}, frase('presenze.gratis'))), admin && members.length > 0 && /*#__PURE__*/React.createElement("button", {
  onClick: () => chiediGiornoGratis(selectedDateStr),
  disabled: !!giornoBloccato(selectedDateStr),
  className: bottoneScelta('interruttore', 'bordato', giornoGratis(selectedDateStr), 'minuscolo', 'w-full' + (giornoBloccato(selectedDateStr) ? ' opacity-50 cursor-not-allowed' : ''))
}, L.t(giornoGratis(selectedDateStr) ? 'presenze.gratisTogli' : 'presenze.gratisMetti')), giornoBloccato(selectedDateStr) && /*#__PURE__*/React.createElement("div", {
  className: "bg-[#5C4A3C]/10 border border-[#5C4A3C]/40 rounded p-2.5"
}, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#5C4A3C] leading-snug"
}, frase('presenze.chiuse', L.data(new Date(giornoBloccato(selectedDateStr).at), 'dataOra')))), members.length === 0 ? /*#__PURE__*/React.createElement("p", {
  className: "text-normale text-gray-400 italic"
}, L.t('presenze.primaIMembri')) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
  className: `bg-[#F0F4F1]/60 rounded border border-[#8F9E8B]/30 overflow-hidden ${giornoBloccato(selectedDateStr) ? 'opacity-50 pointer-events-none' : ''}`
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => setAzioniOpen(v => !v),
  className: bottoneRiga()
}, /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase font-bold text-[#5C4A3C] shrink-0"
}, L.t('presenze.segnaInBlocco')), /*#__PURE__*/React.createElement("span", {
  className: "ml-auto text-minuto text-gray-500 truncate"
}, L.t('presenze.pranzoCena', members.filter(m => getMeal(selectedDateStr, m.id).lunch).length, members.filter(m => getMeal(selectedDateStr, m.id).dinner).length)), /*#__PURE__*/React.createElement("span", {
  className: `text-piccolo text-[#5C4A3C] shrink-0 transition-transform ${azioniOpen ? 'rotate-180' : ''}`
}, "\u25BE")), azioniOpen && /*#__PURE__*/React.createElement("div", {
  className: "px-3 pb-3 space-y-2"
}, /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-3 gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => chiediSetAll('lunch'),
  className: bottone('primario', 'normale')
}, L.t('presenze.tuttiPranzo')), /*#__PURE__*/React.createElement("button", {
  onClick: () => chiediSetAll('dinner'),
  className: bottone('bruno', 'normale')
}, L.t('presenze.tuttiCena')), /*#__PURE__*/React.createElement("button", {
  onClick: chiediCopiaDaIeri,
  className: bottone('secondario', 'normale')
}, L.t('presenze.copiaIeri'))), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 leading-snug"
}, L.t('presenze.bloccoNota')))), /*#__PURE__*/React.createElement("ul", {
  className: "space-y-2"
}, members.map(m => {
  const meal = getMeal(selectedDateStr, m.id);
  const chiuso = !!giornoBloccato(selectedDateStr);
  return /*#__PURE__*/React.createElement("li", {
    key: m.id,
    className: "flex items-center justify-between gap-2 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-normale font-bold text-[#2D392C] truncate flex items-center gap-1"
  }, m.name, m.isChild && /*#__PURE__*/React.createElement("span", {
    className: "text-minuto uppercase bg-[#D97706] text-white px-1 rounded"
  }, L.t('presenze.gratisEtichetta'))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1.5 shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => toggleMeal(selectedDateStr, m.id, 'lunch'),
    disabled: chiuso,
    className: bottoneScelta('spunta', 'pranzo', meal.lunch, 'minuscolo', chiuso ? 'opacity-60 cursor-not-allowed' : '')
  }, L.t('presenze.pranzo')), /*#__PURE__*/React.createElement("button", {
    onClick: () => toggleMeal(selectedDateStr, m.id, 'dinner'),
    disabled: chiuso,
    className: bottoneScelta('spunta', 'cena', meal.dinner, 'minuscolo', chiuso ? 'opacity-60 cursor-not-allowed' : '')
  }, L.t('presenze.cena'))));
}))), admin && members.length > 0 && (giornoBloccato(selectedDateStr) ? /*#__PURE__*/React.createElement("button", {
  onClick: () => sbloccaGiorno(selectedDateStr),
  className: bottone('secondario', 'normale', 'w-full')
}, L.t('presenze.sblocca')) : /*#__PURE__*/React.createElement("button", {
  onClick: () => bloccaGiorno(selectedDateStr),
  className: bottone('bruno', 'normale', 'w-full')
}, L.t('presenze.blocca')))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-2"
}, /*#__PURE__*/React.createElement("h4", {
  className: "font-rustic text-normale text-[#5C4A3C]"
}, L.t('presenze.noteOspiti')), /*#__PURE__*/React.createElement("textarea", {
  value: getDayData(selectedDateStr).guestsNames,
  onChange: e => updateDayData(selectedDateStr, 'guestsNames', e.target.value),
  placeholder: L.t('presenze.ospitiSegno'),
  className: "w-full h-20 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C] resize-none"
})));
// ---------- Schede dei conti: Spese Totali, Lista della Spesa, Attrezzatura ----------
// Vedi 81-schede-giorno.jsx per il perche' sono funzioni e non componenti.

const schedaSpesa = ({
  admin,
  archives,
  bloccoConti,
  campCodeInput,
  cassaSepAttiva,
  cassaUnica,
  chiudiConti,
  cloud,
  connectCloud,
  disconnectCloud,
  exportData,
  goTo,
  importData,
  isOnline,
  openClose,
  openRestore,
  pastiDi,
  riapriConti,
  risparmio,
  saldiOttimizzati,
  schedaQuote,
  schedaSaldi,
  setCampCodeInput,
  setSaldiOttimizzati,
  setSpesaSection,
  shareReport,
  spesaSection,
  totals
}) => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-4 gap-1.5"
}, [['totali', L.t('spesa.totali')], ['quote', L.t('spesa.quote')], ['saldi', L.t('spesa.saldi')], ['dati', L.t('spesa.dati')]].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
  key: k,
  onClick: () => setSpesaSection(k),
  className: bottoneScelta('linguetta', 'sezione', spesaSection === k, 'minuscolo')
}, l))), spesaSection === 'totali' && /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-4"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('spesa.cassaGlobale')), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 -mt-1"
}, frase('spesa.cassaNota')), /*#__PURE__*/React.createElement("div", {
  className: "space-y-2"
}, [[L.t('spesa.cibo'), totals.totalFood], [L.t('spesa.bevande'), totals.totalDrinks], [L.t('spesa.logisticaEAttrezzatura'), totals.totalAccessory]].map(([label, val]) => /*#__PURE__*/React.createElement("div", {
  key: label,
  className: "flex justify-between items-center bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase font-bold text-gray-500"
}, label), /*#__PURE__*/React.createElement("span", {
  className: "font-bold text-[#2D392C]"
}, money(val), " \u20AC")))), totals.foodDrinksSep > 0 && /*#__PURE__*/React.createElement("div", {
  className: "flex justify-between items-center bg-[#5C4A3C]/10 px-3 py-2 rounded border border-[#5C4A3C]/30"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase font-bold text-[#5C4A3C]"
}, L.t('spesa.diCuiSeparato')), /*#__PURE__*/React.createElement("span", {
  className: "font-bold text-[#5C4A3C]"
}, money(totals.foodDrinksSep), " \u20AC")), /*#__PURE__*/React.createElement("div", {
  className: "bg-[#2D392C]/10 p-3 rounded border border-[#2D392C]/20 flex justify-between items-center mt-2"
}, /*#__PURE__*/React.createElement("span", {
  className: "font-bold text-piccolo uppercase"
}, L.t('spesa.importoComplessivo')), /*#__PURE__*/React.createElement("span", {
  className: "font-rustic font-bold text-grande text-[#2D392C]"
}, money(totals.overallTotal), " \u20AC"))), /*#__PURE__*/React.createElement("div", {
  className: "bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md space-y-4"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-1"
}, L.t('spesa.contoDellaServa')), /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-2 gap-3"
}, /*#__PURE__*/React.createElement("div", {
  className: "bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase text-[#8F9E8B] block"
}, L.t('spesa.quotaPasto')), /*#__PURE__*/React.createElement("span", {
  className: "font-rustic text-titolo text-[#D97706]"
}, money(totals.costPerMeal), " \u20AC"), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 mt-1"
}, L.t('spesa.quotaPastoNota', money(totals.foodDrinksCommon), totals.adultMealsCommon, totals.sepDaysCount > 0))), !(FEATURES.equipExemption && totals.equipPayersCount !== totals.accessoryPayersCount) ? /*#__PURE__*/React.createElement("div", {
  className: "bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase text-[#8F9E8B] block"
}, L.t('spesa.quotaPersona')), /*#__PURE__*/React.createElement("span", {
  className: "font-rustic text-titolo text-[#D97706]"
}, money(totals.accessoryPerAdult), " \u20AC"), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 mt-1"
}, L.t('spesa.quotaPersonaNota', money(totals.totalAccessory), totals.accessoryPayersCount))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
  className: "bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase text-[#8F9E8B] block"
}, L.t('spesa.logisticaTesta')), /*#__PURE__*/React.createElement("span", {
  className: "font-rustic text-titolo text-[#D97706]"
}, money(totals.logisticsPerAdult), " \u20AC"), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 mt-1"
}, L.t('spesa.logisticaTestaNota', money(totals.logisticsPurchases), totals.accessoryPayersCount))), /*#__PURE__*/React.createElement("div", {
  className: "bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase text-[#8F9E8B] block"
}, L.t('spesa.attrezzaturaTesta')), /*#__PURE__*/React.createElement("span", {
  className: "font-rustic text-titolo text-[#D97706]"
}, money(totals.equipPerAdult), " \u20AC"), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 mt-1"
}, L.t('spesa.attrezzaturaTestaNota', money(totals.equipBought), totals.equipPayersCount)))), (totals.sepDaysCount > 0 || totals.foodDrinksSep > 0) && /*#__PURE__*/React.createElement("div", {
  className: "bg-[#1F271E] p-3 rounded border border-[#5C4A3C] col-span-2"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase text-[#8F9E8B] block"
}, L.t('spesa.separatoQuotaPasto')), /*#__PURE__*/React.createElement("span", {
  className: "font-rustic text-titolo text-[#D97706]"
}, money(totals.costPerMealSep), " \u20AC"), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 mt-1"
}, L.t('spesa.separatoQuotaNota', money(totals.foodDrinksSep), totals.adultMealsSep, totals.sepDaysCount, totals.sepPeopleCount)))), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic"
}, L.t('spesa.bambiniGratis')))), spesaSection === 'quote' && /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, totals.overallTotal > 0 && totals.adultMealsTotal === 0 && /*#__PURE__*/React.createElement("div", {
  className: "bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5"
}, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#5C4A3C] leading-snug"
}, frase('quote.senzaPasti', money(totals.overallTotal)))), totals.freeDaysCount > 0 && /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#2D392C] leading-snug bg-[#2D392C]/8 border border-[#2D392C]/25 rounded p-2.5"
}, frase('quote.giorniGratis', totals.freeDaysCount, totals.mealsFree)), schedaQuote({
  titolo: L.t('quote.cassaComune'),
  sottotitolo: cassaSepAttiva ? L.t('quote.cassaComuneNota') : null,
  elenco: totals.breakdown,
  quotaDi: b => b.payComune,
  pastiDi: b => b.mealsCommon,
  raccolto: totals.collectedComune,
  totale: totals.totaleComune,
  scarto: totals.roundingDiffComune,
  buchi: totals.buchi.filter(x => x.cassa === 'comune'),
  nonRipartito: totals.nonRipartitoComune,
  avviso: totals.foodDrinksCommon > 0 && totals.adultMealsCommon === 0 && totals.adultMealsTotal > 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, frase('quote.tuttiSeparati', money(totals.foodDrinksCommon))) : null
}), cassaSepAttiva && schedaQuote({
  titolo: L.t('quote.cassaSeparata'),
  sottotitolo: L.t('quote.cassaSeparataNota', totals.sepDaysCount),
  elenco: totals.breakdown.filter(b => b.mealsSep > 0 || b.paySep > 0.005),
  quotaDi: b => b.paySep,
  pastiDi: b => b.mealsSep,
  raccolto: totals.collectedSep,
  totale: totals.foodDrinksSep,
  scarto: totals.roundingDiffSep,
  buchi: totals.buchi.filter(x => x.cassa === 'separata'),
  nonRipartito: totals.nonRipartitoSep,
  vuoto: L.t('quote.separataVuota'),
  avviso: totals.foodDrinksSep > 0 && totals.adultMealsSep === 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, frase('quote.separataSenzaPasti', money(totals.foodDrinksSep))) : null
}), cassaSepAttiva && totals.breakdown.length > 0 && /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
}, L.t('quote.totaleAPersona')), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug mb-2"
}, L.t('quote.totaleNota')), /*#__PURE__*/React.createElement("ul", {
  className: "divide-y divide-[#8F9E8B]/20"
}, totals.breakdown.map(b => /*#__PURE__*/React.createElement("li", {
  key: b.id,
  className: "flex items-center justify-between py-2"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex flex-col"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-normale font-bold text-[#2D392C]"
}, b.name), /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo text-gray-500"
}, b.isChild ? L.t('quote.bambino') : L.t('quote.comunePiuSeparata', money(b.payComune), money(b.paySep)))), /*#__PURE__*/React.createElement("span", {
  className: `font-rustic font-bold ${b.isChild ? 'text-gray-400' : 'text-[#2D392C]'}`
}, b.isChild ? L.t('quote.gratis') : `${money(b.pay)} €`)))), /*#__PURE__*/React.createElement("div", {
  className: "flex justify-between items-center pt-2 mt-1 border-t border-[#8F9E8B]/30"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase font-bold text-gray-500"
}, L.t('quote.totaleRaccolto')), /*#__PURE__*/React.createElement("span", {
  className: "font-rustic font-bold text-[#2D392C]"
}, money(totals.collected), " \u20AC")))), spesaSection === 'saldi' && /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, cassaSepAttiva && (risparmio > 0 || saldiOttimizzati) && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("button", {
  onClick: () => setSaldiOttimizzati(!saldiOttimizzati),
  className: bottoneScelta('interruttore', 'bordato', saldiOttimizzati, 'minuscolo', 'w-full')
}, saldiOttimizzati ? L.t('saldi.tornaPerCassa') : L.t('saldi.ottimizza', totals.transfers.length, totals.transfersOttimizzati.length)), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic mt-1 leading-snug"
}, L.t(saldiOttimizzati ? 'saldi.notaOttimizzati' : 'saldi.notaPerCassa'))), saldiOttimizzati ? schedaSaldi({
  cassa: cassaUnica,
  titolo: L.t('saldi.passaggiOttimizzati'),
  sottotitolo: L.t('saldi.passaggiNota'),
  scarto: totals.roundingDiff,
  nonRipartito: totals.nonRipartito
}) : /*#__PURE__*/React.createElement(React.Fragment, null, schedaSaldi({
  cassa: totals.casse.comune,
  titolo: L.t(cassaSepAttiva ? 'saldi.cassaComune' : 'saldi.finale'),
  sottotitolo: cassaSepAttiva ? L.t('saldi.cassaComuneNota') : null,
  scarto: totals.roundingDiffComune,
  nonRipartito: totals.nonRipartitoComune
}), cassaSepAttiva && schedaSaldi({
  cassa: totals.casse.separata,
  titolo: L.t('saldi.cassaSeparata'),
  sottotitolo: L.t('saldi.cassaSeparataNota', totals.sepDaysCount),
  scarto: totals.roundingDiffSep,
  nonRipartito: totals.nonRipartitoSep,
  vuoto: L.t('saldi.separataVuota')
})), /*#__PURE__*/React.createElement("button", {
  onClick: shareReport,
  className: bottone('whatsapp', 'grande', 'w-full flex items-center justify-center gap-2')
}, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCE4"), " ", L.t('saldi.condividi')), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic text-center"
}, L.t('saldi.condividiNota'))), spesaSection === 'dati' && /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, admin && /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] flex items-center gap-2"
}, /*#__PURE__*/React.createElement("span", null, L.t('chiusura.contiTitolo')), bloccoConti() && /*#__PURE__*/React.createElement("span", {
  className: "ml-auto text-minuto uppercase font-bold px-2 py-1 rounded bg-[#5C4A3C] text-white"
}, L.t('chiusura.chiusi'))), bloccoConti() ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug"
}, frase('chiusura.contiChiusiNota', L.data(new Date(bloccoConti().at), 'dataOra'))), /*#__PURE__*/React.createElement("button", {
  onClick: riapriConti,
  className: bottone('secondario', 'normale', 'w-full')
}, L.t('chiusura.riapri'))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug"
}, frase('chiusura.daFare')), /*#__PURE__*/React.createElement("button", {
  onClick: chiudiConti,
  className: bottone('bruno', 'normale', 'w-full')
}, L.t('chiusura.chiudi')))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('backup.titolo')), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500"
}, L.t('backup.nota')), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: exportData,
  className: bottone('primario', 'normale', 'flex-1')
}, L.t('backup.esporta')), admin && /*#__PURE__*/React.createElement("label", {
  className: "flex-1 py-2.5 bg-[#5C4A3C] text-white rounded text-piccolo font-bold uppercase text-center cursor-pointer hover:bg-[#463628]"
}, L.t('backup.importa'), /*#__PURE__*/React.createElement("input", {
  type: "file",
  accept: "application/json,.json",
  onChange: importData,
  className: "hidden"
}))), admin && /*#__PURE__*/React.createElement("button", {
  onClick: openRestore,
  className: "w-full py-2.5 bg-white border-2 border-[#D97706]/50 text-[#D97706] rounded text-piccolo font-bold uppercase hover:bg-[#D97706]/10"
}, L.t('backup.ripristino'))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#5C4A3C]/30 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('campo.chiusuraTitolo')), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500"
}, frase('campo.chiusuraNota')), admin ? /*#__PURE__*/React.createElement("button", {
  onClick: openClose,
  className: bottone('bruno', 'grande', 'w-full')
}, L.t('campo.chiudiEArchivia')) : /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-400 italic"
}, L.t('campo.laFaChiTieneIConti')), archives.length > 0 && /*#__PURE__*/React.createElement("button", {
  onClick: () => goTo('archivio'),
  className: bottone('testuale', 'normale', 'w-full')
}, L.t('campo.vediArchivio', archives.length))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande text-[#2D392C]"
}, L.t('cloud.titolo')), /*#__PURE__*/React.createElement("span", {
  className: `text-minuto uppercase font-bold px-2 py-1 rounded ${cloud.connected ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`
}, L.t(cloud.connected ? 'cloud.connesso' : 'cloud.nonConnesso'))), !(window.CloudSync && window.CloudSync.isConfigured()) ? /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 italic"
}, frase('cloud.nonConfigurato')) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500"
}, L.t('cloud.notaAuto')), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: campCodeInput,
  onChange: e => setCampCodeInput(e.target.value),
  placeholder: L.t('cloud.codiceCampo'),
  disabled: cloud.connected,
  className: "flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C] disabled:opacity-60"
}), cloud.connected ? /*#__PURE__*/React.createElement("button", {
  onClick: disconnectCloud,
  className: bottone('bruno', 'normale')
}, L.t('cloud.disconnetti')) : /*#__PURE__*/React.createElement("button", {
  onClick: () => connectCloud(campCodeInput),
  className: bottone('primario', 'normale')
}, L.t('cloud.connetti'))), /*#__PURE__*/React.createElement("div", {
  className: "flex items-start justify-between gap-2 text-piccolo text-gray-500"
}, /*#__PURE__*/React.createElement("span", {
  className: "min-w-0 break-words"
}, cloud.status === 'connecting' && L.t('cloud.inCorso'), cloud.status === 'saving' && L.t('cloud.salvataggio'), cloud.status === 'connected' && (cloud.lastSync ? L.t('cloud.ultimaSync', L.data(new Date(cloud.lastSync), 'oraPiena')) : L.t('cloud.inAscolto')), cloud.status === 'error' && /*#__PURE__*/React.createElement("span", {
  className: "text-red-700"
}, L.t('cloud.errore', cloud.error)), cloud.status === 'idle' && L.t(localStorage.getItem('cambusa_sync_optout') === '1' ? 'cloud.disattivata' : 'cloud.inAttesa')), !isOnline && /*#__PURE__*/React.createElement("span", {
  className: "text-[#D97706] font-bold shrink-0"
}, L.t('cloud.offline')))))));
const schedaLista = ({
  addPurchase,
  addToBuy,
  attachReceiptTo,
  listaSection,
  manualOpen,
  newBuyName,
  newBuyQty,
  onReceiptFile,
  openEditPurchase,
  pAccount,
  pBuyer,
  pName,
  pPrice,
  pReceipt,
  pType,
  purchaseQuery,
  purchases,
  receipts,
  removePurchase,
  removeToBuy,
  renderBuyerSelect,
  sepDays,
  setBuying,
  setListaSection,
  setManualOpen,
  setNewBuyName,
  setNewBuyQty,
  setPAccount,
  setPBuyer,
  setPName,
  setPPrice,
  setPReceipt,
  setPType,
  setPurchaseQuery,
  setToBuyQuery,
  setViewReceipt,
  spesePotenzialmenteDoppie,
  toBuy,
  toBuyQuery,
  totals
}) => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-2 gap-2"
}, [['daacquistare', L.t('sezione.daAcquistare'), toBuy.length], ['acquistato', L.t('lista.acquistato'), purchases.length]].map(([k, l, n]) => /*#__PURE__*/React.createElement("button", {
  key: k,
  onClick: () => setListaSection(k),
  className: bottoneScelta('linguetta', 'sezione', listaSection === k, 'minuscolo')
}, l, n > 0 ? ` (${n})` : ''))), listaSection === 'daacquistare' && /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#5C4A3C]/30 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande text-[#2D392C]"
}, L.t('lista.daAcquistareTitolo')), toBuy.length > 0 && /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase font-bold text-gray-500"
}, L.t('lista.quanteVoci', toBuy.length))), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: newBuyName,
  onChange: e => setNewBuyName(e.target.value),
  onKeyDown: e => e.key === 'Enter' && addToBuy(),
  placeholder: L.t('lista.cosaServe'),
  className: "flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
}), /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: newBuyQty,
  onChange: e => setNewBuyQty(e.target.value),
  onKeyDown: e => e.key === 'Enter' && addToBuy(),
  placeholder: L.t('lista.qta'),
  className: "w-20 shrink-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale text-center focus:outline-none focus:border-[#2D392C]"
}), /*#__PURE__*/React.createElement("button", {
  onClick: addToBuy,
  "aria-label": L.t('lista.aggiungiAllaLista'),
  className: bottoneIcona('pieno', 'shrink-0')
}, "+")), toBuy.length > 4 && /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: toBuyQuery,
  onChange: e => setToBuyQuery(e.target.value),
  placeholder: L.t('lista.cerca'),
  className: "flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
}), toBuyQuery && /*#__PURE__*/React.createElement("button", {
  onClick: () => setToBuyQuery(''),
  "aria-label": L.t('lista.azzeraRicerca'),
  className: bottoneIcona('neutro', 'shrink-0')
}, "\xD7")), toBuy.length === 0 ? /*#__PURE__*/React.createElement("p", {
  className: "text-normale text-gray-400 italic"
}, L.t('lista.vuota')) : (() => {
  const q = toBuyQuery.trim().toLowerCase();
  const visibili = toBuy.filter(it => !q || (it.name || '').toLowerCase().includes(q) || (it.qty || '').toLowerCase().includes(q));
  return /*#__PURE__*/React.createElement(React.Fragment, null, q && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo uppercase font-bold text-gray-500"
  }, L.t('lista.trovate', visibili.length, toBuy.length))), visibili.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-normale text-gray-400 italic"
  }, L.t('lista.nienteCorrisponde', toBuyQuery)) : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, visibili.map(it => /*#__PURE__*/React.createElement("li", {
    key: it.id,
    className: "bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-grow min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-normale font-bold text-[#2D392C] leading-snug break-words"
  }, it.name), it.qty && /*#__PURE__*/React.createElement("div", {
    className: "text-piccolo text-gray-500"
  }, L.t('lista.quantita', it.qty))), receipts[it.id] && /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewReceipt(receipts[it.id]),
    "aria-label": L.t('lista.vediScontrino'),
    className: bottoneIcona('pieno', 'shrink-0')
  }, "\uD83D\uDCF7"), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeToBuy(it.id),
    "aria-label": L.t('dotazioni.rimuovi'),
    className: bottoneIcona('distruttivo', 'shrink-0')
  }, "\xD7")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setBuying({
      id: it.id,
      name: it.name,
      qty: it.qty,
      price: '',
      buyer: '',
      type: 'alimentare',
      account: 'comune'
    }),
    className: bottone('bruno', 'normale', 'mt-2 w-full')
  }, L.t('lista.segnaAcquistata'))))));
})(), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic"
}, L.t('lista.notaPassaggio'))), listaSection === 'acquistato' && /*#__PURE__*/React.createElement(React.Fragment, null, !manualOpen ? /*#__PURE__*/React.createElement("button", {
  onClick: () => setManualOpen(true),
  className: "w-full bg-white p-3 rounded-lg border-2 border-dashed border-[#8F9E8B]/60 text-[#2D392C] hover:bg-[#E2EAE4] flex items-center justify-center gap-2"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-grande leading-none"
}, "\uFF0B"), /*#__PURE__*/React.createElement("span", {
  className: "font-bold uppercase text-piccolo tracking-wide"
}, L.t('lista.aggiungiAMano'))) : /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande text-[#2D392C]"
}, L.t('lista.prodottoAcquistato')), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-2 shrink-0"
}, /*#__PURE__*/React.createElement("label", {
  title: L.t('lista.scontrinoTitolo'),
  "aria-label": L.t('lista.allegaScontrino'),
  className: `cursor-pointer px-3 py-2 rounded border-2 text-grande leading-none ${pReceipt ? 'bg-[#2D392C] border-[#2D392C]' : 'bg-white border-[#8F9E8B]/50 hover:bg-[#E2EAE4]'}`
}, "\uD83D\uDCF7", /*#__PURE__*/React.createElement("input", {
  type: "file",
  accept: "image/*",
  onChange: onReceiptFile,
  className: "hidden"
})), /*#__PURE__*/React.createElement("button", {
  onClick: () => setManualOpen(false),
  "aria-label": L.t('lista.chiudiMaschera'),
  className: bottoneIcona('neutro')
}, "\xD7"))), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 -mt-1"
}, L.t('lista.nonEraInLista')), pReceipt && /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-3 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/30"
}, /*#__PURE__*/React.createElement("img", {
  src: pReceipt,
  alt: L.t('lista.scontrino'),
  className: "w-12 h-12 object-cover rounded"
}), /*#__PURE__*/React.createElement("span", {
  className: "flex-grow text-piccolo text-[#2D392C] font-bold"
}, L.t('lista.scontrinoAllegato')), /*#__PURE__*/React.createElement("button", {
  onClick: () => setPReceipt(null),
  "aria-label": L.t('lista.rimuoviFoto'),
  className: bottoneIcona('distruttivo')
}, "\xD7")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
  className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
}, L.t('lista.nome')), /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: pName,
  onChange: e => setPName(e.target.value),
  placeholder: L.t('lista.esempioNome'),
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
})), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
  className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
}, L.t('lista.acquirente')), renderBuyerSelect(pBuyer, setPBuyer)), /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-2 gap-3"
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
  className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
}, L.t('lista.prezzo')), /*#__PURE__*/React.createElement("input", {
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
  className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
}, L.t('lista.tipologia')), /*#__PURE__*/React.createElement("select", {
  value: pType,
  onChange: e => setPType(e.target.value),
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale font-bold focus:outline-none focus:border-[#2D392C]"
}, Object.keys(PURCHASE_TYPES).map(k => /*#__PURE__*/React.createElement("option", {
  key: k,
  value: k
}, tipoSpesa(k)))))), pType !== 'logistica' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
  className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
}, L.t('lista.conto')), /*#__PURE__*/React.createElement("select", {
  value: pAccount,
  onChange: e => setPAccount(e.target.value),
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale font-bold focus:outline-none focus:border-[#2D392C]"
}, /*#__PURE__*/React.createElement("option", {
  value: "comune"
}, L.t('lista.contoComune')), /*#__PURE__*/React.createElement("option", {
  value: "sep"
}, L.t('giorno.contoSeparato'))), pAccount === 'sep' && /*#__PURE__*/React.createElement("p", {
  className: "text-minuto mt-1 leading-snug text-[#5C4A3C]"
}, sepDays.length === 0 ? L.t('lista.senzaGiorniSpuntati') : L.t('lista.siDivide', sepDays.length))), /*#__PURE__*/React.createElement("button", {
  onClick: addPurchase,
  className: bottone('primario', 'grande', 'w-full')
}, L.t('lista.salva'))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande text-[#2D392C]"
}, L.t('lista.cronologia')), purchases.length > 0 && /*#__PURE__*/React.createElement("span", {
  className: "font-rustic font-bold text-[#2D392C]"
}, money(totals.overallTotal), " \u20AC")), purchases.length > 4 && /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2 mb-3"
}, /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: purchaseQuery,
  onChange: e => setPurchaseQuery(e.target.value),
  placeholder: L.t('lista.cercaSpese'),
  className: "flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
}), purchaseQuery && /*#__PURE__*/React.createElement("button", {
  onClick: () => setPurchaseQuery(''),
  "aria-label": L.t('lista.azzeraRicerca'),
  className: bottoneIcona('neutro', 'shrink-0')
}, "\xD7")), spesePotenzialmenteDoppie().map(g => /*#__PURE__*/React.createElement("div", {
  key: g[0].id,
  className: "bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5 mb-3"
}, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#5C4A3C] leading-snug"
}, frase('lista.doppia', g[0].name, money(posNum(g[0].price)), g.length, g.some(x => (x.buyer || '') !== (g[0].buyer || '')) ? [...new Set(g.map(x => x.buyer || '—'))].join(' e ') : null)))), purchases.length === 0 ? /*#__PURE__*/React.createElement("p", {
  className: "text-normale text-gray-400 italic"
}, L.t('lista.nessunAcquisto')) : (() => {
  const q = purchaseQuery.trim().toLowerCase();
  const visibili = purchases.slice().reverse().filter(p => !q || (p.name || '').toLowerCase().includes(q) || (p.buyer || '').toLowerCase().includes(q) || tipoSpesa(p.type).toLowerCase().includes(q));
  const sommaVisibili = visibili.reduce((s, p) => s + posNum(p.price), 0);
  return /*#__PURE__*/React.createElement(React.Fragment, null, q && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20 mb-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo uppercase font-bold text-gray-500"
  }, L.t('lista.trovate', visibili.length, purchases.length)), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C] text-normale"
  }, money(sommaVisibili), " \u20AC")), visibili.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-normale text-gray-400 italic"
  }, L.t('lista.nessunaSpesaCorrisponde', purchaseQuery)) : /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, visibili.map(p =>
  /*#__PURE__*/
  // Due livelli: sopra il nome del prodotto, che ha tutta la
  // riga per sé (prima veniva tagliato dalle etichette e dal
  // prezzo che gli stavano accanto); sotto le informazioni.
  React.createElement("li", {
    key: p.id,
    className: "bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20 space-y-1.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-normale font-bold text-[#2D392C] leading-snug break-words min-w-0"
  }, p.name), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C] shrink-0 whitespace-nowrap"
  }, money(posNum(p.price)), " \u20AC")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-center gap-1 min-w-0 flex-grow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-minuto uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#8F9E8B]"
  }, tipoSpesa(p.type) || p.type), p.account === 'sep' && p.type !== 'logistica' && /*#__PURE__*/React.createElement("span", {
    className: "text-minuto uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#5C4A3C]"
  }, L.t('lista.separatoEtichetta')), p.fromList && /*#__PURE__*/React.createElement("span", {
    className: "text-minuto uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#5C4A3C]"
  }, L.t('lista.acquistataEtichetta')), /*#__PURE__*/React.createElement("span", {
    className: "text-minuto text-gray-400 basis-full"
  }, p.buyer ? /*#__PURE__*/React.createElement("span", {
    className: "text-[#5C4A3C] font-bold"
  }, p.buyer) : /*#__PURE__*/React.createElement("span", {
    className: "italic"
  }, L.t('lista.acquirenteIgnoto')), p.at && ` · ${L.data(new Date(p.at), 'breve')} ${L.data(new Date(p.at), 'ora')}`)), receipts[p.id] ? /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewReceipt(receipts[p.id]),
    "aria-label": L.t('lista.vediScontrino'),
    className: bottoneIcona('pieno', 'shrink-0')
  }, "\uD83D\uDCF7") : /*#__PURE__*/React.createElement("label", {
    title: L.t('lista.scontrinoTitolo'),
    "aria-label": L.t('lista.allegaScontrino'),
    className: "shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-[#8F9E8B]/50 bg-white text-normale leading-none hover:bg-[#E2EAE4]"
  }, "\uD83D\uDCF7", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: e => attachReceiptTo(e, p.id),
    className: "hidden"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => openEditPurchase(p),
    "aria-label": L.t('lista.correggi'),
    title: L.t('lista.correggiSpesa'),
    className: bottoneIcona('neutro', 'shrink-0')
  }, "\u270F\uFE0F"), /*#__PURE__*/React.createElement("button", {
    onClick: () => removePurchase(p.id),
    "aria-label": L.t('dotazioni.rimuovi'),
    className: bottoneIcona('distruttivo', 'shrink-0')
  }, "\xD7"))))));
})(), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic mt-2"
}, L.t('lista.notaScontrini')))));
const schedaAttrezzatura = ({
  addEquip,
  attachReceiptTo,
  equipment,
  newEquipBuyer,
  newEquipPrice,
  newEquipText,
  openEditEquip,
  receipts,
  removeEquip,
  renderBuyerSelect,
  setNewEquipBuyer,
  setNewEquipPrice,
  setNewEquipText,
  setViewReceipt,
  toggleEquipBought
}) => {
  const equipBoughtTotal = equipment.reduce((s, e) => e.bought ? s + posNum(e.price) : s, 0);
  const equipPlannedTotal = equipment.reduce((s, e) => s + posNum(e.price), 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, L.t('attrezzatura.aggiungiTitolo')), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: newEquipText,
    onChange: e => setNewEquipText(e.target.value),
    placeholder: L.t('attrezzatura.esempio'),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
  }, L.t('attrezzatura.acquirenteFacoltativo')), renderBuyerSelect(newEquipBuyer, setNewEquipBuyer)), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    step: "0.01",
    inputMode: "decimal",
    value: newEquipPrice,
    onChange: e => setNewEquipPrice(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addEquip(),
    placeholder: L.t('lista.prezzo'),
    className: "flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addEquip,
    className: bottone('primario', 'normale', 'shrink-0')
  }, L.t('attrezzatura.aggiungi'))), /*#__PURE__*/React.createElement("p", {
    className: "text-minuto text-gray-400"
  }, L.t('attrezzatura.nota'))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-grande text-[#2D392C]"
  }, L.t('area.attrezzatura')), equipment.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo uppercase font-bold text-gray-500"
  }, L.t('attrezzatura.daComprare', equipment.filter(e => !e.bought).length))), equipment.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-normale text-gray-400 italic"
  }, L.t('attrezzatura.vuota')) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, equipment.map(e =>
  /*#__PURE__*/
  // Nome sulla sua riga, prezzo e comandi sotto: in fila su una
  // riga sola il titolo restava schiacciato in due centimetri e
  // non si leggeva più.
  React.createElement("li", {
    key: e.id,
    className: "bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => toggleEquipBought(e.id),
    "aria-label": L.t(e.bought ? 'attrezzatura.segnaDaComprare' : 'attrezzatura.segnaAcquistato'),
    className: bottoneScelta('casella', 'casella', e.bought, 'simbolo', 'mt-0.5')
  }, "\u2713"), /*#__PURE__*/React.createElement("div", {
    className: "flex-grow min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: `text-normale leading-snug break-words ${e.bought ? 'line-through text-gray-500' : 'text-[#2D392C]'}`
  }, e.text), e.buyer && /*#__PURE__*/React.createElement("div", {
    className: "text-minuto text-[#5C4A3C] font-bold break-words"
  }, e.buyer)), /*#__PURE__*/React.createElement("span", {
    className: `font-rustic font-bold shrink-0 ${e.bought ? 'text-[#2D392C]' : 'text-gray-400'}`
  }, money(posNum(e.price)), " \u20AC")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[#8F9E8B]/20"
  }, receipts[e.id] ? /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewReceipt(receipts[e.id]),
    "aria-label": L.t('lista.vediScontrino'),
    className: bottoneIcona('pieno', 'shrink-0')
  }, "\uD83D\uDCF7") : /*#__PURE__*/React.createElement("label", {
    title: L.t('lista.scontrinoTitolo'),
    "aria-label": L.t('lista.allegaScontrino'),
    className: "shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-[#8F9E8B]/50 bg-white text-normale leading-none hover:bg-[#E2EAE4]"
  }, "\uD83D\uDCF7", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    onChange: ev => attachReceiptTo(ev, e.id),
    className: "hidden"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => openEditEquip(e),
    "aria-label": L.t('lista.correggi'),
    title: L.t('attrezzatura.correggiVoce'),
    className: bottoneIcona('neutro', 'shrink-0')
  }, "\u270F\uFE0F"), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeEquip(e.id),
    "aria-label": L.t('dotazioni.rimuovi'),
    className: bottoneIcona('distruttivo', 'shrink-0')
  }, "\xD7"))))), /*#__PURE__*/React.createElement("div", {
    className: "mt-3 pt-2 border-t border-[#8F9E8B]/30 space-y-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between text-piccolo text-gray-500"
  }, /*#__PURE__*/React.createElement("span", {
    className: "uppercase font-bold"
  }, L.t('attrezzatura.previsto')), /*#__PURE__*/React.createElement("span", {
    className: "font-bold"
  }, money(equipPlannedTotal), " \u20AC")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo uppercase font-bold text-[#2D392C]"
  }, L.t('attrezzatura.acquistatoNelleSpese')), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C]"
  }, money(equipBoughtTotal), " \u20AC"))))));
};
// ---------- Schede del gruppo: Membri, Regole, Dotazioni personali ----------
// Vedi 81-schede-giorno.jsx per il perche' sono funzioni e non componenti.

const schedaMembri = ({
  addMember,
  infoMember,
  members,
  membriDoppi,
  newMemberChild,
  newMemberName,
  removeMember,
  setInfoMember,
  setMemberField,
  setNewMemberChild,
  setNewMemberName,
  toggleChild,
  toggleEquipExempt,
  unisciDoppi
}) => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, membriDoppi().map(g => /*#__PURE__*/React.createElement("div", {
  key: g[0].id,
  className: "bg-[#D97706]/10 border-2 border-[#D97706]/40 rounded-lg p-3 space-y-2"
}, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#5C4A3C] leading-snug"
}, frase('membri.doppia', g[0].name, g.length)), /*#__PURE__*/React.createElement("button", {
  onClick: () => unisciDoppi(g),
  className: bottone('avviso', 'normale', 'w-full')
}, L.t('membri.unisci')), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-500 italic leading-snug"
}, L.t('membri.unisciNota')))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('membri.aggiungiTitolo')), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: newMemberName,
  onChange: e => setNewMemberName(e.target.value),
  onKeyDown: e => e.key === 'Enter' && addMember(),
  placeholder: L.t('membri.nome'),
  className: "flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
}), /*#__PURE__*/React.createElement("button", {
  onClick: addMember,
  className: bottoneIcona('pieno')
}, "+")), /*#__PURE__*/React.createElement("label", {
  className: "flex items-center gap-2 text-piccolo text-gray-600"
}, /*#__PURE__*/React.createElement("input", {
  type: "checkbox",
  checked: newMemberChild,
  onChange: e => setNewMemberChild(e.target.checked)
}), L.t('membri.bambinoGratis'))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
}, L.t('membri.quanti', members.length)), members.length === 0 ? /*#__PURE__*/React.createElement("p", {
  className: "text-normale text-gray-400 italic"
}, L.t('membri.vuoto')) : /*#__PURE__*/React.createElement("ul", {
  className: "space-y-2"
}, members.map(m => /*#__PURE__*/React.createElement("li", {
  key: m.id,
  className: "bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between gap-2"
}, /*#__PURE__*/React.createElement("span", {
  className: "font-bold text-normale text-[#2D392C] truncate"
}, m.name, (m.paypal || m.iban) && /*#__PURE__*/React.createElement("span", {
  className: "ml-1.5 text-minuto text-[#8F9E8B]",
  title: L.t('membri.haRimborso')
}, "\uD83D\uDCB3")), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-2 shrink-0"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => setInfoMember(v => v === m.id ? null : m.id),
  "aria-label": L.t('membri.datiDi', m.name),
  title: L.t('membri.datiRimborso'),
  className: `w-6 h-6 rounded-full border-2 font-serif italic font-bold text-piccolo leading-none flex items-center justify-center ${infoMember === m.id ? 'bg-[#2D392C] border-[#2D392C] text-white' : 'bg-white border-[#8F9E8B] text-[#5C4A3C]'}`
}, "i"), /*#__PURE__*/React.createElement("button", {
  onClick: () => toggleChild(m.id),
  className: bottoneScelta('etichetta', 'ambra', m.isChild, 'minimo')
}, L.t(m.isChild ? 'membri.bambino' : 'membri.adulto')), /*#__PURE__*/React.createElement("button", {
  onClick: () => removeMember(m.id),
  className: bottoneIcona('distruttivo')
}, "\xD7"))), infoMember === m.id && /*#__PURE__*/React.createElement("div", {
  className: "mt-2.5 pt-2.5 border-t border-[#8F9E8B]/30 space-y-2"
}, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug"
}, frase('membri.comeRimborso')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
  className: "block text-minuto uppercase font-bold text-gray-500 tracking-wide mb-1"
}, "PayPal"), /*#__PURE__*/React.createElement("input", {
  type: "text",
  inputMode: "email",
  value: m.paypal || '',
  onChange: e => setMemberField(m.id, 'paypal', e.target.value),
  placeholder: L.t('membri.paypalSegno'),
  className: "w-full p-2 bg-white border border-[#8F9E8B]/40 rounded text-normale focus:outline-none focus:border-[#2D392C]"
})), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
  className: "block text-minuto uppercase font-bold text-gray-500 tracking-wide mb-1"
}, "IBAN"), /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: m.iban || '',
  onChange: e => setMemberField(m.id, 'iban', e.target.value.toUpperCase()),
  onBlur: e => {
    const p = ibanPretty(e.target.value);
    if (p !== (m.iban || '')) setMemberField(m.id, 'iban', p);
  },
  placeholder: L.t('membri.ibanSegno'),
  className: "w-full p-2 bg-white border border-[#8F9E8B]/40 rounded text-piccolo font-mono focus:outline-none focus:border-[#2D392C]"
}), (m.iban || '').trim() !== '' && (ibanValid(m.iban) ? /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-[#2D392C] mt-1"
}, L.t('membri.ibanOk')) : /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-[#D97706] mt-1"
}, L.t('membri.ibanNo')))), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic leading-snug"
}, L.t('membri.datiDove'))), FEATURES.equipExemption && /*#__PURE__*/React.createElement("button", {
  onClick: () => toggleEquipExempt(m.id),
  "aria-label": L.t('membri.esenzione'),
  className: "mt-1.5 flex items-center gap-2 text-left"
}, /*#__PURE__*/React.createElement("span", {
  className: `w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-piccolo font-bold ${m.equipExempt ? 'bg-[#5C4A3C] border-[#5C4A3C] text-white' : 'bg-white border-[#8F9E8B]'}`
}, m.equipExempt ? '✓' : ''), /*#__PURE__*/React.createElement("span", {
  className: `text-piccolo ${m.equipExempt ? 'font-bold text-[#5C4A3C]' : 'text-gray-500'}`
}, L.t('membri.esente'))))))));

// Le Regole non dipendono da niente: e' l'unica scheda che si disegna da
// sola, e infatti l'elenco delle dipendenze e' vuoto.
const schedaRegole = () => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
}, L.t('regole.titolo')), /*#__PURE__*/React.createElement("ol", {
  className: "space-y-3"
}, CAMP_RULES.map((text, i) => /*#__PURE__*/React.createElement("li", {
  key: i,
  className: "flex gap-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20"
}, /*#__PURE__*/React.createElement("span", {
  className: "font-rustic text-grande text-[#5C4A3C] leading-none shrink-0"
}, i + 1, "."), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo leading-relaxed uppercase underline underline-offset-2 decoration-[#8F9E8B]/70 font-bold text-[#2D392C]"
}, text))))));
const schedaDotazioni = ({
  addGear,
  gear,
  newGearText,
  removeGear,
  setNewGearText
}) => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
}, L.t('dotazioni.base')), /*#__PURE__*/React.createElement("ul", {
  className: "space-y-2"
}, BASE_GEAR.map(item => /*#__PURE__*/React.createElement("li", {
  key: item.text,
  className: `flex items-center gap-3 rounded border p-2.5 ${item.emphasis ? 'bg-[#D97706]/10 border-[#D97706]/40' : 'bg-[#F0F4F1]/60 border-[#8F9E8B]/20'}`
}, /*#__PURE__*/React.createElement("span", {
  className: `shrink-0 rounded-full bg-[#D97706] ${item.emphasis ? 'w-2 h-2' : 'w-1.5 h-1.5'}`
}), /*#__PURE__*/React.createElement("span", {
  className: item.emphasis ? 'text-medio font-bold uppercase underline decoration-2 underline-offset-2 text-[#2D392C] leading-snug' : 'text-normale text-[#2D392C]'
}, item.text)))), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic mt-2"
}, L.t('dotazioni.obbligo'))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('dotazioni.aggiunte')), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: newGearText,
  onChange: e => setNewGearText(e.target.value),
  onKeyDown: e => e.key === 'Enter' && addGear(),
  placeholder: L.t('dotazioni.esempio'),
  className: "flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
}), /*#__PURE__*/React.createElement("button", {
  onClick: addGear,
  "aria-label": L.t('dotazioni.aggiungi'),
  className: bottoneIcona('pieno')
}, "+")), gear.length === 0 ? /*#__PURE__*/React.createElement("p", {
  className: "text-normale text-gray-400 italic"
}, L.t('dotazioni.vuoto')) : /*#__PURE__*/React.createElement("ul", {
  className: "space-y-2"
}, gear.map(g => /*#__PURE__*/React.createElement("li", {
  key: g.id,
  className: "flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20"
}, /*#__PURE__*/React.createElement("span", {
  className: "w-1.5 h-1.5 bg-[#8F9E8B] rounded-full shrink-0"
}), /*#__PURE__*/React.createElement("span", {
  className: "flex-grow text-normale text-[#2D392C]"
}, g.text), /*#__PURE__*/React.createElement("button", {
  onClick: () => removeGear(g.id),
  "aria-label": L.t('dotazioni.rimuovi'),
  className: bottoneIcona('distruttivo')
}, "\xD7"))))));
// ---------- Archivio, gioco e guida ----------
// La Galleria sta a parte in 85-scheda-galleria.jsx: e' la piu' grossa delle
// quattro ed e' stata la prima a uscire.

const schedaArchivio = ({
  album,
  archives,
  cloud,
  downloadArchive,
  members,
  openAlbum,
  openPhoto,
  photos,
  purchases,
  removeArchive,
  setAlbum,
  setViewArchive,
  totals
}) => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3"
}, L.t('area.archivio')), archives.length === 0 ? /*#__PURE__*/React.createElement("p", {
  className: "text-normale text-gray-400 italic"
}, frase('archivio.vuoto')) : /*#__PURE__*/React.createElement("ul", {
  className: "space-y-3"
}, archives.map(a => /*#__PURE__*/React.createElement("li", {
  key: a.id,
  className: "bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20 space-y-2"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-start justify-between gap-2"
}, /*#__PURE__*/React.createElement("div", {
  className: "min-w-0"
}, /*#__PURE__*/React.createElement("p", {
  className: "font-rustic text-medio text-[#2D392C] truncate"
}, a.name), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500"
}, L.t('archivio.periodoChiuso', a.from === a.to ? a.from : `${a.from} → ${a.to}`, L.data(new Date(a.closedAt), 'numerica')))), /*#__PURE__*/React.createElement("span", {
  className: "font-rustic font-bold text-[#2D392C] shrink-0"
}, money(a.totals && a.totals.overall || 0), " \u20AC")), /*#__PURE__*/React.createElement("div", {
  className: "flex flex-wrap gap-x-3 gap-y-1 text-piccolo text-gray-500"
}, /*#__PURE__*/React.createElement("span", null, L.t('archivio.membri', a.totals && a.totals.members || 0)), /*#__PURE__*/React.createElement("span", null, L.t('archivio.spese', a.totals && a.totals.purchases || 0)), /*#__PURE__*/React.createElement("span", null, L.t('archivio.pasti', a.totals && a.totals.meals || 0)), a.photos > 0 && /*#__PURE__*/React.createElement("span", null, L.t('archivio.foto', a.photos)), !a.state && /*#__PURE__*/React.createElement("span", {
  className: "text-[#8F9E8B] italic"
}, L.t('archivio.soloCloud'))), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => setViewArchive(a),
  className: bottone('primario', 'normale', 'flex-1')
}, L.t('archivio.resoconto')), a.photos > 0 && /*#__PURE__*/React.createElement("button", {
  onClick: () => openAlbum(a),
  className: "flex-1 py-2 bg-[#8F9E8B] text-white rounded text-piccolo font-bold uppercase hover:brightness-95"
}, L.t('archivio.album')), /*#__PURE__*/React.createElement("button", {
  onClick: () => downloadArchive(a),
  className: bottone('bruno', 'normale', 'flex-1')
}, L.t('archivio.scarica')), /*#__PURE__*/React.createElement("button", {
  onClick: () => removeArchive(a),
  "aria-label": L.t('archivio.eliminaArchivio'),
  className: bottone('distruttivo', 'minuscolo')
}, L.t('archivio.elimina'))))))), album && /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande text-[#2D392C] truncate"
}, L.t('archivio.albumDi', album.name)), /*#__PURE__*/React.createElement("button", {
  onClick: () => setAlbum(null),
  className: bottone('testuale', 'minuscolo', 'shrink-0')
}, L.t('archivio.chiudi'))), album.loading ? /*#__PURE__*/React.createElement("p", {
  className: "text-normale text-gray-400 italic"
}, L.t('archivio.carico')) : album.photos.length === 0 ? /*#__PURE__*/React.createElement("p", {
  className: "text-normale text-gray-400 italic"
}, L.t('archivio.senzaFoto')) : /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-3 gap-1.5"
}, album.photos.map(p => /*#__PURE__*/React.createElement("button", {
  key: p.id,
  onClick: () => openPhoto(p),
  className: "relative aspect-square overflow-hidden rounded border border-[#8F9E8B]/30 bg-[#F0F4F1]",
  "aria-label": L.t('archivio.fotoDi', p.by || L.t('archivio.anonimo'))
}, /*#__PURE__*/React.createElement("img", {
  src: p.thumb,
  alt: "",
  className: "w-full h-full object-cover",
  loading: "lazy"
}), p.by && /*#__PURE__*/React.createElement("span", {
  className: "absolute bottom-0 left-0 right-0 bg-black/55 text-white text-minuto px-1 py-0.5 truncate text-left"
}, p.by))))), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic text-center px-4"
}, L.t('archivio.conservalo')));
const schedaGioco = ({
  endGame,
  gameBest,
  gamePlayer,
  gameRunning,
  leaderboard,
  refreshLeaderboard,
  setGamePlayer,
  setGameRunning,
  startGame
}) => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, !gameRunning ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('area.gioco')), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-3"
}, /*#__PURE__*/React.createElement("img", {
  src: "./bandy.png",
  alt: "Bandy",
  className: "w-14 h-14 rounded border-2 border-[#8F9E8B]/40 bg-[#F0F4F1]",
  style: {
    imageRendering: 'pixelated'
  }
}), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-600 leading-snug"
}, L.t('gioco.spiegazione'))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
  className: "block text-piccolo uppercase font-bold text-gray-500 mb-1"
}, L.t('gioco.nomeGiocatore')), /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: gamePlayer,
  onChange: e => setGamePlayer(e.target.value),
  onKeyDown: e => e.key === 'Enter' && startGame(),
  placeholder: L.t('gioco.comeTiChiami'),
  maxLength: 24,
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
})), /*#__PURE__*/React.createElement("button", {
  onClick: startGame,
  className: bottone('primario', 'grande', 'w-full')
}, L.t('gioco.gioca')), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic"
}, L.t('gioco.comandi'))), /*#__PURE__*/React.createElement("div", {
  className: "bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande"
}, L.t('gioco.classifica')), /*#__PURE__*/React.createElement("button", {
  onClick: refreshLeaderboard,
  className: "text-minuto uppercase font-bold text-[#8F9E8B] hover:text-white"
}, L.t('gioco.aggiorna'))), /*#__PURE__*/React.createElement("div", {
  className: "flex justify-between text-piccolo mb-3 pb-2 border-b border-[#8F9E8B]/20"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-[#8F9E8B]"
}, L.t('gioco.tuoRecord')), /*#__PURE__*/React.createElement("span", {
  className: "font-rustic text-[#D97706] text-grande leading-none"
}, gameBest)), leaderboard.length === 0 ? /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-400 italic"
}, L.t('gioco.senzaPunteggi')) : /*#__PURE__*/React.createElement("ul", {
  className: "space-y-1"
}, leaderboard.map((r, i) => /*#__PURE__*/React.createElement("li", {
  key: r.name + i,
  className: "flex items-center justify-between py-1"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-normale truncate"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-[#8F9E8B] mr-2"
}, i + 1, "."), i === 0 ? '🏆 ' : '', r.name), /*#__PURE__*/React.createElement("span", {
  className: "font-rustic font-bold text-[#D97706]"
}, r.score)))))) : /*#__PURE__*/React.createElement(BandyGame, {
  playerName: gamePlayer.trim(),
  bestLocal: gameBest,
  onGameOver: endGame,
  onExit: () => {
    setGameRunning(false);
    refreshLeaderboard();
  }
}));
const schedaGuida = ({
  GUIDE,
  guideOpen,
  setGuideOpen
}) => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-1"
}, L.t('guida.titolo')), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 mb-3"
}, L.t('guida.sottotitolo')), /*#__PURE__*/React.createElement("div", {
  className: "flex flex-wrap gap-1.5"
}, GUIDE.map(g => /*#__PURE__*/React.createElement("button", {
  key: g.k,
  onClick: () => setGuideOpen(g.k),
  className: bottoneScelta('pillola', 'tenue', guideOpen === g.k, 'minuscolo')
}, g.icon, " ", g.title))), (() => {
  const g = GUIDE.find(x => x.k === guideOpen) || GUIDE[0];
  return /*#__PURE__*/React.createElement("div", {
    className: "mt-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-grande leading-none"
  }, g.icon), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic text-[#2D392C]"
  }, g.title)), /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#2D392C] leading-relaxed"
  }, g.body));
})()), /*#__PURE__*/React.createElement("div", {
  className: "bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md"
}, /*#__PURE__*/React.createElement("h4", {
  className: "font-rustic text-medio mb-2"
}, L.t('guida.trePassi')), /*#__PURE__*/React.createElement("ol", {
  className: "text-piccolo space-y-1.5 list-decimal list-inside text-[#F0F4F1]/90"
}, /*#__PURE__*/React.createElement("li", null, frase('guida.passo1')), /*#__PURE__*/React.createElement("li", null, frase('guida.passo2')), /*#__PURE__*/React.createElement("li", null, frase('guida.passo3')))));
// ---------- Scheda Galleria ----------
// Primo pezzo di interfaccia uscito da 80-app.jsx.
//
// Non e' un componente React ma una funzione che restituisce JSX, e la
// differenza conta: nessun confine di riconciliazione nuovo, nessun hook
// spostato, l'albero prodotto e' identico a prima. E' spostamento di codice,
// non un cambio di comportamento — infatti si dimostra confrontando l'HTML
// prodotto, che dev'essere lo stesso al carattere.
//
// L'elenco qui sotto e' il punto: sono le VENTINOVE cose che il disegno della
// galleria si prendeva dalla chiusura di App() senza dirlo. Scritte, si
// vedono; e quando saranno poche abbastanza, la galleria potra' diventare un
// modulo vero con il suo stato.
const schedaGalleria = ({
  PER_PAGINA_ALBUM,
  addPhotos,
  album,
  albumPage,
  albumRef,
  cloud,
  galleryView,
  generaRicordo,
  members,
  onScrollAlbum,
  openPhoto,
  paginaAlbum,
  pdfBusy,
  photoBusy,
  photoCap,
  photoWho,
  photos,
  photosBy,
  photosReady,
  picked,
  picking,
  setGalleryView,
  setPhotoWho,
  setPicked,
  setPicking,
  sfoglia,
  soloNome,
  togglePicked,
  uscitaScelta
}) => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('galleria.carica')), !cloud.connected ? /*#__PURE__*/React.createElement("p", {
  className: "text-normale text-gray-500 leading-snug"
}, frase('galleria.senzaCloud')) : /*#__PURE__*/React.createElement("div", {
  className: "space-y-3"
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
  className: "block text-minuto uppercase font-bold text-gray-500 tracking-wide mb-1"
}, L.t('galleria.chiScatta')), /*#__PURE__*/React.createElement("select", {
  value: photoWho,
  onChange: e => setPhotoWho(e.target.value),
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
}, /*#__PURE__*/React.createElement("option", {
  value: ""
}, L.t('galleria.scegliNome')), members.map(m => /*#__PURE__*/React.createElement("option", {
  key: m.id,
  value: m.name
}, m.name, " (", photosBy(m.name), "/", photoCap, ")"))), members.length === 0 && /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-[#D97706] mt-1"
}, L.t('galleria.primaMembri'))), photoWho && /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-600"
}, photosBy(photoWho) >= photoCap ? /*#__PURE__*/React.createElement("span", {
  className: "text-[#D97706] font-bold"
}, L.t('galleria.esaurite', photoWho, photoCap)) : frase('galleria.restano', photoWho, photoCap - photosBy(photoWho), photoCap)), /*#__PURE__*/React.createElement("label", {
  className: `block w-full py-3 rounded font-bold uppercase text-normale tracking-wide text-center cursor-pointer ${photoWho && photosBy(photoWho) < photoCap && !photoBusy ? 'bg-[#2D392C] text-white hover:bg-[#1F271E]' : 'bg-gray-200 text-gray-400 pointer-events-none'}`
}, photoBusy || L.t('galleria.scegliFoto'), /*#__PURE__*/React.createElement("input", {
  type: "file",
  accept: "image/*",
  multiple: true,
  onChange: addPhotos,
  className: "hidden"
})), (cloud.foto || 0) > 0 && /*#__PURE__*/React.createElement("div", {
  className: "bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5"
}, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#5C4A3C] leading-snug"
}, frase('galleria.inCoda', cloud.foto))), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic leading-snug"
}, frase('galleria.tetto', photoCap)))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3 gap-2"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande text-[#2D392C] shrink-0"
}, L.t('archivio.album'), " ", photos.length > 0 ? `(${photos.length})` : ''), photos.length > 0 && !picking && /*#__PURE__*/React.createElement("div", {
  className: "flex rounded border border-[#8F9E8B]/40 overflow-hidden shrink-0"
}, [['album', L.t('galleria.vistaAlbum')], ['griglia', L.t('galleria.vistaGriglia')]].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
  key: k,
  onClick: () => setGalleryView(k),
  className: bottoneScelta('giunta', 'piatto', galleryView === k, 'minuscolo')
}, l))), picking && /*#__PURE__*/React.createElement("button", {
  onClick: uscitaScelta,
  className: bottone('primario', 'minuscolo', 'shrink-0')
}, L.t('galleria.annulla'))), !cloud.connected ? /*#__PURE__*/React.createElement("p", {
  className: "text-normale text-gray-400 italic"
}, L.t('galleria.senzaLinea')) : !photosReady ? /*#__PURE__*/React.createElement("p", {
  className: "text-normale text-gray-400 italic"
}, L.t('archivio.carico')) : photos.length === 0 ? /*#__PURE__*/React.createElement("p", {
  className: "text-normale text-gray-400 italic"
}, L.t('galleria.ancoraNessuna')) : galleryView === 'album' && !picking ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  className: "album-sfoglio",
  ref: albumRef,
  onScroll: onScrollAlbum
}, paginaAlbum(photos).map((gruppo, i) => /*#__PURE__*/React.createElement("div", {
  key: i,
  className: `album-pagina ${gruppo.length === 1 ? '' : ''}`
}, /*#__PURE__*/React.createElement("div", {
  className: `album-griglia ${gruppo.length === 1 ? 'una' : ''}`
}, gruppo.map(p => /*#__PURE__*/React.createElement("button", {
  key: p.id,
  onClick: () => openPhoto(p),
  className: "polaroid",
  "aria-label": L.t('archivio.fotoDi', p.by || L.t('archivio.anonimo'))
}, /*#__PURE__*/React.createElement("img", {
  src: p.thumb,
  alt: "",
  loading: "lazy"
}), /*#__PURE__*/React.createElement("span", {
  className: "didascalia"
}, /*#__PURE__*/React.createElement("span", {
  className: "nome"
}, soloNome(p.by)), p.at ? /*#__PURE__*/React.createElement("span", {
  className: "quando"
}, L.data(new Date(p.at), 'numerica')) : null))))))), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-center gap-4 mt-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => sfoglia(-1),
  disabled: albumPage <= 0,
  "aria-label": L.t('galleria.paginaPrec'),
  className: `w-8 h-8 rounded-full border border-[#8F9E8B]/40 text-normale ${albumPage <= 0 ? 'text-gray-300' : 'text-[#2D392C]'}`
}, "\u2039"), /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo uppercase tracking-widest text-gray-500"
}, Math.min(albumPage + 1, paginaAlbum(photos).length), " / ", paginaAlbum(photos).length), /*#__PURE__*/React.createElement("button", {
  onClick: () => sfoglia(1),
  disabled: albumPage >= paginaAlbum(photos).length - 1,
  "aria-label": L.t('galleria.paginaSucc'),
  className: `w-8 h-8 rounded-full border border-[#8F9E8B]/40 text-normale ${albumPage >= paginaAlbum(photos).length - 1 ? 'text-gray-300' : 'text-[#2D392C]'}`
}, "\u203A"))) : /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-3 gap-1.5"
}, photos.map(p => {
  const scelta = picked.indexOf(p.id);
  return /*#__PURE__*/React.createElement("button", {
    key: p.id,
    onClick: () => picking ? togglePicked(p.id) : openPhoto(p),
    className: `relative aspect-square overflow-hidden rounded border bg-[#F0F4F1] ${scelta >= 0 ? 'border-[#2D392C] border-2' : 'border-[#8F9E8B]/30'}`,
    "aria-label": picking ? L.t('galleria.scegliQuesta', p.by || L.t('archivio.anonimo')) : L.t('archivio.fotoDi', p.by || L.t('archivio.anonimo'))
  }, /*#__PURE__*/React.createElement("img", {
    src: p.thumb,
    alt: "",
    className: `w-full h-full object-cover ${picking && scelta < 0 ? 'opacity-45' : ''}`,
    loading: "lazy"
  }), picking && /*#__PURE__*/React.createElement("span", {
    className: `absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-minuto font-bold border-2 ${scelta >= 0 ? 'bg-[#2D392C] text-white border-[#2D392C]' : 'bg-white/80 border-white'}`
  }, scelta >= 0 ? scelta + 1 : ''), p.by && /*#__PURE__*/React.createElement("span", {
    className: "absolute bottom-0 left-0 right-0 bg-black/55 text-white text-minuto px-1 py-0.5 truncate text-left"
  }, soloNome(p.by)));
})), picking && /*#__PURE__*/React.createElement("div", {
  className: "mt-3 pt-3 border-t border-[#8F9E8B]/30 space-y-2"
}, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-600"
}, picked.length === 0 ? L.t('galleria.toccaLeFoto') : frase('galleria.scelte', picked.length, photos.length, Math.ceil(picked.length / PER_PAGINA_ALBUM))), /*#__PURE__*/React.createElement("button", {
  onClick: () => generaRicordo(photos, false),
  disabled: picked.length === 0 || !!pdfBusy,
  className: bottone('bruno', 'grande', 'w-full')
}, pdfBusy || L.t('galleria.creaConScelte', picked.length)), /*#__PURE__*/React.createElement("button", {
  onClick: () => setPicked(photos.map(x => x.id)),
  disabled: !!pdfBusy || picked.length === photos.length,
  className: bottone('secondario', 'normale', 'w-full')
}, L.t('galleria.scegliTutte')), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic leading-snug"
}, L.t('galleria.notaScelte'))), photos.length > 0 && !picking && cloud.connected && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
  onClick: () => generaRicordo(photos, true),
  disabled: !!pdfBusy,
  className: bottone('bruno', 'grande', 'w-full mt-3')
}, pdfBusy || L.t('galleria.creaCompleto', photos.length)), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic mt-1.5 leading-snug"
}, frase('galleria.notaCompleto', Math.ceil(photos.length / PER_PAGINA_ALBUM))), /*#__PURE__*/React.createElement("button", {
  onClick: () => {
    setGalleryView('griglia');
    setPicking(true);
  },
  disabled: !!pdfBusy,
  className: bottone('secondario', 'normale', 'w-full mt-2')
}, L.t('galleria.scegliTu')), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic mt-2"
}, L.t('galleria.notaFinale')))));
// ---------- Scheda Impostazioni ----------
// La piu' grande di tutte, e la piu' intrecciata: aspetto, blocco, backup,
// modalita' tecnica, chiusura del campo. Sta da sola apposta.

const schedaImpostazioni = ({
  admin,
  adminErr,
  adminPwd,
  annullaSync,
  askAlways,
  bloccoOpen,
  campData,
  campoInCorso,
  cloud,
  datiOpen,
  diagTick,
  entraAdmin,
  esciAdmin,
  esportaRegistro,
  exportData,
  fotoDove,
  goTo,
  isDark,
  isOnline,
  lockNow,
  logOpen,
  members,
  metaRef,
  photoCap,
  purchases,
  readyChecks,
  readyOk,
  receipts,
  setAdminErr,
  setAdminPwd,
  setBloccoOpen,
  setDatiOpen,
  setDiagTick,
  setLogOpen,
  setLostSync,
  setPhotoCap,
  setTecnicaOpen,
  setTheme,
  swVersion,
  syncStateRef,
  tecnicaOpen,
  lingua,
  setLingua,
  account,
  stanzaStato,
  theme,
  toggleAskAlways,
  wipeLocal
}) => /*#__PURE__*/React.createElement("div", {
  className: "space-y-4"
}, /*#__PURE__*/React.createElement("div", {
  className: `p-4 rounded-lg border-2 shadow-sm space-y-3 ${!campoInCorso || readyOk ? 'bg-white border-[#2D392C]/20' : 'bg-white border-[#D97706]/50'}`
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande text-[#2D392C]"
}, L.t('pronto.titolo')), /*#__PURE__*/React.createElement("span", {
  className: `text-minuto uppercase font-bold px-2 py-1 rounded ${campoInCorso && !readyOk ? 'bg-[#D97706] text-white' : 'bg-[#2D392C] text-white'}`
}, L.t(!campoInCorso ? 'pronto.nessunCampo' : readyOk ? 'pronto.si' : 'pronto.nonAncora'))), !campoInCorso ? /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug"
}, frase('pronto.senzaCampo')) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug"
}, frase('pronto.treCose')), /*#__PURE__*/React.createElement("ul", {
  className: "space-y-2"
}, readyChecks.map(c => /*#__PURE__*/React.createElement("li", {
  key: c.titolo,
  className: `flex items-start gap-2 p-2.5 rounded border ${c.ok ? 'bg-[#F0F4F1]/60 border-[#8F9E8B]/20' : 'bg-[#D97706]/10 border-[#D97706]/40'}`
}, /*#__PURE__*/React.createElement("span", {
  className: "text-medio leading-none shrink-0"
}, c.ok ? '✅' : '⚠️'), /*#__PURE__*/React.createElement("div", {
  className: "min-w-0"
}, /*#__PURE__*/React.createElement("div", {
  className: "text-piccolo font-bold text-[#2D392C]"
}, c.titolo), !c.ok && /*#__PURE__*/React.createElement("div", {
  className: "text-piccolo text-[#5C4A3C] leading-snug mt-0.5"
}, c.no))))), readyOk && /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic"
}, L.t('pronto.tuttoBene')))), FEATURES.auth && /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('auth.titolo')), account.stato === 'registrato' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#2D392C] leading-snug"
}, frase('auth.entratoCome', window.Auth.nomeVisibile({
  nome: account.utente && account.utente.nome,
  email: account.utente && account.utente.email
}))), /*#__PURE__*/React.createElement("button", {
  onClick: account.esci,
  disabled: account.occupato,
  className: bottone('secondario', 'normale', 'w-full')
}, L.t('auth.esci'))), account.stato === 'daVerificare' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#5C4A3C] leading-snug"
}, frase('auth.daVerificare', account.utente && account.utente.email || '')), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: account.controllaVerifica,
  disabled: account.occupato,
  className: bottone('primario', 'normale', 'flex-1')
}, L.t('auth.hoVerificato')), /*#__PURE__*/React.createElement("button", {
  onClick: account.rimandaVerifica,
  disabled: account.occupato,
  className: bottone('secondario', 'normale', 'flex-1')
}, L.t('auth.rimandaEmail'))), /*#__PURE__*/React.createElement("button", {
  onClick: account.esci,
  disabled: account.occupato,
  className: bottone('testuale', 'minuscolo', 'w-full')
}, L.t('auth.esci'))), (account.stato === 'ospite' || account.stato === 'anonimo') && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug"
}, frase('auth.aCosaServe')), /*#__PURE__*/React.createElement("button", {
  onClick: account.entraConGoogle,
  disabled: account.occupato,
  className: bottone('primario', 'normale', 'w-full')
}, L.t('auth.conGoogle')), !account.modo ? /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-2"
}, /*#__PURE__*/React.createElement("span", {
  className: "flex-grow h-px bg-[#8F9E8B]/30"
}), /*#__PURE__*/React.createElement("span", {
  className: "text-minuto uppercase tracking-widest text-gray-400 shrink-0"
}, L.t('auth.oppure')), /*#__PURE__*/React.createElement("span", {
  className: "flex-grow h-px bg-[#8F9E8B]/30"
})) : null, !account.modo && /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => account.setModo('entra'),
  className: bottone('secondario', 'normale', 'flex-1')
}, L.t('auth.haiGiaAccount')), /*#__PURE__*/React.createElement("button", {
  onClick: () => account.setModo('registra'),
  className: bottone('secondario', 'normale', 'flex-1')
}, L.t('auth.creaAccount'))), account.modo && /*#__PURE__*/React.createElement("div", {
  className: "space-y-2 pt-1"
}, account.modo === 'registra' && /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-2 gap-2"
}, /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: account.nome,
  onChange: e => account.setNome(e.target.value),
  placeholder: L.t('auth.nome'),
  autoComplete: "given-name",
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
}), /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: account.cognome,
  onChange: e => account.setCognome(e.target.value),
  placeholder: L.t('auth.cognome'),
  autoComplete: "family-name",
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
})), /*#__PURE__*/React.createElement("input", {
  type: "email",
  inputMode: "email",
  value: account.email,
  onChange: e => account.setEmail(e.target.value),
  placeholder: L.t('auth.email'),
  autoComplete: "email",
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
}), /*#__PURE__*/React.createElement("input", {
  type: "password",
  value: account.password,
  onChange: e => account.setPassword(e.target.value),
  onKeyDown: e => e.key === 'Enter' && (account.modo === 'entra' ? account.entraConEmail() : account.registrati()),
  placeholder: L.t('auth.password'),
  autoComplete: account.modo === 'entra' ? 'current-password' : 'new-password',
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
}), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: account.chiudi,
  className: bottone('testuale', 'normale', 'flex-1')
}, L.t('galleria.annulla')), /*#__PURE__*/React.createElement("button", {
  onClick: account.modo === 'entra' ? account.entraConEmail : account.registrati,
  disabled: account.occupato,
  className: bottone('primario', 'normale', 'flex-1')
}, L.t(account.modo === 'entra' ? 'auth.entra' : 'auth.registrati'))), account.modo === 'entra' && /*#__PURE__*/React.createElement("button", {
  onClick: account.reimposta,
  disabled: account.occupato,
  className: bottone('testuale', 'minuscolo', 'w-full')
}, L.t('auth.passwordDimenticata')))), account.problema && /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo font-bold text-red-700 leading-snug"
}, L.t(account.problema, typeof window !== 'undefined' ? window.location.hostname : '')), account.fatto && /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#2D392C] leading-snug"
}, L.t(account.fatto))), FEATURES.rooms && /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('stanza.titolo')), stanzaStato.invito && /*#__PURE__*/React.createElement("div", {
  className: "bg-[#F0F4F1]/70 border border-[#2D392C]/20 rounded p-3 space-y-2"
}, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#2D392C] leading-snug"
}, frase('stanza.invitoCodice', Stanza.bello(stanzaStato.invito))), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: stanzaStato.rifiutaInvito,
  className: bottone('testuale', 'normale', 'flex-1')
}, L.t('stanza.rifiutaInvito')), /*#__PURE__*/React.createElement("button", {
  onClick: () => stanzaStato.accettaInvito(account.utente),
  disabled: stanzaStato.occupato,
  className: bottone('primario', 'normale', 'flex-1')
}, L.t('stanza.accettaInvito')))), stanzaStato.stanza ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#2D392C] leading-snug"
}, frase('stanza.entrato', stanzaStato.stanza.nome || Stanza.bello(stanzaStato.stanza.codice))), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between gap-2 bg-[#F0F4F1]/60 rounded p-2"
}, /*#__PURE__*/React.createElement("span", {
  className: "font-mono text-medio tracking-widest text-[#2D392C] min-w-0 break-words"
}, Stanza.bello(stanzaStato.stanza.codice)), /*#__PURE__*/React.createElement("button", {
  onClick: () => {
    try {
      navigator.clipboard.writeText(Stanza.bello(stanzaStato.stanza.codice));
    } catch (e) {/* niente */}
  },
  className: bottone('secondario', 'minuscolo', 'shrink-0')
}, L.t('stanza.copiaCodice'))), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => {
    const link = stanzaStato.linkDaMandare();
    const testo = L.t('stanza.invitoTesto')(stanzaStato.stanza.nome || Stanza.bello(stanzaStato.stanza.codice), link);
    if (navigator.share) {
      navigator.share({
        text: testo
      }).catch(() => {/* annullato: non e' un guasto */});
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(testo), '_blank');
    }
  },
  className: bottone('primario', 'normale', 'flex-1')
}, L.t('stanza.condividi')), /*#__PURE__*/React.createElement("button", {
  onClick: () => {
    try {
      navigator.clipboard.writeText(stanzaStato.linkDaMandare());
    } catch (e) {/* niente */}
  },
  className: bottone('secondario', 'normale', 'flex-1')
}, L.t('stanza.copiaLink'))), stanzaStato.membri.length > 0 && /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500"
}, L.t('stanza.dentro')(stanzaStato.membri.length)), /*#__PURE__*/React.createElement("button", {
  onClick: stanzaStato.esci,
  disabled: stanzaStato.occupato,
  className: bottone('testuale', 'minuscolo', 'w-full')
}, L.t('stanza.esci'))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug"
}, L.t('stanza.aCosaServe')), !stanzaStato.modo && /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => stanzaStato.setModo('crea'),
  className: bottone('primario', 'normale', 'flex-1')
}, L.t('stanza.creaTitolo')), /*#__PURE__*/React.createElement("button", {
  onClick: () => stanzaStato.setModo('entra'),
  className: bottone('secondario', 'normale', 'flex-1')
}, L.t('stanza.entraTitolo'))), stanzaStato.modo === 'crea' && /*#__PURE__*/React.createElement("div", {
  className: "space-y-2 pt-1"
}, /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: stanzaStato.nome,
  onChange: e => stanzaStato.setNome(e.target.value),
  placeholder: L.t('stanza.nome'),
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
}), /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-2 gap-2"
}, /*#__PURE__*/React.createElement("input", {
  type: "date",
  value: stanzaStato.inizio,
  onChange: e => stanzaStato.setInizio(e.target.value),
  "aria-label": L.t('stanza.inizio'),
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
}), /*#__PURE__*/React.createElement("input", {
  type: "date",
  value: stanzaStato.fine,
  onChange: e => stanzaStato.setFine(e.target.value),
  "aria-label": L.t('stanza.fine'),
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
})), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: stanzaStato.chiudi,
  className: bottone('testuale', 'normale', 'flex-1')
}, L.t('galleria.annulla')), /*#__PURE__*/React.createElement("button", {
  onClick: () => stanzaStato.crea(account.utente),
  disabled: stanzaStato.occupato,
  className: bottone('primario', 'normale', 'flex-1')
}, L.t('stanza.crea')))), stanzaStato.modo === 'entra' && /*#__PURE__*/React.createElement("div", {
  className: "space-y-2 pt-1"
}, /*#__PURE__*/React.createElement("input", {
  type: "text",
  value: stanzaStato.codice,
  onChange: e => stanzaStato.setCodice(e.target.value),
  placeholder: L.t('stanza.codice'),
  autoCapitalize: "characters",
  autoComplete: "off",
  spellCheck: "false",
  className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-medio font-mono tracking-widest uppercase focus:outline-none focus:border-[#2D392C]"
}), /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: stanzaStato.chiudi,
  className: bottone('testuale', 'normale', 'flex-1')
}, L.t('galleria.annulla')), /*#__PURE__*/React.createElement("button", {
  onClick: () => stanzaStato.entra(account.utente),
  disabled: stanzaStato.occupato,
  className: bottone('primario', 'normale', 'flex-1')
}, L.t('stanza.entra'))))), stanzaStato.problema && /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo font-bold text-red-700 leading-snug"
}, L.t(stanzaStato.problema)), stanzaStato.fatto === 'stanza.creata' && stanzaStato.stanza && /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#2D392C] leading-snug"
}, frase('stanza.creata', Stanza.bello(stanzaStato.stanza.codice)))), FEATURES.lingue && /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('lingua.titolo')), /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-3 gap-2"
}, Object.keys(window.Lingue.LINGUE).map(k => /*#__PURE__*/React.createElement("button", {
  key: k,
  onClick: () => {
    setLingua(k);
    scriviLocale(LINGUA_KEY, k);
  },
  className: bottoneScelta('linguetta', 'sezione', lingua === k, 'minuscolo')
}, window.Lingue.LINGUE[k].nome))), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug"
}, L.t('lingua.nota'))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('aspetto.titolo')), /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-3 gap-2"
}, [['auto', L.t('aspetto.automatico'), '🌗'], ['light', L.t('aspetto.chiaro'), '☀️'], ['dark', L.t('aspetto.scuro'), '🌙']].map(([k, l, icon]) => /*#__PURE__*/React.createElement("button", {
  key: k,
  onClick: () => setTheme(k),
  className: bottoneScelta('linguetta', 'sezione', theme === k, 'minuscolo')
}, /*#__PURE__*/React.createElement("span", {
  className: "block text-medio leading-none mb-1"
}, icon), l))), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500"
}, L.t('aspetto.spiegazione', theme === 'auto', theme === 'auto' ? isDark : theme === 'dark'))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('area.galleria')), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between gap-3"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-normale text-[#2D392C]"
}, L.t('impostazioni.fotoPerPersona')), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-2 shrink-0"
}, [3, 4, 5, 7].map(n => /*#__PURE__*/React.createElement("button", {
  key: n,
  onClick: () => {
    setPhotoCap(n);
    scriviLocale(PHOTO_CAP_KEY, String(n));
  },
  className: bottoneScelta('linguetta', 'sezione', photoCap === n, 'minuscolo', 'w-9')
}, n)))), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug"
}, L.t('impostazioni.fotoNota'))), admin && /*#__PURE__*/React.createElement("div", {
  className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
}, L.t('diag.titolo')), (() => {
  const m = metaRef.current || {
    rev: {},
    del: {}
  };
  const st = syncStateRef.current;
  const lapidi = Object.keys(m.del || {}).map(p => ({
    p,
    at: m.del[p]
  })).sort((a, b) => b.at - a.at);
  // diagTick serve solo a far ridisegnare questa scheda quando la
  // copia di scorta viene buttata: senza, resterebbe a schermo.
  void diagTick;
  const scorta = load(RESCUE_KEY, null);
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-x-4 gap-y-1 text-piccolo text-gray-600"
  }, /*#__PURE__*/React.createElement("span", null, fraseVestita('font-bold text-[#2D392C]', 'diag.vociDatate', Object.keys(m.rev || {}).length)), /*#__PURE__*/React.createElement("span", null, fraseVestita('font-bold text-[#2D392C]', 'diag.cancellazioni', lapidi.length))), (() => {
    const MF = window.MagazzinoFoto;
    const quante = Object.keys(receipts || {}).length;
    const kb = MF ? Math.round(MF.peso(receipts) / 1024) : 0;
    return /*#__PURE__*/React.createElement("p", {
      className: "text-piccolo text-gray-600"
    }, fraseVestita('font-bold text-[#2D392C]', 'diag.scontrini', quante, quante > 0 ? kb : null, fotoDove === 'magazzino'));
  })(), Object.keys(m.rev || {}).length === 0 && ((st.members || []).length > 0 || (st.purchases || []).length > 0 || Object.keys(st.campData || {}).length > 0) && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('diag.senzaStoria'))), (cloud.pending || (cloud.foto || 0) > 0) && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('diag.daInviare', !!cloud.pending, cloud.foto || 0)), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      const CS = window.CloudSync;
      if (CS && CS.riprova) CS.riprova();
    },
    className: bottone('avviso', 'normale', 'w-full mt-2')
  }, L.t('diag.riprovaAdesso'))), scorta && scorta.state && /*#__PURE__*/React.createElement("div", {
    className: "bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5 space-y-2"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('diag.reteDiSicurezza', L.data(new Date(scorta.at), 'dataOra'), scorta.perse, scorta.quando ? L.data(new Date(scorta.quando), 'dataOra') : null, scorta.quando ? Date.now() - scorta.quando > PERDITA_RECENTE : false)), /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#5C4A3C] leading-snug"
  }, frase('diag.annullandoTorna', scorta.perse, scorta.paths && scorta.paths.length ? descriviPerdite(scorta.paths, scorta.state) : null)), /*#__PURE__*/React.createElement("button", {
    onClick: annullaSync,
    className: bottone('avviso', 'normale', 'w-full')
  }, L.t('diag.annullaSync')), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (window.confirm(L.t('diag.confermaButtaCopia'))) {
        localStorage.removeItem(RESCUE_KEY);
        setLostSync(null);
        setDiagTick(t => t + 1);
      }
    },
    className: bottone('testuale', 'minuscolo', 'w-full')
  }, L.t('diag.buttaCopia'))), lapidi.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-gray-400 italic"
  }, L.t('diag.nessunaCancellazione')) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo uppercase font-bold text-gray-500 mb-1"
  }, L.t('diag.ultimeCancellazioni')), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-1"
  }, lapidi.slice(0, 12).map(l => /*#__PURE__*/React.createElement("li", {
    key: l.p,
    className: "flex items-start justify-between gap-2 text-piccolo bg-[#F0F4F1]/60 px-2 py-1.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-[#2D392C] leading-snug"
  }, descriviPath(l.p, st)), /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 shrink-0"
  }, L.data(new Date(l.at), 'breve'), ' ', L.data(new Date(l.at), 'ora'))))), lapidi.length > 12 && /*#__PURE__*/React.createElement("p", {
    className: "text-minuto text-gray-400 italic mt-1"
  }, L.t('diag.eAltre', lapidi.length - 12))), /*#__PURE__*/React.createElement("p", {
    className: "text-minuto text-gray-400 italic leading-snug"
  }, L.t('diag.notaCancellazioni')));
})()), admin && /*#__PURE__*/React.createElement("div", {
  className: "bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => setLogOpen(v => !v),
  className: bottoneRiga()
}, /*#__PURE__*/React.createElement("span", {
  className: "font-rustic text-grande text-[#2D392C] shrink-0"
}, L.t('registro.titolo')), /*#__PURE__*/React.createElement("span", {
  className: "ml-auto flex items-center gap-2 shrink-0"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-minuto uppercase font-bold px-2 py-1 rounded bg-gray-200 text-gray-500"
}, (() => {
  void diagTick;
  const n = logLeggi().length;
  return n === 0 ? L.t('registro.vuoto') : L.t('registro.quanteVoci', n);
})()), /*#__PURE__*/React.createElement("span", {
  className: `text-piccolo text-[#5C4A3C] transition-transform ${logOpen ? 'rotate-180' : ''}`
}, "\u25BE"))), logOpen && /*#__PURE__*/React.createElement("div", {
  className: "px-4 pb-4 space-y-3"
}, (() => {
  void diagTick;
  const reg = logLeggi();
  const st = syncStateRef.current;
  if (reg.length === 0) {
    return /*#__PURE__*/React.createElement("p", {
      className: "text-piccolo text-gray-400 italic"
    }, L.t('registro.nessuna'));
  }
  // Raggruppate per giorno: leggere 400 righe di fila è inutile.
  const perGiorno = [];
  reg.forEach(r => {
    const g = L.data(new Date(r.at), 'completa');
    const ultimo = perGiorno[perGiorno.length - 1];
    if (ultimo && ultimo.giorno === g) ultimo.voci.push(r);else perGiorno.push({
      giorno: g,
      voci: [r]
    });
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-gray-500 leading-snug"
  }, L.t('registro.nota')), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3 max-h-96 overflow-y-auto pr-1"
  }, perGiorno.map(gruppo => /*#__PURE__*/React.createElement("div", {
    key: gruppo.giorno
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-minuto uppercase font-bold text-gray-500 tracking-wide mb-1"
  }, gruppo.giorno), /*#__PURE__*/React.createElement("ul", {
    className: "space-y-1"
  }, gruppo.voci.map((r, i) => /*#__PURE__*/React.createElement("li", {
    key: r.p + r.at + i,
    className: "flex items-start gap-2 text-piccolo bg-[#F0F4F1]/60 px-2 py-1.5 rounded border border-[#8F9E8B]/20"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-gray-500 shrink-0 w-10"
  }, L.data(new Date(r.at), 'ora')), /*#__PURE__*/React.createElement("span", {
    className: `shrink-0 w-3 text-center ${r.k === 'd' ? 'text-red-700' : 'text-[#2D392C]'}`,
    title: L.t(r.k === 'd' ? 'registro.cancellata' : 'registro.modificata')
  }, r.k === 'd' ? '−' : '+'), /*#__PURE__*/React.createElement("span", {
    className: "min-w-0 flex-grow leading-snug"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-[#5C4A3C]"
  }, sezioneDiPath(r.p)), /*#__PURE__*/React.createElement("span", {
    className: "text-[#2D392C]"
  }, " \xB7 ", descriviPath(r.p, st))), /*#__PURE__*/React.createElement("span", {
    className: `shrink-0 text-minuto uppercase font-bold px-1.5 py-0.5 rounded ${r.o === 'io' ? 'bg-[#2D392C]/10 text-[#2D392C]' : 'bg-[#5C4A3C]/10 text-[#5C4A3C]'}`
  }, L.t(r.o === 'io' ? 'registro.qui' : 'registro.sync')))))))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: esportaRegistro,
    className: bottone('primario', 'normale', 'flex-1')
  }, L.t('registro.esporta')), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (window.confirm(L.t('registro.confermaSvuota'))) {
        localStorage.removeItem(LOG_KEY);
        setDiagTick(t => t + 1);
      }
    },
    className: bottone('secondario', 'normale', 'flex-1')
  }, L.t('registro.svuota'))));
})())), /*#__PURE__*/React.createElement("div", {
  className: "bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => setBloccoOpen(v => !v),
  className: bottoneRiga()
}, /*#__PURE__*/React.createElement("span", {
  className: "font-rustic text-grande text-[#2D392C] shrink-0"
}, L.t('blocco.titoloScheda')), /*#__PURE__*/React.createElement("span", {
  className: "ml-auto flex items-center gap-1.5 shrink-0"
}, (() => {
  const lock = window.APP_LOCK || {};
  if (!lock.dbEmail || !(LOCK && LOCK.hash)) return null;
  const protetto = cloud.authMode === 'shared';
  const ignoto = !protetto && !cloud.connected;
  return /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo",
    title: L.t(protetto ? 'blocco.dbProtetto' : ignoto ? 'blocco.dbNonCollegato' : 'blocco.dbAperto')
  }, protetto ? '🔒' : ignoto ? '—' : '⚠');
})(), /*#__PURE__*/React.createElement("span", {
  className: `text-minuto uppercase font-bold px-2 py-1 rounded ${LOCK && LOCK.hash ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`
}, L.t(LOCK && LOCK.hash ? 'blocco.attivo' : 'blocco.nonAttivo')), /*#__PURE__*/React.createElement("span", {
  className: `text-piccolo text-[#5C4A3C] transition-transform ${bloccoOpen ? 'rotate-180' : ''}`
}, "\u25BE"))), bloccoOpen && /*#__PURE__*/React.createElement("div", {
  className: "px-4 pb-4 space-y-3"
}, LOCK && LOCK.hash ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug"
}, L.t('blocco.spiegazione')), (() => {
  const lock = window.APP_LOCK || {};
  if (!lock.dbEmail) return null;
  const protetto = cloud.authMode === 'shared';
  // Senza collegamento non si può sapere come si entrerà nel
  // database: meglio dirlo, invece di allarmare chi è offline.
  const ignoto = !protetto && !cloud.connected;
  return /*#__PURE__*/React.createElement("div", {
    className: `p-3 rounded border ${protetto ? 'bg-[#2D392C]/5 border-[#2D392C]/25' : ignoto ? 'bg-[#F0F4F1]/60 border-[#8F9E8B]/30' : 'bg-[#D97706]/10 border-[#D97706]/40'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-piccolo uppercase font-bold text-gray-500"
  }, L.t('blocco.database')), /*#__PURE__*/React.createElement("span", {
    className: `text-piccolo font-bold ${protetto ? 'text-[#2D392C]' : ignoto ? 'text-gray-500' : 'text-[#D97706]'}`
  }, L.t(protetto ? 'blocco.statoProtetto' : ignoto ? 'blocco.statoIgnoto' : 'blocco.statoAperto'))), /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-gray-500 leading-snug mt-1"
  }, L.t(protetto ? 'blocco.notaProtetto' : ignoto ? 'blocco.notaIgnoto' : 'blocco.notaAperto')));
})(), /*#__PURE__*/React.createElement("label", {
  className: "flex items-center gap-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20 cursor-pointer"
}, /*#__PURE__*/React.createElement("input", {
  type: "checkbox",
  checked: askAlways,
  onChange: toggleAskAlways,
  className: "w-4 h-4 accent-[#2D392C] shrink-0"
}), /*#__PURE__*/React.createElement("span", {
  className: "text-piccolo text-[#2D392C] leading-snug"
}, frase('blocco.ogniVolta'), /*#__PURE__*/React.createElement("span", {
  className: "block text-minuto text-gray-500"
}, L.t('blocco.senzaSpunta')))), window.CloudSync && window.CloudSync.needsPassword && window.CloudSync.needsPassword() && /*#__PURE__*/React.createElement("div", {
  className: "bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5"
}, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#5C4A3C] leading-snug"
}, frase('blocco.ripiego'))), /*#__PURE__*/React.createElement("button", {
  onClick: lockNow,
  className: bottone('bruno', 'normale', 'w-full')
}, L.t('blocco.bloccaOra'))) : /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500"
}, L.t('blocco.nessunaPassword')))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => setDatiOpen(v => !v),
  className: bottoneRiga()
}, /*#__PURE__*/React.createElement("span", {
  className: "font-rustic text-grande text-[#2D392C] shrink-0"
}, L.t('dati.titolo')), /*#__PURE__*/React.createElement("span", {
  className: "ml-auto flex items-center gap-2 shrink-0"
}, /*#__PURE__*/React.createElement("span", {
  className: `text-minuto uppercase font-bold px-2 py-1 rounded ${cloud.connected ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`
}, L.t(cloud.connected ? 'dati.connessa' : isOnline ? 'dati.nonConnessa' : 'dati.offline')), /*#__PURE__*/React.createElement("span", {
  className: `text-piccolo text-[#5C4A3C] transition-transform ${datiOpen ? 'rotate-180' : ''}`
}, "\u25BE"))), datiOpen && /*#__PURE__*/React.createElement("div", {
  className: "px-4 pb-4 space-y-3"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: exportData,
  className: bottone('primario', 'normale', 'flex-1')
}, L.t('dati.esportaBackup')), /*#__PURE__*/React.createElement("button", {
  onClick: () => goTo('spesa'),
  className: bottone('secondario', 'normale', 'flex-1')
}, L.t('dati.gestione'))), /*#__PURE__*/React.createElement("button", {
  onClick: wipeLocal,
  className: bottone('distruttivo', 'normale', 'w-full')
}, L.t('dati.cancellaLocale')), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-gray-400 italic leading-snug"
}, L.t('dati.notaCancella')))), /*#__PURE__*/React.createElement("div", {
  className: "bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => setTecnicaOpen(v => !v),
  className: bottoneRiga()
}, /*#__PURE__*/React.createElement("span", {
  className: "font-rustic text-grande text-[#2D392C] shrink-0"
}, L.t('tecnica.titolo')), /*#__PURE__*/React.createElement("span", {
  className: "ml-auto flex items-center gap-2 shrink-0"
}, /*#__PURE__*/React.createElement("span", {
  className: `text-minuto uppercase font-bold px-2 py-1 rounded ${admin ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`
}, L.t(admin ? 'tecnica.attiva' : 'tecnica.spenta')), /*#__PURE__*/React.createElement("span", {
  className: `text-piccolo text-[#5C4A3C] transition-transform ${tecnicaOpen ? 'rotate-180' : ''}`
}, "\u25BE"))), tecnicaOpen && /*#__PURE__*/React.createElement("div", {
  className: "px-4 pb-4 space-y-3"
}, admin ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug"
}, frase('tecnica.accesaNota')), /*#__PURE__*/React.createElement("button", {
  onClick: esciAdmin,
  className: bottone('secondario', 'normale', 'w-full')
}, L.t('tecnica.spegni'))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-gray-500 leading-snug"
}, L.t('tecnica.spentaNota')), window.APP_ADMIN && window.APP_ADMIN.aperta ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo font-bold text-[#8A5A2B] leading-snug"
}, L.t('tecnica.apertaNota')), /*#__PURE__*/React.createElement("button", {
  onClick: entraAdmin,
  className: bottone('primario', 'normale', 'w-full')
}, L.t('tecnica.attivaTasto'))) : /*#__PURE__*/React.createElement("div", {
  className: "flex gap-2"
}, /*#__PURE__*/React.createElement("input", {
  type: "password",
  value: adminPwd,
  onChange: e => {
    setAdminPwd(e.target.value);
    setAdminErr('');
  },
  onKeyDown: e => e.key === 'Enter' && entraAdmin(),
  placeholder: L.t('tecnica.password'),
  className: "flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale"
}), /*#__PURE__*/React.createElement("button", {
  onClick: entraAdmin,
  className: bottone('primario', 'normale', 'shrink-0')
}, L.t('tecnica.attivaTasto'))), adminErr && /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo font-bold text-red-700"
}, adminErr)))), /*#__PURE__*/React.createElement("div", {
  className: "bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md space-y-2"
}, /*#__PURE__*/React.createElement("h3", {
  className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-1"
}, L.t('info.titolo')), /*#__PURE__*/React.createElement("div", {
  className: "flex justify-between text-piccolo"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-[#8F9E8B]"
}, L.t('info.versione')), /*#__PURE__*/React.createElement("span", {
  className: "font-bold"
}, swVersion || '—')), /*#__PURE__*/React.createElement("p", {
  className: "text-piccolo text-[#F0F4F1]/70 leading-snug"
}, L.t('info.aggiornamento')), /*#__PURE__*/React.createElement("p", {
  className: "text-minuto text-[#8F9E8B]/80 pt-1"
}, BRAND.credits)));
// ---------- Scheda "Chi fa cosa": i compiti assegnati ----------
//
// Uscita da App() come le altre: e' una funzione che restituisce JSX, non un
// componente React, e riceve le dipendenze in un oggetto.
//
// Cosa fa, e cosa NON fa. Assegna un compito a una persona: "prendi gli
// arrosticini", "prenota il rifugio", "ritira la carne". Il testo e' libero
// apposta — al campo servono cose che oggi non sappiamo prevedere, e un
// elenco chiuso di tipi costringe a scrivere tutto in "altro".
//
// I compiti NON entrano nei conti. Nei conti entra la spesa che ne nasce, e
// solo se qualcuno la registra. Il legame fra le due cose esiste ed e' un
// tasto — "Registra la spesa" — ma e' facoltativo e viene dopo: quando si
// assegna il compito il prezzo non si sa ancora.
const schedaCompiti = ({
  addCompito,
  compiti,
  daCompitoASpesa,
  members,
  nuovoCompito,
  nuovoCompitoChi,
  removeCompito,
  renderBuyerSelect,
  setCompitoCampo,
  setNuovoCompito,
  setNuovoCompitoChi,
  toggleCompito
}) => {
  const daFare = compiti.filter(c => !c.fatto);
  const fatti = compiti.filter(c => c.fatto);
  const riga = c => /*#__PURE__*/React.createElement("li", {
    key: c.id,
    className: "p-3 border-b border-[#8F9E8B]/20 last:border-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => toggleCompito(c.id),
    "aria-label": L.t(c.fatto ? 'compiti.segnaDaFare' : 'compiti.segnaFatto'),
    className: bottoneScelta('casella', 'casella', c.fatto, 'simbolo', 'mt-0.5')
  }, "\u2713"), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0 flex-grow space-y-2"
  }, /*#__PURE__*/React.createElement("input", {
    value: c.testo,
    onChange: e => setCompitoCampo(c.id, 'testo', e.target.value),
    className: `w-full bg-transparent text-normale text-[#2D392C] focus:outline-none border-b border-transparent focus:border-[#8F9E8B]/40 ${c.fatto ? 'line-through text-gray-400' : ''}`
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-minuto uppercase font-bold text-[#8F9E8B] shrink-0"
  }, L.t('compiti.aChi')), renderBuyerSelect(c.chi, v => setCompitoCampo(c.id, 'chi', v), 'text-piccolo p-1.5')), c.fatto && /*#__PURE__*/React.createElement("button", {
    onClick: () => daCompitoASpesa(c),
    className: bottone('bruno', 'minuscolo')
  }, "\uD83D\uDCB6 ", L.t('compiti.registraSpesa'))), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeCompito(c.id),
    "aria-label": L.t('compiti.rimuovi'),
    className: bottoneIcona('distruttivo', 'shrink-0')
  }, "\xD7")));
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]"
  }, L.t('compiti.assegnaTitolo')), /*#__PURE__*/React.createElement("input", {
    value: nuovoCompito,
    onChange: e => setNuovoCompito(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') addCompito();
    },
    placeholder: L.t('compiti.cosa'),
    className: "w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
  }), renderBuyerSelect(nuovoCompitoChi, setNuovoCompitoChi), /*#__PURE__*/React.createElement("button", {
    onClick: addCompito,
    disabled: !nuovoCompito.trim(),
    className: bottone('primario', 'grande', 'w-full')
  }, L.t('compiti.assegna')), /*#__PURE__*/React.createElement("p", {
    className: "text-minuto text-gray-400 italic leading-snug"
  }, frase('compiti.spiegazione'))), /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-3 border-b border-[#8F9E8B]/40"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-grande text-[#2D392C]"
  }, L.t('compiti.daFare')), daFare.length > 0 && /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C]"
  }, daFare.length)), daFare.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "px-4 py-6 text-center text-piccolo text-gray-400 italic"
  }, compiti.length === 0 ? L.t('compiti.vuoto') : L.t('compiti.tuttoFatto')) : /*#__PURE__*/React.createElement("ul", null, daFare.map(riga))), fatti.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-3 border-b border-[#8F9E8B]/40"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-rustic text-grande text-[#2D392C]"
  }, L.t('compiti.fatti')), /*#__PURE__*/React.createElement("span", {
    className: "font-rustic font-bold text-[#2D392C]"
  }, fatti.length)), /*#__PURE__*/React.createElement("ul", null, fatti.map(riga))), members.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "text-piccolo text-[#D97706] italic leading-snug px-1"
  }, L.t('compiti.senzaMembri')));
};
const root = createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/React.createElement(App, null));