"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireOrdini, STATI_ORDINE } from "@/lib/enums";
import { applicaRegolaPC } from "@/lib/regole";
import type { Prisma } from "@/generated/prisma";

export type OrdineState = { error?: string } | undefined;

const STATI_VALIDI = Object.keys(STATI_ORDINE);

/* ------------------------------- Righe ordine ----------------------------- */

type RigaInput = {
  id?: string;
  codiceProdotto?: string;
  descrizione?: string;
  unitaMisura?: string;
  quantita?: string | number;
  prezzoUnitario?: string | number;
  sconto?: string | number;
  aliquotaIva?: string | number;
  dataConsegnaPrevista?: string;
  quantitaRicevuta?: string | number;
  ddtNumero?: string;
  ddtData?: string;
  fatturaNumero?: string;
  fatturaData?: string;
};

type RigaPulita = {
  id?: string;
  codiceProdotto: string | null;
  descrizione: string;
  unitaMisura: string | null;
  quantita: number;
  prezzoUnitario: number;
  sconto: number | null;
  imponibile: number;
  aliquotaIva: number | null;
  dataConsegnaPrevista: Date | null;
  quantitaRicevuta: number | null;
  ddtNumero: string | null;
  ddtData: Date | null;
  fatturaNumero: string | null;
  fatturaData: Date | null;
};

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseDate(v: unknown): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Imponibile riga = quantità × prezzo × (1 − sconto%). Ricalcolato lato server. */
function imponibileRiga(
  quantita: number,
  prezzoUnitario: number,
  sconto: number | null,
): number {
  const lordo = quantita * prezzoUnitario;
  const netto = lordo * (1 - (sconto ?? 0) / 100);
  return round2(Number.isFinite(netto) ? netto : 0);
}

/** Estrae, normalizza e ricalcola le righe dal FormData (JSON serializzato). */
function estraiRighe(formData: FormData): RigaPulita[] {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("righe") ?? "[]"));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  return (raw as RigaInput[])
    .map((r) => {
      const quantita = parseNum(r.quantita) ?? 0;
      const prezzoUnitario = parseNum(r.prezzoUnitario) ?? 0;
      const sconto = parseNum(r.sconto);
      const str = (v: unknown): string | null => {
        const s = String(v ?? "").trim();
        return s.length ? s : null;
      };
      return {
        id: r.id || undefined,
        codiceProdotto: str(r.codiceProdotto),
        descrizione: String(r.descrizione ?? "").trim(),
        unitaMisura: str(r.unitaMisura),
        quantita,
        prezzoUnitario,
        sconto,
        imponibile: imponibileRiga(quantita, prezzoUnitario, sconto),
        aliquotaIva: parseNum(r.aliquotaIva),
        dataConsegnaPrevista: parseDate(r.dataConsegnaPrevista),
        quantitaRicevuta: parseNum(r.quantitaRicevuta),
        ddtNumero: str(r.ddtNumero),
        ddtData: parseDate(r.ddtData),
        fatturaNumero: str(r.fatturaNumero),
        fatturaData: parseDate(r.fatturaData),
      };
    })
    .filter((r) => r.descrizione.length > 0);
}

/* -------------------------------- Testata --------------------------------- */

function estraiTestata(formData: FormData) {
  const str = (k: string): string | null => {
    const v = String(formData.get(k) ?? "").trim();
    return v.length ? v : null;
  };

  const statoRaw = String(formData.get("stato") ?? "").trim();
  const stato = STATI_VALIDI.includes(statoRaw) ? statoRaw : "ORDINATO";

  return {
    fornitoreId: String(formData.get("fornitoreId") ?? "").trim(),
    commessaId: str("commessaId"),
    numero: str("numero"),
    data: parseDate(formData.get("data")),
    stato,
  };
}

/**
 * Valida fornitore (deve essere una anagrafica fornitore) e commessa (scartata
 * se inesistente). Ritorna gli id ripuliti o un messaggio d'errore.
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

  let commId = commessaId;
  if (commId) {
    const c = await tx.commessa.findUnique({
      where: { id: commId },
      select: { id: true },
    });
    if (!c) commId = null;
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

  const { fornitoreId, commessaId, numero, data, stato } =
    estraiTestata(formData);
  if (!fornitoreId) return { error: "Il fornitore è obbligatorio." };

  const righe = estraiRighe(formData);
  if (righe.length === 0) {
    return { error: "Aggiungi almeno una riga con descrizione." };
  }

  let id: string;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const rel = await risolviRelazioni(tx, fornitoreId, commessaId);
      if (!rel.ok) throw new Error(rel.error);

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
      e instanceof Error && e.message && !e.message.startsWith("Prisma")
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

  const { fornitoreId, commessaId, numero, data, stato } =
    estraiTestata(formData);
  if (!fornitoreId) return { error: "Il fornitore è obbligatorio." };

  const righe = estraiRighe(formData);
  if (righe.length === 0) {
    return { error: "Aggiungi almeno una riga con descrizione." };
  }

  let commessaPrecedente: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.ordineFornitore.findUnique({
        where: { id: ordineId },
        include: { righe: { select: { id: true } } },
      });
      if (!existing) throw new Error("Ordine non trovato.");
      commessaPrecedente = existing.commessaId;

      const rel = await risolviRelazioni(tx, fornitoreId, commessaId);
      if (!rel.ok) throw new Error(rel.error);

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
      const existingIds = new Set(existing.righe.map((r) => r.id));
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
      e instanceof Error && e.message && !e.message.startsWith("Prisma")
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
