// L'app sul computer (30 settembre): due colonne, il menu fisso a sinistra.
//
// Tutte le altre prove girano a 390 px, cioe' sul telefono. Qui si guarda lo
// schermo largo: il menu e' gia' aperto e non si chiude, il tasto per aprirlo
// non c'e', le schede si allargano, e niente scappa di lato. E al contrario:
// sul telefono niente di tutto questo — il menu resta quello che scorre.
const { apri, ok, fine, attendi } = require('../lib/app');

const misure = (p) => p.evaluate(() => {
  const nav = document.querySelector('nav');
  const main = document.querySelector('main');
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const tasto = document.querySelector('button[aria-label="Menu"]');
  const fab = document.querySelector('[data-tasto-spesa]');
  return {
    nav: r(nav), main: r(main),
    tastoMenu: !!tasto && getComputedStyle(tasto).display !== 'none',
    fab: r(fab),
    radice: r(document.querySelector('#root > div')),
    sborda: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
});

(async () => {
  // ---------- Sul computer ----------
  // Sul computer il tasto del menu non c'e': si aspetta il menu stesso.
  const a = await apri({ viewport: { width: 1280, height: 800 }, aspetta: 'nav button[data-voce="calendario"]' });
  const p = a.page;
  await p.waitForSelector('nav button[data-voce="calendario"]');
  const m = await misure(p);
  ok(`il menu è già aperto, a sinistra (${Math.round(m.nav.left)}–${Math.round(m.nav.right)} px)`,
    m.nav.width >= 250 && m.nav.right <= m.main.left + 1 && m.nav.left >= m.radice.left - 1);
  ok('e il tasto per aprirlo non c\'è', !m.tastoMenu);
  ok(`la scheda si allarga accanto al menu (${Math.round(m.main.width)} px)`, m.main.width > 600);
  ok('niente scappa di lato', !m.sborda);
  ok('il tasto «+ Spesa» resta dentro l\'app', !!m.fab && m.fab.right <= m.radice.right + 1);

  // Una voce del menu porta alla sua scheda, e il menu resta.
  await p.click('nav button[data-voce="spesa"]');
  await attendi(p, () => /spese totali/i.test(document.querySelector('header').innerText));
  const dopo = await misure(p);
  ok('toccando una voce si cambia scheda, e il menu resta dov\'è', Math.abs(dopo.nav.left - m.nav.left) < 1 && dopo.nav.width === m.nav.width);
  // Il foglio della spesa si apre sopra tutto, anche sul computer.
  await p.click('[data-tasto-spesa]');
  await attendi(p, () => !!document.querySelector('[data-foglio-spesa]'));
  ok('il foglio «Registra una spesa» si apre anche qui', true);
  ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await p.screenshot({ path: require('path').join(__dirname, '..', 'tmp', 'vista-desktop.png') });
  await a.browser.close();

  // ---------- Sul telefono non cambia niente ----------
  const b = await apri({});
  await b.page.waitForSelector('button[aria-label="Menu"]');
  const t = await misure(b.page);
  ok('sul telefono il tasto del menu c\'è', t.tastoMenu);
  ok(`e il menu sta fuori dallo schermo finché non lo si apre (${Math.round(t.nav.right)} px)`, t.nav.right <= 0);
  await b.browser.close();
  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
