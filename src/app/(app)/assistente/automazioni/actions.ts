"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { publicError } from "@/lib/crm/commands";
import { runSchedule } from "@/lib/ai/scheduler";

export type ScheduleState = { error?: string; ok?: string } | undefined;
const Schema = z.object({ name: z.string().trim().min(1).max(150), hour: z.coerce.number().int().min(0).max(23), minute: z.coerce.number().int().min(0).max(59), followupDays: z.coerce.number().int().min(1).max(365), horizonDays: z.coerce.number().int().min(1).max(60), weekdaysOnly: z.boolean(), recipientIds: z.array(z.string().min(1)).min(1).max(100) });
export async function saveSchedule(_previous: ScheduleState, form: FormData): Promise<ScheduleState> {
  const user = await requireUser();
  if (user.ruolo !== "SUPER_ADMIN") return { error: "Solo un amministratore può configurare i controlli." };
  try {
    const data = Schema.parse({ name: form.get("name"), hour: form.get("hour"), minute: form.get("minute"), followupDays: form.get("followupDays"), horizonDays: form.get("horizonDays"), weekdaysOnly: form.get("weekdaysOnly") === "on", recipientIds: [...new Set(form.getAll("recipientIds").map(String))] });
    if (await prisma.user.count({ where: { id: { in: data.recipientIds }, attivo: true } }) !== data.recipientIds.length) return { error: "Seleziona destinatari attivi." };
    const id = String(form.get("id") ?? "");
    if (id) {
      const updated = await prisma.aiSchedule.updateMany({ where: { id, userId: user.id }, data });
      if (!updated.count) return { error: "Pianificazione non trovata." };
    } else await prisma.aiSchedule.create({ data: { ...data, userId: user.id } });
    revalidatePath("/assistente/automazioni"); return { ok: "Pianificazione salvata. L'esecuzione automatica richiede il comando schedulato sul server." };
  } catch (e) { return { error: publicError(e) }; }
}
export async function toggleSchedule(id: string, _prev: ScheduleState): Promise<ScheduleState> {
  const user = await requireUser();
  if (user.ruolo !== "SUPER_ADMIN") return { error: "Permesso negato." };
  const s = await prisma.aiSchedule.findFirst({ where: { id, userId: user.id } });
  if (!s) return { error: "Pianificazione non trovata." };
  await prisma.aiSchedule.update({ where: { id }, data: { enabled: !s.enabled } });
  revalidatePath("/assistente/automazioni"); return { ok: s.enabled ? "Controllo sospeso." : "Controllo attivato." };
}
export async function runNow(id: string, _prev: ScheduleState): Promise<ScheduleState> {
  const user = await requireUser();
  if (user.ruolo !== "SUPER_ADMIN") return { error: "Permesso negato." };
  if (!await prisma.aiSchedule.findFirst({ where: { id, userId: user.id } })) return { error: "Pianificazione non trovata." };
  try {
    const result = await runSchedule(id, `manual:${Math.floor(Date.now() / 300000)}`);
    revalidatePath("/", "layout");
    return result.skipped ? { ok: "Controllo già eseguito negli ultimi 5 minuti o ancora in corso." } : result.error ? { error: result.error } : { ok: "Controllo completato. Il riepilogo è nello storico e nelle notifiche." };
  } catch (e) { return { error: publicError(e) }; }
}
