"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { serializable } from "@/lib/transaction";
import { assignSquadra, saveSquadra } from "@/lib/risorse";
import { publicError } from "@/lib/crm/commands";

export type SquadraState = { error?: string; ok?: string; href?: string; warnings?: string[] } | undefined;
const value = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

export async function salvaSquadra(id: string | null, _state: SquadraState, f: FormData): Promise<SquadraState> {
  const user = await requireUser();
  try {
    const row = await serializable((db) => saveSquadra(db, user.id, id, {
      nome: value(f, "nome"), note: value(f, "note"), attiva: f.has("attiva"),
      membri: f.getAll("membri"), expectedUpdatedAt: value(f, "expectedUpdatedAt") ?? undefined,
    }));
    revalidatePath("/", "layout");
    return { ok: "Squadra salvata. Le assegnazioni nei cantieri sono conservate.", href: id ? undefined : `/risorse/squadre/${row.id}` };
  } catch (e) { return { error: publicError(e) }; }
}

export async function assegnaSquadra(commessaId: string, _state: SquadraState, f: FormData): Promise<SquadraState> {
  const user = await requireUser();
  try {
    const result = await serializable((db) => assignSquadra(db, user.id, commessaId, Object.fromEntries(["squadraId", "expectedUpdatedAt", "dal", "al"].map((k) => [k, value(f, k)]))));
    revalidatePath("/", "layout");
    return { ok: result.message, warnings: result.warnings };
  } catch (e) { return { error: publicError(e) }; }
}
