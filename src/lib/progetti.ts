// Fase 7 — la commessa vista come progetto di cantiere.
//
// Scelta di modello: NON esiste un'entità "Progetto". Un progetto è una commessa
// già acquisita che sta in esecuzione: duplicare cliente, PM, importi e numero in
// una seconda tabella avrebbe creato due verità da tenere allineate.
//
// L'avanzamento è **sempre derivato** dalle milestone (peso uguale), mai scritto
// a mano: una percentuale salvata a parte divergerebbe dallo stato reale delle
// milestone alla prima modifica.

/** Stati commessa che corrispondono a un cantiere aperto. */
export const STATI_PROGETTO_ATTIVO = [
  "ORDINE_CONFERMATO",
  "IN_ESECUZIONE",
  "CONSUNTIVO",
] as const;

/** Stati commessa che corrispondono a un progetto chiuso (storico). */
export const STATI_PROGETTO_CHIUSO = ["FATTURATA"] as const;

/**
 * Tutti gli stati che rendono una commessa un progetto. Restano fuori le fasi
 * commerciali (Lead → Follow-up), dove il cantiere non esiste ancora, e PERSA.
 */
export const STATI_PROGETTO: string[] = [
  ...STATI_PROGETTO_ATTIVO,
  ...STATI_PROGETTO_CHIUSO,
];

export function isProgetto(stato: string): boolean {
  return STATI_PROGETTO.includes(stato);
}

export function isProgettoChiuso(stato: string): boolean {
  return (STATI_PROGETTO_CHIUSO as readonly string[]).includes(stato);
}

/* ------------------------------- Avanzamento ------------------------------- */

/** Forma minima di milestone richiesta dai calcoli: niente dipendenze da Prisma. */
export type MilestoneCalcolo = {
  stato: string;
  dataPianificata?: Date | null;
  dimostrativa?: boolean;
};

/**
 * Il progetto contiene milestone caricate per la presentazione. La UI lo deve
 * dichiarare: chi guarda non può distinguere una pianificazione reale da una
 * di esempio, e su dati veri l'equivoco sarebbe serio.
 */
export function haPianificazioneDimostrativa(
  milestone: MilestoneCalcolo[],
): boolean {
  return milestone.some((m) => m.dimostrativa === true);
}

export type Avanzamento = {
  totali: number;
  completate: number;
  inCorso: number;
  /** 0..100, arrotondato. 0 se non ci sono milestone. */
  percentuale: number;
  /** true solo se c'è almeno una milestone e sono tutte completate. */
  tutteCompletate: boolean;
};

export function avanzamento(milestone: MilestoneCalcolo[]): Avanzamento {
  const totali = milestone.length;
  const completate = milestone.filter((m) => m.stato === "COMPLETATA").length;
  const inCorso = milestone.filter((m) => m.stato === "IN_CORSO").length;
  return {
    totali,
    completate,
    inCorso,
    percentuale: totali === 0 ? 0 : Math.round((completate / totali) * 100),
    tutteCompletate: totali > 0 && completate === totali,
  };
}

/* --------------------------------- Ritardo -------------------------------- */

/** Mezzanotte di oggi: i confronti sono per giorno, non per istante. */
function inizioGiornoOggi(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function scaduta(data: Date | null | undefined, oggi: Date): boolean {
  return data ? data.getTime() < oggi.getTime() : false;
}

/**
 * Milestone scaduta: data prevista passata e lavoro non ancora completato.
 * È il mattone del calcolo di ritardo, esposto perché la UI evidenzi la riga.
 */
export function milestoneScaduta(m: MilestoneCalcolo): boolean {
  return m.stato !== "COMPLETATA" && scaduta(m.dataPianificata, inizioGiornoOggi());
}

/**
 * Stato sintetico del progetto, quello che finisce nel badge di lista:
 * - COMPLETATO: cantiere chiuso (data fine o commessa fatturata)
 * - IN_RITARDO: scadenza lavori o milestone pianificata già passate
 * - IN_CORSO: pianificato e nei tempi
 * - DA_PIANIFICARE: nessuna milestone e nessuna data di cantiere
 */
export type StatoAvanzamento =
  | "COMPLETATO"
  | "IN_RITARDO"
  | "IN_CORSO"
  | "DA_PIANIFICARE";

export type ProgettoCalcolo = {
  stato: string;
  dataInizioLavori?: Date | null;
  scadenzaLavori?: Date | null;
  dataFineLavori?: Date | null;
  milestone: MilestoneCalcolo[];
};

export function statoAvanzamento(p: ProgettoCalcolo): StatoAvanzamento {
  const oggi = inizioGiornoOggi();
  const av = avanzamento(p.milestone);

  // Chiuso se il cantiere ha una fine effettiva, se la commessa è fatturata,
  // o se tutte le milestone previste risultano completate.
  if (p.dataFineLavori || isProgettoChiuso(p.stato) || av.tutteCompletate) {
    return "COMPLETATO";
  }

  if (scaduta(p.scadenzaLavori, oggi)) return "IN_RITARDO";
  if (p.milestone.some(milestoneScaduta)) return "IN_RITARDO";

  const senzaPiano =
    av.totali === 0 && !p.dataInizioLavori && !p.scadenzaLavori;
  return senzaPiano ? "DA_PIANIFICARE" : "IN_CORSO";
}

export const ETICHETTE_AVANZAMENTO: Record<StatoAvanzamento, string> = {
  COMPLETATO: "Completato",
  IN_RITARDO: "In ritardo",
  IN_CORSO: "In corso",
  DA_PIANIFICARE: "Da pianificare",
};

/**
 * Giorni residui alla scadenza lavori: negativi se scaduta, null senza data.
 * Serve alla lista per ordinare per urgenza e mostrare "fra N giorni".
 */
export function giorniAllaScadenza(
  scadenza: Date | null | undefined,
): number | null {
  if (!scadenza) return null;
  const oggi = inizioGiornoOggi();
  const target = new Date(scadenza);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - oggi.getTime()) / 86_400_000);
}

/**
 * Prima milestone non completata, in ordine di sequenza: è la "fase corrente"
 * mostrata in lista. null se non ci sono milestone o sono tutte completate.
 */
export function faseCorrente<T extends { stato: string; ordine: number }>(
  milestone: T[],
): T | null {
  return (
    [...milestone]
      .sort((a, b) => a.ordine - b.ordine)
      .find((m) => m.stato !== "COMPLETATA") ?? null
  );
}
