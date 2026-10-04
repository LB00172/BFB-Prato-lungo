// L'avvio veloce delle gite (4 ottobre): tutti, a ogni pasto, tutto il campo.
//
// In un weekend fra amici ci sono tutti sempre, e segnarli giorno per giorno
// e' il motivo per cui un gruppo piccolo lascerebbe perdere le presenze. In
// un campo senza nemmeno un pasto segnato, Presenze lo propone; un tocco
// segna tutti a pranzo e a cena in ogni giorno del campo, i giorni bloccati
// non si toccano, e la proposta se ne va. Quando NON deve comparire: appena
// c'e' un pasto segnato.
const { apri, ok, fine, attendi } = require('../lib/app');

const semina = () => {
  localStorage.setItem('cambusa_members', JSON.stringify([
    { id: 'a', name: 'Anna', isChild: false }, { id: 'b', name: 'Bruno', isChild: false }, { id: 'c', name: 'Carla', isChild: false },
  ]));
  if (!sessionStorage.getItem('__seminato')) {
    sessionStorage.setItem('__seminato', '1');
    // Il secondo giorno del campo e' bloccato (vuoto): deve restare vuoto.
    // Le date sono il ripiego dell'app senza stanza (src/40-configurazione.jsx).
    const secondo = '2026-08-12';
    sessionStorage.setItem('__bloccato', secondo);
    localStorage.setItem('cambusa_camp_data', JSON.stringify({ [secondo]: { note: '', guestsNames: '', meals: {}, bloccato: { at: 1, meals: {} } } }));
  }
};

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: semina });
  await menu('Presenze');
  await attendi(p, () => !!document.querySelector('[data-avvio-veloce]'));
  ok('in un campo senza pasti, Presenze propone di segnare tutti sempre', true);
  await p.locator('[data-avvio-veloce] button').click();
  await attendi(p, () => !document.querySelector('[data-avvio-veloce]'));
  const r = await p.evaluate(() => {
    const cd = JSON.parse(localStorage.getItem('cambusa_camp_data'));
    const bloccato = sessionStorage.getItem('__bloccato');
    const giorni = [];
    const d = new Date(CAMP_START + 'T12:00:00');
    const f = new Date(CAMP_END + 'T12:00:00');
    while (d <= f) { giorni.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
    const pieni = giorni.filter((g) => g !== bloccato).every((g) => ['a', 'b', 'c'].every((id) => cd[g] && cd[g].meals[id] && cd[g].meals[id].lunch && cd[g].meals[id].dinner));
    return { giorni: giorni.length, pieni, bloccatoVuoto: Object.keys((cd[bloccato] || {}).meals || {}).length === 0 };
  });
  ok(`un tocco segna tutti a pranzo e cena in ogni giorno del campo (${r.giorni} giorni)`, r.giorni > 1 && r.pieni);
  ok('il giorno bloccato resta com\'era', r.bloccatoVuoto);
  ok('e la proposta, con dei pasti segnati, non compare più', (await p.locator('[data-avvio-veloce]').count()) === 0);
  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
