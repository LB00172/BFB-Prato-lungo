// Aiuta Bandy col dito: una strisciata deve poter fare due svolte, come due
// tasti premuti di fila. Il gioco accetta due svolte in coda (serve per le
// manovre a L); prima, sul telefono, quella coda non si riusciva a riempire —
// una strisciata valeva una svolta sola e per girare di nuovo bisognava alzare
// il dito. Al livello 4 (50 ms per passo) quel tempo morto vale tre caselle.
const { apri, ok, fine } = require('../lib/app');

// Eventi di tocco sintetici sul canvas. Il gioco ascolta touchstart/touchmove.
const tocco = (page, tipo, x, y) => page.evaluate((o) => {
  const c = document.querySelector('canvas');
  const t = new Touch({ identifier: 1, target: c, clientX: o.x, clientY: o.y });
  c.dispatchEvent(new TouchEvent(o.tipo, { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true }));
}, { tipo, x, y });

// La coda delle svolte ancora da eseguire, letta dal gancio per i test.
const coda = (page) => page.evaluate(() => {
  const g = document.querySelector('canvas').__game;
  return (g.queue || []).map((d) => `${d.x},${d.y}`).join(' ');
});
const svuota = (page) => page.evaluate(() => { document.querySelector('canvas').__game.queue = []; });

(async () => {
  const { browser, page: p, menu, errori } = await apri();

  await menu('Aiuta Bandy');
  await p.fill('input[placeholder="Come ti chiami?"]', 'Lorenzo');
  await p.locator('button', { hasText: 'Gioca' }).first().click();
  await p.waitForTimeout(500);
  ok('il gioco parte', (await p.locator('canvas').count()) === 1);

  // In pausa la coda non viene consumata: si vede esattamente quante svolte
  // sono state accettate, senza rincorrere il serpente.
  await p.locator('button[aria-label="Pausa"]').click();
  await p.waitForTimeout(300);
  ok('si mette in pausa', await p.evaluate(() => document.querySelector('canvas').__game.pause === true));
  ok('si parte diretti verso l\'alto',
    await p.evaluate(() => { const d = document.querySelector('canvas').__game.dir; return d.x === 0 && d.y === -1; }));

  // ---- 1. Una strisciata a L: due svolte, senza staccare il dito ---------
  await svuota(p);
  await tocco(p, 'touchstart', 200, 400);
  await tocco(p, 'touchmove', 260, 400);        // prima gamba: a destra
  ok('la prima svolta arriva subito', (await coda(p)) === '1,0');
  await tocco(p, 'touchmove', 260, 470);        // seconda gamba: in giù
  ok('la seconda svolta arriva SENZA alzare il dito', (await coda(p)) === '1,0 0,1');

  // ---- 2. La coda si ferma a due, come prima ----------------------------
  await tocco(p, 'touchmove', 190, 470);        // terza: a sinistra
  ok('oltre due svolte in coda non si accumula', (await coda(p)) === '1,0 0,1');

  // ---- 3. Il trascinamento in diagonale non fa zigzagare Bandy ----------
  // È il prezzo del ri-ancoraggio: senza il controllo di nettezza, un dito
  // tirato di sbieco alternerebbe orizzontale e verticale da solo.
  await tocco(p, 'touchend', 190, 470);
  await svuota(p);
  await tocco(p, 'touchstart', 200, 400);
  await tocco(p, 'touchmove', 240, 400);        // netta: a destra
  ok('la prima svolta della diagonale passa', (await coda(p)) === '1,0');
  await tocco(p, 'touchmove', 280, 440);        // 40 e 40: nessuna prevale
  ok('il seguito in diagonale viene ignorato', (await coda(p)) === '1,0');
  await tocco(p, 'touchmove', 320, 480);        // continua di sbieco
  ok('e resta ignorato anche insistendo', (await coda(p)) === '1,0');

  // ---- 4. Un movimento minimo non conta ---------------------------------
  await svuota(p);
  await tocco(p, 'touchstart', 200, 400);
  await tocco(p, 'touchmove', 210, 400);        // 10 px: sotto la soglia
  ok('un accenno di dieci pixel non gira niente', (await coda(p)) === '');
  await tocco(p, 'touchmove', 220, 400);        // 20 px: sopra la soglia
  ok('venti pixel invece girano', (await coda(p)) === '1,0');

  // ---- 5. Staccare e riappoggiare continua a funzionare -----------------
  await tocco(p, 'touchend', 220, 400);
  await svuota(p);
  await tocco(p, 'touchstart', 200, 400);
  await tocco(p, 'touchmove', 140, 400);        // a sinistra
  ok('una strisciata nuova gira come sempre', (await coda(p)) === '-1,0');

  // ---- 6. L'inversione a U resta vietata --------------------------------
  await svuota(p);
  await p.evaluate(() => { document.querySelector('canvas').__game.dir = { x: 1, y: 0 }; });
  await tocco(p, 'touchstart', 200, 400);
  await tocco(p, 'touchmove', 120, 400);        // contromano
  ok('non si torna indietro su sé stessi', (await coda(p)) === '');

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
