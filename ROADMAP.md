# Roadmap — versione pubblica (da settembre)

Documento di lavoro per l'evoluzione dell'app da *strumento interno della
Brigata Fabio Bandone* a **prodotto neutro pubblicabile**, utilizzabile da
qualsiasi gruppo (scout, campi estivi, ritiri, case in montagna, sagre).

**Regola d'oro:** niente di tutto questo va toccato prima del campo di agosto
2026. L'app in produzione deve restare stabile. Lo sviluppo va fatto su un
branch dedicato (`feature/public-app`) e rilasciato solo dopo il campo.

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

**Attenzione ai costi:** con utenti pubblici il piano gratuito prima o poi non
basta. Le foto degli scontrini dentro Firestore vanno bene per un gruppo, ma su
scala conviene spostarle su uno storage a oggetti (Firebase Storage / R2), più
economico per i byte.

## 5. Analisi di mercato

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

- **Gratis**: 1 campo attivo, membri illimitati, tutte le funzioni di base,
  offline completo. Deve essere generoso: è il canale di acquisizione.
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
