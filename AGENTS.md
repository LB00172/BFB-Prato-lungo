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

Si modificano i sorgenti in `src/`, poi si lancia `node build.js`, che li
**incolla nell'ordine elencato in `build.js`** e ricompila `App.js` con Babel.
Una correzione scritta in `App.js` viene cancellata al build successivo.

I file di `src/` **non sono moduli**: niente `import`/`export`, condividono un
unico ambito. Per questo l'ordine conta — una costante va dichiarata prima di
chi la usa — e per questo un file nuovo va aggiunto all'elenco in `build.js`,
altrimenti `build.js` si ferma e `unita/compilazione` diventa rossa.

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
- **Le foto degli scontrini non stanno in `localStorage`.** Stanno in IndexedDB
  (`magazzino-foto.js`) e arrivano in modo **asincrono**, dopo il primo
  disegno. Non è un'astrazione di troppo: in `localStorage` occupavano 3,18 MB
  dei ~5 disponibili mentre i conti ne pesavano 35 KB, e riscriverle costava
  53 ms di thread bloccato a ogni scatto. `cambusa_receipts` resta come rete di
  sicurezza per i browser che il magazzino non lo concedono, e la migrazione
  cancella la chiave vecchia **solo dopo** aver riletto ogni foto identica.
- **Italiano nel codice, ma non per sempre nell'interfaccia.** I testi che
  legge l'utente diventano traducibili (`ROADMAP.md` §18): spagnolo e francese
  per primi. Commenti, commit e nomi restano italiani.
- **In `firebase-config.js` non ci sono password in chiaro**: ci sono impronte
  PBKDF2 (`salt`, `hash`, `iter`). Non è un segreto trapelato. Le chiavi
  Firebase di un'app web sono pubbliche per progetto: stanno nel sorgente che
  arriva su ogni telefono, e la protezione vera sono le regole Firestore.
- **Le regole Firestore a utente condiviso sono il modello scelto** per un campo
  solo. L'isolamento fra campi diversi è previsto per la versione pubblica —
  vedi `ROADMAP.md`, non è una svista.
- **`FEATURES.auth` è spenta di proposito, e l'account non è un muro.** Il § 1
  della roadmap è scritto e provato (`auth.js` per le regole,
  `src/78-usa-account.jsx` per lo stato, la tessera in Impostazioni), ma
  l'interruttore resta spento finché i provider non sono accesi nella console
  Firebase — cosa che dal codice non si vede. Soprattutto: **entrare in un
  campo col codice, segnare presenze e registrare spese si può senza account**,
  da tutti e quattro gli stati. Non è una dimenticanza da stringere: è la nota
  di prodotto del § 1, e due prove la sorvegliano. Metà del gruppo, in
  montagna, il primo giorno, non si registra — non c'è linea e non ne ha
  voglia.
- **Tre codici d'errore di Firebase danno lo stesso messaggio.**
  `user-not-found`, `wrong-password` e `invalid-credential` diventano tutti
  «credenziali sbagliate». Non è pigrizia nella traduzione: distinguerli
  permette di scoprire chi è iscritto, un indirizzo alla volta.
- **`src/80-app.jsx` è ancora un file da ~3.300 righe.** Lo sappiamo: era un
  file solo da 8.080. Il disegno delle schede è uscito in `src/8*-schede-*.jsx`,
  lo stato sta uscendo in `src/7*-usa-*.jsx` (`usaGioco`, `usaGalleria`,
  `usaScontrini`) e i conti sono in `conti.js`. Quello che resta dentro è
  presenze, spese e sincronizzazione, e si sposta con le stesse prove — non
  tagliando righe. Non è una scoperta, è la voce §14 di `ROADMAP.md`.
- **Le regole stanno fuori da `src/`: `conti.js` (i conti), `presenze.js`
  (giorno, pasto, blocco, orfane), `allarmi.js` (quando svegliare qualcuno),
  `lingue.js` (dizionario, plurali, date).** Non e' un vezzo di
  organizzazione: e' l'unica parte dell'app che maneggia i soldi di venti
  persone, ed e' una funzione pura di sei cose. Da li' si prova con una prova
  unitaria sui numeri veri del campo 2026 (`test/fixture/campo-2026.json`)
  invece che leggendo cifre a schermo in un browser. Chi ci mette mano deve
  farle restare pure: niente `localStorage`, niente React, niente variabili
  globali di configurazione — quelle si passano. Vale anche per il registro
  degli ex membri, che vive in `localStorage` e infatti a `Presenze.orfane` si
  passa da fuori.
- **Gli hook non disegnano, le schede non tengono stato.** Non è uno stile: un
  hook che restituisce JSX diventa un componente, e un componente aggiunge un
  confine di riconciliazione — cambia QUANDO le cose si ridisegnano. Le due
  regole sono controllate da `test/unita/compilazione.js`.
- **Le schede non sono componenti React.** Sono funzioni che restituiscono JSX
  e ricevono le dipendenze in un oggetto. È voluto: nessun confine di
  riconciliazione nuovo, nessun hook spostato, l'albero prodotto è identico.
  "Convertirle in componenti" è un cambio di comportamento, non una pulizia.

## Vincoli non negoziabili

- **Offline-first.** L'app deve funzionare senza rete. Niente nuove dipendenze
  di rete a runtime, niente script di terze parti, niente CDN aggiuntivi,
  niente telemetria.
- **Italiano** nel codice, nei commenti e nei messaggi di commit. Per
  l'interfaccia si scrive in italiano, ma passando da `lingue.js`: `L.t()`,
  `frase()` (o `fraseVestita()` se il grassetto ha un colore), `L.data()`.
  **Nessun `'it-IT'` scritto a mano** — ce n'erano 32 sparsi in otto file,
  adesso sono zero e c'e' una prova che li conta. Tutti e diciannove i
  sorgenti passano dal dizionario (791 chiavi) e `FEATURES.lingue` e'
  **accesa**: l'italiano resta predefinito, e quello che scrive l'utente non
  si traduce mai. I file non possono tornare indietro: una prova conta i testi
  scritti a mano in ognuno (`node test/censimento-testi.js`) e diventa rossa
  se ne compare uno nuovo.
- **Una costante valutata al caricamento congela la lingua.** I sorgenti di
  `src/` girano prima che `App()` assegni `L`. Una tabella di nomi costruita
  a modulo (`const X = { a: 'Membri' }`) resterebbe nella lingua del momento:
  le tabelle tengono le chiavi, il nome si chiede al disegno.
- **I file puri restituiscono chiavi, non frasi.** `conti.js` dice
  `'buchi.ciboComune'`, non la frase: non sa in che lingua verra' letto. Un
  refuso li' finisce a schermo cosi' com'e' (il ripiego di `t()` lo mostra
  apposta), e una prova unitaria chiede che ogni chiave scritta esista.
- **Nessun `localStorage.setItem` fuori da `salvaLocale`.** Un'eccezione dentro
  un `useEffect` smonta React e l'app sparisce. E niente immagini là dentro:
  quelle vanno nel magazzino.
- **Si scrive su Firestore solo dentro `runTransaction`**, passando da
  `sovrascrivibile()`. Firestore rigioca le scritture messe in coda offline: un
  `setDoc` cieco cancella il lavoro di chi era online.

## Come si prova

```
node build.js          # src/*.jsx -> App.js + CACHE_NAME
npm test               # tutte e 72 (~10 min)
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
