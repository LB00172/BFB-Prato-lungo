// Fotografa il DOM di tutte le schermate, o confronta due fotografie.
//
// E' lo strumento con cui si sposta il codice senza rischiare niente
// (ROADMAP.md § 14): il disegno di una scheda o lo stato di un'area cambiano
// FILE, non comportamento, quindi l'HTML prodotto deve restare identico al
// carattere. Le prove end-to-end guardano quello che sanno guardare; qui si
// confronta tutto, che e' l'unico modo di accorgersi di una riga sparita in un
// ramo che nessuno visita.
//
// Non e' una prova: non gira con `npm test`, perche' non esiste un "giusto" da
// confrontare — il paragone e' fra il prima e il dopo di UNO spostamento.
//
//   node test/schermate-confronto.js prima.json      (prima di toccare)
//   ... si sposta il codice, si lancia node build.js ...
//   node test/schermate-confronto.js dopo.json
//   node test/schermate-confronto.js prima.json dopo.json
//
// Serve il server statico acceso: `node -e "require('./test/lib/server').avvia(8091)"`.
const fs = require('fs');
const { apri } = require('./lib/app');
const { semina, cattura, stabilizza, SCHERMATE } = require('./lib/schermate');

const [a, b] = process.argv.slice(2);

if (!a) {
  console.error('Uso:\n  node test/schermate-confronto.js <file.json>            fotografa\n'
    + '  node test/schermate-confronto.js <prima.json> <dopo.json>  confronta');
  process.exit(2);
}

// Due file: confronto, senza aprire il browser.
if (b) {
  const A = JSON.parse(fs.readFileSync(a, 'utf8'));
  const B = JSON.parse(fs.readFileSync(b, 'utf8'));
  let diverse = 0;
  for (const k of Object.keys(A)) {
    const x = stabilizza(A[k]);
    const y = stabilizza(B[k] === undefined ? '(schermata sparita)' : B[k]);
    if (x === y) { console.log('=  ' + k); continue; }
    diverse++;
    console.log('≠  ' + k);
    // Il primo carattere che cambia, col contorno: basta a capire cos'e'
    // successo senza scorrere ottomila caratteri di HTML.
    let i = 0;
    while (i < Math.min(x.length, y.length) && x[i] === y[i]) i++;
    console.log('   prima: …' + x.slice(Math.max(0, i - 110), i + 110));
    console.log('   dopo : …' + y.slice(Math.max(0, i - 110), i + 110));
  }
  const nuove = Object.keys(B).filter((k) => !(k in A));
  if (nuove.length) { diverse += nuove.length; console.log('+  schermate nuove: ' + nuove.join(', ')); }
  console.log('\n' + (diverse === 0
    ? `DOM identico al carattere su tutte le ${Object.keys(A).length} schermate`
    : `${diverse} schermate su ${Object.keys(A).length} cambiate`));
  process.exit(diverse === 0 ? 0 : 1);
}

// Un file solo: fotografa.
(async () => {
  const { browser, page, menu } = await apri({ initScript: semina });
  const fuori = await cattura(page, menu);
  fs.writeFileSync(a, JSON.stringify(fuori, null, 1));
  const rotte = Object.keys(fuori).filter((k) => fuori[k].startsWith('(non si apre'));
  console.log(`fotografate ${Object.keys(fuori).length} schermate su ${SCHERMATE.length} → ${a}`);
  if (rotte.length) console.log('ATTENZIONE, non si aprono: ' + rotte.join(', '));
  await browser.close();
  process.exit(rotte.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
