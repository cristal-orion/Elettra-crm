// Fase 8 — Assistente AI interno.
// Provider AI isolato dietro un unico modulo, così cambiare fornitore (Gemini →
// OpenAI/Anthropic/"Sign in with ChatGPT") resta una modifica localizzata.
// Oggi: Google Gemini. La chiave può arrivare da env (GEMINI_API_KEY) oppure
// essere configurata da interfaccia (Impostazioni) e salvata cifrata nel DB.

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets";

/** Chiave in tabella Impostazione dove è salvata la chiave API Gemini (cifrata). */
export const GEMINI_KEY_SETTING = "gemini_api_key";

/** Modello usato dall'assistente. Sovrascrivibile senza toccare il codice. */
export const MODEL_ID = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

/**
 * Risolve la chiave API Gemini: prima l'env (per ops/produzione), poi il valore
 * cifrato salvato da interfaccia. Ritorna null se non configurata.
 */
export async function getGeminiApiKey(): Promise<string | null> {
  const env = process.env.GEMINI_API_KEY?.trim();
  if (env) return env;
  try {
    const row = await prisma.impostazione.findUnique({
      where: { chiave: GEMINI_KEY_SETTING },
    });
    if (row?.valore) return decryptSecret(row.valore);
  } catch {
    // chiave assente o non decifrabile → trattata come non configurata
  }
  return null;
}

/** Il modello pronto per streamText/generateText, o null se manca la chiave. */
export async function getAssistantModel(): Promise<LanguageModel | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;
  const google = createGoogleGenerativeAI({ apiKey });
  return google(MODEL_ID);
}

/** True se la chiave API è configurata (da env o da interfaccia). */
export async function isAiConfigured(): Promise<boolean> {
  return Boolean(await getGeminiApiKey());
}

/** True se la chiave arriva dall'ambiente (non modificabile da interfaccia). */
export function apiKeyFromEnv(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/** Istruzioni di sistema dell'assistente interno (sola lettura, Fase 8A). */
export const SYSTEM_PROMPT = `Sei l'assistente interno del CRM di Elettra S.r.l., azienda di impianti elettrici.
Aiuti lo staff a consultare i dati aziendali: commesse, clienti/fornitori, ordini, statistiche e storico prezzi dei materiali.

Regole:
- Rispondi sempre in italiano, in modo conciso e concreto.
- Usa SEMPRE gli strumenti per ottenere dati reali. Non inventare mai numeri, importi, date o codici: se non li trovi con gli strumenti, dillo.
- Gli importi sono in euro. Le commesse hanno un numero (formato AANNNN) e uno stato.
- Per ora sei in sola lettura: NON puoi creare o modificare dati. Se te lo chiedono, spiega che la funzione non è ancora attiva e indica la pagina del CRM dove farlo a mano.
- Quando citi una commessa o un cliente, riporta numero/codice così l'utente può ritrovarli.`;
