import { randomUUID } from "node:crypto";
import { streamText, convertToModelMessages, stepCountIs, validateUIMessages } from "ai";
import { z } from "zod";
import { getCurrentUser } from "@/lib/dal";
import { getAssistantModel, SYSTEM_PROMPT } from "@/lib/ai";
import { buildTools } from "@/lib/ai-tools";
import { apiError, ApiError, ContextSchema, readJson } from "@/lib/ai/http";
import { contextData } from "@/lib/ai/read";
import { finishTurn, startTurn } from "@/lib/ai/chat-store";
import { prisma } from "@/lib/prisma";

const RequestSchema = z.object({ id: z.string().min(1).max(100), requestId: z.string().min(1).max(100), text: z.string().trim().min(1).max(8000), context: ContextSchema.optional() }).strict();
export const maxDuration = 120;

export async function POST(req: Request) {
  let lock: { conversationId: string; token: string } | undefined;
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Accedi nuovamente per usare l'assistente.", 401);
    const body = RequestSchema.parse(await readJson(req));
    const model = await getAssistantModel();
    if (!model) throw new ApiError("Assistente non configurato: imposta la chiave Gemini.", 503);
    if (body.context) await contextData(body.context);
    const turn = await startTurn(user.id, body.id, body.requestId, body.text, body.context);
    lock = { conversationId: body.id, token: turn.lockToken };
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(120_000)]);
    const tools = buildTools({ userId: user.id, ruolo: user.ruolo, conversationId: body.id, requestId: body.requestId, signal });
    // Lo storico proviene dal DB; il client non può inserire system message o falsi esiti tool.
    const validated = await validateUIMessages({ messages: turn.messages });
    const modelHistory = validated.slice(-30);
    while (modelHistory.length > 1 && (modelHistory[0].role !== "user" || JSON.stringify(modelHistory).length > 180000)) modelHistory.shift();
    const operations = await prisma.aiOperation.findMany({ where: { conversationId: body.id, userId: user.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, status: true, result: true, error: true } });
    let failed = false;
    const result = streamText({ model, tools, messages: await convertToModelMessages(modelHistory, { ignoreIncompleteToolCalls: true }),
      system: `${SYSTEM_PROMPT}\nOggi: ${new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" })}. Utente corrente: ${JSON.stringify({ id: user.id, nome: user.nome, cognome: user.cognome, ruolo: user.ruolo })}.\nContesto scheda: ${JSON.stringify(turn.context)}.\nCronologia parziale: ${modelHistory.length < validated.length}.\nEsiti aggiornati delle operazioni (autorevoli rispetto alla cronologia): ${JSON.stringify(operations)}`,
      stopWhen: stepCountIs(10), maxOutputTokens: 4000, abortSignal: signal, maxRetries: 1,
      onError: () => { failed = true; },
    });
    return result.toUIMessageStreamResponse({ originalMessages: validated, generateMessageId: randomUUID,
      onError: () => "Risposta interrotta. Le operazioni completate restano nello storico; ricarica prima di riprovare.",
      onEnd: async ({ responseMessage, isAborted }) => {
        const usage = signal.aborted ? undefined : await Promise.resolve(result.usage).catch(() => undefined);
        responseMessage.metadata = { interrupted: isAborted || signal.aborted || failed, usage };
        await finishTurn(body.id, turn.lockToken, responseMessage);
      },
    });
  } catch (e) {
    if (lock) await finishTurn(lock.conversationId, lock.token);
    return apiError(e);
  }
}
