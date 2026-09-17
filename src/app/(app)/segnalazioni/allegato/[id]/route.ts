import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { percorsoAssoluto } from "@/lib/storage";
import { downloadHeaders } from "@/lib/download";

/**
 * Serve le immagini allegate alle segnalazioni. Come per i documenti di commessa
 * i file stanno fuori da /public: senza sessione non si scaricano.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non autorizzato", { status: 401 });

  const { id } = await ctx.params;
  const allegato = await prisma.allegatoSegnalazione.findUnique({ where: { id } });
  if (!allegato) return new Response("Allegato non trovato", { status: 404 });

  let data: Buffer;
  try {
    data = await readFile(percorsoAssoluto(allegato.percorso));
  } catch {
    return new Response("File non disponibile", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: downloadHeaders(allegato.nomeFile, allegato.tipoMime, data.length),
  });
}
