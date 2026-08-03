"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import {
  puoGestireProgetti,
  STATI_MILESTONE,
  RUOLI_CANTIERE,
} from "@/lib/enums";
import { isProgetto } from "@/lib/progetti";

export type ProgettoState = { error?: string; ok?: string } | undefined;

const STATI_MILESTONE_VALIDI = Object.keys(STATI_MILESTONE);
const RUOLI_CANTIERE_VALIDI = Object.keys(RUOLI_CANTIERE);

/* --------------------------------- utility -------------------------------- */

function str(formData: FormData, k: string): string | null {
  const v = String(formData.get(k) ?? "").trim();
  return v.length ? v : null;
}

function date(formData: FormData, k: string): Date | null {
  const raw = String(formData.get(k) ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Auth + permesso di gestione progetti. Ogni action passa da qui. */
async function guardia(): Promise<{ error: string } | null> {
  const user = await requireUser();
  return puoGestireProgetti(user.ruolo)
    ? null
    : { error: "Non hai i permessi per gestire i progetti." };
}

function messaggio(e: unknown): string {
  return e instanceof Error && e.message && !e.message.startsWith("Prisma")
    ? e.message
    : "Errore nel salvataggio. Riprova.";
}

function aggiorna(commessaId: string) {
  revalidatePath("/progetti");
  revalidatePath(`/progetti/${commessaId}`);
  revalidatePath(`/commesse/${commessaId}`);
}

/** Risale alla commessa di una milestone: serve per revalidare e per i permessi. */
async function commessaDiMilestone(milestoneId: string): Promise<string> {
  const m = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { commessaId: true },
  });
  if (!m) throw new Error("Milestone non trovata.");
  return m.commessaId;
}

/* ----------------------------- pianificazione ----------------------------- */

/** Date di cantiere e note del progetto (non tocca i campi commerciali). */
export async function updatePianificazione(
  commessaId: string,
  _prev: ProgettoState,
  formData: FormData,
): Promise<ProgettoState> {
  const negato = await guardia();
  if (negato) return negato;

  try {
    const commessa = await prisma.commessa.findUnique({
      where: { id: commessaId },
      select: { stato: true },
    });
    if (!commessa) throw new Error("Commessa non trovata.");
    if (!isProgetto(commessa.stato)) {
      throw new Error(
        "La commessa non è ancora un progetto: serve almeno l'ordine confermato.",
      );
    }

    const dataInizioLavori = date(formData, "dataInizioLavori");
    const scadenzaLavori = date(formData, "scadenzaLavori");
    const dataFineLavori = date(formData, "dataFineLavori");

    if (
      dataInizioLavori &&
      scadenzaLavori &&
      scadenzaLavori.getTime() < dataInizioLavori.getTime()
    ) {
      throw new Error("La scadenza non può precedere l'inizio dei lavori.");
    }
    if (
      dataInizioLavori &&
      dataFineLavori &&
      dataFineLavori.getTime() < dataInizioLavori.getTime()
    ) {
      throw new Error("La fine lavori non può precedere l'inizio.");
    }

    await prisma.commessa.update({
      where: { id: commessaId },
      data: {
        dataInizioLavori,
        scadenzaLavori,
        dataFineLavori,
        noteCantiere: str(formData, "noteCantiere"),
      },
    });
  } catch (e) {
    return { error: messaggio(e) };
  }

  aggiorna(commessaId);
  return { ok: "Pianificazione aggiornata." };
}

/* -------------------------------- milestone ------------------------------- */

export async function createMilestone(
  commessaId: string,
  _prev: ProgettoState,
  formData: FormData,
): Promise<ProgettoState> {
  const negato = await guardia();
  if (negato) return negato;

  const titolo = str(formData, "titolo");
  if (!titolo) return { error: "Il titolo della milestone è obbligatorio." };

  try {
    await prisma.$transaction(async (tx) => {
      const commessa = await tx.commessa.findUnique({
        where: { id: commessaId },
        select: { id: true },
      });
      if (!commessa) throw new Error("Commessa non trovata.");

      // In coda alla sequenza esistente.
      const ultima = await tx.milestone.findFirst({
        where: { commessaId },
        orderBy: { ordine: "desc" },
        select: { ordine: true },
      });

      await tx.milestone.create({
        data: {
          commessaId,
          titolo,
          ordine: (ultima?.ordine ?? -1) + 1,
          dataPianificata: date(formData, "dataPianificata"),
          note: str(formData, "note"),
        },
      });
    });
  } catch (e) {
    return { error: messaggio(e) };
  }

  aggiorna(commessaId);
  return { ok: "Milestone aggiunta." };
}

/**
 * Cambia lo stato di una milestone. La data effettiva segue lo stato: si
 * valorizza entrando in COMPLETATA (se non già impostata) e si azzera uscendo,
 * così "pianificato vs effettivo" resta coerente senza input manuale.
 */
export async function setStatoMilestone(
  milestoneId: string,
  formData: FormData,
): Promise<void> {
  const negato = await guardia();
  if (negato) return;

  const statoRaw = String(formData.get("stato") ?? "").trim();
  if (!STATI_MILESTONE_VALIDI.includes(statoRaw)) return;

  const commessaId = await commessaDiMilestone(milestoneId);
  const corrente = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { dataEffettiva: true },
  });

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      stato: statoRaw,
      dataEffettiva:
        statoRaw === "COMPLETATA"
          ? (corrente?.dataEffettiva ?? new Date())
          : null,
    },
  });

  aggiorna(commessaId);
}

export async function updateMilestone(
  milestoneId: string,
  _prev: ProgettoState,
  formData: FormData,
): Promise<ProgettoState> {
  const negato = await guardia();
  if (negato) return negato;

  const titolo = str(formData, "titolo");
  if (!titolo) return { error: "Il titolo della milestone è obbligatorio." };

  let commessaId: string;
  try {
    commessaId = await commessaDiMilestone(milestoneId);
    const statoRaw = String(formData.get("stato") ?? "").trim();
    const stato = STATI_MILESTONE_VALIDI.includes(statoRaw)
      ? statoRaw
      : "DA_FARE";

    const corrente = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: { dataEffettiva: true },
    });

    await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        titolo,
        stato,
        dataPianificata: date(formData, "dataPianificata"),
        note: str(formData, "note"),
        dataEffettiva:
          stato === "COMPLETATA"
            ? (date(formData, "dataEffettiva") ??
              corrente?.dataEffettiva ??
              new Date())
            : null,
      },
    });
  } catch (e) {
    return { error: messaggio(e) };
  }

  aggiorna(commessaId);
  return { ok: "Milestone aggiornata." };
}

export async function deleteMilestone(
  milestoneId: string,
  _formData: FormData,
): Promise<void> {
  const negato = await guardia();
  if (negato) return;

  const commessaId = await commessaDiMilestone(milestoneId);
  await prisma.milestone.delete({ where: { id: milestoneId } });
  aggiorna(commessaId);
}

/**
 * Sposta una milestone su/giù scambiando l'ordine con la vicina. Lo scambio
 * evita di rinumerare l'intera sequenza a ogni spostamento.
 */
export async function spostaMilestone(
  milestoneId: string,
  direzione: "su" | "giu",
  _formData: FormData,
): Promise<void> {
  const negato = await guardia();
  if (negato) return;

  const commessaId = await commessaDiMilestone(milestoneId);

  await prisma.$transaction(async (tx) => {
    const corrente = await tx.milestone.findUnique({
      where: { id: milestoneId },
      select: { id: true, ordine: true, commessaId: true },
    });
    if (!corrente) return;

    const vicina = await tx.milestone.findFirst({
      where: {
        commessaId: corrente.commessaId,
        ordine:
          direzione === "su"
            ? { lt: corrente.ordine }
            : { gt: corrente.ordine },
      },
      orderBy: { ordine: direzione === "su" ? "desc" : "asc" },
      select: { id: true, ordine: true },
    });
    if (!vicina) return; // già in cima / in fondo

    await tx.milestone.update({
      where: { id: corrente.id },
      data: { ordine: vicina.ordine },
    });
    await tx.milestone.update({
      where: { id: vicina.id },
      data: { ordine: corrente.ordine },
    });
  });

  aggiorna(commessaId);
}

/* ------------------------------ assegnazioni ------------------------------ */

export async function assegnaOperaio(
  commessaId: string,
  _prev: ProgettoState,
  formData: FormData,
): Promise<ProgettoState> {
  const negato = await guardia();
  if (negato) return negato;

  const operaioId = str(formData, "operaioId");
  if (!operaioId) return { error: "Scegli un operaio." };

  try {
    const operaio = await prisma.operaio.findUnique({
      where: { id: operaioId },
      select: { attivo: true },
    });
    if (!operaio) throw new Error("Operaio non valido.");
    if (!operaio.attivo) throw new Error("L'operaio non è più attivo.");

    const ruoloRaw = String(formData.get("ruoloCantiere") ?? "").trim();

    const dal = date(formData, "dal");
    const al = date(formData, "al");
    if (dal && al && al.getTime() < dal.getTime()) {
      throw new Error("La data finale non può precedere quella iniziale.");
    }

    await prisma.assegnazioneOperaio.create({
      data: {
        commessaId,
        operaioId,
        ruoloCantiere: RUOLI_CANTIERE_VALIDI.includes(ruoloRaw)
          ? ruoloRaw
          : null,
        dal,
        al,
        note: str(formData, "note"),
      },
    });
  } catch (e) {
    // @@unique([commessaId, operaioId]): assegnazione doppia.
    const msg =
      e instanceof Error && e.message.includes("Unique constraint")
        ? "Questo operaio è già assegnato al progetto."
        : messaggio(e);
    return { error: msg };
  }

  aggiorna(commessaId);
  return { ok: "Operaio assegnato." };
}

export async function rimuoviAssegnazione(
  assegnazioneId: string,
  _formData: FormData,
): Promise<void> {
  const negato = await guardia();
  if (negato) return;

  const a = await prisma.assegnazioneOperaio.findUnique({
    where: { id: assegnazioneId },
    select: { commessaId: true },
  });
  if (!a) return;

  await prisma.assegnazioneOperaio.delete({ where: { id: assegnazioneId } });
  aggiorna(a.commessaId);
}
