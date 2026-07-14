// Estrazione dati da scheda tecnica materiale (PDF) con Gemini (multimodale).
// Stesso pattern della visura camerale: il modello legge il datasheet e
// restituisce dati strutturati che precompilano il form prodotto. L'utente
// conferma sempre; nessuna scrittura automatica.

import { generateObject } from "ai";
import { z } from "zod";
import { getAssistantModel } from "@/lib/ai";
import type { ProdottoFormValues } from "@/app/(app)/materiali/prodotto-form";

export const SchedaSchema = z.object({
  descrizione: z
    .string()
    .nullable()
    .describe("Nome/descrizione del prodotto, conciso ma completo"),
  codice: z
    .string()
    .nullable()
    .describe("Codice articolo / codice prodotto del fornitore, se presente"),
  marca: z.string().nullable().describe("Marca o produttore"),
  unitaMisura: z
    .string()
    .nullable()
    .describe("Unità di misura di vendita (pz, m, kg, scatola…)"),
  categoria: z
    .string()
    .nullable()
    .describe("Categoria merceologica sintetica (es. Cavi, Interruttori)"),
  prezzoListino: z
    .number()
    .nullable()
    .describe("Prezzo di listino in euro, se indicato (solo il numero)"),
  datiTecnici: z
    .string()
    .nullable()
    .describe(
      "Caratteristiche tecniche salienti in forma di elenco puntato (una per riga con '- '): tensione, sezione, portata, grado IP, dimensioni, norme, ecc.",
    ),
});

export type SchedaDati = z.infer<typeof SchedaSchema>;

const PROMPT = `Questa è una scheda tecnica (datasheet) di un materiale/prodotto, tipicamente elettrico.
Estrai i dati anagrafici e tecnici del prodotto. Usa solo ciò che è scritto: se un dato non c'è, lascialo null.
Per i dati tecnici fai un elenco puntato conciso (una caratteristica per riga, con "- ").`;

/** Estrae i dati del prodotto dal PDF della scheda tecnica. */
export async function estraiDaScheda(pdf: Uint8Array): Promise<SchedaDati> {
  const model = await getAssistantModel();
  if (!model) throw new Error("Assistente AI non configurato.");

  const { object } = await generateObject({
    model,
    schema: SchedaSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "file", data: pdf, mediaType: "application/pdf", filename: "scheda.pdf" },
        ],
      },
    ],
  });
  return object;
}

const s = (v: string | null | undefined) => (v ?? "").trim();

/** Mappa i dati estratti sui valori iniziali del form prodotto. */
export function schedaToFormValues(v: SchedaDati): ProdottoFormValues {
  return {
    descrizione: s(v.descrizione),
    codice: s(v.codice),
    marca: s(v.marca),
    unitaMisura: s(v.unitaMisura),
    categoria: s(v.categoria),
    prezzoListino: v.prezzoListino != null ? String(v.prezzoListino) : "",
    datiTecnici: s(v.datiTecnici),
    note: "",
  };
}
