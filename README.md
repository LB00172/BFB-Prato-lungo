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
| **Come funziona** | Guida interna all'app |

## Come vengono ripartite le spese

- **Cibo e bevande** → divisi per il numero di **pasti** degli adulti: ognuno
  paga `pasti fatti × quota pasto`. Chi mangia di più paga di più.
- **Logistica e attrezzatura acquistata** → **quota fissa uguale** per ogni
  adulto presente: nessuno paga più di una quota.
- **Bambini**: gratis, il loro costo è ripartito sugli adulti.
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
- **Snapshot giornaliero** automatico + "Ripristino di emergenza" nella scheda
  Dati. In più, backup manuale **Esporta/Importa** su file JSON.
- Le librerie (React, Tailwind) e i font sono **self-hosted** in `vendor/`:
  nessuna dipendenza da CDN esterni.

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
