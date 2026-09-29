// Le cifre si scrivono nella lingua dell'app: 281,10 € e non 281.10 €.
//
// money() veniva da conti.js cosi' com'era, cioe' toFixed(2): il punto
// inglese, in un'app che parla italiano, spagnolo e francese. Lo ha visto il
// giro dell'interfaccia del 29 settembre, anche nella versione francese.
// L'arrotondamento resta quello di conti.js — qui si guarda solo come la
// cifra si scrive: a schermo, nel resoconto che si manda nel gruppo, e nelle
// tre lingue, migliaia comprese.
const { apri, ok, fine, attendi } = require('../lib/app');

const scena = (lingua) => [(l) => {
  localStorage.setItem('cambusa_lingua', l);
  localStorage.setItem('cambusa_members', JSON.stringify([{ id: 'a', name: 'Anna', isChild: false }, { id: 'b', name: 'Bruno', isChild: false }]));
  localStorage.setItem('cambusa_camp_data', JSON.stringify({ [window.CAMP_START_PREDEFINITO || '2026-08-11']: { note: '', guestsNames: '', meals: { a: { lunch: true }, b: { lunch: true } } } }));
  localStorage.setItem('cambusa_purchases', JSON.stringify([{ id: 'p1', name: 'Spesa', price: 1234.5, type: 'alimentare', buyer: 'Anna', at: 1 }]));
}, lingua];

(async () => {
  for (const [lingua, attesa, migliaia] of [['it', '617,30', '1234,50'], ['es', '617,30', '1234,50'], ['fr', '617,30', '1 234,50']]) {
    const a = await apri({ initScript: scena(lingua) });
    // La regola, presa dalla pagina: e' la money() che usa il disegno.
    const r = await a.page.evaluate(() => [money(1234.5), money(0), money(-3.456), money(0.1 + 0.2)]);
    const norm = (s) => s.replace(/[  ]/g, ' ');
    ok(`${lingua}: le cifre hanno la virgola (${r.map(norm).join(' | ')})`,
      norm(r[1]) === '0,00' && norm(r[2]) === '-3,46' && norm(r[3]) === '0,30' && /,50$/.test(r[0]) && !/\./.test(r[1] + r[2] + r[3]));
    ok(`${lingua}: le migliaia come si scrivono in quella lingua (${norm(r[0])})`, norm(r[0]) === migliaia || norm(r[0]) === migliaia.replace('1234', '1.234'));

    // A schermo: le quote. 1234,50 € in due fanno 617,25 a testa, che
    // arrotondate a 0,10 € (la regola delle quote) diventano 617,30.
    await a.page.click('button[aria-label="Menu"]');
    await a.page.waitForTimeout(250);
    await a.page.locator('nav button[data-voce="spesa"]').first().click();
    await a.page.locator('main button').nth(1).click();
    await attendi(a.page, () => /617/.test(document.querySelector('main').innerText));
    const t = norm(await a.page.locator('main').innerText());
    ok(`${lingua}: a schermo la quota è ${attesa} €, non ${attesa.replace(',', '.')}`, t.includes(attesa + ' €') && !t.includes(attesa.replace(',', '.')));
    ok('nessun errore JavaScript' + (a.errori.length ? ': ' + a.errori.join(' | ') : ''), a.errori.length === 0);
    await a.browser.close();
  }
  fine();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
