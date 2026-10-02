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

export type AttivitaFilters = {
  vista?: string; responsabile?: string; stato?: string; scadenza?: string; q?: string; commessaId?: string; clienteId?: string;
};

/** La vista a schermo e la stampa devono applicare gli stessi filtri e permessi. */
export function normalizeAttivitaFilters(user: { id: string; ruolo: string }, input: AttivitaFilters) {
  const text = (value: unknown) => typeof value === "string" ? value : "";
  const vista = puoGestireCommesse(user.ruolo) && input.vista === "team" ? "team" : "mie";
  return {
    vista,
    stato: input.stato === "COMPLETATA" || input.stato === "tutte" ? input.stato : "DA_FARE",
    scadenza: ["scadute", "oggi", "prossime", "senza"].includes(input.scadenza ?? "") ? input.scadenza! : "",
    q: text(input.q).trim(),
    responsabile: vista === "team" ? text(input.responsabile) : "",
    commessaId: text(input.commessaId),
    clienteId: text(input.clienteId),
  };
}

export function attivitaWhere(user: { id: string; ruolo: string }, filters: AttivitaFilters, now = new Date()): Prisma.AttivitaWhereInput {
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
