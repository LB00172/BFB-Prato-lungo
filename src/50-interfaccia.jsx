// ---------- Vocabolario dei bottoni ----------
// Misurato in RICOGNIZIONE-UI.md: 121 bottoni, 45 forme diverse fra quelle a
// classi fisse, di cui una ventina usate una volta sola. Sei altezze per un
// elemento che ne vuole tre. Non e' una tavolozza nuova: e' un nome dato a
// quello che gia' c'era, scegliendo come regola la forma piu' usata.
//
// La divisione degli assi e' la parte che conta:
//   - qui dentro sta COM'E' FATTO il bottone (pieno, bordo, colore, altezza);
//   - al posto di chiamata resta DOVE STA (w-full, flex-1, gap, margini).
// Mescolare i due era proprio il motivo per cui c'erano 45 forme.

// Quattro misure, non sei. La quarta — "piccolo" — esiste perche' nell'app ci
// sono molti bottoni a piena larghezza con l'etichetta a 10px: hanno il corpo
// di un bottone normale ma la scritta minuta, e portarli a 12px avrebbe
// cambiato l'aspetto di mezza applicazione senza che nessuno l'avesse chiesto.
// La scala sale davvero: minuscolo < piccolo < normale < grande.
//
// La larghezza del bordo sta qui e non nel ruolo perche' nel codice era gia'
// cosi': i bottoni minuti hanno il filo sottile, gli altri quello doppio. Non
// l'ho deciso io, l'ho solo scritto.
// TRE misure, non quattro. La quarta — "piccolo" — esisteva perche' aveva il
// corpo di un bottone normale ma la scritta a 10px invece di 12. La scala del
// testo (index.html, ROADMAP.md § 13) dice che fra 10 e 12 non c'era una
// regola: adesso sono la stessa misura, e le due voci erano diventate la
// stessa identica riga. Cancellarla e' il § 13 che arriva alla sua diagnosi
// di agosto: "sei altezze per un elemento che ne vuole tre".
//
// Quello che resta le distingue davvero, ed e' il corpo: px-3 py-1.5,
// px-4 py-2.5, px-4 py-3.
const BOTTONE_MISURA = {
  minuscolo: 'px-3 py-1.5 text-piccolo border',
  normale: 'px-4 py-2.5 text-piccolo border-2',
  grande: 'px-4 py-3 text-normale border-2',
};

// I ruoli veri, guardando cosa fanno i bottoni e non come sono scritti.
// Il pieno marrone NON e' un doppione del verde: nell'app segna le azioni di
// secondo livello (chiudere il campo, creare l'album), ed e' usato abbastanza
// da essere una scelta, non una svista.
const BOTTONE_RUOLO = {
  primario: 'bg-[#2D392C] border-transparent text-white hover:bg-[#1F271E]',
  bruno: 'bg-[#5C4A3C] border-transparent text-white hover:bg-[#463628]',
  secondario: 'bg-white border-[#8F9E8B]/50 text-[#5C4A3C] hover:bg-[#E2EAE4]',
  testuale: 'border-transparent text-[#5C4A3C] hover:text-[#2D392C]',
  distruttivo: 'bg-white border-red-700/40 text-red-700 hover:bg-red-50',
  // L'ambra e' il colore degli avvisi in tutta l'app (86 usi): un bottone
  // ambra e' un'azione che nasce da un problema, non un'azione qualsiasi.
  avviso: 'bg-[#D97706] border-transparent text-white hover:brightness-95',
  // Verde WhatsApp: e' un marchio altrui, non una nostra scelta di tavolozza.
  // Sta qui per non farlo sembrare un colore dell'app usato a caso.
  whatsapp: 'bg-[#25D366] border-transparent text-white hover:brightness-95',
};

// Le icone sono un terzo dei bottoni e non entrano in nessun ruolo: sono
// quadrate, senza maiuscolo, senza etichetta. Forzarle dentro "testuale" le
// farebbe diventare rettangoli con dentro un simbolo. Nel codice la stessa
// "x" di eliminazione esisteva in quattro varianti diverse.
const BOTTONE_ICONA = {
  neutro: 'text-[#8F9E8B] hover:text-[#2D392C]',
  distruttivo: 'text-red-700 hover:text-red-900',
  pieno: 'bg-[#2D392C] text-white hover:bg-[#1F271E]',
  tenue: 'bg-[#8F9E8B]/20 text-[#2D392C] hover:bg-[#8F9E8B]/40',
};

const bottoneIcona = (tono, extra) => [
  'px-2.5 py-2 rounded font-bold leading-none disabled:opacity-40',
  BOTTONE_ICONA[tono] || BOTTONE_ICONA.neutro,
  extra || '',
].filter(Boolean).join(' ');

// Il tasto sottile: il posto da toccare resta 44×44, il disegno no. Serve
// nelle righe fitte (i membri), dove tre bottoni pieni alti 44 facevano la
// riga tozza quanto un riquadro. Il bordo si vede solo attorno al segno,
// non attorno al pollice. `acceso` per le etichette che cambiano stato.
const bottoneSottile = (tono, extra) => [
  'min-w-11 min-h-11 -my-1.5 inline-flex items-center justify-center rounded leading-none disabled:opacity-40',
  BOTTONE_ICONA[tono] || BOTTONE_ICONA.neutro,
  extra || '',
].filter(Boolean).join(' ');

// La riga richiudibile non e' un bottone con un altro colore: e' una forma
// diversa — larga, allineata a sinistra, senza maiuscolo, con il contenuto ai
// due estremi. Passa da qui perche' e' un ruolo, non un caso particolare.
const bottoneRiga = (extra) => [
  'w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[#E2EAE4]/60',
  extra || '',
].filter(Boolean).join(' ');

// Uso: className={bottone('primario', 'grande', 'w-full mt-3')}
const bottone = (ruolo, misura, extra) => [
  'rounded font-bold uppercase tracking-wide disabled:opacity-40',
  BOTTONE_MISURA[misura] || BOTTONE_MISURA.normale,
  BOTTONE_RUOLO[ruolo] || BOTTONE_RUOLO.primario,
  extra || '',
].filter(Boolean).join(' ');

// ---------- Chip di scelta ----------
// Il sesto ruolo (RICOGNIZIONE-UI.md, §13): non un'azione, ma una scelta che
// resta accesa. Nel codice erano quindici forme scritte a mano, tutte con lo
// stesso schema `${acceso ? 'verde e bianco' : 'bianco e verde'}` e ogni volta
// un pixel diverso: chi py-2 e chi py-2.5, chi border-b-2 e chi border-b-4,
// chi text-white e chi text-[#F0F4F1] — che a occhio sono lo stesso colore.
//
// Due assi, come per i bottoni:
//   - la FORMA dice com'e' fatto e quanto e' spesso (linguetta, pillola…);
//   - il TONO dice di che colore e' da acceso e da spento.
// Servono tutte e due perche' la stessa forma cambia colore secondo il
// significato: il chip del pranzo e' verde, quello della cena bruno, e non
// e' un vezzo — sono i due colori con cui l'app distingue i pasti ovunque.
const SCELTA_FORMA = {
  // Linguetta: in quale sezione sto. Il filo spesso sotto dice dove sei.
  linguetta: 'py-2.5 rounded font-bold uppercase tracking-wide border-b-4 transition-all',
  // Interruttore: una cosa sola, accesa o spenta, a piena larghezza.
  interruttore: 'py-2.5 rounded font-bold uppercase tracking-wide border-2',
  // Spunta: chip minuto in riga, quello dei pasti.
  spunta: 'px-2.5 py-1.5 rounded font-bold uppercase border',
  // Pillola: scelta leggera in un gruppo che va a capo.
  pillola: 'px-3 py-1.5 rounded-full font-bold transition-colors',
  // Giunta: due chip attaccati dentro una cornice sola. Niente angoli
  // propri: glieli da' il contenitore, altrimenti si vedono due bordi.
  giunta: 'px-2.5 py-1.5 font-bold uppercase',
  // Etichetta: dice cos'e' una cosa (adulto/bambino), non cosa succede.
  etichetta: 'px-2 py-1 rounded font-bold uppercase',
  // Casella: la spunta quadrata di una lista di cose da fare. Non e' un chip
  // con dentro una parola — e' un quadrato con dentro un segno — ma il
  // meccanismo e' lo stesso: acceso o spento, e si tocca per cambiare.
  // E' entrata nel vocabolario quando e' comparsa la seconda volta.
  casella: 'w-6 h-6 shrink-0 rounded border-2 flex items-center justify-center font-bold',
};

const SCELTA_TONO = {
  // Da acceso il bordo sotto e' bruno, non verde: e' quello che fa sembrare
  // la linguetta una linguetta invece di un bottone premuto.
  sezione: {
    acceso: 'bg-[#2D392C] text-white border-[#5C4A3C]',
    spento: 'bg-white text-[#2D392C] border-gray-300 hover:bg-[#E2EAE4]',
  },
  bordato: {
    acceso: 'bg-[#2D392C] text-white border-[#2D392C]',
    spento: 'bg-white text-[#2D392C] border-[#8F9E8B]/50 hover:bg-[#E2EAE4]',
  },
  // Pranzo e cena: spento e' GRIGIO, non bianco. Qui "spento" vuol dire "non
  // c'era", e deve sparire dall'occhio — a colpo d'occhio si contano i
  // presenti, non si legge riga per riga.
  pranzo: {
    acceso: 'bg-[#2D392C] text-white border-[#2D392C]',
    spento: 'bg-white text-gray-400 border-gray-300',
  },
  cena: {
    acceso: 'bg-[#5C4A3C] text-white border-[#5C4A3C]',
    spento: 'bg-white text-gray-400 border-gray-300',
  },
  tenue: {
    acceso: 'bg-[#2D392C] text-white',
    spento: 'bg-[#F0F4F1] text-[#2D392C] border border-[#8F9E8B]/40 hover:bg-[#E2EAE4]',
  },
  piatto: {
    acceso: 'bg-[#2D392C] text-white',
    spento: 'bg-white text-[#2D392C]',
  },
  // Spunta: da spenta e' un quadrato vuoto col filo sage. Il segno di spunta
  // c'e' sempre ma e' trasparente: cosi' la casella non cambia dimensione
  // quando la si tocca, e la riga non salta.
  casella: {
    acceso: 'bg-[#2D392C] border-[#2D392C] text-white',
    spento: 'bg-white border-[#8F9E8B] text-transparent',
  },
  // Ambra: il colore con cui l'app segna le cose fuori dai conti. Un bambino
  // non paga, e quel chip lo dice con lo stesso colore degli avvisi.
  ambra: {
    acceso: 'bg-[#D97706] text-white',
    spento: 'bg-gray-200 text-gray-500',
  },
};

// Le misure di testo, le stesse che c'erano gia'.
// Stessa storia dei bottoni: erano cinque misure di testo (9, 10, 11, 12, 16)
// e la scala ne riconosce tre. "piccolo" e "normale" erano diventati la copia
// di "minuscolo", quindi sono spariti.
const SCELTA_TESTO = {
  minimo: 'text-minuto',
  minuscolo: 'text-piccolo',
  // Per i chip che contengono un SEGNO invece di una parola: una spunta non
  // e' un'etichetta minuta, e rimpicciolirla dentro un quadrato da 24 px la
  // fa sembrare sbiadita.
  simbolo: 'text-medio',
};

// Uso: className={bottoneScelta('linguetta', 'sezione', spesaSection === k, 'minuscolo')}
const bottoneScelta = (forma, tono, acceso, misura, extra) => {
  const t = SCELTA_TONO[tono] || SCELTA_TONO.sezione;
  return [
    SCELTA_FORMA[forma] || SCELTA_FORMA.linguetta,
    SCELTA_TESTO[misura] || SCELTA_TESTO.minuscolo,
    acceso ? t.acceso : t.spento,
    extra || '',
  ].filter(Boolean).join(' ');
};

// ---------- Frasi con una parte in grassetto ----------
// Il dizionario tiene la frase intera, con la parte da evidenziare fra
// asterischi: 'Il compito dice *chi fa cosa*, non quanto costa'. Spezzarla in
// tre stringhe non funzionerebbe — l'ordine delle parole cambia da lingua a
// lingua e il pezzo in mezzo finirebbe nel posto sbagliato.
//
// Uso: {frase('compiti.spiegazione')}
// Il grassetto non e' sempre vestito uguale: dentro un paragrafo grigio il
// pezzo in evidenza a volte e' anche verde. Il vestito sta qui, non nel
// dizionario: il traduttore dice DOVE va l'enfasi, non di che colore e'.
const fraseVestita = (classe, chiave, ...resto) => L.pezzi(chiave, ...resto).map((p, i) => (
  p.grassetto
    ? <span key={i} className={classe}>{p.testo}</span>
    : <React.Fragment key={i}>{p.testo}</React.Fragment>
));
const frase = (chiave, ...resto) => fraseVestita('font-bold', chiave, ...resto);
