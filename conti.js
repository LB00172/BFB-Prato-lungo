// I conti del campo: chi ha mangiato, chi ha pagato, chi deve a chi.
//
// Sta fuori da src/ per lo stesso motivo di menu-spesa.js e magazzino-foto.js:
// e' l'unica parte dell'app che maneggia i soldi di venti persone, e va provata
// con una prova unitaria — sui numeri veri di un campo vero — invece che
// leggendo cifre a schermo dentro un browser.
//
// E' una funzione PURA di sei cose: membri, presenze, acquisti, attrezzatura,
// giorni a conto separato, giorni gratis. Non legge localStorage, non tocca
// React, non sa che esiste una schermata. E' l'unica differenza rispetto a
// prima: i sei valori si passano invece di pescarli dallo stato di App().
//
// Le decisioni difficili del progetto stanno qui dentro, commentate una per
// una. Le tre da non rimettere in discussione (CLAUDE.md):
//   - logistica e attrezzatura le pagano solo i giorni a conto comune;
//   - le due casse chiudono ognuna per conto suo, col suo arrotondamento;
//   - i soldi senza divisore finiscono in "nonRipartito" e si dichiarano.
(function (root) {
  'use strict';

  // Le due funzioni di formato stavano in src/30-tema-e-formati.jsx. Sono qui
  // perche' i conti le usano e i conti stanno fuori: definirle due volte
  // vorrebbe dire che un giorno divergono, ed e' l'ultimo posto in cui puo'
  // succedere senza che nessuno se ne accorga. L'app le riprende da qui.
  const money = (n) => (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
  // Numero >= 0 a partire da una stringa di input.
  const posNum = (v) => Math.max(0, parseFloat(v) || 0);

  // "equipExemption" e' l'unica configurazione che entra nei conti: dice se
  // esiste l'esenzione dall'attrezzatura. Si passa invece di leggerla da una
  // variabile globale — una funzione pura non prende decisioni sui soldi
  // guardando qualcosa che il chiamante non vede.
  const calcola = ({ members, campData, purchases, equipment, sepDays, freeDays, equipExemption }) => {
    // I totali di spesa sono generati dal taccuino (per tipologia).
    const sumByType = (t) => purchases.reduce((s, p) => (p.type === t ? s + posNum(p.price) : s), 0);
    const totalFood = sumByType('alimentare');
    const totalDrinks = sumByType('bevande');
    // Logistica dagli acquisti (divisa fra tutti i presenti) e attrezzatura
    // acquistata (divisa solo fra chi NON è esente): due quote separate.
    const logisticsPurchases = sumByType('logistica');
    const equipBought = equipment.reduce((s, e) => (e.bought ? s + posNum(e.price) : s), 0);
    const totalAccessory = logisticsPurchases + equipBought;
    const totalFoodDrinks = totalFood + totalDrinks;
    const overallTotal = totalFoodDrinks + totalAccessory;

    // --- Conto separato ---
    // I giorni spuntati fanno cassa a parte: il cibo/bevande marcato
    // "separato" si divide SOLO sui pasti di quei giorni, e quei pasti escono
    // dal divisore comune (altrimenti chi c'era pagherebbe due volte).
    const sepSet = new Set(sepDays);
    // --- Giorni gratis ---
    // Un giorno gratis è INVISIBILE alla contabilità: i suoi pasti non entrano
    // in nessun divisore e non rendono nessuno "presente". Chi c'è stato solo
    // quel giorno paga zero — che è il senso di "gratis per tutti". Le presenze
    // restano scritte, perché servono alla cucina e al riepilogo del giorno.
    const freeSet = new Set(freeDays);
    const isSepPurchase = (p) => p.account === 'sep' && p.type !== 'logistica';
    const foodDrinksSep = purchases.reduce(
      (s, p) => (isSepPurchase(p) ? s + posNum(p.price) : s), 0);
    const foodDrinksCommon = totalFoodDrinks - foodDrinksSep;

    // Pasti per membro, distinti fra giorni comuni e giorni del conto separato.
    // "gratis" tiene il conto dei pasti dei giorni esclusi: non si pagano, ma
    // vanno mostrati, altrimenti uno vede "2 pasti" sulla scheda e "6" nel
    // calendario e pensa a un errore.
    const mealsByMember = {};
    members.forEach((m) => (mealsByMember[m.id] = { common: 0, sep: 0, total: 0, gratis: 0 }));
    let mealsFree = 0;

    let adultMealsTotal = 0;
    let adultMealsSep = 0;
    const attendingAdults = new Set();
    // Logistica e attrezzatura si dividono SOLO fra chi c'e' nei giorni comuni.
    // Il conto separato e' una cassa a parte: chi e' venuto unicamente in quei
    // giorni paga la sua spesa separata e basta, e la sua parte di logistica e
    // attrezzatura si spalma su chi resta nel conto comune.
    const attendingCommon = new Set();   // adulti con almeno un pasto nei giorni comuni
    const attendingForEquip = new Set(); // come sopra, meno gli esenti da attrezzatura
    const sepPeople = new Set();         // adulti che mangiano nei giorni separati

    Object.keys(campData).forEach((dateStr) => {
      const day = campData[dateStr];
      const meals = (day && day.meals) || {};
      const inSep = sepSet.has(dateStr);
      const gratis = freeSet.has(dateStr);
      members.forEach((m) => {
        const mm = meals[m.id];
        if (!mm) return;
        const count = (mm.lunch ? 1 : 0) + (mm.dinner ? 1 : 0);
        if (count === 0) return;
        const rec = mealsByMember[m.id];
        if (!rec) return;
        rec.total += count;
        // Giorno gratis: si conta e ci si ferma. Niente divisori, niente
        // presenza: quel giorno non esiste per i conti.
        if (gratis) { rec.gratis += count; if (!m.isChild) mealsFree += count; return; }
        if (inSep) rec.sep += count; else rec.common += count;
        if (!m.isChild) {
          adultMealsTotal += count;
          if (inSep) { adultMealsSep += count; sepPeople.add(m.id); }
          else {
            attendingCommon.add(m.id);
            // L'esenzione vale solo se la funzione e' attiva (FEATURES.equipExemption).
            if (!(equipExemption && m.equipExempt)) attendingForEquip.add(m.id);
          }
          attendingAdults.add(m.id);
        }
      });
    });

    const adultMealsCommon = adultMealsTotal - adultMealsSep;

    // Cibo+bevande ripartiti sui pasti degli adulti (bambini = gratis),
    // ognuno sulla sua cassa.
    const costPerMeal = adultMealsCommon > 0 ? foodDrinksCommon / adultMealsCommon : 0;
    const costPerMealSep = adultMealsSep > 0 ? foodDrinksSep / adultMealsSep : 0;
    // Logistica: parti uguali fra gli adulti dei giorni COMUNI.
    const logisticsPerAdult = attendingCommon.size > 0 ? logisticsPurchases / attendingCommon.size : 0;
    // Attrezzatura: parti uguali fra quelli non esenti. Se sono tutti esenti,
    // per non perdere la spesa si ripartisce su tutti i comuni.
    const equipDivisorSet = attendingForEquip.size > 0 ? attendingForEquip : attendingCommon;
    const equipPerAdult = equipDivisorSet.size > 0 ? equipBought / equipDivisorSet.size : 0;
    // Quota "accessori" media mostrata nel riepilogo.
    const accessoryPerAdult = logisticsPerAdult + equipPerAdult;

    // Quota dovuta da ciascun membro (valore esatto).
    const breakdown = members.map((m) => {
      const rec = mealsByMember[m.id] || { common: 0, sep: 0, total: 0, gratis: 0 };
      const mealCount = rec.total;
      const foodShare = m.isChild ? 0 : rec.common * costPerMeal + rec.sep * costPerMealSep;
      // "Presente" ai fini dei conti è chi ha almeno un pasto che si paga: si
      // usa lo STESSO insieme con cui si è calcolata la quota, altrimenti la
      // somma delle quote non torna col totale. In particolare chi è venuto
      // solo in un giorno gratis non deve la quota di logistica: quel giorno
      // per lui non è costato niente, ed è il senso di "gratis per tutti".
      const present = attendingCommon.has(m.id);
      const logShare =
        (present ? logisticsPerAdult : 0) +
        (present && equipDivisorSet.has(m.id) ? equipPerAdult : 0);
      // La quota si tiene divisa fra le due casse fin da qui: la cassa
      // separata è il cibo dei giorni spuntati e basta, tutto il resto —
      // cibo comune, logistica, attrezzatura — sta nella cassa comune.
      const owedSep = m.isChild ? 0 : rec.sep * costPerMealSep;
      const owedComune = m.isChild ? 0 : rec.common * costPerMeal + logShare;
      return {
        ...m, mealCount, mealsCommon: rec.common, mealsSep: rec.sep, mealsGratis: rec.gratis,
        foodShare, logShare, owedComune, owedSep, owed: owedComune + owedSep,
      };
    });

    // --- Arrotondamento "cassa-friendly" ---
    // Ogni quota viene arrotondata a multipli di 0,10 € (niente monetine da
    // 1/2/5 cent). Lo scarto rispetto al totale reale viene riconciliato SOLO
    // se è >= 0,50 €: sotto quella soglia si lascia com'è (non vale la pena).
    // Si arrotonda una cassa alla volta: se si arrotondasse una volta sola sul
    // totale, i saldi di ciascuna cassa non tornerebbero a zero da soli e
    // "cassa separata" resterebbe solo un'etichetta.
    const round10 = (cents) => Math.round(cents / 10) * 10;
    const arrotondaCassa = (dovuto, cents, targetCents) => {
      breakdown.forEach((b) => {
        b[cents] = b.isChild ? 0 : round10(Math.round(b[dovuto] * 100));
      });
      let residuo = targetCents - breakdown.reduce((s, b) => s + b[cents], 0);
      if (Math.abs(residuo) >= 50) {
        // Redistribuisce lo scarto a passi di 10 cent, partendo da chi deve di più.
        const ordine = breakdown
          .filter((b) => !b.isChild && b[dovuto] > 0)
          .sort((a, b) => b[dovuto] - a[dovuto]);
        const passo = residuo > 0 ? 10 : -10;
        let guardia = 0;
        let idx = 0;
        while (Math.abs(residuo) >= 10 && ordine.length > 0 && guardia < 100000) {
          const t = ordine[idx % ordine.length];
          if (!(passo < 0 && t[cents] + passo < 0)) {
            t[cents] += passo;
            residuo -= passo;
          }
          idx++;
          guardia++;
        }
      }
    };

    // --- Soldi senza divisore: un BUCO, non un arrotondamento ---
    // Se una cassa ha dei soldi dentro ma nessun pasto (o nessun presente) su
    // cui dividerli, la sua quota a pasto viene zero e quei soldi non entrano
    // in nessuna quota. Finivano dentro lo scarto, e la riconciliazione — nata
    // per limare qualche centesimo — se li spalmava addosso a chi capitava, 10
    // cent alla volta: cento euro di "conto separato" senza giorni separati
    // spuntati diventavano cinquanta euro a testa per due persone che non
    // c'entravano niente, sotto l'etichetta "arrotondamento".
    // Ora si tengono fuori dal conto e si dicono.
    // Ogni buco sa a quale cassa appartiene: serve a riconciliare le due casse
    // separatamente e a mostrare l'avviso dove il buco è, non su entrambe.
    // "perche" e' una CHIAVE del dizionario, non una frase: questo file e'
    // puro e non sa in che lingua verra' letto. La frase la sceglie il disegno.
    const buchi = [];
    if (foodDrinksCommon > 0.005 && adultMealsCommon === 0) {
      buchi.push({ cassa: 'comune', quanto: foodDrinksCommon, perche: 'buchi.ciboComune' });
    }
    if (foodDrinksSep > 0.005 && adultMealsSep === 0) {
      buchi.push({
        cassa: 'separata',
        quanto: foodDrinksSep,
        perche: sepDays.length === 0
          ? 'buchi.separatoSenzaGiorni'
          : sepDays.every((d) => freeSet.has(d))
          ? 'buchi.separatoTuttiGratis'
          : 'buchi.separatoSenzaPresenze',
      });
    }
    if (logisticsPurchases > 0.005 && attendingCommon.size === 0) {
      buchi.push({ cassa: 'comune', quanto: logisticsPurchases, perche: 'buchi.logistica' });
    }
    if (equipBought > 0.005 && equipDivisorSet.size === 0) {
      buchi.push({ cassa: 'comune', quanto: equipBought, perche: 'buchi.attrezzatura' });
    }
    const somma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
    const nonRipartito = somma(buchi, (b) => b.quanto);
    const nonRipartitoComune = somma(buchi.filter((b) => b.cassa === 'comune'), (b) => b.quanto);
    const nonRipartitoSep = somma(buchi.filter((b) => b.cassa === 'separata'), (b) => b.quanto);

    // Si riconcilia solo ciò che è davvero ripartibile: così lo scarto torna a
    // essere quello che deve essere — pochi centesimi di arrotondamento.
    const totaleComune = foodDrinksCommon + totalAccessory;
    arrotondaCassa('owedComune', 'payComuneCents', Math.round((totaleComune - nonRipartitoComune) * 100));
    arrotondaCassa('owedSep', 'paySepCents', Math.round((foodDrinksSep - nonRipartitoSep) * 100));

    breakdown.forEach((b) => {
      b.payCents = b.payComuneCents + b.paySepCents;
      b.payComune = b.payComuneCents / 100;
      b.paySep = b.paySepCents / 100;
      b.pay = b.payCents / 100;
    });
    const collectedComune = somma(breakdown, (b) => b.payComuneCents) / 100;
    const collectedSep = somma(breakdown, (b) => b.paySepCents) / 100;
    const collected = collectedComune + collectedSep;
    // Lo scarto ora è solo arrotondamento: il buco viaggia da solo, con il suo
    // nome, invece di nascondersi qui dentro.
    const roundingDiffComune = collectedComune - (totaleComune - nonRipartitoComune);
    const roundingDiffSep = collectedSep - (foodDrinksSep - nonRipartitoSep);
    const roundingDiff = collected - (overallTotal - nonRipartito);

    // --- Saldi di UNA cassa: chi ha anticipato, chi deve, chi paga chi ---
    // Scritto una volta e chiamato due volte. Ogni cassa deve chiudersi da
    // sola: chi ha anticipato sul conto separato viene rimborsato da chi in
    // quei giorni ha mangiato, non da chi è arrivato dopo.
    const norm = (s) => (s || '').trim().toLowerCase();

    // Passaggi di pareggio: chi paga chi, col minor numero di giri. Si scorre
    // l'elenco gia' ordinato per saldo e si accoppia a centesimi finche' uno
    // dei due lati si esaurisce. E' lo stesso conto che fa Splitwise quando
    // "semplifica i debiti": nessuno paga un centesimo in piu' o in meno, si
    // riduce solo il numero di bonifici.
    const pareggia = (elenco, nomeCassa) => {
      const creditori = elenco.filter((s) => s.net > 0.005).map((s) => ({ name: s.name, cents: Math.round(s.net * 100) }));
      const debitori = elenco.filter((s) => s.net < -0.005).map((s) => ({ name: s.name, cents: Math.round(-s.net * 100) }));
      const passaggi = [];
      let ci = 0, di = 0;
      while (ci < creditori.length && di < debitori.length) {
        const amt = Math.min(creditori[ci].cents, debitori[di].cents);
        if (amt > 0) passaggi.push({ from: debitori[di].name, to: creditori[ci].name, amount: amt / 100, cassa: nomeCassa });
        creditori[ci].cents -= amt;
        debitori[di].cents -= amt;
        if (creditori[ci].cents === 0) ci++;
        if (debitori[di].cents === 0) di++;
      }
      return passaggi;
    };

    const faiSaldi = (anticipi, campoPay, nomeCassa) => {
      const paidByName = {}; // nome normalizzato -> { display, paid }
      anticipi.forEach((a) => {
        const price = posNum(a.price);
        if (price <= 0) return;
        const raw = (a.buyer && a.buyer.trim()) ? a.buyer.trim() : '—';
        const key = norm(raw) || '—';
        if (!paidByName[key]) paidByName[key] = { display: raw, paid: 0 };
        paidByName[key].paid += price;
      });
      const owedByName = {}; // nome membro normalizzato -> { display, owed }
      breakdown.forEach((b) => {
        const key = norm(b.name);
        if (!owedByName[key]) owedByName[key] = { display: b.name, owed: 0 };
        owedByName[key].owed += b[campoPay]; // già arrotondato; bambini = 0
      });
      const unattributed = paidByName['—'] ? paidByName['—'].paid : 0;
      // Spese intestate a un nome che non è fra i membri: succede se un membro
      // viene rinominato o eliminato dopo l'acquisto. Non è un errore di calcolo
      // (i saldi restano a somma zero) ma va mostrato, perché quella persona
      // compare nei rimborsi pur non essendo del campo.
      const unknownBuyers = Object.keys(paidByName)
        .filter((k) => k !== '—' && !owedByName[k])
        .map((k) => ({ name: paidByName[k].display, paid: paidByName[k].paid }));
      const allKeys = new Set([...Object.keys(paidByName), ...Object.keys(owedByName)]);
      allKeys.delete('—');
      const settlement = [];
      allKeys.forEach((k) => {
        const paid = paidByName[k] ? paidByName[k].paid : 0;
        const owed = owedByName[k] ? owedByName[k].owed : 0;
        if (paid === 0 && owed === 0) return;
        const display = (owedByName[k] && owedByName[k].display) || (paidByName[k] && paidByName[k].display) || k;
        settlement.push({ name: display, paid, owed, net: paid - owed });
      });
      settlement.sort((a, b) => b.net - a.net); // prima chi deve ricevere
      const transfers = pareggia(settlement, nomeCassa);
      // Anticipi per acquirente di questa cassa (utile per i rimborsi).
      const byBuyer = Object.keys(paidByName)
        .map((k) => ({ name: paidByName[k].display, total: paidByName[k].paid }))
        .sort((a, b) => b.total - a.total);
      return { settlement, transfers, byBuyer, unattributed, unknownBuyers };
    };

    // La cassa separata è solo il cibo dei giorni spuntati. Tutto il resto —
    // cibo comune, logistica, attrezzatura comprata — è cassa comune.
    const cassaSep = faiSaldi(
      purchases.filter(isSepPurchase),
      'paySep', 'separata');
    const cassaComune = faiSaldi(
      [
        ...purchases.filter((p) => !isSepPurchase(p)),
        // Attrezzatura acquistata: se ha un acquirente viene accreditata a lui
        // (verrà rimborsato); altrimenti è spesa comune ("non attribuita"). In
        // entrambi i casi la somma dei saldi resta zero.
        ...equipment.filter((e) => e.bought).map((e) => ({ buyer: e.buyer, price: e.price })),
      ],
      'payComune', 'comune');
    const casse = { comune: cassaComune, separata: cassaSep };

    // Viste d'insieme: servono al resoconto da mandare nel gruppo, alla
    // chiusura del campo e alle prove. Non sostituiscono le due casse: le
    // riassumono.
    const transfers = [...cassaComune.transfers, ...cassaSep.transfers];
    const unattributed = cassaComune.unattributed + cassaSep.unattributed;
    const perNome = {};
    [cassaComune, cassaSep].forEach((c) => c.settlement.forEach((s) => {
      const k = norm(s.name);
      if (!perNome[k]) perNome[k] = { name: s.name, paid: 0, owed: 0 };
      perNome[k].paid += s.paid;
      perNome[k].owed += s.owed;
    }));
    const settlement = Object.keys(perNome)
      .map((k) => ({ ...perNome[k], net: perNome[k].paid - perNome[k].owed }))
      .sort((a, b) => b.net - a.net);
    // Gli stessi saldi pareggiati una volta sola invece che cassa per cassa:
    // le cifre dovute non cambiano di un centesimo, cambiano solo i bonifici,
    // che diventano meno. Chi era creditore di qua e debitore di la' qui si
    // compensa da solo. E' la vista che serve QUANDO SI PAGA; quella per
    // cassa resta, ed e' la vista che serve per capire PERCHE'.
    const transfersOttimizzati = pareggia(settlement, 'tutte');
    const sconosciuti = {};
    [cassaComune, cassaSep].forEach((c) => c.unknownBuyers.forEach((u) => {
      const k = norm(u.name);
      if (!sconosciuti[k]) sconosciuti[k] = { name: u.name, paid: 0 };
      sconosciuti[k].paid += u.paid;
    }));
    const unknownBuyers = Object.keys(sconosciuti).map((k) => sconosciuti[k]);
    const byBuyer = (() => {
      const m2 = {};
      [...cassaComune.byBuyer, ...cassaSep.byBuyer].forEach((b) => {
        m2[b.name] = (m2[b.name] || 0) + b.total;
      });
      return Object.keys(m2).map((name) => ({ name, total: m2[name] })).sort((a, b) => b.total - a.total);
    })();

    return {
      totalFood, totalDrinks, totalAccessory, totalFoodDrinks, overallTotal,
      costPerMeal, logisticsPerAdult, equipPerAdult, accessoryPerAdult,
      logisticsPurchases, equipBought, equipPayersCount: equipDivisorSet.size,
      adultMealsTotal, adultMealsCommon, adultMealsSep,
      foodDrinksCommon, foodDrinksSep, costPerMealSep,
      sepPeopleCount: sepPeople.size, sepDaysCount: sepDays.length,
      freeDaysCount: freeDays.length, mealsFree,
      attendingAdultsCount: attendingAdults.size,
      accessoryPayersCount: attendingCommon.size, breakdown,
      collected, roundingDiff, nonRipartito, buchi,
      totaleComune, collectedComune, collectedSep,
      roundingDiffComune, roundingDiffSep,
      nonRipartitoComune, nonRipartitoSep, casse,
      byBuyer, settlement, unattributed, unknownBuyers, transfers,
      transfersOttimizzati,
    };
  };

  root.Conti = { calcola: calcola, money: money, posNum: posNum };
})(typeof window !== 'undefined' ? window : globalThis);
