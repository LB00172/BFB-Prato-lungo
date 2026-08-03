// App.js è generato da App.jsx: se qualcuno modifica il sorgente e dimentica
// "npm run build", il browser continua a caricare la versione vecchia e la
// modifica sembra "non aver funzionato". Qui si ricompila in memoria e si
// confronta, senza toccare niente su disco.
const fs = require('fs');
const path = require('path');
const Babel = require('@babel/standalone');
const { ok, fine } = require('../lib/app');

const RADICE = path.resolve(__dirname, '..', '..');
const sorgente = fs.readFileSync(path.join(RADICE, 'App.jsx'), 'utf8');

let compilato = null;
try {
  compilato = Babel.transform(sorgente, {
    presets: [['react', { runtime: 'classic' }]],
    compact: false,
  }).code;
  ok('App.jsx compila senza errori', true);
} catch (e) {
  ok('App.jsx compila senza errori — ' + e.message, false);
}

if (compilato !== null) {
  // La prima riga di App.js è l'avviso "file generato": si confronta il resto.
  const suDisco = fs.readFileSync(path.join(RADICE, 'App.js'), 'utf8');
  ok('App.js porta l\'avviso "file generato"', /^\/\* File GENERATO/.test(suDisco));
  ok('App.js è allineato ad App.jsx (altrimenti: npm run build)',
    suDisco.slice(suDisco.indexOf('\n') + 1) === compilato);
}

// Il nome della cache del service worker cambia a ogni build: se resta
// indietro, i telefoni non ricevono l'aggiornamento.
const sw = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');
ok('sw.js ha un CACHE_NAME con impronta', /const CACHE_NAME = 'brigata-bandone-[0-9a-f]{10}'/.test(sw));

// Ogni file caricato da index.html deve stare anche nel precache, altrimenti
// offline manca un pezzo e l'app non parte.
const html = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');
const locali = [...html.matchAll(/<script[^>]+src="\.\/([^"]+)"/g)].map((m) => m[1]);
const mancanti = locali.filter((f) => !sw.includes("'./" + f + "'"));
ok('tutti gli script di index.html sono nel precache' + (mancanti.length ? ' — mancano: ' + mancanti.join(', ') : ''), mancanti.length === 0);

fine();
