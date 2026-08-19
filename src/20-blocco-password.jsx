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

