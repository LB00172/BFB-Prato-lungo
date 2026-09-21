// ---------- Schede del giorno: Calendario, Menu', Presenze ----------
// Uscite da 80-app.jsx. Sono funzioni che restituiscono JSX, non componenti
// React: nessun confine di riconciliazione nuovo, nessun hook spostato,
// l'albero prodotto e' identico. L'elenco delle dipendenze in cima a ognuna e'
// il punto del lavoro: sono le cose che quel disegno si prendeva dalla
// chiusura di App() senza dirlo.

const schedaCalendario = ({
  admin,
  fetchWeather,
  getDayData,
  getMeal,
  goTo,
  isOnline,
  members,
  presenzeOrfane,
  campoInCorso,
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
    {/* L'avviso compare solo quando c'e' un campo per cui essere pronti.
        Chiudendo il campo le liste si azzerano — e' giusto cosi', i dati sono
        nell'Archivio — ma "Dati del campo ricevuti" chiede dei membri: senza
        questa condizione l'avviso resterebbe li' per sempre a dire "non sei
        pronto" a un telefono che sta benissimo. */}
    {campoInCorso && !readyOk && (
      <button
        onClick={() => goTo('impostazioni')}
        className="w-full bg-[#D97706]/10 border border-[#D97706]/40 rounded-lg p-3 text-left flex items-start gap-2 hover:bg-[#D97706]/15"
      >
        <span className="text-medio leading-none mt-0.5">⚠️</span>
        <span className="text-piccolo text-[#5C4A3C] leading-snug">
          {frase('giorno.nonPronto')}
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
          <span className="text-medio leading-none mt-0.5">🍽️</span>
          <span className="text-piccolo text-[#5C4A3C] leading-snug">
            {frase('giorno.orfaneAvviso', totale, orfane.length)}
          </span>
        </button>
      );
    })()}

    {renderWeekStrip()}

    {/* Giorni del conto separato: le presenze di questi giorni fanno
        cassa a parte (vedi conti.js). Sta chiuso: è una cosa che
        si imposta una volta, non a ogni apertura del Calendario. */}
    <div className="bg-white rounded-lg border border-[#8F9E8B]/30 shadow-sm overflow-hidden">
      <button
        onClick={() => setSepOpen((v) => !v)}
        className={bottoneRiga()}
      >
        <span className="text-piccolo uppercase font-bold text-[#5C4A3C] shrink-0">{L.t('giorno.contoSeparato')}</span>
        <span className="ml-auto text-minuto text-gray-500 truncate">
          {sepDays.length === 0 ? L.t('giorno.nessunGiorno') : L.t('giorno.giorniInTotale', sepDays.length)}
        </span>
        <span className={`text-piccolo text-[#5C4A3C] shrink-0 transition-transform ${sepOpen ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {sepOpen && (<div className="px-3 pb-3">
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d) => {
          const dateStr = toDateStr(d);
          const on = sepDays.includes(dateStr);
          return (
            <label
              key={dateStr}
              title={L.t('giorno.separatoTitolo', L.data(d, 'completa'))}
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
              <span className={`text-minuto font-bold ${on ? 'text-[#5C4A3C]' : 'text-gray-400'}`}>{d.getDate()}</span>
            </label>
          );
        })}
      </div>
      <p className="text-minuto text-gray-400 italic mt-2 leading-snug">
        {frase('giorno.separatoNota')}
      </p>
      </div>)}
    </div>

    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-dashed border-[#8F9E8B] pb-1">
        {L.data(parseDate(selectedDateStr), 'completa')}
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
                <span className="text-piccolo text-gray-400 italic">{L.t('meteo.senzaLuogo')}</span>
              ) : wx ? (() => {
                // La faccia della giornata e', quando si sa, la
                // condizione prevalente delle ore diurne; il brutto si
                // nomina a parte col suo momento. I millimetri dicono
                // se e' una spruzzata o una lavata: "40%" da solo no.
                const r = raccontaMeteo(wx);
                return (
                <>
                  <span className="text-titolo leading-none">{r.icon}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-normale font-bold text-[#2D392C] leading-tight">
                      {r.label}{r.coda ? <span className="font-normal">, {r.coda}</span> : null}
                    </span>
                    {loc.label && <span className="text-minuto text-gray-400">{loc.label}</span>}
                  </div>
                  <span className="ml-auto text-piccolo text-gray-600 font-bold shrink-0 text-right">
                    {Math.round(wx.tmax)}° / {Math.round(wx.tmin)}°
                    {r.mm
                      ? <span className="text-[#5C8AA8]"> · 💧{r.mm}</span>
                      : wx.rain != null ? <span className="text-[#5C8AA8]"> · 💧{wx.rain}%</span> : null}
                  </span>
                </>
                );
              })() : (
                <span className="text-piccolo text-gray-400 italic">
                  {L.t('meteo.nonDisponibile', isOnline)}
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
                    <span className={`text-minuto ${vecchia ? 'text-[#D97706] font-bold' : 'text-gray-400'}`}>
                      {weather.fetchedAt
                        ? L.t('meteo.previsioniDel', vecchia, L.data(new Date(weather.fetchedAt), 'breve'), L.data(new Date(weather.fetchedAt), 'ora'))
                        : L.t('meteo.nonScaricate')}
                    </span>
                  );
                })()}
                <button
                  onClick={() => fetchWeather(true)}
                  disabled={!isOnline || wxBusy}
                  className={bottone('secondario', 'minuscolo', 'shrink-0')}
                >
                  {wxBusy ? '…' : L.t('gioco.aggiorna')}
                </button>
              </div>
            )}
            {/* Diagnostica: da dove viene il meteo. Serve a controllare
                che il modello stia guardando il prato e non il paese
                giù a valle. Roba da modalità tecnica. */}
            {admin && locOk && (
              <div className="text-minuto text-gray-400 font-mono pt-0.5">
                📍 {loc.lat}, {loc.lon}
                {L.t('meteo.quote', loc.alt, weather.quota)}
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
            <span className="text-titolo leading-none">🍲</span>
            <span className="text-piccolo uppercase font-bold text-gray-500">{L.t('giorno.cucina')}</span>
            <span className="ml-auto text-normale font-bold text-[#2D392C]">
              {lunch} <span className="text-piccolo font-normal text-gray-500">{L.t('giorno.aPranzo')}</span>
              <span className="text-gray-300"> · </span>
              {dinner} <span className="text-piccolo font-normal text-gray-500">{L.t('giorno.aCena')}</span>
            </span>
          </div>
        );
      })()}

      {/* Note libere del giorno: promemoria, turni, cose da ricordare.
          Si sincronizzano come tutto il resto. */}
      <div>
        <label className="flex items-center justify-between mb-1">
          <span className="text-piccolo uppercase font-bold text-gray-500 tracking-wide">{L.t('giorno.note')}</span>
          {(getDayData(selectedDateStr).appunti || '').trim() && (
            <span className="text-minuto text-[#2D392C]">{L.t('giorno.scritte')}</span>
          )}
        </label>
        <textarea
          value={getDayData(selectedDateStr).appunti || ''}
          onChange={(e) => updateDayData(selectedDateStr, 'appunti', e.target.value)}
          rows={3}
          placeholder={L.t('giorno.promemoria')}
          className="w-full p-3 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale leading-snug focus:outline-none focus:border-[#2D392C] resize-y"
        />
        <p className="text-minuto text-gray-400 italic mt-1">
          {frase('giorno.noteNota')}
        </p>
      </div>

      {/* Scorciatoia alla scheda Menù, che lavora sullo stesso giorno */}
      <button
        onClick={() => goTo('menu')}
        className={bottone('secondario', 'normale', 'w-full')}
      >
        {L.t('giorno.vaiAlMenu', !!(getDayData(selectedDateStr).note || '').trim())}
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
        <h3 className="font-rustic text-grande text-[#2D392C]">
          {L.t('menu.diGiorno', L.data(parseDate(selectedDateStr), 'completa'))}
        </h3>
      </div>

      {/* Quante persone stai cucinando: serve proprio mentre scrivi */}
      {(() => {
        const lunch = members.filter((m) => getMeal(selectedDateStr, m.id).lunch).length;
        const dinner = members.filter((m) => getMeal(selectedDateStr, m.id).dinner).length;
        return (
          <div className="flex items-center gap-2 bg-[#2D392C]/5 px-3 py-2 rounded border border-[#2D392C]/15">
            <span className="text-titolo leading-none">🍲</span>
            <span className="text-piccolo uppercase font-bold text-gray-500">{L.t('menu.daPreparare')}</span>
            <span className="ml-auto text-normale font-bold text-[#2D392C]">
              {lunch} <span className="text-piccolo font-normal text-gray-500">{L.t('giorno.aPranzo')}</span>
              <span className="text-gray-300"> · </span>
              {dinner} <span className="text-piccolo font-normal text-gray-500">{L.t('giorno.aCena')}</span>
            </span>
          </div>
        );
      })()}

      <textarea
        value={getDayData(selectedDateStr).note}
        onChange={(e) => updateDayData(selectedDateStr, 'note', e.target.value)}
        placeholder={L.t('menu.cosaSiMangia')}
        className="lined-paper w-full p-3 rounded-lg border border-[#8F9E8B]/30 focus:outline-none focus:border-[#2D392C] resize-y"
      />
      <p className="text-minuto text-gray-400 italic">{L.t('menu.unaPerRiga')}</p>

      {/* Il ponte verso la spesa. Sta qui e non nella Lista perché è qui che si
          scrivono le quantità: al campo 2026 il menù aveva tutta la spesa e la
          scheda "Da acquistare" cinque voci in croce. */}
      <button
        onClick={proponiDalMenu}
        className={bottone('secondario', 'normale', 'w-full mt-1')}
      >
        {L.t('menu.portaInLista')}
      </button>
      <p className="text-minuto text-gray-400 italic">
        {frase('menu.ponteNota', toBuy.length)}
      </p>
    </div>

    {/* Conferma della proposta: l'uomo decide, il lettore propone. */}
    {propostaSpesa && (
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-3 z-50" onClick={() => setPropostaSpesa(null)}>
        <div className="bg-white rounded-lg w-full max-w-md max-h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 border-b border-[#8F9E8B]/30">
            <h3 className="font-rustic text-grande text-[#2D392C]">{L.t('menu.dallaSpesa')}</h3>
            <p className="text-piccolo text-gray-500 leading-snug mt-1">
              {L.t('menu.trovate', propostaSpesa.voci.length, L.data(parseDate(selectedDateStr), 'lunga'), propostaSpesa.scartate)}
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
                  <span className="text-normale text-[#2D392C] min-w-0 flex-1 truncate">{v.nome}</span>
                  {v.qta && <span className="text-piccolo font-bold text-[#5C4A3C] shrink-0">{v.qta}</span>}
                </label>
              </li>
            ))}
          </ul>
          <div className="p-4 border-t border-[#8F9E8B]/30 flex gap-2">
            <button onClick={() => setPropostaSpesa(null)} className={bottone('testuale', 'normale', 'flex-1')}>{L.t('galleria.annulla')}</button>
            <button onClick={confermaPropostaSpesa} className={bottone('primario', 'normale', 'flex-1')}>
              {L.t('menu.aggiungiN', propostaSpesa.voci.filter((_, i) => propostaSpesa.scelte[i]).length)}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Colpo d'occhio sui giorni del campo con il menù già scritto */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">{L.t('menu.giorniDelCampo')}</h3>
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
                  <span className="text-piccolo font-bold text-[#2D392C] shrink-0 w-16">
                    {L.data(parseDate(ds), 'settimanaGiorno')}
                  </span>
                  <span className={`text-piccolo truncate ${testo ? 'text-gray-600' : 'text-gray-400 italic'}`}>
                    {testo ? prima : L.t('menu.daScrivere')}
                  </span>
                  {testo && <span className="ml-auto text-piccolo shrink-0">✔</span>}
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
        className="bg-transparent border-none text-normale focus:outline-none font-bold text-center w-full mx-2 text-[#5C4A3C]"
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
          <p className="text-piccolo text-[#5C4A3C] leading-snug">
            {frase('presenze.orfaneTitolo', totale)}
          </p>
          <ul className="space-y-2">
            {orfane.map((o) => (
              <li key={o.id} className="bg-white/70 rounded border border-[#8F9E8B]/30 p-2.5 space-y-2">
                <p className="text-piccolo text-[#2D392C] leading-snug">
                  <span className="font-bold">{o.nome || L.t('presenze.personaSparita')}</span>
                  {' — '}{L.t('presenze.pastiSuGiorni', o.pasti, o.giorni.length)}
                  <span className="block text-minuto text-gray-500">
                    {o.giorni.slice(0, 6).map((d) => L.data(parseDate(d), 'breve')).join(' · ')}
                    {o.giorni.length > 6 ? ' …' : ''}
                  </span>
                </p>
                <div className="flex gap-2">
                  <select
                    value={orfanoScelte[o.id] || ''}
                    onChange={(e) => setOrfanoScelte((prev) => ({ ...prev, [o.id]: e.target.value }))}
                    className="flex-grow min-w-0 p-2 bg-white border border-[#8F9E8B]/40 rounded text-piccolo focus:outline-none focus:border-[#2D392C]"
                  >
                    <option value="">{L.t('presenze.aChiSono')}</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <button
                    onClick={() => riassegnaOrfane(o, orfanoScelte[o.id])}
                    disabled={!orfanoScelte[o.id]}
                    className={bottone('primario', 'minuscolo', 'shrink-0')}
                  >
                    {L.t('presenze.riassegna')}
                  </button>
                  <button
                    onClick={() => scartaOrfane(o)}
                    aria-label={L.t('presenze.buttaVia')}
                    className={bottone('distruttivo', 'minuscolo', 'shrink-0')}
                  >
                    {L.t('presenze.butta')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {members.length === 0 && (
            <p className="text-minuto text-[#5C4A3C] italic">{L.t('galleria.primaMembri')}</p>
          )}
        </div>
      );
    })()}

    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] flex items-center gap-2">
        <span className="min-w-0 truncate">
          {L.t('presenze.delGiorno', L.data(parseDate(selectedDateStr), 'lunga'))}
        </span>
        {giornoBloccato(selectedDateStr) && (
          <span className="ml-auto shrink-0 text-minuto uppercase font-bold px-2 py-1 rounded bg-[#5C4A3C] text-white">{L.t('presenze.bloccate')}</span>
        )}
      </h3>

      {/* Giorno gratis: non entra in nessun conto. Lo vedono tutti —
          chi guarda le quote deve capire perché quel giorno non pesa —
          ma lo decide chi tiene i conti. */}
      {giornoGratis(selectedDateStr) && (
        <div className="bg-[#2D392C]/10 border border-[#2D392C]/35 rounded p-2.5">
          <p className="text-piccolo text-[#2D392C] leading-snug">
            {frase('presenze.gratis')}
          </p>
        </div>
      )}
      {admin && members.length > 0 && (
        <button
          onClick={() => chiediGiornoGratis(selectedDateStr)}
          disabled={!!giornoBloccato(selectedDateStr)}
          className={bottoneScelta('interruttore', 'bordato', giornoGratis(selectedDateStr), 'minuscolo',
            'w-full' + (giornoBloccato(selectedDateStr) ? ' opacity-50 cursor-not-allowed' : ''))}
        >
          {L.t(giornoGratis(selectedDateStr) ? 'presenze.gratisTogli' : 'presenze.gratisMetti')}
        </button>
      )}

      {/* Giorno chiuso: le presenze sono congelate. Lo si dice a tutti
          — chi non è in modalità tecnica deve capire perché i tasti non
          rispondono — ma solo chi tiene i conti può aprire e chiudere. */}
      {giornoBloccato(selectedDateStr) && (
        <div className="bg-[#5C4A3C]/10 border border-[#5C4A3C]/40 rounded p-2.5">
          <p className="text-piccolo text-[#5C4A3C] leading-snug">
            {frase('presenze.chiuse', L.data(new Date(giornoBloccato(selectedDateStr).at), 'dataOra'))}
          </p>
        </div>
      )}

      {members.length === 0 ? (
        <p className="text-normale text-gray-400 italic">{L.t('presenze.primaIMembri')}</p>
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
            <span className="text-piccolo uppercase font-bold text-[#5C4A3C] shrink-0">{L.t('presenze.segnaInBlocco')}</span>
            <span className="ml-auto text-minuto text-gray-500 truncate">
              {L.t('presenze.pranzoCena', members.filter((m) => getMeal(selectedDateStr, m.id).lunch).length, members.filter((m) => getMeal(selectedDateStr, m.id).dinner).length)}
            </span>
            <span className={`text-piccolo text-[#5C4A3C] shrink-0 transition-transform ${azioniOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {azioniOpen && (
            <div className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => chiediSetAll('lunch')} className={bottone('primario', 'normale')}>{L.t('presenze.tuttiPranzo')}</button>
                <button onClick={() => chiediSetAll('dinner')} className={bottone('bruno', 'normale')}>{L.t('presenze.tuttiCena')}</button>
                <button onClick={chiediCopiaDaIeri} className={bottone('secondario', 'normale')}>{L.t('presenze.copiaIeri')}</button>
              </div>
              <p className="text-minuto text-gray-400 leading-snug">
                {L.t('presenze.bloccoNota')}
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
                <span className="text-normale font-bold text-[#2D392C] truncate flex items-center gap-1">
                  {m.name}
                  {m.isChild && <span className="text-minuto uppercase bg-[#D97706] text-white px-1 rounded">{L.t('presenze.gratisEtichetta')}</span>}
                </span>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleMeal(selectedDateStr, m.id, 'lunch')}
                    disabled={chiuso}
                    className={bottoneScelta('spunta', 'pranzo', meal.lunch, 'minuscolo', chiuso ? 'opacity-60 cursor-not-allowed' : '')}
                  >
                    {L.t('presenze.pranzo')}
                  </button>
                  <button
                    onClick={() => toggleMeal(selectedDateStr, m.id, 'dinner')}
                    disabled={chiuso}
                    className={bottoneScelta('spunta', 'cena', meal.dinner, 'minuscolo', chiuso ? 'opacity-60 cursor-not-allowed' : '')}
                  >
                    {L.t('presenze.cena')}
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
            className={bottone('secondario', 'normale', 'w-full')}
          >
            {L.t('presenze.sblocca')}
          </button>
        ) : (
          <button
            onClick={() => bloccaGiorno(selectedDateStr)}
            className={bottone('bruno', 'normale', 'w-full')}
          >
            {L.t('presenze.blocca')}
          </button>
        )
      )}
    </div>

    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-2">
      <h4 className="font-rustic text-normale text-[#5C4A3C]">{L.t('presenze.noteOspiti')}</h4>
      <textarea
        value={getDayData(selectedDateStr).guestsNames}
        onChange={(e) => updateDayData(selectedDateStr, 'guestsNames', e.target.value)}
        placeholder={L.t('presenze.ospitiSegno')}
        className="w-full h-20 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C] resize-none"
      />
    </div>
  </div>
);
