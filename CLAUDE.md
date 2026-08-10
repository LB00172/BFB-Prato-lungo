# Istruzioni per Claude

Contesto in due righe: PWA per gestire e dividere le spese del campo della
Brigata Fabio Bandone a Prato Lungo (Pereto, AQ), 11–16 agosto 2026. Gira su
Vercel dal ramo `main`. La usano ~20 persone che in montagna vanno offline.

## Regole che non si negoziano

1. **Si parla italiano.** Chat, commenti nel codice, messaggi di commit,
   testi nell'interfaccia: tutto in italiano.
2. **`App.js` è generato. Non si tocca mai a mano.** Si modifica `App.jsx` e
   poi si lancia `node build.js`, che ricompila `App.js` e ricalcola
   `CACHE_NAME` in `sw.js` dall'hash del contenuto. Se salti il build, i
   telefoni restano con la versione vecchia in cache.
3. **Le password in chiaro non entrano nel repository.** In
   `firebase-config.js` ci stanno solo le impronte PBKDF2 (`salt`, `hash`,
   `iter`). La password vera si comunica in chat e basta.
4. **Prima di dire "fatto" gira `npm test`.** 50 prove, circa 8 minuti.
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
node build.js          # App.jsx -> App.js + CACHE_NAME in sw.js
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
| `App.jsx` | tutta l'app: interfaccia, conti, presenze, gioco. Fonte unica. |
| `App.js` | **generato**, non modificare |
| `sync-merge.js` | fusione voce per voce fra dispositivi (`rev`, `del`, orologio `hi`) |
| `firebase-sync.js` | trasporto verso Firestore, transazione e regola `sovrascrivibile` |
| `firebase-config.js` | chiavi Firebase e impronte delle password |
| `sw.js` | service worker, precache atomico |
| `build.js` | compilazione + versione della cache |
| `test/` | 5 prove unitarie + 45 end‑to‑end |

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
- **Importazione, ripristino di emergenza e chiusura del campo stanno in
  modalità tecnica.** Non modificano i dati: li RIMPIAZZANO, e si portano
  via i blocchi insieme al resto. Erano le ultime tre strade aperte a
  tutti. Esportare invece resta a chiunque: è di sola lettura.

## Prima del campo (entro il 10 agosto)

Un giro su un **iPhone** — tutte le prove girano solo su Chromium:
1. le strisciate del gioco (la L con un dito solo, senza staccare);
2. l'avviso arancione di memoria piena, che deve comparire e non far
   sparire l'app;
3. l'installazione a Home e l'avvio a schermo intero;
4. **che il service worker si aggiorni davvero**: riaprendo l'app deve
   arrivare la versione nuova, altrimenti il meteo continua a guardare
   Pereto invece del prato.

## Se al campo qualcosa non torna

Impostazioni → Backup Dati → **Esporta**: produce il JSON completo dello
stato. È il modo di guardare i dati veri invece di ipotizzare — Firestore
da qui non si vede, e l'export funziona anche senza linea.

## Dopo il campo (da settembre)

Spezzare `App.jsx` in più file, notifiche push (FCM + Cloud Functions, piano
Blaze), ponte Menù → Lista della spesa, coda persistente delle foto su
IndexedDB. E, **dopo il backend e non prima**, la lettura degli scontrini con
l'IA — una funzione sola, con la regola che l'IA propone e l'uomo conferma, e
l'app funziona identica se l'IA non risponde mai (`ROADMAP.md` §5). E l'area
Checklist, una condivisa e una privata — dove "privata" non può essere una
spunta su una voce condivisa, perché lo stato viaggia interi su ogni telefono e
finisce nell'export (`ROADMAP.md` §6).

Prima di rimettere mano all'interfaccia, `RICOGNIZIONE-UI.md`: i colori, i 127
bottoni e le undici misure di testo, contati. Vedi `ROADMAP.md`.
