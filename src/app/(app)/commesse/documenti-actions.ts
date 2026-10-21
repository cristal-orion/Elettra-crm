"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireDocumenti, CATEGORIE_DOCUMENTO } from "@/lib/enums";
import { salvaFile, eliminaFile, sanitizeFilename } from "@/lib/storage";
import { serializable } from "@/lib/transaction";
import { eventoCommerciale } from "@/lib/commerciale";

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
  return upload("commessa", commessaId, formData);
}

export async function uploadDocumentiCommerciali(opportunitaId: string, _prev: UploadState, formData: FormData): Promise<UploadState> {
  return upload("opportunita", opportunitaId, formData);
}

async function upload(tipo: "commessa" | "opportunita", id: string, formData: FormData): Promise<UploadState> {
  const user = await requireUser();
  if (!puoGestireDocumenti(user.ruolo)) {
    return { error: "Non hai i permessi per caricare documenti." };
  }

  const commessa = tipo === "commessa" ? await prisma.commessa.findUnique({ where: { id }, select: { numero: true, opportunitaId: true } }) : null;
  const opportunitaId = tipo === "opportunita" ? id : commessa?.opportunitaId;
  if (tipo === "commessa" && !commessa) return { error: "Commessa non trovata." };
  if (opportunitaId && !await prisma.opportunita.findUnique({ where: { id: opportunitaId }, select: { id: true } })) return { error: "Trattativa non trovata." };
  const refresh = () => {
    revalidatePath("/commesse", "layout"); revalidatePath("/progetti", "layout");
    if (opportunitaId) revalidatePath(`/commerciale/${opportunitaId}`);
  };

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
      percorso = await salvaFile(commessa?.numero ?? `commerciale-${id}`, nomeSuDisco, buf);
      const savedPath = percorso;
      await serializable(async (tx) => {
        const actor = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
        if (!actor.attivo || !puoGestireDocumenti(actor.ruolo)) throw new Error("Non autorizzato");
        const opp = opportunitaId ? await tx.opportunita.update({ where: { id: opportunitaId }, data: { versione: { increment: 1 } }, include: { commessa: { select: { id: true } } } }) : null;
        const doc = await tx.documento.create({
        data: {
          commessaId: tipo === "commessa" ? id : opp?.commessa?.id,
          opportunitaId,
          nomeFile,
          categoria,
          tipoMime: f.type || null,
          percorso: savedPath,
          dimensione: f.size,
        },
        });
        if (opportunitaId) await eventoCommerciale(tx, actor, opportunitaId, "DOCUMENTO", `Allegato: ${nomeFile}`, null, doc);
      });
    } catch {
      if (percorso) await eliminaFile(percorso);
      refresh();
      return { error: "Errore durante il salvataggio dei documenti." };
    }
  }

  refresh();
  return { ok: files.length };
}

export async function deleteDocumento(
  documentoId: string,
  _formData: FormData,
): Promise<void> {
  const user = await requireUser();
  if (!puoGestireDocumenti(user.ruolo)) return;

  const doc = await serializable(async (tx) => {
    const actor = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!actor.attivo || !puoGestireDocumenti(actor.ruolo)) return null;
    const row = await tx.documento.findUnique({ where: { id: documentoId } });
    if (!row) return null;
    if (row.opportunitaId) {
      await tx.opportunita.update({ where: { id: row.opportunitaId }, data: { versione: { increment: 1 } } });
      await eventoCommerciale(tx, actor, row.opportunitaId, "DOCUMENTO", `Allegato rimosso: ${row.nomeFile}`, row);
    }
    await tx.documento.delete({ where: { id: documentoId } });
    return row;
  });
  if (!doc) return;

  await eliminaFile(doc.percorso);
  if (doc.commessaId) { revalidatePath(`/commesse/${doc.commessaId}`); revalidatePath(`/progetti/${doc.commessaId}`); }
  if (doc.opportunitaId) revalidatePath(`/commerciale/${doc.opportunitaId}`);
}
