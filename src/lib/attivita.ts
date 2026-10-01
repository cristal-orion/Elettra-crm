import type { Prisma } from "@/generated/prisma";
import { puoGestireCommesse } from "./enums";
import { romeDay } from "./ai/schedule-time";

export function giornoAttivita(now = new Date()) {
  return new Date(`${romeDay(now)}T00:00:00.000Z`);
}

export function attivitaScope(user: { id: string; ruolo: string }, vista?: string, responsabile?: string): Prisma.AttivitaWhereInput {
  return vista === "team" && puoGestireCommesse(user.ruolo)
    ? { userId: responsabile || undefined }
    : { userId: user.id };
}

export function attivitaWhere(user: { id: string; ruolo: string }, filters: {
  vista?: string; responsabile?: string; stato?: string; scadenza?: string; q?: string; commessaId?: string; clienteId?: string;
}, now = new Date()): Prisma.AttivitaWhereInput {
  const oggi = giornoAttivita(now);
  const domani = new Date(oggi.getTime() + 86400000);
  const periodo: Prisma.AttivitaWhereInput = filters.scadenza === "scadute" ? { stato: "DA_FARE", scadenza: { lt: oggi } }
    : filters.scadenza === "oggi" ? { stato: "DA_FARE", scadenza: { gte: oggi, lt: domani } }
    : filters.scadenza === "prossime" ? { stato: "DA_FARE", scadenza: { gte: domani, lt: new Date(oggi.getTime() + 8 * 86400000) } }
    : filters.scadenza === "senza" ? { scadenza: null } : {};
  const q = filters.q?.trim();
  return {
    ...attivitaScope(user, filters.vista, filters.responsabile),
    commessaId: filters.commessaId || undefined,
    clienteId: filters.clienteId || undefined,
    AND: [
      { stato: filters.stato === "tutte" ? undefined : filters.stato === "COMPLETATA" ? "COMPLETATA" : "DA_FARE" },
      periodo,
      q ? { OR: [
        { titolo: { contains: q, mode: "insensitive" } },
        { note: { contains: q, mode: "insensitive" } },
        { commessa: { numero: { contains: q, mode: "insensitive" } } },
        { cliente: { ragioneSociale: { contains: q, mode: "insensitive" } } },
      ] } : {},
    ],
  };
}

export function statoScadenza(scadenza: Date | null, stato: string, now = new Date()) {
  if (stato === "COMPLETATA") return "completata";
  if (!scadenza) return "senza";
  const today = giornoAttivita(now).getTime();
  if (scadenza.getTime() < today) return "scaduta";
  if (scadenza.getTime() < today + 86400000) return "oggi";
  return "pianificata";
}

export function attivitaHref(id: string) {
  return `/attivita/${encodeURIComponent(id)}`;
}
