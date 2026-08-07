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

## Dopo il campo (da settembre)

Spezzare `App.jsx` in più file, notifiche push (FCM + Cloud Functions, piano
Blaze), ponte Menù → Lista della spesa, coda persistente delle foto su
IndexedDB. Vedi `ROADMAP.md`.
