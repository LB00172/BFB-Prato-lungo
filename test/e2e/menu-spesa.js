// Dal menù alla lista della spesa: il giro completo, coi menù veri del campo.
//
// Il caso d'uso viene dall'export dell'agosto 2026: nei menù c'era tutta la
// spesa con le quantità, e la scheda "Da acquistare" aveva cinque voci. Qui si
// verifica che il ponte funzioni E che rispetti la regola: propone, non scrive.
const { apri, ok, fine } = require('../lib/app');

// Il menù del 14 agosto, copiato dall'export.
const MENU = 'Pranzo : \nPasta funghi e piselli\n40 scamorze\n\nCena : \n150 arrosticini \n40 COSCE pollo\n50 salsiccie\nPannocchie';

const semina = (menu) => {
  localStorage.setItem('cambusa_members', JSON.stringify([{ id: 'a', name: 'Alice', isChild: false }]));
  localStorage.setItem('cambusa_camp_data', JSON.stringify({
    '2026-08-14': { note: menu, appunti: '', guestsNames: '', meals: { a: { lunch: true, dinner: true } } },
  }));
  localStorage.setItem('cambusa_tobuy', JSON.stringify([{ id: 't1', name: 'scamorze', qty: '10' }]));
  localStorage.setItem('cambusa_purchases', JSON.stringify([]));
};

const inLista = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_tobuy') || '[]'));

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: [semina, MENU] });

  await menu('Menù');
  // il giorno del menù è quello seminato
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('.grid.grid-cols-7 button')].find((x) => x.textContent.includes('14'));
    if (b) b.click();
  });
  await p.waitForTimeout(400);

  const tasto = p.locator('main button', { hasText: /Porta nella lista della spesa/ });
  ok('il tasto c\'è nella scheda Menù', (await tasto.count()) === 1);

  await tasto.first().click();
  await p.waitForTimeout(400);

  const finestra = p.locator('div.fixed', { hasText: 'Dal menù alla spesa' });
  ok('si apre la conferma invece di scrivere di nascosto', (await finestra.count()) === 1);

  const righe = await finestra.locator('ul li').allInnerTexts();
  const testo = righe.map((r) => r.replace(/\s+/g, ' ').trim());
  // Il menu' ha sei righe; "scamorze" e' gia' in lista, quindi ne propone cinque.
  ok(`propone le voci del menù (${testo.join(' / ')})`, testo.length === 5);
  ok('legge la quantità in testa alla riga', testo.some((r) => /^arrosticini 150$/.test(r)));
  ok('tiene interi i nomi di due parole', testo.some((r) => /^COSCE pollo 40$/.test(r)));
  ok('una riga senza numeri passa senza quantità', testo.some((r) => r === 'Pannocchie'));
  ok('"scamorze" non ricompare: era già in lista', !testo.some((r) => /scamorze/i.test(r)));
  ok('e lo dice', /era già in lista/i.test(await finestra.innerText()));

  // Finché non si conferma, la lista non si muove.
  ok('prima di confermare la lista è ancora quella di prima', (await inLista(p)).length === 1);

  // Si toglie la spunta a quello che non è cibo da comprare.
  const pasta = finestra.locator('li', { hasText: 'Pasta funghi e piselli' }).locator('input[type=checkbox]');
  await pasta.click();
  await p.waitForTimeout(200);
  ok('il contatore del tasto segue le spunte: ' + (await finestra.locator('button', { hasText: /aggiungi/i }).innerText()).trim(),
    /aggiungi \(4\)/i.test(await finestra.locator('button', { hasText: /aggiungi/i }).innerText()));

  await finestra.locator('button', { hasText: /aggiungi/i }).click();
  await p.waitForTimeout(500);

  const dopo = await inLista(p);
  ok(`aggiunge solo le spuntate: 1 + 4 = ${dopo.length}`, dopo.length === 5);
  const arr = dopo.find((x) => x.name === 'arrosticini');
  ok('nome e quantità arrivano separati: ' + JSON.stringify(arr), !!arr && arr.qty === '150');
  ok('quella deselezionata non è entrata', !dopo.some((x) => /Pasta funghi/.test(x.name)));

  // Ripremendo non raddoppia: le quattro appena aggiunte non ricompaiono, e
  // ricompare SOLO quella che avevo deselezionato — cioè il doppione si
  // riconosce dal contenuto della lista, non dal fatto che il tasto sia già
  // stato premuto.
  await tasto.first().click();
  await p.waitForTimeout(400);
  const seconda = p.locator('div.fixed', { hasText: 'Dal menù alla spesa' });
  const righe2 = (await seconda.locator('ul li').allInnerTexts()).map((r) => r.replace(/\s+/g, ' ').trim());
  ok(`ripremendo ripropone solo quella scartata (${righe2.join(' / ')})`,
    righe2.length === 1 && /Pasta funghi/.test(righe2[0]));
  // Cinque scartate, non quattro: le quattro appena aggiunte piu' "scamorze"
  // che c'era dall'inizio. Il menu' ha sei righe in tutto.
  ok('e dice quante erano già in lista', /5 erano già in lista/i.test(await seconda.innerText()));
  await seconda.locator('button', { hasText: /annulla/i }).click();
  await p.waitForTimeout(300);
  ok('annullando la lista non cambia', (await inLista(p)).length === 5);

  // Menù vuoto: lo dice invece di aprire una finestra vuota. Si cambia giorno
  // invece di ricaricare, perché addInitScript risemina a ogni caricamento e
  // il menù tornerebbe da solo.
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('.grid.grid-cols-7 button')].find((x) => x.textContent.includes('15'));
    if (b) b.click();
  });
  await p.waitForTimeout(400);
  await p.locator('main button', { hasText: /Porta nella lista della spesa/ }).first().click();
  await p.waitForTimeout(400);
  ok('su un giorno senza menù non apre nessuna finestra',
    (await p.locator('div.fixed', { hasText: 'Dal menù alla spesa' }).count()) === 0);
  ok('e non ha toccato la lista', (await inLista(p)).length === 5);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
