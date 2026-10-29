import { z } from "zod";
import type { Prisma } from "@/generated/prisma";
import { activeActor } from "./access";
import { puoGestireOperai } from "./enums";
import { CrmError, executeCommand } from "./crm/commands";
import { day } from "./crm/schemas";
import { isProgetto } from "./progetti";

type Db = Prisma.TransactionClient;
const text = z.string().trim().max(5000).nullable();
const version = z.iso.datetime();
const workerSchema = z.object({
  nome: z.string().trim().min(1).max(150), cognome: z.string().trim().min(1).max(150),
  qualifica: text, squadra: z.string().max(150).nullable(), telefono: text, note: text, attivo: z.boolean(),
  expectedUpdatedAt: version.optional(),
});
const teamSchema = z.object({
  nome: z.string().trim().min(1).max(150), note: text, attiva: z.boolean(),
  membri: z.array(z.string().min(1).max(100)).max(500), expectedUpdatedAt: version.optional(),
});

async function manager(db: Db, actorId: string) {
  const actor = await activeActor(db, actorId);
  if (!puoGestireOperai(actor.ruolo)) throw new CrmError("Non hai i permessi per gestire operai e squadre.", "FORBIDDEN");
}
function checkVersion(row: { updatedAt: Date }, expected?: string) {
  if (!expected || row.updatedAt.toISOString() !== expected) throw new CrmError("I dati sono stati modificati. Ricarica prima di salvare.", "CONFLICT");
}
async function touchTeams(db: Db, names: (string | null | undefined)[]) {
  await db.squadra.updateMany({ where: { nome: { in: names.filter((n): n is string => n !== null && n !== undefined) } }, data: { updatedAt: new Date() } });
}

export async function saveOperaio(db: Db, actorId: string, id: string | null, raw: unknown) {
  await manager(db, actorId);
  const { expectedUpdatedAt, ...data } = workerSchema.parse(raw);
  const before = id ? await db.operaio.findUniqueOrThrow({ where: { id } }) : null;
  if (before) checkVersion(before, expectedUpdatedAt);
  if (data.squadra !== null) {
    const team = await db.squadra.findUnique({ where: { nome: data.squadra } });
    if (!team || (!team.attiva && before?.squadra !== team.nome)) throw new CrmError("Scegli una squadra attiva oppure nessuna squadra.");
  }
  const row = id ? await db.operaio.update({ where: { id }, data }) : await db.operaio.create({ data });
  await touchTeams(db, [before?.squadra, data.squadra]);
  return row;
}

export async function removeOperaio(db: Db, actorId: string, id: string, expected: string) {
  await manager(db, actorId);
  const row = await db.operaio.findUniqueOrThrow({ where: { id } });
  checkVersion(row, expected);
  const count = await db.assegnazioneOperaio.count({ where: { operaioId: id } });
  if (count) await db.operaio.update({ where: { id }, data: { attivo: false } });
  else await db.operaio.delete({ where: { id } });
  await touchTeams(db, [row.squadra]);
  return count ? "Operaio disattivato: assegnazioni e storico conservati." : "Operaio eliminato.";
}

export async function saveSquadra(db: Db, actorId: string, id: string | null, raw: unknown) {
  await manager(db, actorId);
  const { membri, expectedUpdatedAt, ...data } = teamSchema.parse(raw);
  if (new Set(membri).size !== membri.length) throw new CrmError("Componenti duplicati.");
  const before = id ? await db.squadra.findUniqueOrThrow({ where: { id } }) : null;
  if (before) checkVersion(before, expectedUpdatedAt);
  const duplicate = await db.squadra.findFirst({ where: { id: id ? { not: id } : undefined, nome: { equals: data.nome, mode: "insensitive" } } });
  if (duplicate) throw new CrmError("Esiste già una squadra con questo nome.");
  const workers = await db.operaio.findMany({ where: { id: { in: membri } } });
  if (workers.length !== membri.length) throw new CrmError("Un componente non è più disponibile. Ricarica l’elenco.");
  if (workers.some((w) => w.squadra !== null && w.squadra !== before?.nome)) throw new CrmError("Un operaio appartiene già a un’altra squadra. Spostalo dalla sua anagrafica prima di aggiungerlo.");
  const row = id ? await db.squadra.update({ where: { id }, data }) : await db.squadra.create({ data });
  // Il nome è la chiave del raggruppamento storico; la FK propaga le rinomine.
  await db.operaio.updateMany({ where: { squadra: row.nome, id: { notIn: membri } }, data: { squadra: null, updatedAt: new Date() } });
  await db.operaio.updateMany({ where: { id: { in: membri } }, data: { squadra: row.nome, updatedAt: new Date() } });
  return row;
}

const assignmentSchema = z.object({ squadraId: z.string().min(1).max(100), expectedUpdatedAt: version, dal: day, al: day });
/** Da chiamare in transazione serializzabile: tutti i componenti oppure nessuno. */
export async function assignSquadra(db: Db, actorId: string, commessaId: string, raw: unknown) {
  const input = assignmentSchema.parse(raw);
  const team = await db.squadra.findUnique({ where: { id: input.squadraId }, include: { membri: { where: { attivo: true }, orderBy: { id: "asc" } } } });
  if (!team?.attiva) throw new CrmError("Scegli una squadra attiva.");
  checkVersion(team, input.expectedUpdatedAt);
  if (!team.membri.length) throw new CrmError("La squadra non ha componenti attivi.");
  const { checkPermission } = await import("./crm/commands");
  const { assertCommessaAccess } = await import("./access");
  const actor = await checkPermission(db, actorId, { type: "assegnaOperaio", commessaId, operaioId: team.membri[0].id, aggiornaEsistente: false });
  const project = await assertCommessaAccess(db, actor, commessaId);
  if (!isProgetto(project.stato)) throw new CrmError("Serve una commessa acquisita per gestire il progetto.");
  if (input.dal && input.al && input.dal > input.al) throw new CrmError("La data finale non può precedere quella iniziale.");
  const existing = await db.assegnazioneOperaio.findMany({ where: { commessaId, operaioId: { in: team.membri.map((w) => w.id) } }, select: { operaioId: true } });
  const ids = new Set(existing.map((a) => a.operaioId));
  let added = 0;
  for (const worker of team.membri) {
    if (ids.has(worker.id)) continue;
    try {
      await executeCommand(db, actorId, { type: "assegnaOperaio", commessaId, operaioId: worker.id, dal: input.dal, al: input.al });
      added++;
    } catch (e) {
      if (e instanceof CrmError && e.code === "OVERLAP") throw new CrmError(`${worker.nome} ${worker.cognome}: periodo sovrapposto a un’altra assegnazione. Nessun componente aggiunto.`, "OVERLAP");
      throw e;
    }
  }
  return `${added} componenti assegnati. ${existing.length} già presenti, con date e ruoli conservati.`;
}
