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
//
// E sotto tutte e tre, un'altezza minima di 44 px (min-h-11): e' la misura
// sotto la quale un pollice sbaglia — Android ne chiede 48, Apple 44. Il
// minuscolo era alto 31, il normale 41. Resta minuscolo il TESTO, non il
// posto da toccare (e2e/tocco misura ogni tasto dell'app).
const BOTTONE_MISURA = {
  minuscolo: 'px-3 py-1.5 min-h-11 text-piccolo border',
  normale: 'px-4 py-2.5 min-h-11 text-piccolo border-2',
  grande: 'px-4 py-3 min-h-11 text-normale border-2',
};

// I ruoli veri, guardando cosa fanno i bottoni e non come sono scritti.
// Il pieno marrone NON e' un doppione del verde: nell'app segna le azioni di
// secondo livello (chiudere il campo, creare l'album), ed e' usato abbastanza
// da essere una scelta, non una svista.
const BOTTONE_RUOLO = {
  primario: 'bg-bosco border-transparent text-white hover:bg-notte',
  bruno: 'bg-legno border-transparent text-white hover:bg-[#463628]',
  secondario: 'bg-scheda border-salvia/50 text-legno hover:bg-orlo',
  testuale: 'border-transparent text-legno hover:text-bosco',
  distruttivo: 'bg-scheda border-red-700/40 text-red-700 hover:bg-red-50',
  // L'ambra e' il colore degli avvisi in tutta l'app (86 usi): un bottone
  // ambra e' un'azione che nasce da un problema, non un'azione qualsiasi.
  avviso: 'bg-fuoco border-transparent text-white hover:brightness-95',
  // Verde WhatsApp: e' un marchio altrui, non una nostra scelta di tavolozza.
  // Sta qui per non farlo sembrare un colore dell'app usato a caso.
  whatsapp: 'bg-[#25D366] border-transparent text-white hover:brightness-95',
};

// Le icone sono un terzo dei bottoni e non entrano in nessun ruolo: sono
// quadrate, senza maiuscolo, senza etichetta. Forzarle dentro "testuale" le
// farebbe diventare rettangoli con dentro un simbolo. Nel codice la stessa
// "x" di eliminazione esisteva in quattro varianti diverse.
const BOTTONE_ICONA = {
  neutro: 'text-salvia hover:text-bosco',
  distruttivo: 'text-red-700 hover:text-red-900',
  pieno: 'bg-bosco text-white hover:bg-notte',
  tenue: 'bg-salvia/20 text-bosco hover:bg-salvia/40',
};

// Almeno 44×44 anche loro: la × per togliere era di 30×32, e sbagliarla
// vuol dire togliere la riga accanto.
const bottoneIcona = (tono, extra) => [
  'min-w-11 min-h-11 inline-flex items-center justify-center px-2.5 py-2 rounded font-bold leading-none disabled:opacity-40',
  BOTTONE_ICONA[tono] || BOTTONE_ICONA.neutro,
  extra || '',
].filter(Boolean).join(' ');

// Il tasto che galleggia: «+ Spesa», sopra ogni scheda del campo, in basso a
// destra dove arriva il pollice. E' uno solo e resta uno solo — due tasti
// galleggianti non dicono piu' quale sia la cosa principale. Pillola piena,
// alta 48 perche' e' il tasto piu' usato dell'app, con l'ombra perche' sta
// SOPRA il contenuto e deve sembrarlo.
const bottoneFlottante = (extra) => [
  'min-h-12 inline-flex items-center gap-2 pl-4 pr-5 rounded-full bg-bosco text-white shadow-xl font-bold uppercase tracking-wide text-normale hover:bg-notte',
  extra || '',
].filter(Boolean).join(' ');

// La riga richiudibile non e' un bottone con un altro colore: e' una forma
// diversa — larga, allineata a sinistra, senza maiuscolo, con il contenuto ai
// due estremi. Passa da qui perche' e' un ruolo, non un caso particolare.
const bottoneRiga = (extra) => [
  'w-full min-h-11 flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-orlo/60',
  extra || '',
].filter(Boolean).join(' ');

// ---------- La voce del menu ----------
// La riga del cassetto: icona a sinistra, etichetta che si accorcia invece di
// traboccare, e lo stato acceso quando e' l'area che stai guardando. Era
// scritta a mano in un posto solo finche' le voci erano una famiglia sola;
// da quando il menu ha anche le due AZIONI (crea un campo, partecipa) sono
// diventate due copie della stessa riga — ed e' il momento in cui una forma
// va nel vocabolario, non il momento in cui si aggiunge una riga al censimento.
const bottoneMenu = (accesa, extra) => [
  'w-full min-h-11 text-left px-3 py-2.5 rounded font-bold uppercase text-normale',
  'tracking-wide transition-colors flex items-center gap-2.5',
  accesa ? 'bg-bosco text-carta' : 'text-bosco hover:bg-orlo',
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
// chi text-white e chi text-carta — che a occhio sono lo stesso colore.
//
// Due assi, come per i bottoni:
//   - la FORMA dice com'e' fatto e quanto e' spesso (linguetta, pillola…);
//   - il TONO dice di che colore e' da acceso e da spento.
// Servono tutte e due perche' la stessa forma cambia colore secondo il
// significato: il chip del pranzo e' verde, quello della cena bruno, e non
// e' un vezzo — sono i due colori con cui l'app distingue i pasti ovunque.
// Tutte alte almeno 44 px, per la stessa ragione dei bottoni. La casella
// della spunta e' quadrata, quindi cresce in tutte e due le direzioni.
const SCELTA_FORMA = {
  // Linguetta: in quale sezione sto. Il filo spesso sotto dice dove sei.
  linguetta: 'min-h-11 py-2.5 rounded font-bold uppercase tracking-wide border-b-4 transition-all',
  // Interruttore: una cosa sola, accesa o spenta, a piena larghezza.
  interruttore: 'min-h-11 py-2.5 rounded font-bold uppercase tracking-wide border-2',
  // Spunta: chip minuto in riga, quello dei pasti.
  spunta: 'min-h-11 px-2.5 py-1.5 rounded font-bold uppercase border',
  // Pillola: scelta leggera in un gruppo che va a capo.
  pillola: 'min-h-11 px-3 py-1.5 rounded-full font-bold transition-colors',
  // Giunta: due chip attaccati dentro una cornice sola. Niente angoli
  // propri: glieli da' il contenitore, altrimenti si vedono due bordi.
  giunta: 'min-h-11 px-2.5 py-1.5 font-bold uppercase',
  // Etichetta: dice cos'e' una cosa (adulto/bambino), non cosa succede.
  etichetta: 'min-h-11 px-2 py-1 rounded font-bold uppercase',
  // Casella: la spunta quadrata di una lista di cose da fare. Non e' un chip
  // con dentro una parola — e' un quadrato con dentro un segno — ma il
  // meccanismo e' lo stesso: acceso o spento, e si tocca per cambiare.
  // E' entrata nel vocabolario quando e' comparsa la seconda volta.
  casella: 'w-11 h-11 shrink-0 rounded border-2 flex items-center justify-center font-bold',
};

const SCELTA_TONO = {
  // Da acceso il bordo sotto e' bruno, non verde: e' quello che fa sembrare
  // la linguetta una linguetta invece di un bottone premuto.
  sezione: {
    acceso: 'bg-bosco text-white border-legno',
    spento: 'bg-scheda text-bosco border-gray-300 hover:bg-orlo',
  },
  bordato: {
    acceso: 'bg-bosco text-white border-bosco',
    spento: 'bg-scheda text-bosco border-salvia/50 hover:bg-orlo',
  },
  // Pranzo e cena: spento e' GRIGIO, non bianco. Qui "spento" vuol dire "non
  // c'era", e deve sparire dall'occhio — a colpo d'occhio si contano i
  // presenti, non si legge riga per riga.
  pranzo: {
    acceso: 'bg-bosco text-white border-bosco',
    spento: 'bg-scheda text-gray-400 border-gray-300',
  },
  cena: {
    acceso: 'bg-legno text-white border-legno',
    spento: 'bg-scheda text-gray-400 border-gray-300',
  },
  tenue: {
    acceso: 'bg-bosco text-white',
    spento: 'bg-carta text-bosco border border-salvia/40 hover:bg-orlo',
  },
  piatto: {
    acceso: 'bg-bosco text-white',
    spento: 'bg-scheda text-bosco',
  },
  // Spunta: da spenta e' un quadrato vuoto col filo sage. Il segno di spunta
  // c'e' sempre ma e' trasparente: cosi' la casella non cambia dimensione
  // quando la si tocca, e la riga non salta.
  casella: {
    acceso: 'bg-bosco border-bosco text-white',
    spento: 'bg-scheda border-salvia text-transparent',
  },
  // Ambra: il colore con cui l'app segna le cose fuori dai conti. Un bambino
  // non paga, e quel chip lo dice con lo stesso colore degli avvisi.
  ambra: {
    acceso: 'bg-fuoco text-white',
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

// ---------- La serratura del Pro ----------
// Quello che si vede al posto di una funzione Pro, in un campo che il Pro non
// ce l'ha. Due parole diverse secondo chi guarda: il capogruppo lo puo'
// attivare (e trova il tasto per farlo), gli altri no — a loro si dice chi
// puo', non si mette davanti un tasto che non li riguarda.
// NOME_PRO tiene le CHIAVI: il nome si chiede al disegno (la lingua cambia).
const NOME_PRO = {
  meteo: 'pro.meteo', compiti: 'pro.compiti', regole: 'pro.regole', dotazioni: 'pro.dotazioni',
  archivio: 'pro.archivio', fotoCloud: 'pro.fotoCloud', piuCampi: 'pro.piuCampi',
};
const segnoPro = (extra) => (
  <span className={`shrink-0 text-minuto uppercase font-bold px-2 py-0.5 rounded bg-fuoco text-white ${extra || ''}`}>{L.t('campi.pro')}</span>
);
// goTo: se c'e', il capogruppo trova il tasto che porta al riquadro del Pro.
const avvisoPro = ({ funzione, capogruppo, goTo }) => (
  <div data-pro-bloccata={funzione} className="rounded border border-fuoco/40 bg-fuoco/10 p-3 space-y-2">
    <p className="text-piccolo font-bold text-bosco flex items-center gap-2">{segnoPro()}{L.t(NOME_PRO[funzione])}</p>
    <p className="text-minuto text-gray-600 leading-snug">{L.t(capogruppo ? 'pro.perCapogruppo' : 'pro.perMembro')}</p>
    {capogruppo && goTo && (
      <button onClick={() => goTo('impostazioni')} className={bottone('avviso', 'minuscolo', 'w-full')}>{L.t('pro.scopri')}</button>
    )}
  </div>
);
