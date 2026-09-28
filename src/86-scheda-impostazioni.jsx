// ---------- Scheda Impostazioni ----------
// La piu' grande di tutte, e la piu' intrecciata: aspetto, blocco, backup,
// modalita' tecnica, chiusura del campo. Sta da sola apposta.

// Il nome di ogni voce di spesa, come CHIAVE: le chiavi scritte per intero le
// controlla la guardia del dizionario, quelle composte a pezzi no.
const NOME_VOCE = {
  alimentare: 'voci.nome.alimentare',
  bevande: 'voci.nome.bevande',
  logistica: 'voci.nome.logistica',
  attrezzatura: 'voci.nome.attrezzatura',
};

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
  contiBloccati,
}) => (
  <div className="space-y-4">
    {/* Pronto per il campo.
        Senza un campo in corso i controlli non hanno oggetto: due dei tre
        parlano dei dati, e i dati sono quelli del campo. Dopo la chiusura
        resterebbero rossi per sempre — su un telefono che sta benissimo. */}
    <div className={`p-4 rounded-lg border-2 shadow-sm space-y-3 ${!campoInCorso || readyOk ? 'bg-scheda border-bosco/20' : 'bg-scheda border-fuoco/50'}`}>
      <div className="flex items-center justify-between border-b border-salvia/40 pb-2">
        <h3 className="font-rustic text-grande text-bosco">{L.t('pronto.titolo')}</h3>
        <span className={`text-minuto uppercase font-bold px-2 py-1 rounded ${campoInCorso && !readyOk ? 'bg-fuoco text-white' : 'bg-bosco text-white'}`}>
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
              <li key={c.titolo} className={`flex items-start gap-2 p-2.5 rounded border ${c.ok ? 'bg-carta/60 border-salvia/20' : 'bg-fuoco/10 border-fuoco/40'}`}>
                <span className="text-medio leading-none shrink-0">{c.ok ? '✅' : '⚠️'}</span>
                <div className="min-w-0">
                  <div className="text-piccolo font-bold text-bosco">{c.titolo}</div>
                  {!c.ok && <div className="text-piccolo text-legno leading-snug mt-0.5">{c.no}</div>}
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
    {FEATURES.auth && schedaAccount({
      account,
      // Cancellato l'account, si esce anche dalla stanza su questo telefono:
      // la scheda li' dentro non c'e' piu', e la sincronizzazione andrebbe a
      // sbattere contro un "permesso negato" a ogni apertura.
      onCancella: async () => {
        const fatto = await account.cancellaAccount(stanzaStato.stanza && stanzaStato.stanza.codice);
        if (fatto) stanzaStato.esci();
      },
    })}

    {/* La stanza (ROADMAP.md § 2 e § 9). Dietro FEATURES.rooms.

        Come l'account, sta in fondo a Impostazioni e non davanti all'app:
        chi usa il campo che ha gia' non incontra niente di tutto questo.
        Le regole del codice stanno in stanza.js, quelle di CHI puo' entrare
        in firestore.rules — qui si disegna e basta. */}
    {FEATURES.rooms && (
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('stanza.titolo')}</h3>

      {/* Un invito arrivato da un link. Si mostra e si CHIEDE: entrare di
          nascosto perche' qualcuno ha inoltrato un messaggio e' il genere di
          cosa che fa disinstallare un'app. */}
      {stanzaStato.invito && (
        <div className="bg-carta/70 border border-bosco/20 rounded p-3 space-y-2">
          <p className="text-piccolo text-bosco leading-snug">{frase('stanza.invitoCodice', Stanza.bello(stanzaStato.invito))}</p>
          <div className="flex gap-2">
            <button onClick={stanzaStato.rifiutaInvito} className={bottone('testuale', 'normale', 'flex-1')}>{L.t('stanza.rifiutaInvito')}</button>
            <button onClick={() => stanzaStato.accettaInvito(account.utente)} disabled={stanzaStato.occupato} className={bottone('primario', 'normale', 'flex-1')}>{L.t('stanza.accettaInvito')}</button>
          </div>
        </div>
      )}

      {stanzaStato.stanza ? (
        <>
          <p className="text-piccolo text-bosco leading-snug">{frase('stanza.entrato', stanzaStato.stanza.nome || Stanza.bello(stanzaStato.stanza.codice))}</p>

          {/* Tieni il tuo posto: per chi e' entrato col solo codice. Non e' un
              muro — si usa il campo anche senza — ma e' l'unica cosa che
              impedisce, cambiando telefono, di rientrare come una persona
              nuova e perdere il ruolo. Da anonimo il collegamento tiene lo
              stesso uid (Auth.promuovibile); se l'account Google era gia'
              usato altrove si diventa quello (Auth.passaAllAccountEsistente)
              e si rientra col codice salvato. Il posto si rilegge comunque:
              una lettura in piu', e la conferma a schermo e' vera in tutti e
              due i casi. */}
          {FEATURES.auth && (account.stato === 'ospite' || account.stato === 'anonimo') && (
            <div data-riquadro="tieni-il-posto" className="rounded border border-bosco/25 bg-orlo/40 p-3 space-y-2">
              <p className="text-piccolo text-bosco leading-snug">{frase('stanza.tieniIlPosto')}</p>
              <button
                onClick={async () => {
                  const u = await account.entraConGoogle();
                  // Serve un utente VERO: un semplice "riuscito" non basta a
                  // sapere con quale uid rientrare.
                  if (u && u.uid && !u.isAnonimo) await stanzaStato.riagganciaStanza(u);
                }}
                disabled={account.occupato || stanzaStato.occupato}
                className={bottone('primario', 'normale', 'w-full')}
              >{L.t('stanza.collegaGoogle')}</button>
            </div>
          )}
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
              onClick={() => {
                const link = stanzaStato.linkDaMandare();
                const testo = L.t('stanza.invitoTesto', stanzaStato.stanza.nome || Stanza.bello(stanzaStato.stanza.codice), link);
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
            <p className="text-piccolo text-gray-500">{L.t('stanza.dentro', stanzaStato.membri.length)}</p>
          )}
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
                <p className="text-piccolo font-bold text-bosco">{L.t('stanza.aiutanteTitolo')}</p>
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
          {/* Le voci che si dividono (§ 8). Le sceglie il capogruppo per tutto
              il campo: le quote devono essere le stesse su ogni telefono.
              Spegnerne una a rimborsi gia' fatti riscrive le quote di tutti,
              quindi a conti chiusi non si muove, e prima di cambiare chiede. */}
          {stanzaStato.capogruppo && window.Voci && (
            <div data-riquadro="voci" className="rounded border border-bosco/25 bg-orlo/40 p-3 space-y-2">
              <p className="text-piccolo font-bold text-bosco">{L.t('voci.titolo')}</p>
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
          {stanzaStato.aiutante && (
            <p className="text-piccolo text-bosco leading-snug">{L.t('stanza.seiAiutante')}</p>
          )}
          <button onClick={() => { stanzaStato.esci(); goTo('campi'); }} disabled={stanzaStato.occupato} className={bottone('testuale', 'minuscolo', 'w-full')}>{L.t('stanza.esci')}</button>
        </>
      ) : moduloStanza({ stanzaStato, account })}

      {stanzaStato.problema && <p className="text-piccolo font-bold text-red-700 leading-snug">{L.t(stanzaStato.problema)}</p>}
      {stanzaStato.fatto === 'stanza.creata' && stanzaStato.stanza && (
        <p className="text-piccolo text-bosco leading-snug">{frase('stanza.creata', Stanza.bello(stanzaStato.stanza.codice))}</p>
      )}
      {/* Uno per uno, non un {L.t(stanzaStato.fatto)} generico: alcune chiavi
          vogliono un argomento (stanza.entrato vuole il nome del campo) e
          senza stamperebbero "undefined" in mezzo alla frase. */}
      {stanzaStato.fatto === 'stanza.postoTenuto' && (
        <p className="text-piccolo text-bosco leading-snug">{L.t('stanza.postoTenuto')}</p>
      )}
    </div>
    )}

    {/* Lingua. Dietro FEATURES.lingue: finche' i dizionari non coprono tutta
        l'app, offrire la scelta vorrebbe dire mostrare meta' schermata in una
        lingua e meta' nell'altra. */}
    {FEATURES.lingue && (
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('lingua.titolo')}</h3>
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
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('aspetto.titolo')}</h3>
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
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('area.galleria')}</h3>
      <div className="flex items-center justify-between gap-3">
        <span className="text-normale text-bosco">{L.t('impostazioni.fotoPerPersona')}</span>
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
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('diag.titolo')}</h3>
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
              <span>{fraseVestita('font-bold text-bosco', 'diag.vociDatate', Object.keys(m.rev || {}).length)}</span>
              <span>{fraseVestita('font-bold text-bosco', 'diag.cancellazioni', lapidi.length)}</span>
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
                  {fraseVestita('font-bold text-bosco', 'diag.scontrini', quante, quante > 0 ? kb : null, fotoDove === 'magazzino')}
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
              <div className="bg-fuoco/10 border border-fuoco/40 rounded p-2.5">
                <p className="text-piccolo text-legno leading-snug">
                  {frase('diag.senzaStoria')}
                </p>
              </div>
            )}

            {/* Cosa non è ancora arrivato agli altri, e come forzarlo. */}
            {(cloud.pending || (cloud.foto || 0) > 0) && (
              <div className="bg-fuoco/10 border border-fuoco/40 rounded p-2.5">
                <p className="text-piccolo text-legno leading-snug">
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
              <div className="bg-fuoco/10 border border-fuoco/40 rounded p-2.5 space-y-2">
                <p className="text-piccolo text-legno leading-snug">
                  {frase('diag.reteDiSicurezza',
                    L.data(new Date(scorta.at), 'dataOra'),
                    scorta.perse,
                    scorta.quando ? L.data(new Date(scorta.quando), 'dataOra') : null,
                    scorta.quando ? Date.now() - scorta.quando > PERDITA_RECENTE : false)}
                </p>
                <p className="text-piccolo text-legno leading-snug">
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
                    <li key={l.p} className="flex items-start justify-between gap-2 text-piccolo bg-carta/60 px-2 py-1.5 rounded border border-salvia/20">
                      <span className="text-bosco leading-snug">{descriviPath(l.p, st)}</span>
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
    <div className="bg-scheda rounded-lg border-2 border-bosco/20 shadow-sm overflow-hidden">
      <button
        onClick={() => setLogOpen((v) => !v)}
        className={bottoneRiga()}
      >
        <span className="font-rustic text-grande text-bosco shrink-0">{L.t('registro.titolo')}</span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-minuto uppercase font-bold px-2 py-1 rounded bg-gray-200 text-gray-500">
            {(() => { void diagTick; const n = logLeggi().length; return n === 0 ? L.t('registro.vuoto') : L.t('registro.quanteVoci', n); })()}
          </span>
          <span className={`text-piccolo text-legno transition-transform ${logOpen ? 'rotate-180' : ''}`}>▾</span>
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
                        <li key={r.p + r.at + i} className="flex items-start gap-2 text-piccolo bg-carta/60 px-2 py-1.5 rounded border border-salvia/20">
                          <span className="text-gray-500 shrink-0 w-10">
                            {L.data(new Date(r.at), 'ora')}
                          </span>
                          <span className={`shrink-0 w-3 text-center ${r.k === 'd' ? 'text-red-700' : 'text-bosco'}`} title={L.t(r.k === 'd' ? 'registro.cancellata' : 'registro.modificata')}>
                            {r.k === 'd' ? '−' : '+'}
                          </span>
                          <span className="min-w-0 flex-grow leading-snug">
                            <span className="font-bold text-legno">{sezioneDiPath(r.p)}</span>
                            <span className="text-bosco"> · {descriviPath(r.p, st)}</span>
                          </span>
                          <span className={`shrink-0 text-minuto uppercase font-bold px-1.5 py-0.5 rounded ${r.o === 'io' ? 'bg-bosco/10 text-bosco' : 'bg-legno/10 text-legno'}`}>
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
    <div className="bg-scheda rounded-lg border-2 border-bosco/20 shadow-sm overflow-hidden">
      <button
        onClick={() => setBloccoOpen((v) => !v)}
        className={bottoneRiga()}
      >
        <span className="font-rustic text-grande text-bosco shrink-0">{L.t('blocco.titoloScheda')}</span>
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
          <span className={`text-minuto uppercase font-bold px-2 py-1 rounded ${LOCK && LOCK.hash ? 'bg-bosco text-white' : 'bg-gray-200 text-gray-500'}`}>
            {L.t(LOCK && LOCK.hash ? 'blocco.attivo' : 'blocco.nonAttivo')}
          </span>
          <span className={`text-piccolo text-legno transition-transform ${bloccoOpen ? 'rotate-180' : ''}`}>▾</span>
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
              <div className={`p-3 rounded border ${protetto ? 'bg-bosco/5 border-bosco/25' : ignoto ? 'bg-carta/60 border-salvia/30' : 'bg-fuoco/10 border-fuoco/40'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-piccolo uppercase font-bold text-gray-500">{L.t('blocco.database')}</span>
                  <span className={`text-piccolo font-bold ${protetto ? 'text-bosco' : ignoto ? 'text-gray-500' : 'text-fuoco'}`}>
                    {L.t(protetto ? 'blocco.statoProtetto' : ignoto ? 'blocco.statoIgnoto' : 'blocco.statoAperto')}
                  </span>
                </div>
                <p className="text-piccolo text-gray-500 leading-snug mt-1">
                  {L.t(protetto ? 'blocco.notaProtetto' : ignoto ? 'blocco.notaIgnoto' : 'blocco.notaAperto')}
                </p>
              </div>
            );
          })()}
          <label className="flex items-center gap-3 bg-carta/60 p-3 rounded border border-salvia/20 cursor-pointer">
            <input type="checkbox" checked={askAlways} onChange={toggleAskAlways} className="w-4 h-4 accent-bosco shrink-0" />
            <span className="text-piccolo text-bosco leading-snug">
              {frase('blocco.ogniVolta')}
              <span className="block text-minuto text-gray-500">{L.t('blocco.senzaSpunta')}</span>
            </span>
          </label>
          {window.CloudSync && window.CloudSync.needsPassword && window.CloudSync.needsPassword() && (
            <div className="bg-fuoco/10 border border-fuoco/40 rounded p-2.5">
              <p className="text-piccolo text-legno leading-snug">
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
    <div className="bg-scheda rounded-lg border-2 border-bosco/20 shadow-sm overflow-hidden">
      <button
        onClick={() => setDatiOpen((v) => !v)}
        className={bottoneRiga()}
      >
        <span className="font-rustic text-grande text-bosco shrink-0">{L.t('dati.titolo')}</span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span className={`text-minuto uppercase font-bold px-2 py-1 rounded ${cloud.connected ? 'bg-bosco text-white' : 'bg-gray-200 text-gray-500'}`}>
            {L.t(cloud.connected ? 'dati.connessa' : isOnline ? 'dati.nonConnessa' : 'dati.offline')}
          </span>
          <span className={`text-piccolo text-legno transition-transform ${datiOpen ? 'rotate-180' : ''}`}>▾</span>
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
    <div className="bg-scheda rounded-lg border-2 border-bosco/20 shadow-sm overflow-hidden">
      <button
        onClick={() => setTecnicaOpen((v) => !v)}
        className={bottoneRiga()}
      >
        <span className="font-rustic text-grande text-bosco shrink-0">{L.t('tecnica.titolo')}</span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span className={`text-minuto uppercase font-bold px-2 py-1 rounded ${admin ? 'bg-bosco text-white' : 'bg-gray-200 text-gray-500'}`}>
            {L.t(admin ? 'tecnica.attiva' : 'tecnica.spenta')}
          </span>
          <span className={`text-piccolo text-legno transition-transform ${tecnicaOpen ? 'rotate-180' : ''}`}>▾</span>
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
            {/* Senza password non si mostra una casella che non serve: una
                casella vuota accanto a un tasto che entra comunque fa
                pensare di aver dimenticato qualcosa. Al suo posto si dice
                che la serratura non c'è, e cosa apre la porta. */}
            {window.APP_ADMIN && window.APP_ADMIN.aperta ? (
              <>
                <p className="text-piccolo font-bold text-[#8A5A2B] leading-snug">
                  {L.t('tecnica.apertaNota')}
                </p>
                <button
                  onClick={entraAdmin}
                  className={bottone('primario', 'normale', 'w-full')}
                >
                  {L.t('tecnica.attivaTasto')}
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  value={adminPwd}
                  onChange={(e) => { setAdminPwd(e.target.value); setAdminErr(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && entraAdmin()}
                  placeholder={L.t('tecnica.password')}
                  className="flex-grow min-w-0 p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale"
                />
                <button
                  onClick={entraAdmin}
                  className={bottone('primario', 'normale', 'shrink-0')}
                >
                  {L.t('tecnica.attivaTasto')}
                </button>
              </div>
            )}
            {adminErr && <p className="text-piccolo font-bold text-red-700">{adminErr}</p>}
          </>
        )}
      </div>)}
    </div>

    {/* Info */}
    <div className="bg-bosco text-carta p-4 rounded-lg border-b-4 border-legno shadow-md space-y-2">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-1">{L.t('info.titolo')}</h3>
      <div className="flex justify-between text-piccolo">
        <span className="text-salvia">{L.t('info.versione')}</span>
        <span className="font-bold">{swVersion || '—'}</span>
      </div>
      <p className="text-piccolo text-carta/70 leading-snug">
        {L.t('info.aggiornamento')}
      </p>
      {/* L'informativa: Google Play la vuole raggiungibile anche DENTRO
          l'app, non solo nella scheda dello store (ROADMAP § 3). */}
      <a href="./privacy.html" target="_blank" rel="noopener" className="block text-piccolo text-carta underline">{L.t('info.privacy')}</a>
      <p className="text-minuto text-salvia/80 pt-1">{BRAND.credits}</p>
    </div>
  </div>
);
