// ---------- La Panoramica ----------
// Tutti i propri campi in un colpo d'occhio: quanto si e' speso, quanto costa
// a testa, i rimborsi ancora da fare e i conti che non tornano. Per chi tiene
// d'occhio piu' campi insieme — l'organizzatore, di solito secondo capogruppo
// accanto al capo sul posto. Si apre con l'abbonamento Pro annuale, che e'
// della persona (panoramica.js). I numeri vengono dagli stessi conti del
// campo: aprendo un campo si ritrovano identici.
//
// Serve la linea: legge i campi dal cloud, uno per uno. Senza, lo dice.
// Come le altre schede disegna e non tiene stato: quello sta in usaStanza.
const schedaPanoramica = ({ account, goTo, onApri, stanzaStato }) => {
  const p = stanzaStato.panoramica;
  const scatola = 'bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3';
  const intestazione = (
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-rustic text-grande text-bosco flex items-center gap-2">{segnoPro()}{L.t('panoramica.titolo')}</h3>
      {p.abbonato && (
        <button data-aggiorna onClick={() => stanzaStato.caricaPanoramica(account.utente)} disabled={p.stato === 'caricando'} className={bottone('secondario', 'minuscolo', 'shrink-0')}>
          {L.t('panoramica.aggiorna')}
        </button>
      )}
    </div>
  );

  // Senza un account vero non c'e' un abbonamento da cercare.
  if (account.stato !== 'registrato') {
    return (
      <div data-scheda="panoramica" className="space-y-4">
        <div className={scatola}>
          {intestazione}
          <p className="text-piccolo text-gray-600 leading-snug">{L.t('panoramica.serveAccount')}</p>
          <button onClick={() => goTo('impostazioni')} className={bottone('primario', 'normale', 'w-full')}>{L.t('area.impostazioni')}</button>
        </div>
      </div>
    );
  }

  if (p.stato === 'ferma' || (p.stato === 'caricando' && p.abbonato === null)) {
    return (
      <div data-scheda="panoramica" className="space-y-4">
        <div className={scatola}>{intestazione}<p className="text-piccolo text-gray-500">{L.t('panoramica.leggo')}</p></div>
      </div>
    );
  }

  if (p.stato === 'senzaLinea') {
    return (
      <div data-scheda="panoramica" className="space-y-4">
        <div className={scatola}>
          {intestazione}
          <p data-panoramica-senza-linea className="text-piccolo text-legno leading-snug">{L.t('panoramica.senzaLinea')}</p>
          <button onClick={() => stanzaStato.caricaPanoramica(account.utente)} className={bottone('secondario', 'normale', 'w-full')}>{L.t('panoramica.riprova')}</button>
        </div>
      </div>
    );
  }

  // Senza abbonamento: cosa sarebbe, e dove si prende. L'abbonamento si
  // compra dal riquadro del Pro di un proprio campo (e' lo stesso pro_anno
  // che rende Pro tutti i campi di cui si e' capogruppo).
  if (!p.abbonato) {
    return (
      <div data-scheda="panoramica" className="space-y-4">
        <div data-pro-bloccata="panoramica" className="rounded-lg border-2 border-fuoco/40 bg-fuoco/10 p-4 space-y-2">
          {intestazione}
          <p className="text-piccolo text-bosco leading-snug">{L.t('panoramica.cosE')}</p>
          <p className="text-minuto text-gray-600 leading-snug">{L.t('panoramica.soloAnno')}</p>
          {stanzaStato.stanza && stanzaStato.primoCapo && (
            <button onClick={() => goTo('campo', 'pro')} className={bottone('avviso', 'minuscolo', 'w-full')}>{L.t('pro.scopri')}</button>
          )}
        </div>
      </div>
    );
  }

  const tot = window.Panoramica.totali(p.righe);
  const date = (v) => (v.inizio && v.fine ? L.t('campo.dal', L.data(parseDate(v.inizio), 'breve'), L.data(parseDate(v.fine), 'breve')) : L.t('campo.senzaDate'));
  const ruolo = (v) => L.t(v.ruolo === 'proprietario' ? 'campi.organizzi' : v.aiutante ? 'campi.aiutante' : 'campi.partecipi');
  const cifra = (etichetta, valore, attr) => (
    <div {...(attr || {})}>
      <div className="text-minuto uppercase tracking-wide text-gray-500">{etichetta}</div>
      <div className="text-normale font-bold text-bosco">{valore}</div>
    </div>
  );
  return (
    <div data-scheda="panoramica" className="space-y-4">
      <div className={scatola}>
        {intestazione}
        <p className="text-piccolo text-gray-500 leading-snug">{L.t('panoramica.sottotitolo')}</p>
        <div data-totali className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-carta/60 rounded p-3">
          {cifra(L.t('panoramica.campi'), tot.campi)}
          {cifra(L.t('panoramica.speso'), `${money(tot.speso)} €`)}
          {cifra(L.t('panoramica.rimborsi'), tot.rimborsiAperti)}
          {cifra(L.t('panoramica.buchi'), tot.buchi)}
        </div>
        {p.stato === 'caricando' && <p className="text-minuto text-gray-500">{L.t('panoramica.leggo')}</p>}
      </div>

      {p.righe.length === 0 && <p className="text-piccolo text-gray-500 px-1">{L.t('panoramica.nessunCampo')}</p>}

      {/* Un campo per scheda; su uno schermo largo due per riga. */}
      <div className="grid gap-4 md:grid-cols-2">
        {p.righe.map(({ voce: v, riassunto: r, errore }) => (
          <div key={v.codice} data-panoramica-campo={v.codice} className={`bg-scheda rounded-lg border-2 shadow-sm p-4 space-y-3 ${r && r.buchi ? 'border-fuoco/50' : 'border-bosco/20'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-rustic text-medio text-bosco truncate">{v.nome || Stanza.bello(v.codice)}</div>
                <div className="text-minuto text-gray-500">{date(v)} · {ruolo(v)}</div>
              </div>
              <button data-apri={v.codice} onClick={() => onApri(v.codice)} className={bottone('secondario', 'minuscolo', 'shrink-0')}>{L.t('panoramica.apri')}</button>
            </div>
            {errore ? (
              <p className="text-piccolo text-legno leading-snug">{L.t(errore)}</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {cifra(L.t('panoramica.persone'), r.bambini ? L.t('panoramica.adultiBambini', r.adulti, r.bambini) : r.adulti)}
                  {cifra(L.t('panoramica.speso'), `${money(r.speso)} €`, { 'data-speso': r.speso })}
                  {cifra(L.t('panoramica.aTesta'), r.aTesta === null ? '—' : `${money(r.aTesta)} €`)}
                </div>
                <p className={`text-piccolo leading-snug ${r.rimborsiAperti ? 'text-legno' : 'text-bosco'}`}>
                  {r.rimborsiAperti ? L.t('panoramica.daRimborsare', r.rimborsiAperti, money(r.daMuovere)) : L.t('panoramica.tuttoPari')}
                </p>
                {r.buchi > 0 && <p data-buchi className="text-piccolo font-bold text-legno leading-snug">{L.t('panoramica.conBuchi')}</p>}
                {r.fuoriConto > 0 && <p className="text-minuto text-gray-500">{L.t('panoramica.fuoriConto', money(r.fuoriConto))}</p>}
                <p className="text-minuto text-gray-400">
                  {r.ultimaSpesa ? L.t('panoramica.ultimaSpesa', L.data(new Date(r.ultimaSpesa), 'breve')) : L.t('panoramica.nessunaSpesa')}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
