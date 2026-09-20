// Cambiare lingua, e vederla cambiare.
//
// La prova unitaria (unita/lingue) controlla il dizionario: che non manchi
// una chiave, che i plurali siano funzioni, che le date seguano la lingua.
// Quella non puo' controllare l'unica cosa che conta per chi usa l'app:
// **che toccando "Español" lo schermo cambi, senza riaprire niente**.
//
// E' il difetto che il § 18 nominava prima di scrivere una riga: se il
// traduttore legge una variabile globale invece dello stato di React,
// cambiare lingua non ridisegna e serve un ricaricamento. Qui si verifica
// che non succeda.
const { apri, ok, fine } = require('../lib/app');

const semina = () => {
  localStorage.setItem('cambusa_members', JSON.stringify([
    { id: 'a', name: 'Alice', isChild: false },
  ]));
  localStorage.setItem('cambusa_compiti', JSON.stringify([
    { id: 'k1', testo: 'Prendere la carne', chi: 'Alice', fatto: false },
  ]));
};

// La bandiera si accende intercettando APP_CONFIG: firebase-config.js lo
// riscrive per intero DOPO di noi, quindi impostarlo e basta non servirebbe.
const conLingue = (acceso) => [(s) => {
  let vero;
  Object.defineProperty(window, 'APP_CONFIG', {
    configurable: true,
    get() { return vero; },
    set(v) { vero = Object.assign({}, v, { features: Object.assign({}, v && v.features, { lingue: JSON.parse(s).acceso }) }); },
  });
  window.APP_CONFIG = {};
  // eslint-disable-next-line no-new-func
  new Function(JSON.parse(s).semina)();
}, JSON.stringify({ acceso, semina: '(' + semina.toString() + ')()' })];

const menuTesto = async (p) => {
  await p.locator('button[aria-label="Menu"]').click();
  await p.waitForTimeout(350);
  const t = await p.locator('body').innerText();
  await p.keyboard.press('Escape').catch(() => {});
  await p.waitForTimeout(200);
  return t;
};

(async () => {
  // ---------- Bandiera accesa ----------
  const { browser, page: p, menu, errori } = await apri({ initScript: conLingue(true) });
  await p.waitForTimeout(900);

  await menu('Impostazioni');
  await p.waitForTimeout(500);
  const imp = await p.locator('main').innerText();
  ok(`in Impostazioni c'è il selettore della lingua (${/Lingua/.test(imp) ? 'sì' : 'no'})`, /Lingua/.test(imp));
  // Il maiuscolo dei bottoni e' CSS, non testo: il confronto va fatto senza
  // badare alle maiuscole. E' la terza volta che questa trappola scatta.
  ok('con le tre lingue', /italiano/i.test(imp) && /espa[nñ]ol/i.test(imp) && /fran[cç]ais/i.test(imp));

  // --- Si parte in italiano ---
  const menuIt = await menuTesto(p);
  ok('si parte in italiano', /CHI FA COSA/i.test(menuIt) && /LISTA DELLA SPESA/i.test(menuIt));

  // --- Si passa allo spagnolo, SENZA ricaricare ---
  await menu('Impostazioni');
  await p.waitForTimeout(400);
  await p.locator('main button', { hasText: /^Español$/ }).first().click();
  await p.waitForTimeout(500);

  const menuEs = await menuTesto(p);
  ok(`il menu passa allo spagnolo senza ricaricare (${/QUIÉN HACE QUÉ/i.test(menuEs) ? 'sì' : 'no'})`,
    /QUIÉN HACE QU/i.test(menuEs));
  ok('e la Lista della Spesa pure', /LISTA DE LA COMPRA/i.test(menuEs));
  ok('mentre l\'italiano è sparito', !/LISTA DELLA SPESA/i.test(menuEs));

  // --- Anche dentro una scheda ---
  await menu('Quién hace qué');
  await p.waitForTimeout(500);
  const schedaEs = await p.locator('main').innerText();
  ok(`la scheda è in spagnolo (${(schedaEs.match(/Asignar una tarea/) || ['no'])[0]})`,
    /Asignar una tarea/.test(schedaEs) && /Pendientes/.test(schedaEs));
  ok('e la frase col grassetto non si è spezzata', /qui[eé]n hace qu[eé]/i.test(schedaEs));
  // Quello che scrive l'utente NON si traduce: resta com'è. Sta dentro un
  // campo di testo, e innerText non legge i valori dei campi.
  const scritti = await p.evaluate(() => [...document.querySelectorAll('main li input')].map((i) => i.value));
  ok(`ma quello che ha scritto l'utente resta com'era (${scritti.join(' | ')})`,
    scritti.some((v) => /Prendere la carne/.test(v)));

  // --- La lingua resta dopo il riavvio ---
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(1000);
  const menuDopo = await menuTesto(p);
  ok(`riaprendo l'app resta lo spagnolo (${/QUIÉN/i.test(menuDopo) ? 'sì' : 'no'})`, /QUI[EÉ]N HACE QU/i.test(menuDopo));

  // --- E il francese ---
  await menu('Ajustes');
  await p.waitForTimeout(400);
  await p.locator('main button', { hasText: /^Français$/ }).first().click();
  await p.waitForTimeout(500);
  const menuFr = await menuTesto(p);
  ok(`e si passa al francese (${/QUI FAIT QUOI/i.test(menuFr) ? 'sì' : 'no'})`, /QUI FAIT QUOI/i.test(menuFr));

  // --- Le date seguono la lingua ---
  await menu('Calendrier');
  await p.waitForTimeout(600);
  const cal = await p.locator('main').innerText();
  ok(`anche le date seguono la lingua (${(cal.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i) || ['no'])[0]})`,
    /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i.test(cal));
  ok('e non è rimasto l\'italiano', !/\b(luned|marted|mercoled|gioved|venerd|sabato|domenica)/i.test(cal));

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await browser.close();

  // ---------- Bandiera spenta ----------
  const spenta = await apri({ initScript: conLingue(false) });
  await spenta.page.waitForTimeout(900);
  await spenta.menu('Impostazioni');
  await spenta.page.waitForTimeout(500);
  const impSpenta = await spenta.page.locator('main').innerText();
  ok(`con la bandiera spenta il selettore non c'è (${/Español/.test(impSpenta) ? "c'è ancora" : 'sparito'})`,
    !/Español/.test(impSpenta) && !/Français/.test(impSpenta));
  const menuSpento = await menuTesto(spenta.page);
  ok('e l\'app resta in italiano', /LISTA DELLA SPESA/i.test(menuSpento));
  ok('nessun errore JavaScript con la bandiera spenta' + (spenta.errori.length ? ': ' + spenta.errori.join(' | ') : ''),
    spenta.errori.length === 0);

  await fine(spenta.browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
