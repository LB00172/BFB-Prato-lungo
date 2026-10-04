// ---------- La mia lista (4 ottobre) ----------
// La checklist privata: «cosa mi porto». Lo stato sta in
// src/79b-usa-mia-lista.jsx; qui si disegna. Dice in cima, con parole
// semplici, chi la vede — cioe' nessuno —, perche' e' la prima domanda di chi
// scrive qualcosa di suo dentro un'app di gruppo.
const schedaMiaLista = ({ miaLista, goTo }) => {
  const m = miaLista;
  const daFare = m.lista.voci.filter((x) => !x.fatto);
  const fatte = m.lista.voci.filter((x) => x.fatto);
  const riga = (x) => (
    <li key={x.id} data-voce-mia={x.testo} className="flex items-center gap-2 py-1 min-h-11">
      <button
        onClick={() => m.spunta(x.id)}
        aria-pressed={!!x.fatto}
        aria-label={x.testo}
        className={bottoneScelta('casella', 'casella', !!x.fatto, 'simbolo')}
      >{x.fatto ? icona('fatto', 'w-5 h-5') : null}</button>
      <span className={`flex-grow min-w-0 break-words text-normale ${x.fatto ? 'line-through text-gray-400' : 'text-bosco'}`}>{x.testo}</span>
      <button onClick={() => m.togli(x.id)} aria-label={L.t('miaLista.togli', x.testo)} className={bottoneSottile('distruttivo')}>
        {icona('togli', 'w-4 h-4')}
      </button>
    </li>
  );
  return (
    <div data-scheda="mia-lista" className="space-y-4">
      <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
        <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('miaLista.titolo')}</h3>
        <p data-chi-la-vede className="text-piccolo text-gray-500 leading-snug">
          {L.t(m.privataNelCloud ? 'miaLista.soloTu' : 'miaLista.soloQui')}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            data-nuova-voce
            value={m.nuova}
            onChange={(e) => m.setNuova(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') m.aggiungi(); }}
            placeholder={L.t('miaLista.esempio')}
            className="flex-grow p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco"
          />
          <button onClick={m.aggiungi} aria-label={L.t('miaLista.aggiungi')} className={bottoneIcona('pieno')}>+</button>
        </div>
        {m.lista.voci.length === 0 ? (
          <p className="text-normale text-gray-400 italic">{L.t('miaLista.vuota')}</p>
        ) : (
          <>
            <ul className="divide-y divide-salvia/20">{daFare.map(riga)}</ul>
            {fatte.length > 0 && (
              <div>
                <h4 className="font-rustic text-normale text-salvia mt-2 mb-1">{L.t('miaLista.fatte', fatte.length)}</h4>
                <ul className="divide-y divide-salvia/20">{fatte.map(riga)}</ul>
                <button onClick={m.togliFatte} className={bottone('testuale', 'minuscolo', 'mt-1')}>{L.t('miaLista.togliFatte')}</button>
              </div>
            )}
          </>
        )}
      </div>
      {/* Le cose del gruppo hanno gia' il loro posto: dirlo qui evita che
          qualcuno scriva nella lista privata «portare il gas per tutti». */}
      {FEATURES.compiti && (
        <p className="text-piccolo text-gray-500 leading-snug px-1">
          {L.t('miaLista.delGruppo')}{' '}
          <button onClick={() => goTo('compiti')} className={bottone('testuale', 'minuscolo', 'inline-flex')}>{L.t('area.compiti')}</button>
        </p>
      )}
    </div>
  );
};
