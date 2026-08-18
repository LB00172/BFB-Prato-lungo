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

// Tre altezze, non sei. py-1/py-1.5 -> piccolo, py-2/py-2.5 -> normale, py-3 -> grande.
// La larghezza del bordo sta qui e non nel ruolo perche' nel codice era gia'
// cosi': i bottoni piccoli hanno il filo sottile, i grandi quello doppio. Non
// l'ho deciso io, l'ho solo scritto.
const BOTTONE_MISURA = {
  piccolo: 'px-3 py-1.5 text-[10px] border',
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
};

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
