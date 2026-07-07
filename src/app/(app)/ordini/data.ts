import { prisma } from "@/lib/prisma";

/** Opzioni per il form ordine: fornitori e commesse a cui collegarlo. */
export async function getOrdineFormOptions() {
  const [fornitori, commesse] = await Promise.all([
    prisma.anagrafica.findMany({
      where: { isFornitore: true },
      orderBy: { ragioneSociale: "asc" },
      select: { id: true, ragioneSociale: true, codiceFornitore: true },
    }),
    prisma.commessa.findMany({
      orderBy: [{ anno: "desc" }, { progressivo: "desc" }],
      select: {
        id: true,
        numero: true,
        descrizione: true,
        cliente: { select: { ragioneSociale: true } },
      },
    }),
  ]);
  return { fornitori, commesse };
}
