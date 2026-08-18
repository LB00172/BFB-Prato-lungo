// App.js è generato dai sorgenti in src/: se qualcuno modifica un sorgente e
// dimentica "npm run build", il browser continua a caricare la versione vecchia
// e la modifica sembra "non aver funzionato". Qui si ricompila in memoria e si
// confronta, senza toccare niente su disco.
//
// I sorgenti non sono moduli: si incollano nell'ordine dichiarato in build.js e
// si compilano come un file solo. Quell'ordine e' una regola (una costante va
// dichiarata prima di chi la usa), quindi la prova lo legge da build.js invece
// di riscriverlo: due elenchi separati prima o poi divergono.
const fs = require('fs');
const path = require('path');
const Babel = require('@babel/standalone');
const { ok, fine } = require('../lib/app');

const RADICE = path.resolve(__dirname, '..', '..');

// L'elenco dei sorgenti, letto da build.js: e' li' che vive la verita'.
const testoBuild = fs.readFileSync(path.join(RADICE, 'build.js'), 'utf8');
const blocco = testoBuild.slice(testoBuild.indexOf('const SORGENTI = ['), testoBuild.indexOf('];', testoBuild.indexOf('const SORGENTI = [')));
const SORGENTI = [...blocco.matchAll(/'([^']+\.jsx)'/g)].map((m) => m[1]);
ok(`build.js elenca ${SORGENTI.length} sorgenti`, SORGENTI.length > 0);

// Nessun file dimenticato: uno .jsx in src/ fuori dall'elenco sparirebbe
// dall'app senza rompere niente, che e' il modo peggiore.
const suDiscoJsx = fs.readdirSync(path.join(RADICE, 'src')).filter((f) => f.endsWith('.jsx')).sort();
const fuoriElenco = suDiscoJsx.filter((f) => !SORGENTI.includes(f));
ok(`tutti i ${suDiscoJsx.length} sorgenti di src/ sono in build.js`
  + (fuoriElenco.length ? ' — FUORI ELENCO: ' + fuoriElenco.join(', ') : ''), fuoriElenco.length === 0);

const sorgente = SORGENTI.map((f) => fs.readFileSync(path.join(RADICE, 'src', f), 'utf8')).join('');

// L'ordine sbagliato non si vede ricompilando — App.js risulterebbe comunque
// "allineato", perche' e' stato generato dallo stesso ordine sbagliato — ma
// l'app non parte: il mount cercherebbe createRoot prima che venga dichiarato.
// Qui si controllano i due estremi, che sono i due punti dove rompe davvero.
const primo = fs.readFileSync(path.join(RADICE, 'src', SORGENTI[0]), 'utf8');
const ultimo = fs.readFileSync(path.join(RADICE, 'src', SORGENTI[SORGENTI.length - 1]), 'utf8');
ok(`il primo sorgente (${SORGENTI[0]}) prende React dal globale`,
  /const \{[^}]*useState[^}]*\} = React;/.test(primo) && /createRoot \} = ReactDOM;/.test(primo));
ok(`l'ultimo sorgente (${SORGENTI[SORGENTI.length - 1]}) e' quello che monta l'app`,
  /createRoot\(document\.getElementById\('root'\)\)/.test(ultimo));
ok('e nessun altro sorgente monta l\'app',
  SORGENTI.slice(0, -1).every((f) => !/createRoot\(document/.test(fs.readFileSync(path.join(RADICE, 'src', f), 'utf8'))));

let compilato = null;
try {
  compilato = Babel.transform(sorgente, {
    presets: [['react', { runtime: 'classic' }]],
    compact: false,
  }).code;
  ok('i sorgenti di src/ compilano senza errori', true);
} catch (e) {
  ok('i sorgenti di src/ compilano senza errori — ' + e.message, false);
}

if (compilato !== null) {
  // La prima riga di App.js è l'avviso "file generato": si confronta il resto.
  const suDisco = fs.readFileSync(path.join(RADICE, 'App.js'), 'utf8');
  ok('App.js porta l\'avviso "file generato"', /^\/\* File GENERATO/.test(suDisco));
  ok('App.js è allineato ai sorgenti (altrimenti: npm run build)',
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
// I sorgenti: le immagini caricate dal codice (es. './bandy.png' nel minigioco)
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
