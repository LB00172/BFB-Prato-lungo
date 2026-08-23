// Le regole del magazzino delle foto, senza aprire un browser.
//
// Due sole cose qui dentro decidono se si perde una foto o se si riempie di
// nuovo la memoria del telefono:
//
//   daScrivere        -> si tocca solo cio' che e' cambiato. Se sbaglia per
//                        eccesso si riversano megabyte a ogni scatto (il
//                        difetto da cui veniamo); se sbaglia per difetto una
//                        foto non viene mai salvata.
//   migrazioneRiuscita -> dice se si puo' cancellare la copia vecchia. Se dice
//                        "si'" quando non e' vero, le foto spariscono.
//
// Sono pure, quindi si provano qui invece che a schermo.
const path = require('path');
const { ok, fine } = require('../lib/app');
require(path.resolve(__dirname, '..', '..', 'magazzino-foto.js'));
const MF = (typeof globalThis !== 'undefined' && globalThis.MagazzinoFoto) || null;

ok('il modulo si carica ed espone le regole', !!(MF && typeof MF.daScrivere === 'function'
  && typeof MF.migrazioneRiuscita === 'function' && typeof MF.peso === 'function'));
if (!MF) { fine(); }

const come = (d) => `scrivi[${d.scrivi.sort().join(',')}] cancella[${d.cancella.sort().join(',')}]`;

// ---------- daScrivere: si tocca solo il cambiamento ----------
{
  const d = MF.daScrivere({}, {});
  ok(`due mappe vuote non producono lavoro (${come(d)})`, d.scrivi.length === 0 && d.cancella.length === 0);
}
{
  const d = MF.daScrivere({}, { a: 'foto-a' });
  ok(`la prima foto si scrive (${come(d)})`, come(d) === 'scrivi[a] cancella[]');
}
{
  // Il caso che conta davvero: 29 foto gia' salvate, se ne aggiunge una.
  // Devono partire UNA scrittura, non trenta.
  const prima = {};
  for (let i = 0; i < 29; i++) prima['s' + i] = 'foto-' + i;
  const dopo = Object.assign({}, prima, { nuova: 'foto-nuova' });
  const d = MF.daScrivere(prima, dopo);
  ok(`aggiungendo la trentesima si scrive solo quella (${come(d)})`,
    d.scrivi.length === 1 && d.scrivi[0] === 'nuova' && d.cancella.length === 0);
}
{
  const prima = { a: 'foto-a', b: 'foto-b' };
  const d = MF.daScrivere(prima, prima);
  ok(`ridisegnare senza cambiare niente non scrive niente (${come(d)})`,
    d.scrivi.length === 0 && d.cancella.length === 0);
}
{
  // Stessa chiave, foto diversa: succede quando si riscatta lo scontrino di
  // una voce gia' fotografata. Va riscritta, altrimenti resta la vecchia.
  const d = MF.daScrivere({ a: 'vecchia' }, { a: 'nuova' });
  ok(`rifotografando la stessa voce si riscrive (${come(d)})`, come(d) === 'scrivi[a] cancella[]');
}
{
  // Una spesa cancellata da un altro telefono: la foto va tolta, o resta
  // occupata memoria per una voce che non esiste piu'.
  const d = MF.daScrivere({ a: 'foto-a', b: 'foto-b' }, { a: 'foto-a' });
  ok(`una voce sparita porta via la sua foto (${come(d)})`, come(d) === 'scrivi[] cancella[b]');
}
{
  // Chiusura del campo: tutto azzerato.
  const d = MF.daScrivere({ a: '1', b: '2', c: '3' }, {});
  ok(`chiudendo il campo si cancellano tutte (${come(d)})`, d.scrivi.length === 0 && d.cancella.length === 3);
}
{
  // Una foto messa a "undefined" NON e' una foto cancellata: la chiave c'e'
  // ancora. Se qui si sbagliasse, un valore rotto resterebbe per sempre.
  const d = MF.daScrivere({ a: '1' }, { a: undefined });
  ok(`un valore azzerato si riscrive, non si cancella (${come(d)})`, come(d) === 'scrivi[a] cancella[]');
}
{
  const d = MF.daScrivere(null, null);
  ok('mappe assenti non fanno esplodere niente', d.scrivi.length === 0 && d.cancella.length === 0);
}

// ---------- migrazioneRiuscita: quando si puo' cancellare il vecchio ----------
{
  ok('niente da migrare vuol dire migrazione riuscita', MF.migrazioneRiuscita({}, {}) === true);
}
{
  const v = { a: 'foto-a', b: 'foto-b' };
  ok('se si rilegge tutto identico, si puo' + "'" + ' cancellare il vecchio',
    MF.migrazioneRiuscita(v, { a: 'foto-a', b: 'foto-b' }) === true);
}
{
  // Il caso che salva le foto: una scrittura non e' andata a buon fine.
  const v = { a: 'foto-a', b: 'foto-b' };
  ok('se una foto non si rilegge, il vecchio NON si cancella',
    MF.migrazioneRiuscita(v, { a: 'foto-a' }) === false);
}
{
  // Ancora peggio: si rilegge, ma troncata. Confrontare i conteggi invece dei
  // contenuti non lo vedrebbe.
  const v = { a: 'foto-a-intera' };
  ok('una foto riletta a meta' + "'" + ' vale come persa',
    MF.migrazioneRiuscita(v, { a: 'foto-a-int' }) === false);
}
{
  // Nel magazzino c'e' gia' roba di prima (foto arrivate dal cloud). Non e'
  // un problema: contano le originali, non le altre.
  const v = { a: 'foto-a' };
  ok('foto in piu' + "'" + ' nel magazzino non bloccano la migrazione',
    MF.migrazioneRiuscita(v, { a: 'foto-a', z: 'arrivata-dal-cloud' }) === true);
}

// ---------- peso: il numero che ha spostato le foto ----------
{
  ok('il peso di niente e' + "'" + ' zero', MF.peso({}) === 0 && MF.peso(null) === 0);
  ok('il peso e' + "'" + ' la somma dei byte', MF.peso({ a: 'abcde', b: 'xyz' }) === 8);
}

fine();
