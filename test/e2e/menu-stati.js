// Il menu racconta lo stato in cui sei.
//
// Fuori da un campo quasi tutte le aree parlano di dati che non esistono: il
// Calendario mostra una settimana vuota, i Saldi conti a zero, la Galleria
// nessuna foto. Un menu pieno di sezioni vuote non e' generoso, e' confuso —
// sembra un'app rotta invece di un'app che aspetta una cosa sola.
//
// La REGOLA (quali voci restano) e' pura e sta in stanza.js, provata senza
// browser da unita/stanza. Ma una regola pura non sa se qualcuno la chiama:
// se App() smettesse di passare da `Stanza.gruppiMenu`, quella prova
// resterebbe verde e il menu tornerebbe pieno. E' la trappola gia' scritta in
// CLAUDE.md — una prova che sostituisce un pezzo non puo' verificare quel
// pezzo — vista dall'altro lato: qui si guarda il collegamento, non la regola.
//
// La meta' che conta di piu' e' la SECONDA: dentro un campo il menu deve
// restare intero. Una prova che controlla solo che fuori sia corto passerebbe
// anche con un menu sempre vuoto.
const { apri, ok, fine } = require('../lib/app');

const vociDelMenu = async (page) => {
  await page.locator('header button').first().click();
  await page.waitForTimeout(400);
  return page.evaluate(() => [...document.querySelectorAll('nav button')]
    .map((b) => b.innerText.trim()).filter(Boolean));
};

(async () => {
  // ---------- Fuori da un campo ----------
  // La stanza si toglie PRIMA dell'apertura, nello script di avvio: messa
  // dopo con un page.evaluate, l'app l'avrebbe gia' letta e il menu sarebbe
  // gia' stato disegnato (CLAUDE.md, il sabotaggio che non produceva rosso).
  const fuori = await apri({
    // Non basta togliere la stanza: un campo c'e' anche quando arriva dal
    // codice salvato o da quello predefinito, ed e' giusto cosi' — sono le
    // stesse tre strade da cui la sincronizzazione prende il codice. Per
    // essere DAVVERO senza campo vanno tolte tutte e tre.
    initScript: () => {
      try {
        localStorage.removeItem('cambusa_stanza');
        localStorage.removeItem('cambusa_camp_code');
        // Lo script di avvio gira PRIMA di firebase-config.js, che poi
        // riassegna CAMP_CODE_DEFAULT: un'assegnazione qui verrebbe
        // sovrascritta e la prova misurerebbe un'app che il campo ce l'ha.
        // Si blocca la proprieta' invece di scriverla — lo stesso modo con
        // cui le prove si installano un blocco loro.
        Object.defineProperty(window, 'CAMP_CODE_DEFAULT',
          { value: '', writable: false, configurable: true });
      } catch (e) { /* niente */ }
    },
    viewport: { width: 390, height: 900 },
  });
  const senza = await vociDelMenu(fuori.page);
  ok(`senza campo il menu ha tre voci (${senza.length}: ${senza.join(', ')})`, senza.length === 3);
  // Il confronto sul testo a schermo va sempre con /i: i bottoni sono in
  // maiuscolo per CSS e innerText restituisce il disegnato, non il DOM.
  ok('e sono creare, partecipare, impostazioni',
    /crea un campo/i.test(senza[0]) && /partecipa/i.test(senza[1]) && /impostazioni/i.test(senza[2]));
  ok('nessuna area che parlerebbe di dati inesistenti',
    !senza.some((v) => /calendario|presenze|spese totali|galleria/i.test(v)));
  ok('nessun errore JavaScript' + (fuori.errori.length ? ': ' + fuori.errori.join(' | ') : ''),
    fuori.errori.length === 0);
  await fuori.browser.close();

  // ---------- Dentro un campo ----------
  const dentro = await apri({
    initScript: () => { try { localStorage.setItem('cambusa_stanza', 'TS9N-TC43'); } catch (e) { /* niente */ } },
    viewport: { width: 390, height: 900 },
  });
  const con = await vociDelMenu(dentro.page);
  ok(`dentro un campo il menu torna intero (${con.length} voci)`, con.length >= 14);
  ok('e ci sono le aree vere', ['calendario', 'presenze', 'spese totali', 'galleria', 'impostazioni']
    .every((v) => con.some((x) => new RegExp(v, 'i').test(x))));
  ok('le due azioni spariscono: il campo ce l\'hai gia\'',
    !con.some((v) => /crea un campo|partecipa a un campo/i.test(v)));
  ok('nessun errore JavaScript' + (dentro.errori.length ? ': ' + dentro.errori.join(' | ') : ''),
    dentro.errori.length === 0);
  await dentro.browser.close();

  fine();
})();
