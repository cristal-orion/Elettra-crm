import { createHash } from "node:crypto";
import { prisma } from "../prisma";
import { Prisma } from "@/generated/prisma";
import { checkPermission, CrmError, executeCommand, publicError, type Db } from "../crm/commands";
import { CommandSchema, needsConfirmation, type CrmCommand } from "../crm/schemas";

export const jsonValue = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

async function snapshot(db: Db, c: CrmCommand) {
  if (c.type === "salvaAnagrafica" && c.id) return db.anagrafica.findUnique({ where: { id: c.id } });
  if (c.type === "salvaReferente") return db.anagrafica.findUnique({ where: { id: c.anagraficaId } });
  if ((c.type === "salvaCommessa" || c.type === "pianificaProgetto") && c.id) return db.commessa.findUnique({ where: { id: c.id } });
  if (c.type === "aggiornaMilestone" || c.type === "eliminaMilestone" || c.type === "spostaMilestone") return db.milestone.findUnique({ where: { id: c.id } });
  if (c.type === "aggiornaAttivita") return db.attivita.findUnique({ where: { id: c.id } });
  if (c.type === "rimuoviAssegnazione") {
    const a = await db.assegnazioneOperaio.findUnique({ where: { id: c.id }, include: { operaio: { select: { nome: true, cognome: true } }, commessa: { select: { numero: true } } } });
    return a ? { ...a, titolo: `${a.operaio.nome} ${a.operaio.cognome} · Commessa ${a.commessa.numero}` } : null;
  }
  if (c.type === "assegnaOperaio") return db.assegnazioneOperaio.findUnique({ where: { commessaId_operaioId: { commessaId: c.commessaId, operaioId: c.operaioId } } });
  return null;
}

/** L'identità della richiesta e il comando normalizzato rendono innocuo un retry. */
export async function submitOperation(userId: string, conversationId: string, requestId: string, raw: unknown) {
  const command = CommandSchema.parse(raw);
  const requestKey = createHash("sha256").update(`${userId}:${conversationId}:${requestId}:${canonical(command)}`).digest("hex");
  try { return await prisma.$transaction(async (db) => {
    await checkPermission(db, userId, command);
    const conversation = await db.aiConversation.findFirst({ where: { id: conversationId, userId } });
    if (!conversation) throw new CrmError("Conversazione non trovata.");
    const old = await db.aiOperation.findUnique({ where: { requestKey } });
    if (old) return operationOutput(old);
    const before = await snapshot(db, command);
    if (before && "updatedAt" in before && "expectedUpdatedAt" in command && command.expectedUpdatedAt && before.updatedAt.toISOString() !== command.expectedUpdatedAt) throw new CrmError("Record modificato: rileggi i dati.", "CONFLICT");
    // Per le conferme la versione viene sempre fissata sul server.
    if (before && "updatedAt" in before) Object.assign(command, { expectedUpdatedAt: before.updatedAt.toISOString() });
    const preview = jsonValue({ operazione: command.type, prima: before, proposta: command });
    const operation = await db.aiOperation.create({ data: { userId, conversationId, requestKey, command: jsonValue(command), preview, expiresAt: new Date(Date.now() + 30 * 60_000) } });
    if (needsConfirmation(command)) return operationOutput(operation);
    const result = await executeCommand(db, userId, command);
    const completed = await db.aiOperation.update({ where: { id: operation.id }, data: { status: "COMPLETED", result: jsonValue(result) } });
    return operationOutput(completed);
  }); } catch (e) {
    // Un errore annulla la transazione, ma conserva un esito consultabile.
    // Un concorrente potrebbe aver già completato lo stesso comando.
    const old = await prisma.aiOperation.findUnique({ where: { requestKey } });
    if (old) return operationOutput(old);
    const conversation = await prisma.aiConversation.findFirst({ where: { id: conversationId, userId } });
    if (!conversation) throw e;
    const failed = await prisma.aiOperation.upsert({ where: { requestKey }, update: {}, create: { userId, conversationId, requestKey, command: jsonValue(command), preview: {}, status: "FAILED", error: publicError(e), expiresAt: new Date() } });
    return operationOutput(failed);
  }
}

export function operationOutput(o: { id: string; status: string; preview: Prisma.JsonValue; result: Prisma.JsonValue | null; error: string | null }) {
  return { operationId: o.id, status: o.status, preview: o.preview, result: o.result, error: o.error, message: o.status === "PENDING" ? "Modifica preparata: serve conferma dell'utente nella scheda operazione. Non è stata eseguita." : "Consulta il risultato dell'operazione." };
}

export async function decideOperation(userId: string, id: string, approved: boolean) {
  try {
    return await prisma.$transaction(async (db) => {
      const op = await db.aiOperation.findFirst({ where: { id, userId } });
      if (!op) throw new CrmError("Operazione non trovata.", "NOT_FOUND");
      if (op.status !== "PENDING") return operationOutput(op);
      const command = CommandSchema.parse(op.command);
      await checkPermission(db, userId, command);
      if (!approved || op.expiresAt <= new Date()) {
        return operationOutput(await db.aiOperation.update({ where: { id }, data: { status: approved ? "EXPIRED" : "REJECTED" } }));
      }
      // Anche le entità prive di updatedAt (assegnazioni) vengono confrontate.
      const preview = op.preview as { prima?: unknown };
      if (canonical(jsonValue(await snapshot(db, command))) !== canonical(preview.prima)) throw new CrmError("Il record è cambiato dopo la proposta. Richiedi una nuova operazione.", "CONFLICT");
      const result = await executeCommand(db, userId, command);
      return operationOutput(await db.aiOperation.update({ where: { id }, data: { status: "COMPLETED", result: jsonValue(result) } }));
    });
  } catch (e) {
    if (e instanceof CrmError && e.code === "CONFLICT") {
      await prisma.aiOperation.updateMany({ where: { id, userId, status: "PENDING" }, data: { status: "CONFLICT", error: publicError(e) } });
    }
    throw e;
  }
}
