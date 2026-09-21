// La scala del testo esiste davvero, e regge in tutte le schermate.
//
// Il § 13 punto 3 ha sostituito dodici misure di testo con sei, dichiarate in
// index.html come token di Tailwind v4 (@theme). Questo cambiamento e' l'unico
// dei tre che NON si puo' provare col confronto del DOM: i nomi delle classi
// cambiano ovunque per definizione, quindi il confronto diventa cieco proprio
// dove servirebbe. Qui si guarda quello che vede il BROWSER.
//
// Tre pericoli, uno per verifica:
//
//   1. Un token scritto male non rompe niente: "text-piccolo" diventerebbe una
//      classe che non esiste, l'elemento erediterebbe la misura del genitore e
//      l'app resterebbe in piedi, solo con i caratteri sbagliati. Nessun errore
//      in console, nessuna prova rossa. Qui si misura il font-size calcolato.
//   2. Ingrandire il testo fa traboccare le scatole. Su un telefono stretto una
//      riga che prima stava su una va a capo, o esce di lato: si controlla che
//      la pagina non prenda uno scorrimento orizzontale.
//   3. Le misure tornano a moltiplicarsi. Si contano quelle che il browser
//      disegna davvero: devono restare quelle dichiarate, non una di piu'.
const { apri, ok, fine } = require('../lib/app');
const { semina, SCHERMATE } = require('../lib/schermate');

// Le sei, come stanno in index.html. Scritte qui a mano di proposito: se
// qualcuno cambia un token deve cambiare anche questa riga, e accorgersene.
const SCALA = { 'text-minuto': 9, 'text-piccolo': 11, 'text-normale': 14, 'text-medio': 16, 'text-grande': 18, 'text-titolo': 24 };

(async () => {
  // 360 px: il telefono stretto, non quello comodo. E' li' che una misura
  // cresciuta di un pixel si vede.
  const { browser, page, menu, errori } = await apri({ initScript: semina, viewport: { width: 360, height: 780 } });

  // ---------- 1. I token esistono e valgono quello che dicono ----------
  const misurate = await page.evaluate((scala) => {
    const fuori = [];
    Object.keys(scala).forEach((classe) => {
      const el = document.querySelector('.' + classe);
      if (!el) { fuori.push(classe + ': mai usata'); return; }
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (Math.abs(px - scala[classe]) > 0.5) fuori.push(classe + ': ' + px + 'px invece di ' + scala[classe]);
    });
    return fuori;
  }, SCALA);
  ok(`le ${Object.keys(SCALA).length} misure della scala valgono quello che dichiarano`
    + (misurate.length ? ' — ' + misurate.join('; ') : ''), misurate.length === 0);

  // ---------- 2. Niente trabocca, in nessuna schermata ----------
  const larghe = [];
  const misureViste = new Set();
  for (const [voce, sotto] of SCHERMATE) {
    const chiave = voce + (sotto ? ' / ' + sotto : '');
    await menu(voce, 6000);
    if (sotto) {
      const b = page.locator('main button', { hasText: new RegExp('^' + sotto + '$') }).first();
      if (await b.count()) { await b.click({ timeout: 4000 }); await page.waitForTimeout(200); }
    }
    await page.waitForTimeout(300);
    const esito = await page.evaluate(() => {
      const doc = document.documentElement;
      const misure = {};
      document.querySelectorAll('main *, header *, nav *').forEach((el) => {
        // Solo chi ha del testo suo: un contenitore vuoto eredita e basta.
        const proprio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!proprio) return;
        const px = Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10;
        misure[px] = (misure[px] || 0) + 1;
      });
      return { scorre: doc.scrollWidth - doc.clientWidth, misure };
    });
    if (esito.scorre > 1) larghe.push(chiave + ' (+' + esito.scorre + 'px)');
    Object.keys(esito.misure).forEach((px) => misureViste.add(Number(px)));
  }
  ok(`nessuna schermata trabocca di lato a 360 px (${SCHERMATE.length} guardate)`
    + (larghe.length ? ' — ' + larghe.join(', ') : ''), larghe.length === 0);

  // ---------- 3. Quante misure disegna davvero il browser ----------
  const ammesse = new Set(Object.values(SCALA));
  const intruse = [...misureViste].filter((px) => !ammesse.has(px)).sort((a, b) => a - b);
  ok(`il browser disegna solo le misure della scala (viste: ${[...misureViste].sort((a, b) => a - b).join(', ')})`
    + (intruse.length ? ' — INTRUSE: ' + intruse.join(', ') : ''), intruse.length === 0);

  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await browser.close();
  fine();
})();
