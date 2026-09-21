// ---------- Scheda Galleria ----------
// Primo pezzo di interfaccia uscito da 80-app.jsx.
//
// Non e' un componente React ma una funzione che restituisce JSX, e la
// differenza conta: nessun confine di riconciliazione nuovo, nessun hook
// spostato, l'albero prodotto e' identico a prima. E' spostamento di codice,
// non un cambio di comportamento — infatti si dimostra confrontando l'HTML
// prodotto, che dev'essere lo stesso al carattere.
//
// L'elenco qui sotto e' il punto: sono le VENTINOVE cose che il disegno della
// galleria si prendeva dalla chiusura di App() senza dirlo. Scritte, si
// vedono; e quando saranno poche abbastanza, la galleria potra' diventare un
// modulo vero con il suo stato.
const schedaGalleria = ({
  PER_PAGINA_ALBUM,
  addPhotos,
  album,
  albumPage,
  albumRef,
  cloud,
  galleryView,
  generaRicordo,
  members,
  onScrollAlbum,
  openPhoto,
  paginaAlbum,
  pdfBusy,
  photoBusy,
  photoCap,
  photoWho,
  photos,
  photosBy,
  photosReady,
  picked,
  picking,
  setGalleryView,
  setPhotoWho,
  setPicked,
  setPicking,
  sfoglia,
  soloNome,
  togglePicked,
  uscitaScelta,
}) => (
  <div className="space-y-4">
    {/* Caricamento */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">{L.t('galleria.carica')}</h3>

      {!cloud.connected ? (
        <p className="text-normale text-gray-500 leading-snug">
          {frase('galleria.senzaCloud')}
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-minuto uppercase font-bold text-gray-500 tracking-wide mb-1">{L.t('galleria.chiScatta')}</label>
            <select
              value={photoWho}
              onChange={(e) => setPhotoWho(e.target.value)}
              className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
            >
              <option value="">{L.t('galleria.scegliNome')}</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} ({photosBy(m.name)}/{photoCap})
                </option>
              ))}
            </select>
            {members.length === 0 && (
              <p className="text-minuto text-[#D97706] mt-1">{L.t('galleria.primaMembri')}</p>
            )}
          </div>

          {photoWho && (
            <p className="text-piccolo text-gray-600">
              {photosBy(photoWho) >= photoCap
                ? <span className="text-[#D97706] font-bold">{L.t('galleria.esaurite', photoWho, photoCap)}</span>
                : frase('galleria.restano', photoWho, photoCap - photosBy(photoWho), photoCap)}
            </p>
          )}

          <label className={`block w-full py-3 rounded font-bold uppercase text-normale tracking-wide text-center cursor-pointer ${photoWho && photosBy(photoWho) < photoCap && !photoBusy ? 'bg-[#2D392C] text-white hover:bg-[#1F271E]' : 'bg-gray-200 text-gray-400 pointer-events-none'}`}>
            {photoBusy || L.t('galleria.scegliFoto')}
            <input type="file" accept="image/*" multiple onChange={addPhotos} className="hidden" />
          </label>

          {/* Le foto della galleria vivono solo nel cloud: la coda dei
              caricamenti sta in memoria, quindi chiudendo l'app adesso
              quello che non è ancora partito va rifatto. Gli scontrini
              no: quelli hanno una copia sul telefono e si ricaricano da
              soli al prossimo collegamento. */}
          {(cloud.foto || 0) > 0 && (
            <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
              <p className="text-piccolo text-[#5C4A3C] leading-snug">
                {frase('galleria.inCoda', cloud.foto)}
              </p>
            </div>
          )}

          <p className="text-minuto text-gray-400 italic leading-snug">
            {frase('galleria.tetto', photoCap)}
          </p>
        </div>
      )}
    </div>

    {/* Griglia */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3 gap-2">
        <h3 className="font-rustic text-grande text-[#2D392C] shrink-0">
          {L.t('archivio.album')} {photos.length > 0 ? `(${photos.length})` : ''}
        </h3>
        {/* Due modi di guardare le stesse foto: l'album per sfogliarle,
            la griglia per trovarle. La scelta a mano funziona solo in
            griglia, quindi ci passa da sola. */}
        {photos.length > 0 && !picking && (
          <div className="flex rounded border border-[#8F9E8B]/40 overflow-hidden shrink-0">
            {[['album', L.t('galleria.vistaAlbum')], ['griglia', L.t('galleria.vistaGriglia')]].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setGalleryView(k)}
                className={bottoneScelta('giunta', 'piatto', galleryView === k, 'minuscolo')}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        {picking && (
          <button
            onClick={uscitaScelta}
            className={bottone('primario', 'minuscolo', 'shrink-0')}
          >
            {L.t('galleria.annulla')}
          </button>
        )}
      </div>
      {!cloud.connected ? (
        <p className="text-normale text-gray-400 italic">{L.t('galleria.senzaLinea')}</p>
      ) : !photosReady ? (
        <p className="text-normale text-gray-400 italic">{L.t('archivio.carico')}</p>
      ) : photos.length === 0 ? (
        <p className="text-normale text-gray-400 italic">{L.t('galleria.ancoraNessuna')}</p>
      ) : galleryView === 'album' && !picking ? (
        <div>
          <div className="album-sfoglio" ref={albumRef} onScroll={onScrollAlbum}>
            {paginaAlbum(photos).map((gruppo, i) => (
              <div key={i} className={`album-pagina ${gruppo.length === 1 ? '' : ''}`}>
                <div className={`album-griglia ${gruppo.length === 1 ? 'una' : ''}`}>
                  {gruppo.map((p) => (
                    <button key={p.id} onClick={() => openPhoto(p)} className="polaroid" aria-label={L.t('archivio.fotoDi', p.by || L.t('archivio.anonimo'))}>
                      <img src={p.thumb} alt="" loading="lazy" />
                      {/* Solo il nome: sotto una polaroid il cognome non
                          serve a nessuno e non ci sta. */}
                      <span className="didascalia">
                        <span className="nome">{soloNome(p.by)}</span>
                        {p.at ? <span className="quando">{L.data(new Date(p.at), 'numerica')}</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Comandi di sfoglio: col dito basta la spinta, col mouse no. */}
          <div className="flex items-center justify-center gap-4 mt-2">
            <button
              onClick={() => sfoglia(-1)}
              disabled={albumPage <= 0}
              aria-label={L.t('galleria.paginaPrec')}
              className={`w-8 h-8 rounded-full border border-[#8F9E8B]/40 text-normale ${albumPage <= 0 ? 'text-gray-300' : 'text-[#2D392C]'}`}
            >
              ‹
            </button>
            <span className="text-piccolo uppercase tracking-widest text-gray-500">
              {Math.min(albumPage + 1, paginaAlbum(photos).length)} / {paginaAlbum(photos).length}
            </span>
            <button
              onClick={() => sfoglia(1)}
              disabled={albumPage >= paginaAlbum(photos).length - 1}
              aria-label={L.t('galleria.paginaSucc')}
              className={`w-8 h-8 rounded-full border border-[#8F9E8B]/40 text-normale ${albumPage >= paginaAlbum(photos).length - 1 ? 'text-gray-300' : 'text-[#2D392C]'}`}
            >
              ›
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => {
            const scelta = picked.indexOf(p.id);
            return (
              <button
                key={p.id}
                onClick={() => (picking ? togglePicked(p.id) : openPhoto(p))}
                className={`relative aspect-square overflow-hidden rounded border bg-[#F0F4F1] ${scelta >= 0 ? 'border-[#2D392C] border-2' : 'border-[#8F9E8B]/30'}`}
                aria-label={picking
                  ? L.t('galleria.scegliQuesta', p.by || L.t('archivio.anonimo'))
                  : L.t('archivio.fotoDi', p.by || L.t('archivio.anonimo'))}
              >
                <img src={p.thumb} alt="" className={`w-full h-full object-cover ${picking && scelta < 0 ? 'opacity-45' : ''}`} loading="lazy" />
                {picking && (
                  <span className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-minuto font-bold border-2 ${scelta >= 0 ? 'bg-[#2D392C] text-white border-[#2D392C]' : 'bg-white/80 border-white'}`}>
                    {scelta >= 0 ? scelta + 1 : ''}
                  </span>
                )}
                {p.by && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-minuto px-1 py-0.5 truncate text-left">
                    {soloNome(p.by)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Stampa del ricordo: compare solo mentre si scelgono le foto. */}
      {picking && (
        <div className="mt-3 pt-3 border-t border-[#8F9E8B]/30 space-y-2">
          <p className="text-piccolo text-gray-600">
            {picked.length === 0
              ? L.t('galleria.toccaLeFoto')
              : frase('galleria.scelte', picked.length, photos.length, Math.ceil(picked.length / PER_PAGINA_ALBUM))}
          </p>
          <button
            onClick={() => generaRicordo(photos, false)}
            disabled={picked.length === 0 || !!pdfBusy}
            className={bottone('bruno', 'grande', 'w-full')}
          >
            {pdfBusy || L.t('galleria.creaConScelte', picked.length)}
          </button>
          <button
            onClick={() => setPicked(photos.map((x) => x.id))}
            disabled={!!pdfBusy || picked.length === photos.length}
            className={bottone('secondario', 'normale', 'w-full')}
          >
            {L.t('galleria.scegliTutte')}
          </button>
          <p className="text-minuto text-gray-400 italic leading-snug">
            {L.t('galleria.notaScelte')}
          </p>
        </div>
      )}

      {photos.length > 0 && !picking && cloud.connected && (
        <>
          {/* L'album completo è la strada normale: il ricordo del campo
              sono tutte le foto, in ordine di scatto. Scegliere a mano
              resta possibile, ma è il caso particolare. */}
          <button
            onClick={() => generaRicordo(photos, true)}
            disabled={!!pdfBusy}
            className={bottone('bruno', 'grande', 'w-full mt-3')}
          >
            {pdfBusy || L.t('galleria.creaCompleto', photos.length)}
          </button>
          <p className="text-minuto text-gray-400 italic mt-1.5 leading-snug">
            {frase('galleria.notaCompleto', Math.ceil(photos.length / PER_PAGINA_ALBUM))}
          </p>
          <button
            onClick={() => { setGalleryView('griglia'); setPicking(true); }}
            disabled={!!pdfBusy}
            className={bottone('secondario', 'normale', 'w-full mt-2')}
          >
            {L.t('galleria.scegliTu')}
          </button>
          <p className="text-minuto text-gray-400 italic mt-2">
            {L.t('galleria.notaFinale')}
          </p>
        </>
      )}
    </div>
  </div>
);
