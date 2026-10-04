// Le lingue: la regola che impedisce a una schermata di mostrare un buco.
//
// Il rischio vero non e' tradurre male — quello si vede e si corregge. E'
// che manchi una stringa e il meccanismo NON SE NE ACCORGA: a schermo resta
// uno spazio bianco, e uno spazio bianco non lo segnala nessuno.
//
// Per questo la prova che conta e' una sola, e va in tutte e due le
// direzioni: ogni chiave italiana esiste in tutte le lingue, e nessuna lingua
// ha chiavi che l'italiano non ha. La seconda meta' serve quanto la prima —
// una chiave che avanza e' una traduzione che nessuno mostrera' mai.
const path = require('path');
const { ok, fine } = require('../lib/app');
require(path.resolve(__dirname, '..', '..', 'lingue.js'));
const L = (typeof globalThis !== 'undefined' && globalThis.Lingue) || null;

ok('lingue.js si carica', !!(L && typeof L.crea === 'function' && typeof L.differenze === 'function'));
if (!L) { fine(); }

const CODICI = Object.keys(L.LINGUE);
ok(`ci sono ${CODICI.length} lingue (${CODICI.join(', ')})`, CODICI.length >= 3 && CODICI.includes('it'));
ok('l\'italiano è la predefinita', L.PREDEFINITA === 'it');

// ---------- LA regola ----------
CODICI.filter((c) => c !== 'it').forEach((c) => {
  const fuori = L.differenze(c);
  const manca = fuori.filter((x) => x.tipo === 'manca').map((x) => x.chiave);
  const avanza = fuori.filter((x) => x.tipo === 'in piu').map((x) => x.chiave);
  const tipi = fuori.filter((x) => x.tipo === 'tipo diverso').map((x) => x.chiave);
  ok(`[${c}] non manca nessuna chiave${manca.length ? ' — MANCANO: ' + manca.join(', ') : ''}`, manca.length === 0);
  ok(`[${c}] non ne avanza nessuna${avanza.length ? ' — AVANZANO: ' + avanza.join(', ') : ''}`, avanza.length === 0);
  // Una chiave che in italiano e' una funzione (un plurale) deve essere una
  // funzione anche altrove: se diventa una stringa, il numero sparisce.
  ok(`[${c}] i plurali restano funzioni${tipi.length ? ' — CAMBIATI: ' + tipi.join(', ') : ''}`, tipi.length === 0);
});

const IT = L.DIZIONARI.it;
const CHIAVI = Object.keys(IT);
ok(`il dizionario italiano ha ${CHIAVI.length} voci`, CHIAVI.length > 20);

// ---------- Nessuna traduzione vuota ----------
// Una stringa vuota passerebbe il controllo delle chiavi e sarebbe comunque
// un buco a schermo: e' la stessa cosa che si voleva evitare.
{
  const vuote = [];
  CODICI.forEach((c) => {
    const d = L.DIZIONARI[c];
    Object.keys(d).forEach((k) => {
      if (typeof d[k] === 'string' && d[k].trim() === '') vuote.push(c + ':' + k);
    });
  });
  ok(`nessuna traduzione è vuota (${vuote.length})${vuote.length ? ' — ' + vuote.join(', ') : ''}`, vuote.length === 0);
}

// ---------- Nessuna traduzione dimenticata in italiano ----------
// Una chiave copiata e non tradotta e' un difetto che le prove di prima non
// vedono: la chiave c'e', il tipo e' giusto, ma a schermo compare l'italiano
// in mezzo allo spagnolo.
//
// Certe parole pero' sono davvero uguali: "Adulto" e "Cena" sono spagnolo,
// "Album" e' francese, "Aiuta Bandy" e' un nome proprio. Il permesso si da'
// UNA LINGUA ALLA VOLTA — 'es:membri.adulto', non 'membri.adulto' — se no
// perdonare lo spagnolo perdonerebbe anche il francese, dove la stessa
// parola sarebbe invece una traduzione dimenticata.
{
  const UGUALI_SUL_SERIO = [
    'es:campi.pro', 'fr:campi.pro',                // "Pro" e' il nome del piano, uguale ovunque
    'es:area.calendario',                          // "Calendario" e' anche spagnolo
    'es:membri.adulto',                            // "Adulto" e' anche spagnolo
    'es:presenze.cena',                            // "Cena" e' anche spagnolo
    'es:presenze.gratisEtichetta',                 // "gratis" e' anche spagnolo
    'fr:archivio.album', 'fr:galleria.vistaAlbum', // "Album" e' anche francese
    'es:sezione.calendario',                       // "Calendario" e' anche spagnolo
    'es:info.titolo',                              // "Info" e' anche spagnolo
    'es:auth.email',                               // "Email" e' anche spagnolo
    'es:registro.sync', 'fr:registro.sync',        // "sync" e' una sigla, non una parola
    'es:quote.gratis',                             // "Gratis" e' anche spagnolo
    'es:guida.calendario.titolo',                  // "Calendario" e' anche spagnolo
    'es:foglio.tipo',                              // "Tipo" e' anche spagnolo
    'es:membri.satispay', 'fr:membri.satispay',    // e' un marchio
  ];
  const copiate = [];
  CODICI.filter((c) => c !== 'it').forEach((c) => {
    const d = L.DIZIONARI[c];
    Object.keys(d).forEach((k) => {
      if (UGUALI_SUL_SERIO.includes(c + ':' + k)) return;
      if (typeof d[k] === 'string' && d[k] === IT[k]) copiate.push(c + ':' + k + ' ("' + d[k] + '")');
    });
  });
  // Un permesso che non serve piu' e' una guardia abbassata in silenzio: se
  // domani qualcuno traduce 'es:membri.adulto', il permesso resta li' e
  // coprirebbe una dimenticanza futura sulla stessa chiave.
  const scaduti = UGUALI_SUL_SERIO.filter((v) => {
    const [c, k] = v.split(':');
    return !(L.DIZIONARI[c] && typeof L.DIZIONARI[c][k] === 'string' && L.DIZIONARI[c][k] === IT[k]);
  });
  ok(`nessun permesso scaduto fra le voci uguali (${scaduti.length})${scaduti.length ? ' — ' + scaduti.join(', ') : ''}`,
    scaduti.length === 0);
  ok(`nessuna voce è rimasta in italiano (${copiate.length})${copiate.length ? ' — ' + copiate.join(', ') : ''}`,
    copiate.length === 0);
}

// ---------- Il traduttore ----------
const it = L.crea('it');
const es = L.crea('es');
const fr = L.crea('fr');
{
  ok(`l'italiano traduce (${it.t('area.compiti')})`, it.t('area.compiti') === 'Chi fa cosa');
  ok(`lo spagnolo pure (${es.t('area.compiti')})`, es.t('area.compiti') === 'Quién hace qué');
  ok(`e il francese (${fr.t('area.compiti')})`, fr.t('area.compiti') === 'Qui fait quoi');
}
{
  // Una lingua che non esiste non deve rompere niente: si torna all'italiano.
  const boh = L.crea('klingon');
  ok(`una lingua sconosciuta ripiega sull'italiano (${boh.codice})`, boh.codice === 'it');
  const vuota = L.crea(undefined);
  ok('e nemmeno passarne nessuna rompe qualcosa', vuota.codice === 'it');
}
{
  // IL CASO CHE QUESTO FILE ESISTE PER EVITARE: una chiave che non c'e' non
  // deve diventare uno spazio bianco. Si mostra la chiave, che è brutta ma
  // si vede — e quello che si vede, qualcuno lo segnala.
  const mancante = es.t('questa.chiave.non.esiste');
  ok(`una chiave inventata mostra sé stessa, non il vuoto ("${mancante}")`,
    mancante === 'questa.chiave.non.esiste' && mancante.length > 0);
}

// ---------- I plurali ----------
{
  ok(`in italiano zero è plurale (${it.t('compiti.quanti', 0)})`, it.t('compiti.quanti', 0) === '0 compiti');
  ok(`uno è singolare (${it.t('compiti.quanti', 1)})`, it.t('compiti.quanti', 1) === '1 compito');
  ok(`due è plurale (${it.t('compiti.quanti', 2)})`, it.t('compiti.quanti', 2) === '2 compiti');
}
{
  // La regola francese e' DIVERSA da quella italiana, e questo e' tutto il
  // motivo per cui i plurali sono funzioni invece di stringhe con un "%s".
  ok(`in francese zero è singolare (${fr.t('compiti.quanti', 0)})`, fr.t('compiti.quanti', 0) === '0 tâche');
  ok(`uno pure (${fr.t('compiti.quanti', 1)})`, fr.t('compiti.quanti', 1) === '1 tâche');
  ok(`e due è plurale (${fr.t('compiti.quanti', 2)})`, fr.t('compiti.quanti', 2) === '2 tâches');
  ok('quindi italiano e francese si comportano DIVERSAMENTE sullo zero',
    it.t('compiti.quanti', 0) !== '0 compito' && fr.t('compiti.quanti', 0) === '0 tâche');
}
{
  // Un valore che si infila dentro la frase deve arrivarci davvero.
  const m = es.t('compiti.confermaTogli', 'Comprar la carne');
  ok(`il testo passato finisce dentro la frase (${m})`, /Comprar la carne/.test(m));
}

// ---------- Le date ----------
const UN_GIORNO = new Date(2026, 7, 11, 14, 5);  // martedì 11 agosto 2026, 14:05
{
  ok(`data completa in italiano (${it.data(UN_GIORNO, 'completa')})`,
    /marted/i.test(it.data(UN_GIORNO, 'completa')) && /agosto/i.test(it.data(UN_GIORNO, 'completa')));
  ok(`in spagnolo (${es.data(UN_GIORNO, 'completa')})`,
    /martes/i.test(es.data(UN_GIORNO, 'completa')) && /agosto/i.test(es.data(UN_GIORNO, 'completa')));
  ok(`in francese (${fr.data(UN_GIORNO, 'completa')})`,
    /mardi/i.test(fr.data(UN_GIORNO, 'completa')) && /ao/i.test(fr.data(UN_GIORNO, 'completa')));
}
{
  // Le dodici forme devono restituire tutte qualcosa: una forma che torna
  // vuota e' di nuovo un buco a schermo.
  const forme = [...Object.keys(L.FORME), 'numerica', 'oraPiena', 'dataOra'];
  const vuote = forme.filter((f) => !it.data(UN_GIORNO, f));
  ok(`tutte le ${forme.length} forme di data danno un testo (${vuote.length} vuote)`, vuote.length === 0);
  ok(`l'ora è l'ora (${it.data(UN_GIORNO, 'ora')})`, /14[:.]05/.test(it.data(UN_GIORNO, 'ora')));
}
{
  // Una data che non c'e' non deve produrre "Invalid Date" a schermo.
  ok(`una data assente resta vuota ("${it.data(null, 'completa')}")`, it.data(null, 'completa') === '');
  ok('e una data scritta male pure', it.data('non una data', 'completa') === '');
  // Una forma che non esiste ripiega su qualcosa di leggibile, non sul nulla.
  ok(`una forma sconosciuta non sparisce (${it.data(UN_GIORNO, 'boh')})`, it.data(UN_GIORNO, 'boh').length > 0);
}

// ---------- L'enfasi dentro una frase ----------
{
  const p = L.pezzi('uno *due* tre');
  ok(`una frase si spezza in pezzi (${p.map((x) => (x.grassetto ? '[' + x.testo + ']' : x.testo)).join('|')})`,
    p.length === 3 && p[1].grassetto === true && p[1].testo === 'due' && p[0].grassetto === false);
  ok('una frase senza asterischi resta un pezzo solo', L.pezzi('niente da evidenziare').length === 1);
  ok('e una frase vuota non produce pezzi', L.pezzi('').length === 0 && L.pezzi(null).length === 0);
}
{
  // Il motivo per cui la frase resta INTERA nel dizionario: in spagnolo e in
  // francese le parole prima e dopo l'evidenziato non sono nello stesso posto.
  // Spezzarla in tre stringhe metterebbe il pezzo in mezzo dove capita.
  ['it', 'es', 'fr'].forEach((c) => {
    const p = L.crea(c).pezzi('compiti.spiegazione');
    const forti = p.filter((x) => x.grassetto);
    ok(`[${c}] la spiegazione ha una parte in grassetto (${forti.map((x) => x.testo).join('')})`,
      forti.length === 1 && forti[0].testo.length > 3);
    ok(`[${c}] e il resto della frase è intero`, p.length === 3 && p[0].testo.length > 3 && p[2].testo.length > 10);
  });
}
{
  // Un asterisco spaiato non deve mangiarsi meta' frase.
  const p = L.pezzi('uno *due tre');
  ok(`un asterisco spaiato non perde testo (${p.map((x) => x.testo).join('')})`,
    p.map((x) => x.testo).join('') === 'uno due tre');
}

// ---------- Ogni chiave-funzione sa girare davvero ----------
// Le prove di sopra guardano le chiavi e i tipi. Non chiamano niente — e con
// FEATURES.lingue spenta NESSUNO chiama mai lo spagnolo o il francese: un
// apostrofo sbagliato dentro un template, o un argomento in piu' di quelli
// che la funzione si aspetta, resterebbe li' finche' qualcuno non accende la
// lingua al campo. Qui si chiamano tutte, in tutte le lingue, con lo zero,
// l'uno e il due — che sono i tre numeri su cui i plurali si dividono.
{
  const rotte = [];
  const vuote = [];
  CODICI.forEach((c) => {
    const d = L.DIZIONARI[c];
    Object.keys(d).forEach((k) => {
      if (typeof d[k] !== 'function') return;
      [0, 1, 2].forEach((n) => {
        // Gli argomenti: il numero dove serve un numero, una parola dove
        // serve una parola. La funzione non sa quale sia quale, quindi si
        // passa un valore che regge tutti e due i modi.
        const args = [];
        for (let i = 0; i < Math.max(d[k].length, 1); i++) args.push(i === 0 ? n : 'x');
        let out;
        try { out = d[k].apply(null, args); }
        catch (e) { rotte.push(c + ':' + k + ' (' + n + ') — ' + e.message); return; }
        if (typeof out !== 'string' || out.trim() === '') vuote.push(c + ':' + k + ' (' + n + ')');
      });
    });
  });
  ok(`nessuna chiave-funzione va in errore (${rotte.length})${rotte.length ? ' — ' + rotte.slice(0, 5).join('; ') : ''}`,
    rotte.length === 0);
  ok(`nessuna chiave-funzione restituisce il vuoto (${vuote.length})${vuote.length ? ' — ' + vuote.slice(0, 5).join('; ') : ''}`,
    vuote.length === 0);
}

// ---------- Nessuna chiave inventata ----------
// Da quando i file puri (conti.js, 10-fondamenta) restituiscono CHIAVI invece
// di frasi, un refuso non e' piu' un errore di battitura: e' "buchi.ciboComune"
// stampato a schermo in mezzo a un avviso. Il ripiego di t() lo nasconde
// apposta — meglio la chiave di un buco — ma una prova deve vederlo.
//
// Due regole, e servono tutte e due:
//   1. ogni chiave scritta dentro L.t(), frase() o fraseVestita() esiste;
//   2. ogni stringa che SEMBRA una chiave (prefisso noto, punto, nome) lo e'
//      davvero — e' cosi' che si prendono quelle passate di mano in mano,
//      come 'buchi.ciboComune' che nasce in conti.js e si legge in 80-app.
{
  const fs = require('fs');
  const path = require('path');
  const RADICE = path.join(__dirname, '..', '..');
  // I sorgenti di src/, piu' OGNI file che index.html carica dal proprio
  // dominio. L'elenco era scritto a mano, e un elenco a mano invecchia: e'
  // bastato che nascesse auth.js — che restituisce chiavi esattamente come
  // conti.js — perche' i suoi refusi smettessero di essere guardati senza
  // che nessuno se ne accorgesse. Qui si chiede a index.html, che i file li
  // elenca gia' per forza.
  const html = fs.readFileSync(path.join(RADICE, 'index.html'), 'utf8');
  const propri = [...html.matchAll(/<script\s+src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((f) => !/^https?:|^vendor\/|^App\.js$/.test(f));
  const files = fs.readdirSync(path.join(RADICE, 'src'))
    .filter((f) => f.endsWith('.jsx'))
    .map((f) => path.join('src', f))
    .concat(propri);

  const prefissi = {};
  Object.keys(IT).forEach((k) => { if (k.includes('.')) prefissi[k.split('.')[0]] = 1; });

  const dirette = [];
  const indirette = [];
  files.forEach((rel) => {
    const src = fs.readFileSync(path.join(RADICE, rel), 'utf8');
    [...src.matchAll(/(?:L\.t|frase|L\.pezzi)\(\s*'([^']+)'/g)].forEach((m) => {
      if (!(m[1] in IT)) dirette.push(rel + ': ' + m[1]);
    });
    [...src.matchAll(/fraseVestita\(\s*'[^']*',\s*'([^']+)'/g)].forEach((m) => {
      if (!(m[1] in IT)) dirette.push(rel + ': ' + m[1]);
    });
    [...src.matchAll(/'([a-z][a-zA-Z]*\.[a-zA-Z][a-zA-Z0-9.]*)'/g)].forEach((m) => {
      const k = m[1];
      if (k in IT) return;
      if (!(k.split('.')[0] in prefissi)) return;   // non e' una chiave nostra
      indirette.push(rel + ': ' + k);
    });
  });

  ok(`ogni chiave scritta in L.t()/frase() esiste (${dirette.length})`
    + (dirette.length ? ' — ' + dirette.slice(0, 6).join(', ') : ''), dirette.length === 0);
  ok(`nessuna chiave inventata passata di mano (${indirette.length})`
    + (indirette.length ? ' — ' + indirette.slice(0, 6).join(', ') : ''), indirette.length === 0);
}

// ---------- Un messaggio che nomina la causa e non il valore e' mezzo ----------
// «Questo indirizzo non e' autorizzato» dice cosa non va e non dice cosa
// copiare: chi legge va in Firebase e incolla l'indirizzo che si ricorda,
// che e' quello di ieri. E' successo davvero, con un'anteprima Vercel che
// aveva cambiato nome insieme al ramo. Il dominio va SCRITTO nel messaggio,
// in tutte le lingue.
{
  const DOVE = 'esempio-di-prova.vercel.app';
  CODICI.forEach((c) => {
    const frase = L.crea(c).t('auth.dominioNonAutorizzato', DOVE);
    ok(`[${c}] il dominio non autorizzato si legge nel messaggio`, frase.includes(DOVE));
  });
}

// ---------- Una voce-funzione si chiama PASSANDO gli argomenti a t() ----------
// t() la chiama gia' da se' e restituisce la frase: scrivere L.t('chiave')(x)
// vuol dire chiamare una stringa, e l'app sparisce. E' successo due volte
// senza che nessuno lo vedesse — il tasto «Condividi» dell'invito e il
// conteggio dei membri — perche' quelle righe non giravano in nessuna prova.
{
  const fs = require('fs');
  const path = require('path');
  const cartella = path.join(__dirname, '..', '..', 'src');
  const sbagliate = [];
  fs.readdirSync(cartella).filter((f) => f.endsWith('.jsx')).forEach((f) => {
    fs.readFileSync(path.join(cartella, f), 'utf8').split('\n').forEach((r, n) => {
      if (/\bL\.t\(\s*'[^']+'\s*\)\s*\(/.test(r)) sbagliate.push(`${f}:${n + 1}`);
    });
  });
  ok(`nessuna voce chiamata due volte, L.t('…')(…) (${sbagliate.join(', ') || 'nessuna'})`, sbagliate.length === 0);
}

fine();
