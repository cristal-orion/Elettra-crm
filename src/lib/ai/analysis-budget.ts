import { prisma } from "../prisma";
import { CrmError } from "../crm/commands";
import { jsonValue } from "./operations";

export async function reserveAnalysis(userId: string, command: unknown) {
  return prisma.$transaction(async (db) => {
    const recent = await db.aiOperation.count({ where: { userId, requestKey: { startsWith: "analysis:" }, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } } });
    if (recent >= 10) throw new CrmError("Limite di 10 analisi raggiunto. Riprova tra qualche minuto.", "RATE_LIMIT");
    return db.aiOperation.create({ data: { userId, requestKey: `analysis:${crypto.randomUUID()}`, command: jsonValue(command), preview: {}, status: "RUNNING", expiresAt: new Date(Date.now() + 60_000) } });
  });
}
