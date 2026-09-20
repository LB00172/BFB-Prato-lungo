# Verifiche automatiche

Rete di sicurezza dell'app. Serve soprattutto per i lavori grossi — spezzare
i sorgenti, rifare una sezione — dove il rischio non è sbagliare una riga, ma
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
| `schermate-confronto.js` | **Non è una prova, è lo strumento del § 14.** Fotografa il DOM delle sedici schermate su file, e confronta due fotografie carattere per carattere. Si usa per spostare codice senza rischiare: `node test/schermate-confronto.js prima.json`, si sposta, `… dopo.json`, `… prima.json dopo.json`. Serve il server acceso |
| `lib/app.js` | Aiuti condivisi: dove sta Chromium, `apri()` l'app già sbloccata, `ok()` / `fine()`, e `fotoSalvate()` / `scontriniSalvati()` — che chiedono **quali foto ci sono**, non cosa c'è in una certa chiave. Le foto si sono già spostate una volta (da `localStorage` al magazzino IndexedDB): le prove che guardavano la chiave sono diventate rosse, quelle che chiedevano le foto no |
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
| `unita/compilazione` | i sorgenti di `src/` compilano, **sono tutti elencati in `build.js`** e l'ordine regge ai due estremi (React in testa, il mount in coda); **ogni bottone chiede un ruolo e una misura che esistono** — un `whatsap` invece di `whatsapp` produce un bottone del colore sbagliato che nessuna prova e2e vede, perché il bottone c'è, funziona e ha il testo giusto; **`App.js` è allineato** (cioè non hai dimenticato `npm run build`); il `CACHE_NAME` c'è; **ogni file che l'app carica dal proprio dominio** — script, fogli di stile, font, icone, immagini usate dal codice — sta nel precache, e ogni file del precache esiste davvero (uno mancante fa fallire l'installazione del service worker: `addAll` è tutto-o-niente, e i telefoni resterebbero alla versione vecchia in silenzio) |
| `unita/fusione-motore` | I 59 casi del motore di fusione (`sync-merge.js`): voci nuove da due telefoni, cancellazioni, lapidi, convergenza, **orologi sbagliati** (telefono indietro che deve comunque vincere anche **dopo aver chiuso e riaperto l'app**, telefono avanti che non deve trascinare gli altri né spaccare l'accordo), app vecchia che non deve cancellare nulla, e **quando** è stata fatta una cancellazione — un membro tolto vale sette percorsi, non sette danni |
| `unita/arrotondamenti` | Quote sempre multiple di 0,10 €; riconciliazione dello scarto solo sopra i 50 cent |
| `unita/sovrascrittura-regola` | La regola che sta fra il lavoro di tutti e una sovrascrittura (`sovrascrivibile` in `firebase-sync.js`): quando si può scrivere sopra il documento del cloud e quando no, compresa la sequenza completa del rientro dal campo — rifiuto, fusione, scrittura dell'unione |
| `unita/pdf-ricordo` | Il PDF "foto ricordo": struttura del file, **ogni voce della tavola degli scarti punta al suo oggetto**, JPEG incorporati senza ricodifica, impaginazione, nessun tetto al numero di foto, accenti e ingressi rotti. Salva un esempio in `test/tmp/ricordo.pdf` |

**Con l'app vera**

| Prova | Cosa verifica |
|---|---|
| `e2e/audit` | **384 verifiche**: tutta la catena dal carico spese a "chi paga chi", su 20 scenari (bambini, conto separato, giorni vuoti, acquirenti fantasma, campo intero disordinato) |
| `e2e/netting` | Chi ha anticipato paga la sua quota come gli altri; i passaggi di pareggio |
| `e2e/pagamenti` | PayPal e IBAN per membro, controllo mod-97, comparsa nei Saldi, tasto copia |
| `e2e/schermate` | **Tutte e sedici le schede si aprono e disegnano qualcosa di sensato**: nessuna vuota, nessun `undefined`/`NaN`/`[object Object]` a schermo, ogni scheda ha un titolo, nessun errore JS. Nata dalla divisione di `80-app.jsx`: il modo di sbagliare più probabile non è un errore rumoroso, è una scheda che si apre vuota perché una dipendenza non è stata passata. La semina e la cattura del DOM stanno in `test/lib/schermate.js` e servono anche da **attrezzo**: si cattura, si sposta il codice, si ricattura, e i due HTML devono essere identici al carattere. Verificata togliendo `members` dalla chiamata di `schedaMembri` → 3 verifiche rosse che nominano la scheda rotta |
| `unita/menu-spesa` | Il lettore dei menù: nome e quantità nelle tre forme che la gente scrive davvero (`Vongole: 1,5 kg 6€ al kg`, `150 arrosticini`, `FIORENTINA 5kg`), intestazioni PRANZO/CENA scartate, virgole che separano solo dove non c'è quantità, doppioni riconosciuti senza badare a maiuscole. **I casi non sono inventati: sono copiati dall'export del campo 2026.** Verificata rendendo obbligatoria l'unità nella quantità in testa → 5 rosse, e togliendo il `toLowerCase` al filtro dei doppioni → 1 rossa |
| `unita/allarmi` | **Quando svegliare qualcuno, e quando no.** Le due decisioni più delicate dell'app: un orologio avanti di giorni, e perdite che meritano un allarme invece di essere il recupero di un ritardo. Il caso che ha fatto nascere la regola è vero: togliere un membro cancella anche le sue presenze di tutti i giorni — sette «voci perse» per un gesto solo, scoperte tre giorni dopo. Verificata con sei sabotaggi: contare tutte le perdite invece della raffica → 5 rosse, smettere di guardare QUANDO → 3, bastare una voce sola → 2, la soglia dell'orologio da «oltre» a «almeno» → 1, guardare solo le modifiche e non le lapidi → 1, far entrare una data scritta come stringa → 2 |
| `unita/conti-campo-2026` | **I conti di un campo vero, in centesimi di secondo.** 59 persone, 7 giorni, 35 spese, due casse: i numeri di chiusura di Prato Lungo 2026 (`fixture/campo-2026.json`, nomi sostituiti e cifre intatte). Difende le decisioni che, se sbagliate, si scoprono davanti a venti persone che devono darsi dei soldi: 2.303,59 € spesi contro 2.303,60 € raccolti, zero buchi, le due casse che chiudono ognuna per conto suo, i bambini che non pagano, la logistica ai soli giorni comuni, e l'ottimizzatore che sposta i bonifici senza spostare le posizioni. Verificata con sei sabotaggi: logistica a chiunque abbia un pasto → 8 rosse, bambini contati come adulti → 7, cassa separata sciolta nella comune → 10, niente arrotondamento a 10 cent → 6, ottimizzatore spento → 2, divisore dell'attrezzatura sbagliato → 1 |
| `unita/presenze` | Le regole da cui dipendono le quote: un giorno, un pasto, il blocco, le presenze orfane. **Due fonti e due mestieri:** sul campo vero prova che su dati sani non si inventa niente (zero orfane, 413 pasti letti identici ai dati); i guasti — che nel 2026 per fortuna non c'erano — sono costruiti a mano. Verificata con sei sabotaggi: una voce a zero contata come presenza → 1 rossa, `applicaBlocchi` che torna sempre un oggetto nuovo → 2, il blocco che non rimette a posto i pasti → 2, `conBlocco` che dimentica la copia congelata → 1, un blocco scritto male preso per buono → 1, `giorniBloccatiDi` che non guarda se la persona c'era → 1 |
| `unita/magazzino-foto` | Le due regole che decidono se si perde una foto o se si riempie di nuovo la memoria: `daScrivere` tocca solo ciò che è cambiato (la trentesima foto fa partire **una** scrittura, non trenta) e `migrazioneRiuscita` confronta i **contenuti**, non i conteggi. Verificata riscrivendo tutto a ogni foto → 3 rosse, accontentandosi che la chiave esista → 1 rossa, e non cancellando mai niente → 2 rosse |
| `e2e/magazzino-foto` | Tre foto da un megabyte nella vecchia chiave: si spostano in IndexedDB, la chiave vecchia sparisce, `localStorage` torna da 3 MB a **2 KB**, le foto sopravvivono al riavvio, quella di una voce inesistente non resta, e senza magazzino (browser che non lo concede) l'app non crolla e lo dice. Verificata tornando a scrivere in `localStorage` → 3 rosse, togliendo le foto dalle dipendenze della potatura → 4 rosse, e togliendo la rete di sicurezza → 1 rossa |
| `e2e/meteo` | Una previsione sola per tutto il campo, e nessun modo di restare appesi a una previsione morta: l'orologio avanti, la faccia della giornata (condizione prevalente, non la peggiore), i millimetri al posto della probabilità, la cache che resta visibile offline. **Il bollettino finto copre il campo, non "oggi ±30 giorni"**: con la vecchia finestra la prova ha cominciato a fallire da sola a settembre 2026, undici verifiche rosse per un motivo che col meteo non c'entrava. Le date del campo si leggono da `src/40-configurazione.jsx`, non si riscrivono |
| `e2e/pronto` | «Pronto per il campo»: l'avviso c'è quando c'è un campo e manca qualcosa, **e non c'è** quando un campo non c'è — a campo chiuso le liste sono vuote di proposito, e l'avviso restava lì per sempre su un telefono a posto. Basta una voce in lista perché i controlli tornino. Verificata rimettendo l'avviso incondizionato → 1 rossa, lasciando la scheda che elenca i controlli comunque → 3 rosse, e restringendo «campo in corso» ai soli membri → 2 rosse |
| `e2e/compiti` | «Chi fa cosa»: assegnare, segnare fatto, correggere il testo strada facendo, il ponte verso la spesa, e la bandiera che spegne la scheda. **La verifica che conta è la prima:** assegnare un compito non muove un euro — i conti restano a 40,00 € prima, durante e dopo. Verificata con cinque sabotaggi: far entrare il compito nei conti → 3 rosse, togliere il nome dal ponte → 1, inventare un prezzo → 1, azzerare la persona dopo ogni assegnazione → 2, ignorare la bandiera → 1 |
| `e2e/menu-spesa` | Il giro completo dal menù alla lista: il tasto propone, **la lista non si muove finché non confermi**, le spunte comandano, i doppioni non ricompaiono, ripremendo ripropone solo quello che avevi scartato (cioè il doppione si riconosce dal contenuto, non dal tasto premuto), e su un giorno senza menù non apre niente. Verificata facendo scrivere la proposta direttamente in lista → 4 rosse |
| `e2e/album` | Galleria: tetto per persona, miniatura più leggera dell'originale, **nessuna foto in localStorage**, vista Album sfogliabile e vista Griglia, **album completo** con tutte le foto in ordine di scatto (l'ordine si verifica registrando in che sequenza l'app chiede gli originali), scelta a mano come seconda strada, PDF davvero scaricato, chiusura del campo che timbra le foto invece di cancellarle. Verificata rimettendo il tetto di 12 → 2 rosse in `unita/pdf-ricordo`; passando le foto nell'ordine della galleria → 1 rossa; passandone solo due → 2 rosse |
| `e2e/separato` | Conto separato: giorni spuntati, pasti fuori dal divisore comune, le due schede "Quote cassa comune"/"Quote cassa separata", chi non c'era nei giorni spuntati non compare nella cassa separata, e togliendo la spunta i soldi separati diventano un buco dichiarato **in quella cassa** invece di sparire nella comune |
| `e2e/ottimizza` | Il tasto "Ottimizza i passaggi": due bonifici fra le stesse persone diventano uno solo, la cifra totale non cambia, le quote dovute nemmeno, le spunte dell'ottimizzato hanno chiave propria (`opt:`) e la vista scelta resiste al riavvio. Verificata togliendo l'ottimizzazione → il tasto sparisce, e togliendo il prefisso `opt:` → la spunta finisce nella chiave della cassa |
| `e2e/due-casse` | Le due casse producono lo stesso identico passaggio (Bruno → Alice 20 €): spuntarne uno **non** deve spuntare l'altro. Verificata togliendo il prefisso di cassa dalla chiave del rimborso → 3 verifiche rosse, con la seconda spunta che cancellava la prima |
| `e2e/dueflussi` | I due modi di registrare una spesa portano allo stesso conto |
| `e2e/acquirente` | L'acquirente si sceglie dai membri, niente nomi scritti a mano |
| `e2e/correzioni` | Correzione di una spesa già salvata (la matita) |
| `e2e/chiusura` | Chiusura del campo: archivio scaricato, liste azzerate, totali a zero |
| `e2e/fusione` | La fusione dentro l'app: due telefoni offline, nessun dato perso |
| `e2e/scorte` | Copie locali **due volte al giorno** (mattina e pomeriggio, con lo stato precedente alla modifica che le fa scattare), potatura per numero e per spazio, **ripristino che funziona senza linea**, e promemoria serale del backup: compare solo nei giorni del campo, di sera, e solo se ci sono state modifiche. Usa un orologio pilotabile, così l'esito non dipende da quando si lancia la prova |
| `e2e/tenuta` | I guasti silenziosi della sincronizzazione: scrittura fallita che dev'essere ritentata e segnalata ("Da inviare"), campo vuoto nel cloud che va ripopolato, memoria del telefono piena che va detta, **foto e scontrini che finiscono in coda invece di perdersi** e partono da soli quando la linea regge, e la **cronologia che sopravvive alla memoria piena**: si salva prima delle copie di sicurezza, e se lo spazio manca sacrifica loro |
| `e2e/registro` | Registro delle modifiche (locali e in arrivo, con data e ora, esportabile) e ciclo offline→online: il lavoro fatto senza linea sopravvive, viene ripubblicato, e ricevere ciò che si è appena spedito non produce un altro invio |
| `e2e/perdita` | **Perdita di dati**: cancellazioni datate in arrivo dal cloud, freno di sicurezza, copia di scorta, "Annulla la sincronizzazione" con ridatazione, diagnostica, che "Copia da ieri" non cancelli le presenze di nessuno, e il **recupero del ritardo**: un telefono rimasto indietro che viene a sapere di cancellazioni di giorni prima non deve gridare al disastro, ma deve comunque poterle annullare |
| `e2e/admin` | Modalità tecnica: l'utente normale non vede diagnostica, registro né allarmi (ma la copia di scorta si salva lo stesso, in silenzio); la password sbagliata non apre niente, quella giusta accende tutto, la scelta sopravvive alla riapertura e si può spegnere. Le altre prove aprono l'app **già in modalità tecnica** (`apri({ admin: false })` per l'utente normale) |
| `e2e/sovrascrittura` | Un altro telefono ha pubblicato del lavoro che questo non ha mai visto: la scrittura viene **annullata**, il lavoro altrui viene ricevuto e fuso, e nel cloud finisce l'**unione**. Quando invece non ci sono novità, la scrittura passa al primo colpo |
| `e2e/sostituzioni` | Ripristino e importazione: la conferma dice **la data del backup, cosa contiene e quante voci spariranno da tutti i telefoni**; un file che non è un backup viene rifiutato; la copia di scorta si salva anche su chi fa l'operazione, e l'annullamento funziona davvero |
| `e2e/riaggancio` | Ritorno della linea e riaggancio al cloud |
| `e2e/login` | Blocco con password, tentativi sbagliati, "blocca ora" |
| `e2e/autochiede` | L'app chiede da sola la password quando serve al database |
| `e2e/smoke` | L'app si apre e resta usabile anche senza rete |
| `e2e/presenze` | Presenze, "tutti a pranzo/cena", copia da ieri |
| `e2e/sanita` | Le due cose che non riguardano la fusione ma il mondo reale: un telefono con l'**orologio avanti di un anno** dev'essere rilevato e annunciato (l'avviso sopravvive alla riapertura, si chiude a mano, e non compare all'utente normale); e una **cifra fuori scala** dev'essere fermata prima di entrare — quattro spese normali non fanno domande, 870 € su una mediana di 24 sì, e sopra i 1000 € si chiede comunque |
| `e2e/verdetto` | **Il risultato non deve dipendere dalla strada.** Lo stesso campo (3 persone, 4 giorni, 3 spese) fatto in tre modi: da un telefono solo sempre online; diviso fra due telefoni offline che poi si riagganciano; e con i due che rientrano in ordine inverso. Quote, "chi paga chi", raccolto e buco devono venire **identici** in tutti e tre. Poi: la stessa presenza toccata da entrambi mentre sono scollegati (vince la più recente, **su tutti e due**), l'app senza linea che continua a fare i conti e se li ricorda dopo la riapertura, e un ulteriore scambio che non deve più muovere niente (convergenza) |
| `e2e/oracolo` | **I conti sono giusti, non solo stabili.** Cinque scenari con i risultati calcolati a mano (quote, arrotondamento sotto soglia, bambini, giorni gratis, conto separato, chi paga chi) più cinque invarianti su otto scenari generati a caso: quote ≥0 e multiple di 10 cent, bambini a zero, chi ha pasti solo nei giorni gratis a zero, raccolto + buco = totale speso, passaggi di pareggio positivi. Legge `window.__totali`, cioè i numeri esatti, non il testo a schermo. Verificata rompendo l'app di proposito: arrotondamento a 5 cent invece di 10 → 4 verifiche rosse; giorni gratis che tornano a contare come presenza → 1 rossa |
| `e2e/gratis` | Giorni gratis: le presenze restano segnate ma escono dai conti; **chi è venuto solo in un giorno gratis paga zero, logistica compresa**; la somma delle quote continua a fare il totale speso; la conferma avverte che la spesa già registrata si redistribuisce; si torna indietro e le quote tornano quelle di prima; senza modalità tecnica il tasto non c'è |
| `e2e/blocco` | Presenze bloccate: i tasti si spengono davvero (e forzarli non serve), "Tutti a pranzo" non passa, un aggiornamento **datato adesso** non scalfisce il giorno chiuso e la correzione viene **ripubblicata**; sbloccando tornano i pasti congelati, non quelli arrivati nel frattempo; senza modalità tecnica il tasto non c'è |
| `e2e/conti-chiusi` | Chiusura dei conti: congela spese e attrezzatura e blocca i giorni ancora aperti; aggiungere una spesa viene rifiutato con una spiegazione; una spesa in arrivo dalla **sincronizzazione** non entra, viene segnalata con nome e cifra e la correzione viene ripubblicata; riaprendo si torna a lavorare; senza modalità tecnica il tasto non c'è |
| `e2e/buchi` | Soldi che non entrano in nessuna quota: 100 € di "conto separato" senza giorni separati **non** vengono spalmati sulle quote come se fossero arrotondamento, il buco si vede con cifra e motivo in Quote, nei Saldi e nel resoconto, e spuntando il giorno separato si chiude |
| `e2e/corsa` | Una spunta e un aggiornamento in arrivo nello stesso giro di disegno: la spunta dev'essere datata, spedita, e sopravvivere a un aggiornamento più vecchio che la contraddice |
| `e2e/doppioni` | Stessa persona aggiunta da due telefoni offline: la fusione tiene **entrambe** (sono voci nuove legittime), l'app lo segnala spiegando che sbaglia la quota di tutti, e unendo le due schede **somma** le presenze e non perde l'IBAN compilato solo su una. Per le spese doppie invece segnala e basta: di mezzo ci sono i soldi |
| `e2e/orfane` | Membro eliminato e riaggiunto: le sue presenze restano appese al vecchio id. L'app le trova, le chiama per nome, le riassegna sommandole a quelle già segnate, o le butta |
| `e2e/calendario` | Note libere del giorno (distinte dal menù: scriverne una non cancella l'altro) e riga "Conto separato" che si apre a comando |
| `e2e/menuscheda`, `e2e/menugruppi`, `e2e/sezioni` | Menù, gruppi del menu a tendina, navigazione fra le aree |
| `e2e/scontrino`, `e2e/galleria`, `e2e/grafica` | Foto scontrino (scatto e galleria), schede della cronologia |
| `e2e/cercalista`, `e2e/maschera` | Ricerche e maschera manuale a scomparsa |
| `e2e/regole` | Le regole del campo, **verbatim** |
| `e2e/dotazioni`, `e2e/gioco` | Dotazioni personali; minigioco |
| `e2e/livelli` | I quattro livelli di "Aiuta Bandy" — **Prato Lungo**, **Palmiro Togliatti**, **Rio de Janeiro**, **Thailandia** — controllati guardando i pixel: il bosco verde, la città che perde il verde, la spiaggia, e la notte thailandese (buia davvero, insegne al neon ai lati e non in mezzo alla strada, rosso e blu della bandiera, corpo leggibile sull'asfalto scuro) — la sabbia deve dominare il campo da gioco, il mare deve stare in una fascia a sinistra (non a macchie sparse) e il verde e il giallo delle bandiere brasiliane devono esserci davvero. Ogni livello dev'essere chiamato per nome, e il nome deve restare nella riga del punteggio anche dopo che il cartello è sparito. Salva una schermata in `test/tmp/livello3-gioco.png` |

## La rete funziona davvero?

Verificato rompendo l'app di proposito: cambiando l'arrotondamento delle quote
da 0,10 € a 0,05 €, `e2e/audit` è passato da 384 verifiche superate a
**383 superate, 1 problema**. Se cambi qualcosa nei conti e i test restano
verdi, o non hai cambiato niente di sostanziale, o manca una prova: aggiungila.
