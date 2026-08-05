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
  `hi` viene **salvato sul telefono e spedito insieme ai dati**: prima si
  azzerava a ogni riapertura dell'app, e un telefono con l'ora indietro tornava
  a marcare le proprie modifiche con date vecchie: l'orologio logico esisteva
  solo finché l'app restava aperta.
- **Dati senza cronologia** (telefono fermo a una versione vecchia dell'app) non
  vengono più presi per buoni: entrano nella fusione come voci "di data ignota",
  quindi qualsiasi modifica datata ha la precedenza e nulla viene cancellato.
  Prima qui si sovrascriveva tutto, e bastava un telefono rimasto indietro per
  riportare l'intero campo a giorni prima.
- **Niente sovrascritture alla cieca**: la fusione girava solo in *lettura*. In
  scrittura si faceva `setDoc` e basta — e siccome Firestore **mette in coda le
  scritture fatte offline e le rigioca al ritorno della linea**, un telefono
  rientrato dal campo dopo giorni senza rete riscriveva il documento con il
  proprio stato, **cancellando dal cloud il lavoro di chi era rientrato prima**;
  e non poteva accorgersene, perché le proprie scritture le ignora. Il lavoro
  tornava solo se l'altro riapriva l'app. Ora si scrive dentro una
  **transazione**: si legge cosa c'è, e se contiene qualcosa che questo telefono
  non ha mai visto la scrittura **si annulla**, si aspetta di riceverlo, lo si
  fonde e si rimanda l'unione. La regola sta in una funzione sola
  (`sovrascrivibile`), provata a parte. Effetto collaterale voluto: la
  transazione va sempre al server, quindi **niente scritture in coda** — finché
  non c'è linea resta tutto "da inviare", che è la verità.
- **Sostituzioni in blocco** (Ripristino di emergenza, Importa backup): non
  aggiungono, **rimpiazzano**, e ciò che sparisce viene cancellato su tutti i
  telefoni. Prima la conferma diceva solo "i dati attuali verranno sostituiti":
  chi apriva per sbaglio un backup di tre giorni prima azzerava il campo per
  tutti senza sapere né la data del file né quanto stava buttando. Ora la
  conferma dice **la data del backup, cosa contiene e quante voci spariranno da
  TUTTI i telefoni**, in italiano ("28 presenze, 4 membri"); un file che non è
  un backup viene rifiutato; e la **copia di scorta si salva anche su chi fa
  l'operazione**, che prima era l'unico senza via d'uscita.
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
  Attenzione a una differenza: gli **scontrini** hanno una copia in
  `localStorage`, quindi al collegamento successivo quelli mancanti nel cloud si
  ripubblicano da soli. Le **foto della galleria** no — sono troppo grandi per
  stare sul telefono — quindi la loro coda vive solo finché l'app è aperta: se si
  chiude, quelle non ancora partite vanno riscelte. La Galleria lo dice mentre
  succede ("3 foto ancora da caricare: tieni l'app aperta").
- **Documento troppo grande**: sopra i 900 KB (il limite di Firestore è 1 MiB)
  la scrittura verrebbe rifiutata e la sincronizzazione si fermerebbe senza
  dirlo. Ora si avvisa prima.
- **Campo vuoto nel cloud**: se nel cloud non c'è ancora niente, chi ha dati in
  locale li pubblica. Senza, restavano fermi finché qualcuno non toccava
  qualcosa.
- **Memoria del telefono piena**: se la cronologia delle modifiche non si può
  più salvare, alla riapertura le modifiche di quel telefono risulterebbero
  "senza data" e perderebbero ogni confronto — ed è lo stato in cui la prima
  sincronizzazione gli porta via tutto ciò che gli altri hanno cancellato.
  Tre difese: la cronologia si salva **prima** delle copie di sicurezza (una
  copia da qualche decina di KB poteva prendersi gli ultimi byte liberi e far
  fallire proprio lei); se lo spazio manca comunque, si **sacrifica il resto** —
  prima le copie vecchie, poi il registro — e si riprova; e i salvataggi dei
  dati non lasciano più scappare l'eccezione, che smontava l'app intera
  (schermata bianca) impedendo perfino l'invio agli altri. Resta l'avviso in
  cima, e in *Diagnostica* compare "questo telefono non ha ancora la cronologia
  delle modifiche" quando i dati ci sono ma nessuno è datato.
- **Modalità tecnica**: la diagnostica, il registro, gli avvisi sulle voci
  cancellate e il promemoria del backup parlano di lapidi e cronologie — roba
  che serve a chi tiene i conti e **mette ansia a tutti gli altri**. Si accende
  per telefono da *Impostazioni → Modalità tecnica* con una **password
  dedicata** (impronta PBKDF2 in `window.APP_ADMIN`, come il blocco: la
  password in chiaro non sta nel repo), e resta accesa finché non la si spegne.
  Sugli altri telefoni l'app lavora uguale — copia di scorta compresa, che si
  salva **in silenzio anche per loro** — ma non mostra nulla di tecnico; l'unico
  avviso che resta per tutti è quello della memoria piena, in versione breve,
  perché liberare spazio può farlo solo il proprietario del telefono.
- **Registro delle modifiche** (Impostazioni, riga richiudibile, solo in
  modalità tecnica): ogni
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
- **Presenze bloccate** (Presenze, in modalità tecnica): chiuso un giorno, i
  suoi pasti non si toccano più — né dai tasti (che si spengono per tutti) né
  da una sincronizzazione. Il blocco si porta dietro una **copia dei pasti**:
  è un solo valore con una sua data, quindi si fonde come qualsiasi altra voce
  e tutti i telefoni arrivano allo stesso risultato. Se un aggiornamento in
  arrivo tocca i pasti di un giorno chiuso, l'app li **rimette com'erano e
  ripubblica la correzione**, così il blocco vale ovunque e non solo sul
  telefono che l'ha messo. Sbloccando si torna ai pasti congelati, non a quelli
  arrivati nel frattempo. Le riparazioni d'identità (doppioni, presenze senza
  padrone) restano valide anche sui giorni chiusi: cambiano *a chi* è attaccata
  una presenza, non *chi* ha mangiato.
- **Chiusura dei conti** (Spese Totali → Dati, in modalità tecnica): da fare
  **quando i conti sono definitivi e la gente comincia a pagarsi**. I passaggi
  di pareggio sono segnati come saldati con una chiave che contiene l'importo
  (`Anna→Bruno@4530`): basta uno scontrino dimenticato aggiunto dopo perché
  **tutti** gli importi si ricalcolino, le chiavi non combacino più e i bonifici
  già fatti spariscano dall'elenco — chi aveva pagato torna debitore, con cifre
  diverse. Chiudendo, spese e attrezzatura si congelano (portandosi dietro una
  copia, come il blocco delle presenze) e i giorni ancora aperti si bloccano.
  Quello che arriva dopo dagli altri telefoni **non entra e non viene buttato in
  silenzio**: l'app lo respinge, ripubblica la correzione e lo dice con nome e
  cifra ("Birra dimenticata, 25 €"), così chi l'aveva registrata sa che non è
  entrata. Si riapre da qui.
- **Soldi che non entrano in nessuna quota**: se una cassa ha dentro dei soldi
  ma nessun pasto su cui dividerli — spese segnate "conto separato" senza
  nessun giorno separato spuntato, oppure acquisti registrati prima che
  qualcuno segni le presenze — la sua quota a pasto viene zero e quei soldi
  restano fuori da tutte le quote. Finivano dentro lo *scarto*, e la
  riconciliazione (nata per limare qualche centesimo) se li spalmava addosso a
  chi capitava, 10 cent alla volta: **100 € di conto separato diventavano 50 €
  a testa** per due persone che non c'entravano niente, sotto l'etichetta
  "arrotondamento". Ora la riconciliazione lavora solo sul ripartibile, e il
  buco viene detto con la cifra e il motivo — in *Quote*, nei *Saldi* ("i
  rimborsi non quadrano") e nel resoconto che si manda nel gruppo.
- **Stessa persona inserita due volte**: non è un difetto della fusione, è la
  fusione che funziona e produce un risultato sbagliato. Due telefoni senza
  linea che aggiungono "Anna Rossi" creano due membri con **id diversi**, ed
  entrambi sono voci nuove legittime: nessuna regola può scartarne una, e il
  controllo che c'è all'inserimento non può vederlo perché in quel momento
  l'elenco dell'altro non è ancora arrivato. Il danno non è estetico: Anna
  entra **due volte nel divisore delle quote**, quindi sbagliano i conti di
  tutti, e le sue presenze si dividono fra i due id. L'app se ne accorge, lo
  dice in **Membri** spiegando il danno vero, e le **unisce**: resta la scheda
  con più presenze, i pasti delle due si **sommano** (chi aveva segnato il
  pranzo su una e la cena sull'altra se li ritrova entrambi) e i campi
  compilati solo su una — PayPal, IBAN — non si perdono.
- **Stessa spesa registrata due volte**: stessa causa, ma di mezzo ci sono i
  soldi — il totale si gonfia e la quota di tutti sale. Qui l'app **non tocca
  niente da sola**: segnala le spese con lo stesso nome e lo stesso prezzo (e
  chi le ha messe), e lascia decidere a una persona quale buttare.
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
  locale; se le voci perse sono almeno tre **ed è appena successo** compare un
  avviso in cima (solo in modalità tecnica: la decisione di annullare spetta a
  chi tiene i conti, quindici tasti "Annulla" in giro sono più pericolosi del
  problema) con **"Annulla la sincronizzazione"**, che rimette lo stato di
  prima e lo ripubblica su tutti i dispositivi (le voci che tornano vengono
  ridatate, quindi vincono sulle cancellazioni che le avevano tolte). La copia
  resta comunque disponibile in *Impostazioni → Diagnostica sincronizzazione*.
  L'avviso guarda **quando** è stata fatta la cancellazione, non solo quante
  voci sono sparite: un telefono rimasto indietro che si riaggancia viene a
  sapere di cancellazioni fatte giorni prima, e non manca niente a nessuno — è
  solo il recupero del ritardo. Prima le due situazioni venivano annunciate allo
  stesso modo, e siccome togliere **un solo membro** porta via anche le sue
  presenze di tutti i giorni (un gesto = sette "voci"), bastavano quattro
  cancellazioni vecchie per annunciare "mancano 29 voci" a chi non aveva perso
  niente. Ora si avvisa solo per le cancellazioni delle ultime **sei ore**, e
  l'avviso dice **l'ora in cui sono state fatte**; le più vecchie finiscono
  soltanto nel registro e in Diagnostica, che spiega che il telefono era
  indietro.
- **Diagnostica sincronizzazione** (Impostazioni, solo in modalità tecnica):
  quante voci sono datate,
  quante cancellazioni sono registrate e **le ultime dodici, tradotte in
  italiano con data e ora** ("presenza di Bruno — mer 13 ago, cancellata il 3
  ago alle 14:12"). Tante cancellazioni tutte allo stesso minuto sono la firma
  di un ripristino, di un'importazione o di un "Copia da ieri".
- **"Copia da ieri"** sovrascrive le presenze del giorno ma **non cancella** chi
  ieri non c'era: lo lascia in elenco azzerato. Toglierlo genererebbe una lapide
  che cancella quella presenza su *tutti* i telefoni, anche se qualcun altro
  l'aveva appena segnata.
- **Copie di sicurezza, tre strati**:
  1. **Sul telefono, automatiche**: **due al giorno**, una dopo mezzanotte e una
     dopo mezzogiorno. L'app gira solo quando è aperta, quindi la copia della
     fascia si fa al **primo utilizzo dentro quella fascia**, e contiene lo
     stato *precedente* alla modifica che l'ha fatta scattare: è esattamente il
     punto a cui si vuole tornare. Si tengono le ultime 14 (7 giorni), con un
     tetto di 600 KB complessivi — se la memoria è poca si butta la più vecchia
     e si riprova, perché avere la copia di adesso conta più di avere la storia
     lontana. Niente foto. Si fanno **anche in modalità aereo**: è ciò che rende
     il **"Ripristino di emergenza" utilizzabile al campo**. Prima gli snapshot
     stavano solo su Firestore e il ripristino rispondeva "serve la
     connessione": nei giorni che contano non esisteva alcuna rete.
  2. **Nel cloud, automatiche**: snapshot giornaliero in
     `camps/<codice>/snapshots/<data>`, ultimi 10 giorni, quando c'è linea.
  3. **Su file, a mano**: *Esporta/Importa* JSON (foto comprese). È l'unica che
     sopravvive a un telefono perso, rotto o svuotato, e richiede un gesto umano
     perché il browser non può scrivere un file senza conferma. Per questo, nei
     **giorni del campo**, dopo le 20 compare un promemoria — ma **solo sul
     telefono in modalità tecnica** (è un compito di chi tiene i conti, non
     un'ansia da distribuire) e **solo se quel giorno sono state fatte davvero
     delle modifiche su quel telefono**: se non hai toccato niente, non c'è
     niente da salvare e non compare nulla.
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
| Modalità tecnica | **Password dedicata** (`window.APP_ADMIN`, stessa PBKDF2 del blocco) | Nasconde diagnostica e avvisi tecnici agli utenti normali. È un sipario, non una serratura: decide chi vede gli strumenti, non chi tocca i dati |
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
