"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireCatalogo } from "@/lib/enums";
import { salvaFile, eliminaFile, sanitizeFilename } from "@/lib/storage";
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
  if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error("Il file non contiene un PDF valido.");
  const percorso = await salvaFile(
    `materiali/${prodottoId}`,
    `${randomUUID()}__${nomeFile}`,
    buf,
  );
  return {
    schedaNomeFile: nomeFile,
    schedaMime: "application/pdf",
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
  if (str(formData, "prezzoListino") && dati.prezzoListino === null) return { error: "Inserisci un prezzo di listino valido e non negativo." };

  const file = fileScheda(formData);
  if (file && "error" in file) return { error: file.error };

  const id = randomUUID();
  let scheda: Awaited<ReturnType<typeof salvaDatasheet>> | undefined;
  try {
    if (file) scheda = await salvaDatasheet(id, file);
    await prisma.prodotto.create({ data: { ...dati, id, ...scheda } });
  } catch (e) {
    if (scheda) await eliminaFile(scheda.schedaPercorso);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Esiste già un materiale con questo codice." };
    }
    return { error: "Errore nel salvataggio." };
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
  if (str(formData, "prezzoListino") && dati.prezzoListino === null) return { error: "Inserisci un prezzo di listino valido e non negativo." };

  const file = fileScheda(formData);
  if (file && "error" in file) return { error: file.error };

  let scheda: Awaited<ReturnType<typeof salvaDatasheet>> | undefined;
  try {
    if (file) scheda = await salvaDatasheet(prodottoId, file);
    await prisma.prodotto.update({ where: { id: prodottoId, updatedAt: esistente.updatedAt }, data: { ...dati, ...scheda } });
  } catch (e) {
    if (scheda) await eliminaFile(scheda.schedaPercorso);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Esiste già un materiale con questo codice." };
    }
    return { error: "Errore nel salvataggio." };
  }

  if (scheda && esistente.schedaPercorso) await eliminaFile(esistente.schedaPercorso);

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
