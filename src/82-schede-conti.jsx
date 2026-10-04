// ---------- Schede dei conti: Spese Totali, Lista della Spesa, Attrezzatura ----------
// Vedi 81-schede-giorno.jsx per il perche' sono funzioni e non componenti.

const schedaSpesa = ({
  admin,
  archives,
  bloccoConti,
  campCodeInput,
  cassaSepAttiva,
  cassaUnica,
  chiudiConti,
  cloud,
  connectCloud,
  disconnectCloud,
  exportData,
  goTo,
  importData,
  isOnline,
  openClose,
  openRestore,
  pastiDi,
  riapriConti,
  risparmio,
  saldiOttimizzati,
  rimborsi,
  schedaQuote,
  schedaSaldi,
  setCampCodeInput,
  setSaldiOttimizzati,
  setSpesaSection,
  shareReport,
  spesaSection,
  totals,
  fuoriConto,
}) => (
  <div className="space-y-4">
    {/* Sotto-sezioni della Spesa */}
    <div className="grid grid-cols-4 gap-1.5">
      {[['totali', L.t('spesa.totali')], ['quote', L.t('spesa.quote')], ['saldi', L.t('spesa.saldi')], ['dati', L.t('spesa.dati')]].map(([k, l]) => (
        <button
          key={k}
          onClick={() => setSpesaSection(k)}
          className={bottoneScelta('linguetta', 'sezione', spesaSection === k, 'minuscolo')}
        >
          {l}
        </button>
      ))}
    </div>

    {spesaSection === 'totali' && (<div className="space-y-4">
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-4">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('spesa.cassaGlobale')}</h3>
      <p className="text-piccolo text-gray-500 -mt-1">{frase('spesa.cassaNota')}</p>
      <div className="space-y-2">
        {[
          [L.t('spesa.cibo'), totals.totalFood],
          [L.t('spesa.bevande'), totals.totalDrinks],
          [L.t('spesa.logisticaEAttrezzatura'), totals.totalAccessory],
          ...(totals.fraAlcuni && totals.fraAlcuni.totale > 0 ? [[L.t('spesa.fraAlcuni'), totals.fraAlcuni.totale]] : []),
        ].map(([label, val]) => (
          <div key={label} className="flex justify-between items-center bg-carta/60 px-3 py-2 rounded border border-salvia/20">
            <span className="text-piccolo uppercase font-bold text-gray-500">{label}</span>
            <span className="font-bold text-bosco">{money(val)} €</span>
          </div>
        ))}
      </div>
      {totals.foodDrinksSep > 0 && (
        <div className="flex justify-between items-center bg-legno/10 px-3 py-2 rounded border border-legno/30">
          <span className="text-piccolo uppercase font-bold text-legno">{L.t('spesa.diCuiSeparato')}</span>
          <span className="font-bold text-legno">{money(totals.foodDrinksSep)} €</span>
        </div>
      )}
      <div className="bg-bosco/10 p-3 rounded border border-bosco/20 flex justify-between items-center mt-2">
        <span className="font-bold text-piccolo uppercase">{L.t('spesa.importoComplessivo')}</span>
        <span className="font-rustic font-bold text-grande text-bosco">{money(totals.overallTotal)} €</span>
      </div>
      {/* Il fuori conto: registrato, ma non si divide qui — lo gestisce il
          gruppo (§ 8). Si dichiara sempre: un euro tolto dal conto non si
          toglie dalla vista. */}
      {fuoriConto && fuoriConto.totale > 0.005 && (
        <div data-fuori-conto className="bg-carta/60 px-3 py-2 rounded border border-dashed border-legno/50 space-y-0.5">
          <div className="flex justify-between items-center">
            <span className="text-piccolo uppercase font-bold text-legno">{L.t('voci.fuoriConto')}</span>
            <span className="font-bold text-legno">{money(fuoriConto.totale)} €</span>
          </div>
          <p className="text-minuto text-gray-500 leading-snug">{L.t('voci.fuoriContoNota')}</p>
        </div>
      )}
    </div>

    <div className="bg-bosco text-carta p-4 rounded-lg border-b-4 border-legno shadow-md space-y-4">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-1">{L.t('spesa.contoDellaServa')}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-notte p-3 rounded border border-salvia/20">
          <span className="text-piccolo uppercase text-salvia block">{L.t('spesa.quotaPasto')}</span>
          <span className="font-rustic text-titolo text-fuoco">{money(totals.costPerMeal)} €</span>
          <p className="text-minuto text-gray-400 mt-1">
            {L.t('spesa.quotaPastoNota', money(totals.foodDrinksCommon), totals.adultMealsCommon, totals.sepDaysCount > 0)}
          </p>
        </div>
        {/* Logistica e attrezzatura si dividono allo STESSO modo — a
            testa, fra i presenti — quindi si mostrano insieme: due
            riquadri separati facevano sembrare l'attrezzatura una
            tassa a parte, quando e' una voce del costo del campo come
            le altre. I numeri non cambiano di un centesimo: la somma
            accessoryPerAdult era gia' calcolata. Il dettaglio resta
            nella riga piccola, che e' dove va cercato quando serve.
            Se l'esenzione per membro fosse attiva i due divisori
            potrebbero differire: in quel caso si torna a due riquadri,
            perche' un numero solo sarebbe una bugia. */}
        {!(FEATURES.equipExemption && totals.equipPayersCount !== totals.accessoryPayersCount) ? (
          <div className="bg-notte p-3 rounded border border-salvia/20">
            <span className="text-piccolo uppercase text-salvia block">{L.t('spesa.quotaPersona')}</span>
            <span className="font-rustic text-titolo text-fuoco">{money(totals.accessoryPerAdult)} €</span>
            <p className="text-minuto text-gray-400 mt-1">
              {L.t('spesa.quotaPersonaNota', money(totals.totalAccessory), totals.accessoryPayersCount)}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-notte p-3 rounded border border-salvia/20">
              <span className="text-piccolo uppercase text-salvia block">{L.t('spesa.logisticaTesta')}</span>
              <span className="font-rustic text-titolo text-fuoco">{money(totals.logisticsPerAdult)} €</span>
              <p className="text-minuto text-gray-400 mt-1">{L.t('spesa.logisticaTestaNota', money(totals.logisticsPurchases), totals.accessoryPayersCount)}</p>
            </div>
            <div className="bg-notte p-3 rounded border border-salvia/20">
              <span className="text-piccolo uppercase text-salvia block">{L.t('spesa.attrezzaturaTesta')}</span>
              <span className="font-rustic text-titolo text-fuoco">{money(totals.equipPerAdult)} €</span>
              <p className="text-minuto text-gray-400 mt-1">
                {L.t('spesa.attrezzaturaTestaNota', money(totals.equipBought), totals.equipPayersCount)}
              </p>
            </div>
          </>
        )}
        {(totals.sepDaysCount > 0 || totals.foodDrinksSep > 0) && (
          <div className="bg-notte p-3 rounded border border-legno col-span-2">
            <span className="text-piccolo uppercase text-salvia block">{L.t('spesa.separatoQuotaPasto')}</span>
            <span className="font-rustic text-titolo text-fuoco">{money(totals.costPerMealSep)} €</span>
            <p className="text-minuto text-gray-400 mt-1">
              {L.t('spesa.separatoQuotaNota', money(totals.foodDrinksSep), totals.adultMealsSep, totals.sepDaysCount, totals.sepPeopleCount)}
            </p>
          </div>
        )}
      </div>
      <p className="text-minuto text-gray-400 italic">{L.t('spesa.bambiniGratis')}</p>
    </div>

    </div>)}

    {spesaSection === 'quote' && (<div className="space-y-4">
    {/* Caso tipico da campo: spese registrate ma presenze dimenticate.
        Senza pasti non c'è nulla su cui ripartire e le quote restano a
        zero: meglio dirlo, invece di mostrare solo degli zeri. */}
    {totals.overallTotal > 0 && totals.adultMealsTotal === 0 && (
      <div className="bg-fuoco/10 border border-fuoco/40 rounded p-2.5">
        <p className="text-piccolo text-legno leading-snug">
          {frase('quote.senzaPasti', money(totals.overallTotal))}
        </p>
      </div>
    )}
    {totals.freeDaysCount > 0 && (
      <p className="text-piccolo text-bosco leading-snug bg-bosco/8 border border-bosco/25 rounded p-2.5">
        {frase('quote.giorniGratis', totals.freeDaysCount, totals.mealsFree)}
      </p>
    )}

    {/* Quote cassa comune: cibo e bevande dei giorni di tutti, più
        logistica e attrezzatura. Senza giorni spuntati è l'unica
        cassa che esiste, e la scheda resta quella di sempre. */}
    {schedaQuote({
      titolo: L.t('quote.cassaComune'),
      sottotitolo: cassaSepAttiva ? L.t('quote.cassaComuneNota') : null,
      elenco: totals.breakdown,
      quotaDi: (b) => b.payComune,
      pastiDi: (b) => b.mealsCommon,
      raccolto: totals.collectedComune,
      totale: totals.totaleComune,
      scarto: totals.roundingDiffComune,
      buchi: totals.buchi.filter((x) => x.cassa === 'comune'),
      nonRipartito: totals.nonRipartitoComune,
      avviso: totals.foodDrinksCommon > 0 && totals.adultMealsCommon === 0 && totals.adultMealsTotal > 0
        ? <>{frase('quote.tuttiSeparati', money(totals.foodDrinksCommon))}</>
        : null,
    })}

    {/* Le spese fra alcuni (fra-alcuni.js): fuori dalle quote per pasto,
        divise in parti uguali solo fra chi c'era. Una riga per spesa, con
        quanto tocca a ciascuno: e' la domanda che si fa chi la vede. */}
    {totals.fraAlcuni && totals.fraAlcuni.voci.length > 0 && (
      <div data-quote-fra-alcuni className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm">
        <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco mb-2">{L.t('fraAlcuni.titolo')}</h3>
        <p className="text-piccolo text-gray-500 leading-snug mb-2">{L.t('fraAlcuni.spiega')}</p>
        <ul className="divide-y divide-salvia/20">
          {totals.fraAlcuni.voci.map((v) => (
            <li key={v.id} className="py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-normale font-bold text-bosco min-w-0 break-words">{v.name}</span>
                <span className="font-rustic font-bold text-bosco shrink-0">{money(v.price)} €</span>
              </div>
              {v.buyer && <p className="text-minuto text-legno">{L.t('fraAlcuni.pagataDa', v.buyer)}</p>}
              <p className="text-piccolo text-gray-600 leading-snug">
                {v.quote.map((q) => `${q.name} ${money(q.amount)} €`).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      </div>
    )}

    {/* Quote cassa separata: solo il cibo dei giorni spuntati, diviso
        solo fra chi in quei giorni ha mangiato. */}
    {cassaSepAttiva && schedaQuote({
      titolo: L.t('quote.cassaSeparata'),
      sottotitolo: L.t('quote.cassaSeparataNota', totals.sepDaysCount),
      elenco: totals.breakdown.filter((b) => b.mealsSep > 0 || b.paySep > 0.005),
      quotaDi: (b) => b.paySep,
      pastiDi: (b) => b.mealsSep,
      raccolto: totals.collectedSep,
      totale: totals.foodDrinksSep,
      scarto: totals.roundingDiffSep,
      buchi: totals.buchi.filter((x) => x.cassa === 'separata'),
      nonRipartito: totals.nonRipartitoSep,
      vuoto: L.t('quote.separataVuota'),
      avviso: totals.foodDrinksSep > 0 && totals.adultMealsSep === 0
        ? <>{frase('quote.separataSenzaPasti', money(totals.foodDrinksSep))}</>
        : null,
    })}

    {/* Il totale di tutte e due, per chi vuole sapere quanto tira
        fuori in tutto senza sommare a mente. */}
    {cassaSepAttiva && totals.breakdown.length > 0 && (
      <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm">
        <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco mb-3">{L.t('quote.totaleAPersona')}</h3>
        <p className="text-piccolo text-gray-500 leading-snug mb-2">{L.t('quote.totaleNota')}</p>
        <ul className="divide-y divide-salvia/20">
          {totals.breakdown.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-2">
              <div className="flex flex-col">
                <span className="text-normale font-bold text-bosco">{b.name}</span>
                <span className="text-piccolo text-gray-500">
                  {b.isChild ? L.t('quote.bambino') : L.t('quote.comunePiuSeparata', money(b.payComune), money(b.paySep))}
                </span>
              </div>
              <span className={`font-rustic font-bold ${b.isChild ? 'text-gray-400' : 'text-bosco'}`}>
                {b.isChild ? L.t('quote.gratis') : `${money(b.pay)} €`}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between items-center pt-2 mt-1 border-t border-salvia/30">
          <span className="text-piccolo uppercase font-bold text-gray-500">{L.t('quote.totaleRaccolto')}</span>
          <span className="font-rustic font-bold text-bosco">{money(totals.collected)} €</span>
        </div>
      </div>
    )}

    </div>)}

    {spesaSection === 'saldi' && (<div className="space-y-4">
    {/* Meno bonifici, stesse cifre. Compare solo se serve davvero:
        con una cassa sola le due liste sono identiche. */}
    {cassaSepAttiva && (risparmio > 0 || saldiOttimizzati || rimborsi.unica) && (
      <div>
        <button
          onClick={() => setSaldiOttimizzati(!saldiOttimizzati)}
          className={bottoneScelta('interruttore', 'bordato', saldiOttimizzati, 'minuscolo', 'w-full')}
        >
          {saldiOttimizzati
            ? L.t('saldi.tornaPerCassa')
            : L.t('saldi.ottimizza', totals.transfers.length, totals.transfersOttimizzati.length)}
        </button>
        <p className="text-minuto text-gray-400 italic mt-1 leading-snug">
          {L.t(saldiOttimizzati ? 'saldi.notaOttimizzati' : 'saldi.notaPerCassa')}
        </p>
      </div>
    )}
    {saldiOttimizzati ? schedaSaldi({
      cassa: cassaUnica,
      rimandaPerCassa: rimborsi.perCassa,
      titolo: L.t('saldi.passaggiOttimizzati'),
      sottotitolo: L.t('saldi.passaggiNota'),
      scarto: totals.roundingDiff,
      nonRipartito: totals.nonRipartito,
    }) : (<>
    {schedaSaldi({
      cassa: { ...totals.casse.comune, ...rimborsi.comune },
      rimandaUnica: rimborsi.unica,
      titolo: L.t(cassaSepAttiva ? 'saldi.cassaComune' : 'saldi.finale'),
      sottotitolo: cassaSepAttiva ? L.t('saldi.cassaComuneNota') : null,
      scarto: totals.roundingDiffComune,
      nonRipartito: totals.nonRipartitoComune,
    })}
    {cassaSepAttiva && schedaSaldi({
      cassa: { ...totals.casse.separata, ...rimborsi.separata },
      rimandaUnica: rimborsi.unica,
      titolo: L.t('saldi.cassaSeparata'),
      sottotitolo: L.t('saldi.cassaSeparataNota', totals.sepDaysCount),
      scarto: totals.roundingDiffSep,
      nonRipartito: totals.nonRipartitoSep,
      vuoto: L.t('saldi.separataVuota'),
    })}
    </>)}

    <button onClick={shareReport} className={bottone('whatsapp', 'grande', 'w-full flex items-center justify-center gap-2')}>
      <span>📤</span> {L.t('saldi.condividi')}
    </button>
    <p className="text-minuto text-gray-400 italic text-center">{L.t('saldi.condividiNota')}</p>

    </div>)}

    {spesaSection === 'dati' && (<div className="space-y-4">
    {/* Chiusura dei conti: il blocco che serve DOPO il campo, quando la
        gente comincia a pagarsi e gli importi non devono più muoversi. */}
    {admin && (
      <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
        <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco flex items-center gap-2">
          <span>{L.t('chiusura.contiTitolo')}</span>
          {bloccoConti() && <span className="ml-auto text-minuto uppercase font-bold px-2 py-1 rounded bg-legno text-white">{L.t('chiusura.chiusi')}</span>}
        </h3>
        {bloccoConti() ? (
          <>
            <p className="text-piccolo text-gray-500 leading-snug">
              {frase('chiusura.contiChiusiNota', L.data(new Date(bloccoConti().at), 'dataOra'))}
            </p>
            <button onClick={riapriConti} className={bottone('secondario', 'normale', 'w-full')}>
              {L.t('chiusura.riapri')}
            </button>
          </>
        ) : (
          <>
            <p className="text-piccolo text-gray-500 leading-snug">
              {frase('chiusura.daFare')}
            </p>
            <button onClick={chiudiConti} className={bottone('bruno', 'normale', 'w-full')}>
              {L.t('chiusura.chiudi')}
            </button>
          </>
        )}
      </div>
    )}

    {/* Backup dati */}
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('backup.titolo')}</h3>
      <p className="text-piccolo text-gray-500">{L.t('backup.nota')}</p>
      {/* Esportare è innocuo e serve a chiunque voglia tenersi una
          copia. Importare e ripristinare invece RIMPIAZZANO tutto:
          cancellano il lavoro di tutti gli altri e possono sbloccare
          giorni chiusi. Stanno in modalità tecnica, come il blocco. */}
      <div className="flex gap-2">
        <button onClick={exportData} className={bottone('primario', 'normale', 'flex-1')}>{L.t('backup.esporta')}</button>
        {admin && (
          <label className="flex-1 py-2.5 bg-legno text-white rounded text-piccolo font-bold uppercase text-center cursor-pointer hover:bg-[#463628]">
            {L.t('backup.importa')}
            <input type="file" accept="application/json,.json" onChange={importData} className="hidden" />
          </label>
        )}
      </div>
      {admin && (
        <button onClick={openRestore} className="w-full py-2.5 bg-scheda border-2 border-fuoco/50 text-fuoco rounded text-piccolo font-bold uppercase hover:bg-fuoco/10">
          {L.t('backup.ripristino')}
        </button>
      )}
    </div>

    {/* Chiusura del campo */}
    <div className="bg-scheda p-4 rounded-lg border-2 border-legno/30 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('campo.chiusuraTitolo')}</h3>
      <p className="text-piccolo text-gray-500">
        {frase('campo.chiusuraNota')}
      </p>
      {/* Azzera membri, presenze e spese: giorni bloccati compresi.
          È l'ultimo gesto del campo e lo fa chi tiene i conti. */}
      {admin ? (
        <button onClick={openClose} className={bottone('bruno', 'grande', 'w-full')}>
          {L.t('campo.chiudiEArchivia')}
        </button>
      ) : (
        <p className="text-piccolo text-gray-400 italic">{L.t('campo.laFaChiTieneIConti')}</p>
      )}
      {archives.length > 0 && (
        <button onClick={() => goTo('archivio')} className={bottone('testuale', 'normale', 'w-full')}>
          {L.t('campo.vediArchivio', archives.length)}
        </button>
      )}
    </div>

    {/* Sincronizzazione Cloud (online) */}
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-salvia/40 pb-2">
        <h3 className="font-rustic text-grande text-bosco">{L.t('cloud.titolo')}</h3>
        <span className={`text-minuto uppercase font-bold px-2 py-1 rounded ${cloud.connected ? 'bg-bosco text-white' : 'bg-gray-200 text-gray-500'}`}>
          {L.t(cloud.connected ? 'cloud.connesso' : 'cloud.nonConnesso')}
        </span>
      </div>

      {!(window.CloudSync && window.CloudSync.isConfigured()) ? (
        <p className="text-piccolo text-gray-500 italic">
          {frase('cloud.nonConfigurato')}
        </p>
      ) : (
        <>
          <p className="text-piccolo text-gray-500">
            {L.t('cloud.notaAuto')}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={campCodeInput}
              onChange={(e) => setCampCodeInput(e.target.value)}
              placeholder={L.t('cloud.codiceCampo')}
              disabled={cloud.connected}
              className="flex-grow p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco disabled:opacity-60"
            />
            {cloud.connected ? (
              <button onClick={disconnectCloud} className={bottone('bruno', 'normale')}>{L.t('cloud.disconnetti')}</button>
            ) : (
              <button onClick={() => connectCloud(campCodeInput)} className={bottone('primario', 'normale')}>{L.t('cloud.connetti')}</button>
            )}
          </div>
          {/* min-w-0 e break-words non sono decorazione: il messaggio
              d'errore di Firebase contiene un indirizzo, cioe' una parola
              lunghissima che non va a capo da sola. Dentro un flex senza
              min-w-0 quella riga non puo' restringersi, e spinge tutta la
              schermata fuori dallo schermo. Si vedeva solo su un telefono
              stretto e solo quando il cloud falliva davvero. */}
          <div className="flex items-start justify-between gap-2 text-piccolo text-gray-500">
            <span className="min-w-0 break-words">
              {cloud.status === 'connecting' && L.t('cloud.inCorso')}
              {cloud.status === 'saving' && L.t('cloud.salvataggio')}
              {cloud.status === 'connected' && (cloud.lastSync ? L.t('cloud.ultimaSync', L.data(new Date(cloud.lastSync), 'oraPiena')) : L.t('cloud.inAscolto'))}
              {cloud.status === 'error' && <span className="text-red-700">{L.t('cloud.errore', cloud.error)}</span>}
              {cloud.status === 'idle' && L.t(localStorage.getItem('cambusa_sync_optout') === '1'
                ? 'cloud.disattivata'
                : 'cloud.inAttesa')}
            </span>
            {!isOnline && <span className="text-fuoco font-bold shrink-0">{L.t('cloud.offline')}</span>}
          </div>
        </>
      )}
    </div>
    </div>)}
  </div>
);

const schedaLista = ({
  acquirentePredefinito,
  addToBuy,
  apriFoglioSpesa,
  manualOpen,
  attachReceiptTo,
  listaSection,
  newBuyName,
  newBuyQty,
  openEditPurchase,
  purchaseQuery,
  purchases,
  receipts,
  removePurchase,
  removeToBuy,
  setBuying,
  setListaSection,
  setNewBuyName,
  setNewBuyQty,
  setPurchaseQuery,
  setToBuyQuery,
  setViewReceipt,
  spesePotenzialmenteDoppie,
  toBuy,
  toBuyQuery,
  totals,
}) => (
  <div className="space-y-4">
    {/* Sotto-sezioni: Da acquistare / Acquistato */}
    <div className="grid grid-cols-2 gap-2">
      {[['daacquistare', L.t('sezione.daAcquistare'), toBuy.length], ['acquistato', L.t('lista.acquistato'), purchases.length]].map(([k, l, n]) => (
        <button
          key={k}
          onClick={() => setListaSection(k)}
          className={bottoneScelta('linguetta', 'sezione', listaSection === k, 'minuscolo')}
        >
          {l}{n > 0 ? ` (${n})` : ''}
        </button>
      ))}
    </div>

    {/* ===== DA ACQUISTARE ===== */}
    {listaSection === 'daacquistare' && (
    <div className="bg-scheda p-4 rounded-lg border-2 border-legno/30 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-salvia/40 pb-2">
        <h3 className="font-rustic text-grande text-bosco">{L.t('lista.daAcquistareTitolo')}</h3>
        {toBuy.length > 0 && (
          <span className="text-piccolo uppercase font-bold text-gray-500">{L.t('lista.quanteVoci', toBuy.length)}</span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newBuyName}
          onChange={(e) => setNewBuyName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addToBuy()}
          placeholder={L.t('lista.cosaServe')}
          className="flex-grow min-w-0 p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco"
        />
        <input
          type="text"
          value={newBuyQty}
          onChange={(e) => setNewBuyQty(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addToBuy()}
          placeholder={L.t('lista.qta')}
          className="w-20 shrink-0 p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale text-center focus:outline-none focus:border-bosco"
        />
        <button onClick={addToBuy} aria-label={L.t('lista.aggiungiAllaLista')} className={bottoneIcona('pieno', 'shrink-0')}>+</button>
      </div>

      {/* Ricerca: la lista della spesa arriva a decine di voci, e
          ritrovarne una scorrendo col dito e' impraticabile. */}
      {toBuy.length > 4 && (
        <div className="flex gap-2">
          <input
            type="text"
            value={toBuyQuery}
            onChange={(e) => setToBuyQuery(e.target.value)}
            placeholder={L.t('lista.cerca')}
            className="flex-grow min-w-0 p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco"
          />
          {toBuyQuery && (
            <button onClick={() => setToBuyQuery('')} aria-label={L.t('lista.azzeraRicerca')} className={bottoneIcona('neutro', 'shrink-0')}>&times;</button>
          )}
        </div>
      )}

      {toBuy.length === 0 ? (
        <p className="text-normale text-gray-400 italic">{L.t('lista.vuota')}</p>
      ) : (() => {
        const q = toBuyQuery.trim().toLowerCase();
        const visibili = toBuy.filter((it) => !q ||
          (it.name || '').toLowerCase().includes(q) ||
          (it.qty || '').toLowerCase().includes(q));
        return (
        <>
        {q && (
          <div className="flex items-center justify-between bg-carta/60 px-3 py-2 rounded border border-salvia/20">
            <span className="text-piccolo uppercase font-bold text-gray-500">
              {L.t('lista.trovate', visibili.length, toBuy.length)}
            </span>
          </div>
        )}
        {visibili.length === 0 ? (
          <p className="text-normale text-gray-400 italic">{L.t('lista.nienteCorrisponde', toBuyQuery)}</p>
        ) : (
        <ul className="space-y-2">
          {visibili.map((it) => (
            <li key={it.id} className="bg-carta/60 p-2.5 rounded border border-salvia/20">
              <div className="flex items-center gap-2">
                <div className="flex-grow min-w-0">
                  <div className="text-normale font-bold text-bosco leading-snug break-words">{it.name}</div>
                  {it.qty && <div className="text-piccolo text-gray-500">{L.t('lista.quantita', it.qty)}</div>}
                </div>
                {/* Lo scontrino si allega al momento dell'acquisto,
                    nella maschera di "Segna come acquistata": è lì che
                    si ha in mano, non mentre si scrive la lista. */}
                {receipts[it.id] && (
                  <button onClick={() => setViewReceipt(receipts[it.id])} aria-label={L.t('lista.vediScontrino')} className={bottoneIcona('pieno', 'shrink-0')}>📷</button>
                )}
                <button onClick={() => removeToBuy(it.id)} aria-label={L.t('dotazioni.rimuovi')} className={bottoneIcona('distruttivo', 'shrink-0')}>&times;</button>
              </div>
              <button
                onClick={() => setBuying({ id: it.id, name: it.name, qty: it.qty, price: '', buyer: acquirentePredefinito(), type: 'alimentare', account: 'comune' })}
                className={bottone('bruno', 'normale', 'mt-2 w-full')}
              >
                {L.t('lista.segnaAcquistata')}
              </button>
            </li>
          ))}
        </ul>
        )}
        </>
        );
      })()}
      <p className="text-minuto text-gray-400 italic">{L.t('lista.notaPassaggio')}</p>
    </div>
    )}

    {/* ===== ACQUISTATO: inserimento manuale + cronologia ===== */}
    {listaSection === 'acquistato' && (<>
    {/* Registrare una spesa che non era in lista: il foglio dal basso, lo
        stesso del tasto «+ Spesa» (foglioSpesa, qui sotto). */}
    {!manualOpen && (
    <button
      onClick={apriFoglioSpesa}
      className="w-full min-h-11 bg-scheda p-3 rounded-lg border-2 border-dashed border-salvia/60 text-bosco hover:bg-orlo flex items-center justify-center gap-2"
    >
      {icona('piu', 'w-5 h-5')}
      <span className="font-bold uppercase text-piccolo tracking-wide">{L.t('lista.aggiungiAMano')}</span>
    </button>
    )}

    {/* Cronologia acquisti */}
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm">
      <div className="flex items-center justify-between border-b border-salvia/40 pb-2 mb-3">
        <h3 className="font-rustic text-grande text-bosco">{L.t('lista.cronologia')}</h3>
        {purchases.length > 0 && (
          <span className="font-rustic font-bold text-bosco">{money(totals.overallTotal)} €</span>
        )}
      </div>

      {/* Ricerca: con un centinaio di voci ritrovarne una scorrendo
          è impraticabile. Filtra su nome, acquirente e tipologia. */}
      {purchases.length > 4 && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={purchaseQuery}
            onChange={(e) => setPurchaseQuery(e.target.value)}
            placeholder={L.t('lista.cercaSpese')}
            className="flex-grow min-w-0 p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco"
          />
          {purchaseQuery && (
            <button onClick={() => setPurchaseQuery('')} aria-label={L.t('lista.azzeraRicerca')} className={bottoneIcona('neutro', 'shrink-0')}>&times;</button>
          )}
        </div>
      )}

      {/* Stessa spesa registrata da due persone: il totale si gonfia e
          la quota di tutti sale. Non si tocca niente da soli — di
          mezzo ci sono i soldi — ma si dice dov'è, con la matita e la
          × già a portata di mano qui sotto. */}
      {spesePotenzialmenteDoppie().map((g) => (
        <div key={g[0].id} className="bg-fuoco/10 border border-fuoco/40 rounded p-2.5 mb-3">
          <p className="text-piccolo text-legno leading-snug">
            {frase('lista.doppia', g[0].name, money(posNum(g[0].price)), g.length,
              g.some((x) => (x.buyer || '') !== (g[0].buyer || ''))
                ? [...new Set(g.map((x) => x.buyer || '—'))].join(' e ')
                : null)}
          </p>
        </div>
      ))}

      {purchases.length === 0 ? (
        <p className="text-normale text-gray-400 italic">{L.t('lista.nessunAcquisto')}</p>
      ) : (() => {
        const q = purchaseQuery.trim().toLowerCase();
        const visibili = purchases.slice().reverse().filter((p) => !q ||
          (p.name || '').toLowerCase().includes(q) ||
          (p.buyer || '').toLowerCase().includes(q) ||
          tipoSpesa(p.type).toLowerCase().includes(q));
        const sommaVisibili = visibili.reduce((s, p) => s + posNum(p.price), 0);
        return (
        <>
        {q && (
          <div className="flex items-center justify-between bg-carta/60 px-3 py-2 rounded border border-salvia/20 mb-2">
            <span className="text-piccolo uppercase font-bold text-gray-500">
              {L.t('lista.trovate', visibili.length, purchases.length)}
            </span>
            <span className="font-rustic font-bold text-bosco text-normale">{money(sommaVisibili)} €</span>
          </div>
        )}
        {visibili.length === 0 ? (
          <p className="text-normale text-gray-400 italic">{L.t('lista.nessunaSpesaCorrisponde', purchaseQuery)}</p>
        ) : (
        <ul className="space-y-2">
          {visibili.map((p) => (
            // Due livelli: sopra il nome del prodotto, che ha tutta la
            // riga per sé (prima veniva tagliato dalle etichette e dal
            // prezzo che gli stavano accanto); sotto le informazioni.
            <li key={p.id} className="bg-carta/60 p-2.5 rounded border border-salvia/20 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-normale font-bold text-bosco leading-snug break-words min-w-0">{p.name}</span>
                <span className="font-rustic font-bold text-bosco shrink-0 whitespace-nowrap">{money(posNum(p.price))} €</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap items-center gap-1 min-w-0 flex-grow">
                  <span className="text-minuto uppercase font-bold text-white px-1.5 py-0.5 rounded bg-salvia">{tipoSpesa(p.type) || p.type}</span>
                  {p.account === 'sep' && p.type !== 'logistica' && (
                    <span className="text-minuto uppercase font-bold text-white px-1.5 py-0.5 rounded bg-legno">{L.t('lista.separatoEtichetta')}</span>
                  )}
                  {p.fromList && <span className="text-minuto uppercase font-bold text-white px-1.5 py-0.5 rounded bg-legno">{L.t('lista.acquistataEtichetta')}</span>}
                  {Array.isArray(p.per) && p.per.length > 0 && <span data-etichetta-fra className="text-minuto uppercase font-bold text-white px-1.5 py-0.5 rounded bg-bosco">{L.t('fraAlcuni.etichetta', p.per.length)}</span>}
                  <span className="text-minuto text-gray-400 basis-full">
                    {p.buyer ? <span className="text-legno font-bold">{p.buyer}</span> : <span className="italic">{L.t('lista.acquirenteIgnoto')}</span>}
                    {p.at && ` · ${L.data(new Date(p.at), 'breve')} ${L.data(new Date(p.at), 'ora')}`}
                  </span>
                </div>
                {receipts[p.id] ? (
                  <button onClick={() => setViewReceipt(receipts[p.id])} aria-label={L.t('lista.vediScontrino')} className={bottoneIcona('pieno', 'shrink-0')}>📷</button>
                ) : (
                  <label title={L.t('lista.scontrinoTitolo')} aria-label={L.t('lista.allegaScontrino')} className="shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-salvia/50 bg-scheda text-normale leading-none hover:bg-orlo">
                    📷
                    <input type="file" accept="image/*" onChange={(e) => attachReceiptTo(e, p.id)} className="hidden" />
                  </label>
                )}
                <button onClick={() => openEditPurchase(p)} aria-label={L.t('lista.correggi')} title={L.t('lista.correggiSpesa')} className={bottoneIcona('neutro', 'shrink-0')}>✏️</button>
                <button onClick={() => removePurchase(p.id)} aria-label={L.t('dotazioni.rimuovi')} className={bottoneIcona('distruttivo', 'shrink-0')}>&times;</button>
              </div>
            </li>
          ))}
        </ul>
        )}
        </>
        );
      })()}
      <p className="text-minuto text-gray-400 italic mt-2">{L.t('lista.notaScontrini')}</p>
    </div>
    </>)}
  </div>
);

const schedaAttrezzatura = ({
  addEquip,
  attachReceiptTo,
  equipment,
  newEquipBuyer,
  newEquipPrice,
  newEquipText,
  openEditEquip,
  receipts,
  removeEquip,
  renderBuyerSelect,
  setNewEquipBuyer,
  setNewEquipPrice,
  setNewEquipText,
  setViewReceipt,
  toggleEquipBought,
}) => {
  const equipBoughtTotal = equipment.reduce((s, e) => (e.bought ? s + posNum(e.price) : s), 0);
  const equipPlannedTotal = equipment.reduce((s, e) => s + posNum(e.price), 0);
  return (
  <div className="space-y-4">
    {/* Form di inserimento */}
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('attrezzatura.aggiungiTitolo')}</h3>
      <input
        type="text"
        value={newEquipText}
        onChange={(e) => setNewEquipText(e.target.value)}
        placeholder={L.t('attrezzatura.esempio')}
        className="w-full p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco"
      />
      <div>
        <label className="block text-piccolo uppercase font-bold text-gray-500 mb-1">{L.t('attrezzatura.acquirenteFacoltativo')}</label>
        {renderBuyerSelect(newEquipBuyer, setNewEquipBuyer)}
      </div>
      <div className="flex gap-2">
        <input
          type="number" min="0" step="0.01" inputMode="decimal" data-cifra
          value={newEquipPrice}
          onChange={(e) => setNewEquipPrice(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addEquip()}
          placeholder={L.t('lista.prezzo')}
          className="flex-grow min-w-0 p-2.5 bg-carta/50 border border-salvia/30 rounded font-bold"
        />
        <button onClick={addEquip} className={bottone('primario', 'normale', 'shrink-0')}>{L.t('attrezzatura.aggiungi')}</button>
      </div>
      <p className="text-minuto text-gray-400">{L.t('attrezzatura.nota')}</p>
    </div>

    {/* Elenco attrezzatura */}
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm">
      <div className="flex items-center justify-between border-b border-salvia/40 pb-2 mb-3">
        <h3 className="font-rustic text-grande text-bosco">{L.t('area.attrezzatura')}</h3>
        {equipment.length > 0 && (
          <span className="text-piccolo uppercase font-bold text-gray-500">
            {L.t('attrezzatura.daComprare', equipment.filter((e) => !e.bought).length)}
          </span>
        )}
      </div>
      {equipment.length === 0 ? (
        <p className="text-normale text-gray-400 italic">{L.t('attrezzatura.vuota')}</p>
      ) : (
        <>
        <ul className="space-y-2">
          {equipment.map((e) => (
            // Nome sulla sua riga, prezzo e comandi sotto: in fila su una
            // riga sola il titolo restava schiacciato in due centimetri e
            // non si leggeva più.
            <li key={e.id} className="bg-carta/60 p-2.5 rounded border border-salvia/20">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleEquipBought(e.id)}
                  aria-label={L.t(e.bought ? 'attrezzatura.segnaDaComprare' : 'attrezzatura.segnaAcquistato')}
                  className={bottoneScelta('casella', 'casella', e.bought, 'simbolo', 'mt-0.5')}
                >
                  ✓
                </button>
                <div className="flex-grow min-w-0">
                  <div className={`text-normale leading-snug break-words ${e.bought ? 'line-through text-gray-500' : 'text-bosco'}`}>{e.text}</div>
                  {e.buyer && <div className="text-minuto text-legno font-bold break-words">{e.buyer}</div>}
                </div>
                <span className={`font-rustic font-bold shrink-0 ${e.bought ? 'text-bosco' : 'text-gray-400'}`}>{money(posNum(e.price))} €</span>
              </div>
              <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-salvia/20">
                {receipts[e.id] ? (
                  <button onClick={() => setViewReceipt(receipts[e.id])} aria-label={L.t('lista.vediScontrino')} className={bottoneIcona('pieno', 'shrink-0')}>📷</button>
                ) : (
                  <label title={L.t('lista.scontrinoTitolo')} aria-label={L.t('lista.allegaScontrino')} className="shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-salvia/50 bg-scheda text-normale leading-none hover:bg-orlo">
                    📷
                    <input type="file" accept="image/*" onChange={(ev) => attachReceiptTo(ev, e.id)} className="hidden" />
                  </label>
                )}
                <button onClick={() => openEditEquip(e)} aria-label={L.t('lista.correggi')} title={L.t('attrezzatura.correggiVoce')} className={bottoneIcona('neutro', 'shrink-0')}>✏️</button>
                <button onClick={() => removeEquip(e.id)} aria-label={L.t('dotazioni.rimuovi')} className={bottoneIcona('distruttivo', 'shrink-0')}>&times;</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-2 border-t border-salvia/30 space-y-1">
          <div className="flex justify-between text-piccolo text-gray-500">
            <span className="uppercase font-bold">{L.t('attrezzatura.previsto')}</span>
            <span className="font-bold">{money(equipPlannedTotal)} €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-piccolo uppercase font-bold text-bosco">{L.t('attrezzatura.acquistatoNelleSpese')}</span>
            <span className="font-rustic font-bold text-bosco">{money(equipBoughtTotal)} €</span>
          </div>
        </div>
        </>
      )}
    </div>
  </div>
  );
};

// ---------- Il foglio della spesa ----------
// Registrare una spesa, da qualunque scheda del campo: sale dal basso sopra
// quello che si stava guardando, e si chiude toccando fuori. L'ordine e'
// quello del gesto vero, alla cassa: prima QUANTO (l'unica cosa sempre da
// scrivere), poi chi ha pagato — che parte gia' da qualcuno, vedi
// acquirentePredefinito in App —, poi cosa e di che tipo. Il conto separato
// compare solo se il campo ha dei giorni separati: altrimenti e' una domanda
// senza senso. La foto dello scontrino e' a un tocco, e facoltativa.
//
// La logica e' quella di sempre, addPurchase: qui cambia solo il disegno.
// Fra chi si divide una spesa (fra-alcuni.js). «Come sempre» e' il modo di
// tutte le spese di prima — per pasti o fra i presenti —; «solo alcuni» apre
// i nomi, e la spesa si divide in parti uguali fra quelli accesi. Sta nel
// foglio della spesa e nella maschera di correzione: scritta una volta.
const sceltaFraChi = ({ members, per, setPer }) => {
  const scelti = per || [];
  const etichetta = 'block text-minuto uppercase font-bold tracking-wide text-gray-500 mb-1.5';
  const quanti = scelti.length;
  return (
    <div data-fra-chi>
      <span className={etichetta}>{L.t('fraAlcuni.siDivide')}</span>
      <div className="flex flex-wrap gap-1.5">
        <button data-fra="tutti" aria-pressed={!per} onClick={() => setPer(null)} className={bottoneScelta('pillola', 'tenue', !per, 'minuscolo')}>{L.t('fraAlcuni.comeSempre')}</button>
        <button data-fra="alcuni" aria-pressed={!!per} onClick={() => setPer(per || [])} className={bottoneScelta('pillola', 'tenue', !!per, 'minuscolo')}>{L.t('fraAlcuni.soloAlcuni')}</button>
      </div>
      {per && (
        <div className="mt-2 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => {
              const acceso = scelti.includes(m.id);
              return (
                <button
                  key={m.id}
                  data-fra-membro={m.name}
                  aria-pressed={acceso}
                  onClick={() => setPer((v) => { const x = v || []; return x.includes(m.id) ? x.filter((i) => i !== m.id) : [...x, m.id]; })}
                  className={bottoneScelta('pillola', 'tenue', acceso, 'minuscolo')}
                >{m.name}</button>
              );
            })}
          </div>
          <p className="text-minuto text-gray-500 leading-snug">{L.t('fraAlcuni.nota', quanti)}</p>
        </div>
      )}
    </div>
  );
};

const foglioSpesa = ({
  addPurchase,
  chiudi,
  fotoCloud,
  members,
  onReceiptFile,
  pAccount,
  pBuyer,
  pName,
  pPer,
  pPrice,
  pReceipt,
  pType,
  purchases,
  renderBuyerSelect,
  sepDays,
  setPAccount,
  setPBuyer,
  setPName,
  setPPer,
  setPPrice,
  setPReceipt,
  setPType,
}) => {
  // I chip veloci: chi e' gia' scelto, poi chi ha pagato di recente, poi gli
  // altri membri. Quattro al massimo; per tutti gli altri c'e' la tendina.
  const veloci = [];
  const prendi = (n) => { if (n && veloci.length < 4 && !veloci.includes(n) && members.some((m) => m.name === n)) veloci.push(n); };
  prendi(pBuyer);
  purchases.slice().sort((a, b) => (b.at || 0) - (a.at || 0)).forEach((p) => prendi(p.buyer));
  members.forEach((m) => prendi(m.name));
  const conConto = !pPer && pType !== 'logistica' && (sepDays.length > 0 || pAccount === 'sep');
  const etichetta = 'block text-minuto uppercase font-bold tracking-wide text-gray-500 mb-1.5';
  return (
    <div data-foglio-spesa role="dialog" aria-modal="true" aria-label={L.t('foglio.titolo')} className="fixed inset-0 z-40 flex flex-col justify-end">
      <div onClick={chiudi} className="absolute inset-0 bg-notte/55"></div>
      <div
        className="relative w-full max-w-md mx-auto bg-scheda rounded-t-2xl shadow-2xl px-5 pt-3 space-y-4 max-h-[92vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      >
        <div className="flex justify-center"><span className="w-10 h-1 rounded-full bg-salvia/40"></span></div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-rustic text-grande text-bosco">{L.t('foglio.titolo')}</h3>
          <button onClick={chiudi} aria-label={L.t('lista.chiudiMaschera')} className={bottoneIcona('neutro')}>&times;</button>
        </div>

        <label className="flex items-center gap-2 px-4 py-1 bg-carta border-2 border-bosco rounded-md">
          <input
            type="number" min="0" step="0.01" inputMode="decimal" data-cifra
            autoFocus
            value={pPrice}
            onChange={(e) => setPPrice(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPurchase()}
            placeholder={money(0)}
            aria-label={L.t('foglio.quanto')}
            className="flex-1 min-w-0 bg-transparent font-bold text-titolo text-bosco focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="font-bold text-grande text-gray-500">€</span>
        </label>

        <div>
          <span className={etichetta}>{L.t('foglio.chiHaPagato')}</span>
          {veloci.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {veloci.map((n) => (
                <button key={n} data-acquirente={n} aria-pressed={pBuyer === n} onClick={() => setPBuyer(n)} className={bottoneScelta('pillola', 'tenue', pBuyer === n, 'minuscolo')}>{n}</button>
              ))}
            </div>
          )}
          {renderBuyerSelect(pBuyer, setPBuyer)}
        </div>

        <div>
          <span className={etichetta}>{L.t('foglio.cosa')}</span>
          <input
            type="text"
            value={pName}
            onChange={(e) => setPName(e.target.value)}
            placeholder={L.t('lista.esempioNome')}
            className="w-full p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco"
          />
        </div>

        <div>
          <span className={etichetta}>{L.t('foglio.tipo')}</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(PURCHASE_TYPES).map((k) => (
              <button key={k} data-tipo={k} aria-pressed={pType === k} onClick={() => setPType(k)} className={bottoneScelta('pillola', 'tenue', pType === k, 'minuscolo')}>{tipoSpesa(k)}</button>
            ))}
          </div>
        </div>

        {sceltaFraChi({ members, per: pPer, setPer: setPPer })}

        {conConto && (
          <div>
            <span className={etichetta}>{L.t('lista.conto')}</span>
            <div className="flex flex-wrap gap-1.5">
              {[['comune', 'lista.contoComune'], ['sep', 'giorno.contoSeparato']].map(([k, chiave]) => (
                <button key={k} data-conto={k} aria-pressed={pAccount === k} onClick={() => setPAccount(k)} className={bottoneScelta('pillola', 'tenue', pAccount === k, 'minuscolo')}>{L.t(chiave)}</button>
              ))}
            </div>
            {pAccount === 'sep' && (
              <p className="text-minuto mt-1 leading-snug text-legno">
                {sepDays.length === 0 ? L.t('lista.senzaGiorniSpuntati') : L.t('lista.siDivide', sepDays.length)}
              </p>
            )}
          </div>
        )}

        {pReceipt && (
          <div className="flex items-center gap-3 bg-carta/60 p-2 rounded border border-salvia/30">
            <img src={pReceipt} alt={L.t('lista.scontrino')} className="w-12 h-12 object-cover rounded" />
            <span className="flex-grow text-piccolo text-bosco font-bold leading-snug">
              {L.t('lista.scontrinoAllegato')}
              {/* In un campo gratuito la foto non va nel cloud: lo si dice qui,
                  altrimenti chi l'ha scattata non capisce perche' gli altri non
                  la vedono. */}
              {fotoCloud === false && <span data-foto-solo-qui className="block font-normal text-minuto text-gray-500">{L.t('pro.fotoSoloQui')}</span>}
            </span>
            <button onClick={() => setPReceipt(null)} aria-label={L.t('lista.rimuoviFoto')} className={bottoneIcona('distruttivo')}>&times;</button>
          </div>
        )}

        <div className="flex gap-2">
          <label
            aria-label={L.t('lista.allegaScontrino')}
            className={`${bottone('secondario', 'normale', 'shrink-0 cursor-pointer inline-flex items-center gap-1.5')}`}
          >
            {icona('galleria', 'w-5 h-5')}
            <span>{L.t('foglio.scontrino')}</span>
            <input type="file" accept="image/*" onChange={onReceiptFile} className="hidden" />
          </label>
          <button onClick={addPurchase} className={bottone('primario', 'normale', 'flex-1')}>{L.t('lista.salva')}</button>
        </div>
      </div>
    </div>
  );
};
