import { z } from "zod";
import { getCurrentUser } from "@/lib/dal";
import { apiError, ApiError, ContextSchema, readJson } from "@/lib/ai/http";
import { analyzeContext } from "@/lib/ai/analysis";
import { prisma } from "@/lib/prisma";
import { jsonValue } from "@/lib/ai/operations";
import { reserveAnalysis } from "@/lib/ai/analysis-budget";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Non autenticato", 401);
    const { context, task } = z.object({ context: ContextSchema, task: z.string().trim().min(1).max(2000) }).strict().parse(await readJson(req));
    const op = await reserveAnalysis(user.id, { context, task });
    try {
      const result = await analyzeContext(context, task, req.signal);
      await prisma.aiOperation.update({ where: { id: op.id }, data: { status: "COMPLETED", result: jsonValue(result) } });
      return Response.json(result);
    } catch (e) {
      await prisma.aiOperation.update({ where: { id: op.id }, data: { status: "FAILED", error: "Analisi non completata." } });
      throw e;
    }
  } catch (e) { return apiError(e); }
}
