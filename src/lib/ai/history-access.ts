import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma";
import { activeActor, commessaScope, puoLeggereEconomia } from "../access";
import { InputError } from "../form-validation";

/** Una risposta libera può citare più cantieri: se il perimetro cambia non si
 * riutilizza la vecchia fotografia, neppure come contesto del modello. */
export async function historyAccess(db: Prisma.TransactionClient, userId: string) {
  const actor = await activeActor(db, userId);
  const jobs = actor.ruolo === "PROJECT_MANAGER" ? await db.commessa.findMany({ where: commessaScope(actor), select: { id: true }, orderBy: { id: "asc" } }) : [];
  const key = createHash("sha256").update(JSON.stringify([actor.ruolo, jobs.map((c) => c.id)])).digest("hex");
  const legacy = puoLeggereEconomia(actor);
  return { key, where: { OR: [{ accessKey: key }, ...(legacy ? [{ accessKey: null }] : [])] },
    assert(stored: string | null) {
      if (stored !== key && !(stored === null && legacy)) throw new InputError("I tuoi permessi o cantieri sono cambiati. Avvia una nuova conversazione con i dati attuali.");
    } };
}
