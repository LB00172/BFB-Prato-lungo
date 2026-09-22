// ============================================================================
//  SCHERMATA DI BLOCCO
// ============================================================================
function LockScreen({ onUnlock, reason }) {
  const [pwd, setPwd] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [waitLeft, setWaitLeft] = useState(0);

  // Attesa progressiva dopo troppi tentativi sbagliati: rende inutile
  // provare le password a raffica.
  useEffect(() => {
    const tick = () => {
      const until = Number(localStorage.getItem(UNTIL_KEY) || 0);
      setWaitLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  const submit = async () => {
    if (busy || waitLeft > 0) return;
    if (!pwd) { setError(L.t('blocco.scrivi')); return; }
    setBusy(true);
    setError('');
    try {
      const digest = await derivePassword(pwd);
      if (digest === null) {
        setError(L.t('blocco.senzaHttps'));
        return;
      }
      if (digest === LOCK.hash) {
        sessionPassword = pwd;   // solo in memoria, per l'accesso al database
        rememberUnlock();
        setPwd('');
        onUnlock();
        return;
      }
      const fails = Number(localStorage.getItem(FAIL_KEY) || 0) + 1;
      scriviLocale(FAIL_KEY, String(fails));
      if (fails >= 5) {
        const secs = Math.min(600, 30 * Math.pow(2, fails - 5));
        scriviLocale(UNTIL_KEY, String(Date.now() + secs * 1000));
        setError(L.t('blocco.attesa', secs));
      } else {
        setError(L.t('blocco.restano', 5 - fails));
      }
      setPwd('');
    } catch (e) {
      setError(L.t('blocco.nonRiuscita'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-bosco flex flex-col items-center justify-center text-carta z-50 px-8">
      <div className="w-28 h-28 mb-5 rounded-full overflow-hidden shadow-2xl border-4 border-salvia bg-carta shrink-0">
        <img src="./logo.png" alt={L.t('blocco.logo', BRAND.groupName)} className="w-full h-full object-cover" />
      </div>
      <h1 className="font-rustic text-titolo tracking-widest text-salvia text-center">{BRAND.splashLine1}</h1>
      <h2 className="font-rustic text-grande tracking-widest text-carta text-center mb-6">{BRAND.splashLine2}</h2>

      <div className="w-full max-w-xs space-y-3">
        {reason && (
          <div className="bg-notte border border-salvia/30 rounded p-3 mb-1">
            <p className="text-piccolo text-carta leading-snug">{reason}</p>
          </div>
        )}
        <label className="block text-piccolo uppercase tracking-widest text-salvia font-bold">{L.t('blocco.password')}</label>
        <div className="flex gap-2">
          <input
            type={show ? 'text' : 'password'}
            value={pwd}
            autoFocus
            autoComplete="current-password"
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            disabled={waitLeft > 0}
            placeholder="••••••••"
            className="flex-grow min-w-0 p-3 rounded bg-notte border-2 border-salvia/40 text-carta placeholder-salvia/50 focus:outline-none focus:border-salvia disabled:opacity-50"
          />
          <button
            onClick={() => setShow((s) => !s)}
            aria-label={L.t(show ? 'blocco.nascondi' : 'blocco.mostra')}
            className="shrink-0 px-3 rounded bg-notte border-2 border-salvia/40 text-grande leading-none hover:border-salvia"
          >
            {show ? '🙈' : '👁️'}
          </button>
        </div>

        <button
          onClick={submit}
          disabled={busy || waitLeft > 0}
          className="w-full py-3 rounded bg-salvia text-notte font-bold uppercase text-normale tracking-widest hover:brightness-110 disabled:opacity-50"
        >
          {busy ? L.t('blocco.verifica') : waitLeft > 0 ? L.t('blocco.attendi', waitLeft) : L.t('blocco.entra')}
        </button>

        {error && <p className="text-piccolo text-[#F0A0A0] leading-snug">{error}</p>}
        <p className="text-piccolo text-salvia/80 leading-snug">
          {(LOCK && LOCK.hint) || L.t('blocco.chiedi')}
        </p>
      </div>

      <p className="absolute bottom-4 left-0 right-0 text-center text-minuto tracking-wide text-salvia/70 px-6">
        {BRAND.credits}
      </p>
    </div>
  );
}

