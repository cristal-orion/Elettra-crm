"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { publicError, runCommand } from "@/lib/crm/commands";

export type TaskState = { error?: string; ok?: string } | undefined;

export async function saveTask(_prev: TaskState, form: FormData): Promise<TaskState> {
  const user = await requireUser();
  let href: string;
  try {
    const id = String(form.get("id") ?? "");
    const fields = {
      titolo: form.get("titolo"), note: form.get("note") || null,
      scadenza: form.get("scadenza") || null, userId: form.get("userId") || undefined,
      commessaId: form.get("commessaId") || null, clienteId: form.get("clienteId") || null,
    };
    const result = await runCommand(user.id, id
      ? { type: "aggiornaAttivita", id, expectedUpdatedAt: form.get("expectedUpdatedAt"), stato: form.get("stato"), ...fields }
      : { type: "creaAttivita", ...fields });
    href = result.href;
  } catch (error) { return { error: publicError(error) }; }
  revalidatePath("/", "layout");
  redirect(`${href}?esito=salvata`);
}

export async function toggleTask(id: string, expectedUpdatedAt: string, stato: string, _prev: TaskState): Promise<TaskState> {
  const user = await requireUser();
  try {
    const result = await runCommand(user.id, { type: "aggiornaAttivita", id, expectedUpdatedAt, stato });
    revalidatePath("/", "layout");
    return { ok: result.message };
  } catch (error) { return { error: publicError(error) }; }
}

export async function deleteTask(id: string, expectedUpdatedAt: string, _prev: TaskState): Promise<TaskState> {
  const user = await requireUser();
  try {
    await runCommand(user.id, { type: "eliminaAttivita", id, expectedUpdatedAt });
  } catch (error) { return { error: publicError(error) }; }
  revalidatePath("/", "layout");
  redirect("/attivita?esito=eliminata");
}
