import { z } from "zod";
import { TITOLI } from "./enums";
import { idsUnivoci, testoOpzionale } from "./form-validation";

export const ReferentiSchema = z.array(z.object({
  id: z.string().trim().min(1).optional(),
  titolo: z.enum(Object.keys(TITOLI) as [string, ...string[]]).default("NESSUNO"),
  nome: z.string().trim().min(1, "Il nome del referente è obbligatorio."),
  cognome: z.string().trim().min(1, "Il cognome del referente è obbligatorio."),
  ruoloAzienda: testoOpzionale,
  email: testoOpzionale,
  telefono: testoOpzionale,
  principale: z.boolean().default(false),
})).refine(idsUnivoci, "Lo stesso referente compare più volte. Ricarica il modulo.");
