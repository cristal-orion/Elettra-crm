import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { percorsoAssoluto } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorizzato", { status: 401 });

  const { id } = await ctx.params;
  const p = await prisma.prodotto.findUnique({ where: { id } });
  if (!p || !p.schedaPercorso) {
    return new Response("Scheda non trovata", { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readFile(percorsoAssoluto(p.schedaPercorso));
  } catch {
    return new Response("File non disponibile", { status: 404 });
  }

  const nome = encodeURIComponent(p.schedaNomeFile ?? "scheda.pdf");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": p.schedaMime ?? "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${nome}`,
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
    },
  });
}
