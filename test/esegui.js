// Esecutore delle verifiche: avvia il server statico, lancia le prove in
// test/unita e test/e2e, e alla fine dice se qualcosa si è rotto.
//
//   npm test                 tutto
//   npm test contabilita     solo le prove il cui nome contiene "contabilita"
//   npm test unita           solo quelle che non aprono il browser
//   PROVE_PARALLELE=1 npm test    una alla volta (per inseguire una prova ballerina)
//
// L'uscita è diversa da zero se anche una sola prova fallisce: è quello che
// rende il tutto una rete di sicurezza e non una collezione di stampe.
//
// ---------- Perché le prove girano in parallelo ----------
// Fino al 22 settembre 2026 giravano una alla volta: 75 prove, di cui una
// sessantina aprono un browser vero, per **oltre dieci minuti**. In una
// giornata di lavoro la suite si gira otto o nove volte, e fanno un'ora e
// mezza di sola attesa — su una macchina con quattro core, di cui tre stanno
// a guardare. Il costo vero non è il tempo: è che una rete di sicurezza che
// costa dieci minuti si finisce per lanciarla di meno, ed è esattamente il
// contrario di quello che deve succedere.
//
// Si può fare perché le prove sono già isolate l'una dall'altra: ognuna è un
// processo suo, apre una finestra pulita del browser, e il server statico è
// di sola lettura quindi serve tutti insieme senza stato condiviso. Gli
// screenshot vanno in test/tmp ognuno col suo nome.
//
// Due accorgimenti che non sono ovvi:
//
//   - **le più lente vanno per prime.** Con l'ordine alfabetico, e2e/verdetto
//     (100 s) partiva per ultima e teneva in piedi tutto da sola mentre gli
//     altri posti erano vuoti. La durata si ricorda dal giro precedente, in
//     test/tmp/durate.json: si impara da sé invece di tenere un elenco a mano,
//     che invecchierebbe.
//   - **il parallelismo non arriva a quattro.** Ogni browser si prende un
//     core: riempirli tutti fa rallentare ogni singola prova e trasforma le
//     attese in fallimenti che non c'entrano niente. Si lascia un core libero.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { avvia } = require('./lib/server');

// Cartella di lavoro delle prove (screenshot, scarichi): ricreata ogni volta.
fs.mkdirSync(path.join(__dirname, 'tmp'), { recursive: true });

const PORTA = parseInt(process.env.PORTA_TEST, 10) || 8091;
const filtro = (process.argv[2] || '').toLowerCase();
// Il DOPPIO dei core, non uno per core. Misurato: la suite consuma due
// minuti di processore in sei di orologio, cioe' per due terzi del tempo sta
// ferma ad aspettare — timeout scritti nelle prove e avvii del browser. Con
// un posto per core i core restano vuoti mentre tutti aspettano; al doppio
// l'utilizzo sale all'85% e la suite passa da dieci minuti a due e mezzo.
// Piu' in su non guadagna e comincia a far scadere le attese, che diventano
// fallimenti che col codice non c'entrano niente.
const PARALLELE = Math.max(1, parseInt(process.env.PROVE_PARALLELE, 10)
  || Math.max(4, ((os.cpus() || []).length || 2) * 2));
// Quanto ci ha messo ognuna l'ultima volta: serve solo a metterle in fila.
const DURATE = path.join(__dirname, 'tmp', 'durate.json');
function durateNote() {
  try { return JSON.parse(fs.readFileSync(DURATE, 'utf8')); } catch (e) { return {}; }
}

// Segnali di guasto nelle prove più vecchie, che non usano ancora l'aiuto
// condiviso: se compaiono, la prova è fallita anche se il processo esce con 0.
const SPIE = [/\bKO\b/, /PROBLEMA/, /FATAL/, /FALLITE/];
const spiaErroriJs = /errori(?: JS)?:\s*(?!nessuno)\S/i;

function prove() {
  const out = [];
  for (const cartella of ['unita', 'e2e']) {
    const dir = path.join(__dirname, cartella);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
      const nome = cartella + '/' + f.replace(/\.js$/, '');
      if (!filtro || nome.toLowerCase().includes(filtro)) out.push({ nome, file: path.join(dir, f) });
    }
  }
  return out;
}

function esegui(p) {
  return new Promise((ris) => {
    const inizio = Date.now();
    const proc = spawn(process.execPath, [p.file], {
      cwd: __dirname,
      env: { ...process.env, APP_URL: `http://localhost:${PORTA}` },
    });
    let testo = '';
    proc.stdout.on('data', (d) => { testo += d; });
    proc.stderr.on('data', (d) => { testo += d; });
    proc.on('close', (codice) => {
      const spia = SPIE.some((r) => r.test(testo)) || spiaErroriJs.test(testo);
      ris({ ...p, codice, testo, guasto: codice !== 0 || spia, secondi: ((Date.now() - inizio) / 1000).toFixed(1) });
    });
  });
}

(async () => {
  const elenco = prove();
  if (elenco.length === 0) {
    console.error(filtro ? `Nessuna prova che contenga "${filtro}".` : 'Nessuna prova trovata.');
    process.exit(1);
  }

  let server;
  try {
    server = await avvia(PORTA);
  } catch (e) {
    console.error(`Impossibile aprire la porta ${PORTA}: ${e.message}`);
    process.exit(1);
  }

  console.log(`\n${elenco.length} prove — app servita su http://localhost:${PORTA}`
    + `, ${PARALLELE} alla volta\n`);

  // Le piu' lente per prime: quello che sappiamo dal giro scorso, e le
  // sconosciute in mezzo (un valore alto, cosi' una prova nuova non finisce
  // in coda a fare da tappo la prima volta che gira).
  const note = durateNote();
  const inFila = [...elenco].sort((a, b) => (note[b.nome] || 30) - (note[a.nome] || 30));

  const esiti = [];
  const inizio = Date.now();
  let prossima = 0;
  const riga = (e) => {
    // Il numero di verifiche superate, se la prova lo dichiara.
    const n = (e.testo.match(/(\d+) verifiche/) || e.testo.match(/RISULTATO: (\d+)/) || e.testo.match(/(\d+) controlli/) || [])[1];
    console.log(('  ' + e.nome).padEnd(34, ' ') + ' … '
      + (e.guasto ? 'GUASTO' : 'ok') + (n ? `  (${n} verifiche)` : '') + `  ${e.secondi}s`);
  };
  // Un posto di lavoro: prende la prossima prova finche' ce ne sono.
  const operaio = async () => {
    while (prossima < inFila.length) {
      const p = inFila[prossima++];
      const e = await esegui(p);
      esiti.push(e);
      riga(e);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLELE, inFila.length) }, operaio));

  server.close();

  // Le durate di questo giro servono al prossimo per mettere in fila.
  try {
    const agg = { ...note };
    esiti.forEach((e) => { agg[e.nome] = Number(e.secondi); });
    fs.writeFileSync(DURATE, JSON.stringify(agg, null, 1));
  } catch (e) { /* e' solo un aiuto: se non si scrive, si va in ordine alfabetico */ }

  // In parallelo le prove finiscono alla rinfusa: l'elenco finale torna in
  // ordine, o leggere cosa e' successo diventa un lavoro.
  esiti.sort((a, b) => a.nome.localeCompare(b.nome));

  const guasti = esiti.filter((e) => e.guasto);
  if (guasti.length) {
    console.log('\n' + '='.repeat(70));
    for (const g of guasti) {
      console.log(`\n--- ${g.nome} (uscita ${g.codice}) ---`);
      console.log(g.testo.trim());
    }
  }

  console.log('\n' + '='.repeat(70));
  const minuti = ((Date.now() - inizio) / 1000).toFixed(0);
  console.log(guasti.length
    ? `${guasti.length} prove su ${esiti.length} FALLITE: ${guasti.map((g) => g.nome).join(', ')}`
    : `Tutte le ${esiti.length} prove superate.  (${minuti}s)`);
  console.log('='.repeat(70) + '\n');
  process.exit(guasti.length ? 1 : 0);
})();
