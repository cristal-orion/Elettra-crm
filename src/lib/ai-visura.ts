// Fase 8B — Estrazione dati da visura camerale (PDF) con Gemini (multimodale).
// Il modello legge il PDF e restituisce dati strutturati, che vengono mappati
// sui campi del form anagrafica per la precompilazione. Nessuna scrittura
// automatica: l'utente conferma sempre dal form.

import { generateObject } from "ai";
import { z } from "zod";
import { getAssistantModel } from "@/lib/ai";
import type { AnagraficaFormValues } from "@/app/(app)/anagrafiche/anagrafica-form";

/** Schema dei dati estraibili da una visura. Tutto nullable: il modello
 *  riempie ciò che trova, null quando il dato non è presente. */
export const VisuraSchema = z.object({
  ragioneSociale: z.string().nullable().describe("Denominazione / ragione sociale completa"),
  formaGiuridica: z.string().nullable().describe("Es. S.R.L., S.P.A., ditta individuale"),
  partitaIva: z.string().nullable(),
  codiceFiscale: z.string().nullable(),
  codiceSDI: z.string().nullable().describe("Codice destinatario SDI, se presente"),
  pec: z.string().nullable().describe("Indirizzo PEC"),
  indirizzo: z.string().nullable().describe("Via e numero civico della sede legale"),
  cap: z.string().nullable(),
  localita: z.string().nullable().describe("Comune della sede legale"),
  provincia: z.string().nullable().describe("Sigla provincia (2 lettere)"),
  telefono: z.string().nullable(),
  email: z.string().nullable(),
  web: z.string().nullable().describe("Sito web, se presente"),
  attivita: z
    .string()
    .nullable()
    .describe("Oggetto sociale o attività ATECO prevalente, in forma sintetica"),
  amministratori: z
    .array(
      z.object({
        nome: z.string(),
        cognome: z.string(),
        carica: z
          .string()
          .nullable()
          .describe("Es. Amministratore Unico, Presidente CdA, Socio"),
      }),
    )
    .describe("Amministratori / legali rappresentanti elencati nella visura"),
});

export type VisuraDati = z.infer<typeof VisuraSchema>;

const PROMPT = `Questa è una visura camerale italiana della Camera di Commercio.
Estrai i dati anagrafici dell'impresa. Usa esattamente ciò che è scritto nel documento,
non inventare nulla: se un dato non è presente, lascialo null.
La provincia va come sigla di 2 lettere. Gli amministratori sono le persone con cariche
(amministratore, legale rappresentante, presidente, socio amministratore).`;

/** Estrae i dati dell'impresa dal PDF della visura. Lancia se l'AI non è
 *  configurata o se il modello non riesce a produrre un output valido. */
export async function estraiDaVisura(pdf: Uint8Array): Promise<VisuraDati> {
  const model = await getAssistantModel();
  if (!model) throw new Error("Assistente AI non configurato.");

  const { object } = await generateObject({
    model,
    schema: VisuraSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "file", data: pdf, mediaType: "application/pdf", filename: "visura.pdf" },
        ],
      },
    ],
  });
  return object;
}

const s = (v: string | null | undefined) => (v ?? "").trim();

/** Mappa i dati estratti sui valori iniziali del form anagrafica. */
export function visuraToFormValues(v: VisuraDati): AnagraficaFormValues {
  const email = s(v.email) || s(v.pec);
  const noteParti = [
    v.formaGiuridica ? `Forma giuridica: ${s(v.formaGiuridica)}` : null,
    // se la PEC non è finita come email, la conservo nelle note
    v.pec && s(v.email) ? `PEC: ${s(v.pec)}` : null,
  ].filter(Boolean);

  return {
    ragioneSociale: s(v.ragioneSociale),
    isCliente: true,
    isFornitore: false,
    partitaIva: s(v.partitaIva),
    codiceFiscale: s(v.codiceFiscale),
    codiceSDI: s(v.codiceSDI),
    indirizzo: s(v.indirizzo),
    cap: s(v.cap),
    localita: s(v.localita),
    provincia: s(v.provincia).toUpperCase().slice(0, 2),
    telefono: s(v.telefono),
    fax: "",
    email,
    web: s(v.web),
    modalitaPagamento: "",
    prodottiTrattati: s(v.attivita),
    note: noteParti.join(" · "),
    referenti: (v.amministratori ?? []).map((a, i) => ({
      titolo: "NESSUNO",
      nome: s(a.nome),
      cognome: s(a.cognome),
      ruoloAzienda: s(a.carica) || "Amministratore",
      email: "",
      telefono: "",
      principale: i === 0,
    })),
  };
}
