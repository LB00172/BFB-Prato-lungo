# Istruzioni per Claude

Contesto in due righe: PWA per gestire e dividere le spese del campo della
Brigata Fabio Bandone a Prato Lungo (Pereto, AQ), 11–16 agosto 2026. Gira su
Vercel dal ramo `main`. La usano ~20 persone che in montagna vanno offline.

## Regole che non si negoziano

1. **Si parla italiano.** Chat, commenti nel codice, messaggi di commit:
   tutto in italiano, e questo non cambia. I **testi che legge l'utente** sono
   l'eccezione decisa ad agosto 2026 (`ROADMAP.md` §18): si scrivono in
   italiano per primi, ma passano da `lingue.js` perché l'app parlerà anche
   spagnolo e francese. Si usano `L.t('chiave')` per il testo,
   `frase('chiave')` quando c'è del grassetto dentro — `fraseVestita(classe,
   'chiave')` se quel grassetto ha anche un colore — e `L.data(d, 'forma')`
   per le date. **Mai `'it-IT'` a mano** — ce n'erano 32 sparsi, adesso zero.
   **Tutti** i sorgenti passano dal dizionario (791 chiavi) e
   `FEATURES.lingue` è accesa: `node test/censimento-testi.js` dice se
   qualcuno ha scritto testo nuovo a mano, e una prova lo vieta — compreso
   un sorgente appena nato, che senza quella riga entrerebbe senza contarlo.
2. **`App.js` è generato. Non si tocca mai a mano.** Si modificano i sorgenti
   in `src/` e poi si lancia `node build.js`, che li incolla nell'ordine
   dichiarato, ricompila `App.js` e ricalcola `CACHE_NAME` in `sw.js` dall'hash
   del contenuto. Se salti il build, i telefoni restano con la versione vecchia
   in cache.
3. **Le password in chiaro non entrano nel repository.** In
   `firebase-config.js` ci stanno solo le impronte PBKDF2 (`salt`, `hash`,
   `iter`). La password vera si comunica in chat e basta.
   **Le chiavi di SERVIZIO di Firebase non entrano da nessuna parte** — né nel
   repository né in chat. Una chiave admin scavalca le regole Firestore: vale
   più di tutto quello che c'è scritto in `firestore.rules` messo insieme, e
   quello che entra in git ci resta anche dopo che lo cancelli. Le chiavi
   *web* in `firebase-config.js` sono un'altra cosa: sono pubbliche per
   progetto, stanno nel codice che arriva su ogni telefono, e la protezione
   vera sono le regole. Una prova guarda il contenuto dei file e diventa rossa
   se una chiave di servizio compare, comunque la si chiami.
4. **Prima di dire "fatto" gira `npm test`.** 81 prove, **due minuti e
   mezzo**. Verde o non è finito. Se hai toccato `firestore.rules`, anche
   `npm run regole`.
5. **Nessuna prova nuova vale finché non l'ho vista fallire.** Si sabota di
   proposito il codice che dovrebbe proteggere, si controlla che la prova
   diventi rossa, si rimette a posto. Una prova che non sa fallire è peggio
   di niente, perché rassicura a vuoto.

Per gli strumenti esterni (Base44, Codex, revisori automatici) c'è
`AGENTS.md`: contiene solo quello che dal codice non si vede e che, ignorato,
porta a diagnosi sbagliate. Se cambia una di quelle regole, va aggiornato lì.

## Comandi

```
node build.js          # src/*.jsx -> App.js + CACHE_NAME in sw.js
npm test               # tutto (~2 min 30)
npm test unita         # solo le prove che non aprono il browser (~2 s)
npm test contabilita   # filtro sul nome della prova
npm run regole         # le regole Firestore, contro l'emulatore (~30 s)
PROVE_PARALLELE=1 npm test   # una alla volta, per inseguire una prova ballerina
```

Le prove girano **in parallelo**, al doppio dei core. Non è per eleganza: in
serie erano dieci minuti, e una rete di sicurezza che costa dieci minuti si
finisce per lanciarla di meno — che è il contrario di quello che deve
succedere. La misura che lo permette: la suite consuma due minuti di
processore in sei di orologio, cioè per due terzi del tempo sta ferma ad
aspettare. Le più lente partono per prime, e le durate se le ricorda da sé in
`test/tmp/durate.json`.

`npm run regole` sta **fuori** da `npm test` perché ha bisogno
dell'emulatore Firestore (Java e `firebase-tools`, già fra le dipendenze di
sviluppo). Si lancia da sé l'emulatore e lo spegne alla fine. Va girato ogni
volta che si tocca `firestore.rules` — e prima di incollarle in console.

Le prove e2e usano `playwright-core` con il Chromium già installato e un
server statico sulla porta 8091. Se salta fuori `EADDRINUSE`, è rimasto un
`node test/esegui.js` appeso: va ucciso.

## Com'è fatto

| File | Cosa contiene |
| --- | --- |
| `src/*.jsx` | i sorgenti, incollati **nell'ordine elencato in `build.js`**. I numeri vanno di dieci in dieci per poter infilare pezzi in mezzo |
| `src/80-app.jsx` | `function App()`: stato, sincronizzazione, gestori. I conti non stanno più qui |
| `src/7*-usa-*.jsx` | lo **stato** uscito da `App()`: hook (`usaGioco`, `usaGalleria`, `usaScontrini`) che si portano dietro i loro `useState`. Tengono stato e **non disegnano** |
| `src/8*-schede-*.jsx` | il **disegno** delle schede, uscito da `App()`. Non sono componenti React: sono funzioni che restituiscono JSX e ricevono le dipendenze in un oggetto. Disegnano e **non tengono stato** |
| `src/45-icone.jsx` | **le icone**, SVG in linea con `stroke="currentColor"`: prendono il colore dal testo, quindi tema scuro e tavolozza vengono gratis. Si chiamano per nome, `icona('calendario')`; un nome inventato non dà errore, dà un buco — una prova lo vieta. Le emoji rimaste possono solo scendere |
| `src/50-interfaccia.jsx` | vocabolario dei bottoni: `bottone`, `bottoneIcona`, `bottoneRiga`, `bottoneMenu`, `bottoneScelta` (i chip accesi/spenti). La guardia chiede l'elenco a questo file, non lo tiene scritto |
| `src/87-scheda-compiti.jsx` | «Chi fa cosa»: i compiti assegnati, dietro `FEATURES.compiti`. Un compito **non** è una spesa |
| `src/88-scheda-ingresso.jsx` | **l'ingresso**: la tessera dell'account (una sola, usata da Impostazioni e dalla schermata d'apertura) e la schermata d'apertura, che compare solo a chi non ha **né** un account **né** un campo |
| `src/89-scheda-campi.jsx` | **la home, «I miei campi»**: l'elenco dei campi della persona e il modulo Crea / Partecipa (uno solo, usato anche da Impostazioni). Compare da sola quando non c'è un campo aperto, e dal menu quando c'è. L'elenco sta sul telefono (`cambusa_campi`) e si corregge dal cloud: la home si apre senza linea. Le regole (ricordare, aggiornare, ordinare) sono in `stanza.js` |
| `src/78-usa-account.jsx` | lo stato del login: maschera, occupato, problema. Le regole no — quelle stanno in `auth.js` |
| `src/79-usa-stanza.jsx` | lo stato della stanza: crea, entra, chi c'è dentro. Dietro `FEATURES.rooms` |
| ~~`src/60-gioco.jsx`~~ | **non c'è su questo ramo.** «Aiuta Bandy» è della Brigata e vive solo su `main`: tolto dall'app pubblica il 28 settembre (sorgenti, scheda, `bandy.png`, testi, prove). `unita/compilazione` diventa rossa se rientra |
| `voci.js` | **le voci di spesa spente** (§ 8): toglie dai conti le categorie che il gruppo gestisce fuori e ne dichiara la cifra. `conti.js` non si tocca — si sceglie cosa dargli da dividere |
| `App.js` | **generato**, non modificare |
| `sync-merge.js` | fusione voce per voce fra dispositivi (`rev`, `del`, orologio `hi`) |
| `menu-spesa.js` | dal menù del giorno alle voci della spesa. Sta fuori da `src/` perché così è provabile con una prova unitaria invece di duplicare la logica nel test |
| `magazzino-foto.js` | dove stanno le foto degli scontrini: IndexedDB, con `localStorage` come rete di sicurezza. Fuori da `src/` per lo stesso motivo |
| `conti.js` | **i conti**: `Conti.calcola({membri, presenze, acquisti, attrezzatura, giorni separati, giorni gratis})`. Funzione pura, fuori da `src/`, provata sui numeri veri del campo 2026 |
| `presenze.js` | le **regole** delle presenze: giorno, pasto, blocco, presenze orfane. Pure, fuori da `src/`. I gestori restano in `App()` |
| `lingue.js` | **le lingue**: dizionario (it/es/fr), plurali come funzioni, le dodici forme di data, e la regola che si prova — ogni chiave italiana esiste altrove e viceversa. Fuori da `src/` |
| `allarmi.js` | **quando svegliare qualcuno**: orologio di un altro telefono avanti di giorni, e perdite che meritano un allarme invece di essere il recupero di un ritardo. Pure, fuori da `src/` |
| `auth.js` | **chi sei, e cosa ti lascia fare l'app**: `Auth` sono le regole (stati, permessi, validazione, codici d'errore tradotti), `AuthCloud` è il trasporto verso Firebase Authentication. Fuori da `src/`. Dietro `FEATURES.auth` |
| `stanza.js` | **la stanza**, in due metà come `auth.js`: `Stanza` sono le regole (alfabeto e generatore del codice, lettura di un codice digitato a mano, validazione del modulo, ruoli, **cosa si scrive entrando**), `StanzaCloud` il trasporto verso Firestore. La crittografia non c'è: è `improntaPassword` in `src/20-blocco-password.jsx`. Dietro `FEATURES.rooms` |
| `cassetti.js` | **un cassetto per campo**: le chiavi di sempre tengono i dati del campo in gioco, gli altri campi stanno da parte sotto il loro codice. Lo scambio si fa all'avvio e a ogni cambio di campo, con `App` smontata (`src/90-avvio.jsx`); le foto si scambiano a parte, in modo asincrono. Ogni chiave `cambusa_*` dei sorgenti deve stare in `DEL_CAMPO` o in `DEL_TELEFONO`: una prova lo pretende |
| `firebase-sync.js` | trasporto verso Firestore, transazione e regola `sovrascrivibile`. **Dove** stanno i dati lo decide `percorso()`: `camps/<codice>` nella versione privata, `rooms/<codice>/dati/stato` in quella pubblica (`APP_CONFIG.dati`) |
| `firebase-config.js` | chiavi Firebase e impronte delle password. Il progetto è **`camp-ops`**, non quello della Brigata: separarli è la decisione del 22 settembre |
| `privacy.html`, `cancella-account.html` | **l'informativa e la richiesta di cancellazione** che Google Play pretende. Titolare e contatto da `APP_CONFIG.privacy`. Devono dire la verità sull'app di oggi: una guardia vieta che l'app parli con un servizio che l'informativa non nomina, e una prova controlla che il percorso descritto sia il nome vero del bottone |
| `firestore.rules` | **chi può leggere e scrivere cosa** nel cloud. Su questo ramo parlano solo di `rooms/<id>`: `camps/` sta in un altro progetto Firebase e qui è chiuso come tutto il resto. Si provano con `npm run regole`, mai a occhio |
| `sw.js` | service worker, precache atomico |
| `build.js` | compilazione + versione della cache |
| `marca/` | il logo originale di **Camp Ops** a 2000 px. Le quattro misure (`logo.png`, `icon-512`, `icon-192`, `apple-touch-icon`) si ricavano da lì con Chromium, senza dipendenze nuove |
| `test/censimento-testi.js` | **il metro del §18**: quanti testi l'utente legge che non passano ancora dal dizionario, e in quale file. Non è una prova — ma una prova lo usa come guardia |
| `test/` | 16 prove unitarie + 65 end‑to‑end, più `regole/` (fuori da `npm test`). `test/lib/app.js` ha `ingressoFinto`: Firebase Authentication finto e, a richiesta, un'app senza campo |

Su Firestore: documento `camps/<codice>` più le sottoraccolte `receipts`,
`snapshots`, `archives`, `scores`, `photos`, `photofull`, `meta/weather`.

## Le trappole in cui sono già cascato

- **L'orologio logico `hi` frena solo se stesso.** Il tetto `MAX_AVANTI` vale
  quando l'orologio locale avanza, mai nei confronti fra due valori: se freni
  anche il confronto, due telefoni non convergono più.
- **Un `localStorage.setItem` senza `try/catch` dentro un `useEffect` smonta
  React.** Quota piena e l'app sparisce. Si passa sempre da `salvaLocale`.
- **Firestore rigioca le scritture messe in coda offline.** Un `setDoc` cieco
  cancella il lavoro di chi era online. Si scrive solo dentro
  `runTransaction`, passando da `sovrascrivibile()`.
- **Contare le voci senza guardare le date genera falsi allarmi.** Togliere
  un membro tocca 7 percorsi: sembrano 7 perdite e non lo sono. La regola sta
  in `allarmi.js` e si conta solo la **raffica più recente**: le lapidi di un
  gesto solo portano tutte lo stesso istante. Un allarme che suona a vuoto è
  peggio di nessun allarme — dopo due volte non lo guarda più nessuno.
- **Prima si aggiorna la storia della sincronizzazione, poi l'istantanea
  locale.** All'inverso, con lo spazio agli sgoccioli, l'istantanea si mangia
  i byte che servivano alla storia.
- **I dati veri correggono i piani, e vanno guardati prima di scrivere.** Il
  ponte Menù → Lista prevedeva una tabella di ingredienti: i menù del campo 2026
  hanno mostrato che la gente scrive già gli ingredienti con le quantità, e che
  la scheda «Da acquistare» era vuota perché nessuno scrive due volte. La
  tabella non è servita. Lo stesso è capitato al §11, sopravvalutato finché non
  ho letto `firebase-sync.js` riga per riga.
- **Una prova che dipende da "oggi" scade da sola.** `e2e/meteo` costruiva il
  bollettino finto su «oggi ±30 giorni», ma il Calendario apre sul giorno di
  inizio campo: a settembre 2026 sono diventate undici verifiche rosse senza
  che nessuno avesse toccato il meteo. Se una prova ha bisogno di una data,
  la prende dal campo (`CAMP_START`/`CAMP_END` in `src/40-configurazione.jsx`),
  non dall'orologio.
- **Un controllo che chiede dei dati non vale quando i dati non ci sono.**
  «Pronto per il campo» chiedeva dei membri, ma chiudere il campo azzera le
  liste: l'avviso restava per sempre su un telefono che stava benissimo. Ogni
  avviso va chiesto anche al contrario — *quando NON deve comparire?*
- **Le foto degli scontrini NON sono in `localStorage`.** Stanno nel magazzino
  (`magazzino-foto.js`, IndexedDB), le governa `src/77-usa-scontrini.jsx`, e
  arrivano **dopo** il primo disegno. Chi scrive un effetto che le guarda deve
  metterle fra le dipendenze, altrimenti al primo giro non c'è ancora niente:
  è così che la potatura delle foto orfane era smessa di funzionare senza che
  si vedesse.
- **Non tutto si stacca allo stesso modo.** Stato isolato (gioco, galleria,
  scontrini) → hook in `src/7*-usa-*.jsx`, e si prova col DOM identico. Logica
  pura (i conti) → file fuori da `src/`, e si prova coi numeri veri. Scegliere
  il modo sbagliato produce un hook con venti dipendenze, che non ha staccato
  niente: ha solo spostato le righe.
- **Un compito non è una spesa.** «Chi fa cosa» (§17) assegna incarichi e non
  tocca i conti: nei conti entra la spesa che ne nasce, se qualcuno la
  registra. Il ponte porta il nome e chi l'ha eseguito, **mai un prezzo** —
  quando ci si divide i compiti il prezzo non si sa ancora.
- **`L` è globale, ma la scrive il disegno.** La lingua vive in
  `10-fondamenta.jsx` e `App()` la riassegna **a ogni disegno** dal suo stato:
  è questo che fa cambiare lingua senza ricaricare. Trasformare una scheda in
  un componente memoizzato romperebbe proprio questo — salterebbe il ridisegno
  e resterebbe con la lingua di prima.
- **`new Date(null)` non è una data non valida: è il 1° gennaio 1970.** Una
  data assente formattata senza controllo compare a schermo come «giovedì 1
  gennaio», che è una bugia con l'aria di un dato.
- **Una costante valutata al caricamento congela la lingua.** I sorgenti si
  incollano e girano *prima* che `App()` assegni `L`: una tabella come
  `const SEZIONE_DI = { m: 'Membri', … }` si costruisce una volta sola e
  resterebbe per sempre nella lingua di quel momento. Le tabelle tengono le
  **chiavi** (`SEZIONE_DI`, `PURCHASE_TYPES`), il nome si chiede al disegno.
- **Un file puro non sa in che lingua verrà letto.** `conti.js` non
  restituisce più «cibo e bevande del conto comune, ma nessun pasto segnato»:
  restituisce `'buchi.ciboComune'`, e la frase la sceglie il disegno. Il
  prezzo è che un refuso diventa `buchi.logistiche` stampato a schermo — il
  ripiego di `t()` lo mostra apposta. Una prova legge i sorgenti e chiede che
  ogni chiave scritta esista, comprese quelle che passano da un file all'altro.
- **Con `FEATURES.lingue` spenta, lo spagnolo non lo chiama nessuno.**
  Settantatré chiavi sono funzioni: un apostrofo sbagliato dentro un template
  non si vedrebbe fino al giorno in cui qualcuno accende la lingua. Le prove
  le chiamano tutte, in tutte le lingue, con lo zero, l'uno e il due.
- **Un token di `@theme` scritto male non rompe niente.** `text-piccolo` con
  il token sbagliato diventa una classe che non esiste: l'elemento eredita la
  misura del genitore, l'app resta in piedi e nessuno se ne accorge. Non c'è
  errore in console e il DOM è identico — la classe c'è, è il CSS che manca.
  Se ne accorge solo `e2e/scala-testo`, che misura il `font-size` calcolato.
- **Il confronto del DOM è cieco quando a cambiare sono le classi.** Serve a
  spostare codice senza cambiare comportamento; quando il lavoro È cambiare
  l'aspetto (la scala del testo, i colori), non dice niente di utile. Lì la
  rete è un'altra: si guarda quello che disegna il browser.
- **Se sta nel precache, deve contare per `CACHE_NAME`.** `logo.png` e le tre
  icone stavano nel precache ma fuori dall'elenco che calcola la versione, che
  era scritto a mano. Cambiare il logo non avrebbe cambiato la versione, e ogni
  telefono già installato avrebbe continuato a mostrare quello vecchio, dalla
  cache, **per sempre** — finché qualcos'altro non avesse cambiato l'hash. Il
  codice giusto in produzione che non arriva a nessuno è già successo una
  volta. Adesso `build.js` l'elenco lo chiede al precache, e una prova
  ricalcola la versione e la confronta con quella scritta in `sw.js`.
- **La password del campo non sta nel repository, ma l'IMPRONTA ricopiata è
  lo stesso problema.** Cambiando la password del campo sono diventate rosse
  **diciannove prove in un colpo**: ognuna aveva l'impronta copiata dentro per
  entrare già sbloccata, e nessuna c'entrava niente con il blocco. E tre prove
  avevano addirittura la password **in chiaro**, contro la regola 3, da mesi.
  Adesso l'impronta si legge da `firebase-config.js` (`SBLOCCO` in
  `test/lib/app.js`) e le tre prove che attraversano davvero il blocco si
  installano un blocco loro (`bloccoDiProva()`), con una password che non apre
  niente di vero.
- **Un elenco di file scritto a mano dentro una prova invecchia da solo.**
  La guardia sulle chiavi inventate leggeva `['conti.js', 'presenze.js',
  'allarmi.js', 'menu-spesa.js']`: è nato `auth.js`, che restituisce chiavi
  esattamente come `conti.js`, e i suoi refusi hanno smesso di essere guardati
  **senza che niente diventasse rosso**. Lo stesso valeva per la tabella del
  censimento, che controllava solo i file che già conosceva. Una guardia che
  non copre il codice nuovo non è una guardia a metà: è un sonnifero. L'elenco
  si chiede a chi lo tiene già — `index.html` per i file caricati, `build.js`
  per i sorgenti.
- **I bottoni sono in maiuscolo per CSS, e `innerText` lo restituisce.**
  `uppercase` non cambia il DOM, cambia quello che il browser disegna — ma
  `innerText` legge il disegnato, quindi «Entra con Google» arriva alla prova
  come «ENTRA CON GOOGLE». Ci sono già cascato **quattro volte**, e la seconda
  faccia della trappola è peggiore della prima: una verifica che cerca
  `/Entra con Google/` e **non deve trovarlo** passa, ma per il motivo
  sbagliato, e continuerebbe a passare anche se il bottone ci fosse. Nelle
  prove il confronto sul testo a schermo va sempre con `/i`.
- **Una regola Firestore sbagliata non dà errore: dà accesso.** È l'unica
  parte del progetto che non si può provare leggendo il codice, e l'unica che
  separa i dati di venti persone da chiunque passi di lì. Si provano contro
  l'emulatore (`npm run regole`), e la prova è fatta quasi tutta di cose che
  devono **fallire**: una prova che controlla solo che il proprietario possa
  scrivere passerebbe anche con `allow read, write: if true`. Il diniego in
  fondo (`match /{document=**}` → `if false`) non è decorazione: togliendolo,
  ventidue verifiche su trentanove diventano rosse in un colpo.
- **Una prova che non ripulisce quello che ha scritto passa una volta sola.**
  Le prove delle regole creavano una stanza e non la cancellavano: al secondo
  giro la `create` diventava una `update` e la verifica diventava rossa per un
  motivo che con le regole non c'entrava niente. Se ne è accorto un sabotaggio,
  non io — due sabotaggi diversi facevano fallire la stessa verifica estranea,
  ed è quello il segnale. `clearFirestore()` all'inizio, sempre.
- **Una prova che sostituisce un pezzo non può verificare quel pezzo.** La
  prova a schermo della stanza sostituisce `StanzaCloud` con un finto: la
  verifica «entrando ci si scrive da redattori» guardava quindi il finto, e
  sarebbe rimasta verde anche cambiando il ruolo nell'app. Il sabotaggio non
  la faceva arrossire, ed è così che me ne sono accorto — **un sabotaggio che
  non produce rosso è una notizia, non un sollievo.** La cura è la stessa già
  usata per l'account: la decisione esce dal pezzo sostituito e diventa una
  funzione pura (`Stanza.schedaIngresso`) che il finto è costretto a chiamare.
- **Un sabotaggio che non produce rosso è una notizia, e va inseguito.** È
  capitato due volte in un giorno, e tutte e due le volte il difetto era nella
  prova, non nel codice: la prima perché la prova verificava un pezzo che lei
  stessa aveva sostituito; la seconda perché seminava i dati **dopo** il
  momento in cui il codice sabotato li avrebbe usati, quindi il sabotaggio
  falliva per il motivo sbagliato e la prova restava verde. Se una prova che
  gira in un browser ha bisogno di uno stato che deve esistere *prima*
  dell'apertura, quello stato si dichiara nello script di avvio — che rigira a
  ogni navigazione — non con un `page.evaluate()` dopo.
- **Firestore conta i pezzi del percorso: pari è un documento, dispari una
  collezione.** La radice pubblica era `rooms/<id>/dati` — tre pezzi, quindi
  una collezione — e ogni `doc()` sopra ci sarebbe esploso. Ci vuole un
  documento dentro: `rooms/<id>/dati/stato`. Se ne è accorta la prova che
  conta i pezzi, non io. E **dove** stanno i dati non si scrive più a mano:
  `'camps'` era in trentasette punti di `firebase-sync.js`, adesso passa tutto
  da `percorso()` e una prova vieta di riscriverne uno.
- **Lo stato di partenza scritto aggirando le regole nasconde la strada che
  lo costruisce.** Le prove delle regole seminano la stanza con
  `withSecurityRulesDisabled` — e devono farlo, provare le regole con le
  regole non dimostra niente. Ma fra le righe seminate c'era la **scheda del
  proprietario**, cioè proprio il documento che l'app fatica a scrivere:
  ogni verifica partiva da un mondo che le regole non sapevano costruire.
  Creare una stanza sono **tre** scritture, e la terza era negata: il
  documento nasceva, la scheda no, e da lì in poi il proprietario non poteva
  più nemmeno leggere la stanza che aveva appena creato. Trentanove verifiche
  verdi, e la versione pubblica senza primo passo. La prova a schermo non
  poteva vederlo — sostituisce `StanzaCloud` con un finto. Se lo stato
  iniziale contiene qualcosa che l'app scrive, quel percorso va provato in
  proprio, di seguito e nell'ordine vero (`5-bis` in `test/regole/stanze.js`).
- **Le regole in `firestore.rules` non vanno in produzione da sole.** Non le
  pubblica né `git push` né Vercel: si incollano a mano nella console
  Firebase. Ripararle nel repository e fermarsi lì vuol dire avere la cura
  scritta e il difetto ancora vivo su venti telefoni.
- **Un'attesa fissa dentro una prova è una bomba a orologeria che il
  parallelismo fa esplodere.** `e2e/registro` aspettava 800 millisecondi e poi
  pretendeva che la fusione remota fosse arrivata. In serie bastavano; con
  otto browser accesi no, e la prova è caduta una volta su cinque — per un
  motivo che col codice non c'entrava niente. Una prova che cade a caso è
  peggio di una che manca: dopo due volte si prende l'abitudine di rilanciarla
  invece di leggerla, e il giorno che ha ragione non la crede più nessuno. Si
  aspetta la CONDIZIONE (`waitForFunction`), mai un numero di millisecondi —
  tranne quando si verifica che qualcosa NON succeda, dove un'attesa fissa è
  l'unica cosa possibile.
- **I dati sul telefono non dicevano di quale campo erano.** Membri, spese,
  presenze e cronologia della fusione stavano in chiavi fisse. Entrando in un
  secondo campo, l'app si collegava al codice nuovo e **fondeva** i due campi,
  poi rimandava su il risultato: i membri di A finivano in B per tutti, una
  stanza nuova e vuota si prendeva il campo intero di prima, e le foto degli
  scontrini di A venivano caricate nella stanza di B. La fusione faceva il suo
  mestiere: le si davano da fondere due campi diversi. Nessuno se n'era accorto
  perché ad agosto il campo era uno. Adesso ogni campo ha il suo cassetto
  (`cassetti.js`, `e2e/cassetti`). E un effetto che legge lo stato **dopo** il
  primo disegno è un primo disegno che mente: la stanza salvata si leggeva in
  un effetto, e per un istante l'app si credeva nel campo predefinito — prima
  dei cassetti non costava niente, con i cassetti scambiava verso il campo
  sbagliato.
- **Soldi senza divisore non si spalmano su nessuno.** Se una spesa non ha
  presenti a cui attribuirla finisce in `nonRipartito` e si dichiara, non si
  nasconde dentro l'arrotondamento.

## Modalità tecnica (admin)

Diagnostica, registro, avvisi di allineamento e i pulsanti di blocco stanno
dietro la modalità tecnica, che si attiva da Impostazioni con una password
dedicata. L'utente normale non deve vedere messaggi che lo spaventano. Nelle
prove si entra già in modalità tecnica; `apri({ admin: false })` mostra l'app
come la vede lui.

## Commit

Messaggio in italiano, una riga, che dice cosa cambia per chi usa l'app —
non quali file sono stati toccati. Esempi veri:
`Deep check: orologi sballati, prezzi fuori scala, precache completo`,
`Il verdetto: gli stessi conti, qualunque strada abbiano preso`.

Un hook `Stop` in `.claude/settings.json` fa già `node build.js`, commit e
push a fine turno: non serve chiederlo, serve non dimenticare che succede.

**Quell'hook può fallire in silenzio.** Ha `2>/dev/null` su tutto e `exit 0`
in coda: se la firma del commit va in timeout, non committa e nessuno lo
sa. A fine turno si guarda `git status`: se ci sono file, si rifà a mano.

## Decisioni già prese, da non rimettere in discussione

- **La velocità del gioco non si tocca** (su `main`: nell'app pubblica il
  gioco non c'è). `BASE_STEP`, `LEVEL_SPEEDUP` e
  `MIN_STEP` sono fermi dal 27 luglio, quando l'accelerazione è passata da
  x2 a x1.5. In classifica ci sono già dei punteggi fatti con questa curva:
  cambiarla renderebbe incomparabili i vecchi e i nuovi. Il muro in
  Thailandia (50 ms) è voluto — è lì che una curva geometrica costante
  incrocia il tempo di reazione umano.
- **Il blocco di un giorno protegge tre cose, non una.** I pasti; i membri
  che quei pasti li hanno (eliminarli o dichiararli bambini riscriverebbe
  le quote lo stesso); e i due interruttori "gratis" e "conto separato".
  Riattaccare una presenza orfana o unire due schede doppie invece passa:
  sono riparazioni, non cambiano CHI ha mangiato.
- **Logistica e attrezzatura le pagano solo i giorni comuni.** Il divisore è
  chi ha almeno un pasto in un giorno a conto comune. Chi c'è stato unicamente
  nei giorni a conto separato non le paga, e la sua parte si spalma sugli
  altri: il conto separato è una cassa a parte, non uno sconto sui pasti. Se
  di adulti nei giorni comuni non ce n'è nessuno, quei soldi finiscono in
  `nonRipartito` e si dichiarano — non si spalmano su chi non c'era.
- **Le casse sono due e chiudono ognuna per conto suo.** La cassa separata è
  solo il cibo dei giorni spuntati; tutto il resto — cibo comune, logistica,
  attrezzatura — è cassa comune. Ognuna ha le sue quote, il suo arrotondamento
  a 0,10 € e il suo "chi paga chi": chi ha anticipato sul conto separato viene
  rimborsato da chi in quei giorni ha mangiato, non da chi è arrivato dopo.
  Sommare le due prima di pareggiare farebbe sparire proprio la separazione,
  perché un creditore di qua e debitore di là si annullerebbe da solo.
- **Ottimizzare i passaggi non è ricalcolare i conti.** Il tasto nei Saldi
  mette insieme le due casse per fare meno bonifici: le cifre dovute restano
  identiche, cambia solo chi gira i soldi a chi. La vista per cassa resta ed è
  quella che spiega PERCHÉ una cifra è quella; l'ottimizzata serve QUANDO si
  paga. Le spunte delle due viste sono separate (`opt:`), altrimenti un
  rimborso segnato in una vista sembrerebbe fatto anche nell'altra.
- **L'account non è un muro.** Entrare in un campo col codice, segnare presenze
  e registrare spese si può da ospite, da anonimo, da registrato e da chi non ha
  ancora verificato l'indirizzo. L'account serve a **creare** e **amministrare**
  un campo, cioè alle cose che nella versione pubblica avranno un proprietario.
  È un difetto che non si vede scrivendo il codice: si vede in montagna il primo
  giorno, quando non c'è linea per registrarsi e nessuno ha voglia di farlo — e
  lì non si sistema. La tabella dei permessi sta in `auth.js` e due prove la
  guardano da sole.
  **Riconfermata il 28 settembre**, dopo averla rimessa in discussione per il
  Play Store: Google **non** chiede la registrazione (verificato sulle norme,
  `ROADMAP.md` §3), e registrare tutti non rende la stanza più sicura — a
  far entrare è il **codice**, registrati o no. L'unico problema vero
  dell'accesso col codice (cambiando telefono si rientra come persona nuova
  e si perde il ruolo) lo risolve **«tieni il tuo posto»**: un tocco lega la
  sessione anonima a Google **con lo stesso uid**; se quell'account Google era
  già usato altrove, si diventa lui e si rientra col codice salvato
  (`Auth.passaAllAccountEsistente`, `e2e/posto`).
- **Le versioni sono DUE, e restano separate.** La **privata** è questa: il
  gruppo, il campo in montagna, «Aiuta Bandy», Prato Lungo, l'utente condiviso.
  La **pubblica** è un prodotto neutro che andrà sul Play Store. Non è un'app
  sola con il marchio cambiato: sono due, e vivono su rami diversi — `main` la
  privata, `camp-ops` la pubblica.
  **Niente passa dall'una all'altra da solo.** Quando una cosa sviluppata sulla
  pubblica va portata anche sulla privata, lo decide Lorenzo e lo dice. Non si
  fondono i rami «per tenerli allineati».
  **E dal 22 settembre i progetti Firebase sono DUE**: `camp-ops` per la
  pubblica, `brigata-bandone` per la privata. Prima era uno solo, e il marchio
  usciva nel punto peggiore — premendo «Entra con Google» la finestra di
  consenso diceva `brigata-bandone` a ogni utente della versione pubblica. La
  guardia sui file di marchio restava verde: i due `firebase-config.js`
  differivano in due righe e avevano identiche le sei che contano. Un file
  diverso non è un marchio separato; separato lo è quando differiscono i
  **valori che l'utente legge**, ed è quello che adesso una prova controlla
  (`apiKey`, `authDomain`, `projectId`, `appId`). Separando i progetti cadono
  insieme anche il file di regole unico per due app e il raggio di un errore:
  uno sbaglio nelle regole pubbliche non arriva più ai dati veri del 2026.
  **Ma non stanno divergendo, e conviene saperlo:** al 22 settembre i due rami
  differiscono in sessanta file, di cui **sei** sono il marchio e gli altri
  **lavoro nuovo che non ha ancora attraversato** — login, stanza, inviti, che
  non sono «della pubblica», sono il futuro di tutte e due. La relazione non si
  ricorda più: `unita/compilazione` la dichiara in due elenchi (`UGUALI`,
  `DIVERSI`) e stampa un riepilogo a ogni `npm test`. Se qualcosa diverge senza
  che tu l'abbia deciso, o se il marchio della Brigata torna nell'app pubblica,
  diventa rosso.
  Un solo vincolo tecnico a questa separazione: **la logica dei soldi non si
  duplica**. `conti.js`, `presenze.js`, `sync-merge.js` e `allarmi.js` devono
  restare la stessa cosa nei due rami, perché un errore sui conti corretto una
  volta sola sarebbe un errore ancora vivo dall'altra parte. Se uno di quei
  file diverge, è un problema da risolvere, non una conseguenza accettabile.
- **Il Pro è del campo, non della persona** (28 settembre). Lo paga chi crea
  il campo e vale per tutti quelli dentro; chi è Pro in un altro gruppo non lo
  porta con sé. Nessun telefono lo scrive, proprietario compreso: lo accende
  solo il server che verifica l'acquisto. Le funzioni Pro chiedono a
  `stanzaStato.pro` (`Stanza.campoPro`, che riceve la stanza) e **mai** a
  qualcosa della persona.
- **Importazione, ripristino di emergenza e chiusura del campo stanno in
  modalità tecnica.** Non modificano i dati: li RIMPIAZZANO, e si portano
  via i blocchi insieme al resto. Erano le ultime tre strade aperte a
  tutti. Esportare invece resta a chiunque: è di sola lettura.

## Se al campo qualcosa non torna

Impostazioni → Backup Dati → **Esporta**: produce il JSON completo dello
stato. È il modo di guardare i dati veri invece di ipotizzare — Firestore
da qui non si vede, e l'export funziona anche senza linea.

## Dopo il campo (da settembre)

**Il piano sta in `ROADMAP.md`, non qui.** In testa a quel documento c'è
l'*ordine di lavoro*: quindici sezioni con i numeri fissi (sono nomi, non
priorità) e la fila in cui affrontarle, con scritto cosa blocca cosa.

Le tre cose da sapere senza aprirlo:

- **L'iPhone è verificato** (`ROADMAP.md` §10): ad agosto 2026, a mano, e
  l'aggiornamento del service worker arriva. Le 74 prove girano comunque solo
  su Chromium, quindi quel giro va rifatto ogni volta che si tocca `sw.js` o
  `build.js` — sono i due file che decidono se un rilascio arriva o resta in
  cache. Si comincia invece dalle immagini fuori da `localStorage` (§19): nel
  campo 2026 gli scontrini occupavano 3,18 MB dei 5 disponibili, e i dati che
  contano ne pesano 35 KB.
- **Login e room vengono prima di quasi tutto** (§1 e §2): senza un `uid` non
  esistono la checklist privata, la chiave dell'IA, le voci spegnibili né il
  modulo della stanza.
- **La divisione ha due mucchi con due regole opposte** (§14). I sorgenti
  stanno in `src/`, incollati nell'ordine di `build.js`: non sono moduli,
  condividono un ambito solo. Gli **hook** (`7*-usa-*.jsx`) tengono lo stato e
  non disegnano; le **schede** (`8*-schede-*.jsx`) disegnano e non tengono
  stato. Dentro `80-app.jsx` resta quello che tocca i soldi: presenze, spese,
  sincronizzazione, conti. **Come si sposta un pezzo senza rischiare:**
  `node test/schermate-confronto.js prima.json`, si sposta, `… dopo.json`,
  `… prima.json dopo.json` — i due HTML devono essere identici al carattere.

Prima di rimettere mano all'interfaccia, `RICOGNIZIONE-UI.md`: i colori, i 127
bottoni e le misure di testo, già contati. È il materiale del §13, che è
**fatto**: i bottoni passano dal vocabolario (102 su 124, i 22 rimasti sono
censiti) e le misure di testo sono **sei**, dichiarate in `index.html` come
token di Tailwind v4 e chiamate per nome — `text-minuto`, `text-piccolo`,
`text-normale`, `text-medio`, `text-grande`, `text-titolo`. **Mai una misura
scritta a numero**: due prove lo vietano.
