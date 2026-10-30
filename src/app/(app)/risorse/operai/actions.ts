"use server";

import { revalidatePath } from "next/cache";
import { serializable } from "@/lib/transaction";
import { saveOperaio, removeOperaio } from "@/lib/risorse";
import { publicError } from "@/lib/crm/commands";
import { requireUser } from "@/lib/dal";

export type OperaioState = { error?: string; ok?: string } | undefined;

function str(formData: FormData, k: string): string | null {
  const v = String(formData.get(k) ?? "").trim();
  return v.length ? v : null;
}

/** Le assegnazioni vivono nelle pagine progetto: si revalidano entrambe. */
function aggiorna() {
  revalidatePath("/", "layout");
}

function estrai(formData: FormData) {
  return {
    nome: str(formData, "nome"),
    cognome: str(formData, "cognome"),
    qualifica: str(formData, "qualifica"),
    squadre: formData.getAll("squadre"),
    telefono: str(formData, "telefono"),
    note: str(formData, "note"),
    attivo: formData.get("attivo") !== null,
    expectedUpdatedAt: str(formData, "expectedUpdatedAt") ?? undefined,
  };
}

export async function createOperaio(
  _prev: OperaioState,
  formData: FormData,
): Promise<OperaioState> {
  const user = await requireUser();

  const campi = estrai(formData);
  if (!campi.nome || !campi.cognome) {
    return { error: "Nome e cognome sono obbligatori." };
  }

  try {
    await serializable((db) => saveOperaio(db, user.id, null, { ...campi, attivo: true }));
  } catch (e) {
    return { error: publicError(e) };
  }

  aggiorna();
  return { ok: "Operaio aggiunto." };
}

export async function updateOperaio(
  operaioId: string,
  _prev: OperaioState,
  formData: FormData,
): Promise<OperaioState> {
  const user = await requireUser();

  const campi = estrai(formData);
  if (!campi.nome || !campi.cognome) {
    return { error: "Nome e cognome sono obbligatori." };
  }

  try {
    await serializable((db) => saveOperaio(db, user.id, operaioId, campi));
  } catch (e) {
    return { error: publicError(e) };
  }

  aggiorna();
  return { ok: "Operaio aggiornato." };
}

/**
 * Eliminazione consentita solo se l'operaio non è mai stato assegnato: il
 * cascade cancellerebbe la storia delle squadre dei cantieri. Con assegnazioni
 * presenti si disattiva, così resta nello storico ma non è più assegnabile.
 */
export async function deleteOperaio(
  operaioId: string,
  _prev: OperaioState,
  formData: FormData,
): Promise<OperaioState> {
  const user = await requireUser();

  try {
    const ok = await serializable((db) => removeOperaio(db, user.id, operaioId, str(formData, "expectedUpdatedAt") ?? ""));
    aggiorna();
    return { ok };
  } catch (e) {
    return { error: publicError(e) };
  }
}
