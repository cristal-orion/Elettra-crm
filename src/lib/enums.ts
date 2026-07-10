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

/* --------------------------- Tipologia lavoro P/C ------------------------- */

export const TIPOLOGIE = {
  P: "Preventivo (a corpo)",
  C: "Consuntivo",
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

/** Chi può caricare/eliminare i documenti di commessa (PM, tecnico, backoffice). */
export function puoGestireDocumenti(ruolo: string): boolean {
  return (
    ruolo === "SUPER_ADMIN" ||
    ruolo === "BACKOFFICE" ||
    ruolo === "PROJECT_MANAGER" ||
    ruolo === "UFFICIO_TECNICO"
  );
}

/** Chi può gestire utenti e configurazione. */
export function puoGestireUtenti(ruolo: string): boolean {
  return ruolo === "SUPER_ADMIN";
}
