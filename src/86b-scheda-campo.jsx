// ---------- «Il campo» ----------
// La scheda del campo aperto: prima stava tutta dentro Impostazioni, in
// mezzo alla lingua e al tema scuro, e per mandare l'invito bisognava
// scendere oltre il proprio account. Adesso Impostazioni e' della persona, e
// il campo ha la sua scheda (bozza C1):
//
//   1. l'INVITO in cima, perche' e' la cosa che si fa piu' spesso: il codice,
//      Condividi, Copia il link;
//   2. le cose del campo, una riga per una, che si aprono una alla volta:
//      nome e date, il luogo del meteo, cosa si divide, l'aiutante, le regole
//      e cosa portare. Le cambia il capogruppo; gli altri le leggono;
//   3. il Pro, in fondo: lo vedono tutti, e lo compra solo il capogruppo.
//
// Come le altre schede disegna e non tiene stato: quale riga e' aperta sta in
// usaStanza (rigaCampo).
// Dentro una riga aperta il riquadro non ripete il titolo: lo dice gia' la
// riga, un rigo sopra.
const schedaCampo = ({ account, contiBloccati, goTo, stanzaStato }) => {
  if (!stanzaStato.stanza) return null;
  const capo = stanzaStato.capogruppo;
  const v = stanzaStato.voceAperta || {};
  const nomeCampo = v.nome || stanzaStato.stanza.nome || Stanza.bello(stanzaStato.stanza.codice);
  const date = v.inizio && v.fine ? L.t('campo.dal', L.data(parseDate(v.inizio), 'breve'), L.data(parseDate(v.fine), 'breve')) : L.t('campo.senzaDate');
  // Una riga: il titolo, com'e' adesso, e sotto — se aperta — il suo riquadro.
  const riga = (k, titolo, adesso, contenuto) => (
    <div key={k} className="border-t border-salvia/20 first:border-t-0">
      <button data-riga={k} aria-expanded={stanzaStato.rigaCampo === k} onClick={() => stanzaStato.apriRigaCampo(k)} className={bottoneRiga()}>
        <span className="min-w-0">
          <span className="block text-normale font-bold text-bosco">{titolo}</span>
          {adesso && <span className="block text-minuto text-gray-500 truncate">{adesso}</span>}
        </span>
        <span className="text-salvia shrink-0">{stanzaStato.rigaCampo === k ? '−' : '+'}</span>
      </button>
      {stanzaStato.rigaCampo === k && <div className="px-4 pb-3">{contenuto}</div>}
    </div>
  );
  const campoTesto = 'p-2 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco';
  const b = stanzaStato.bozzaCampo;
  const luogo = stanzaStato.luogo;
  const spente = window.Voci ? window.Voci.CATEGORIE.filter((c) => stanzaStato.voci && stanzaStato.voci[c] === 'fuori') : [];
  return (
  <div data-scheda="campo" className="space-y-4">
    {/* L'invito. Il codice e' la chiave del campo: chi ce l'ha entra, senza
        registrarsi. «Condividi» sul telefono apre WhatsApp, Telegram, SMS e
        mail con un gesto solo; gli altri due tasti sono il ripiego per chi sta
        al computer. */}
    <div data-riquadro="invito" className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande text-bosco">{L.t('campo.invitaTitolo')}</h3>
      <p className="text-piccolo text-gray-500 leading-snug -mt-1">{L.t('passi.invitaNota')}</p>
        <div className="flex items-center justify-between gap-2 bg-carta/60 rounded p-2">
          <span className="font-mono text-medio tracking-widest text-bosco min-w-0 break-words">{Stanza.bello(stanzaStato.stanza.codice)}</span>
          <button
            onClick={() => { try { navigator.clipboard.writeText(Stanza.bello(stanzaStato.stanza.codice)); } catch (e) { /* niente */ } }}
            className={bottone('secondario', 'minuscolo', 'shrink-0')}
          >{L.t('stanza.copiaCodice')}</button>
        </div>
        {/* Le tre strade per mandare l'invito. "Condividi" sul telefono apre
            WhatsApp, Telegram, SMS e mail con un gesto solo ed e' il tasto
            giusto; gli altri due sono il ripiego per chi sta al computer,
            dove navigator.share spesso non c'e'. Il meccanismo e' lo stesso
            gia' usato per il PDF ricordo e il resoconto delle spese. */}
        <div className="flex gap-2">
          <button
            onClick={stanzaStato.mandaInvito}
            className={bottone('primario', 'normale', 'flex-1')}
          >{L.t('stanza.condividi')}</button>
          <button
            onClick={() => { try { navigator.clipboard.writeText(stanzaStato.linkDaMandare()); } catch (e) { /* niente */ } }}
            className={bottone('secondario', 'normale', 'flex-1')}
          >{L.t('stanza.copiaLink')}</button>
        </div>
        {stanzaStato.membri.length > 0 && (
          <p className="text-piccolo text-gray-500">{L.t('stanza.dentro', stanzaStato.membri.length)}</p>
        )}
    </div>

    {/* Le cose del campo. */}
    <div className="bg-scheda rounded-lg border-2 border-bosco/20 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-salvia/40">
        <h3 data-nome-campo className="font-rustic text-grande text-bosco">{nomeCampo}</h3>
        <p className="text-piccolo text-gray-500">{date}</p>
        {stanzaStato.aiutante && <p className="text-piccolo text-bosco leading-snug mt-1">{L.t('stanza.seiAiutante')}</p>}
      </div>
      {capo ? (
        <div>
          {riga('nome', L.t('campo.nomeDate'), date, b ? (
            <div data-riquadro="nome-date" className="space-y-2">
              <input data-nome value={b.nome} onChange={(e) => stanzaStato.setBozzaCampo(Object.assign({}, b, { nome: e.target.value }))} placeholder={L.t('stanza.nome')} className={`w-full ${campoTesto}`} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-minuto uppercase font-bold text-gray-500">{L.t('stanza.inizio')}
                  <input data-inizio type="date" value={b.inizio} onChange={(e) => stanzaStato.setBozzaCampo(Object.assign({}, b, { inizio: e.target.value }))} className={`w-full mt-1 ${campoTesto}`} />
                </label>
                <label className="text-minuto uppercase font-bold text-gray-500">{L.t('stanza.fine')}
                  <input data-fine type="date" value={b.fine} onChange={(e) => stanzaStato.setBozzaCampo(Object.assign({}, b, { fine: e.target.value }))} className={`w-full mt-1 ${campoTesto}`} />
                </label>
              </div>
              <p className="text-minuto text-gray-500 leading-snug">{L.t('campo.dateSpiega')}</p>
              <div className="flex gap-2">
                <button data-salva-nome onClick={stanzaStato.salvaNomeDate} disabled={stanzaStato.occupato} className={bottone('primario', 'normale', 'flex-1')}>{L.t('luogo.salva')}</button>
                <button onClick={() => stanzaStato.setBozzaCampo(null)} className={bottone('testuale', 'normale', 'shrink-0')}>{L.t('luogo.annulla')}</button>
              </div>
            </div>
          ) : (
            <button data-cambia-nome onClick={stanzaStato.apriBozzaCampo} className={bottone('secondario', 'normale', 'w-full')}>{L.t('campo.cambia')}</button>
          ))}
          {riga('luogo', L.t('luogo.titolo'), !stanzaStato.sbloccata('meteo') ? L.t('pro.soloPro') : luogo ? (luogo.label || L.t('luogo.senzaNome')) : L.t('luogo.nonScelto'), (
            <div>
                  {/* Il luogo del campo, per il meteo. Lo sceglie il capogruppo per
                      tutti: le previsioni sono una sola per tutto il campo. Una
                      casella sola: un nome da cercare, oppure un link di Google Maps
                      o due coordinate incollate. */}
                  {stanzaStato.capogruppo && !stanzaStato.sbloccata('meteo') && avvisoPro({ funzione: 'meteo', capogruppo: true })}
                  {stanzaStato.capogruppo && stanzaStato.sbloccata('meteo') && (() => {
                    const campoTesto = 'p-2 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco';
                    const l = stanzaStato.luogo;
                    const c = stanzaStato.candidatoLuogo;
                    return (
                      <div data-riquadro="luogo" className="rounded border border-bosco/25 bg-orlo/40 p-3 space-y-2">
                        <p className="text-minuto text-gray-500 leading-snug">{L.t('luogo.spiega')}</p>
                        {stanzaStato.cercaLuogo === null ? (
                          <>
                            {l ? (
                              <p data-luogo-scelto className="text-piccolo text-bosco leading-snug">
                                <span className="font-bold">{l.label || L.t('luogo.senzaNome')}</span>
                                <span className="block text-minuto text-gray-500 font-mono">
                                  {l.lat}, {l.lon}{typeof l.alt === 'number' ? ` · ${L.t('luogo.aQuota', l.alt)}` : ` · ${L.t('luogo.quotaNonDetta')}`}
                                </span>
                              </p>
                            ) : (
                              <p className="text-piccolo text-gray-500 leading-snug">{L.t('luogo.nonScelto')}</p>
                            )}
                            <div className="flex gap-2">
                              <button onClick={stanzaStato.apriLuogo} disabled={stanzaStato.occupato} className={bottone('secondario', 'normale', 'flex-1')}>
                                {L.t(l ? 'luogo.cambia' : 'luogo.scegli')}
                              </button>
                              {l && (
                                <button
                                  onClick={() => { if (window.confirm(L.t('luogo.confermaTogli'))) stanzaStato.salvaLuogo(null); }}
                                  disabled={stanzaStato.occupato}
                                  className={bottone('testuale', 'normale', 'shrink-0')}
                                >{L.t('luogo.togli')}</button>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex gap-2">
                              <input
                                data-cerca-luogo
                                value={stanzaStato.cercaLuogo}
                                onChange={(e) => stanzaStato.setCercaLuogo(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') stanzaStato.trovaLuogo(); }}
                                placeholder={L.t('luogo.segnaposto')}
                                className={`flex-1 min-w-0 ${campoTesto}`}
                              />
                              <button onClick={stanzaStato.trovaLuogo} disabled={stanzaStato.cercandoLuogo} className={bottone('secondario', 'normale', 'shrink-0')}>
                                {stanzaStato.cercandoLuogo ? '…' : L.t('luogo.cerca')}
                              </button>
                            </div>
                            <p className="text-minuto text-gray-500 leading-snug">{L.t('luogo.aiuto')}</p>
                            {stanzaStato.trovatiLuogo.length > 0 && (
                              <div className="rounded border border-salvia/30 bg-scheda divide-y divide-salvia/20">
                                {stanzaStato.trovatiLuogo.map((t, i) => {
                                  const scelto = !!(c && c.lat === t.lat && c.lon === t.lon);
                                  return (
                                    <button key={i} data-trovato={i} onClick={() => stanzaStato.setCandidatoLuogo(t)} className={bottoneRiga()}>
                                      <span className={`text-piccolo leading-snug ${scelto ? 'font-bold text-bosco' : 'text-gray-700'}`}>{t.label}</span>
                                      <span className="text-minuto text-gray-400 shrink-0">{typeof t.alt === 'number' ? L.t('luogo.aQuota', t.alt) : ''}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {stanzaStato.erroreLuogo && (
                              <p className="text-piccolo font-bold text-red-700 leading-snug">{L.t(stanzaStato.erroreLuogo)}</p>
                            )}
                            {c && (
                              <div data-candidato className="rounded border border-bosco/30 bg-scheda p-2 space-y-2">
                                <input
                                  data-nome-luogo
                                  value={c.label || ''}
                                  onChange={(e) => stanzaStato.setCandidatoLuogo(Object.assign({}, c, { label: e.target.value }))}
                                  placeholder={L.t('luogo.nome')}
                                  className={`w-full ${campoTesto}`}
                                />
                                <p className="text-minuto text-gray-500 font-mono">{c.lat}, {c.lon}</p>
                                <label className="flex items-center gap-2 text-piccolo text-gray-600">
                                  <span>{L.t('luogo.quota')}</span>
                                  <input
                                    data-quota-luogo
                                    type="number"
                                    inputMode="numeric"
                                    value={typeof c.alt === 'number' || typeof c.alt === 'string' ? c.alt : ''}
                                    onChange={(e) => stanzaStato.setCandidatoLuogo(Object.assign({}, c, { alt: e.target.value }))}
                                    className={`w-24 ${campoTesto}`}
                                  />
                                  <span>m</span>
                                </label>
                                <p className="text-minuto text-gray-500 leading-snug">{L.t('luogo.quotaSpiega')}</p>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                data-salva-luogo
                                onClick={() => stanzaStato.salvaLuogo(c)}
                                disabled={!c || stanzaStato.occupato}
                                className={bottone('primario', 'normale', 'flex-1')}
                              >{L.t('luogo.salva')}</button>
                              <button onClick={stanzaStato.chiudiLuogo} className={bottone('testuale', 'normale', 'shrink-0')}>{L.t('luogo.annulla')}</button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
            </div>
          ))}
          {window.Voci && riga('voci', L.t('voci.titolo'), spente.length ? L.t('campo.vociSpente', spente.map((c) => L.t(NOME_VOCE[c])).join(', ')) : L.t('campo.vociTutte'), (
            <div>
                  {/* Le voci che si dividono (§ 8). Le sceglie il capogruppo per tutto
                      il campo: le quote devono essere le stesse su ogni telefono.
                      Spegnerne una a rimborsi gia' fatti riscrive le quote di tutti,
                      quindi a conti chiusi non si muove, e prima di cambiare chiede. */}
                  {stanzaStato.capogruppo && window.Voci && (
                    <div data-riquadro="voci" className="rounded border border-bosco/25 bg-orlo/40 p-3 space-y-2">
                      <p className="text-minuto text-gray-500 leading-snug">{L.t('voci.spiega')}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {window.Voci.CATEGORIE.map((cat) => {
                          const spenta = !!(stanzaStato.voci && stanzaStato.voci[cat] === 'fuori');
                          return (
                            <button
                              key={cat}
                              data-voce={cat}
                              onClick={() => {
                                if (!window.confirm(L.t('voci.conferma', L.t(NOME_VOCE[cat]), !spenta))) return;
                                stanzaStato.cambiaVoce(cat, !spenta);
                              }}
                              disabled={contiBloccati || stanzaStato.occupato}
                              className={bottoneScelta('interruttore', 'bordato', !spenta, 'minuscolo', contiBloccati ? 'opacity-60 cursor-not-allowed' : '')}
                            >{L.t(NOME_VOCE[cat])}</button>
                          );
                        })}
                      </div>
                      <p className="text-minuto text-gray-500 leading-snug">{L.t(contiBloccati ? 'voci.chiuse' : 'voci.legenda')}</p>
                    </div>
                  )}
            </div>
          ))}
          {riga('aiutante', L.t('stanza.aiutanteTitolo'), stanzaStato.vice ? ((stanzaStato.membri.find((m) => m.uid === stanzaStato.vice) || {}).nome || L.t('stanza.unMembro')) : L.t('campo.nessunAiutante'), (
            <div>
                  {/* L'aiutante: il capogruppo lo nomina fra chi c'e', e se deve
                      lasciare il campo lo passa a lui. Il Pro non passa: l'ha pagato
                      chi se ne va (firestore.rules lo spegne nel passaggio). */}
                  {stanzaStato.capogruppo && (() => {
                    const io = account.utente && account.utente.uid;
                    const altri = stanzaStato.membri.filter((m) => m.uid !== io);
                    const nomeDi = (uid) => {
                      const m = stanzaStato.membri.find((x) => x.uid === uid);
                      return (m && m.nome) || L.t('stanza.unMembro');
                    };
                    return (
                      <div data-riquadro="aiutante" className="rounded border border-bosco/25 bg-orlo/40 p-3 space-y-2">
                        <p className="text-minuto text-gray-500 leading-snug">{L.t('stanza.aiutanteSpiega')}</p>
                        {stanzaStato.vice && <p className="text-piccolo text-bosco leading-snug">{frase('stanza.aiutanteE', nomeDi(stanzaStato.vice))}</p>}
                        {altri.length > 0 && (
                          <div className="flex gap-2">
                            <select
                              value={stanzaStato.sceltaAiutante}
                              onChange={(e) => stanzaStato.setSceltaAiutante(e.target.value)}
                              className="flex-1 min-w-0 p-2 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco"
                            >
                              <option value="">{L.t('stanza.aiutanteScegli')}</option>
                              {altri.map((m) => (<option key={m.uid} value={m.uid}>{m.nome || L.t('stanza.unMembro')}</option>))}
                            </select>
                            <button
                              onClick={() => stanzaStato.nominaAiutante(stanzaStato.sceltaAiutante)}
                              disabled={!stanzaStato.sceltaAiutante || stanzaStato.occupato}
                              className={bottone('secondario', 'normale', 'shrink-0')}
                            >{L.t('stanza.aiutanteNomina')}</button>
                          </div>
                        )}
                        {stanzaStato.fatto === 'stanza.aiutanteNominato' && <p className="text-piccolo text-bosco leading-snug">{L.t('stanza.aiutanteNominato')}</p>}
                        {stanzaStato.vice && (
                          <button
                            onClick={async () => {
                              if (!window.confirm(L.t('stanza.confermaLascia', nomeDi(stanzaStato.vice), stanzaStato.pro))) return;
                              await stanzaStato.lasciaCampo(account.utente, () => goTo('campi'));
                            }}
                            disabled={stanzaStato.occupato}
                            className={bottone('distruttivo', 'minuscolo', 'w-full')}
                          >{L.t('stanza.lasciaCampo', nomeDi(stanzaStato.vice))}</button>
                        )}
                      </div>
                    );
                  })()}
            </div>
          ))}
          {riga('regole', L.t('campo.regoleDotazioni'), L.t('campo.regoleNota'), (
            <div className="flex gap-2">
              <button onClick={() => goTo('regole')} className={bottone('secondario', 'normale', 'flex-1')}>{L.t('area.regole')}</button>
              <button onClick={() => goTo('dotazioni')} className={bottone('secondario', 'normale', 'flex-1')}>{L.t('area.dotazioni')}</button>
            </div>
          ))}
        </div>
      ) : (
        // Chi non e' il capogruppo legge: dove si va e chi tiene il campo.
        <div className="px-4 py-3 space-y-1">
          {luogo && <p className="text-piccolo text-bosco flex items-center gap-1.5">{icona('luogo', 'w-4 h-4')}{luogo.label || L.t('luogo.senzaNome')}</p>}
          <p className="text-minuto text-gray-500 leading-snug">{L.t('campo.soloCapogruppo')}</p>
        </div>
      )}
    </div>

    {/* Il Pro del campo. Lo vedono tutti: sapere se il campo e' Pro serve
        anche a chi non lo paga, per capire perche' una cosa non c'e'. */}
    <div data-riquadro="pro" className={`rounded-lg border-2 p-4 space-y-2 ${stanzaStato.pro ? 'border-fuoco/40 bg-fuoco/10' : 'border-bosco/25 bg-orlo/40'}`}>
      <p className="text-piccolo font-bold text-bosco flex items-center gap-2">
        {segnoPro()}
        {stanzaStato.pro
          ? (stanzaStato.proFino ? L.t('pro.attivoFino', L.data(parseDate(stanzaStato.proFino), 'breve')) : L.t('pro.attivo'))
          : L.t('pro.gratuito')}
      </p>
      {!stanzaStato.pro && (
        <>
          <p className="text-minuto text-gray-600 leading-snug">{L.t(stanzaStato.capogruppo ? 'pro.cosaSblocca' : 'pro.perMembro')}</p>
          <ul className="text-minuto text-bosco space-y-0.5 pl-1">
            {window.Stanza.FUNZIONI_PRO.map((f) => <li key={f}>· {L.t(NOME_PRO[f])}</li>)}
          </ul>
          <p className="text-minuto text-gray-500 leading-snug">{L.t('pro.maiIConti')}</p>
          {/* Comprarlo: solo il capogruppo, e solo dall'app Android —
              Google Play Billing. Fuori si dice dove, senza tasti finti. */}
          {stanzaStato.capogruppo && stanzaStato.negozio === 'assente' && (
            <p data-pro-solo-android className="text-minuto text-bosco leading-snug">{L.t('pro.soloAndroid')}</p>
          )}
          {stanzaStato.capogruppo && stanzaStato.negozio && stanzaStato.negozio !== 'assente' && (
            <div className="space-y-2 pt-1">
              {[
                [window.Stanza.PRODOTTI_PRO.campo, 'pro.compraCampo', 'pro.compraCampoSpiega'],
                [window.Stanza.PRODOTTI_PRO.anno, 'pro.compraAnno', 'pro.compraAnnoSpiega'],
              ].map(([sku, etichetta, spiega]) => (
                <div key={sku}>
                  <button
                    data-compra={sku}
                    onClick={() => stanzaStato.compraPro(sku)}
                    disabled={!!stanzaStato.acquistando}
                    className={bottone(sku === window.Stanza.PRODOTTI_PRO.campo ? 'avviso' : 'secondario', 'normale', 'w-full')}
                  >{stanzaStato.acquistando === sku ? '…' : L.t(etichetta, stanzaStato.negozio.prezzi[sku] || '')}</button>
                  <p className="text-minuto text-gray-500 leading-snug mt-1">{L.t(spiega)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {stanzaStato.esitoPro && stanzaStato.esitoPro.fatto && (
        <p data-pro-esito className="text-piccolo font-bold text-bosco leading-snug">{L.t(stanzaStato.esitoPro.fatto)}</p>
      )}
      {stanzaStato.esitoPro && stanzaStato.esitoPro.errore && (
        <p data-pro-esito className="text-piccolo font-bold text-red-700 leading-snug">{L.t(stanzaStato.esitoPro.errore)}</p>
      )}
    </div>

    <button onClick={() => { stanzaStato.esci(); goTo('campi'); }} disabled={stanzaStato.occupato} className={bottone('testuale', 'minuscolo', 'w-full')}>{L.t('stanza.esci')}</button>

    {stanzaStato.problema && <p className="text-piccolo font-bold text-red-700 leading-snug">{L.t(stanzaStato.problema)}</p>}
  </div>
  );
};
