// ---------- Scheda "Chi fa cosa": i compiti assegnati ----------
//
// Uscita da App() come le altre: e' una funzione che restituisce JSX, non un
// componente React, e riceve le dipendenze in un oggetto.
//
// Cosa fa, e cosa NON fa. Assegna un compito a una persona: "prendi gli
// arrosticini", "prenota il rifugio", "ritira la carne". Il testo e' libero
// apposta — al campo servono cose che oggi non sappiamo prevedere, e un
// elenco chiuso di tipi costringe a scrivere tutto in "altro".
//
// I compiti NON entrano nei conti. Nei conti entra la spesa che ne nasce, e
// solo se qualcuno la registra. Il legame fra le due cose esiste ed e' un
// tasto — "Registra la spesa" — ma e' facoltativo e viene dopo: quando si
// assegna il compito il prezzo non si sa ancora.
const schedaCompiti = ({
  addCompito,
  compiti,
  daCompitoASpesa,
  members,
  nuovoCompito,
  nuovoCompitoChi,
  removeCompito,
  renderBuyerSelect,
  setCompitoCampo,
  setNuovoCompito,
  setNuovoCompitoChi,
  toggleCompito,
}) => {
  const daFare = compiti.filter((c) => !c.fatto);
  const fatti = compiti.filter((c) => c.fatto);

  const riga = (c) => (
    <li key={c.id} className="p-3 border-b border-[#8F9E8B]/20 last:border-0">
      <div className="flex items-start gap-2">
        <button
          onClick={() => toggleCompito(c.id)}
          aria-label={c.fatto ? 'Segna come da fare' : 'Segna come fatto'}
          className={bottoneScelta('casella', 'casella', c.fatto, 'simbolo', 'mt-0.5')}
        >
          ✓
        </button>
        <div className="min-w-0 flex-grow space-y-2">
          {/* Il testo resta modificabile anche dopo: un compito si precisa
              strada facendo ("carne" diventa "carne: 3 kg da Rossi"). */}
          <input
            value={c.testo}
            onChange={(e) => setCompitoCampo(c.id, 'testo', e.target.value)}
            className={`w-full bg-transparent text-sm text-[#2D392C] focus:outline-none border-b border-transparent focus:border-[#8F9E8B]/40 ${
              c.fatto ? 'line-through text-gray-400' : ''
            }`}
          />
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase font-bold text-[#8F9E8B] shrink-0">a chi</span>
            {renderBuyerSelect(c.chi, (v) => setCompitoCampo(c.id, 'chi', v), 'text-xs p-1.5')}
          </div>
          {c.fatto && (
            <button onClick={() => daCompitoASpesa(c)} className={bottone('bruno', 'minuscolo')}>
              💶 Registra la spesa
            </button>
          )}
        </div>
        <button onClick={() => removeCompito(c.id)} aria-label="Rimuovi" className={bottoneIcona('distruttivo', 'shrink-0')}>&times;</button>
      </div>
    </li>
  );

  return (
    <div className="space-y-4">
      {/* Assegnare */}
      <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
        <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Assegna un compito</h3>
        <input
          value={nuovoCompito}
          onChange={(e) => setNuovoCompito(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addCompito(); }}
          placeholder="Es. Prendere gli arrosticini, prenotare il rifugio…"
          className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
        />
        {renderBuyerSelect(nuovoCompitoChi, setNuovoCompitoChi)}
        <button onClick={addCompito} disabled={!nuovoCompito.trim()} className={bottone('primario', 'grande', 'w-full')}>
          Assegna
        </button>
        <p className="text-[9px] text-gray-400 italic leading-snug">
          Il compito dice <span className="font-bold">chi fa cosa</span>, non quanto costa: il prezzo si
          scopre alla cassa. Quando è fatto, da qui si registra la spesa — ma solo se ce n'è una.
        </p>
      </div>

      {/* Da fare */}
      <div className="bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#8F9E8B]/40">
          <h3 className="font-rustic text-lg text-[#2D392C]">Da fare</h3>
          {daFare.length > 0 && <span className="font-rustic font-bold text-[#2D392C]">{daFare.length}</span>}
        </div>
        {daFare.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-gray-400 italic">
            {compiti.length === 0
              ? 'Nessun compito assegnato. Serve a dividersi le cose prima di partire.'
              : 'Tutto fatto.'}
          </p>
        ) : (
          <ul>{daFare.map(riga)}</ul>
        )}
      </div>

      {/* Fatti */}
      {fatti.length > 0 && (
        <div className="bg-white rounded-lg border-2 border-[#2D392C]/20 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#8F9E8B]/40">
            <h3 className="font-rustic text-lg text-[#2D392C]">Fatti</h3>
            <span className="font-rustic font-bold text-[#2D392C]">{fatti.length}</span>
          </div>
          <ul>{fatti.map(riga)}</ul>
        </div>
      )}

      {members.length === 0 && (
        <p className="text-[10px] text-[#D97706] italic leading-snug px-1">
          Non c'è ancora nessuno fra i Membri: i compiti si possono scrivere, ma non assegnare.
        </p>
      )}
    </div>
  );
};
