"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireDocumenti, CATEGORIE_DOCUMENTO } from "@/lib/enums";
import { salvaFile, eliminaFile, sanitizeFilename } from "@/lib/storage";

export type UploadState = { error?: string; ok?: number } | undefined;

/** Limite per singolo file (il body totale del server action è a 25MB). */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const ESTENSIONI_AMMESSE = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
  "dwg",
  "dxf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "txt",
  "csv",
  "zip",
]);

const CATEGORIE_VALIDE = Object.keys(CATEGORIE_DOCUMENTO);

function estensione(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : "";
}

export async function uploadDocumenti(
  commessaId: string,
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await requireUser();
  if (!puoGestireDocumenti(user.ruolo)) {
    return { error: "Non hai i permessi per caricare documenti." };
  }

  const commessa = await prisma.commessa.findUnique({
    where: { id: commessaId },
    select: { numero: true },
  });
  if (!commessa) return { error: "Commessa non trovata." };

  const catRaw = String(formData.get("categoria") ?? "").trim();
  const categoria = CATEGORIE_VALIDE.includes(catRaw) ? catRaw : "ALTRO";

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Seleziona almeno un file." };

  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return { error: `«${f.name}» supera il limite di 20 MB.` };
    }
    if (!ESTENSIONI_AMMESSE.has(estensione(f.name))) {
      return { error: `Tipo di file non ammesso: «${f.name}».` };
    }
  }

  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const nomeFile = sanitizeFilename(f.name);
    const nomeSuDisco = `${randomUUID()}__${nomeFile}`;
    let percorso: string | null = null;
    try {
      // La cartella "<numeroCommessa>/" viene creata al bisogno (auto-cartella).
      percorso = await salvaFile(commessa.numero, nomeSuDisco, buf);
      await prisma.documento.create({
        data: {
          commessaId,
          nomeFile,
          categoria,
          tipoMime: f.type || null,
          percorso,
          dimensione: f.size,
        },
      });
    } catch {
      if (percorso) await eliminaFile(percorso);
      revalidatePath(`/commesse/${commessaId}`);
      return { error: "Errore durante il salvataggio dei documenti." };
    }
  }

  revalidatePath(`/commesse/${commessaId}`);
  return { ok: files.length };
}

export async function deleteDocumento(
  documentoId: string,
  _formData: FormData,
): Promise<void> {
  const user = await requireUser();
  if (!puoGestireDocumenti(user.ruolo)) return;

  const doc = await prisma.documento.findUnique({
    where: { id: documentoId },
    select: { percorso: true, commessaId: true },
  });
  if (!doc) return;

  await prisma.documento.delete({ where: { id: documentoId } });
  await eliminaFile(doc.percorso);
  revalidatePath(`/commesse/${doc.commessaId}`);
}
