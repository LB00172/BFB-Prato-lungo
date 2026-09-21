# Roadmap — versione pubblica (da settembre)

Documento di lavoro per l'evoluzione dell'app da *strumento interno della
Brigata Fabio Bandone* a **prodotto neutro pubblicabile**, utilizzabile da
qualsiasi gruppo (scout, campi estivi, ritiri, case in montagna, sagre).

**Il campo di agosto 2026 è finito** (11–16 agosto): la regola d'oro che
bloccava tutto — «niente di tutto questo prima del campo» — ha smesso di
valere, e questa è la fase in cui si lavora. Restano due cose di quella regola,
che valgono ancora: l'app in produzione deve restare stabile mentre il gruppo
chiude i rimborsi, e lo sviluppo grosso va fatto su un branch dedicato
(`feature/public-app`), non su `main`.

---

## Ordine di lavoro

I numeri delle sezioni sono **nomi, non priorità**: servono a citarle senza
ambiguità e non cambiano più. L'ordine in cui affrontarle è questo, e nasce da
cosa blocca cosa.

**Prima di tutto — si sistema la casa (nessuna dipendenza, tutto guadagno):**

| | Sezione | Stato |
| --- | --- | --- |
| — | § 12 Ponte Menù → Lista della spesa | **fatto** il 19 agosto: i menù veri del campo hanno corretto il piano (niente tabella di ingredienti) |
| — | § 11 Coda foto | **chiusa**: la galleria resta online (§ 15-bis.4), e il messaggio ora dice anche cosa si perde chiudendo l'app |
| — | § 19 Immagini fuori da `localStorage` | **fatto** il 23 agosto: le foto stanno in IndexedDB, `localStorage` è tornato da 3 MB a 2 KB |
| — | § 13 Vocabolario dell'interfaccia | **fatto**: bottoni il 23 agosto (102 su 124, più il chip di scelta), **misure di testo il 21 settembre** — da dodici a sei, dichiarate in `index.html` e chiamate per nome |
| — | § 14 Spezzare i sorgenti | **a buon punto** il 20 settembre: disegno, stato isolato e tutte le regole che decidono qualcosa sono fuori e provate senza browser. Resta il collegamento della sincronizzazione, che si sposta col § 2 |
| — | § 17 Compiti assegnati | **fatto** il 20 settembre: scheda «Chi fa cosa», dietro `FEATURES.compiti`. Il gestore della Room arriva col § 2 |
| — | § 18 Più lingue | **fatto** il 21 settembre: tutti e diciannove i sorgenti passano dal dizionario, `FEATURES.lingue` accesa. Le misure di testo del § 13 **non** sono state fatte in questo giro: si toccano gli stessi file, ma sono un lavoro diverso |

**Poi — la versione pubblica, che è una catena:**

| | Sezione | Perché in quest'ordine |
| --- | --- | --- |
| 4 | § 1 Login | Senza account non esiste nient'altro di quanto segue |
| 5 | § 2 Room | I dati sono già in `camps/<codice>`: è evoluzione, non riscrittura |
| 6 | § 9 Modulo stanza e inviti | È l'interfaccia del § 2. Senza, i gruppi poco tecnologici si fermano al primo tentativo |
| 7 | § 8 Voci di spesa spegnibili | Configurazione della room: ha senso solo quando la room esiste |
| 8 | § 3 Google Play | Si pubblica quando c'è qualcosa da far entrare, cioè dopo la 7 — e dopo il § 18, altrimenti le schede dello store si rifanno |
| 9 | § 6 Checklist | La lista privata ha bisogno di un `uid`, quindi del § 1 |
| 10 | § 5 Scontrini con l'IA | La chiave ha bisogno di un server. Farla prima significa costruire il backend per l'IA invece che per il motivo giusto |
| 11 | § 15 Notifiche push | Piano Blaze, Cloud Functions e — soprattutto — una domanda ancora senza risposta su cosa valga la pena notificare |

**Fuori dalla fila:** § 4 (database) è una decisione già presa — si resta su
Firestore; § 7 (analisi di mercato) non è lavoro, è la mappa; § 10 (iPhone) è
**fatta** ad agosto 2026 e si ripete solo quando si tocca `sw.js` o `build.js`
— cioè, fra le voci qui sopra, il § 14 e il § 19.

### Il calendario, che prima non c'era

Contributo utile arrivato da un'analisi esterna (agosto 2026), tenuto perché è
l'unica cosa di quel documento che non era già nostra: **l'uso dei gestionali
per l'outdoor crolla d'inverno e ha il picco fra giugno e settembre.** Lanciare
in autunno disperde le energie. Da qui:

- lavoro tecnico in autunno-inverno;
- **posizionamento sullo store (ASO) in febbraio-marzo**, su parole chiave di
  nicchia senza concorrenza diretta: «cassa scout», «gestione cambusa», «conti
  campo»;
- **apertura pubblica a primavera**, a ridosso dei preparativi dei campi estivi,
  quando i capi gruppo stanno organizzando.

**Ma il collaudo su un campo vero resta prima del lancio, non dopo** (§ 16). Un
campo invernale di tre giorni al chiuso e con la linea non prova nessuna delle
condizioni che possono affondare questa app. Se il calendario e il collaudo
entrano in conflitto, vince il collaudo.

**In mezzo, e non è una voce di questo elenco:** raccogliere il *feedback dei
venti utenti veri* del campo 2026 — cosa hanno usato, cosa non hanno capito. È
ricerca di mercato gratuita, la più affidabile che esista, e va fatta finché se
lo ricordano.

---

## Stato attuale (già pronto)

Cose già in casa che riducono il lavoro di settembre:

- **PWA completa e offline-first**: service worker con cache auto-versionata,
  nessuna dipendenza da CDN esterni, auto-aggiornamento.
- **Backend già multi-gruppo di fatto**: i dati vivono in
  `camps/<codice>` su Firestore. Il codice `Bandone` non è altro che un ID di
  campo scritto a mano: la struttura per N gruppi esiste già.
- **Sincronizzazione live + coda offline**, foto scontrini sincronizzate,
  snapshot giornalieri con ripristino.
- **Branding esternalizzato** in `firebase-config.js` → `window.APP_CONFIG.brand`.
  Per la versione neutra basta cambiare quel blocco (vedi § 3).
- **Feature flag** già predisposti: `window.APP_CONFIG.features = { auth, rooms }`,
  entrambi `false` → le funzioni nuove restano invisibili finché non si accendono.

---

## 1. Login certificato (Google nativo + email/password)

**Obiettivo:** accesso con account Google in un tap, oppure registrazione
classica con nome, cognome, email e password scelta dall'utente.

- Firebase Authentication supporta nativamente entrambi i provider
  (`GoogleAuthProvider`, `createUserWithEmailAndPassword`), quindi non serve
  scrivere un backend di autenticazione.
- Profilo utente in `users/<uid>`: nome, cognome, email, campi a cui partecipa.
- **Verifica email** obbligatoria per la registrazione classica + flusso di
  reset password (entrambi già forniti da Firebase).
- **Migrazione dall'attuale accesso anonimo**: Firebase permette di
  "promuovere" un utente anonimo ad account registrato mantenendone i dati
  (`linkWithCredential`) — così chi usa l'app oggi non perde nulla.
- Da tenere presente per lo store: Google Play richiede, per le app con
  registrazione, un percorso di **cancellazione dell'account** (anche via web).

**Nota di prodotto:** il login non deve diventare un muro. Consiglio di
mantenere la possibilità di *entrare in un campo con il solo codice* (ospite),
e rendere l'account necessario solo per **creare** e **amministrare** un campo.

## 2. Room dedicate per gruppo (ID + password)

**Obiettivo:** dopo il login, l'utente crea la "room" del proprio gruppo e
invita le persone con un ID e una password; la room sblocca tutte le aree.

Modello dati proposto (evoluzione di quello attuale, non riscrittura):

```
rooms/<roomId>
  name, ownerUid, createdAt, campStart, campEnd, location{lat,lon,label}
  joinCodeHash            (hash della password d'ingresso, non in chiaro)
  members/<uid>           { role: 'owner' | 'editor' | 'viewer', displayName }
  data/                   (membri, presenze, acquisti, attrezzatura… = oggi camps/<id>)
  receipts/<purchaseId>   (foto scontrini)
  snapshots/<data>        (copie giornaliere)
```

- **ID room**: generato casualmente e leggibile (es. `K7RX-2MQP`), non
  sequenziale (niente room indovinabili).
- **Password room**: mai salvata in chiaro. La verifica va fatta
  **server-side** con una Cloud Function `joinRoom(roomId, password)` che, se
  corretta, scrive `rooms/<id>/members/<uid>`. Le Security Rules concedono
  l'accesso ai dati **solo** a chi è già in `members`. Questo è il punto
  delicato: se la verifica avvenisse nel client, chiunque potrebbe aggirarla.
- **Invito con link/QR** (`.../join?room=K7RX-2MQP`) per non far digitare nulla:
  è ciò che fa davvero adottare l'app dai gruppi meno tecnologici.
- **Ruoli**: chi crea la room la amministra (cambia date, luogo, rimuove
  membri); gli altri possono modificare i dati del campo.

## 3. Pubblicazione su Google Play (versione neutra)

**Percorso tecnico:** PWA → **TWA (Trusted Web Activity)**, generata con
PWABuilder o Bubblewrap. L'app resta la stessa: il pacchetto è un guscio che
carica la PWA, quindi **gli aggiornamenti continuano a passare dal deploy web**
senza ripubblicare sullo store ogni volta.

Checklist:

- [ ] Account Google Play Developer (**25 $ una tantum**).
- [ ] `assetlinks.json` sul dominio per verificare la proprietà (rimuove la
      barra del browser).
- [ ] Icone e splash già presenti (`apple-touch-icon`, 192, 512).
- [ ] **Privacy policy** pubblica (obbligatoria) + scheda "Sicurezza dei dati".
- [ ] Percorso di **cancellazione account** (requisito Play).
- [ ] **De-branding**: modificare `window.APP_CONFIG.brand` in
      `firebase-config.js` e i tre punti statici rimasti:
      `index.html` (`<title>`), `manifest.json` (`name`, `short_name`), `logo.png`.
      Il resto dell'interfaccia legge già dalla configurazione.
- [ ] Nome prodotto neutro + logo generico (da decidere).

**Su Apple App Store**: Apple rifiuta di norma i "wrapper" di siti web
(linea guida 4.2). Sull'ecosistema iOS la strada realistica resta
l'installazione della PWA da Safari, che già funziona.

## 4. Scelta del database: Firestore o Supabase?

| | **Firestore** (attuale) | **Supabase** |
|---|---|---|
| Offline reale | ✅ cache persistente + coda scritture, nativa | ⚠️ non nativo, va costruito a mano |
| Sync live | ✅ `onSnapshot` | ✅ Realtime |
| Auth Google + email | ✅ | ✅ |
| Query/report complessi | ⚠️ limitati (NoSQL) | ✅ SQL completo |
| Costo a piccola scala | gratis, poi a consumo | gratis, poi ~25 $/mese |
| Lavoro di migrazione | **zero** | riscrittura del livello dati |

**Raccomandazione: restare su Firestore.** Il requisito numero uno di questa
app è funzionare *senza linea*, e la cache offline con coda di scritture è
esattamente ciò che Firestore fa nativamente e Supabase no. La migrazione
costerebbe settimane per un vantaggio (SQL) che a questa app non serve.
Riconsiderare Supabase solo se in futuro servissero report analitici pesanti.

### Riesaminato con l'app pubblica sul tavolo (agosto 2026)

La decisione regge, e con **tre motivi nuovi** che prima non c'erano.

**1. Un database diverso obbliga al fork.** Le due app (§ 16) condividono un
solo codice e si distinguono per configurazione. Metterne una su Supabase
significa due livelli dati diversi, quindi due codici, quindi ogni correzione
fatta due volte. È il costo più alto della lista e non si vede al momento della
scelta: si vede sei mesi dopo, quando le due versioni hanno smesso di
assomigliarsi.

**2. La stagionalità premia il consumo.** Questo prodotto vive tre mesi
all'anno. Supabase Pro costa ~25 $/mese anche a novembre, quando non campeggia
nessuno; Firestore a novembre costa quasi zero. Per un uso stagionale la
fatturazione a consumo è la forma giusta, non un compromesso.

**3. I costi veri non sono del fornitore, sono nostri.** Con i numeri del campo
2026 (59 persone, 7 giorni, ~800 scritture in una settimana): il campo è **un
solo documento**, quindi ogni scrittura costa una lettura per ogni telefono
collegato. Venti telefoni × 800 scritture = ~16.000 letture per l'intero campo,
contro le 50.000 al giorno del piano gratuito. **Un campo è praticamente
gratis**; cinquanta campi nella stessa settimana restano sotto il caffè.

Il costo che cresce davvero sono le **foto**: 29 scontrini da 112 KB più la
galleria, e stanno dentro documenti Firestore, dove il byte costa ~7 volte più
che su uno storage a oggetti e ogni visualizzazione è una lettura da ~1 MB.

> **La modifica che conta per i costi non è cambiare fornitore: è togliere le
> foto dai documenti.** Vale su Firestore come su Supabase, e va fatta per la
> versione pubblica in ogni caso.

**Quando riaprire la domanda:** se servisse davvero SQL per analisi trasversali
fra campi (metriche di prodotto), o se si volesse l'auto-ospitazione. Nessuna
delle due è sul tavolo. Gli ordini di grandezza qui sopra vanno riverificati
prima di impegnarsi: i listini cambiano.

## 5. Lettura degli scontrini con l'IA

**Una funzione sola, e solo questa.** Uno scontrino della spesa per venti
persone sono trenta righe, e oggi qualcuno le ribatte a mano una per una: nome,
prezzo, tipologia. La foto invece c'è già — è compressa, allegata alla voce e
sincronizzata. Farsi proporre le righe già spezzate, con la tipologia
indovinata, è l'unico punto dell'app dove un modello fa risparmiare mezz'ora
vera invece di sostituire un modulo che è già rapido.

**La regola che decide tutto:**

> L'IA propone, l'uomo conferma, e l'app funziona identica se l'IA non risponde
> mai.

Qualunque funzione che non rispetti quella riga, in questa app, è un difetto
travestito da caratteristica. Niente chat, niente assistente, nessun pulsante
"chiedi all'IA" sparso nelle schede: un bottone sopra una foto che dice «ho
letto queste righe, confermi?».

### Perché funziona proprio qui

**La geografia divide il lavoro da sola.** Lo scontrino lo fotografi al
supermercato, dove la linea c'è. I conti li fai al campo, dove non c'è. L'IA
aiuta al negozio, mai al prato: non è un compromesso, è una linea
architetturale pulita.

### Il rischio, e la difesa che esiste già

Un modello che legge uno scontrino, prima o poi, sbaglia una cifra. In un'app
il cui valore è *«i conti tornano sempre»*, un componente che inventa numeri in
silenzio è il pericolo serio — e non è ipotetico, è quasi certo.

La difesa però c'è, e non era nata per questo: `prezzoSospetto()` confronta ogni
prezzo con la **mediana** delle altre spese e ferma tutto sopra le dieci volte,
o sopra i 1000 €. È stata scritta per il dito che batte 1290 invece di 12,90, e
funziona identica su un modello che legge male. Più la foto resta attaccata alla
voce: chi conferma vede le righe proposte **accanto all'immagine**.

### Perché dopo il backend, non prima

Quattro ostacoli, e i primi due si sciolgono da soli quando ci sarà un server
(punti 1 e 2 di questa roadmap):

- **La chiave.** Non c'è build step: qualunque chiave finirebbe nel sorgente
  servito a ogni telefono. Serve un proxy nostro.
- **Il costo.** Nessun limite di frequenza in un'app statica: un dito che
  insiste, o un ritentativo in ciclo, e si paga.
- **La privacy.** Nomi, chi ha mangiato cosa, chi deve soldi a chi, e scontrini
  che in fondo hanno gli ultimi numeri della carta. Mandarli a terzi richiede il
  consenso di tutti, e in un gruppo di amici non è una formalità.
- **Il precache atomico.** Ogni dipendenza nuova va aggiunta a `sw.js` e
  all'elenco degli hash in `build.js`, e deve degradare bene offline.

**Fare l'IA prima del backend significa costruire il backend per l'IA.** Tanto
vale farlo per il motivo giusto e prenderla come conseguenza.

### Seconda, molto dietro: le quantità del menù

Il ponte Menù → Lista della spesa (già previsto) diventa più utile se sa
rispondere a «venti persone, tre giorni, pasta al pomodoro e grigliata: quanto
compro?». È una cosa che gli umani sbagliano sistematicamente. Anche questa
succede **prima di partire**, con la linea.

Tutto il resto — inserire spese parlando, il resoconto finale scritto dall'IA,
la diagnosi dei problemi di sincronizzazione — sono soluzioni in cerca di un
problema: il modulo è già veloce, e la diagnosi richiede di conoscere *questo*
codice.

## 6. Area "Checklist": una condivisa, una privata

**Obiettivo:** una scheda in stile Google Task, con due elenchi dietro due
bottoni — **Condivisa** (la vede e la spunta tutto il gruppo) e **Privata**
(solo chi l'ha scritta).

**Oggi non ha senso, e non per pigrizia: manca l'identità.** L'app non ha
account nominali — si entra con la password del campo e tutti i telefoni usano
lo stesso utente Firebase condiviso. Senza un `uid` per persona, "privata" non
ha nessuno a cui appartenere. La funzione arriva **dopo** i punti 1 e 2.

### Il punto che è facilissimo sbagliare

**"Privata" non può essere una spunta su una voce condivisa.**

Il modello attuale è un documento solo per campo, fuso voce per voce, e
**replicato interi su ogni telefono**: ogni dispositivo tiene tutto lo stato in
`localStorage`, e Impostazioni → Esporta produce tutto. Una voce con
`privata: true` dentro quei dati funzionerebbe nell'interfaccia e sarebbe
**leggibile da chiunque** apra l'export o guardi la memoria del proprio
telefono. Trapelerebbe **in silenzio**, che è il modo peggiore.

Serve un archivio separato per persona:

```
rooms/<roomId>/private/<uid>/checklist/<itemId>
```

con Security Rules legate a `request.auth.uid`, e con la regola che quei dati
**non entrano nell'export condiviso**. La lista condivisa invece sta nei dati
della room come tutto il resto.

### Deve funzionare offline come il resto

Una lista privata è esattamente quello che si annota in un prato senza linea.
La buona notizia è che `sync-merge.js` è generico: basta una voce nuova in
`LISTS` e la fusione per voce funziona già. Il lavoro sta nel **trasporto**:
`firebase-sync.js` oggi ha un solo canale (il documento del campo), e servirebbe
un secondo canale per il documento privato.

### Il vincolo che decide se un guest può esistere

Il punto 1 consiglia di tenere la possibilità di **entrare in un campo con il
solo codice**, senza account. Ma un ospite non ha `uid`, quindi **non può avere
una lista privata**. Le due cose sono in tensione, e la checklist è la funzione
che costringe a decidere: o l'ospite esiste e per lui la scheda mostra solo la
lista condivisa, o l'account diventa obbligatorio per tutti. **Da decidere
prima di scrivere il codice, non durante.**

### Come limitarla nella versione gratuita

La checklist è un buon candidato per il confine fra gratis e Pro (vedi il
modello di prezzo in § 7): per esempio solo la lista condivisa nel piano
gratuito, o un tetto al numero di voci.

Ma vale una regola generale, che conviene fissare adesso:

> **Nella versione gratuita si limita la quantità, mai la correttezza.**

Numero di campi, storico, spazio per le foto, formati di export: tutto
limitabile. **Niente che possa rendere i conti sbagliati o incompleti.** Un
utente gratuito che ottiene numeri errati non pensa "mi manca il Pro": pensa che
l'app non funziona — e l'unica cosa che questa app vende è che i conti tornano.

## 7. Analisi di mercato

### Concorrenza

**Divisione spese di gruppo — mercato saturo.**
Splitwise è il riferimento: freemium, con Pro intorno a **$4,99/mese o
~$40–50/anno** (varia per regione). Ci sono poi Tricount, Settle Up e decine di
cloni. Fanno bene una cosa sola: dividere importi già noti. **Non** sanno *chi
ha mangiato cosa*, non calcolano una quota-pasto, non gestiscono la logistica di
un campo.

**Gestionali per campi — altro mestiere.**
Il software di "camp management" (CampDoc, UltraCamp, Campium, Scout Manager da
~$9/mese) serve a **iscrizioni, moduli sanitari, pagamenti** per campi
commerciali americani. Costoso, burocratico, inutile per la cambusa quotidiana.
In Italia esistono gestionali associativi (es. per le iscrizioni agli eventi),
ma nulla per la gestione economica di un campo autogestito.

**Conclusione: la nicchia specifica è scoperta.** La catena
*presenze pasto per pasto → costo reale del pasto → quota individuale + cassa
comune + scontrini + saldi, tutto offline* non ha un concorrente diretto
affermato. Splitwise ti fa dividere una cifra; questa app **calcola la cifra
giusta da dividere**.

### Segmento di mercato realistico

In ordine di affinità:

1. **Scout e associazioni giovanili** (in Italia AGESCI conta oltre 180.000
   membri, migliaia di gruppi che fanno campi ogni estate) — bisogno reale,
   ricorrente, e passaparola forte tra capi gruppo.
2. **Campi estivi parrocchiali, oratori, cori, gruppi sportivi** in ritiro.
3. **Gruppi di amici**: settimana in baita/casa al mare con cassa comune —
   il segmento più ampio ma anche quello dove Splitwise basta.
4. **Rifugi, sagre, piccole cucine da campo** — uso "professionale" leggero.

Il segmento 1 è quello da cui partire: è dove il vantaggio competitivo è
massimo e dove il prodotto è già modellato sui loro usi (cambusa, dotazioni,
turni, offline in mezzo al bosco).

### Modello di prezzo consigliato

**Freemium, non pay-first.** Motivi concreti:

- il pubblico non paga in anticipo un'app sconosciuta per un bisogno
  stagionale; deve poterla provare *durante* un campo;
- l'adozione è **virale per gruppo**: chi crea la room porta dentro 10–30
  persone. Un paywall all'ingresso ucciderebbe proprio il meccanismo di
  diffusione;
- l'uso è **stagionale** (estate): un abbonamento mensile è percepito come
  spreco; meglio un pagamento legato al campo.

Struttura proposta:

- **Account per tutti, in un tap.** L'ingresso è Google (o email/password): è
  l'account che rende possibili le funzioni personali, prima fra tutte la
  checklist privata (§ 6). Chi paga è **chi crea la room**, non chi entra.
- **Gratis**: 1 campo attivo, membri illimitati, tutte le funzioni di base,
  offline completo. Deve essere generoso: è il canale di acquisizione.
  **Si limita la quantità, mai la correttezza** — vedi § 6: un utente gratuito
  che ottiene conti sbagliati non pensa che gli manchi il Pro, pensa che l'app
  non funzioni.
- **Pro (una tantum "per campo", ~4–8 € pagati da chi organizza,
  oppure ~10–15 €/anno)**: storico dei campi passati, export PDF/Excel del
  rendiconto, scontrini illimitati e archiviati, più campi contemporanei,
  ripristino esteso. Chi paga è **una persona per gruppo** (il cambusiere/
  tesoriere), non tutti: percepito come costo irrisorio diviso per 20 persone.
- Da evitare: pubblicità (rovinerebbe l'uso in campo) e abbonamento
  individuale obbligatorio.

### Aspettative onesta sui numeri

È un mercato di nicchia, stagionale, con concorrenza gratuita nel segmento
generalista. Non è un prodotto da migliaia di euro al mese; è realistico
pensare a un'app **sostenibile** (che si paga i costi cloud e ripaga il tempo)
con crescita per passaparola nel mondo associativo, eventualmente con accordi
con associazioni/zone. Il valore maggiore, all'inizio, è **strategico**: un
prodotto vero, pubblicato, con utenti reali.

### Prossimi passi suggeriti

1. Dopo il campo di agosto: **raccogliere feedback** dai 20+ utenti reali
   (cosa hanno usato, cosa non hanno capito). È ricerca di mercato gratuita e
   la più affidabile che esista.
2. Sviluppare **room + login** su branch dedicato (§ 1 e § 2).
3. **De-branding** e pubblicazione su Play Store in beta chiusa (§ 3).
4. Test con **2–3 gruppi amici** di altri reparti prima dell'apertura pubblica.
5. Valutare il piano Pro solo quando c'è uso reale ricorrente.

---

### Fonti (consultate il 20/07/2026)

- Prezzi Splitwise Pro: [usefairsplit.com](https://usefairsplit.com/blog/splitwise-pricing/),
  [split-circle.com](https://split-circle.com/en/blog/splitwise-free-vs-pro)
- Software gestione campi: [Scout Manager](https://www.scoutmanager.com/),
  [Capterra — Camp Management](https://www.capterra.com/camp-management-software/)
- AGESCI (dimensione associativa): [Wikipedia](https://en.wikipedia.org/wiki/Associazione_Guide_e_Scouts_Cattolici_Italiani)

---

## 8. Voci di spesa che si possono spegnere

**Obiettivo:** un interruttore per categoria — logistica, attrezzatura, e in
generale qualunque tipologia — che dica **«questa voce non si divide qui: la
gestiamo fuori dall'app»**. Serve ai gruppi che comprano il gasolio con la
cassa dell'associazione, o l'attrezzatura una volta per tutte, e non vogliono
vederla comparire come tassa a testa.

Oggi le due voci sono obbligatorie: se ci sono acquisti di logistica, tutti
quelli che hanno pasti nei giorni comuni ne pagano una quota. È giusto per la
Brigata, non è giusto per tutti.

### Spegnere una voce non è nasconderla

È il punto in cui questa funzione può fare danno, e va deciso prima di scrivere
il codice. Ci sono **due cose diverse** che sembrano la stessa:

1. **La spesa non entra nell'app.** Il gruppo la paga fuori e non la registra.
   Non serve nessun interruttore: basta non scriverla.
2. **La spesa è registrata ma non si divide.** Qui l'interruttore serve — e
   quei soldi diventano immediatamente il caso che l'app oggi tratta come
   errore: `nonRipartito`, con l'avviso «X € non sono nelle quote di nessuno».

Quindi l'interruttore deve fare **due cose insieme**: togliere la voce dai
divisori **e** spostarla in un secchiello dichiarato — *«fuori conto: gestito
dal gruppo»* — che non è un buco. Se facesse solo la prima, l'app urlerebbe un
errore che non c'è; se non dichiarasse nulla, chi legge «Totale spese» crederebbe
che il campo è costato meno di quanto è costato.

Regola, la stessa di § 6 in altra forma: **si può togliere una voce dal conto,
non si può far sparire un euro dalla vista.**

### Cosa comporta, in pratica

- **Configurazione della room**, non del telefono: le quote sono le stesse per
  tutti, quindi la scelta sta in `rooms/<roomId>` e la cambia solo chi
  amministra. Una scelta per dispositivo produrrebbe due gruppi con conti
  diversi sullo stesso campo.
- **Va protetta come i giorni bloccati.** Spegnere la logistica a rimborsi già
  fatti riscrive le quote di tutti: l'interruttore deve essere chiuso quando i
  conti sono chiusi (`bloccoConti`) e avvisare prima di cambiare, esattamente
  come fa oggi il blocco delle presenze.
- **Non appartiene a nessuna delle due casse.** Una voce spenta esce sia dalla
  cassa comune sia da quella separata: è una terza colonna, non uno sconto.
- **Generalizzare, non aggiungere due bandierine.** Oggi le tipologie sono
  `alimentare`, `bevande`, `logistica` più l'attrezzatura. La forma giusta è una
  mappa per categoria (`{ logistica: 'fuori', attrezzatura: 'dividi', … }`), così
  domani una categoria nuova non richiede codice nuovo.
- **Nel resoconto e nell'export** la riga «fuori conto» deve comparire con la
  sua cifra e il suo perché, altrimenti il messaggio nel gruppo racconta un
  campo più economico di quello vero.

### Prove che servono, prima di dire fatto

- Con una voce spenta: le quote scendono di esattamente quella cifra, la somma
  dei saldi resta a zero, e **non** compare l'avviso del buco.
- La cifra spenta è dichiarata a schermo e nel resoconto.
- A conti chiusi l'interruttore non si muove.

## 9. Form di creazione della stanza e inviti (link, WhatsApp, email)

**Obiettivo:** chi crea il campo riempie un modulo, e da lì manda l'invito agli
altri senza far digitare niente a nessuno. È il passo che decide se un gruppo
poco tecnologico adotta l'app o la abbandona al primo tentativo.

Dipende da § 1 (account) e § 2 (room): il modulo è l'interfaccia di quel modello
dati, non una cosa a parte.

### Il modulo

Campi, tutti scritti in `rooms/<roomId>`:

- **Nome del campo** (diventa il titolo dell'app per quel gruppo).
- **Date**, inizio e fine: da qui nascono i giorni del calendario.
- **Luogo**: incollando un link di Google Maps si ricavano latitudine e
  longitudine, come si fa già a mano in `firebase-config.js` per
  `window.CAMP_LOCATION`. Serve al meteo, e va mostrata anche l'altitudine che
  il modello usa davvero — a 1300 m il meteo del paese in fondovalle è un'altra
  cosa.
- **Password d'ingresso**, mai in chiaro: solo il suo hash (§ 2).
- **Voci di spesa attive** (§ 8), così il gruppo parte già con il conto che gli
  somiglia.

### L'invito

Un link solo, canonico: `.../join?room=K7RX-2MQP`. Da lì, tre strade e un
tasto che le copre tutte:

- **Condividi** (`navigator.share`): su telefono è il tasto giusto, perché apre
  WhatsApp, Telegram, SMS e mail con un gesto. Il meccanismo esiste già in casa
  — l'app lo usa per il PDF ricordo e per il resoconto delle spese.
- **WhatsApp** (`https://wa.me/?text=…`): il canale vero di questi gruppi. Anche
  questo già usato dall'app per il resoconto, quindi è codice noto.
- **Email** (`mailto:?subject=…&body=…`): non serve nessun backend e funziona
  anche da computer. Una mail *vera*, spedita dal server con il logo, è un'altra
  cosa: richiede Cloud Function e un provider, e ha senso solo se serve un
  invito verificato o tracciato.
- **QR** per chi è nella stessa stanza fisica (già previsto in § 2).

### Le due decisioni da prendere prima

**La password dentro il link.** Comodissimo — un tap e sei dentro — ma un
messaggio WhatsApp si inoltra, e con esso l'ingresso al campo. La strada pulita
è un **invito monouso a scadenza**:

```
rooms/<roomId>/invites/<token>
  createdBy, createdAt, expiresAt, maxUsi, usatoDa[]
```

Il link porta il token, non la password; `joinRoom` lo consuma e scrive
`members/<uid>`. Per un campo fra amici la password nel link è probabilmente
accettabile, ma deve essere una **scelta dichiarata**, non il risultato del fatto
che era più veloce da scrivere.

**Chi ha accettato.** Con `mailto:` e `wa.me` l'app non sa niente di cosa è
successo al messaggio: nessuna conferma di consegna, nessuna lettura. Se chi
amministra deve vedere «invitati 12, entrati 9», quell'informazione può venire
solo dalla collezione `invites` qui sopra. Senza di essa il modulo funziona
ugualmente, ma quella schermata non si può fare.

### Il vincolo che resta

L'invito **non deve poter scavalcare la verifica server-side** di § 2. Il link
pre-compila l'ID della room e, se c'è, porta il token: l'ingresso lo decide
sempre la Cloud Function. Un client che si scrive da solo in `members` è un
campo aperto a chiunque.

### Dove sta il confine gratis/Pro

Il numero di room create è il limite naturale (una gratis, più di una nel piano
Pro), coerente con la regola di § 6: **si limita la quantità, mai la
correttezza.** Gli inviti, invece, non si limitano: un campo con metà gruppo
fuori non è un campo a metà, è un campo che non funziona.

---

## 10. Verifiche su iPhone — fatte ad agosto 2026

**Le 70 prove girano tutte su Chromium**, quindi su iOS l'unica prova possibile
è un telefono in mano. È stata fatta durante il campo 2026, e **funziona**.

Era la voce in cima all'ordine di lavoro, perché è l'unica che poteva rendere
**invisibile** tutto il resto: se su iOS il service worker non si aggiorna, ogni
rilascio successivo è lavoro che metà gruppo non riceve, e il sintomo è identico
a «il codice è sbagliato». Quel dubbio è chiuso: durante il campo sono stati
pubblicati diversi aggiornamenti e sono arrivati.

Verificato a mano:

- **L'aggiornamento del service worker** — il punto che contava.
- **Le strisciate del gioco**: la L con un dito solo, senza staccare.
- **Installazione a Home e avvio a schermo intero.**

**Resta fuori una cosa sola, e non per dimenticanza:** l'avviso arancione di
memoria piena non si prova a comando, perché richiede un telefono davvero pieno
— su iOS la quota di `localStorage` è più stretta e si tocca prima. Quel
percorso è coperto dalla prova `e2e/quota`, che simula il rifiuto delle
scritture e controlla che l'app regga invece di sparire; su Chromium, però. Se
capita di avere fra le mani un iPhone quasi pieno, è l'occasione per guardare.

**Quando va rifatta:** ogni volta che si tocca `sw.js` o `build.js`. Sono i due
file che decidono se un rilascio arriva o resta in cache, e sono anche quelli
che il § 14 (spezzare i sorgenti) rischia di muovere.

## 11. Coda foto — chiusa (19 agosto 2026)

**Questa voce era sopravvalutata, e la sopravvalutazione era nostra.** Diceva
che la promessa «partono da sole appena la linea regge» ha un asterisco.
Verificando il codice riga per riga:

- `codaFoto` (`firebase-sync.js:358`) **è un array in memoria**: vero.
- Ma si riempie solo nel ramo `catch` di `putPhoto`, cioè su errori veri
  (permessi, documento oltre il megabyte, SDK in stato cattivo) — casi in cui
  ritentare non aiuta comunque.
- Alla caduta di rete `setDoc` **non rifiuta**: resta in sospeso e la scrittura
  vive nella coda persistente di Firestore (`persistentLocalCache`,
  `firebase-sync.js:116`), che è già su IndexedDB.
- E soprattutto `addPhotos` (`src/80-app.jsx:1923`) **rifiuta il caricamento
  senza linea**. Al campo non si aggiungono foto: lo scenario «l'app muore e la
  coda con lei» non è raggiungibile.

**Decisione (§ 15-bis.4): la galleria resta online e la voce si chiude.** Le
foto vivono solo nel cloud per non mangiare il `localStorage` che serve a
presenze e conti; si caricano a casa.

**Una riga aggiunta al messaggio, ed era l'unica cosa che mancava.** Il testo
già diceva «*puoi chiudere l'app, ma non prima che la spia smetta di dire "da
inviare"*»: quindi non prometteva nulla di falso. Diceva però solo **cosa fare**,
non **cosa si perde** a non farlo. Ora aggiunge che quella coda vive finché
l'app è aperta e che, chiudendola prima, le foto vanno riprese dal rullino.

*(Nota per chi legge fra sei mesi: la prima stesura di questa sezione diceva che
il messaggio «prometteva» la persistenza. Non era vero — è stato verificato
leggendolo. Vale come promemoria che anche le correzioni vanno controllate
contro il codice, non contro il ricordo che se ne ha.)*

## 12. Ponte Menù → Lista della spesa — fatto (19 agosto 2026)

**Il piano era sbagliato, e sono stati i dati veri a dirlo.** Prevedeva una
tabella di ingredienti per tradurre «pasta al pomodoro» in «pasta, pomodoro».
Guardando i menù scritti davvero al campo 2026:

```
Pranzo :
Pasta funghi e piselli
40 scamorze

Cena :
150 arrosticini
40 COSCE pollo
50 salsiccie
Pannocchie
```

e l'11 agosto: `Vongole: 1,5 kg 6€ al kg`.

**Il menù era già la lista della spesa**, con le quantità e a volte i prezzi.
Nel frattempo la scheda «Da acquistare», che esiste esattamente per quello,
conteneva **cinque voci in tutto**. Non è disciplina che manca: chi pensa al
cibo scrive nel campo che ha davanti.

Quindi niente tabella di ingredienti — la gente scrive già gli ingredienti — e
niente IA. Serve un lettore che riconosca la quantità e proponga la riga.

### Com'è fatto

`menu-spesa.js`, modulo a sé come `sync-merge.js` e `pdf-ricordo.js`: sta fuori
da `src/` perché così è **provabile con una prova unitaria** invece che
duplicando la logica in un test (che è quello che fa ancora
`unita/arrotondamenti`). Espone `vociDalMenu(testo)` e `nuove(voci, giaInLista)`.

Tre forme riconosciute, in ordine di certezza:

| Riga | Nome | Quantità |
| --- | --- | --- |
| `Vongole: 1,5 kg 6€ al kg` | Vongole | `1,5 kg 6€ al kg` |
| `150 arrosticini` | arrosticini | `150` |
| `FIORENTINA 5kg` | FIORENTINA | `5kg` |
| `Pannocchie` | Pannocchie | — |

Le decisioni che contano, tutte prese guardando i menù veri:

- **Quello che segue i due punti resta verbatim, prezzo compreso.** Se chi
  cucina ha scritto `6€ al kg` è un'informazione sua: non tocca a noi buttarla.
- **Il numero in coda vale come quantità solo se ha l'unità attaccata**
  (`5kg`): senza unità, un numero in fondo è più probabilmente parte del nome.
- **Le virgole separano voci diverse solo se non c'è una quantità.** Con una
  quantità non si saprebbe a quale pezzo appartiene, e indovinare lì vorrebbe
  dire sbagliare le quantità della spesa.
- **Niente filtro «non sembra cibo».** Filtrare richiederebbe un dizionario
  alimentare, cioè la cosa che si è deciso di non costruire. `Montaggio serale
  tende etc.` viene proposto come tutto il resto: una spunta da togliere costa
  meno di una voce persa.
- **Propone, non scrive.** Il tasto apre una finestra con le voci spuntate; la
  lista non si muove finché non si conferma. I doppioni si riconoscono dal
  **contenuto** della lista, non dal fatto che il tasto sia già stato premuto.

### Quello che i dati hanno mostrato e che non abbiamo fatto

Negli `appunti` del campo si legge *«Arrosticini Eleonora / Salsicce Leonardo /
Pollo Nunzio / Pecora Ugo»*. È un **terzo bisogno** — chi porta cosa — che
l'app non copre e che la gente sta già gestendo a mano in un campo libero.
Candidato naturale per il prossimo giro.

E il ponte oggi lavora **su un giorno alla volta**. Chi fa la spesa la fa per
tutta la settimana: una versione «tutti i giorni» è un'aggiunta piccola, ma va
decisa guardando come lo usano, non prima.

## 13. Vocabolario dell'interfaccia — bottoni fatti (23 agosto 2026)

Materiale già misurato in `RICOGNIZIONE-UI.md` (9 agosto 2026). **Non è un
redesign**: è dare un nome alle cose che ci sono, ed è il passo che rende
sensato il § 14.

Nell'ordine, perché ogni passo dipende dal precedente:

1. **Colori: quasi niente da fare.** 16 in tutta l'interfaccia, otto fanno il
   99% del lavoro. Due sole correzioni: unire `#1A201A` in `#1F271E` (distanza
   RGB 9,5: a occhio sono lo stesso colore) e riportare `#A9752F` sull'ambra
   vera `#D97706`, che esiste già ed è usata 86 volte.
2. **Bottoni: qui sta il lavoro.** 127 bottoni, 47 forme diverse, una ventina
   delle quali compare **una volta sola**. I ruoli veri sono sei: primario
   pieno, secondario bordato, testuale, distruttivo, riga richiudibile, chip di
   scelta. Le altezze sono sei (`py-1` … `py-3`) per un elemento che ne vuole
   tre.
3. **Testo: da undici misure a cinque o sei**, e la scala scritta da qualche
   parte invece che nella testa. Le misure in pixel (`8/9/10/11/13`) sono 272
   usi decisi a occhio, uno alla volta.

**Il vincolo che decide la forma della soluzione:** Tailwind è vendorizzato e
non c'è build step in produzione (`vercel.json`: `buildCommand: ""`), quindi non
esiste un `tailwind.config.js` dove mettere i token. La strada realistica sono
le **variabili CSS in `index.html`**.

### Il sesto ruolo: il chip di scelta

Dei sei ruoli, cinque erano già nel vocabolario. Mancava quello che non è
un'azione ma **una scelta che resta accesa** — e nel codice erano quindici
forme scritte a mano, tutte con lo stesso schema
`${acceso ? 'verde e bianco' : 'bianco e verde'}` e ogni volta un pixel
diverso: chi `py-2` e chi `py-2.5`, chi `border-b-2` e chi `border-b-4`, chi
`text-white` e chi `text-[#F0F4F1]` — che a occhio sono lo stesso colore.

`bottoneScelta(forma, tono, acceso, misura, extra)`, sui soliti due assi:

| forma | dov'è |
| --- | --- |
| `linguetta` | in quale sezione sto (Totali/Quote/Saldi/Dati, Aspetto, Da acquistare/Acquistato, foto per persona) |
| `interruttore` | una cosa sola, accesa o spenta, a piena larghezza (giorno gratis, ottimizza i passaggi) |
| `spunta` | il chip minuto dei pasti |
| `pillola` | scelta leggera in un gruppo che va a capo (le guide) |
| `giunta` | due chip dentro una cornice sola (Album \| Griglia) |
| `etichetta` | dice cos'è una cosa, non cosa succede (Adulto/Bambino) |

I toni sono sette — `sezione`, `bordato`, `pranzo`, `cena`, `tenue`, `piatto`,
`ambra` — e servono tutti: la stessa forma cambia colore secondo il
significato. Il chip del pranzo è verde e quello della cena è bruno, e non è
un vezzo — sono i due colori con cui l'app distingue i pasti dappertutto.

### Com'è stato dimostrato

Con lo stesso strumento del § 14: si cattura il DOM delle sedici schermate
prima, si migra, si ricattura. Qui però il confronto non può essere carattere
per carattere — il vocabolario rimette le classi nel *suo* ordine — quindi si
confrontano gli **insiemi di classi**, ordinati: una classe in più o in meno
resta una differenza, l'ordine no.

**Tredici schermate su sedici sono identiche classe per classe.** Le tre che
cambiano sono le tre modifiche volute, e sono queste:

- **Presenze** — «Rendi questo giorno gratis» da `py-2` a `py-2.5`: adesso è
  alto come ogni altro comando a piena larghezza.
- **Saldi** — «Ottimizza i passaggi» perde `text-[#F0F4F1]` (era bianco sporco
  dove tutto il resto è bianco) e il bordo da spento passa da `#2D392C/50` al
  sage `#8F9E8B/50`, che è il bordo di ogni altro bottone chiaro.
- **Impostazioni** — il selettore «foto per persona» (3 4 5 7) era l'unico
  `border-b-2` in tutta l'app, alto la metà delle linguette che gli stanno
  sopra. Adesso è una linguetta come le altre.

### Quello che NON è passato dal vocabolario, e perché

**Ventidue bottoni su 124** restano scritti a mano, e non è una dimenticanza:
sono forme che un vocabolario di bottoni non descrive. La casella di un giorno
sul calendario (che ha tre stati, non due), le voci del menu di navigazione, le
caselle di spunta quadrate, le frecce tonde dell'album, le mattonelle delle
foto, la polaroid, il pulsante a tre righe in cima, i riquadri tratteggiati
«aggiungi», e i due bottoni del visore foto — che stanno su fondo nero e con i
colori dell'app diventerebbero illeggibili.

Inventare un ruolo per ognuna significherebbe ricostruire la ventina di forme
usate una volta sola da cui si era partiti. **Il conteggio però è congelato in
`test/unita/compilazione.js`**: se sale, qualcuno ha scritto un bottone a mano
invece di chiedere una parola al vocabolario.

### Il testo: dodici misure, sei (21 settembre 2026)

Non erano più undici: mentre si lavorava ne era nata un'altra, ed è la prova
che il problema non era il numero ma l'assenza di una regola. **449 usi**
decisi a occhio, uno alla volta.

**Dove vive la scala.** Tailwind qui è la build v4 nel browser e non c'è un
`tailwind.config.js` — ma in v4 i token stanno nel CSS. Sei righe di `@theme`
in `index.html`, e da lì nascono utility vere: `text-minuto` (9px),
`text-piccolo` (11), `text-normale` (14), `text-medio` (16), `text-grande`
(18), `text-titolo` (24). Vere davvero, non classi scritte a mano: `leading-snug`
continua a vincere sull'altezza di riga esattamente come prima, che è la
ragione per cui questa strada è stata scelta al posto di un blocco di CSS.

Le altezze di riga non sono inventate: sono quelle che le misure assorbite
avevano già (1.5 ereditata dalle misure in pixel, 20/14 di `text-sm`, 32/24 di
`text-2xl`).

**Cosa si è mosso, e cosa no.** Unire 10 e 11 px era obbligatorio — facevano
gli stessi due mestieri, etichetta maiuscola e nota secondaria, e la differenza
era memoria, non regola. La direzione è stata una via di mezzo: il minimo sale
da 8 a 9, le note secondarie si accorpano a 11, il corpo resta dov'è. Si sono
mossi 149 usi su 449.

**La conseguenza che non era nel piano.** Il merge ha fatto collassare la
quarta misura dei bottoni: `piccolo` esisteva perché aveva il corpo di un
bottone normale con la scritta a 10px invece di 12, e dopo la scala le due
voci erano diventate la stessa identica riga di classi. È stata tolta, e i
suoi 18 posti di chiamata spostati su `normale`. Lo stesso per due delle
cinque misure dei chip. **Non è un effetto collaterale: è la diagnosi di
agosto che arriva a valle** — «sei altezze per un elemento che ne vuole tre».

**Il confronto del DOM qui non serve a niente**, ed è la differenza con gli
altri due punti: i nomi delle classi cambiano ovunque per definizione, quindi
lo strumento diventa cieco proprio dove servirebbe. La rete è un'altra
(`e2e/scala-testo`), e guarda quello che vede il browser: che i token valgano
quello che dichiarano, che nessuna schermata trabocchi di lato a 360 px, e
**quante misure il browser disegna davvero** — che è la definizione operativa
di «fatto». Sono sei.

Un token scritto male è il pericolo vero: non rompe niente, l'elemento eredita
la misura del genitore e l'app resta in piedi con i caratteri sbagliati. Il
sabotaggio lo ha confermato — `text-piccolo` diventava 16px in silenzio.

**Un difetto trovato dalla prova.** A 360 px la scheda «Spese Totali → Dati»
usciva dallo schermo di 18 px. Non era la scala: era il messaggio d'errore di
Firebase, che contiene un indirizzo — una parola lunghissima che non va a capo
— dentro un flex senza `min-w-0`. Quella riga non poteva restringersi e
spingeva fuori tutta la schermata. C'era da sempre, e si vedeva solo su un
telefono stretto e solo quando il cloud falliva davvero: il pixel in più l'ha
fatta uscire allo scoperto.

## 14. Spezzare i sorgenti — il disegno e la parte isolata dello stato sono fuori

**Era un file solo da 8.080 righe.** Il 17 agosto 2026 è diventato otto
sorgenti in `src/`, incollati da `build.js` nell'ordine dichiarato lì:

| Sorgente | Righe | Contenuto |
| --- | --- | --- |
| `1-fondamenta.jsx` | 267 | React dal globale, utility, memoria locale, istantanee, registro |
| `2-blocco-password.jsx` | 68 | impronta PBKDF2 della password del campo |
| `3-tema-e-formati.jsx` | 66 | tema, `uid`/`money`/`posNum`, IBAN e PayPal |
| `4-configurazione.jsx` | 164 | marchio, funzioni attive, date, tipologie, meteo, regole |
| `5-gioco.jsx` | 1.083 | "Aiuta Bandy" per intero: non tocca i conti |
| `6-schermata-blocco.jsx` | 114 | `LockScreen` |
| `7-app.jsx` | 6.315 | `function App()` |
| `8-avvio.jsx` | 3 | il mount di React |

**Come è stato fatto senza rischiare niente.** Il taglio è stato puramente
meccanico: nessuna riga spostata, nessuna riordinata, solo confini messi dove il
file aveva già i suoi stacchi. Questo permette la prova più forte che esista per
un lavoro del genere — **il codice compilato è rimasto identico al byte**
(423 KB), quindi mandarlo in produzione non ha cambiato nulla per nessuno.
L'unica differenza in `App.js` è la riga di intestazione, che ora dice da dove
viene.

**Le due regole nuove, e la loro difesa.** I sorgenti non sono moduli: niente
`import`, un ambito solo, quindi l'ordine è una regola. `build.js` si ferma se
trova in `src/` un file che nessuno ha elencato (sparirebbe dall'app senza
rompere niente, che è il modo peggiore), e `unita/compilazione` controlla anche
i due estremi — React va preso in testa, il mount deve stare in coda.

### Secondo taglio: il disegno delle schede (18 agosto 2026)

Le quattordici schede — Calendario, Menu', Presenze, Spese Totali, Lista della
Spesa, Attrezzatura, Membri, Regole, Dotazioni, Galleria, Archivio, Aiuta
Bandy, Come funziona, Impostazioni — sono uscite da `App()` in sei sorgenti:

| Sorgente | Righe | Schede |
| --- | --- | --- |
| `81-schede-giorno.jsx` | 573 | Calendario, Menu', Presenze |
| `82-schede-conti.jsx` | 932 | Spese Totali, Lista della Spesa, Attrezzatura |
| `83-schede-gruppo.jsx` | 243 | Membri, Regole, Dotazioni |
| `84-schede-album.jsx` | 224 | Archivio, gioco, guida |
| `85-scheda-galleria.jsx` | 284 | Galleria |
| `86-scheda-impostazioni.jsx` | 520 | Impostazioni |

**`80-app.jsx` passa da 6.315 a 3.887 righe.** Contando dall'inizio: un file
solo da 8.080 righe è diventato quindici sorgenti, e il più grande è meno della
metà dell'originale.

### Non sono componenti React, ed è voluto

Ogni scheda è una **funzione che restituisce JSX** e riceve le dipendenze in un
oggetto: `schedaGalleria({ photos, picked, addPhotos, … })`. Convertirle in
componenti avrebbe aggiunto un confine di riconciliazione per scheda — un
cambio di comportamento, non una pulizia. Così invece l'albero prodotto è
identico, e questo permette la prova più forte:

> Si cattura il DOM di tutte e sedici le schermate, si sposta il codice, si
> ricattura. I due HTML devono essere **identici al carattere**.

Lo strumento sta in `test/lib/schermate.js` e va usato a ogni prossimo
spostamento. Il taglio di agosto è passato così su tutte e sedici.

### L'elenco delle dipendenze è il risultato, non l'effetto collaterale

`App()` aveva **329 variabili locali** e ogni scheda ne pescava quello che le
serviva senza dichiararlo. Ora ogni scheda ha in cima l'elenco di ciò che usa:
Calendario 20, Presenze 24, Spese Totali 28, Lista 40, Impostazioni 41.
Regole zero — l'unica che si disegna da sola.

Quei numeri sono la misura di quanto lavoro resta, e la lista della spesa per
il prossimo passo: finché una scheda ne chiede quaranta, non è un modulo.

### Terzo taglio: lo stato esce come hook (23 agosto 2026)

Il disegno era uscito, lo stato no. I primi due mucchi:

| Sorgente | Righe | Cosa si porta via |
| --- | --- | --- |
| `75-usa-gioco.jsx` | 55 | 4 variabili di stato, la classifica, inizio e fine partita |
| `76-usa-galleria.jsx` | 250 | 12 variabili di stato, un riferimento, l'ascolto delle miniature, il caricamento, l'album e il PDF ricordo |

**Perché si è cominciato da lì.** Il gioco è l'unica parte dell'app che non
tocca i conti: se qualcosa va storto si vede subito e non si porta via una
presenza. La galleria è la seconda per lo stesso motivo — dodici variabili di
stato e dodici gestori che stavano in mezzo ai conti senza avere niente a che
farci.

**`80-app.jsx` passa da 3.979 a 3.734 righe.** Non è il numero che conta: è che
`usaGalleria` riceve **tre cose** — la scheda aperta, lo stato della linea e i
giorni del campo — e non vede nient'altro di `App()`.

### Sono hook, non componenti — e stavolta la differenza è la prova

Un componente aggiungerebbe un confine di riconciliazione: cambierebbe
**quando** le cose si ridisegnano, che è un cambio di comportamento e non una
pulizia. Un hook no. Ed è proprio questo che permette la prova:

> **DOM identico al carattere su tutte e sedici le schermate**, prima e dopo,
> per tutti e due gli spostamenti.

Lo strumento adesso è completo e sta nel repository: `test/schermate-confronto.js`
fotografa e confronta, e `test/lib/schermate.js` stabilizza ciò che cambia da
solo. Il primo confronto ha segnalato una differenza che non c'era — «Versione
installata» in Impostazioni, che a volte mostra l'impronta e a volte un
trattino secondo quando il service worker fa in tempo a registrarsi. Uno
strumento che dà falsi allarmi si smette di guardarlo, quindi quella riga è
stata neutralizzata.

### Le due regole della divisione, e la guardia che le tiene

    gli HOOK  (7*-usa-*.jsx)   tengono lo stato e NON disegnano
    le SCHEDE (8[1-9]-*.jsx)   disegnano e NON tengono stato

`test/unita/compilazione.js` controlla tutte e quattro le cose: nessun hook
disegna, nessuna scheda tiene stato, gli hook stanno **prima** di `80-app.jsx`
(li si chiama mentre `App()` si disegna, quindi devono già esistere) e vengono
davvero chiamati — un hook dichiarato e mai usato è codice morto che sembra
lavoro fatto. Tutte e quattro viste fallire prima di essere credute.

### Quello che resta

Dentro `80-app.jsx` restano stato, effetti, conti e gestori delle aree che
**toccano i soldi**: presenze, spese, sincronizzazione, saldi. Sono il pezzo
grosso e il pezzo delicato, e vanno staccati uno alla volta con la stessa
prova. L'ordine sensato, dal più isolato al più intrecciato:

1. **`usaArchivio`** — archivi, chiusura del campo, esporta/importa: legge
   tutto ma è letto da poco;
2. **`usaListaSpesa`** — voci da acquistare, acquisti, scontrini, il ponte dal
   menù (§ 12);
3. **`usaPresenze`** — presenze e blocchi dei giorni;
4. **`usaSincronizzazione`** — l'ascolto del cloud, la fusione, la diagnostica:
   per ultimo, perché è l'unica parte che ha già cancellato il lavoro di
   qualcuno una volta.

### I conti fuori da `App()` — fatto (24 agosto 2026)

**`conti.js`, 384 righe, fuori da `src/`** come `menu-spesa.js` e
`magazzino-foto.js`. `calculateTotals` sembrava un metodo e invece era una
funzione pura travestita: legge **sei** cose — membri, presenze, acquisti,
attrezzatura, giorni a conto separato, giorni gratis — e nient'altro. La
settima, l'esenzione dall'attrezzatura, era una configurazione letta dall'aria
(`FEATURES`): adesso si passa, perché una funzione che decide dei soldi non
deve guardare cose che il chiamante non vede.

`80-app.jsx` scende a **3.396 righe** (era 8.080).

**La prova, che è il vero motivo per cui si fa.** Finora i conti si potevano
guardare solo a schermo, dentro una prova end-to-end che leggeva una cifra
scritta da qualche parte: bastava che l'interfaccia cambiasse una riga perché
diventasse cieca, o rossa senza motivo. Adesso c'è
`test/unita/conti-campo-2026.js`, che fa girare **il campo vero del 2026** —
59 persone, 7 giorni, 35 spese, due casse — e controlla i numeri di chiusura in
centesimi di secondo invece che in venti secondi di browser.

I dati stanno in `test/fixture/campo-2026.json`: **numeri intatti, nomi
sostituiti**. Nomi di persone vere non entrano nel repository, nemmeno dentro
le descrizioni delle spese («Spesa di X»), e i conti non se ne accorgono —
il nome è un'etichetta, quello che conta sono presenze e prezzi.

**Sei sabotaggi, sei rossi.** Ognuno è una regola del progetto:

| se si rompe questo | quante prove diventano rosse |
| --- | --- |
| la logistica la paga chiunque abbia un pasto | 8 |
| i bambini contano come adulti | 7 |
| la cassa separata si scioglie in quella comune | 10 |
| niente arrotondamento a 10 centesimi | 6 |
| l'ottimizzatore non ottimizza | 2 |
| il divisore dell'attrezzatura è sbagliato | 1 |

E due sabotaggi **non** hanno fatto niente, il che è la parte più utile: la
regola «logistica solo ai giorni comuni» è difesa da due strati indipendenti, e
rompere quello interno non basta. Il primo tentativo l'aveva mancata; la prova
adesso chiede anche il divisore dell'attrezzatura, che era il buco.

**Una cosa che credevo e non era vera.** Pensavo che ottimizzando i passaggi
girassero gli stessi soldi. Non è così: girano **meno** soldi (1.073,93 € invece
di 1.110,74 €), perché chi è creditore in una cassa e debitore nell'altra si
compensa da solo invece di fare due bonifici incrociati. Quello che non cambia
non è il totale dei bonifici, è la **posizione** di ognuno — e infatti nessuno
si sposta di più di un arrotondamento. La prova adesso dice quella, che è la
cosa vera.

### Quarto taglio: gli scontrini (20 settembre 2026)

**`77-usa-scontrini.jsx`, 147 righe.** È il seguito naturale del § 19: le foto
non stanno più in `localStorage` ma nel magazzino, e tutto quello che serve a
farle vivere — la migrazione dalla vecchia chiave, la scrittura del solo
cambiamento, la fila delle scritture, la potatura delle orfane, l'arrivo dal
cloud, lo scatto — era sparso in mezzo ai conti.

Riceve **tre cose**: le tre liste che possono avere uno scontrino (acquisti,
da acquistare, attrezzatura). Servono a una sola domanda — *quali foto non
appartengono più a niente* — e se se ne dimentica una, le foto di quelle voci
spariscono al primo giro. È già successo.

`80-app.jsx` scende a **3.279 righe**. DOM identico al carattere su tutte e
sedici le schermate; e siccome il confronto del DOM non scatta fotografie, ho
rifatto anche le cinque prove che le foto le toccano davvero
(`magazzino-foto`, `scontrino`, `galleria`, `chiusura`, `tenuta`).

### Quello che resta, e perché non è più una fila

Restano le aree che toccano i soldi. Ma **non tutte si staccano allo stesso
modo**, e il § 14 fin qui ha insegnato a distinguere due casi:

- **Stato isolato → hook.** Gioco, galleria, scontrini: poche dipendenze in
  ingresso, molto stato in uscita. Si dimostra col DOM identico.
- **Logica pura → file fuori da `src/`.** I conti: nessuno stato, sei
  ingressi, e una prova unitaria sui numeri veri che vale più di qualunque
  prova a schermo.

### Quinto taglio: le regole delle presenze (20 settembre 2026)

**`presenze.js`, 123 righe**, accanto a `conti.js`. Era la prova che la scelta
del *modo* conta più della fatica: un `usaPresenze` che si portasse dietro lo
stato avrebbe ricevuto `campData`, `members`, `blocchi`, `freeDays`, `sepDays`
e i loro cinque setter — **dodici dipendenze per togliere quattro variabili**.
Non avrebbe staccato niente.

Quello che si stacca bene è la parte **pura**, e sono le regole da cui
dipendono le quote: `giorno`, `pasto`, `blocco`, `applicaBlocchi`, `conBlocco`,
`giorniBloccatiDi`, `orfane`. In `App()` restano i gestori — i tasti, i modali,
le conferme — che ora rinviano lì. `80-app.jsx` scende a **3.237 righe**.

**`test/unita/presenze.js`, 26 verifiche, due fonti e due mestieri:**

- il **campo vero** prova che su dati sani non si inventa niente — zero
  presenze orfane, e 413 pasti letti identici a quelli nei dati. Un falso
  allarme qui manderebbe venti persone a cercare un problema che non c'è;
- i **guasti costruiti a mano** provano quello che nel 2026, per fortuna, non
  è capitato: un id rimasto orfano dopo un'eliminazione, una voce a zero che
  non è una presenza, un blocco scritto male, una riparazione d'identità su un
  giorno chiuso.

Sei sabotaggi, sei rossi. Il più istruttivo: `applicaBlocchi` deve restituire
**lo stesso oggetto** quando non c'è niente da correggere — uno nuovo a ogni
giro farebbe ripartire all'infinito gli effetti che lo guardano.

E una correzione alla prova stessa: rompendo `conBlocco` moriva con un
`TypeError` invece di dire quale regola si era rotta. Adesso legge in modo
difensivo e il guasto ha un nome.

**L'archivio no, in nessuno dei due modi.** Sembrava il candidato più facile —
«legge tutto ma è letto da poco» — e invece è il peggiore: `closeCamp` e
`importData` *scrivono* dodici stati diversi. Un hook che si porta dietro venti
setter non ha staccato niente, ha solo spostato le righe.

### Sesto taglio: le decisioni della sincronizzazione (20 settembre 2026)

**`allarmi.js`, 81 righe.** La sincronizzazione è la parte che ha già
cancellato il lavoro di qualcuno una volta, e si tocca con cautela. Per questo
è uscito **quello che decide**, non quello che collega:

- **quando un orologio è sballato** — la data più alta che arriva dall'altro
  telefono, confrontata con la nostra. Qui è solo l'avviso: il freno vero sta
  in `sync-merge.js` e frena l'orologio locale, mai il confronto fra due voci;
- **quando una perdita merita un allarme** — e questa è la regola che nasce da
  un guaio vero.

Togliere un membro cancella anche le sue presenze di tutti i giorni: un gesto
solo che produce **sette «voci perse»**. Un telefono rimasto indietro le
scopriva tre giorni dopo e gridava al disastro per una cosa che nessuno stava
perdendo. La regola guarda **quando**, non solo quante, e conta solo la
raffica più recente — le lapidi di un gesto solo portano tutte lo stesso
istante.

**`test/unita/allarmi.js`, 25 verifiche**, fra cui quel caso esatto: sette voci
di tre giorni fa non sono un allarme; le stesse quattro di trenta secondi fa lo
sono. Sei sabotaggi, sei rossi.

Il più istruttivo è il sesto, perché al primo tentativo **non** diventava
rosso: avevo provato con `'domani'` e `null`, che in JavaScript perdono
comunque il confronto. Il valore davvero cattivo è una data arrivata come
**stringa di cifre** — `'9999999999999' > 0` è vero — e senza il controllo del
tipo l'app avrebbe detto a tutti di avere l'ora sbagliata di trecento anni.

### Quello che resta della sincronizzazione, e perché resta lì

Fuori sono le decisioni. Dentro `App()` restano il collegamento, gli stati
(`cloud`, `lostSync`, `orologioFuori`) e `applyRemote`, che è **97 righe e
chiama 16 setter**.

Quei 16 sono il punto. Un `usaSincronizzazione` che se li porti dietro è
l'errore già visto due volte — l'archivio, le presenze. Si potrebbe ridurli a
uno solo passando un `applicaStato(nuovoStato)` che fa il ventaglio da `App()`,
e a quel punto l'hook avrebbe quattro dipendenze: è fattibile, e va deciso
guardando cosa ci si guadagna.

**Quello che ci si guadagna è meno di quanto sembri.** Le decisioni sono già
fuori e provate; quello che resta è idraulica, ed è idraulica in un posto solo.
La prova del DOM identico **non copre** la sincronizzazione — la cattura non si
collega a nessun cloud — quindi l'unica rete sarebbero le sei prove end-to-end
(`perdita`, `sovrascrittura`, `riaggancio`, `tenuta`, `oracolo`, `verdetto`).
Sono buone, ma spostare 250 righe del codice più pericoloso dell'app per
guadagnare righe, e non chiarezza, non è un affare.

**Si rifarà quando ci sarà un motivo vero**, e ce n'è uno in arrivo: il § 2
(le room) cambia proprio questa parte. Allora si sposta *mentre* la si cambia,
con una ragione, invece di spostarla adesso per simmetria.

### Dove siamo

| | righe |
| --- | --- |
| all'inizio, un file solo | 8.080 |
| `src/80-app.jsx` oggi | **3.229** |
| fuori: conti, presenze, allarmi | 588 |
| hook: gioco, galleria, scontrini | 452 |
| schede | 2.861 |

Da rifare quando si tocca: le **verifiche su iPhone** (§ 10), perche' un
sorgente nuovo cambia `App.js` e quindi `CACHE_NAME`.

## 15. Notifiche push

**Ultima, e con una domanda aperta davanti.**

Tecnicamente: FCM + Cloud Functions, quindi **piano Blaze** (a consumo) e un
server — cioè dopo § 1 e § 2. Su iOS le notifiche web arrivano solo se l'app è
installata a Home, il che la lega al § 10.

Ma prima del come, il cosa: **che cosa vale la pena notificare a venti persone
che sono in mezzo a un prato con il telefono spento per risparmiare batteria?**
«Mancano le tue presenze di ieri» forse. «Qualcuno ha aggiunto una spesa» quasi
certamente no. Il rischio concreto è costruire la funzione più costosa della
lista per poi spegnerla al primo campo.

**Va tenuta ultima anche per questo:** dopo un campo vero con la versione
pubblica si saprà quali sono i due o tre momenti in cui qualcuno *ha davvero
aspettato* un avviso. Prima di allora è una risposta senza domanda.

---

## 15-bis. Le cinque decisioni (19 agosto 2026)

Le cinque domande aperte della revisione hanno avuto risposta. Quattro sono
accettate, una è respinta, e due hanno un dettaglio da correggere prima di
essere messe in pratica.

### 1. Il confine gratis/Pro — accettato a metà

**Accettato:** nel piano Pro vanno l'**export del resoconto in PDF/Excel** (è il
momento «fine campo, archivio tutto», quello in cui l'organizzatore sente
davvero la mancanza) e le **foto degli scontrini** — che sono anche il primo
costo d'infrastruttura, quindi il prezzo segue la spesa. Buona economia.

**Respinto: il conto separato non si vende.** Un gruppo che fa una serata a
parte e non può separarla ottiene **quote sbagliate**, o rifà i conti a mano.

> **Si limita la quantità, mai la correttezza** (§ 6, § 7).

Non è una regola di stile: un utente gratuito che ottiene numeri errati non
pensa «mi manca il Pro», pensa che l'app non funzioni — e l'unica cosa che
questa app vende è che i conti tornano. Al campo 2026 il conto separato
riguardava 314 € su 2.303: senza, quei soldi sarebbero finiti addosso a chi
era arrivato dopo.

Al suo posto, come limite di quantità: numero di campi archiviati consultabili,
numero di foto, formati di export.

**E una cosa che non si tocca mai:** *Impostazioni → Backup Dati → Esporta*
resta gratuito per sempre. È il JSON dei dati dell'utente, non un nostro
servizio: metterlo dietro un pagamento è ostile e, con utenti europei, è un
problema di portabilità dei dati. Il **resoconto bello** si vende; **i dati
propri** no.

### 2. Stripe dal browser invece di Play Billing — accettato con avvertenza

L'economia è giusta: niente 15%, niente Digital Goods API dentro una TWA.

**Ma «app gratuita su Play + sblocco Stripe dentro la stessa app» è il modo
classico di farsi togliere dallo store.** La policy sui pagamenti di Google
chiede Play Billing per i beni digitali consumati nell'app. In Europa il quadro
si sta muovendo (DMA, offerte esterne), ma è una questione aperta, non una
strada sicura.

Le vie senza rischio sono tre: non pubblicare su Play e restare PWA pura;
pubblicare su Play un'app **senza** funzioni a pagamento; oppure accettare Play
Billing. **La decisione si può rimandare**, perché fino a fine 2027 non c'è
niente da vendere (vedi qui sotto) — ma non va data per risolta.

### 3. Open Beta gratuita per l'estate 2027 — accettato

Risolve il conflitto fra calendario e collaudo: il primo campo estivo vero di
altri gruppi avviene sotto l'etichetta «beta», le aspettative sono corrette, e
si comincia a pagare solo dopo che ha funzionato. Versione 1.0 a pagamento a
fine 2027.

**Con un limite:** in beta si perdona una foto persa, non un conto sbagliato.
La reputazione sui numeri si perde una volta sola, etichetta o non etichetta.

### 4. Il § 11 si chiude — accettato

La galleria resta online. Il motivo sta già scritto nel codice: le foto vivono
solo nel cloud per non mangiare il `localStorage` che serve a presenze e conti.
Si caricano a casa.

**Fatto:** il messaggio già avvisava di non chiudere l'app prima che la spia si
spegnesse — quindi non prometteva il falso. Ora dice anche **cosa si perde** a
non dar retta all'avviso: quella coda vive finché l'app è aperta, e le foto
vanno riprese dal rullino.

### 5. Tetto di spesa su Blaze — accettato, ma non così

Il meccanismo è giusto (budget di Cloud Billing → Pub/Sub → Cloud Function).
**L'azione proposta no:** spegnere il database a 5 € di spesa significa
fermare l'app a tutti i gruppi, e con ogni probabilità nel momento peggiore —
la sera in cui si chiudono i conti.

- **Avvisi a soglie crescenti** (50%, 90%, 100% del budget) che arrivano a chi
  amministra: quella è la difesa.
- **Interruzione automatica solo come ultima spiaggia**, e degradando le vie
  non essenziali (caricamento foto) prima di quelle vitali (documento dei conti).
- 5 € è un'ottima soglia di **allarme**, pessima di spegnimento.

L'app regge comunque: è offline-first, e un blocco del cloud non ferma i conti
sul telefono. Ma non deve mai accadere in silenzio.

## 16. Le due app: la nostra e la pubblica

**Decisione presa il 18 agosto 2026.** L'app della Brigata resta nostra e non
diventa un cliente della versione pubblica. Accanto nasce una **sorella
pubblica**, da mettere su Google Play.

### Un codice solo, due configurazioni — non un fork

La tentazione è copiare il repository, togliere il marchio e far evolvere le due
cose separatamente. Costa poco oggi e tantissimo per sempre: ogni correzione va
applicata due volte, e in pochi mesi le due versioni smettono di assomigliarsi
abbastanza perché applicarla due volte diventi difficile.

La strada è l'altra, ed è **già mezza costruita**:

- il marchio è fuori dal codice (`window.APP_CONFIG.brand` in
  `firebase-config.js`);
- gli interruttori esistono (`window.APP_CONFIG.features = { auth, rooms }`,
  oggi spenti).

Quindi: **un repository, un ramo, due progetti Vercel** che pubblicano lo stesso
codice con due `firebase-config.js` diversi.

| | La nostra | La pubblica |
| --- | --- | --- |
| `brand` | Brigata Fabio Bandone | nome neutro |
| `auth` / `rooms` | `false` | `true` |
| Ingresso | password del campo | account + room |
| Progetto Firebase | il nostro | separato |

> **La regola che tiene in piedi tutto: la differenza fra le due app deve essere
> configurazione, mai codice.** Il primo `if (isBandone)` scritto nel sorgente è
> l'inizio del fork, solo più lento da riconoscere.

### Il vantaggio che nessun concorrente ha

Tenendo un codice solo, **il nostro campo diventa il collaudo annuale della
versione pubblica**: cinquantanove persone, una settimana, senza linea, con
soldi veri. Nel 2026 ha già trovato l'orologio del meteo, il blocco delle
presenze che non bloccava, e la logistica addossata a chi non c'era. Nessuna
suite di prove trova quelle cose; un campo sì.

Se invece si forka, quel collaudo smette di valere per la pubblica il giorno
dopo la divisione.

### Che cosa è davvero lavoro nuovo

Il database non è la parte difficile (§ 4: si resta su Firestore). Lo sono
queste, in ordine di gravità:

1. **Un confine di sicurezza vero.** Oggi tutti i campi condividono un utente
   Firebase e regole permissive: va bene per un gruppo, **non** per un'app
   pubblica, dove significa che chiunque può leggere il campo di chiunque. È il
   `joinRoom` server-side del § 2 con le regole legate a `members`. È il pezzo
   di lavoro nuovo più grosso, e non è negoziabile.
2. **Le foto fuori dai documenti**, su storage a oggetti (§ 4).
3. **Cancellazione dell'account** — richiesta da Google Play e dal GDPR.
4. **Privacy policy vera.** Non è una formalità: l'app tiene nomi, chi ha
   mangiato con chi, chi deve soldi a chi, e foto di scontrini che a volte
   portano le ultime cifre di una carta. Servono anche la scheda "Sicurezza dei
   dati" di Play e una base giuridica per il trattamento.
5. **Nome e logo neutri.**

### L'ordine che eviterebbe l'errore classico

L'errore è costruire l'app pubblica e poi cercare gli utenti. Il modo di
sbagliare di questo prodotto non è «non la scarica nessuno»: è **«un gruppo l'ha
usata per una settimana e i conti non tornavano»**. Quello lo si scopre con un
gruppo vero, non con una scheda sullo store.

1. Rendere l'app capace di room **dietro gli interruttori spenti** (§ 1, § 2):
   il nostro campo continua a funzionare esattamente come oggi.
2. Accendere gli interruttori per **un altro gruppo vero** — un altro reparto —
   la prossima estate. Beta chiusa con utenti veri, offline vero, soldi veri.
3. **Solo dopo** pubblicare su Play (§ 3).

Fra il punto 2 e il punto 3 c'è un campo intero, cioè un anno. È lento e va bene
così: l'unica cosa che questa app vende è che i conti tornano, e quella
reputazione si perde una volta sola.

### Il campo 2026 come misura

Numeri veri di chiusura, utili a dimensionare la versione pubblica:

- **59 membri** (39 adulti, 20 bambini), 219 pasti su 7 giorni, punta di 48
  persone il 15 agosto — **tre volte il gruppo su cui l'app era stata pensata**,
  e ha retto;
- **2.303,59 €** di spesa, 2.303,60 € raccolti, **nessun buco**;
- due casse: comune 1.989,50 €, separata 314,10 € (i giorni 11–13), che chiudono
  ognuna per conto suo;
- 35 passaggi per cassa, **30 ottimizzati**;
- export completo **3,2 MB**, di cui 3,18 MB sono 29 foto di scontrini: la
  conferma che il peso dell'app sono le immagini, non i dati.

---


## 17. Compiti assegnati — fatto (20 settembre 2026)

**Il bisogno è dimostrato, come per il § 12.** Negli `appunti` del campo 2026 si
legge, scritto a mano in un campo libero:

```
Arrosticini Eleonora
Salsicce/pancetta Leonardo
Pollo/Nunzio
Pecora/Ugo
```

e il giorno prima: `Carne da ritirare: Federica`, `Leo portare formaggio`.

### Cos'era davvero, e perché il primo modello era sbagliato

La prima lettura di queste righe è stata «roba portata da casa, quindi fuori
dalla cassa». **Sbagliato.** Erano **compiti concordati e già pagati**: ci si
divideva chi comprava cosa, prima di partire. Non è una terza colonna accanto
a Menù e Lista: è **il passaggio che manca prima della Lista**, cioè
*l'assegnazione*.

Questo cambia tre cose:

1. **Il compito ha un assegnatario, non un pagatore.** Chi lo esegue è quasi
   sempre anche chi anticipa i soldi, ma sono due fatti diversi: il compito si
   assegna prima, la spesa si registra dopo, col prezzo che si scopre in cassa.
2. **Il compito non è mai fuori dai conti.** Un compito eseguito produce una
   spesa normale, con acquirente e prezzo, che finisce nelle casse come tutte
   le altre. Il modello «portato da casa, non si divide» non descriveva quello
   che succedeva davvero.
3. **Serve un ciclo, non un campo.** Assegnato → fatto → registrato. Le tre
   righe sopra erano assegnazioni; le spese che ne sono nate stanno già in
   `purchases`. Oggi le due cose non si toccano e nessuno sa quale compito è
   ancora scoperto.

### Com'è fatta la scheda

Compiti **completamente editabili**: il testo lo scrive chi assegna, e può
essere qualunque cosa — comprare un cibo, comprare un'attrezzatura, prenotare
un servizio, ritirare qualcosa. Nessun elenco chiuso di tipi: al campo servono
cose che oggi non sappiamo prevedere, e un elenco chiuso costringe a scrivere
tutto in «altro».

- **Assegna il gestore della Room**, a **un membro già inserito**, con la
  solita tendina (`renderBuyerSelect`). Nomi scritti a mano no: è lo stesso
  problema che i saldi hanno già oggi con gli acquirenti liberi.
- **Stati**: da fare / fatto. Niente di più. Un terzo stato («in corso») è
  la cosa che in ogni gestionale nessuno aggiorna mai.
- **Il legame con la spesa è facoltativo e a posteriori**: da un compito fatto
  si può aprire l'inserimento di una spesa già compilato col nome e con
  l'acquirente. Se non si fa, il compito resta fatto lo stesso e la spesa si
  registra a mano come sempre. **Il compito non entra nei conti**: nei conti
  entra la spesa che ne nasce.
- **Offline come tutto il resto**: è una lista con `id`, quindi entra in
  `LISTS` di `sync-merge.js` e si fonde voce per voce come `toBuy`. Nessun
  meccanismo nuovo.

### Com'è venuta

`src/87-scheda-compiti.jsx`, voce **«Chi fa cosa»** nel menu — e sta **prima
della Lista della Spesa**, che è l'ordine dei fatti: ci si divide i compiti,
poi si compra, poi si registra la spesa.

- **Testo libero**, modificabile anche dopo: un compito si precisa strada
  facendo («carne» diventa «carne: 3 kg»).
- **Si assegna dalla tendina dei membri**, la stessa degli acquirenti. La
  persona **non si azzera** dopo l'assegnazione: assegnandone tre alla stessa
  si scrivono di fila senza risceglierla ogni volta.
- **Due stati**, da fare e fatto, in due sezioni separate.
- **Il ponte verso la spesa** è un tasto che compare solo sui compiti fatti:
  apre la Lista già compilata col nome e con chi l'ha eseguito, **e col prezzo
  vuoto** — alla cassa non si sapeva ancora. Se la spesa non c'è (hai prenotato
  e basta), il compito resta fatto e nei conti non entra niente.
- **Si sincronizza come tutto il resto**: è entrata in `LISTS` di
  `sync-merge.js` (`['k', 'compiti']`), quindi si fonde voce per voce. Due
  persone che assegnano compiti diversi mentre sono offline non si
  sovrascrivono. Nessun meccanismo nuovo.

**`test/e2e/compiti.js`, 27 verifiche.** La prima e la più importante:
assegnare un compito **non muove un euro** — i conti restano a 40,00 € prima,
durante e dopo. Cinque sabotaggi, cinque rossi: far entrare il compito nei
conti → 3 rosse, togliere il nome dal ponte → 1, inventare un prezzo → 1,
azzerare la persona → 2, ignorare la bandiera → 1.

**Una cosa che la prova ha trovato su sé stessa.** La verifica «il testo si
corregge strada facendo» usava un `some`: modificava il compito sbagliato e
passava lo stesso. Adesso controlla *quale* è cambiato **e che l'altro sia
rimasto com'era.

### Il vocabolario ha guadagnato una parola

La casella di spunta quadrata di questa scheda esisteva già, scritta a mano,
nell'Attrezzatura. Alla seconda comparsa si è guadagnata un posto
(`bottoneScelta('casella', …)`, § 13), e i bottoni censiti come «scritti a
mano» scendono da 22 a 21.

Nel migrarla il segno di spunta si era rimpicciolito — prima non aveva una
misura e la ereditava. Misurato a schermo: 16 px. Il vocabolario ha ora una
misura `simbolo` che vale esattamente quello, perché un segno non è
un'etichetta minuta.

### Le due cose da sistemare prima

**Questa scheda è Premium, e il Premium non esiste ancora.** Non c'è né
autenticazione (§ 1) né incasso (§ 3 / § 15-bis.2). E soprattutto: «il gestore
della Room» presuppone **le Room**, che sono il § 2, cioè il numero 5 della
fila. Assegnare compiti senza un gestore vuol dire che li assegna chiunque, e
la scheda perde esattamente la cosa che la rende utile.

Quindi: **la si costruisce dietro una bandiera**, come `auth` e `rooms` del
§ 16. Sulla nostra app resta accesa e senza gestore — chiunque assegna, che in
un gruppo di amici va benissimo ed è come funzionava sugli appunti. Sulla
pubblica si accende quando il § 2 esiste, e allora la tendina «chi assegna» ha
un significato.

**Fatto così:** `FEATURES.compiti`, accesa qui e spegnibile da
`window.APP_CONFIG`. Con la bandiera spenta la voce sparisce dal menu e la
scheda non si disegna — e c'è una prova che lo verifica accendendo e spegnendo.

**Quello che manca ancora**, e che arriva col § 2: oggi assegna chiunque.
Quando ci sarà un gestore della Room, la scheda dovrà chiedere **chi** sta
assegnando, non solo **a chi**.

**Vantaggio di farla ora anche se il Premium è lontano:** si prova sul campo
2027 con dati veri prima di venderla. È lo stesso metodo che ha corretto il
§ 12 e questo stesso § 17.

---

## 18. Più lingue — fatto: l'app parla italiano, spagnolo e francese (21 settembre 2026)

**Decisione presa, e cambia un intento iniziale.** L'app era stata scritta in
italiano e basta, per una ragione buona: la usavano venti amici italiani. Il
progetto è cambiato, e una app di divisione spese in un solo idioma non esce
dall'Italia.

**Cosa resta italiano:** il codice, i commenti, i commit, i nomi delle
variabili, questa roadmap, `CLAUDE.md`. La lingua di lavoro non si tocca. A
diventare traducibile è **solo quello che l'utente legge**.

### L'ordine, e perché

1. **Spagnolo e francese.** Sono i due mercati dove il campeggio di gruppo e le
   spese condivise hanno la stessa forma sociale che hanno qui — e dove
   Splitwise è meno radicato che nei paesi anglosassoni.
2. **Inglese e tedesco** subito dopo. L'inglese non è prioritario nonostante
   sembri: è il mercato dove i concorrenti sono più forti (§ 7).

L'italiano resta la lingua predefinita e la sola completa per definizione:
è quella in cui si scrive prima.

### Come si fa senza rompere niente

Il rischio vero non è tradurre: è che il meccanismo di traduzione **non si
accorga** che manca una stringa, e la mostri vuota in mezzo a una schermata.

- **Un file di dizionario fuori da `src/`**, come `menu-spesa.js`. Sta fuori
  perché così si prova con una prova unitaria — e la prova che serve è
  esattamente una: *ogni chiave presente in italiano esiste in tutte le altre
  lingue, e nessuna lingua ha chiavi che l'italiano non ha*. Dentro `src/`
  sarebbe provabile solo aprendo il browser.
- **`t()` deve conoscere lo stato di React.** La lingua è uno stato: se `t()`
  legge una variabile globale, cambiare lingua non ridisegna niente e serve un
  ricaricamento. Va presa da un contesto, o passata giù come le altre
  dipendenze delle schede.
- **I plurali non sono concatenazioni.** «1 pasto» / «2 pasti» in italiano sono
  due forme, in francese pure, ma non con le stesse regole (0 è singolare in
  francese, plurale in italiano). Le voci con un numero dentro sono **funzioni**
  che ricevono il numero, non stringhe con un `%s`.
- **Le date sono trentaquattro.** In `src/30-tema-e-formati.jsx` i formati sono
  già centralizzati: è **un punto solo** da agganciare alla lingua scelta, e
  questo è il motivo per cui il lavoro è fattibile. Se fossero sparsi nelle
  schede sarebbe un altro discorso.
- **Le costanti che non si traducono**: le regole del campo (§ 40) sono un
  testo verbatim di Lorenzo. Nella versione pubblica non esistono proprio —
  sono contenuto della room, non dell'app.

### Com'è venuta, e due premesse che erano sbagliate

`lingue.js`, fuori da `src/` come `conti.js`: dizionario, plurali, date e la
regola che si prova. `test/unita/lingue.js` (44 verifiche) e
`test/e2e/lingue.js` (17).

**Prima premessa sbagliata: «le date sono già centralizzate in
`src/30-tema-e-formati.jsx`, è un punto solo».** Non era vero. Erano **32
`'it-IT'` sparsi in otto sorgenti**, in **dodici forme diverse**. Adesso le
dodici forme hanno un nome (`completa`, `breve`, `ora`, `dataOra`…) e i 32
punti passano da `L.data(d, forma)`. Il DOM è rimasto identico al carattere su
tutte e diciassette le schermate, quindi lo spostamento non ha cambiato niente
per nessuno — ma senza guardare prima, il piano avrebbe sottostimato il lavoro.

**Seconda premessa sbagliata: «il lavoro grosso è passare `t` a quattordici
schede».** Non serve. Le schede leggono già dal loro ambito `bottone`,
`money`, `FEATURES`: `L` è la stessa cosa. Vive in `10-fondamenta.jsx` e
**la riassegna `App()` a ogni disegno**, dal suo stato — non è «una variabile
globale letta a caso», è una variabile globale *scritta dal disegno prima che
le schede la leggano*. Cambiare lingua cambia uno stato di React, React
ridisegna, e il disegno vede il valore appena messo. Costo: zero dipendenze
nuove in quattordici file.

Cosa la romperebbe, ed è scritto nel codice: trasformare una scheda in un
componente memoizzato. Quello salterebbe il ridisegno. Le schede non sono
componenti, ed è anche per questo (§ 14).

### L'enfasi dentro una frase

Una frase lunga ha spesso una parte in grassetto, e spezzarla in tre stringhe
non funziona: l'ordine delle parole cambia da lingua a lingua e il pezzo in
mezzo finisce nel posto sbagliato. La frase resta **intera** nel dizionario,
con la parte da evidenziare fra asterischi:

    'Il compito dice *chi fa cosa*, non quanto costa'

La regola che la spezza sta in `lingue.js` (pura, provata); il disegno sta in
`src/50-interfaccia.jsx` (`frase('compiti.spiegazione')`). È lo stesso taglio
di sempre: la regola fuori, il JSX dentro.

### Cosa è tradotto, e cosa no

**Tutti e diciannove i sorgenti.** 752 chiavi, di cui 174 funzioni (plurali e
frasi con dei numeri dentro), in italiano, spagnolo e francese. L'ultimo terzo
erano i due file che toccano i soldi — `80-app.jsx` e `82-schede-conti.jsx` —
e dentro c'era anche il **manuale dell'app**: le ventuno voci di «Come
funziona», che da sole sono un terzo di tutta la prosa dell'interfaccia.

`FEATURES.lingue` è **accesa**. L'italiano resta la lingua predefinita; la
scelta si fa da Impostazioni e resta su quel telefono. **Quello che scrive
l'utente non si traduce mai**: nomi, menù, spese, note restano come li ha
messi. Accendendola, il DOM è cambiato **in un punto solo su diciassette
schermate** — il selettore che compare in Impostazioni.

Restano in italiano per scelta, non per dimenticanza: le **regole del campo**
e la **dotazione base** (testo verbatim di Lorenzo, contenuto della room e non
dell'app), il **marchio**, e i **nomi dei livelli** del gioco — Prato Lungo,
Palmiro Togliatti, Rio de Janeiro sono luoghi, e la battuta è la geografia.
Nella versione pubblica non esistono proprio.

**Quello che il machine non garantisce:** che lo spagnolo e il francese siano
*belli*. Le prove controllano che ogni chiave ci sia, che nessuna sia rimasta
in italiano, che ogni funzione giri e non torni vuota. Nessuna prova sa se una
frase suona bene: quello lo dirà chi le legge.

### Il metro: `test/censimento-testi.js`

«Circa mille stringhe» non si affronta senza sapere da che file cominciare.
Il censimento conta i testi che l'utente legge e che non passano dal
dizionario, e dice **dove** stanno:

    node test/censimento-testi.js                  quante ne restano, per file
    node test/censimento-testi.js 82-schede        l'elenco di un file

È un'euristica, non un parser: riconosce la prosa da una maiuscola in testa,
da un accento o da una parola italiana, e scarta le classi Tailwind e le
schegge di codice. Un paio di falsi positivi per file restano, ed è voluto —
meglio guardarne uno di troppo che perderne uno.

### Quattro trappole nuove

- **Una costante valutata al caricamento congela la lingua.** `SEZIONE_DI`
  era una tabella di nomi (`{ m: 'Membri', … }`) costruita una volta sola,
  prima che `App()` assegni `L`: tradurla lì l'avrebbe inchiodata alla lingua
  di quel momento. Adesso la tabella tiene le **chiavi** e il nome si chiede
  al disegno. `PURCHASE_TYPES` ha lo stesso difetto e aspetta il suo turno.
- **`frase()` perdeva il colore del grassetto.** Dentro un paragrafo grigio,
  il pezzo in evidenza a volte è anche verde: `frase()` lo vestiva sempre di
  `font-bold` e basta. Se ne è accorto solo il confronto del DOM, che ha
  segnalato `text-[#2D392C]` sparito da tre punti della Diagnostica. Adesso
  c'è `fraseVestita(classe, chiave, …)`; il vestito sta nell'interfaccia, non
  nel dizionario — il traduttore dice **dove** va l'enfasi, non di che colore.
- **Con la lingua spenta, nessuno chiama mai lo spagnolo.** Settantatré
  chiavi sono funzioni: un apostrofo sbagliato dentro un template o un
  argomento di troppo sarebbe rimasto lì fino al giorno in cui qualcuno
  accende la lingua. Adesso la prova le chiama **tutte**, in tutte le lingue,
  con lo zero, l'uno e il due — i tre numeri su cui i plurali si dividono.
- **Un file puro che restituisce una frase non sa in che lingua verrà letta.**
  `conti.js` diceva *«cibo e bevande del conto comune, ma nessun pasto segnato
  nei giorni comuni»*. Adesso restituisce `'buchi.ciboComune'` e la frase la
  sceglie il disegno. Lo stesso per le modifiche respinte a conti chiusi. Il
  prezzo è che un refuso non è più un errore di battitura: è `buchi.logistiche`
  stampato in mezzo a un avviso — e il ripiego di `t()` lo mostra *apposta*,
  perché una chiave a schermo è meglio di un buco. Per questo c'è una prova che
  legge i sorgenti e chiede che **ogni chiave scritta esista**, comprese quelle
  che passano di mano fra un file e l'altro.

### La prova che protegge il resto del lavoro

Il rischio non è tradurre male — quello si vede. È che manchi una stringa e il
meccanismo non se ne accorga: a schermo resta uno spazio bianco, e uno spazio
bianco non lo segnala nessuno. La regola va in **due direzioni**: ogni chiave
italiana esiste nelle altre lingue, e nessuna lingua ha chiavi che l'italiano
non ha — una chiave che avanza è una traduzione che nessuno mostrerà mai.

Ci sono altri tre controlli che sembrano paranoia e non lo sono: nessuna
traduzione **vuota**, nessuna voce **rimasta in italiano** (una chiave copiata
e non tradotta passa tutti gli altri controlli), e i **plurali che restano
funzioni** — se uno diventa una stringa, il numero sparisce.

Sette sabotaggi, sette rossi. Più tre sulla prova end-to-end, fra cui quello
che conta: **`L` che non si riassegna** — la lingua smette di cambiare senza
ricaricare, ed è esattamente il difetto che il § 18 nominava prima di scrivere
una riga.

### Un difetto trovato dalla prova

`new Date(null)` **non** è una data non valida: è il primo gennaio 1970. Una
data assente sarebbe comparsa a schermo come «giovedì 1 gennaio» — una bugia
con l'aria di un dato. Adesso resta vuota.

### Quanto resta

| | |
| --- | --- |
| chiavi nel dizionario | 752 (174 funzioni) |
| sorgenti passati dal dizionario | 19 su 19 |
| testi ancora da portare nel dizionario | nessuno |
| date centralizzate | 32 su 32 |
| `FEATURES.lingue` | accesa |

Il lavoro che resta è **meccanico e a fette**: una scheda alla volta, con la
prova unitaria che diventa rossa appena una traduzione manca. Le misure di
testo del § 13 si fanno nello stesso passaggio, perché sono gli stessi file.
Quando i dizionari coprono tutto, si accende `FEATURES.lingue` — e solo
allora ha senso il § 3 (Google Play).

### Quanto costa davvero

`RICOGNIZIONE-UI.md` ha già contato i testi. Il lavoro grosso non è la
traduzione: è **passare `t` a quattordici schede** che oggi ricevono le
dipendenze in un oggetto. Il § 14 ha reso questa cosa meccanica — è una voce
in più nell'oggetto — ed è la ragione per cui questo § 18 viene *dopo* il
§ 14 e non prima.

**Va fatto prima del § 3 (Google Play).** Pubblicare in un solo idioma e poi
aggiungere le lingue significa rifare le schede degli store, gli screenshot e
le descrizioni.

---

## 19. Le immagini fuori da `localStorage` — fatto (23 agosto 2026)

**Questa sezione nasce da una critica esterna, verificata sui dati veri del
campo.** Delle quattro sollevate, è l'unica che i numeri confermano — e ne
confermano due insieme, perché hanno la stessa causa.

### Il numero

Nell'export di chiusura: **3,18 MB su 3,2 MB sono 29 foto di scontrini**, in
Base64, dentro la chiave `cambusa_receipts`. Il tetto di `localStorage` è
**circa 5 MB per origine**. Ventinove foto in un campo da sei giorni: al 60 %
del tetto. Il campo 2026 è finito senza incidenti *per un pelo*, e con un
gruppo grande il triplo del previsto.

Lo stato che davvero conta — membri, presenze, spese, saldi — pesa **35 KB**.
Le foto occupano **novanta volte** i dati che proteggono.

### Perché è un problema anche di velocità

`JSON.stringify(receipts)` gira in un `useEffect` **a ogni foto aggiunta**.
Misurato sui dati veri: **53 ms su un portatile**, che su un telefono di fascia
media diventano tre-quattro decimi di secondo di interfaccia ferma. Per
confronto, lo `stringify` dello stato intero — quello che parte verso Firestore
ogni volta — costa **0,128 ms**. Non è la sincronizzazione a pesare: sono le
immagini.

### Com'è fatto

**`magazzino-foto.js`**, fuori da `src/` per lo stesso motivo di
`menu-spesa.js`: le regole che decidono se si perde una foto si provano con
una prova unitaria, senza aprire un browser. Le foto stanno in IndexedDB —
niente tetto dei 5 MB, scritture asincrone — e `localStorage` torna a
contenere solo i conti.

Tre cose lo tengono in piedi:

- **Si scrive solo il cambiamento.** `daScrivere(prima, dopo)` confronta le
  due mappe: aggiungere la trentesima foto fa partire **una** scrittura, non
  trenta. Riversare tutto a ogni scatto era esattamente il difetto da cui si
  veniva.
- **Il vecchio si cancella solo dopo aver riletto il nuovo.**
  `migrazioneRiuscita(originali, rilette)` confronta i **contenuti**, non i
  conteggi: una foto riletta a metà vale come persa e la chiave vecchia resta
  dov'è. Si occupa spazio per un altro giro, ma non si perde una foto.
- **Senza magazzino non succede niente di male.** Safari in navigazione
  privata ha fatto di peggio che mancare: c'è l'oggetto `indexedDB` ma aprire
  un database fallisce. Si prova una volta, e se non va si resta su
  `localStorage` come prima — e la diagnostica lo **dice**, invece di far
  finta di niente.

### Il numero, dopo

Le stesse tre foto da un megabyte che prima riempivano `localStorage` adesso
lo lasciano a **2 KB**. La diagnostica in modalità tecnica mostra quante foto
ci sono, quanto pesano e dove stanno: è il numero che ha fatto nascere questa
sezione, quindi è anche quello da tenere d'occhio.

### Quello che le prove hanno trovato

Due cose che non erano nel piano:

- **La potatura delle foto orfane aveva smesso di funzionare.** Le foto adesso
  arrivano *dopo* il primo disegno, e l'effetto che toglie quelle di voci
  cancellate girava solo quando cambiavano gli acquisti: al primo giro non
  c'era ancora niente da potare. Corretto mettendo le foto fra le dipendenze —
  e c'è una prova apposta, con una foto che non appartiene a nessuna spesa.
- **«Cancella i dati da questo telefono» lasciava indietro i megabyte.**
  Svuotava le chiavi `cambusa_*` e ricaricava: con le foto altrove, il tasto
  prometteva una cosa e ne faceva un'altra.
- **Quattro prove guardavano la chiave invece delle foto.** `e2e/scontrino`,
  `e2e/tenuta`, `e2e/galleria` e `e2e/chiusura` leggevano
  `localStorage.cambusa_receipts` a mano: due sono diventate rosse subito, e
  le altre due passavano solo perché ingoiavano l'errore. Adesso passano tutte
  da `fotoSalvate()` in `test/lib/app.js`, che chiede **quali foto ci sono**.
  Una prova che descrive dove stanno i dati invece di cosa fa l'app diventa
  rossa a ogni spostamento, e a furia di rimetterla a posto si smette di
  crederle.

Una terza cosa è stata chiusa senza che una prova la mostrasse: le scritture
nel magazzino sono **messe in fila**. Due in volo insieme partirebbero dallo
stesso punto — aggiungi una foto e cancellala subito, e la cancellazione parte
da uno stato in cui quella foto non c'era ancora, quindi resta nel magazzino
per sempre. È una finestra di pochi millisecondi che non si riesce a colpire
da fuori: la correzione è ragionata, non dimostrata, e va detto.

**Prove:** `test/unita/magazzino-foto.js` (17 verifiche) e
`test/e2e/magazzino-foto.js` (15). Tutte e due viste fallire prima di essere
credute: riscrivendo tutto a ogni foto, accontentandosi che la chiave esista
invece di confrontare il contenuto, non cancellando mai niente, tornando a
scrivere in `localStorage`, togliendo le foto dalle dipendenze della potatura,
e togliendo la rete di sicurezza a chi il magazzino non ce l'ha.

### Le tre critiche che invece non reggono, e perché è scritto qui

Perché non vengano riproposte:

- **«Il documento di stato si avvicina al tetto dei 900 KB.»** Misurato:
  **35,2 KB, il 3,9 % del tetto**. Novantasei per cento di margine con tre
  volte le persone previste. Riscrivere la sincronizzazione con dei delta o
  una libreria CRDT per questo motivo significherebbe rifare, senza un
  problema, l'unica parte del codice che ha già cancellato il lavoro di
  qualcuno una volta.
- **«`JSON.stringify` sui dati blocca il thread.»** Vero solo per le foto
  (sopra). Sullo stato costa 0,128 ms, sui pasti di un giorno **0,0011 ms**.
- **«L'app dipende dagli orologi locali e un telefono avanti di minuti
  sovrascrive gli altri per sempre.»** No: il confronto fra due versioni non
  usa `Date.now()`, usa `rev`, e ogni dispositivo alza il proprio orologio a
  `hi + 1` appena vede una data più alta (`sync-merge.js`). Un telefono avanti
  vince **una volta**, poi tutti gli altri lo superano. `OROLOGIO_SOGLIA` non
  è la difesa, è solo l'avviso in modalità tecnica. E il meteo è già
  normalizzato sull'ora del server (`quandoMeteo`, `src/40-configurazione.jsx`).
  L'unico residuo onesto: due modifiche fatte **davvero in contemporanea** da
  due telefoni che non si sono mai visti si decidono in modo arbitrario ma
  deterministico. È il compromesso scritto in `CLAUDE.md`, ed è voluto:
  «meglio un telefono con l'ora sbagliata che vince un confronto, che due
  telefoni che non si accordano».
