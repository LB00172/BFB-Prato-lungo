// Censimento dei testi che l'utente legge e che NON passano dal dizionario.
//
// Non e' una prova: e' il metro del § 18. Dice quanto manca e DOVE, perche'
// "circa mille stringhe" non si affronta senza sapere da che file cominciare.
// Gira da solo, come test/schermate-confronto.js:
//
//   node test/censimento-testi.js                  quante ne restano, per file
//   node test/censimento-testi.js 82-schede        l'elenco di un file
//   node test/censimento-testi.js --elenco         tutte, con file e riga
//
// E' una EURISTICA, non un parser: riconosce la prosa da una maiuscola in
// testa, da un accento o da una parola italiana, e scarta le classi CSS e le
// schegge di codice. Qualche falso positivo resta — un paio per file — ed e'
// voluto: preferisco guardarne uno di troppo che perderne uno.
//
// Chi lo usa come guardia e' test/unita/compilazione.js: i file gia' tradotti
// devono restare a zero. Per quelli e' esatto, ed e' li' che serve esserlo.
const fs = require('fs');
const path = require('path');
const CARTELLA = path.join(__dirname, '..', 'src');
const FILTRO = process.argv[2] || '';
// Vocali accentate italiane: sono la firma piu' affidabile, ma non bastano.
const ACCENTI = /[àèéìòùÀÈÉÌÒÙ]/;

// Parole italiane comuni: se una stringa ne contiene una, e' prosa, non codice.
const SPIA = new RegExp('\\b(' + [
  'il','lo','la','i','gli','le','un','uno','una','del','dei','della','delle','dal','dalla',
  'al','alla','ai','alle','nel','nella','sul','sulla','con','per','tra','fra','che','chi',
  'non','piu','anche','come','quando','dove','ogni','tutti','tutte','tutto','solo','ancora',
  'sono','sei','siamo','essere','hai','ha','hanno','avere','fare','fatto','serve','servono',
  'questo','questa','questi','queste','quello','quella','nessuno','nessuna','qualche',
  'aggiungi','elimina','rimuovi','salva','annulla','conferma','chiudi','apri','scegli',
  'spesa','spese','membro','membri','giorno','giorni','presenza','presenze','conto','conti',
  'nome','cognome','prezzo','totale','quota','campo','pasto','pasti','foto','scontrino',
  'sicuro','vuoi','verra','verranno','oppure','senza','dentro','fuori','prima','dopo',
].join('|') + ')\\b', 'i');

function cssiforme(t) {
  // Una stringa di classi Tailwind: tutti i pezzi minuscoli con trattini,
  // due punti o parentesi quadre. Non e' testo, e' aspetto.
  const pezzi = t.trim().split(/\s+/);
  if (!pezzi.length) return false;
  return pezzi.every((p) => /^[a-z0-9]+[a-z0-9:\[\]()#/.,%_-]*$/.test(p) && /[-:[\]/]/.test(p));
}

function prosa(s) {
  const t = String(s).trim();
  if (t.length < 3) return false;
  if (!/[a-zA-ZàèéìòùÀÈÉÌÒÙ]/.test(t)) return false;          // solo simboli o numeri
  if (/^[,;:)(}{[\]]/.test(t) || /[,;:({[]$/.test(t)) return false; // scheggia di codice
  if (cssiforme(t)) return false;
  if (/^[\w./#:-]+$/.test(t) && !ACCENTI.test(t)) return false;  // classe, chiave, url
  // Il criterio: una maiuscola in testa (le etichette la hanno, le classi no),
  // un accento, o una parola italiana riconosciuta.
  return /^[A-ZÀÈÉÌÒÙ«"']/.test(t) || ACCENTI.test(t) || SPIA.test(t);
}

// Quello che gia' passa dal dizionario non si conta.
function tradotto(riga) {
  return /\bL\.t\(|\bfrase\(|\bL\.data\(/.test(riga);
}

const trovati = [];
fs.readdirSync(CARTELLA).filter((f) => f.endsWith('.jsx')).sort().forEach((file) => {
  const righe = fs.readFileSync(path.join(CARTELLA, file), 'utf8').split('\n');
  let inCommento = false;
  righe.forEach((riga, i) => {
    // I commenti non sono testo dell'utente.
    let r = riga;
    if (inCommento) { if (r.includes('*/')) { r = r.slice(r.indexOf('*/') + 2); inCommento = false; } else return; }
    if (r.includes('/*')) { const j = r.indexOf('/*'); if (!r.slice(j).includes('*/')) { inCommento = true; } r = r.slice(0, j) + (r.slice(j).includes('*/') ? r.slice(r.indexOf('*/') + 2) : ''); }
    r = r.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
    // Il commento a fine riga non e' testo dell'utente (ma // dentro un
    // indirizzo si': si guarda che davanti non ci siano due punti).
    r = r.replace(/(^|[^:'"`])\/\/.*$/, '$1');
    if (!r.trim()) return;
    if (tradotto(r)) return;

    const pezzi = [];
    // 1) il testo JSX, anche quando la frase prosegue sulla riga dopo: si
    //    toglie quello che testo non e' (tag, espressioni) e si guarda il resto.
    let nudo = r.replace(/\{[^{}]*\}/g, ' ').replace(/<[^<>]*>/g, ' ');
    nudo.split(/\s{2,}/).forEach((t) => pezzi.push(t));
    // 2) attributi che l'utente legge
    r.replace(/(?:placeholder|title|alt|aria-label)=["']([^"']+)["']/g, (m, t) => { pezzi.push(t); return m; });
    // 3) stringhe dentro alert/confirm/prompt
    r.replace(/(?:alert|confirm|prompt)\(\s*(['"`])((?:[^\\]|\\.)*?)\1/g, (m, q, t) => { pezzi.push(t); return m; });
    // 4) stringhe letterali lunghe (messaggi passati a funzioni)
    r.replace(/(['"])((?:[^'"\\]|\\.){4,}?)\1/g, (m, q, t) => { pezzi.push(t); return m; });

    const visti = {};
    pezzi.forEach((t) => {
      const pulito = String(t).trim().replace(/\s+/g, ' ');
      if (!prosa(pulito) || visti[pulito]) return;
      visti[pulito] = 1;
      trovati.push({ file, riga: i + 1, testo: pulito });
    });
  });
});

const perFile = {};
trovati.forEach((t) => { perFile[t.file] = (perFile[t.file] || 0) + 1; });

module.exports = { trovati, perFile };

// Lanciato a mano: stampa. Richiesto da una prova: tace.
if (require.main !== module) { /* solo i dati */ } else if (FILTRO === '--elenco') {
  trovati.forEach((t) => console.log(t.file + ':' + t.riga + '  ' + t.testo.slice(0, 100)));
} else if (FILTRO) {
  trovati.filter((t) => t.file.includes(FILTRO)).forEach((t) => console.log(t.riga + '  ' + t.testo.slice(0, 120)));
} else {
  Object.keys(perFile).sort((a, b) => perFile[b] - perFile[a]).forEach((f) => console.log(String(perFile[f]).padStart(5) + '  ' + f));
  console.log(String(trovati.length).padStart(5) + '  TOTALE');
}
