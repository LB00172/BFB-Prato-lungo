// Ricompila App.jsx -> App.js (JS puro per il browser, niente Babel a runtime)
// e aggiorna automaticamente CACHE_NAME nel service worker in base al
// contenuto dei file, cosi' ogni deploy con modifiche invalida la vecchia
// cache e i dispositivi ricevono la versione nuova.
// Uso: node build.js
const Babel = require('@babel/standalone');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;

// 1) Compila App.jsx -> App.js
const src = fs.readFileSync(path.join(root, 'App.jsx'), 'utf8');
const { code } = Babel.transform(src, {
  presets: [['react', { runtime: 'classic' }]],
  compact: false,
});
const banner = '/* File GENERATO da App.jsx tramite Babel (node build.js). Non modificare a mano. */\n';
fs.writeFileSync(path.join(root, 'App.js'), banner + code);
console.log('Compilato App.jsx -> App.js');

// 2) Calcola una versione dal contenuto degli asset cacheati e la scrive in sw.js
const filesToHash = [
  'App.js', 'index.html', 'manifest.json',
  'firebase-config.js', 'sync-merge.js', 'firebase-sync.js',
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
