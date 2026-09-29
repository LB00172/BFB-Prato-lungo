// Il verdetto finale: i conti fatti OFFLINE, a pezzi, su due telefoni che poi
// si riagganciano, devono dare gli stessi identici numeri di quelli fatti
// online da un telefono solo.
//
// È la domanda vera del campo: dall'11 al 15 si sale a scaglioni, i telefoni
// vanno offline uno alla volta, ognuno segna la sua parte, e al rientro tutto
// si ricompone. Se il risultato dipendesse da CHI ha segnato cosa o da QUANDO
// si è riagganciato, i conti finali sarebbero una lotteria.
//
// Qui il confronto è sui numeri esatti (window.__totali), non sul testo a
// schermo: due quote possono scriversi uguali e non esserlo.
const { apri, ok, fine } = require('../lib/app');

// Cloud finto con un interruttore: quando è "offline" nessuno riceve niente,
// ma l'app continua a lavorare e a tenersi pronto l'ultimo stato da spedire —
// che è esattamente ciò che ripubblica al ritorno della linea.
function cloudFinto() {
  window.__inviati = [];
  Object.defineProperty(window, 'CloudSync', {
    configurable: true,
    get() { return window.__cs; },
    set(v) {
      window.__cs = Object.assign({}, v, {
        isConfigured: () => true,
        isConnected: () => !!window.__connesso,
        savedCode: () => 'TEST',
        connect: (cfg, code, cb) => {
          window.__remoteCb = cb;
          window.__connesso = true;
          if (window.__status) window.__status({ connected: true, status: 'connected', code });
          return Promise.resolve();
        },
        onStatus: (cb) => { window.__status = cb; cb({ connected: true, status: 'connected', code: 'TEST' }); },
        onReceipts: () => {}, onWeather: () => {},
        pushState: (obj) => { window.__inviati.push(JSON.stringify(obj)); },
        riprova: () => false, inSospeso: () => false, fotoInCoda: () => 0,
        putReceipt: () => {}, deleteReceipt: () => {},
        putArchive: () => Promise.resolve(true), listArchives: () => Promise.resolve([]),
        listSnapshots: () => Promise.resolve([]), listScores: () => Promise.resolve([]),
        submitScore: () => Promise.resolve(),
        watchPhotos: () => () => {}, listPhotos: () => Promise.resolve([]),
        archivePhotos: () => Promise.resolve(0), putPhoto: () => Promise.resolve(true),
        getPhotoFull: () => Promise.resolve(null), deletePhoto: () => Promise.resolve(true),
      });
    },
  });
}

// ---- Azioni sull'app, le stesse per tutti i telefoni ----
const membro = async (p, nome) => {
  await p.fill('input[placeholder="Nome e cognome"]', nome);
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(180);
};

const vaiAlGiorno = async (p, menu, i) => {
  await menu('Calendario');
  await p.locator('.grid.grid-cols-7 button').nth(i).click();
  await p.waitForTimeout(220);
  await menu('Presenze');
  await p.waitForTimeout(220);
};

// Segna tutti a pranzo e a cena con i tasti in blocco (che chiedono conferma).
const tuttiPresenti = async (p) => {
  // La riga "Segna in blocco" resta aperta fra un giorno e l'altro: va aperta
  // solo se i tasti non si vedono già, altrimenti la si richiude.
  if ((await p.locator('button', { hasText: 'Tutti a pranzo' }).count()) === 0) {
    await p.locator('button', { hasText: 'Segna in blocco' }).first().click();
    await p.waitForTimeout(280);
  }
  for (const t of ['Tutti a pranzo', 'Tutti a cena']) {
    await p.locator('button', { hasText: t }).first().click();
    await p.waitForTimeout(350);
  }
};

const spesa = async (p, menu, nome, prezzo, tipo, chi) => {
  await menu('Lista della Spesa');
  const tab = p.locator('button', { hasText: 'Acquistato' });
  if (await tab.count()) { await tab.first().click(); await p.waitForTimeout(250); }
  const man = p.locator('main button', { hasText: 'Registra una spesa' });
  if (await man.count()) { await man.first().click(); await p.waitForTimeout(280); }
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', nome);
  await p.locator('input[data-cifra]').first().fill(String(prezzo));
  if (tipo) await p.locator(`[data-foglio-spesa] [data-tipo="${tipo}"]`).click();
  if (chi) await p.locator('select').filter({ hasText: /—/ }).first().selectOption({ label: chi }).catch(() => {});
  await p.locator('button', { hasText: /Salva/ }).first().click();
  await p.waitForTimeout(400);
};

// I numeri che contano, presi dall'app e non dallo schermo.
const conti = (p) => p.evaluate(() => {
  const t = window.__totali;
  if (!t) return null;
  return {
    totale: Math.round(t.overallTotal * 100),
    raccolto: Math.round(t.collected * 100),
    buco: Math.round((t.nonRipartito || 0) * 100),
    quote: Object.fromEntries(t.breakdown.map((b) => [b.name, Math.round(b.pay * 100)])),
    passaggi: t.transfers.map((x) => `${x.from}→${x.to}:${Math.round(x.amount * 100)}`).sort(),
  };
});

const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Consegna a "dest" l'ultimo stato pubblicato da "src", come farebbe il cloud.
const consegna = async (src, dest) => {
  const json = await src.evaluate(() => {
    const v = window.__inviati;
    return v && v.length ? v[v.length - 1] : null;
  });
  if (!json) return false;
  await dest.evaluate((s) => { window.__remoteCb(JSON.parse(s)); }, json);
  await dest.waitForTimeout(500);
  return true;
};

// Due telefoni che si riagganciano e si scambiano lo stato finché non
// convergono: è quello che fanno davvero al rientro.
const riaggancia = async (a, b, giri) => {
  for (let i = 0; i < (giri || 3); i++) {
    await consegna(a, b);
    await consegna(b, a);
  }
};

(async () => {
  // ============================================================
  //  RIFERIMENTO: un telefono solo, sempre online, fa tutto lui
  // ============================================================
  const A = await apri({ initScript: cloudFinto });
  A.page.removeAllListeners('dialog');
  A.page.on('dialog', async (d) => { await d.accept(); });

  await A.menu('Membri');
  for (const n of ['Anna', 'Bruno', 'Carlo']) await membro(A.page, n);
  for (const g of [1, 2, 3, 4]) { await vaiAlGiorno(A.page, A.menu, g); await tuttiPresenti(A.page); }
  await spesa(A.page, A.menu, 'Spesa grossa', 137.4, null, 'Anna');
  await spesa(A.page, A.menu, 'Bevande', 48.6, 'bevande', 'Bruno');
  await spesa(A.page, A.menu, 'Gas e carbone', 31.5, 'logistica', 'Carlo');
  await A.page.waitForTimeout(600);

  const riferimento = await conti(A.page);
  ok(`il riferimento è stato calcolato (totale ${riferimento.totale / 100} €)`, riferimento && riferimento.totale === 21750);
  ok(`raccolto = totale, nessun buco (${riferimento.raccolto / 100} €)`,
    riferimento.raccolto === riferimento.totale && riferimento.buco === 0);
  await A.browser.close();

  // ============================================================
  //  STESSO CAMPO, MA OFFLINE E DIVISO FRA DUE TELEFONI
  // ============================================================
  // Setup comune fatto prima di salire (tutti online): i membri.
  const B = await apri({ initScript: cloudFinto });
  const C = await apri({ initScript: cloudFinto });
  [B, C].forEach((x) => {
    x.page.removeAllListeners('dialog');
    x.page.on('dialog', async (d) => { await d.accept(); });
  });

  await B.menu('Membri');
  for (const n of ['Anna', 'Bruno', 'Carlo']) await membro(B.page, n);
  await B.page.waitForTimeout(500);
  await consegna(B.page, C.page);
  const membriC = await C.page.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]').map((m) => m.name).sort());
  ok(`i membri arrivano anche al secondo telefono (${membriC.join(', ')})`, membriC.join() === 'Anna,Bruno,Carlo');

  // --- Da qui in poi sono OFFLINE: nessuno scambio fino al rientro ---
  // B fa i primi due giorni e due spese. C fa gli altri due giorni e la terza.
  for (const g of [1, 2]) { await vaiAlGiorno(B.page, B.menu, g); await tuttiPresenti(B.page); }
  await spesa(B.page, B.menu, 'Spesa grossa', 137.4, null, 'Anna');
  await spesa(B.page, B.menu, 'Bevande', 48.6, 'bevande', 'Bruno');

  for (const g of [3, 4]) { await vaiAlGiorno(C.page, C.menu, g); await tuttiPresenti(C.page); }
  await spesa(C.page, C.menu, 'Gas e carbone', 31.5, 'logistica', 'Carlo');
  await B.page.waitForTimeout(500);
  await C.page.waitForTimeout(500);

  // Offline ognuno vede solo la sua metà: i conti sono parziali, ma coerenti.
  const soloB = await conti(B.page);
  const soloC = await conti(C.page);
  ok(`offline B vede solo le sue spese (${soloB.totale / 100} €)`, soloB.totale === 18600);
  ok(`offline C vede solo le sue (${soloC.totale / 100} €)`, soloC.totale === 3150);
  ok('e ognuno raccoglie esattamente quello che vede',
    soloB.raccolto === soloB.totale && soloC.raccolto === soloC.totale);

  // --- Rientro: si riagganciano e si scambiano tutto ---
  await riaggancia(B.page, C.page);

  const dopoB = await conti(B.page);
  const dopoC = await conti(C.page);

  ok(`dopo il rientro il totale è quello vero (${dopoB.totale / 100} €)`, dopoB.totale === riferimento.totale);
  ok('e i due telefoni sono d\'accordo fra loro', uguali(dopoB, dopoC));
  ok(`le quote sono IDENTICHE a quelle fatte online (${JSON.stringify(dopoB.quote)})`, uguali(dopoB.quote, riferimento.quote));
  ok(`e anche chi paga chi (${dopoB.passaggi.join(' · ')})`, uguali(dopoB.passaggi, riferimento.passaggi));
  ok('raccolto e buco identici al riferimento',
    dopoB.raccolto === riferimento.raccolto && dopoB.buco === riferimento.buco);

  // ============================================================
  //  L'ORDINE DI RIENTRO NON DEVE CONTARE
  // ============================================================
  // Stesso campo, ma stavolta rientra prima C. Se il risultato cambiasse,
  // i conti dipenderebbero da chi arriva primo al parcheggio.
  const D = await apri({ initScript: cloudFinto });
  const E = await apri({ initScript: cloudFinto });
  [D, E].forEach((x) => {
    x.page.removeAllListeners('dialog');
    x.page.on('dialog', async (d) => { await d.accept(); });
  });
  await D.menu('Membri');
  for (const n of ['Anna', 'Bruno', 'Carlo']) await membro(D.page, n);
  await D.page.waitForTimeout(400);
  await consegna(D.page, E.page);
  for (const g of [1, 2]) { await vaiAlGiorno(D.page, D.menu, g); await tuttiPresenti(D.page); }
  await spesa(D.page, D.menu, 'Spesa grossa', 137.4, null, 'Anna');
  await spesa(D.page, D.menu, 'Bevande', 48.6, 'bevande', 'Bruno');
  for (const g of [3, 4]) { await vaiAlGiorno(E.page, E.menu, g); await tuttiPresenti(E.page); }
  await spesa(E.page, E.menu, 'Gas e carbone', 31.5, 'logistica', 'Carlo');
  await D.page.waitForTimeout(400);
  await E.page.waitForTimeout(400);
  await riaggancia(E.page, D.page);          // ordine invertito

  const invertito = await conti(D.page);
  ok('rientrando in ordine inverso i conti sono gli stessi', uguali(invertito, riferimento));

  // ============================================================
  //  LA STESSA VOCE TOCCATA DA TUTTI E DUE, OFFLINE
  // ============================================================
  // Finora i due telefoni si erano divisi il lavoro senza pestarsi i piedi.
  // Qui invece toccano la STESSA presenza mentre sono scollegati: D toglie il
  // pranzo ad Anna, e più tardi E le toglie la cena. Al rientro devono
  // ritrovarsi tutti e due con la versione PIÙ RECENTE — quella di E — non
  // ognuno con la propria.
  const pastoAnna = (p) => p.evaluate(() => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    const anna = membri.find((m) => m.name === 'Anna');
    const g = Object.keys(cd).sort()[0];
    const v = ((cd[g] || {}).meals || {})[anna.id] || {};
    return `${v.lunch ? 'P' : '-'}${v.dinner ? 'C' : '-'}`;
  });

  await vaiAlGiorno(D.page, D.menu, 1);
  await D.page.locator('li', { hasText: 'Anna' }).locator('button', { hasText: 'Pranzo' }).first().click();
  await D.page.waitForTimeout(600);
  ok(`D toglie il pranzo ad Anna (${await pastoAnna(D.page)})`, (await pastoAnna(D.page)) === '-C');

  await vaiAlGiorno(E.page, E.menu, 1);
  await E.page.locator('li', { hasText: 'Anna' }).locator('button', { hasText: 'Cena' }).first().click();
  await E.page.waitForTimeout(600);
  ok(`E, più tardi, le toglie la cena (${await pastoAnna(E.page)})`, (await pastoAnna(E.page)) === 'P-');

  await riaggancia(D.page, E.page);
  const scontroD = await pastoAnna(D.page);
  const scontroE = await pastoAnna(E.page);
  ok(`sulla stessa voce vince la modifica più recente, su entrambi (D:${scontroD} E:${scontroE})`,
    scontroD === 'P-' && scontroE === 'P-');
  ok('e i conti dei due telefoni coincidono', uguali(await conti(D.page), await conti(E.page)));

  await D.browser.close();
  await E.browser.close();

  // ============================================================
  //  SENZA LINEA L'APP DEVE FARE I CONTI LO STESSO, E RICORDARLI
  // ============================================================
  await B.page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
  });
  await B.page.waitForTimeout(400);
  const senzaLinea = await conti(B.page);
  ok('togliendo la linea i conti restano quelli', uguali(senzaLinea, riferimento));

  // Una modifica fatta senza linea deve entrare nei conti subito.
  // Attenzione a cosa si sceglie: aggiungere un giorno in cui ci sono TUTTI
  // non sposta di un centesimo le quote — il divisore cresce esattamente
  // quanto i pasti di ciascuno, ed è giusto così. Per vedere il conto muoversi
  // serve una presenza che rompa la simmetria: solo Anna mangia il quinto
  // giorno, quindi paga di più e gli altri di meno.
  await vaiAlGiorno(B.page, B.menu, 5);
  for (const pasto of ['Pranzo', 'Cena']) {
    await B.page.locator('li', { hasText: 'Anna' }).locator('button', { hasText: pasto }).first().click();
    await B.page.waitForTimeout(220);
  }
  await B.page.waitForTimeout(500);
  const conGiornoInPiu = await conti(B.page);
  ok(`una presenza segnata offline cambia le quote all'istante (${JSON.stringify(conGiornoInPiu.quote)})`,
    !uguali(conGiornoInPiu.quote, riferimento.quote));
  ok(`chi ha mangiato di più paga di più (Anna ${conGiornoInPiu.quote.Anna / 100} €, Bruno ${conGiornoInPiu.quote.Bruno / 100} €)`,
    conGiornoInPiu.quote.Anna > conGiornoInPiu.quote.Bruno &&
    conGiornoInPiu.quote.Bruno === conGiornoInPiu.quote.Carlo);
  ok(`e il totale da raccogliere resta quello speso (${conGiornoInPiu.raccolto / 100} di ${conGiornoInPiu.totale / 100} €)`,
    conGiornoInPiu.totale === riferimento.totale &&
    Math.abs(conGiornoInPiu.raccolto + conGiornoInPiu.buco - conGiornoInPiu.totale) <= 50);

  // E deve sopravvivere alla chiusura dell'app, sempre senza linea.
  await B.page.reload({ waitUntil: 'load' });
  await B.page.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await B.page.waitForFunction(() => !!window.__totali, null, { timeout: 8000 });
  const dopoRiavvio = await conti(B.page);
  ok('e sopravvive alla riapertura dell\'app', uguali(dopoRiavvio, conGiornoInPiu));

  // --- Torna la linea: il lavoro offline raggiunge l'altro telefono ---
  await B.page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    window.dispatchEvent(new Event('online'));
  });
  await B.page.waitForTimeout(600);
  await riaggancia(B.page, C.page);
  const finaleB = await conti(B.page);
  const finaleC = await conti(C.page);
  ok('al ritorno della linea il giorno segnato offline arriva all\'altro', uguali(finaleC, dopoRiavvio));
  ok('e i due telefoni restano d\'accordo', uguali(finaleB, finaleC));

  // --- Un altro giro di scambi non deve muovere più niente ---
  await riaggancia(B.page, C.page);
  ok('scambiandosi ancora i dati, i conti non si muovono più (convergenza)',
    uguali(await conti(B.page), finaleB) && uguali(await conti(C.page), finaleC));

  ok('nessun errore JavaScript su B' + (B.errori.length ? ': ' + B.errori.join(' | ') : ''), B.errori.length === 0);
  ok('nessun errore JavaScript su C' + (C.errori.length ? ': ' + C.errori.join(' | ') : ''), C.errori.length === 0);
  await C.browser.close();
  await fine(B.browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
