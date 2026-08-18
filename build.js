// Ricompila i sorgenti di src/ -> App.js (JS puro per il browser, niente Babel
// a runtime) e aggiorna automaticamente CACHE_NAME nel service worker in base
// al contenuto dei file, cosi' ogni deploy con modifiche invalida la vecchia
// cache e i dispositivi ricevono la versione nuova.
// Uso: node build.js
const Babel = require('@babel/standalone');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;

// 1) Compila src/*.jsx -> App.js
//
// I sorgenti NON sono moduli: vengono incollati uno dietro l'altro e compilati
// come un file solo, quindi condividono un unico ambito. Per questo l'ordine
// qui sotto e' una regola, non una preferenza: una costante usata a livello di
// modulo deve essere dichiarata prima di chi la usa. I numeri nei nomi lo
// rendono visibile anche a chi guarda solo la cartella.
const SORGENTI = [
  '1-fondamenta.jsx',       // React, utility, memoria locale, istantanee, registro
  '2-blocco-password.jsx',  // impronta PBKDF2 della password del campo
  '3-tema-e-formati.jsx',   // tema chiaro/scuro, uid/money/posNum, IBAN e PayPal
  '4-configurazione.jsx',   // marchio, funzioni attive, date del campo, meteo, regole
  '5-interfaccia.jsx',      // vocabolario dei bottoni: sei ruoli, tre altezze
  '6-gioco.jsx',            // "Aiuta Bandy": tavolozze, disegno, BandyGame
  '7-schermata-blocco.jsx', // LockScreen
  '8-app.jsx',              // function App(): stato, conti, sincronizzazione, interfaccia
  '9-avvio.jsx',            // il mount di React
];

const cartella = path.join(root, 'src');
// Un file nuovo in src/ che nessuno ha aggiunto all'elenco sparirebbe dall'app
// senza un errore: meglio fermarsi qui che scoprirlo da un telefono.
const suDisco = fs.readdirSync(cartella).filter((f) => f.endsWith('.jsx')).sort();
const dimenticati = suDisco.filter((f) => !SORGENTI.includes(f));
if (dimenticati.length) {
  console.error('Sorgenti in src/ non elencati in build.js:', dimenticati.join(', '));
  process.exit(1);
}
const mancanti = SORGENTI.filter((f) => !suDisco.includes(f));
if (mancanti.length) {
  console.error('Sorgenti elencati ma assenti da src/:', mancanti.join(', '));
  process.exit(1);
}

const src = SORGENTI.map((f) => fs.readFileSync(path.join(cartella, f), 'utf8')).join('');
const { code } = Babel.transform(src, {
  presets: [['react', { runtime: 'classic' }]],
  compact: false,
});
const banner = '/* File GENERATO dai sorgenti in src/ tramite Babel (node build.js). Non modificare a mano. */\n';
fs.writeFileSync(path.join(root, 'App.js'), banner + code);
console.log('Compilato src/*.jsx -> App.js (' + SORGENTI.length + ' sorgenti)');

// 2) Calcola una versione dal contenuto degli asset cacheati e la scrive in sw.js
const filesToHash = [
  'App.js', 'index.html', 'manifest.json',
  'firebase-config.js', 'sync-merge.js', 'pdf-ricordo.js', 'firebase-sync.js',
  'vendor/tailwind.js', 'vendor/fonts.css',
];
const h = crypto.createHash('sha1');
for (const f of filesToHash) {
  try { h.update(fs.readFileSync(path.join(root, f))); } catch (e) { /* file assente: ignora */ }
}
const version = 'brigata-bandone-' + h.digest('hex').slice(0, 10);

const swPath = path.join(root, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = '${version}';`);
fs.writeFileSync(swPath, sw);
console.log('CACHE_NAME =', version);
