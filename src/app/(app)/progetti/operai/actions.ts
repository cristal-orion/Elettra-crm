"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireOperai } from "@/lib/enums";

export type OperaioState = { error?: string; ok?: string } | undefined;

function str(formData: FormData, k: string): string | null {
  const v = String(formData.get(k) ?? "").trim();
  return v.length ? v : null;
}

async function guardia(): Promise<{ error: string } | null> {
  const user = await requireUser();
  return puoGestireOperai(user.ruolo)
    ? null
    : { error: "Non hai i permessi per gestire l'anagrafica operai." };
}

function messaggio(e: unknown): string {
  return e instanceof Error && e.message && !e.message.startsWith("Prisma")
    ? e.message
    : "Errore nel salvataggio. Riprova.";
}

/** Le assegnazioni vivono nelle pagine progetto: si revalidano entrambe. */
function aggiorna() {
  revalidatePath("/progetti/operai");
  revalidatePath("/progetti");
}

function estrai(formData: FormData) {
  return {
    nome: str(formData, "nome"),
    cognome: str(formData, "cognome"),
    qualifica: str(formData, "qualifica"),
    squadra: str(formData, "squadra"),
    telefono: str(formData, "telefono"),
    note: str(formData, "note"),
    attivo: formData.get("attivo") !== null,
  };
}

export async function createOperaio(
  _prev: OperaioState,
  formData: FormData,
): Promise<OperaioState> {
  const negato = await guardia();
  if (negato) return negato;

  const campi = estrai(formData);
  if (!campi.nome || !campi.cognome) {
    return { error: "Nome e cognome sono obbligatori." };
  }

  try {
    await prisma.operaio.create({
      data: {
        nome: campi.nome,
        cognome: campi.cognome,
        qualifica: campi.qualifica,
        squadra: campi.squadra,
        telefono: campi.telefono,
        note: campi.note,
      },
    });
  } catch (e) {
    return { error: messaggio(e) };
  }

  aggiorna();
  return { ok: "Operaio aggiunto." };
}

export async function updateOperaio(
  operaioId: string,
  _prev: OperaioState,
  formData: FormData,
): Promise<OperaioState> {
  const negato = await guardia();
  if (negato) return negato;

  const campi = estrai(formData);
  if (!campi.nome || !campi.cognome) {
    return { error: "Nome e cognome sono obbligatori." };
  }

  try {
    await prisma.operaio.update({
      where: { id: operaioId },
      data: {
        nome: campi.nome,
        cognome: campi.cognome,
        qualifica: campi.qualifica,
        squadra: campi.squadra,
        telefono: campi.telefono,
        note: campi.note,
        attivo: campi.attivo,
      },
    });
  } catch (e) {
    return { error: messaggio(e) };
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
  _formData: FormData,
): Promise<OperaioState> {
  const negato = await guardia();
  if (negato) return negato;

  try {
    const assegnazioni = await prisma.assegnazioneOperaio.count({
      where: { operaioId },
    });

    if (assegnazioni > 0) {
      await prisma.operaio.update({
        where: { id: operaioId },
        data: { attivo: false },
      });
      aggiorna();
      return {
        ok: `Assegnato a ${assegnazioni} cantier${assegnazioni === 1 ? "e" : "i"}: disattivato invece di eliminato, per non perdere lo storico.`,
      };
    }

    await prisma.operaio.delete({ where: { id: operaioId } });
  } catch (e) {
    return { error: messaggio(e) };
  }

  aggiorna();
  return { ok: "Operaio eliminato." };
}
