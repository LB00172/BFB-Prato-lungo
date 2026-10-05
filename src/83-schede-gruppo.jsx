// ---------- Schede del gruppo: Membri, Regole, Dotazioni personali ----------
// Vedi 81-schede-giorno.jsx per il perche' sono funzioni e non componenti.

// Un campo della scheda di una persona: una casella con la sua etichetta.
// Le etichette arrivano gia' tradotte. Su main la scheda la compilano tutti,
// come prima: non c'e' una stanza che dica chi e' chi.
const campoMembro = ({ m, campo, etichetta, segno, tipo, modi, setMemberField, mono, normalizza, esce }) => (
  <div>
    <label className="block text-minuto uppercase font-bold text-gray-500 tracking-wide mb-0.5">{etichetta}</label>
    <input
      type={tipo || 'text'}
      inputMode={modi}
      data-dato={campo}
      value={m[campo] || ''}
      onChange={(e) => setMemberField(m.id, campo, normalizza ? normalizza(e.target.value) : e.target.value)}
      onBlur={esce ? (e) => esce(e.target.value) : undefined}
      placeholder={segno}
      className={`w-full px-2 py-1.5 bg-white border border-[#8F9E8B]/40 rounded focus:outline-none focus:border-[#2D392C] ${mono ? 'font-mono text-piccolo' : 'text-normale'}`}
    />
  </div>
);

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
      <div key={g[0].id} className="bg-[#D97706]/10 border-2 border-[#D97706]/40 rounded-lg p-3 space-y-2">
        <p className="text-piccolo text-[#5C4A3C] leading-snug">
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

    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">{L.t('membri.aggiungiTitolo')}</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={newMemberName}
          onChange={(e) => setNewMemberName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMember()}
          placeholder={L.t('membri.nome')}
          className="flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
        />
        <button onClick={addMember} className={bottoneIcona('pieno')}>+</button>
      </div>
      <label className="flex items-center gap-2 text-piccolo text-gray-600">
        <input type="checkbox" checked={newMemberChild} onChange={(e) => setNewMemberChild(e.target.checked)} />
        {L.t('membri.bambinoGratis')}
      </label>
    </div>

    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-2">
        {L.t('membri.quanti', members.length)}
      </h3>
      {members.length === 0 ? (
        <p className="text-normale text-gray-400 italic">{L.t('membri.vuoto')}</p>
      ) : (
        // Righe sottili, una sotto l'altra con un filo in mezzo: venti
        // persone devono stare in uno schermo, non in tre.
        <ul className="divide-y divide-[#8F9E8B]/25">
          {members.map((m) => {
            const aperta = infoMember === m.id;
            const anagrafe = [m.nome, m.cognome].filter((x) => (x || '').trim()).join(' ');
            const paga = !!(m.paypal || m.iban || m.satispay);
            return (
              <li key={m.id} data-membro={m.name} className="py-1">
                <div className="flex items-center gap-1 min-h-11">
                  <div className="flex-grow min-w-0 leading-tight">
                    <span className="font-bold text-normale text-[#2D392C] truncate block">
                      {m.name}
                      {paga && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#8F9E8B] align-middle" title={L.t('membri.haRimborso')} />}
                    </span>
                    {anagrafe && <span className="text-minuto text-gray-500 truncate block">{anagrafe}</span>}
                  </div>
                  <button
                    onClick={() => setInfoMember((v) => (v === m.id ? null : m.id))}
                    aria-label={L.t('membri.datiDi', m.name)}
                    aria-expanded={aperta}
                    title={L.t('membri.datiRimborso')}
                    className={bottoneSottile('neutro', aperta ? 'text-[#2D392C]' : '')}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 font-serif italic font-bold text-minuto leading-none flex items-center justify-center ${aperta ? 'bg-[#2D392C] border-[#2D392C] text-white' : 'border-current'}`}>i</span>
                  </button>
                  <button
                    onClick={() => toggleChild(m.id)}
                    data-esente
                    className={bottoneSottile('neutro', 'px-1')}
                  >
                    <span className={`inline-block w-16 text-center text-minuto font-bold uppercase tracking-wide py-0.5 rounded ${m.isChild ? 'bg-[#D97706]/15 text-[#5C4A3C]' : 'bg-[#8F9E8B]/15 text-gray-500'}`}>
                      {L.t(m.isChild ? 'membri.bambino' : 'membri.adulto')}
                    </span>
                  </button>
                  <button onClick={() => removeMember(m.id)} aria-label={L.t('membri.togli', m.name)} className={bottoneSottile('distruttivo', 'text-medio')}>
                    &times;
                  </button>
                </div>
                {/* La scheda della persona: chi e', e dove mandarle i soldi.
                    Si apre con la "i". */}
                {aperta && (
                  <div data-scheda-membro={m.name} className="mt-1 mb-2 p-3 rounded bg-[#F0F4F1]/60 border border-[#8F9E8B]/25 space-y-3">
                    <div>
                      <h4 className="font-rustic text-normale text-[#2D392C] mb-1.5">{L.t('membri.chiE')}</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {campoMembro({ m, campo: 'nome', etichetta: L.t('membri.nomeVero'), setMemberField })}
                        {campoMembro({ m, campo: 'cognome', etichetta: L.t('membri.cognome'), setMemberField })}
                      </div>
                      <div className="grid grid-cols-1 gap-2 mt-2">
                        {campoMembro({ m, campo: 'email', etichetta: L.t('membri.email'), tipo: 'email', modi: 'email', segno: L.t('membri.emailSegno'), setMemberField })}
                        {campoMembro({ m, campo: 'telefono', etichetta: L.t('membri.telefono'), tipo: 'tel', modi: 'tel', segno: L.t('membri.telefonoSegno'), setMemberField })}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-rustic text-normale text-[#2D392C] mb-1">{L.t('membri.rimborsoTitolo')}</h4>
                      <p className="text-minuto text-gray-500 leading-snug mb-1.5">{frase('membri.comeRimborso')}</p>
                      <div className="space-y-2">
                        {campoMembro({ m, campo: 'paypal', etichetta: 'PayPal', modi: 'email', segno: L.t('membri.paypalSegno'), setMemberField })}
                        <div>
                          {campoMembro({
                            m, campo: 'iban', etichetta: 'IBAN', segno: L.t('membri.ibanSegno'), mono: true, setMemberField,
                            normalizza: (v) => v.toUpperCase(),
                            esce: (v) => { const p = ibanPretty(v); if (p !== (m.iban || '')) setMemberField(m.id, 'iban', p); },
                          })}
                          {/* Un IBAN sbagliato si scopre solo quando il bonifico torna indietro. */}
                          {(m.iban || '').trim() !== '' && (
                            ibanValid(m.iban)
                              ? <p className="text-minuto text-[#2D392C] mt-1">{L.t('membri.ibanOk')}</p>
                              : <p className="text-minuto text-[#D97706] mt-1">{L.t('membri.ibanNo')}</p>
                          )}
                        </div>
                        {campoMembro({ m, campo: 'satispay', etichetta: L.t('membri.satispay'), tipo: 'tel', modi: 'tel', segno: L.t('membri.satispaySegno'), setMemberField })}
                      </div>
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
                    className="mt-0.5 mb-1 flex items-center gap-2 text-left"
                  >
                    <span className={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-piccolo font-bold ${m.equipExempt ? 'bg-[#5C4A3C] border-[#5C4A3C] text-white' : 'bg-white border-[#8F9E8B]'}`}>
                      {m.equipExempt ? '✓' : ''}
                    </span>
                    <span className={`text-piccolo ${m.equipExempt ? 'font-bold text-[#5C4A3C]' : 'text-gray-500'}`}>
                      {L.t('membri.esente')}
                    </span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  </div>
);

// Le Regole non dipendono da niente: e' l'unica scheda che si disegna da
// sola, e infatti l'elenco delle dipendenze e' vuoto.
const schedaRegole = () => (
  <div className="space-y-4">
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">{L.t('regole.titolo')}</h3>
      <ol className="space-y-3">
        {CAMP_RULES.map((text, i) => (
          <li key={i} className="flex gap-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20">
            <span className="font-rustic text-grande text-[#5C4A3C] leading-none shrink-0">{i + 1}.</span>
            <p className="text-piccolo leading-relaxed uppercase underline underline-offset-2 decoration-[#8F9E8B]/70 font-bold text-[#2D392C]">
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
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">{L.t('dotazioni.base')}</h3>
      <ul className="space-y-2">
        {BASE_GEAR.map((item) => (
          <li
            key={item.text}
            className={`flex items-center gap-3 rounded border p-2.5 ${
              item.emphasis
                ? 'bg-[#D97706]/10 border-[#D97706]/40'
                : 'bg-[#F0F4F1]/60 border-[#8F9E8B]/20'
            }`}
          >
            <span className={`shrink-0 rounded-full bg-[#D97706] ${item.emphasis ? 'w-2 h-2' : 'w-1.5 h-1.5'}`}></span>
            <span className={item.emphasis
              ? 'text-medio font-bold uppercase underline decoration-2 underline-offset-2 text-[#2D392C] leading-snug'
              : 'text-normale text-[#2D392C]'}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-minuto text-gray-400 italic mt-2">{L.t('dotazioni.obbligo')}</p>
    </div>

    {/* Box editabile: aggiunte dell'occasione */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">{L.t('dotazioni.aggiunte')}</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={newGearText}
          onChange={(e) => setNewGearText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addGear()}
          placeholder={L.t('dotazioni.esempio')}
          className="flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]"
        />
        <button onClick={addGear} aria-label={L.t('dotazioni.aggiungi')} className={bottoneIcona('pieno')}>+</button>
      </div>
      {gear.length === 0 ? (
        <p className="text-normale text-gray-400 italic">{L.t('dotazioni.vuoto')}</p>
      ) : (
        <ul className="space-y-2">
          {gear.map((g) => (
            <li key={g.id} className="flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
              <span className="w-1.5 h-1.5 bg-[#8F9E8B] rounded-full shrink-0"></span>
              <span className="flex-grow text-normale text-[#2D392C]">{g.text}</span>
              <button onClick={() => removeGear(g.id)} aria-label={L.t('dotazioni.rimuovi')} className={bottoneIcona('distruttivo')}>&times;</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);
