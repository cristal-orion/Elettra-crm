"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { publicError, runCommand } from "@/lib/crm/commands";
export type TaskState = { error?: string; ok?: string } | undefined;
export async function saveTask(_prev: TaskState, f: FormData): Promise<TaskState> {
  const user = await requireUser();
  try {
    const id = String(f.get("id") ?? "");
    const result = await runCommand(user.id, id ? { type: "aggiornaAttivita", id, expectedUpdatedAt: f.get("expectedUpdatedAt") || undefined, stato: f.get("stato") } : { type: "creaAttivita", titolo: f.get("titolo"), note: f.get("note") || null, scadenza: f.get("scadenza") || null });
    revalidatePath("/attivita"); return { ok: result.message };
  } catch (e) { return { error: publicError(e) }; }
}
