// ---------- I miei campi ----------
// La home: i campi di questa persona, e le due strade per averne uno nuovo.
// Toccando un campo si apre l'app di sempre, con il menu intero; da dentro,
// «I miei campi» nel menu riporta qui.
//
// Due cose da sapere leggendo questo file.
//
// **Si apre senza linea.** L'elenco sta sul telefono (Stanza.ricordaCampo) e
// si corregge quando il cloud risponde: in montagna la home mostra i nomi di
// ieri, e aprire un campo non chiede niente alla rete.
//
// **Scegliere un campo cambia cassetto** (cassetti.js): i dati sul telefono
// sono quelli del campo aperto, e passare a un altro smonta e rimonta l'app.
// E' per questo che la home e' venuta DOPO i cassetti: prima, un elenco di
// campi a portata di dito avrebbe reso facilissimo mescolarli.

// Crea / Partecipa. Stava dentro Impostazioni; ne e' uscito quando e' nata la
// home, che deve mostrare lo STESSO modulo — due copie divergono alla prima
// correzione. Impostazioni e' identica al carattere a com'era (confronto del
// DOM).
const moduloStanza = ({ stanzaStato, account }) => (
  <>
    <p className="text-piccolo text-gray-500 leading-snug">{L.t('stanza.aCosaServe')}</p>

    {!stanzaStato.modo && (
      <div className="flex gap-2">
        <button onClick={() => stanzaStato.setModo('crea')} className={bottone('primario', 'normale', 'flex-1')}>{L.t('stanza.creaTitolo')}</button>
        <button onClick={() => stanzaStato.setModo('entra')} className={bottone('secondario', 'normale', 'flex-1')}>{L.t('stanza.entraTitolo')}</button>
      </div>
    )}

    {/* Un campo gratuito attivo alla volta: si dice PRIMA del modulo. */}
    {stanzaStato.modo === 'crea' && !stanzaStato.puoCreare && (
      <div data-pro-bloccata="piuCampi" className="rounded border border-fuoco/40 bg-fuoco/10 p-3 space-y-2">
        <p className="text-piccolo font-bold text-bosco flex items-center gap-2">{segnoPro()}{L.t('pro.piuCampi')}</p>
        <p className="text-minuto text-gray-600 leading-snug">{L.t('pro.unCampoGratis')}</p>
        <button onClick={stanzaStato.chiudi} className={bottone('testuale', 'normale', 'w-full')}>{L.t('galleria.annulla')}</button>
      </div>
    )}
    {stanzaStato.modo === 'crea' && stanzaStato.puoCreare && (
      <div className="space-y-2 pt-1">
        <input type="text" value={stanzaStato.nome} onChange={(e) => stanzaStato.setNome(e.target.value)}
          placeholder={L.t('stanza.nome')}
          className="w-full p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco" />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={stanzaStato.inizio} onChange={(e) => stanzaStato.setInizio(e.target.value)}
            aria-label={L.t('stanza.inizio')}
            className="w-full p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco" />
          <input type="date" value={stanzaStato.fine} onChange={(e) => stanzaStato.setFine(e.target.value)}
            aria-label={L.t('stanza.fine')}
            className="w-full p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco" />
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
          className="w-full p-2.5 bg-carta/50 border border-salvia/30 rounded text-medio font-mono tracking-widest uppercase focus:outline-none focus:border-bosco" />
        <div className="flex gap-2">
          <button onClick={stanzaStato.chiudi} className={bottone('testuale', 'normale', 'flex-1')}>{L.t('galleria.annulla')}</button>
          <button onClick={() => stanzaStato.entra(account.utente)} disabled={stanzaStato.occupato} className={bottone('primario', 'normale', 'flex-1')}>{L.t('stanza.entra')}</button>
        </div>
      </div>
    )}
  </>
);

// `codiceInGioco`: il campo aperto adesso, per segnarlo. `onApri`: cosa fare
// toccando un campo (App lo apre e torna al Calendario).
const schedaCampi = ({ stanzaStato, account, codiceInGioco, onApri }) => {
  const oggi = toDateStr(new Date());
  const elenco = window.Stanza.ordinaCampi(stanzaStato.campi, oggi);
  const qui = window.Stanza.normalizza(codiceInGioco);
  const registrato = account.stato === 'registrato' || account.stato === 'daVerificare';
  const date = (v) => (v.inizio
    ? L.t('campi.date', L.data(parseDate(v.inizio), 'numerica'), v.fine ? L.data(parseDate(v.fine), 'numerica') : '')
    : '');
  return (
    <div data-scheda="campi" className="space-y-4">
      <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
        <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('area.campi')}</h3>
        {elenco.length === 0 ? (
          <p className="text-piccolo text-gray-500 leading-snug">{L.t('campi.vuoto')}</p>
        ) : (
          <ul className="rounded border border-salvia/30 divide-y divide-salvia/20 overflow-hidden">
            {elenco.map((v) => (
              <li key={v.codice}>
                <button data-campo={v.codice} onClick={() => onApri(v.codice)} className={bottoneRiga('bg-carta/40')}>
                  <span className="min-w-0">
                    <span className="block font-bold text-bosco truncate">{v.nome || Stanza.bello(v.codice)}</span>
                    <span className="block text-minuto text-gray-500 truncate">
                      {[date(v), L.t(v.ruolo === 'proprietario' ? 'campi.organizzi' : v.aiutante ? 'campi.aiutante' : 'campi.partecipi')].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {window.Stanza.campoPro(v, oggi) && (
                    <span data-pro className="shrink-0 text-minuto uppercase font-bold px-2 py-1 rounded bg-fuoco text-white">{L.t('campi.pro')}</span>
                  )}
                  {v.codice === qui && (
                    <span className="shrink-0 text-minuto uppercase font-bold px-2 py-1 rounded bg-bosco text-carta">{L.t('campi.seiQui')}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-minuto text-gray-400 leading-snug">{L.t(registrato ? 'campi.notaProfilo' : 'campi.notaTelefono')}</p>
        {stanzaStato.fatto === 'stanza.campoLasciato' && <p className="text-piccolo text-bosco leading-snug">{L.t('stanza.campoLasciato')}</p>}
      </div>

      <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
        <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('campi.nuovo')}</h3>
        {moduloStanza({ stanzaStato, account })}
        {stanzaStato.problema && <p className="text-piccolo font-bold text-red-700 leading-snug">{L.t(stanzaStato.problema)}</p>}
      </div>
    </div>
  );
};
