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
  if (meta) meta.setAttribute('content', dark ? '#0E1A1A' : '#00494A');
  return dark;
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Formato dei soldi e numero non negativo: stanno in conti.js insieme a chi
// li usa di piu'. Qui si riprendono da li' invece di riscriverli, perche' due
// copie della stessa regola sui soldi prima o poi divergono — e l'app e i
// conti mostrerebbero due cifre diverse per la stessa spesa.
//
// Le cifre si LEGGONO nella lingua dell'app: 281,10 € e non 281.10 €. Il
// punto era l'inglese di toFixed, e in italiano, spagnolo e francese i
// decimali vanno con la virgola. L'arrotondamento resta quello di conti.js
// (una regola sola sui soldi, uguale a quella della versione privata): qui
// cambia soltanto come la cifra arrotondata si scrive. Tutti gli usi di
// money finiscono a schermo o nel resoconto da mandare nel gruppo — nessuno
// la rimette in un calcolo, dove una virgola farebbe danni.
const money = (n) => {
  const s = window.Conti.money(n);
  try {
    return new Intl.NumberFormat(L.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(s));
  } catch (e) { return s; }
};
const posNum = window.Conti.posNum;

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

