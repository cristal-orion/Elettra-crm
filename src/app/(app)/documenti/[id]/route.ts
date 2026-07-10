import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { percorsoAssoluto } from "@/lib/storage";

/** Solo PDF e immagini raster si aprono inline; il resto è scaricato (evita
 *  l'esecuzione di HTML/SVG serviti dallo stesso dominio). */
function apreInline(tipoMime: string | null): boolean {
  if (!tipoMime) return false;
  if (tipoMime === "application/pdf") return true;
  return tipoMime.startsWith("image/") && tipoMime !== "image/svg+xml";
}

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

  const disposition = apreInline(doc.tipoMime) ? "inline" : "attachment";
  const nome = encodeURIComponent(doc.nomeFile);

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.tipoMime ?? "application/octet-stream",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${nome}`,
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
    },
  });
}
