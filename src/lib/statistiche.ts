// Fase 5 — Statistiche.
// Fonte di verità unica per la classificazione commerciale delle commesse e per
// i calcoli di conversione/serie temporali, condivisa tra il cruscotto globale
// (/statistiche) e la vista cliente-centrica (dettaglio anagrafica).

/** Esito commerciale di una commessa ai fini della conversione. */
export type Esito = "VINTA" | "ATTESA" | "PERSA";

// Stati in cui l'offerta si è trasformata in ordine → conteggia come "vinta".
const STATI_VINTA = new Set<string>([
  "ORDINE_CONFERMATO",
  "IN_ESECUZIONE",
  "CONSUNTIVO",
  "FATTURATA",
]);

// Stati in cui l'offerta è stata inviata al cliente e si attende una risposta.
// Sono il sottoinsieme di "ATTESA" su cui ha senso contare i giorni di attesa.
export const STATI_PENDING = new Set<string>(["INVIATA", "IN_FOLLOWUP"]);

/**
 * Classifica lo stato commessa in esito commerciale.
 * ATTESA = ancora in gioco (LEAD, PREVENTIVO, INVIATA, IN_FOLLOWUP).
 */
export function classificaEsito(stato: string): Esito {
  if (STATI_VINTA.has(stato)) return "VINTA";
  if (stato === "PERSA") return "PERSA";
  return "ATTESA";
}

/**
 * Tasso di conversione per numero di commesse: vinte / (vinte + perse).
 * Le commesse ancora in attesa NON entrano nel denominatore (esito non deciso).
 * Ritorna 0 se nessuna commessa è stata ancora decisa.
 */
export function winRate(vinte: number, perse: number): number {
  const decise = vinte + perse;
  return decise > 0 ? Math.round((vinte / decise) * 100) : 0;
}

/** Giorni interi trascorsi da una data a "adesso" (mai negativo). */
export function giorniDa(
  data: Date | string | null | undefined,
  adesso: Date,
): number {
  if (!data) return 0;
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((adesso.getTime() - d.getTime()) / 86_400_000));
}

/* --------------------------- Serie mensile ------------------------------- */

export type PuntoMese = {
  /** chiave ordinabile "AAAA-MM" */
  chiave: string;
  /** etichetta breve per l'asse ("gen", "feb"… con anno a gennaio) */
  etichetta: string;
  /** etichetta estesa per il tooltip ("gennaio 2026") */
  estesa: string;
  valore: number;
};

const meseBreve = new Intl.DateTimeFormat("it-IT", { month: "short" });
const meseEsteso = new Intl.DateTimeFormat("it-IT", {
  month: "long",
  year: "numeric",
});

/**
 * Distribuisce importi sugli ultimi `mesi` mesi (incluso quello corrente),
 * a partire da coppie {data, importo}. Gli slot vuoti restano a zero.
 * Ritorna l'array ordinato dal mese più vecchio al più recente.
 */
export function serieMensile(
  punti: { data: Date | null | undefined; importo: number }[],
  adesso: Date,
  mesi = 12,
): PuntoMese[] {
  const buckets = new Map<string, PuntoMese>();

  for (let i = mesi - 1; i >= 0; i--) {
    const d = new Date(adesso.getFullYear(), adesso.getMonth() - i, 1);
    const chiave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const breve = meseBreve.format(d).replace(".", "");
    buckets.set(chiave, {
      chiave,
      // a gennaio (o al primo slot) aggiungo l'anno per orientarsi
      etichetta: d.getMonth() === 0 ? `${breve} '${String(d.getFullYear()).slice(2)}` : breve,
      estesa: meseEsteso.format(d),
      valore: 0,
    });
  }

  for (const p of punti) {
    if (!p.data) continue;
    const d = p.data instanceof Date ? p.data : new Date(p.data);
    if (Number.isNaN(d.getTime())) continue;
    const chiave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const slot = buckets.get(chiave);
    if (slot) slot.valore += p.importo;
  }

  return [...buckets.values()];
}
