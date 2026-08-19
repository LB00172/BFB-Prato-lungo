// ---------- Schede del giorno: Calendario, Menu', Presenze ----------
// Uscite da 80-app.jsx. Sono funzioni che restituiscono JSX, non componenti
// React: nessun confine di riconciliazione nuovo, nessun hook spostato,
// l'albero prodotto e' identico. L'elenco delle dipendenze in cima a ognuna e'
// il punto del lavoro: sono le cose che quel disegno si prendeva dalla
// chiusura di App() senza dirlo.

const schedaCalendario = ({
  admin,
  calculateTotals,
  fetchWeather,
  getDayData,
  getMeal,
  goTo,
  isOnline,
  members,
  presenzeOrfane,
  readyOk,
  renderWeekStrip,
  selectedDateStr,
  sepDays,
  sepOpen,
  setSepOpen,
  toggleSepDay,
  updateDayData,
  weather,
  weekDays,
  wxBusy,
}) => (
  <div className="space-y-4">
    {!readyOk && (
      <button
        onClick={() => goTo('impostazioni')}
        className="w-full bg-[#D97706]/10 border border-[#D97706]/40 rounded-lg p-3 text-left flex items-start gap-2 hover:bg-[#D97706]/15"
      >
        <span className="text-base leading-none mt-0.5">⚠️</span>
        <span className="text-[11px] text-[#5C4A3C] leading-snug">
          <span className="font-bold">Questo telefono non è ancora pronto per il campo.</span>{' '}
          Al campo non c'è linea: tocca qui per vedere cosa manca, finché sei collegato.
        </span>
      </button>
    )}
    {/* Presenze rimaste senza padrone: si vedono anche da qui, altrimenti
        se ne accorge solo chi apre Presenze. */}
    {(() => {
      const orfane = presenzeOrfane();
      if (orfane.length === 0) return null;
      const totale = orfane.reduce((s, o) => s + o.pasti, 0);
      return (
        <button
          onClick={() => goTo('presenze')}
          className="w-full bg-[#D97706]/10 border border-[#D97706]/40 rounded-lg p-3 text-left flex items-start gap-2 hover:bg-[#D97706]/15"
        >
          <span className="text-base leading-none mt-0.5">🍽️</span>
          <span className="text-[11px] text-[#5C4A3C] leading-snug">
            <span className="font-bold">{totale} presenze non contano nei conti.</span>{' '}
            Sono di {orfane.length === 1 ? 'una persona' : `${orfane.length} persone`} eliminate e riaggiunte fra i Membri:
            tocca qui per riattaccarle a chi di dovere.
          </span>
        </button>
      );
    })()}

    {renderWeekStrip()}

    {/* Giorni del conto separato: le presenze di questi giorni fanno
        cassa a parte (vedi calculateTotals). Sta chiuso: è una cosa che
        si imposta una volta, non a ogni apertura del Calendario. */}
    <div className="bg-white rounded-lg border border-[#8F9E8B]/30 shadow-sm overflow-hidden">
      <button
        onClick={() => setSepOpen((v) => !v)}
        className={bottoneRiga()}
      >
        <span className="text-[10px] uppercase font-bold text-[#5C4A3C] shrink-0">Conto separato</span>
        <span className="ml-auto text-[9px] text-gray-500 truncate">
          {sepDays.length === 0 ? 'nessun giorno' : `${sepDays.length} ${sepDays.length === 1 ? 'giorno' : 'giorni'} in totale`}
        </span>
        <span className={`text-[10px] text-[#5C4A3C] shrink-0 transition-transform ${sepOpen ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {sepOpen && (<div className="px-3 pb-3">
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d) => {
          const dateStr = toDateStr(d);
          const on = sepDays.includes(dateStr);
          return (
            <label
              key={dateStr}
              title={`${d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}: conto separato`}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded cursor-pointer border ${
                on ? 'bg-[#5C4A3C]/15 border-[#5C4A3C]/50' : 'bg-[#F0F4F1]/50 border-transparent hover:bg-[#E2EAE4]'
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggleSepDay(dateStr)}
                className="w-3.5 h-3.5 accent-[#5C4A3C]"
              />
              <span className={`text-[9px] font-bold ${on ? 'text-[#5C4A3C]' : 'text-gray-400'}`}>{d.getDate()}</span>
            </label>
          );
        })}
      </div>
      <p className="text-[9px] text-gray-400 italic mt-2 leading-snug">
        Spunta i giorni che fanno cassa a parte: cibo e bevande registrati sul
        <span className="font-bold"> conto separato</span> si dividono solo fra chi era presente ai pasti di quei giorni.
        Gli altri giorni restano nel conto comune. Logistica e attrezzatura restano sempre in comune.
      </p>
      </div>)}
    </div>

    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-lg border-b border-dashed border-[#8F9E8B] pb-1">
        {parseDate(selectedDateStr).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
      </h3>

      {/* Meteo previsto per il giorno selezionato */}
      {(() => {
        const loc = window.CAMP_LOCATION;
        const locOk = loc && typeof loc.lat === 'number' && typeof loc.lon === 'number';
        const wx = weather.byDate[selectedDateStr];
        return (
          <div className="bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20 space-y-1">
            <div className="flex items-center gap-2">
              {!locOk ? (
                <span className="text-[10px] text-gray-400 italic">Meteo: località del campo da impostare.</span>
              ) : wx ? (() => {
                // La faccia della giornata e', quando si sa, la
                // condizione prevalente delle ore diurne; il brutto si
                // nomina a parte col suo momento. I millimetri dicono
                // se e' una spruzzata o una lavata: "40%" da solo no.
                const r = raccontaMeteo(wx);
                return (
                <>
                  <span className="text-2xl leading-none">{r.icon}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-[#2D392C] leading-tight">
                      {r.label}{r.coda ? <span className="font-normal">, {r.coda}</span> : null}
                    </span>
                    {loc.label && <span className="text-[9px] text-gray-400">{loc.label}</span>}
                  </div>
                  <span className="ml-auto text-xs text-gray-600 font-bold shrink-0 text-right">
                    {Math.round(wx.tmax)}° / {Math.round(wx.tmin)}°
                    {r.mm
                      ? <span className="text-[#5C8AA8]"> · 💧{r.mm}</span>
                      : wx.rain != null ? <span className="text-[#5C8AA8]"> · 💧{wx.rain}%</span> : null}
                  </span>
                </>
                );
              })() : (
                <span className="text-[10px] text-gray-400 italic">
                  Previsione non ancora disponibile per questo giorno{isOnline ? ' (copre 16 giorni in avanti)' : ' (offline)'}.
                </span>
              )}
            </div>
            {/* Stessa previsione per tutti: si vede quando è stata
                scaricata, così è chiaro se qualcuno ha numeri vecchi. */}
            {locOk && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#8F9E8B]/20">
                {(() => {
                  const vecchia = weather.fetchedAt && Date.now() - weather.fetchedAt > METEO_VECCHIO;
                  return (
                    <span className={`text-[9px] ${vecchia ? 'text-[#D97706] font-bold' : 'text-gray-400'}`}>
                      {weather.fetchedAt
                        ? `${vecchia ? '⚠ Previsioni vecchie, del' : 'Previsioni del'} ${new Date(weather.fetchedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} alle ${new Date(weather.fetchedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}${vecchia ? ': altrove ne trovi di più fresche.' : ' · uguali per tutto il campo'}`
                        : 'Previsioni non ancora scaricate.'}
                    </span>
                  );
                })()}
                <button
                  onClick={() => fetchWeather(true)}
                  disabled={!isOnline || wxBusy}
                  className={bottone('secondario', 'minuscolo', 'shrink-0')}
                >
                  {wxBusy ? '…' : 'Aggiorna'}
                </button>
              </div>
            )}
            {/* Diagnostica: da dove viene il meteo. Serve a controllare
                che il modello stia guardando il prato e non il paese
                giù a valle. Roba da modalità tecnica. */}
            {admin && locOk && (
              <div className="text-[9px] text-gray-400 font-mono pt-0.5">
                📍 {loc.lat}, {loc.lon}
                {typeof loc.alt === 'number' ? ` · quota dichiarata ${loc.alt} m` : ' · quota non dichiarata'}
                {typeof weather.quota === 'number' ? ` · modello a ${Math.round(weather.quota)} m` : ''}
              </div>
            )}
          </div>
        );
      })()}

      {/* Riepilogo cucina del giorno: quanti pasti preparare */}
      {(() => {
        const lunch = members.filter((m) => getMeal(selectedDateStr, m.id).lunch).length;
        const dinner = members.filter((m) => getMeal(selectedDateStr, m.id).dinner).length;
        return (
          <div className="flex items-center gap-2 bg-[#2D392C]/5 px-3 py-2 rounded border border-[#2D392C]/15">
            <span className="text-xl leading-none">🍲</span>
            <span className="text-[11px] uppercase font-bold text-gray-500">Cucina</span>
            <span className="ml-auto text-sm font-bold text-[#2D392C]">
              {lunch} <span className="text-[10px] font-normal text-gray-500">a pranzo</span>
              <span className="text-gray-300"> · </span>
              {dinner} <span className="text-[10px] font-normal text-gray-500">a cena</span>
            </span>
          </div>
        );
      })()}

      {/* Note libere del giorno: promemoria, turni, cose da ricordare.
          Si sincronizzano come tutto il resto. */}
      <div>
        <label className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wide">Note del giorno</span>
          {(getDayData(selectedDateStr).appunti || '').trim() && (
            <span className="text-[9px] text-[#2D392C]">✔ scritte</span>
          )}
        </label>
        <textarea
          value={getDayData(selectedDateStr).appunti || ''}
          onChange={(e) => updateDayData(selectedDateStr, 'appunti', e.target.value)}
          rows={3}
          placeholder="Promemoria del giorno…"
          className="w-full p-3 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm leading-snug focus:outline-none focus:border-[#2D392C] resize-y"
        />
        <p className="text-[9px] text-gray-400 italic mt-1">
          Promemoria del giorno, visibili a tutti. Il <span className="font-bold">menù</span> ha la sua scheda: qui ci vanno le altre cose.
        </p>
      </div>

      {/* Scorciatoia alla scheda Menù, che lavora sullo stesso giorno */}
      <button
        onClick={() => goTo('menu')}
        className={bottone('secondario', 'piccolo', 'w-full')}
      >
        🍝 Menù del giorno
        {(getDayData(selectedDateStr).note || '').trim() ? ' · già scritto' : ' · da scrivere'}
      </button>
    </div>
  </div>
);

const schedaMenu = ({
  confermaPropostaSpesa,
  getDayData,
  getMeal,
  members,
  proponiDalMenu,
  propostaSpesa,
  renderWeekStrip,
  selectedDateStr,
  setCurrentDate,
  setPropostaSpesa,
  setSelectedDateStr,
  toBuy,
  updateDayData,
}) => (
  <div className="space-y-4">
    {/* Stessa striscia del Calendario: il giorno scelto è condiviso */}
    {renderWeekStrip()}

    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-2">
      <div className="flex items-baseline justify-between border-b border-dashed border-[#8F9E8B] pb-1">
        <h3 className="font-rustic text-lg text-[#2D392C]">
          Menù di {parseDate(selectedDateStr).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h3>
      </div>

      {/* Quante persone stai cucinando: serve proprio mentre scrivi */}
      {(() => {
        const lunch = members.filter((m) => getMeal(selectedDateStr, m.id).lunch).length;
        const dinner = members.filter((m) => getMeal(selectedDateStr, m.id).dinner).length;
        return (
          <div className="flex items-center gap-2 bg-[#2D392C]/5 px-3 py-2 rounded border border-[#2D392C]/15">
            <span className="text-xl leading-none">🍲</span>
            <span className="text-[11px] uppercase font-bold text-gray-500">Da preparare</span>
            <span className="ml-auto text-sm font-bold text-[#2D392C]">
              {lunch} <span className="text-[10px] font-normal text-gray-500">a pranzo</span>
              <span className="text-gray-300"> · </span>
              {dinner} <span className="text-[10px] font-normal text-gray-500">a cena</span>
            </span>
          </div>
        );
      })()}

      <textarea
        value={getDayData(selectedDateStr).note}
        onChange={(e) => updateDayData(selectedDateStr, 'note', e.target.value)}
        placeholder="Cosa si mangia…"
        className="lined-paper w-full p-3 rounded-lg border border-[#8F9E8B]/30 focus:outline-none focus:border-[#2D392C] resize-y"
      />
      <p className="text-[9px] text-gray-400 italic">Una pietanza per riga. Si sincronizza con gli altri: chi cucina lo trova già scritto.</p>

      {/* Il ponte verso la spesa. Sta qui e non nella Lista perché è qui che si
          scrivono le quantità: al campo 2026 il menù aveva tutta la spesa e la
          scheda "Da acquistare" cinque voci in croce. */}
      <button
        onClick={proponiDalMenu}
        className={bottone('secondario', 'piccolo', 'w-full mt-1')}
      >
        🧾 Porta nella lista della spesa
      </button>
      <p className="text-[9px] text-gray-400 italic">
        Legge le righe qui sopra e le propone in <span className="font-bold">Lista della Spesa → Da acquistare</span>.
        Prima di aggiungerle te le fa vedere: niente entra senza la tua spunta.
        {toBuy.length > 0 && ` Adesso in lista ce ne sono ${toBuy.length}.`}
      </p>
    </div>

    {/* Conferma della proposta: l'uomo decide, il lettore propone. */}
    {propostaSpesa && (
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-3 z-50" onClick={() => setPropostaSpesa(null)}>
        <div className="bg-white rounded-lg w-full max-w-md max-h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 border-b border-[#8F9E8B]/30">
            <h3 className="font-rustic text-lg text-[#2D392C]">Dal menù alla spesa</h3>
            <p className="text-[10px] text-gray-500 leading-snug mt-1">
              {propostaSpesa.voci.length} {propostaSpesa.voci.length === 1 ? 'voce trovata' : 'voci trovate'} nel menù di
              {' '}{parseDate(selectedDateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}.
              Togli la spunta a quello che non serve comprare.
              {propostaSpesa.scartate > 0 && ` (${propostaSpesa.scartate} ${propostaSpesa.scartate === 1 ? 'era già' : 'erano già'} in lista.)`}
            </p>
          </div>
          <ul className="overflow-y-auto divide-y divide-[#8F9E8B]/15 px-4">
            {propostaSpesa.voci.map((v, i) => (
              <li key={i}>
                <label className="flex items-center gap-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!propostaSpesa.scelte[i]}
                    onChange={() => setPropostaSpesa((p) => ({ ...p, scelte: { ...p.scelte, [i]: !p.scelte[i] } }))}
                    className="w-4 h-4 shrink-0 accent-[#2D392C]"
                  />
                  <span className="text-sm text-[#2D392C] min-w-0 flex-1 truncate">{v.nome}</span>
                  {v.qta && <span className="text-[10px] font-bold text-[#5C4A3C] shrink-0">{v.qta}</span>}
                </label>
              </li>
            ))}
          </ul>
          <div className="p-4 border-t border-[#8F9E8B]/30 flex gap-2">
            <button onClick={() => setPropostaSpesa(null)} className={bottone('testuale', 'normale', 'flex-1')}>Annulla</button>
            <button onClick={confermaPropostaSpesa} className={bottone('primario', 'normale', 'flex-1')}>
              Aggiungi ({propostaSpesa.voci.filter((_, i) => propostaSpesa.scelte[i]).length})
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Colpo d'occhio sui giorni del campo con il menù già scritto */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Giorni del campo</h3>
      <ul className="space-y-1.5">
        {(() => {
          const giorni = [];
          for (let d = parseDate(CAMP_START); toDateStr(d) <= CAMP_END; d.setDate(d.getDate() + 1)) {
            giorni.push(toDateStr(d));
          }
          return giorni.map((ds) => {
            const testo = (getDayData(ds).note || '').trim();
            const prima = testo.split('\n')[0] || '';
            return (
              <li key={ds}>
                <button
                  onClick={() => { setSelectedDateStr(ds); setCurrentDate(parseDate(ds)); }}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded border transition-colors ${
                    ds === selectedDateStr ? 'bg-[#5C4A3C]/15 border-[#5C4A3C]/50' : 'bg-[#F0F4F1]/60 border-[#8F9E8B]/20 hover:bg-[#E2EAE4]'
                  }`}
                >
                  <span className="text-[11px] font-bold text-[#2D392C] shrink-0 w-16">
                    {parseDate(ds).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}
                  </span>
                  <span className={`text-[10px] truncate ${testo ? 'text-gray-600' : 'text-gray-400 italic'}`}>
                    {testo ? prima : 'da scrivere'}
                  </span>
                  {testo && <span className="ml-auto text-[10px] shrink-0">✔</span>}
                </button>
              </li>
            );
          });
        })()}
      </ul>
    </div>
  </div>
);

const schedaPresenze = ({
  admin,
  azioniOpen,
  bloccaGiorno,
  chiediCopiaDaIeri,
  chiediGiornoGratis,
  chiediSetAll,
  getDayData,
  getMeal,
  giornoBloccato,
  giornoGratis,
  members,
  navigateDate,
  orfanoScelte,
  presenzeOrfane,
  riassegnaOrfane,
  sbloccaGiorno,
  scartaOrfane,
  selectedDateStr,
  setAzioniOpen,
  setCurrentDate,
  setOrfanoScelte,
  setSelectedDateStr,
  toggleMeal,
  updateDayData,
}) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-[#8F9E8B]/30 shadow-sm">
      <button onClick={() => navigateDate(-1)} className={bottoneIcona('tenue')}>&larr;</button>
      <input
        type="date"
        value={selectedDateStr}
        onChange={(e) => { if (e.target.value) { setSelectedDateStr(e.target.value); setCurrentDate(parseDate(e.target.value)); } }}
        className="bg-transparent border-none text-sm focus:outline-none font-bold text-center w-full mx-2 text-[#5C4A3C]"
      />
      <button onClick={() => navigateDate(1)} className={bottoneIcona('tenue')}>&rarr;</button>
    </div>

    {/* Presenze appese a membri che non esistono più: succede quando
        qualcuno viene eliminato e riaggiunto. Sparirebbero dai conti in
        silenzio, quindi qui si segnalano e si riattaccano. */}
    {(() => {
      const orfane = presenzeOrfane();
      if (orfane.length === 0) return null;
      const totale = orfane.reduce((s, o) => s + o.pasti, 0);
      return (
        <div className="bg-[#D97706]/10 border-2 border-[#D97706]/50 rounded-lg p-3 space-y-3">
          <p className="text-[11px] text-[#5C4A3C] leading-snug">
            <span className="font-bold">Ci sono {totale} presenze senza padrone.</span> Succede quando una
            persona viene eliminata dai Membri e poi riaggiunta: per l'app è una persona nuova, e i pasti
            segnati prima restano attaccati alla vecchia — spariti dall'elenco e dai conti.
            Riattaccali alla persona giusta.
          </p>
          <ul className="space-y-2">
            {orfane.map((o) => (
              <li key={o.id} className="bg-white/70 rounded border border-[#8F9E8B]/30 p-2.5 space-y-2">
                <p className="text-[11px] text-[#2D392C] leading-snug">
                  <span className="font-bold">{o.nome || 'Persona non più in elenco'}</span>
                  {' — '}{o.pasti} {o.pasti === 1 ? 'pasto' : 'pasti'} su {o.giorni.length} {o.giorni.length === 1 ? 'giorno' : 'giorni'}
                  <span className="block text-[9px] text-gray-500">
                    {o.giorni.slice(0, 6).map((d) => parseDate(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })).join(' · ')}
                    {o.giorni.length > 6 ? ' …' : ''}
                  </span>
                </p>
                <div className="flex gap-2">
                  <select
                    value={orfanoScelte[o.id] || ''}
                    onChange={(e) => setOrfanoScelte((prev) => ({ ...prev, [o.id]: e.target.value }))}
                    className="flex-grow min-w-0 p-2 bg-white border border-[#8F9E8B]/40 rounded text-xs focus:outline-none focus:border-[#2D392C]"
                  >
                    <option value="">— a chi sono? —</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <button
                    onClick={() => riassegnaOrfane(o, orfanoScelte[o.id])}
                    disabled={!orfanoScelte[o.id]}
                    className={`shrink-0 px-3 py-2 rounded text-[10px] font-bold uppercase ${orfanoScelte[o.id] ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-400'}`}
                  >
                    Riassegna
                  </button>
                  <button
                    onClick={() => scartaOrfane(o)}
                    aria-label="Butta via queste presenze"
                    className={bottone('distruttivo', 'minuscolo', 'shrink-0')}
                  >
                    Butta
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {members.length === 0 && (
            <p className="text-[9px] text-[#5C4A3C] italic">Aggiungi prima le persone nella scheda Membri.</p>
          )}
        </div>
      );
    })()}

    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] flex items-center gap-2">
        <span className="min-w-0 truncate">
          Presenze del {parseDate(selectedDateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
        </span>
        {giornoBloccato(selectedDateStr) && (
          <span className="ml-auto shrink-0 text-[9px] uppercase font-bold px-2 py-1 rounded bg-[#5C4A3C] text-white">🔒 Bloccate</span>
        )}
      </h3>

      {/* Giorno gratis: non entra in nessun conto. Lo vedono tutti —
          chi guarda le quote deve capire perché quel giorno non pesa —
          ma lo decide chi tiene i conti. */}
      {giornoGratis(selectedDateStr) && (
        <div className="bg-[#2D392C]/10 border border-[#2D392C]/35 rounded p-2.5">
          <p className="text-[10px] text-[#2D392C] leading-snug">
            <span className="font-bold">🎁 Giorno gratis.</span> Le presenze restano segnate per la cucina,
            ma non entrano in nessun conto: nessuno paga i pasti di oggi, e chi è venuto solo oggi
            non deve niente.
          </p>
        </div>
      )}
      {admin && members.length > 0 && (
        <button
          onClick={() => chiediGiornoGratis(selectedDateStr)}
          disabled={!!giornoBloccato(selectedDateStr)}
          className={`w-full py-2 rounded text-[10px] font-bold uppercase tracking-wide border-2 ${
            giornoGratis(selectedDateStr)
              ? 'bg-[#2D392C] text-white border-[#2D392C]'
              : 'bg-white text-[#2D392C] border-[#8F9E8B]/50 hover:bg-[#E2EAE4]'
          } ${giornoBloccato(selectedDateStr) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {giornoGratis(selectedDateStr) ? '🎁 Giorno gratis — rimettilo nei conti' : '🎁 Rendi questo giorno gratis'}
        </button>
      )}

      {/* Giorno chiuso: le presenze sono congelate. Lo si dice a tutti
          — chi non è in modalità tecnica deve capire perché i tasti non
          rispondono — ma solo chi tiene i conti può aprire e chiudere. */}
      {giornoBloccato(selectedDateStr) && (
        <div className="bg-[#5C4A3C]/10 border border-[#5C4A3C]/40 rounded p-2.5">
          <p className="text-[10px] text-[#5C4A3C] leading-snug">
            <span className="font-bold">Presenze chiuse.</span> Sono state bloccate il{' '}
            {new Date(giornoBloccato(selectedDateStr).at).toLocaleString('it-IT')} e non cambiano più:
            né dai tasti, né da quello che arriva dagli altri telefoni. Se un telefono prova a
            modificarle, l'app le rimette com'erano.
          </p>
        </div>
      )}

      {members.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aggiungi prima i membri nella scheda "Membri".</p>
      ) : (
        <>
        {/* Azioni rapide: cambiano le presenze di TUTTI in un colpo, e
            la modifica arriva su tutti i telefoni. Stanno chiuse e
            chiedono conferma: è il tipo di tasto che si preme per
            sbaglio scorrendo, e poi qualcuno resta senza pasti. */}
        <div className={`bg-[#F0F4F1]/60 rounded border border-[#8F9E8B]/30 overflow-hidden ${giornoBloccato(selectedDateStr) ? 'opacity-50 pointer-events-none' : ''}`}>
          <button
            onClick={() => setAzioniOpen((v) => !v)}
            className={bottoneRiga()}
          >
            <span className="text-[10px] uppercase font-bold text-[#5C4A3C] shrink-0">Segna in blocco</span>
            <span className="ml-auto text-[9px] text-gray-500 truncate">
              {members.filter((m) => getMeal(selectedDateStr, m.id).lunch).length} a pranzo · {members.filter((m) => getMeal(selectedDateStr, m.id).dinner).length} a cena
            </span>
            <span className={`text-[10px] text-[#5C4A3C] shrink-0 transition-transform ${azioniOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {azioniOpen && (
            <div className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => chiediSetAll('lunch')} className={bottone('primario', 'piccolo')}>Tutti a pranzo</button>
                <button onClick={() => chiediSetAll('dinner')} className={bottone('bruno', 'piccolo')}>Tutti a cena</button>
                <button onClick={chiediCopiaDaIeri} className={bottone('secondario', 'piccolo')}>Copia da ieri</button>
              </div>
              <p className="text-[9px] text-gray-400 leading-snug">
                Segna tutti, poi togli i pochi assenti. Se sono già tutti segnati, il bottone li toglie tutti.
                Ognuno di questi tasti chiede conferma: cambia le presenze di tutti, su tutti i telefoni.
              </p>
            </div>
          )}
        </div>
        <ul className="space-y-2">
          {members.map((m) => {
            const meal = getMeal(selectedDateStr, m.id);
            const chiuso = !!giornoBloccato(selectedDateStr);
            return (
              <li key={m.id} className="flex items-center justify-between gap-2 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/20">
                <span className="text-sm font-bold text-[#2D392C] truncate flex items-center gap-1">
                  {m.name}
                  {m.isChild && <span className="text-[8px] uppercase bg-[#D97706] text-white px-1 rounded">gratis</span>}
                </span>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleMeal(selectedDateStr, m.id, 'lunch')}
                    disabled={chiuso}
                    className={`text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border ${meal.lunch ? 'bg-[#2D392C] text-white border-[#2D392C]' : 'bg-white text-gray-400 border-gray-300'} ${chiuso ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    Pranzo
                  </button>
                  <button
                    onClick={() => toggleMeal(selectedDateStr, m.id, 'dinner')}
                    disabled={chiuso}
                    className={`text-[10px] uppercase font-bold px-2.5 py-1.5 rounded border ${meal.dinner ? 'bg-[#5C4A3C] text-white border-[#5C4A3C]' : 'bg-white text-gray-400 border-gray-300'} ${chiuso ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    Cena
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}

      {/* Chiudere un giorno è la garanzia definitiva contro le presenze
          che cambiano da sole: è una decisione di chi tiene i conti,
          quindi sta in modalità tecnica. */}
      {admin && members.length > 0 && (
        giornoBloccato(selectedDateStr) ? (
          <button
            onClick={() => sbloccaGiorno(selectedDateStr)}
            className={bottone('secondario', 'piccolo', 'w-full')}
          >
            🔓 Sblocca le presenze di questo giorno
          </button>
        ) : (
          <button
            onClick={() => bloccaGiorno(selectedDateStr)}
            className={bottone('bruno', 'piccolo', 'w-full')}
          >
            🔒 Blocca le presenze di questo giorno
          </button>
        )
      )}
    </div>

    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-2">
      <h4 className="font-rustic text-sm text-[#5C4A3C]">Note / Ospiti del giorno</h4>
      <textarea
        value={getDayData(selectedDateStr).guestsNames}
        onChange={(e) => updateDayData(selectedDateStr, 'guestsNames', e.target.value)}
        placeholder="Ospiti occasionali o note sulle presenze..."
        className="w-full h-20 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C] resize-none"
      />
    </div>
  </div>
);
