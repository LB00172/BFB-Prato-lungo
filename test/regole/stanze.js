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
const { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } = require('firebase/firestore');

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

  console.log('\n7) Quello che non e\' previsto e\' chiuso');
  // Una collezione nuova non deve nascere aperta per distrazione.
  await negato('una collezione mai pensata non si legge', () => getDoc(doc(anna, 'qualcosa/altro')));
  await negato('e non si scrive', () => setDoc(doc(anna, 'qualcosa/altro'), { roba: 1 }));
  await negato('nemmeno dall\'utente condiviso', () => setDoc(doc(condiviso, 'qualcosa/altro'), { roba: 1 }));

  await env.cleanup();
  console.log(`\n${checks} verifiche — ${fails ? fails + ' FALLITE' : 'nessun problema'}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FATAL', e && e.message); process.exit(1); });
