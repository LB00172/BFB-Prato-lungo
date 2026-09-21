#!/bin/bash
# Preparazione della sessione su Claude Code sul web.
#
# Il contenitore viene buttato via a fine sessione e ricostruito dal
# repository: senza questo script ogni sessione ricomincia da node_modules
# vuoto, e prima che `npm test` possa girare passano minuti.
#
# Due cose da installare, e pesano:
#   - node_modules (~500 MB): playwright-core per le prove e2e, firebase-tools
#     e @firebase/rules-unit-testing per `npm run regole`;
#   - l'emulatore Firestore (~137 MB), che firebase-tools scarica da Google
#     la prima volta che lo si avvia. Scaricarlo qui vuol dire che
#     `npm run regole` parte subito invece di fermarsi ad aspettare.
#
# Lo stato del contenitore viene messo in cache DOPO che questo script
# finisce, quindi tutto quello che scarica qui lo ritrovano le sessioni
# successive. Per lo stesso motivo si usa `npm install` e non `npm ci`:
# install riusa quello che trova, ci butta via tutto e riparte.
set -euo pipefail

# Solo sul web. Sul computer di casa le dipendenze ci sono gia' e reinstallarle
# a ogni avvio sarebbe solo fastidio.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-/home/user/BFB-Prato-lungo}"

echo "→ dipendenze npm"
npm install --no-audit --no-fund

# Chromium sta gia' nell'immagine (PLAYWRIGHT_BROWSERS_PATH), e
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD impedisce a npm di riscaricarlo: qui non
# c'e' niente da fare. Se un giorno sparisse, le prove e2e lo direbbero da
# sole ("Chromium non trovato").

# L'emulatore Firestore, 137 MB. `setup:emulators:firestore` li riscarica
# TUTTI a ogni chiamata anche quando il file c'e' gia' — verificato guardando
# la data del jar cambiare. SessionStart pero' scatta anche su resume e clear,
# non solo all'avvio: senza questo controllo sarebbero 137 MB ogni volta.
#
# Se la rete non lo lascia passare non e' un guasto della sessione: `npm test`
# gira lo stesso, e a fermarsi sarebbe solo `npm run regole`, che lo direbbe
# da se'. Quindi si avvisa e si tira dritto.
CACHE_EMU="${HOME:-/root}/.cache/firebase/emulators"
if compgen -G "$CACHE_EMU/cloud-firestore-emulator-*.jar" > /dev/null; then
  echo "→ emulatore Firestore: c'e' gia'"
else
  echo "→ emulatore Firestore: lo scarico"
  if ! npx --no-install firebase setup:emulators:firestore; then
    echo "  ATTENZIONE: non sono riuscito a scaricare l'emulatore Firestore."
    echo "  'npm test' funziona lo stesso; 'npm run regole' no, finche' non arriva."
  fi
fi

echo "✓ pronto: npm test (74 prove) e npm run regole"
