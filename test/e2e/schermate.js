// Ogni scheda si apre e disegna qualcosa di sensato.
//
// Nasce dalla divisione di 80-app.jsx (ROADMAP §14): spostando il disegno
// delle schede in sorgenti separati, il modo di sbagliare piu' probabile non
// e' un errore rumoroso — e' una scheda che si apre VUOTA perche' una
// dipendenza non e' stata passata, o che mostra "undefined" dove c'era un
// numero. Le altre prove entrano in due o tre schede; questa le apre tutte.
//
// La semina sta in test/lib/schermate.js insieme alla cattura del DOM, che
// serve anche da attrezzo: prima di spostare un pezzo di interfaccia si
// cattura, si sposta, si ricattura e i due HTML devono essere identici al
// carattere. E' cosi' che la divisione e' stata dimostrata.
const { apri, ok, fine } = require('../lib/app');
const { semina, cattura, SCHERMATE } = require('../lib/schermate');

// Quello che non deve MAI finire a schermo.
const SPORCIZIA = [
  ['undefined', /\bundefined\b/],
  ['NaN', /\bNaN\b/],
  ['[object Object]', /\[object Object\]/],
  ['Infinity', /\bInfinity\b/],
];

(async () => {
  const { browser, page, menu, errori } = await apri({ initScript: semina });
  const dom = await cattura(page, menu);

  ok(`si aprono tutte e ${SCHERMATE.length} le schede`, Object.keys(dom).length === SCHERMATE.length);

  const vuote = Object.entries(dom).filter(([, html]) => html.replace(/<[^>]*>/g, '').trim().length < 40);
  ok('nessuna scheda si apre vuota' + (vuote.length ? ' — VUOTE: ' + vuote.map((v) => v[0]).join(', ') : ''),
    vuote.length === 0);

  for (const [nome, rx] of SPORCIZIA) {
    const sporche = Object.entries(dom).filter(([, html]) => rx.test(html)).map((v) => v[0]);
    ok(`nessuna scheda mostra "${nome}"` + (sporche.length ? ' — ' + sporche.join(', ') : ''), sporche.length === 0);
  }

  // Ogni scheda deve avere almeno un titolo: e' il segno che il suo contenuto
  // c'e' davvero e non solo l'involucro.
  const senzaTitolo = Object.entries(dom).filter(([, html]) => !/<h[23]/.test(html)).map((v) => v[0]);
  ok('ogni scheda ha almeno un titolo' + (senzaTitolo.length ? ' — SENZA: ' + senzaTitolo.join(', ') : ''),
    senzaTitolo.length === 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
