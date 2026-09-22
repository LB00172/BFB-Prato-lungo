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
const crypto = require('crypto');
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

// La divisione di App() ha due mucchi con due regole opposte, e sono proprio
// le regole a renderla una divisione invece che uno spostamento di righe:
//
//   gli HOOK (7*-usa-*.jsx)  tengono lo stato e NON disegnano;
//   le SCHEDE (8[1-9]-*.jsx) disegnano e NON tengono stato.
//
// Se un hook comincia a restituire JSX diventa un componente — e un componente
// aggiunge un confine di riconciliazione, cioe' cambia QUANDO le cose si
// ridisegnano: non e' piu' una pulizia, e' un cambio di comportamento. Se una
// scheda comincia a tenere stato, il suo stato nasce e muore col disegno.
// Nessuna delle due cose fa fallire una prova end-to-end.
const HOOK = SORGENTI.filter((f) => /^7\d-usa-/.test(f));
const SCHEDE = SORGENTI.filter((f) => /^8[1-9]-/.test(f));
const leggi = (f) => fs.readFileSync(path.join(RADICE, 'src', f), 'utf8');

ok(`ci sono ${HOOK.length} hook e ${SCHEDE.length} schede`, HOOK.length > 0 && SCHEDE.length > 0);

const hookCheDisegnano = HOOK.filter((f) => /className=/.test(leggi(f)));
ok('nessun hook disegna' + (hookCheDisegnano.length ? ' — DISEGNANO: ' + hookCheDisegnano.join(', ') : ''),
  hookCheDisegnano.length === 0);

const schedeConStato = SCHEDE.filter((f) => /\buse(State|Effect|Ref|Memo|Callback)\(/.test(leggi(f)));
ok('nessuna scheda tiene stato' + (schedeConStato.length ? ' — LO TENGONO: ' + schedeConStato.join(', ') : ''),
  schedeConStato.length === 0);

// Un hook si chiama mentre App() si disegna, quindi dev'essere gia' stato
// dichiarato: e' l'unico punto dell'ordine in cui un errore fa schermata
// bianca invece di un difetto silenzioso.
const doveApp = SORGENTI.indexOf('80-app.jsx');
const hookInRitardo = HOOK.filter((f) => SORGENTI.indexOf(f) > doveApp);
ok('gli hook stanno prima di 80-app.jsx' + (hookInRitardo.length ? ' — IN RITARDO: ' + hookInRitardo.join(', ') : ''),
  hookInRitardo.length === 0);

// E devono essere chiamati davvero: un hook dichiarato e mai usato e' codice
// morto che sembra lavoro fatto.
const app = leggi('80-app.jsx');
const hookMorti = HOOK.filter((f) => {
  const m = leggi(f).match(/^const (usa[A-Za-z]+) = /m);
  return !m || !new RegExp('\\b' + m[1] + '\\(').test(app);
});
ok('e vengono chiamati da App()' + (hookMorti.length ? ' — MAI CHIAMATI: ' + hookMorti.join(', ') : ''),
  hookMorti.length === 0);

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

// Il vocabolario dei bottoni: un ruolo o una misura scritti male non li prende
// nessuno. Con la rete di sicurezza il bottone diventa del colore sbagliato in
// silenzio (un "whatsap" verde bosco invece che verde WhatsApp); senza, diventa
// trasparente. Nessuna delle due cose fa fallire una prova end-to-end, perche'
// il bottone c'e', funziona e ha il testo giusto. Si controlla qui.
const interfaccia = fs.readFileSync(path.join(RADICE, 'src', '50-interfaccia.jsx'), 'utf8');
const nomiDi = (blocco) => {
  const i = interfaccia.indexOf('const ' + blocco + ' = {');
  const j = interfaccia.indexOf('};', i);
  return [...interfaccia.slice(i, j).matchAll(/^\s{2}([A-Za-z]+):/gm)].map((m) => m[1]);
};
const RUOLI = nomiDi('BOTTONE_RUOLO');
const MISURE = nomiDi('BOTTONE_MISURA');
const TONI = nomiDi('BOTTONE_ICONA');
const FORME = nomiDi('SCELTA_FORMA');
const TONI_SCELTA = nomiDi('SCELTA_TONO');
const TESTI_SCELTA = nomiDi('SCELTA_TESTO');
ok(`il vocabolario dichiara ${RUOLI.length} ruoli, ${MISURE.length} misure e ${TONI.length} toni d'icona`,
  RUOLI.length >= 5 && MISURE.length >= 3 && TONI.length >= 3);
ok(`e ${FORME.length} forme di chip, ${TONI_SCELTA.length} toni e ${TESTI_SCELTA.length} misure di testo`,
  FORME.length >= 5 && TONI_SCELTA.length >= 5 && TESTI_SCELTA.length >= 3);

const sbagliati = [];
SORGENTI.forEach((f) => {
  const testo = fs.readFileSync(path.join(RADICE, 'src', f), 'utf8');
  [...testo.matchAll(/\bbottone\('([^']*)',\s*'([^']*)'/g)].forEach((m) => {
    if (!RUOLI.includes(m[1])) sbagliati.push(`${f}: ruolo "${m[1]}"`);
    if (!MISURE.includes(m[2])) sbagliati.push(`${f}: misura "${m[2]}"`);
  });
  [...testo.matchAll(/\bbottoneIcona\('([^']*)'/g)].forEach((m) => {
    if (!TONI.includes(m[1])) sbagliati.push(`${f}: tono "${m[1]}"`);
  });
  // Il chip di scelta ha un argomento in piu' — il tono — e con la rete di
  // sicurezza uno sbagliato non si vede: il chip resta acceso e verde, solo
  // di un verde che non e' il suo. E' proprio quello che si vuole scoprire.
  [...testo.matchAll(/\bbottoneScelta\('([^']*)',\s*'([^']*)',[^,]*,\s*'([^']*)'/g)].forEach((m) => {
    if (!FORME.includes(m[1])) sbagliati.push(`${f}: forma "${m[1]}"`);
    if (!TONI_SCELTA.includes(m[2])) sbagliati.push(`${f}: tono di scelta "${m[2]}"`);
    if (!TESTI_SCELTA.includes(m[3])) sbagliati.push(`${f}: misura di scelta "${m[3]}"`);
  });
});
ok('ogni bottone chiede un ruolo e una misura che esistono'
  + (sbagliati.length ? ' — SBAGLIATI: ' + sbagliati.join(', ') : ''), sbagliati.length === 0);

// I bottoni ancora scritti a mano, contati. Non e' un divieto: e' un
// inventario che non deve crescere da solo.
//
// Ventuno su 140 non passano dal vocabolario, e non e' una dimenticanza.
// Sono forme che un vocabolario di bottoni non descrive: la casella di un
// giorno sul calendario (tre stati), le voci del menu di navigazione, le
// caselle di spunta quadrate, le frecce tonde dell'album, le mattonelle
// delle foto, la polaroid, il pulsante a tre righe in cima, i riquadri
// tratteggiati "aggiungi", e i due bottoni del visore foto — che stanno su
// fondo nero e con i colori dell'app diventerebbero illeggibili.
// Inventare un ruolo per ognuna vorrebbe dire rifare la ventina di forme
// usate una volta sola da cui si era partiti (RICOGNIZIONE-UI.md, § 13).
//
// Il conteggio e' la guardia: se sale, qualcuno ha scritto un bottone a mano
// invece di chiedere una parola al vocabolario; se scende, si aggiorna qui.
const A_MANO_ATTESI = {
  '80-app.jsx': 7,
  '81-schede-giorno.jsx': 3,
  '82-schede-conti.jsx': 2,
  '83-schede-gruppo.jsx': 2,
  '84-schede-album.jsx': 3,
  '85-scheda-galleria.jsx': 4,
  // "Chi fa cosa" non ne ha nessuno: e' nata dopo il vocabolario, e la sua
  // casella di spunta ha fatto entrare nel vocabolario la forma "casella" —
  // che esisteva gia' nell'attrezzatura, scritta a mano.
  '87-scheda-compiti.jsx': 0,
};

// Legge la className di un <button>, comprese quelle scritte fra graffe.
const classeDi = (testo, da) => {
  let d = 0;
  let fine = -1;
  for (let j = da; j < testo.length; j++) {
    const c = testo[j];
    if (c === '{') d++;
    else if (c === '}') d--;
    else if (c === '>' && d === 0) { fine = j; break; }
  }
  const tag = testo.slice(da, fine < 0 ? da + 500 : fine + 1);
  const k = tag.indexOf('className=');
  if (k < 0) return '';
  const resto = tag.slice(k + 'className='.length);
  if (resto[0] === '"') return resto.slice(1, resto.indexOf('"', 1));
  if (resto[0] !== '{') return '';
  let p = 0;
  for (let j = 0; j < resto.length; j++) {
    if (resto[j] === '{') p++;
    else if (resto[j] === '}') { p--; if (p === 0) return resto.slice(0, j + 1); }
  }
  return '';
};

const aMano = {};
const schedeNuove = [];
SORGENTI.filter((f) => /^8/.test(f)).forEach((f) => {
  const testo = fs.readFileSync(path.join(RADICE, 'src', f), 'utf8');
  let i = testo.indexOf('<button');
  while (i >= 0) {
    const cls = classeDi(testo, i);
    if (!/\bbottone(Icona|Riga|Scelta)?\(/.test(cls)) {
      aMano[f] = (aMano[f] || 0) + 1;
      if (!(f in A_MANO_ATTESI)) schedeNuove.push(`${f}: ${cls.replace(/\s+/g, ' ').slice(0, 50)}…`);
    }
    i = testo.indexOf('<button', i + 7);
  }
});
const scostamenti = Object.keys(A_MANO_ATTESI)
  .filter((f) => (aMano[f] || 0) !== A_MANO_ATTESI[f])
  .map((f) => `${f}: ${aMano[f] || 0} invece di ${A_MANO_ATTESI[f]}`)
  .concat(schedeNuove);
const totaleAMano = Object.values(aMano).reduce((a, b) => a + b, 0);
ok(`i bottoni scritti a mano restano ${totaleAMano}, quelli censiti`
  + (scostamenti.length ? ' — CAMBIATI: ' + scostamenti.join(', ') : ''), scostamenti.length === 0);

// Le date passano tutte da L.data(): un 'it-IT' scritto a mano e' una data
// che resta italiana quando l'app parla spagnolo, e non se ne accorge nessuno
// finche' qualcuno non guarda quella schermata in quella lingua. Ce n'erano 32
// sparsi in otto file (ROADMAP.md § 18).
const conDateAMano = SORGENTI.filter((f) => /'it-IT'|"it-IT"/.test(leggi(f)));
ok('nessuna data scritta a mano nei sorgenti'
  + (conDateAMano.length ? ' — CE NE SONO IN: ' + conDateAMano.join(', ') : ''),
  conDateAMano.length === 0);

// Il nome della cache del service worker cambia a ogni build: se resta
// indietro, i telefoni non ricevono l'aggiornamento.
const sw = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');
// Il prefisso e' il nome del prodotto, e sui due rami e' diverso: qui e'
// camp-ops, sulla versione privata brigata-bandone. Due nomi vuol dire due
// cache separate, ed e' giusto — sono due app.
ok(`sw.js ha un CACHE_NAME con impronta (${(sw.match(/const CACHE_NAME = '([^']*)'/) || [])[1]})`,
  /const CACHE_NAME = '[a-z-]+-[0-9a-f]{10}'/.test(sw));

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

// ---------- Il § 18 non torna indietro ----------
// I file gia' passati dal dizionario devono restarci. Senza questa guardia
// basta una riga nuova scritta in italiano dentro una scheda tradotta e
// nessuno se ne accorge finche' qualcuno non apre l'app in spagnolo.
//
// Il numero atteso NON e' sempre zero: il censimento e' un'euristica, e in
// qualche file restano una o due schegge di codice che sembrano prosa. Sono
// contate qui una per una, cosi' il conto e' esatto lo stesso — e se cambia
// in un senso o nell'altro la prova diventa rossa e si guarda perche'.
//
// Adesso ci sono TUTTI i sorgenti: il § 18 e' finito, e da qui in poi la
// tabella serve solo a non tornare indietro — anche per i file che nascono
// dopo, che senza la riga in fondo entrerebbero senza essere contati.
{
  const { perFile } = require('../censimento-testi');
  const TRADOTTI = {
    '10-fondamenta.jsx': 3,          // console.warn e due schegge di codice
    '20-blocco-password.jsx': 0,
    '30-tema-e-formati.jsx': 0,
    // Il marchio, le REGOLE del campo e la DOTAZIONE base: contenuto della
    // room, non dell'app. Restano in italiano per scelta (ROADMAP § 18).
    '40-configurazione.jsx': 20,
    '50-interfaccia.jsx': 0,
    '60-gioco.jsx': 3,               // i nomi dei livelli: sono luoghi veri
    '70-schermata-blocco.jsx': 0,
    '75-usa-gioco.jsx': 1,           // una scheggia di codice
    '76-usa-galleria.jsx': 1,        // una scheggia di codice
    '77-usa-scontrini.jsx': 2,       // 'memoria del telefono': e' un valore, non un testo
    '78-usa-account.jsx': 1,         // una scheggia di codice
    '79-usa-stanza.jsx': 1,          // una scheggia di codice
    // Un console.warn, il titolo del foglio di condivisione (che porta il
    // nome del campo) e quattordici schegge di codice.
    '80-app.jsx': 17,
    '81-schede-giorno.jsx': 1,       // una scheggia di codice
    '82-schede-conti.jsx': 0,
    '83-schede-gruppo.jsx': 0,
    '84-schede-album.jsx': 0,
    '85-scheda-galleria.jsx': 0,
    '86-scheda-impostazioni.jsx': 2, // due schegge di codice
    '87-scheda-compiti.jsx': 1,      // una scheggia di codice
    '90-avvio.jsx': 0,
  };
  const fuori = [];
  Object.keys(TRADOTTI).forEach((f) => {
    const quanti = perFile[f] || 0;
    if (quanti !== TRADOTTI[f]) fuori.push(`${f}: ${quanti} invece di ${TRADOTTI[f]}`);
  });
  // E un sorgente NUOVO non deve poter entrare senza passare di qui: la
  // tabella guardava solo i file che conosceva, quindi un file appena nato
  // pieno di testo italiano sarebbe passato senza che nessuno lo contasse.
  // E' successo con 78-usa-account.jsx, ed e' la stessa forma della trappola
  // «un controllo che chiede dei dati non vale quando i dati non ci sono».
  SORGENTI.filter((f) => !(f in TRADOTTI))
    .forEach((f) => fuori.push(`${f}: sorgente nuovo, non e' nella tabella`));
  ok(`i ${Object.keys(TRADOTTI).length} file gia' tradotti non hanno testo nuovo scritto a mano`
    + (fuori.length ? ' — ' + fuori.join('; ') : ''), fuori.length === 0);
}

// ---------- La scala del testo non si riapre ----------
// Dodici misure erano diventate dodici perche' ogni volta che serviva un
// testo "un po' piu' piccolo" qualcuno ne scriveva una nuova a occhio. La
// scala sta in index.html (@theme) e i sorgenti chiedono un NOME: qui si
// controlla che nessuno sia tornato a scrivere il numero.
//
// La prova end-to-end (e2e/scala-testo) guarda quello che disegna il browser,
// che e' la verita'; questa costa un secondo e dice SUBITO in quale file.
{
  const grezze = [];
  SORGENTI.forEach((f) => {
    const testo = fs.readFileSync(path.join(RADICE, 'src', f), 'utf8');
    [...testo.matchAll(/\btext-(xs|sm|base|lg|xl|2xl|3xl|\[\d+px\])/g)].forEach((m) => {
      grezze.push(`${f}: text-${m[1]}`);
    });
  });
  ok(`nessuna misura di testo scritta a numero nei sorgenti (${grezze.length})`
    + (grezze.length ? ' — ' + grezze.slice(0, 6).join(', ') : ''), grezze.length === 0);

  // E il contrario: i nomi che i sorgenti usano devono esistere fra i token.
  const html = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');
  const token = new Set([...html.matchAll(/--text-([a-z]+):/g)].map((m) => m[1]));
  const inventate = new Set();
  SORGENTI.forEach((f) => {
    const testo = fs.readFileSync(path.join(RADICE, 'src', f), 'utf8');
    [...testo.matchAll(/\btext-([a-z]+)\b/g)].forEach((m) => {
      // text-white, text-gray-400… sono colori: si guardano solo i nomi che
      // index.html dichiara come misure, piu' quelli che ci somigliano.
      if (token.has(m[1])) return;
      if (['minuto', 'piccolo', 'normale', 'medio', 'grande', 'titolo'].includes(m[1])) inventate.add(f + ': text-' + m[1]);
    });
  });
  ok(`le misure usate esistono fra i token di index.html (${token.size} dichiarati)`
    + (inventate.size ? ' — INVENTATE: ' + [...inventate].join(', ') : ''), inventate.size === 0);
}

// ---------- Le regole Firestore non restano scoperte in silenzio ----------
// Le regole si provano con `npm run regole`, che ha bisogno dell'emulatore e
// quindi sta fuori da `npm test`. Il rischio e' ovvio: qualcuno aggiunge una
// collezione alle regole, non tocca le prove, e nessuno se ne accorge —
// perche' la prova che avrebbe dovuto accorgersene non gira mai.
//
// Questa guardia gira sempre e non ha bisogno di niente: legge le strade
// nominate in firestore.rules e chiede che ognuna compaia nelle prove delle
// regole. Non dice che la regola e' giusta — quello lo dice l'emulatore — ma
// dice che qualcuno l'ha guardata.
{
  const regole = fs.readFileSync(path.join(RADICE, 'firestore.rules'), 'utf8');
  const prova = fs.readFileSync(path.join(RADICE, 'test', 'regole', 'stanze.js'), 'utf8');

  // I nomi veri dentro i match: 'rooms', 'private', 'members', 'dati',
  // 'camps'. Le graffe sono variabili, non strade.
  const strade = new Set();
  [...regole.matchAll(/match\s+([^\s{]+)\s*\{/g)].forEach((m) => {
    m[1].split('/').forEach((pezzo) => {
      if (pezzo && !pezzo.startsWith('{') && pezzo !== 'databases' && pezzo !== 'documents') strade.add(pezzo);
    });
  });
  const scoperte = [...strade].filter((s) => prova.indexOf(s) < 0);
  ok(`ogni strada nominata in firestore.rules compare nelle prove (${strade.size})`
    + (scoperte.length ? ' — SCOPERTE: ' + scoperte.join(', ') : ''), scoperte.length === 0);

  // Il diniego finale e' quello che tiene chiuso tutto il resto: togliendolo,
  // ventidue verifiche delle regole diventano rosse in un colpo (l'ho
  // sabotato apposta). Vale la pena controllare che ci sia ancora, e che
  // sia l'ULTIMO — una regola che permette, messa dopo, non lo annulla, ma
  // una catch-all messa in mezzo nasconde quelle che vengono dopo.
  const ultimo = regole.lastIndexOf('match /{document=**}');
  const coda = ultimo >= 0 ? regole.slice(ultimo) : '';
  ok('firestore.rules finisce con il diniego di tutto il resto',
    ultimo >= 0 && /allow\s+read,\s*write:\s*if\s+false\s*;/.test(coda));
}

// ---------- Tutto quello che sta nel precache conta per la versione --------
// Il service worker serve cache-first: un file cambiato che non fa cambiare
// CACHE_NAME e' un file che in produzione c'e' e che nessuno riceve, perche'
// i telefoni continuano a servire quello vecchio dalla cache. E' gia'
// successo (CLAUDE.md), e stava per succedere di nuovo: logo.png e le tre
// icone erano nel precache ma fuori dall'elenco che calcola la versione, che
// era scritto a mano. Cambiare il logo non avrebbe cambiato niente per chi
// aveva gia' l'app installata.
//
// Adesso build.js l'elenco lo chiede al precache. Questa prova verifica che
// continui a farlo — cioe' che il legame non venga sciolto di nuovo.
{
  const sw = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');
  const blocco = sw.slice(sw.indexOf('const ASSETS = ['), sw.indexOf('];', sw.indexOf('const ASSETS = [')));
  const precache = [...blocco.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);

  // Si ricalcola la versione come fa build.js e si confronta con quella
  // scritta in sw.js: se qualcuno rimette un elenco a mano che dimentica un
  // file, i due numeri non combaciano.
  const h = crypto.createHash('sha1');
  const ordine = precache.filter((f) => f !== 'index.html').concat(['index.html']);
  ordine.forEach((f) => {
    try { h.update(fs.readFileSync(path.join(RADICE, f))); } catch (e) { /* assente */ }
  });
  const atteso = h.digest('hex').slice(0, 10);
  // L'impronta e' l'ultimo pezzo dopo il trattino: il prefisso puo' avere
  // dei trattini dentro ("camp-ops"), e un'espressione che non lo prevede
  // torna undefined — cosa che mi e' appena successa.
  const scritto = (sw.match(/const CACHE_NAME = '[a-z-]+-([0-9a-f]{10})'/) || [])[1];
  ok(`CACHE_NAME nasce da TUTTO il precache, ${precache.length} file (${scritto})`
    + (scritto === atteso ? '' : ` — ATTESO ${atteso}: qualcosa nel precache non conta per la versione`),
    scritto === atteso);

  // E in particolare le immagini, che sono il caso in cui l'errore non si
  // vede: il codice e' giusto, la pagina funziona, e l'icona resta quella di
  // prima su ogni telefono che aveva gia' l'app.
  const immagini = precache.filter((f) => /\.(png|jpg|svg|ico)$/.test(f));
  ok(`e le ${immagini.length} immagini del precache sono fra quelle contate`,
    immagini.length > 0 && immagini.every((f) => ordine.includes(f)));
}

// ---------- Niente `require` dentro il codice che gira nel browser --------
// La funzione passata ad addInitScript viene serializzata e ESEGUITA NEL
// BROWSER, dove `require` non esiste. Scriverlo li' dentro non da' errore di
// sintassi: la pagina si apre, lo script fallisce in silenzio, e la prova
// muore venti secondi dopo su un timeout che dice solo "non trovo il menu".
//
// Ci sono cascato in DIECI file insieme, sostituendo un valore ricopiato con
// una lettura da file. Il valore si passa come argomento — addInitScript ne
// accetta uno — e la funzione resta pura.
{
  const fuori = [];
  fs.readdirSync(path.join(RADICE, 'test', 'e2e')).filter((f) => f.endsWith('.js')).forEach((f) => {
    const testo = fs.readFileSync(path.join(RADICE, 'test', 'e2e', f), 'utf8');
    let i = testo.indexOf('addInitScript(');
    while (i >= 0) {
      // Il corpo della funzione: da addInitScript( fino alla virgola che
      // introduce l'argomento, o alla parentesi di chiusura se non c'e'.
      const da = i + 'addInitScript('.length;
      let p2 = 1;
      let fine2 = da;
      for (let j = da; j < testo.length && p2 > 0; j++) {
        if (testo[j] === '(') p2++;
        else if (testo[j] === ')') p2--;
        fine2 = j;
      }
      const corpo = testo.slice(da, fine2);
      // Si toglie quello che sta DOPO l'ultima graffa chiusa o freccia
      // semplice: e' l'argomento, e li' require ci sta benissimo.
      const taglio = corpo.lastIndexOf('}, ') >= 0 ? corpo.lastIndexOf('}, ')
        : (corpo.indexOf('), ') >= 0 ? corpo.indexOf('), ') : corpo.length);
      if (/\brequire\s*\(/.test(corpo.slice(0, taglio))) fuori.push(f);
      i = testo.indexOf('addInitScript(', i + 1);
    }
  });
  const unici = [...new Set(fuori)];
  ok(`nessun require dentro una funzione che gira nel browser (${unici.length})`
    + (unici.length ? ' — DENTRO: ' + unici.join(', ') : ''), unici.length === 0);
}

// ---------- Nessun percorso Firestore scritto a mano ----------------------
// 'camps' era scritto in trentasette punti di firebase-sync.js. Adesso passa
// tutto da percorso(), perche' le due versioni mettono i dati in posti
// diversi e un percorso che non combacia con le regole non da' un errore:
// da' un permesso negato su ogni scrittura, e l'app sembra rotta senza dire
// perche'. Se qualcuno ne riscrive uno a mano, questa prova lo vede.
{
  const sync = fs.readFileSync(path.join(RADICE, 'firebase-sync.js'), 'utf8');
  // Attenzione allo spazio: con `\s*` l'espressione puo' consumare zero
  // caratteri e poi trovarsi davanti " ...percorso" — con lo spazio — che
  // non e' "...percorso", quindi il divieto non scatta e la guardia dice
  // sempre di si'. Ci sono appena cascato: segnalava ventinove percorsi a
  // mano che erano tutti giusti.
  const aMano = [...sync.matchAll(/fb\.(doc|collection)\(db,[ ]+(?!\.\.\.percorso)([^)\n]*)/g)]
    .map((m) => m[1] + '(' + m[2].trim().slice(0, 40));
  ok(`ogni percorso Firestore passa da percorso() (${aMano.length} a mano)`
    + (aMano.length ? ' — A MANO: ' + aMano.join(', ') : ''), aMano.length === 0);
}

// ---------- Nessuna chiave di servizio nel repository ---------------------
// Le chiavi web di Firebase (firebase-config.js) sono pubbliche per progetto
// e stanno bene dove stanno. Una chiave di SERVIZIO e' un'altra cosa: e'
// un'identita' amministrativa che SCAVALCA le regole Firestore — vale piu' di
// tutto quello che c'e' scritto in firestore.rules messo insieme. Se ne
// arriva una nel repository, ci resta anche dopo che la cancelli, perche'
// la storia di git non dimentica.
//
// .gitignore la ferma, ma solo se si chiama come ci si aspetta. Questa prova
// guarda il CONTENUTO, che non si puo' rinominare.
{
  const sospetti = [];
  const salta = new Set(['node_modules', '.git', 'test/tmp', 'vendor']);
  // Il motivo si compone a pezzi, altrimenti questa prova trova SE STESSA —
  // i marcatori sarebbero scritti qui dentro. L'alternativa era un elenco di
  // file da saltare, che e' peggio: un giorno ci finisce dentro un file vero
  // e la guardia smette di guardarlo senza dirlo a nessuno.
  const marcatore = new RegExp([
    'BEGIN [A-Z ]*PRIVATE' + ' KEY',
    '"type"\\s*:\\s*"service' + '_account"',
    '"private' + '_key"',
  ].join('|'));
  const gira = (dir, rel) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((v) => {
      const dentro = rel ? rel + '/' + v.name : v.name;
      if (salta.has(dentro) || salta.has(v.name)) return;
      const pieno = path.join(dir, v.name);
      if (v.isDirectory()) { gira(pieno, dentro); return; }
      if (!/\.(json|js|txt|pem|p12|env)$/.test(v.name) && v.name !== '.env') return;
      let testo = '';
      try { testo = fs.readFileSync(pieno, 'utf8'); } catch (e) { return; }
      if (marcatore.test(testo)) sospetti.push(dentro);
    });
  };
  gira(RADICE, '');
  ok(`nessuna chiave di servizio nel repository (${sospetti.length})`
    + (sospetti.length ? ' — TROVATA IN: ' + sospetti.join(', ') : ''), sospetti.length === 0);
}

// ---------- La relazione fra i due rami, detta invece che ricordata -------
// Le versioni sono due (CLAUDE.md): `main` e' la privata, `camp-ops` la
// pubblica. Tenerle separate e' voluto — ma "quanto sono diverse?" era una
// domanda a cui si rispondeva a memoria, e a memoria faceva paura: sembrava
// una biforcazione, ed erano invece 52 file di lavoro NUOVO piu' 6 di marchio.
//
// Qui la relazione si dichiara, e diventa una cosa che si legge:
//
//   UGUALI   devono restare identici. Se divergono e' un problema, non una
//            conseguenza accettabile: un errore sui conti corretto da una
//            parte sola resta vivo dall'altra, e lo scopre chi sta dividendo
//            le spese davanti a venti persone.
//   DIVERSI  devono restare diversi. Sono l'identita' del prodotto: se uno
//            smette di differire, qualcuno ha riportato il marchio della
//            Brigata dentro l'app pubblica.
//
// Tutto il resto che differisce e' lavoro che non ha ancora attraversato, e
// il riepilogo lo conta: e' quel numero che dice se la distanza sta
// aumentando o se e' solo una coda.
{
  const { execFileSync } = require('child_process');
  const UGUALI = ['conti.js', 'presenze.js', 'sync-merge.js', 'allarmi.js',
    'menu-spesa.js', 'magazzino-foto.js', 'pdf-ricordo.js'];
  const DIVERSI = ['firebase-config.js', 'manifest.json',
    'logo.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
  const git = (args) => execFileSync('git', args, { cwd: RADICE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const bin = (args) => execFileSync('git', args, { cwd: RADICE, stdio: ['ignore', 'pipe', 'ignore'] });

  let ramo = '';
  try { ramo = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim(); } catch (e) { ramo = ''; }

  if (ramo === 'main') {
    // Su main il confronto sarebbe con se stessi: non dice niente, e una
    // verifica che non dice niente e' peggio di nessuna verifica.
    ok('sul ramo privato non c\'e' + ' niente da confrontare', true);
  } else {
    let potuto = true;
    const leggiLa = (f) => {
      try { return bin(['show', 'main:' + f]); } catch (e) { return null; }
    };
    const leggiQui = (f) => {
      try { return fs.readFileSync(path.join(RADICE, f)); } catch (e) { return null; }
    };

    const divergono = [];
    UGUALI.forEach((f) => {
      const la = leggiLa(f);
      if (la === null) { potuto = false; return; }
      if (!la.equals(leggiQui(f) || Buffer.alloc(0))) divergono.push(f);
    });
    ok(`i ${UGUALI.length} file che devono restare identici lo sono`
      + (!potuto ? ' — NON HO POTUTO CONFRONTARE: manca il ramo main o git' : '')
      + (divergono.length ? ' — DIVERGONO: ' + divergono.join(', ') : ''),
      potuto && divergono.length === 0);

    // E il contrario: l'identita' del prodotto deve restare diversa. Se
    // firebase-config.js tornasse uguale a quello di main, l'app pubblica
    // porterebbe il marchio della Brigata e scriverebbe nel suo campo.
    const uguagliati = [];
    let potuto2 = true;
    DIVERSI.forEach((f) => {
      const la = leggiLa(f);
      if (la === null) { potuto2 = false; return; }
      if (la.equals(leggiQui(f) || Buffer.alloc(0))) uguagliati.push(f);
    });
    ok(`i ${DIVERSI.length} file che portano il marchio restano diversi da main`
      + (!potuto2 ? ' — NON HO POTUTO CONFRONTARE' : '')
      + (uguagliati.length ? ' — TORNATI UGUALI: ' + uguagliati.join(', ') : ''),
      potuto2 && uguagliati.length === 0);

    // ---------- Il marchio che usciva dove la guardia non guardava ----------
    // "firebase-config.js differisce da main" non bastava, ed e' stato verde
    // per settimane mentre il marchio usciva lo stesso. I due file erano
    // diversi in due righe (`dati`, `CAMP_CODE_DEFAULT`) e IDENTICI nelle
    // sei che contano: stesso apiKey, stesso projectId, stesso authDomain.
    // Cioe' lo stesso progetto Firebase — e quindi, premendo "Entra con
    // Google", una finestra di consenso che diceva `brigata-bandone` a ogni
    // utente della versione pubblica, nel momento in cui e' piu' guardata.
    //
    // Un file "diverso" non e' un marchio separato: separato lo e' quando a
    // differire sono i valori che l'utente legge. Qui si guardano quelli.
    const CHIAVI_PROGETTO = ['apiKey', 'authDomain', 'projectId', 'appId'];
    const valore = (testo, chiave) => {
      const m = new RegExp('\\b' + chiave + ':\\s*"([^"]*)"').exec(testo || '');
      return m ? m[1] : null;
    };
    try {
      const laa = git(['show', 'main:firebase-config.js']);
      const quii = fs.readFileSync(path.join(RADICE, 'firebase-config.js'), 'utf8');
      const condivise = CHIAVI_PROGETTO.filter((c) => {
        const a = valore(laa, c), b = valore(quii, c);
        return a !== null && b !== null && a === b;
      });
      ok('il progetto Firebase della pubblica non e\' quello della Brigata'
        + (condivise.length ? ' — ANCORA IN COMUNE: ' + condivise.join(', ') : ''),
        condivise.length === 0);
    } catch (e) {
      ok('il progetto Firebase della pubblica non e\' quello della Brigata'
        + ' — NON HO POTUTO CONFRONTARE', false);
    }

    // Il riepilogo. Non fa fallire niente: e' la riga che risponde a
    // "quanto sono lontani i due rami, e perche'" senza doverlo ricordare.
    try {
      const righe = git(['diff', '--name-status', 'main...HEAD']).trim().split('\n').filter(Boolean);
      const soloQui = righe.filter((r) => r.startsWith('A')).length;
      const cambiati = righe.filter((r) => r.startsWith('M')).map((r) => r.split('\t')[1]);
      const marchio = cambiati.filter((f) => DIVERSI.includes(f)).length;
      const inViaggio = cambiati.length - marchio;
      ok(`riepilogo: ${marchio} file di marchio, ${inViaggio} modificati dal lavoro`
        + ` non ancora attraversato, ${soloQui} nati qui`, true);
    } catch (e) { /* il riepilogo non fa fallire niente */ }
  }
}

fine();
