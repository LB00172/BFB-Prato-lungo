# BFB-Prato-lungo

PWA gestionale per le spese e l'organizzazione del campo della Brigata Fabio
Bandone. Registra presenze e acquisti, **calcola quanto deve pagare ogni
persona** e chi rimborsa chi. Progettata per funzionare **online in fase di
preparazione** e **offline al campo**, dove non c'è linea.

> Evoluzione in versione pubblica/neutra (login, room, Play Store, analisi di
> mercato): vedi **[ROADMAP.md](ROADMAP.md)**. Nulla di quello va toccato prima
> del campo di agosto 2026.

## Cosa fa

| Area | A cosa serve |
|---|---|
| **Calendario** | Meteo previsto del giorno (Pereto, AQ), riepilogo cucina (quanti pasti preparare), giorni del conto separato |
| **Menù** | Cosa si mangia, giorno per giorno, su foglio a righe; condivide il giorno scelto con il Calendario |
| **Membri** | Elenco partecipanti; i bambini mangiano gratis; la "i" accanto al nome apre PayPal e IBAN per farsi rimborsare |
| **Presenze** | Chi c'è a pranzo/cena, con "Tutti a pranzo/cena" e "Copia da ieri" |
| **Lista della Spesa** | Ogni acquisto: nome, acquirente, prezzo, tipologia, foto scontrino; ricerca e correzione delle voci registrate |
| **Aggiunta Attrezzatura** | Attrezzatura da comprare con prezzo; se spuntata entra nelle spese |
| **Spese Totali** | Totali · Quote · Saldi (chi paga chi + condividi resoconto) · Dati (backup) |
| **Dotazioni personali** | Dotazione base fissa + aggiunte per il campo |
| **Galleria** | L'album del campo, da riempire al ritorno: foto a nome di un membro, con un tetto per persona |
| **Impostazioni** | Pronto per il campo, tema chiaro/scuro/automatico, blocco con password, dati locali, versione |
| **Archivio** | Campi chiusi: resoconto, dati scaricabili, eliminazione |
| **Come funziona** | Guida interna all'app |

## Come vengono ripartite le spese

- **Cibo e bevande** → divisi per il numero di **pasti** degli adulti: ognuno
  paga `pasti fatti × quota pasto`. Chi mangia di più paga di più.
- **Logistica e attrezzatura acquistata** → **quota fissa uguale** per ogni
  adulto presente: nessuno paga più di una quota.
- **Bambini**: gratis, il loro costo è ripartito sugli adulti.
- **Conto separato** (facoltativo): in Calendario si spuntano i giorni che fanno
  cassa a parte, e in fase di registrazione una spesa di cibo/bevande si può
  mettere sul "conto separato". Quella spesa si divide solo sui pasti dei giorni
  spuntati, e quei pasti **escono dal divisore comune**, così chi c'era non paga
  due volte. Logistica e attrezzatura restano sempre comuni. Senza giorni
  spuntati il comportamento è identico a prima.
- Le quote sono arrotondate a **0,10 €** (niente monetine da 1/2/5 cent); lo
  scarto viene riconciliato solo se ≥ 0,50 €.
- **Saldi**: per ogni persona `anticipato − dovuto` → "riceve" o "dà", più le
  transazioni di pareggio ("chi paga chi") col minor numero di passaggi.
- **Come farsi rimborsare**: ogni membro può lasciare **PayPal** e **IBAN**
  (Membri → "i" accanto al nome, entrambi facoltativi). Compaiono in
  *Saldi → chi paga chi*, sotto il passaggio da fare, con il tasto **copia**;
  spariscono quando il rimborso viene segnato come saldato. L'IBAN è
  verificato con il controllo standard mod-97: se manca o è sbagliato un
  carattere l'app lo dice subito, invece di scoprirlo col bonifico che torna
  indietro. Non finiscono nel messaggio di "Condividi resoconto": restano
  dentro l'app, non nel gruppo WhatsApp. Alla chiusura del campo si azzerano
  insieme ai membri.
- **Acquirente**: si sceglie dalla tendina dei membri, non si scrive. Gli
  abbinamenti dei saldi avvengono per nome, quindi un refuso creerebbe una
  persona fantasma; se una spesa risulta intestata a un nome che non è (più)
  fra i membri, i Saldi lo segnalano.

## Dati, offline e sincronizzazione

- Tutto è salvato in `localStorage` sul dispositivo: l'app funziona **senza
  linea**, sempre.
- Con la linea i dati si sincronizzano da soli tra i dispositivi via
  **Firestore** (documento condiviso `camps/<codice campo>` + sotto-collezioni
  per foto scontrini e snapshot). La connessione è **automatica** all'avvio.
- Offline le modifiche restano in coda e partono da sole al ritorno della rete.
- **Meteo**: previsioni di [Open-Meteo](https://open-meteo.com) (gratuito, senza
  chiave), 16 giorni, fuso orario della località. Sono **una sola copia per
  tutto il campo**: chi ha linea le scarica e le pubblica in
  `camps/<codice>/meta/weather`, gli altri le ricevono e le adottano se più
  recenti delle proprie. Nel Calendario si vede l'ora dello scaricamento e c'è
  un tasto Aggiorna. Prima ogni telefono scaricava per conto suo e si vedevano
  numeri diversi.
- **Fusione, non sovrascrittura** (`sync-merge.js`): ogni voce porta con sé la
  data della sua ultima modifica (o cancellazione). Quando due dispositivi che
  hanno lavorato **offline** tornano online, le due versioni si uniscono voce
  per voce — voci nuove da entrambe le parti, sulla stessa voce vince la
  modifica più recente, le cancellazioni non fanno "resuscitare" nulla. La
  regola è identica sui due dispositivi, quindi la sincronizzazione converge
  senza rimbalzi. Senza questo, al campo (dove non c'è linea) il secondo
  telefono che si agganciava cancellava il lavoro del primo.
- **Galleria**: è l'unica parte dell'app che **vive solo nel cloud** e ha
  bisogno della linea, di proposito. Cento foto in `localStorage` (tetto ~5 MB)
  romperebbero il salvataggio di *tutto*, presenze e spese comprese; e al campo
  non c'è linea, quindi l'album si riempie al ritorno. Ogni foto sta in due
  documenti: la **miniatura** (~6 KB, in `camps/<codice>/photos`) che riempie la
  griglia, e l'**originale** (~160 KB, in `camps/<codice>/photofull`) che si
  scarica solo quando apri la foto. Cento foto = ~600 KB di miniature invece di
  16 MB: è ciò che rende l'album sfogliabile da telefono. Le miniature si
  ascoltano **solo mentre la Galleria è aperta**.
  Il tetto di foto per persona (7 di serie, si cambia in Impostazioni) è un
  **accordo di gruppo, non un lucchetto**: il nome si sceglie da una tendina e
  nessuno verifica chi sei. Serve a far scegliere le foto belle.
  Alla **chiusura del campo** le foto non si cancellano: vengono **timbrate**
  con l'archivio e restano consultabili da *Archivio → Album*, mentre la
  galleria del campo nuovo riparte vuota.
- **Snapshot giornaliero** automatico + "Ripristino di emergenza" nella scheda
  Dati. In più, backup manuale **Esporta/Importa** su file JSON.
- **Chiusura del campo** (Spese Totali → Dati): archivia tutto (file scaricato
  con le foto + copia nel cloud in `camps/<codice>/archives/<id>`), poi azzera
  membri, presenze, spese, lista, attrezzatura, dotazioni aggiuntive e
  scontrini su tutti i dispositivi. L'app resta pronta per l'evento successivo
  e i campi chiusi restano consultabili in **Archivio**.
- Le librerie (React, Tailwind) e i font sono **self-hosted** in `vendor/`:
  nessuna dipendenza da CDN esterni.

## Sicurezza: cosa protegge cosa

| | Protetto da | Note |
|---|---|---|
| Aprire l'app | **Blocco con password** (`window.APP_LOCK` in `firebase-config.js`) | Impronta PBKDF2-SHA256, 200.000 giri, con sale: nel codice **non** c'è la password in chiaro. Attesa progressiva dopo 5 tentativi sbagliati. Gira sul telefono, quindi è una barriera, non una cassaforte |
| Dati sul telefono | `localStorage` del browser + blocco dell'app | Chi ha il telefono sbloccato e sa aprire gli strumenti da sviluppatore li legge: la difesa vera è il codice di sblocco del telefono |
| **Dati nel cloud** | **Regole di Firestore** + utente condiviso | L'app entra nel database con un **utente unico e invisibile** (`APP_LOCK.dbEmail`), usando la password digitata al blocco. Finché quell'utente non esiste in Firebase, l'app ricade sull'accesso anonimo di prima ⚠️ |

**Utente condiviso: come attivarlo** (10 minuti nella console Firebase). Il
codice è già pronto e aspetta solo che l'utente esista: fino ad allora tutto
funziona come prima, quindi non c'è fretta e non si rompe niente.

1. Authentication → Sign-in method → abilita **Email/Password**.
2. Authentication → Users → **Add user**: email `campo@brigatabandone.it`
   (la stessa scritta in `firebase-config.js` come `dbEmail`), password
   **quella del campo**. Nessuno la digiterà: la usa l'app.
3. Verifica dal tuo telefono: Impostazioni → Blocco con password, la riga
   *Database* deve passare a **protetto dalla password**.
4. Solo allora stringi le Regole Firestore: copia il contenuto di
   **[`firestore.rules`](firestore.rules)** e incollalo in Firestore Database →
   scheda *Regole* → sostituisci tutto → *Pubblica*.

5. Authentication → Sign-in method → **disabilita Anonimo**.

Da quel momento senza password non si leggono i dati nemmeno interrogando
Firestore direttamente. Costo: la **prima** apertura su ogni dispositivo
richiede la linea; poi la sessione Firebase resta valida anche offline.

**Gli altri partecipanti non devono fare nulla.** Quando a un telefono serve la
password per entrare nel database (tipico di chi era già sbloccato da prima),
è l'app a chiederla da sola, con la solita schermata di blocco e una riga che
spiega perché. Nessun menu da cercare, nessun account da creare: l'utente del
database è uno solo, condiviso e invisibile.

Altre accortezze utili, senza scrivere codice:

- La password va nel gruppo del campo e da nessun'altra parte: se gira troppo,
  si rigenera l'impronta e si cambia (istruzioni in `firebase-config.js`).
- Il **file di archivio** creato alla chiusura contiene tutto, foto degli
  scontrini comprese: conservalo dove conservi i documenti, non in una cartella
  condivisa.
- Gli scontrini fotografati possono mostrare dati della carta: se si vedono,
  meglio inquadrare solo la parte degli importi.
- Le foto della **Galleria** stanno nello stesso database: le vede chi ha la
  password. Sono facce di persone, quindi vale la stessa cautela dei conti — la
  password non esce dal gruppo.
- La classifica del minigioco contiene i nomi dei giocatori: sta nello stesso
  database, quindi valgono le stesse considerazioni.

### Configurazione Firebase

Le impostazioni stanno in **`firebase-config.js`**: config del progetto
Firestore, codice campo predefinito, località per il meteo, branding e feature
flag. L'`apiKey` di Firebase non è un segreto (è un identificatore pubblico
lato client): la sicurezza è data dalle Regole di Firestore.

Le regole del database stanno in **`firestore.rules`**, pronte da incollare
nella console (Firestore Database → Regole → Pubblica). Richiedono l'accesso
**Email/Password** abilitato in Firebase Authentication e l'utente condiviso
creato; l'accesso **Anonimo** va disabilitato solo dopo che tutti i telefoni
risultano "protetti dalla password".

## Struttura del progetto

| File | Ruolo |
|---|---|
| `App.jsx` | **Sorgente** dell'app (React + JSX). *Questo è il file da modificare.* |
| `App.js` | Versione **compilata** di `App.jsx`, caricata dal browser. Generato: non modificare a mano. |
| `index.html` | Pagina principale, registrazione service worker |
| `sw.js` | Service worker (cache offline). `CACHE_NAME` è rigenerato dalla build |
| `firebase-config.js` | Configurazione: Firebase, campo, meteo, branding, feature flag |
| `firebase-sync.js` | Sincronizzazione cloud (`window.CloudSync`), caricata solo online |
| `sync-merge.js` | Fusione degli stati fra dispositivi (`window.SyncMerge`), usata dalla sincronizzazione |
| `firestore.rules` | Regole di sicurezza del database, da incollare nella console Firebase |
| `build.js` | Compila `App.jsx` → `App.js` e aggiorna `CACHE_NAME` |
| `test/` | Verifiche automatiche (`npm test`). Escluse dal deploy |
| `vendor/` | React, Tailwind e font self-hosted |

## Sviluppo

```bash
npm install      # una volta
npm run build    # App.jsx -> App.js + nuovo CACHE_NAME
npm test         # 28 prove automatiche (~6 min); "npm test unita" per le veloci
```

Le verifiche stanno in **[`test/`](test/README.md)**: 384 controlli sui conti,
32 sulla fusione fra dispositivi, più le prove che pilotano l'app vera in un
browser. `npm test` fallisce con codice diverso da zero se qualcosa si rompe.
Da lanciare **prima di ogni push** che tocchi i calcoli o la sincronizzazione.

`build.js` calcola `CACHE_NAME` dall'hash dei file: ogni build con modifiche
invalida la vecchia cache, e l'app installata **si aggiorna da sola** (ricarica
una volta all'arrivo del nuovo service worker). Non serve più cambiare la
versione a mano.

Deploy: push su `main` → Vercel pubblica in automatico
(`vercel.json` serve i file statici già compilati, senza build server-side).
