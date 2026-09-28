const { chromium } = require('playwright-core');
const { scontriniSalvati, fotoSalvate } = require('../lib/app');

(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, acceptDownloads: true });
  const p = await ctx.newPage();
  // Sbloccata e in modalità tecnica: chiudere il campo azzera tutto, giorni
  // bloccati compresi, ed è un gesto che fa solo chi tiene i conti.
  await p.addInitScript((h) => {
    localStorage.setItem('cambusa_unlock', h);
    localStorage.setItem('cambusa_admin', '1');
  }, require('../lib/app').SBLOCCO);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());

  const menu = async (voce) => {
    await p.click('button[aria-label="Menu"]');
    await p.waitForTimeout(300);
    await p.locator('nav button', { hasText: voce }).first().click();
    await p.waitForTimeout(300);
  };

  await p.addInitScript(...require('../lib/app').campoDiProva());
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });

  console.log('modulo di fusione caricato:', await p.evaluate(() => !!(window.SyncMerge && window.SyncMerge.merge)));

  // --- Dati di prova ---
  await menu('Membri');
  for (const n of ['Lorenzo', 'Bruno', 'Anna']) {
    await p.fill('input[placeholder="Nome e cognome"]', n);
    await p.locator('button', { hasText: /^\+$/ }).first().click();
    await p.waitForTimeout(120);
  }
  const nMembri = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]').length);

  await menu('Presenze');
  // "Segna in blocco" ora è una riga richiudibile: va aperta prima.
  { const b = p.locator('button', { hasText: 'Segna in blocco' }); if (await b.count()) { await b.first().click(); await p.waitForTimeout(300); } }
  const tutti = p.locator('button', { hasText: 'Tutti a pranzo' });
  if (await tutti.count()) { await tutti.first().click(); await p.waitForTimeout(200); }
  const cena = p.locator('button', { hasText: 'Tutti a cena' });
  if (await cena.count()) { await cena.first().click(); await p.waitForTimeout(200); }

  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  { const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' }); if (await b.count()) { await b.first().click(); await p.waitForTimeout(350); } }
  await p.waitForTimeout(200);
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Pasta');
  await p.locator('input[placeholder="0.00"]').first().fill('30');
  const acq = p.locator('input[placeholder="Chi ha acquistato"]');
  if (await acq.count()) await acq.first().fill('Lorenzo');
  await p.locator('button', { hasText: /Salva/ }).first().click();
  await p.waitForTimeout(300);

  const nSpese = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases') || '[]').length);

  await menu('Attrezzatura');
  await p.fill('input[placeholder="Es. Corda, gazebo, tanica…"]', 'Gazebo');
  await p.locator('input[placeholder="Prezzo (€)"]').first().fill('40');
  await p.locator('button', { hasText: 'Aggiungi' }).first().click();
  await p.waitForTimeout(250);

  // --- La cronologia delle modifiche viene davvero scritta ---
  const meta = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_syncmeta') || 'null'));
  const nRev = meta && meta.rev ? Object.keys(meta.rev).length : 0;
  console.log('membri:', nMembri, '| spese:', nSpese, '| voci datate per la fusione:', nRev);

  // --- Totali prima della chiusura ---
  await menu('Spese Totali');
  const totale = (await p.locator('body').innerText()).match(/(\d+[.,]\d\d)\s*€/);
  console.log('totale visibile in Spese Totali:', totale ? totale[1] : 'n/d');

  // --- Chiusura del campo ---
  await p.locator('button', { hasText: 'Dati' }).first().click();
  await p.waitForTimeout(250);
  const bottone = p.locator('button', { hasText: 'Chiudi il campo e archivia' });
  console.log('bottone di chiusura presente:', (await bottone.count()) > 0);
  await bottone.first().click();
  await p.waitForTimeout(300);
  await p.fill('input[placeholder="Es. Prato Lungo 2026"]', 'Prato Lungo 2026');

  const [download] = await Promise.all([
    p.waitForEvent('download', { timeout: 10000 }).catch(() => null),
    p.locator('button', { hasText: 'Archivia e azzera' }).first().click(),
  ]);
  await p.waitForTimeout(800);

  console.log('file di salvataggio scaricato:', download ? download.suggestedFilename() : 'NO');
  if (download) {
    const fs = require('fs');
    const path = await download.path();
    const j = JSON.parse(fs.readFileSync(path, 'utf8'));
    console.log('  contenuto file -> membri:', (j.members || []).length, '| spese:', (j.purchases || []).length,
      '| attrezzatura:', (j.equipment || []).length, '| resoconto:', !!(j.archive && j.archive.report));
  }

  // --- Tutto azzerato? ---
  const dopo = await p.evaluate(() => ({
    members: JSON.parse(localStorage.getItem('cambusa_members') || '[]').length,
    purchases: JSON.parse(localStorage.getItem('cambusa_purchases') || '[]').length,
    toBuy: JSON.parse(localStorage.getItem('cambusa_tobuy') || '[]').length,
    equipment: JSON.parse(localStorage.getItem('cambusa_equipment') || '[]').length,
    gear: JSON.parse(localStorage.getItem('cambusa_gear') || '[]').length,
    settled: JSON.parse(localStorage.getItem('cambusa_settled') || '[]').length,
    campData: Object.keys(JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}')).length,
    archivi: JSON.parse(localStorage.getItem('cambusa_archives') || '[]').length,
    lapidi: Object.keys((JSON.parse(localStorage.getItem('cambusa_syncmeta') || '{}').del) || {}).length,
  }));
  dopo.receipts = (await fotoSalvate(p)).length;
  console.log('dopo la chiusura ->', JSON.stringify(dopo));
  const azzerato = ['members', 'purchases', 'toBuy', 'equipment', 'gear', 'settled', 'receipts'].every((k) => dopo[k] === 0);
  console.log('tutte le liste azzerate:', azzerato, '| archivi salvati:', dopo.archivi, '| cancellazioni datate:', dopo.lapidi);

  // --- Archivio consultabile ---
  const testoArchivio = await p.locator('body').innerText();
  console.log('si apre su Archivio:', testoArchivio.includes('Prato Lungo 2026'));
  await p.locator('button', { hasText: 'Resoconto' }).first().click();
  await p.waitForTimeout(300);
  const resoconto = await p.locator('pre').innerText().catch(() => '');
  console.log('resoconto salvato:', resoconto.split('\n')[0] || 'VUOTO', '|', resoconto.includes('Totale spese') ? 'con i totali' : 'SENZA totali');
  await p.locator('button', { hasText: 'Chiudi' }).last().click();
  await p.waitForTimeout(200);

  // --- I totali ripartono da zero ---
  await menu('Spese Totali');
  await p.getByRole('button', { name: 'Totali', exact: true }).first().click();
  await p.waitForTimeout(300);
  const dopoTot = await p.locator('body').innerText();
  console.log('totali ripartiti da zero:', /0[.,]00\s*€/.test(dopoTot) && !/30[.,]00/.test(dopoTot));

  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','archivio.png') });
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
