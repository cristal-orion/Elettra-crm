import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { apiError, ApiError, readJson } from "@/lib/ai/http";
import { decideOperation, operationOutput } from "@/lib/ai/operations";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Non autenticato", 401);
    const op = await prisma.aiOperation.findFirst({ where: { id: (await ctx.params).id, userId: user.id } });
    if (!op) throw new ApiError("Operazione non trovata", 404);
    return Response.json(operationOutput(op));
  } catch (e) { return apiError(e); }
}
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new ApiError("Non autenticato", 401);
    const { approved } = z.object({ approved: z.boolean() }).strict().parse(await readJson(req));
    const result = await decideOperation(user.id, (await ctx.params).id, approved);
    revalidatePath("/", "layout");
    return Response.json(result);
  } catch (e) { return apiError(e); }
}
