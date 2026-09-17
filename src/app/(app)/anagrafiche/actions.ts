"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { parseJsonField } from "@/lib/form-validation";
import { ReferentiSchema } from "@/lib/referenti-validation";
import { runCommand, publicError } from "@/lib/crm/commands";

export type AnagraficaState = { error?: string } | undefined;

async function save(id: string | undefined, form: FormData): Promise<AnagraficaState> {
  const user = await requireUser();
  const referenti = parseJsonField(form.get("referenti"), ReferentiSchema);
  if (!referenti.success) return { error: referenti.error };
  const fields = ["ragioneSociale", "partitaIva", "codiceFiscale", "codiceSDI", "indirizzo", "cap", "localita", "provincia", "telefono", "fax", "email", "web", "modalitaPagamento", "prodottiTrattati", "note"];
  const data = Object.fromEntries(fields.map((k) => [k, String(form.get(k) ?? "").trim() || null]));
  let href: string;
  try {
    const result = await runCommand(user.id, { type: "salvaAnagrafica", id, expectedUpdatedAt: form.get("expectedUpdatedAt") || undefined, data: { ...data, isCliente: form.get("isCliente") === "on", isFornitore: form.get("isFornitore") === "on" }, referenti: referenti.data });
    href = result.href;
  } catch (e) { return { error: publicError(e) }; }
  revalidatePath("/", "layout");
  redirect(href);
}
export async function createAnagrafica(_prev: AnagraficaState, form: FormData) { return save(undefined, form); }
export async function updateAnagrafica(id: string, _prev: AnagraficaState, form: FormData) { return save(id, form); }
