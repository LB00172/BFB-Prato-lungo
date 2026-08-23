// Tenuta della sincronizzazione nei casi che non si vedono: scrittura fallita,
// campo vuoto nel cloud, memoria piena. Sono i modi in cui i dati restano
// fermi su un telefono senza che nessuno se ne accorga.
const { apri, ok, fine, scontriniSalvati, fotoSalvate } = require('../lib/app');

// Cloud finto pilotabile: si può far fallire la scrittura a comando e si può
// dire che nel cloud non c'è ancora niente.
function cloudFinto(opz) {
  // Dati già presenti sul telefono PRIMA dell'aggancio: è il caso vero, cioè
  // l'app che si connette avendo già lavorato.
  if (opz.semina) localStorage.setItem('cambusa_members', JSON.stringify(opz.semina));
  // Spia sull'ordine dei salvataggi: dev'essere attiva già al primo giro, cioè
  // prima che l'app scriva qualsiasi cosa.
  if (opz.spia) {
    window.__ordine = [];
    window.__vero = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { window.__ordine.push(k); return window.__vero.call(this, k, v); };
  }
  Object.defineProperty(window, 'CloudSync', {
    configurable: true,
    get() { return window.__cs; },
    set(v) {
      window.__scritture = [];
      window.__falliscono = !!opz.falliscono;
      window.__vuoto = !!opz.vuoto;
      window.__fotoRotte = !!opz.fotoRotte;
      window.__codaFoto = [];
      window.__fotoCaricate = [];
      // Come il modulo vero: "vuoto" cambia SOLO quando arriva una fotografia
      // dal cloud, non a ogni scrittura.
      window.__emit = (patch) => {
        if (window.__status) {
          window.__status(Object.assign({
            connected: true, code: 'TEST', empty: window.__vuoto,
            pending: !!window.__inSospeso, foto: window.__codaFoto.length,
          }, patch));
        }
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
        riprova: () => {
          // Prima le foto rimaste indietro, come fa quella vera.
          if (window.__codaFoto.length && !window.__fotoRotte) {
            window.__codaFoto.splice(0).forEach((v) => window.__fotoCaricate.push(v.id));
            window.__emit({ status: 'connected' });
          }
          if (window.__inSospeso && !window.__falliscono) { window.__cs.pushState(window.__ultimo || {}, true); return true; }
          return false;
        },
        inSospeso: () => !!window.__inSospeso,
        // Coda foto: si comporta come quella vera, e si puo' far fallire.
        putReceipt: (id, dati) => {
          if (window.__fotoRotte) {
            if (!window.__codaFoto.some((x) => x.id === id)) window.__codaFoto.push({ id, dati });
            window.__emit({ status: 'error', foto: window.__codaFoto.length });
            return;
          }
          window.__fotoCaricate.push(id);
          window.__emit({ status: 'connected', foto: window.__codaFoto.length });
        },
        fotoInCoda: () => window.__codaFoto.length,
        deleteReceipt: () => {},
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

  // ---- 4) Foto e scontrini: se il caricamento non riesce, non si perdono ----
  // Sono documenti a parte: non passano dalla fusione, quindi se il
  // caricamento fallisce non c'è niente che rimedi. Devono finire in coda.
  {
    const { browser: b2, page: p2, menu: m2 } = await apri({ initScript: [cloudFinto, { fotoRotte: true }] });
    // Una spesa registrata a mano, poi ci si allega lo scontrino.
    await m2('Lista della Spesa');
    await p2.locator('button', { hasText: 'Acquistato' }).first().click();
    await p2.waitForTimeout(300);
    { const b = p2.locator('main button', { hasText: 'Aggiungi un prodotto a mano' }); if (await b.count()) { await b.first().click(); await p2.waitForTimeout(350); } }
    await p2.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Pane');
    await p2.locator('input[placeholder="0.00"]').first().fill('3');
    await p2.locator('button', { hasText: /Salva/ }).first().click();
    await p2.waitForTimeout(500);

    const FOTO = require('path').join(__dirname, '..', 'fixture', 'foto.png');
    await p2.locator('li:has-text("Pane") input[type="file"]').first().setInputFiles(FOTO);
    // La foto va decodificata e ridimensionata: sotto carico pieno può volerci
    // più di un secondo e mezzo. Si aspetta il fatto, non il cronometro.
    const salvata = await scontriniSalvati(p2, 1).then(() => true).catch(() => false);
    await p2.waitForTimeout(400);

    ok('la foto è comunque sul telefono', salvata && (await fotoSalvate(p2)).length === 1);
    ok('e finisce in coda invece di sparire', (await p2.evaluate(() => window.__codaFoto.length)) === 1);
    ok('l\'app dice che c\'è una foto da inviare', /foto da inviare/i.test(await p2.locator('header').innerText()));

    // Torna a funzionare: la coda si svuota da sola.
    await p2.evaluate(() => { window.__fotoRotte = false; window.__cs.riprova(); });
    await p2.waitForTimeout(800);
    ok('quando riprende, la foto parte', (await p2.evaluate(() => window.__fotoCaricate.length)) === 1);
    ok('e la coda si svuota', (await p2.evaluate(() => window.__codaFoto.length)) === 0);
    ok('la spia torna normale', !/da inviare/i.test(await p2.locator('header').innerText()));
    await b2.close();
  }

  // ---- 5) Memoria al limite: la cronologia vale più di tutto il resto ----
  // È la catena che ha prodotto il falso allarme: le copie di sicurezza si
  // prendono gli ultimi byte liberi, il salvataggio della cronologia fallisce,
  // alla riapertura il telefono riparte "senza date" e la prima
  // sincronizzazione gli porta via le voci cancellate dagli altri.
  {
    const { browser: b3, page: p3, menu: m3, errori: e3 } = await apri({ initScript: [cloudFinto, { spia: true }] });

    await m3('Membri');
    await aggiungiMembro(p3, 'Lorenzo');
    await p3.waitForTimeout(600);
    const ordine = await p3.evaluate(() => ({
      meta: window.__ordine.indexOf('cambusa_syncmeta'),
      copia: window.__ordine.indexOf('cambusa_snap_locali'),
    }));
    ok(`la cronologia si salva PRIMA della copia di sicurezza (${ordine.meta} < ${ordine.copia})`,
      ordine.meta >= 0 && ordine.copia >= 0 && ordine.meta < ordine.copia);

    // Ora la memoria si riempie: solo la cronologia deve passare comunque.
    await p3.evaluate(() => {
      Storage.prototype.setItem = window.__vero;
      // Una copia di sicurezza enorme, poi il tetto viene chiuso di netto.
      const grosso = 'x'.repeat(300 * 1024);
      localStorage.setItem('cambusa_snap_locali', JSON.stringify({ '2026-01-01T00': { at: 1, dati: grosso } }));
      let tot = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        tot += k.length + (localStorage.getItem(k) || '').length;
      }
      window.__tetto = tot;   // da qui in poi non entra più niente di nuovo
      Storage.prototype.setItem = function (k, v) {
        let peso = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const kk = localStorage.key(i);
          if (kk !== k) peso += kk.length + (localStorage.getItem(kk) || '').length;
        }
        if (peso + k.length + String(v).length > window.__tetto) {
          const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e;
        }
        return window.__vero.call(this, k, v);
      };
    });

    await aggiungiMembro(p3, 'Bruno');
    await p3.waitForTimeout(800);

    const esito = await p3.evaluate(() => {
      const m = JSON.parse(localStorage.getItem('cambusa_syncmeta') || '{}');
      const membri = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
      const nuovo = membri.find((x) => x.name === 'Bruno');
      return {
        datate: Object.keys(m.rev || {}).length,
        haBruno: !!nuovo && !!(m.rev || {})['m|' + nuovo.id],
        vecchiona: !!JSON.parse(localStorage.getItem('cambusa_snap_locali') || '{}')['2026-01-01T00'],
        membri: membri.length,
      };
    });
    ok(`con la memoria piena la cronologia si salva lo stesso (${esito.datate} voci datate)`, esito.haBruno);
    ok('sacrificando la copia di sicurezza che occupava lo spazio', !esito.vecchiona);
    ok('e l\'app resta in piedi con i suoi dati', esito.membri === 2);
    ok('nessun errore JavaScript nella prova della memoria' + (e3.length ? ': ' + e3.join(' | ') : ''), e3.length === 0);
    await b3.close();
  }

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
