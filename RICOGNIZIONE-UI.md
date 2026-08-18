# Ricognizione dell'interfaccia

Materiale per il lavoro di settembre (`ROADMAP.md`: spezzare `src/7-app.jsx`, versione
neutra per lo store). **Non è una proposta di redesign**: è la misura di cosa
c'è adesso, così quel lavoro parte da dati e non da impressioni.

Misurato sul sorgente il 9 agosto 2026, a 55 prove verdi. I numeri di riga citati
qui sotto sono quelli dell'allora `App.jsx`, prima della divisione in `src/`:
valgono come proporzioni, non come indirizzi.

## Metodo, e cosa è stato escluso

Le righe **526–1301** sono le tavolozze e le funzioni di disegno del gioco
(`drawForest`, `drawStreet`, `drawBeach`, `drawThai`, i corpi). Sono pixel art:
lì le sfumature vicine sono il mestiere, non deriva. Contarle insieme
all'interfaccia dà 142 colori e un allarme falso. Escluse.

## Colori: la tavolozza è già disciplinata

**16 colori in tutta l'interfaccia.** Otto fanno il 99% del lavoro:

| Colore | Volte | Ruolo |
| --- | --- | --- |
| `#2D392C` | 253 | verde bosco — identità, testo forte, pieni |
| `#8F9E8B` | 202 | salvia — bordi, testo secondario |
| `#5C4A3C` | 116 | marrone — secondo pieno, etichette |
| `#D97706` | 86 | ambra — **avvisi** |
| `#F0F4F1` | 84 | verde chiarissimo — fondi |
| `#E2EAE4` | 28 | verde chiaro — passaggio del mouse |
| `#1F271E` | 25 | verde quasi nero — pieni premuti |
| `#463628` | 11 | marrone scuro — pieni premuti |

Gli altri otto sono comparse legittime: `#25D366` (verde WhatsApp, marchio
altrui), `#8FBF8F`, `#F6C177` (stato sospeso), `#E9B48E`, `#F0A0A0`.

**Una sola coppia quasi identica in tutta l'interfaccia**: `#1A201A` (usato una
volta sola, riga 350, colore della barra di sistema in tema scuro) contro
`#1F271E` (25 volte). Distanza RGB 9,5: a occhio sono lo stesso colore.

### Le due eccezioni sono recenti, e sono mie

Aggiunte il 7 agosto scrivendo il blocco del meteo:

- `#5C8AA8` (riga 4928) — l'azzurro della goccia di pioggia. Unico blu
  dell'interfaccia.
- `#A9752F` (riga 4944) — l'ambra di «Previsioni vecchie». **Ma l'ambra degli
  avvisi esiste già ed è `#D97706`, usata 86 volte.** Ne ho introdotta una
  seconda per lo stesso scopo senza accorgermene.

È esattamente il modo in cui una tavolozza si sfalda: non con una decisione, ma
con un colore alla volta scelto guardando lo schermo invece dell'elenco.

## Bottoni: qui il sistema manca davvero

**127 bottoni, 100 stringhe di classi distinte.** Raggruppandoli per *forma*
invece che per stringa — larghezza, tipo di pieno, bordo, altezza, maiuscolo —
restano **47 famiglie**. Le più numerose:

| Volte | Forma |
| --- | --- |
| 11 | auto · nudo · senza bordo · normale |
| 8 | auto · pieno scuro · `py-2.5` · MAIUSCOLO |
| 6 | piena · bianco · bordo · `py-2.5` · MAIUSCOLO |
| 5 | auto · pieno scuro · `py-3` · normale |
| 5 | auto · bianco · bordo · `py-1.5` · MAIUSCOLO |
| 5 | piena · pieno scuro · `py-3` · MAIUSCOLO |

La coda è lunghissima: **una ventina di famiglie compaiono una volta sola.**

Il segnale più chiaro sono le altezze: `py-1`, `py-1.5`, `py-2`, `py-2.5`,
`py-3` e alcune senza `py` esplicito. **Sei altezze per un elemento che ne vuole
tre** (piccolo, normale, grande). E lo stesso ruolo visivo compare a volte in
maiuscolo e a volte no.

I ruoli veri, guardando cosa fanno, sembrano essere sei:
**primario pieno**, **secondario bordato**, **testuale**, **distruttivo**,
**riga richiudibile**, **chip di scelta**.

## Tipografia

Undici misure di testo. `font-rustic` compare 82 volte ed è l'identità.

| Misura | Volte |
| --- | --- |
| `text-[10px]` | 121 |
| `text-sm` | 81 |
| `text-[9px]` | 79 |
| `text-[11px]` | 63 |
| `text-lg` | 60 |
| `text-xs` | 42 |
| `text-base` | 14 |
| `text-xl` | 9 |
| `text-[8px]` | 8 |
| `text-2xl` | 5 |
| `text-3xl` | 2 |
| `text-[13px]` | 1 |

Le misure in pixel (`8/9/10/11/13`) sono 272 usi decisi a occhio, uno alla
volta. Fra `text-[9px]` e `text-[10px]` non c'è una regola: c'è la memoria di
cosa stava bene in quel punto.

## Cosa se ne ricava per settembre

Nell'ordine, perché ogni passo dipende dal precedente:

1. **Colori: quasi niente da fare.** Unire `#1A201A` in `#1F271E`, e riportare
   `#A9752F` sull'ambra vera `#D97706`. Due modifiche, non una revisione.
2. **Bottoni: qui sta il lavoro.** Ridurre 47 forme ai sei ruoli veri, con tre
   altezze. È anche il passo che rende leggibile il codice: oggi ogni bottone
   porta addosso la sua riga di classi.
3. **Testo: da undici misure a cinque o sei**, e la scala scritta da qualche
   parte invece che nella testa.
4. **Solo dopo, spezzare `src/7-app.jsx`.** Con un vocabolario deciso la divisione ha
   un bersaglio; senza, sposta soltanto le righe di posto.

## Vincoli che qualunque soluzione deve rispettare

- **Tailwind è vendorizzato e non c'è un build step** (`vercel.json`:
  `buildCommand: ""`). Non esiste un `tailwind.config.js` dove mettere i token:
  la strada realistica sono le variabili CSS in `index.html`.
- **Tutto deve funzionare offline.** Niente font esterni, niente CSS da CDN: il
  precache è atomico e l'app gira senza rete.
- **Ogni file nuovo che serve all'app va aggiunto al precache** in `sw.js` e
  all'elenco degli hash in `build.js`, altrimenti `unita/compilazione` diventa
  rossa — ed è giusto così.
- **`App.js` è generato**: si modificano i sorgenti in `src/` e si lancia
  `node build.js`.
