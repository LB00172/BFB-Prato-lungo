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

| | Sezione | Perché adesso |
| --- | --- | --- |
| 1 | § 11 Coda foto su IndexedDB | Oggi la promessa ha un asterisco («non chiudere l'app»). Al campo l'app si chiude da sola: è la condizione normale |
| 2 | § 12 Ponte Menù → Lista della spesa | Valore vero, nessun backend, si usa già al prossimo campo |

**Poi — si prepara il terreno, nell'ordine obbligato:**

| | Sezione | Perché prima dell'altro |
| --- | --- | --- |
| 4 | § 13 Vocabolario dell'interfaccia | Dà un bersaglio alla divisione del codice |
| 5 | § 14 Spezzare `src/7-app.jsx` | Il taglio grosso è fatto; per il resto serve prima il § 13, altrimenti sposta righe di posto |

**Poi — la versione pubblica, che è una catena:**

| | Sezione | Perché in quest'ordine |
| --- | --- | --- |
| 6 | § 1 Login | Senza account non esiste nient'altro di quanto segue |
| 7 | § 2 Room | I dati sono già in `camps/<codice>`: è evoluzione, non riscrittura |
| 8 | § 9 Modulo stanza e inviti | È l'interfaccia del § 2. Senza, i gruppi poco tecnologici si fermano al primo tentativo |
| 9 | § 8 Voci di spesa spegnibili | Configurazione della room: ha senso solo quando la room esiste |
| 10 | § 3 Google Play | Si pubblica quando c'è qualcosa da far entrare, cioè dopo la 8 |
| 11 | § 6 Checklist | La lista privata ha bisogno di un `uid`, quindi del § 1 |
| 12 | § 5 Scontrini con l'IA | La chiave ha bisogno di un server. Farla prima significa costruire il backend per l'IA invece che per il motivo giusto |
| 13 | § 15 Notifiche push | Piano Blaze, Cloud Functions e — soprattutto — una domanda ancora senza risposta su cosa valga la pena notificare |

**Fuori dalla fila:** § 4 (database) è una decisione già presa — si resta su
Firestore; § 7 (analisi di mercato) non è lavoro, è la mappa; § 10 (iPhone) è
**fatta** ad agosto 2026 e si ripete solo quando si tocca `sw.js` o `build.js`
— cioè, fra le voci qui sopra, il § 14.

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

**Le 57 prove girano tutte su Chromium**, quindi su iOS l'unica prova possibile
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

## 11. Coda persistente delle foto (IndexedDB)

**Oggi le foto viaggiano sulla coda di scrittura di Firestore.** Funziona, ma
l'app deve dire questa frase:

> Puoi chiudere l'app, ma non prima che la spia in alto smetta di dire
> «da inviare».

Una promessa con un asterisco è una promessa che qualcuno non leggerà. Al campo
si fotografa lo scontrino, si mette il telefono in tasca e l'app muore per conto
suo: quella è la condizione normale, non l'eccezione.

**Cosa cambia con una coda propria su IndexedDB:** i byte della foto stanno in
un archivio pensato per i byte, non dentro documenti da 1 MB; la coda sopravvive
alla chiusura senza asterischi; e il ritentativo diventa nostro, quindi si può
mostrare *quante* foto mancano e *da quanto*.

**Ordine, come sempre in questa app:** prima si scrive la coda, poi si toglie
l'avviso. Toglierlo prima significa promettere una cosa che non c'è ancora.

Vale sia per le foto della Galleria sia per quelle degli scontrini — sono lo
stesso problema con due nomi.

## 12. Ponte Menù → Lista della spesa

**Obiettivo:** dal menù del giorno escono le voci nella Lista della Spesa, senza
ricopiare a mano.

Le due schede esistono già e non si parlano: il Menù scrive nel campo `note` del
giorno (un foglio a righe, una pietanza per riga), la Lista della Spesa è un
elenco separato. Chi fa la cambusa legge l'uno e ribatte nell'altra.

**Il ponte deterministico viene prima dell'IA.** «Pasta al pomodoro» → *pasta*,
*pomodoro*: è una tabella di ingredienti, non un modello. Serve senza linea, che
è quando si fa la lista. **Le quantità** («venti persone, tre giorni: quanto
compro?») sono un'altra cosa e stanno in § 5, con la linea e con la conferma
dell'uomo.

Il vincolo: il ponte **propone**, non scrive da solo. Una lista della spesa che
si riempie da sola mentre scrivi il menù è una lista di cui nessuno si fida.

## 13. Vocabolario dell'interfaccia

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

## 14. Spezzare i sorgenti — primo taglio fatto

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

### Quello che resta

Dentro `80-app.jsx` ci sono ancora stato, effetti, conti e gestori. **Quelli
non si spostano con `sed`:** vanno estratti come hook (`usaGalleria`,
`usaPresenze`) che si portano dietro il loro `useState`. È il passo che fa
scendere davvero il numero delle dipendenze, e va fatto una scheda alla volta,
con la stessa prova del DOM identico.

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
