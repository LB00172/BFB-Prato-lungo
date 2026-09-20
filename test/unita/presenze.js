// Le regole delle presenze, senza aprire il browser.
//
// Da qui dipendono le quote: le quote non escono dai pasti, escono da pasti
// PER membri. Un errore qui non si vede a schermo — si vede quando venti
// persone si dividono dei soldi e i conti non tornano.
//
// Due fonti, e due mestieri diversi:
//   - il campo vero (test/fixture/campo-2026.json) prova che su dati sani
//     NON si inventa niente: zero presenze orfane, nessun falso allarme;
//   - i casi costruiti a mano provano i guasti, che nel campo 2026 per
//     fortuna non c'erano.
//
// Nota sulla fixture: il suo campData contiene solo i pasti. Note, menù e
// blocchi sono stati tolti quando e' stata costruita (erano testi scritti
// dalle persone), quindi i blocchi qui si costruiscono apposta.
const path = require('path');
const { ok, fine } = require('../lib/app');
require(path.resolve(__dirname, '..', '..', 'presenze.js'));
const P = (typeof globalThis !== 'undefined' && globalThis.Presenze) || null;

ok('presenze.js si carica ed espone le regole',
  !!(P && typeof P.orfane === 'function' && typeof P.applicaBlocchi === 'function'));
if (!P) { fine(); }

const campo = require(path.resolve(__dirname, '..', 'fixture', 'campo-2026.json'));

// ---------- Sul campo vero non si inventa niente ----------
{
  const orf = P.orfane(campo.campData, campo.members, {});
  ok(`sul campo vero non risultano presenze orfane (${orf.length})`, orf.length === 0);
}
{
  // Ogni pasto letto dalle regole coincide con quello che c'e' nei dati: se
  // "pasto" sbagliasse anche per una persona sola, le quote di quel giorno
  // sarebbero di un altro.
  let letti = 0;
  let diversi = 0;
  Object.keys(campo.campData).forEach((g) => {
    const meals = campo.campData[g].meals || {};
    campo.members.forEach((m) => {
      const atteso = meals[m.id] || { lunch: false, dinner: false };
      const avuto = P.pasto(campo.campData, g, m.id);
      letti++;
      if (!!atteso.lunch !== !!avuto.lunch || !!atteso.dinner !== !!avuto.dinner) diversi++;
    });
  });
  ok(`i ${letti} pasti letti coincidono con i dati (${diversi} diversi)`, letti > 0 && diversi === 0);
}
{
  const g = P.giorno(campo.campData, Object.keys(campo.campData)[0]);
  ok(`un giorno vero ha sempre tutti i campi (${Object.keys(g).sort().join(', ')})`,
    'note' in g && 'appunti' in g && 'guestsNames' in g && 'meals' in g);
  const mai = P.giorno(campo.campData, '1999-01-01');
  ok('e un giorno che non esiste torna vuoto, non indefinito',
    mai && Object.keys(mai.meals).length === 0 && mai.note === '');
}

// ---------- Presenze orfane: i guasti, costruiti apposta ----------
const MEMBRI = [{ id: 'a', name: 'Alice', isChild: false }, { id: 'b', name: 'Bruno', isChild: false }];
const CD = {
  '2026-08-11': { meals: { a: { lunch: true, dinner: true }, vecchio: { lunch: true, dinner: false } } },
  '2026-08-12': { meals: { b: { lunch: true, dinner: false }, vecchio: { lunch: false, dinner: true } } },
};
{
  const orf = P.orfane(CD, MEMBRI, {});
  ok(`un id che non e' piu' fra i membri viene trovato (${orf.length})`, orf.length === 1 && orf[0].id === 'vecchio');
  ok(`coi suoi pasti contati su tutti i giorni (${orf[0] && orf[0].pasti})`, orf[0].pasti === 2);
  ok(`e coi giorni in cui compare (${orf[0] && orf[0].giorni.join(', ')})`,
    orf[0].giorni.join(',') === '2026-08-11,2026-08-12');
}
{
  // Il registro degli eliminati serve a dire un NOME invece di una sigla:
  // "vecchio" non dice niente a nessuno, "Carlo" si' .
  const orf = P.orfane(CD, MEMBRI, { vecchio: 'Carlo' });
  ok(`col registro degli eliminati si sa di chi era (${orf[0] && orf[0].nome})`, orf[0].nome === 'Carlo');
  const senza = P.orfane(CD, MEMBRI, {});
  ok('e senza registro non si inventa un nome', senza[0].nome === '');
}
{
  // Una voce a zero NON e' una presenza: resta nei dati quando si toglie la
  // spunta, e segnalarla vorrebbe dire dare l'allarme per niente.
  const cd = { '2026-08-11': { meals: { a: { lunch: true, dinner: false }, zero: { lunch: false, dinner: false } } } };
  ok(`una voce a zero non e' una presenza orfana (${P.orfane(cd, MEMBRI, {}).length})`,
    P.orfane(cd, MEMBRI, {}).length === 0);
}
{
  // In ordine di gravita': chi ha piu' pasti scoperti viene prima.
  const cd = {
    '2026-08-11': { meals: { x: { lunch: true, dinner: true }, y: { lunch: true, dinner: false } } },
    '2026-08-12': { meals: { x: { lunch: true, dinner: true } } },
  };
  const orf = P.orfane(cd, MEMBRI, {});
  ok(`si elencano dal piu' grave (${orf.map((o) => o.id + ':' + o.pasti).join(' ')})`,
    orf.length === 2 && orf[0].id === 'x' && orf[0].pasti === 4 && orf[1].pasti === 1);
}
{
  ok('senza presenze e senza membri non si esplode',
    P.orfane(null, null, null).length === 0 && P.orfane({}, [], {}).length === 0);
}

// ---------- Il blocco ----------
const bloccato = (meals, copia) => ({ meals: meals, bloccato: { at: 1, meals: copia } });
{
  // Se i pasti coincidono con la copia congelata non c'e' niente da fare, e
  // si deve tornare LO STESSO oggetto: uno nuovo farebbe ripartire gli
  // effetti che lo guardano, all'infinito.
  const cd = { '2026-08-11': bloccato({ a: { lunch: true, dinner: false } }, { a: { lunch: true, dinner: false } }) };
  ok('se non c\'e' + "' niente da correggere si torna lo stesso oggetto", P.applicaBlocchi(cd) === cd);
}
{
  // Qualcuno ha cambiato i pasti di un giorno chiuso (col dito o da una
  // sincronizzazione): la copia congelata e' l'unica verita' e vince.
  const cd = { '2026-08-11': bloccato({ a: { lunch: false, dinner: false } }, { a: { lunch: true, dinner: true } }) };
  const dopo = P.applicaBlocchi(cd);
  ok('un giorno bloccato che viene cambiato torna com\'era',
    dopo !== cd && dopo['2026-08-11'].meals.a.lunch === true && dopo['2026-08-11'].meals.a.dinner === true);
  ok('e la copia congelata resta quella', dopo['2026-08-11'].bloccato.meals.a.lunch === true);
}
{
  // I giorni NON bloccati non si toccano, nemmeno per sbaglio.
  const cd = {
    '2026-08-11': { meals: { a: { lunch: true, dinner: false } } },
    '2026-08-12': bloccato({ a: { lunch: false, dinner: false } }, { a: { lunch: true, dinner: false } }),
  };
  const dopo = P.applicaBlocchi(cd);
  ok('i giorni liberi restano come sono', dopo['2026-08-11'] === cd['2026-08-11']);
  ok('e solo quello bloccato viene corretto', dopo['2026-08-12'] !== cd['2026-08-12']);
}
{
  // "bloccato" scritto male (non un oggetto, o senza pasti) non deve far
  // sparire niente: si ignora e si tira dritto.
  const cd = {
    '2026-08-11': { meals: { a: { lunch: true, dinner: false } }, bloccato: true },
    '2026-08-12': { meals: { a: { lunch: true, dinner: false } }, bloccato: { at: 1 } },
  };
  ok('un blocco scritto male si ignora invece di cancellare i pasti',
    P.applicaBlocchi(cd) === cd);
  ok('e non risulta un blocco', P.blocco(cd, '2026-08-11') === null);
  ok('mentre uno vero si riconosce',
    !!P.blocco({ '2026-08-11': bloccato({}, {}) }, '2026-08-11'));
}
{
  // Le riparazioni d'identita' devono valere anche sui giorni chiusi: se si
  // riattacca una presenza orfana e la copia congelata non segue, quella
  // presenza sparisce dai conti al primo giro.
  const day = { meals: { vecchio: { lunch: true, dinner: false } }, bloccato: { at: 1, meals: { vecchio: { lunch: true, dinner: false } } } };
  const nuovi = { a: { lunch: true, dinner: false } };
  const dopo = P.conBlocco(day, nuovi);
  // Letture difensive: se la copia congelata non viene aggiornata, qui dentro
  // ci sono "undefined". Leggerli a catena farebbe morire la prova con uno
  // stack invece di dire QUALE regola si e' rotta.
  const copia = (dopo.bloccato && dopo.bloccato.meals) || {};
  ok(`riattaccando una presenza su un giorno chiuso si aggiorna anche la copia (${JSON.stringify(copia)})`,
    !!(dopo.meals.a && dopo.meals.a.lunch) && !!(copia.a && copia.a.lunch) && !copia.vecchio);
  const libero = P.conBlocco({ meals: {} }, nuovi);
  ok('e su un giorno libero non si inventa un blocco', !libero.bloccato && libero.meals.a.lunch === true);
}
{
  // Quali giorni chiusi trattengono una persona: serve a dire NO quando la si
  // vuole eliminare, e a spiegare perche'.
  const cd = {
    '2026-08-13': bloccato({ a: { lunch: true, dinner: false } }, { a: { lunch: true, dinner: false } }),
    '2026-08-11': bloccato({ a: { lunch: true, dinner: false } }, { a: { lunch: true, dinner: false } }),
    '2026-08-12': bloccato({ b: { lunch: true, dinner: false } }, { b: { lunch: true, dinner: false } }),
    '2026-08-14': { meals: { a: { lunch: true, dinner: false } } },
  };
  ok(`i giorni chiusi che trattengono Alice, in ordine (${P.giorniBloccatiDi(cd, 'a').join(', ')})`,
    P.giorniBloccatiDi(cd, 'a').join(',') === '2026-08-11,2026-08-13');
  ok('chi non compare in nessun giorno chiuso non e' + "' trattenuto",
    P.giorniBloccatiDi(cd, 'zzz').length === 0);
  // Una voce a zero in un giorno chiuso non trattiene nessuno: quella persona
  // quel giorno non c'era.
  const cd2 = { '2026-08-11': bloccato({ a: { lunch: false, dinner: false } }, { a: { lunch: false, dinner: false } }) };
  ok('e una presenza a zero in un giorno chiuso non trattiene', P.giorniBloccatiDi(cd2, 'a').length === 0);
}

fine();
