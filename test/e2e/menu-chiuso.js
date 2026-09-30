// Il menu a gruppi che si chiudono, e «Come funziona» a capitoli (30 settembre).
//
// Il menu aveva sedici voci aperte tutte insieme: per trovare la propria si
// scorreva. Adesso i gruppi sono intestazioni che si aprono e si chiudono, e
// chi non ha mai toccato niente trova aperto solo il gruppo della scheda in
// cui e'. Il telefono si ricorda quali hai aperto.
//
// Le altre prove partono con tutti i gruppi aperti (test/lib/app.js): questa
// e' l'unica che guarda il menu come lo trova una persona.
//
// La guida era un muro di venti pillole con un testo solo sotto. Adesso: i tre
// passi in cima, poi capitoli con righe che si aprono una alla volta. E
// nessuna voce del dizionario deve restare fuori da un capitolo — non si
// vedrebbe piu', e nessuno se ne accorgerebbe.
const { apri, ok, fine, attendi } = require('../lib/app');

const statoMenu = (p) => p.evaluate(() => {
  const g = {};
  document.querySelectorAll('nav button[data-gruppo]').forEach((b) => { g[b.getAttribute('data-gruppo')] = b.getAttribute('aria-expanded') === 'true'; });
  return { gruppi: g, voci: [...document.querySelectorAll('nav button[data-voce]')].map((b) => b.getAttribute('data-voce')) };
});
const apriMenu = async (p) => { await p.click('button[aria-label="Menu"]'); await p.waitForTimeout(350); };

(async () => {
  const a = await apri({ admin: false, menuChiuso: true });
  const p = a.page;

  // ---------- Il menu, la prima volta ----------
  await apriMenu(p);
  const primo = await statoMenu(p);
  ok(`i gruppi sono intestazioni che si aprono (${Object.keys(primo.gruppi).join(', ')})`,
    Object.keys(primo.gruppi).join(',') === 'pianificazione,spese,gruppo,altro');
  ok(`la prima volta è aperto solo il gruppo in cui sei (${JSON.stringify(primo.gruppi)})`,
    primo.gruppi.pianificazione === true && !primo.gruppi.spese && !primo.gruppi.gruppo && !primo.gruppi.altro);
  ok(`e le voci degli altri non si vedono (${primo.voci.join(', ')})`,
    primo.voci.includes('calendario') && !primo.voci.includes('lista') && !primo.voci.includes('impostazioni'));

  // Si apre un gruppo e si va a una sua voce.
  await p.click('nav button[data-gruppo="spese"]');
  await attendi(p, () => !!document.querySelector('nav button[data-voce="lista"]'));
  ok('toccando l\'intestazione il gruppo si apre', (await statoMenu(p)).gruppi.spese === true);
  await p.click('nav button[data-voce="lista"]');
  await attendi(p, () => /lista della spesa/i.test(document.querySelector('header').innerText));
  ok('e le sue voci portano alla scheda', true);

  // Si chiude il gruppo di prima: il telefono se lo ricorda.
  await apriMenu(p);
  await p.click('nav button[data-gruppo="pianificazione"]');
  await p.waitForTimeout(200);
  const dopo = await statoMenu(p);
  ok(`un gruppo si richiude, e l'altro resta aperto (${JSON.stringify(dopo.gruppi)})`,
    dopo.gruppi.pianificazione === false && dopo.gruppi.spese === true && !dopo.voci.includes('calendario'));
  // Il gruppo chiuso con dentro la scheda in cui sei ha un segno: qui no,
  // si e' in Lista, che sta nel gruppo aperto.
  await p.reload({ waitUntil: 'load' });
  await p.waitForSelector('button[aria-label="Menu"]');
  await apriMenu(p);
  const ricaricato = await statoMenu(p);
  ok(`riaprendo l'app i gruppi sono come li avevi lasciati (${JSON.stringify(ricaricato.gruppi)})`,
    ricaricato.gruppi.pianificazione === false && ricaricato.gruppi.spese === true);

  // ---------- Come funziona ----------
  await p.click('nav button[data-gruppo="altro"]');
  await p.click('nav button[data-voce="guida"]');
  await attendi(p, () => !!document.querySelector('[data-capitolo]'));
  const guida = await p.evaluate(() => {
    const passi = document.querySelector('[data-tre-passi]');
    const primoCap = document.querySelector('[data-capitolo]');
    const voci = [...document.querySelectorAll('[data-guida]')].map((b) => b.getAttribute('data-guida'));
    const nelDizionario = Object.keys(window.Lingue.DIZIONARI.it)
      .map((k) => (/^guida\.([a-z]+)\.titolo$/.exec(k) || [])[1]).filter(Boolean)
      .filter((k) => k !== 'campo' || (window.FEATURES && window.FEATURES.rooms) || document.querySelector('[data-guida="campo"]'));
    return {
      passiInCima: !!passi && !!primoCap && !!(passi.compareDocumentPosition(primoCap) & Node.DOCUMENT_POSITION_FOLLOWING),
      capitoli: [...document.querySelectorAll('[data-capitolo]')].map((c) => c.getAttribute('data-capitolo')),
      voci, fuori: nelDizionario.filter((k) => !voci.includes(k)), doppie: voci.filter((k, i) => voci.indexOf(k) !== i),
      aperte: document.querySelectorAll('[data-guida][aria-expanded="true"]').length,
    };
  });
  ok('i tre passi per cominciare stanno in cima', guida.passiInCima);
  ok(`le voci sono divise in capitoli (${guida.capitoli.join(', ')})`, guida.capitoli.join(',') === 'partire,campo,spese,conti,dati');
  ok(`ogni voce della guida sta in un capitolo (${guida.voci.length} voci${guida.fuori.length ? ', FUORI: ' + guida.fuori.join(', ') : ''})`,
    guida.fuori.length === 0 && guida.voci.length >= 20);
  ok(`e in uno solo${guida.doppie.length ? ' — DOPPIE: ' + guida.doppie.join(', ') : ''}`, guida.doppie.length === 0);
  ok('all\'inizio sono tutte chiuse', guida.aperte === 0);

  await p.click('[data-guida="separato"]');
  await attendi(p, () => document.querySelector('[data-guida="separato"]').getAttribute('aria-expanded') === 'true');
  const testo = await p.locator('[data-capitolo="conti"]').innerText();
  ok('toccando una voce si legge il suo testo', /cassa a parte/i.test(testo));
  await p.click('[data-guida="saldi"]');
  await p.waitForTimeout(200);
  ok('aprendone un\'altra, la prima si chiude',
    (await p.locator('[data-guida][aria-expanded="true"]').count()) === 1
    && (await p.locator('[data-guida="saldi"]').getAttribute('aria-expanded')) === 'true');
  // Il testo racconta l'app di oggi: la spesa si registra col tasto, non con
  // la maschera che non c'e' piu'.
  await p.click('[data-guida="lista"]');
  ok('la guida parla del tasto «+ Spesa», non della vecchia maschera',
    /\+ spesa/i.test(await p.locator('[data-capitolo="spese"]').innerText()) && !/maschera per registrare/i.test(await p.locator('main').innerText()));

  ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
  await a.browser.close();
  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
