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
const BOTTONE_MISURA = {
  minuscolo: 'px-3 py-1.5 text-[10px] border',
  piccolo: 'px-4 py-2.5 text-[10px] border-2',
  normale: 'px-4 py-2.5 text-xs border-2',
  grande: 'px-4 py-3 text-sm border-2',
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
