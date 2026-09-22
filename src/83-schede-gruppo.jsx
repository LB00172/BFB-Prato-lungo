// ---------- Schede del gruppo: Membri, Regole, Dotazioni personali ----------
// Vedi 81-schede-giorno.jsx per il perche' sono funzioni e non componenti.

const schedaMembri = ({
  addMember,
  infoMember,
  members,
  membriDoppi,
  newMemberChild,
  newMemberName,
  removeMember,
  setInfoMember,
  setMemberField,
  setNewMemberChild,
  setNewMemberName,
  toggleChild,
  toggleEquipExempt,
  unisciDoppi,
}) => (
  <div className="space-y-4">
    {/* Stessa persona in elenco due volte: succede quando due telefoni
        senza linea la aggiungono tutti e due. Non è un errore di
        sincronizzazione — sono due voci nuove legittime — ma nei conti
        diventa due persone, e la quota sbaglia per TUTTI. */}
    {membriDoppi().map((g) => (
      <div key={g[0].id} className="bg-fuoco/10 border-2 border-fuoco/40 rounded-lg p-3 space-y-2">
        <p className="text-piccolo text-legno leading-snug">
          {frase('membri.doppia', g[0].name, g.length)}
        </p>
        <button
          onClick={() => unisciDoppi(g)}
          className={bottone('avviso', 'normale', 'w-full')}
        >
          {L.t('membri.unisci')}
        </button>
        <p className="text-minuto text-gray-500 italic leading-snug">
          {L.t('membri.unisciNota')}
        </p>
      </div>
    ))}

    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('membri.aggiungiTitolo')}</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={newMemberName}
          onChange={(e) => setNewMemberName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMember()}
          placeholder={L.t('membri.nome')}
          className="flex-grow p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco"
        />
        <button onClick={addMember} className={bottoneIcona('pieno')}>+</button>
      </div>
      <label className="flex items-center gap-2 text-piccolo text-gray-600">
        <input type="checkbox" checked={newMemberChild} onChange={(e) => setNewMemberChild(e.target.checked)} />
        {L.t('membri.bambinoGratis')}
      </label>
    </div>

    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco mb-3">
        {L.t('membri.quanti', members.length)}
      </h3>
      {members.length === 0 ? (
        <p className="text-normale text-gray-400 italic">{L.t('membri.vuoto')}</p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="bg-carta/60 p-2.5 rounded border border-salvia/20">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-normale text-bosco truncate">
                  {m.name}
                  {(m.paypal || m.iban) && <span className="ml-1.5 text-minuto text-salvia" title={L.t('membri.haRimborso')}>💳</span>}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setInfoMember((v) => (v === m.id ? null : m.id))}
                    aria-label={L.t('membri.datiDi', m.name)}
                    title={L.t('membri.datiRimborso')}
                    className={`w-6 h-6 rounded-full border-2 font-serif italic font-bold text-piccolo leading-none flex items-center justify-center ${infoMember === m.id ? 'bg-bosco border-bosco text-white' : 'bg-scheda border-salvia text-legno'}`}
                  >
                    i
                  </button>
                  <button
                    onClick={() => toggleChild(m.id)}
                    className={bottoneScelta('etichetta', 'ambra', m.isChild, 'minimo')}
                  >
                    {L.t(m.isChild ? 'membri.bambino' : 'membri.adulto')}
                  </button>
                  <button onClick={() => removeMember(m.id)} className={bottoneIcona('distruttivo')}>&times;</button>
                </div>
              </div>
              {/* Dati per farsi rimborsare dopo il campo. Si aprono con la "i". */}
              {infoMember === m.id && (
                <div className="mt-2.5 pt-2.5 border-t border-salvia/30 space-y-2">
                  <p className="text-piccolo text-gray-500 leading-snug">
                    {frase('membri.comeRimborso')}
                  </p>
                  <div>
                    <label className="block text-minuto uppercase font-bold text-gray-500 tracking-wide mb-1">PayPal</label>
                    <input
                      type="text"
                      inputMode="email"
                      value={m.paypal || ''}
                      onChange={(e) => setMemberField(m.id, 'paypal', e.target.value)}
                      placeholder={L.t('membri.paypalSegno')}
                      className="w-full p-2 bg-scheda border border-salvia/40 rounded text-normale focus:outline-none focus:border-bosco"
                    />
                  </div>
                  <div>
                    <label className="block text-minuto uppercase font-bold text-gray-500 tracking-wide mb-1">IBAN</label>
                    <input
                      type="text"
                      value={m.iban || ''}
                      onChange={(e) => setMemberField(m.id, 'iban', e.target.value.toUpperCase())}
                      onBlur={(e) => { const p = ibanPretty(e.target.value); if (p !== (m.iban || '')) setMemberField(m.id, 'iban', p); }}
                      placeholder={L.t('membri.ibanSegno')}
                      className="w-full p-2 bg-scheda border border-salvia/40 rounded text-piccolo font-mono focus:outline-none focus:border-bosco"
                    />
                    {/* Un IBAN sbagliato si scopre solo quando il bonifico torna indietro. */}
                    {(m.iban || '').trim() !== '' && (
                      ibanValid(m.iban)
                        ? <p className="text-minuto text-bosco mt-1">{L.t('membri.ibanOk')}</p>
                        : <p className="text-minuto text-fuoco mt-1">{L.t('membri.ibanNo')}</p>
                    )}
                  </div>
                  <p className="text-minuto text-gray-400 italic leading-snug">
                    {L.t('membri.datiDove')}
                  </p>
                </div>
              )}
              {/* Esenzione attrezzatura: nascosta finche' FEATURES.equipExemption e' false */}
              {FEATURES.equipExemption && (
                <button
                  onClick={() => toggleEquipExempt(m.id)}
                  aria-label={L.t('membri.esenzione')}
                  className="mt-1.5 flex items-center gap-2 text-left"
                >
                  <span className={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-piccolo font-bold ${m.equipExempt ? 'bg-legno border-legno text-white' : 'bg-scheda border-salvia'}`}>
                    {m.equipExempt ? '✓' : ''}
                  </span>
                  <span className={`text-piccolo ${m.equipExempt ? 'font-bold text-legno' : 'text-gray-500'}`}>
                    {L.t('membri.esente')}
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

// Le Regole non dipendono da niente: e' l'unica scheda che si disegna da
// sola, e infatti l'elenco delle dipendenze e' vuoto.
const schedaRegole = () => (
  <div className="space-y-4">
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco mb-3">{L.t('regole.titolo')}</h3>
      <ol className="space-y-3">
        {CAMP_RULES.map((text, i) => (
          <li key={i} className="flex gap-3 bg-carta/60 p-3 rounded border border-salvia/20">
            <span className="font-rustic text-grande text-legno leading-none shrink-0">{i + 1}.</span>
            <p className="text-piccolo leading-relaxed uppercase underline underline-offset-2 decoration-salvia/70 font-bold text-bosco">
              {text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  </div>
);

const schedaDotazioni = ({
  addGear,
  gear,
  newGearText,
  removeGear,
  setNewGearText,
}) => (
  <div className="space-y-4">
    {/* Box fisso: dotazione base */}
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco mb-3">{L.t('dotazioni.base')}</h3>
      <ul className="space-y-2">
        {BASE_GEAR.map((item) => (
          <li
            key={item.text}
            className={`flex items-center gap-3 rounded border p-2.5 ${
              item.emphasis
                ? 'bg-fuoco/10 border-fuoco/40'
                : 'bg-carta/60 border-salvia/20'
            }`}
          >
            <span className={`shrink-0 rounded-full bg-fuoco ${item.emphasis ? 'w-2 h-2' : 'w-1.5 h-1.5'}`}></span>
            <span className={item.emphasis
              ? 'text-medio font-bold uppercase underline decoration-2 underline-offset-2 text-bosco leading-snug'
              : 'text-normale text-bosco'}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-minuto text-gray-400 italic mt-2">{L.t('dotazioni.obbligo')}</p>
    </div>

    {/* Box editabile: aggiunte dell'occasione */}
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('dotazioni.aggiunte')}</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={newGearText}
          onChange={(e) => setNewGearText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addGear()}
          placeholder={L.t('dotazioni.esempio')}
          className="flex-grow p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco"
        />
        <button onClick={addGear} aria-label={L.t('dotazioni.aggiungi')} className={bottoneIcona('pieno')}>+</button>
      </div>
      {gear.length === 0 ? (
        <p className="text-normale text-gray-400 italic">{L.t('dotazioni.vuoto')}</p>
      ) : (
        <ul className="space-y-2">
          {gear.map((g) => (
            <li key={g.id} className="flex items-center gap-3 bg-carta/60 p-2.5 rounded border border-salvia/20">
              <span className="w-1.5 h-1.5 bg-salvia rounded-full shrink-0"></span>
              <span className="flex-grow text-normale text-bosco">{g.text}</span>
              <button onClick={() => removeGear(g.id)} aria-label={L.t('dotazioni.rimuovi')} className={bottoneIcona('distruttivo')}>&times;</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);
