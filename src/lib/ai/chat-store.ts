import { randomUUID } from "node:crypto";
import type { UIMessage } from "ai";
import { prisma } from "../prisma";
import { jsonValue } from "./operations";
import { ApiError, type AiContext } from "./http";

export async function startTurn(userId: string, conversationId: string, requestId: string, text: string, context?: AiContext) {
  return prisma.$transaction(async (db) => {
    const since = new Date(Date.now() - 15 * 60_000);
    const recent = await db.aiMessage.count({ where: { conversation: { userId }, createdAt: { gte: since } } });
    if (recent >= 60) throw new ApiError("Hai raggiunto il limite di richieste. Riprova tra qualche minuto.", 429);
    let conversation = await db.aiConversation.findUnique({ where: { id: conversationId } });
    if (conversation && conversation.userId !== userId) throw new ApiError("Conversazione non trovata.", 404);
    if (!conversation) conversation = await db.aiConversation.create({ data: { id: conversationId, userId, title: text.slice(0, 90), context: context ? jsonValue(context) : undefined } });
    if (conversation.busyUntil && conversation.busyUntil > new Date()) throw new ApiError("Attendi la fine della risposta corrente.", 409);
    const count = await db.aiMessage.count({ where: { conversationId } });
    if (count >= 100) throw new ApiError("Questa conversazione ha raggiunto il limite. Avvia una nuova conversazione.", 409);
    const old = await db.aiMessage.findUnique({ where: { id: requestId } });
    if (old && (old.conversationId !== conversationId || JSON.stringify(old.payload) !== JSON.stringify({ id: requestId, role: "user", parts: [{ type: "text", text }] }))) throw new ApiError("Identificatore richiesta già utilizzato.", 409);
    if (old) {
      const last = await db.aiMessage.findFirst({ where: { conversationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      if (last?.id !== requestId) {
        const payload = last?.payload as { role?: string; metadata?: { interrupted?: boolean } } | undefined;
        const preceding = await db.aiMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 2 });
        if (payload?.role !== "assistant" || !payload.metadata?.interrupted || preceding[1]?.id !== requestId) throw new ApiError("La richiesta ha già una risposta. Ricarica la conversazione.", 409);
        await db.aiMessage.delete({ where: { id: last!.id } });
      }
    }
    const lockToken = randomUUID();
    await db.aiConversation.update({ where: { id: conversationId }, data: { busyUntil: new Date(Date.now() + 150_000), lockToken } });
    if (!old) await db.aiMessage.create({ data: { id: requestId, conversationId, payload: jsonValue({ id: requestId, role: "user", parts: [{ type: "text", text }] }) } });
    const rows = await db.aiMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return { messages: rows.map((r) => r.payload as unknown as UIMessage), context: conversation.context as AiContext | null, lockToken };
  });
}
export async function finishTurn(conversationId: string, lockToken: string, message?: UIMessage) {
  await prisma.$transaction(async (db) => {
    const lock = await db.aiConversation.updateMany({ where: { id: conversationId, lockToken }, data: { busyUntil: null, lockToken: null } });
    if (!lock.count) return;
    if (message?.parts.length) await db.aiMessage.upsert({ where: { id: message.id }, create: { id: message.id, conversationId, payload: jsonValue(message) }, update: { payload: jsonValue(message) } });
  });
}
