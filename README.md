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
| **Calendario** | Meteo previsto del giorno (Pereto, AQ), riepilogo cucina (quanti pasti preparare), note libere del giorno, giorni del conto separato (riga richiudibile) |
| **Menù** | Cosa si mangia, giorno per giorno, su foglio a righe; condivide il giorno scelto con il Calendario |
| **Membri** | Elenco partecipanti; i bambini mangiano gratis; la "i" accanto al nome apre PayPal e IBAN per farsi rimborsare |
| **Presenze** | Chi c'è a pranzo/cena; "Tutti a pranzo/cena" e "Copia da ieri" stanno in una riga richiudibile ("Segna in blocco") e chiedono conferma; segnala le presenze rimaste senza padrone |
| **Lista della Spesa** | Ogni acquisto: nome, acquirente, prezzo, tipologia, foto scontrino; ricerca e correzione delle voci registrate |
| **Aggiunta Attrezzatura** | Attrezzatura da comprare con prezzo; se spuntata entra nelle spese |
| **Spese Totali** | Totali · Quote · Saldi (chi paga chi + condividi resoconto) · Dati (backup) |
| **Dotazioni personali** | Dotazione base fissa + aggiunte per il campo |
| **Galleria** | L'album del campo, da riempire al ritorno: si sfoglia come polaroid o si guarda a griglia; "Crea album ricordo" ne fa un PDF |
| **Impostazioni** | Pronto per il campo, tema chiaro/scuro/automatico, galleria, diagnostica sincronizzazione; in fondo, richiudibili, blocco con password e dati locali |
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
- **Orologio logico**: le date verrebbero dall'orologio di ogni telefono, e un
  telefono indietro perderebbe ogni confronto anche avendo ragione. Ogni
  dispositivo tiene perciò `hi`, la data più alta che ha mai visto, e non marca
  mai una modifica con una data inferiore: **una modifica fatta dopo aver visto
  qualcosa batte sempre quel qualcosa**, che è la proprietà che serve davvero.
  Le date oltre una settimana nel futuro non vengono adottate, così un telefono
  con l'ora sbagliata non trascina in avanti l'orologio di tutti. Il freno vale
  **solo** per l'orologio interno, mai per il confronto fra due voci: il
  confronto dipende solo dai dati, altrimenti due telefoni con "adesso" diverso
  deciderebbero in modo diverso e non convergerebbero più.
- **Dati senza cronologia** (telefono fermo a una versione vecchia dell'app) non
  vengono più presi per buoni: entrano nella fusione come voci "di data ignota",
  quindi qualsiasi modifica datata ha la precedenza e nulla viene cancellato.
  Prima qui si sovrascriveva tutto, e bastava un telefono rimasto indietro per
  riportare l'intero campo a giorni prima.
- **Scritture che non arrivano**: `lastPushedJson` si aggiorna **solo a
  scrittura riuscita**. Prima veniva segnato prima di scrivere, quindi una
  scrittura fallita (regole, quota, documento troppo grande) non veniva più
  ritentata: quei dati restavano su un telefono solo, in silenzio. Ora restano
  in sospeso e si ritentano da soli con attese crescenti (2s, 4s, 8s… fino a un
  minuto), al ritorno della linea e a un controllo ogni due minuti. Finché
  qualcosa è in sospeso, la spia in alto a destra dice **"Da inviare"**.
- **Foto e scontrini**: sono documenti a parte, non passano dalla fusione,
  quindi se il caricamento fallisce non c'è niente che rimedi — la foto resta
  sul telefono di chi l'ha scattata. Prima si perdevano in silenzio (un `catch`
  vuoto). Ora ogni foto entra in una **coda** che si svuota da sola, con attese
  crescenti, al ritorno della linea e al collegamento; la spia in alto dice
  quante ne mancano ("2 foto da inviare") e in *Impostazioni → Diagnostica*
  c'è "Riprova adesso".
- **Documento troppo grande**: sopra i 900 KB (il limite di Firestore è 1 MiB)
  la scrittura verrebbe rifiutata e la sincronizzazione si fermerebbe senza
  dirlo. Ora si avvisa prima.
- **Campo vuoto nel cloud**: se nel cloud non c'è ancora niente, chi ha dati in
  locale li pubblica. Senza, restavano fermi finché qualcuno non toccava
  qualcosa.
- **Memoria del telefono piena**: se la cronologia delle modifiche non si può
  più salvare, alla riapertura le modifiche di quel telefono risulterebbero
  "senza data" e perderebbero ogni confronto. Ora compare un avviso.
- **Registro delle modifiche** (Impostazioni, riga richiudibile): ogni
  cambiamento con **data e ora**, la sezione a cui appartiene, la voce in
  chiaro e se è stato fatto **qui** o è arrivato dalla **sincronizzazione**.
  Raggruppato per giorno, esportabile come file di testo, tenuto sul telefono
  (non si sincronizza) e limitato alle ultime 400 voci; battute ravvicinate
  sulla stessa voce si uniscono in una riga sola.
- **Galleria**: è l'unica parte dell'app che **vive solo nel cloud** e ha
  bisogno della linea, di proposito. Cento foto in `localStorage` (tetto ~5 MB)
  romperebbero il salvataggio di *tutto*, presenze e spese comprese; e al campo
  non c'è linea, quindi l'album si riempie al ritorno. Ogni foto sta in due
  documenti: la **miniatura** (~6 KB, in `camps/<codice>/photos`) che riempie la
  griglia, e l'**originale** (~160 KB, in `camps/<codice>/photofull`) che si
  scarica solo quando apri la foto. Cento foto = ~600 KB di miniature invece di
  16 MB: è ciò che rende l'album sfogliabile da telefono. Le miniature si
  ascoltano **solo mentre la Galleria è aperta**.
  Due modi di guardare le stesse foto, con un interruttore in cima: **Album**
  (quello d'ingresso) le mostra come polaroid inclinate su un paesaggio di
  montagna e si sfoglia in orizzontale con l'aggancio a pagina — una spinta col
  dito e il telefono ferma la pagina da solo, senza animazioni scritte a mano né
  pagine che si curvano; **Griglia** le mette tutte in fila, ed è la vista in cui
  si cerca, si sceglie e si cancella. Premendo "Crea album ricordo" si passa da
  soli in Griglia: sfogliando dodici pagine, selezionarne otto sarebbe un
  supplizio.
  **Album ricordo**: dalla Galleria si scelgono fino a **12 foto** e l'app ne fa
  un **PDF** con uno sfondo di montagna disegnato, quattro polaroid per pagina,
  titolo e motto del campo. Da telefono si apre la condivisione (si manda nel
  gruppo), altrimenti si scarica. Il generatore è `pdf-ricordo.js`, scritto a
  mano: il PDF incorpora i JPEG **così come sono** (`DCTDecode`) e usa i font
  standard, quindi non serve nessuna libreria — jsPDF avrebbe pesato ~350 KB nel
  precache di ogni telefono per una funzione che si usa una volta l'anno.
  Il tetto di foto per persona (4 di serie, si cambia in Impostazioni: 3/4/5/7) è un
  **accordo di gruppo, non un lucchetto**: il nome si sceglie da una tendina e
  nessuno verifica chi sei. Serve a far scegliere le foto belle.
  Alla **chiusura del campo** le foto non si cancellano: vengono **timbrate**
  con l'archivio e restano consultabili da *Archivio → Album*, mentre la
  galleria del campo nuovo riparte vuota.
- **Presenze senza padrone**: le presenze sono legate all'**id** del membro, non
  al nome. Chi viene eliminato dai Membri e poi riaggiunto prende un id nuovo, e
  i pasti segnati prima restano attaccati al vecchio: spariscono dall'elenco e
  dai conti in silenzio, pur avendo la lista dei membri apparentemente giusta.
  L'app se ne accorge e lo dice in **Presenze** (e con un avviso in Calendario),
  con il nome di chi erano — quando un membro viene eliminato il suo nome resta
  in un elenco a parte — e li fa **riassegnare** alla persona giusta con una
  tendina, oppure buttare. Riassegnando, i pasti si **sommano** a quelli già
  segnati: non si sovrascrive niente.
- **Freno di sicurezza sulle cancellazioni**: una fusione può togliere voci solo
  se dall'altra parte c'è una cancellazione datata. È legittimo (qualcuno ha
  cancellato una spesa), ma è anche il modo in cui un ripristino, un'importazione
  o un "Copia da ieri" cancellano il lavoro di tutti. Prima di applicare una
  sincronizzazione che toglie voci, l'app mette da parte una **copia di scorta**
  locale; se le voci perse sono almeno tre compare un avviso in cima con
  **"Annulla la sincronizzazione"**, che rimette lo stato di prima e lo
  ripubblica su tutti i dispositivi (le voci che tornano vengono ridatate, quindi
  vincono sulle cancellazioni che le avevano tolte). La copia resta comunque
  disponibile in *Impostazioni → Diagnostica sincronizzazione*.
- **Diagnostica sincronizzazione** (Impostazioni): quante voci sono datate,
  quante cancellazioni sono registrate e **le ultime dodici, tradotte in
  italiano con data e ora** ("presenza di Bruno — mer 13 ago, cancellata il 3
  ago alle 14:12"). Tante cancellazioni tutte allo stesso minuto sono la firma
  di un ripristino, di un'importazione o di un "Copia da ieri".
- **"Copia da ieri"** sovrascrive le presenze del giorno ma **non cancella** chi
  ieri non c'era: lo lascia in elenco azzerato. Toglierlo genererebbe una lapide
  che cancella quella presenza su *tutti* i telefoni, anche se qualcun altro
  l'aveva appena segnata.
- **Copie di sicurezza, tre strati**:
  1. **Sul telefono, automatiche**: una copia dello stato al giorno, scattata al
     primo utilizzo (quindi contiene la situazione *prima* dei pasticci di
     oggi), ultimi 7 giorni, senza foto. Si fanno **anche in modalità aereo**:
     è ciò che rende il **"Ripristino di emergenza" utilizzabile al campo**.
     Prima gli snapshot stavano solo su Firestore e il ripristino rispondeva
     "serve la connessione": nei giorni che contano non esisteva alcuna rete.
  2. **Nel cloud, automatiche**: snapshot giornaliero in
     `camps/<codice>/snapshots/<data>`, ultimi 10 giorni, quando c'è linea.
  3. **Su file, a mano**: *Esporta/Importa* JSON (foto comprese). È l'unica che
     sopravvive a un telefono perso, rotto o svuotato, e richiede un gesto umano
     perché il browser non può scrivere un file senza conferma. Per questo, nei
     **giorni del campo**, dopo le 20 compare un promemoria — ma **solo se quel
     giorno sono state fatte davvero delle modifiche su quel telefono**: se non
     hai toccato niente, non c'è niente da salvare e non compare nulla.
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
| `pdf-ricordo.js` | Generatore del PDF "foto ricordo" (`window.PdfRicordo`), senza librerie |
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
