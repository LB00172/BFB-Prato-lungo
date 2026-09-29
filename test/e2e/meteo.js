// Meteo: una sola previsione per tutto il campo, e nessun modo di restare
// appesi a una previsione morta. Il caso che conta e' quello dell'orologio
// avanti: un telefono che data il bollettino nel futuro lo rende per giorni
// il piu' recente per tutti, e da quel momento nessuno lo sostituisce piu'.
const { apri, ok, fine, attendi } = require('../lib/app');

const GIORNO = 24 * 60 * 60 * 1000;
const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// I giorni che il bollettino finto deve coprire.
//
// Il Calendario apre sul giorno di inizio campo, non su oggi: con una finestra
// "oggi piu' o meno trenta giorni" la prova funzionava finche' il campo era
// vicino, e dal 10 settembre 2026 ha cominciato a fallire da sola — undici
// verifiche rosse per un motivo che col meteo non c'entrava niente. Una prova
// che scade col calendario non e' una rete di sicurezza: e' una sveglia che
// suona a caso.
//
// Le date del campo si leggono dal sorgente invece di riscriverle: se un anno
// cambiano, la prova le segue.
const CONF = require('fs').readFileSync(
  require('path').resolve(__dirname, '..', '..', 'src', '40-configurazione.jsx'), 'utf8');
const dataDi = (nome) => {
  const m = CONF.match(new RegExp('const ' + nome + " = '(\\d{4}-\\d{2}-\\d{2})'"));
  if (!m) throw new Error('non trovo ' + nome + ' in src/40-configurazione.jsx');
  const [a, me, g] = m[1].split('-').map(Number);
  return new Date(a, me - 1, g).getTime();
};
// Le date di ripiego: il campo di prova non e' una stanza, e usa quelle.
const INIZIO = dataDi('CAMP_START_PREDEFINITO');
const FINE = dataDi('CAMP_END_PREDEFINITO');
const oggi = Date.now();
// Dal piu' indietro fra "un mese fa" e "il giorno prima del campo", al piu'
// avanti fra "fra un mese" e "il giorno dopo il campo".
const DA = Math.min(oggi - 30 * GIORNO, INIZIO - GIORNO);
const A = Math.max(oggi + 30 * GIORNO, FINE + GIORNO);
const giorniCoperti = () => {
  const out = [];
  for (let t = DA; t <= A; t += GIORNO) out.push(ds(new Date(t)));
  return out;
};

// Bollettino finto con tutti i giorni uguali: cosi' la verifica sull'interfaccia
// non dipende da quale giorno risulti selezionato. La finestra e' larga (dal
// mese scorso al mese prossimo) perche' il Calendario apre sul giorno di inizio
// campo, che non e' quasi mai oggi.
// opz.orario(ora) -> codice WMO di quell'ora. Il valore giornaliero resta il
// PIU' SEVERO delle 24 ore, come fa Open-Meteo davvero: e' la differenza fra
// quello e le ore che l'app deve saper raccontare.
function bollettino(tmax, tmin, code, rain, opz) {
  const o = opz || {};
  const orario = o.orario || (() => code);
  const time = [], weather_code = [], temperature_2m_max = [], temperature_2m_min = [], precipitation_probability_max = [];
  const precipitation_sum = [], precipitation_hours = [], precipitation_probability_mean = [];
  const hTime = [], hCode = [], hProb = [];
  giorniCoperti().forEach((g) => {
    time.push(g);
    weather_code.push(code); temperature_2m_max.push(tmax);
    temperature_2m_min.push(tmin); precipitation_probability_max.push(rain);
    precipitation_sum.push(o.mm === undefined ? null : o.mm);
    precipitation_hours.push(o.ore === undefined ? null : o.ore);
    precipitation_probability_mean.push(o.rmed === undefined ? null : o.rmed);
    for (let h = 0; h < 24; h++) {
      hTime.push(g + 'T' + String(h).padStart(2, '0') + ':00');
      hCode.push(orario(h)); hProb.push(rain);
    }
  });
  // "elevation" e' la quota che il modello ha usato davvero: e' il modo di
  // accorgersi che si sta guardando il meteo del paese invece che del prato.
  return {
    elevation: 1043,
    daily: { time, weather_code, temperature_2m_max, temperature_2m_min, precipitation_probability_max,
             precipitation_probability_mean, precipitation_sum, precipitation_hours },
    hourly: { time: hTime, weather_code: hCode, precipitation_probability: hProb },
  };
}

// Previsione gia' in cache sul telefono, con una temperatura impossibile che
// si riconosce a colpo d'occhio se rimane appiccicata allo schermo.
// Scaricata per il luogo del campo, salvo che la prova ne dica un altro.
function inCache(quando, dove) {
  const byDate = {};
  giorniCoperti().forEach((g) => {
    byDate[g] = { code: 0, tmax: 99, tmin: 88, rain: 3 };
  });
  return Object.assign({ fetchedAt: quando, stampa: quando, byDate, lat: 42.0486, lon: 13.14855 }, dove);
}

// Semina la cache e sostituisce la chiamata a Open-Meteo: le prove non devono
// dipendere dalla rete vera, ne' per esserci ne' per mancare.
const seme = (o) => {
  // Il luogo del campo: nell'app pubblica firebase-config.js non ne ha piu'
  // uno (il meteo e' spento finche' non lo sceglie il capogruppo). Qui se ne
  // da' uno di prova, come il campo di prova di test/lib/app.js.
  Object.defineProperty(window, 'CAMP_LOCATION', {
    configurable: true,
    get() { return { lat: 42.0486, lon: 13.14855, alt: 1337, label: 'Luogo di prova' }; },
    set() { /* firebase-config.js assegna null dopo di noi: vale il nostro */ },
  });
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
  ok('senza millimetri si mostra ancora la probabilita\'', /40%/.test(t2));
  ok('la quota usata dal modello viene conservata',
    (await a.page.evaluate(() => (JSON.parse(localStorage.getItem('cambusa_weather') || '{}')).quota)) === 1043);
  ok('in modalita\' tecnica si vede da dove viene il meteo', /1043 m/.test(t2));
  // Le coordinate si leggono dalla configurazione, non si scrivono qui: un
  // giorno il campo si sposta e la prova non deve diventare una bugia.
  const luogo = await a.page.evaluate(() => window.CAMP_LOCATION);
  ok('e si vedono le coordinate interrogate', t2.indexOf(String(luogo.lat)) >= 0);
  ok('e la quota dichiarata nella configurazione',
    typeof luogo.alt !== 'number' || t2.indexOf(String(luogo.alt) + ' m') >= 0);
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
  const luogoN = await a.page.evaluate(() => window.CAMP_LOCATION);
  ok('ne\' le coordinate', tn.indexOf('📍 ' + luogoN.lat) < 0);
  await a.browser.close();

  // ---- 2-ter. La forma della giornata, non il suo momento peggiore --------
  // Il caso che rende il meteo dell'app inutilizzabile: Open-Meteo dichiara il
  // giorno "temporale" perche' il codice giornaliero e' il piu' severo delle 24
  // ore. Ma le ore dicono sole tutto il giorno e due ore di temporale alle 16.
  // Per chi deve decidere se fare la camminata sono due informazioni diverse.
  a = await apri({ initScript: [seme, {
    wx: inCache(Date.now() - 2 * GIORNO),
    risposta: bollettino(24, 12, 95, 40, { mm: 2.4, ore: 2, rmed: 11, orario: (o) => (o >= 16 && o <= 17 ? 95 : 1) }),
  }] });
  await a.menu('Calendario');
  await attendi(a.page, () => {
    const w = JSON.parse(localStorage.getItem('cambusa_weather') || '{}');
    return w.byDate && w.byDate[Object.keys(w.byDate)[0]].tmax === 24;
  }, null, 15000).catch(() => {});
  const tf = await testo(a.page);
  ok('la faccia della giornata e\' la condizione prevalente, non la peggiore',
    /Poco nuvoloso/.test(tf));
  ok('e il brutto viene detto a parte, col suo momento',
    /temporale nel pomeriggio/i.test(tf));
  ok('si mostrano i millimetri invece della probabilita\' dell\'ora peggiore',
    /2,4 mm/.test(tf) && !/40%/.test(tf));
  // Il codice severo del giorno non si butta: serve alla compatibilita' e a chi
  // legge il dato grezzo.
  const grezzo = await a.page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem('cambusa_weather') || '{}');
    return w.byDate[Object.keys(w.byDate)[0]];
  });
  ok('il codice giornaliero severo resta nel dato salvato', grezzo.code === 95);
  ok('e accanto ci sono la condizione prevalente e l\'ora peggiore',
    grezzo.giorno === 1 && grezzo.peggio === 95 && grezzo.ora === 16);
  ok('nessun errore JS', a.errori.length === 0);
  await a.browser.close();

  // ---- 2-quater. Ma se piove davvero tutto il giorno, si dice -------------
  // La difesa contro l'ottimismo di comodo: ammorbidire una giornata brutta
  // sarebbe peggio del problema che stiamo risolvendo.
  a = await apri({ initScript: [seme, {
    wx: inCache(Date.now() - 2 * GIORNO),
    risposta: bollettino(14, 10, 61, 90, { mm: 18, ore: 20, rmed: 85 }),
  }] });
  await a.menu('Calendario');
  await attendi(a.page, () => {
    const w = JSON.parse(localStorage.getItem('cambusa_weather') || '{}');
    return w.byDate && w.byDate[Object.keys(w.byDate)[0]].tmax === 14;
  }, null, 15000).catch(() => {});
  const tp = await testo(a.page);
  ok('una giornata di pioggia resta una giornata di pioggia', /Pioggia/.test(tp));
  ok('e non si aggiunge un momento inutile', !/in mattinata|nel pomeriggio|in serata/i.test(tp));
  ok('i millimetri veri si vedono', /18 mm/.test(tp));
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

  // ---- 3-bis. La previsione di un altro posto non si mostra -------------
  // Il capogruppo ha cambiato il luogo del campo, e senza linea la nuova
  // previsione non arriva: quella in cache e' del posto di prima. Mostrarla
  // vorrebbe dire dare il meteo della Valle d'Aosta a chi e' in Abruzzo.
  a = await apri({ initScript: [seme, { wx: inCache(Date.now() - 10 * 60 * 1000, { lat: 45.7, lon: 7.3 }), rete: 'ko' }] });
  await a.menu('Calendario');
  await a.page.waitForTimeout(600);
  ok('la previsione in cache di un altro luogo non si spaccia per questa', !/99°\s*\/\s*88°/.test(await testo(a.page)));
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
