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
  schedaQuote,
  schedaSaldi,
  setCampCodeInput,
  setSaldiOttimizzati,
  setSpesaSection,
  shareReport,
  spesaSection,
  totals,
}) => (
  <div className="space-y-4">
    {/* Sotto-sezioni della Spesa */}
    <div className="grid grid-cols-4 gap-1.5">
      {[['totali', 'Totali'], ['quote', 'Quote'], ['saldi', 'Saldi'], ['dati', 'Dati']].map(([k, l]) => (
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
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-4">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Cassa Globale Campo</h3>
      <p className="text-[10px] text-gray-500 -mt-1">Totali generati automaticamente da quello che registri in <span className="font-bold">Lista della Spesa</span> e <span className="font-bold">Attrezzatura</span>.</p>
      <div className="space-y-2">
        {[
          ['Spesa Cibo (Alimentare)', totals.totalFood],
          ['Spesa Bevande', totals.totalDrinks],
          ['Logistica e attrezzatura', totals.totalAccessory],
        ].map(([label, val]) => (
          <div key={label} className="flex justify-between items-center bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20">
            <span className="text-[11px] uppercase font-bold text-gray-500">{label}</span>
            <span className="font-bold text-[#2D392C]">{money(val)} €</span>
          </div>
        ))}
      </div>
      {totals.foodDrinksSep > 0 && (
        <div className="flex justify-between items-center bg-[#5C4A3C]/10 px-3 py-2 rounded border border-[#5C4A3C]/30">
          <span className="text-[10px] uppercase font-bold text-[#5C4A3C]">di cui sul conto separato</span>
          <span className="font-bold text-[#5C4A3C]">{money(totals.foodDrinksSep)} €</span>
        </div>
      )}
      <div className="bg-[#2D392C]/10 p-3 rounded border border-[#2D392C]/20 flex justify-between items-center mt-2">
        <span className="font-bold text-xs uppercase">Importo Complessivo:</span>
        <span className="font-rustic font-bold text-lg text-[#2D392C]">{money(totals.overallTotal)} €</span>
      </div>
    </div>

    <div className="bg-[#2D392C] text-[#F0F4F1] p-4 rounded-lg border-b-4 border-[#5C4A3C] shadow-md space-y-4">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-1">Il Conto della Serva</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20">
          <span className="text-[10px] uppercase text-[#8F9E8B] block">Quota Singolo Pasto</span>
          <span className="font-rustic text-xl text-[#D97706]">{money(totals.costPerMeal)} €</span>
          <p className="text-[9px] text-gray-400 mt-1">
            Cibo+bevande ({money(totals.foodDrinksCommon)} €) / {totals.adultMealsCommon} pasti adulti
            {totals.sepDaysCount > 0 ? ' dei giorni comuni' : ''}.
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
          <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20">
            <span className="text-[10px] uppercase text-[#8F9E8B] block">Quota a persona</span>
            <span className="font-rustic text-xl text-[#D97706]">{money(totals.accessoryPerAdult)} €</span>
            <p className="text-[9px] text-gray-400 mt-1">
              Logistica e attrezzatura ({money(totals.totalAccessory)} €) / {totals.accessoryPayersCount} {totals.accessoryPayersCount === 1 ? 'adulto' : 'adulti'} dei giorni comuni.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20">
              <span className="text-[10px] uppercase text-[#8F9E8B] block">Logistica a testa</span>
              <span className="font-rustic text-xl text-[#D97706]">{money(totals.logisticsPerAdult)} €</span>
              <p className="text-[9px] text-gray-400 mt-1">Logistica ({money(totals.logisticsPurchases)} €) / {totals.accessoryPayersCount} adulti dei giorni comuni.</p>
            </div>
            <div className="bg-[#1F271E] p-3 rounded border border-[#8F9E8B]/20">
              <span className="text-[10px] uppercase text-[#8F9E8B] block">Attrezzatura a testa</span>
              <span className="font-rustic text-xl text-[#D97706]">{money(totals.equipPerAdult)} €</span>
              <p className="text-[9px] text-gray-400 mt-1">
                Attrezzatura ({money(totals.equipBought)} €) / {totals.equipPayersCount} {totals.equipPayersCount === 1 ? 'persona non esente' : 'persone non esenti'}.
              </p>
            </div>
          </>
        )}
        {(totals.sepDaysCount > 0 || totals.foodDrinksSep > 0) && (
          <div className="bg-[#1F271E] p-3 rounded border border-[#5C4A3C] col-span-2">
            <span className="text-[10px] uppercase text-[#8F9E8B] block">Conto separato — quota pasto</span>
            <span className="font-rustic text-xl text-[#D97706]">{money(totals.costPerMealSep)} €</span>
            <p className="text-[9px] text-gray-400 mt-1">
              Cibo+bevande separati ({money(totals.foodDrinksSep)} €) / {totals.adultMealsSep} pasti adulti
              su {totals.sepDaysCount} {totals.sepDaysCount === 1 ? 'giorno' : 'giorni'},
              {' '}{totals.sepPeopleCount} {totals.sepPeopleCount === 1 ? 'persona' : 'persone'}.
            </p>
          </div>
        )}
      </div>
      <p className="text-[9px] text-gray-400 italic">I pasti dei bambini sono gratis: il loro costo è ripartito sugli adulti.</p>
    </div>

    </div>)}

    {spesaSection === 'quote' && (<div className="space-y-4">
    {/* Caso tipico da campo: spese registrate ma presenze dimenticate.
        Senza pasti non c'è nulla su cui ripartire e le quote restano a
        zero: meglio dirlo, invece di mostrare solo degli zeri. */}
    {totals.overallTotal > 0 && totals.adultMealsTotal === 0 && (
      <div className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5">
        <p className="text-[11px] text-[#5C4A3C] leading-snug">
          <span className="font-bold">Attenzione:</span> ci sono spese per {money(totals.overallTotal)} € ma
          nessun pasto registrato. Le quote restano a zero finché non segni le presenze
          nella scheda <span className="font-bold">Presenze</span>.
        </p>
      </div>
    )}
    {totals.freeDaysCount > 0 && (
      <p className="text-[10px] text-[#2D392C] leading-snug bg-[#2D392C]/8 border border-[#2D392C]/25 rounded p-2.5">
        🎁 <span className="font-bold">{totals.freeDaysCount} {totals.freeDaysCount === 1 ? 'giorno gratis' : 'giorni gratis'}</span>:
        {' '}{totals.mealsFree} {totals.mealsFree === 1 ? 'pasto è escluso' : 'pasti sono esclusi'} dai conti.
        Restano segnati nel calendario per la cucina, ma nessuno li paga — per questo i pasti
        contati qui sotto possono essere meno di quelli che vedi in Presenze.
      </p>
    )}

    {/* Quote cassa comune: cibo e bevande dei giorni di tutti, più
        logistica e attrezzatura. Senza giorni spuntati è l'unica
        cassa che esiste, e la scheda resta quella di sempre. */}
    {schedaQuote({
      titolo: 'Quote cassa comune',
      sottotitolo: cassaSepAttiva
        ? 'Cibo e bevande dei giorni di tutti, più logistica e attrezzatura.'
        : null,
      elenco: totals.breakdown,
      quotaDi: (b) => b.payComune,
      pastiDi: (b) => b.mealsCommon,
      raccolto: totals.collectedComune,
      totale: totals.totaleComune,
      scarto: totals.roundingDiffComune,
      buchi: totals.buchi.filter((x) => x.cassa === 'comune'),
      nonRipartito: totals.nonRipartitoComune,
      avviso: totals.foodDrinksCommon > 0 && totals.adultMealsCommon === 0 && totals.adultMealsTotal > 0 ? (
        <>
          <span className="font-bold">Attenzione:</span> tutti i giorni con presenze sono spuntati come
          conto separato, ma ci sono {money(totals.foodDrinksCommon)} € di cibo e bevande sul conto comune.
          Sposta quelle spese sul conto separato, oppure togli la spunta ai giorni che sono di tutti.
        </>
      ) : null,
    })}

    {/* Quote cassa separata: solo il cibo dei giorni spuntati, diviso
        solo fra chi in quei giorni ha mangiato. */}
    {cassaSepAttiva && schedaQuote({
      titolo: 'Quote cassa separata',
      sottotitolo: `Solo cibo e bevande dei ${totals.sepDaysCount} ${totals.sepDaysCount === 1 ? 'giorno spuntato' : 'giorni spuntati'} in Calendario, a carico di chi c'era.`,
      elenco: totals.breakdown.filter((b) => b.mealsSep > 0 || b.paySep > 0.005),
      quotaDi: (b) => b.paySep,
      pastiDi: (b) => b.mealsSep,
      raccolto: totals.collectedSep,
      totale: totals.foodDrinksSep,
      scarto: totals.roundingDiffSep,
      buchi: totals.buchi.filter((x) => x.cassa === 'separata'),
      nonRipartito: totals.nonRipartitoSep,
      vuoto: 'Nessuno ha pasti nei giorni spuntati: qui non c\'è niente da dividere.',
      avviso: totals.foodDrinksSep > 0 && totals.adultMealsSep === 0 ? (
        <>
          <span className="font-bold">Attenzione:</span> ci sono {money(totals.foodDrinksSep)} € sul
          conto separato ma nessun pasto nei giorni spuntati. Spunta i giorni in
          <span className="font-bold"> Calendario</span> e segna le
          <span className="font-bold"> Presenze</span>, altrimenti quella spesa non entra nelle quote.
        </>
      ) : null,
    })}

    {/* Il totale di tutte e due, per chi vuole sapere quanto tira
        fuori in tutto senza sommare a mente. */}
    {cassaSepAttiva && totals.breakdown.length > 0 && (
      <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
        <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] mb-3">Totale a persona</h3>
        <p className="text-[10px] text-gray-500 leading-snug mb-2">Le due casse sommate: è la cifra che ciascuno tira fuori in tutto.</p>
        <ul className="divide-y divide-[#8F9E8B]/20">
          {totals.breakdown.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-2">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[#2D392C]">{b.name}</span>
                <span className="text-[10px] text-gray-500">
                  {b.isChild ? 'bambino' : `${money(b.payComune)} € comune + ${money(b.paySep)} € separata`}
                </span>
              </div>
              <span className={`font-rustic font-bold ${b.isChild ? 'text-gray-400' : 'text-[#2D392C]'}`}>
                {b.isChild ? 'Gratis' : `${money(b.pay)} €`}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between items-center pt-2 mt-1 border-t border-[#8F9E8B]/30">
          <span className="text-[11px] uppercase font-bold text-gray-500">Totale raccolto</span>
          <span className="font-rustic font-bold text-[#2D392C]">{money(totals.collected)} €</span>
        </div>
      </div>
    )}

    </div>)}

    {spesaSection === 'saldi' && (<div className="space-y-4">
    {/* Meno bonifici, stesse cifre. Compare solo se serve davvero:
        con una cassa sola le due liste sono identiche. */}
    {cassaSepAttiva && (risparmio > 0 || saldiOttimizzati) && (
      <div>
        <button
          onClick={() => setSaldiOttimizzati(!saldiOttimizzati)}
          className={bottoneScelta('interruttore', 'bordato', saldiOttimizzati, 'normale', 'w-full')}
        >
          {saldiOttimizzati
            ? '↩ Torna ai saldi per cassa'
            : `⚡ Ottimizza i passaggi (${totals.transfers.length} → ${totals.transfersOttimizzati.length})`}
        </button>
        <p className="text-[9px] text-gray-400 italic mt-1 leading-snug">
          {saldiOttimizzati
            ? 'Stai vedendo le due casse messe insieme. Per capire da dove viene una cifra, torna ai saldi per cassa.'
            : 'Unisce le due casse in un elenco solo di bonifici: nessuno paga un centesimo in più o in meno, sono solo meno passaggi.'}
        </p>
      </div>
    )}
    {saldiOttimizzati ? schedaSaldi({
      cassa: cassaUnica,
      titolo: 'Passaggi ottimizzati',
      sottotitolo: 'Le due casse insieme. Le cifre dovute sono le stesse: cambia solo chi gira i soldi a chi, per farne meno. Le spunte di questa vista sono separate da quelle per cassa.',
      scarto: totals.roundingDiff,
      nonRipartito: totals.nonRipartito,
    }) : (<>
    {schedaSaldi({
      cassa: totals.casse.comune,
      titolo: cassaSepAttiva ? 'Saldi cassa comune' : 'Saldo finale',
      sottotitolo: cassaSepAttiva
        ? 'Cibo e bevande dei giorni di tutti, logistica e attrezzatura.'
        : null,
      scarto: totals.roundingDiffComune,
      nonRipartito: totals.nonRipartitoComune,
    })}
    {cassaSepAttiva && schedaSaldi({
      cassa: totals.casse.separata,
      titolo: 'Saldi cassa separata',
      sottotitolo: `Solo cibo e bevande dei ${totals.sepDaysCount} ${totals.sepDaysCount === 1 ? 'giorno spuntato' : 'giorni spuntati'}: chi ha anticipato lì viene rimborsato da chi c'era.`,
      scarto: totals.roundingDiffSep,
      nonRipartito: totals.nonRipartitoSep,
      vuoto: 'Nessun anticipo e nessuna quota su questa cassa.',
    })}
    </>)}

    <button onClick={shareReport} className={bottone('whatsapp', 'grande', 'w-full flex items-center justify-center gap-2')}>
      <span>📤</span> Condividi resoconto
    </button>
    <p className="text-[9px] text-gray-400 italic text-center">Genera un messaggio pronto con totale e "chi paga chi" da mandare nel gruppo.</p>

    </div>)}

    {spesaSection === 'dati' && (<div className="space-y-4">
    {/* Chiusura dei conti: il blocco che serve DOPO il campo, quando la
        gente comincia a pagarsi e gli importi non devono più muoversi. */}
    {admin && (
      <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
        <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C] flex items-center gap-2">
          <span>Chiusura dei conti</span>
          {bloccoConti() && <span className="ml-auto text-[9px] uppercase font-bold px-2 py-1 rounded bg-[#5C4A3C] text-white">🔒 Chiusi</span>}
        </h3>
        {bloccoConti() ? (
          <>
            <p className="text-[10px] text-gray-500 leading-snug">
              Conti chiusi il <span className="font-bold">{new Date(bloccoConti().at).toLocaleString('it-IT')}</span>.
              Spese e attrezzatura sono congelate: gli importi di "chi paga chi" non cambiano più, quindi i
              rimborsi già segnati come saldati restano validi. Quello che arriva dagli altri telefoni viene
              messo da parte e segnalato qui sopra.
            </p>
            <button onClick={riapriConti} className={bottone('secondario', 'normale', 'w-full')}>
              🔓 Riapri i conti
            </button>
          </>
        ) : (
          <>
            <p className="text-[10px] text-gray-500 leading-snug">
              Da fare <span className="font-bold">quando i conti sono definitivi e la gente comincia a pagarsi</span>.
              I passaggi di pareggio sono segnati come saldati con una chiave che contiene l'importo: basta
              una spesa aggiunta dopo perché tutti gli importi si ricalcolino e i bonifici già fatti
              spariscano dall'elenco. Chiudendo, spese e attrezzatura si congelano e le presenze ancora
              aperte si bloccano.
            </p>
            <button onClick={chiudiConti} className={bottone('bruno', 'normale', 'w-full')}>
              🔒 Chiudi i conti
            </button>
          </>
        )}
      </div>
    )}

    {/* Backup dati */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Backup Dati</h3>
      <p className="text-[10px] text-gray-500">Ogni giorno viene salvata da sola una copia di sicurezza nel cloud. Esporta/Importa serve per un backup manuale su file.</p>
      {/* Esportare è innocuo e serve a chiunque voglia tenersi una
          copia. Importare e ripristinare invece RIMPIAZZANO tutto:
          cancellano il lavoro di tutti gli altri e possono sbloccare
          giorni chiusi. Stanno in modalità tecnica, come il blocco. */}
      <div className="flex gap-2">
        <button onClick={exportData} className={bottone('primario', 'normale', 'flex-1')}>Esporta</button>
        {admin && (
          <label className="flex-1 py-2.5 bg-[#5C4A3C] text-white rounded text-xs font-bold uppercase text-center cursor-pointer hover:bg-[#463628]">
            Importa
            <input type="file" accept="application/json,.json" onChange={importData} className="hidden" />
          </label>
        )}
      </div>
      {admin && (
        <button onClick={openRestore} className="w-full py-2.5 bg-white border-2 border-[#D97706]/50 text-[#D97706] rounded text-xs font-bold uppercase hover:bg-[#D97706]/10">
          Ripristino di emergenza
        </button>
      )}
    </div>

    {/* Chiusura del campo */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#5C4A3C]/30 shadow-sm space-y-3">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Chiusura del campo</h3>
      <p className="text-[10px] text-gray-500">
        A conti fatti e rimborsi saldati: salva tutto (file + cloud), lo mette in <span className="font-bold">Archivio</span> e
        azzera membri, presenze, spese, lista, attrezzatura, dotazioni aggiuntive e scontrini.
        L'app resta pronta per il prossimo evento. I dati archiviati restano consultabili.
      </p>
      {/* Azzera membri, presenze e spese: giorni bloccati compresi.
          È l'ultimo gesto del campo e lo fa chi tiene i conti. */}
      {admin ? (
        <button onClick={openClose} className={bottone('bruno', 'grande', 'w-full')}>
          🏁 Chiudi il campo e archivia
        </button>
      ) : (
        <p className="text-[10px] text-gray-400 italic">La chiusura del campo la fa chi tiene i conti.</p>
      )}
      {archives.length > 0 && (
        <button onClick={() => goTo('archivio')} className={bottone('testuale', 'piccolo', 'w-full')}>
          Vedi l'archivio ({archives.length})
        </button>
      )}
    </div>

    {/* Sincronizzazione Cloud (online) */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
        <h3 className="font-rustic text-lg text-[#2D392C]">Sincronizzazione Cloud</h3>
        <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded ${cloud.connected ? 'bg-[#2D392C] text-white' : 'bg-gray-200 text-gray-500'}`}>
          {cloud.connected ? 'Connesso' : 'Non connesso'}
        </span>
      </div>

      {!(window.CloudSync && window.CloudSync.isConfigured()) ? (
        <p className="text-[10px] text-gray-500 italic">
          Firebase non configurato. Incolla la config del tuo progetto in <span className="font-bold">firebase-config.js</span> per abilitare la sincronizzazione online tra dispositivi.
        </p>
      ) : (
        <>
          <p className="text-[10px] text-gray-500">
            La sincronizzazione si attiva da sola all'avvio quando c'è linea. Offline si continua a lavorare in locale. Premi Disconnetti solo se vuoi lavorare senza condividere i dati.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={campCodeInput}
              onChange={(e) => setCampCodeInput(e.target.value)}
              placeholder="Codice campo"
              disabled={cloud.connected}
              className="flex-grow p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C] disabled:opacity-60"
            />
            {cloud.connected ? (
              <button onClick={disconnectCloud} className={bottone('bruno', 'normale')}>Disconnetti</button>
            ) : (
              <button onClick={() => connectCloud(campCodeInput)} className={bottone('primario', 'normale')}>Connetti</button>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-500">
            <span>
              {cloud.status === 'connecting' && 'Connessione in corso…'}
              {cloud.status === 'saving' && 'Salvataggio…'}
              {cloud.status === 'connected' && (cloud.lastSync ? `Ultima sync: ${new Date(cloud.lastSync).toLocaleTimeString('it-IT')}` : 'In ascolto…')}
              {cloud.status === 'error' && <span className="text-red-700">Errore: {cloud.error}</span>}
              {cloud.status === 'idle' && (localStorage.getItem('cambusa_sync_optout') === '1'
                ? 'Sincronizzazione disattivata: premi Connetti per riattivarla.'
                : 'In attesa di connessione automatica…')}
            </span>
            {!isOnline && <span className="text-[#D97706] font-bold">offline</span>}
          </div>
        </>
      )}
    </div>
    </div>)}
  </div>
);

const schedaLista = ({
  addPurchase,
  addToBuy,
  attachReceiptTo,
  listaSection,
  manualOpen,
  newBuyName,
  newBuyQty,
  onReceiptFile,
  openEditPurchase,
  pAccount,
  pBuyer,
  pName,
  pPrice,
  pReceipt,
  pType,
  purchaseQuery,
  purchases,
  receipts,
  removePurchase,
  removeToBuy,
  renderBuyerSelect,
  sepDays,
  setBuying,
  setListaSection,
  setManualOpen,
  setNewBuyName,
  setNewBuyQty,
  setPAccount,
  setPBuyer,
  setPName,
  setPPrice,
  setPReceipt,
  setPType,
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
      {[['daacquistare', 'Da acquistare', toBuy.length], ['acquistato', 'Acquistato', purchases.length]].map(([k, l, n]) => (
        <button
          key={k}
          onClick={() => setListaSection(k)}
          className={bottoneScelta('linguetta', 'sezione', listaSection === k, 'piccolo')}
        >
          {l}{n > 0 ? ` (${n})` : ''}
        </button>
      ))}
    </div>

    {/* ===== DA ACQUISTARE ===== */}
    {listaSection === 'daacquistare' && (
    <div className="bg-white p-4 rounded-lg border-2 border-[#5C4A3C]/30 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
        <h3 className="font-rustic text-lg text-[#2D392C]">Da Acquistare</h3>
        {toBuy.length > 0 && (
          <span className="text-[10px] uppercase font-bold text-gray-500">{toBuy.length} {toBuy.length === 1 ? 'voce' : 'voci'}</span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newBuyName}
          onChange={(e) => setNewBuyName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addToBuy()}
          placeholder="Cosa serve…"
          className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
        />
        <input
          type="text"
          value={newBuyQty}
          onChange={(e) => setNewBuyQty(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addToBuy()}
          placeholder="Q.tà"
          className="w-20 shrink-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm text-center focus:outline-none focus:border-[#2D392C]"
        />
        <button onClick={addToBuy} aria-label="Aggiungi alla lista" className={bottoneIcona('pieno', 'shrink-0')}>+</button>
      </div>

      {/* Ricerca: la lista della spesa arriva a decine di voci, e
          ritrovarne una scorrendo col dito e' impraticabile. */}
      {toBuy.length > 4 && (
        <div className="flex gap-2">
          <input
            type="text"
            value={toBuyQuery}
            onChange={(e) => setToBuyQuery(e.target.value)}
            placeholder="Cerca nella lista…"
            className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
          />
          {toBuyQuery && (
            <button onClick={() => setToBuyQuery('')} aria-label="Azzera la ricerca" className={bottoneIcona('neutro', 'shrink-0')}>&times;</button>
          )}
        </div>
      )}

      {toBuy.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Lista vuota. Scrivi cosa serve e premi +.</p>
      ) : (() => {
        const q = toBuyQuery.trim().toLowerCase();
        const visibili = toBuy.filter((it) => !q ||
          (it.name || '').toLowerCase().includes(q) ||
          (it.qty || '').toLowerCase().includes(q));
        return (
        <>
        {q && (
          <div className="flex items-center justify-between bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20">
            <span className="text-[10px] uppercase font-bold text-gray-500">
              {visibili.length} {visibili.length === 1 ? 'voce trovata' : 'voci trovate'} su {toBuy.length}
            </span>
          </div>
        )}
        {visibili.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Niente in lista corrisponde a "{toBuyQuery}".</p>
        ) : (
        <ul className="space-y-2">
          {visibili.map((it) => (
            <li key={it.id} className="bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
              <div className="flex items-center gap-2">
                <div className="flex-grow min-w-0">
                  <div className="text-sm font-bold text-[#2D392C] leading-snug break-words">{it.name}</div>
                  {it.qty && <div className="text-[10px] text-gray-500">Quantità: {it.qty}</div>}
                </div>
                {/* Lo scontrino si allega al momento dell'acquisto,
                    nella maschera di "Segna come acquistata": è lì che
                    si ha in mano, non mentre si scrive la lista. */}
                {receipts[it.id] && (
                  <button onClick={() => setViewReceipt(receipts[it.id])} aria-label="Vedi scontrino" className={bottoneIcona('pieno', 'shrink-0')}>📷</button>
                )}
                <button onClick={() => removeToBuy(it.id)} aria-label="Rimuovi" className={bottoneIcona('distruttivo', 'shrink-0')}>&times;</button>
              </div>
              <button
                onClick={() => setBuying({ id: it.id, name: it.name, qty: it.qty, price: '', buyer: '', type: 'alimentare', account: 'comune' })}
                className={bottone('bruno', 'piccolo', 'mt-2 w-full')}
              >
                Segna come acquistata
              </button>
            </li>
          ))}
        </ul>
        )}
        </>
        );
      })()}
      <p className="text-[9px] text-gray-400 italic">Quando una voce viene acquistata passa in "Acquistato": lì si mettono prezzo, acquirente e la foto dello scontrino.</p>
    </div>
    )}

    {/* ===== ACQUISTATO: inserimento manuale + cronologia ===== */}
    {listaSection === 'acquistato' && (<>
    {/* Inserimento manuale: chiuso, si apre a richiesta */}
    {!manualOpen ? (
      <button
        onClick={() => setManualOpen(true)}
        className="w-full bg-white p-3 rounded-lg border-2 border-dashed border-[#8F9E8B]/60 text-[#2D392C] hover:bg-[#E2EAE4] flex items-center justify-center gap-2"
      >
        <span className="text-lg leading-none">＋</span>
        <span className="font-bold uppercase text-xs tracking-wide">Aggiungi un prodotto a mano</span>
      </button>
    ) : (
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2">
        <h3 className="font-rustic text-lg text-[#2D392C]">Prodotto acquistato</h3>
        <div className="flex items-center gap-2 shrink-0">
          <label
            title="Scontrino: scatta una foto o scegli dalla galleria"
            aria-label="Allega scontrino"
            className={`cursor-pointer px-3 py-2 rounded border-2 text-lg leading-none ${pReceipt ? 'bg-[#2D392C] border-[#2D392C]' : 'bg-white border-[#8F9E8B]/50 hover:bg-[#E2EAE4]'}`}
          >
            📷
            <input type="file" accept="image/*" onChange={onReceiptFile} className="hidden" />
          </label>
          <button
            onClick={() => setManualOpen(false)}
            aria-label="Chiudi la maschera"
            className={bottoneIcona('neutro')}
          >
            &times;
          </button>
        </div>
      </div>
      <p className="text-[10px] text-gray-500 -mt-1">Per un prodotto che non era in "Da acquistare".</p>

      {pReceipt && (
        <div className="flex items-center gap-3 bg-[#F0F4F1]/60 p-2 rounded border border-[#8F9E8B]/30">
          <img src={pReceipt} alt="Scontrino" className="w-12 h-12 object-cover rounded" />
          <span className="flex-grow text-xs text-[#2D392C] font-bold">Scontrino allegato ✓</span>
          <button onClick={() => setPReceipt(null)} aria-label="Rimuovi foto" className={bottoneIcona('distruttivo')}>&times;</button>
        </div>
      )}

      <div>
        <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Nome</label>
        <input
          type="text"
          value={pName}
          onChange={(e) => setPName(e.target.value)}
          placeholder="Es. Pasta, Acqua, Piatti…"
          className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Acquirente</label>
        {renderBuyerSelect(pBuyer, setPBuyer)}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Prezzo (€)</label>
          <input
            type="number" min="0" step="0.01" inputMode="decimal"
            value={pPrice}
            onChange={(e) => setPPrice(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPurchase()}
            placeholder="0.00"
            className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Tipologia</label>
          <select
            value={pType}
            onChange={(e) => setPType(e.target.value)}
            className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold focus:outline-none focus:border-[#2D392C]"
          >
            {Object.keys(PURCHASE_TYPES).map((k) => (
              <option key={k} value={k}>{PURCHASE_TYPES[k]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conto su cui addebitare cibo e bevande. La logistica è sempre
          comune, quindi per quella il menu non serve. */}
      {pType !== 'logistica' && (
        <div>
          <label className="block text-[11px] uppercase font-bold text-gray-500 mb-1">Conto</label>
          <select
            value={pAccount}
            onChange={(e) => setPAccount(e.target.value)}
            className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm font-bold focus:outline-none focus:border-[#2D392C]"
          >
            <option value="comune">Conto comune</option>
            <option value="sep">Conto separato</option>
          </select>
          {pAccount === 'sep' && (
            <p className="text-[9px] mt-1 leading-snug text-[#5C4A3C]">
              {sepDays.length === 0
                ? '⚠ Nessun giorno spuntato come "conto separato": vai in Calendario e spunta i giorni, altrimenti questa spesa non sa fra chi dividersi.'
                : `Si dividerà solo fra chi era presente ai pasti dei ${sepDays.length} giorni spuntati in Calendario.`}
            </p>
          )}
        </div>
      )}

      <button onClick={addPurchase} className={bottone('primario', 'grande', 'w-full')}>
        Salva
      </button>
    </div>
    )}

    {/* Cronologia acquisti */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
        <h3 className="font-rustic text-lg text-[#2D392C]">Cronologia acquisti</h3>
        {purchases.length > 0 && (
          <span className="font-rustic font-bold text-[#2D392C]">{money(totals.overallTotal)} €</span>
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
            placeholder="Cerca fra le spese…"
            className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
          />
          {purchaseQuery && (
            <button onClick={() => setPurchaseQuery('')} aria-label="Azzera la ricerca" className={bottoneIcona('neutro', 'shrink-0')}>&times;</button>
          )}
        </div>
      )}

      {/* Stessa spesa registrata da due persone: il totale si gonfia e
          la quota di tutti sale. Non si tocca niente da soli — di
          mezzo ci sono i soldi — ma si dice dov'è, con la matita e la
          × già a portata di mano qui sotto. */}
      {spesePotenzialmenteDoppie().map((g) => (
        <div key={g[0].id} className="bg-[#D97706]/10 border border-[#D97706]/40 rounded p-2.5 mb-3">
          <p className="text-[10px] text-[#5C4A3C] leading-snug">
            <span className="font-bold">"{g[0].name}" da {money(posNum(g[0].price))} € è registrata {g.length} volte</span>
            {g.some((x) => (x.buyer || '') !== (g[0].buyer || ''))
              ? <> (da {[...new Set(g.map((x) => x.buyer || '—'))].join(' e ')})</>
              : null}.
            {' '}Se è la stessa spesa messa da due persone, il totale è gonfiato e la quota di tutti sale:
            cancellane una qui sotto con la <span className="font-bold">×</span>. Se sono due spese davvero
            diverse, lascia stare — o cambia un nome per non ricascarci.
          </p>
        </div>
      ))}

      {purchases.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nessun acquisto registrato. Compila il form qui sopra e premi Salva.</p>
      ) : (() => {
        const q = purchaseQuery.trim().toLowerCase();
        const visibili = purchases.slice().reverse().filter((p) => !q ||
          (p.name || '').toLowerCase().includes(q) ||
          (p.buyer || '').toLowerCase().includes(q) ||
          (PURCHASE_TYPES[p.type] || '').toLowerCase().includes(q));
        const sommaVisibili = visibili.reduce((s, p) => s + posNum(p.price), 0);
        return (
        <>
        {q && (
          <div className="flex items-center justify-between bg-[#F0F4F1]/60 px-3 py-2 rounded border border-[#8F9E8B]/20 mb-2">
            <span className="text-[10px] uppercase font-bold text-gray-500">
              {visibili.length} {visibili.length === 1 ? 'voce trovata' : 'voci trovate'} su {purchases.length}
            </span>
            <span className="font-rustic font-bold text-[#2D392C] text-sm">{money(sommaVisibili)} €</span>
          </div>
        )}
        {visibili.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nessuna spesa corrisponde a "{purchaseQuery}".</p>
        ) : (
        <ul className="space-y-2">
          {visibili.map((p) => (
            // Due livelli: sopra il nome del prodotto, che ha tutta la
            // riga per sé (prima veniva tagliato dalle etichette e dal
            // prezzo che gli stavano accanto); sotto le informazioni.
            <li key={p.id} className="bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-bold text-[#2D392C] leading-snug break-words min-w-0">{p.name}</span>
                <span className="font-rustic font-bold text-[#2D392C] shrink-0 whitespace-nowrap">{money(posNum(p.price))} €</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap items-center gap-1 min-w-0 flex-grow">
                  <span className="text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#8F9E8B]">{PURCHASE_TYPES[p.type] || p.type}</span>
                  {p.account === 'sep' && p.type !== 'logistica' && (
                    <span className="text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#5C4A3C]">Separato</span>
                  )}
                  {p.fromList && <span className="text-[8px] uppercase font-bold text-white px-1.5 py-0.5 rounded bg-[#5C4A3C]">acquistata</span>}
                  <span className="text-[9px] text-gray-400 basis-full">
                    {p.buyer ? <span className="text-[#5C4A3C] font-bold">{p.buyer}</span> : <span className="italic">acquirente non indicato</span>}
                    {p.at && ` · ${new Date(p.at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} ${new Date(p.at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                </div>
                {receipts[p.id] ? (
                  <button onClick={() => setViewReceipt(receipts[p.id])} aria-label="Vedi scontrino" className={bottoneIcona('pieno', 'shrink-0')}>📷</button>
                ) : (
                  <label title="Scontrino: scatta una foto o scegli dalla galleria" aria-label="Allega scontrino" className="shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-[#8F9E8B]/50 bg-white text-sm leading-none hover:bg-[#E2EAE4]">
                    📷
                    <input type="file" accept="image/*" onChange={(e) => attachReceiptTo(e, p.id)} className="hidden" />
                  </label>
                )}
                <button onClick={() => openEditPurchase(p)} aria-label="Correggi" title="Correggi questa spesa" className={bottoneIcona('neutro', 'shrink-0')}>✏️</button>
                <button onClick={() => removePurchase(p.id)} aria-label="Rimuovi" className={bottoneIcona('distruttivo', 'shrink-0')}>&times;</button>
              </div>
            </li>
          ))}
        </ul>
        )}
        </>
        );
      })()}
      <p className="text-[9px] text-gray-400 italic mt-2">Manca uno scontrino? Tocca 📷 sulla voce: puoi scattarlo o scegliere una foto dalla galleria, anche dopo. Le foto si sincronizzano tra i dispositivi del campo e sono incluse nel backup.</p>
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
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm space-y-3">
      <h3 className="font-rustic text-lg border-b border-[#8F9E8B]/40 pb-2 text-[#2D392C]">Aggiungi attrezzatura</h3>
      <input
        type="text"
        value={newEquipText}
        onChange={(e) => setNewEquipText(e.target.value)}
        placeholder="Es. Corda, gazebo, tanica…"
        className="w-full p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded text-sm focus:outline-none focus:border-[#2D392C]"
      />
      <div>
        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Acquirente (facoltativo)</label>
        {renderBuyerSelect(newEquipBuyer, setNewEquipBuyer)}
      </div>
      <div className="flex gap-2">
        <input
          type="number" min="0" step="0.01" inputMode="decimal"
          value={newEquipPrice}
          onChange={(e) => setNewEquipPrice(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addEquip()}
          placeholder="Prezzo (€)"
          className="flex-grow min-w-0 p-2.5 bg-[#F0F4F1]/50 border border-[#8F9E8B]/30 rounded font-bold"
        />
        <button onClick={addEquip} className={bottone('primario', 'normale', 'shrink-0')}>Aggiungi</button>
      </div>
      <p className="text-[9px] text-gray-400">Spunta una voce quando l'hai acquistata: il suo prezzo entra nelle Spese Totali (come logistica). Con 📷 alleghi lo scontrino (foto o galleria), anche dopo.</p>
    </div>

    {/* Elenco attrezzatura */}
    <div className="bg-white p-4 rounded-lg border-2 border-[#2D392C]/20 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#8F9E8B]/40 pb-2 mb-3">
        <h3 className="font-rustic text-lg text-[#2D392C]">Attrezzatura</h3>
        {equipment.length > 0 && (
          <span className="text-[10px] uppercase font-bold text-gray-500">
            {equipment.filter((e) => !e.bought).length} da comprare
          </span>
        )}
      </div>
      {equipment.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Nessuna attrezzatura. Aggiungi la prima voce qui sopra.</p>
      ) : (
        <>
        <ul className="space-y-2">
          {equipment.map((e) => (
            // Nome sulla sua riga, prezzo e comandi sotto: in fila su una
            // riga sola il titolo restava schiacciato in due centimetri e
            // non si leggeva più.
            <li key={e.id} className="bg-[#F0F4F1]/60 p-2.5 rounded border border-[#8F9E8B]/20">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleEquipBought(e.id)}
                  aria-label={e.bought ? 'Segna da comprare' : 'Segna acquistato'}
                  className={`w-6 h-6 shrink-0 rounded border-2 flex items-center justify-center font-bold mt-0.5 ${e.bought ? 'bg-[#2D392C] border-[#2D392C] text-white' : 'bg-white border-[#8F9E8B]'}`}
                >
                  {e.bought ? '✓' : ''}
                </button>
                <div className="flex-grow min-w-0">
                  <div className={`text-sm leading-snug break-words ${e.bought ? 'line-through text-gray-500' : 'text-[#2D392C]'}`}>{e.text}</div>
                  {e.buyer && <div className="text-[9px] text-[#5C4A3C] font-bold break-words">{e.buyer}</div>}
                </div>
                <span className={`font-rustic font-bold shrink-0 ${e.bought ? 'text-[#2D392C]' : 'text-gray-400'}`}>{money(posNum(e.price))} €</span>
              </div>
              <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[#8F9E8B]/20">
                {receipts[e.id] ? (
                  <button onClick={() => setViewReceipt(receipts[e.id])} aria-label="Vedi scontrino" className={bottoneIcona('pieno', 'shrink-0')}>📷</button>
                ) : (
                  <label title="Scontrino: scatta una foto o scegli dalla galleria" aria-label="Allega scontrino" className="shrink-0 cursor-pointer px-2 py-1 rounded border-2 border-[#8F9E8B]/50 bg-white text-sm leading-none hover:bg-[#E2EAE4]">
                    📷
                    <input type="file" accept="image/*" onChange={(ev) => attachReceiptTo(ev, e.id)} className="hidden" />
                  </label>
                )}
                <button onClick={() => openEditEquip(e)} aria-label="Correggi" title="Correggi questa voce" className={bottoneIcona('neutro', 'shrink-0')}>✏️</button>
                <button onClick={() => removeEquip(e.id)} aria-label="Rimuovi" className={bottoneIcona('distruttivo', 'shrink-0')}>&times;</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-2 border-t border-[#8F9E8B]/30 space-y-1">
          <div className="flex justify-between text-[11px] text-gray-500">
            <span className="uppercase font-bold">Previsto (tutto)</span>
            <span className="font-bold">{money(equipPlannedTotal)} €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] uppercase font-bold text-[#2D392C]">Acquistato (nelle spese)</span>
            <span className="font-rustic font-bold text-[#2D392C]">{money(equipBoughtTotal)} €</span>
          </div>
        </div>
        </>
      )}
    </div>
  </div>
  );
};
