// ---------- La cassa del campo (4 ottobre) ----------
// Le entrate accanto alle uscite: le quote previste e versate, gli altri
// soldi entrati, quanto si e' speso, quanto avanza, e il rendiconto per il
// tesoriere. Le regole stanno in cassa.js; qui si disegna e basta.
//
// Gli incassi li segna il capogruppo (chi tiene la cassa); gli altri leggono.
// Come per la scheda delle persone, e' una cortesia dell'interfaccia: la
// serratura dei dati del campo e' quella di sempre.
const schedaCassa = ({
  addIncasso,
  applicaQuotaATutti,
  cassa,
  incassaQuota,
  members,
  modificabile,
  nuovoIncasso,
  quotaPerTutti,
  removeIncasso,
  scaricaRendiconto,
  setMemberField,
  setNuovoIncasso,
  setQuotaPerTutti,
}) => {
  const r = cassa;
  const nome = (id) => ((members.find((m) => m.id === id) || {}).name) || L.t('cassa.exMembro');
  const casella = 'w-full p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco';
  const etichetta = 'block text-minuto uppercase font-bold tracking-wide text-gray-500 mb-1';
  const riga = (chiave, valore, tono, dati) => (
    <div {...dati} className="flex justify-between items-center bg-carta/60 px-3 py-2 rounded border border-salvia/20">
      <span className="text-piccolo uppercase font-bold text-gray-500">{L.t(chiave)}</span>
      <span className={`font-bold ${tono || 'text-bosco'}`}>{money(valore)} €</span>
    </div>
  );
  return (
    <div data-scheda="cassa" className="space-y-4">
      {/* Il riepilogo: i quattro numeri del cassiere. */}
      <div data-cassa-riepilogo className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-2">
        <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('cassa.titolo')}</h3>
        <p className="text-piccolo text-gray-500 leading-snug">{L.t('cassa.spiega')}</p>
        {riga('cassa.entrate', r.entrate, 'text-bosco', { 'data-entrate': r.entrate })}
        {riga('cassa.uscite', r.uscite, 'text-legno', { 'data-uscite': r.uscite })}
        {r.fuori > 0.005 && <p className="text-minuto text-gray-500 leading-snug -mt-1 px-1">{L.t('cassa.diCuiFuori', money(r.fuori))}</p>}
        <div data-saldo={r.saldo} className={`p-3 rounded border flex justify-between items-center ${r.saldo < -0.005 ? 'bg-fuoco/10 border-fuoco/40' : 'bg-bosco/10 border-bosco/20'}`}>
          <span className="font-bold text-piccolo uppercase">{L.t(r.saldo < -0.005 ? 'cassa.mancano' : 'cassa.avanzo')}</span>
          <span className={`font-rustic font-bold text-grande ${r.saldo < -0.005 ? 'text-fuoco' : 'text-bosco'}`}>{money(Math.abs(r.saldo))} €</span>
        </div>
        {r.daIncassare > 0.005 && (
          <p data-da-incassare className="text-piccolo text-legno leading-snug">
            {frase('cassa.daIncassare', money(r.daIncassare), money(Math.abs(r.saldoAtteso)), r.saldoAtteso < -0.005)}
          </p>
        )}
      </div>

      {/* Le quote: una per persona. Chi non ne ha una non deve niente alla
          cassa — vale per i capi, che spesso non pagano. */}
      <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
        <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('cassa.quoteTitolo')}</h3>
        {modificabile && members.length > 0 && (
          <div className="flex gap-2 items-end">
            <label className="flex-grow">
              <span className={etichetta}>{L.t('cassa.quotaUguale')}</span>
              <input type="number" min="0" step="0.01" inputMode="decimal" data-cifra-tutti value={quotaPerTutti} onChange={(e) => setQuotaPerTutti(e.target.value)} placeholder={money(0)} className={casella} />
            </label>
            <button onClick={applicaQuotaATutti} className={bottone('secondario', 'normale', 'shrink-0')}>{L.t('cassa.applica')}</button>
          </div>
        )}
        {members.length === 0 ? (
          <p className="text-normale text-gray-400 italic">{L.t('cassa.senzaMembri')}</p>
        ) : (
          <ul className="divide-y divide-salvia/25">
            {r.persone.map((p) => {
              const m = members.find((x) => x.id === p.id) || {};
              return (
                <li key={p.id} data-persona-cassa={p.name} className="py-1.5">
                  {/* Nome e stato su una riga intera: con la casella e il tasto
                      accanto, a 360 px il nome si tagliava e lo stato andava a
                      capo cinque volte. I comandi stanno sotto. */}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-normale text-bosco min-w-0 break-words">{p.name}</span>
                    {p.previsto > 0 && p.manca <= 0.005 && <span className="text-minuto font-bold uppercase text-bosco shrink-0" data-pagata>{L.t('cassa.pagata')}</span>}
                  </div>
                  <span className="text-minuto text-gray-500 block leading-snug">
                    {p.previsto > 0
                      ? L.t('cassa.statoQuota', money(p.versato), money(p.previsto), p.manca > 0.005 ? money(p.manca) : null)
                      : (p.versato > 0 ? L.t('cassa.versatoSenzaQuota', money(p.versato)) : L.t('cassa.senzaQuota'))}
                  </span>
                  {modificabile && (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number" min="0" step="0.01" inputMode="decimal" data-cifra-persona
                        aria-label={L.t('cassa.quotaDi', p.name)}
                        value={m.quota == null ? '' : m.quota}
                        onChange={(e) => setMemberField(p.id, 'quota', e.target.value === '' ? undefined : e.target.value)}
                        placeholder={L.t('cassa.quota')}
                        className="w-24 shrink-0 px-2 py-1.5 min-h-11 bg-carta/50 border border-salvia/30 rounded text-piccolo text-right focus:outline-none focus:border-bosco"
                      />
                      {p.manca > 0.005 && (
                        <button data-incassa={p.name} onClick={() => incassaQuota(p)} className={bottone('primario', 'minuscolo', 'flex-grow')}>
                          {L.t('cassa.incassa', money(p.manca))}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Un incasso qualsiasi: una quota, un contributo del gruppo, uno
          sponsor, il resto di un altro campo. */}
      {modificabile && (
        <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
          <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('cassa.registraTitolo')}</h3>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className={etichetta}>{L.t('cassa.daChi')}</span>
              <select data-incasso-chi value={nuovoIncasso.chi} onChange={(e) => setNuovoIncasso((x) => ({ ...x, chi: e.target.value }))} className={casella}>
                <option value="">{L.t('cassa.altro')}</option>
                {members.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
              </select>
            </label>
            <label>
              <span className={etichetta}>{L.t('cassa.quanto')}</span>
              <input type="number" min="0" step="0.01" inputMode="decimal" data-incasso-quanto value={nuovoIncasso.quanto} onChange={(e) => setNuovoIncasso((x) => ({ ...x, quanto: e.target.value }))} placeholder={money(0)} className={casella} />
            </label>
          </div>
          {!nuovoIncasso.chi && (
            <label className="block">
              <span className={etichetta}>{L.t('cassa.chiAltro')}</span>
              <input type="text" data-incasso-da value={nuovoIncasso.da} onChange={(e) => setNuovoIncasso((x) => ({ ...x, da: e.target.value }))} placeholder={L.t('cassa.chiAltroSegno')} className={casella} />
            </label>
          )}
          <label className="block">
            <span className={etichetta}>{L.t('cassa.nota')}</span>
            <input type="text" data-incasso-nota value={nuovoIncasso.nota} onChange={(e) => setNuovoIncasso((x) => ({ ...x, nota: e.target.value }))} placeholder={L.t('cassa.notaSegno')} className={casella} />
          </label>
          <button onClick={addIncasso} className={bottone('primario', 'normale', 'w-full')}>{L.t('cassa.registra')}</button>
        </div>
      )}

      {/* Gli incassi, dal piu' recente. */}
      <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm">
        <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco mb-2">{L.t('cassa.incassiTitolo', r.incassi.length)}</h3>
        {r.incassi.length === 0 ? (
          <p className="text-normale text-gray-400 italic">{L.t('cassa.nessunIncasso')}</p>
        ) : (
          <ul className="divide-y divide-salvia/25">
            {r.incassi.map((x) => (
              <li key={x.id} data-incasso={x.id} className="py-1.5 flex items-center gap-2 min-h-11">
                <div className="flex-grow min-w-0 leading-tight">
                  <span className="font-bold text-normale text-bosco truncate block">{x.chi ? nome(x.chi) : (x.da || L.t('cassa.altro'))}</span>
                  <span className="text-minuto text-gray-500 truncate block">
                    {[x.nota, x.at ? L.data(new Date(x.at), 'breve') : ''].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="font-rustic font-bold text-bosco shrink-0">{money(Number(x.quanto) || 0)} €</span>
                {modificabile && (
                  <button onClick={() => removeIncasso(x.id)} aria-label={L.t('cassa.togli')} className={bottoneSottile('distruttivo')}>
                    {icona('togli', 'w-4 h-4')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Il rendiconto: lo scarica chiunque, e' di sola lettura. */}
      <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-2">
        <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('cassa.rendicontoTitolo')}</h3>
        <p className="text-piccolo text-gray-500 leading-snug">{L.t('cassa.rendicontoSpiega')}</p>
        <button data-rendiconto onClick={scaricaRendiconto} className={bottone('secondario', 'normale', 'w-full')}>{L.t('cassa.scarica')}</button>
      </div>
    </div>
  );
};
