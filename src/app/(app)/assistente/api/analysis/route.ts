import { z } from "zod";
import { getCurrentUser } from "@/lib/dal";
import { apiError, ApiError, ContextSchema, readJson } from "@/lib/ai/http";
import { analyzeContext } from "@/lib/ai/analysis";
import { prisma } from "@/lib/prisma";
import { jsonValue } from "@/lib/ai/operations";
import { reserveAnalysis } from "@/lib/ai/analysis-budget";
import { analysisFailure } from "@/lib/ai/analysis-error";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Non autenticato", 401);
    const { context, task } = z.object({ context: ContextSchema, task: z.string().trim().min(1).max(2000) }).strict().parse(await readJson(req));
    const op = await reserveAnalysis(user.id, { context, task });
    try {
      const result = await analyzeContext(context, task, user, req.signal);
      await prisma.aiOperation.update({ where: { id: op.id }, data: { status: "COMPLETED", result: jsonValue(result) } });
      return Response.json(result);
    } catch (e) {
      const failure = analysisFailure(e);
      console.error("[ai.analysis]", { operationId: op.id, code: failure.code, providerStatus: failure.providerStatus });
      try {
        await prisma.aiOperation.update({ where: { id: op.id }, data: { status: "FAILED", error: `${failure.code}: ${failure.message}` } });
      } catch {
        console.error("[ai.analysis]", { operationId: op.id, code: "FAILURE_RECORD_UNAVAILABLE" });
      }
      return Response.json({ error: failure.message, code: failure.code, retryable: failure.retryable }, {
        status: failure.status,
        headers: failure.retryAfter ? { "Retry-After": String(failure.retryAfter) } : undefined,
      });
    }
  } catch (e) { return apiError(e); }
}
