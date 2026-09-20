// Quando la sincronizzazione va detta, e quando no.
//
// Sono le due decisioni piu' delicate dell'app. Non decidono cosa succede ai
// dati — quello lo fa sync-merge.js — decidono se **svegliare qualcuno**. E un
// allarme che suona quando non serve e' peggio di nessun allarme: dopo due
// volte non lo guarda piu' nessuno, e la terza e' quella vera.
//
// Il caso da cui e' nata la regola, ed e' vero: togliere un membro cancella
// anche le sue presenze di tutti i giorni. Un gesto solo, sette "voci perse".
// Un telefono rimasto indietro lo scopriva tre giorni dopo e gridava al
// disastro per una cosa che nessuno stava perdendo.
const path = require('path');
const { ok, fine } = require('../lib/app');
require(path.resolve(__dirname, '..', '..', 'allarmi.js'));
const A = (typeof globalThis !== 'undefined' && globalThis.Allarmi) || null;

ok('allarmi.js si carica ed espone le due regole',
  !!(A && typeof A.orologioAvanti === 'function' && typeof A.perditeDaAnnunciare === 'function'));
if (!A) { fine(); }

const MIN = 60 * 1000;
const ORA = 60 * MIN;
const GIORNO = 24 * ORA;
const ADESSO = 1_700_000_000_000;
const SOGLIA = 2 * GIORNO;       // OROLOGIO_SOGLIA
const RAFFICA = 2 * MIN;
const RECENTE = 6 * ORA;         // PERDITA_RECENTE

// ---------- Orologi ----------
{
  ok('senza cronologia non si dice niente',
    A.orologioAvanti(null, ADESSO, SOGLIA) === null
    && A.orologioAvanti({}, ADESSO, SOGLIA) === null
    && A.orologioAvanti({ rev: null, del: null }, ADESSO, SOGLIA) === null);
}
{
  const m = { rev: { 'p|1': ADESSO - ORA, 'p|2': ADESSO - 3 * GIORNO } };
  ok('un telefono con l\'ora giusta non fa scattare niente', A.orologioAvanti(m, ADESSO, SOGLIA) === null);
}
{
  // Il caso vero: qualcuno ha l'ora avanti e sta vincendo ogni confronto.
  const m = { rev: { 'p|1': ADESSO + 3 * GIORNO } };
  const v = A.orologioAvanti(m, ADESSO, SOGLIA);
  ok(`tre giorni avanti si segnalano (${v && Math.round(v.avanti / GIORNO)} giorni)`,
    !!v && v.avanti === 3 * GIORNO && v.at === ADESSO);
}
{
  // Un'ora avanti non e' un orologio sballato: e' un fuso, o un telefono che
  // si e' risincronizzato. Segnalarlo sarebbe il falso allarme numero uno.
  const m = { rev: { 'p|1': ADESSO + ORA } };
  ok('un\'ora avanti non basta', A.orologioAvanti(m, ADESSO, SOGLIA) === null);
  // Esattamente sulla soglia: non si scatta. La soglia e' un "oltre", non un
  // "almeno", altrimenti basta un millisecondo di deriva.
  ok('esattamente sulla soglia non si scatta',
    A.orologioAvanti({ rev: { x: ADESSO + SOGLIA } }, ADESSO, SOGLIA) === null);
  ok('un millisecondo oltre invece si',
    A.orologioAvanti({ rev: { x: ADESSO + SOGLIA + 1 } }, ADESSO, SOGLIA) !== null);
}
{
  // La data piu' alta puo' stare nelle lapidi invece che nelle modifiche.
  const m = { rev: { 'p|1': ADESSO - ORA }, del: { 'p|2': ADESSO + 5 * GIORNO } };
  ok('si guarda anche fra le cancellazioni', A.orologioAvanti(m, ADESSO, SOGLIA) !== null);
}
{
  // Valori non numerici in mezzo non devono far vincere niente.
  const m = { rev: { a: 'domani', b: null, c: ADESSO + 3 * GIORNO } };
  const v = A.orologioAvanti(m, ADESSO, SOGLIA);
  ok('i valori scritti male si ignorano invece di rompere il conto',
    !!v && v.avanti === 3 * GIORNO);
}
{
  // Il caso cattivo davvero: una data arrivata come STRINGA di cifre. In
  // JavaScript "9999999999999" > 0 e' vero, quindi senza il controllo del tipo
  // si prenderebbe per buona e l'app direbbe a tutti che hanno l'ora sbagliata
  // di trecento anni. Una data che non e' un numero non e' una data.
  const m = { rev: { a: String(ADESSO + 300 * 365 * GIORNO), b: ADESSO - ORA } };
  ok('una data scritta come stringa non conta',
    A.orologioAvanti(m, ADESSO, SOGLIA) === null);
}
{
  // E se le date buone ci sono, la stringa non deve nemmeno spostarle.
  const m = { rev: { a: String(ADESSO + 300 * 365 * GIORNO), b: ADESSO + 3 * GIORNO } };
  const v = A.orologioAvanti(m, ADESSO, SOGLIA);
  ok(`resta quella vera (${v && Math.round(v.avanti / GIORNO)} giorni, non trecento anni)`,
    !!v && v.avanti === 3 * GIORNO);
}

// ---------- Perdite ----------
const opz = { raffica: RAFFICA, recente: RECENTE, minimo: 3 };
{
  const v = A.perditeDaAnnunciare([], [], ADESSO, opz);
  ok('senza perdite non si annuncia niente', v.annuncia === false && v.fresche.length === 0);
}
{
  // IL CASO CHE HA FATTO NASCERE LA REGOLA.
  // Sette voci perse, ma sono un gesto solo (stesso istante) di tre giorni fa:
  // il telefono sta solo recuperando il ritardo. Non manca niente a nessuno.
  const t = ADESSO - 3 * GIORNO;
  const perse = ['m|1', 'c|11|meals|1', 'c|12|meals|1', 'c|13|meals|1', 'c|14|meals|1', 'c|15|meals|1', 'c|16|meals|1'];
  const v = A.perditeDaAnnunciare(perse, perse.map(() => t), ADESSO, opz);
  ok(`sette voci di tre giorni fa non sono un allarme (fresche ${v.fresche.length}, eta ${Math.round(v.eta / GIORNO)}g)`,
    v.fresche.length === 7 && v.annuncia === false);
}
{
  // Lo STESSO gesto, ma adesso: qualcuno sta cancellando, e va fermato.
  const t = ADESSO - 30 * 1000;
  const perse = ['m|1', 'c|11|meals|1', 'c|12|meals|1', 'c|13|meals|1'];
  const v = A.perditeDaAnnunciare(perse, perse.map(() => t), ADESSO, opz);
  ok(`le stesse quattro voci di trenta secondi fa sono un allarme (${v.fresche.length})`,
    v.annuncia === true && v.fresche.length === 4);
}
{
  // Due voci sole: e' quasi sempre qualcuno che ha corretto una spesa.
  const t = ADESSO - 10 * 1000;
  const v = A.perditeDaAnnunciare(['p|1', 'p|2'], [t, t], ADESSO, opz);
  ok(`due voci sole non disturbano nessuno (${v.fresche.length})`, v.annuncia === false);
  const tre = A.perditeDaAnnunciare(['p|1', 'p|2', 'p|3'], [t, t, t], ADESSO, opz);
  ok('tre invece si', tre.annuncia === true);
}
{
  // Cancellazioni sparse nel tempo: si contano SOLO quelle della raffica piu'
  // recente. Sommarle tutte farebbe scattare l'allarme per la storia di una
  // settimana messa in fila.
  const perse = ['a', 'b', 'c', 'd', 'e'];
  const quando = [ADESSO - 5 * GIORNO, ADESSO - 4 * GIORNO, ADESSO - 3 * GIORNO, ADESSO - 20 * 1000, ADESSO - 25 * 1000];
  const v = A.perditeDaAnnunciare(perse, quando, ADESSO, opz);
  ok(`di cinque sparse restano le due della raffica (${v.fresche.join(', ')})`,
    v.fresche.length === 2 && v.fresche.join(',') === 'd,e');
  ok('e due non bastano per l\'allarme', v.annuncia === false);
}
{
  // Tre nella stessa raffica, in mezzo a roba vecchia: l'allarme scatta.
  const perse = ['vecchia', 'a', 'b', 'c'];
  const quando = [ADESSO - 6 * GIORNO, ADESSO - 10 * 1000, ADESSO - 40 * 1000, ADESSO - 60 * 1000];
  const v = A.perditeDaAnnunciare(perse, quando, ADESSO, opz);
  ok(`tre nella stessa raffica fanno scattare l'allarme (${v.fresche.join(', ')})`,
    v.annuncia === true && v.fresche.length === 3 && !v.fresche.includes('vecchia'));
}
{
  // Il confine delle sei ore: appena dentro si', appena fuori no.
  const dentro = ADESSO - RECENTE + 1000;
  const fuori = ADESSO - RECENTE - 1000;
  const p = ['a', 'b', 'c'];
  ok('cinque ore e mezza fa si annuncia',
    A.perditeDaAnnunciare(p, p.map(() => dentro), ADESSO, opz).annuncia === true);
  ok('sei ore e un minuto fa no',
    A.perditeDaAnnunciare(p, p.map(() => fuori), ADESSO, opz).annuncia === false);
}
{
  // Il confine della raffica: due minuti tengono insieme lo stesso gesto,
  // due minuti e uno no.
  const p = ['a', 'b', 'c'];
  const q = [ADESSO, ADESSO - RAFFICA, ADESSO - RAFFICA - 1];
  const v = A.perditeDaAnnunciare(p, q, ADESSO, opz);
  ok(`nella raffica ci stanno le prime due (${v.fresche.join(', ')})`,
    v.fresche.length === 2 && v.fresche.join(',') === 'a,b');
}
{
  // Date mancanti: senza data la voce risulta vecchissima e resta fuori dalla
  // raffica. Meglio non annunciare che annunciare a caso.
  const v = A.perditeDaAnnunciare(['a', 'b', 'c'], [ADESSO, undefined, null], ADESSO, opz);
  ok(`le voci senza data non entrano nella raffica (${v.fresche.length})`, v.fresche.length === 1);
}
{
  // Le soglie hanno un valore di scorta: chi chiama senza opzioni non deve
  // ritrovarsi con "annuncia sempre".
  const t = ADESSO - 10 * 1000;
  const v = A.perditeDaAnnunciare(['a', 'b', 'c'], [t, t, t], ADESSO);
  ok('senza opzioni valgono le soglie di scorta', v.annuncia === true);
  const vecchie = ADESSO - 3 * GIORNO;
  ok('e restano quelle giuste anche per le perdite vecchie',
    A.perditeDaAnnunciare(['a', 'b', 'c'], [vecchie, vecchie, vecchie], ADESSO).annuncia === false);
}

fine();
