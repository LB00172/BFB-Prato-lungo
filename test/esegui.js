// Esecutore delle verifiche: avvia il server statico, lancia una per una le
// prove in test/unita e test/e2e, e alla fine dice se qualcosa si è rotto.
//
//   npm test                 tutto
//   npm test contabilita     solo le prove il cui nome contiene "contabilita"
//   npm test unita           solo quelle che non aprono il browser
//
// L'uscita è diversa da zero se anche una sola prova fallisce: è quello che
// rende il tutto una rete di sicurezza e non una collezione di stampe.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { avvia } = require('./lib/server');

// Cartella di lavoro delle prove (screenshot, scarichi): ricreata ogni volta.
fs.mkdirSync(path.join(__dirname, 'tmp'), { recursive: true });

const PORTA = parseInt(process.env.PORTA_TEST, 10) || 8091;
const filtro = (process.argv[2] || '').toLowerCase();

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

  console.log(`\n${elenco.length} prove — app servita su http://localhost:${PORTA}\n`);

  const esiti = [];
  for (const p of elenco) {
    process.stdout.write(('  ' + p.nome).padEnd(34, ' ') + ' … ');
    const e = await esegui(p);
    esiti.push(e);
    // Numero di verifiche superate, se la prova lo dichiara.
    const n = (e.testo.match(/(\d+) verifiche/) || e.testo.match(/RISULTATO: (\d+)/) || e.testo.match(/(\d+) controlli/) || [])[1];
    console.log((e.guasto ? 'GUASTO' : 'ok') + (n ? `  (${n} verifiche)` : '') + `  ${e.secondi}s`);
  }

  server.close();

  const guasti = esiti.filter((e) => e.guasto);
  if (guasti.length) {
    console.log('\n' + '='.repeat(70));
    for (const g of guasti) {
      console.log(`\n--- ${g.nome} (uscita ${g.codice}) ---`);
      console.log(g.testo.trim());
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(guasti.length
    ? `${guasti.length} prove su ${esiti.length} FALLITE: ${guasti.map((g) => g.nome).join(', ')}`
    : `Tutte le ${esiti.length} prove superate.`);
  console.log('='.repeat(70) + '\n');
  process.exit(guasti.length ? 1 : 0);
})();
