import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { percorsoAssoluto } from "@/lib/storage";
import { downloadHeaders } from "@/lib/download";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorizzato", { status: 401 });

  const { id } = await ctx.params;
  const doc = await prisma.documento.findUnique({ where: { id } });
  if (!doc) return new Response("Documento non trovato", { status: 404 });

  let data: Buffer;
  try {
    data = await readFile(percorsoAssoluto(doc.percorso));
  } catch {
    return new Response("File non disponibile", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: downloadHeaders(doc.nomeFile, doc.tipoMime, data.length),
  });
}
