# Istruzioni per Claude

Contesto in due righe: PWA per gestire e dividere le spese del campo della
Brigata Fabio Bandone a Prato Lungo (Pereto, AQ), 11–16 agosto 2026. Gira su
Vercel dal ramo `main`. La usano ~20 persone che in montagna vanno offline.

## Regole che non si negoziano

1. **Si parla italiano.** Chat, commenti nel codice, messaggi di commit:
   tutto in italiano, e questo non cambia. I **testi che legge l'utente** sono
   l'eccezione decisa ad agosto 2026 (`ROADMAP.md` §18): si scrivono in
   italiano per primi, ma passano da un dizionario perché l'app parlerà anche
   spagnolo e francese.
2. **`App.js` è generato. Non si tocca mai a mano.** Si modificano i sorgenti
   in `src/` e poi si lancia `node build.js`, che li incolla nell'ordine
   dichiarato, ricompila `App.js` e ricalcola `CACHE_NAME` in `sw.js` dall'hash
   del contenuto. Se salti il build, i telefoni restano con la versione vecchia
   in cache.
3. **Le password in chiaro non entrano nel repository.** In
   `firebase-config.js` ci stanno solo le impronte PBKDF2 (`salt`, `hash`,
   `iter`). La password vera si comunica in chat e basta.
4. **Prima di dire "fatto" gira `npm test`.** 62 prove, circa 9 minuti.
   Verde o non è finito.
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
npm test               # tutto (~8 min)
npm test unita         # solo le prove che non aprono il browser (~10 s)
npm test contabilita   # filtro sul nome della prova
```

Le prove e2e usano `playwright-core` con il Chromium già installato e un
server statico sulla porta 8091. Se salta fuori `EADDRINUSE`, è rimasto un
`node test/esegui.js` appeso: va ucciso.

## Com'è fatto

| File | Cosa contiene |
| --- | --- |
| `src/*.jsx` | i sorgenti, incollati **nell'ordine elencato in `build.js`**. I numeri vanno di dieci in dieci per poter infilare pezzi in mezzo |
| `src/80-app.jsx` | `function App()`: stato, sincronizzazione, conti, gestori |
| `src/8*-schede-*.jsx` | il **disegno** delle schede, uscito da `App()`. Non sono componenti React: sono funzioni che restituiscono JSX e ricevono le dipendenze in un oggetto |
| `src/50-interfaccia.jsx` | vocabolario dei bottoni: `bottone`, `bottoneIcona`, `bottoneRiga` |
| `src/60-gioco.jsx` | "Aiuta Bandy": tavolozze, disegno, `BandyGame`. Non tocca i conti |
| `App.js` | **generato**, non modificare |
| `sync-merge.js` | fusione voce per voce fra dispositivi (`rev`, `del`, orologio `hi`) |
| `menu-spesa.js` | dal menù del giorno alle voci della spesa. Sta fuori da `src/` perché così è provabile con una prova unitaria invece di duplicare la logica nel test |
| `magazzino-foto.js` | dove stanno le foto degli scontrini: IndexedDB, con `localStorage` come rete di sicurezza. Fuori da `src/` per lo stesso motivo |
| `firebase-sync.js` | trasporto verso Firestore, transazione e regola `sovrascrivibile` |
| `firebase-config.js` | chiavi Firebase e impronte delle password |
| `sw.js` | service worker, precache atomico |
| `build.js` | compilazione + versione della cache |
| `test/` | 8 prove unitarie + 54 end‑to‑end |

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
  un membro tocca 7 percorsi: sembrano 7 perdite e non lo sono.
- **Prima si aggiorna la storia della sincronizzazione, poi l'istantanea
  locale.** All'inverso, con lo spazio agli sgoccioli, l'istantanea si mangia
  i byte che servivano alla storia.
- **I dati veri correggono i piani, e vanno guardati prima di scrivere.** Il
  ponte Menù → Lista prevedeva una tabella di ingredienti: i menù del campo 2026
  hanno mostrato che la gente scrive già gli ingredienti con le quantità, e che
  la scheda «Da acquistare» era vuota perché nessuno scrive due volte. La
  tabella non è servita. Lo stesso è capitato al §11, sopravvalutato finché non
  ho letto `firebase-sync.js` riga per riga.
- **Le foto degli scontrini NON sono in `localStorage`.** Stanno nel magazzino
  (`magazzino-foto.js`, IndexedDB) e arrivano **dopo** il primo disegno. Chi
  scrive un effetto che le guarda deve metterle fra le dipendenze, altrimenti
  al primo giro non c'è ancora niente: è così che la potatura delle foto
  orfane era smessa di funzionare senza che si vedesse.
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

- **La velocità del gioco non si tocca.** `BASE_STEP`, `LEVEL_SPEEDUP` e
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
  l'aggiornamento del service worker arriva. Le 57 prove girano comunque solo
  su Chromium, quindi quel giro va rifatto ogni volta che si tocca `sw.js` o
  `build.js` — sono i due file che decidono se un rilascio arriva o resta in
  cache. Si comincia invece dalle immagini fuori da `localStorage` (§19): nel
  campo 2026 gli scontrini occupavano 3,18 MB dei 5 disponibili, e i dati che
  contano ne pesano 35 KB.
- **Login e room vengono prima di quasi tutto** (§1 e §2): senza un `uid` non
  esistono la checklist privata, la chiave dell'IA, le voci spegnibili né il
  modulo della stanza.
- **La divisione è fatta per il disegno, non per la logica** (§14). I sorgenti
  stanno in `src/`, incollati nell'ordine di `build.js`: non sono moduli,
  condividono un ambito solo. Il disegno delle quattordici schede è uscito da
  `App()` in sei file; dentro `80-app.jsx` restano stato, effetti, conti e
  gestori. **Come si sposta un pezzo senza rischiare:** si cattura il DOM di
  tutte le schermate con `test/lib/schermate.js`, si sposta, si ricattura, e i
  due HTML devono essere identici al carattere. È così che è stata dimostrata.

Prima di rimettere mano all'interfaccia, `RICOGNIZIONE-UI.md`: i colori, i 127
bottoni e le undici misure di testo, già contati. È il materiale del §13.
