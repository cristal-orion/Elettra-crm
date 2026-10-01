import type { Prisma } from "@/generated/prisma";
import { prisma } from "./prisma";
import { serializable } from "./transaction";
import { InputError } from "./form-validation";
import { attivitaHref, giornoAttivita } from "./attivita";
import { romeDay } from "./ai/schedule-time";
import { formatDate } from "./format";

export async function notificaAttivita(db: Prisma.TransactionClient, actorId: string, task: {
  id: string; userId: string; titolo: string; scadenza: Date | null; stato: string;
}, assegnata: boolean) {
  if (task.userId === actorId) return;
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
      select: { id: true, userId: true, titolo: true, scadenza: true },
    });
    let created = 0;
    for (const task of tasks) {
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
  if (!await db.user.findFirst({ where: { id: userId, attivo: true }, select: { id: true } })) {
    throw new InputError("Sessione non valida.");
  }
}

export async function setNotificationRead(userId: string, id: string | null, letta: boolean) {
  return serializable(async (db) => {
    await checkRecipient(db, userId);
    const result = await db.notifica.updateMany({
      where: { userId, ...(id ? { id } : { letta: false }) }, data: { letta },
    });
    if (id && !result.count) throw new InputError("Notifica non trovata.");
    return result.count;
  });
}

/** I collegamenti delle notifiche devono restare interni alle sezioni supportate. */
export function safeNotificationHref(href: string) {
  return /^\/attivita\/[a-zA-Z0-9_-]+(?:\?promemoria=\d{4}-\d{2}-\d{2})?$/.test(href)
    || /^\/assistente\/automazioni\/[a-zA-Z0-9_-]+$/.test(href)
    ? href : "/notifiche";
}

export async function openUserNotification(userId: string, id: string) {
  return serializable(async (db) => {
    await checkRecipient(db, userId);
    const notification = await db.notifica.findFirst({ where: { id, userId } });
    if (!notification) throw new InputError("Notifica non trovata.");
    await db.notifica.update({ where: { id: notification.id }, data: { letta: true } });
    return safeNotificationHref(notification.href);
  });
}

export async function unreadNotificationCount(userId: string) {
  return prisma.notifica.count({ where: { userId, letta: false } });
}
