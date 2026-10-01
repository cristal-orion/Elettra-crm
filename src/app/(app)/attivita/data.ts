import { prisma } from "@/lib/prisma";
import { puoGestireCommesse } from "@/lib/enums";

export async function getTaskOptions(user: { id: string; ruolo: string }, currentUserId?: string) {
  const [utenti, commesse, clienti] = await Promise.all([
    prisma.user.findMany({
      where: puoGestireCommesse(user.ruolo) ? { OR: [{ attivo: true }, { id: currentUserId ?? user.id }] } : { id: user.id },
      orderBy: [{ cognome: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true, cognome: true, attivo: true },
    }),
    prisma.commessa.findMany({ orderBy: { numero: "desc" }, select: { id: true, numero: true, clienteId: true, cliente: { select: { ragioneSociale: true } } } }),
    prisma.anagrafica.findMany({ orderBy: { ragioneSociale: "asc" }, select: { id: true, ragioneSociale: true, codiceCliente: true } }),
  ]);
  return { utenti, commesse, clienti };
}

export type TaskOptions = Awaited<ReturnType<typeof getTaskOptions>>;
