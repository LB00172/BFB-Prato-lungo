// I quattro livelli di "Aiuta Bandy": bosco, città, spiaggia di Rio, notte thailandese.
// Il gioco tiene lo stato su canvas.__game, quindi si può portare avanti di
// livello senza dover davvero raccogliere sessanta Bandy.
const path = require('path');
const { apri, ok, fine } = require('../lib/app');

// Porta il gioco al livello chiesto. Il Bandy viene messo davanti al muso, così
// il livello scatta al passo dopo; appena è scattato si mette in PAUSA, altrimenti
// ai livelli alti il serpente fa in tempo ad andare a sbattere mentre la prova
// sta ancora guardando lo schermo (e il cartello del livello sparisce col
// "Bandy è scappato").
const vaiAlLivello = async (p, n) => {
  await p.evaluate((liv) => {
    const st = document.querySelector('canvas').__game;
    st.pause = false;
    st.score = (liv - 1) * 15 - 1;
    st.food = { x: st.snake[0].x + st.dir.x, y: st.snake[0].y + st.dir.y };
  }, n);
  await p.waitForFunction((liv) => {
    const st = document.querySelector('canvas').__game;
    if (st.level >= liv) { st.pause = true; return true; }
    return false;
  }, n, { timeout: 5000 });
  await p.waitForTimeout(250);
};

// Quanto pesa un colore nell'immagine: serve a distinguere un bosco verde da
// una spiaggia chiara senza confrontare pixel a pixel.
const tinte = (p) => p.evaluate(() => {
  const c = document.querySelector('canvas');
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let verde = 0, sabbia = 0, blu = 0, tot = 0;
  for (let i = 0; i < d.length; i += 4 * 7) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    tot++;
    if (g > r + 20 && g > b + 20) verde++;
    if (r > 190 && g > 165 && b > 110 && b < 210 && r > b + 30) sabbia++;
    if (b > r + 45 && b > 110) blu++;
  }
  return { verde: verde / tot, sabbia: sabbia / tot, blu: blu / tot };
});

(async () => {
  const { browser, page: p, menu, errori } = await apri({ viewport: { width: 400, height: 900 } });

  await menu('Aiuta Bandy');
  await p.fill('input[placeholder="Come ti chiami?"]', 'Lorenzo');
  await p.locator('button', { hasText: 'Gioca' }).first().click();
  await p.waitForTimeout(600);
  ok('il gioco parte', (await p.locator('canvas').count()) > 0);

  // --- Livello 1: bosco ---
  ok('il livello 1 si chiama Prato Lungo', /prato lungo/i.test(await p.locator('body').innerText()));
  const l1 = await tinte(p);
  ok(`livello 1: domina il verde del bosco (${Math.round(l1.verde * 100)}%)`, l1.verde > 0.22);

  // --- Livello 2: città ---
  await vaiAlLivello(p, 2);
  const l2 = await tinte(p);
  ok('livello 2: il verde sparisce, si va sull\'asfalto', l2.verde < l1.verde / 2);
  ok('il cartello dà il nome al livello', /palmiro togliatti/i.test(await p.locator('body').innerText()));

  // --- Livello 3: la spiaggia di Rio ---
  await vaiAlLivello(p, 3);
  // Il cartello dura meno di due secondi: si legge PRIMA delle analisi
  // dell'immagine, che sono lente.
  ok('il cartello dice dove siamo', /rio de janeiro/i.test(await p.locator('body').innerText()));
  const l3 = await tinte(p);
  ok(`livello 3: domina la sabbia (${Math.round(l3.sabbia * 100)}%)`, l3.sabbia > 0.30);
  ok(`c'è il mare sulla sinistra (${Math.round(l3.blu * 100)}% di blu)`, l3.blu > 0.08);

  // Il mare deve stare tutto in una fascia a sinistra, non sparso: è quello che
  // fa leggere "spiaggia" invece di "macchie azzurre".
  const acqua = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let sinistra = 0, destra = 0;
    for (let y = 0; y < c.height; y += 4) {
      for (let x = 0; x < c.width; x += 4) {
        const i = (y * c.width + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (b > r + 45 && b > 110) { if (x < c.width * 0.25) sinistra++; else destra++; }
      }
    }
    return { sinistra, destra };
  });
  ok(`il mare è una fascia a sinistra (${acqua.sinistra} contro ${acqua.destra})`, acqua.sinistra > acqua.destra * 2);

  // Le bandiere: verde brasiliano e giallo devono esserci sulla sabbia.
  const bandiere = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let verdeBr = 0, giallo = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (Math.abs(r - 30) < 45 && Math.abs(g - 156) < 45 && Math.abs(b - 74) < 45) verdeBr++;
      if (r > 225 && g > 190 && b < 90) giallo++;
    }
    return { verdeBr, giallo };
  });
  ok(`c'è il verde della bandiera brasiliana (${bandiere.verdeBr} pixel)`, bandiere.verdeBr > 400);
  ok(`e il giallo del rombo (${bandiere.giallo} pixel)`, bandiere.giallo > 150);

  await p.locator('canvas').screenshot({ path: path.join(__dirname, '..', 'tmp', 'livello3-gioco.png') });

  // --- Livello 4: la notte thailandese ---
  await vaiAlLivello(p, 4);
  ok('il cartello annuncia la Thailandia', /thailandia/i.test(await p.locator('body').innerText()));

  const notte = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let luce = 0, n = 0, neon = 0, abbaglianti = 0, rossoTh = 0, bluTh = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      luce += (r + g + b) / 3; n++;
      // neon: molto saturo e molto chiaro
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      // Le insegne devono ESSERCI e vedersi colorate...
      if (max > 150 && max - min > 60) neon++;
      // ...ma nessun blocco deve BRUCIARE. Il neon acceso al massimo su
      // asfalto quasi nero e' il contrasto piu' aggressivo che ci sia, e
      // dopo dieci minuti di partita gli occhi se ne accorgono. Con la
      // tavolozza accesa qui si contavano 37.513 pixel; con quella calma
      // 469, e sono la foto di Bandy, che deve saltare all'occhio.
      if (max > 225 && max - min > 140) abbaglianti++;
      if (Math.abs(r - 216) < 30 && Math.abs(g - 43) < 40 && Math.abs(b - 60) < 40) rossoTh++;
      if (Math.abs(r - 27) < 30 && Math.abs(g - 44) < 30 && Math.abs(b - 107) < 35) bluTh++;
    }
    return { luce: luce / n, neon, abbaglianti, rossoTh, bluTh };
  });
  ok(`livello 4: è notte, la strada è scura (luminosità media ${Math.round(notte.luce)}/255)`, notte.luce < 110);
  ok(`ci sono le insegne al neon (${notte.neon} pixel colorati)`, notte.neon > 20000);
  ok(`ma non abbagliano (${notte.abbaglianti} pixel accecanti, erano 37513)`, notte.abbaglianti < 1500);
  ok(`c'è il rosso della bandiera thailandese (${notte.rossoTh} pixel)`, notte.rossoTh > 200);
  ok(`e il blu (${notte.bluTh} pixel)`, notte.bluTh > 200);

  // Le insegne stanno ai due lati, sopra i locali: se fossero sparse in mezzo
  // alla strada non si leggerebbe "corridoio di locali".
  const lati = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let bordi = 0, centro = 0;
    for (let y = 0; y < c.height; y += 3) {
      for (let x = 0; x < c.width; x += 3) {
        const i = (y * c.width + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        // Stesso metro di sopra: si contano i pixel COLORATI, non quelli
        // accecanti. Col metro vecchio qui finivano dentro i tuk-tuk in
        // mezzo alla carreggiata, e la verifica misurava quelli invece
        // delle insegne che dice di misurare.
        if (max > 150 && max - min > 60) {
          if (x < c.width * 0.3 || x > c.width * 0.7) bordi++; else centro++;
        }
      }
    }
    return { bordi, centro };
  });
  ok(`le insegne stanno ai lati, non in mezzo alla strada (${lati.bordi} contro ${lati.centro})`,
    lati.bordi > lati.centro * 3);

  // Il corpo dev'essere leggibile sull'asfalto scuro: al livello 3 è marrone
  // scuro su sabbia chiara, qui serve il contrario.
  const contrasto = await p.evaluate(() => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let pelle = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 190 && g > 140 && g < 200 && b > 100 && b < 175 && r > b + 40) pelle++;
    }
    return pelle;
  });
  ok(`il corpo si vede sull'asfalto scuro (${contrasto} pixel di pelle chiara)`, contrasto > 300);

  await p.locator('canvas').screenshot({ path: path.join(__dirname, '..', 'tmp', 'livello4-gioco.png') });

  // Il cartello dura meno di due secondi: passato quello, il nome del livello
  // deve restare leggibile nella riga del punteggio, altrimenti chi gioca non
  // sa più dov'è.
  await p.waitForTimeout(2000);
  const dopoCartello = await p.locator('body').innerText();
  ok('sparito il cartello, il nome resta nella riga del punteggio',
    /thailandia/i.test(dopoCartello) && !/livello 4/i.test(dopoCartello));

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
