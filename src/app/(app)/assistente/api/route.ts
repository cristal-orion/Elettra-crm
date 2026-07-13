import { streamText, convertToModelMessages, stepCountIs } from "ai";
import type { UIMessage } from "ai";
import { getCurrentUser } from "@/lib/dal";
import { getAssistantModel, SYSTEM_PROMPT } from "@/lib/ai";
import { buildReadTools } from "@/lib/ai-tools";

export async function POST(req: Request) {
  // Auth applicata qui (il route handler è escluso dal proxy ottimistico):
  // niente redirect, ma 401 pulito per il client fetch.
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Non autenticato", { status: 401 });
  }
  const model = await getAssistantModel();
  if (!model) {
    return new Response(
      "Assistente non configurato: manca la chiave API Gemini.",
      { status: 503 },
    );
  }

  let messages: UIMessage[];
  try {
    ({ messages } = (await req.json()) as { messages: UIMessage[] });
  } catch {
    return new Response("Richiesta non valida", { status: 400 });
  }

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: buildReadTools(),
    // Consenti più passaggi tool→risposta nello stesso turno.
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse();
}
