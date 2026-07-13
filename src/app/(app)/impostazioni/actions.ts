"use server";

import { generateText } from "ai";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireUtenti } from "@/lib/enums";
import { encryptSecret } from "@/lib/secrets";
import {
  GEMINI_KEY_SETTING,
  MODEL_ID,
  apiKeyFromEnv,
  getAssistantModel,
} from "@/lib/ai";

export type ConfigState =
  | { ok?: boolean; error?: string; message?: string }
  | undefined;

async function guard(): Promise<ConfigState> {
  const me = await requireUser();
  if (!puoGestireUtenti(me.ruolo)) {
    return { error: "Solo un amministratore può gestire le impostazioni." };
  }
  return undefined;
}

/** Salva (cifrata) la chiave API Gemini inserita da interfaccia. */
export async function salvaChiaveGemini(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  const err = await guard();
  if (err) return err;
  if (apiKeyFromEnv()) {
    return { error: "La chiave è già impostata via variabile d'ambiente." };
  }

  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (!apiKey) return { error: "Inserisci una chiave API." };
  if (apiKey.length < 20) return { error: "La chiave sembra troppo corta." };

  try {
    const valore = encryptSecret(apiKey);
    await prisma.impostazione.upsert({
      where: { chiave: GEMINI_KEY_SETTING },
      update: { valore },
      create: { chiave: GEMINI_KEY_SETTING, valore },
    });
  } catch {
    return { error: "Errore nel salvataggio della chiave." };
  }

  revalidatePath("/impostazioni");
  revalidatePath("/assistente");
  return { ok: true, message: "Chiave salvata." };
}

/** Rimuove la chiave salvata (disattiva l'assistente). */
export async function rimuoviChiaveGemini(): Promise<ConfigState> {
  const err = await guard();
  if (err) return err;
  if (apiKeyFromEnv()) {
    return { error: "La chiave proviene dall'ambiente: rimuovila dal file .env." };
  }
  try {
    await prisma.impostazione.deleteMany({ where: { chiave: GEMINI_KEY_SETTING } });
  } catch {
    return { error: "Errore nella rimozione." };
  }
  revalidatePath("/impostazioni");
  revalidatePath("/assistente");
  return { ok: true, message: "Chiave rimossa." };
}

/** Testa la chiave salvata con una mini-chiamata reale a Gemini. */
export async function testaGemini(): Promise<ConfigState> {
  const err = await guard();
  if (err) return err;

  const model = await getAssistantModel();
  if (!model) return { error: "Nessuna chiave configurata da testare." };

  try {
    const { text } = await generateText({
      model,
      prompt: 'Rispondi solo con la parola: OK',
      maxOutputTokens: 16,
    });
    return {
      ok: true,
      message: `Connessione riuscita con ${MODEL_ID} (risposta: "${text.trim().slice(0, 40)}").`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Test fallito: ${msg.slice(0, 200)}` };
  }
}
