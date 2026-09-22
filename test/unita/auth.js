// Chi sei, e cosa ti lascia fare l'app.
//
// La regola che questa prova difende piu' di tutte e' la nota di prodotto del
// § 1: **il login non deve diventare un muro**. Si entra in un campo con il
// solo codice, e ci si segna le presenze, senza account. Se un giorno
// qualcuno stringe quella tabella, meta' del gruppo resta fuori il primo
// giorno di campo — quando non c'e' linea per registrarsi e nessuno ha voglia
// di farlo. E' un difetto che non si vede scrivendo il codice: si vede in
// montagna, e li' non si sistema.
//
// Le altre due che contano: che promuovere un anonimo resti l'unica strada
// (uscire e registrarsi da capo cambia uid e stacca i dati dal loro
// proprietario), e che tre codici d'errore diversi diano lo stesso messaggio
// — dire "questo indirizzo non esiste" e' un modo per sapere chi e' iscritto,
// una email alla volta.
const path = require('path');
const { ok, fine } = require('../lib/app');
require(path.resolve(__dirname, '..', '..', 'auth.js'));
const A = (typeof globalThis !== 'undefined' && globalThis.Auth) || null;

ok('auth.js si carica ed espone le regole',
  !!(A && typeof A.stato === 'function' && typeof A.puo === 'function'
     && typeof A.validaRegistrazione === 'function' && typeof A.motivo === 'function'));
if (!A) { fine(); }

// ---------- I quattro stati ----------
{
  ok(`senza utente si e' ospiti (${A.stato(null)})`, A.stato(null) === A.OSPITE);
  ok(`e anche con undefined (${A.stato(undefined)})`, A.stato(undefined) === A.OSPITE);
  ok('un utente anonimo e\' anonimo', A.stato({ isAnonymous: true }) === A.ANONIMO);
  ok('un registrato senza email verificata e\' "da verificare"',
    A.stato({ isAnonymous: false, emailVerified: false }) === A.DA_VERIFICARE);
  ok('con l\'email verificata e\' registrato',
    A.stato({ isAnonymous: false, emailVerified: true }) === A.REGISTRATO);
  // Google certifica l'indirizzo da solo: chi entra col tasto Google non deve
  // aspettare nessuna email.
  ok('chi entra con Google e\' registrato subito',
    A.stato({ isAnonymous: false, emailVerified: true, providerId: 'google.com' }) === A.REGISTRATO);
  // I nomi italiani dei campi funzionano quanto quelli di Firebase: il resto
  // dell'app non deve portarsi dietro l'oggetto originale.
  ok('gli stessi campi in italiano danno lo stesso stato',
    A.stato({ isAnonimo: true }) === A.ANONIMO
    && A.stato({ emailVerificata: true }) === A.REGISTRATO);
}

// ---------- Il muro che non deve esserci ----------
{
  const tutti = [A.OSPITE, A.ANONIMO, A.DA_VERIFICARE, A.REGISTRATO];
  const fuori = tutti.filter((s) => !A.puo('entrare', s));
  ok(`entrare in un campo col codice si puo' da TUTTI e quattro gli stati (${tutti.length - fuori.length}/4)`
    + (fuori.length ? ' — FUORI: ' + fuori.join(', ') : ''), fuori.length === 0);

  const senzaModifica = tutti.filter((s) => !A.puo('modificare', s));
  ok(`e anche segnare presenze e spese (${tutti.length - senzaModifica.length}/4)`
    + (senzaModifica.length ? ' — FUORI: ' + senzaModifica.join(', ') : ''), senzaModifica.length === 0);

  ok('creare un campo invece richiede un account verificato',
    A.puo('creare', A.REGISTRATO)
    && !A.puo('creare', A.DA_VERIFICARE)
    && !A.puo('creare', A.ANONIMO)
    && !A.puo('creare', A.OSPITE));
  ok('e amministrarlo pure',
    A.puo('amministrare', A.REGISTRATO) && !A.puo('amministrare', A.ANONIMO));
  ok('uscire ha senso solo per chi e\' entrato con un nome',
    A.puo('uscire', A.REGISTRATO) && A.puo('uscire', A.DA_VERIFICARE)
    && !A.puo('uscire', A.ANONIMO) && !A.puo('uscire', A.OSPITE));

  // Un refuso nel nome dell'azione non deve concedere niente: se "puo" dicesse
  // di si' a un'azione che non conosce, "amministare" (con la t mangiata)
  // aprirebbe l'amministrazione a chiunque, e nessuna prova se ne accorgerebbe.
  ok('un\'azione che non esiste non si concede',
    !A.puo('amministare', A.REGISTRATO) && !A.puo('', A.REGISTRATO) && !A.puo(undefined, A.REGISTRATO));
}

// ---------- La registrazione ----------
{
  const buona = { nome: 'Mario', cognome: 'Rossi', email: 'mario@example.com', password: 'cavallo-batteria' };
  ok(`una registrazione completa non ha problemi (${A.validaRegistrazione(buona).length})`,
    A.validaRegistrazione(buona).length === 0);

  const manca = (campo) => {
    const d = Object.assign({}, buona);
    d[campo] = '';
    return A.validaRegistrazione(d);
  };
  ok('senza nome lo dice', manca('nome').includes('auth.serveNome'));
  ok('senza cognome lo dice', manca('cognome').includes('auth.serveCognome'));
  ok('senza email lo dice', manca('email').includes('auth.serveEmail'));
  ok('senza password lo dice', manca('password').includes('auth.servePassword'));

  // Il nome fatto di soli spazi e' come non averlo.
  ok('un nome di soli spazi non conta',
    A.validaRegistrazione(Object.assign({}, buona, { nome: '   ' })).includes('auth.serveNome'));

  ok('un indirizzo senza chiocciola non passa',
    A.validaRegistrazione(Object.assign({}, buona, { email: 'mario.example.com' })).includes('auth.emailNonValida'));
  ok('e nemmeno uno senza punto nel dominio',
    A.validaRegistrazione(Object.assign({}, buona, { email: 'mario@example' })).includes('auth.emailNonValida'));

  // Il controllo e' largo di proposito: questi indirizzi sono validi e
  // un'espressione regolare severa li rifiuterebbe, che e' il modo piu'
  // rapido di far scappare qualcuno dalla registrazione.
  ['mario+campo@example.com', 'm@example.co.uk', 'nome.cognome@studenti.universita.it'].forEach((e) => {
    ok(`"${e}" e' un indirizzo valido e passa`,
      !A.validaRegistrazione(Object.assign({}, buona, { email: e })).includes('auth.emailNonValida'));
  });

  ok('sette caratteri sono pochi',
    A.validaRegistrazione(Object.assign({}, buona, { password: 'abcdefg' })).includes('auth.passwordCorta'));
  ok('otto vanno bene',
    A.validaRegistrazione(Object.assign({}, buona, { password: 'abcdefgh' })).length === 0);
  ok('una password di soli spazi non e\' una password',
    A.validaRegistrazione(Object.assign({}, buona, { password: '        ' })).includes('auth.passwordVuota'));
  // L'indirizzo e' l'unica cosa che chi attacca conosce di sicuro.
  ok('la password non puo\' essere l\'indirizzo',
    A.validaRegistrazione(Object.assign({}, buona, { password: 'mario@example.com' })).includes('auth.passwordUgualeEmail'));
  ok('nemmeno scritta con le maiuscole',
    A.validaRegistrazione(Object.assign({}, buona, { password: 'Mario@Example.com' })).includes('auth.passwordUgualeEmail'));

  // Niente esplode con dati assenti: la maschera puo' chiamare la validazione
  // mentre l'utente sta ancora scrivendo.
  ok('la validazione regge anche senza niente',
    A.validaRegistrazione().length === 4 && A.validaRegistrazione({}).length === 4);
}

// ---------- Promuovere, non ricominciare ----------
{
  ok('un anonimo si promuove', A.promuovibile({ isAnonymous: true }));
  ok('un ospite no: non c\'e\' niente da promuovere', !A.promuovibile(null));
  ok('e nemmeno chi e\' gia\' registrato',
    !A.promuovibile({ isAnonymous: false, emailVerified: true })
    && !A.promuovibile({ isAnonymous: false, emailVerified: false }));
}

// ---------- I codici di Firebase ----------
{
  const uguali = ['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].map((c) => A.motivo({ code: c }));
  ok(`i tre codici che direbbero chi e' iscritto danno lo stesso messaggio (${uguali[0]})`,
    uguali[0] === 'auth.credenzialiSbagliate' && uguali[1] === uguali[0] && uguali[2] === uguali[0]);

  ok('l\'indirizzo gia\' usato invece si puo\' dire',
    A.motivo({ code: 'auth/email-already-in-use' }) === 'auth.emailGiaUsata');
  ok('la mancanza di linea si riconosce',
    A.motivo({ code: 'auth/network-request-failed' }) === 'auth.senzaLinea');
  ok('un metodo spento in console si riconosce',
    A.motivo({ code: 'auth/operation-not-allowed' }) === 'auth.metodoSpento');

  // Chiudere la finestra di Google non e' un errore: e' un ripensamento.
  ok('la finestra di Google chiusa non produce nessun avviso',
    A.motivo({ code: 'auth/popup-closed-by-user' }) === null
    && A.motivo({ code: 'auth/cancelled-popup-request' }) === null);

  // Questi tre sono arrivati dal campo, non dalla fantasia: provando
  // l'anteprima, "Entra con Google" rispondeva "Non e' riuscito. Riprova." —
  // che e' il ripiego per un codice che la tabella non conosce, ed e' il
  // consiglio piu' inutile possibile quando il problema e' che il dominio non
  // e' autorizzato: riprovando succede identico.
  ok(`un dominio non autorizzato lo dice, e dice dove si sistema (${A.motivo({ code: 'auth/unauthorized-domain' })})`,
    A.motivo({ code: 'auth/unauthorized-domain' }) === 'auth.dominioNonAutorizzato');
  // La finestra BLOCCATA non e' la finestra CHIUSA: chiuderla e' un
  // ripensamento e non merita un avviso, bloccata e' un guasto da spiegare.
  // Su telefono succede spesso.
  ok('la finestra bloccata dal browser e\' un\'altra cosa dal ripensamento',
    A.motivo({ code: 'auth/popup-blocked' }) === 'auth.finestraBloccata'
    && A.motivo({ code: 'auth/popup-closed-by-user' }) === null);
  ok('e un ambiente che non sa aprire finestre dice la stessa cosa',
    A.motivo({ code: 'auth/operation-not-supported-in-this-environment' }) === 'auth.finestraBloccata');

  ok('un codice mai visto ha comunque un messaggio',
    A.motivo({ code: 'auth/qualcosa-di-nuovo' }) === 'auth.nonRiuscito');
  ok('e anche nessun codice affatto',
    A.motivo(null) === 'auth.nonRiuscito' && A.motivo({}) === 'auth.nonRiuscito');
  ok('una stringa nuda vale quanto un errore',
    A.motivo('auth/too-many-requests') === 'auth.troppiTentativi');
}

// ---------- Il profilo, e cosa NON ci finisce ----------
{
  const p = A.profilo({ email: 'Mario@Example.COM' }, { nome: ' Mario ', cognome: 'Rossi ', password: 'segreta' });
  ok(`il profilo tiene nome e cognome ripuliti ("${p.nome}" "${p.cognome}")`,
    p.nome === 'Mario' && p.cognome === 'Rossi');
  ok(`l'indirizzo scende in minuscolo (${p.email})`, p.email === 'mario@example.com');
  // Una password dentro users/<uid> sarebbe la fine: Firestore lo legge
  // chiunque abbia accesso alla room.
  ok('la password NON entra nel profilo', !('password' in p) && JSON.stringify(p).indexOf('segreta') === -1);
  ok('c\'e\' la data di creazione', typeof p.creatoIl === 'number' && p.creatoIl > 0);

  ok(`il nome da mostrare e' nome e cognome (${A.nomeVisibile(p)})`, A.nomeVisibile(p) === 'Mario Rossi');
  ok('col solo nome basta quello', A.nomeVisibile({ nome: 'Mario', email: 'x@y.z' }) === 'Mario');
  // Nei Saldi il nome finisce accanto a quanto uno deve: l'indirizzo di tutti
  // non e' una cosa da spargere in giro.
  ok(`senza nome si mostra la parte davanti alla chiocciola (${A.nomeVisibile({ email: 'mario.rossi@example.com' })})`,
    A.nomeVisibile({ email: 'mario.rossi@example.com' }) === 'mario.rossi');
  ok('e mai l\'indirizzo intero',
    A.nomeVisibile({ email: 'mario@example.com' }).indexOf('@') === -1);
  ok('senza niente non esplode', A.nomeVisibile(null) === '' && A.nomeVisibile({}) === '');
}

fine();
