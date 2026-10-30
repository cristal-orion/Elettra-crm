import type { Prisma } from "@/generated/prisma";
import { STATI_PROGETTO_ATTIVO } from "./progetti";

type Impegno = { operaioId: string; nome: string; cognome: string; dal?: Date | null; al?: Date | null };

/** Avviso informativo: le assegnazioni contemporanee sono consentite per tutti.
 * Non carica nomi, numeri o altri dettagli dei cantieri fuori perimetro. */
export async function avvisiAssegnazioni(db: Prisma.TransactionClient, commessaId: string, impegni: Impegno[]): Promise<string[]> {
  if (!impegni.length) return [];
  const overlaps = await db.assegnazioneOperaio.findMany({
    where: {
      commessaId: { not: commessaId },
      commessa: { stato: { in: [...STATI_PROGETTO_ATTIVO] }, dataFineLavori: null },
      OR: impegni.map(({ operaioId, dal, al }) => ({ operaioId, AND: [
        ...(dal ? [{ OR: [{ al: null }, { al: { gte: dal } }] }] : []),
        ...(al ? [{ OR: [{ dal: null }, { dal: { lte: al } }] }] : []),
      ] })),
    },
    select: { operaioId: true }, distinct: ["operaioId"],
  });
  const ids = new Set(overlaps.map((a) => a.operaioId));
  return impegni.filter((a) => ids.has(a.operaioId)).map((a) => `${a.nome} ${a.cognome}: già assegnato ad altri cantieri nel periodo indicato.`);
}
