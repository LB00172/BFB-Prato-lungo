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

  console.log('\n6) Il ponte: il campo 2026 regge da tutte e due le parti');
  // Venti telefoni fanno cosi' in questo momento, e i rimborsi si stanno
  // ancora chiudendo. Se questa diventa rossa, l'app si svuota in mano a
  // gente che sta facendo i conti.
  await permesso('l\'utente condiviso legge il campo 2026', () => getDoc(doc(condiviso, 'camps/Bandone')));
  await permesso('e scrive', () => setDoc(doc(condiviso, 'camps/Bandone'), { roba: 2 }));
  await permesso('comprese le sottoraccolte', () => getDoc(doc(condiviso, 'camps/Bandone/receipts/uno')));
  // L'altra campata: chi e' membro della stanza con lo stesso codice.
  await permesso('un membro della stanza legge lo stesso campo', () => getDoc(doc(carla, 'camps/Bandone')));
  await permesso('e ci scrive', () => setDoc(doc(carla, 'camps/Bandone'), { roba: 3 }));
  // E chi non e' ne' l'uno ne' l'altro resta fuori: senza questa, il ponte
  // sarebbe una porta aperta.
  await negato('ma un estraneo resta fuori', () => getDoc(doc(bruno, 'camps/Bandone')));
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
