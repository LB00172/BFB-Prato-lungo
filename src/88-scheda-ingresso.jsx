// ---------- L'ingresso ----------
// Due pezzi, e il secondo esiste per via del primo.
//
// schedaAccount e' la tessera dell'account — entrare con Google, con email e
// password, registrarsi — che fino al 26 settembre 2026 stava soltanto in
// fondo alle Impostazioni. E' uscita di li' quando e' nata la schermata
// d'apertura, che deve mostrare la STESSA tessera: due copie dello stesso
// modulo di accesso divergono alla prima correzione, e un difetto riparato
// in una resta vivo nell'altra. Lo spostamento e' verificato col confronto
// del DOM: Impostazioni e' identica al carattere a com'era prima.
//
// Il titolo e' facoltativo per un motivo solo: sulla schermata d'apertura la
// parola "Account" sopra i bottoni non dice niente che il logo non dica gia'.
// `onCancella`: chi disegna la tessera e sa in che stanza si e' (Impostazioni)
// passa come cancellare l'account; la schermata d'apertura no, perche' li'
// un account da cancellare non c'e' mai.
const schedaAccount = ({ account, senzaTitolo, onCancella }) => (
    <div className="bg-scheda p-4 rounded-lg border-2 border-bosco/20 shadow-sm space-y-3">
      {!senzaTitolo && <h3 className="font-rustic text-grande border-b border-salvia/40 pb-2 text-bosco">{L.t('auth.titolo')}</h3>}

      {account.stato === 'registrato' && (
        <>
          <p className="text-piccolo text-bosco leading-snug">{frase('auth.entratoCome', window.Auth.nomeVisibile({ nome: account.utente && account.utente.nome, email: account.utente && account.utente.email }))}</p>
          <button onClick={account.esci} disabled={account.occupato} className={bottone('secondario', 'normale', 'w-full')}>{L.t('auth.esci')}</button>
          {onCancella && (
            <button
              onClick={() => { if (window.confirm(L.t('auth.confermaCancella'))) onCancella(); }}
              disabled={account.occupato}
              className={bottone('distruttivo', 'minuscolo', 'w-full')}
            >{L.t('auth.cancellaAccount')}</button>
          )}
        </>
      )}

      {account.stato === 'daVerificare' && (
        <>
          <p className="text-piccolo text-legno leading-snug">{frase('auth.daVerificare', (account.utente && account.utente.email) || '')}</p>
          <div className="flex gap-2">
            <button onClick={account.controllaVerifica} disabled={account.occupato} className={bottone('primario', 'normale', 'flex-1')}>{L.t('auth.hoVerificato')}</button>
            <button onClick={account.rimandaVerifica} disabled={account.occupato} className={bottone('secondario', 'normale', 'flex-1')}>{L.t('auth.rimandaEmail')}</button>
          </div>
          <button onClick={account.esci} disabled={account.occupato} className={bottone('testuale', 'minuscolo', 'w-full')}>{L.t('auth.esci')}</button>
          {onCancella && (
            <button
              onClick={() => { if (window.confirm(L.t('auth.confermaCancella'))) onCancella(); }}
              disabled={account.occupato}
              className={bottone('distruttivo', 'minuscolo', 'w-full')}
            >{L.t('auth.cancellaAccount')}</button>
          )}
        </>
      )}

      {(account.stato === 'ospite' || account.stato === 'anonimo') && (
        <>
          <p className="text-piccolo text-gray-500 leading-snug">{frase('auth.aCosaServe')}</p>
          <button onClick={account.entraConGoogle} disabled={account.occupato} className={bottone('primario', 'normale', 'w-full')}>{L.t('auth.conGoogle')}</button>

          {!account.modo ? (
            <div className="flex items-center gap-2">
              <span className="flex-grow h-px bg-salvia/30"></span>
              <span className="text-minuto uppercase tracking-widest text-gray-400 shrink-0">{L.t('auth.oppure')}</span>
              <span className="flex-grow h-px bg-salvia/30"></span>
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
                <div data-modulo-registrazione className="grid grid-cols-2 gap-2">
                  <input type="text" value={account.nome} onChange={(e) => account.setNome(e.target.value)}
                    placeholder={L.t('auth.nome')} autoComplete="given-name"
                    className={CASELLA_ACCOUNT} />
                  <input type="text" value={account.cognome} onChange={(e) => account.setCognome(e.target.value)}
                    placeholder={L.t('auth.cognome')} autoComplete="family-name"
                    className={CASELLA_ACCOUNT} />
                  <input type="text" data-citta value={account.citta} onChange={(e) => account.setCitta(e.target.value)}
                    placeholder={L.t('auth.citta')} autoComplete="address-level2"
                    className={CASELLA_ACCOUNT} />
                  <select data-paese value={account.paese} onChange={(e) => account.setPaese(e.target.value)}
                    aria-label={L.t('auth.paese')} autoComplete="country"
                    className={CASELLA_ACCOUNT}>
                    <option value="">{L.t('auth.paese')}</option>
                    {paesiInLingua().map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                  </select>
                </div>
              )}
              <input type="email" inputMode="email" value={account.email} onChange={(e) => account.setEmail(e.target.value)}
                placeholder={L.t('auth.email')} autoComplete="email"
                className="w-full p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco" />
              <input type="password" value={account.password} onChange={(e) => account.setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (account.modo === 'entra' ? account.entraConEmail() : account.registrati())}
                placeholder={L.t('auth.password')} autoComplete={account.modo === 'entra' ? 'current-password' : 'new-password'}
                className="w-full p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco" />
              {account.modo === 'registra' && (
                <>
                  <input type="password" data-ripeti value={account.ripeti} onChange={(e) => account.setRipeti(e.target.value)}
                    placeholder={L.t('auth.ripetiPassword')} autoComplete="new-password"
                    className={CASELLA_ACCOUNT} />
                  {/* La lingua preferita: si sceglie fra quelle che l'app
                      parla, e l'app la prende subito. Parte da quella di
                      adesso — chi sta leggendo in italiano, di solito, vuole
                      l'italiano. */}
                  <div>
                    <span className="block text-minuto uppercase font-bold tracking-wide text-gray-500 mb-1.5">{L.t('auth.linguaPreferita')}</span>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.keys(window.Lingue.LINGUE).map((k) => (
                        <button key={k} data-lingua-preferita={k} aria-pressed={(account.linguaPreferita || L.codice) === k}
                          onClick={() => account.setLinguaPreferita(k)}
                          className={bottoneScelta('pillola', 'tenue', (account.linguaPreferita || L.codice) === k, 'minuscolo')}>
                          {window.Lingue.LINGUE[k].nome || k}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
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
      {account.problema && <p className="text-piccolo font-bold text-red-700 leading-snug">{L.t(account.problema, account.problemaDati != null ? account.problemaDati : (typeof window !== 'undefined' ? window.location.hostname : ''))}</p>}
      {account.fatto && <p className="text-piccolo text-bosco leading-snug">{L.t(account.fatto)}</p>}
      {/* Chi aspetta un'email che non arriva deve sapere a chi scrivere: e'
          il momento in cui un'app nuova si disinstalla. */}
      {EMAIL_SISTEMA && (account.modo === 'registra' || account.stato === 'daVerificare' || account.fatto === 'auth.controllaEmail') && (
        <p data-email-sistema className="text-minuto text-gray-500 leading-snug">
          {L.t('auth.aiuto')} <a href={'mailto:' + EMAIL_SISTEMA} className="underline text-bosco break-all">{EMAIL_SISTEMA}</a>
        </p>
      )}
    </div>
);

// Le caselle della tessera: una forma sola, scritta una volta.
const CASELLA_ACCOUNT = 'w-full min-w-0 p-2.5 bg-carta/50 border border-salvia/30 rounded text-normale focus:outline-none focus:border-bosco';

// I paesi con il nome nella lingua dell'app, in ordine alfabetico di quella
// lingua. I nomi li da' il browser (Intl.DisplayNames): nessuno li traduce a
// mano, e «Germania», «Alemania», «Allemagne» restano lo stesso DE. Un
// browser vecchio senza DisplayNames mostra il codice, che e' brutto ma
// giusto.
const paesiInLingua = () => {
  let nomi = null;
  try { nomi = new Intl.DisplayNames([L.locale], { type: 'region' }); } catch (e) { nomi = null; }
  return window.Auth.PAESI
    .map((c) => [c, (nomi && nomi.of(c)) || c])
    .sort((a, b) => a[1].localeCompare(b[1], L.locale));
};

// ---------- La schermata d'apertura ----------
// Quello che vede chi apre Camp Ops per la prima volta: il logo, e le strade
// per entrare. Compare solo quando TUTTE e due le cose mancano — un account
// vero e un campo — perche' ognuna delle due basta a sapere chi sei o dove
// vai:
//
//   - chi e' gia' entrato con Google o con email resta dentro, sempre: la
//     sessione la tiene Firebase, e questa schermata non la chiede di nuovo;
//   - chi ha gia' un campo (una stanza scelta, un codice salvato) non deve
//     ripassare di qui a ogni apertura: sarebbe un muro davanti a una porta
//     che ha gia' la chiave.
//
// La terza strada, "Ho un codice", e' la regola scritta in CLAUDE.md —
// l'account non e' un muro: per PARTECIPARE al campo di un altro basta il
// codice che ti ha mandato. L'account serve a creare e amministrare. Se la
// regola cambia (registrazione per tutti), si toglie questo bottone e basta:
// il resto della schermata non dipende da lui.
//
const schermataIngresso = ({ account, onCodice }) => (
  // data-schermata: il logo da solo non la distingue — c'e' anche nella
  // schermata di benvenuto che la precede e nel cassetto del menu dopo — e
  // una prova che cercava il logo misurava la schermata sbagliata.
  <div data-schermata="ingresso" className="min-h-screen bg-carta text-bosco flex flex-col items-center px-5 pt-10 pb-10">
    {/* mix-blend-darken: il crema del PNG non e' identico a `carta`, e senza
        si vedeva un quadrato appena diverso attorno al disegno. Cosi', canale
        per canale, vince il piu' scuro: dove il PNG e' crema resta la pagina,
        e il disegno — tutto piu' scuro del crema — resta com'e'. */}
    <img src="./logo.png" alt={BRAND.appTitle} className="w-52 h-52 object-contain mix-blend-darken" />
    <p className="-mt-2 text-normale text-legno text-center max-w-xs leading-snug">{BRAND.splashTagline}</p>

    <div className="w-full max-w-sm mt-8">
      {schedaAccount({ account, senzaTitolo: true })}
    </div>

    <div className="w-full max-w-sm mt-6 text-center">
      <button onClick={onCodice} className={bottone('secondario', 'normale', 'w-full')}>
        {L.t('ingresso.hoUnCodice')}
      </button>
      <p className="mt-2 text-piccolo text-salvia leading-snug">{L.t('ingresso.hoUnCodiceNota')}</p>
    </div>
  </div>
);
