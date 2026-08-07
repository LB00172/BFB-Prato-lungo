// Meteo: una sola previsione per tutto il campo, e nessun modo di restare
// appesi a una previsione morta. Il caso che conta e' quello dell'orologio
// avanti: un telefono che data il bollettino nel futuro lo rende per giorni
// il piu' recente per tutti, e da quel momento nessuno lo sostituisce piu'.
const { apri, ok, fine, attendi } = require('../lib/app');

const GIORNO = 24 * 60 * 60 * 1000;
const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Bollettino finto con tutti i giorni uguali: cosi' la verifica sull'interfaccia
// non dipende da quale giorno risulti selezionato. La finestra e' larga (dal
// mese scorso al mese prossimo) perche' il Calendario apre sul giorno di inizio
// campo, che non e' quasi mai oggi.
function bollettino(tmax, tmin, code, rain) {
  const time = [], weather_code = [], temperature_2m_max = [], temperature_2m_min = [], precipitation_probability_max = [];
  for (let i = -30; i <= 30; i++) {
    time.push(ds(new Date(Date.now() + i * GIORNO)));
    weather_code.push(code); temperature_2m_max.push(tmax);
    temperature_2m_min.push(tmin); precipitation_probability_max.push(rain);
  }
  // "elevation" e' la quota che il modello ha usato davvero: e' il modo di
  // accorgersi che si sta guardando il meteo del paese invece che del prato.
  return { elevation: 1043, daily: { time, weather_code, temperature_2m_max, temperature_2m_min, precipitation_probability_max } };
}

// Previsione gia' in cache sul telefono, con una temperatura impossibile che
// si riconosce a colpo d'occhio se rimane appiccicata allo schermo.
function inCache(quando) {
  const byDate = {};
  for (let i = -30; i <= 30; i++) {
    byDate[ds(new Date(Date.now() + i * GIORNO))] = { code: 0, tmax: 99, tmin: 88, rain: 3 };
  }
  return { fetchedAt: quando, stampa: quando, byDate, lat: 42.059, lon: 13.1 };
}

// Semina la cache e sostituisce la chiamata a Open-Meteo: le prove non devono
// dipendere dalla rete vera, ne' per esserci ne' per mancare.
const seme = (o) => {
  localStorage.setItem('cambusa_weather', JSON.stringify(o.wx));
  const vero = window.fetch;
  window.fetch = function (u) {
    if (String(u).includes('open-meteo')) {
      if (o.rete === 'ko') return Promise.reject(new Error('rete giu\''));
      window.__chiamate = (window.__chiamate || 0) + 1;
      return Promise.resolve({ ok: true, json: () => Promise.resolve(o.risposta) });
    }
    return vero.apply(this, arguments);
  };
};

const testo = (p) => p.locator('main').innerText();

(async () => {
  // ---- 1. La regola di datazione, nuda -----------------------------------
  let a = await apri();
  const q = (remote, server, now) => a.page.evaluate(
    ([r, s, n]) => window.__meteo.quandoMeteo(r, s, n), [remote, server, now]);

  const ORA = 1000000000000;
  ok('una previsione datata nel futuro dal telefono viene riportata ad adesso',
    (await q({ fetchedAt: ORA + 3 * GIORNO }, null, ORA)) === ORA);
  ok('anche se e\' il server a essere avanti, non si va oltre adesso',
    (await q({ fetchedAt: ORA }, ORA + 5 * GIORNO, ORA)) === ORA);
  ok('una previsione di un\'ora fa resta di un\'ora fa',
    (await q({ fetchedAt: ORA - 3600000 }, null, ORA)) === ORA - 3600000);
  ok('quando ci sono entrambe comanda l\'ora del server',
    (await q({ fetchedAt: ORA - 5 * GIORNO }, ORA - 3600000, ORA)) === ORA - 3600000);
  ok('senza date utili non si inventa niente', (await q({}, null, ORA)) === 0);
  await a.browser.close();

  // ---- 2. L'orologio avanti non congela il meteo del campo ---------------
  // In cache c'e' una previsione datata fra tre giorni: e' la trappola. Se il
  // controllo della cache si limita a sottrarre, la differenza viene negativa,
  // sembra "scaricata da meno di un'ora" e non si aggiorna piu' fino a giovedi'.
  a = await apri({ initScript: [seme, { wx: inCache(Date.now() + 3 * GIORNO), risposta: bollettino(21, 9, 95, 40) }] });
  await a.menu('Calendario');

  await attendi(a.page, () => (window.__chiamate || 0) > 0, null, 15000)
    .then(() => ok('con la previsione datata nel futuro l\'app va comunque a riscaricare', true))
    .catch(() => ok('con la previsione datata nel futuro l\'app va comunque a riscaricare', false));

  await attendi(a.page, () => {
    const w = JSON.parse(localStorage.getItem('cambusa_weather') || '{}');
    const d = w.byDate && w.byDate[Object.keys(w.byDate)[0]];
    return d && d.tmax === 21;
  }, null, 15000).catch(() => {});

  const salvata = await a.page.evaluate(() => JSON.parse(localStorage.getItem('cambusa_weather') || '{}'));
  const prima = salvata.byDate ? salvata.byDate[Object.keys(salvata.byDate)[0]] : null;
  ok('la previsione impossibile viene sostituita da quella vera', !!prima && prima.tmax === 21);
  ok('e la data salvata non e\' piu\' nel futuro', salvata.fetchedAt <= Date.now());

  const t2 = await testo(a.page);
  ok('sullo schermo compaiono i gradi nuovi', /21°\s*\/\s*9°/.test(t2));
  ok('e non piu\' quelli della previsione morta', !/99°/.test(t2));
  ok('l\'icona segue il codice WMO del bollettino', /Temporale/.test(t2));
  ok('la probabilita\' di pioggia arriva fino allo schermo', /40%/.test(t2));
  ok('la quota usata dal modello viene conservata',
    (await a.page.evaluate(() => (JSON.parse(localStorage.getItem('cambusa_weather') || '{}')).quota)) === 1043);
  ok('in modalita\' tecnica si vede da dove viene il meteo', /1043 m/.test(t2));
  ok('e si vedono le coordinate interrogate', /42\.059/.test(t2));
  ok('nessun errore JS', a.errori.length === 0);
  await a.browser.close();

  // ---- 2-bis. All'utente normale la diagnostica non si mostra ------------
  a = await apri({ admin: false, initScript: [seme, { wx: inCache(Date.now() - 2 * GIORNO), risposta: bollettino(21, 9, 95, 40) }] });
  await a.menu('Calendario');
  await attendi(a.page, () => {
    const w = JSON.parse(localStorage.getItem('cambusa_weather') || '{}');
    return w.byDate && w.byDate[Object.keys(w.byDate)[0]].tmax === 21;
  }, null, 15000).catch(() => {});
  const tn = await testo(a.page);
  ok('senza modalita\' tecnica il meteo si vede lo stesso', /21°\s*\/\s*9°/.test(tn));
  ok('ma non la quota del modello', !/1043 m/.test(tn));
  ok('ne\' le coordinate', !/42\.059/.test(tn));
  await a.browser.close();

  // ---- 3. Previsione vecchia: si dice, non si finge ----------------------
  // Trenta ore, e la rete non risponde: la cache e' l'unica cosa che c'e', ma
  // chi guarda deve sapere che sta leggendo il bollettino di ieri.
  a = await apri({ initScript: [seme, { wx: inCache(Date.now() - 30 * 60 * 60 * 1000), rete: 'ko' }] });
  await a.menu('Calendario');
  await a.page.waitForTimeout(600);
  const t3 = await testo(a.page);
  ok('una previsione di trenta ore fa viene dichiarata vecchia', /Previsioni vecchie/i.test(t3));
  ok('e si dice anche che altrove ce ne sono di piu\' fresche', /piu' fresche|più fresche/i.test(t3));
  ok('i dati in cache restano comunque visibili', /99°\s*\/\s*88°/.test(t3));
  ok('nessun errore JS con la rete giu\'', a.errori.length === 0);
  await a.browser.close();

  // ---- 4. Previsione fresca: nessun allarme, e regge anche offline -------
  a = await apri({ initScript: [seme, { wx: inCache(Date.now() - 10 * 60 * 1000), rete: 'ko' }] });
  await a.menu('Calendario');
  await a.page.waitForTimeout(600);
  const t4 = await testo(a.page);
  ok('una previsione di dieci minuti fa non viene dichiarata vecchia', !/Previsioni vecchie/i.test(t4));
  ok('ma la data di scarico si vede lo stesso', /Previsioni del/i.test(t4));

  await a.ctx.setOffline(true);
  await a.page.reload({ waitUntil: 'load' });
  await a.page.waitForSelector('button[aria-label="Menu"]', { timeout: 20000 });
  await a.menu('Calendario');
  await a.page.waitForTimeout(400);
  const t5 = await testo(a.page);
  ok('offline la previsione in cache resta sullo schermo', /99°\s*\/\s*88°/.test(t5));
  ok('offline il tasto Aggiorna e\' spento',
    await a.page.locator('main button', { hasText: 'Aggiorna' }).first().isDisabled());
  await a.ctx.setOffline(false);
  ok('nessun errore JS offline', a.errori.length === 0);

  await fine(a.browser);
})();
