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
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Carica le tue foto</h3>

      {!cloud.connected ? (
        <p className="text-sm text-gray-500 leading-snug">
          La galleria vive nel cloud: serve la linea. È fatta apposta per il
          <span className="font-bold"> ritorno a casa</span> — al campo non c'è campo, e le foto
          occuperebbero lo spazio che serve a presenze e spese.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-[9px] uppercase font-bold text-gray-500 tracking-wide mb-1">Chi le ha scattate</label>
            <select
              value={photoWho}
              onChange={(e) => setPhotoWho(e.target.value)}
              className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
            >
              <option value="">— scegli il tuo nome —</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} ({photosBy(m.name)}/{photoCap})
                </option>
              ))}
            </select>
            {members.length === 0 && (
              <p className="text-[9px] text-[#D97706] mt-1">Aggiungi prima le persone nella scheda Membri.</p>
            )}
          </div>

          {photoWho && (
            <p className="text-[11px] text-gray-600">
              {photosBy(photoWho) >= photoCap
                ? <span className="text-[#D97706] font-bold">{photoWho} ha esaurito le sue {photoCap} foto. Cancellane una per farne entrare un'altra.</span>
                : <>A {photoWho} restano <span className="font-bold">{photoCap - photosBy(photoWho)}</span> foto su {photoCap}.</>}
            </p>
          )}

          <label className={`block w-full py-3 rounded font-bold uppercase text-sm tracking-wide text-center cursor-pointer ${photoWho && photosBy(photoWho) < photoCap && !photoBusy ? 'bg-[#2D392C] text-white hover:bg-[#1F271E]' : 'bg-gray-200 text-gray-400 pointer-events-none'}`}>
            {photoBusy || '📸 Scegli le foto'}
            <input type="file" accept="image/*" multiple onChange={addPhotos} className="hidden" />
          </label>

          {/* Le foto della galleria vivono solo nel cloud: la coda dei
              caricamenti sta in memoria, quindi chiudendo l'app adesso
              quello che non è ancora partito va rifatto. Gli scontrini
              no: quelli hanno una copia sul telefono e si ricaricano da
              soli al prossimo collegamento. */}
          {(cloud.foto || 0) > 0 && (
            <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
              <p className="text-[10px] text-[#5C4A3C] leading-snug">
                <span className="font-bold">{cloud.foto} {cloud.foto === 1 ? 'foto ancora da caricare' : 'foto ancora da caricare'}.</span>{' '}
                Tieni l'app aperta finché non sono partite: se la chiudi adesso, quelle vanno riscelte.
              </p>
            </div>
          )}

          <p className="text-[9px] text-gray-400 italic leading-snug">
            Massimo <span className="font-bold">{photoCap} foto a testa</span> (si cambia in Impostazioni): serve a scegliere
            le belle, non a svuotare il rullino. È un accordo fra noi, non un lucchetto: il nome si sceglie dalla tendina.
            Le foto vengono rimpicciolite prima di partire.
          </p>
        </div>
      )}
    </div>

    {/* Griglia */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3 gap-2">
        <h3 className="font-rustic text-lg text-[#2D392C] shrink-0">
          Album {photos.length > 0 ? `(${photos.length})` : ''}
        </h3>
        {/* Due modi di guardare le stesse foto: l'album per sfogliarle,
            la griglia per trovarle. La scelta a mano funziona solo in
            griglia, quindi ci passa da sola. */}
        {photos.length > 0 && !picking && (
          <div className="flex rounded border border-[#8F9E8B]/40 overflow-hidden shrink-0">
            {[['album', '📖 Album'], ['griglia', '▦ Griglia']].map(([k, l]) => (
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
            Annulla
          </button>
        )}
      </div>
      {!cloud.connected ? (
        <p className="text-sm text-gray-400 italic">Senza linea l'album non si può sfogliare.</p>
      ) : !photosReady ? (
        <p className="text-sm text-gray-400 italic">Carico l'album…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Ancora nessuna foto. Comincia tu.</p>
      ) : galleryView === 'album' && !picking ? (
        <div>
          <div className="album-sfoglio" ref={albumRef} onScroll={onScrollAlbum}>
            {paginaAlbum(photos).map((gruppo, i) => (
              <div key={i} className={`album-pagina ${gruppo.length === 1 ? '' : ''}`}>
                <div className={`album-griglia ${gruppo.length === 1 ? 'una' : ''}`}>
                  {gruppo.map((p) => (
                    <button key={p.id} onClick={() => openPhoto(p)} className="polaroid" aria-label={`Foto di ${p.by || 'anonimo'}`}>
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
              aria-label="Pagina precedente"
              className={`w-8 h-8 rounded-full border border-[#8F9E8B]/40 text-sm ${albumPage <= 0 ? 'text-gray-300' : 'text-[#2D392C]'}`}
            >
              ‹
            </button>
            <span className="text-[10px] uppercase tracking-widest text-gray-500">
              {Math.min(albumPage + 1, paginaAlbum(photos).length)} / {paginaAlbum(photos).length}
            </span>
            <button
              onClick={() => sfoglia(1)}
              disabled={albumPage >= paginaAlbum(photos).length - 1}
              aria-label="Pagina successiva"
              className={`w-8 h-8 rounded-full border border-[#8F9E8B]/40 text-sm ${albumPage >= paginaAlbum(photos).length - 1 ? 'text-gray-300' : 'text-[#2D392C]'}`}
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
                aria-label={picking ? `Scegli la foto di ${p.by || 'anonimo'}` : `Foto di ${p.by || 'anonimo'}`}
              >
                <img src={p.thumb} alt="" className={`w-full h-full object-cover ${picking && scelta < 0 ? 'opacity-45' : ''}`} loading="lazy" />
                {picking && (
                  <span className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border-2 ${scelta >= 0 ? 'bg-[#2D392C] text-white border-[#2D392C]' : 'bg-white/80 border-white'}`}>
                    {scelta >= 0 ? scelta + 1 : ''}
                  </span>
                )}
                {p.by && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-[8px] px-1 py-0.5 truncate text-left">
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
          <p className="text-[11px] text-gray-600">
            {picked.length === 0
              ? 'Tocca le foto da mettere nel ricordo. L\'ordine è quello con cui le scegli.'
              : <>Scelte <span className="font-bold">{picked.length}</span> foto su {photos.length} · {Math.ceil(picked.length / PER_PAGINA_ALBUM)} {Math.ceil(picked.length / PER_PAGINA_ALBUM) === 1 ? 'pagina' : 'pagine'}</>}
          </p>
          <button
            onClick={() => generaRicordo(photos, false)}
            disabled={picked.length === 0 || !!pdfBusy}
            className={bottone('bruno', 'grande', 'w-full')}
          >
            {pdfBusy || `Crea album con le scelte${picked.length ? ` (${picked.length})` : ''}`}
          </button>
          <button
            onClick={() => setPicked(photos.map((x) => x.id))}
            disabled={!!pdfBusy || picked.length === photos.length}
            className={bottone('secondario', 'piccolo', 'w-full')}
          >
            Scegli tutte
          </button>
          <p className="text-[9px] text-gray-400 italic leading-snug">
            Crea un PDF con le foto scelte su uno sfondo di montagna, quattro per pagina.
            Le foto vengono scaricate a piena qualità, quindi ci vuole qualche secondo.
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
            {pdfBusy || `📕 Crea album completo (${photos.length} ${photos.length === 1 ? 'foto' : 'foto'})`}
          </button>
          <p className="text-[9px] text-gray-400 italic mt-1.5 leading-snug">
            Un PDF con <span className="font-bold">tutte</span> le foto della galleria su uno sfondo di
            montagna, quattro per pagina, dalla prima all'ultima in ordine di scatto
            ({Math.ceil(photos.length / PER_PAGINA_ALBUM)} {Math.ceil(photos.length / PER_PAGINA_ALBUM) === 1 ? 'pagina' : 'pagine'}).
            Vengono scaricate a piena qualità, quindi ci vuole un po'.
          </p>
          <button
            onClick={() => { setGalleryView('griglia'); setPicking(true); }}
            disabled={!!pdfBusy}
            className={bottone('secondario', 'piccolo', 'w-full mt-2')}
          >
            Scegli tu quali foto
          </button>
          <p className="text-[9px] text-gray-400 italic mt-2">
            Tocca una foto per vederla grande. Le foto restano nel campo: alla chiusura finiscono
            nell'archivio insieme ai conti.
          </p>
        </>
      )}
    </div>
  </div>
);
