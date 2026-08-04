// Tenuta della sincronizzazione nei casi che non si vedono: scrittura fallita,
// campo vuoto nel cloud, memoria piena. Sono i modi in cui i dati restano
// fermi su un telefono senza che nessuno se ne accorga.
const { apri, ok, fine } = require('../lib/app');

// Cloud finto pilotabile: si può far fallire la scrittura a comando e si può
// dire che nel cloud non c'è ancora niente.
function cloudFinto(opz) {
  // Dati già presenti sul telefono PRIMA dell'aggancio: è il caso vero, cioè
  // l'app che si connette avendo già lavorato.
  if (opz.semina) localStorage.setItem('cambusa_members', JSON.stringify(opz.semina));
  Object.defineProperty(window, 'CloudSync', {
    configurable: true,
    get() { return window.__cs; },
    set(v) {
      window.__scritture = [];
      window.__falliscono = !!opz.falliscono;
      window.__vuoto = !!opz.vuoto;
      // Come il modulo vero: "vuoto" cambia SOLO quando arriva una fotografia
      // dal cloud, non a ogni scrittura.
      window.__emit = (patch) => {
        if (window.__status) window.__status(Object.assign({ connected: true, code: 'TEST', empty: window.__vuoto, pending: !!window.__inSospeso }, patch));
      };
      window.__cs = Object.assign({}, v, {
        isConfigured: () => true,
        isConnected: () => !!window.__connesso,
        savedCode: () => 'TEST',
        connect: (cfg, code, cb) => {
          window.__remoteCb = cb;
          window.__connesso = true;
          // Come il vero onSnapshot: dice anche se il documento non esiste.
          window.__emit({ status: 'connected' });
          return Promise.resolve();
        },
        onStatus: (cb) => { window.__status = cb; cb({ connected: false, status: 'idle', code: 'TEST', empty: false, pending: false }); },
        onReceipts: () => {}, onWeather: () => {},
        pushState: (obj, forza) => {
          if (window.__falliscono) {
            window.__inSospeso = true;
            window.__emit({ status: 'error', error: 'finto guasto' });
            return;
          }
          window.__inSospeso = false;
          window.__scritture.push({ at: Date.now(), forza: !!forza, stato: JSON.parse(JSON.stringify(obj)) });
          window.__vuoto = false;   // ora nel cloud c'è qualcosa
          window.__emit({ status: 'connected' });
        },
        riprova: () => { if (window.__inSospeso && !window.__falliscono) { window.__cs.pushState(window.__ultimo || {}, true); return true; } return false; },
        inSospeso: () => !!window.__inSospeso,
        putReceipt: () => {}, deleteReceipt: () => {},
        putArchive: () => Promise.resolve(true), listArchives: () => Promise.resolve([]),
        listSnapshots: () => Promise.resolve([]), listScores: () => Promise.resolve([]),
        submitScore: () => Promise.resolve(),
        watchPhotos: () => () => {}, listPhotos: () => Promise.resolve([]),
        archivePhotos: () => Promise.resolve(0), putPhoto: () => Promise.resolve(true),
        getPhotoFull: () => Promise.resolve(null), deletePhoto: () => Promise.resolve(true),
      });
    },
  });
}

const aggiungiMembro = async (p, nome) => {
  await p.fill('input[placeholder="Nome e cognome"]', nome);
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(250);
};

(async () => {
  // ---- 1) Campo vuoto nel cloud: chi ha dei dati li pubblica ----
  {
    const semina = [{ id: 'm1', name: 'Lorenzo', isChild: false }, { id: 'm2', name: 'Bruno', isChild: false }];
    const { browser, page: p } = await apri({ initScript: [cloudFinto, { vuoto: true, semina }] });
    await p.waitForTimeout(1200);
    const scritture = await p.evaluate(() => window.__scritture || []);
    ok(`con il cloud vuoto i dati già presenti vengono pubblicati (${scritture.length} invii)`, scritture.length > 0);
    ok('e contengono i membri che c\'erano', scritture.some((s) => (s.stato.members || []).length === 2));

    // Caso che prima restava scoperto: il campo torna vuoto MENTRE l'app è già
    // avviata (documento cancellato, codice campo nuovo). Senza la
    // ripubblicazione forzata i dati resterebbero fermi su questo telefono
    // finché qualcuno non tocca qualcosa.
    const prima = await p.evaluate(() => window.__scritture.length);
    await p.evaluate(() => { window.__vuoto = true; window.__emit({ status: 'connected' }); });
    await p.waitForTimeout(900);
    const dopo = await p.evaluate(() => window.__scritture || []);
    ok(`se il campo torna vuoto, l'app ripubblica (${prima} → ${dopo.length})`, dopo.length > prima);
    ok('ed è un invio forzato, non una modifica qualsiasi', dopo.slice(prima).some((s) => s.forza));
    await browser.close();
  }

  // ---- 2) Scrittura fallita: si dice, e si ritenta ----
  const { browser, page: p, menu, errori } = await apri({ initScript: [cloudFinto, { falliscono: true }] });
  await menu('Membri');
  await aggiungiMembro(p, 'Lorenzo');
  await p.waitForTimeout(900);

  ok('nessuna scrittura è andata a buon fine', (await p.evaluate(() => window.__scritture.length)) === 0);
  ok('l\'app dice che qualcosa non è ancora partito', /da inviare/i.test(await p.locator('header').innerText()));

  // Torna a funzionare: il ritentativo deve partire da solo.
  await p.evaluate(() => {
    window.__falliscono = false;
    window.__ultimo = { prova: true };
    // Come fa il vero modulo quando la scrittura riesce dopo un guasto.
    window.__cs.riprova();
  });
  await p.waitForTimeout(600);
  ok('quando la rete torna, ciò che era in sospeso parte', (await p.evaluate(() => window.__scritture.length)) > 0);
  ok('e la spia torna normale', !/da inviare/i.test(await p.locator('header').innerText()));

  // ---- 3) Memoria piena: guasto silenzioso, va detto ----
  await p.evaluate(() => {
    window.__setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'cambusa_syncmeta') { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
      return window.__setItem.call(this, k, v);
    };
  });
  await menu('Membri');
  await aggiungiMembro(p, 'Bruno');
  await p.waitForTimeout(600);
  ok('la memoria piena viene segnalata', /memoria di questo telefono è piena/i.test(await p.locator('body').innerText()));
  ok('ma l\'app continua a funzionare', (await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]').length)) === 2);

  await p.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
  await menu('Membri');
  await aggiungiMembro(p, 'Anna');
  await p.waitForTimeout(600);
  ok('liberato lo spazio, l\'avviso sparisce', !/memoria di questo telefono è piena/i.test(await p.locator('body').innerText()));

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
