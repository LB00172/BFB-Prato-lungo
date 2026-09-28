// Un cassetto per campo: le regole, senza browser.
//
// La prova a schermo (e2e/cassetti) guarda il difetto da fuori: cosa parte
// verso quale campo. Questa guarda le tre cose che da fuori non si vedono
// bene: che uno scambio andata-e-ritorno restituisca i dati IDENTICI al
// byte; che un telefono che si riempie a meta' scambio torni esattamente
// com'era; e che nessuna chiave nuova possa nascere senza che qualcuno abbia
// deciso se e' del campo o del telefono.
const fs = require('fs');
const path = require('path');
const { ok, fine } = require('../lib/app');
const RADICE = path.resolve(__dirname, '..', '..');
require(path.join(RADICE, 'cassetti.js'));
const C = globalThis.Cassetti;

ok('cassetti.js si carica ed espone le sue regole',
  !!(C && typeof C.allinea === 'function' && typeof C.scambia === 'function'));
if (!C) { fine(); }

// Un localStorage finto. `tetto` imita la quota: oltre quei caratteri in
// tutto, setItem lancia — come fa il browser.
const magazzino = (iniziale, tetto) => {
  const m = new Map(Object.entries(iniziale || {}));
  let riuscite = 0;
  const peso = () => [...m].reduce((s, [k, v]) => s + k.length + v.length, 0);
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      const prima = m.get(k);
      m.set(k, String(v));
      if (tetto && peso() > tetto) {
        if (prima === undefined) m.delete(k); else m.set(k, prima);
        const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e;
      }
      riuscite++;
    },
    riuscite: () => riuscite,
    removeItem: (k) => { m.delete(k); },
    tutto: () => Object.fromEntries(m),
  };
};

// Il confronto non guarda l'ordine delle chiavi: localStorage non ne ha uno.
const ordinato = (o) => Object.fromEntries(Object.entries(o).sort(([x], [y]) => (x < y ? -1 : 1)));

const CAMPO_A = {
  cambusa_members: '[{"id":"a","name":"Anna"}]',
  cambusa_purchases: '[{"id":"p1","price":12}]',
  cambusa_syncmeta: '{"rev":{"m|a":1}}',
  cambusa_registro: '[{"at":1}]',
};
const TELEFONO = { cambusa_theme: 'scuro', cambusa_lingua: 'it', cambusa_device_id: 'dev-1', cambusa_stanza: 'BBBB' };

// ---------- Il telefono di prima dei cassetti: si adotta, non si sposta ----
{
  const s = magazzino(Object.assign({}, CAMPO_A, TELEFONO));
  const r = C.allinea(s, 'AAAA');
  ok(`senza proprietario i dati si adottano (${r.esito})`, r.esito === 'adottato');
  ok('e restano al loro posto', s.getItem('cambusa_members') === CAMPO_A.cambusa_members);
  ok('il proprietario diventa il campo in gioco', s.getItem(C.PROPRIETARIO) === 'AAAA');
  ok('stesso campo al giro dopo: non si tocca niente', C.allinea(s, 'AAAA').esito === 'uguale');
}

// ---------- Andata e ritorno: identici al byte ----------
{
  const s = magazzino(Object.assign({}, CAMPO_A, TELEFONO, { [C.PROPRIETARIO]: 'AAAA' }));
  const r = C.allinea(s, 'BBBB');
  ok(`campo diverso: scambio (${r.esito})`, r.esito === 'fatto');
  const vuote = Object.keys(CAMPO_A).every((k) => s.getItem(k) === null);
  ok('nel campo nuovo le chiavi del campo sono vuote', vuote);
  ok('quelle del telefono non si muovono', Object.keys(TELEFONO).every((k) => s.getItem(k) === TELEFONO[k]));
  ok('i dati di A stanno nel cassetto di A',
    Object.keys(CAMPO_A).every((k) => s.getItem(C.riposta('AAAA', k)) === CAMPO_A[k]));

  // Si lavora in B.
  s.setItem('cambusa_members', '[{"id":"b","name":"Bruno"}]');
  C.allinea(s, 'AAAA');
  ok('tornati in A, tutto identico al byte',
    Object.keys(CAMPO_A).every((k) => s.getItem(k) === CAMPO_A[k]));
  ok('e il lavoro di B e\' nel cassetto di B', s.getItem(C.riposta('BBBB', 'cambusa_members')) === '[{"id":"b","name":"Bruno"}]');
  ok('il cassetto di A, riaperto, non resta anche da parte (niente doppioni che mangiano spazio)',
    Object.keys(CAMPO_A).every((k) => s.getItem(C.riposta('AAAA', k)) === null));
  C.allinea(s, 'BBBB');
  ok('e in B si ritrova Bruno, non Anna', s.getItem('cambusa_members') === '[{"id":"b","name":"Bruno"}]');
}

// ---------- Il telefono si riempie a meta': si torna esattamente com'era ----
{
  const iniziale = Object.assign({}, CAMPO_A, TELEFONO, { [C.PROPRIETARIO]: 'AAAA' });
  const pesoIniziale = Object.entries(iniziale).reduce((t, [k, v]) => t + k.length + v.length, 0);
  // Spazio per spostare la prima chiave, non la seconda: lo scambio si
  // ferma A META', dopo aver gia' mosso qualcosa. Fermarsi alla prima
  // scrittura non proverebbe il ritorno indietro — non ci sarebbe niente da
  // rimettere a posto.
  const s = magazzino(iniziale, pesoIniziale + 70);
  const r = C.allinea(s, 'BBBB');
  ok(`lo scambio si e' fermato a meta', non all'inizio (${s.riuscite()} scritture riuscite prima)`,
    s.riuscite() > 0);
  ok(`memoria piena: lo scambio si dichiara non fatto (${r.esito})`, r.esito === 'pieno');
  ok('e il telefono e\' esattamente com\'era, chiave per chiave',
    JSON.stringify(ordinato(s.tutto())) === JSON.stringify(ordinato(iniziale)));
  ok('il proprietario resta A: l\'app non si colleghera\' a B con i dati di A',
    C.di(s, 'BBBB') === 'AAAA');
}

// ---------- Il codice in gioco: stanza, poi salvato, poi predefinito ----
{
  const conStanza = magazzino({ cambusa_stanza: 'SSSS', cambusa_camp_code: 'CCCC' });
  ok('la stanza vince sul codice salvato', C.codiceInGioco(conStanza, null, 'DDDD') === 'SSSS');
  const senza = magazzino({ cambusa_camp_code: 'CCCC' });
  ok('senza stanza, il codice salvato', C.codiceInGioco(senza, null, 'DDDD') === 'CCCC');
  ok('e il codice salvato si chiede a CloudSync quando c\'e\'',
    C.codiceInGioco(senza, { savedCode: () => 'CLOUD' }, 'DDDD') === 'CLOUD');
  ok('senza niente, il predefinito', C.codiceInGioco(magazzino({}), null, 'DDDD') === 'DDDD');
}

// ---------- Nessuna chiave senza padrone ----------
// L'elenco delle chiavi del campo e' scritto a mano: il punto debole. Una
// chiave nuova che nessuno aggiunge resterebbe condivisa fra i campi, cioe'
// il difetto di prima in piccolo. Qui si cercano tutte le 'cambusa_…' scritte
// nei sorgenti — i file che index.html carica e quelli che build.js incolla,
// chiesti a loro e non ricopiati qui — e ognuna deve stare in uno dei due
// elenchi.
{
  const campo = new Set(C.DEL_CAMPO);
  const telefono = new Set(C.DEL_TELEFONO);
  const tutte = [...campo].filter((k) => telefono.has(k));
  ok(`nessuna chiave e' insieme del campo e del telefono (${tutte.join(', ') || 'nessuna'})`, tutte.length === 0);

  const html = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');
  const caricati = [...html.matchAll(/<script src="([^"]+\.js)"/g)].map((m) => m[1])
    .filter((f) => !/^vendor\//.test(f) && f !== 'App.js');
  const build = fs.readFileSync(path.join(RADICE, 'build.js'), 'utf8');
  const sorgenti = [...build.matchAll(/'(\d\d-[a-z-]+\.jsx)'/g)].map((m) => path.join('src', m[1]));
  const file = caricati.concat(sorgenti);
  ok(`i sorgenti si trovano (${caricati.length} caricati da index.html, ${sorgenti.length} da build.js)`,
    caricati.length > 5 && sorgenti.length > 15 && caricati.includes('cassetti.js'));

  const senzaPadrone = [];
  file.forEach((f) => {
    const testo = fs.readFileSync(path.join(RADICE, f), 'utf8');
    for (const m of testo.matchAll(/['"`](cambusa_[a-z_]+)['"`]/g)) {
      const k = m[1];
      if (k === C.PROPRIETARIO || k === C.FOTO_DI) continue;
      if (!campo.has(k) && !telefono.has(k)) senzaPadrone.push(`${k} (${f})`);
    }
  });
  ok(`ogni chiave dei sorgenti e' del campo o del telefono (${senzaPadrone.join(', ') || 'tutte'})`,
    senzaPadrone.length === 0);
}

fine();
