import { prisma } from "@/lib/prisma";

/** Opzioni per il form commessa: clienti (con referenti) e project manager. */
export async function getCommessaFormOptions() {
  const [clienti, pms] = await Promise.all([
    prisma.anagrafica.findMany({
      where: { isCliente: true },
      orderBy: { ragioneSociale: "asc" },
      select: {
        id: true,
        ragioneSociale: true,
        codiceCliente: true,
        referenti: {
          orderBy: [{ principale: "desc" }, { cognome: "asc" }],
          // Prisma 6 su SQLite richiede anche il campo di ordinamento nel
          // select per evitare il panic "no entry found for key".
          select: {
            id: true,
            titolo: true,
            nome: true,
            cognome: true,
            principale: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { ruolo: "PROJECT_MANAGER", attivo: true },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true, cognome: true },
    }),
  ]);
  return { clienti, pms };
}
