// Il telefono già sbloccato, che si aggancia col ripiego, deve vedersi
// chiedere la password DA SOLO: nessun menu, nessun pulsante da cercare.
const { chromium } = require('playwright-core');
// Il blocco di prova: la password vera del campo non entra nel repository
// (CLAUDE.md, regola 3). Qui se ne installa una che non apre niente.
const { bloccoDiProva, PASSWORD_PROVA, BLOCCO_PROVA } = require('../lib/app');
// Il telefono "gia' sbloccato da prima": l'impronta che si mette in
// localStorage dev'essere quella del blocco INSTALLATO qui, non un'altra
// ricopiata a mano — se le due non combaciano, l'app si crede bloccata e
// questa prova verifica un caso diverso da quello che dice di verificare.
const H = BLOCCO_PROVA.hash;
(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 820 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.addInitScript(...bloccoDiProva());
  await p.addInitScript((h) => {
    localStorage.setItem('cambusa_unlock', h);            // già sbloccato da prima
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
            const conPwd = !!(creds && creds.password);
            window.__log.push('connect:' + (conPwd ? 'con password' : 'senza password'));
            // senza password si entra col ripiego, come farebbe Firebase
            window.__modo = conPwd ? 'shared' : 'anon-nopass';
            if (window.__status) window.__status({ connected: true, status: 'connected', code, authMode: window.__modo });
            return Promise.resolve();
          },
          disconnect: () => { window.__conn = false; window.__log.push('disconnect'); if (window.__status) window.__status({ connected: false, status: 'idle', authMode: window.__modo }); },
          onStatus: (cb) => { window.__status = cb; cb({ connected: false, status: 'idle', authMode: 'anon' }); },
          onReceipts: () => {}, onWeather: () => {},
          pushState: () => {}, putReceipt: () => {}, deleteReceipt: () => {}, putWeather: () => {},
          listArchives: () => Promise.resolve([]), listSnapshots: () => Promise.resolve([]), listScores: () => Promise.resolve([]),
          needsPassword: () => window.__modo === 'anon-nopass', authMode: () => window.__modo || 'anon',
        });
      },
    });
  }, H);

  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(3000);

  const chiede = await p.locator('input[placeholder="••••••••"]').count();
  console.log('l\'app chiede la password da sola:', chiede > 0 ? 'OK' : 'PROBLEMA');
  const testo = await p.locator('body').innerText();
  console.log('spiega perché:', /serve di nuovo la password del campo/i.test(testo) ? 'OK' : 'PROBLEMA');
  console.log('  messaggio:', (testo.match(/Per sincronizzare[^\n]*/) || ['(nessuno)'])[0]);
  console.log('sequenza finora:', JSON.stringify(await p.evaluate(() => window.__log)));

  // Digito la password: deve riagganciarsi con l'utente condiviso
  await p.fill('input[placeholder="••••••••"]', PASSWORD_PROVA);
  await p.locator('button', { hasText: /Entra|Verifica/ }).first().click();
  await p.waitForTimeout(1200);
  const log = await p.evaluate(() => window.__log);
  console.log('sequenza completa:', JSON.stringify(log));
  console.log('riagganciato con la password:', log[log.length - 1] === 'connect:con password' ? 'OK' : 'PROBLEMA');
  const modo = await p.evaluate(() => window.__modo);
  console.log('modo di accesso finale:', modo, '->', modo === 'shared' ? 'OK (utente del campo)' : 'PROBLEMA');

  // Non deve richiederla di nuovo a raffica
  await p.waitForTimeout(2500);
  console.log('non richiede la password in continuazione:', (await p.locator('input[placeholder="••••••••"]').count()) === 0 ? 'OK' : 'PROBLEMA');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-richiesta.png') });
  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
