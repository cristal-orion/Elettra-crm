import { access, constants } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { UPLOADS_DIR } from "@/lib/storage";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await prisma.user.count(); // Connessione e tabella applicativa: non basta SELECT 1.
    await access(UPLOADS_DIR, constants.R_OK | constants.W_OK);
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
