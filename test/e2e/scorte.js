// Copie di sicurezza locali (due al giorno, dentro il telefono) e promemoria
// del backup serale. Al campo non c'è linea: senza queste, per i giorni che
// contano non esisterebbe nessuna rete di recupero.
const { apri, ok, fine } = require('../lib/app');

// Orologio pilotabile: l'app si comporta in modo diverso a seconda dell'ora e
// del giorno, e con l'ora vera questa prova darebbe risultati diversi a
// seconda di quando la si lancia.
function orologioFinto(inizio) {
  const vero = Date;
  window.__ora = inizio;
  window.Date = class extends vero {
    constructor(...a) { return a.length ? new vero(...a) : new vero(window.__ora); }
    static now() { return window.__ora; }
    static parse(...a) { return vero.parse(...a); }
    static UTC(...a) { return vero.UTC(...a); }
  };
}

const snapLocali = (p) => p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cambusa_snap_locali') || '{}')).sort());
const membri = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members') || '[]').map((x) => x.name).sort());
const spostaOrologio = (p, quando) => p.evaluate((t) => { window.__ora = t; }, new Date(quando).getTime());

const aggiungi = async (p, nome) => {
  await p.fill('input[placeholder="Nome e cognome"]', nome);
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(250);
};

(async () => {
  // Si parte da una mattina dei giorni del campo.
  const MATTINA = new Date('2026-08-13T09:00:00').getTime();
  const { browser, page: p, menu, errori } = await apri({ initScript: [orologioFinto, MATTINA] });

  // ---- 1) La copia della fascia si fa da sola, anche senza linea ----
  await menu('Membri');
  await aggiungi(p, 'Lorenzo');
  await p.waitForTimeout(400);

  let fasce = await snapLocali(p);
  ok(`la copia della mattina viene creata da sola (${fasce.join(', ')})`, fasce.length === 1);
  ok('è datata col giorno e la fascia', fasce[0] === '2026-08-13T00');

  // Contiene lo stato di PRIMA delle modifiche della fascia: è il punto a cui
  // si vuole tornare.
  const dentro = await p.evaluate((g) => {
    const v = JSON.parse(localStorage.getItem('cambusa_snap_locali'))[g];
    return { membri: (JSON.parse(v.dati).members || []).length, at: v.at };
  }, fasce[0]);
  ok(`contiene lo stato di prima delle modifiche (${dentro.membri} membri)`, dentro.membri === 0);
  ok('e si sa a che ora è stata presa', dentro.at === MATTINA);

  await aggiungi(p, 'Bruno');
  await p.waitForTimeout(400);
  ok('non se ne fa una nuova a ogni modifica', (await snapLocali(p)).length === 1);

  // ---- 2) Passato mezzogiorno si apre la seconda fascia ----
  await spostaOrologio(p, '2026-08-13T14:00:00');
  await aggiungi(p, 'Carlo');
  await p.waitForTimeout(500);
  fasce = await snapLocali(p);
  ok(`nel pomeriggio si aggiunge la seconda copia (${fasce.join(', ')})`, fasce.length === 2);
  ok('sono le due fasce dello stesso giorno', fasce[0] === '2026-08-13T00' && fasce[1] === '2026-08-13T12');
  const pomeriggio = await p.evaluate((g) => (JSON.parse(JSON.parse(localStorage.getItem('cambusa_snap_locali'))[g].dati).members || []).length, fasce[1]);
  ok(`quella del pomeriggio ha il lavoro della mattina ma non la modifica che l'ha fatta scattare (${pomeriggio} membri)`, pomeriggio === 2);

  // ---- 3) Il ripristino funziona SENZA linea ----
  // Prima diceva soltanto "serve la connessione": al campo era inutilizzabile.
  await menu('Spese Totali');
  await p.locator('button', { hasText: 'Dati' }).first().click();
  await p.waitForTimeout(300);
  await p.locator('button', { hasText: 'Ripristino di emergenza' }).first().click();
  await p.waitForTimeout(500);
  const elenco = await p.locator('body').innerText();
  ok('senza linea il ripristino si apre lo stesso', /ripristina un salvataggio/i.test(elenco));
  ok('distingue mattina e pomeriggio', /mattina/i.test(elenco) && /pomeriggio/i.test(elenco));
  ok('e dice che le copie sono sul telefono', /sul telefono/i.test(elenco));

  // Si sceglie la copia della MATTINA: si deve tornare a prima di tutto.
  await p.locator('button').filter({ hasText: 'mattina' }).first().click();
  await p.waitForTimeout(900);
  ok('ripristinando la mattina si torna a prima di tutto', (await membri(p)).length === 0);

  // ---- 4) Le copie vecchie si buttano, per numero e per spazio ----
  const quante = await p.evaluate(() => {
    const grosso = 'x'.repeat(80 * 1024);
    const tutte = {};
    for (let i = 1; i <= 20; i++) tutte['2026-07-' + String(i).padStart(2, '0') + 'T00'] = { at: 1, dati: grosso };
    localStorage.setItem('cambusa_snap_locali', JSON.stringify(tutte));
    return Object.keys(tutte).length;
  });
  await spostaOrologio(p, '2026-08-14T09:00:00');
  await menu('Membri');
  await aggiungi(p, 'Dario');
  await p.waitForTimeout(600);
  const dopo = await p.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('cambusa_snap_locali') || '{}');
    const peso = Object.keys(t).reduce((s, k) => s + ((t[k] && t[k].dati) || '').length, 0);
    return { quante: Object.keys(t).length, kb: Math.round(peso / 1024) };
  });
  ok(`da ${quante} copie enormi si rientra nei limiti (${dopo.quante} copie, ${dopo.kb} KB)`,
    dopo.quante <= 14 && dopo.kb <= 700);
  ok('la copia di oggi c\'è comunque', (await snapLocali(p)).indexOf('2026-08-14T00') >= 0);

  // ---- 5) Il promemoria serale ----
  // Compare solo nei giorni del campo, di sera, e solo se c'è stato qualcosa
  // da salvare. Si provano le condizioni una per volta.
  const promemoria = async () => /fine giornata/i.test(await p.locator('body').innerText());

  await spostaOrologio(p, '2026-08-14T10:00:00');
  await menu('Calendario');
  await p.waitForTimeout(400);
  ok('di mattina non compare', !(await promemoria()));

  await p.evaluate(() => localStorage.setItem('cambusa_registro', '[]'));
  await spostaOrologio(p, '2026-08-14T21:30:00');
  await menu('Presenze');
  await p.waitForTimeout(400);
  ok('di sera al campo, ma senza modifiche, NON compare', !(await promemoria()));

  await menu('Membri');
  await aggiungi(p, 'Anna');
  const comparso = await p.waitForFunction(
    () => /fine giornata/i.test(document.body.innerText), null, { timeout: 8000 },
  ).then(() => true).catch(() => false);
  ok('con delle modifiche compare', comparso);
  ok('e dice quante ne hai fatte', /\d+ modific(a|he)/i.test(await p.locator('body').innerText()));

  await p.locator('button', { hasText: 'Ho già fatto' }).first().click();
  await p.waitForTimeout(400);
  ok('"Ho già fatto" lo chiude', !(await promemoria()));
  ok('e resta segnato il giorno', (await p.evaluate(() => localStorage.getItem('cambusa_backup_data'))) === '2026-08-14');

  // Fuori dai giorni del campo non deve comparire mai.
  await p.evaluate(() => localStorage.removeItem('cambusa_backup_data'));
  await spostaOrologio(p, '2026-09-20T21:30:00');
  await menu('Membri');
  await aggiungi(p, 'Elia');
  await p.waitForTimeout(600);
  ok('fuori dai giorni del campo non compare', !(await promemoria()));

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
