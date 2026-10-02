import type { PrismaClient } from "@/generated/prisma";
import { prisma } from "./prisma";
import { attivitaWhere, normalizeAttivitaFilters, type AttivitaFilters } from "./attivita";

export const printQuantity = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 });

export async function getPrintableTasks(user: { id: string; ruolo: string }, input: AttivitaFilters, db: PrismaClient = prisma, now = new Date()) {
  const filters = normalizeAttivitaFilters(user, input);
  // Nessun take/skip: si stampa l'intero risultato filtrato, non solo la pagina corrente.
  const [tasks, responsabile, commessa, cliente] = await Promise.all([
    db.attivita.findMany({
      where: attivitaWhere(user, filters, now),
      orderBy: [{ stato: "desc" }, { scadenza: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true, titolo: true, note: true, stato: true, scadenza: true,
        user: { select: { nome: true, cognome: true } },
        commessa: { select: { numero: true } },
        cliente: { select: { ragioneSociale: true } },
      },
    }),
    filters.responsabile ? db.user.findUnique({ where: { id: filters.responsabile }, select: { nome: true, cognome: true } }) : null,
    filters.commessaId ? db.commessa.findUnique({ where: { id: filters.commessaId }, select: { numero: true } }) : null,
    filters.clienteId ? db.anagrafica.findUnique({ where: { id: filters.clienteId }, select: { ragioneSociale: true } }) : null,
  ]);
  return { filters, tasks, responsabile, commessa, cliente };
}
