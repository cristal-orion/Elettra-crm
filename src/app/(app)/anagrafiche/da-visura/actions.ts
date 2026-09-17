"use server";

import { requireUser } from "@/lib/dal";
import { puoGestireAnagrafiche } from "@/lib/enums";
import { estraiDaVisura, visuraToFormValues } from "@/lib/ai-visura";
import type { AnagraficaFormValues } from "../anagrafica-form";
import { publicError } from "@/lib/crm/commands";

export type VisuraState =
  | { ok: true; dati: AnagraficaFormValues; nome: string }
  | { ok?: false; error: string }
  | undefined;

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function estraiVisura(
  _prev: VisuraState,
  formData: FormData,
): Promise<VisuraState> {
  const user = await requireUser();
  if (!puoGestireAnagrafiche(user.ruolo)) {
    return { error: "Non hai i permessi per creare anagrafiche." };
  }

  const file = formData.get("visura");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Carica il PDF della visura." };
  }
  if (file.type && file.type !== "application/pdf") {
    return { error: "Il file deve essere un PDF." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Il PDF supera i 20 MB." };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dati = await estraiDaVisura(bytes, user.id);
    const mappati = visuraToFormValues(dati);
    if (!mappati.ragioneSociale) {
      return {
        error:
          "Non sono riuscito a leggere la ragione sociale dalla visura. Controlla il file o inserisci l'anagrafica a mano.",
      };
    }
    return { ok: true, dati: mappati, nome: file.name };
  } catch (e) {
    return { error: publicError(e) };
  }
}
