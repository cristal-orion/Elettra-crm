import { Prisma } from "@/generated/prisma";
import { prisma } from "./prisma";
import { serializable } from "./transaction";
import { InputError } from "./form-validation";
import { attivitaHref, attivitaScope, giornoAttivita } from "./attivita";
import { activeActor, commessaScopeSql, puoLeggereEconomia, type Actor } from "./access";
import { puoGestireCommesse } from "./enums";
import { romeDay } from "./ai/schedule-time";
import { formatDate } from "./format";

export async function notificaAttivita(db: Prisma.TransactionClient, actorId: string, task: {
  id: string; userId: string; titolo: string; scadenza: Date | null; stato: string;
}, assegnata: boolean) {
  if (task.userId === actorId) return;
  const recipient = await activeActor(db, task.userId);
  if (!await db.attivita.findFirst({ where: { id: task.id, ...attivitaScope(recipient, "team") }, select: { id: true } })) return;
  const actor = await db.user.findUniqueOrThrow({ where: { id: actorId }, select: { nome: true, cognome: true } });
  await db.notifica.create({ data: {
    userId: task.userId,
    titolo: assegnata ? "Nuova attività assegnata" : "Attività aggiornata",
    testo: `${actor.nome} ${actor.cognome}: ${task.titolo}${assegnata ? "" : ` · ${task.stato === "COMPLETATA" ? "Completata" : "Da fare"}`}${task.scadenza ? ` · Scadenza ${formatDate(task.scadenza)}` : ""}`,
    href: attivitaHref(task.id),
  } });
}

export function notificheAttivitaWhere(id: string): Prisma.NotificaWhereInput {
  const href = attivitaHref(id);
  return { runId: null, OR: [{ href }, { href: { startsWith: `${href}?` } }] };
}

/** Un promemoria al giorno per attività in scadenza/scaduta, anche senza controlli AI configurati. */
export async function notifyDueTasks(now = new Date()) {
  return serializable(async (db) => {
    const tasks = await db.attivita.findMany({
      where: { stato: "DA_FARE", scadenza: { lt: new Date(giornoAttivita(now).getTime() + 86400000) }, user: { attivo: true } },
      select: { id: true, userId: true, titolo: true, scadenza: true, user: { select: { id: true, ruolo: true } } },
    });
    let created = 0;
    for (const task of tasks) {
      if (!await db.attivita.findFirst({ where: { id: task.id, ...attivitaScope(task.user, "team") }, select: { id: true } })) continue;
      const href = `${attivitaHref(task.id)}?promemoria=${romeDay(now)}`;
      if (await db.notifica.findFirst({ where: { userId: task.userId, href, runId: null }, select: { id: true } })) continue;
      const scaduta = task.scadenza! < giornoAttivita(now);
      await db.notifica.create({ data: {
        userId: task.userId, href, createdAt: now,
        titolo: scaduta ? "Attività scaduta" : "Attività in scadenza oggi",
        testo: `${task.titolo} · Scadenza ${formatDate(task.scadenza)}`,
      } });
      created++;
    }
    return created;
  });
}

async function checkRecipient(db: Prisma.TransactionClient, userId: string) {
  return activeActor(db, userId);
}

/** Ricalcola l'accesso anche alle copie storiche dei titoli nelle notifiche. */
export async function notificationScope(db: Prisma.TransactionClient, actor: Actor): Promise<Prisma.NotificaWhereInput> {
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT n.id FROM "Notifica" n WHERE n."userId" = ${actor.id} AND CASE
      WHEN n."runId" IS NOT NULL OR n.href LIKE '/assistente/automazioni/%' THEN ${puoLeggereEconomia(actor)}
      WHEN n.href LIKE '/problemi/%' THEN EXISTS (
        SELECT 1 FROM "ProblemaCantiere" p JOIN "Commessa" s ON s.id = p."commessaId"
        WHERE p.id = split_part(n.href, '/', 3) AND ${commessaScopeSql(actor)})
      WHEN n.href LIKE '/attivita/%' THEN EXISTS (
        SELECT 1 FROM "Attivita" a LEFT JOIN "Commessa" s ON s.id = a."commessaId"
        WHERE a.id = split_part(split_part(n.href, '?', 1), '/', 3)
        AND (${puoGestireCommesse(actor.ruolo)} OR a."userId" = ${actor.id})
        AND (${puoLeggereEconomia(actor)} OR a."opportunitaId" IS NULL)
        AND (a."commessaId" IS NULL OR ${commessaScopeSql(actor)}))
      ELSE true END`);
  return { userId: actor.id, id: { in: rows.map((r) => r.id) } };
}

export async function setNotificationRead(userId: string, id: string | null, letta: boolean) {
  return serializable(async (db) => {
    const actor = await checkRecipient(db, userId);
    const result = await db.notifica.updateMany({
      where: { AND: [await notificationScope(db, actor), id ? { id } : { letta: false }] }, data: { letta },
    });
    if (id && !result.count) throw new InputError("Notifica non trovata.");
    return result.count;
  });
}

/** I collegamenti delle notifiche devono restare interni alle sezioni supportate. */
export function safeNotificationHref(href: string) {
  return /^\/attivita\/[a-zA-Z0-9_-]+(?:\?promemoria=\d{4}-\d{2}-\d{2})?$/.test(href)
    || /^\/problemi\/[a-zA-Z0-9_-]+$/.test(href)
    || /^\/assistente\/automazioni\/[a-zA-Z0-9_-]+$/.test(href)
    ? href : "/notifiche";
}

export async function openUserNotification(userId: string, id: string) {
  return serializable(async (db) => {
    const actor = await checkRecipient(db, userId);
    const notification = await db.notifica.findFirst({ where: { AND: [{ id }, await notificationScope(db, actor)] } });
    if (!notification) throw new InputError("Notifica non trovata.");
    await db.notifica.update({ where: { id: notification.id }, data: { letta: true } });
    return safeNotificationHref(notification.href);
  });
}

export async function unreadNotificationCount(userId: string) {
  const actor = await activeActor(prisma, userId);
  return prisma.notifica.count({ where: { ...await notificationScope(prisma, actor), letta: false } });
}
