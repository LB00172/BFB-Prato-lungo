// PayPal/IBAN per membro: inserimento, controllo IBAN, comparsa nei Saldi.
const { chromium } = require('playwright-core');

(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 840 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  await p.addInitScript(() => localStorage.setItem('cambusa_unlock', '432631a6d9164150bff2cef2afebf83fc36f43fe04c658bac55ec89dbeda8a14'));
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());

  const menu = async (voce) => {
    await p.click('button[aria-label="Menu"]');
    await p.waitForTimeout(250);
    await p.locator('nav button', { hasText: voce }).first().click();
    await p.waitForTimeout(250);
  };
  const ok = (t, c) => console.log((c ? 'OK   ' : 'KO   ') + t);

  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });

  // --- Membri ---
  await menu('Membri');
  for (const n of ['Lorenzo', 'Bruno', 'Anna']) {
    await p.fill('input[placeholder="Nome e cognome"]', n);
    await p.locator('button', { hasText: /^\+$/ }).first().click();
    await p.waitForTimeout(150);
  }

  const iLorenzo = p.locator('button[aria-label="Dati di pagamento di Lorenzo"]');
  ok('la "i" compare accanto a ogni membro', (await p.locator('button[aria-label^="Dati di pagamento"]').count()) === 3);

  await iLorenzo.click();
  await p.waitForTimeout(250);
  ok('si aprono i due campi PayPal e IBAN',
    (await p.locator('input[placeholder="paypal.me/nome oppure email"]').count()) === 1 &&
    (await p.locator('input[placeholder="IT00 X000 0000 0000 0000 0000 000"]').count()) === 1);

  await p.fill('input[placeholder="paypal.me/nome oppure email"]', 'paypal.me/lorenzoballerini');
  const ib = p.locator('input[placeholder="IT00 X000 0000 0000 0000 0000 000"]');

  // IBAN sbagliato -> avviso
  await ib.fill('IT60X0542811101000000123457');
  await p.waitForTimeout(200);
  ok('IBAN sbagliato segnalato', (await p.locator('text=Controlla').count()) > 0);

  // IBAN corretto -> spunta, e alla perdita del fuoco viene formattato
  await ib.fill('it60x0542811101000000123456');
  await p.waitForTimeout(200);
  ok('IBAN corretto accettato', (await p.locator('text=IBAN formalmente corretto').count()) > 0);
  await p.locator('input[placeholder="Nome e cognome"]').click();
  await p.waitForTimeout(250);
  const salvato = await ib.inputValue();
  ok('IBAN formattato a gruppi di 4: ' + salvato, salvato === 'IT60 X054 2811 1010 0000 0123 456');

  // --- Persistenza + ricarica ---
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','membri.png'), fullPage: true });
  const dbg = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]').find((m) => m.name === 'Lorenzo'));
  ok('salvato in locale', dbg && dbg.paypal === 'paypal.me/lorenzoballerini' && /^IT60 X054/.test(dbg.iban || ''));

  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await menu('Membri');
  ok('il segnalino 💳 compare sul membro con i dati', (await p.locator('li:has-text("Lorenzo") >> text=💳').count()) > 0);

  // --- Presenze + spesa anticipata da Lorenzo, così Bruno e Anna gli devono dare ---
  await menu('Presenze');
  await p.locator('button', { hasText: 'Tutti a pranzo' }).first().click();
  await p.waitForTimeout(300);

  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  { const m = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' }); if (await m.count()) { await m.first().click(); await p.waitForTimeout(350); } }
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Pasta');
  await p.locator('input[placeholder="0.00"]').first().fill('30');
  await p.locator('select').filter({ has: p.locator('option', { hasText: 'Lorenzo' }) }).first().selectOption({ label: 'Lorenzo' });
  await p.locator('button', { hasText: /Salva/ }).first().click();
  await p.waitForTimeout(400);

  // --- Saldi ---
  await menu('Spese Totali');
  await p.getByRole('button', { name: 'Saldi', exact: true }).first().click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','saldi.png'), fullPage: true });
  const testo = await p.locator('body').innerText();
  ok('i dati di Lorenzo compaiono in "chi paga chi"',
    testo.includes('paypal.me/lorenzoballerini') && testo.includes('IT60 X054 2811 1010 0000 0123 456'));
  ok('avviso per chi riceve senza dati NON compare (riceve solo Lorenzo)', !/non .*inserito\s*PayPal/.test(testo.replace(/\n/g, ' ')));

  // copia
  const copia = p.locator('button', { hasText: /^copia$/i }).first();
  await copia.click();
  await p.waitForTimeout(400);
  const app = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok('il tasto copia mette il dato negli appunti: ' + app, app.includes('paypal.me/lorenzoballerini'));
  const settledDopo = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_settled') || '[]').length);
  ok('copiare NON segna il rimborso come saldato', settledDopo === 0);

  // segnare saldato nasconde i dati (solo su quella riga: le altre restano)
  const righe = p.locator('li', { hasText: '→' });
  const nRighe = await righe.count();
  await righe.first().click();
  await p.waitForTimeout(350);
  const rigaSaldata = await righe.first().innerText();
  ok('a rimborso saldato i dati spariscono da quella riga (' + nRighe + ' passaggi in tutto)',
    !rigaSaldata.includes('paypal.me/lorenzoballerini') && rigaSaldata.includes('✓'));

  // --- Chi riceve senza dati ---
  await righe.first().click();
  await p.waitForTimeout(250);
  await menu('Membri');
  await p.locator('button[aria-label="Dati di pagamento di Lorenzo"]').click();
  await p.waitForTimeout(200);
  await p.fill('input[placeholder="paypal.me/nome oppure email"]', '');
  await p.locator('input[placeholder="IT00 X000 0000 0000 0000 0000 000"]').fill('');
  await p.waitForTimeout(250);
  await menu('Spese Totali');
  await p.getByRole('button', { name: 'Saldi', exact: true }).first().click();
  await p.waitForTimeout(400);
  const testo3 = (await p.locator('body').innerText()).replace(/\n/g, ' ');
  ok('avviso per chi deve ricevere senza PayPal/IBAN', /Lorenzo deve ricevere ma non ha inserito/.test(testo3));

  // --- La fusione fra telefoni conserva i nuovi campi ---
  const fusione = await p.evaluate(() => {
    const SM = window.SyncMerge;
    const A = { members: [{ id: 'x1', name: 'Lorenzo', isChild: false, iban: 'IT60 X054' }], campData: {}, purchases: [], toBuy: [], equipment: [], gear: [], settled: [], sepDays: [] };
    const B = { members: [{ id: 'x1', name: 'Lorenzo', isChild: false }], campData: {}, purchases: [], toBuy: [], equipment: [], gear: [], settled: [], sepDays: [] };
    const r = SM.merge(A, { flat: SM.flatten(A), rev: { 'm|x1': 2000 }, del: {} }, B, { flat: SM.flatten(B), rev: { 'm|x1': 1000 }, del: {} });
    return r.state.members[0].iban || '';
  });
  ok('la fusione fra telefoni porta con sé l\'IBAN', fusione === 'IT60 X054');

  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','pagamenti.png'), fullPage: true });
  console.log('errori JS:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
