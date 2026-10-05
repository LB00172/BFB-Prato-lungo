// La lista dei membri a righe sottili, e la scheda di ogni persona
// (portata da camp-ops a ottobre 2026).
//
// Le righe erano riquadri alti quanto tre bottoni pieni: con venti persone la
// lista era tre schermate. Adesso sono righe con un filo in mezzo, e i tasti
// tengono il posto da toccare di 44 px ma un disegno piccolo.
//
// La «i» apre la scheda della persona: nome, cognome, email, telefono, e
// PayPal, IBAN e Satispay per farsi rimborsare. Su main non c'e' una stanza
// che dica chi e' chi: la compilano tutti, come prima. Il nome nel campo
// resta quello delle spese — nome e cognome sono anagrafe.
const { apri, ok, fine, attendi } = require('../lib/app');

const semina = () => {
  if (sessionStorage.getItem('__seminato')) return;
  sessionStorage.setItem('__seminato', '1');
  const membri = [['m1', 'Giulia Ferri'], ['m2', 'Marco Bellini'], ['m3', 'Anna Riva']];
  localStorage.setItem('cambusa_members', JSON.stringify(membri.map(([id, name]) => ({ id, name, isChild: false }))));
  const P = { lunch: true, dinner: true };
  const meals = {};
  membri.forEach(([id]) => { meals[id] = P; });
  localStorage.setItem('cambusa_camp_data', JSON.stringify({ '2026-08-11': { note: '', guestsNames: '', meals } }));
  localStorage.setItem('cambusa_purchases', JSON.stringify([{ id: 'p1', name: 'Spesa', price: 60, type: 'alimentare', buyer: 'Marco Bellini', at: 1 }]));
};
const membri = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cambusa_members')));

(async () => {
  const { browser, page: p, menu, errori } = await apri({ admin: false, initScript: semina });
  await menu('Membri');
  await attendi(p, () => document.querySelectorAll('[data-membro]').length === 3);
  const altezze = await p.evaluate(() => [...document.querySelectorAll('[data-membro]')].map((li) => Math.round(li.getBoundingClientRect().height)));
  ok(`le righe sono sottili (${altezze.join(', ')} px)`, altezze.every((h) => h <= 60));
  const tasti = await p.evaluate(() => [...document.querySelectorAll('[data-membro] button')].map((b) => { const r = b.getBoundingClientRect(); return Math.min(Math.round(r.width), Math.round(r.height)); }));
  ok(`ma i tasti restano da 44 px da toccare (minimo ${Math.min(...tasti)})`, Math.min(...tasti) >= 44);

  await p.locator('[data-membro="Marco Bellini"] button[aria-label*="Marco Bellini"]').first().click();
  await attendi(p, () => !!document.querySelector('[data-scheda-membro="Marco Bellini"]'));
  const sm = p.locator('[data-scheda-membro="Marco Bellini"]');
  const campi = await sm.locator('input[data-dato]').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-dato')));
  ok(`la «i» apre la scheda della persona: ${campi.join(', ')}`,
    campi.join(',') === 'nome,cognome,email,telefono,paypal,iban,satispay');
  ok('e una scheda sola alla volta', (await p.locator('[data-scheda-membro]').count()) === 1);
  await sm.locator('input[data-dato="nome"]').fill('Marco');
  await sm.locator('input[data-dato="cognome"]').fill('Bellini');
  await sm.locator('input[data-dato="email"]').fill('marco@example.com');
  await sm.locator('input[data-dato="telefono"]').fill('+39 333 1234567');
  await sm.locator('input[data-dato="satispay"]').fill('+39 333 1234567');
  await attendi(p, () => (JSON.parse(localStorage.getItem('cambusa_members')).find((m) => m.id === 'm2') || {}).satispay === '+39 333 1234567');
  const marco = (await membri(p)).find((m) => m.id === 'm2');
  ok(`i dati restano sulla persona (${[marco.nome, marco.cognome, marco.email, marco.telefono].join(' · ')})`,
    marco.nome === 'Marco' && marco.cognome === 'Bellini' && marco.email === 'marco@example.com' && marco.telefono === '+39 333 1234567');
  ok('il nome nel campo non cambia: è quello delle spese', marco.name === 'Marco Bellini');
  ok('il segnalino del rimborso compare su chi ha lasciato i dati', (await p.locator('[data-membro="Marco Bellini"] [title="Ha inserito i dati per il rimborso"]').count()) === 1
    && (await p.locator('[data-membro="Anna Riva"] [title="Ha inserito i dati per il rimborso"]').count()) === 0);

  // Il Satispay compare dove serve: accanto a chi deve ricevere.
  await menu('Spese Totali');
  await p.getByRole('button', { name: 'Saldi', exact: true }).first().click();
  await attendi(p, () => !!document.querySelector('main li[data-da-fare]'));
  const riga = await p.locator('main li[data-da-fare]').first().innerText();
  ok('nei Saldi accanto a chi riceve c\'è il suo Satispay', /satispay/i.test(riga) && /\+39 333 1234567/.test(riga));
  ok('nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''), errori.length === 0);
  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
