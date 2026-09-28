# Camp Ops su Google Play — testi e risposte per Play Console

Preparato il 28 settembre 2026 sul ramo `camp-ops`. Le norme di Google sono
quelle verificate in `ROADMAP.md` § 3. Tutto quello che sta in un riquadro di
codice si incolla così com'è.

---

## 0. Lato codice: fatto il 28 settembre

La verifica del codice aveva trovato quattro blocchi e due decisioni. Sono
sistemati, con le prove viste rosse sabotando:

| # | Cosa | Com'è adesso |
| --- | --- | --- |
| 1 | Blocco con password | **Spento** nell'app pubblica (`APP_LOCK = null`). Protegge il codice d'ingresso del campo, e le regole Firestore custodiscono i dati |
| 2 | Modalità tecnica | **Del capogruppo** del campo aperto, senza password. Un membro non la accende, nemmeno se sul suo telefono era accesa (`e2e/capogruppo`). È una protezione dell'interfaccia, non delle regole: i dati li scrive qualunque redattore |
| 3 | Date del campo | **Dalla stanza**: il calendario si apre sul primo giorno del campo aperto (`e2e/periodo`) |
| 4 | Meteo | **Del Pro.** Il luogo lo sceglie il capogruppo — per nome, o incollando un link di Google Maps — e corregge la quota (`e2e/luogo`). Senza Pro il meteo non si scarica |
| — | Il Pro | **Si compra**, dall'app Android: una tantum per un campo o abbonamento annuale (§ 6). Cosa sblocca è in una tabella sola, `Stanza.FUNZIONI_PRO` (`e2e/pro`, `e2e/acquisto`, `unita/server-pro`) |
| — | Tracce della Brigata | Tolte «A Prato Lungo non c'è linea», il meteo «di Pereto» nella guida, l'esempio «Prato Lungo 2026», i file `bandone-…`. Una guardia vieta che rientrino |
| — | Spia «app scaricata sul telefono» | Era **sempre rossa** nell'app pubblica: cercava la cache col nome della Brigata. Ora la riconosce dalla forma del nome |
| — | Manifest | Aggiunti `id`, `scope`, descrizione, lingua e categoria |

**Resta da fare, e non è codice:**

| Cosa | Chi |
| --- | --- |
| Il contatto dell'informativa (`APP_CONFIG.privacy.contatto`) | **Tu**: l'indirizzo con dominio |
| Il campo di prova per il revisore, con dati finti | **Tu**, dall'app; il codice va nelle istruzioni del § 3 |
| `/.well-known/assetlinks.json` | Claude, quando mi passi l'impronta SHA-256 da Play Console |
| Gli screenshot | Claude, adesso che date e meteo sono giusti |

Già a posto, verificato: l'informativa (`privacy.html`, con IBAN e PayPal),
la cancellazione dell'account dentro l'app e dal web
(`cancella-account.html`), nessuna pubblicità, **nessuno strumento di
analisi caricato** (in `firebase-config.js` c'è un `measurementId`, ma
Analytics non viene mai avviato), nessun uso della posizione del telefono.

---

## 1. L'app in Play Console

| Campo | Valore |
| --- | --- |
| Nome dell'app | `Camp Ops` |
| Lingua predefinita | Italiano (it-IT) |
| App o gioco | App |
| Gratuita o a pagamento | Gratuita |
| Categoria | **Produttività** (non «Finanza»: l'app non muove denaro, e Finanza porta con sé le dichiarazioni sui servizi finanziari) |
| Email di contatto | l'indirizzo con dominio (vedi § 0, punto 5) |
| Sito web | l'indirizzo dell'app su Vercel |
| Informativa sulla privacy | `https://<indirizzo-dell-app>/privacy.html` |

---

## 2. Scheda dello store

### Italiano

**Titolo** (massimo 30 caratteri)
```
Camp Ops: spese del campo
```

**Descrizione breve** (massimo 80 caratteri)
```
Presenze, spese e conti del campo, divisi bene. Funziona anche senza linea.
```

**Descrizione completa**
```
Camp Ops tiene i conti di un campo di gruppo: chi c'era, chi ha mangiato, chi ha pagato cosa, e chi deve quanto a chi.

È pensata per i campi veri: in montagna, al mare, in tenda, dove la linea va e viene. Funziona anche offline e quando torna il segnale mette d'accordo i telefoni di tutti, senza che nessuno perda il lavoro degli altri.

COME FUNZIONA
• Chi organizza crea il campo e manda il codice agli altri, anche su WhatsApp.
• Chi riceve il codice entra: non serve registrarsi.
• Ognuno segna le sue presenze ai pasti e registra le spese che anticipa, con la foto dello scontrino.
• L'app divide tutto in modo giusto e dice chi deve rimborsare chi, con il minor numero di bonifici.

CONTI CHE TORNANO
• Il cibo lo paga chi ha mangiato, pasto per pasto. I pasti dei bambini sono gratis e si ripartiscono sugli adulti.
• Logistica e attrezzatura si dividono fra chi c'era.
• Una serata a parte? Il conto separato la tiene fuori dalla cassa comune.
• Il gasolio lo paga l'associazione? Il capogruppo lo toglie dalle quote, e resta dichiarato.
• Le cifre si arrotondano a 10 centesimi, e se qualcosa non torna l'app lo dice invece di nasconderlo.

TUTTO IL CAMPO IN UN POSTO
• Calendario e menù dei pasti, lista della spesa, attrezzatura del gruppo.
• «Chi fa cosa»: i compiti assegnati.
• Regole del campo e cosa portare, scritte dal capogruppo.
• Galleria delle foto del campo e archivio dei campi passati.
• Più campi? La home «I miei campi» li tiene tutti in ordine.

IL CAPOGRUPPO
Chi crea il campo lo amministra: scrive le regole e la lista di cosa portare, sceglie cosa si divide e nomina un aiutante, che prende il suo posto se deve lasciare il campo.

PRIVACY
Niente pubblicità, niente profilazione, niente strumenti di analisi. I dati di un campo li vedono solo i membri di quel campo.

In italiano, spagnolo e francese.
```

### Español

**Título**
```
Camp Ops: gastos del campamento
```
(31 caratteri: **uno di troppo**. Alternativa da 30: `Camp Ops: gastos de campamento`)

**Descripción breve**
```
Asistencias, gastos y cuentas del campamento, bien repartidos. También offline.
```

**Descripción completa**
```
Camp Ops lleva las cuentas de un campamento en grupo: quién estuvo, quién comió, quién pagó qué y quién le debe cuánto a quién.

Está pensada para campamentos de verdad: en la montaña, en la playa, en tienda de campaña, donde la cobertura va y viene. Funciona también sin conexión y, cuando vuelve la señal, pone de acuerdo los teléfonos de todos sin que nadie pierda el trabajo de los demás.

CÓMO FUNCIONA
• Quien organiza crea el campamento y envía el código a los demás, también por WhatsApp.
• Quien recibe el código entra: no hace falta registrarse.
• Cada uno marca sus comidas y registra los gastos que adelanta, con la foto del ticket.
• La app lo reparte todo de forma justa y dice quién debe devolver a quién, con el menor número de transferencias.

CUENTAS QUE CUADRAN
• La comida la paga quien comió, comida por comida. Las de los niños son gratis y se reparten entre los adultos.
• Logística y equipamiento se dividen entre quienes estuvieron.
• ¿Una noche aparte? La cuenta separada la deja fuera de la caja común.
• ¿El combustible lo paga la asociación? El jefe de grupo lo saca de las cuotas y queda declarado.
• Las cifras se redondean a 10 céntimos y, si algo no cuadra, la app lo dice en vez de esconderlo.

TODO EL CAMPAMENTO EN UN SOLO LUGAR
• Calendario y menú, lista de la compra, equipamiento del grupo.
• «Quién hace qué»: las tareas asignadas.
• Normas del campamento y qué traer, escritas por el jefe de grupo.
• Galería de fotos y archivo de los campamentos pasados.
• ¿Varios campamentos? La pantalla «Mis campamentos» los ordena todos.

PRIVACIDAD
Sin publicidad, sin perfiles, sin herramientas de análisis. Los datos de un campamento solo los ven sus miembros.

En italiano, español y francés.
```

### Français

**Titre**
```
Camp Ops : dépenses du camp
```

**Description courte**
```
Présences, dépenses et comptes du camp, bien partagés. Fonctionne hors ligne.
```

**Description complète**
```
Camp Ops tient les comptes d'un camp en groupe : qui était là, qui a mangé, qui a payé quoi, et qui doit combien à qui.

Elle est pensée pour les vrais camps : à la montagne, à la mer, sous la tente, là où le réseau va et vient. Elle fonctionne aussi hors ligne et, quand le signal revient, elle met d'accord les téléphones de chacun sans que personne ne perde le travail des autres.

COMMENT ÇA MARCHE
• L'organisateur crée le camp et envoie le code aux autres, aussi par WhatsApp.
• Qui reçoit le code entre : pas besoin de s'inscrire.
• Chacun note ses repas et enregistre les dépenses qu'il avance, avec la photo du ticket.
• L'app répartit tout de façon juste et indique qui doit rembourser qui, avec le moins de virements possible.

DES COMPTES QUI TOMBENT JUSTE
• La nourriture est payée par ceux qui ont mangé, repas par repas. Les repas des enfants sont gratuits et répartis entre les adultes.
• Logistique et équipement se partagent entre ceux qui étaient là.
• Une soirée à part ? Le compte séparé la garde hors de la caisse commune.
• Le carburant est payé par l'association ? Le chef de groupe le retire des parts, et il reste déclaré.
• Les montants sont arrondis à 10 centimes et, si quelque chose ne va pas, l'app le dit au lieu de le cacher.

TOUT LE CAMP AU MÊME ENDROIT
• Calendrier et menus, liste de courses, équipement du groupe.
• « Qui fait quoi » : les tâches attribuées.
• Règles du camp et quoi apporter, écrites par le chef de groupe.
• Galerie de photos et archives des camps passés.
• Plusieurs camps ? L'écran « Mes camps » les range tous.

CONFIDENTIALITÉ
Pas de publicité, pas de profilage, pas d'outils d'analyse. Les données d'un camp ne sont visibles que par ses membres.

En italien, espagnol et français.
```

### Grafica da preparare

| Cosa | Misura | Note |
| --- | --- | --- |
| Icona | 512 × 512 PNG | c'è già: `icon-512.png` |
| Grafica in evidenza | 1024 × 500 PNG/JPG | da fare: logo su fondo crema, con la frase «Le spese del campo, divise bene» |
| Screenshot telefono | da 2 a 8, lato corto almeno 320 px | da fare: li genero io con il browser delle prove (home, calendario, spese, saldi, regole) |

---

## 3. Contenuti dell'app (Policy → Contenuti dell'app)

### Norme sulla privacy
```
https://<indirizzo-dell-app>/privacy.html
```

### Accesso alle app
Scegli: **«Tutte le funzionalità o alcune sono soggette a restrizioni»**, perché
senza un campo l'app mostra solo la home. Istruzioni per il revisore:
```
Camp Ops works inside a "camp" (a private group). To review it with real data:
1. Open the app and tap "Ho un codice" (I have a code).
2. Enter the code: XXXX-XXXX
3. You are now inside a sample camp with members, meals and expenses.
No account is needed. To test account features, sign in with Google from Settings (Impostazioni).
```
Il codice va creato apposta: **un campo di prova con dati finti** (membri
inventati, qualche spesa), non un campo vero. Va tenuto vivo finché l'app è
sullo store: il revisore ci rientra a ogni aggiornamento.

### Annunci
**No**, l'app non contiene annunci.

### Classificazione dei contenuti (questionario IARC)
- Categoria: **Utilità, produttività, comunicazione o altro**.
- Violenza, sesso, linguaggio volgare, droghe, gioco d'azzardo: **no** a tutto.
- «Gli utenti possono interagire o scambiarsi contenuti?» **Sì**: dentro un
  campo i membri vedono nomi, spese, foto e testi degli altri membri.
- «L'app condivide la posizione dell'utente con altri?» **No**.
- «L'app consente acquisti di beni digitali?» **Sì**: il Pro, venduto con
  Google Play Billing (§ 6).

### Pubblico di destinazione
- Fasce d'età: **18 anni e oltre**.
- «L'app potrebbe attirare i bambini?» **No**. Nei campi ci sono bambini, ma
  li segnano gli adulti: l'app la usano gli adulti che organizzano e pagano.
  Scegliere fasce più giovani porterebbe le norme «Famiglie», che qui non
  servono.

### App di notizie / governative / sanitarie / COVID / finanziarie
**No** a tutte. Per le funzionalità finanziarie: **«La mia app non fornisce
funzionalità finanziarie»** — divide le spese e mostra un IBAN da copiare,
ma non muove denaro e non si collega a banche.

### Sicurezza dei dati (Data safety)

**Domande generali**
| Domanda | Risposta |
| --- | --- |
| L'app raccoglie o condivide dati utente dei tipi richiesti? | **Sì** |
| Tutti i dati sono criptati in transito? | **Sì** (HTTPS e Firebase) |
| Gli utenti possono chiedere la cancellazione dei dati? | **Sì** |
| URL per la cancellazione dell'account | `https://<indirizzo-dell-app>/cancella-account.html` |
| Dati condivisi con terze parti | **Nessuno.** Firebase (Google) e Vercel trattano i dati per conto dell'app: per Google sono «fornitori di servizi», non condivisione. Open-Meteo riceve solo le coordinate del campo e, se il capogruppo cerca il luogo per nome, quel nome: non dati degli utenti. Google Play fa pagare il Pro: è Google, e per Google è un fornitore di servizi. WhatsApp riceve solo quello che l'utente sceglie di condividere. |

**Tipi di dati raccolti** — per tutti: *raccolti*, *non condivisi*, trattamento **non facoltativo** salvo dove scritto, finalità **Funzionalità dell'app** (e **Gestione dell'account** dove indicato).

| Categoria Google | Tipo | Note per la risposta |
| --- | --- | --- |
| Informazioni personali | **Nome** | nome e cognome dell'account; nomi dei partecipanti scritti dai membri. Funzionalità + Gestione account |
| Informazioni personali | **Indirizzo email** | solo per chi crea un account. **Facoltativo**. Gestione account |
| Informazioni personali | **ID utente** | l'identificativo Firebase (anche anonimo). Funzionalità |
| Informazioni finanziarie | **Altre informazioni finanziarie** | IBAN o PayPal, se l'utente li inserisce per farsi rimborsare. **Facoltativo** |
| Foto e video | **Foto** | foto degli scontrini e della galleria del campo. **Facoltativo** |
| Attività nelle app | **Altri contenuti generati dagli utenti** | spese, presenze, menù, liste, compiti, regole |
| Informazioni finanziarie | **Cronologia acquisti** | chi ha comprato il Pro, per quale campo, e il numero d'ordine di Google (mai la carta: la vede solo Google). Solo per chi compra. Funzionalità dell'app |

**Non** raccolti: posizione, contatti, messaggi, cronologia di navigazione,
dati di salute, audio, file, calendario, identificativi del dispositivo per
pubblicità, dati di diagnostica e arresti anomali.

---

## 4. Test chiuso — obbligatorio prima della produzione

Per gli account sviluppatore **personali creati dopo il 13 novembre 2023**
Google chiede un **test chiuso con almeno 12 tester che restino iscritti per
14 giorni di fila** prima di aprire la produzione (`ROADMAP.md` § 3).

1. Test → Test chiuso → crea un canale, carica il pacchetto.
2. Tester: una **Google Group** o un elenco di indirizzi Gmail. I venti del
   campo 2026 sono i candidati naturali, e sono anche il feedback più
   affidabile che esista.
3. Il conto dei 14 giorni parte quando ci sono 12 iscritti: conviene
   arruolarne 15, per non ricominciare se qualcuno esce.
4. Alla fine Google chiede un breve questionario (cosa hai testato, cosa hai
   cambiato): le risposte si scrivono da quello che i tester hanno detto.

---

## 5. Il pacchetto Android

L'app resta una web app: sullo store va un **contenitore Android (Trusted Web
Activity)** che la apre a schermo intero. Si genera con **PWABuilder**
(pwabuilder.com) o **Bubblewrap**, partendo dall'indirizzo dell'app.

| Campo | Valore consigliato |
| --- | --- |
| Nome del pacchetto | `app.campops` oppure `it.<tuodominio>.campops` — **non si cambia più**, sceglilo con calma |
| Nome da mostrare | `Camp Ops` |
| Colore tema e sfondo | `#2D392C` (quelli del manifest) |
| Firma | **Play App Signing** (la chiave la custodisce Google) |

Poi, in Play Console → Configurazione → Integrità dell'app, copi
l'**impronta SHA-256 del certificato di firma dell'app** e me la passi: la
metto in `/.well-known/assetlinks.json`, così l'app si apre senza la barra
del browser. È l'ultimo passo prima di caricare il pacchetto definitivo.


---

## 6. Il Pro: i prodotti e il server

Il codice c'è (`functions/`, `stanza.js`, `firestore.rules`). Queste sono le
cose che si fanno a mano, una volta, **in quest'ordine**. Nessuna chiede una
chiave di servizio: il server usa l'identità che Google gli dà, e quella si
autorizza in Play Console (passo 4).

1. **Firebase → piano Blaze** (progetto `camp-ops`). Le funzioni lo
   richiedono. Metti subito un **avviso di budget** (es. 5 €/mese) in Google
   Cloud → Fatturazione: con questi numeri non si esce dalla soglia gratuita,
   ma un avviso costa niente.
2. **Google Cloud → API e servizi → abilita «Google Play Android Developer
   API»** nel progetto `camp-ops`.
3. **Pubblica il server**, dalla cartella del repository:
   `npx firebase deploy --only functions --project camp-ops`.
   Al primo giro chiede `PACCHETTO_ANDROID`: il nome del pacchetto del § 5
   (lo stesso, lettera per lettera). Crea tre funzioni a Torino
   (`europe-west12`): `attivaPro`, `proAlCampoNuovo`, `notifichePlay`.
4. **Play Console → Utenti e autorizzazioni → Invita** l'account di servizio
   delle funzioni: `<numero-del-progetto>-compute@developer.gserviceaccount.com`
   (il numero è in Firebase → Impostazioni progetto). Autorizzazioni a livello
   di app: **Visualizza dati finanziari** e **Gestisci ordini e abbonamenti**.
   Può volerci fino a un giorno prima che valga.
5. **Play Console → Monetizza → Prodotti**:
   - *Prodotti in-app* → `pro_campo` — «Pro per un campo». Prezzo tuo
     (ROADMAP § 7 suggerisce 4–8 €).
   - *Abbonamenti* → `pro_anno` — «Camp Ops Pro, un anno», con un piano base
     **annuale a rinnovo automatico** (ROADMAP § 7: 10–15 €).
   Gli identificativi vanno scritti **esattamente così**: sono quelli che
   l'app vende e che il server verifica, e una prova controlla che i due
   combacino.
6. **Notifiche in tempo reale** (rinnovi, disdette, rimborsi): Play Console →
   Monetizza → Configurazione della monetizzazione → argomento
   `projects/camp-ops/topics/play-billing` (lo crea il passo 3). In Google
   Cloud → Pub/Sub → quell'argomento → Autorizzazioni, dai **Publisher** a
   `google-play-developer-notifications@system.gserviceaccount.com`. Poi
   «Invia notifica di prova».
7. **Regole Firestore**: incolla `firestore.rules` in console (le foto degli
   scontrini nel cloud sono del Pro, e le regole lo sanno). Provate con
   `npm run regole`: 101 verifiche.
8. **Il pacchetto Android con Play Billing**: in PWABuilder spunta *Google
   Play Billing*; con Bubblewrap, in `twa-manifest.json`,
   `"features": { "playBilling": { "enabled": true } }` e
   `"alphaDependencies": { "enabled": true }`.
9. **Provalo senza pagare**: Play Console → Configurazione → Test delle
   licenze → aggiungi il tuo indirizzo. Dal test chiuso compri davvero, con
   la carta di prova, e il Pro arriva come arriverà a tutti.

**Cosa succede quando qualcuno paga.** Google fa pagare e dà all'app un
gettone. L'app lo manda al server (`attivaPro`), che chiede a Google se è
pagato, controlla che chi chiede sia il capogruppo di quel campo, scrive il
Pro nella stanza e conferma l'acquisto a Google. Solo dopo, l'app «consuma»
l'acquisto una tantum: così si può ricomprare per un altro campo. Se in
mezzo cade la linea, l'acquisto resta pagato e in sospeso: riaprendo il
campo l'app lo ritrova e finisce il lavoro, senza far pagare due volte.

**Quanto dura.** Una tantum: fino a **tre mesi dopo la fine del campo**
(se il campo è già finito, tre mesi da oggi). Abbonamento: tutti i campi di
cui si è capogruppo, anche quelli creati dopo, finché è pagato. Passando il
campo all'aiutante il Pro si spegne: l'ha pagato chi se ne va.
