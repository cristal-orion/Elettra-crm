"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireCatalogo } from "@/lib/enums";
import {
  salvaFile,
  eliminaFile,
  sanitizeFilename,
  PENDING_DIR,
} from "@/lib/storage";
import { Prisma } from "@/generated/prisma";

export type ProdottoState = { error?: string } | undefined;

const MAX_BYTES = 20 * 1024 * 1024;

function str(formData: FormData, k: string): string | null {
  const v = String(formData.get(k) ?? "").trim();
  return v.length ? v : null;
}

function decimale(v: string | null): Prisma.Decimal | null {
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? new Prisma.Decimal(n) : null;
}

function datiComuni(formData: FormData) {
  return {
    descrizione: String(formData.get("descrizione") ?? "").trim(),
    codice: str(formData, "codice"),
    marca: str(formData, "marca"),
    categoria: str(formData, "categoria"),
    unitaMisura: str(formData, "unitaMisura"),
    prezzoListino: decimale(str(formData, "prezzoListino")),
    datiTecnici: str(formData, "datiTecnici"),
    note: str(formData, "note"),
  };
}

/** Salva il PDF caricato nella cartella del prodotto. Ritorna i campi scheda. */
async function salvaDatasheet(prodottoId: string, file: File) {
  const nomeFile = sanitizeFilename(file.name);
  const buf = Buffer.from(await file.arrayBuffer());
  const percorso = await salvaFile(
    `materiali/${prodottoId}`,
    `${randomUUID()}__${nomeFile}`,
    buf,
  );
  return {
    schedaNomeFile: nomeFile,
    schedaMime: file.type || "application/pdf",
    schedaPercorso: percorso,
    schedaDimensione: file.size,
  };
}

/** Valida il file scheda (PDF, dimensione). Null se non fornito. */
function fileScheda(formData: FormData): File | null | { error: string } {
  const f = formData.get("scheda");
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.type && f.type !== "application/pdf") return { error: "La scheda deve essere un PDF." };
  if (f.size > MAX_BYTES) return { error: "La scheda supera i 20 MB." };
  return f;
}

/** Campi scheda da un file già parcheggiato in _pending (flusso da-scheda). */
function schedaPending(formData: FormData) {
  const percorso = str(formData, "pendingPercorso");
  if (!percorso || !percorso.startsWith(`${PENDING_DIR}/`)) return null;
  return {
    schedaNomeFile: str(formData, "pendingNome"),
    schedaMime: str(formData, "pendingMime") ?? "application/pdf",
    schedaPercorso: percorso,
    schedaDimensione: Number(formData.get("pendingDim") ?? 0) || null,
  };
}

export async function createProdotto(
  _prev: ProdottoState,
  formData: FormData,
): Promise<ProdottoState> {
  const user = await requireUser();
  if (!puoGestireCatalogo(user.ruolo)) {
    return { error: "Non hai i permessi per gestire il catalogo." };
  }

  const dati = datiComuni(formData);
  if (!dati.descrizione) return { error: "La descrizione è obbligatoria." };

  const file = fileScheda(formData);
  if (file && "error" in file) return { error: file.error };

  let id: string;
  try {
    const creato = await prisma.prodotto.create({ data: dati });
    id = creato.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Esiste già un materiale con questo codice." };
    }
    return { error: "Errore nel salvataggio." };
  }

  // Allegato: file caricato a mano ha precedenza; altrimenti il pending estratto.
  try {
    if (file) {
      const scheda = await salvaDatasheet(id, file);
      await prisma.prodotto.update({ where: { id }, data: scheda });
    } else {
      const pending = schedaPending(formData);
      if (pending) await prisma.prodotto.update({ where: { id }, data: pending });
    }
  } catch {
    // il prodotto è creato: l'allegato si può ricaricare dalla modifica
  }

  revalidatePath("/materiali");
  redirect(`/materiali/${id}`);
}

export async function updateProdotto(
  prodottoId: string,
  _prev: ProdottoState,
  formData: FormData,
): Promise<ProdottoState> {
  const user = await requireUser();
  if (!puoGestireCatalogo(user.ruolo)) {
    return { error: "Non hai i permessi per gestire il catalogo." };
  }

  const esistente = await prisma.prodotto.findUnique({ where: { id: prodottoId } });
  if (!esistente) return { error: "Materiale non trovato." };

  const dati = datiComuni(formData);
  if (!dati.descrizione) return { error: "La descrizione è obbligatoria." };

  const file = fileScheda(formData);
  if (file && "error" in file) return { error: file.error };

  try {
    await prisma.prodotto.update({ where: { id: prodottoId }, data: dati });
    if (file) {
      // Sostituzione datasheet: elimina il vecchio dal disco.
      if (esistente.schedaPercorso) await eliminaFile(esistente.schedaPercorso);
      const scheda = await salvaDatasheet(prodottoId, file);
      await prisma.prodotto.update({ where: { id: prodottoId }, data: scheda });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Esiste già un materiale con questo codice." };
    }
    return { error: "Errore nel salvataggio." };
  }

  revalidatePath("/materiali");
  revalidatePath(`/materiali/${prodottoId}`);
  redirect(`/materiali/${prodottoId}`);
}

export async function deleteProdotto(
  prodottoId: string,
  _formData: FormData,
): Promise<void> {
  const user = await requireUser();
  if (!puoGestireCatalogo(user.ruolo)) return;

  const p = await prisma.prodotto.findUnique({
    where: { id: prodottoId },
    select: { schedaPercorso: true },
  });
  if (!p) return;

  // Le righe d'ordine sopravvivono al materiale: si scollega solo il riferimento.
  await prisma.$transaction([
    prisma.rigaOrdineFornitore.updateMany({
      where: { prodottoId },
      data: { prodottoId: null },
    }),
    prisma.prodotto.delete({ where: { id: prodottoId } }),
  ]);
  if (p.schedaPercorso) await eliminaFile(p.schedaPercorso);

  revalidatePath("/materiali");
  redirect("/materiali");
}
