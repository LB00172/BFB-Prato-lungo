// Memoria del telefono piena: l'app deve reggere, non sparire.
//
// E' l'incidente peggiore possibile al campo, perche' non si vede arrivare: le
// foto degli scontrini riempiono localStorage, e da quel momento OGNI scrittura
// lancia. Un'eccezione dentro un useEffect risale a React e smonta l'albero:
// schermo bianco, in montagna, senza nessuno che sappia perche'. In un gestore
// di eventi invece l'app regge e fallisce solo quell'azione.
//
// Qui si simula la quota esaurita e si controlla che l'app resti in piedi su
// tutti i percorsi che scrivono: tema, gioco, impostazioni, sincronizzazione.
const { apri, ok, fine } = require('../lib/app');

// localStorage che a comando comincia a rifiutare le scritture, come fa un
// telefono pieno davvero. Le letture continuano a funzionare: e' cosi' che si
// comporta la quota, non e' un guasto totale.
const quota = () => {
  const vero = localStorage.setItem.bind(localStorage);
  window.__pieno = false;
  window.__rifiutate = 0;
  localStorage.setItem = function (k, v) {
    if (window.__pieno) {
      window.__rifiutate++;
      const e = new Error('QuotaExceededError: memoria piena');
      e.name = 'QuotaExceededError';
      throw e;
    }
    return vero(k, v);
  };
};

const vivo = async (p) => (await p.locator('main').count()) > 0 && (await p.locator('main').innerText()).length > 20;

(async () => {
  const { browser, page: p, menu, errori } = await apri({ initScript: quota });

  await menu('Membri');
  await p.fill('input[placeholder="Nome e cognome"]', 'Anna');
  await p.locator('button', { hasText: /^\+$/ }).first().click();
  await p.waitForTimeout(300);
  ok('si parte con l\'app viva e un membro', await vivo(p));

  // Da qui in poi ogni scrittura fallisce.
  await p.evaluate(() => { window.__pieno = true; });

  // ---- 1. Il tema: l'unico percorso che passa da un useEffect -------------
  // E' quello che conta. Senza protezione, qui l'app sparisce e basta.
  await menu('Impostazioni');
  await p.waitForTimeout(300);
  const tema = (nome) => p.locator('main button', { hasText: nome }).first();
  await tema('Scuro').click();
  await p.waitForTimeout(600);
  ok('cambiare tema con la memoria piena non fa sparire l\'app', await vivo(p));
  await tema('Chiaro').click();
  await p.waitForTimeout(600);
  ok('e nemmeno cambiarlo di nuovo', await vivo(p));
  ok('la scrittura e\' stata davvero rifiutata',
    (await p.evaluate(() => window.__rifiutate)) > 0);

  // ---- 2. Le impostazioni che scrivono da un gestore di eventi ------------
  const chiedi = p.locator('main button', { hasText: /Chiedi la password ogni volta|ogni volta/i }).first();
  if (await chiedi.count()) { await chiedi.click(); await p.waitForTimeout(400); }
  ok('toccare le impostazioni non fa sparire l\'app', await vivo(p));

  // ---- 3. La lingua: una preferenza scritta da un gestore di eventi -------
  // Qui c'era il gioco (nome del giocatore e record): nell'app pubblica non
  // c'e' piu', e la lingua fa la stessa strada — scrive da un tocco.
  await menu('Impostazioni');
  await p.waitForTimeout(300);
  const spagnolo = p.locator('main button', { hasText: /español/i }).first();
  if (await spagnolo.count()) { await spagnolo.click(); await p.waitForTimeout(400); }
  ok('cambiare lingua con la memoria piena non fa sparire l\'app', await vivo(p));
  const italiano = p.locator('main button', { hasText: /italiano/i }).first();
  if (await italiano.count()) { await italiano.click(); await p.waitForTimeout(400); }

  // ---- 4. Le presenze: il percorso che scrive di piu' ---------------------
  await menu('Presenze');
  await p.waitForTimeout(400);
  const pranzo = p.locator('li', { hasText: 'Anna' }).locator('button', { hasText: 'Pranzo' }).first();
  if (await pranzo.count()) { await pranzo.click(); await p.waitForTimeout(500); }
  ok('segnare una presenza non fa sparire l\'app', await vivo(p));

  // ---- 5. E l'app lo DICE, invece di far finta di niente ------------------
  // Liberare spazio puo' farlo solo il proprietario del telefono: l'avviso
  // resta visibile anche a chi non e' in modalita' tecnica.
  const testo = await p.locator('body').innerText();
  ok('compare l\'avviso che la memoria e\' piena', /memoria di questo telefono è piena/i.test(testo));

  // ---- 6. Nessun errore ha sfondato React --------------------------------
  const smontata = errori.filter((e) => /QuotaExceeded/i.test(e));
  ok('nessuna eccezione di quota e\' arrivata fino a React'
    + (smontata.length ? ': ' + smontata.join(' | ') : ''), smontata.length === 0);

  // ---- 7. Torna lo spazio, torna tutto -----------------------------------
  await p.evaluate(() => { window.__pieno = false; });
  await menu('Impostazioni');
  await tema('Scuro').click();
  await p.waitForTimeout(600);
  ok('liberato lo spazio, il tema si salva di nuovo',
    (await p.evaluate(() => localStorage.getItem('cambusa_theme'))) === 'dark');

  await fine(browser);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
