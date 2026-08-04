"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { isSuperAdmin } from "@/lib/enums";
import { importaExcel, type EsitoImport } from "@/lib/import-excel";

export type ImportState =
  | { errore: string; esito?: undefined }
  | { errore?: undefined; esito: EsitoImport }
  | undefined;

/** Limite per file: gli elenchi reali stanno sotto i 2 MB, 15 dà margine. */
const MAX_BYTE = 15 * 1024 * 1024;

function estensioneOk(nome: string): boolean {
  return /\.(xls|xlsx)$/i.test(nome);
}

/**
 * Esegue l'import dei due elenchi.
 *
 * L'operazione è distruttiva quando `pulisci` è attivo, quindi il permesso è
 * ristretto al Super Admin e verificato **qui**: una server action è
 * raggiungibile con una POST diretta, nascondere il form non basta.
 */
export async function eseguiImport(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireUser();
  if (!isSuperAdmin(user.ruolo)) {
    return { errore: "Solo il Super Admin può importare i dati." };
  }

  const anagrafiche = formData.get("anagrafiche");
  const offerte = formData.get("offerte");

  if (!(anagrafiche instanceof File) || !(offerte instanceof File)) {
    return { errore: "Carica entrambi i file: anagrafiche e offerte." };
  }
  if (anagrafiche.size === 0 || offerte.size === 0) {
    return { errore: "Uno dei due file è vuoto." };
  }
  for (const f of [anagrafiche, offerte]) {
    if (!estensioneOk(f.name)) {
      return { errore: `"${f.name}" non è un file Excel (.xls o .xlsx).` };
    }
    if (f.size > MAX_BYTE) {
      return { errore: `"${f.name}" supera i 15 MB.` };
    }
  }

  const prova = formData.get("modalita") !== "scrivi";
  const pulisci = formData.get("pulisci") !== null;

  try {
    const esito = await importaExcel({
      anagrafiche: await anagrafiche.arrayBuffer(),
      offerte: await offerte.arrayBuffer(),
      pulisci,
      prova,
    });

    if (!prova) {
      // I dati cambiano ovunque: elenchi, dashboard, statistiche, cantieri.
      revalidatePath("/", "layout");
    }
    return { esito };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore imprevisto.";
    return { errore: msg };
  }
}
