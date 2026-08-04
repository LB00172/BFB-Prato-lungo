// Copie di sicurezza locali (una al giorno, dentro il telefono) e promemoria
// del backup serale. Al campo non c'è linea: senza queste, per i giorni che
// contano non esisterebbe nessuna rete di recupero.
const { apri, ok, fine } = require('../lib/app');

const snapLocali = (p) => p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cambusa_snap_locali') || '{}')).sort());
const membri = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]').map((x) => x.name).sort());

const aggiungi = async (p, nome) => {
  await p.fill('input[placeholder="Nome e cognome"]', nome);
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(250);
};

(async () => {
  // ---- 1) La copia del giorno si fa da sola, anche senza linea ----
  const { browser, page: p, menu, errori } = await apri();
  await p.evaluate(() => { window.__offline = true; });

  await menu('Membri');
  await aggiungi(p, 'Lorenzo');
  await p.waitForTimeout(400);

  let giorni = await snapLocali(p);
  ok(`la copia di oggi viene creata da sola (${giorni.join(', ')})`, giorni.length === 1);
  ok('è datata oggi', giorni[0] === new Date().toISOString().slice(0, 10));

  // La copia è quella di INIZIO giornata: non deve contenere Lorenzo, che è
  // stato aggiunto dopo. È il punto a cui si vuole tornare.
  const dentro = await p.evaluate((g) => {
    const s = JSON.parse(JSON.parse(localStorage.getItem('cambusa_snap_locali'))[g]);
    return (s.members || []).length;
  }, giorni[0]);
  ok(`contiene lo stato di prima delle modifiche di oggi (${dentro} membri)`, dentro === 0);

  await aggiungi(p, 'Bruno');
  await p.waitForTimeout(400);
  giorni = await snapLocali(p);
  ok('non se ne fa una nuova a ogni modifica', giorni.length === 1);

  // ---- 2) Il ripristino funziona SENZA linea ----
  // Prima diceva soltanto "serve la connessione": al campo era inutilizzabile.
  await menu('Spese Totali');
  await p.locator('button', { hasText: 'Dati' }).first().click();
  await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'Ripristino di emergenza' }).first().click();
  await p.waitForTimeout(500);
  ok('senza linea il ripristino si apre lo stesso', (await p.locator('text=Ripristina un salvataggio').count()) > 0);
  ok('e dice che la copia è sul telefono', /sul telefono/i.test(await p.locator('body').innerText()));

  await p.locator('button', { hasText: /^Annulla$/ }).last().click();
  await p.waitForTimeout(300);

  // ---- 3) Ripristinare riporta davvero indietro ----
  await p.locator('button', { hasText: 'Ripristino di emergenza' }).first().click();
  await p.waitForTimeout(400);
  await p.locator('button', { hasText: /\d+ [a-z]+$|sul telefono/i }).first().click();
  await p.waitForTimeout(800);
  ok('ripristinando si torna allo stato di inizio giornata', (await membri(p)).length === 0);

  // ---- 4) Il promemoria serale ----
  // Compare solo nei giorni del campo, di sera, e solo se c'è stato qualcosa
  // da salvare. Qui si simulano le tre condizioni una per volta.
  const promemoria = async () => /fine giornata/i.test(await p.locator('body').innerText());

  ok('fuori dai giorni del campo non compare', !(await promemoria()));

  // Si sposta l'orologio a una sera del campo, senza modifiche registrate oggi.
  await p.evaluate(() => {
    localStorage.setItem('cambusa_registro', '[]');
    const vero = Date;
    const finto = new Date('2026-08-13T21:30:00');
    window.Date = class extends vero {
      constructor(...a) { return a.length ? new vero(...a) : new vero(finto); }
      static now() { return finto.getTime(); }
      static parse(...a) { return vero.parse(...a); }
    };
  });
  await menu('Calendario');
  await p.waitForTimeout(400);
  ok('di sera al campo, ma senza modifiche, NON compare', !(await promemoria()));

  // Ora una modifica di oggi: il promemoria deve comparire.
  await menu('Membri');
  await aggiungi(p, 'Anna');
  // Si aspetta il banner invece di sperare in un'attesa fissa: sotto carico
  // il ridisegno può arrivare più tardi e la prova diventerebbe ballerina.
  const comparso = await p.waitForFunction(
    () => /fine giornata/i.test(document.body.innerText), null, { timeout: 8000 },
  ).then(() => true).catch(() => false);
  ok('con delle modifiche compare', comparso);
  ok('e dice quante ne hai fatte', /\d+ modific(a|he)/i.test(await p.locator('body').innerText()));

  // "Ho già fatto" lo mette a tacere fino a domani.
  await p.locator('button', { hasText: 'Ho già fatto' }).first().click();
  await p.waitForTimeout(400);
  ok('"Ho già fatto" lo chiude', !(await promemoria()));
  ok('e resta segnato il giorno', (await p.evaluate(() => localStorage.getItem('cambusa_backup_data'))) === '2026-08-13');

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
