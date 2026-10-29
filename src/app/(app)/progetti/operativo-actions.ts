"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { activeActor, assertCommessaAccess } from "@/lib/access";
import { puoGestireProgetti } from "@/lib/enums";
import { InputError } from "@/lib/form-validation";
import { publicError } from "@/lib/crm/commands";
import { serializable } from "@/lib/transaction";
import { salvaFile, eliminaFile, sanitizeFilename } from "@/lib/storage";
import { saveSal, setSospensione, createProblema, updateProblema } from "@/lib/cantiere";
import { SalInput, SospensioneInput, ProblemaInput, ProblemaUpdate } from "@/lib/cantiere-schema";

export type OperativoResult = { error?: string; href?: string };

async function submit(commessaId: string, tipo: "sal" | "sospensione" | "problema" | "modificaProblema", form: FormData, problemaId?: string): Promise<OperativoResult> {
  const user = await requireUser();
  const saved: string[] = [];
  let committed = false;
  try {
    if (!puoGestireProgetti(user.ruolo)) throw new InputError("Non hai i permessi per aggiornare il cantiere.");
    const commessa = await assertCommessaAccess(prisma, user, commessaId);
    const payload = JSON.parse(String(form.get("dati") ?? "{}"));
    const schema = tipo === "sal" ? SalInput : tipo === "sospensione" ? SospensioneInput : tipo === "problema" ? ProblemaInput : ProblemaUpdate;
    schema.parse(payload);
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (tipo === "sospensione" && files.length) throw new InputError("Allega i file a un aggiornamento SAL o a un problema.");
    if (files.length > 5 || files.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024) throw new InputError("Carica fino a 5 allegati, per un totale massimo di 20 MB.");
    const prepared: { id: string; nomeFile: string; categoria: string; tipoMime: string; percorso: string; dimensione: number }[] = [];
    for (const [index, file] of files.entries()) {
      if (!/\.(pdf|jpe?g|png|webp|heic)$/i.test(file.name)) throw new InputError("Sono ammessi PDF e foto JPG, PNG, WebP o HEIC.");
      const bytes = Buffer.from(await file.arrayBuffer());
      const digest = createHash("sha256").update(file.name).update(bytes).digest("hex").slice(0, 32);
      const id = `${payload.richiestaId}-${index}-${digest}`;
      const existing = await prisma.documento.findUnique({ where: { id } });
      if (existing) {
        if (existing.commessaId !== commessaId) throw new InputError("Allegato non disponibile.");
        prepared.push({ id, nomeFile: existing.nomeFile, categoria: existing.categoria, percorso: existing.percorso, tipoMime: existing.tipoMime ?? "application/octet-stream", dimensione: existing.dimensione ?? 0 });
        continue;
      }
      const nomeFile = sanitizeFilename(file.name);
      const percorso = await salvaFile(commessa.numero, `${randomUUID()}__${nomeFile}`, bytes);
      saved.push(percorso);
      prepared.push({ id, nomeFile, percorso, dimensione: file.size, tipoMime: file.type || "application/octet-stream", categoria: /\.pdf$/i.test(file.name) ? "ALTRO" : "FOTO" });
    }
    const result = await serializable(async (tx) => {
      const actor = await activeActor(tx, user.id);
      await assertCommessaAccess(tx, actor, commessaId);
      if (!puoGestireProgetti(actor.ruolo)) throw new InputError("Permessi aggiornati. Ricarica la pagina.");
      if (tipo === "modificaProblema" && !await tx.problemaCantiere.findFirst({ where: { id: problemaId, commessaId }, select: { id: true } })) throw new InputError("Problema non disponibile in questo cantiere.");
      for (const file of prepared) await tx.documento.upsert({ where: { id: file.id }, update: {}, create: { ...file, commessaId } });
      const input = tipo === "sospensione" ? payload : { ...payload, documenti: [...(payload.documenti ?? []), ...prepared.map((f) => f.id)] };
      if (tipo === "sal") { await saveSal(tx, actor.id, commessaId, input, prepared.map((f) => f.id)); return `/progetti/${commessaId}?tab=avanzamento&esito=sal`; }
      if (tipo === "sospensione") { await setSospensione(tx, actor.id, commessaId, input); return `/progetti/${commessaId}?esito=stato`; }
      const problem = tipo === "problema" ? await createProblema(tx, actor.id, commessaId, input, prepared.map((f) => f.id)) : await updateProblema(tx, actor.id, problemaId!, input, prepared.map((f) => f.id));
      return `/problemi/${problem.id}?esito=salvato`;
    });
    committed = true;
    const used = await prisma.documento.findMany({ where: { percorso: { in: saved } }, select: { percorso: true } });
    await Promise.all(saved.filter((path) => !used.some((d) => d.percorso === path)).map(eliminaFile));
    revalidatePath("/", "layout");
    return { href: result };
  } catch (error) {
    if (!committed) await Promise.all(saved.map(eliminaFile));
    return { error: publicError(error) };
  }
}

export async function registraSal(commessaId: string, form: FormData) { return submit(commessaId, "sal", form); }
export async function cambiaSospensione(commessaId: string, form: FormData) { return submit(commessaId, "sospensione", form); }
export async function apriProblema(commessaId: string, form: FormData) { return submit(commessaId, "problema", form); }
export async function modificaProblema(commessaId: string, problemaId: string, form: FormData) { return submit(commessaId, "modificaProblema", form, problemaId); }
