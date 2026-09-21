const { useState, useEffect, useRef } = React;

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

// Scrittura "secca" in localStorage che non fa saltare l'app se la memoria e'
// piena. Vale per i valori che non passano da salvaLocale: stringhe singole,
// preferenze, contatori. Se non c'e' spazio il dato si perde — l'app no.
const scriviLocale = (chiave, valore) => {
  try { localStorage.setItem(chiave, valore); return true; } catch (e) { return false; }
};
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
// La tabella tiene le CHIAVI, non i nomi: e' una costante, e si valuta una
// volta sola al caricamento — se ci mettessimo i nomi tradotti resterebbero
// per sempre nella lingua di quel momento. Il nome si chiede al disegno.
const SEZIONE_DI = { m: 'sezione.membri', p: 'sezione.lista', t: 'sezione.daAcquistare', e: 'sezione.attrezzatura', g: 'sezione.dotazioni', s: 'sezione.saldi', x: 'sezione.contoSeparato', f: 'sezione.giorniGratis' };
const sezioneDiPath = (p) => {
  const parti = String(p).split('|');
  if (parti[0] === 'c') return L.t(parti[2] === 'meals' ? 'sezione.presenze' : (parti[3] === 'note' ? 'sezione.menu' : 'sezione.calendario'));
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
    return m ? m.name : L.t('percorso.exMembro');
  };
  const giorno = (d) => {
    try { return L.data(parseDate(d), 'settimana'); }
    catch (e) { return d; }
  };
  const voce = (lista, id, etichetta) => {
    const it = (stato[lista] || []).find((x) => x.id === id);
    return `${etichetta}${it && it.name ? ` "${it.name}"` : ''}`;
  };
  switch (parti[0]) {
    case 'c':
      if (parti[2] === 'meals') return L.t('percorso.presenzaDi', nomeMembro(parti[3]), giorno(parti[1]));
      if (parti[3] === 'note') return L.t('percorso.menuDel', giorno(parti[1]));
      if (parti[3] === 'appunti') return L.t('percorso.noteDel', giorno(parti[1]));
      if (parti[3] === 'guestsNames') return L.t('percorso.ospitiDel', giorno(parti[1]));
      return L.t('percorso.campoDel', parti[3], giorno(parti[1]));
    case 'm': return voce('members', parti[1], L.t('percorso.membro'));
    case 'p': return voce('purchases', parti[1], L.t('percorso.spesa'));
    case 't': return voce('toBuy', parti[1], L.t('percorso.daAcquistare'));
    case 'e': return voce('equipment', parti[1], L.t('percorso.attrezzatura'));
    case 'g': return voce('gear', parti[1], L.t('percorso.dotazione'));
    case 's': return L.t('percorso.rimborsoSaldato');
    case 'x': return L.t('percorso.giornoSeparato', giorno(parti[1]));
    case 'f': return L.t('percorso.giornoGratis', giorno(parti[1]));
    default: return p;
  }
};

const descriviPerdite = (paths, stato) => {
  const nome = (id) => {
    const m = (stato.members || []).find((x) => x.id === id);
    return m ? m.name : L.t('percorso.qualcuno');
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

