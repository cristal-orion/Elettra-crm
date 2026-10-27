"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { serializable } from "@/lib/transaction";
import { publicError } from "@/lib/crm/commands";
import { confirmWizard, saveWizard, wizardActor, WizardValidationError, WizardAlreadyConfirmedError } from "@/lib/commessa-wizard";
import { z } from "zod";
import { WizardData, WizardSave } from "@/lib/commessa-wizard-schema";
import { findSimilarAnagrafiche } from "@/lib/anagrafica-duplicates";

export async function saveCommessaDraft(raw: unknown) {
  const user = await requireUser();
  try {
    const draft = await serializable((db) => saveWizard(db, user.id, raw));
    revalidatePath("/commesse/bozze");
    return { versione: draft.versione };
  } catch (e) {
    if (e instanceof WizardAlreadyConfirmedError) return { href: `/commesse/${e.commessaId}` };
    return { error: publicError(e) };
  }
}

export async function confirmCommessaDraft(raw: unknown) {
  const user = await requireUser();
  try {
    const input = WizardSave.pick({ id: true, versione: true }).extend({ conferma: z.boolean(), documenti: z.array(z.string().min(1).max(100)) }).strict().parse(raw);
    const id = await serializable((db) => confirmWizard(db, user.id, input.id, input.versione, input.conferma, input.documenti));
    for (const path of ["/commesse", "/commesse/bozze", "/progetti", "/anagrafiche", "/"]) revalidatePath(path);
    return { href: `/commesse/${id}` };
  } catch (e) {
    return { error: publicError(e), fieldErrors: e instanceof WizardValidationError ? e.fields : undefined };
  }
}

export async function wizardCustomerContext(raw: unknown) {
  const user = await requireUser();
  try {
    await wizardActor(prisma, user.id);
    const v = WizardData.parse(raw);
    if (v.nuovoCliente) return { similar: await findSimilarAnagrafiche(prisma, v) };
    const last = await prisma.commessa.findFirst({ where: { clienteId: v.clienteId }, orderBy: [{ dataRichiesta: "desc" }, { progressivo: "desc" }],
      select: { id: true, numero: true, pmId: true, tipologia: true, indirizzoCantiere: true, referenteCommerciale: true } });
    return { last };
  } catch (e) { return { error: publicError(e) }; }
}
