"use server";

import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/dal";
import { puoGestireCatalogo } from "@/lib/enums";
import { salvaFile, sanitizeFilename, PENDING_DIR } from "@/lib/storage";
import { estraiDaScheda, schedaToFormValues } from "@/lib/ai-scheda";
import type { ProdottoFormValues } from "../prodotto-form";

export type SchedaState =
  | {
      ok: true;
      dati: ProdottoFormValues;
      nome: string;
      pending: { percorso: string; nome: string; mime: string; dim: number };
    }
  | { ok?: false; error: string }
  | undefined;

const MAX_BYTES = 20 * 1024 * 1024;

export async function estraiScheda(
  _prev: SchedaState,
  formData: FormData,
): Promise<SchedaState> {
  const user = await requireUser();
  if (!puoGestireCatalogo(user.ruolo)) {
    return { error: "Non hai i permessi per gestire il catalogo." };
  }

  const file = formData.get("scheda");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Carica il PDF della scheda tecnica." };
  }
  if (file.type && file.type !== "application/pdf") {
    return { error: "Il file deve essere un PDF." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Il PDF supera i 20 MB." };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dati = schedaToFormValues(await estraiDaScheda(bytes));
    if (!dati.descrizione) {
      return {
        error:
          "Non sono riuscito a leggere una descrizione dalla scheda. Riprova o inserisci il materiale a mano.",
      };
    }

    // Parcheggia il PDF: verrà collegato al prodotto alla conferma.
    const nome = sanitizeFilename(file.name);
    const percorso = await salvaFile(
      PENDING_DIR,
      `${randomUUID()}__${nome}`,
      Buffer.from(bytes),
    );

    return {
      ok: true,
      dati,
      nome: file.name,
      pending: {
        percorso,
        nome,
        mime: file.type || "application/pdf",
        dim: file.size,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Estrazione fallita: ${msg.slice(0, 200)}` };
  }
}
