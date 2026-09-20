// Le lingue dell'app.
//
// Sta fuori da src/ per lo stesso motivo di conti.js e presenze.js: il
// rischio vero non e' tradurre, e' che il meccanismo NON SI ACCORGA che una
// stringa manca e la mostri vuota in mezzo a una schermata. Quella e' una
// regola, e le regole si provano con una prova unitaria.
//
// Cosa resta italiano: il codice, i commenti, i commit, i nomi delle chiavi.
// A diventare traducibile e' solo quello che l'utente legge.
//
// Tre cose che questo file fa, e che una tabella di stringhe non basterebbe a
// fare:
//   1. i PLURALI sono funzioni, non stringhe con un segnaposto. "1 pasto" e
//      "2 pasti" in italiano sono due forme; in francese lo zero e' singolare
//      e in italiano e' plurale. Una concatenazione non lo sa.
//   2. le DATE seguono la lingua. Erano 32 'it-IT' sparsi in otto sorgenti —
//      non "un punto solo", come credevamo. Adesso hanno dodici nomi, che
//      sono le dodici forme che l'app usa davvero.
//   3. una chiave che manca NON diventa vuota: si ripiega sull'italiano, e se
//      manca anche li' si mostra la chiave. Meglio "spesa.totale" a schermo
//      che un buco: il buco non lo segnala nessuno.
(function (root) {
  'use strict';

  // Le lingue, e il codice con cui il browser formatta date e numeri.
  const LINGUE = {
    it: { nome: 'Italiano', locale: 'it-IT' },
    es: { nome: 'Español', locale: 'es-ES' },
    fr: { nome: 'Français', locale: 'fr-FR' },
  };
  const PREDEFINITA = 'it';

  // ---------- Le dodici forme di data ----------
  // Sono quelle che l'app usa davvero, contate nei sorgenti. Dare un nome a
  // ognuna e' il lavoro: dopo, cambiare lingua e' gratis.
  const FORME = {
    completa: { weekday: 'long', day: 'numeric', month: 'long' },
    lunga: { day: 'numeric', month: 'long' },
    breve: { day: 'numeric', month: 'short' },
    settimana: { weekday: 'short', day: 'numeric', month: 'short' },
    settimanaLunga: { weekday: 'short', day: 'numeric', month: 'long' },
    settimanaGiorno: { weekday: 'short', day: 'numeric' },
    settimanaSola: { weekday: 'short' },
    ora: { hour: '2-digit', minute: '2-digit' },
    dataOraBreve: { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' },
  };
  // Queste tre non passano opzioni: sono il formato predefinito del browser
  // per quella lingua, ed e' voluto — e' quello che la gente si aspetta.
  const SENZA_OPZIONI = { numerica: 'data', oraPiena: 'ora', dataOra: 'dataOra' };

  function formatta(valore, forma, locale) {
    // Una data che non c'e' deve restare vuota. Attenzione: new Date(null) NON
    // e' una data non valida — e' il primo gennaio 1970, e a schermo sarebbe
    // una bugia con l'aria di un dato. Lo stesso vale per la stringa vuota.
    if (valore === null || valore === undefined || valore === '') return '';
    const d = valore instanceof Date ? valore : new Date(valore);
    if (isNaN(d.getTime())) return '';
    if (SENZA_OPZIONI[forma] === 'data') return d.toLocaleDateString(locale);
    if (SENZA_OPZIONI[forma] === 'ora') return d.toLocaleTimeString(locale);
    if (SENZA_OPZIONI[forma] === 'dataOra') return d.toLocaleString(locale);
    const opz = FORME[forma];
    if (!opz) return d.toLocaleString(locale);
    if (forma === 'ora') return d.toLocaleTimeString(locale, opz);
    if (forma === 'dataOraBreve') return d.toLocaleString(locale, opz);
    return d.toLocaleDateString(locale, opz);
  }

  // ---------- Il dizionario ----------
  // L'italiano e' la lingua completa per definizione: e' quella in cui si
  // scrive prima. Le altre si controllano contro questa.
  const IT = {
    'lingua.titolo': 'Lingua',
    'lingua.nota': "Cambia subito, senza riaprire l'app. I nomi delle persone e quello che scrivi tu non si traducono: restano come li hai messi.",
    // Aree dell'app
    'area.calendario': 'Calendario',
    'area.menu': 'Menù',
    'area.membri': 'Membri',
    'area.presenze': 'Presenze',
    'area.spesa': 'Spese Totali',
    'area.compiti': 'Chi fa cosa',
    'area.lista': 'Lista della Spesa',
    'area.attrezzatura': 'Attrezzatura',
    'area.regole': 'Regole',
    'area.dotazioni': 'Dotazioni personali',
    'area.galleria': 'Galleria',
    'area.archivio': 'Archivio',
    'area.gioco': 'Aiuta Bandy',
    'area.guida': 'Come funziona',
    'area.impostazioni': 'Impostazioni',
    // Gruppi del menu
    'menu.pianificazione': 'Pianificazione',
    'menu.spese': 'Spese',
    'menu.gruppo': 'Il gruppo',
    'menu.altro': 'Altro',
    // Scheda "Chi fa cosa"
    'compiti.assegnaTitolo': 'Assegna un compito',
    'compiti.cosa': 'Es. Prendere gli arrosticini, prenotare il rifugio…',
    'compiti.assegna': 'Assegna',
    'compiti.spiegazione': 'Il compito dice *chi fa cosa*, non quanto costa: il prezzo si scopre alla cassa. Quando è fatto, da qui si registra la spesa — ma solo se ce n\'è una.',
    'compiti.daFare': 'Da fare',
    'compiti.fatti': 'Fatti',
    'compiti.vuoto': 'Nessun compito assegnato. Serve a dividersi le cose prima di partire.',
    'compiti.tuttoFatto': 'Tutto fatto.',
    'compiti.aChi': 'a chi',
    'compiti.registraSpesa': 'Registra la spesa',
    'compiti.segnaFatto': 'Segna come fatto',
    'compiti.segnaDaFare': 'Segna come da fare',
    'compiti.rimuovi': 'Rimuovi',
    'compiti.senzaMembri': 'Non c\'è ancora nessuno fra i Membri: i compiti si possono scrivere, ma non assegnare.',
    'compiti.confermaTogli': (testo) => `Togliere il compito "${testo}"?`,
    // Plurali: funzioni, non stringhe con un segnaposto.
    'compiti.quanti': (n) => (n === 1 ? '1 compito' : `${n} compiti`),
  };

  const ES = {
    'lingua.titolo': 'Idioma',
    'lingua.nota': 'Cambia al momento, sin reabrir la aplicación. Los nombres de las personas y lo que escribes tú no se traducen: quedan como los pusiste.',
    'area.calendario': 'Calendario',
    'area.menu': 'Menú',
    'area.membri': 'Miembros',
    'area.presenze': 'Asistencia',
    'area.spesa': 'Gastos totales',
    'area.compiti': 'Quién hace qué',
    'area.lista': 'Lista de la compra',
    'area.attrezzatura': 'Equipamiento',
    'area.regole': 'Normas',
    'area.dotazioni': 'Equipo personal',
    'area.galleria': 'Galería',
    'area.archivio': 'Archivo',
    'area.gioco': 'Aiuta Bandy',
    'area.guida': 'Cómo funciona',
    'area.impostazioni': 'Ajustes',
    'menu.pianificazione': 'Planificación',
    'menu.spese': 'Gastos',
    'menu.gruppo': 'El grupo',
    'menu.altro': 'Más',
    'compiti.assegnaTitolo': 'Asignar una tarea',
    'compiti.cosa': 'Ej. Comprar la carne, reservar el refugio…',
    'compiti.assegna': 'Asignar',
    'compiti.spiegazione': 'La tarea dice *quién hace qué*, no cuánto cuesta: el precio se sabe en la caja. Cuando esté hecha, desde aquí se registra el gasto — pero solo si lo hay.',
    'compiti.daFare': 'Pendientes',
    'compiti.fatti': 'Hechas',
    'compiti.vuoto': 'Ninguna tarea asignada. Sirve para repartirse las cosas antes de salir.',
    'compiti.tuttoFatto': 'Todo hecho.',
    'compiti.aChi': 'a quién',
    'compiti.registraSpesa': 'Registrar el gasto',
    'compiti.segnaFatto': 'Marcar como hecha',
    'compiti.segnaDaFare': 'Marcar como pendiente',
    'compiti.rimuovi': 'Quitar',
    'compiti.senzaMembri': 'Todavía no hay nadie en Miembros: las tareas se pueden escribir, pero no asignar.',
    'compiti.confermaTogli': (testo) => `¿Quitar la tarea "${testo}"?`,
    'compiti.quanti': (n) => (n === 1 ? '1 tarea' : `${n} tareas`),
  };

  const FR = {
    'lingua.titolo': 'Langue',
    'lingua.nota': "Change tout de suite, sans rouvrir l'application. Les noms des personnes et ce que tu écris toi ne sont pas traduits : ils restent tels quels.",
    'area.calendario': 'Calendrier',
    'area.menu': 'Menu',
    'area.membri': 'Membres',
    'area.presenze': 'Présences',
    'area.spesa': 'Dépenses totales',
    'area.compiti': 'Qui fait quoi',
    'area.lista': 'Liste de courses',
    'area.attrezzatura': 'Matériel',
    'area.regole': 'Règles',
    'area.dotazioni': 'Équipement personnel',
    'area.galleria': 'Galerie',
    'area.archivio': 'Archives',
    'area.gioco': 'Aiuta Bandy',
    'area.guida': 'Comment ça marche',
    'area.impostazioni': 'Réglages',
    'menu.pianificazione': 'Organisation',
    'menu.spese': 'Dépenses',
    'menu.gruppo': 'Le groupe',
    'menu.altro': 'Autre',
    'compiti.assegnaTitolo': 'Attribuer une tâche',
    'compiti.cosa': 'Ex. Prendre la viande, réserver le refuge…',
    'compiti.assegna': 'Attribuer',
    'compiti.spiegazione': 'La tâche dit *qui fait quoi*, pas combien ça coûte : le prix se découvre à la caisse. Une fois faite, on enregistre la dépense d\'ici — mais seulement s\'il y en a une.',
    'compiti.daFare': 'À faire',
    'compiti.fatti': 'Faites',
    'compiti.vuoto': 'Aucune tâche attribuée. Ça sert à se répartir les choses avant de partir.',
    'compiti.tuttoFatto': 'Tout est fait.',
    'compiti.aChi': 'à qui',
    'compiti.registraSpesa': 'Enregistrer la dépense',
    'compiti.segnaFatto': 'Marquer comme faite',
    'compiti.segnaDaFare': 'Marquer comme à faire',
    'compiti.rimuovi': 'Retirer',
    'compiti.senzaMembri': 'Il n\'y a encore personne dans Membres : les tâches peuvent s\'écrire, mais pas s\'attribuer.',
    'compiti.confermaTogli': (testo) => `Retirer la tâche « ${testo} » ?`,
    // In francese le ZERO e' singolare: "0 tâche", non "0 tâches". In italiano
    // e' plurale. E' esattamente il motivo per cui i plurali sono funzioni.
    'compiti.quanti': (n) => (n < 2 ? `${n} tâche` : `${n} tâches`),
  };

  const DIZIONARI = { it: IT, es: ES, fr: FR };

  // ---------- L'enfasi dentro una frase tradotta ----------
  // Una frase lunga ha spesso una parte in grassetto, e spezzarla in tre
  // stringhe non funziona: l'ordine delle parole cambia da lingua a lingua e
  // il pezzo in mezzo finisce nel posto sbagliato. La frase resta INTERA nel
  // dizionario, con la parte da evidenziare fra asterischi:
  //
  //   'Il compito dice *chi fa cosa*, non quanto costa'
  //
  // Qui si spezza in pezzi; a disegnarli ci pensa l'interfaccia. La regola sta
  // fuori perche' cosi' si prova, il disegno sta dentro perche' e' JSX.
  function pezzi(testo) {
    const out = [];
    String(testo === null || testo === undefined ? '' : testo)
      .split('*')
      .forEach(function (parte, i) {
        if (parte === '') return;
        out.push({ grassetto: i % 2 === 1, testo: parte });
      });
    return out;
  }

  // ---------- La regola che si prova ----------
  // Cosa manca e cosa avanza rispetto all'italiano. Restituisce un elenco
  // vuoto quando va tutto bene, cosi' la prova puo' stamparlo.
  function differenze(codice) {
    const d = DIZIONARI[codice];
    if (!d) return [{ tipo: 'lingua sconosciuta', chiave: codice }];
    const fuori = [];
    Object.keys(IT).forEach(function (k) {
      if (!(k in d)) fuori.push({ tipo: 'manca', chiave: k });
      else if (typeof IT[k] !== typeof d[k]) fuori.push({ tipo: 'tipo diverso', chiave: k });
    });
    Object.keys(d).forEach(function (k) {
      if (!(k in IT)) fuori.push({ tipo: 'in piu', chiave: k });
    });
    return fuori;
  }

  // ---------- Il traduttore ----------
  // Si crea per una lingua e si passa alle schede come qualsiasi altra
  // dipendenza. NON legge una variabile globale: la lingua e' uno stato di
  // React, e se "t" leggesse da fuori, cambiarla non ridisegnerebbe niente.
  function crea(codice) {
    const cod = DIZIONARI[codice] ? codice : PREDEFINITA;
    const d = DIZIONARI[cod];
    const locale = LINGUE[cod].locale;

    const t = function (chiave) {
      // Ripiego sull'italiano, poi sulla chiave stessa. Mai una stringa
      // vuota: un buco a schermo non lo segnala nessuno.
      const v = (chiave in d) ? d[chiave] : (chiave in IT ? IT[chiave] : null);
      if (v === null || v === undefined) return chiave;
      if (typeof v === 'function') return v.apply(null, Array.prototype.slice.call(arguments, 1));
      return v;
    };

    return {
      codice: cod,
      locale: locale,
      nome: LINGUE[cod].nome,
      t: t,
      pezzi: function (chiave) { return pezzi(t.apply(null, arguments)); },
      data: function (valore, forma) { return formatta(valore, forma, locale); },
    };
  }

  root.Lingue = {
    LINGUE: LINGUE,
    PREDEFINITA: PREDEFINITA,
    FORME: FORME,
    DIZIONARI: DIZIONARI,
    differenze: differenze,
    pezzi: pezzi,
    crea: crea,
  };
})(typeof window !== 'undefined' ? window : globalThis);
