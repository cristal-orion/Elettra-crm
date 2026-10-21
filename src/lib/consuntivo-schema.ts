import { z } from "zod";

export const FASCE_ORARIE = {
  ordinaria: "Ordinaria", straordinariaFeriale: "Straordinaria feriale", straordinariaFestiva: "Straordinaria festiva",
} as const;
const id = z.string().min(1).max(100);
const decimal = z.string().trim().transform((s) => s.replace(",", "."))
  .pipe(z.string().regex(/^\d{1,6}(\.\d{1,4})?$/, "Inserisci un valore da 0 a 999999,9999, con massimo 4 decimali."));
const positive = decimal.refine((s) => Number(s) > 0, "La quantità deve essere maggiore di zero.");
const percent = decimal.refine((s) => Number(s) <= 1000, "Il ricarico massimo è 1000%.");
const version = z.number().int().min(0);
const unique = (rows: { id: string }[]) => new Set(rows.map((r) => r.id)).size === rows.length;

export const TariffaOreSchema = z.object({ id, mansione: z.string().trim().min(1).max(100), ordinaria: decimal, straordinariaFeriale: decimal, straordinariaFestiva: decimal }).strict();
export const TariffaMaterialeSchema = z.object({ id, prodottoId: id, ricarico: percent }).strict();
export const TariffarioSchema = z.object({
  versione: version,
  manodopera: z.array(TariffaOreSchema).max(50).refine(unique, "Righe duplicate."),
  materiali: z.array(TariffaMaterialeSchema).max(500).refine(unique, "Righe duplicate."),
}).strict().refine((v) => new Set(v.manodopera.map((r) => r.mansione.toLocaleLowerCase("it").replace(/\s+/g, " "))).size === v.manodopera.length, "Mansioni duplicate.")
  .refine((v) => new Set(v.materiali.map((r) => r.prodottoId)).size === v.materiali.length, "Materiali duplicati.");
export const RigaConsuntivoSchema = z.discriminatedUnion("tipo", [
  z.object({ id, tipo: z.literal("ORE"), voceId: id, fascia: z.enum(["ordinaria", "straordinariaFeriale", "straordinariaFestiva"]), quantita: positive, tariffa: decimal }).strict(),
  z.object({ id, tipo: z.literal("MATERIALE"), voceId: id, quantita: positive, costoBase: decimal, ricarico: percent }).strict(),
]);
export const ConsuntivoSchema = z.object({
  versione: version, versioneTariffario: version, data: z.iso.date(), note: z.string().trim().max(4000),
  righe: z.array(RigaConsuntivoSchema).min(1, "Aggiungi almeno una riga.").max(200).refine(unique, "Righe duplicate."),
}).strict();

export type TariffaOre = z.infer<typeof TariffaOreSchema>;
export type TariffaMateriale = z.infer<typeof TariffaMaterialeSchema> & { descrizione: string; unitaMisura: string | null };
export type TariffarioValues = { versione: number; manodopera: TariffaOre[]; materiali: TariffaMateriale[] };
export type RigaConsuntivoInput = z.infer<typeof RigaConsuntivoSchema>;
export type RigaConsuntivo = RigaConsuntivoInput & {
  descrizione: string; unitaMisura: string; valoreListino: string; versioneTariffario: number; prezzoUnitario: string; totale: string;
};
export type ConsuntivoValues = {
  versione: number; data: string; note: string; righe: RigaConsuntivo[];
  totaleOre: string; totaleMateriali: string; totale: string;
};

/** Solo i dati modificabili: fonti, prezzi calcolati e totali non arrivano dal client. */
export function editableRow(r: RigaConsuntivo): RigaConsuntivoInput {
  return r.tipo === "ORE" ? { id: r.id, tipo: r.tipo, voceId: r.voceId, fascia: r.fascia, quantita: r.quantita, tariffa: r.tariffa }
    : { id: r.id, tipo: r.tipo, voceId: r.voceId, quantita: r.quantita, costoBase: r.costoBase, ricarico: r.ricarico };
}
