// I conti di un campo vero, senza aprire il browser.
//
// Questi numeri non sono inventati: sono il campo di Prato Lungo dell'agosto
// 2026 alla chiusura, con i nomi sostituiti e i numeri lasciati com'erano
// (test/fixture/campo-2026.json). 59 persone, 7 giorni, 35 spese, due casse.
//
// Perche' serve. Finora i conti si potevano guardare solo a schermo, dentro
// una prova end-to-end: si leggeva una cifra scritta da qualche parte e la si
// confrontava con quella attesa. Bastava che l'interfaccia cambiasse una riga
// perche' la prova diventasse cieca, o rossa senza motivo. Da quando
// calculateTotals sta in conti.js — funzione pura di sei cose — i conti si
// interrogano direttamente: questa prova dura centesimi di secondo invece di
// venti secondi di browser, e guarda le cifre esatte invece del testo.
//
// Le cose che difende sono quelle che, se sbagliate, si scoprono davanti a
// venti persone che devono darsi dei soldi.
const path = require('path');
const { ok, fine } = require('../lib/app');
require(path.resolve(__dirname, '..', '..', 'conti.js'));
const C = (typeof globalThis !== 'undefined' && globalThis.Conti) || null;

ok('conti.js si carica ed espone calcola()', !!(C && typeof C.calcola === 'function'));
if (!C) { fine(); }

const campo = require(path.resolve(__dirname, '..', 'fixture', 'campo-2026.json'));
const t = C.calcola({
  members: campo.members, campData: campo.campData, purchases: campo.purchases,
  equipment: campo.equipment, sepDays: campo.sepDays, freeDays: campo.freeDays,
  equipExemption: false,
});
const e = (n) => C.money(n);
const cent = (n) => Math.round(n * 100);
const adulti = t.breakdown.filter((b) => !b.isChild);

// ---------- Il campo, com'era ----------
ok(`sono 59 persone, 20 bambini (${campo.members.length}, ${campo.members.filter((m) => m.isChild).length})`,
  campo.members.length === 59 && campo.members.filter((m) => m.isChild).length === 20);
ok(`in tutto si sono spesi 2.303,59 € (${e(t.overallTotal)})`, e(t.overallTotal) === '2303.59');
ok(`3 giorni a conto separato e 1 gratis (${t.sepDaysCount}, ${t.freeDaysCount})`,
  t.sepDaysCount === 3 && t.freeDaysCount === 1);

// ---------- Non deve mancare un euro ----------
// La regola che conta piu' di tutte: quello che si raccoglie deve pareggiare
// quello che si e' speso, a meno dell'arrotondamento a 10 centesimi.
ok(`raccolti 2.303,60 € (${e(t.collected)})`, e(t.collected) === '2303.60');
ok(`fra speso e raccolto ballano ${cent(t.collected) - cent(t.overallTotal)} centesimi, non di piu'`,
  Math.abs(cent(t.collected) - cent(t.overallTotal)) <= 10);
ok(`nessun buco dichiarato (${t.buchi.length})`, t.buchi.length === 0);
ok(`niente finito in "non ripartito" (${e(t.nonRipartito)})`, cent(t.nonRipartito) === 0);

// ---------- Le due casse chiudono ognuna per conto suo ----------
// Sommarle prima di pareggiare farebbe sparire proprio la separazione: un
// creditore di qua e debitore di la' si annullerebbe da solo.
ok(`la cassa comune raccoglie 1.989,50 € (${e(t.collectedComune)})`, e(t.collectedComune) === '1989.50');
ok(`la cassa separata raccoglie 314,10 € (${e(t.collectedSep)})`, e(t.collectedSep) === '314.10');
ok('e insieme fanno esattamente il raccolto totale',
  cent(t.collectedComune) + cent(t.collectedSep) === cent(t.collected));
ok(`ognuna sbaglia al massimo un arrotondamento (comune ${cent(t.collectedComune) - cent(t.totaleComune)}, separata ${cent(t.collectedSep) - cent(t.foodDrinksSep)} cent)`,
  Math.abs(cent(t.collectedComune) - cent(t.totaleComune)) <= 10
  && Math.abs(cent(t.collectedSep) - cent(t.foodDrinksSep)) <= 10);

const quoteRotte = t.breakdown.filter((b) => b.payComuneCents + b.paySepCents !== b.payCents);
ok(`per tutti e 59, quota comune + quota separata = quota totale (${quoteRotte.length} rotte)`,
  quoteRotte.length === 0);

// ---------- I bambini non pagano ----------
const bambiniChePagano = t.breakdown.filter((b) => b.isChild && b.payCents !== 0);
ok(`nessuno dei 20 bambini paga (${bambiniChePagano.length} pagano)`, bambiniChePagano.length === 0);

// ---------- Le quote sono multipli di 10 centesimi ----------
// Nessuno vuole dover dare 12,37 €: l'arrotondamento a 0,10 € e' una scelta,
// e vale per tutte e due le casse separatamente.
const nonTonde = t.breakdown.filter((b) => b.payComuneCents % 10 !== 0 || b.paySepCents % 10 !== 0);
ok(`ogni quota e' un multiplo di 10 centesimi (${nonTonde.length} storte)`, nonTonde.length === 0);

// ---------- Logistica e attrezzatura: le pagano solo i giorni comuni ----------
// La decisione: chi c'e' stato SOLO nei giorni a conto separato non paga
// gazebo e bombola. E' il motivo per cui i paganti sono meno degli adulti.
ok(`gli adulti sono 39 ma le spese accessorie le dividono in 26 (${adulti.length}, ${t.accessoryPayersCount})`,
  adulti.length === 39 && t.accessoryPayersCount === 26);
// Logistica e attrezzatura hanno due divisori distinti (l'attrezzatura ha le
// esenzioni), ma senza esenzioni attive devono coincidere. Chiedere solo il
// primo lasciava passare un divisore dell'attrezzatura sbagliato.
ok(`e l'attrezzatura ha lo stesso divisore della logistica (${t.equipPayersCount})`,
  t.equipPayersCount === t.accessoryPayersCount);
const soloSeparati = adulti.filter((b) => b.mealsCommon === 0 && b.mealsSep > 0);
const soloSeparatiChePagano = soloSeparati.filter((b) => b.logShare > 0);
ok(`chi ha mangiato solo nei giorni separati non paga la logistica (${soloSeparati.length} persone, ${soloSeparatiChePagano.length} pagano)`,
  soloSeparati.length > 0 && soloSeparatiChePagano.length === 0);
ok(`e infatti la loro quota comune e' zero (${soloSeparati.filter((b) => b.payComuneCents !== 0).length} diverse da zero)`,
  soloSeparati.every((b) => b.payComuneCents === 0));

// ---------- Chi non c'era nei giorni separati non paga quella cassa ----------
const senzaSeparati = adulti.filter((b) => b.mealsSep === 0);
ok(`chi non c'era nei giorni separati non paga quella cassa (${senzaSeparati.length} persone)`,
  senzaSeparati.length > 0 && senzaSeparati.every((b) => b.paySepCents === 0));

// ---------- Chi paga chi ----------
ok(`per cassa vengono 35 passaggi (${t.transfers.length})`, t.transfers.length === 35);
ok(`ottimizzati diventano 30 (${t.transfersOttimizzati.length})`, t.transfersOttimizzati.length === 30);
const somma = (righe) => righe.reduce((s, x) => s + cent(x.amount), 0);

// Ottimizzando GIRANO MENO SOLDI, ed e' giusto cosi': chi e' creditore in una
// cassa e debitore nell'altra si compensa da solo invece di fare due bonifici
// incrociati. Cio' che non deve cambiare non e' il totale dei bonifici, e' la
// POSIZIONE di ognuno: quanto esce e quanto entra, a conti fatti.
const posizioni = (righe) => {
  const m = {};
  righe.forEach((x) => {
    m[x.from] = (m[x.from] || 0) - cent(x.amount);
    m[x.to] = (m[x.to] || 0) + cent(x.amount);
  });
  return m;
};
const perCassa = posizioni(t.transfers);
const ottimizzate = posizioni(t.transfersOttimizzati);
const nomi = [...new Set([...Object.keys(perCassa), ...Object.keys(ottimizzate)])];
const spostati = nomi.filter((n) => Math.abs((perCassa[n] || 0) - (ottimizzate[n] || 0)) > 10);
ok(`ottimizzando nessuno si muove di piu' di un arrotondamento (${spostati.length} su ${nomi.length})`,
  spostati.length === 0);

// E i soldi che girano da ottimizzati sono esattamente quelli che restano
// dopo la compensazione: meno bonifici, non meno debito.
const nettoPerCassa = Object.values(perCassa).filter((v) => v > 0).reduce((s, v) => s + v, 0);
ok(`si girano ${e(somma(t.transfersOttimizzati) / 100)} € invece di ${e(somma(t.transfers) / 100)}, cioe' esattamente il netto`,
  Math.abs(somma(t.transfersOttimizzati) - nettoPerCassa) <= 10);
ok(`nessun passaggio da zero o negativo (${t.transfers.filter((x) => x.amount <= 0).length})`,
  t.transfers.every((x) => x.amount > 0) && t.transfersOttimizzati.every((x) => x.amount > 0));
ok('nessuno paga sé stesso', t.transfers.every((x) => x.from !== x.to)
  && t.transfersOttimizzati.every((x) => x.from !== x.to));
// Ogni passaggio per cassa dice a quale cassa appartiene: senza, due rimborsi
// identici fra le stesse persone diventerebbero la stessa riga.
ok(`ogni passaggio sa da che cassa viene (${[...new Set(t.transfers.map((x) => x.cassa))].join(', ')})`,
  t.transfers.every((x) => x.cassa === 'comune' || x.cassa === 'separata'));

// ---------- Chi ha anticipato rientra, chi deve versa ----------
// Somma dei crediti = somma dei debiti: se non torna, qualcuno ci rimette.
const netti = [].concat(t.casse.comune.settlement, t.casse.separata.settlement);
const crediti = netti.filter((s) => s.net > 0).reduce((s, x) => s + cent(x.net), 0);
const debiti = netti.filter((s) => s.net < 0).reduce((s, x) => s - cent(x.net), 0);
ok(`crediti e debiti si equivalgono (${e(crediti / 100)} contro ${e(debiti / 100)})`,
  Math.abs(crediti - debiti) <= 10);
ok(`e i passaggi coprono i crediti (${e(somma(t.transfers) / 100)})`,
  Math.abs(somma(t.transfers) - crediti) <= 10);

// ---------- I pasti ----------
ok(`121 pasti da adulto, 88 comuni e 33 separati (${t.adultMealsTotal}, ${t.adultMealsCommon}, ${t.adultMealsSep})`,
  t.adultMealsTotal === 121 && t.adultMealsCommon === 88 && t.adultMealsSep === 33);
ok('e la somma dei pasti delle persone torna con il totale',
  adulti.reduce((s, b) => s + b.mealsCommon, 0) === t.adultMealsCommon
  && adulti.reduce((s, b) => s + b.mealsSep, 0) === t.adultMealsSep);

// ---------- Un campo vuoto non esplode ----------
// Chiudendo il campo le liste si azzerano: i conti devono restare zero,
// non NaN. Un NaN qui arriverebbe a schermo come "NaN €".
const vuoto = C.calcola({ members: [], campData: {}, purchases: [], equipment: [], sepDays: [], freeDays: [] });
ok(`a campo vuoto tutto e' zero, non NaN (${e(vuoto.overallTotal)}, ${e(vuoto.collected)})`,
  cent(vuoto.overallTotal) === 0 && cent(vuoto.collected) === 0
  && vuoto.breakdown.length === 0 && vuoto.transfers.length === 0);
ok('e non ci sono buchi da dichiarare', vuoto.buchi.length === 0 && cent(vuoto.nonRipartito) === 0);

// ---------- Spese senza acquirente: si dichiarano, non si nascondono ----------
const senzaNome = C.calcola({
  members: [{ id: 'a', name: 'Alice', isChild: false }],
  campData: { '2026-08-11': { meals: { a: { lunch: true, dinner: false } } } },
  purchases: [{ id: 'p1', name: 'Spesa', price: 50, type: 'alimentare', buyer: '', at: 1 }],
  equipment: [], sepDays: [], freeDays: [],
});
ok(`una spesa senza acquirente resta nei totali (${e(senzaNome.overallTotal)})`,
  cent(senzaNome.overallTotal) === 5000);
ok(`e viene segnalata come non attribuita (${e(senzaNome.unattributed)})`,
  cent(senzaNome.unattributed) === 5000);

fine();
