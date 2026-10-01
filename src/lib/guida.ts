/**
 * Guida contestuale: un mini-tour per pagina, mostrato la prima volta che
 * l'utente la visita. Ogni passo è ancorato a un elemento reale della pagina
 * (selettore CSS); senza selettore il passo è una scheda centrata.
 *
 * Quali tour ha già visto l'utente è salvato in `User.guidaVista`, come elenco
 * di chiavi separate da virgola. La chiave speciale `*` vale «tutti».
 */

export type PassoGuida = {
  titolo: string;
  testo: string;
  /** Selettore CSS dell'elemento a cui ancorare il popover. */
  sel?: string;
  /** Tra gli elementi trovati, prende il primo che contiene questo testo. */
  conTesto?: string;
};

export type TourGuida = {
  chiave: string;
  passi: PassoGuida[];
  /** Se presente, il tour è per questi ruoli soltanto. */
  ruoli?: string[];
};

const GESTIONE_PROGETTI = ["SUPER_ADMIN", "BACKOFFICE", "PROJECT_MANAGER", "UFFICIO_TECNICO"];

const FILTRI: PassoGuida = {
  titolo: "Cerca e filtra",
  testo: "Scrivi nel campo di ricerca o scegli un filtro, poi premi il pulsante per aggiornare l'elenco.",
  sel: "main form[method='get']",
};

/** Tour per percorso esatto. */
const TOUR: Record<string, TourGuida> = {
  "/": {
    chiave: "dashboard",
    passi: [
      {
        titolo: "Benvenuto nel CRM Elettra",
        testo:
          "Ti accompagniamo pagina per pagina: la prima volta che apri una sezione compare una breve guida vicino agli elementi principali. Puoi chiuderla quando vuoi.",
      },
      {
        titolo: "La situazione in un colpo d'occhio",
        testo: "Questi numeri riassumono clienti, fornitori e offerte. È la pagina da cui iniziare ogni giorno.",
        sel: "main section",
      },
      {
        titolo: "Il menu",
        testo:
          "Da qui raggiungi tutte le sezioni; la voce evidenziata indica dove ti trovi. Apri una sezione qualsiasi: troverai la sua guida.",
        sel: "nav[aria-label^='Navigazione']",
      },
      {
        titolo: "Riapri la guida quando vuoi",
        testo: "Il pulsante «Guida» rilancia il tour della pagina in cui ti trovi.",
        sel: "[data-guida-apri]",
      },
      {
        titolo: "Qualcosa non va? Segnalalo",
        testo:
          "Siamo in fase di prova e il tuo parere conta: descrivi il problema o l'idea, la schermata da cui scrivi viene registrata in automatico.",
        sel: "a[href^='/segnalazioni/nuova']",
      },
    ],
  },
  "/anagrafiche": {
    chiave: "anagrafiche",
    passi: [
      {
        titolo: "Clienti e fornitori",
        testo:
          "Ogni azienda ha una sola scheda, anche se è sia cliente sia fornitore: può avere un codice cliente e un codice fornitore.",
        sel: "main h1",
      },
      FILTRI,
      {
        titolo: "Nuova anagrafica",
        testo: "Aggiungi un'azienda a mano oppure importala da una visura camerale con «Da visura».",
        sel: "main a[href='/anagrafiche/nuova']",
      },
      {
        titolo: "L'elenco",
        testo: "Apri una riga per vedere referenti, commesse recenti ed economics del cliente.",
        sel: "main table",
      },
    ],
  },
  "/commesse": {
    chiave: "commesse",
    passi: [
      {
        titolo: "Le commesse",
        testo: "La commessa è il cuore del lavoro: collega cliente, project manager, avanzamento, ordini e documenti.",
        sel: "main h1",
      },
      { ...FILTRI, testo: "Filtra per stato o cerca per numero e cliente." },
      {
        titolo: "Nuova commessa",
        testo: "Crea una commessa scegliendo il cliente e il project manager.",
        sel: "main a[href='/commesse/nuova']",
      },
      {
        titolo: "L'elenco",
        testo: "Apri una commessa per vedere il dettaglio, gli ordini a fornitore e i documenti allegati.",
        sel: "main table",
      },
    ],
  },
  "/progetti": {
    chiave: "progetti",
    ruoli: GESTIONE_PROGETTI,
    passi: [
      {
        titolo: "Cantieri in corso",
        testo: "Ogni progetto ha le sue milestone e la squadra assegnata: qui vedi a colpo d'occhio chi è in ritardo.",
        sel: "main h1",
      },
      FILTRI,
      {
        titolo: "Gestione operai",
        testo: "Anagrafica del personale di cantiere da assegnare alle squadre.",
        sel: "main a[href='/progetti/operai']",
      },
    ],
  },
  "/ordini": {
    chiave: "ordini",
    passi: [
      {
        titolo: "Ordini a fornitore",
        testo: "Gli ordini d'acquisto sono sempre legati a una commessa, così i costi restano tracciati.",
        sel: "main h1",
      },
      FILTRI,
      {
        titolo: "Nuovo ordine",
        testo: "Scegli la commessa e il fornitore, poi aggiungi le righe di materiale.",
        sel: "main a[href='/ordini/nuovo']",
      },
      { titolo: "L'elenco", testo: "Apri un ordine per vederne righe, stato e destinazione.", sel: "main table" },
    ],
  },
  "/materiali": {
    chiave: "materiali",
    passi: [
      {
        titolo: "Catalogo materiali",
        testo: "Prodotti con i prezzi dei fornitori, per confrontare e riusare i costi negli ordini.",
        sel: "main h1",
      },
      FILTRI,
      {
        titolo: "Storico prezzi",
        testo: "Consulta come sono variati i prezzi d'acquisto nel tempo.",
        sel: "main a[href='/materiali/prezzi']",
      },
      {
        titolo: "Nuovo materiale",
        testo: "Aggiungi un prodotto al catalogo.",
        sel: "main a[href='/materiali/nuovo']",
      },
    ],
  },
  "/statistiche": {
    chiave: "statistiche",
    passi: [
      { titolo: "Statistiche", testo: "Indicatori commerciali e ordinato, calcolati sui dati del CRM.", sel: "main h1" },
      { titolo: "Indicatori principali", testo: "I totali di sintesi in alto.", sel: "main section" },
    ],
  },
  "/attivita": {
    chiave: "attivita",
    passi: [
      { titolo: "Attività e scadenze", testo: "Qui organizzi follow-up e prossimi passi. Il riepilogo distingue attività da fare, scadute, in scadenza oggi e completate.", sel: "main h1" },
      { titolo: "Nuova attività", testo: "Inserisci titolo, note e scadenza e collega una commessa o un cliente. Chi gestisce le commesse può anche assegnare attività al team.", sel: "main a[href='/attivita/nuova']" },
      FILTRI,
      { titolo: "Aggiornamenti e notifiche", testo: "Apri un’attività per modificarla, completarla o riaprirla. Le assegnazioni e le scadenze sono collegate alle notifiche.", sel: "main section[aria-label='Elenco attività']" },
    ],
  },
  "/notifiche": {
    chiave: "notifiche",
    passi: [
      { titolo: "Notifiche personali", testo: "Ricevi assegnazioni, promemoria delle attività e riepiloghi dei controlli condivisi con te.", sel: "main h1" },
      { titolo: "Da leggere o già lette", testo: "Filtra le notifiche per stato e tipo. Puoi segnarle come lette singolarmente o tutte insieme.", sel: "main nav[aria-label='Stato notifiche']" },
      { titolo: "Apri il dettaglio", testo: "Aprendo una notifica raggiungi l’attività o il controllo corrispondente e la notifica viene segnata come letta. Il contatore nel menu si aggiorna anche quando arrivano nuovi avvisi.", sel: "main h1" },
    ],
  },
  "/assistente": {
    chiave: "assistente",
    passi: [
      {
        titolo: "Assistente operativo",
        testo:
          "Fai domande sui dati del CRM in linguaggio naturale, ad esempio «quali commesse sono da fatturare?». Controlla sempre le risposte importanti sui dati originali.",
        sel: "main h1",
      },
      { titolo: "Scrivi qui", testo: "Scrivi la domanda e invia: la risposta arriva in questa conversazione.", sel: "#ai-message" },
      { titolo: "Cronologia", testo: "Le conversazioni precedenti restano disponibili qui.", sel: "aside[aria-label='Cronologia conversazioni']" },
    ],
  },
  "/segnalazioni": {
    chiave: "segnalazioni",
    passi: [
      {
        titolo: "Segnalazioni",
        testo: "Problemi e idee raccolti durante la fase di prova, con la schermata da cui sono partiti.",
        sel: "main h1",
      },
      {
        titolo: "Nuova segnalazione",
        testo: "Descrivi cosa hai notato, anche con uno screenshot.",
        sel: "main a[href='/segnalazioni/nuova']",
      },
      FILTRI,
    ],
  },
  "/utenti": {
    chiave: "utenti",
    ruoli: ["SUPER_ADMIN"],
    passi: [
      { titolo: "Utenti e ruoli", testo: "Solo il Super Admin crea utenti e assegna i ruoli, che decidono cosa ciascuno può fare.", sel: "main h1" },
      { titolo: "Nuovo utente", testo: "Crea un accesso e scegli il ruolo.", sel: "main a[href='/utenti/nuovo']" },
      { titolo: "Carico di lavoro", testo: "La tabella mostra commesse aperte e totali, attività da fare e scadute, segnalazioni aperte e data di creazione dell’account. Usa i filtri per trovare un utente.", sel: "main table" },
      { titolo: "Modifica ed eliminazione", testo: "Modifica ruoli e accessi oppure elimina un account trasferendo i dati operativi. Il tuo account non può essere eliminato. Per sospendere un accesso basta disattivarlo.", sel: "main table" },
    ],
  },
  "/impostazioni": {
    chiave: "impostazioni",
    ruoli: ["SUPER_ADMIN"],
    passi: [
      {
        titolo: "Impostazioni",
        testo: "Qui configuri l'assistente AI e le opzioni generali dell'applicativo.",
        sel: "main h1",
      },
    ],
  },
};

/** Tour per pagine di dettaglio, riconosciute dal percorso. */
const TOUR_DETTAGLIO: { regola: RegExp; tour: TourGuida }[] = [
  {
    regola: /^\/commesse\/(?!nuova$)[^/]+$/,
    tour: {
      chiave: "commessa-dettaglio",
      passi: [
        { titolo: "Scheda commessa", testo: "Riepilogo di cliente, stato e importi. Da qui gestisci tutto ciò che riguarda questa commessa.", sel: "main h1" },
        { titolo: "Ordini a fornitore", testo: "Gli acquisti collegati a questa commessa; «+ Nuovo ordine» ne crea uno già associato.", sel: "main section", conTesto: "Ordini" },
        { titolo: "Documenti", testo: "Allega offerte, disegni, foto, DDT e fatture: restano tutti nella commessa.", sel: "main section", conTesto: "Documenti" },
      ],
    },
  },
  {
    regola: /^\/anagrafiche\/(?!nuova$|da-visura$)[^/]+$/,
    tour: {
      chiave: "anagrafica-dettaglio",
      passi: [
        { titolo: "Scheda azienda", testo: "Dati anagrafici, referenti e, per i clienti, commesse ed economics.", sel: "main h1" },
      ],
    },
  },
];

export function tourPerPercorso(percorso: string, ruolo: string): TourGuida | null {
  const p = percorso.length > 1 ? percorso.replace(/\/$/, "") : percorso;
  const tour = TOUR[p] ?? TOUR_DETTAGLIO.find((d) => d.regola.test(p))?.tour ?? null;
  if (!tour) return null;
  if (tour.ruoli && !tour.ruoli.includes(ruolo)) return null;
  return tour;
}

export function parseVisti(csv: string | null | undefined): string[] {
  return (csv ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function giaVisto(visti: string[], chiave: string): boolean {
  return visti.includes("*") || visti.includes(chiave);
}

/** Aggiunge una chiave all'elenco, senza duplicati; `*` sostituisce tutto. */
export function aggiungiVisto(csv: string | null | undefined, chiave: string): string {
  if (chiave === "*") return "*";
  const visti = parseVisti(csv);
  if (!visti.includes(chiave)) visti.push(chiave);
  return visti.join(",");
}
