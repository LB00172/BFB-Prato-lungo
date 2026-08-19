// ---------- Scheda Impostazioni ----------
// La piu' grande di tutte, e la piu' intrecciata: aspetto, blocco, backup,
// modalita' tecnica, chiusura del campo. Sta da sola apposta.

const schedaImpostazioni = ({
  admin,
  adminErr,
  adminPwd,
  annullaSync,
  askAlways,
  bloccoOpen,
  campData,
  cloud,
  datiOpen,
  diagTick,
  entraAdmin,
  esciAdmin,
  esportaRegistro,
  exportData,
  goTo,
  isDark,
  isOnline,
  lockNow,
  logOpen,
  members,
  metaRef,
  photoCap,
  purchases,
  readyChecks,
  readyOk,
  setAdminErr,
  setAdminPwd,
  setBloccoOpen,
  setDatiOpen,
  setDiagTick,
  setLogOpen,
  setLostSync,
  setPhotoCap,
  setTecnicaOpen,
  setTheme,
  swVersion,
  syncStateRef,
  tecnicaOpen,
  theme,
  toggleAskAlways,
  wipeLocal,
}) => (
  <div className="space-y-4">
    {/* Pronto per il campo */}
    <div className={`p-4 rounded-lg border-2 shadow-sm space-y-3 ${readyOk ? 'bg-white border-[#2D392C]/20' : 'bg-white border-[#D97706]/50'}`}>
      <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
        <h3 className="font-rustic text-lg text-[#2D392C]">Pronto per il campo</h3>
        <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${readyOk ? 'bg-[#2D392C] text-white' : 'bg-[#D97706] text-white'}`}>
          {readyOk ? 'Sì' : 'Non ancora'}
        </span>
      </div>
      <p className="text-[10px] text-gray-500 leading-snug">
        A Prato Lungo non c'è linea. Controlla queste tre cose <span className="font-bold">prima di partire</span>:
        lassù non si sistemano.
      </p>
      <ul className="space-y-2">
        {readyChecks.map((c) => (
          <li key={c.titolo} className={`flex items-start gap-2 p-2.5 rounded border ${c.ok ? 'bg-[#F0F4F1]/60 border-[#8F9E8B]/20' : 'bg-[#D97706]/10 border-[#D97706]/40'}`}>
            <span className="text-base leading-none shrink-0">{c.ok ? '✅' : '⚠️'}</span>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-[#2D392C]">{c.titolo}</div>
              {!c.ok && <div className="text-[10px] text-[#5C4A3C] leading-snug mt-0.5">{c.no}</div>}
            </div>
          </li>
        ))}
      </ul>
      {readyOk && (
        <p className="text-[9px] text-gray-400 italic">Questo telefono funziona anche senza linea. Ricontrolla il giorno della partenza.</p>
      )}
    </div>

    {/* Aspetto */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aspetto</h3>
      <div className="grid grid-cols-3 gap-2">
        {[['auto', 'Automatico', '🌗'], ['light', 'Chiaro', '☀️'], ['dark', 'Scuro', '🌙']].map(([k, l, icon]) => (
          <button
            key={k}
            onClick={() => setTheme(k)}
            className={`py-2.5 rounded text-[10px] font-bold uppercase tracking-wide border-b-4 transition-all ${
              theme === k ? 'bg-[#2D392C] text-white border-[#5C4A3C]' : 'bg-white text-[#2D392C] border-gray-300 hover:bg-[#E2EAE4]'
            }`}
          >
            <span className="block text-base leading-none mb-1">{icon}</span>
            {l}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-500">
        {theme === 'auto'
          ? `Segue le impostazioni del telefono: adesso è ${isDark ? 'scuro' : 'chiaro'}.`
          : `Sempre ${theme === 'dark' ? 'scuro' : 'chiaro'}, indipendentemente dal telefono.`}
        {' '}Comodo la sera in tenda: schermo scuro, meno luce in faccia a tutti.
      </p>
    </div>

    {/* Galleria */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Galleria</h3>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#2D392C]">Foto per persona</span>
        <div className="flex items-center gap-2 shrink-0">
          {[3, 4, 5, 7].map((n) => (
            <button
              key={n}
              onClick={() => { setPhotoCap(n); scriviLocale(PHOTO_CAP_KEY, String(n)); }}
              className={`w-9 py-1.5 rounded text-xs font-bold border-b-2 ${photoCap === n ? 'bg-[#2D392C] text-white border-[#5C4A3C]' : 'bg-white text-[#2D392C] border-gray-300'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-gray-500 leading-snug">
        Quante foto può caricare ciascuno. È un accordo di gruppo che vale su questo telefono, non un
        controllo: serve a far scegliere le foto belle. Mettetevi d'accordo sullo stesso numero.
      </p>
    </div>

    {/* Diagnostica della sincronizzazione: cosa è stato cancellato e
        quando. Senza questa scheda, capire chi ha fatto sparire cosa
        vuol dire leggere il database a mano. Solo in modalità tecnica. */}
    {admin && (
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Diagnostica sincronizzazione</h3>
      {(() => {
        const m = metaRef.current || { rev: {}, del: {} };
        const st = syncStateRef.current;
        const lapidi = Object.keys(m.del || {})
          .map((p) => ({ p, at: m.del[p] }))
          .sort((a, b) => b.at - a.at);
        // diagTick serve solo a far ridisegnare questa scheda quando la
        // copia di scorta viene buttata: senza, resterebbe a schermo.
        void diagTick;
        const scorta = load(RESCUE_KEY, null);
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
              <span><span className="font-bold text-[#2D392C]">{Object.keys(m.rev || {}).length}</span> voci datate</span>
              <span><span className="font-bold text-[#2D392C]">{lapidi.length}</span> cancellazioni registrate</span>
            </div>

            {/* Un telefono pieno di dati ma senza nemmeno una data è
                indifeso: non può vincere un confronto e la prima
                sincronizzazione gli porta via tutto ciò che gli altri
                hanno cancellato. È lo stato in cui si finisce quando la
                memoria si riempie, e non si vedeva da nessuna parte. */}
            {Object.keys(m.rev || {}).length === 0 &&
              ((st.members || []).length > 0 || (st.purchases || []).length > 0 || Object.keys(st.campData || {}).length > 0) && (
              <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                <p className="text-[10px] text-[#5C4A3C] leading-snug">
                  <span className="font-bold">Questo telefono non ha ancora la cronologia delle modifiche.</span> I dati ci
                  sono, ma sono "senza data": in una sincronizzazione perdono contro quelli degli altri. Basta
                  toccare qualcosa perché riparta. Se succede spesso, è la memoria del telefono che è piena.
                </p>
              </div>
            )}

            {/* Cosa non è ancora arrivato agli altri, e come forzarlo. */}
            {(cloud.pending || (cloud.foto || 0) > 0) && (
              <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                <p className="text-[10px] text-[#5C4A3C] leading-snug">
                  <span className="font-bold">Da inviare:</span>
                  {cloud.pending ? ' le ultime modifiche' : ''}
                  {cloud.pending && (cloud.foto || 0) > 0 ? ' e' : ''}
                  {(cloud.foto || 0) > 0 ? ` ${cloud.foto} ${cloud.foto === 1 ? 'foto' : 'foto'}` : ''}.
                  {' '}L'app riprova da sola, con attese sempre più lunghe. Tieni l'app aperta e la linea
                  attiva finché la spia in alto non torna verde.
                </p>
                <button
                  onClick={() => { const CS = window.CloudSync; if (CS && CS.riprova) CS.riprova(); }}
                  className={bottone('avviso', 'piccolo', 'w-full mt-2')}
                >
                  Riprova adesso
                </button>
              </div>
            )}

            {scorta && scorta.state && (
              <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5 space-y-2">
                <p className="text-[10px] text-[#5C4A3C] leading-snug">
                  <span className="font-bold">Rete di sicurezza.</span> Il {new Date(scorta.at).toLocaleString('it-IT')} una
                  sincronizzazione ha tolto {scorta.perse === 1 ? 'una voce' : `${scorta.perse} voci`} da questo telefono, e
                  l'app ha messo da parte una copia di com'era prima.
                  {scorta.quando ? (
                    <> La cancellazione è stata fatta il <span className="font-bold">{new Date(scorta.quando).toLocaleString('it-IT')}</span>
                      {Date.now() - scorta.quando > PERDITA_RECENTE
                        ? <> — non adesso: questo telefono era indietro e l'ha saputo solo ora.</>
                        : '.'}
                    </>
                  ) : null}
                </p>
                <p className="text-[10px] text-[#5C4A3C] leading-snug">
                  Annullando torna {scorta.perse === 1 ? 'quella voce' : 'quello che è sparito'}
                  {scorta.paths && scorta.paths.length
                    ? <> — <span className="font-bold">{descriviPerdite(scorta.paths, scorta.state)}</span></>
                    : null}, su tutti i telefoni. Tutto il resto, comprese le modifiche fatte dopo, rimane.
                </p>
                <button onClick={annullaSync} className={bottone('avviso', 'piccolo', 'w-full')}>
                  Annulla quella sincronizzazione
                </button>
                <button
                  onClick={() => { if (window.confirm('Buttare la copia di scorta?\nDopo non si potrà più annullare quella sincronizzazione.')) { localStorage.removeItem(RESCUE_KEY); setLostSync(null); setDiagTick((t) => t + 1); } }}
                  className={bottone('testuale', 'minuscolo', 'w-full')}
                >
                  Va bene così, butta la copia
                </button>
              </div>
            )}

            {lapidi.length === 0 ? (
              <p className="text-[11px] text-gray-400 italic">Nessuna cancellazione registrata su questo telefono.</p>
            ) : (
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Ultime cancellazioni</p>
                <ul className="space-y-1">
                  {lapidi.slice(0, 12).map((l) => (
                    <li key={l.p} className="flex items-start justify-between gap-2 text-[10px] bg-[#F0F4F1]/60 px-2 py-1.5 rounded border border-[#8F9E8B]/20">
                      <span className="text-[#2D392C] leading-snug">{descriviPath(l.p, st)}</span>
                      <span className="text-gray-500 shrink-0">
                        {new Date(l.at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                        {' '}{new Date(l.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
                {lapidi.length > 12 && (
                  <p className="text-[9px] text-gray-400 italic mt-1">…e altre {lapidi.length - 12}.</p>
                )}
              </div>
            )}
            <p className="text-[9px] text-gray-400 italic leading-snug">
              Una cancellazione è normale quando qualcuno toglie davvero una voce. Se ne vedi tante
              tutte allo stesso minuto, è il segno di un ripristino, di un'importazione o di un
              "Copia da ieri": in quel caso la copia di scorta qui sopra rimette tutto a posto.
            </p>
          </div>
        );
      })()}
    </div>
    )}

    {/* Registro delle modifiche: chi ha cambiato cosa e quando. Non ci
        sono utenti tracciati, quindi si distingue almeno fra ciò che è
        stato fatto qui e ciò che è arrivato dalla sincronizzazione.
        Solo in modalità tecnica. */}
    {admin && (
    <div className="bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden">
      <button
        onClick={() => setLogOpen((v) => !v)}
        className={bottoneRiga()}
      >
        <span className="font-rustic text-lg text-[#2D392C] shrink-0">Registro modifiche</span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[9px] uppercase font-bold px-2 py-1 rounded bg-gray-200 text-gray-500">
            {(() => { void diagTick; const n = logLeggi().length; return n === 0 ? 'vuoto' : `${n} voci`; })()}
          </span>
          <span className={`text-[10px] text-[#5C4A3C] transition-transform ${logOpen ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {logOpen && (<div className="px-4 pb-4 space-y-3">
        {(() => {
          void diagTick;
          const reg = logLeggi();
          const st = syncStateRef.current;
          if (reg.length === 0) {
            return <p className="text-[11px] text-gray-400 italic">Ancora nessuna modifica registrata su questo telefono.</p>;
          }
          // Raggruppate per giorno: leggere 400 righe di fila è inutile.
          const perGiorno = [];
          reg.forEach((r) => {
            const g = new Date(r.at).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
            const ultimo = perGiorno[perGiorno.length - 1];
            if (ultimo && ultimo.giorno === g) ultimo.voci.push(r);
            else perGiorno.push({ giorno: g, voci: [r] });
          });
          return (
            <>
              <p className="text-[10px] text-gray-500 leading-snug">
                Ogni modifica, fatta qui o arrivata dagli altri, con data e ora. Le più recenti in alto.
                Resta su questo telefono e non viene sincronizzata.
              </p>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {perGiorno.map((gruppo) => (
                  <div key={gruppo.giorno}>
                    <p className="text-[9px] uppercase font-bold text-gray-500 tracking-wide mb-1">{gruppo.giorno}</p>
                    <ul className="space-y-1">
                      {gruppo.voci.map((r, i) => (
                        <li key={r.p + r.at + i} className="flex items-start gap-2 text-[10px] bg-[#F0F4F1]/60 px-2 py-1.5 rounded border border-[#8F9E8B]/20">
                          <span className="text-gray-500 shrink-0 w-10">
                            {new Date(r.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className={`shrink-0 w-3 text-center ${r.k === 'd' ? 'text-red-700' : 'text-[#2D392C]'}`} title={r.k === 'd' ? 'cancellata' : 'modificata'}>
                            {r.k === 'd' ? '−' : '+'}
                          </span>
                          <span className="min-w-0 flex-grow leading-snug">
                            <span className="font-bold text-[#5C4A3C]">{sezioneDiPath(r.p)}</span>
                            <span className="text-[#2D392C]"> · {descriviPath(r.p, st)}</span>
                          </span>
                          <span className={`shrink-0 text-[8px] uppercase font-bold px-1.5 py-0.5 rounded ${r.o === 'io' ? 'bg-[#2D392C]/10 text-[#2D392C]' : 'bg-[#5C4A3C]/10 text-[#5C4A3C]'}`}>
                            {r.o === 'io' ? 'qui' : 'sync'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={esportaRegistro} className={bottone('primario', 'piccolo', 'flex-1')}>Esporta il registro</button>
                <button
                  onClick={() => { if (window.confirm('Svuotare il registro delle modifiche?\nI dati non vengono toccati: si perde solo lo storico.')) { localStorage.removeItem(LOG_KEY); setDiagTick((t) => t + 1); } }}
                  className={bottone('secondario', 'piccolo', 'flex-1')}
                >
                  Svuota
                </button>
              </div>
            </>
          );
        })()}
      </div>)}
    </div>
    )}

    {/* Blocco con password — riga richiudibile: si imposta una volta e
        non si tocca più, quindi sta chiusa e in fondo. */}
    <div className="bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden">
      <button
        onClick={() => setBloccoOpen((v) => !v)}
        className={bottoneRiga()}
      >
        <span className="font-rustic text-lg text-[#2D392C] shrink-0">Blocco con password</span>
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {/* Stato del database anche da chiusa: è l'unica cosa che
              serve vedere a colpo d'occhio. */}
          {(() => {
            const lock = window.APP_LOCK || {};
            if (!lock.dbEmail || !(LOCK && LOCK.hash)) return null;
            const protetto = cloud.authMode === 'shared';
            const ignoto = !protetto && !cloud.connected;
            return <span className="text-[10px]" title={protetto ? 'Database protetto' : ignoto ? 'Non collegato' : 'Database ad accesso aperto'}>{protetto ? '🔒' : ignoto ? '—' : '⚠'}</span>;
          })()}
          <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${LOCK && LOCK.hash ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`}>
            {LOCK && LOCK.hash ? 'Attivo' : 'Non attivo'}
          </span>
          <span className={`text-[10px] text-[#5C4A3C] transition-transform ${bloccoOpen ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {bloccoOpen && (<div className="px-4 pb-4 space-y-3">
      {LOCK && LOCK.hash ? (
        <>
          <p className="text-[10px] text-gray-500 leading-snug">
            All'apertura serve la password del campo. Tienila nel gruppo, non pubblicarla altrove.
            Serve a non lasciare spese, nomi e scontrini alla portata di chi capita sull'indirizzo:
            non è una cassaforte, perché il controllo gira sul telefono.
          </p>
          {/* Stato reale della protezione del database: il blocco
              dell'app e la chiusura del cloud sono due cose diverse. */}
          {(() => {
            const lock = window.APP_LOCK || {};
            if (!lock.dbEmail) return null;
            const protetto = cloud.authMode === 'shared';
            // Senza collegamento non si può sapere come si entrerà nel
            // database: meglio dirlo, invece di allarmare chi è offline.
            const ignoto = !protetto && !cloud.connected;
            return (
              <div className={`p-3 rounded border ${protetto ? 'bg-[#2D392C]/5 border-[#2D392C]/25' : ignoto ? 'bg-[#F0F4F1]/60 border-[#8F9E8B]/30' : 'bg-[#D97706]/10 border-[#D97706]/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Database</span>
                  <span className={`text-[10px] font-bold ${protetto ? 'text-[#2D392C]' : ignoto ? 'text-gray-500' : 'text-[#D97706]'}`}>
                    {protetto ? '🔒 protetto dalla password' : ignoto ? '— non collegato' : '⚠ accesso aperto'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 leading-snug mt-1">
                  {protetto
                    ? 'L\'app entra nel database con l\'utente del campo: senza password i dati non si leggono nemmeno da fuori.'
                    : ignoto
                    ? 'Senza linea non c\'è nulla da proteggere: si lavora in locale. Il controllo si aggiorna al prossimo collegamento.'
                    : 'I dati nel cloud sono ancora raggiungibili senza password. Per chiuderli servono i passaggi nella console Firebase (utente condiviso + regole): finché non sono fatti, il blocco protegge solo la schermata.'}
                </p>
              </div>
            );
          })()}
          <label className="flex items-center gap-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20 cursor-pointer">
            <input type="checkbox" checked={askAlways} onChange={toggleAskAlways} className="w-4 h-4 accent-[#2D392C] shrink-0" />
            <span className="text-[11px] text-[#2D392C] leading-snug">
              Chiedi la password <span className="font-bold">ogni volta</span> che apro l'app
              <span className="block text-[9px] text-gray-500">Senza la spunta il telefono resta sbloccato fino a "Blocca ora".</span>
            </span>
          </label>
          {window.CloudSync && window.CloudSync.needsPassword && window.CloudSync.needsPassword() && (
            <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
              <p className="text-[11px] text-[#5C4A3C] leading-snug">
                La sincronizzazione sta usando l'accesso di ripiego. L'app chiede la
                password da sola quando serve: se non è successo, tocca
                <span className="font-bold"> Blocca ora</span> e rientra.
              </p>
            </div>
          )}
          <button onClick={lockNow} className={bottone('bruno', 'normale', 'w-full')}>
            🔒 Blocca ora
          </button>
        </>
      ) : (
        <p className="text-[10px] text-gray-500">
          Nessuna password impostata: l'app si apre a chiunque abbia l'indirizzo.
        </p>
      )}
      </div>)}
    </div>

    {/* Dati su questo telefono — riga richiudibile. */}
    <div className="bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden">
      <button
        onClick={() => setDatiOpen((v) => !v)}
        className={bottoneRiga()}
      >
        <span className="font-rustic text-lg text-[#2D392C] shrink-0">Dati su questo telefono</span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${cloud.connected ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`}>
            {cloud.connected ? 'Connessa' : isOnline ? 'Non connessa' : 'Offline'}
          </span>
          <span className={`text-[10px] text-[#5C4A3C] transition-transform ${datiOpen ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {datiOpen && (<div className="px-4 pb-4 space-y-3">
      <div className="flex gap-2">
        <button onClick={exportData} className={bottone('primario', 'normale', 'flex-1')}>Esporta backup</button>
        <button onClick={() => goTo('spesa')} className={bottone('secondario', 'normale', 'flex-1')}>Gestione dati</button>
      </div>
      <button onClick={wipeLocal} className={bottone('distruttivo', 'normale', 'w-full')}>
        Cancella i dati da questo telefono
      </button>
      <p className="text-[9px] text-gray-400 italic leading-snug">
        Utile se presti o cambi telefono. Il cloud non viene toccato: con la linea i dati tornano da soli.
      </p>
      </div>)}
    </div>

    {/* Modalità tecnica — riga richiudibile. Si accende con una
        password sua, per telefono: gli avvisi sulle voci cancellate,
        la diagnostica, il registro e il promemoria del backup si
        vedono solo qui. Gli altri usano l'app e basta. */}
    <div className="bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden">
      <button
        onClick={() => setTecnicaOpen((v) => !v)}
        className={bottoneRiga()}
      >
        <span className="font-rustic text-lg text-[#2D392C] shrink-0">Modalità tecnica</span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${admin ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`}>
            {admin ? 'Attiva' : 'Spenta'}
          </span>
          <span className={`text-[10px] text-[#5C4A3C] transition-transform ${tecnicaOpen ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {tecnicaOpen && (<div className="px-4 pb-4 space-y-3">
        {admin ? (
          <>
            <p className="text-[10px] text-gray-500 leading-snug">
              Su questo telefono si vedono la <span className="font-bold">Diagnostica sincronizzazione</span>, il
              <span className="font-bold"> Registro modifiche</span>, gli avvisi sulle voci cancellate e il
              promemoria serale del backup. Sono strumenti per chi tiene i conti: sugli altri telefoni
              non compare niente di tutto questo.
            </p>
            <button
              onClick={esciAdmin}
              className={bottone('secondario', 'normale', 'w-full')}
            >
              Spegni la modalità tecnica
            </button>
          </>
        ) : (
          <>
            <p className="text-[10px] text-gray-500 leading-snug">
              Per chi tiene i conti del campo: mostra la diagnostica della sincronizzazione, il registro
              delle modifiche e gli avvisi tecnici, solo su questo telefono. Ha una password dedicata,
              diversa da quella del campo.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={adminPwd}
                onChange={(e) => { setAdminPwd(e.target.value); setAdminErr(''); }}
                onKeyDown={(e) => e.key === 'Enter' && entraAdmin()}
                placeholder="Password tecnica"
                className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm"
              />
              <button
                onClick={entraAdmin}
                className={bottone('primario', 'normale', 'shrink-0')}
              >
                Attiva
              </button>
            </div>
            {adminErr && <p className="text-[10px] font-bold text-red-700">{adminErr}</p>}
          </>
        )}
      </div>)}
    </div>

    {/* Info */}
    <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md space-y-2">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-1">Info</h3>
      <div className="flex justify-between text-[11px]">
        <span className="text-[#8F9E8B]">Versione installata</span>
        <span className="font-bold">{swVersion || '—'}</span>
      </div>
      <p className="text-[10px] text-[#F0F4F1]/70 leading-snug">
        L'app si aggiorna da sola: se non vedi una novità, chiudila e riaprila.
      </p>
      <p className="text-[9px] text-[#8F9E8B]/80 pt-1">{BRAND.credits}</p>
    </div>
  </div>
);
