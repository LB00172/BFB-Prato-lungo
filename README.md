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
| **Calendario** | Meteo previsto del giorno (Pereto, AQ), riepilogo cucina (quanti pasti preparare), note libere |
| **Membri** | Elenco partecipanti; i bambini mangiano gratis |
| **Presenze** | Chi c'è a pranzo/cena, con "Tutti a pranzo/cena" e "Copia da ieri" |
| **Lista della Spesa** | Ogni acquisto: nome, acquirente, prezzo, tipologia, foto scontrino |
| **Aggiunta Attrezzatura** | Attrezzatura da comprare con prezzo; se spuntata entra nelle spese |
| **Spese Totali** | Totali · Quote · Saldi (chi paga chi + condividi resoconto) · Dati (backup) |
| **Dotazioni personali** | Dotazione base fissa + aggiunte per il campo |
| **Impostazioni** | Tema chiaro/scuro/automatico, blocco con password, dati locali, versione |
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

## Dati, offline e sincronizzazione

- Tutto è salvato in `localStorage` sul dispositivo: l'app funziona **senza
  linea**, sempre.
- Con la linea i dati si sincronizzano da soli tra i dispositivi via
  **Firestore** (documento condiviso `camps/<codice campo>` + sotto-collezioni
  per foto scontrini e snapshot). La connessione è **automatica** all'avvio.
- Offline le modifiche restano in coda e partono da sole al ritorno della rete.
- **Fusione, non sovrascrittura** (`sync-merge.js`): ogni voce porta con sé la
  data della sua ultima modifica (o cancellazione). Quando due dispositivi che
  hanno lavorato **offline** tornano online, le due versioni si uniscono voce
  per voce — voci nuove da entrambe le parti, sulla stessa voce vince la
  modifica più recente, le cancellazioni non fanno "resuscitare" nulla. La
  regola è identica sui due dispositivi, quindi la sincronizzazione converge
  senza rimbalzi. Senza questo, al campo (dove non c'è linea) il secondo
  telefono che si agganciava cancellava il lavoro del primo.
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
| **Dati nel cloud** | **solo le Regole di Firestore** | ⚠️ Con l'accesso anonimo attuale, chiunque scarichi il JavaScript dell'app (è pubblico) può leggere e scrivere `camps/<codice>`. Il blocco con password **non** difende il cloud |

**Come chiudere davvero il cloud** (10 minuti nella console Firebase, da fare
quando si vuole):

1. Authentication → Sign-in method → abilita **Email/Password** e disabilita
   *Anonimo*.
2. Authentication → Users → crea **un utente condiviso** (es.
   `campo@brigatabandone.it`) con la password del campo.
3. Regole Firestore: `allow read, write: if request.auth != null &&
   request.auth.token.email == "campo@brigatabandone.it";`
4. Nell'app, il login usa la password digitata per entrare in Firebase invece
   dell'accesso anonimo (la password resta fuori dal codice).

Da quel momento senza password non si leggono i dati nemmeno interrogando
Firestore direttamente. Costo: la **prima** apertura su ogni dispositivo
richiede la linea; poi la sessione resta valida anche offline.

Altre accortezze utili, senza scrivere codice:

- La password va nel gruppo del campo e da nessun'altra parte: se gira troppo,
  si rigenera l'impronta e si cambia (istruzioni in `firebase-config.js`).
- Il **file di archivio** creato alla chiusura contiene tutto, foto degli
  scontrini comprese: conservalo dove conservi i documenti, non in una cartella
  condivisa.
- Gli scontrini fotografati possono mostrare dati della carta: se si vedono,
  meglio inquadrare solo la parte degli importi.
- La classifica del minigioco contiene i nomi dei giocatori: sta nello stesso
  database, quindi valgono le stesse considerazioni.

### Configurazione Firebase

Le impostazioni stanno in **`firebase-config.js`**: config del progetto
Firestore, codice campo predefinito, località per il meteo, branding e feature
flag. L'`apiKey` di Firebase non è un segreto (è un identificatore pubblico
lato client): la sicurezza è data dalle Regole di Firestore.

Regole Firestore attualmente in uso:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /camps/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Serve inoltre l'accesso **Anonymous** abilitato in Firebase Authentication.

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
| `build.js` | Compila `App.jsx` → `App.js` e aggiorna `CACHE_NAME` |
| `vendor/` | React, Tailwind e font self-hosted |

## Sviluppo

```bash
npm install      # una volta
npm run build    # App.jsx -> App.js + nuovo CACHE_NAME
```

`build.js` calcola `CACHE_NAME` dall'hash dei file: ogni build con modifiche
invalida la vecchia cache, e l'app installata **si aggiorna da sola** (ricarica
una volta all'arrivo del nuovo service worker). Non serve più cambiare la
versione a mano.

Deploy: push su `main` → Vercel pubblica in automatico
(`vercel.json` serve i file statici già compilati, senza build server-side).
