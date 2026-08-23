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
      <div key={g[0].id} className="bg-[#D97706]/10 border-2 border-[#D97706]/40 rounded-lg p-3 space-y-2">
        <p className="text-[11px] text-[#5C4A3C] leading-snug">
          <span className="font-bold">"{g[0].name}" è in elenco {g.length} volte.</span>{' '}
          Capita quando due telefoni senza linea aggiungono la stessa persona. Così nei conti
          vale {g.length} persone: <span className="font-bold">la quota di tutti sbaglia</span>.
        </p>
        <button
          onClick={() => unisciDoppi(g)}
          className={bottone('avviso', 'piccolo', 'w-full')}
        >
          Unisci in una sola scheda
        </button>
        <p className="text-[9px] text-gray-500 italic leading-snug">
          Le presenze segnate sulle due schede si sommano: non si perde niente. Se invece sono
          davvero due persone diverse, aggiungi un cognome o un soprannome a una delle due.
        </p>
      </div>
    ))}

    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aggiungi Membro</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={newMemberName}
          onChange={(e) => setNewMemberName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMember()}
          placeholder="Nome e cognome"
          className="flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
        />
        <button onClick={addMember} className={bottoneIcona('pieno')}>+</button>
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={newMemberChild} onChange={(e) => setNewMemberChild(e.target.checked)} />
        Bambino (pasti gratis)
      </label>
    </div>

    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">
        Membri ({members.length})
      </h3>
      {members.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nessun membro. Aggiungine uno per iniziare a segnare le presenze.</p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-[#2D392C] truncate">
                  {m.name}
                  {(m.paypal || m.iban) && <span className="ml-1.5 text-[9px] text-[#8F9E8B]" title="Ha inserito i dati per il rimborso">💳</span>}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setInfoMember((v) => (v === m.id ? null : m.id))}
                    aria-label={`Dati di pagamento di ${m.name}`}
                    title="Dati per il rimborso (PayPal / IBAN)"
                    className={`w-6 h-6 rounded-full border-2 font-serif italic font-bold text-[11px] leading-none flex items-center justify-center ${infoMember === m.id ? 'bg-[#2D392C] border-[#2D392C] text-white' : 'bg-white border-[#8F9E8B] text-[#5C4A3C]'}`}
                  >
                    i
                  </button>
                  <button
                    onClick={() => toggleChild(m.id)}
                    className={bottoneScelta('etichetta', 'ambra', m.isChild, 'minimo')}
                  >
                    {m.isChild ? 'Bambino' : 'Adulto'}
                  </button>
                  <button onClick={() => removeMember(m.id)} className={bottoneIcona('distruttivo')}>&times;</button>
                </div>
              </div>
              {/* Dati per farsi rimborsare dopo il campo. Si aprono con la "i". */}
              {infoMember === m.id && (
                <div className="mt-2.5 pt-2.5 border-t border-[#8F9E8B]/30 space-y-2">
                  <p className="text-[10px] text-gray-500 leading-snug">
                    Come farsi rimborsare a campo finito. Facoltativi: si vedono in
                    <span className="font-bold"> Spese Totali → Saldi</span>, accanto a chi deve ricevere.
                  </p>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-gray-500 tracking-wide mb-1">PayPal</label>
                    <input
                      type="text"
                      inputMode="email"
                      value={m.paypal || ''}
                      onChange={(e) => setMemberField(m.id, 'paypal', e.target.value)}
                      placeholder="paypal.me/nome oppure email"
                      className="w-full p-2 bg-white border border-[#8F9E8B]/40 rounded text-sm focus:outline-none focus:border-[#2D392C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-gray-500 tracking-wide mb-1">IBAN</label>
                    <input
                      type="text"
                      value={m.iban || ''}
                      onChange={(e) => setMemberField(m.id, 'iban', e.target.value.toUpperCase())}
                      onBlur={(e) => { const p = ibanPretty(e.target.value); if (p !== (m.iban || '')) setMemberField(m.id, 'iban', p); }}
                      placeholder="IT00 X000 0000 0000 0000 0000 000"
                      className="w-full p-2 bg-white border border-[#8F9E8B]/40 rounded text-xs font-mono focus:outline-none focus:border-[#2D392C]"
                    />
                    {/* Un IBAN sbagliato si scopre solo quando il bonifico torna indietro. */}
                    {(m.iban || '').trim() !== '' && (
                      ibanValid(m.iban)
                        ? <p className="text-[9px] text-[#2D392C] mt-1">✔ IBAN formalmente corretto</p>
                        : <p className="text-[9px] text-[#D97706] mt-1">Controlla l'IBAN: non supera la verifica standard (manca o è sbagliato un carattere).</p>
                    )}
                  </div>
                  <p className="text-[9px] text-gray-400 italic leading-snug">
                    Finiscono nel database del campo, come tutto il resto: li vede chi ha la password dell'app.
                    Alla chiusura del campo vengono azzerati insieme ai membri.
                  </p>
                </div>
              )}
              {/* Esenzione attrezzatura: nascosta finche' FEATURES.equipExemption e' false */}
              {FEATURES.equipExemption && (
                <button
                  onClick={() => toggleEquipExempt(m.id)}
                  aria-label="Esenzione attrezzatura"
                  className="mt-1.5 flex items-center gap-2 text-left"
                >
                  <span className={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center text-[10px] font-bold ${m.equipExempt ? 'bg-[#5C4A3C] border-[#5C4A3C] text-white' : 'bg-white border-[#8F9E8B]'}`}>
                    {m.equipExempt ? '✓' : ''}
                  </span>
                  <span className={`text-[10px] ${m.equipExempt ? 'font-bold text-[#5C4A3C]' : 'text-gray-500'}`}>
                    Esente attrezzatura
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
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Regole dell'accampamento</h3>
      <ol className="space-y-3">
        {CAMP_RULES.map((text, i) => (
          <li key={i} className="flex gap-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20">
            <span className="font-rustic text-lg text-[#5C4A3C] leading-none shrink-0">{i + 1}.</span>
            <p className="text-[11px] leading-relaxed uppercase underline underline-offset-2 decoration-[#8F9E8B]/70 font-bold text-[#2D392C]">
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
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Dotazione base</h3>
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
              ? 'text-base font-bold uppercase underline decoration-2 underline-offset-2 text-[#2D392C] leading-snug'
              : 'text-sm text-[#2D392C]'}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[9px] text-gray-400 italic mt-2">Dotazione obbligatoria per ogni partecipante.</p>
    </div>

    {/* Box editabile: aggiunte dell'occasione */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aggiunte per questo campo</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={newGearText}
          onChange={(e) => setNewGearText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addGear()}
          placeholder="Es. costume, torcia frontale…"
          className="flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
        />
        <button onClick={addGear} aria-label="Aggiungi dotazione" className={bottoneIcona('pieno')}>+</button>
      </div>
      {gear.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nessuna aggiunta. Inserisci qui le dotazioni extra per questo campo.</p>
      ) : (
        <ul className="space-y-2">
          {gear.map((g) => (
            <li key={g.id} className="flex items-center gap-3 bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
              <span className="w-1.5 h-1.5 bg-[#8F9E8B] rounded-full shrink-0"></span>
              <span className="flex-grow text-sm text-[#2D392C]">{g.text}</span>
              <button onClick={() => removeGear(g.id)} aria-label="Rimuovi" className={bottoneIcona('distruttivo')}>&times;</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);
