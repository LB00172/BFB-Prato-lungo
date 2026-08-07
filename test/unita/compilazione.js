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

// Ogni file che l'app carica dal proprio dominio deve stare nel precache:
// offline quello che non è in cache semplicemente non arriva, e al campo non
// c'è una seconda occasione. Prima si controllavano solo i <script> di
// index.html — un font, un'icona o bandy.png dimenticati sarebbero passati.
const html = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(RADICE, 'vendor', 'fonts.css'), 'utf8');
const manifest = fs.readFileSync(path.join(RADICE, 'manifest.json'), 'utf8');

const esterno = (u) => /^https?:|^data:|^blob:|^\/\//.test(u);
const pulisci = (u) => u.replace(/^\.\//, '').split('?')[0].split('#')[0];
const riferiti = new Set();

// index.html: script, fogli di stile, icone, manifest
[...html.matchAll(/(?:src|href)="([^"]+)"/g)].forEach((m) => {
  if (!esterno(m[1])) riferiti.add(pulisci(m[1]));
});
// fonts.css: i woff2 stanno sotto vendor/
[...css.matchAll(/url\(["']?([^)"']+)/g)].forEach((m) => {
  if (!esterno(m[1])) riferiti.add('vendor/' + pulisci(m[1]));
});
// manifest.json: le icone dell'app installata
[...manifest.matchAll(/"src"\s*:\s*"([^"]+)"/g)].forEach((m) => {
  if (!esterno(m[1])) riferiti.add(pulisci(m[1]));
});
// App.jsx: le immagini caricate dal codice (es. './bandy.png' nel minigioco)
[...sorgente.matchAll(/'\.\/([a-zA-Z0-9_-]+\.(?:png|jpg|jpeg|svg|webp|json|css|js))'/g)].forEach((m) => {
  riferiti.add(m[1]);
});

const mancanti = [...riferiti].filter((f) => !sw.includes("'./" + f + "'"));
ok(`tutti i ${riferiti.size} file dell'app sono nel precache` + (mancanti.length ? ' — MANCANO: ' + mancanti.join(', ') : ''),
  mancanti.length === 0);

// E il contrario: un file nel precache che non esiste più fa fallire l'intera
// installazione del service worker (addAll è tutto-o-niente), quindi i telefoni
// resterebbero fermi alla versione vecchia senza che nessuno se ne accorga.
const inPrecache = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter((f) => f !== '');
const fantasmi = inPrecache.filter((f) => !fs.existsSync(path.join(RADICE, f)));
ok(`i ${inPrecache.length} file del precache esistono davvero` + (fantasmi.length ? ' — FANTASMI: ' + fantasmi.join(', ') : ''),
  fantasmi.length === 0);

fine();
