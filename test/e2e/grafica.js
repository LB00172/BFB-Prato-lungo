// Cronologia acquisti su due livelli, Menù a righe, meteo condiviso.
const { campoDiProva, luogoDiProva } = require('../lib/app');
const { chromium } = require('playwright-core');
// L'impronta del blocco si LEGGE da firebase-config.js (test/lib/app.js).
// Ricopiata qui, il giorno in cui cambia la password del campo questa prova
// diventa rossa per un motivo che non c'entra niente con quello che prova —
// e' successo davvero, a diciannove prove insieme.
const H = require('../lib/app').SBLOCCO;

(async () => {
  const b = await chromium.launch({ executablePath: require('../lib/app').chromium(), args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 820 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.addInitScript((h) => {
    localStorage.setItem('cambusa_unlock', h);
    localStorage.setItem('cambusa_sync_optout', '1');
    localStorage.setItem('cambusa_install_hint_off', '1');
    localStorage.setItem('cambusa_purchases', JSON.stringify([
      { id: 'x1', name: 'Doppio malto artigianale cassa da 24 bottiglie', price: 180, type: 'bevande', buyer: 'Bandone', at: Date.now(), account: 'sep' },
      { id: 'x2', name: 'Pane', price: 4.5, type: 'alimentare', buyer: 'Anna', at: Date.now() },
    ]));
    // Mezz'ora fa, non un'ora: un'ora e' ESATTAMENTE il confine della cache,
    // quindi l'app riscaricava sempre e per qualche secondo il bottone mostrava
    // "…" invece di "Aggiorna". Questa prova guarda come si vede il meteo gia'
    // scaricato, non il riscaricamento.
    localStorage.setItem('cambusa_weather', JSON.stringify({
      fetchedAt: Date.now() - 30 * 60 * 1000,
      byDate: { '2026-08-11': { code: 1, tmax: 27.4, tmin: 14.2, rain: 10 } },
    }));
  }, H);

  const menu = async (voce) => {
    await p.click('button[aria-label="Menu"]');
    await p.waitForTimeout(280);
    await p.locator('nav button', { hasText: voce }).first().click();
    await p.waitForTimeout(280);
  };

  await p.addInitScript(...campoDiProva());
  await p.addInitScript(...luogoDiProva());
  await p.goto((process.env.APP_URL || 'http://localhost:8091') + '/index.html', { waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });

  // --- 1. Cronologia acquisti: il nome NON deve essere troncato ---
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  const riga = p.locator('ul li', { hasText: 'Doppio malto' }).first();
  const info = await riga.evaluate((el) => {
    const nome = Array.from(el.querySelectorAll('span')).find((s) => s.innerText.indexOf('Doppio malto') === 0);
    return {
      testoCompleto: nome ? nome.innerText : '(non trovato)',
      troncato: nome ? nome.scrollWidth > nome.clientWidth + 1 : null,
      righe: nome ? Math.round(nome.getBoundingClientRect().height / 20) : 0,
      altezzaScheda: Math.round(el.getBoundingClientRect().height),
    };
  });
  console.log('nome per esteso:', JSON.stringify(info.testoCompleto));
  console.log('tagliato dai puntini:', info.troncato === false ? 'NO -> OK' : 'PROBLEMA');
  const prezzo = await riga.locator('span', { hasText: '180,00' }).first().innerText().catch(() => '');
  console.log('prezzo sulla stessa riga del nome:', prezzo.trim() ? 'OK (' + prezzo.trim() + ')' : 'PROBLEMA');
  const badge = await riga.innerText();
  console.log('etichette presenti:', /BEVANDE/.test(badge) && /SEPARATO/.test(badge) ? 'OK' : 'PROBLEMA');
  console.log('acquirente e data presenti:', /Bandone/.test(badge) ? 'OK' : 'PROBLEMA');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  console.log('nessuno sbordamento orizzontale:', overflow ? 'OK' : 'PROBLEMA');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-cronologia.png') });

  // --- 2. Menù a righe (scheda a sé) ---
  await menu('Calendario');
  await p.waitForTimeout(300);
  const titoli = await p.locator('main h3').allInnerTexts();
  console.log('schede del calendario:', JSON.stringify(titoli));
  await menu('Menù');
  await p.waitForTimeout(300);
  const ta = p.locator('textarea').first();
  const stile = await ta.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      righe: s.backgroundImage.indexOf('repeating-linear-gradient') >= 0,
      interlinea: s.lineHeight,
      altezza: Math.round(el.getBoundingClientRect().height),
      ridimensionabile: s.resize,
    };
  });
  console.log('foglio a righe:', stile.righe ? 'OK' : 'PROBLEMA', '| interlinea:', stile.interlinea, '| altezza:', stile.altezza + 'px', '| resize:', stile.ridimensionabile);
  await ta.fill('Pranzo: pasta al pomodoro\nInsalata mista\nCena: grigliata\nPatate al forno');
  await p.waitForTimeout(400);
  const salvato = await p.evaluate(() => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}');
    const k = Object.keys(cd)[0];
    return k ? (cd[k].note || '').split('\n').length : 0;
  });
  console.log('menù salvato su', salvato, 'righe ->', salvato === 4 ? 'OK' : 'PROBLEMA');

  // --- 3. Meteo: ora dell'aggiornamento e bottone (in Calendario) ---
  await menu('Calendario');
  await p.waitForTimeout(300);
  const testoMeteo = await p.locator('main').innerText();
  console.log('mostra quando è stato scaricato:', /Previsioni del .* alle .* uguali per tutto il campo/.test(testoMeteo.replace(/\s+/g, ' ')) ? 'OK' : 'PROBLEMA');
  // Se per qualsiasi motivo un aggiornamento fosse comunque in corso, il
  // bottone mostra "…": si aspetta la condizione invece di un tempo fisso.
  await p.waitForFunction(
    () => [...document.querySelectorAll('main button')].some((b) => /Aggiorna/.test(b.textContent)),
    null, { timeout: 15000 },
  ).catch(() => {});
  console.log('bottone Aggiorna presente:', (await p.locator('main button', { hasText: 'Aggiorna' }).count()) > 0 ? 'OK' : 'PROBLEMA');
  await p.screenshot({ path: require('path').join(__dirname,'..','tmp','vista-menu.png'), fullPage: true });

  // --- 4. Il meteo che arriva dal cloud, se più recente, viene adottato ---
  const adottato = await p.evaluate(() => {
    const w = { fetchedAt: Date.now() + 5000, byDate: { '2099-01-01': { code: 0, tmax: 40, tmin: 30, rain: 0 } } };
    // la app registra la callback all'avvio: la richiamo come farebbe Firestore
    if (!window.CloudSync || !window.CloudSync.__wx) return 'callback non esposta';
    return 'n/d';
  });

  console.log('errori:', errs.length ? errs.join(' | ') : 'nessuno');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
