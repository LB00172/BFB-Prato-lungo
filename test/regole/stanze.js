// Le regole Firestore, provate provando a violarle.
//
// Questa prova non sta in `npm test` e non apre un browser: gira contro
// l'EMULATORE Firestore, che e' l'unico posto dove una regola si comporta
// come si comportera' in produzione. Si lancia con `npm run regole`.
//
// Perche' esiste: le regole sono l'unica cosa, in tutto il progetto, che
// separa i dati di venti persone da chiunque passi di li'. Sono anche
// l'unica cosa che non si puo' provare leggendo il codice — una regola
// sbagliata non da' errore, da' accesso. E una regola scritta e mai vista
// negare qualcosa non e' una regola: e' una speranza (CLAUDE.md, regola 5).
//
// Il grosso delle verifiche qui dentro e' quindi fatto di cose che devono
// FALLIRE. Una prova che controlla solo che il proprietario possa scrivere
// passerebbe anche con `allow read, write: if true`.
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, getDocs, Timestamp } = require('firebase/firestore');

const RADICE = path.join(__dirname, '..', '..');
const CONDIVISO = 'campo@brigatabandone.it';
// L'impronta del codice d'ingresso: qui un valore qualsiasi, perche' a
// calcolarla e' il telefono (improntaPassword) e le regole si limitano a
// confrontare due stringhe. E' esattamente quello che fanno in produzione.
const IMPRONTA = 'e3b0c44298fc1c149afbf4c8996fb924';

let fails = 0;
let checks = 0;
const ok = (msg, cond) => {
  checks++;
  if (cond) console.log('OK   ' + msg);
  else { fails++; console.log('KO   ' + msg); }
};

// assertFails/assertSucceeds lanciano: qui diventano un si'/no, cosi' una
// verifica rossa non porta via con se' tutte quelle dopo.
const negato = async (msg, azione) => {
  let esito = false;
  try { await assertFails(azione()); esito = true; } catch (e) { esito = false; }
  ok(msg, esito);
};
const permesso = async (msg, azione) => {
  let esito = false;
  try { await assertSucceeds(azione()); esito = true; } catch (e) { esito = false; }
  ok(msg, esito);
};

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'bandone-prova',
    firestore: {
      host: '127.0.0.1',
      port: 8092,
      rules: fs.readFileSync(path.join(RADICE, 'firestore.rules'), 'utf8'),
    },
  });

  // Chi gioca. Il proprietario ha l'indirizzo verificato: e' la condizione
  // per creare una stanza, ed e' la stessa riga della tabella di auth.js.
  const anna = env.authenticatedContext('anna', { email: 'anna@example.com', email_verified: true }).firestore();
  const bruno = env.authenticatedContext('bruno', { email: 'bruno@example.com', email_verified: true }).firestore();
  const carla = env.authenticatedContext('carla', { email: 'carla@example.com', email_verified: true }).firestore();
  const nonVerificato = env.authenticatedContext('dino', { email: 'dino@example.com', email_verified: false }).firestore();
  const condiviso = env.authenticatedContext('vecchio', { email: CONDIVISO, email_verified: true }).firestore();
  const ospite = env.unauthenticatedContext().firestore();

  // Si riparte sempre da un database vuoto. Senza, la prova passa la prima
  // volta e basta: al secondo giro le stanze create nel § 5 esistono gia', la
  // create diventa una update, e la verifica diventa rossa per un motivo che
  // non ha niente a che fare con le regole. L'ho scoperto sabotando: due
  // sabotaggi diversi facevano fallire la stessa verifica estranea.
  await env.clearFirestore();

  // Lo stato di partenza si scrive AGGIRANDO le regole: serve una stanza che
  // esiste gia' per poter provare cosa succede a chi ci gira intorno, e
  // costruirla passando dalle regole vorrebbe dire provare le regole con le
  // regole.
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'rooms/K7RX2MQP'), { nome: 'Prato Lungo 2027', proprietario: 'anna' });
    await setDoc(doc(db, 'rooms/K7RX2MQP/private/join'), { impronta: IMPRONTA });
    await setDoc(doc(db, 'rooms/K7RX2MQP/members/anna'), { ruolo: 'proprietario', nome: 'Anna' });
    await setDoc(doc(db, 'rooms/K7RX2MQP/members/bruno'), { ruolo: 'redattore', nome: 'Bruno' });
    await setDoc(doc(db, 'rooms/K7RX2MQP/dati/presenze'), { roba: 1 });
    // Il campo 2026, com'e' oggi, piu' la stanza che porta lo stesso codice:
    // e' su questa coincidenza che regge il ponte.
    await setDoc(doc(db, 'camps/Bandone'), { roba: 1 });
    await setDoc(doc(db, 'camps/Bandone/receipts/uno'), { roba: 1 });
    await setDoc(doc(db, 'rooms/Bandone/members/carla'), { ruolo: 'redattore', nome: 'Carla' });
  });

  console.log('\n1) Il segreto non lo legge nessuno');
  // Se questa cede, cede tutto: chi legge l'impronta puo' entrare in ogni
  // stanza senza conoscerne il codice.
  await negato('il proprietario NON legge l\'impronta del codice',
    () => getDoc(doc(anna, 'rooms/K7RX2MQP/private/join')));
  await negato('e nemmeno un membro', () => getDoc(doc(bruno, 'rooms/K7RX2MQP/private/join')));
  await negato('ne\' un estraneo', () => getDoc(doc(carla, 'rooms/K7RX2MQP/private/join')));
  await negato('ne\' un ospite senza account', () => getDoc(doc(ospite, 'rooms/K7RX2MQP/private/join')));
  // Anche l'elenco: chiedere la collezione invece del documento e' il modo
  // piu' vecchio di aggirare una regola scritta sul singolo documento.
  await negato('e nemmeno chiedendo l\'elenco invece del documento',
    () => getDocs(collection(anna, 'rooms/K7RX2MQP/private')));

  console.log('\n2) Si entra col codice, e solo con quello');
  await negato('senza l\'impronta non si entra',
    () => setDoc(doc(carla, 'rooms/K7RX2MQP/members/carla'), { ruolo: 'redattore', nome: 'Carla' }));
  await negato('con l\'impronta sbagliata nemmeno',
    () => setDoc(doc(carla, 'rooms/K7RX2MQP/members/carla'), { ruolo: 'redattore', nome: 'Carla', prova: 'sbagliata' }));
  // IL caso: chi entra non si sceglie il ruolo. Senza questa riga, il primo
  // che entra si scrive proprietario e amministra la stanza di un altro.
  await negato('entrando non ci si fa proprietari',
    () => setDoc(doc(carla, 'rooms/K7RX2MQP/members/carla'), { ruolo: 'proprietario', nome: 'Carla', prova: IMPRONTA }));
  await negato('e non si scrive la scheda di un altro',
    () => setDoc(doc(carla, 'rooms/K7RX2MQP/members/bruno'), { ruolo: 'redattore', nome: 'Finta', prova: IMPRONTA }));
  await permesso('col codice giusto si entra, da redattore',
    () => setDoc(doc(carla, 'rooms/K7RX2MQP/members/carla'), { ruolo: 'redattore', nome: 'Carla', prova: IMPRONTA }));

  console.log('\n3) I dati del campo: il lettore guarda, il redattore scrive');
  await permesso('un membro legge i dati', () => getDoc(doc(bruno, 'rooms/K7RX2MQP/dati/presenze')));
  await permesso('un redattore scrive', () => setDoc(doc(bruno, 'rooms/K7RX2MQP/dati/presenze'), { roba: 2 }));
  await negato('un estraneo non legge niente',
    () => getDoc(doc(nonVerificato, 'rooms/K7RX2MQP/dati/presenze')));
  await negato('e non scrive niente',
    () => setDoc(doc(nonVerificato, 'rooms/K7RX2MQP/dati/presenze'), { roba: 3 }));
  await negato('un ospite senza account nemmeno',
    () => getDoc(doc(ospite, 'rooms/K7RX2MQP/dati/presenze')));

  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'rooms/K7RX2MQP/members/carla'), { ruolo: 'lettore', nome: 'Carla' });
  });
  // Il lettore serve a far vedere i conti a chi ha pagato senza lasciargli
  // riscrivere le presenze di tutti: se questa cede, il ruolo non esiste.
  await permesso('il lettore guarda', () => getDoc(doc(carla, 'rooms/K7RX2MQP/dati/presenze')));
  await negato('ma non scrive', () => setDoc(doc(carla, 'rooms/K7RX2MQP/dati/presenze'), { roba: 4 }));

  console.log('\n4) Amministrare la stanza');
  await permesso('il proprietario cambia le date', () => updateDoc(doc(anna, 'rooms/K7RX2MQP'), { nome: 'Prato Lungo 2028' }));
  await negato('un redattore no', () => updateDoc(doc(bruno, 'rooms/K7RX2MQP'), { nome: 'Mia' }));
  // Cedere una stanza e' un gesto che merita una strada sua: non deve
  // succedere per via di un campo cambiato di nascosto.
  await negato('e nessuno si prende la stanza riscrivendo il proprietario',
    () => updateDoc(doc(anna, 'rooms/K7RX2MQP'), { proprietario: 'bruno' }));
  await negato('un redattore non cancella la stanza', () => deleteDoc(doc(bruno, 'rooms/K7RX2MQP')));

  await permesso('il proprietario promuove un membro',
    () => updateDoc(doc(anna, 'rooms/K7RX2MQP/members/bruno'), { ruolo: 'lettore' }));
  await negato('un membro non si promuove da solo',
    () => updateDoc(doc(bruno, 'rooms/K7RX2MQP/members/bruno'), { ruolo: 'proprietario' }));
  // Una stanza senza proprietario non la amministra piu' nessuno e non si
  // puo' nemmeno cancellare: e' il vicolo cieco da cui non si esce.
  await negato('il proprietario non si toglie da solo', () => deleteDoc(doc(anna, 'rooms/K7RX2MQP/members/anna')));
  await permesso('ma si esce da soli', () => deleteDoc(doc(carla, 'rooms/K7RX2MQP/members/carla')));

  console.log('\n5) Creare una stanza');
  await permesso('con un indirizzo verificato si crea',
    () => setDoc(doc(anna, 'rooms/NUOVA111'), { nome: 'Campo', proprietario: 'anna' }));
  // Un campo senza un padrone raggiungibile non si amministra: e' la stessa
  // riga della tabella dei permessi di auth.js ('creare' vuole REGISTRATO),
  // scritta dove conta davvero.
  await negato('senza indirizzo verificato no',
    () => setDoc(doc(nonVerificato, 'rooms/NUOVA222'), { nome: 'Campo', proprietario: 'dino' }));
  await negato('e non si crea una stanza intestata a un altro',
    () => setDoc(doc(anna, 'rooms/NUOVA333'), { nome: 'Campo', proprietario: 'bruno' }));
  await negato('un ospite senza account non crea niente',
    () => setDoc(doc(ospite, 'rooms/NUOVA444'), { nome: 'Campo', proprietario: 'x' }));

  // ---------- 5-bis) E poi la stanza si usa ----------
  // Qui sopra si creava il documento della stanza e ci si fermava. Ma creare
  // una stanza non e' scrivere un documento: sono TRE scritture di fila, ed
  // e' la terza che decideva tutto. Lo stato di partenza del § 0 la scheda
  // del proprietario se la scrive AGGIRANDO le regole — cosi' ogni verifica
  // qui sotto partiva da un mondo che le regole non sapevano costruire, e la
  // strada che lo costruisce non la provava nessuno. Risultato: creare una
  // stanza lasciava il proprietario chiuso fuori dalla stanza appena creata,
  // e trentanove verifiche verdi non se ne accorgevano.
  //
  // Si rifanno esattamente i tre setDoc di StanzaCloud.crea, nell'ordine, con
  // i permessi veri. Se questa sezione cede, la versione pubblica non ha un
  // primo passo.
  console.log('\n5-bis) Creare una stanza e potercela usare');
  await permesso('1. nasce il documento della stanza',
    () => setDoc(doc(bruno, 'rooms/NUOVA555'), { nome: 'Campo', proprietario: 'bruno', creataIl: Date.now() }));
  await permesso('2. chi l\'ha creata ci scrive il segreto',
    () => setDoc(doc(bruno, 'rooms/NUOVA555/private/join'), { impronta: IMPRONTA }));
  await permesso('3. e la propria scheda da proprietario',
    () => setDoc(doc(bruno, 'rooms/NUOVA555/members/bruno'), { ruolo: 'proprietario', nome: 'Bruno' }));
  await permesso('poi legge la sua stanza', () => getDoc(doc(bruno, 'rooms/NUOVA555')));
  await permesso('e ci scrive i dati del campo',
    () => setDoc(doc(bruno, 'rooms/NUOVA555/dati/stato'), { roba: 1 }));

  // La meta' che deve fallire. Il ruolo di proprietario si scrive SOLO se il
  // documento della stanza dice che sei tu: altrimenti la seconda strada
  // aperta qui sopra sarebbe una porta di servizio per farsi padroni della
  // stanza di chiunque, senza nemmeno conoscerne il codice.
  await negato('un estraneo non si fa proprietario di una stanza altrui',
    () => setDoc(doc(carla, 'rooms/NUOVA555/members/carla'), { ruolo: 'proprietario', nome: 'Carla' }));
  await negato('e nemmeno portando l\'impronta giusta',
    () => setDoc(doc(carla, 'rooms/NUOVA555/members/carla'), { ruolo: 'proprietario', nome: 'Carla', prova: IMPRONTA }));
  await negato('il proprietario non scrive la scheda di un altro',
    () => setDoc(doc(bruno, 'rooms/NUOVA555/members/carla'), { ruolo: 'proprietario', nome: 'Carla' }));
  // Chi non ha creato niente resta fuori: il segreto lo scrive solo chi la
  // stanza l'ha fatta nascere.
  await negato('e il segreto di una stanza altrui non si riscrive',
    () => setDoc(doc(carla, 'rooms/NUOVA555/private/join'), { impronta: 'mia' }));

  // ---------- 6) Il campo 2026 qui dentro NON esiste ----------
  // Fino al 22 settembre questa sezione si chiamava "il ponte" e chiedeva il
  // contrario: che l'utente condiviso e i membri della stanza arrivassero
  // tutti e due a camps/<codice>. Serviva a far convivere due mondi nello
  // STESSO progetto Firebase. I progetti adesso sono due — `camp-ops` per la
  // versione pubblica, `brigata-bandone` per quella privata — e qui dentro
  // camps/ e' soltanto una collezione come un'altra, cioe' chiusa.
  //
  // Le verifiche sono rimaste, girate al rovescio, e sono piu' utili di
  // prima: se qualcuno incolla in questo progetto le vecchie regole — quelle
  // che avevano il ponte e l'utente condiviso — queste diventano rosse.
  // Cancellarle e basta avrebbe lasciato quel passo falso senza nessuno che
  // lo guarda.
  // ---------- 5-quater) Rientrare in una stanza di cui sei gia' membro ----------
  // Chi cambia telefono, o si rimette il codice dopo esserci gia' entrato,
  // rifa' la stessa cosa del primo ingresso: StanzaCloud.entra scrive la
  // propria scheda. Ma la seconda volta la scheda C'E' GIA', e per le regole
  // un setDoc su un documento che esiste e' una MODIFICA — che puo' fare solo
  // il proprietario, e mai sulla propria. Queste verifiche fissano le due
  // cose su cui entra() conta per non sbattere contro quel muro: rileggere la
  // propria scheda si puo', riscriverla no.
  console.log('\n5-quater) Rientrare dove si e\' gia\' dentro');
  await negato('un membro non puo\' riscriversi la scheda entrando di nuovo',
    () => setDoc(doc(bruno, 'rooms/K7RX2MQP/members/bruno'), { ruolo: 'redattore', nome: 'Bruno', prova: IMPRONTA }));
  await permesso('ma puo\' rileggerla, e sapere cosi\' che e\' gia\' dentro',
    () => getDoc(doc(bruno, 'rooms/K7RX2MQP/members/bruno')));
  await negato('mentre chi non e\' membro la propria scheda non la legge (non c\'e\')',
    () => getDoc(doc(nonVerificato, 'rooms/K7RX2MQP/members/dino')));

  // ---------- 5-ter) Il profilo e' tuo e di nessun altro ----------
  // users/<uid> tiene nome, cognome e indirizzo. La meta' che conta e' quella
  // che nega: un indirizzo email, una volta uscito, non si fa rientrare, e
  // qui dentro ci sono quelli di tutti quelli che useranno l'app.
  console.log('\n5-ter) Il profilo');
  await permesso('ognuno scrive il proprio profilo',
    () => setDoc(doc(anna, 'users/anna'), { nome: 'Anna', email: 'anna@example.com' }));
  await permesso('e se lo rilegge', () => getDoc(doc(anna, 'users/anna')));
  await negato('ma non scrive quello di un altro',
    () => setDoc(doc(bruno, 'users/anna'), { nome: 'Finta' }));
  // Nemmeno fra membri della stessa stanza: il nome che serve ai saldi sta in
  // members/<uid>, e per quello non c'e' bisogno dell'indirizzo di nessuno.
  await negato('e NON legge quello di un altro, nemmeno da compagno di stanza',
    () => getDoc(doc(bruno, 'users/anna')));
  await negato('un ospite senza account non ne legge nessuno',
    () => getDoc(doc(ospite, 'users/anna')));
  await negato('e non se ne scrive uno a caso',
    () => setDoc(doc(ospite, 'users/chiunque'), { nome: 'X' }));
  // La cancellazione dell'account (ROADMAP § 3, requisito di Google Play)
  // toglie il profilo prima dell'account: dopo, senza utente, le regole non
  // lo lascerebbero piu' toccare.
  await permesso('ognuno cancella il proprio profilo', () => deleteDoc(doc(anna, 'users/anna')));
  await negato('ma non quello di un altro', () => deleteDoc(doc(bruno, 'users/anna')));

  console.log('\n6) Il campo 2026 non abita in questo progetto');
  await negato('l\'utente condiviso non legge camps/',
    () => getDoc(doc(condiviso, 'camps/Bandone')));
  await negato('e non ci scrive', () => setDoc(doc(condiviso, 'camps/Bandone'), { roba: 2 }));
  await negato('nemmeno le sottoraccolte',
    () => getDoc(doc(condiviso, 'camps/Bandone/receipts/uno')));
  // Il membro di una stanza vede i dati della SUA stanza, non un campo che
  // porta lo stesso codice: la coincidenza dei nomi non e' piu' un permesso.
  await negato('un membro di stanza non arriva a camps/ col suo codice',
    () => getDoc(doc(carla, 'camps/Bandone')));
  await negato('e non ci scrive', () => setDoc(doc(carla, 'camps/Bandone'), { roba: 3 }));
  await negato('un estraneo resta fuori', () => getDoc(doc(bruno, 'camps/Bandone')));
  await negato('e un ospite senza account pure', () => getDoc(doc(ospite, 'camps/Bandone')));

  console.log('\n8) Il Pro e\' del campo, e nessun telefono se lo scrive');
  // Il Pro si accende perche' chi ha creato il campo ha pagato, e lo accende
  // il server che verifica l'acquisto (con la chiave di servizio, che le
  // regole non le guarda). Da qui dentro NESSUNO lo tocca: se potesse il
  // proprietario, se lo regalerebbe chiunque crei un campo.
  await negato('non si crea un campo gia\' Pro',
    () => setDoc(doc(anna, 'rooms/PROVAPRO'), { nome: 'Gratis?', proprietario: 'anna', pro: { attivo: true } }));
  await negato('il proprietario non si accende il Pro da solo',
    () => setDoc(doc(anna, 'rooms/K7RX2MQP'), { pro: { attivo: true } }, { merge: true }));
  await negato('e un membro nemmeno', () => setDoc(doc(bruno, 'rooms/K7RX2MQP'), { pro: { attivo: true } }, { merge: true }));
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'rooms/BCDFGHJK'), { nome: 'Pagato', proprietario: 'anna', pro: { attivo: true, fino: '2027-12-31' } });
    await setDoc(doc(c.firestore(), 'rooms/BCDFGHJK/members/anna'), { ruolo: 'proprietario', nome: 'Anna' });
  });
  await negato('non se lo allunga', () => setDoc(doc(anna, 'rooms/BCDFGHJK'),
    { pro: { attivo: true, fino: '2099-12-31' } }, { merge: true }));
  await negato('e non lo toglie', () => setDoc(doc(anna, 'rooms/BCDFGHJK'), { nome: 'Pagato', proprietario: 'anna' }));
  // L'altra meta': il Pro non deve bloccare il resto. Un campo Pro che non
  // si puo' piu' rinominare sarebbe un campo che ha pagato per peggiorare.
  await permesso('ma il proprietario di un campo Pro lo rinomina come prima',
    () => setDoc(doc(anna, 'rooms/BCDFGHJK'), { nome: 'Pagato e rinominato' }, { merge: true }));
  await permesso('e il campo gratuito resta suo come prima',
    () => setDoc(doc(anna, 'rooms/K7RX2MQP'), { nome: 'Prato Lungo 2027 bis' }, { merge: true }));

  console.log('\n9) L\'aiutante, il passaggio, e il Pro che non passa');
  // Una stanza a se', per non dipendere da quello che le prove sopra hanno
  // fatto a K7RX2MQP. Anna capogruppo col Pro, Bruno e Carla membri.
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'rooms/MNPQRSTV'), { nome: 'Passaggio', proprietario: 'anna', pro: { attivo: true } });
    await setDoc(doc(db, 'rooms/MNPQRSTV/members/anna'), { ruolo: 'proprietario', nome: 'Anna' });
    await setDoc(doc(db, 'rooms/MNPQRSTV/members/bruno'), { ruolo: 'redattore', nome: 'Bruno' });
    await setDoc(doc(db, 'rooms/MNPQRSTV/members/carla'), { ruolo: 'redattore', nome: 'Carla' });
  });
  const stanzaP = (db) => doc(db, 'rooms/MNPQRSTV');
  await negato('un membro non si nomina aiutante da solo',
    () => setDoc(stanzaP(bruno), { vice: 'bruno' }, { merge: true }));
  await negato('il capogruppo non nomina aiutante chi non è nel campo',
    () => setDoc(stanzaP(anna), { vice: 'dino' }, { merge: true }));
  await negato('e nemmeno se stesso', () => setDoc(stanzaP(anna), { vice: 'anna' }, { merge: true }));
  await permesso('il capogruppo nomina aiutante un membro',
    () => setDoc(stanzaP(anna), { vice: 'bruno' }, { merge: true }));
  await negato('l\'aiutante non si prende il campo da solo',
    () => setDoc(stanzaP(bruno), { proprietario: 'bruno' }, { merge: true }));
  await negato('il capogruppo non lo passa a chi non è l\'aiutante',
    () => updateDoc(stanzaP(anna), { proprietario: 'carla', vice: deleteField(), pro: deleteField() }));
  // IL caso: il Pro l'ha pagato chi se ne va, e non passa di mano.
  await negato('passandolo all\'aiutante il Pro non si porta dietro',
    () => updateDoc(stanzaP(anna), { proprietario: 'bruno', vice: deleteField() }));
  await permesso('lo passa all\'aiutante, e il Pro si spegne nello stesso gesto',
    () => updateDoc(stanzaP(anna), { proprietario: 'bruno', vice: deleteField(), pro: deleteField() }));
  // Dopo il passaggio la scheda di Anna dice ancora «proprietario» finché
  // non se ne va: non deve contare niente. Comanda il documento della stanza.
  await negato('dopo il passaggio chi se ne va non amministra più, anche se la sua scheda non è ancora sparita',
    () => setDoc(stanzaP(anna), { nome: 'Rubato' }, { merge: true }));
  await permesso('e può andarsene: la sua scheda la toglie da sé',
    () => deleteDoc(doc(anna, 'rooms/MNPQRSTV/members/anna')));
  await permesso('il nuovo capogruppo amministra', () => setDoc(stanzaP(bruno), { nome: 'Di Bruno' }, { merge: true }));
  await negato('ma il Pro non se lo riaccende', () => setDoc(stanzaP(bruno), { pro: { attivo: true } }, { merge: true }));

  console.log('\n9-bis) Due capigruppo: il secondo amministra, il primo resta il padrone');
  // Dal 30 settembre l'aiutante non aspetta che il capogruppo se ne vada: e'
  // un SECONDO capogruppo, che amministra subito — il capo sul posto accanto
  // a chi organizza. Ma tre cose restano del primo, che ha creato il campo e
  // l'ha pagato: chi e' il secondo, il passaggio del campo, cancellarlo.
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'rooms/DUECAPIX'), { nome: 'Due capi', proprietario: 'anna', vice: 'bruno', pro: { attivo: true } });
    await setDoc(doc(db, 'rooms/DUECAPIX/members/anna'), { ruolo: 'proprietario', nome: 'Anna' });
    await setDoc(doc(db, 'rooms/DUECAPIX/members/bruno'), { ruolo: 'redattore', nome: 'Bruno' });
    await setDoc(doc(db, 'rooms/DUECAPIX/members/carla'), { ruolo: 'redattore', nome: 'Carla' });
  });
  const due = (db) => doc(db, 'rooms/DUECAPIX');
  await permesso('il secondo capogruppo cambia nome e date', () => setDoc(due(bruno), { nome: 'Di tutti e due', inizio: '2027-08-01' }, { merge: true }));
  await permesso('e scrive le regole del campo', () => setDoc(due(bruno), { regole: ['Si parte alle otto.'] }, { merge: true }));
  await negato('un membro qualunque invece no', () => setDoc(due(carla), { nome: 'Di Carla' }, { merge: true }));
  await negato('il secondo non si sceglie un altro secondo', () => setDoc(due(bruno), { vice: 'carla' }, { merge: true }));
  await negato('e non si toglie il titolo per darlo a nessuno', () => updateDoc(due(bruno), { vice: deleteField() }));
  // IL caso: se il secondo potesse usare la strada del passaggio, si
  // prenderebbe il campo di chi l'ha creato, e con lui il posto del Pro.
  await negato('il secondo non si prende il campo con la strada del passaggio',
    () => updateDoc(due(bruno), { proprietario: 'bruno', vice: deleteField(), pro: deleteField() }));
  await negato('il secondo non tocca il Pro', () => updateDoc(due(bruno), { pro: deleteField() }));
  await negato('e non cancella il campo', () => deleteDoc(due(bruno)));
  await negato('e non riscrive la scheda del primo', () => setDoc(doc(bruno, 'rooms/DUECAPIX/members/anna'), { ruolo: 'redattore' }, { merge: true }));
  await negato('né la toglie', () => deleteDoc(doc(bruno, 'rooms/DUECAPIX/members/anna')));
  await permesso('il primo cambia il secondo', () => setDoc(due(anna), { vice: 'carla' }, { merge: true }));
  await negato('e chi non è più secondo non amministra più', () => setDoc(due(bruno), { nome: 'Ancora mio' }, { merge: true }));
  await permesso('mentre il nuovo secondo sì', () => setDoc(due(carla), { nome: 'Di Anna e Carla' }, { merge: true }));

  console.log('\n10) Le regole del campo le scrive il capogruppo');
  await permesso('il capogruppo scrive le regole',
    () => setDoc(stanzaP(bruno), { regole: ['Si lava a turno.'] }, { merge: true }));
  await negato('un membro no', () => setDoc(stanzaP(carla), { regole: ['Niente turni.'] }, { merge: true }));
  await permesso('il capogruppo scrive anche le dotazioni',
    () => setDoc(stanzaP(bruno), { dotazioni: [{ testo: 'Borraccia' }] }, { merge: true }));
  await negato('un membro le dotazioni non le tocca',
    () => setDoc(stanzaP(carla), { dotazioni: [] }, { merge: true }));
  await permesso('e un membro le legge', () => getDoc(stanzaP(carla)));
  await negato('un estraneo non le legge', () => getDoc(stanzaP(nonVerificato)));

  console.log('\n11) Le foto degli scontrini nel cloud sono del Pro');
  // Sono quello che costa davvero: spazio, e letture per ogni telefono del
  // campo. Nell'app il tasto non c'e' (Stanza.sbloccata('fotoCloud')), ma
  // l'app si smonta: qui sta la serratura. Il resto del campo — lo stato, il
  // meteo condiviso, gli archivi — si scrive come prima, Pro o no: si limita
  // la quantita', mai la correttezza.
  const giorno = 24 * 60 * 60 * 1000;
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'rooms/FOTOGRAT'), { nome: 'Gratis', proprietario: 'anna' });
    await setDoc(doc(db, 'rooms/FOTOGRAT/members/anna'), { ruolo: 'proprietario', nome: 'Anna' });
    await setDoc(doc(db, 'rooms/FOTOGRAT/members/bruno'), { ruolo: 'redattore', nome: 'Bruno' });
    await setDoc(doc(db, 'rooms/FOTOGRAT/members/carla'), { ruolo: 'lettore', nome: 'Carla' });
    await setDoc(doc(db, 'rooms/FOTOGRAT/dati/stato/receipts/vecchia'), { data: 'x' });
  });
  const scontrino = (db, id) => doc(db, 'rooms/FOTOGRAT/dati/stato/receipts/' + (id || 'p1'));
  // updateDoc e non setDoc con merge: il merge fonde anche DENTRO la mappa,
  // e la scadenza del passo prima resterebbe li' senza che nessuno l'abbia
  // scritta.
  const pro = (p) => env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'rooms/FOTOGRAT'), { pro: p }));
  await negato('in un campo gratuito la foto di uno scontrino non va nel cloud', () => setDoc(scontrino(bruno), { data: 'x' }));
  await negato('nemmeno quella del capogruppo', () => setDoc(scontrino(anna), { data: 'x' }));
  await permesso('ma lo stato del campo si scrive come sempre', () => setDoc(doc(bruno, 'rooms/FOTOGRAT/dati/stato'), { roba: 1 }));
  await permesso('e anche il meteo condiviso', () => setDoc(doc(bruno, 'rooms/FOTOGRAT/dati/stato/meta/weather'), { roba: 1 }));
  await permesso('e una foto che c\'era si toglie: togliere una spesa toglie il suo scontrino',
    () => deleteDoc(scontrino(bruno, 'vecchia')));
  await permesso('e le foto degli altri si guardano', () => getDocs(collection(bruno, 'rooms/FOTOGRAT/dati/stato/receipts')));

  await pro({ attivo: true, fino: '2999-12-31', scade: Timestamp.fromMillis(Date.now() + 30 * giorno) });
  await permesso('nel campo Pro la foto va nel cloud', () => setDoc(scontrino(bruno), { data: 'x' }));
  await negato('ma non la scrive chi il campo lo può solo guardare', () => setDoc(scontrino(carla, 'p2'), { data: 'x' }));

  await pro({ attivo: true, fino: '2000-01-01', scade: Timestamp.fromMillis(Date.now() - giorno) });
  await negato('scaduto il Pro, le foto nuove non vanno più nel cloud', () => setDoc(scontrino(bruno, 'p3'), { data: 'x' }));
  await negato('e quelle che ci sono non si riscrivono', () => setDoc(scontrino(bruno), { data: 'y' }));
  await permesso('ma si tolgono', () => deleteDoc(scontrino(bruno)));

  await pro({ attivo: false });
  await negato('un Pro spento non vale', () => setDoc(scontrino(bruno, 'p4'), { data: 'x' }));
  // Senza scadenza vale per sempre: e' il Pro che i campi avevano prima che
  // la scadenza esistesse (e quello delle prove qui sopra).
  await pro({ attivo: true });
  await permesso('un Pro acceso senza scadenza vale', () => setDoc(scontrino(bruno, 'p5'), { data: 'x' }));

  // Il registro degli acquisti e gli abbonati li scrive solo il server
  // (functions/index.js). Un telefono che ci scrivesse si farebbe abbonato
  // da solo, e il Pro dei suoi campi nuovi arriverebbe gratis.
  await negato('nessun telefono si scrive abbonato', () => setDoc(doc(anna, 'abbonati/anna'), { scade: Timestamp.fromMillis(Date.now() + 365 * giorno) }));
  await negato('né legge chi lo è', () => getDoc(doc(anna, 'abbonati/anna')));
  await negato('né scrive il registro degli acquisti', () => setDoc(doc(anna, 'acquisti/qualcosa'), { uid: 'anna' }));
  await negato('né lo legge', () => getDoc(doc(anna, 'acquisti/qualcosa')));

  console.log('\n7) Quello che non e\' previsto e\' chiuso');
  // Una collezione nuova non deve nascere aperta per distrazione.
  await negato('una collezione mai pensata non si legge', () => getDoc(doc(anna, 'qualcosa/altro')));
  await negato('e non si scrive', () => setDoc(doc(anna, 'qualcosa/altro'), { roba: 1 }));
  await negato('nemmeno dall\'utente condiviso', () => setDoc(doc(condiviso, 'qualcosa/altro'), { roba: 1 }));

  await env.cleanup();
  console.log(`\n${checks} verifiche — ${fails ? fails + ' FALLITE' : 'nessun problema'}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FATAL', e && e.message); process.exit(1); });
