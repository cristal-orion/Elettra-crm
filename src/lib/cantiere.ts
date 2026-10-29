import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma";
import { activeActor, assertCommessaAccess, documentoScope, type Actor } from "./access";
import { InputError } from "./form-validation";
import { puoGestireProgetti } from "./enums";
import { avanzamento, isProgetto } from "./progetti";
import { SalInput, SospensioneInput, ProblemaInput, ProblemaUpdate, STATI_PROBLEMA } from "./cantiere-schema";

type Db = Prisma.TransactionClient;
const json = (data: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(data));
const hash = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const nome = (actor: { nome: string; cognome: string }) => `${actor.nome} ${actor.cognome}`;
export const problemaHref = (id: string) => `/problemi/${id}`;

async function operator(db: Db, userId: string, commessaId: string) {
  const actor = await activeActor(db, userId);
  if (!puoGestireProgetti(actor.ruolo)) throw new InputError("Non hai i permessi per aggiornare il cantiere.");
  const commessa = await assertCommessaAccess(db, actor, commessaId);
  if (!isProgetto(commessa.stato)) throw new InputError("Il cantiere è disponibile dopo la conferma dell’incarico.");
  return { actor, commessa };
}

function retry(row: { autoreId: string; richiestaHash: string }, actorId: string, input: unknown) {
  if (row.autoreId !== actorId || row.richiestaHash !== hash(input)) throw new InputError("Richiesta già utilizzata per un altro salvataggio. Ricarica la scheda.");
}

async function attach(db: Db, actor: Actor, commessaId: string, ids: string[], owner: { aggiornamentoId?: string; problemaId?: string }, nuovi: string[]) {
  if (new Set(ids).size !== ids.length) throw new InputError("Allegati duplicati.");
  const docs = await db.documento.findMany({ where: { id: { in: ids }, commessaId, bozzaId: null, aggiornamentoId: null,
    AND: [{ OR: [documentoScope(actor), { id: { in: nuovi } }] }],
    OR: [{ problemaId: null }, ...(owner.problemaId ? [{ problemaId: owner.problemaId }] : [])] } });
  if (docs.length !== ids.length) throw new InputError("Un allegato non è disponibile in questo cantiere o è già collegato a un SAL.");
  await db.documento.updateMany({ where: { id: { in: ids } }, data: owner });
}

async function recipient(db: Db, id: string | null) {
  if (!id) return;
  const user = await db.user.findUnique({ where: { id }, select: { attivo: true, ruolo: true } });
  if (!user?.attivo || !puoGestireProgetti(user.ruolo)) throw new InputError("Scegli un responsabile operativo attivo.");
}

export async function saveSal(db: Db, userId: string, commessaId: string, raw: unknown, nuoviDocumenti: string[] = []) {
  const input = SalInput.parse(raw);
  const { actor, commessa } = await operator(db, userId, commessaId);
  const existing = await db.aggiornamentoCantiere.findUnique({ where: { richiestaId: input.richiestaId } });
  const fingerprint = { commessaId, ...input };
  if (existing) { retry(existing, actor.id, fingerprint); return existing; }
  if (commessa.versioneOperativa !== input.versione) throw new InputError("Il cantiere è stato aggiornato da un collega. Ricarica per confrontare le modifiche.");
  const before = await db.milestone.findMany({ where: { commessaId, dimostrativa: false }, orderBy: { ordine: "asc" } });
  if (!before.length) throw new InputError("Aggiungi almeno una milestone reale prima di registrare il SAL.");
  if (avanzamento(before).durateMancanti) throw new InputError("Definisci la durata prevista di tutte le milestone reali prima di registrare il SAL.");
  if (new Set(input.milestone.map((m) => m.id)).size !== input.milestone.length || input.milestone.length !== before.length) throw new InputError("La pianificazione è cambiata. Ricarica le milestone.");
  const changes = before.map((m) => {
    const next = input.milestone.find((v) => v.id === m.id);
    if (!next || next.versione !== m.updatedAt.toISOString()) throw new InputError("Una milestone è stata modificata. Ricarica per confrontare i dati.");
    return { ...m, stato: next.stato };
  });
  const data = new Date(`${input.data}T00:00:00Z`);
  if (input.data > new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" })) throw new InputError("La data del SAL non può essere futura.");
  for (const next of changes) {
    const old = before.find((m) => m.id === next.id)!;
    if (old.stato !== next.stato) await db.milestone.update({ where: { id: next.id }, data: {
      stato: next.stato, dataEffettiva: next.stato === "COMPLETATA" ? data : null,
    } });
  }
  const snapshot = (rows: typeof before) => ({ metodo: "DURATA_GIORNI_V1", percentuale: avanzamento(rows).percentuale, milestone: rows.map(({ id, titolo, stato, durataGiorni }) => ({ id, titolo, stato, durataGiorni })) });
  const update = await db.aggiornamentoCantiere.create({ data: {
    richiestaId: input.richiestaId, richiestaHash: hash(fingerprint), commessaId, autoreId: actor.id, autoreNome: nome(actor),
    data, nota: input.nota || null, prima: snapshot(before), dopo: snapshot(changes),
  } });
  await attach(db, actor, commessaId, input.documenti, { aggiornamentoId: update.id }, nuoviDocumenti);
  await db.commessa.update({ where: { id: commessaId }, data: { versioneOperativa: { increment: 1 } } });
  return update;
}

export async function setSospensione(db: Db, userId: string, commessaId: string, raw: unknown) {
  const input = SospensioneInput.parse(raw);
  const { actor, commessa } = await operator(db, userId, commessaId);
  const fingerprint = { commessaId, ...input };
  const existing = await db.aggiornamentoCantiere.findUnique({ where: { richiestaId: input.richiestaId } });
  if (existing) { retry(existing, actor.id, fingerprint); return existing; }
  if (commessa.versioneOperativa !== input.versione) throw new InputError("Il cantiere è cambiato. Ricarica i dati prima di salvare.");
  if (input.sospeso && input.motivo.length < 3) throw new InputError("Indica il motivo della sospensione.");
  const next = { sospeso: input.sospeso, motivoSospensione: input.sospeso ? input.motivo : null };
  await db.commessa.update({ where: { id: commessaId }, data: { ...next, versioneOperativa: { increment: 1 } } });
  return db.aggiornamentoCantiere.create({ data: { richiestaId: input.richiestaId, richiestaHash: hash(fingerprint), commessaId,
    autoreId: actor.id, autoreNome: nome(actor), tipo: input.sospeso ? "SOSPENSIONE" : "RIPRESA", data: new Date(), nota: input.motivo || null,
    prima: { sospeso: commessa.sospeso, motivoSospensione: commessa.motivoSospensione }, dopo: next } });
}

async function notify(db: Db, userId: string | null, eventId: string, title: string, text: string, href: string, author: string) {
  if (!userId || userId === author) return;
  await db.notifica.upsert({ where: { eventoKey: `${eventId}:${userId}` }, update: {}, create: { userId, eventoKey: `${eventId}:${userId}`, titolo: title, testo: text, href } });
}

export async function createProblema(db: Db, userId: string, commessaId: string, raw: unknown, nuoviDocumenti: string[] = []) {
  const input = ProblemaInput.parse(raw);
  const { actor, commessa } = await operator(db, userId, commessaId);
  const fingerprint = { commessaId, ...input };
  const existing = await db.problemaCantiere.findUnique({ where: { richiestaId: input.richiestaId } });
  if (existing) { retry(existing, actor.id, fingerprint); return existing; }
  await recipient(db, input.assegnatarioId);
  if (input.creaAttivita && (!input.assegnatarioId || !input.scadenza)) throw new InputError("Per creare l’attività scegli responsabile e scadenza.");
  const { documenti, creaAttivita, ...data } = input;
  const problem = await db.problemaCantiere.create({ data: { ...data, richiestaHash: hash(fingerprint), commessaId,
    scadenza: input.scadenza ? new Date(input.scadenza) : null, autoreId: actor.id, autoreNome: nome(actor) } });
  await attach(db, actor, commessaId, documenti, { problemaId: problem.id }, nuoviDocumenti);
  const event = await db.eventoProblema.create({ data: { richiestaId: input.richiestaId, richiestaHash: hash(fingerprint), problemaId: problem.id,
    autoreId: actor.id, autoreNome: nome(actor), testo: "Problema aperto", dopo: json(problem) } });
  if (creaAttivita) await db.attivita.create({ data: { titolo: input.titolo, note: input.descrizione, userId: input.assegnatarioId!, scadenza: problem.scadenza,
    commessaId, clienteId: commessa.clienteId, problemaId: problem.id } });
  await notify(db, input.assegnatarioId, event.id, `Problema assegnato · ${commessa.numero}`, input.titolo, problemaHref(problem.id), actor.id);
  await db.commessa.update({ where: { id: commessaId }, data: { updatedAt: new Date() } });
  return problem;
}

export async function updateProblema(db: Db, userId: string, id: string, raw: unknown, nuoviDocumenti: string[] = []) {
  const input = ProblemaUpdate.parse(raw);
  const before = await db.problemaCantiere.findUnique({ where: { id } });
  if (!before) throw new InputError("Problema non disponibile.");
  const { actor, commessa } = await operator(db, userId, before.commessaId);
  const fingerprint = { id, ...input };
  const existing = await db.eventoProblema.findUnique({ where: { richiestaId: input.richiestaId } });
  if (existing) { retry(existing, actor.id, fingerprint); return before; }
  if (input.versione !== before.versione) throw new InputError("Il problema è stato aggiornato da un collega. Ricarica prima di salvare.");
  await recipient(db, input.assegnatarioId);
  const task = await db.attivita.findUnique({ where: { problemaId: id } });
  if (task && (!input.assegnatarioId || !input.scadenza)) throw new InputError("Il problema ha un’attività collegata: conserva responsabile e scadenza.");
  const next = await db.problemaCantiere.update({ where: { id }, data: { stato: input.stato, priorita: input.priorita,
    assegnatarioId: input.assegnatarioId, scadenza: input.scadenza ? new Date(input.scadenza) : null, versione: { increment: 1 } } });
  await attach(db, actor, before.commessaId, input.documenti, { problemaId: id }, nuoviDocumenti);
  const event = await db.eventoProblema.create({ data: { richiestaId: input.richiestaId, richiestaHash: hash(fingerprint), problemaId: id,
    autoreId: actor.id, autoreNome: nome(actor), testo: input.commento || `Stato: ${STATI_PROBLEMA[input.stato]}`, prima: json(before), dopo: json(next) } });
  if (task) await db.attivita.update({ where: { id: task.id }, data: { userId: input.assegnatarioId!, scadenza: next.scadenza,
    stato: input.stato === "RISOLTA" ? "COMPLETATA" : "DA_FARE" } });
  for (const recipientId of new Set([next.assegnatarioId, commessa.pmId])) await notify(db, recipientId, event.id,
    `Problema aggiornato · ${commessa.numero}`, `${next.titolo} · ${STATI_PROBLEMA[input.stato]}`, problemaHref(id), actor.id);
  await db.commessa.update({ where: { id: before.commessaId }, data: { updatedAt: new Date() } });
  return next;
}
