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
    if (!pwd) { setError('Scrivi la password.'); return; }
    setBusy(true);
    setError('');
    try {
      const digest = await derivePassword(pwd);
      if (digest === null) {
        setError('Questo browser non può verificare la password: apri l\'app su https (l\'indirizzo pubblicato) invece di una copia locale.');
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
        setError(`Password sbagliata. Troppi tentativi: riprova fra ${secs} secondi.`);
      } else {
        setError(`Password sbagliata. ${5 - fails} ${5 - fails === 1 ? 'tentativo' : 'tentativi'} prima dell'attesa.`);
      }
      setPwd('');
    } catch (e) {
      setError('Verifica non riuscita. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#2D392C] flex flex-col items-center justify-center text-[#F0F4F1] z-50 px-8">
      <div className="w-28 h-28 mb-5 rounded-full overflow-hidden shadow-2xl border-4 border-[#8F9E8B] bg-[#F0F4F1] shrink-0">
        <img src="./logo.png" alt={`Logo ${BRAND.groupName}`} className="w-full h-full object-cover" />
      </div>
      <h1 className="font-rustic text-2xl tracking-widest text-[#8F9E8B] text-center">{BRAND.splashLine1}</h1>
      <h2 className="font-rustic text-lg tracking-widest text-[#F0F4F1] text-center mb-6">{BRAND.splashLine2}</h2>

      <div className="w-full max-w-xs space-y-3">
        {reason && (
          <div className="bg-[#1F271E] border border-[#8F9E8B]/30 rounded p-3 mb-1">
            <p className="text-[11px] text-[#F0F4F1] leading-snug">{reason}</p>
          </div>
        )}
        <label className="block text-[10px] uppercase tracking-widest text-[#8F9E8B] font-bold">Password del campo</label>
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
            className="flex-grow min-w-0 p-3 rounded bg-[#1F271E] border-2 border-[#8F9E8B]/40 text-[#F0F4F1] placeholder-[#8F9E8B]/50 focus:outline-none focus:border-[#8F9E8B] disabled:opacity-50"
          />
          <button
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Nascondi la password' : 'Mostra la password'}
            className="shrink-0 px-3 rounded bg-[#1F271E] border-2 border-[#8F9E8B]/40 text-lg leading-none hover:border-[#8F9E8B]"
          >
            {show ? '🙈' : '👁️'}
          </button>
        </div>

        <button
          onClick={submit}
          disabled={busy || waitLeft > 0}
          className="w-full py-3 rounded bg-[#8F9E8B] text-[#1F271E] font-bold uppercase text-sm tracking-widest hover:brightness-110 disabled:opacity-50"
        >
          {busy ? 'Verifica…' : waitLeft > 0 ? `Attendi ${waitLeft} s` : 'Entra'}
        </button>

        {error && <p className="text-[11px] text-[#F0A0A0] leading-snug">{error}</p>}
        <p className="text-[10px] text-[#8F9E8B]/80 leading-snug">
          {(LOCK && LOCK.hint) || 'Chiedi la password a chi organizza il campo.'}
        </p>
      </div>

      <p className="absolute bottom-4 left-0 right-0 text-center text-[9px] tracking-wide text-[#8F9E8B]/70 px-6">
        {BRAND.credits}
      </p>
    </div>
  );
}

