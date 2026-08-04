// Valori "a scelta chiusa" del dominio, con etichette per la UI.
// Sono la fonte di verità applicativa al posto degli enum DB (non supportati
// da SQLite). Su Postgres si possono promuovere a enum nativi.

/* ------------------------------ Ruoli utente ------------------------------ */

export const RUOLI = {
  SUPER_ADMIN: "Super Admin",
  BACKOFFICE: "Backoffice",
  PROJECT_MANAGER: "Project Manager",
  UFFICIO_TECNICO: "Ufficio Tecnico",
  AMMINISTRAZIONE: "Amministrazione",
} as const;

export type Ruolo = keyof typeof RUOLI;
export const RUOLI_LIST = Object.keys(RUOLI) as Ruolo[];
export function etichettaRuolo(r: string): string {
  return (RUOLI as Record<string, string>)[r] ?? r;
}

/* ----------------------------- Titoli referente --------------------------- */

export const TITOLI = {
  NESSUNO: "—",
  SIG: "Sig.",
  SIGRA: "Sig.ra",
  DOTT: "Dott.",
  DOTTSSA: "Dott.ssa",
  ING: "Ing.",
  GEOM: "Geom.",
  ARCH: "Arch.",
  PERITO: "P.I.",
  RAG: "Rag.",
  AVV: "Avv.",
  PROF: "Prof.",
} as const;

export type Titolo = keyof typeof TITOLI;
export const TITOLI_LIST = Object.keys(TITOLI) as Titolo[];
export function etichettaTitolo(t: string): string {
  const v = (TITOLI as Record<string, string>)[t];
  return v && v !== "—" ? v : "";
}

/* ----------------------------- Stati commessa ----------------------------- */

export const STATI_COMMESSA = {
  LEAD: "Lead",
  PREVENTIVO: "Preventivo",
  INVIATA: "Offerta inviata",
  IN_FOLLOWUP: "In follow-up",
  ORDINE_CONFERMATO: "Ordine confermato",
  IN_ESECUZIONE: "In esecuzione",
  CONSUNTIVO: "Consuntivo",
  FATTURATA: "Fatturata",
  PERSA: "Persa",
} as const;

export type StatoCommessa = keyof typeof STATI_COMMESSA;
export const STATI_COMMESSA_LIST = Object.keys(STATI_COMMESSA) as StatoCommessa[];
export function etichettaStato(s: string): string {
  return (STATI_COMMESSA as Record<string, string>)[s] ?? s;
}

/* ---------------------------- Tipologia lavoro ---------------------------- */
// P e C sono le due tipologie storiche del flusso (§5.1, regola bloccante P→C).
// T e GARA arrivano dall'elenco offerte reale di Elettra. "INT." non è una
// tipologia: le commesse interne si riconoscono dal cliente (ELETTRA S.r.l.,
// codice C0000), quindi sarebbe un'informazione duplicata.

export const TIPOLOGIE = {
  P: "Preventivo (a corpo)",
  C: "Consuntivo",
  T: "Tariffario",
  GARA: "Gara d'appalto",
} as const;

export type Tipologia = keyof typeof TIPOLOGIE;

/* ----------------------- Metodo di ricezione ordine ----------------------- */

export const METODI_RICEZIONE = {
  EMAIL: "Email",
  TELEFONO: "OK telefonico",
  CONTROFIRMA: "Offerta controfirmata",
  NUMERO_ORDINE: "Numero d'ordine",
} as const;

export type MetodoRicezione = keyof typeof METODI_RICEZIONE;

/* ------------------------------ Stati ordine ------------------------------ */
// Ciclo di vita dell'ordine a fornitore: emesso -> merce parziale -> completo.

export const STATI_ORDINE = {
  ORDINATO: "Ordinato",
  ENTRATA: "Entrata parziale",
  RICEVUTO: "Ricevuto",
} as const;

export type StatoOrdine = keyof typeof STATI_ORDINE;
export const STATI_ORDINE_LIST = Object.keys(STATI_ORDINE) as StatoOrdine[];
export function etichettaStatoOrdine(s: string): string {
  return (STATI_ORDINE as Record<string, string>)[s] ?? s;
}

/* ---------------------------- Stati milestone ----------------------------- */
// Avanzamento di una milestone di progetto (Fase 7).

export const STATI_MILESTONE = {
  DA_FARE: "Da fare",
  IN_CORSO: "In corso",
  COMPLETATA: "Completata",
} as const;

export type StatoMilestone = keyof typeof STATI_MILESTONE;
export const STATI_MILESTONE_LIST = Object.keys(
  STATI_MILESTONE,
) as StatoMilestone[];
export function etichettaStatoMilestone(s: string): string {
  return (STATI_MILESTONE as Record<string, string>)[s] ?? s;
}

/* ----------------------------- Ruoli in cantiere --------------------------- */
// Ruolo di un operaio sull'assegnazione a un progetto (Fase 7).

export const RUOLI_CANTIERE = {
  CAPO_SQUADRA: "Capo squadra",
  ELETTRICISTA: "Elettricista",
  AIUTANTE: "Aiutante",
  MANUTENTORE: "Manutentore",
  ALTRO: "Altro",
} as const;

export type RuoloCantiere = keyof typeof RUOLI_CANTIERE;
export const RUOLI_CANTIERE_LIST = Object.keys(
  RUOLI_CANTIERE,
) as RuoloCantiere[];
export function etichettaRuoloCantiere(r: string): string {
  return (RUOLI_CANTIERE as Record<string, string>)[r] ?? r;
}

/* --------------------------- Categorie documento -------------------------- */
// Tipi di documento allegabili alla commessa (flusso §7).

export const CATEGORIE_DOCUMENTO = {
  OFFERTA: "Offerta",
  DISEGNO: "Disegno",
  FOTO: "Foto",
  DDT: "DDT",
  FATTURA: "Fattura",
  ALTRO: "Altro",
} as const;

export type CategoriaDocumento = keyof typeof CATEGORIE_DOCUMENTO;
export const CATEGORIE_DOCUMENTO_LIST = Object.keys(
  CATEGORIE_DOCUMENTO,
) as CategoriaDocumento[];
export function etichettaCategoria(c: string): string {
  return (CATEGORIE_DOCUMENTO as Record<string, string>)[c] ?? c;
}

/* ---------------------------- Segnalazioni -------------------------------- */
// Feedback di chi prova il CRM durante la fase di test.

export const TIPI_SEGNALAZIONE = {
  PROBLEMA: "Problema",
  MIGLIORAMENTO: "Miglioramento",
  DOMANDA: "Domanda",
} as const;

export type TipoSegnalazione = keyof typeof TIPI_SEGNALAZIONE;
export const TIPI_SEGNALAZIONE_LIST = Object.keys(
  TIPI_SEGNALAZIONE,
) as TipoSegnalazione[];
export function etichettaTipoSegnalazione(t: string): string {
  return (TIPI_SEGNALAZIONE as Record<string, string>)[t] ?? t;
}

export const PRIORITA_SEGNALAZIONE = {
  BASSA: "Bassa",
  MEDIA: "Media",
  ALTA: "Alta — blocca il lavoro",
} as const;

export type PrioritaSegnalazione = keyof typeof PRIORITA_SEGNALAZIONE;
export const PRIORITA_SEGNALAZIONE_LIST = Object.keys(
  PRIORITA_SEGNALAZIONE,
) as PrioritaSegnalazione[];
export function etichettaPriorita(p: string): string {
  return (PRIORITA_SEGNALAZIONE as Record<string, string>)[p] ?? p;
}

export const STATI_SEGNALAZIONE = {
  APERTA: "Aperta",
  IN_LAVORAZIONE: "In lavorazione",
  CONCLUSA: "Conclusa",
} as const;

export type StatoSegnalazione = keyof typeof STATI_SEGNALAZIONE;
export const STATI_SEGNALAZIONE_LIST = Object.keys(
  STATI_SEGNALAZIONE,
) as StatoSegnalazione[];
export function etichettaStatoSegnalazione(s: string): string {
  return (STATI_SEGNALAZIONE as Record<string, string>)[s] ?? s;
}

/* ------------------------------ Permessi ---------------------------------- */
// Regole di accesso minime per la Fase 1. Estendibili per modulo.

export function isSuperAdmin(ruolo: string): boolean {
  return ruolo === "SUPER_ADMIN";
}

/** Chi può creare/modificare le anagrafiche. */
export function puoGestireAnagrafiche(ruolo: string): boolean {
  return ruolo === "SUPER_ADMIN" || ruolo === "BACKOFFICE";
}

/** Chi può creare/modificare le commesse (pipeline commerciale). */
export function puoGestireCommesse(ruolo: string): boolean {
  return (
    ruolo === "SUPER_ADMIN" ||
    ruolo === "BACKOFFICE" ||
    ruolo === "PROJECT_MANAGER"
  );
}

/** Chi può creare/modificare gli ordini ai fornitori (acquisti). */
export function puoGestireOrdini(ruolo: string): boolean {
  return (
    ruolo === "SUPER_ADMIN" ||
    ruolo === "BACKOFFICE" ||
    ruolo === "PROJECT_MANAGER" ||
    ruolo === "UFFICIO_TECNICO"
  );
}

/** Chi può gestire il catalogo materiali (anagrafica prodotti + schede tecniche). */
export function puoGestireCatalogo(ruolo: string): boolean {
  return (
    ruolo === "SUPER_ADMIN" ||
    ruolo === "BACKOFFICE" ||
    ruolo === "PROJECT_MANAGER" ||
    ruolo === "UFFICIO_TECNICO"
  );
}

/** Chi può caricare/eliminare i documenti di commessa (PM, tecnico, backoffice). */
export function puoGestireDocumenti(ruolo: string): boolean {
  return (
    ruolo === "SUPER_ADMIN" ||
    ruolo === "BACKOFFICE" ||
    ruolo === "PROJECT_MANAGER" ||
    ruolo === "UFFICIO_TECNICO"
  );
}

/** Chi può gestire i progetti di cantiere: milestone e squadra assegnata. */
export function puoGestireProgetti(ruolo: string): boolean {
  return (
    ruolo === "SUPER_ADMIN" ||
    ruolo === "BACKOFFICE" ||
    ruolo === "PROJECT_MANAGER" ||
    ruolo === "UFFICIO_TECNICO"
  );
}

/**
 * Chi può gestire l'anagrafica operai. Più ristretto della gestione progetti:
 * l'Ufficio Tecnico assegna le squadre ma non crea/elimina il personale.
 */
export function puoGestireOperai(ruolo: string): boolean {
  return (
    ruolo === "SUPER_ADMIN" ||
    ruolo === "BACKOFFICE" ||
    ruolo === "PROJECT_MANAGER"
  );
}

/** Chi può gestire utenti e configurazione. */
export function puoGestireUtenti(ruolo: string): boolean {
  return ruolo === "SUPER_ADMIN";
}

/**
 * Chi può prendere in carico e chiudere le segnalazioni. Aprirle e commentarle
 * può farlo chiunque sia autenticato: è il senso di uno strumento di test.
 */
export function puoGestireSegnalazioni(ruolo: string): boolean {
  return ruolo === "SUPER_ADMIN";
}
