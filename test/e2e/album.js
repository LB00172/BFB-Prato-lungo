// Galleria del campo: caricamento con il nome di un membro, tetto per persona,
// visione a schermo pieno, eliminazione. Il cloud è finto e vive in memoria,
// così la prova non tocca Firebase.
const { apri, ok, fine } = require('../lib/app');

// Finto CloudSync: tiene le foto in memoria e si comporta come quello vero.
function cloudFinto(collegato) {
  Object.defineProperty(window, 'CloudSync', {
    configurable: true,
    get() { return window.__cs; },
    set(v) {
      const foto = new Map();      // id -> { thumb, by, at }
      const intere = new Map();    // id -> dataURL
      let avvisa = null;
      // Timbro strettamente crescente: due foto caricate nello stesso
      // millisecondo renderebbero ambiguo l'ordine di scatto, e la prova
      // sull'album completo diventerebbe un lancio di dado.
      let orologio = 0;
      const spargi = () => {
        if (!avvisa) return;
        // Come il vero watchPhotos: le foto timbrate con un archivio non
        // compaiono più nella galleria del campo in corso.
        const out = [...foto.entries()]
          .filter(([, m]) => !m.archive)
          .map(([id, m]) => ({ id, ...m }))
          .sort((a, b) => b.at - a.at);
        avvisa(out);
      };
      window.__foto = foto;
      window.__intere = intere;
      window.__cs = Object.assign({}, v, {
        isConfigured: () => true,
        isConnected: () => collegato,
        savedCode: () => 'TEST',
        connect: (cfg, code, cb) => {
          if (window.__status) window.__status({ connected: collegato, status: collegato ? 'connected' : 'idle', code });
          return Promise.resolve();
        },
        onStatus: (cb) => { window.__status = cb; cb({ connected: collegato, status: collegato ? 'connected' : 'idle', code: 'TEST' }); },
        onReceipts: () => {}, onWeather: () => {},
        pushState: () => {}, putReceipt: () => {}, deleteReceipt: () => {},
        putArchive: () => Promise.resolve(true), listArchives: () => Promise.resolve([]),
        archivePhotos: (archiveId) => {
          let n = 0;
          foto.forEach((m, id) => { if (!m.archive) { foto.set(id, { ...m, archive: archiveId }); n++; } });
          spargi();
          return Promise.resolve(n);
        },
        listPhotos: (archiveId) => Promise.resolve(
          [...foto.entries()].filter(([, m]) => m.archive === archiveId).map(([id, m]) => ({ id, ...m }))
        ),
        listSnapshots: () => Promise.resolve([]), listScores: () => Promise.resolve([]),
        submitScore: () => Promise.resolve(),
        // --- galleria ---
        putPhoto: (id, thumb, full, by) => {
          foto.set(id, { thumb, by, at: Date.now() + (orologio++) });
          intere.set(id, full);
          spargi();
          return Promise.resolve(true);
        },
        watchPhotos: (cb) => { avvisa = cb; spargi(); return () => { avvisa = null; }; },
        getPhotoFull: (id) => {
          // Registro l'ordine in cui l'app chiede gli originali: e' l'ordine
          // in cui le foto finiscono nelle pagine del PDF.
          if (!window.__chiesti) window.__chiesti = [];
          window.__chiesti.push(id);
          return Promise.resolve(intere.get(id) || null);
        },
        deletePhoto: (id) => { foto.delete(id); intere.delete(id); spargi(); return Promise.resolve(true); },
      });
    },
  });
}

const FOTO = require('path').join(__dirname, '..', 'fixture', 'foto.png');

(async () => {
  // ---- 1) Senza linea: la galleria lo dice, non finge ----
  {
    const { browser, page: p, menu } = await apri({ initScript: [cloudFinto, false] });
    await menu('Galleria');
    const testo = await p.locator('main').innerText();
    ok('senza linea la galleria spiega che serve il collegamento', /ha bisogno della linea|vive nel cloud/i.test(testo));
    ok('senza linea non compare la tendina dei nomi', (await p.locator('main select').count()) === 0);
    await browser.close();
  }

  // ---- 2) Con la linea: caricamento, tetto, visione, eliminazione ----
  const { browser, page: p, menu, errori } = await apri({ initScript: [cloudFinto, true] });

  await menu('Membri');
  // Nome E cognome: sotto la polaroid deve restare solo il nome.
  for (const n of ['Lorenzo Ballerini', 'Bruno']) {
    await p.fill('input[placeholder="Nome e cognome"]', n);
    await p.locator('button', { hasText: /^\+$/ }).first().click();
    await p.waitForTimeout(150);
  }

  // Tetto basso, così la prova non deve caricare sette foto.
  await menu('Impostazioni');
  await p.locator('button', { hasText: /^5$/ }).first().click();
  await p.waitForTimeout(200);

  await menu('Galleria');
  ok('la galleria compare nel menu e si apre', (await p.locator('h3', { hasText: 'Carica le tue foto' }).count()) > 0);
  ok('la tendina elenca i membri col loro conteggio',
    (await p.locator('main select option').allInnerTexts()).some((t) => /Lorenzo Ballerini \(0\/5\)/.test(t)));

  const scegli = p.locator('main input[type="file"]');
  ok('senza aver scelto il nome non si possono caricare foto',
    (await p.locator('label:has-text("Scegli le foto")').getAttribute('class')).includes('pointer-events-none'));

  await p.locator('main select').selectOption('Lorenzo Ballerini');
  await p.waitForTimeout(200);
  ok('scelto il nome, compare quante foto restano', /restano/i.test(await p.locator('main').innerText()));

  await scegli.setInputFiles([FOTO, FOTO]);
  await p.waitForFunction(() => (window.__foto ? window.__foto.size : 0) >= 2, null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(400);

  // --- Vista Album: è quella d'ingresso ---
  ok('si apre in vista Album', (await p.locator('.album-pagina').count()) === 1);
  ok('le foto caricate compaiono come polaroid', (await p.locator('.polaroid').count()) === 2);
  ok('la polaroid porta il nome di chi l\'ha scattata', (await p.locator('.polaroid .didascalia').first().innerText()).includes('Lorenzo'));
  ok('sotto la polaroid c\'è solo il nome, senza cognome',
    (await p.locator('.polaroid .didascalia .nome').first().innerText()).trim() === 'Lorenzo');
  ok('nome e data stanno su due righe', (await p.locator('.polaroid .didascalia .quando').count()) > 0);
  const scorre = await p.evaluate(() => {
    const s = document.querySelector('.album-sfoglio');
    return { sw: s.scrollWidth, cw: s.clientWidth };
  });
  ok(`con una pagina sola l'album non scorre di lato (${scorre.sw} vs ${scorre.cw})`, scorre.sw <= scorre.cw + 1);
  ok('l\'indicatore di pagina parte da 1', /1 \/ 1/.test(await p.locator('main').innerText()));

  // --- Passaggio alla Griglia ---
  await p.locator('button', { hasText: 'Griglia' }).first().click();
  await p.waitForTimeout(300);
  ok('la griglia mostra le stesse foto', (await p.locator('main .grid button').count()) === 2);
  ok('in griglia la miniatura porta il nome', (await p.locator('main .grid button').first().innerText()).includes('Lorenzo'));

  const conservate = await p.evaluate(() => window.__foto.size);
  ok('le foto sono finite nel cloud, non altrove', conservate === 2);

  // Il punto tecnico che regge tutta la sezione: niente foto in localStorage.
  const pesoLocale = await p.evaluate(() => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) n += (localStorage.getItem(localStorage.key(i)) || '').length;
    return n;
  });
  const chiaviConFoto = await p.evaluate(() => {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if ((localStorage.getItem(k) || '').includes('data:image')) out.push(k);
    }
    return out;
  });
  ok(`nessuna foto della galleria in localStorage (chiavi con immagini: ${chiaviConFoto.join(', ') || 'nessuna'})`, chiaviConFoto.length === 0);
  ok(`localStorage resta leggero (${(pesoLocale / 1024).toFixed(1)} KB)`, pesoLocale < 200 * 1024);

  // Miniatura piccola, originale grande: è ciò che rende sfogliabile l'album.
  const misure = await p.evaluate(() => {
    const id = [...window.__foto.keys()][0];
    return { mini: window.__foto.get(id).thumb.length, intera: window.__intere.get(id).length };
  });
  ok(`la miniatura è più leggera dell'originale (${misure.mini} < ${misure.intera} byte)`, misure.mini < misure.intera);
  ok(`l'originale sta sotto il limite di 1 MB per documento (${misure.intera} byte)`, misure.intera < 1000000);

  // ---- Tetto per persona ----
  await scegli.setInputFiles([FOTO, FOTO, FOTO, FOTO]);
  await p.waitForFunction(() => (window.__foto ? window.__foto.size : 0) >= 4, null, { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(500);
  const dopoTetto = await p.locator('main .grid button').count();
  ok(`oltre il tetto non si carica: 5 foto e non 6 (viste: ${dopoTetto})`, dopoTetto === 5);
  ok('a tetto raggiunto lo dice chiaramente', /esaurito le sue 5 foto/i.test(await p.locator('main').innerText()));

  // Un altro membro ha il suo conteggio, indipendente.
  await p.locator('main select').selectOption('Bruno');
  await p.waitForTimeout(200);
  ok('il tetto è per persona, non per album', /restano/i.test(await p.locator('main').innerText()));

  // Con cinque foto l'album deve sdoppiarsi: quattro per pagina, come il PDF.
  await p.locator('button', { hasText: 'Album' }).first().click();
  await p.waitForTimeout(400);
  ok('con cinque foto l\'album fa due pagine', (await p.locator('.album-pagina').count()) === 2);
  ok('l\'indicatore mostra il totale delle pagine', /1 \/ 2/.test(await p.locator('main').innerText()));
  await p.locator('button[aria-label="Pagina successiva"]').click();
  await p.waitForTimeout(1200);
  ok('si sfoglia alla pagina dopo', /2 \/ 2/.test(await p.locator('main').innerText()));
  await p.locator('button', { hasText: 'Griglia' }).first().click();
  await p.waitForTimeout(300);

  // ---- Visione a schermo pieno ----
  await p.locator('main .grid button').first().click();
  await p.waitForTimeout(600);
  ok('la foto si apre a schermo pieno', (await p.locator('button', { hasText: 'Chiudi' }).count()) > 0);
  const grande = await p.evaluate(() => {
    const imgs = [...document.querySelectorAll('.fixed img')];
    return imgs.length ? imgs[imgs.length - 1].src.length : 0;
  });
  ok(`aprendola scarica l'originale (${grande} byte)`, grande === misure.intera);

  // ---- Eliminazione: libera un posto ----
  await p.locator('button', { hasText: 'Elimina' }).first().click();
  await p.waitForTimeout(600);
  ok('eliminando resta un posto libero', (await p.locator('main .grid button').count()) === 4);
  ok('la foto sparisce anche dal cloud', (await p.evaluate(() => window.__foto.size)) === 4);

  // ---- Album ricordo: prima quello completo, poi la scelta a mano ----
  await p.locator('button', { hasText: 'Album' }).first().click();
  await p.waitForTimeout(300);
  ok('quattro foto stanno in una pagina sola', (await p.locator('.album-pagina').count()) === 1);

  // L'album COMPLETO e' la strada normale: un tasto, tutte le foto, niente da
  // scegliere. Il tasto dice anche quante sono, cosi' non ci sono sorprese.
  const tastoTutte = p.locator('button', { hasText: /Crea album completo/ });
  ok('il tasto dell\'album completo dice quante foto ci sono: '
    + (await tastoTutte.first().innerText()).replace(/\s+/g, ' ').trim(),
    /\(4 foto\)/i.test(await tastoTutte.first().innerText()));

  await p.evaluate(() => { window.__chiesti = []; });
  const [tutto] = await Promise.all([
    p.waitForEvent('download', { timeout: 25000 }).catch(() => null),
    tastoTutte.first().click(),
  ]);
  await p.waitForTimeout(600);
  ok('l\'album completo viene prodotto e scaricato: ' + (tutto ? tutto.suggestedFilename() : 'NO'),
    !!tutto && /^foto-ricordo-\d{4}-\d{2}-\d{2}\.pdf$/.test(tutto.suggestedFilename()));
  if (tutto) {
    const fs = require('fs');
    const dati = fs.readFileSync(await tutto.path());
    const t = dati.toString('latin1');
    ok(`l\'album completo è un PDF valido (${(dati.length / 1024).toFixed(0)} KB)`,
      t.startsWith('%PDF-') && t.trimEnd().endsWith('%%EOF'));
    ok('e contiene TUTTE e quattro le foto, senza sceglierne nessuna',
      (t.match(/\/Subtype \/Image/g) || []).length === 4);
  }
  // Ordine di scatto: la galleria mostra le ultime per prime, ma il ricordo
  // deve raccontare il campo dal primo giorno all'ultimo.
  const ordine = await p.evaluate(() => {
    const atteso = [...window.__foto.entries()]
      .filter(([, m]) => !m.archive)
      .sort((a, b) => a[1].at - b[1].at)
      .map(([id]) => id);
    return { chiesti: window.__chiesti || [], atteso };
  });
  ok(`le foto entrano in ordine di scatto, non a rovescio (${ordine.chiesti.length} richieste)`,
    ordine.chiesti.length === 4 && JSON.stringify(ordine.chiesti) === JSON.stringify(ordine.atteso));

  // ---- E la scelta a mano resta, come seconda strada ----
  await p.locator('button', { hasText: 'Scegli tu quali foto' }).click();
  await p.waitForTimeout(300);
  ok('scegliere le foto riporta da solo in griglia', (await p.locator('main .grid button').count()) === 4);
  ok('la modalità di scelta si apre', /Tocca le foto da mettere nel ricordo/.test(await p.locator('main').innerText()));
  ok('senza scelte il tasto è spento', await p.locator('button', { hasText: /^Crea album con le scelte/ }).isDisabled());

  const miniature = p.locator('main .grid button');
  await miniature.nth(0).click();
  await miniature.nth(1).click();
  await p.waitForTimeout(300);
  ok('le foto scelte vengono numerate', /Scelte 2 foto/.test(await p.locator('main').innerText()));

  // Toccare di nuovo toglie la scelta.
  await miniature.nth(1).click();
  await p.waitForTimeout(250);
  ok('si può togliere una foto dalla scelta', /Scelte 1 foto/.test(await p.locator('main').innerText()));
  await miniature.nth(1).click();
  await p.waitForTimeout(250);

  const [scarico] = await Promise.all([
    p.waitForEvent('download', { timeout: 25000 }).catch(() => null),
    p.locator('button', { hasText: /^Crea album con le scelte/ }).click(),
  ]);
  await p.waitForTimeout(600);

  ok('il PDF viene prodotto e scaricato: ' + (scarico ? scarico.suggestedFilename() : 'NO'),
    !!scarico && /^foto-ricordo-\d{4}-\d{2}-\d{2}\.pdf$/.test(scarico.suggestedFilename()));
  if (scarico) {
    const fs = require('fs');
    const dati = fs.readFileSync(await scarico.path());
    const t = dati.toString('latin1');
    ok(`il file è un PDF valido (${(dati.length / 1024).toFixed(0)} KB)`, t.startsWith('%PDF-') && t.trimEnd().endsWith('%%EOF'));
    ok('contiene le due foto scelte, non tutte', (t.match(/\/Subtype \/Image/g) || []).length === 2);
    ok('le foto sono incorporate come JPEG', t.includes('/Filter /DCTDecode'));
    ok('porta il titolo del campo', t.includes('(PRATO LUNGO 2026) Tj'));
    ok('porta il nome di chi ha scattato', /\(Lorenzo · /.test(t) || t.includes('(Lorenzo'));
  }
  ok('finita la stampa si esce dalla modalità di scelta',
    (await p.locator('button', { hasText: /Crea album completo/ }).count()) > 0);

  // ---- Chiusura del campo: le foto non si perdono, cambiano posto ----
  // Serve una spesa, altrimenti la chiusura si rifiuta di partire.
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  { const m = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' }); if (await m.count()) { await m.first().click(); await p.waitForTimeout(350); } }
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', 'Pasta');
  await p.locator('input[placeholder="0.00"]').first().fill('20');
  await p.locator('button', { hasText: /Salva/ }).first().click();
  await p.waitForTimeout(400);

  await menu('Spese Totali');
  await p.locator('button', { hasText: 'Dati' }).first().click();
  await p.waitForTimeout(250);
  await p.locator('button', { hasText: 'Chiudi il campo e archivia' }).first().click();
  await p.waitForTimeout(300);
  await p.fill('input[placeholder="Es. Prato Lungo 2026"]', 'Prova 2026');
  await Promise.all([
    p.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    p.locator('button', { hasText: 'Archivia e azzera' }).first().click(),
  ]);
  await p.waitForTimeout(1200);

  const timbrate = await p.evaluate(() => [...window.__foto.values()].filter((m) => m.archive).length);
  ok(`alla chiusura le foto vengono timbrate con l'archivio (${timbrate})`, timbrate === 4);
  ok('nessuna foto cancellata dal cloud alla chiusura', (await p.evaluate(() => window.__foto.size)) === 4);

  ok('l\'archivio dice quante foto contiene', /4 foto/.test(await p.locator('main').innerText()));
  await p.locator('button', { hasText: /^Album$/ }).first().click();
  await p.waitForTimeout(800);
  ok('l\'album del campo chiuso si riapre dall\'Archivio', (await p.locator('main .grid button').count()) === 4);

  await menu('Galleria');
  await p.waitForTimeout(600);
  ok('la galleria del campo nuovo riparte vuota', /Ancora nessuna foto/.test(await p.locator('main').innerText()));

  // ---- Il nome più lungo del campo non deve uscire dalla cornice ----
  // Il caso che si era rotto: didascalia su una riga sola con nome, cognome e
  // data. Usciva dalla polaroid e, allargando il contenuto, faceva scorrere di
  // lato l'intera pagina dell'album. Si prova a campo chiuso, con l'album
  // vuoto, per non spostare i conteggi di prima.
  await menu('Membri');
  await p.fill('input[placeholder="Nome e cognome"]', 'Giovanbattistamariano Della Fontanella');
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(200);
  await menu('Galleria');
  await p.locator('main select').selectOption('Giovanbattistamariano Della Fontanella');
  await p.waitForTimeout(200);
  await p.locator('main input[type="file"]').setInputFiles([FOTO]);
  await p.waitForTimeout(2000);
  // La scelta delle foto di prima ci ha lasciati in Griglia: qui serve l'Album.
  { const b = p.locator('button', { hasText: 'Album' }).first(); if (await b.count()) { await b.click(); await p.waitForTimeout(500); } }

  const dentro = await p.evaluate(() => {
    const pol = document.querySelector('.polaroid');
    if (!pol) return null;
    const d = pol.querySelector('.didascalia');
    const a = pol.getBoundingClientRect(), b = d.getBoundingClientRect();
    const s = document.querySelector('.album-sfoglio');
    return {
      dentro: b.left >= a.left - 0.5 && b.right <= a.right + 0.5,
      nonScorre: s.scrollWidth <= s.clientWidth + 1,
      pol: Math.round(a.width), testo: Math.round(b.width),
      nome: pol.querySelector('.nome').textContent,
    };
  });
  ok('la foto del nome lungo compare', !!dentro);
  if (dentro) {
    ok(`col nome più lungo la didascalia resta nella cornice — "${dentro.nome}" (${dentro.testo}px in ${dentro.pol}px)`, dentro.dentro);
    ok('e la pagina dell\'album non scorre di lato', dentro.nonScorre);
  }

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
