// Semina condivisa e cattura del DOM, schermata per schermata.
//
// Serve alla divisione di 80-app.jsx: spostare pezzi di interfaccia in un
// altro sorgente non deve cambiare NIENTE di quello che finisce a schermo.
// Le prove end-to-end guardano quello che sanno guardare; qui si confronta
// l'HTML prodotto per intero, che e' l'unico modo di accorgersi di una riga
// sparita in un ramo che nessuno visita.
const L = { lunch: true, dinner: true };

const semina = () => {
  const P = { lunch: true, dinner: false };
  const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  set('cambusa_members', [
    { id: 'a', name: 'Alice', isChild: false, paypal: 'alice@pp.it' },
    { id: 'b', name: 'Bruno', isChild: false, iban: 'IT60X0542811101000000123456' },
    { id: 'c', name: 'Carlo', isChild: false },
    { id: 'k', name: 'Cleo', isChild: true },
  ]);
  set('cambusa_camp_data', {
    '2026-08-12': { note: 'Pasta al pomodoro', appunti: 'turno di Bruno', guestsNames: 'due ospiti', meals: { a: { lunch: true, dinner: true }, b: { lunch: true, dinner: true }, c: { lunch: true, dinner: false }, k: { lunch: true, dinner: true } } },
    '2026-08-13': { note: 'Grigliata', appunti: '', guestsNames: '', meals: { a: { lunch: true, dinner: false }, b: { lunch: true, dinner: false } } },
    '2026-08-14': { note: '', appunti: '', guestsNames: '', meals: { a: { lunch: false, dinner: true }, c: { lunch: false, dinner: true } } },
  });
  set('cambusa_purchases', [
    { id: 'p1', name: 'Spesa grossa', price: 120, type: 'alimentare', buyer: 'Alice', at: 1 },
    { id: 'p2', name: 'Gasolio', price: 40, type: 'logistica', buyer: 'Bruno', at: 2 },
    { id: 'p3', name: 'Cena fuori', price: 60, type: 'alimentare', buyer: 'Carlo', at: 3, account: 'sep' },
    { id: 'p4', name: 'Bevande', price: 25, type: 'bevande', buyer: '', at: 4 },
  ]);
  set('cambusa_equipment', [
    { id: 'e1', text: 'Gazebo', price: 80, bought: true, buyer: 'Alice' },
    { id: 'e2', text: 'Corda', price: 30, bought: false, buyer: '' },
  ]);
  set('cambusa_tobuy', [{ id: 't1', name: 'Pane', qty: '3 kg' }, { id: 't2', name: 'Sale', qty: '' }]);
  set('cambusa_sepdays', ['2026-08-13']);
  set('cambusa_freedays', ['2026-08-14']);
  set('cambusa_settled', []);
  set('cambusa_gear', [{ id: 'g1', text: 'Pentolone', have: true }]);
};

// Ogni voce: [menu, sottoscheda]. Le sottoschede sono i bottoni interni.
const SCHERMATE = [
  ['Calendario', null], ['Menù', null], ['Membri', null], ['Presenze', null],
  ['Spese Totali', 'Totali'], ['Spese Totali', 'Quote'], ['Spese Totali', 'Saldi'], ['Spese Totali', 'Dati'],
  ['Lista della Spesa', null], ['Attrezzatura', null], ['Dotazioni personali', null],
  ['Regole', null], ['Galleria', null], ['Archivio', null], ['Come funziona', null], ['Impostazioni', null],
];

// Il DOM di <main>, ripulito da cio' che cambia a ogni apertura (orari,
// identificativi generati, versione del service worker).
const stabilizza = (html) => html
  .replace(/\d{1,2}:\d{2}(:\d{2})?/g, 'ORA')
  .replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, 'DATA')
  .replace(/brigata-bandone-[0-9a-f]+/g, 'VERSIONE')
  .replace(/id="[^"]*"/g, '')
  .replace(/\s+/g, ' ');

// Una scheda che non si apre non deve far scadere l'attesa in silenzio: se
// manca una dipendenza l'app cade, React smonta l'albero e il menu sparisce.
// Qui si annota "(non si apre)" e si prosegue, cosi' la prova dice QUALE
// scheda e' rotta invece di morire su un timeout.
async function cattura(page, menu) {
  const fuori = {};
  for (const [voce, sotto] of SCHERMATE) {
    const chiave = voce + (sotto ? ' / ' + sotto : '');
    try {
      await menu(voce, 5000);
      if (sotto) {
        const b = page.locator('main button', { hasText: new RegExp('^' + sotto + '$') }).first();
        if (await b.count()) { await b.click({ timeout: 4000 }); await page.waitForTimeout(250); }
      }
      await page.waitForTimeout(350);
      const html = await page.evaluate(() => {
        const m = document.querySelector('main');
        return m ? m.innerHTML : '(nessun main)';
      });
      fuori[chiave] = stabilizza(html);
    } catch (e) {
      fuori[chiave] = '(non si apre: ' + String(e.message).split('\n')[0] + ')';
      // L'app potrebbe essere smontata: si ricarica per provare la successiva.
      try { await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(600); } catch (e2) { /* niente da fare */ }
    }
  }
  return fuori;
}

module.exports = { semina, SCHERMATE, cattura, stabilizza };
