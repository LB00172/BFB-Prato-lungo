// Ripristino e importazione: le due operazioni che non aggiungono ma
// SOSTITUISCONO. Tutto ciò che c'era e non c'è più diventa una cancellazione
// datata che parte verso tutti i telefoni — ed è l'operazione più pericolosa
// dell'app. Finora chi la faceva era l'unico a non avere una via d'uscita: la
// copia di scorta si salvava soltanto su chi RICEVEVA il disastro.
const fs = require('fs');
const path = require('path');
const { apri, ok, fine } = require('../lib/app');

function cloudFinto() {
  Object.defineProperty(window, 'CloudSync', {
    configurable: true,
    get() { return window.__cs; },
    set(v) {
      window.__cs = Object.assign({}, v, {
        isConfigured: () => true,
        isConnected: () => !!window.__connesso,
        savedCode: () => 'TEST',
        connect: (cfg, code, cb) => {
          window.__remoteCb = cb;
          window.__connesso = true;
          if (window.__status) window.__status({ connected: true, status: 'connected', code });
          return Promise.resolve();
        },
        onStatus: (cb) => { window.__status = cb; cb({ connected: true, status: 'connected', code: 'TEST' }); },
        onReceipts: () => {}, onWeather: () => {},
        pushState: (obj) => { window.__pushed = obj; },
        riprova: () => false, inSospeso: () => false, fotoInCoda: () => 0,
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

const nomi = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]').map((x) => x.name).sort());

const aggiungi = async (p, nome) => {
  await p.fill('input[placeholder="Nome e cognome"]', nome);
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(250);
};

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: cloudFinto });

  // Le domande dell'app si raccolgono invece di accettarle alla cieca: il
  // punto della prova è proprio COSA viene chiesto.
  const chiesto = [];
  let rispondi = true;
  p.removeAllListeners('dialog');
  p.on('dialog', async (d) => { chiesto.push(d.message()); if (rispondi) await d.accept(); else await d.dismiss(); });

  // --- Dati di partenza ---
  await menu('Membri');
  for (const n of ['Lorenzo', 'Bruno', 'Anna', 'Carlo']) await aggiungi(p, n);
  await p.waitForTimeout(500);
  ok('si parte con quattro membri', (await nomi(p)).length === 4);

  // --- Un backup VECCHIO, con dentro solo due dei quattro ---
  const vecchio = await p.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('cambusa_members') || '[]');
    return JSON.stringify({
      version: 6,
      exportedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      members: m.slice(0, 2), campData: {}, purchases: [], gear: [],
      settled: [], equipment: [], toBuy: [], sepDays: [], receipts: {},
    });
  });
  const fileBackup = path.join(__dirname, '..', 'tmp', 'backup-vecchio.json');
  fs.mkdirSync(path.dirname(fileBackup), { recursive: true });
  fs.writeFileSync(fileBackup, vecchio);

  // --- 1) L'importazione deve DIRE cosa sta per distruggere ---
  chiesto.length = 0;
  rispondi = false;                      // prima si annulla
  await menu('Spese Totali');
  await p.locator('button', { hasText: 'Dati' }).first().click();
  await p.waitForTimeout(300);
  await p.locator('input[type="file"][accept*="json"]').first().setInputFiles(fileBackup);
  await p.waitForTimeout(800);

  const domanda = chiesto[0] || '';
  ok('l\'importazione chiede conferma', chiesto.length === 1);
  ok('dice di che data è il backup', /backup del /i.test(domanda));
  ok('dice cosa contiene', /2 membri/.test(domanda));
  ok('dice QUANTE voci spariranno', /spariranno 2 voci/i.test(domanda));
  ok('dice che spariscono da tutti i telefoni', /TUTTI i telefoni/.test(domanda));
  ok('e dice come tornare indietro', /annullare/i.test(domanda));
  ok('annullando non cambia niente', (await nomi(p)).length === 4);

  // --- 2) Confermando, la copia di scorta c'è anche su QUESTO telefono ---
  chiesto.length = 0;
  rispondi = true;
  await p.locator('input[type="file"][accept*="json"]').first().setInputFiles(fileBackup);
  await p.waitForTimeout(900);
  ok('confermando i dati vengono sostituiti', (await nomi(p)).length === 2);

  const scorta = await p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_rescue') || 'null'));
  ok('la copia di scorta è stata salvata su chi ha fatto l\'operazione', !!scorta && scorta.perse === 2);
  ok('e contiene lo stato di prima', !!scorta && (scorta.state.members || []).length === 4);

  // --- 3) E si può davvero annullare ---
  await menu('Impostazioni');
  await p.waitForTimeout(400);
  ok('la diagnostica offre l\'annullamento', (await p.locator('button', { hasText: 'Annulla quella sincronizzazione' }).count()) > 0);
  await p.locator('button', { hasText: 'Annulla quella sincronizzazione' }).first().click();
  await p.waitForTimeout(900);
  ok('annullando tornano tutti e quattro', (await nomi(p)).length === 4);

  // --- 4) Un file che non è un backup viene rifiutato ---
  chiesto.length = 0;
  const spazzatura = path.join(__dirname, '..', 'tmp', 'non-backup.json');
  fs.writeFileSync(spazzatura, JSON.stringify({ ciao: 'mondo' }));
  await menu('Spese Totali');
  await p.locator('button', { hasText: 'Dati' }).first().click();
  await p.waitForTimeout(300);
  await p.locator('input[type="file"][accept*="json"]').first().setInputFiles(spazzatura);
  await p.waitForTimeout(700);
  ok('un file che non è un backup viene rifiutato', /non è un backup/i.test(chiesto.join(' ')));
  ok('e i dati restano intatti', (await nomi(p)).length === 4);

  // --- 5) Il ripristino di una copia locale dice anch'esso il costo ---
  chiesto.length = 0;
  rispondi = false;
  await p.locator('button', { hasText: 'Ripristino di emergenza' }).first().click();
  await p.waitForTimeout(600);
  const righe = await p.locator('button').filter({ hasText: /mattina|pomeriggio/ }).count();
  if (righe > 0) {
    await p.locator('button').filter({ hasText: /mattina|pomeriggio/ }).first().click();
    await p.waitForTimeout(600);
    const q = chiesto.join(' ');
    ok('anche il ripristino dice quante voci spariranno', /spariranno \d+ voci|non sparisce nessuna voce/i.test(q));
    ok('e annullando non tocca niente', (await nomi(p)).length === 4);
  } else {
    ok('c\'è almeno una copia locale da ripristinare', false);
  }

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
