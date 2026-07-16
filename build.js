// Ricompila App.jsx -> App.js (JS puro per il browser, niente Babel a runtime).
// Uso: node build.js
const Babel = require('@babel/standalone');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const srcPath = path.join(root, 'App.jsx');
const outPath = path.join(root, 'App.js');

const src = fs.readFileSync(srcPath, 'utf8');
const { code } = Babel.transform(src, {
  presets: [['react', { runtime: 'classic' }]],
  compact: false,
});

const banner = '/* File GENERATO da App.jsx tramite Babel (node build.js). Non modificare a mano. */\n';
fs.writeFileSync(outPath, banner + code);
console.log('Compilato App.jsx -> App.js');
