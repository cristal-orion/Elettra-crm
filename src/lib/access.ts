import { Prisma } from "@/generated/prisma";
import { InputError } from "./form-validation";

export type Actor = { id: string; ruolo: string };

/** Scope applicato prima di fuzzy-search, conteggi e paginazione (alias s). */
export function commessaScopeSql(actor: Actor) {
  return actor.ruolo === "PROJECT_MANAGER" ? Prisma.sql`(s."pmId" = ${actor.id} OR EXISTS (SELECT 1 FROM "ProblemaCantiere" p WHERE p."commessaId" = s.id AND p."assegnatarioId" = ${actor.id}))` : Prisma.sql`true`;
}

/** Il responsabile di un problema è un collaboratore del relativo cantiere. */
export function commessaScope(actor: Actor): Prisma.CommessaWhereInput {
  return actor.ruolo === "PROJECT_MANAGER"
    ? { OR: [{ pmId: actor.id }, { problemi: { some: { assegnatarioId: actor.id } } }] }
    : {};
}

/** Preset iniziale: KPI e costi interni sono riservati ai ruoli amministrativi. */
export function puoLeggereEconomia(actor: Actor) {
  return ["SUPER_ADMIN", "BACKOFFICE", "AMMINISTRAZIONE"].includes(actor.ruolo);
}

export function documentoScope(actor: Actor): Prisma.DocumentoWhereInput {
  return puoLeggereEconomia(actor) ? {} : { AND: [
    { commessa: commessaScope(actor) },
    { OR: [{ categoria: { in: ["FOTO", "DISEGNO"] } }, { aggiornamentoId: { not: null } }, { problemaId: { not: null } }] },
  ] };
}

export function puoCaricareDocumento(actor: Actor, tipo: string, categoria: string) {
  return puoLeggereEconomia(actor) || (tipo === "commessa" && ["FOTO", "DISEGNO"].includes(categoria));
}

export async function assertCommessaAccess(db: Prisma.TransactionClient, actor: Actor, id: string) {
  const row = await db.commessa.findFirst({ where: { id, ...commessaScope(actor) } });
  if (!row) throw new InputError("Commessa non disponibile o non assegnata a te.");
  return row;
}

export async function activeActor(db: Prisma.TransactionClient, id: string) {
  const actor = await db.user.findUnique({ where: { id }, select: { id: true, nome: true, cognome: true, ruolo: true, attivo: true } });
  if (!actor?.attivo) throw new InputError("Sessione non valida. Accedi nuovamente.");
  return actor;
}
