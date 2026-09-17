"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireOrdini } from "@/lib/enums";
import { applicaRegolaPC } from "@/lib/regole";
import type { Prisma } from "@/generated/prisma";
import { InputError, parseJsonField } from "@/lib/form-validation";
import { RigheOrdineSchema, TestataOrdineSchema } from "@/lib/ordini-validation";

export type OrdineState = { error?: string } | undefined;

/* -------------------------------- Testata --------------------------------- */

function estraiTestata(formData: FormData) {
  return TestataOrdineSchema.safeParse({
    fornitoreId: formData.get("fornitoreId"),
    commessaId: formData.get("commessaId"),
    numero: formData.get("numero"),
    data: formData.get("data"),
    stato: formData.get("stato"),
  });
}

/**
 * Valida fornitore e commessa senza perdere silenziosamente il collegamento.
 */
async function risolviRelazioni(
  tx: Prisma.TransactionClient,
  fornitoreId: string,
  commessaId: string | null,
): Promise<
  | { ok: true; commessaId: string | null }
  | { ok: false; error: string }
> {
  const fornitore = await tx.anagrafica.findUnique({
    where: { id: fornitoreId },
    select: { isFornitore: true },
  });
  if (!fornitore || !fornitore.isFornitore) {
    return { ok: false, error: "Fornitore non valido." };
  }

  const commId = commessaId;
  if (commId) {
    const c = await tx.commessa.findUnique({
      where: { id: commId },
      select: { id: true },
    });
    if (!c) return { ok: false, error: "Commessa non valida. Ricarica il modulo." };
  }

  return { ok: true, commessaId: commId };
}

export async function createOrdine(
  _prev: OrdineState,
  formData: FormData,
): Promise<OrdineState> {
  const user = await requireUser();
  if (!puoGestireOrdini(user.ruolo)) {
    return { error: "Non hai i permessi per gestire gli ordini." };
  }

  const testata = estraiTestata(formData);
  if (!testata.success) return { error: testata.error.issues[0]?.message ?? "Testata non valida." };
  const { fornitoreId, commessaId, numero, data, stato } = testata.data;

  const parsed = parseJsonField(formData.get("righe"), RigheOrdineSchema);
  if (!parsed.success) return { error: parsed.error };
  const righe = parsed.data;

  let id: string;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const rel = await risolviRelazioni(tx, fornitoreId, commessaId);
      if (!rel.ok) throw new InputError(rel.error);

      const ordine = await tx.ordineFornitore.create({
        data: {
          fornitoreId,
          commessaId: rel.commessaId,
          numero,
          data: data ?? new Date(),
          stato,
          righe: {
            create: righe.map(({ id: _drop, ...r }) => r),
          },
        },
      });

      // Regola bloccante P→C: il nuovo acquisto forza la commessa a Consuntivo.
      if (rel.commessaId) await applicaRegolaPC(tx, rel.commessaId);

      return ordine;
    });
    id = created.id;
  } catch (e) {
    const msg =
      e instanceof InputError
        ? e.message
        : "Errore nel salvataggio. Riprova.";
    return { error: msg };
  }

  revalidatePath("/ordini");
  if (commessaId) revalidatePath(`/commesse/${commessaId}`);
  revalidatePath("/");
  redirect(`/ordini/${id}`);
}

export async function updateOrdine(
  ordineId: string,
  _prev: OrdineState,
  formData: FormData,
): Promise<OrdineState> {
  const user = await requireUser();
  if (!puoGestireOrdini(user.ruolo)) {
    return { error: "Non hai i permessi per gestire gli ordini." };
  }

  const testata = estraiTestata(formData);
  if (!testata.success) return { error: testata.error.issues[0]?.message ?? "Testata non valida." };
  const { fornitoreId, commessaId, numero, data, stato } = testata.data;

  const parsed = parseJsonField(formData.get("righe"), RigheOrdineSchema);
  if (!parsed.success) return { error: parsed.error };
  const righe = parsed.data;

  let commessaPrecedente: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.ordineFornitore.findUnique({
        where: { id: ordineId },
        include: { righe: { select: { id: true } } },
      });
      if (!existing) throw new InputError("Ordine non trovato.");
      commessaPrecedente = existing.commessaId;

      const rel = await risolviRelazioni(tx, fornitoreId, commessaId);
      if (!rel.ok) throw new InputError(rel.error);

      const existingIds = new Set(existing.righe.map((r) => r.id));
      if (righe.some((r) => r.id && !existingIds.has(r.id))) {
        throw new InputError("Una riga non appartiene a questo ordine. Ricarica il modulo.");
      }

      await tx.ordineFornitore.update({
        where: { id: ordineId },
        data: {
          fornitoreId,
          commessaId: rel.commessaId,
          numero,
          stato,
          data: data ?? undefined,
        },
      });

      // Riconciliazione righe: le righe non sono referenziate da altre tabelle,
      // quindi le rimosse si possono eliminare senza vincoli FK.
      const incomingIds = new Set(
        righe.filter((r) => r.id).map((r) => r.id as string),
      );
      const rimossi = [...existingIds].filter((rid) => !incomingIds.has(rid));
      if (rimossi.length) {
        await tx.rigaOrdineFornitore.deleteMany({
          where: { id: { in: rimossi } },
        });
      }

      for (const r of righe) {
        const { id: rid, ...dati } = r;
        if (rid && existingIds.has(rid)) {
          await tx.rigaOrdineFornitore.update({ where: { id: rid }, data: dati });
        } else {
          await tx.rigaOrdineFornitore.create({
            data: { ordineId, ...dati },
          });
        }
      }

      // Regola bloccante P→C sulla commessa (eventualmente nuova) collegata.
      if (rel.commessaId) await applicaRegolaPC(tx, rel.commessaId);
    });
  } catch (e) {
    const msg =
      e instanceof InputError
        ? e.message
        : "Errore nel salvataggio. Riprova.";
    return { error: msg };
  }

  revalidatePath("/ordini");
  revalidatePath(`/ordini/${ordineId}`);
  if (commessaId) revalidatePath(`/commesse/${commessaId}`);
  // Se l'ordine è stato spostato, aggiorna anche la commessa di partenza.
  if (commessaPrecedente && commessaPrecedente !== commessaId) {
    revalidatePath(`/commesse/${commessaPrecedente}`);
  }
  revalidatePath("/");
  redirect(`/ordini/${ordineId}`);
}
