# BFB-Prato-lungo

PWA gestionale per le spese da campeggio della Brigata Fabio Bandone.

Gestisce presenze e **ripartizione di quanto ogni membro deve pagare** per i pasti,
pensata per funzionare **online in fase di preparazione** e **offline al campo**,
dove non c'è linea.

## Come funziona la ripartizione

- **Cibo + bevande** vengono divisi per il numero totale di pasti degli **adulti**
  → si ottiene la *quota per singolo pasto*. Ogni membro paga `pasti × quota`.
- I **bambini** mangiano gratis: il loro costo è ripartito sugli adulti.
- **Accessori / logistica** (generatore, piatti…) vengono divisi in parti uguali
  tra gli adulti effettivamente presenti almeno a un pasto.

La somma di quanto devono tutti i membri è **sempre uguale** all'importo complessivo.

## Dati e offline

- I dati sono salvati in `localStorage` sul dispositivo: **nessun database, nessun
  account, nessuna connessione necessaria**. Funziona al 100% offline.
- Per non perdere i dati o per spostarli su un altro telefono c'è **Esporta/Importa**
  (un file JSON) nella scheda *Spesa*.
- Tutte le librerie (React, Tailwind, font) sono **self-hosted** in `vendor/`:
  l'app non dipende da nessun CDN esterno, quindi si apre anche senza rete purché
  sia stata aperta almeno una volta (per installare il service worker).

## Struttura

- `index.html` — pagina principale (carica le librerie locali e `App.js`).
- `App.jsx` — **sorgente** dell'app (React + JSX). *Questo è il file da modificare.*
- `App.js` — versione **compilata** di `App.jsx` (JS puro, caricata dal browser).
- `sw.js` — service worker (cache offline).
- `vendor/` — librerie e font self-hosted.

## Modificare il codice

Dopo aver modificato `App.jsx`, rigenerare `App.js` con Babel:

```bash
npx @babel/cli --presets @babel/preset-react App.jsx -o App.js
```

(oppure qualsiasi altro transpiler JSX). Ricordarsi di aggiornare la versione della
cache in `sw.js` (`CACHE_NAME`) per far scaricare ai dispositivi la nuova versione.
