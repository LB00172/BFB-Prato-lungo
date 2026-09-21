// Dopo "Blocca ora" e rientro, l'app deve riagganciarsi al database
// passando la password appena digitata (serve per l'utente condiviso).
const { chromium } = require('playwright-core');
// Il blocco di prova: la password vera del campo non entra nel repository
// (CLAUDE.md, regola 3). Qui se ne installa una che non apre niente.
const { bloccoDiProva, PASSWORD_PROVA } = require('../lib/app');
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 820 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.addInitScript(...bloccoDiProva());
  await p.addInitScript(() => {
    localStorage.setItem('cambusa_install_hint_off', '1');
    window.__log = [];
    Object.defineProperty(window, 'CloudSync', {
      configurable: true,
      get() { return window.__cs; },
      set(v) {
        window.__cs = Object.assign({}, v, {
          isConfigured: () => true,
          isConnected: () => !!window.__conn,
          savedCode: () => 'TEST',
          connect: (cfg, code, cb, creds) => {
            window.__conn = true;
            window.__log.push('connect:' + (creds && creds.password ? 'con password' : 'SENZA password'));
            if (window.__status) window.__status({ connected: true, status: 'connected', code, authMode: 'shared' });
            return Promise.resolve();
          },
          disconnect: () => { window.__conn = false; window.__log.push('disconnect'); if (window.__status) window.__status({ connected: false, status: 'idle' }); },
          onStatus: (cb) => { window.__status = cb; cb({ connected: false, status: 'idle' }); },
          onReceipts: () => {}, onWeather: () => {},
          pushState: () => {}, putReceipt: () => {}, deleteReceipt: () => {}, putWeather: () => {},
          listArchives: () => Promise.resolve([]), listSnapshots: () => Promise.resolve([]), listScores: () => Promise.resolve([]),
          needsPassword: () => false, authMode: () => 'shared',
        });
      },
    });
  });
  const entra = async () => {
    await p.fill('input[placeholder="••••••••"]', PASSWORD_PROVA);
    await p.locator('button', { hasText: /Entra|Verifica/ }).first().click();
    await p.waitForTimeout(900);
  };
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(500);
  console.log('prima dello sblocco:', JSON.stringify(await p.evaluate(() => window.__log)), '-> non deve connettersi');
  await entra();
  await p.waitForTimeout(2600);
  console.log('dopo lo sblocco:', JSON.stringify(await p.evaluate(() => window.__log)));

  // Blocca ora -> rientra
  await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(300);
  await p.locator('nav button', { hasText: 'Impostazioni' }).first().click(); await p.waitForTimeout(300);
  // "Blocco con password" ora è una riga richiudibile, chiusa di suo.
  await p.locator('button', { hasText: 'Blocco con password' }).first().click(); await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'Blocca ora' }).first().click();
  await p.waitForTimeout(600);
  await entra();
  await p.waitForTimeout(600);
  const log = await p.evaluate(() => window.__log);
  console.log('sequenza completa:', JSON.stringify(log));
  const ok = log.filter(x => x.indexOf('connect:') === 0).every(x => x === 'connect:con password')
    && log.includes('disconnect')
    && log.filter(x => x.indexOf('connect:') === 0).length === 2;
  console.log('riaggancio con la password dopo il rientro:', ok ? 'OK' : 'PROBLEMA');
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
