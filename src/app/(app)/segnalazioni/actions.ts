"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/dal";
import {
  puoGestireSegnalazioni,
  STATI_SEGNALAZIONE,
  TIPI_SEGNALAZIONE,
  PRIORITA_SEGNALAZIONE,
} from "@/lib/enums";
import { eliminaFile, salvaFile, sanitizeFilename } from "@/lib/storage";

export type SegnalazioneState = { error?: string; ok?: string } | undefined;

const TIPI = Object.keys(TIPI_SEGNALAZIONE);
const PRIORITA = Object.keys(PRIORITA_SEGNALAZIONE);
const STATI = Object.keys(STATI_SEGNALAZIONE);

/** 8 MB per immagine: uno screenshot sta largamente sotto. */
const MAX_BYTE = 8 * 1024 * 1024;
const MAX_ALLEGATI = 6;

/**
 * Solo immagini raster. Gli SVG restano fuori: sono documenti attivi e verrebbero
 * serviti dallo stesso dominio dell'applicazione.
 */
const MIME_AMMESSI = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function str(formData: FormData, k: string): string | null {
  const v = String(formData.get(k) ?? "").trim();
  return v.length ? v : null;
}

function scelta(formData: FormData, k: string, ammessi: string[], def: string): string {
  const v = String(formData.get(k) ?? "").trim();
  return ammessi.includes(v) ? v : def;
}

function messaggio(e: unknown): string {
  return e instanceof Error && e.message && !e.message.startsWith("Prisma")
    ? e.message
    : "Errore nel salvataggio. Riprova.";
}

function aggiorna(id?: string) {
  revalidatePath("/segnalazioni");
  if (id) revalidatePath(`/segnalazioni/${id}`);
}

/**
 * Chi può modificare o eliminare: l'autore finché la segnalazione è aperta, e
 * il Super Admin sempre. Verificato nell'action, non solo nascondendo i comandi.
 */
function puoIntervenire(
  user: CurrentUser,
  segnalazione: { autoreId: string; stato: string },
): boolean {
  if (puoGestireSegnalazioni(user.ruolo)) return true;
  return segnalazione.autoreId === user.id && segnalazione.stato !== "CONCLUSA";
}

/** Salva gli allegati immagine di una segnalazione. Ritorna quanti ne ha scritti. */
async function salvaAllegati(
  segnalazioneId: string,
  files: File[],
): Promise<number> {
  let salvati = 0;

  for (const f of files.slice(0, MAX_ALLEGATI)) {
    if (f.size === 0) continue;
    if (f.size > MAX_BYTE) {
      throw new Error(`"${f.name}" supera gli 8 MB.`);
    }
    if (!MIME_AMMESSI.has(f.type)) {
      throw new Error(
        `"${f.name}" non è un'immagine supportata (PNG, JPEG, WebP, GIF, AVIF).`,
      );
    }

    const nome = sanitizeFilename(f.name || "screenshot.png");
    // Nome su disco univoco: due screenshot possono chiamarsi allo stesso modo.
    const nomeSuDisco = `${randomUUID().slice(0, 8)}-${nome}`;
    const percorso = await salvaFile(
      `segnalazioni/${segnalazioneId}`,
      nomeSuDisco,
      Buffer.from(await f.arrayBuffer()),
    );

    await prisma.allegatoSegnalazione.create({
      data: {
        segnalazioneId,
        nomeFile: nome,
        tipoMime: f.type || null,
        percorso,
        dimensione: f.size,
      },
    });
    salvati++;
  }

  return salvati;
}

export async function createSegnalazione(
  _prev: SegnalazioneState,
  formData: FormData,
): Promise<SegnalazioneState> {
  const user = await requireUser();

  const titolo = str(formData, "titolo");
  const descrizione = str(formData, "descrizione");
  if (!titolo) return { error: "Il titolo è obbligatorio." };
  if (!descrizione) return { error: "Descrivi cosa hai riscontrato." };

  const files = formData
    .getAll("immagini")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_ALLEGATI) {
    return { error: `Massimo ${MAX_ALLEGATI} immagini per segnalazione.` };
  }

  let id: string;
  try {
    const creata = await prisma.segnalazione.create({
      data: {
        titolo,
        descrizione,
        tipo: scelta(formData, "tipo", TIPI, "PROBLEMA"),
        priorita: scelta(formData, "priorita", PRIORITA, "MEDIA"),
        pagina: str(formData, "pagina"),
        autoreId: user.id,
      },
      select: { id: true },
    });
    id = creata.id;

    await salvaAllegati(id, files);
  } catch (e) {
    return { error: messaggio(e) };
  }

  aggiorna(id);
  redirect(`/segnalazioni/${id}`);
}

export async function aggiungiAllegati(
  segnalazioneId: string,
  _prev: SegnalazioneState,
  formData: FormData,
): Promise<SegnalazioneState> {
  const user = await requireUser();

  const seg = await prisma.segnalazione.findUnique({
    where: { id: segnalazioneId },
    select: { autoreId: true, stato: true, _count: { select: { allegati: true } } },
  });
  if (!seg) return { error: "Segnalazione non trovata." };
  if (!puoIntervenire(user, seg)) {
    return { error: "Non puoi modificare questa segnalazione." };
  }

  const files = formData
    .getAll("immagini")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Nessuna immagine selezionata." };
  if (seg._count.allegati + files.length > MAX_ALLEGATI) {
    return { error: `Massimo ${MAX_ALLEGATI} immagini per segnalazione.` };
  }

  try {
    const n = await salvaAllegati(segnalazioneId, files);
    aggiorna(segnalazioneId);
    return { ok: `${n} immagin${n === 1 ? "e" : "i"} aggiunt${n === 1 ? "a" : "e"}.` };
  } catch (e) {
    return { error: messaggio(e) };
  }
}

export async function eliminaAllegato(
  allegatoId: string,
  _formData: FormData,
): Promise<void> {
  const user = await requireUser();

  const allegato = await prisma.allegatoSegnalazione.findUnique({
    where: { id: allegatoId },
    include: { segnalazione: { select: { id: true, autoreId: true, stato: true } } },
  });
  if (!allegato) return;
  if (!puoIntervenire(user, allegato.segnalazione)) return;

  await prisma.allegatoSegnalazione.delete({ where: { id: allegatoId } });
  await eliminaFile(allegato.percorso);
  aggiorna(allegato.segnalazione.id);
}

/**
 * Cambia stato. Passando a CONCLUSA si registra la data e, se fornita, la nota
 * di risoluzione; tornando indietro si azzerano, così lo storico resta coerente.
 */
export async function cambiaStato(
  segnalazioneId: string,
  _prev: SegnalazioneState,
  formData: FormData,
): Promise<SegnalazioneState> {
  const user = await requireUser();
  if (!puoGestireSegnalazioni(user.ruolo)) {
    return { error: "Solo il Super Admin può cambiare lo stato." };
  }

  const stato = scelta(formData, "stato", STATI, "APERTA");
  const risoluzione = str(formData, "risoluzione");

  try {
    await prisma.segnalazione.update({
      where: { id: segnalazioneId },
      data: {
        stato,
        risoluzione: stato === "CONCLUSA" ? risoluzione : null,
        conclusaIl: stato === "CONCLUSA" ? new Date() : null,
      },
    });
  } catch (e) {
    return { error: messaggio(e) };
  }

  aggiorna(segnalazioneId);
  return {
    ok: stato === "CONCLUSA" ? "Segnalazione conclusa." : "Stato aggiornato.",
  };
}

export async function updateSegnalazione(
  segnalazioneId: string,
  _prev: SegnalazioneState,
  formData: FormData,
): Promise<SegnalazioneState> {
  const user = await requireUser();

  const seg = await prisma.segnalazione.findUnique({
    where: { id: segnalazioneId },
    select: { autoreId: true, stato: true },
  });
  if (!seg) return { error: "Segnalazione non trovata." };
  if (!puoIntervenire(user, seg)) {
    return { error: "Non puoi modificare questa segnalazione." };
  }

  const titolo = str(formData, "titolo");
  const descrizione = str(formData, "descrizione");
  if (!titolo) return { error: "Il titolo è obbligatorio." };
  if (!descrizione) return { error: "La descrizione è obbligatoria." };

  try {
    await prisma.segnalazione.update({
      where: { id: segnalazioneId },
      data: {
        titolo,
        descrizione,
        tipo: scelta(formData, "tipo", TIPI, "PROBLEMA"),
        priorita: scelta(formData, "priorita", PRIORITA, "MEDIA"),
      },
    });
  } catch (e) {
    return { error: messaggio(e) };
  }

  aggiorna(segnalazioneId);
  return { ok: "Segnalazione aggiornata." };
}

/** Elimina la segnalazione e i file su disco. */
export async function eliminaSegnalazione(
  segnalazioneId: string,
  _formData: FormData,
): Promise<void> {
  const user = await requireUser();

  const seg = await prisma.segnalazione.findUnique({
    where: { id: segnalazioneId },
    select: { autoreId: true, stato: true, allegati: { select: { percorso: true } } },
  });
  if (!seg) return;
  if (!puoIntervenire(user, seg)) return;

  // Le righe allegato cadono in cascata; i file su disco vanno rimossi a mano.
  await prisma.segnalazione.delete({ where: { id: segnalazioneId } });
  for (const a of seg.allegati) await eliminaFile(a.percorso);

  revalidatePath("/segnalazioni");
  redirect("/segnalazioni");
}
