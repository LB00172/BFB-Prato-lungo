// ---------- Archivio e guida ----------
// La Galleria sta a parte in 85-scheda-galleria.jsx: e' la piu' grossa delle
// quattro ed e' stata la prima a uscire.

const schedaArchivio = ({
  album,
  aperto,
  archives,
  avviso,
  cloud,
  downloadArchive,
  members,
  openAlbum,
  openPhoto,
  photos,
  purchases,
  removeArchive,
  setAlbum,
  setViewArchive,
  totals,
}) => (
  <div className="space-y-4">
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco mb-3">{L.t('area.archivio')}</h3>
      {/* Consultarlo nell'app e' del Pro. Scaricarlo no: esportare i propri
          dati resta a chiunque, ed e' la strada per non perderli. */}
      {!aperto && <div className="mb-3">{avviso}</div>}
      {archives.length === 0 ? (
        <p className="text-normale text-gray-400 italic">
          {frase('archivio.vuoto')}
        </p>
      ) : (
        <ul className="space-y-3">
          {archives.map((a) => (
            <li key={a.id} className="bg-carta/60 p-3 rounded border border-salvia/20 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-rustic text-medio text-bosco truncate">{a.name}</p>
                  <p className="text-piccolo text-gray-500">
                    {L.t('archivio.periodoChiuso', a.from === a.to ? a.from : `${a.from} → ${a.to}`, L.data(new Date(a.closedAt), 'numerica'))}
                  </p>
                </div>
                <span className="font-rustic font-bold text-bosco shrink-0">{money((a.totals && a.totals.overall) || 0)} €</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-piccolo text-gray-500">
                <span>{L.t('archivio.membri', (a.totals && a.totals.members) || 0)}</span>
                <span>{L.t('archivio.spese', (a.totals && a.totals.purchases) || 0)}</span>
                <span>{L.t('archivio.pasti', (a.totals && a.totals.meals) || 0)}</span>
                {a.photos > 0 && <span>{L.t('archivio.foto', a.photos)}</span>}
                {!a.state && <span className="text-salvia italic">{L.t('archivio.soloCloud')}</span>}
              </div>
              <div className="flex gap-2">
                {aperto && <button onClick={() => setViewArchive(a)} className={bottone('primario', 'normale', 'flex-1')}>{L.t('archivio.resoconto')}</button>}
                {aperto && a.photos > 0 && (
                  <button onClick={() => openAlbum(a)} className="flex-1 py-2 bg-salvia text-white rounded text-piccolo font-bold uppercase hover:brightness-95">{L.t('archivio.album')}</button>
                )}
                <button onClick={() => downloadArchive(a)} className={bottone('bruno', 'normale', 'flex-1')}>{L.t('archivio.scarica')}</button>
                <button onClick={() => removeArchive(a)} aria-label={L.t('archivio.eliminaArchivio')} className={bottone('distruttivo', 'minuscolo')}>{L.t('archivio.elimina')}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>

    {/* Album di un campo chiuso: le miniature si scaricano su richiesta. */}
    {album && (
      <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm">
        <div className="flex items-center justify-between border-b border-salvia/40 pb-2 mb-3">
          <h3 className="font-rustic text-grande text-bosco truncate">{L.t('archivio.albumDi', album.name)}</h3>
          <button onClick={() => setAlbum(null)} className={bottone('testuale', 'minuscolo', 'shrink-0')}>{L.t('archivio.chiudi')}</button>
        </div>
        {album.loading ? (
          <p className="text-normale text-gray-400 italic">{L.t('archivio.carico')}</p>
        ) : album.photos.length === 0 ? (
          <p className="text-normale text-gray-400 italic">{L.t('archivio.senzaFoto')}</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {album.photos.map((p) => (
              <button
                key={p.id}
                onClick={() => openPhoto(p)}
                className="relative aspect-square overflow-hidden rounded border border-salvia/30 bg-carta"
                aria-label={L.t('archivio.fotoDi', p.by || L.t('archivio.anonimo'))}
              >
                <img src={p.thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                {p.by && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-minuto px-1 py-0.5 truncate text-left">{p.by}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    )}
    <p className="text-minuto text-gray-400 italic text-center px-4">
      {L.t('archivio.conservalo')}
    </p>
  </div>
);

// ---------- Come funziona ----------
// Erano venti pillole tutte insieme e un testo solo sotto: per trovare una
// cosa si leggevano le etichette di tutte le altre. Adesso i tre passi per
// cominciare stanno in cima, e il resto e' diviso in capitoli per MOMENTO
// (prima di partire, al campo, le spese, i conti, il telefono): dentro, una
// riga per voce, che si apre sul suo testo — una alla volta, come le righe
// di «Il campo». Non una tendina: una tendina nasconde l'elenco, e l'elenco
// e' proprio quello che serve vedere per sapere cosa chiedere.
const schedaGuida = ({
  GUIDE,
  guideOpen,
  setGuideOpen,
}) => (
  <div className="space-y-4">
    <div className="bg-bosco text-carta p-4 rounded-lg border-b-4 border-legno shadow-md">
      <h3 className="font-rustic text-grande mb-1">{L.t('guida.titolo')}</h3>
      <p className="text-piccolo text-carta/80 mb-3">{L.t('guida.sottotitolo')}</p>
      <h4 className="font-rustic text-medio mb-2">{L.t('guida.trePassi')}</h4>
      <ol data-tre-passi className="text-piccolo space-y-1.5 list-decimal list-inside text-carta/90">
        <li>{frase('guida.passo1')}</li>
        <li>{frase('guida.passo2')}</li>
        <li>{frase('guida.passo3')}</li>
      </ol>
    </div>

    {CAPITOLI_GUIDA.map((cap) => {
      const voci = cap.voci.map((k) => GUIDE.find((g) => g.k === k)).filter(Boolean);
      if (!voci.length) return null;
      return (
        <div key={cap.id} data-capitolo={cap.id} className="bg-scheda rounded-lg border-2 border-bosco/20 shadow-sm overflow-hidden">
          <h3 className="font-rustic text-grande text-bosco px-4 pt-3 pb-2 border-b border-salvia/40">{L.t(cap.titolo)}</h3>
          {voci.map((g) => {
            const aperta = guideOpen === g.k;
            return (
              <div key={g.k} className="border-t border-salvia/20 first:border-t-0">
                <button data-guida={g.k} aria-expanded={aperta} onClick={() => setGuideOpen(aperta ? '' : g.k)} className={bottoneRiga()}>
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="text-bosco shrink-0">{icona(g.k, 'w-5 h-5')}</span>
                    <span className="text-normale font-bold text-bosco">{g.title}</span>
                  </span>
                  <span className="text-salvia shrink-0">{aperta ? '−' : '+'}</span>
                </button>
                {aperta && <p className="px-4 pb-3 text-piccolo text-bosco leading-relaxed">{g.body}</p>}
              </div>
            );
          })}
        </div>
      );
    })}
  </div>
);

// I capitoli: tengono le CHIAVI delle voci, i testi li chiede il disegno
// (una tabella di testi qui si congelerebbe nella lingua di quel momento).
// Una voce che non sta in nessun capitolo non si vedrebbe piu': una prova
// lo vieta.
const CAPITOLI_GUIDA = [
  { id: 'partire', titolo: 'guida.cap.partire', voci: ['campo', 'membri', 'compiti', 'dotazioni', 'pronto', 'installa'] },
  { id: 'campo', titolo: 'guida.cap.campo', voci: ['calendario', 'menu', 'presenze', 'galleria'] },
  { id: 'spese', titolo: 'guida.cap.spese', voci: ['lista', 'attrezzatura', 'correggi'] },
  { id: 'conti', titolo: 'guida.cap.conti', voci: ['spesa', 'conti', 'separato', 'saldi'] },
  { id: 'dati', titolo: 'guida.cap.dati', voci: ['sync', 'backup', 'chiusura', 'impostazioni'] },
];
