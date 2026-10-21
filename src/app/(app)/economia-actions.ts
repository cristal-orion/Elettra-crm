"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { serializable } from "@/lib/transaction";
import { publicError } from "@/lib/crm/commands";
import { parseJsonField } from "@/lib/form-validation";
import { ConsuntivoSchema, TariffarioSchema } from "@/lib/consuntivo-schema";
import { saveConsuntivo, saveTariffario } from "@/lib/consuntivi";

export type EconomiaState = { error?: string } | undefined;

export async function salvaTariffario(clienteId: string, _prev: EconomiaState, form: FormData): Promise<EconomiaState> {
  const user = await requireUser();
  const data = parseJsonField(form.get("dati"), TariffarioSchema);
  if (!data.success) return { error: data.error };
  try { await serializable((tx) => saveTariffario(tx, user.id, clienteId, data.data)); }
  catch (e) { return { error: publicError(e) }; }
  revalidatePath(`/anagrafiche/${clienteId}/tariffario`);
  revalidatePath("/commesse/[id]/consuntivo", "page");
  redirect(`/anagrafiche/${clienteId}/tariffario?esito=salvato`);
}

export async function salvaConsuntivo(commessaId: string, _prev: EconomiaState, form: FormData): Promise<EconomiaState> {
  const user = await requireUser();
  const data = parseJsonField(form.get("dati"), ConsuntivoSchema);
  if (!data.success) return { error: data.error };
  try { await serializable((tx) => saveConsuntivo(tx, user.id, commessaId, data.data)); }
  catch (e) { return { error: publicError(e) }; }
  revalidatePath(`/commesse/${commessaId}/consuntivo`);
  revalidatePath(`/stampa/consuntivi/${commessaId}`);
  redirect(`/commesse/${commessaId}/consuntivo?esito=salvato`);
}
