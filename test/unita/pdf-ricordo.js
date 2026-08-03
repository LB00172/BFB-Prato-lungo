// Generatore del PDF "foto ricordo": struttura del file, foto incorporate
// senza ricodifica, tetto di 12, robustezza sugli ingressi sbagliati.
const fs = require('fs');
const path = require('path');
const { ok, fine } = require('../lib/app');

require('../../pdf-ricordo.js');
const PDF = globalThis.PdfRicordo;

const RADICE = path.resolve(__dirname, '..', '..');

// Una foto vera: si parte dal PNG di prova e si passa per un JPEG, come fa
// l'app (le foto della galleria sono sempre JPEG).
function jpegDiProva(largh, alt) {
  // JPEG minimo generato a mano non è realistico: si usa quello prodotto una
  // volta sola e conservato come campione.
  const b = fs.readFileSync(path.join(RADICE, 'test', 'fixture', 'foto.jpg'));
  return 'data:image/jpeg;base64,' + b.toString('base64');
}

const FOTO = jpegDiProva();
const bytesFoto = Buffer.from(FOTO.split(',')[1], 'base64');

const testo = (u8) => Buffer.from(u8).toString('latin1');

// --- lettura delle dimensioni dal JPEG ---
const info = PDF.infoJpeg(Buffer.from(bytesFoto));
ok('legge le dimensioni dal JPEG (' + (info && info.w) + 'x' + (info && info.h) + ')', !!info && info.w > 0 && info.h > 0);
ok('riconosce i tre canali del colore', !!info && info.canali === 3);
ok('un file che non è JPEG viene rifiutato', PDF.infoJpeg(Buffer.from([1, 2, 3, 4])) === null);

// --- un PDF con una foto sola ---
const uno = PDF.crea({
  titolo: 'PRATO LUNGO 2026',
  sottotitolo: '11 - 16 agosto',
  motto: 'IN BANDY WE TRUST',
  foto: [{ dataUrl: FOTO, didascalia: 'Lorenzo' }],
});
const t1 = testo(uno);

ok('il file comincia come un PDF', t1.startsWith('%PDF-1.4'));
ok('il file finisce con %%EOF', t1.trimEnd().endsWith('%%EOF'));
ok('contiene la tavola degli scarti e il trailer', t1.includes('\nxref\n') && t1.includes('trailer') && t1.includes('startxref'));
ok('dichiara una sola pagina', /\/Type \/Pages \/Count 1 /.test(t1));
ok('la pagina è A4', t1.includes('/MediaBox [0 0 595.28 841.89]'));
ok('la foto è incorporata come JPEG, non ricodificata', t1.includes('/Filter /DCTDecode'));
ok('i byte originali del JPEG sono dentro il PDF', testo(uno).includes(bytesFoto.toString('latin1')));
ok('il titolo compare nel contenuto', t1.includes('(PRATO LUNGO 2026) Tj'));
ok('la didascalia compare nel contenuto', t1.includes('(Lorenzo) Tj'));
ok('i font standard non vengono incorporati', t1.includes('/BaseFont /Courier-Bold') && !t1.includes('/FontFile'));

// La tavola degli scarti deve puntare davvero all'inizio di ogni oggetto:
// se sbaglia di un byte, il PDF si apre storto (o non si apre).
function verificaXref(u8) {
  const s = testo(u8);
  const posXref = s.lastIndexOf('\nxref\n') + 1;
  const righe = s.slice(posXref).split('\n');
  const conteggio = parseInt(righe[1].split(' ')[1], 10);
  let buone = 0;
  for (let n = 1; n < conteggio; n++) {
    const off = parseInt(righe[1 + n + 1].slice(0, 10), 10);
    if (s.slice(off, off + 20).startsWith(n + ' 0 obj')) buone++;
  }
  return { attesi: conteggio - 1, buone };
}
const x1 = verificaXref(uno);
ok(`ogni scarto punta al suo oggetto (${x1.buone}/${x1.attesi})`, x1.buone === x1.attesi && x1.attesi > 0);

// --- più foto: impaginazione e tetto ---
const molte = (n) => Array.from({ length: n }, (_, i) => ({ dataUrl: FOTO, didascalia: 'Foto ' + (i + 1) }));

const quattro = PDF.crea({ titolo: 'X', foto: molte(4) });
ok('quattro foto stanno in una pagina', /\/Type \/Pages \/Count 1 /.test(testo(quattro)));

const cinque = PDF.crea({ titolo: 'X', foto: molte(5) });
ok('la quinta foto apre la seconda pagina', /\/Type \/Pages \/Count 2 /.test(testo(cinque)));

const dodici = PDF.crea({ titolo: 'X', foto: molte(12) });
const t12 = testo(dodici);
ok('dodici foto stanno in tre pagine', /\/Type \/Pages \/Count 3 /.test(t12));
ok('tutte e dodici le immagini sono nel file', (t12.match(/\/Subtype \/Image/g) || []).length === 12);
const x12 = verificaXref(dodici);
ok(`con dodici foto la tavola resta coerente (${x12.buone}/${x12.attesi})`, x12.buone === x12.attesi);

const venti = PDF.crea({ titolo: 'X', foto: molte(20) });
ok('oltre il tetto le foto in più vengono ignorate', (testo(venti).match(/\/Subtype \/Image/g) || []).length === PDF.MAX_FOTO);

// --- ingressi sbagliati: si lamenta, non produce un file rotto ---
let errore = '';
try { PDF.crea({ foto: [] }); } catch (e) { errore = e.message; }
ok('senza foto si ferma con un messaggio', /Nessuna foto/.test(errore));

errore = '';
try { PDF.crea({ foto: [{ dataUrl: 'data:image/png;base64,AAAA' }] }); } catch (e) { errore = e.message; }
ok('con foto illeggibili si ferma con un messaggio', /utilizzabile/.test(errore));

// Una foto buona in mezzo a due rotte: si salva il salvabile.
const misto = PDF.crea({ titolo: 'X', foto: [{ dataUrl: 'data:image/png;base64,AAAA' }, { dataUrl: FOTO }, { dataUrl: 'boh' }] });
ok('le foto rotte vengono saltate, le buone restano', (testo(misto).match(/\/Subtype \/Image/g) || []).length === 1);

// --- caratteri: gli accenti non devono rompere il file ---
const accenti = PDF.crea({ titolo: 'PERÒ È COSÌ', foto: [{ dataUrl: FOTO, didascalia: 'Niccolò · 12/08' }] });
ok('gli accenti italiani non rompono il PDF', testo(accenti).includes('(PER'));
const parentesi = PDF.crea({ titolo: 'X', foto: [{ dataUrl: FOTO, didascalia: 'Tizio (il vero) \\ capo' }] });
ok('parentesi e barre nella didascalia vengono protette', testo(parentesi).includes('\\(il vero\\)'));

// --- ripetibilità: due generazioni identiche danno lo stesso file ---
const a = PDF.crea({ titolo: 'X', foto: [{ dataUrl: FOTO, didascalia: 'A' }] });
const b = PDF.crea({ titolo: 'X', foto: [{ dataUrl: FOTO, didascalia: 'A' }] });
ok('lo sfondo è casuale ma ripetibile', Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0);

// Il file va salvato per poterlo guardare: test/tmp è fuori dal repo.
const fuori = path.join(__dirname, '..', 'tmp', 'ricordo.pdf');
fs.mkdirSync(path.dirname(fuori), { recursive: true });
fs.writeFileSync(fuori, Buffer.from(PDF.crea({
  titolo: 'PRATO LUNGO 2026',
  sottotitolo: '11 - 16 agosto · Pereto (AQ)',
  motto: 'IN BANDY WE TRUST',
  foto: molte(6).map((f, i) => ({ ...f, didascalia: ['Lorenzo', 'Bruno', 'Anna'][i % 3] + ' · 12/08/2026' })),
})));
console.log('     (esempio salvato in test/tmp/ricordo.pdf)');

fine();
