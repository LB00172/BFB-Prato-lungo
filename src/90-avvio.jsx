
// ---------- Un cassetto per campo (cassetti.js) ----------
// Le chiavi di sempre contengono i dati del campo in gioco; quelli degli
// altri campi stanno messi da parte. Si allinea una volta qui, PRIMA che App
// legga qualunque cosa: se il codice e' cambiato mentre l'app era chiusa, i
// dati giusti devono essere al loro posto quando i useState li leggono.
const primoCassetto = window.Cassetti
  ? window.Cassetti.allinea(localStorage,
    window.Cassetti.codiceInGioco(localStorage, window.CloudSync, window.CAMP_CODE_DEFAULT))
  : null;

// Cambiare campo con l'app accesa vuol dire smontarla, scambiare i cassetti
// e rimontarla. In quest'ordine, e l'ordine e' il punto: con App montata un
// effetto qualsiasi — il salvataggio dei membri, la copia della fascia, il
// registro — potrebbe scrivere i dati di A nelle chiavi mentre ci stanno gia'
// quelli di B. Smontata, non scrive nessuno. E rimontarla invece di
// ricaricare la pagina lascia al loro posto il cloud finto delle prove e la
// password del database, che sta in memoria.
//
// `eredita` porta di la' le due cose che chi ha cambiato campo si aspetta di
// ritrovare: la scheda su cui era, e com'e' andato lo scambio. E `rimontata`,
// perche' il saluto col logo e' dell'apertura dell'app, non di ogni campo.
const Radice = () => {
  const [giro, setGiro] = useState({ n: 0, verso: null, eredita: { cassetto: primoCassetto } });
  useEffect(() => {
    if (giro.verso === null) return;
    const esito = window.Cassetti.allinea(localStorage, giro.verso);
    setGiro((g) => ({ n: g.n + 1, verso: null, eredita: Object.assign({}, g.eredita, { cassetto: esito, rimontata: true }) }));
  }, [giro.verso]);
  if (giro.verso !== null) return null;
  return (
    <App
      key={giro.n}
      eredita={giro.eredita}
      cambiaCampo={(codice, eredita) => setGiro((g) => ({ n: g.n, verso: codice, eredita }))}
    />
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<Radice />);
