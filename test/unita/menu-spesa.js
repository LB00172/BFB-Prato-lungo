// Dal menù alla lista della spesa, senza ricopiare a mano.
//
// I menù del campo 2026 sono già la lista della spesa: quantità scritte,
// a volte anche i prezzi. Nel frattempo la scheda "Da acquistare" conteneva
// CINQUE voci, perché la gente scrive nel campo che ha davanti mentre pensa
// al cibo. Questo lettore prende quelle righe e le propone.
//
// I casi qui sotto NON sono inventati: sono copiati dall'export del campo
// dell'agosto 2026. E' il motivo per cui la regola e' quella che e': niente
// tabella di ingredienti, perche' la gente scrive gia' gli ingredienti.
const path = require('path');
const { ok, fine } = require('../lib/app');
require(path.resolve(__dirname, '..', '..', 'menu-spesa.js'));
const MS = (typeof globalThis !== 'undefined' && globalThis.MenuSpesa) || null;

ok('il modulo si carica ed espone vociDalMenu', !!(MS && typeof MS.vociDalMenu === 'function'));
if (!MS || !MS.vociDalMenu) { fine(); }

const v = (t) => MS.vociDalMenu(t);
const come = (righe) => righe.map((r) => r.nome + (r.qta ? ' | ' + r.qta : '')).join(' / ');

// ---- 1. Menù dell'11 agosto: nome, due punti, quantità e prezzo ----------
const undici = v('CENA:\nVongole: 1,5 kg 6€ al kg\nSpigole: 1,5 kg 13€ al kg\nCalamari: 1 kg 20€ al kg\nGamberoni: 15 pz 15€ al kg');
ok(`l'intestazione CENA: non diventa una voce (${undici.length} voci)`, undici.length === 4);
ok('il nome sta prima dei due punti: ' + come(undici).slice(0, 60),
  undici[0].nome === 'Vongole' && undici[3].nome === 'Gamberoni');
ok('la quantità resta come l\'ha scritta chi cucina, prezzo compreso',
  undici[0].qta === '1,5 kg 6€ al kg' && undici[3].qta === '15 pz 15€ al kg');

// ---- 2. Menù del 14 agosto: quantità in testa alla riga -------------------
const quattordici = v('Pranzo : \nPasta funghi e piselli\n40 scamorze\n\nCena : \n150 arrosticini \n40 COSCE pollo\n50 salsiccie\nPannocchie');
ok(`due intestazioni e una riga vuota non contano (${quattordici.length} voci)`, quattordici.length === 6);
ok('il numero in testa diventa quantità: ' + come(quattordici),
  quattordici[1].nome === 'scamorze' && quattordici[1].qta === '40'
  && quattordici[2].nome === 'arrosticini' && quattordici[2].qta === '150');
ok('un nome di due parole dopo il numero resta intero',
  quattordici[3].nome === 'COSCE pollo' && quattordici[3].qta === '40');
ok('una riga senza numeri passa senza quantità',
  quattordici[0].nome === 'Pasta funghi e piselli' && quattordici[0].qta === ''
  && quattordici[5].nome === 'Pannocchie' && quattordici[5].qta === '');

// ---- 3. Menù del 12 agosto: quantità in coda, attaccata all'unità --------
const dodici = v('PRANZO:\nTONNARELLO ALLA NORMA\n11 SCAMORZE\n\nCENA:\nGIN TONIC PARTY\nFIORENTINA 5kg\nVERDURE ALLA BRACE');
ok('la quantità in coda si riconosce: ' + come(dodici),
  dodici.some((r) => r.nome === 'FIORENTINA' && r.qta === '5kg'));
ok('undici scamorze: numero senza unità in testa',
  dodici.some((r) => r.nome === 'SCAMORZE' && r.qta === '11'));

// ---- 4. Il 13 agosto ha l'intestazione E il piatto sulla stessa riga -----
const tredici = v('Pranzo: CORDICELLE AL SUGO\n\nCENA: BISTECCHE DI CAPOCOLLO, PANCETTA TESA E CICORIA');
ok(`"Pranzo: piatto" lascia solo il piatto (${come(tredici)})`,
  tredici.length >= 2 && tredici[0].nome === 'CORDICELLE AL SUGO');
ok('una riga con le virgole e senza quantità si spezza sulle virgole',
  tredici.some((r) => r.nome === 'BISTECCHE DI CAPOCOLLO')
  && tredici.some((r) => r.nome === 'PANCETTA TESA E CICORIA'));

// ---- 5. Il 15 agosto: numeri, formaggi, legumi ---------------------------
const quindici = v('Pranzo: pasta amatriciana\n\n\nCena: \n60 pecora \n40 pancetta\n150 arrosticini\nCacio cavallo\nfagioli');
ok(`righe vuote multiple non producono voci vuote (${quindici.length} voci)`, quindici.length === 6);
ok('il nome di due parole senza numeri resta intero',
  quindici.some((r) => r.nome === 'Cacio cavallo' && r.qta === ''));

// ---- 6. Casi che non sono cibo: si propongono comunque -------------------
// Filtrarli richiederebbe un dizionario alimentare, cioe' la cosa che si e'
// deciso di NON costruire. Meglio una spunta da togliere che una voce persa.
const dieci = v('Montaggio serale tende etc.');
ok('anche una riga che non è cibo viene proposta, sta all\'uomo togliere la spunta',
  dieci.length === 1 && dieci[0].nome === 'Montaggio serale tende etc.');

// ---- 7. Ingressi vuoti o sporchi ----------------------------------------
ok('menù vuoto: nessuna voce', v('').length === 0 && v(null).length === 0 && v(undefined).length === 0);
ok('solo intestazioni: nessuna voce', v('PRANZO:\nCENA:\n\n').length === 0);
ok('spazi doppi e in coda si normalizzano',
  v('   40   scamorze   ')[0].nome === 'scamorze' && v('   40   scamorze   ')[0].qta === '40');
ok('i trattini d\'elenco non entrano nel nome',
  v('- 40 scamorze')[0].nome === 'scamorze' && v('• Pannocchie')[0].nome === 'Pannocchie');

// ---- 8. Il filtro dei doppioni -------------------------------------------
ok('nuove(): scarta ciò che è già in lista, senza badare a maiuscole e spazi',
  typeof MS.nuove === 'function'
  && MS.nuove(v('40 scamorze\nPannocchie'), [{ name: '  SCAMORZE ' }]).length === 1
  && MS.nuove(v('40 scamorze\nPannocchie'), [{ name: 'scamorze' }])[0].nome === 'Pannocchie');
ok('nuove() con lista vuota tiene tutto', MS.nuove(v('40 scamorze'), []).length === 1);
ok('nuove() regge una lista non valida', MS.nuove(v('40 scamorze'), null).length === 1);

fine();
