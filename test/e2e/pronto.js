// "Pronto per il campo": l'avviso che deve esserci, e quello che NON deve.
//
// A Prato Lungo non c'e' linea: chi arriva lassu' senza l'app in cache o senza
// i dati non puo' piu' rimediare. Per questo, finche' si e' collegati, l'app
// controlla tre cose e mette un avviso arancione sul Calendario.
//
// Il difetto che questa prova chiude: uno dei tre controlli chiede che ci
// siano dei MEMBRI, ma chiudere il campo azzera le liste — giustamente, i dati
// finiscono in Archivio. Da quel momento l'avviso non poteva piu' sparire:
// restava li' per sempre a dire "questo telefono non e' pronto" a un telefono
// che stava benissimo. E nella versione pubblica sarebbe peggio: chi apre
// l'app per la prima volta, prima ancora di creare la sua stanza, si
// prenderebbe un allarme arancione in faccia.
//
// La regola: i controlli valgono quando c'e' un campo per cui essere pronti.
const { apri, ok, fine } = require('../lib/app');

const AVVISO = /non è ancora pronto per il campo/i;

// Un campo con dentro qualcosa. La cache non c'e' (il browser di prova non
// registra il service worker), quindi il primo controllo e' rosso davvero.
const conCampo = () => {
  // «La cache non c'e'» deve essere VERA, non una questione di tempo:
  // index.html il service worker lo registra anche qui, e il controllo si
  // ripete ogni 5 secondi. Con novanta prove in parallelo la lettura arrivava
  // dopo il secondo giro, col service worker gia' al comando, e la prova
  // cadeva una volta su due per un motivo che col codice non c'entrava.
  if (navigator.serviceWorker) navigator.serviceWorker.register = () => new Promise(() => {});
  localStorage.setItem('cambusa_members', JSON.stringify([
    { id: 'a', name: 'Alice', isChild: false },
  ]));
  localStorage.setItem('cambusa_camp_data', JSON.stringify({
    '2026-08-11': { note: '', guestsNames: '', meals: { a: { lunch: true, dinner: false } } },
  }));
};

// App vuota: nessun membro, nessuna spesa, nessuna lista. E' lo stato in cui
// si trova un telefono DOPO la chiusura del campo, ed e' anche quello di chi
// installa l'app per la prima volta.
const senzaCampo = () => {
  localStorage.setItem('cambusa_members', JSON.stringify([]));
  localStorage.setItem('cambusa_purchases', JSON.stringify([]));
  localStorage.setItem('cambusa_tobuy', JSON.stringify([]));
  localStorage.setItem('cambusa_equipment', JSON.stringify([]));
};

const testo = (p) => p.locator('main').innerText();

(async () => {
  // ---- 1. C'e' un campo e manca qualcosa: l'avviso ci vuole ----
  {
    const { browser, page: p, menu, errori } = await apri({ initScript: conCampo });
    await p.waitForTimeout(900);
    ok('con un campo in corso e la cache mancante, il Calendario avvisa',
      AVVISO.test(await testo(p)));

    // E il riquadro dice QUALE dei tre manca, invece di un generico "errore".
    await menu('Impostazioni');
    await p.waitForTimeout(500);
    const imp = await testo(p);
    ok(`in Impostazioni la scheda è "Non ancora" (${(imp.match(/Pronto per il campo\s*\n?\s*\S+/i) || ['—'])[0].replace(/\s+/g, ' ')})`,
      /Pronto per il campo/i.test(imp) && /NON ANCORA/i.test(imp));
    ok('e nomina i tre controlli uno per uno',
      /App scaricata sul telefono/i.test(imp)
      && /Dati del campo ricevuti/i.test(imp)
      && /Accesso al database a posto/i.test(imp));
    ok('dicendo cosa fare per quello che manca',
      /Resta su questa pagina qualche secondo/i.test(imp));

    ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
    await browser.close();
  }

  // ---- 2. Nessun campo: l'avviso NON deve esserci ----
  {
    const { browser, page: p, menu, errori } = await apri({ initScript: senzaCampo });
    await p.waitForTimeout(900);
    const cal = await testo(p);
    ok(`a campo chiuso il Calendario non avvisa niente (${AVVISO.test(cal) ? 'AVVISA' : 'pulito'})`,
      !AVVISO.test(cal));

    await menu('Impostazioni');
    await p.waitForTimeout(500);
    const imp = await testo(p);
    ok('e la scheda dice "Nessun campo" invece di "Non ancora"',
      /NESSUN CAMPO/i.test(imp) && !/NON ANCORA/i.test(imp));
    ok('spiegando perché i controlli non ci sono',
      /Non c'è un campo in corso/i.test(imp));
    ok('senza elencare i tre controlli, che qui non hanno oggetto',
      !/App scaricata sul telefono/i.test(imp) && !/Dati del campo ricevuti/i.test(imp));
    // Il punto: niente arancione. Un telefono a posto non deve vedere allarmi.
    ok('e senza il triangolo di avviso', !/⚠️/.test(imp));

    ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
    await browser.close();
  }

  // ---- 3. Basta UNA cosa nell'app perché i controlli tornino ----
  // Non serve un campo completo: appena si comincia a riempire qualcosa, la
  // domanda "sono pronto?" ha di nuovo senso. Qui c'e' solo una voce nella
  // lista della spesa, nessun membro.
  {
    const { browser, page: p, menu, errori } = await apri({
      initScript: () => {
        if (navigator.serviceWorker) navigator.serviceWorker.register = () => new Promise(() => {});
        localStorage.setItem('cambusa_members', JSON.stringify([]));
        localStorage.setItem('cambusa_tobuy', JSON.stringify([{ id: 't1', name: 'Pane', qty: '' }]));
      },
    });
    await p.waitForTimeout(900);
    ok('con una sola voce in lista e nessun membro, i controlli tornano',
      AVVISO.test(await testo(p)));
    await menu('Impostazioni');
    await p.waitForTimeout(500);
    const imp = await testo(p);
    ok('e fra i tre segnala proprio i dati mancanti',
      /Dati del campo ricevuti/i.test(imp) && /membri, spese e liste arrivano da soli/i.test(imp));
    ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
    await fine(browser);
  }
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
