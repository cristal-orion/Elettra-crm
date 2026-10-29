import type { PrismaClient } from "@/generated/prisma";
import { attivitaWhere, giornoAttivita } from "./attivita";

const CATEGORIES = [
  { key: "scadute", label: "Scadute" },
  { key: "oggi", label: "In scadenza oggi" },
  { key: "prossime", label: "Prossimi 7 giorni" },
  { key: "senza", label: "Senza scadenza" },
] as const;

const personalFilters = (scadenza = "") => ({ vista: "mie", stato: "DA_FARE", scadenza });
const personalHref = (scadenza = "") => {
  const params = new URLSearchParams(personalFilters(scadenza));
  if (!scadenza) params.delete("scadenza");
  return `/attivita?${params}`;
};

/** Anche per gli amministratori è un'agenda personale. Conteggi e liste usano
 * i filtri delle Attività e la stessa fotografia del DB, nel giorno italiano. */
export async function getTodayTasks(db: PrismaClient, user: { id: string; ruolo: string }, now = new Date()) {
  return db.$transaction(async (tx) => {
    const [cards, total, tasks] = await Promise.all([
      Promise.all(CATEGORIES.map(async (category) => ({ ...category,
        count: await tx.attivita.count({ where: attivitaWhere(user, personalFilters(category.key), now) }),
        href: personalHref(category.key),
      }))),
      tx.attivita.count({ where: attivitaWhere(user, personalFilters(), now) }),
      tx.attivita.findMany({
        where: attivitaWhere(user, personalFilters("entro_oggi"), now), take: 6,
        orderBy: [{ scadenza: "asc" }, { createdAt: "desc" }, { id: "asc" }],
        select: { id: true, titolo: true, stato: true, scadenza: true, updatedAt: true, problemaId: true,
          commessa: { select: { id: true, numero: true } }, cliente: { select: { id: true, ragioneSociale: true } },
        },
      }),
    ]);
    return { cards, total, tasks, date: giornoAttivita(now),
      due: cards.filter((c) => c.key === "oggi" || c.key === "scadute").reduce((sum, c) => sum + c.count, 0),
      dueHref: personalHref("entro_oggi"), allHref: personalHref(),
    };
  }, { isolationLevel: "RepeatableRead" });
}
