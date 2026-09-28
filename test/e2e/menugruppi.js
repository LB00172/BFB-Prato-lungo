const { campoDiProva } = require('../lib/app');
const { chromium } = require('playwright-core');
// L'impronta del blocco si LEGGE da firebase-config.js (test/lib/app.js).
// Ricopiata qui, il giorno in cui cambia la password del campo questa prova
// diventa rossa per un motivo che non c'entra niente con quello che prova —
// e' successo davvero, a diciannove prove insieme.
const H = require('../lib/app').SBLOCCO;
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 780 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript((h) => {
    localStorage.setItem('cambusa_unlock', h);
    localStorage.setItem('cambusa_sync_optout', '1');
    localStorage.setItem('cambusa_install_hint_off', '1');
  }, H);
  await p.addInitScript(...campoDiProva());
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await p.click('button[aria-label="Menu"]');
  await p.waitForTimeout(450);

  const voci = await p.evaluate(() => Array.from(document.querySelectorAll('nav button')).map(b => b.innerText.trim()));
  console.log('voci:', voci.length, JSON.stringify(voci));
  const gruppi = await p.evaluate(() => Array.from(document.querySelectorAll('nav > div > div > span:first-child')).map(s => s.innerText.trim()).filter(Boolean));
  console.log('gruppi:', JSON.stringify(gruppi));

  // tutte le 13 aree devono restare raggiungibili
  const attese = ['CALENDARIO','MENÙ','PRESENZE','LISTA DELLA SPESA','ATTREZZATURA','SPESE TOTALI','MEMBRI','REGOLE','DOTAZIONI PERSONALI','AIUTA BANDY','ARCHIVIO','COME FUNZIONA','IMPOSTAZIONI'];
  const mancanti = attese.filter(a => !voci.some(v => v.indexOf(a) >= 0));
  console.log('aree mancanti:', mancanti.length ? JSON.stringify(mancanti) : 'nessuna -> OK');

  // il menu deve essere scorribile e non tagliare l'ultima voce
  const misure = await p.evaluate(() => {
    const nav = document.querySelector('nav');
    const ultimo = nav.querySelectorAll('button');
    const last = ultimo[ultimo.length - 1];
    nav.scrollTop = nav.scrollHeight;
    const r = last.getBoundingClientRect();
    const nr = nav.getBoundingClientRect();
    return { scorrevole: nav.scrollHeight > nav.clientHeight, ultimaVisibile: r.bottom <= nr.bottom + 1, altezzaNav: Math.round(nr.height), contenuto: nav.scrollHeight };
  });
  console.log('menu scorrevole:', misure.scorrevole, '| ultima voce raggiungibile:', misure.ultimaVisibile ? 'OK' : 'PROBLEMA');

  // una voce di ogni gruppo deve funzionare
  for (const [voce, atteso] of [['Menù', 'MENÙ'], ['Spese Totali', 'SPESE TOTALI'], ['Regole', 'REGOLE'], ['Impostazioni', 'IMPOSTAZIONI']]) {
    await p.locator('nav button', { hasText: voce }).first().click();
    await p.waitForTimeout(280);
    const sotto = await p.locator('header p').innerText();
    if (sotto.trim() !== atteso) console.log('PROBLEMA:', voce, '->', sotto);
    await p.click('button[aria-label="Menu"]');
    await p.waitForTimeout(350);
  }
  console.log('navigazione dai gruppi: OK');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-menu-gruppi.png') });
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
