import { Prisma, type PrismaClient } from "@/generated/prisma";
import { prisma } from "./prisma";
import { puoGestireUtenti } from "./enums";

export class UtenteError extends Error {}

/** Trasferisce i dati operativi e cancella l'account in un'unica transazione. */
export async function eliminaUtente(
  actorId: string,
  userId: string,
  input: { emailConferma: string; subentranteId: string },
  db: PrismaClient = prisma,
) {
  await db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({
      where: { id: actorId },
      select: { attivo: true, ruolo: true },
    });
    if (!actor?.attivo || !puoGestireUtenti(actor.ruolo)) {
      throw new UtenteError("Non hai i permessi per eliminare gli utenti.");
    }
    if (actorId === userId) {
      throw new UtenteError("Non puoi eliminare il tuo stesso account.");
    }

    const target = await tx.user.findUnique({
      where: { id: userId },
      select: {
        nome: true, cognome: true, email: true, ruolo: true, attivo: true,
        _count: { select: { commesse: true, attivita: true, segnalazioni: true } },
      },
    });
    if (!target) throw new UtenteError("Utente non trovato.");
    if (input.emailConferma.trim().toLowerCase() !== target.email.toLowerCase()) {
      throw new UtenteError("Per confermare l’eliminazione, inserisci l’email dell’utente.");
    }
    if (target.ruolo === "SUPER_ADMIN" && target.attivo) {
      const altriAdmin = await tx.user.count({
        where: { ruolo: "SUPER_ADMIN", attivo: true, id: { not: userId } },
      });
      if (!altriAdmin) throw new UtenteError("Deve restare almeno un Super Admin attivo.");
    }

    const haDati = target._count.commesse + target._count.attivita + target._count.segnalazioni > 0;
    if (haDati) {
      const subentrante = input.subentranteId && input.subentranteId !== userId
        ? await tx.user.findUnique({
          where: { id: input.subentranteId }, select: { attivo: true, ruolo: true },
        })
        : null;
      if (!subentrante?.attivo) {
        throw new UtenteError("Seleziona un altro utente attivo a cui trasferire i dati collegati.");
      }
      if (target._count.commesse > 0 && subentrante.ruolo !== "PROJECT_MANAGER") {
        throw new UtenteError("Le commesse devono essere trasferite a un Project Manager attivo.");
      }

      await tx.commessa.updateMany({ where: { pmId: userId }, data: { pmId: input.subentranteId } });
      await tx.attivita.updateMany({ where: { userId }, data: { userId: input.subentranteId } });
      // La segnalazione richiede un autore: conserviamo anche l'identità originale nello storico.
      const segnalazioni = await tx.segnalazione.findMany({
        where: { autoreId: userId }, select: { id: true, descrizione: true },
      });
      for (const s of segnalazioni) {
        await tx.segnalazione.update({
          where: { id: s.id },
          data: {
            autoreId: input.subentranteId,
            descrizione: `${s.descrizione}\n\n[Account eliminato — autore precedente: ${target.nome} ${target.cognome} (${target.email})]`,
          },
        });
      }
    }

    // I destinatari delle automazioni sono ID in JSON, senza vincoli FK.
    const schedules = await tx.aiSchedule.findMany({
      where: { userId: { not: userId } }, select: { id: true, recipientIds: true },
    });
    for (const schedule of schedules) {
      if (Array.isArray(schedule.recipientIds) && schedule.recipientIds.includes(userId)) {
        await tx.aiSchedule.update({
          where: { id: schedule.id },
          data: { recipientIds: schedule.recipientIds.filter((id) => id !== userId) as Prisma.InputJsonArray },
        });
      }
    }

    // Conversazioni AI, operazioni, automazioni e notifiche personali hanno onDelete: Cascade.
    await tx.user.delete({ where: { id: userId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
