"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import {
  puoGestireCommesse,
  STATI_COMMESSA,
  TIPOLOGIE,
  METODI_RICEZIONE,
} from "@/lib/enums";
import type { Prisma } from "@/generated/prisma";

export type CommessaState = { error?: string } | undefined;

const STATI_VALIDI = Object.keys(STATI_COMMESSA);
const TIPOLOGIE_VALIDE = Object.keys(TIPOLOGIE);
const METODI_VALIDI = Object.keys(METODI_RICEZIONE);

/**
 * Prossimo numero commessa. Il progressivo è un contatore globale monotòno
 * (come i dati storici, es. 1041…1070); il numero è "AANNNN" con AA = anno.
 */
async function nextNumero(
  tx: Prisma.TransactionClient,
  anno: number,
): Promise<{ progressivo: number; numero: string }> {
  const rows = await tx.commessa.findMany({ select: { progressivo: true } });
  let max = 0;
  for (const r of rows) if (r.progressivo > max) max = r.progressivo;
  const progressivo = max + 1;
  const numero = `${String(anno).slice(-2)}${String(progressivo).padStart(4, "0")}`;
  return { progressivo, numero };
}

/** Estrae e normalizza i campi della commessa dal FormData. */
function estrai(formData: FormData) {
  const str = (k: string): string | null => {
    const v = String(formData.get(k) ?? "").trim();
    return v.length ? v : null;
  };
  const decimal = (k: string): string | null => {
    const raw = String(formData.get(k) ?? "").trim().replace(",", ".");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? String(n) : null;
  };
  const date = (k: string): Date | null => {
    const raw = String(formData.get(k) ?? "").trim();
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const clienteId = String(formData.get("clienteId") ?? "").trim();

  const statoRaw = String(formData.get("stato") ?? "").trim();
  const stato = STATI_VALIDI.includes(statoRaw) ? statoRaw : "LEAD";

  const tipoRaw = String(formData.get("tipologia") ?? "").trim();
  const tipologia = TIPOLOGIE_VALIDE.includes(tipoRaw) ? tipoRaw : null;

  const metodoRaw = String(formData.get("metodoRicezioneOrdine") ?? "").trim();
  const metodoRicezioneOrdine = METODI_VALIDI.includes(metodoRaw)
    ? metodoRaw
    : null;

  return {
    clienteId,
    referenteId: str("referenteId"),
    pmId: str("pmId"),
    stato,
    campi: {
      referenteCommerciale: str("referenteCommerciale"),
      tipologia,
      descrizione: str("descrizione"),
      dataRichiesta: date("dataRichiesta"),
      dataInvio: date("dataInvio"),
      importoOfferta: decimal("importoOfferta"),
      importoOrdine: decimal("importoOrdine"),
      dataOrdine: date("dataOrdine"),
      metodoRicezioneOrdine,
      motivazionePersa: stato === "PERSA" ? str("motivazionePersa") : null,
    },
  };
}

/**
 * Valida cliente/referente/pm coerenti fra loro.
 * Ritorna gli id ripuliti (referente scartato se non appartiene al cliente,
 * pm scartato se inesistente) oppure un messaggio d'errore.
 */
async function risolviRelazioni(
  tx: Prisma.TransactionClient,
  clienteId: string,
  referenteId: string | null,
  pmId: string | null,
): Promise<
  { ok: true; referenteId: string | null; pmId: string | null } | {
    ok: false;
    error: string;
  }
> {
  const cliente = await tx.anagrafica.findUnique({
    where: { id: clienteId },
    select: { id: true, isCliente: true },
  });
  if (!cliente) return { ok: false, error: "Cliente non valido." };

  let refId = referenteId;
  if (refId) {
    const ref = await tx.referente.findUnique({
      where: { id: refId },
      select: { anagraficaId: true },
    });
    if (!ref || ref.anagraficaId !== clienteId) refId = null;
  }

  let pm = pmId;
  if (pm) {
    const u = await tx.user.findUnique({
      where: { id: pm },
      select: { id: true },
    });
    if (!u) pm = null;
  }

  return { ok: true, referenteId: refId, pmId: pm };
}

export async function createCommessa(
  _prev: CommessaState,
  formData: FormData,
): Promise<CommessaState> {
  const user = await requireUser();
  if (!puoGestireCommesse(user.ruolo)) {
    return { error: "Non hai i permessi per gestire le commesse." };
  }

  const { clienteId, referenteId, pmId, stato, campi } = estrai(formData);
  if (!clienteId) return { error: "Il cliente è obbligatorio." };

  let id: string;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const rel = await risolviRelazioni(tx, clienteId, referenteId, pmId);
      if (!rel.ok) throw new Error(rel.error);

      const dataRichiesta = campi.dataRichiesta ?? new Date();
      const anno = dataRichiesta.getFullYear();
      const { progressivo, numero } = await nextNumero(tx, anno);

      return tx.commessa.create({
        data: {
          numero,
          anno,
          progressivo,
          clienteId,
          referenteId: rel.referenteId,
          pmId: rel.pmId,
          stato,
          ...campi,
          dataRichiesta,
        },
      });
    });
    id = created.id;
  } catch (e) {
    const msg =
      e instanceof Error && e.message && !e.message.startsWith("Prisma")
        ? e.message
        : "Errore nel salvataggio. Riprova.";
    return { error: msg };
  }

  revalidatePath("/commesse");
  revalidatePath("/");
  redirect(`/commesse/${id}`);
}

export async function updateCommessa(
  commessaId: string,
  _prev: CommessaState,
  formData: FormData,
): Promise<CommessaState> {
  const user = await requireUser();
  if (!puoGestireCommesse(user.ruolo)) {
    return { error: "Non hai i permessi per gestire le commesse." };
  }

  const { clienteId, referenteId, pmId, stato, campi } = estrai(formData);
  if (!clienteId) return { error: "Il cliente è obbligatorio." };

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.commessa.findUnique({
        where: { id: commessaId },
        select: { id: true },
      });
      if (!existing) throw new Error("Commessa non trovata.");

      const rel = await risolviRelazioni(tx, clienteId, referenteId, pmId);
      if (!rel.ok) throw new Error(rel.error);

      // Numero/anno/progressivo non si riassegnano in modifica.
      await tx.commessa.update({
        where: { id: commessaId },
        data: {
          clienteId,
          referenteId: rel.referenteId,
          pmId: rel.pmId,
          stato,
          ...campi,
          // dataRichiesta resta modificabile ma senza sovrascrivere con null.
          dataRichiesta: campi.dataRichiesta ?? undefined,
        },
      });
    });
  } catch (e) {
    const msg =
      e instanceof Error && e.message && !e.message.startsWith("Prisma")
        ? e.message
        : "Errore nel salvataggio. Riprova.";
    return { error: msg };
  }

  revalidatePath("/commesse");
  revalidatePath(`/commesse/${commessaId}`);
  revalidatePath("/");
  redirect(`/commesse/${commessaId}`);
}
