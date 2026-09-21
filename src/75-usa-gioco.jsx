// ---------- "Aiuta Bandy": stato, classifica, inizio e fine partita ----------
//
// Primo pezzo di stato che esce da App() (ROADMAP.md § 14). Si comincia da
// qui perche' il gioco e' l'unica parte dell'app che non tocca i conti: se
// qualcosa va storto si vede subito e non si porta via una presenza.
//
// NON e' un componente React: e' un hook, cioe' una funzione che chiama altri
// hook. La differenza conta — un componente aggiungerebbe un confine di
// riconciliazione e cambierebbe quando le cose si ridisegnano; un hook no,
// l'albero prodotto resta identico. E' la stessa scelta fatta per le schede.
//
// L'ordine delle chiamate a useState non cambia fra un disegno e l'altro:
// e' l'unica regola che React impone, ed e' rispettata perche' l'hook si
// chiama sempre, in un punto fisso di App().
const usaGioco = ({ activeTab, cloudConnesso }) => {
  const [gamePlayer, setGamePlayer] = useState(() => localStorage.getItem('cambusa_player') || '');
  const [gameRunning, setGameRunning] = useState(false);
  const [gameBest, setGameBest] = useState(() => Number(load('cambusa_best', 0)) || 0);
  const [leaderboard, setLeaderboard] = useState([]);

  const refreshLeaderboard = () => {
    const CS = window.CloudSync;
    if (CS && CS.listScores) CS.listScores().then(setLeaderboard).catch(() => {});
  };

  // Si scarica la classifica solo entrando nella sezione del gioco: all'avvio
  // dell'app non interessa a nessuno, e in montagna ogni lettura si paga.
  useEffect(() => {
    if (activeTab === 'gioco') refreshLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, cloudConnesso]);

  const startGame = () => {
    const n = gamePlayer.trim();
    if (!n) { window.alert(L.t('gioco.scriviNome')); return; }
    scriviLocale('cambusa_player', n);
    setGameRunning(true);
  };

  const endGame = (score) => {
    if (score > gameBest) {
      setGameBest(score);
      scriviLocale('cambusa_best', JSON.stringify(score));
    }
    const CS = window.CloudSync;
    if (CS && CS.submitScore) {
      CS.submitScore(gamePlayer.trim(), score).then(refreshLeaderboard).catch(() => {});
    }
  };

  return {
    gamePlayer, setGamePlayer, gameRunning, setGameRunning, gameBest,
    leaderboard, refreshLeaderboard, startGame, endGame,
  };
};
