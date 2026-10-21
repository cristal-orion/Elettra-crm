"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { serializable } from "@/lib/transaction";
import { publicError } from "@/lib/crm/commands";
import { InputError } from "@/lib/form-validation";
import { salvaOpportunita, cambiaFase, registraInterazione, convertiOpportunita, salvaFase } from "@/lib/commerciale";

export type CommercialeState = { error?: string; ok?: string } | undefined;
function payload(form: FormData) {
  try { return JSON.parse(String(form.get("dati"))); } catch { throw new InputError("Dati non validi. Rivedi il modulo."); }
}
function refreshCommerciale() {
  revalidatePath("/commerciale", "layout");
  revalidatePath("/attivita", "layout");
  revalidatePath("/");
}
export async function saveOpportunity(id: string, _prev: CommercialeState, form: FormData): Promise<CommercialeState> {
  const user = await requireUser();
  try { const input = payload(form); await serializable((db) => salvaOpportunita(db, user.id, id, input)); }
  catch (e) { return { error: publicError(e) }; }
  refreshCommerciale();
  redirect(`/commerciale/${id}?esito=salvata`);
}
export async function changePhase(id: string, versione: number, _prev: CommercialeState, form: FormData): Promise<CommercialeState> {
  const user = await requireUser();
  try { await serializable((db) => cambiaFase(db, user.id, id, { versione, faseId: form.get("faseId"), motivo: String(form.get("motivo") ?? "") })); }
  catch (e) { return { error: publicError(e) }; }
  refreshCommerciale();
  return { ok: "Fase aggiornata." };
}
export async function addInteraction(id: string, _prev: CommercialeState, form: FormData): Promise<CommercialeState> {
  const user = await requireUser();
  try { const input = payload(form); await serializable((db) => registraInterazione(db, user.id, id, input)); }
  catch (e) { return { error: publicError(e) }; }
  refreshCommerciale();
  redirect(`/commerciale/${id}?esito=interazione#cronologia`);
}
export async function convertOpportunity(id: string, _prev: CommercialeState, form: FormData): Promise<CommercialeState> {
  const user = await requireUser();
  let commessa: { id: string };
  try { const input = payload(form); commessa = await serializable((db) => convertiOpportunita(db, user.id, id, input)); }
  catch (e) { return { error: publicError(e) }; }
  refreshCommerciale();
  revalidatePath("/commesse", "layout");
  revalidatePath("/progetti", "layout");
  revalidatePath("/anagrafiche", "layout");
  redirect(`/commesse/${commessa.id}`);
}
export async function savePhase(id: string, _prev: CommercialeState, form: FormData): Promise<CommercialeState> {
  const user = await requireUser();
  try { const input = payload(form); await serializable((db) => salvaFase(db, user.id, id, input)); }
  catch (e) { return { error: publicError(e) }; }
  refreshCommerciale();
  redirect("/commerciale/fasi?esito=salvata");
}
