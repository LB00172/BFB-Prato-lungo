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
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Archivio</h3>
      {archives.length === 0 ? (
        <p className="text-sm text-gray-400 italic">
          Nessun campo archiviato. Quando i conti sono chiusi, usa <span className="font-bold">Spese Totali → Dati → Chiudi il campo</span>:
          tutto finisce qui e l'app riparte pulita per l'evento successivo.
        </p>
      ) : (
        <ul className="space-y-3">
          {archives.map((a) => (
            <li key={a.id} className="bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-rustic text-base text-[#2D392C] truncate">{a.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {a.from === a.to ? a.from : `${a.from} → ${a.to}`} · chiuso il {new Date(a.closedAt).toLocaleDateString('it-IT')}
                  </p>
                </div>
                <span className="font-rustic font-bold text-[#2D392C] shrink-0">{money((a.totals && a.totals.overall) || 0)} €</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
                <span>{(a.totals && a.totals.members) || 0} membri</span>
                <span>{(a.totals && a.totals.purchases) || 0} spese</span>
                <span>{(a.totals && a.totals.meals) || 0} pasti</span>
                {a.photos > 0 && <span>{a.photos} foto</span>}
                {!a.state && <span className="text-[#8F9E8B] italic">solo cloud</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setViewArchive(a)} className={bottone('primario', 'piccolo', 'flex-1')}>Resoconto</button>
                {a.photos > 0 && (
                  <button onClick={() => openAlbum(a)} className="flex-1 py-2 bg-[#8F9E8B] text-white rounded text-[10px] font-bold uppercase hover:brightness-95">Album</button>
                )}
                <button onClick={() => downloadArchive(a)} className={bottone('bruno', 'piccolo', 'flex-1')}>Scarica</button>
                <button onClick={() => removeArchive(a)} aria-label="Elimina archivio" className={bottone('distruttivo', 'minuscolo')}>Elimina</button>
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
          <h3 className="font-rustic text-lg text-[#2D392C] truncate">Album · {album.name}</h3>
          <button onClick={() => setAlbum(null)} className={bottone('testuale', 'minuscolo', 'shrink-0')}>Chiudi</button>
        </div>
        {album.loading ? (
          <p className="text-sm text-gray-400 italic">Carico l'album…</p>
        ) : album.photos.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nessuna foto trovata: serve la linea per scaricarle.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {album.photos.map((p) => (
              <button
                key={p.id}
                onClick={() => openPhoto(p)}
                className="relative aspect-square overflow-hidden rounded border border-[#8F9E8B]/30 bg-[#F0F4F1]"
                aria-label={`Foto di ${p.by || 'anonimo'}`}
              >
                <img src={p.thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                {p.by && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-[8px] px-1 py-0.5 truncate text-left">{p.by}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    )}
    <p className="text-[9px] text-gray-400 italic text-center px-4">
      Il file scaricato alla chiusura è l'unica copia che contiene anche le foto degli scontrini: conservalo.
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
          <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aiuta Bandy</h3>
          <div className="flex items-center gap-3">
            <img src="./bandy.png" alt="Bandy" className="w-14 h-14 rounded border-2 border-[#8F9E8B]/40 bg-[#F0F4F1]" style={{ imageRendering: 'pixelated' }} />
            <p className="text-[11px] text-gray-600 leading-snug">
              Bandy è in montagna e non è ancora fatto: raggiungilo con la canna più volte che puoi. Ogni volta che lo prendi la canna si allunga — se sbatti contro i bordi o contro te stesso, GAME OVER.
            </p>
          </div>
          <div>
            <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Nome giocatore</label>
            <input
              type="text"
              value={gamePlayer}
              onChange={(e) => setGamePlayer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startGame()}
              placeholder="Come ti chiami?"
              maxLength={24}
              className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
            />
          </div>
          <button onClick={startGame} className={bottone('primario', 'grande', 'w-full')}>
            Gioca
          </button>
          <p className="text-[9px] text-gray-400 italic">Comandi: scorri il dito sul campo o usa le frecce sotto. Da computer: frecce o WASD.</p>
        </div>

        <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md">
          <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
            <h3 className="font-rustic text-lg">Classifica</h3>
            <button onClick={refreshLeaderboard} className="text-[9px] uppercase font-bold text-[#8F9E8B] hover:text-white">Aggiorna</button>
          </div>
          <div className="flex justify-between text-xs mb-3 pb-2 border-b border-[#8F9E8B]/20">
            <span className="text-[#8F9E8B]">Il tuo record</span>
            <span className="font-rustic text-[#D97706] text-lg leading-none">{gameBest}</span>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-[11px] text-gray-400 italic">Nessun punteggio condiviso ancora. Gioca una partita: con la linea il tuo record finisce qui per tutti.</p>
          ) : (
            <ul className="space-y-1">
              {leaderboard.map((r, i) => (
                <li key={r.name + i} className="flex items-center justify-between py-1">
                  <span className="text-sm truncate">
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
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-1">Come funziona l'app</h3>
      <p className="text-[11px] text-gray-500 mb-3">Tocca un'area per vedere a cosa serve. In sintesi: segni presenze e spese, l'app calcola quanto deve ciascuno e chi rimborsa chi.</p>

      {/* Pills */}
      <div className="flex flex-wrap gap-1.5">
        {GUIDE.map((g) => (
          <button
            key={g.k}
            onClick={() => setGuideOpen(g.k)}
            className={bottoneScelta('pillola', 'tenue', guideOpen === g.k, 'piccolo')}
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
              <span className="text-lg leading-none">{g.icon}</span>
              <span className="font-rustic text-[#2D392C]">{g.title}</span>
            </div>
            <p className="text-xs text-[#2D392C] leading-relaxed">{g.body}</p>
          </div>
        );
      })()}
    </div>

    <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md">
      <h4 className="font-rustic text-base mb-2">In tre passi</h4>
      <ol className="text-xs space-y-1.5 list-decimal list-inside text-[#F0F4F1]/90">
        <li>In <span className="font-bold">Membri</span> aggiungi le persone (e segna chi è bambino).</li>
        <li>Ogni giorno segna le <span className="font-bold">Presenze</span> e registra le spese nella <span className="font-bold">Lista della Spesa</span>: prima cosa serve in "Da acquistare", poi la sposti in "Acquistato" con prezzo e acquirente.</li>
        <li>In <span className="font-bold">Spese Totali → Saldi</span> vedi chi deve dare o ricevere e chi paga chi, e con <span className="font-bold">Condividi resoconto</span> lo mandi nel gruppo.</li>
      </ol>
    </div>
  </div>
);
