// ---------- Archivio, gioco e guida ----------
// La Galleria sta a parte in 85-scheda-galleria.jsx: e' la piu' grossa delle
// quattro ed e' stata la prima a uscire.

const schedaArchivio = ({
  album,
  archives,
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
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">{L.t('area.archivio')}</h3>
      {archives.length === 0 ? (
        <p className="text-normale text-gray-400 italic">
          {frase('archivio.vuoto')}
        </p>
      ) : (
        <ul className="space-y-3">
          {archives.map((a) => (
            <li key={a.id} className="bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-rustic text-medio text-[#2D392C] truncate">{a.name}</p>
                  <p className="text-piccolo text-gray-500">
                    {L.t('archivio.periodoChiuso', a.from === a.to ? a.from : `${a.from} → ${a.to}`, L.data(new Date(a.closedAt), 'numerica'))}
                  </p>
                </div>
                <span className="font-rustic font-bold text-[#2D392C] shrink-0">{money((a.totals && a.totals.overall) || 0)} €</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-piccolo text-gray-500">
                <span>{L.t('archivio.membri', (a.totals && a.totals.members) || 0)}</span>
                <span>{L.t('archivio.spese', (a.totals && a.totals.purchases) || 0)}</span>
                <span>{L.t('archivio.pasti', (a.totals && a.totals.meals) || 0)}</span>
                {a.photos > 0 && <span>{L.t('archivio.foto', a.photos)}</span>}
                {!a.state && <span className="text-[#8F9E8B] italic">{L.t('archivio.soloCloud')}</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setViewArchive(a)} className={bottone('primario', 'normale', 'flex-1')}>{L.t('archivio.resoconto')}</button>
                {a.photos > 0 && (
                  <button onClick={() => openAlbum(a)} className="flex-1 py-2 bg-[#8F9E8B] text-white rounded text-piccolo font-bold uppercase hover:brightness-95">{L.t('archivio.album')}</button>
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
      <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
          <h3 className="font-rustic text-grande text-[#2D392C] truncate">{L.t('archivio.albumDi', album.name)}</h3>
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
                className="relative aspect-square overflow-hidden rounded border border-[#8F9E8B]/30 bg-[#F0F4F1]"
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

const schedaGioco = ({
  endGame,
  gameBest,
  gamePlayer,
  gameRunning,
  leaderboard,
  refreshLeaderboard,
  setGamePlayer,
  setGameRunning,
  startGame,
}) => (
  <div className="space-y-4">
    {!gameRunning ? (
      <>
        <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
          <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">{L.t('area.gioco')}</h3>
          <div className="flex items-center gap-3">
            <img src="./bandy.png" alt="Bandy" className="w-14 h-14 rounded border-2 border-[#8F9E8B]/40 bg-[#F0F4F1]" style={{ imageRendering: 'pixelated' }} />
            <p className="text-piccolo text-gray-600 leading-snug">
              {L.t('gioco.spiegazione')}
            </p>
          </div>
          <div>
            <label className="block text-piccolo uppercase font-bold text-gray-500 mb-1">{L.t('gioco.nomeGiocatore')}</label>
            <input
              type="text"
              value={gamePlayer}
              onChange={(e) => setGamePlayer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startGame()}
              placeholder={L.t('gioco.comeTiChiami')}
              maxLength={24}
              className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
            />
          </div>
          <button onClick={startGame} className={bottone('primario', 'grande', 'w-full')}>
            {L.t('gioco.gioca')}
          </button>
          <p className="text-minuto text-gray-400 italic">{L.t('gioco.comandi')}</p>
        </div>

        <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md">
          <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
            <h3 className="font-rustic text-grande">{L.t('gioco.classifica')}</h3>
            <button onClick={refreshLeaderboard} className="text-minuto uppercase font-bold text-[#8F9E8B] hover:text-white">{L.t('gioco.aggiorna')}</button>
          </div>
          <div className="flex justify-between text-piccolo mb-3 pb-2 border-b border-[#8F9E8B]/20">
            <span className="text-[#8F9E8B]">{L.t('gioco.tuoRecord')}</span>
            <span className="font-rustic text-[#D97706] text-grande leading-none">{gameBest}</span>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-piccolo text-gray-400 italic">{L.t('gioco.senzaPunteggi')}</p>
          ) : (
            <ul className="space-y-1">
              {leaderboard.map((r, i) => (
                <li key={r.name + i} className="flex items-center justify-between py-1">
                  <span className="text-normale truncate">
                    <span className="text-[#8F9E8B] mr-2">{i + 1}.</span>
                    {i === 0 ? '🏆 ' : ''}{r.name}
                  </span>
                  <span className="font-rustic font-bold text-[#D97706]">{r.score}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>
    ) : (
      <BandyGame
        playerName={gamePlayer.trim()}
        bestLocal={gameBest}
        onGameOver={endGame}
        onExit={() => { setGameRunning(false); refreshLeaderboard(); }}
      />
    )}
  </div>
);

const schedaGuida = ({
  GUIDE,
  guideOpen,
  setGuideOpen,
}) => (
  <div className="space-y-4">
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-1">{L.t('guida.titolo')}</h3>
      <p className="text-piccolo text-gray-500 mb-3">{L.t('guida.sottotitolo')}</p>

      {/* Pills */}
      <div className="flex flex-wrap gap-1.5">
        {GUIDE.map((g) => (
          <button
            key={g.k}
            onClick={() => setGuideOpen(g.k)}
            className={bottoneScelta('pillola', 'tenue', guideOpen === g.k, 'minuscolo')}
          >
            {g.icon} {g.title}
          </button>
        ))}
      </div>

      {/* Testo della pill selezionata */}
      {(() => {
        const g = GUIDE.find((x) => x.k === guideOpen) || GUIDE[0];
        return (
          <div className="mt-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-grande leading-none">{g.icon}</span>
              <span className="font-rustic text-[#2D392C]">{g.title}</span>
            </div>
            <p className="text-piccolo text-[#2D392C] leading-relaxed">{g.body}</p>
          </div>
        );
      })()}
    </div>

    <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md">
      <h4 className="font-rustic text-medio mb-2">{L.t('guida.trePassi')}</h4>
      <ol className="text-piccolo space-y-1.5 list-decimal list-inside text-[#F0F4F1]/90">
        <li>{frase('guida.passo1')}</li>
        <li>{frase('guida.passo2')}</li>
        <li>{frase('guida.passo3')}</li>
      </ol>
    </div>
  </div>
);
