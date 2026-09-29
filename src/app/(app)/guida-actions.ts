"use server";

import { requireUser } from "@/lib/dal";
import { aggiungiVisto } from "@/lib/guida";
import { prisma } from "@/lib/prisma";

/** Segna un tour come visto (o `*` per tutti): non si riapre più da solo. */
export async function segnaGuidaVista(chiave: string) {
  if (typeof chiave !== "string" || !/^(\*|[a-z-]{1,40})$/.test(chiave)) return;
  const user = await requireUser();
  const nuovo = aggiungiVisto(user.guidaVista, chiave);
  if (nuovo === user.guidaVista) return;
  await prisma.user.update({ where: { id: user.id }, data: { guidaVista: nuovo } });
}
