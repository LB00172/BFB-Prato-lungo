// ============================================================================
//  FOTO RICORDO — genera un PDF con le foto del campo su uno sfondo di montagna
// ============================================================================
// Scritto a mano, senza librerie. Il PDF è un formato di testo e sa incorporare
// i JPEG COSÌ COME SONO (filtro DCTDecode): le foto della galleria sono già
// JPEG, quindi entrano nel file senza essere ricodificate. Una libreria tipo
// jsPDF peserebbe ~350 KB nel precache di ogni telefono per una funzione che si
// usa una volta l'anno.
//
// Lo sfondo è vettoriale (poligoni e bande di colore): poche centinaia di byte,
// nitido a qualsiasi zoom e in stampa.
//
// I caratteri sono i 14 standard del PDF, che non vanno incorporati. Courier è
// il più vicino allo spirito del font dell'app (macchina da scrivere); quello
// vero è disponibile solo in woff2, che il PDF non digerisce.
//
// Espone window.PdfRicordo. Nessuna dipendenza: funziona anche in Node (test).
// ============================================================================
(function (root) {
  'use strict';

  var A4 = { w: 595.28, h: 841.89 };
  var MARGINE = 44;
  var PER_PAGINA = 4;          // 2 x 2: sotto sono francobolli, sopra è un elenco
  // Nessun tetto al numero di foto: l'album del campo e' l'album del campo, e
  // uno spezzato in due non e' un ricordo. Il costo vero non e' il PDF ma lo
  // scaricamento degli originali, uno a uno: quello si avvisa e si mostra,
  // non si taglia di nascosto.

  // ---- byte e testo --------------------------------------------------------
  // Il PDF usa la codifica WinAnsi: le lettere accentate italiane ci stanno,
  // il resto viene sostituito invece di produrre un file rotto.
  function byte(s) {
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      out[i] = c < 256 ? c : 63; // '?'
    }
    return out;
  }

  function testoPdf(s) {
    return String(s == null ? '' : s)
      .replace(/[\\()]/g, function (c) { return '\\' + c; })
      .replace(/[\r\n]+/g, ' ')
      .replace(/[^\x20-\xFF]/g, '?');
  }

  // Courier è monospaziato: la larghezza è esatta, quindi centrare è esatto.
  var LARGH_CAR = 0.6;
  function larghezza(testo, corpo) { return testo.length * LARGH_CAR * corpo; }

  function dataUrlABytes(dataUrl) {
    var virgola = String(dataUrl || '').indexOf(',');
    if (virgola < 0) return null;
    var b64 = dataUrl.slice(virgola + 1);
    var bin = typeof atob === 'function'
      ? atob(b64)
      : Buffer.from(b64, 'base64').toString('binary');
    return byte(bin);
  }

  // ---- JPEG: dimensioni e canali ------------------------------------------
  // Servono al PDF per sapere quanto è grande l'immagine e in che spazio colore.
  function infoJpeg(b) {
    if (!b || b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return null;
    var i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xFF) { i++; continue; }
      var m = b[i + 1];
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      var len = (b[i + 2] << 8) | b[i + 3];
      // SOF0..SOF15, esclusi DHT (C4), JPG (C8) e DAC (CC).
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], canali: b[i + 9] };
      }
      if (len <= 0) return null;
      i += 2 + len;
    }
    return null;
  }

  function spazioColore(canali) {
    if (canali === 1) return '/DeviceGray';
    if (canali === 4) return '/DeviceCMYK';
    return '/DeviceRGB';
  }

  // ---- colori --------------------------------------------------------------
  function rgb(hex) {
    var n = parseInt(String(hex).replace('#', ''), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function riempi(hex) { var c = rgb(hex); return c[0].toFixed(3) + ' ' + c[1].toFixed(3) + ' ' + c[2].toFixed(3) + ' rg\n'; }
  function traccia(hex) { var c = rgb(hex); return c[0].toFixed(3) + ' ' + c[1].toFixed(3) + ' ' + c[2].toFixed(3) + ' RG\n'; }
  function fra(a, b, t) { return a + (b - a) * t; }
  function mescola(hexA, hexB, t) {
    var A = rgb(hexA), B = rgb(hexB);
    return (fra(A[0], B[0], t)).toFixed(3) + ' ' + (fra(A[1], B[1], t)).toFixed(3) + ' ' + (fra(A[2], B[2], t)).toFixed(3) + ' rg\n';
  }

  // Rumore ripetibile: le montagne devono sembrare irregolari ma uscire uguali
  // a ogni generazione (altrimenti i test non potrebbero verificarle).
  function caso(seme) {
    var s = seme >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ---- sfondo: cielo, creste, prato, alberi -------------------------------
  function sfondo(seme) {
    var c = '';
    var r = caso(seme);

    // Cielo: bande sottili dall'alto verso l'orizzonte. Una sfumatura vera
    // (shading) costerebbe altri oggetti per pochissima resa in più.
    var bande = 70;
    for (var i = 0; i < bande; i++) {
      var t = i / (bande - 1);
      c += mescola('#CFDDE2', '#F2EFE3', t);
      var y = A4.h - (i + 1) * (A4.h / bande);
      c += '0 ' + y.toFixed(2) + ' ' + A4.w.toFixed(2) + ' ' + (A4.h / bande + 1).toFixed(2) + ' re f\n';
    }

    // Sole basso, appena accennato.
    c += riempi('#F6E7C8');
    c += cerchio(A4.w * 0.74, A4.h * 0.80, 26);

    // Tre creste, dalla più lontana e chiara alla più vicina e scura.
    c += cresta(r, 430, 82, '#AEBFB6', 9);
    c += cresta(r, 372, 96, '#829684', 11);
    c += cresta(r, 300, 108, '#5A6B58', 13);

    // Prato in primo piano.
    c += riempi('#2D392C');
    c += '0 0 ' + A4.w.toFixed(2) + ' 168 re f\n';

    // Abeti sul crinale del prato: pochi, sparsi, nel verde più scuro.
    c += riempi('#1F271E');
    for (var k = 0; k < 22; k++) {
      var x = r() * A4.w;
      var h = 16 + r() * 20;
      var b = h * 0.42;
      var base = 154 + r() * 10;
      c += x.toFixed(1) + ' ' + (base + h).toFixed(1) + ' m ' +
        (x - b).toFixed(1) + ' ' + base.toFixed(1) + ' l ' +
        (x + b).toFixed(1) + ' ' + base.toFixed(1) + ' l f\n';
    }
    return c;
  }

  // Una catena di monti: spezzata da sinistra a destra, riempita fino a terra.
  function cresta(r, quota, ampiezza, colore, punte) {
    var c = riempi(colore);
    c += '-5 0 m\n';
    var passo = (A4.w + 10) / punte;
    for (var i = 0; i <= punte; i++) {
      var x = -5 + i * passo;
      // Le punte alternano alto e basso: senza, viene una linea di colline uguali.
      var alto = i % 2 === 1;
      var y = quota + (alto ? ampiezza * (0.55 + r() * 0.45) : -ampiezza * (0.2 + r() * 0.35));
      c += x.toFixed(1) + ' ' + y.toFixed(1) + ' l\n';
    }
    c += (A4.w + 5).toFixed(1) + ' 0 l f\n';
    return c;
  }

  function cerchio(cx, cy, r) {
    var k = 0.5523 * r;
    return (cx + r).toFixed(2) + ' ' + cy.toFixed(2) + ' m ' +
      (cx + r).toFixed(2) + ' ' + (cy + k).toFixed(2) + ' ' + (cx + k).toFixed(2) + ' ' + (cy + r).toFixed(2) + ' ' + cx.toFixed(2) + ' ' + (cy + r).toFixed(2) + ' c ' +
      (cx - k).toFixed(2) + ' ' + (cy + r).toFixed(2) + ' ' + (cx - r).toFixed(2) + ' ' + (cy + k).toFixed(2) + ' ' + (cx - r).toFixed(2) + ' ' + cy.toFixed(2) + ' c ' +
      (cx - r).toFixed(2) + ' ' + (cy - k).toFixed(2) + ' ' + (cx - k).toFixed(2) + ' ' + (cy - r).toFixed(2) + ' ' + cx.toFixed(2) + ' ' + (cy - r).toFixed(2) + ' c ' +
      (cx + k).toFixed(2) + ' ' + (cy - r).toFixed(2) + ' ' + (cx + r).toFixed(2) + ' ' + (cy - k).toFixed(2) + ' ' + (cx + r).toFixed(2) + ' ' + cy.toFixed(2) + ' c f\n';
  }

  function scritta(testo, x, y, corpo, font, colore) {
    var t = testoPdf(testo);
    return riempi(colore) + 'BT /' + font + ' ' + corpo + ' Tf 1 0 0 1 ' +
      x.toFixed(2) + ' ' + y.toFixed(2) + ' Tm (' + t + ') Tj ET\n';
  }

  function scrittaCentrata(testo, y, corpo, font, colore) {
    var t = testoPdf(testo);
    return scritta(testo, (A4.w - larghezza(t, corpo)) / 2, y, corpo, font, colore);
  }

  // ---- una polaroid: cornice bianca, foto dentro, didascalia --------------
  function polaroid(idx, foto, riquadro, ruota) {
    var cornice = 9;
    var piede = 26;
    var interno = { w: riquadro.w - cornice * 2, h: riquadro.h - cornice * 2 - piede };

    var scala = Math.min(interno.w / foto.w, interno.h / foto.h);
    var iw = foto.w * scala;
    var ih = foto.h * scala;
    var ix = cornice + (interno.w - iw) / 2;
    var iy = cornice + piede + (interno.h - ih) / 2;

    var rad = ruota * Math.PI / 180;
    var cos = Math.cos(rad).toFixed(5);
    var sin = Math.sin(rad).toFixed(5);
    // Rotazione attorno al centro del riquadro.
    var cx = riquadro.x + riquadro.w / 2;
    var cy = riquadro.y + riquadro.h / 2;

    var c = 'q\n';
    c += cos + ' ' + sin + ' ' + (-sin) + ' ' + cos + ' ' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ' cm\n';
    c += '1 0 0 1 ' + (-riquadro.w / 2).toFixed(2) + ' ' + (-riquadro.h / 2).toFixed(2) + ' cm\n';

    // Ombra e cornice.
    c += '0 0 0 rg\n0.18 0.18 0.18 rg\n';
    c += '2.5 -2.5 ' + riquadro.w.toFixed(2) + ' ' + riquadro.h.toFixed(2) + ' re f\n';
    c += riempi('#FBFAF5');
    c += '0 0 ' + riquadro.w.toFixed(2) + ' ' + riquadro.h.toFixed(2) + ' re f\n';

    // La foto.
    c += 'q ' + iw.toFixed(2) + ' 0 0 ' + ih.toFixed(2) + ' ' + ix.toFixed(2) + ' ' + iy.toFixed(2) + ' cm /Im' + idx + ' Do Q\n';

    // Didascalia: chi l'ha scattata (e quando).
    var didascalia = testoPdf(foto.didascalia || '');
    if (didascalia) {
      var corpo = 9;
      var max = riquadro.w - cornice * 2;
      while (larghezza(didascalia, corpo) > max && didascalia.length > 4) {
        didascalia = didascalia.slice(0, -2) + '.';
      }
      c += riempi('#3A3A38');
      c += 'BT /F2 ' + corpo + ' Tf 1 0 0 1 ' +
        ((riquadro.w - larghezza(didascalia, corpo)) / 2).toFixed(2) + ' ' + (piede / 2 - 1).toFixed(2) +
        ' Tm (' + didascalia + ') Tj ET\n';
    }
    c += 'Q\n';
    return c;
  }

  // ---- contenuto di una pagina --------------------------------------------
  function pagina(fotoPagina, indiciGlobali, opz, numero, totale) {
    var c = sfondo(7919 + numero * 104729);

    // Testata.
    c += scrittaCentrata(opz.titolo || 'RICORDO', A4.h - 62, 24, 'F1', '#22301F');
    if (opz.sottotitolo) c += scrittaCentrata(opz.sottotitolo, A4.h - 82, 10, 'F2', '#3E4A3C');

    // Griglia 2 x 2 fra la testata e la fascia del prato. Le polaroid NON
    // riempiono tutto lo spazio disponibile: se lo facessero coprirebbero le
    // montagne, e lo sfondo è metà del senso di questa pagina.
    var alto = A4.h - 112;
    var basso = 108;
    // Le colonne restano due anche con una foto sola: serve a tenere la stessa
    // misura di polaroid in tutte le pagine. Le righe invece si contano sulle
    // foto che ci sono davvero, altrimenti una pagina con due foto le tiene in
    // alto e lascia mezza pagina vuota sotto.
    var colonne = 2;
    var righe = Math.ceil(fotoPagina.length / colonne);
    var spazio = 34;
    var largh = (A4.w - MARGINE * 2 - spazio * (colonne - 1)) / colonne;
    var alt = largh * 0.88;      // la foto ci sta dentro comunque, ridotta a scala
    // Il blocco si centra nella fascia libera invece di allungarsi.
    var altezzaBlocco = righe * alt + (righe - 1) * spazio;
    var cima = basso + (alto - basso + altezzaBlocco) / 2;

    // Sfalsature e inclinazioni: devono sembrare foto buttate sul tavolo, non
    // incollate su una griglia. Il rumore è ripetibile (stesso seme, stesso
    // risultato), altrimenti due generazioni della stessa pagina darebbero file
    // diversi e la prova di ripetibilità non avrebbe senso.
    var s = caso(31337 + numero * 7919);
    var INCLINA = [-7.5, 5.5, 6.5, -6];

    for (var i = 0; i < fotoPagina.length; i++) {
      var col = i % colonne;
      var rig = Math.floor(i / colonne);
      // Ultima riga incompleta (es. tre foto): si centra invece di restare
      // appesa a sinistra.
      var inRiga = Math.min(colonne, fotoPagina.length - rig * colonne);
      var rientro = (colonne - inRiga) * (largh + spazio) / 2;
      var scartoX = (s() - 0.5) * 34;
      var scartoY = (s() - 0.5) * 40;
      var riquadro = {
        x: MARGINE + rientro + col * (largh + spazio) + scartoX,
        y: cima - (rig + 1) * alt - rig * spazio + scartoY,
        w: largh,
        h: alt,
      };
      var ruota = INCLINA[i % 4] + (s() - 0.5) * 3;
      c += polaroid(indiciGlobali[i], fotoPagina[i], riquadro, ruota);
    }

    // Fascia in basso con il motto.
    if (opz.motto) c += scrittaCentrata(opz.motto, 46, 11, 'F1', '#DCE6DE');
    if (totale > 1) {
      c += scritta(numero + ' / ' + totale, A4.w - MARGINE - 30, 24, 8, 'F2', '#A9B8A8');
    }
    return c;
  }

  // ---- assemblaggio del file ----------------------------------------------
  function crea(opz) {
    opz = opz || {};
    var foto = opz.foto || [];
    if (foto.length === 0) throw new Error('Nessuna foto da mettere nel ricordo.');

    // Preparazione: byte del JPEG + dimensioni. Le foto illeggibili si saltano.
    var buone = [];
    for (var i = 0; i < foto.length; i++) {
      var b = dataUrlABytes(foto[i].dataUrl);
      var info = b && infoJpeg(b);
      if (!info) continue;
      buone.push({ bytes: b, w: info.w, h: info.h, canali: info.canali, didascalia: foto[i].didascalia });
    }
    if (buone.length === 0) throw new Error('Nessuna delle foto è utilizzabile (servono JPEG).');

    var pagine = Math.ceil(buone.length / PER_PAGINA);

    // Numerazione: 1 catalogo, 2 elenco pagine, 3-4 font, poi le immagini,
    // poi per ogni pagina l'oggetto pagina e il suo contenuto.
    var N_IMG = 5;
    var N_PAG = N_IMG + buone.length;              // numero del primo oggetto pagina
    // Ogni pagina occupa DUE oggetti (la pagina e il suo contenuto), quindi
    // l'ultimo numero usato è N_PAG + 2*pagine - 1: senza il -1 la tavola degli
    // scarti dichiarerebbe un oggetto che non esiste, con scarto zero.
    var totOggetti = N_PAG + pagine * 2 - 1;

    var parti = [];
    var lung = 0;
    var offset = new Array(totOggetti + 1).fill(0);

    function scrivi(x) {
      var b = typeof x === 'string' ? byte(x) : x;
      parti.push(b);
      lung += b.length;
    }
    function apri(num) { offset[num] = lung; scrivi(num + ' 0 obj\n'); }
    function chiudi() { scrivi('endobj\n'); }

    scrivi('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    // 1) Catalogo
    apri(1); scrivi('<< /Type /Catalog /Pages 2 0 R >>\n'); chiudi();

    // 2) Elenco pagine
    var kids = [];
    for (var p = 0; p < pagine; p++) kids.push((N_PAG + p * 2) + ' 0 R');
    apri(2);
    scrivi('<< /Type /Pages /Count ' + pagine + ' /Kids [' + kids.join(' ') + '] >>\n');
    chiudi();

    // 3-4) Font standard: non vanno incorporati.
    apri(3); scrivi('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>\n'); chiudi();
    apri(4); scrivi('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\n'); chiudi();

    // Immagini: i byte del JPEG entrano tali e quali (DCTDecode).
    for (var j = 0; j < buone.length; j++) {
      var im = buone[j];
      apri(N_IMG + j);
      scrivi('<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h +
        ' /ColorSpace ' + spazioColore(im.canali) + ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>\nstream\n');
      scrivi(im.bytes);
      scrivi('\nendstream\n');
      chiudi();
    }

    // Pagine e contenuti.
    for (var q = 0; q < pagine; q++) {
      var da = q * PER_PAGINA;
      var gruppo = buone.slice(da, da + PER_PAGINA);
      var indici = gruppo.map(function (_, k) { return da + k; });

      var risorse = gruppo.map(function (_, k) {
        return '/Im' + (da + k) + ' ' + (N_IMG + da + k) + ' 0 R';
      }).join(' ');

      var numPagina = N_PAG + q * 2;
      var numContenuto = numPagina + 1;

      apri(numPagina);
      scrivi('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + A4.w.toFixed(2) + ' ' + A4.h.toFixed(2) + ']' +
        ' /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ' + risorse + ' >> >>' +
        ' /Contents ' + numContenuto + ' 0 R >>\n');
      chiudi();

      var contenuto = pagina(gruppo, indici, opz, q + 1, pagine);
      var cb = byte(contenuto);
      apri(numContenuto);
      scrivi('<< /Length ' + cb.length + ' >>\nstream\n');
      scrivi(cb);
      scrivi('\nendstream\n');
      chiudi();
    }

    // Tavola degli scarti (xref) e coda.
    var inizioXref = lung;
    var xref = 'xref\n0 ' + (totOggetti + 1) + '\n0000000000 65535 f \n';
    for (var n = 1; n <= totOggetti; n++) {
      xref += String(offset[n]).padStart(10, '0') + ' 00000 n \n';
    }
    scrivi(xref);
    scrivi('trailer\n<< /Size ' + (totOggetti + 1) + ' /Root 1 0 R >>\nstartxref\n' + inizioXref + '\n%%EOF\n');

    var out = new Uint8Array(lung);
    var pos = 0;
    for (var z = 0; z < parti.length; z++) { out.set(parti[z], pos); pos += parti[z].length; }
    return out;
  }

  root.PdfRicordo = {
    crea: crea,
    PER_PAGINA: PER_PAGINA,
    infoJpeg: infoJpeg,
  };
})(typeof window !== 'undefined' ? window : globalThis);
