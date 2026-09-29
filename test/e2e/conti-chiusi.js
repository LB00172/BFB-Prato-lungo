// Chiusura dei conti: il gemello del blocco delle presenze, ma per i soldi.
//
// I passaggi di pareggio sono segnati come saldati con una chiave che contiene
// l'IMPORTO ("Anna→Bruno@4530"). Basta che qualcuno aggiunga uno scontrino
// dimenticato e tutti gli importi si ricalcolano: le chiavi non combaciano
// più, e i bonifici già fatti spariscono dall'elenco come se non fossero mai
// avvenuti. Chi aveva pagato torna debitore, con cifre diverse.
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
        pushState: (obj) => { window.__inviati = (window.__inviati || []).concat([obj]); },
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

const aggiungi = async (p, nome) => {
  await p.fill('input[placeholder="Nome e cognome"]', nome);
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(200);
};

const spesa = async (p, nome, prezzo, chi) => {
  const b = p.locator('main button', { hasText: 'Aggiungi un prodotto a mano' });
  if (await b.count()) { await b.first().click(); await p.waitForTimeout(300); }
  await p.fill('input[placeholder="Es. Pasta, Acqua, Piatti…"]', nome);
  await p.locator('input[data-cifra]').first().fill(String(prezzo));
  if (chi) await p.locator('select').filter({ hasText: /Chi ha pagato|acquirente|—/i }).first().selectOption({ label: chi }).catch(() => {});
  await p.locator('button', { hasText: /Salva/ }).first().click();
  await p.waitForTimeout(500);
};

const spese = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_purchases') || '[]').map((x) => `${x.name}:${x.price}`).sort());

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: cloudFinto });

  const chiesto = [];
  p.removeAllListeners('dialog');
  p.on('dialog', async (d) => { chiesto.push(d.message()); await d.accept(); });

  await menu('Membri');
  await aggiungi(p, 'Anna');
  await aggiungi(p, 'Bruno');
  await menu('Presenze');
  for (const n of ['Anna', 'Bruno']) {
    for (const pasto of ['Pranzo', 'Cena']) {
      await p.locator('li', { hasText: n }).locator('button', { hasText: pasto }).first().click();
      await p.waitForTimeout(150);
    }
  }
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  await spesa(p, 'Spesa grossa', 100);
  const prima = await spese(p);
  ok(`si parte con una spesa registrata (${prima.join(', ')})`, prima.length === 1);

  // --- Chiusura ---
  await menu('Spese Totali');
  await p.locator('button', { hasText: /^Dati$/ }).first().click();
  await p.waitForTimeout(400);
  ok('il tasto per chiudere i conti c\'è (modalità tecnica)', (await p.locator('button', { hasText: 'Chiudi i conti' }).count()) > 0);

  chiesto.length = 0;
  await p.locator('button', { hasText: 'Chiudi i conti' }).first().click();
  await p.waitForTimeout(900);
  ok('chiudere chiede conferma spiegando il perché', /rimborsi già segnati come saldati restano validi/i.test(chiesto[0] || ''));
  ok('e dice quante spese congela', /1 spese/.test(chiesto[0] || ''));

  const dati = await p.locator('main').innerText();
  ok('i conti risultano chiusi', /🔒 Chiusi|Conti chiusi il/i.test(dati));

  // --- 1) Chiudendo, anche le presenze ancora aperte si bloccano ---
  await menu('Presenze');
  await p.waitForTimeout(400);
  ok('le presenze del giorno risultano bloccate', /presenze chiuse/i.test(await p.locator('main').innerText()));

  // --- 2) Non si possono più aggiungere o cancellare spese ---
  chiesto.length = 0;
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  await spesa(p, 'Scontrino dimenticato', 40);
  ok('aggiungere una spesa viene rifiutato con una spiegazione',
    chiesto.some((m) => /conti del campo sono chiusi/i.test(m)));
  ok('e la spesa non entra davvero', (await spese(p)).length === 1);

  // --- 3) Nemmeno dalla sincronizzazione ---
  // È il caso vero: un telefono che era offline pubblica una spesa in ritardo.
  await p.evaluate(() => {
    const st = {
      members: JSON.parse(localStorage.getItem('cambusa_members') || '[]'),
      campData: JSON.parse(localStorage.getItem('cambusa_camp_data') || '{}'),
      purchases: JSON.parse(localStorage.getItem('cambusa_purchases') || '[]')
        .concat([{ id: 'tardiva', name: 'Birra dimenticata', price: 25, type: 'bevande', buyer: 'Bruno', at: Date.now() }]),
      toBuy: [], equipment: [], gear: [], settled: [], sepDays: [],
      blocchi: JSON.parse(localStorage.getItem('cambusa_blocchi') || '[]'),
    };
    const now = Date.now() + 60000;
    window.__remoteCb(Object.assign(st, { _meta: { v: 2, rev: { 'p|tardiva': now }, del: {}, hi: now } }));
  });
  await p.waitForTimeout(1000);

  ok(`la spesa in ritardo NON entra nei conti (${(await spese(p)).join(', ')})`, (await spese(p)).length === 1);

  const avviso = await p.locator('body').innerText();
  ok('ma viene detto, non buttata in silenzio', /conti sono chiusi: 1 modifica è stata respinta/i.test(avviso));
  ok('con il nome e la cifra', /Birra dimenticata/.test(avviso) && /25[.,]00 €/.test(avviso));
  ok('e si dice come accettarla', /riapri i conti/i.test(avviso));

  // La correzione va anche ripubblicata, altrimenti il blocco vale solo qui.
  const rimandato = await p.evaluate(() => {
    const inviati = window.__inviati || [];
    const ultimo = inviati[inviati.length - 1];
    return ultimo ? (ultimo.purchases || []).map((x) => x.id) : null;
  });
  ok(`la correzione viene rimandata agli altri (${(rimandato || []).length} spese)`,
    Array.isArray(rimandato) && rimandato.indexOf('tardiva') < 0);

  // --- 4) Riaprendo si torna a poter lavorare ---
  await menu('Spese Totali');
  await p.locator('button', { hasText: /^Dati$/ }).first().click();
  await p.waitForTimeout(400);
  chiesto.length = 0;
  await p.locator('button', { hasText: 'Riapri i conti' }).first().click();
  await p.waitForTimeout(700);
  ok('riaprire avvisa che gli importi si rimuovono', /potrebbero non combaciare più/i.test(chiesto[0] || ''));

  chiesto.length = 0;
  await menu('Lista della Spesa');
  await p.locator('button', { hasText: 'Acquistato' }).first().click();
  await p.waitForTimeout(300);
  await spesa(p, 'Ora si può', 10);
  ok('con i conti riaperti la spesa entra', (await spese(p)).length === 2);
  ok('e nessun rifiuto', !chiesto.some((m) => /conti del campo sono chiusi/i.test(m)));

  // --- 5) Un utente normale non può chiudere né riaprire ---
  await p.addInitScript(() => localStorage.removeItem('cambusa_admin'));
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await menu('Spese Totali');
  await p.locator('button', { hasText: /^Dati$/ }).first().click();
  await p.waitForTimeout(400);
  ok('senza modalità tecnica il tasto non c\'è',
    (await p.locator('button', { hasText: /Chiudi i conti|Riapri i conti/ }).count()) === 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
