import { z } from "zod";
import { Prisma } from "@/generated/prisma";
import { STATI_ORDINE_LIST } from "./enums";
import { dataOpzionale, idsUnivoci, numeroOpzionale, testoOpzionale } from "./form-validation";

export const TestataOrdineSchema = z.object({
  fornitoreId: z.string().trim().min(1, "Il fornitore è obbligatorio."),
  commessaId: testoOpzionale,
  numero: testoOpzionale,
  data: dataOpzionale,
  stato: z.enum(STATI_ORDINE_LIST, { message: "Stato ordine non valido." }),
});

const RigaSchema = z.object({
  id: z.string().trim().min(1).optional(),
  codiceProdotto: testoOpzionale,
  descrizione: z.string().trim().min(1, "La descrizione è obbligatoria."),
  unitaMisura: testoOpzionale,
  quantita: numeroOpzionale("Quantità").transform((v) => v ?? 0),
  prezzoUnitario: numeroOpzionale("Prezzo unitario").transform((v) => v ?? 0),
  sconto: numeroOpzionale("Sconto", 100),
  aliquotaIva: numeroOpzionale("IVA", 100),
  dataConsegnaPrevista: dataOpzionale,
  quantitaRicevuta: numeroOpzionale("Quantità ricevuta"),
  ddtNumero: testoOpzionale,
  ddtData: dataOpzionale,
  fatturaNumero: testoOpzionale,
  fatturaData: dataOpzionale,
}).transform((r) => ({
  ...r,
  // Ricalcolato sul server: un imponibile inviato dal client non è attendibile.
  imponibile: new Prisma.Decimal(r.quantita).mul(r.prezzoUnitario)
    .mul(new Prisma.Decimal(1).minus(new Prisma.Decimal(r.sconto ?? 0).div(100)))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber(),
})).refine((r) => Number.isFinite(r.imponibile) && r.imponibile <= Number.MAX_SAFE_INTEGER / 100, {
  message: "L'imponibile supera il limite gestibile.",
});

export const RigheOrdineSchema = z.array(RigaSchema)
  .min(1, "Aggiungi almeno una riga con descrizione.")
  .refine(idsUnivoci, "La stessa riga compare più volte. Ricarica il modulo.");
