// I colori che il browser disegna davvero, e se si leggono.
//
// Questa prova nasce prima di cambiare la tavolozza (§ 13 / Camp Ops), e
// nasce perche' l'unica rete che avevamo qui non serve: il confronto del DOM
// e' CIECO quando a cambiare sono le classi e i colori. Il DOM resta identico
// al carattere mentre a schermo non si legge piu' niente.
//
// C'e' una trappola piu' cattiva della semplice svista, e il cambio di
// tavolozza la sfiora da vicino: il tema scuro si aggancia all'esadecimale
// scritto DENTRO il nome della classe —
//
//     :root[data-theme="dark"] [class*="bg-[#F0F4F1]"] { ... }
//
// — quindi rinominare le classi in token (bg-bosco) fa smettere di funzionare
// diciassette regole in silenzio. Nessun errore, nessuna classe mancante:
// semplicemente il CSS non si applica, il testo chiaro resta su fondo chiaro,
// e chi usa il tema scuro vede una pagina bianca di testo invisibile. Qui si
// misura il colore CALCOLATO, che e' l'unica cosa che non si puo' fingere.
//
// ---------- Come e' fatta, e perche' non e' "niente sotto 4,5:1" ----------
//
// L'app di oggi e' gia' sotto soglia in centoventicinque punti. Una prova che
// pretendesse la perfezione nascerebbe rossa, e una prova che nasce rossa non
// la guarda nessuno. Allora si dichiara il DEBITO che c'e' — coppia per
// coppia, con il suo rapporto — e si chiede due cose:
//
//   1. che non ne nasca una nuova (e' questa che ferma il cambio di tavolozza
//      sbagliato, e l'arancio del logo sotto del testo: 2,24:1 sul crema);
//   2. che quelle dichiarate esistano ancora davvero. Senza questa meta',
//      l'elenco marcisce: si ripara un colore, la riga resta, e continua a
//      dare il permesso a un problema che non c'e' piu'. E' la stessa regola
//      delle lingue — "non ne avanza nessuna" serve quanto "non ne manca".
const { apri, ok, fine } = require('../lib/app');
const { semina, SCHERMATE } = require('../lib/schermate');

// Il debito di partenza, misurato il 22 settembre 2026 sulla tavolozza della
// Brigata, con la sonda che fa dipingere i colori al browser. La prima
// versione della sonda leggeva le notazioni con una regex e ne dichiarava
// sette: ne saltava meta', perche' ogni classe con opacita' esce in oklab()
// e quella regex non la capiva. Il debito vero e' questo, ed e' piu' grosso.
//
// Ogni riga e' "testo su sfondo". Quando un colore si ripara, la sua riga va
// TOLTA da qui, o la prova diventa rossa apposta.
//
// #25D366 e' il verde di WhatsApp: quello non si tocca, e' il loro marchio e
// il bottone deve somigliare al loro. Resta dichiarato, non riparato.
const DEBITO = {
  light: [
    '#6A7282 su #E5E7EB',   // 3,91 — text-gray-500 di Tailwind
    '#6A7282 su #F4F5F4',   // 4,43 — a un soffio
    '#7B8A78 su #2D392C',   // 3,32 — salvia semitrasparente sul militare
    '#8F9E8B su #2D392C',   // 4,29
    '#8F9E8B su #F0F4F1',   // 2,55 — le etichette di sezione, il peggiore
    '#8F9E8B su #FFFFFF',   // 2,83
    '#99A1AF su #E7E4E2',   // 2,06 — text-gray-400, il peggiore in assoluto
    '#99A1AF su #F0F4F1',   // 2,34
    '#99A1AF su #F6F8F7',   // 2,44
    '#99A1AF su #FFFFFF',   // 2,60
    '#D97706 su #2D392C',   // 3,80
    '#D97706 su #FFFFFF',   // 3,19
    '#FFFFFF su #25D366',   // 1,98 — WhatsApp, per contratto
    '#FFFFFF su #D97706',   // 3,19
  ],
  dark: [
    '#7B8A78 su #2D392C',   // 3,32
    '#8C988B su #2C352B',   // 4,23
    '#8C988B su #2D392C',   // 4,03
    '#8F9E8B su #2D392C',   // 4,29
    '#D97706 su #2D392C',   // 3,80
    '#FFFFFF su #25D366',   // 1,98 — WhatsApp, per contratto
    '#FFFFFF su #D97706',   // 3,19
  ],
};

// Quante coppie colore/sfondo distinte puo' disegnare l'app. Non e' un numero
// tondo per caso: e' quello misurato piu' un po' di respiro. Serve a prendere
// la tavolozza che si moltiplica — dodici misure di testo diventate sei
// avevano cominciato cosi'.
const TETTO = { light: 48, dark: 44 };

const SONDA = () => {
  // I colori NON si interpretano: si fanno dipingere al browser. Tailwind
  // emette `oklab(... / 0.5)` per ogni classe con opacita' — bg-carta/50,
  // border-salvia/30, e sono centosettanta nell'app — e una regex su rgba()
  // li salta in silenzio. Saltarli non vuol dire misurare di meno: vuol dire
  // misurare il contrasto contro lo sfondo SBAGLIATO, perche' la risalita
  // prosegue fino a un antenato che quel colore non ce l'ha. Un buco che
  // rassicura a vuoto, che e' peggio di nessuna misura.
  //
  // Con il canvas la notazione non conta piu': quello che si legge e' quello
  // che verrebbe dipinto, oggi e con qualunque notazione Tailwind inventi.
  const tela = document.createElement('canvas');
  tela.width = 1; tela.height = 1;
  const pennello = tela.getContext('2d', { willReadFrequently: true });
  const memoria = {};
  const risolvi = (css) => {
    if (memoria[css]) return memoria[css];
    pennello.clearRect(0, 0, 1, 1);
    pennello.fillStyle = '#000000';
    pennello.fillStyle = css;          // se non la capisce resta nero: si vede
    pennello.fillRect(0, 0, 1, 1);
    const d = pennello.getImageData(0, 0, 1, 1).data;
    memoria[css] = { rgb: [d[0], d[1], d[2]], a: d[3] / 255 };
    return memoria[css];
  };
  // Un colore semitrasparente sopra un altro: quello che si VEDE e' la
  // mescolanza, non nessuno dei due.
  const sopra = (f, s) => f.rgb.map((v, i) => Math.round(f.a * v + (1 - f.a) * s[i]));

  const lum = (c) => {
    const v = c.map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const rapporto = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const hex = (c) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase();

  // Lo sfondo vero: si risale raccogliendo gli strati finche' non se ne trova
  // uno che copre, poi si mescolano dal fondo verso l'alto. Fermarsi al primo
  // strato semitrasparente darebbe un colore che nessuno vede davvero.
  const sfondoDi = (el) => {
    const strati = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const c = risolvi(getComputedStyle(n).backgroundColor);
      if (c.a > 0) strati.push(c);
      if (c.a >= 0.999) break;
      n = n.parentElement;
    }
    const radice = risolvi(getComputedStyle(document.documentElement).backgroundColor);
    let sotto = radice.a >= 0.999 ? radice.rgb : [255, 255, 255];
    for (let i = strati.length - 1; i >= 0; i -= 1) sotto = sopra(strati[i], sotto);
    return sotto;
  };

  const sotto = {};
  const coppie = {};
  document.querySelectorAll('main *, header *, nav *').forEach((el) => {
    // Solo chi ha del testo suo: un contenitore vuoto eredita e basta.
    const proprio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!proprio) return;
    // Le emoji hanno i colori loro e non li prendono dal CSS: un elemento
    // fatto solo di simboli darebbe un falso allarme a ogni giro.
    if (!/[\p{L}\p{N}]/u.test(el.innerText || '')) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const st = getComputedStyle(el);
    const t = risolvi(st.color);
    if (t.a < 0.1) return;                       // testo invisibile apposta
    const s = sfondoDi(el);
    const testo = t.a >= 0.999 ? t.rgb : sopra(t, s);
    const chiave = hex(testo) + ' su ' + hex(s);
    coppie[chiave] = true;
    const px = parseFloat(st.fontSize);
    // La soglia WCAG AA: 3 per il testo grande, 4,5 per tutto il resto.
    const grosso = px >= 18.66 || (px >= 14 && Number(st.fontWeight) >= 700);
    const cr = rapporto(testo, s);
    if (cr < (grosso ? 3 : 4.5)) sotto[chiave] = Math.round(cr * 100) / 100;
  });
  return { sotto, coppie: Object.keys(coppie) };
};

(async () => {
  let erroriTotali = [];
  for (const tema of ['light', 'dark']) {
    const { browser, page, menu, errori } = await apri({ initScript: semina, viewport: { width: 360, height: 780 } });
    await page.evaluate((t) => { document.documentElement.setAttribute('data-theme', t); }, tema);
    await page.waitForTimeout(300);

    const sotto = {};
    const coppie = new Set();
    for (const [voce, subvoce] of SCHERMATE) {
      await menu(voce, 6000);
      if (subvoce) {
        const b = page.locator('main button', { hasText: new RegExp('^' + subvoce + '$') }).first();
        if (await b.count()) { await b.click({ timeout: 4000 }); await page.waitForTimeout(200); }
      }
      await page.waitForTimeout(250);
      const r = await page.evaluate(SONDA);
      Object.entries(r.sotto).forEach(([k, v]) => { sotto[k] = v; });
      r.coppie.forEach((c) => coppie.add(c));
    }

    const noti = new Set(DEBITO[tema]);
    const nuove = Object.keys(sotto).filter((k) => !noti.has(k))
      .map((k) => k + ' (' + sotto[k] + ':1)');
    ok(`[${tema}] nessun colore nuovo sotto soglia`
      + (nuove.length ? ' — NUOVE: ' + nuove.join(', ') : ''), nuove.length === 0);

    // La meta' che impedisce all'elenco di marcire.
    const sparite = DEBITO[tema].filter((k) => !(k in sotto));
    ok(`[${tema}] le ${DEBITO[tema].length} coppie dichiarate esistono ancora`
      + (sparite.length ? ' — RIPARATE, TOGLILE DA DEBITO: ' + sparite.join(', ') : ''),
      sparite.length === 0);

    ok(`[${tema}] la tavolozza non si moltiplica (${coppie.size} coppie, tetto ${TETTO[tema]})`,
      coppie.size <= TETTO[tema]);

    erroriTotali = erroriTotali.concat(errori);
    await browser.close();
  }
  ok('nessun errore JavaScript' + (erroriTotali.length ? ': ' + erroriTotali.join(' | ') : ''),
    erroriTotali.length === 0);
  fine();
})();
