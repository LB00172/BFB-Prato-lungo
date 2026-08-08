# Istruzioni per chi analizza o modifica questo repository

Per strumenti e assistenti esterni (Base44, Codex, Cursor, revisori automatici).
Contiene solo quello che **dal codice non si vede** — le cose che, ignorandole,
portano a conclusioni sbagliate. Le regole di lavoro quotidiane stanno in
`CLAUDE.md`.

PWA per dividere le spese di un campeggio. ~20 persone, in montagna, spesso
**senza linea**. Gira su Vercel dal ramo `main`.

## Le tre cose che fanno sbagliare diagnosi

**1. Il repository È il sito. Non c'è nessun build in produzione.**

```json
// vercel.json
{ "framework": null, "installCommand": "", "buildCommand": "", "outputDirectory": "." }
```

Ogni file versionato viene servito così com'è. `index.html` fa
`<script src="App.js">`.

Conseguenza: **`App.js` DEVE stare nel repository.** Metterlo in `.gitignore`
— suggerimento sensato in qualunque progetto React normale — qui spegne
l'applicazione per tutti al primo deploy.

**2. `App.js` è generato. Non si modifica a mano.**

Si modifica `App.jsx`, poi si lancia `node build.js`, che ricompila `App.js`
con Babel. Una correzione scritta in `App.js` viene cancellata al build
successivo.

**3. Dopo ogni modifica a un file precacheato, `node build.js` è obbligatorio.**

`build.js` ricalcola `CACHE_NAME` in `sw.js` dall'hash del contenuto di:

```
App.js  index.html  manifest.json  firebase-config.js
sync-merge.js  pdf-ricordo.js  firebase-sync.js
vendor/tailwind.js  vendor/fonts.css
```

Il service worker serve **cache-first**. Se cambi uno di quei file e non
rigeneri `CACHE_NAME`, la modifica è in produzione ma **i telefoni continuano a
servire la versione vecchia dalla cache**: il codice è corretto e non lo riceve
nessuno. È già successo.

## Scelte deliberate che sembrano difetti

Segnalarle come bug fa perdere tempo; "correggerle" fa danno.

- **Il precache è atomico.** `cache.addAll()` è tutto-o-niente di proposito: un
  precache parziale lascia i telefoni con un misto di file vecchi e nuovi, che
  qui è peggio del non aggiornarsi. Un asset mancante non arriva mai in
  produzione perché `test/unita/compilazione.js` confronta ogni file con
  l'elenco del precache. Sostituirlo con `Promise.allSettled` **toglie** una
  garanzia.
- **`window.confirm` sincrono è voluto** sulle azioni distruttive. Un modale
  asincrono su "elimino questo membro?" è più facile da sbagliare, e a venti
  persone in un campo un dialogo nativo non sfugge.
- **Le chiavi `localStorage` con prefisso `cambusa_*` sono un contratto**, non
  un residuo estetico. Rinominarle fa perdere i dati a ogni telefono che non
  migra: è una migrazione con codice di compatibilità, non una rinomina.
- **In `firebase-config.js` non ci sono password in chiaro**: ci sono impronte
  PBKDF2 (`salt`, `hash`, `iter`). Non è un segreto trapelato. Le chiavi
  Firebase di un'app web sono pubbliche per progetto: stanno nel sorgente che
  arriva su ogni telefono, e la protezione vera sono le regole Firestore.
- **Le regole Firestore a utente condiviso sono il modello scelto** per un campo
  solo. L'isolamento fra campi diversi è previsto per la versione pubblica —
  vedi `ROADMAP.md`, non è una svista.
- **`App.jsx` è un file unico da ~7.700 righe.** Lo sappiamo; spezzarlo è la
  prima voce del dopo-campo. Non è una scoperta.

## Vincoli non negoziabili

- **Offline-first.** L'app deve funzionare senza rete. Niente nuove dipendenze
  di rete a runtime, niente script di terze parti, niente CDN aggiuntivi,
  niente telemetria.
- **Italiano.** Interfaccia, commenti nel codice, messaggi di commit.
- **Nessun `localStorage.setItem` fuori da `salvaLocale`.** Un'eccezione dentro
  un `useEffect` smonta React e l'app sparisce.
- **Si scrive su Firestore solo dentro `runTransaction`**, passando da
  `sovrascrivibile()`. Firestore rigioca le scritture messe in coda offline: un
  `setDoc` cieco cancella il lavoro di chi era online.

## Come si prova

```
node build.js          # App.jsx -> App.js + CACHE_NAME
npm test               # tutto (~10 min)
npm test unita         # solo quelle senza browser (~10 s)
```

Le prove e2e usano `playwright-core` con Chromium e un server statico sulla
porta 8091. Se compare `EADDRINUSE`, è rimasto un `node test/esegui.js` appeso.

## Come consegnare il lavoro

**Meglio segnalare che spingere.** Una diagnosi verificata vale più di una
correzione non provata: chi conosce il progetto decide se e come applicarla.

Se invece modifichi e spingi, tutte e tre queste, in ordine:

1. `node build.js`
2. `npm test` — verde, senza eccezioni
3. commit con `App.js` e `sw.js` aggiornati inclusi

**Ogni correzione va accompagnata da una prova che sia stata vista fallire.**
Si sabota di proposito il codice che dovrebbe proteggere, si controlla che la
prova diventi rossa, si rimette a posto. Una prova che non sa fallire è peggio
di niente, perché rassicura a vuoto.

## Contesto temporale

Il campo è dall'11 al 16 agosto 2026. In quella finestra l'app è in uso reale e
offline: si accettano solo correzioni piccole, isolate e provate. Rifattorizzazioni,
rinomine e cambi di impianto si fanno da settembre (`ROADMAP.md`).
