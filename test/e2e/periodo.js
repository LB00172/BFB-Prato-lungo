// Le date del campo sono quelle della stanza, non quelle della Brigata.
//
// CAMP_START e CAMP_END erano scritti nel codice: 11–16 agosto 2026. Nell'app
// pubblica un gruppo che crea un campo per luglio 2027 si ritrovava il
// calendario aperto sull'agosto 2026, e i «giorni del campo» erano quelli di
// un altro. Adesso le date le riscrive App() dalla stanza aperta
// (periodoDelCampo, src/40-configurazione.jsx).
//
// L'elenco dei campi si semina nello script di avvio, PRIMA dell'apertura:
// al primo disegno deve esserci gia' (CLAUDE.md, lo stato che serve prima si
// dichiara li', non con un page.evaluate() dopo).
const { apri, ok, fine } = require('../lib/app');

const campo = (voce) => [(o) => {
  localStorage.setItem('cambusa_stanza', o.codice);
  localStorage.setItem('cambusa_campi', JSON.stringify([o]));
}, Object.assign({ codice: 'K7RX2MQP', nome: 'Campo di luglio', ruolo: 'proprietario' }, voce)];

(async () => {
  // ---------- 1. Dentro un campo con le sue date ----------
  const b = await apri({ admin: false, initScript: campo({ inizio: '2027-07-12', fine: '2027-07-14' }) });
  await b.menu('Calendario');
  const cal = await b.page.locator('main').innerText();
  ok(`il calendario si apre sul primo giorno del campo (${(cal.match(/\d+ (luglio|agosto)/i) || [''])[0]})`,
    /12 luglio/i.test(cal));
  ok('e non sull\'agosto 2026 della Brigata', !/11 agosto/i.test(cal));
  // Il meteo nell'app pubblica e' spento (niente luogo in firebase-config.js):
  // prima si vedeva quello di Prato Lungo, ovunque si campeggiasse.
  ok('e senza un luogo il meteo non compare, nemmeno per dire che manca',
    !/meteo|località del campo/i.test(cal)
    && (await b.page.evaluate(() => window.CAMP_LOCATION)) === null);
  const periodo = await b.page.evaluate(() => [CAMP_START, CAMP_END]);
  ok(`le date del campo sono quelle della stanza (${periodo.join(' → ')})`,
    periodo[0] === '2027-07-12' && periodo[1] === '2027-07-14');
  ok('nessun errore JavaScript' + (b.errori.length ? ': ' + b.errori.join(' | ') : ''), b.errori.length === 0);
  await b.browser.close();

  // ---------- 2. Date storte: si resta sul ripiego, non su un calendario vuoto ----------
  const c = await apri({ admin: false, initScript: campo({ inizio: 'domani', fine: '' }) });
  const p2 = await c.page.evaluate(() => [CAMP_START, CAMP_END]);
  ok(`con date che non sono date si resta sul ripiego (${p2.join(' → ')})`,
    /^\d{4}-\d{2}-\d{2}$/.test(p2[0]) && p2[1] >= p2[0]);
  ok('nessun errore JavaScript' + (c.errori.length ? ': ' + c.errori.join(' | ') : ''), c.errori.length === 0);
  await fine(c.browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
