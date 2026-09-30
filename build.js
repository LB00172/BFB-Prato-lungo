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
//
// I numeri vanno di dieci in dieci apposta: la divisione di 80-app.jsx e'
// cominciata e ogni pezzo che esce va infilato in mezzo. Con i numeri di fila
// ogni inserimento avrebbe voluto dire rinominare meta' cartella.
const SORGENTI = [
  '10-fondamenta.jsx',       // React, utility, memoria locale, istantanee, registro
  '20-blocco-password.jsx',  // impronta PBKDF2 della password del campo
  '30-tema-e-formati.jsx',   // tema chiaro/scuro, uid/money/posNum, IBAN e PayPal
  '40-configurazione.jsx',   // marchio, funzioni attive, date del campo, meteo, regole
  '45-icone.jsx',
  '50-interfaccia.jsx',      // vocabolario dei bottoni: sei ruoli, tre altezze
  '70-schermata-blocco.jsx', // LockScreen
  // Gli hook: stato ed effetti usciti da App(), un file per area. Stanno
  // PRIMA di 80-app.jsx perche' App() li chiama mentre si disegna, non dopo.
  '76-usa-galleria.jsx',     // foto del campo: ascolto, caricamento, album, PDF ricordo
  '77-usa-scontrini.jsx',    // foto degli scontrini: magazzino, migrazione, potatura
  '78-usa-account.jsx',      // chi sei: login, registrazione, verifica (FEATURES.auth)
  '79-usa-stanza.jsx',       // la stanza: crea, entra, chi c'e' dentro (FEATURES.rooms)
  '80-app.jsx',              // function App(): stato, sincronizzazione, conti, gestori
  // Le schede: disegno uscito da App(), un file per area. Stanno DOPO
  // 80-app.jsx e va bene: sono `const` che App() chiama solo al disegno,
  // cioe' dopo che tutti i sorgenti sono stati eseguiti.
  '81-schede-giorno.jsx',   // Calendario, Menu', Presenze
  '82-schede-conti.jsx',    // Spese Totali, Lista della Spesa, Attrezzatura
  '83-schede-gruppo.jsx',   // Membri, Regole, Dotazioni personali
  '84-schede-album.jsx',    // Archivio, Aiuta Bandy, Come funziona
  '85-scheda-galleria.jsx', // Galleria
  '86-scheda-impostazioni.jsx', // Impostazioni
  '86b-scheda-campo.jsx',     // Il campo: invito, nome e date, luogo, voci, aiutante, Pro
  '87-scheda-compiti.jsx',
  '88-scheda-ingresso.jsx',  // Chi fa cosa: compiti assegnati (FEATURES.compiti)
  '89-scheda-campi.jsx',     // I miei campi: la home, e il modulo Crea / Partecipa
  '89b-scheda-panoramica.jsx', // la Panoramica dei campi (Pro annuale)
  '90-avvio.jsx',            // il mount di React
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
//
// L'elenco dei file che contano NON si scrive a mano: si chiede al precache,
// che li elenca gia' tutti. Scritto a mano invecchiava, e invecchiava in
// silenzio — le icone e il logo erano nel precache ma fuori da qui, quindi
// cambiare il logo non cambiava CACHE_NAME e ogni telefono gia' installato
// avrebbe continuato a mostrare quello vecchio, dalla cache, per sempre.
// La regola giusta e' semplice: **se sta nel precache, conta per la
// versione**. Una prova in unita/compilazione lo sorveglia.
const swPath = path.join(root, 'sw.js');
const swTesto = fs.readFileSync(swPath, 'utf8');
const bloccoAssets = swTesto.slice(swTesto.indexOf('const ASSETS = ['), swTesto.indexOf('];', swTesto.indexOf('const ASSETS = [')));
const filesToHash = [...bloccoAssets.matchAll(/'\.\/([^']+)'/g)]
  .map((m) => m[1])
  .filter((f) => f && f !== 'index.html')      // la radice './' e './index.html' sono lo stesso file
  .concat(['index.html']);
const h = crypto.createHash('sha1');
for (const f of filesToHash) {
  try { h.update(fs.readFileSync(path.join(root, f))); } catch (e) { /* file assente: ignora */ }
}
// Il prefisso e' il nome del prodotto: su questo ramo e' Camp Ops, sulla
// versione privata resta brigata-bandone. Due nomi diversi vuol dire anche
// due cache diverse, che e' giusto: sono due app.
const version = 'camp-ops-' + h.digest('hex').slice(0, 10);

let sw = swTesto;
sw = sw.replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = '${version}';`);
fs.writeFileSync(swPath, sw);
console.log('CACHE_NAME =', version);
