import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { percorsoAssoluto } from "@/lib/storage";
import { downloadHeaders } from "@/lib/download";
import { ownedDraft } from "@/lib/commessa-wizard";
import { commessaScope, documentoScope } from "@/lib/access";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorizzato", { status: 401 });

  const { id } = await ctx.params;
  const doc = await prisma.documento.findFirst({ where: { id, ...documentoScope(user) } });
  if (!doc) return new Response("Documento non trovato", { status: 404 });
  if (user.ruolo === "PROJECT_MANAGER" && !doc.bozzaId && (!doc.commessaId || !await prisma.commessa.findFirst({ where: { id: doc.commessaId, ...commessaScope(user) }, select: { id: true } }))) return new Response("Documento non trovato", { status: 404 });
  if (doc.bozzaId) {
    try { await ownedDraft(prisma, user.id, doc.bozzaId); }
    catch { return new Response("Documento non trovato", { status: 404 }); }
  }

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
