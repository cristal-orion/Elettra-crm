"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { runCommand, publicError } from "@/lib/crm/commands";

export type CommessaState = { error?: string } | undefined;

async function save(id: string | undefined, form: FormData): Promise<CommessaState> {
  const user = await requireUser();
  const fields = ["clienteId", "referenteId", "pmId", "stato", "tipologia", "descrizione", "referenteCommerciale", "dataRichiesta", "dataInvio", "dataOrdine", "metodoRicezioneOrdine", "motivazionePersa"];
  const data: Record<string, unknown> = Object.fromEntries(fields.map((k) => [k, String(form.get(k) ?? "").trim() || null]));
  for (const field of ["importoOfferta", "importoOrdine"]) {
    const raw = String(form.get(field) ?? "").trim();
    data[field] = raw ? Number(raw.replace(",", ".")) : null;
  }
  if (form.has("oda")) data.oda = String(form.get("oda") ?? "").trim() || null;
  let href: string;
  try {
    const result = await runCommand(user.id, { type: "salvaCommessa", id, expectedUpdatedAt: form.get("expectedUpdatedAt") || undefined, data });
    href = result.href;
  } catch (e) { return { error: publicError(e) }; }
  revalidatePath("/", "layout");
  redirect(href);
}
export async function createCommessa(_prev: CommessaState, form: FormData) { return save(undefined, form); }
export async function updateCommessa(id: string, _prev: CommessaState, form: FormData) { return save(id, form); }
