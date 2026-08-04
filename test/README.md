# Verifiche automatiche

Rete di sicurezza dell'app. Serve soprattutto per i lavori grossi — spezzare
`App.jsx`, rifare una sezione — dove il rischio non è sbagliare una riga, ma
rompere i conti senza accorgersene.

```bash
npm install          # una volta
npm test             # tutto (~6 minuti)
npm test unita       # solo le prove senza browser (istantanee)
npm test contabilita # solo le prove col nome che contiene "contabilita"
npm test audit
```

`npm test` esce con **codice diverso da zero** se anche una sola prova
fallisce, e in coda stampa per esteso l'output di quelle guaste.

## Com'è fatta

| | |
|---|---|
| `esegui.js` | Avvia il server statico e lancia le prove una per una |
| `lib/server.js` | Server statico minimo (nessuna dipendenza): serve il progetto com'è |
| `lib/app.js` | Aiuti condivisi: dove sta Chromium, `apri()` l'app già sbloccata, `ok()` / `fine()` |
| `unita/` | Prove che non aprono il browser: veloci |
| `e2e/` | Prove che pilotano l'app vera in Chromium |
| `fixture/` | File di appoggio (la finta foto di uno scontrino) |
| `tmp/` | Schermate e scarichi delle prove. Fuori dal repo |

Una prova nuova si scrive così:

```js
const { apri, ok, fine } = require('../lib/app');

(async () => {
  const { browser, page, menu, errori } = await apri();
  await menu('Membri');
  ok('descrizione di cosa deve valere', condizione);
  ok('nessun errore JavaScript', errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
```

Le prove più vecchie stampano ancora a modo loro: l'esecutore le considera
fallite se nell'output compare `KO`, `PROBLEMA`, `FATAL` o un errore JS. Chi le
tocca, le converta a `ok()` / `fine()`.

Chromium viene cercato da solo (`PLAYWRIGHT_BROWSERS_PATH`, poi i browser di
sistema). Su un computer dove non lo trova: `CHROMIUM_PATH=/percorso npm test`.

## Cosa copre

**Senza browser**

| Prova | Cosa verifica |
|---|---|
| `unita/compilazione` | `App.jsx` compila; **`App.js` è allineato** (cioè non hai dimenticato `npm run build`); il `CACHE_NAME` c'è; ogni script di `index.html` sta nel precache |
| `unita/fusione-motore` | I 45 casi del motore di fusione (`sync-merge.js`): voci nuove da due telefoni, cancellazioni, lapidi, convergenza, **orologi sbagliati** (telefono indietro che deve comunque vincere, telefono avanti che non deve trascinare gli altri né spaccare l'accordo) e app vecchia che non deve cancellare nulla |
| `unita/arrotondamenti` | Quote sempre multiple di 0,10 €; riconciliazione dello scarto solo sopra i 50 cent |
| `unita/pdf-ricordo` | Il PDF "foto ricordo": struttura del file, **ogni voce della tavola degli scarti punta al suo oggetto**, JPEG incorporati senza ricodifica, impaginazione, tetto di 12, accenti e ingressi rotti. Salva un esempio in `test/tmp/ricordo.pdf` |

**Con l'app vera**

| Prova | Cosa verifica |
|---|---|
| `e2e/audit` | **384 verifiche**: tutta la catena dal carico spese a "chi paga chi", su 20 scenari (bambini, conto separato, giorni vuoti, acquirenti fantasma, campo intero disordinato) |
| `e2e/netting` | Chi ha anticipato paga la sua quota come gli altri; i passaggi di pareggio |
| `e2e/pagamenti` | PayPal e IBAN per membro, controllo mod-97, comparsa nei Saldi, tasto copia |
| `e2e/album` | Galleria: tetto per persona, miniatura più leggera dell'originale, **nessuna foto in localStorage**, vista Album sfogliabile e vista Griglia, scelta delle foto e PDF ricordo davvero scaricato, chiusura del campo che timbra le foto invece di cancellarle |
| `e2e/separato` | Conto separato: giorni spuntati, pasti fuori dal divisore comune |
| `e2e/dueflussi` | I due modi di registrare una spesa portano allo stesso conto |
| `e2e/acquirente` | L'acquirente si sceglie dai membri, niente nomi scritti a mano |
| `e2e/correzioni` | Correzione di una spesa già salvata (la matita) |
| `e2e/chiusura` | Chiusura del campo: archivio scaricato, liste azzerate, totali a zero |
| `e2e/fusione` | La fusione dentro l'app: due telefoni offline, nessun dato perso |
| `e2e/scorte` | Copie locali **due volte al giorno** (mattina e pomeriggio, con lo stato precedente alla modifica che le fa scattare), potatura per numero e per spazio, **ripristino che funziona senza linea**, e promemoria serale del backup: compare solo nei giorni del campo, di sera, e solo se ci sono state modifiche. Usa un orologio pilotabile, così l'esito non dipende da quando si lancia la prova |
| `e2e/tenuta` | I guasti silenziosi della sincronizzazione: scrittura fallita che dev'essere ritentata e segnalata ("Da inviare"), campo vuoto nel cloud che va ripopolato, memoria del telefono piena che va detta, **foto e scontrini che finiscono in coda invece di perdersi** e partono da soli quando la linea regge |
| `e2e/registro` | Registro delle modifiche (locali e in arrivo, con data e ora, esportabile) e ciclo offline→online: il lavoro fatto senza linea sopravvive, viene ripubblicato, e ricevere ciò che si è appena spedito non produce un altro invio |
| `e2e/perdita` | **Perdita di dati**: cancellazioni datate in arrivo dal cloud, freno di sicurezza, copia di scorta, "Annulla la sincronizzazione" con ridatazione, diagnostica, e che "Copia da ieri" non cancelli le presenze di nessuno |
| `e2e/riaggancio` | Ritorno della linea e riaggancio al cloud |
| `e2e/login` | Blocco con password, tentativi sbagliati, "blocca ora" |
| `e2e/autochiede` | L'app chiede da sola la password quando serve al database |
| `e2e/smoke` | L'app si apre e resta usabile anche senza rete |
| `e2e/presenze` | Presenze, "tutti a pranzo/cena", copia da ieri |
| `e2e/orfane` | Membro eliminato e riaggiunto: le sue presenze restano appese al vecchio id. L'app le trova, le chiama per nome, le riassegna sommandole a quelle già segnate, o le butta |
| `e2e/calendario` | Note libere del giorno (distinte dal menù: scriverne una non cancella l'altro) e riga "Conto separato" che si apre a comando |
| `e2e/menuscheda`, `e2e/menugruppi`, `e2e/sezioni` | Menù, gruppi del menu a tendina, navigazione fra le aree |
| `e2e/scontrino`, `e2e/galleria`, `e2e/grafica` | Foto scontrino (scatto e galleria), schede della cronologia |
| `e2e/cercalista`, `e2e/maschera` | Ricerche e maschera manuale a scomparsa |
| `e2e/regole` | Le regole del campo, **verbatim** |
| `e2e/dotazioni`, `e2e/gioco` | Dotazioni personali; minigioco |

## La rete funziona davvero?

Verificato rompendo l'app di proposito: cambiando l'arrotondamento delle quote
da 0,10 € a 0,05 €, `e2e/audit` è passato da 384 verifiche superate a
**383 superate, 1 problema**. Se cambi qualcosa nei conti e i test restano
verdi, o non hai cambiato niente di sostanziale, o manca una prova: aggiungila.
