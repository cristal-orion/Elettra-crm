import { z } from "zod";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireAnagrafiche } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { ApiError, readJson } from "@/lib/ai/http";
import { findSimilarAnagrafiche } from "@/lib/anagrafica-duplicates";

const field = z.string().max(200).default("");
const Input = z.object({
  ragioneSociale: z.string().max(300).default(""), partitaIva: field, codiceFiscale: field,
  email: z.string().max(254).default(""), telefono: field,
  excludeId: z.string().min(1).max(100).optional(),
}).strict();
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/** POST di sola lettura: dati fiscali/contatti non finiscono nell'URL o nella cronologia. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Sessione scaduta. Accedi nuovamente per verificare le anagrafiche." }, 401);
  if (!puoGestireAnagrafiche(user.ruolo)) return json({ error: "Non hai i permessi per verificare le anagrafiche." }, 403);
  try {
    const input = Input.safeParse(await readJson(req, 8192));
    if (!input.success) return json({ error: "Dati di ricerca non validi." }, 400);
    return json(await findSimilarAnagrafiche(prisma, input.data));
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    return json({ error: "Verifica delle anagrafiche non disponibile. Riprova tra poco." }, 503);
  }
}
