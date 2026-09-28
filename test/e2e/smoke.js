const { campoDiProva } = require('../lib/app');
const { chromium } = require('playwright-core');
// L'impronta del blocco si LEGGE da firebase-config.js (test/lib/app.js).
// Ricopiata qui, il giorno in cui cambia la password del campo questa prova
// diventa rossa per un motivo che non c'entra niente con quello che prova —
// e' successo davvero, a diciannove prove insieme.
const H = require('../lib/app').SBLOCCO;
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 820 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript((h) => localStorage.setItem('cambusa_unlock', h), H);
  await p.addInitScript(...campoDiProva());
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await p.waitForTimeout(3000);
  const stato = await p.evaluate(() => ({
    connesso: window.CloudSync.isConnected(),
    modo: window.CloudSync.authMode ? window.CloudSync.authMode() : 'n/d',
    servePassword: window.CloudSync.needsPassword ? window.CloudSync.needsPassword() : 'n/d',
    apiMeteo: typeof window.CloudSync.putWeather === 'function' && typeof window.CloudSync.onWeather === 'function',
  }));
  console.log('con Firebase irraggiungibile (sandbox senza rete):', JSON.stringify(stato));
  console.log('app comunque utilizzabile:', (await p.locator('button[aria-label="Menu"]').count()) > 0 ? 'OK' : 'PROBLEMA');
  console.log('errori JS:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
