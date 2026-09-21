const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  await p.addInitScript((h) => localStorage.setItem('cambusa_unlock', h), require('../lib/app').SBLOCCO);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('cambusa_install_hint_off', '1'));
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await p.click('button[aria-label="Menu"]');
  await p.waitForTimeout(300);
  await p.locator('nav button', { hasText: 'Regole' }).first().click();
  await p.waitForTimeout(400);
  const n = await p.locator('ol li').count();
  const stile = await p.evaluate(() => {
    const el = document.querySelector('ol li p');
    const s = getComputedStyle(el);
    return { maiuscolo: s.textTransform, sottolineato: s.textDecorationLine, reso: el.innerText.slice(0, 40) };
  });
  console.log('regole mostrate:', n);
  console.log('maiuscolo:', stile.maiuscolo, '| sottolineato:', stile.sottolineato);
  console.log('prima riga a schermo:', stile.reso);
  console.log('work in progress sparito:', !(await p.locator('body').innerText()).includes('Work in progress'));
  console.log('nessuno sbordamento:', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-regole.png'), fullPage: true });
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
