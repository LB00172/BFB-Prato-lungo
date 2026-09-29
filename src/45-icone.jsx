// ---------- Il vocabolario delle icone ----------
//
// Fino al 22 settembre 2026 l'iconografia dell'app erano NOVANTACINQUE
// emoji, cinquantatre' diverse, e zero disegni nostri. Le emoji hanno tre
// difetti che non si vedono finche' non ci si prova a costruire sopra un
// marchio:
//
//   - le disegna il sistema operativo, quindi la stessa schermata ha una
//     faccia su Android, un'altra su iPhone e un'altra sul portatile;
//   - sono a colori pieni e saturi, e litigano con una tavolozza scelta al
//     millesimo: la padella e' rossa qualunque cosa dica il crema attorno;
//   - non si possono ridipingere, quindi il tema scuro se le tiene com'erano.
//
// Qui le icone sono SVG in linea, con `stroke="currentColor"`: prendono il
// colore dal testo che hanno accanto, e quindi il tema scuro e il cambio di
// tavolozza funzionano da soli, senza una riga in piu'.
//
// **Lo stile.** Tratto spesso e chiuso agli angoli, forme geometriche e un po'
// squadrate: e' il mondo del logo — l'albero intagliato, la montagna piena —
// tradotto a ventiquattro pixel. A questa misura il tratto irregolare del
// logo diventerebbe sporcizia, quindi l'irregolarita' non si imita: si imita
// la SOLIDITA'. E dove si puo' si sceglie l'oggetto da campo invece di quello
// da ufficio: l'ascia invece della chiave inglese, la bussola invece del
// punto interrogativo, la cassa invece dello schedario.
//
// `misura` e' in pixel e vale anche per il tratto: un'icona grande con il
// tratto di una piccola sembra sbiadita, quindi il tratto cresce con lei.
const ICONE = {
  // I miei campi: la tenda, col palo in mezzo e l'ingresso aperto.
  campi: 'M3 20L12 4l9 16z M12 4v16 M9 20l3-5 3 5',
  // Calendario: il riquadro con i due chiodi e la riga del mese.
  calendario: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
  // Il menu' del giorno: la pentola sul fuoco, con il vapore.
  menu: 'M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z M4 13H2 M20 13h2 M9 7c0-1.5 1-1.5 1-3 M14 7c0-1.5 1-1.5 1-3',
  // I pasti: il piatto con la forchetta e il coltello.
  presenze: 'M12 8a5 5 0 1 1 0 10 5 5 0 0 1 0-10z M4 3v8 M4 11v10 M2 3v5a2 2 0 0 0 4 0V3 M20 3v18 M20 3c-1.5 1-2 3-2 5s.5 3 2 3',
  // Chi fa cosa: il segno di spunta dentro una cornice.
  compiti: 'M4 4h16v16H4z M8 12l3 3 5-6',
  // La lista della spesa: il foglio strappato in fondo, con le righe.
  lista: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6 M9 16h4',
  // L'attrezzatura: l'ascia, non la chiave inglese.
  attrezzatura: 'M14 3l7 7-3 3-3-3-9 9-4-4 9-9-3-3z M11 10l3 3',
  // I soldi: la banconota con il tondo in mezzo.
  spesa: 'M2 6h20v12H2z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z M5 9v6 M19 9v6',
  // I membri: due persone, una davanti e una dietro.
  membri: 'M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z M2 21c0-3.5 3-6 7-6s7 2.5 7 6 M17 4a4 4 0 0 1 0 7 M18 15c2.5.8 4 2.7 4 6',
  // Le regole: il foglio arrotolato, come un bando appeso.
  regole: 'M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 0 2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2z M9 8h7 M9 12h7 M9 16h4',
  // Le dotazioni personali: lo zaino. Con un manico solo in cima si
  // leggeva come un lucchetto: ci vogliono due spallacci e la tasca.
  dotazioni: 'M6 8h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z M8 8V6a2 2 0 0 1 2-2 M16 8V6a2 2 0 0 0-2-2 M10 4h4 M9 13h6v8H9z M11 16h2',
  // La galleria: la macchina fotografica.
  galleria: 'M3 7h4l2-3h6l2 3h4v13H3z M12 10a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  // Il gioco: il triangolo di avvio, che si capisce a colpo d'occhio.
  gioco: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M10 8.5l6 3.5-6 3.5z',
  // L'archivio: la cassa di legno con le assi.
  archivio: 'M3 7h18v13H3z M3 7l2-4h14l2 4 M10 12h4',
  // La guida: la bussola, non il punto interrogativo.
  guida: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z M15.5 8.5l-2 5-5 2 2-5z',
  // I cursori, non la ruota dentata: a ventiquattro pixel i denti
  // diventano un sole, e un sole in un menu non vuol dire niente.
  impostazioni: 'M3 7h18 M3 12h18 M3 17h18 M9 7a2 2 0 1 1-.01 0z M16 12a2 2 0 1 1-.01 0z M7 17a2 2 0 1 1-.01 0z',

  // ---------- Quelle che servono solo alla Guida ----------
  // I conti: la bilancia a due piatti.
  conti: 'M12 4v16 M8 20h8 M5 8h14 M12 8L5 8l-2.5 5a3 3 0 0 0 5 0z M12 8l7 0 2.5 5a3 3 0 0 1-5 0z',
  // I saldi: i soldi che passano di mano, in tondo.
  saldi: 'M4 9h12l-3-3 M20 15H8l3 3 M12 2a10 10 0 0 1 9 6 M12 22a10 10 0 0 1-9-6',
  // Il backup: la cassaforte, cioe' la scatola con il giro di corda.
  backup: 'M4 4h16v16H4z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z M12 4v5 M12 15v5 M4 12h5 M15 12h5',
  // La sincronizzazione: la nuvola con la freccia che sale.
  sync: 'M7 17a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.5 1.5 3.5 3.5 0 0 1-.5 6.5H7z M12 21v-7 M9.5 16.5L12 14l2.5 2.5',
  // La chiusura del campo: la bandiera piantata.
  chiusura: 'M6 3v18 M6 4h12l-2.5 4L18 12H6',
  // Correggere: la matita.
  correggi: 'M4 20l1-4L16 5l3 3L8 19z M14 7l3 3',
  // Due alias: la stessa cosa detta in un altro punto dell'app non merita un
  // disegno diverso, o l'utente pensa che parlino di due cose.
  separato: 'M12 8a5 5 0 1 1 0 10 5 5 0 0 1 0-10z M4 3v8 M4 11v10 M2 3v5a2 2 0 0 0 4 0V3 M20 3v18 M20 3c-1.5 1-2 3-2 5s.5 3 2 3',
  pronto: 'M7 8h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z M9 8V6a3 3 0 0 1 6 0v2 M9 14h6 M10 21v-4h4v4',
  // Aggiungere: il tasto «+ Spesa».
  piu: 'M12 5v14 M5 12h14',
  // La spunta di un passo fatto.
  fatto: 'M5 12l5 5L20 7',
  // Il luogo del campo: il segnaposto, il gesto che tutti conoscono dalle mappe.
  luogo: 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z M12 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
};

// Restituisce il disegno, o null se il nome non c'e'. **Null e non un
// ripiego**: un'icona sbagliata che si vede come un quadratino e' un difetto
// che qualcuno nota, un ripiego silenzioso no. E una prova vieta i nomi
// inventati, come per le chiavi del dizionario.
const icona = (nome, classe) => {
  const d = ICONE[nome];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      className={classe || 'w-5 h-5'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {d.split(' M').map((p, i) => <path key={i} d={i ? 'M' + p : p} />)}
    </svg>
  );
};
