"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { publicError } from "@/lib/crm/commands";
import { openUserNotification, setNotificationRead } from "@/lib/notifiche";

export type NotificationState = { error?: string; ok?: string } | undefined;

export async function setRead(id: string | null, letta: boolean, _prev: NotificationState): Promise<NotificationState> {
  const user = await requireUser();
  try {
    const count = await setNotificationRead(user.id, id, letta);
    revalidatePath("/", "layout");
    return { ok: id ? letta ? "Notifica segnata come letta." : "Notifica segnata come da leggere." : `${count} notifiche segnate come lette.` };
  } catch (error) { return { error: publicError(error) }; }
}

export async function openNotification(id: string) {
  const user = await requireUser();
  let href: string;
  try { href = await openUserNotification(user.id, id); }
  catch { redirect("/notifiche?esito=non-trovata"); }
  revalidatePath("/", "layout");
  redirect(href);
}
