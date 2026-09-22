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
    <li key={c.id} className="p-3 border-b border-salvia/20 last:border-0">
      <div className="flex items-start gap-2">
        <button
          onClick={() => toggleCompito(c.id)}
          aria-label={L.t(c.fatto ? 'compiti.segnaDaFare' : 'compiti.segnaFatto')}
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
            className={`w-full bg-transparent text-normale text-bosco focus:outline-none border-b border-transparent focus:border-salvia/40 ${
              c.fatto ? 'line-through text-gray-400' : ''
            }`}
          />
          <div className="flex items-center gap-2">
            <span className="text-minuto uppercase font-bold text-salvia shrink-0">{L.t('compiti.aChi')}</span>
            {renderBuyerSelect(c.chi, (v) => setCompitoCampo(c.id, 'chi', v), 'text-piccolo p-1.5')}
          </div>
          {c.fatto && (
            <button onClick={() => daCompitoASpesa(c)} className={bottone('bruno', 'minuscolo')}>
              💶 {L.t('compiti.registraSpesa')}
            </button>
          )}
        </div>
        <button onClick={() => removeCompito(c.id)} aria-label={L.t('compiti.rimuovi')} className={bottoneIcona('distruttivo', 'shrink-0')}>&times;</button>
      </div>
    </li>
  );

  return (
    <div className="space-y-4">
      {/* Assegnare */}
      <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
        <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('compiti.assegnaTitolo')}</h3>
        <input
          value={nuovoCompito}
          onChange={(e) => setNuovoCompito(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addCompito(); }}
          placeholder={L.t('compiti.cosa')}
          className="w-full p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco"
        />
        {renderBuyerSelect(nuovoCompitoChi, setNuovoCompitoChi)}
        <button onClick={addCompito} disabled={!nuovoCompito.trim()} className={bottone('primario', 'grande', 'w-full')}>
          {L.t('compiti.assegna')}
        </button>
        <p className="text-minuto text-gray-400 italic leading-snug">{frase('compiti.spiegazione')}</p>
      </div>

      {/* Da fare */}
      <div className="bg-scheda rounded-lg border-2 border-bosco/20 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-salvia/40">
          <h3 className="font-rustic text-grande text-bosco">{L.t('compiti.daFare')}</h3>
          {daFare.length > 0 && <span className="font-rustic font-bold text-bosco">{daFare.length}</span>}
        </div>
        {daFare.length === 0 ? (
          <p className="px-4 py-6 text-center text-piccolo text-gray-400 italic">
            {compiti.length === 0
              ? L.t('compiti.vuoto')
              : L.t('compiti.tuttoFatto')}
          </p>
        ) : (
          <ul>{daFare.map(riga)}</ul>
        )}
      </div>

      {/* Fatti */}
      {fatti.length > 0 && (
        <div className="bg-scheda rounded-lg border-2 border-bosco/20 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-salvia/40">
            <h3 className="font-rustic text-grande text-bosco">{L.t('compiti.fatti')}</h3>
            <span className="font-rustic font-bold text-bosco">{fatti.length}</span>
          </div>
          <ul>{fatti.map(riga)}</ul>
        </div>
      )}

      {members.length === 0 && (
        <p className="text-piccolo text-fuoco italic leading-snug px-1">{L.t('compiti.senzaMembri')}</p>
      )}
    </div>
  );
};
