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
  campoInCorso,
  cloud,
  datiOpen,
  diagTick,
  entraAdmin,
  esciAdmin,
  esportaRegistro,
  exportData,
  fotoDove,
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
  receipts,
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
  lingua,
  setLingua,
  account,
  stanzaStato,
  theme,
  toggleAskAlways,
  wipeLocal,
}) => (
  <div className="space-y-4">
    {/* Pronto per il campo.
        Senza un campo in corso i controlli non hanno oggetto: due dei tre
        parlano dei dati, e i dati sono quelli del campo. Dopo la chiusura
        resterebbero rossi per sempre — su un telefono che sta benissimo. */}
    <div className={`p-4 rounded-lg border-2 shadow-sm space-y-3 ${!campoInCorso || readyOk ? 'bg-white border-[#2D392C]/20' : 'bg-white border-[#D97706]/50'}`}>
      <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
        <h3 className="font-rustic text-grande text-[#2D392C]">{L.t('pronto.titolo')}</h3>
        <span className={`text-minuto uppercase font-bold px-2 py-1 rounded ${campoInCorso && !readyOk ? 'bg-[#D97706] text-white' : 'bg-[#2D392C] text-white'}`}>
          {L.t(!campoInCorso ? 'pronto.nessunCampo' : readyOk ? 'pronto.si' : 'pronto.nonAncora')}
        </span>
      </div>
      {!campoInCorso ? (
        <p className="text-piccolo text-gray-500 leading-snug">
          {frase('pronto.senzaCampo')}
        </p>
      ) : (
        <>
          <p className="text-piccolo text-gray-500 leading-snug">
            {frase('pronto.treCose')}
          </p>
          <ul className="space-y-2">
            {readyChecks.map((c) => (
              <li key={c.titolo} className={`flex items-start gap-2 p-2.5 rounded border ${c.ok ? 'bg-[#F0F4F1]/60 border-[#8F9E8B]/20' : 'bg-[#D97706]/10 border-[#D97706]/40'}`}>
                <span className="text-medio leading-none shrink-0">{c.ok ? '✅' : '⚠️'}</span>
                <div className="min-w-0">
                  <div className="text-piccolo font-bold text-[#2D392C]">{c.titolo}</div>
                  {!c.ok && <div className="text-piccolo text-[#5C4A3C] leading-snug mt-0.5">{c.no}</div>}
                </div>
              </li>
            ))}
          </ul>
          {readyOk && (
            <p className="text-minuto text-gray-400 italic">{L.t('pronto.tuttoBene')}</p>
          )}
        </>
      )}
    </div>

    {/* Account (ROADMAP.md § 1). Dietro FEATURES.auth.

        Sta QUI, in fondo a Impostazioni, e non davanti all'app: e' la nota di
        prodotto del § 1 messa in pratica. Chi apre l'app e digita il codice
        del campo segna presenze e spese senza sapere che questa tessera
        esiste. L'account serve a creare e amministrare un campo — cioe' alle
        cose che nella versione pubblica hanno un proprietario. */}
    {FEATURES.auth && (
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">{L.t('auth.titolo')}</h3>

      {account.stato === 'registrato' && (
        <>
          <p className="text-piccolo text-[#2D392C] leading-snug">{frase('auth.entratoCome', window.Auth.nomeVisibile({ nome: account.utente && account.utente.nome, email: account.utente && account.utente.email }))}</p>
          <button onClick={account.esci} disabled={account.occupato} className={bottone('secondario', 'normale', 'w-full')}>{L.t('auth.esci')}</button>
        </>
      )}

      {account.stato === 'daVerificare' && (
        <>
          <p className="text-piccolo text-[#5C4A3C] leading-snug">{frase('auth.daVerificare', (account.utente && account.utente.email) || '')}</p>
          <div className="flex gap-2">
            <button onClick={account.controllaVerifica} disabled={account.occupato} className={bottone('primario', 'normale', 'flex-1')}>{L.t('auth.hoVerificato')}</button>
            <button onClick={account.rimandaVerifica} disabled={account.occupato} className={bottone('secondario', 'normale', 'flex-1')}>{L.t('auth.rimandaEmail')}</button>
          </div>
          <button onClick={account.esci} disabled={account.occupato} className={bottone('testuale', 'minuscolo', 'w-full')}>{L.t('auth.esci')}</button>
        </>
      )}

      {(account.stato === 'ospite' || account.stato === 'anonimo') && (
        <>
          <p className="text-piccolo text-gray-500 leading-snug">{frase('auth.aCosaServe')}</p>
          <button onClick={account.entraConGoogle} disabled={account.occupato} className={bottone('primario', 'normale', 'w-full')}>{L.t('auth.conGoogle')}</button>

          {!account.modo ? (
            <div className="flex items-center gap-2">
              <span className="flex-grow h-px bg-[#8F9E8B]/30"></span>
              <span className="text-minuto uppercase tracking-widest text-gray-400 shrink-0">{L.t('auth.oppure')}</span>
              <span className="flex-grow h-px bg-[#8F9E8B]/30"></span>
            </div>
          ) : null}

          {!account.modo && (
            <div className="flex gap-2">
              <button onClick={() => account.setModo('entra')} className={bottone('secondario', 'normale', 'flex-1')}>{L.t('auth.haiGiaAccount')}</button>
              <button onClick={() => account.setModo('registra')} className={bottone('secondario', 'normale', 'flex-1')}>{L.t('auth.creaAccount')}</button>
            </div>
          )}

          {account.modo && (
            <div className="space-y-2 pt-1">
              {account.modo === 'registra' && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={account.nome} onChange={(e) => account.setNome(e.target.value)}
                    placeholder={L.t('auth.nome')} autoComplete="given-name"
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]" />
                  <input type="text" value={account.cognome} onChange={(e) => account.setCognome(e.target.value)}
                    placeholder={L.t('auth.cognome')} autoComplete="family-name"
                    className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]" />
                </div>
              )}
              <input type="email" inputMode="email" value={account.email} onChange={(e) => account.setEmail(e.target.value)}
                placeholder={L.t('auth.email')} autoComplete="email"
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]" />
              <input type="password" value={account.password} onChange={(e) => account.setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (account.modo === 'entra' ? account.entraConEmail() : account.registrati())}
                placeholder={L.t('auth.password')} autoComplete={account.modo === 'entra' ? 'current-password' : 'new-password'}
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]" />
              <div className="flex gap-2">
                <button onClick={account.chiudi} className={bottone('testuale', 'normale', 'flex-1')}>{L.t('galleria.annulla')}</button>
                <button
                  onClick={account.modo === 'entra' ? account.entraConEmail : account.registrati}
                  disabled={account.occupato}
                  className={bottone('primario', 'normale', 'flex-1')}
                >
                  {L.t(account.modo === 'entra' ? 'auth.entra' : 'auth.registrati')}
                </button>
              </div>
              {account.modo === 'entra' && (
                <button onClick={account.reimposta} disabled={account.occupato} className={bottone('testuale', 'minuscolo', 'w-full')}>{L.t('auth.passwordDimenticata')}</button>
              )}
            </div>
          )}
        </>
      )}

      {/* L'indirizzo di questa pagina si passa sempre: le chiavi che sono
          stringhe lo ignorano, e quella del dominio non autorizzato ci
          scrive dentro il nome da copiare in Firebase. */}
      {account.problema && <p className="text-piccolo font-bold text-red-700 leading-snug">{L.t(account.problema, typeof window !== 'undefined' ? window.location.hostname : '')}</p>}
      {account.fatto && <p className="text-piccolo text-[#2D392C] leading-snug">{L.t(account.fatto)}</p>}
    </div>
    )}

    {/* La stanza (ROADMAP.md § 2 e § 9). Dietro FEATURES.rooms.

        Come l'account, sta in fondo a Impostazioni e non davanti all'app:
        chi usa il campo che ha gia' non incontra niente di tutto questo.
        Le regole del codice stanno in stanza.js, quelle di CHI puo' entrare
        in firestore.rules — qui si disegna e basta. */}
    {FEATURES.rooms && (
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">{L.t('stanza.titolo')}</h3>

      {/* Un invito arrivato da un link. Si mostra e si CHIEDE: entrare di
          nascosto perche' qualcuno ha inoltrato un messaggio e' il genere di
          cosa che fa disinstallare un'app. */}
      {stanzaStato.invito && (
        <div className="bg-[#F0F4F1]/70 border border-[#2D392C]/20 rounded p-3 space-y-2">
          <p className="text-piccolo text-[#2D392C] leading-snug">{frase('stanza.invitoCodice', Stanza.bello(stanzaStato.invito))}</p>
          <div className="flex gap-2">
            <button onClick={stanzaStato.rifiutaInvito} className={bottone('testuale', 'normale', 'flex-1')}>{L.t('stanza.rifiutaInvito')}</button>
            <button onClick={() => stanzaStato.accettaInvito(account.utente)} disabled={stanzaStato.occupato} className={bottone('primario', 'normale', 'flex-1')}>{L.t('stanza.accettaInvito')}</button>
          </div>
        </div>
      )}

      {stanzaStato.stanza ? (
        <>
          <p className="text-piccolo text-[#2D392C] leading-snug">{frase('stanza.entrato', stanzaStato.stanza.nome || Stanza.bello(stanzaStato.stanza.codice))}</p>
          <div className="flex items-center justify-between gap-2 bg-[#F0F4F1]/60 rounded p-2">
            <span className="font-mono text-medio tracking-widest text-[#2D392C] min-w-0 break-words">{Stanza.bello(stanzaStato.stanza.codice)}</span>
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
              onClick={() => {
                const link = stanzaStato.linkDaMandare();
                const testo = L.t('stanza.invitoTesto')(stanzaStato.stanza.nome || Stanza.bello(stanzaStato.stanza.codice), link);
                if (navigator.share) { navigator.share({ text: testo }).catch(() => { /* annullato: non e' un guasto */ }); }
                else { window.open('https://wa.me/?text=' + encodeURIComponent(testo), '_blank'); }
              }}
              className={bottone('primario', 'normale', 'flex-1')}
            >{L.t('stanza.condividi')}</button>
            <button
              onClick={() => { try { navigator.clipboard.writeText(stanzaStato.linkDaMandare()); } catch (e) { /* niente */ } }}
              className={bottone('secondario', 'normale', 'flex-1')}
            >{L.t('stanza.copiaLink')}</button>
          </div>
          {stanzaStato.membri.length > 0 && (
            <p className="text-piccolo text-gray-500">{L.t('stanza.dentro')(stanzaStato.membri.length)}</p>
          )}
          <button onClick={stanzaStato.esci} disabled={stanzaStato.occupato} className={bottone('testuale', 'minuscolo', 'w-full')}>{L.t('stanza.esci')}</button>
        </>
      ) : (
        <>
          <p className="text-piccolo text-gray-500 leading-snug">{L.t('stanza.aCosaServe')}</p>

          {!stanzaStato.modo && (
            <div className="flex gap-2">
              <button onClick={() => stanzaStato.setModo('crea')} className={bottone('primario', 'normale', 'flex-1')}>{L.t('stanza.creaTitolo')}</button>
              <button onClick={() => stanzaStato.setModo('entra')} className={bottone('secondario', 'normale', 'flex-1')}>{L.t('stanza.entraTitolo')}</button>
            </div>
          )}

          {stanzaStato.modo === 'crea' && (
            <div className="space-y-2 pt-1">
              <input type="text" value={stanzaStato.nome} onChange={(e) => stanzaStato.setNome(e.target.value)}
                placeholder={L.t('stanza.nome')}
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={stanzaStato.inizio} onChange={(e) => stanzaStato.setInizio(e.target.value)}
                  aria-label={L.t('stanza.inizio')}
                  className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]" />
                <input type="date" value={stanzaStato.fine} onChange={(e) => stanzaStato.setFine(e.target.value)}
                  aria-label={L.t('stanza.fine')}
                  className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale focus:outline-none focus:border-[#2D392C]" />
              </div>
              <div className="flex gap-2">
                <button onClick={stanzaStato.chiudi} className={bottone('testuale', 'normale', 'flex-1')}>{L.t('galleria.annulla')}</button>
                <button onClick={() => stanzaStato.crea(account.utente)} disabled={stanzaStato.occupato} className={bottone('primario', 'normale', 'flex-1')}>{L.t('stanza.crea')}</button>
              </div>
            </div>
          )}

          {stanzaStato.modo === 'entra' && (
            <div className="space-y-2 pt-1">
              {/* Il codice si mostra sempre in forma leggibile mentre si
                  digita: chi lo ricopia da un foglio deve poter confrontare
                  quello che vede con quello che ha in mano. */}
              <input type="text" value={stanzaStato.codice} onChange={(e) => stanzaStato.setCodice(e.target.value)}
                placeholder={L.t('stanza.codice')} autoCapitalize="characters" autoComplete="off" spellCheck="false"
                className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-medio font-mono tracking-widest uppercase focus:outline-none focus:border-[#2D392C]" />
              <div className="flex gap-2">
                <button onClick={stanzaStato.chiudi} className={bottone('testuale', 'normale', 'flex-1')}>{L.t('galleria.annulla')}</button>
                <button onClick={() => stanzaStato.entra(account.utente)} disabled={stanzaStato.occupato} className={bottone('primario', 'normale', 'flex-1')}>{L.t('stanza.entra')}</button>
              </div>
            </div>
          )}
        </>
      )}

      {stanzaStato.problema && <p className="text-piccolo font-bold text-red-700 leading-snug">{L.t(stanzaStato.problema)}</p>}
      {stanzaStato.fatto === 'stanza.creata' && stanzaStato.stanza && (
        <p className="text-piccolo text-[#2D392C] leading-snug">{frase('stanza.creata', Stanza.bello(stanzaStato.stanza.codice))}</p>
      )}
    </div>
    )}

    {/* Lingua. Dietro FEATURES.lingue: finche' i dizionari non coprono tutta
        l'app, offrire la scelta vorrebbe dire mostrare meta' schermata in una
        lingua e meta' nell'altra. */}
    {FEATURES.lingue && (
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">{L.t('lingua.titolo')}</h3>
      <div className="grid grid-cols-3 gap-2">
        {Object.keys(window.Lingue.LINGUE).map((k) => (
          <button
            key={k}
            onClick={() => { setLingua(k); scriviLocale(LINGUA_KEY, k); }}
            className={bottoneScelta('linguetta', 'sezione', lingua === k, 'minuscolo')}
          >
            {window.Lingue.LINGUE[k].nome}
          </button>
        ))}
      </div>
      <p className="text-piccolo text-gray-500 leading-snug">{L.t('lingua.nota')}</p>
    </div>
    )}

    {/* Aspetto */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">{L.t('aspetto.titolo')}</h3>
      <div className="grid grid-cols-3 gap-2">
        {[['auto', L.t('aspetto.automatico'), '🌗'], ['light', L.t('aspetto.chiaro'), '☀️'], ['dark', L.t('aspetto.scuro'), '🌙']].map(([k, l, icon]) => (
          <button
            key={k}
            onClick={() => setTheme(k)}
            className={bottoneScelta('linguetta', 'sezione', theme === k, 'minuscolo')}
          >
            <span className="block text-medio leading-none mb-1">{icon}</span>
            {l}
          </button>
        ))}
      </div>
      <p className="text-piccolo text-gray-500">
        {L.t('aspetto.spiegazione', theme === 'auto', theme === 'auto' ? isDark : theme === 'dark')}
      </p>
    </div>

    {/* Galleria */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">{L.t('area.galleria')}</h3>
      <div className="flex items-center justify-between gap-3">
        <span className="text-normale text-[#2D392C]">{L.t('impostazioni.fotoPerPersona')}</span>
        <div className="flex items-center gap-2 shrink-0">
          {[3, 4, 5, 7].map((n) => (
            <button
              key={n}
              onClick={() => { setPhotoCap(n); scriviLocale(PHOTO_CAP_KEY, String(n)); }}
              className={bottoneScelta('linguetta', 'sezione', photoCap === n, 'minuscolo', 'w-9')}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <p className="text-piccolo text-gray-500 leading-snug">
        {L.t('impostazioni.fotoNota')}
      </p>
    </div>

    {/* Diagnostica della sincronizzazione: cosa è stato cancellato e
        quando. Senza questa scheda, capire chi ha fatto sparire cosa
        vuol dire leggere il database a mano. Solo in modalità tecnica. */}
    {admin && (
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">{L.t('diag.titolo')}</h3>
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
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-piccolo text-gray-600">
              <span>{fraseVestita('font-bold text-[#2D392C]', 'diag.vociDatate', Object.keys(m.rev || {}).length)}</span>
              <span>{fraseVestita('font-bold text-[#2D392C]', 'diag.cancellazioni', lapidi.length)}</span>
            </div>

            {/* Quanto pesano le foto e dove stanno. Nel campo 2026 gli
                scontrini occupavano 3,18 MB dei 5 di localStorage e i dati
                dei conti 35 KB: e' il numero che ha spostato le foto nel
                magazzino, quindi e' anche il numero da tenere d'occhio. */}
            {(() => {
              const MF = window.MagazzinoFoto;
              const quante = Object.keys(receipts || {}).length;
              const kb = MF ? Math.round(MF.peso(receipts) / 1024) : 0;
              return (
                <p className="text-piccolo text-gray-600">
                  {fraseVestita('font-bold text-[#2D392C]', 'diag.scontrini', quante, quante > 0 ? kb : null, fotoDove === 'magazzino')}
                </p>
              );
            })()}

            {/* Un telefono pieno di dati ma senza nemmeno una data è
                indifeso: non può vincere un confronto e la prima
                sincronizzazione gli porta via tutto ciò che gli altri
                hanno cancellato. È lo stato in cui si finisce quando la
                memoria si riempie, e non si vedeva da nessuna parte. */}
            {Object.keys(m.rev || {}).length === 0 &&
              ((st.members || []).length > 0 || (st.purchases || []).length > 0 || Object.keys(st.campData || {}).length > 0) && (
              <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                <p className="text-piccolo text-[#5C4A3C] leading-snug">
                  {frase('diag.senzaStoria')}
                </p>
              </div>
            )}

            {/* Cosa non è ancora arrivato agli altri, e come forzarlo. */}
            {(cloud.pending || (cloud.foto || 0) > 0) && (
              <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
                <p className="text-piccolo text-[#5C4A3C] leading-snug">
                  {frase('diag.daInviare', !!cloud.pending, cloud.foto || 0)}
                </p>
                <button
                  onClick={() => { const CS = window.CloudSync; if (CS && CS.riprova) CS.riprova(); }}
                  className={bottone('avviso', 'normale', 'w-full mt-2')}
                >
                  {L.t('diag.riprovaAdesso')}
                </button>
              </div>
            )}

            {scorta && scorta.state && (
              <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5 space-y-2">
                <p className="text-piccolo text-[#5C4A3C] leading-snug">
                  {frase('diag.reteDiSicurezza',
                    L.data(new Date(scorta.at), 'dataOra'),
                    scorta.perse,
                    scorta.quando ? L.data(new Date(scorta.quando), 'dataOra') : null,
                    scorta.quando ? Date.now() - scorta.quando > PERDITA_RECENTE : false)}
                </p>
                <p className="text-piccolo text-[#5C4A3C] leading-snug">
                  {frase('diag.annullandoTorna', scorta.perse,
                    scorta.paths && scorta.paths.length ? descriviPerdite(scorta.paths, scorta.state) : null)}
                </p>
                <button onClick={annullaSync} className={bottone('avviso', 'normale', 'w-full')}>
                  {L.t('diag.annullaSync')}
                </button>
                <button
                  onClick={() => { if (window.confirm(L.t('diag.confermaButtaCopia'))) { localStorage.removeItem(RESCUE_KEY); setLostSync(null); setDiagTick((t) => t + 1); } }}
                  className={bottone('testuale', 'minuscolo', 'w-full')}
                >
                  {L.t('diag.buttaCopia')}
                </button>
              </div>
            )}

            {lapidi.length === 0 ? (
              <p className="text-piccolo text-gray-400 italic">{L.t('diag.nessunaCancellazione')}</p>
            ) : (
              <div>
                <p className="text-piccolo uppercase font-bold text-gray-500 mb-1">{L.t('diag.ultimeCancellazioni')}</p>
                <ul className="space-y-1">
                  {lapidi.slice(0, 12).map((l) => (
                    <li key={l.p} className="flex items-start justify-between gap-2 text-piccolo bg-[#F0F4F1]/60 px-2 py-1.5 rounded border border-[#8F9E8B]/20">
                      <span className="text-[#2D392C] leading-snug">{descriviPath(l.p, st)}</span>
                      <span className="text-gray-500 shrink-0">
                        {L.data(new Date(l.at), 'breve')}
                        {' '}{L.data(new Date(l.at), 'ora')}
                      </span>
                    </li>
                  ))}
                </ul>
                {lapidi.length > 12 && (
                  <p className="text-minuto text-gray-400 italic mt-1">{L.t('diag.eAltre', lapidi.length - 12)}</p>
                )}
              </div>
            )}
            <p className="text-minuto text-gray-400 italic leading-snug">
              {L.t('diag.notaCancellazioni')}
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
        <span className="font-rustic text-grande text-[#2D392C] shrink-0">{L.t('registro.titolo')}</span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-minuto uppercase font-bold px-2 py-1 rounded bg-gray-200 text-gray-500">
            {(() => { void diagTick; const n = logLeggi().length; return n === 0 ? L.t('registro.vuoto') : L.t('registro.quanteVoci', n); })()}
          </span>
          <span className={`text-piccolo text-[#5C4A3C] transition-transform ${logOpen ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {logOpen && (<div className="px-4 pb-4 space-y-3">
        {(() => {
          void diagTick;
          const reg = logLeggi();
          const st = syncStateRef.current;
          if (reg.length === 0) {
            return <p className="text-piccolo text-gray-400 italic">{L.t('registro.nessuna')}</p>;
          }
          // Raggruppate per giorno: leggere 400 righe di fila è inutile.
          const perGiorno = [];
          reg.forEach((r) => {
            const g = L.data(new Date(r.at), 'completa');
            const ultimo = perGiorno[perGiorno.length - 1];
            if (ultimo && ultimo.giorno === g) ultimo.voci.push(r);
            else perGiorno.push({ giorno: g, voci: [r] });
          });
          return (
            <>
              <p className="text-piccolo text-gray-500 leading-snug">
                {L.t('registro.nota')}
              </p>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {perGiorno.map((gruppo) => (
                  <div key={gruppo.giorno}>
                    <p className="text-minuto uppercase font-bold text-gray-500 tracking-wide mb-1">{gruppo.giorno}</p>
                    <ul className="space-y-1">
                      {gruppo.voci.map((r, i) => (
                        <li key={r.p + r.at + i} className="flex items-start gap-2 text-piccolo bg-[#F0F4F1]/60 px-2 py-1.5 rounded border border-[#8F9E8B]/20">
                          <span className="text-gray-500 shrink-0 w-10">
                            {L.data(new Date(r.at), 'ora')}
                          </span>
                          <span className={`shrink-0 w-3 text-center ${r.k === 'd' ? 'text-red-700' : 'text-[#2D392C]'}`} title={L.t(r.k === 'd' ? 'registro.cancellata' : 'registro.modificata')}>
                            {r.k === 'd' ? '−' : '+'}
                          </span>
                          <span className="min-w-0 flex-grow leading-snug">
                            <span className="font-bold text-[#5C4A3C]">{sezioneDiPath(r.p)}</span>
                            <span className="text-[#2D392C]"> · {descriviPath(r.p, st)}</span>
                          </span>
                          <span className={`shrink-0 text-minuto uppercase font-bold px-1.5 py-0.5 rounded ${r.o === 'io' ? 'bg-[#2D392C]/10 text-[#2D392C]' : 'bg-[#5C4A3C]/10 text-[#5C4A3C]'}`}>
                            {L.t(r.o === 'io' ? 'registro.qui' : 'registro.sync')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={esportaRegistro} className={bottone('primario', 'normale', 'flex-1')}>{L.t('registro.esporta')}</button>
                <button
                  onClick={() => { if (window.confirm(L.t('registro.confermaSvuota'))) { localStorage.removeItem(LOG_KEY); setDiagTick((t) => t + 1); } }}
                  className={bottone('secondario', 'normale', 'flex-1')}
                >
                  {L.t('registro.svuota')}
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
        <span className="font-rustic text-grande text-[#2D392C] shrink-0">{L.t('blocco.titoloScheda')}</span>
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {/* Stato del database anche da chiusa: è l'unica cosa che
              serve vedere a colpo d'occhio. */}
          {(() => {
            const lock = window.APP_LOCK || {};
            if (!lock.dbEmail || !(LOCK && LOCK.hash)) return null;
            const protetto = cloud.authMode === 'shared';
            const ignoto = !protetto && !cloud.connected;
            return <span className="text-piccolo" title={L.t(protetto ? 'blocco.dbProtetto' : ignoto ? 'blocco.dbNonCollegato' : 'blocco.dbAperto')}>{protetto ? '🔒' : ignoto ? '—' : '⚠'}</span>;
          })()}
          <span className={`text-minuto uppercase font-bold px-2 py-1 rounded ${LOCK && LOCK.hash ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`}>
            {L.t(LOCK && LOCK.hash ? 'blocco.attivo' : 'blocco.nonAttivo')}
          </span>
          <span className={`text-piccolo text-[#5C4A3C] transition-transform ${bloccoOpen ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {bloccoOpen && (<div className="px-4 pb-4 space-y-3">
      {LOCK && LOCK.hash ? (
        <>
          <p className="text-piccolo text-gray-500 leading-snug">
            {L.t('blocco.spiegazione')}
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
                  <span className="text-piccolo uppercase font-bold text-gray-500">{L.t('blocco.database')}</span>
                  <span className={`text-piccolo font-bold ${protetto ? 'text-[#2D392C]' : ignoto ? 'text-gray-500' : 'text-[#D97706]'}`}>
                    {L.t(protetto ? 'blocco.statoProtetto' : ignoto ? 'blocco.statoIgnoto' : 'blocco.statoAperto')}
                  </span>
                </div>
                <p className="text-piccolo text-gray-500 leading-snug mt-1">
                  {L.t(protetto ? 'blocco.notaProtetto' : ignoto ? 'blocco.notaIgnoto' : 'blocco.notaAperto')}
                </p>
              </div>
            );
          })()}
          <label className="flex items-center gap-3 bg-[#F0F4F1]/60 p-3 rounded border border-[#8F9E8B]/20 cursor-pointer">
            <input type="checkbox" checked={askAlways} onChange={toggleAskAlways} className="w-4 h-4 accent-[#2D392C] shrink-0" />
            <span className="text-piccolo text-[#2D392C] leading-snug">
              {frase('blocco.ogniVolta')}
              <span className="block text-minuto text-gray-500">{L.t('blocco.senzaSpunta')}</span>
            </span>
          </label>
          {window.CloudSync && window.CloudSync.needsPassword && window.CloudSync.needsPassword() && (
            <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
              <p className="text-piccolo text-[#5C4A3C] leading-snug">
                {frase('blocco.ripiego')}
              </p>
            </div>
          )}
          <button onClick={lockNow} className={bottone('bruno', 'normale', 'w-full')}>
            {L.t('blocco.bloccaOra')}
          </button>
        </>
      ) : (
        <p className="text-piccolo text-gray-500">
          {L.t('blocco.nessunaPassword')}
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
        <span className="font-rustic text-grande text-[#2D392C] shrink-0">{L.t('dati.titolo')}</span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span className={`text-minuto uppercase font-bold px-2 py-1 rounded ${cloud.connected ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`}>
            {L.t(cloud.connected ? 'dati.connessa' : isOnline ? 'dati.nonConnessa' : 'dati.offline')}
          </span>
          <span className={`text-piccolo text-[#5C4A3C] transition-transform ${datiOpen ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {datiOpen && (<div className="px-4 pb-4 space-y-3">
      <div className="flex gap-2">
        <button onClick={exportData} className={bottone('primario', 'normale', 'flex-1')}>{L.t('dati.esportaBackup')}</button>
        <button onClick={() => goTo('spesa')} className={bottone('secondario', 'normale', 'flex-1')}>{L.t('dati.gestione')}</button>
      </div>
      <button onClick={wipeLocal} className={bottone('distruttivo', 'normale', 'w-full')}>
        {L.t('dati.cancellaLocale')}
      </button>
      <p className="text-minuto text-gray-400 italic leading-snug">
        {L.t('dati.notaCancella')}
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
        <span className="font-rustic text-grande text-[#2D392C] shrink-0">{L.t('tecnica.titolo')}</span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span className={`text-minuto uppercase font-bold px-2 py-1 rounded ${admin ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`}>
            {L.t(admin ? 'tecnica.attiva' : 'tecnica.spenta')}
          </span>
          <span className={`text-piccolo text-[#5C4A3C] transition-transform ${tecnicaOpen ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {tecnicaOpen && (<div className="px-4 pb-4 space-y-3">
        {admin ? (
          <>
            <p className="text-piccolo text-gray-500 leading-snug">
              {frase('tecnica.accesaNota')}
            </p>
            <button
              onClick={esciAdmin}
              className={bottone('secondario', 'normale', 'w-full')}
            >
              {L.t('tecnica.spegni')}
            </button>
          </>
        ) : (
          <>
            <p className="text-piccolo text-gray-500 leading-snug">
              {L.t('tecnica.spentaNota')}
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={adminPwd}
                onChange={(e) => { setAdminPwd(e.target.value); setAdminErr(''); }}
                onKeyDown={(e) => e.key === 'Enter' && entraAdmin()}
                placeholder={L.t('tecnica.password')}
                className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-normale"
              />
              <button
                onClick={entraAdmin}
                className={bottone('primario', 'normale', 'shrink-0')}
              >
                {L.t('tecnica.attivaTasto')}
              </button>
            </div>
            {adminErr && <p className="text-piccolo font-bold text-red-700">{adminErr}</p>}
          </>
        )}
      </div>)}
    </div>

    {/* Info */}
    <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md space-y-2">
      <h3 className="font-rustic text-grande border-b border-[#8F9E8B]/40 pb-1">{L.t('info.titolo')}</h3>
      <div className="flex justify-between text-piccolo">
        <span className="text-[#8F9E8B]">{L.t('info.versione')}</span>
        <span className="font-bold">{swVersion || '—'}</span>
      </div>
      <p className="text-piccolo text-[#F0F4F1]/70 leading-snug">
        {L.t('info.aggiornamento')}
      </p>
      <p className="text-minuto text-[#8F9E8B]/80 pt-1">{BRAND.credits}</p>
    </div>
  </div>
);
