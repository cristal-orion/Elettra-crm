import { z } from "zod";

export const STATI_PROBLEMA = { APERTA: "Aperta", IN_LAVORAZIONE: "In lavorazione", IN_ATTESA: "In attesa", RISOLTA: "Risolta" } as const;
export const PRIORITA_PROBLEMA = { BASSA: "Bassa", MEDIA: "Media", ALTA: "Alta", URGENTE: "Urgente" } as const;
const id = z.string().min(1).max(100);
const nota = z.string().trim().max(5000);
export const SalInput = z.object({
  richiestaId: z.uuid(), versione: z.number().int().min(0), data: z.iso.date(), nota,
  milestone: z.array(z.object({ id, stato: z.enum(["DA_FARE", "IN_CORSO", "COMPLETATA"]), versione: z.iso.datetime() })).max(300),
  documenti: z.array(id).max(10).default([]),
}).strict();
export const SospensioneInput = z.object({ richiestaId: z.uuid(), versione: z.number().int().min(0), sospeso: z.boolean(), motivo: nota }).strict();
export const ProblemaInput = z.object({
  richiestaId: z.uuid(), titolo: z.string().trim().min(3, "Scrivi un titolo di almeno 3 caratteri.").max(180),
  descrizione: z.string().trim().min(3, "Descrivi il problema.").max(5000),
  priorita: z.enum(["BASSA", "MEDIA", "ALTA", "URGENTE"]),
  assegnatarioId: id.nullable(), scadenza: z.iso.date().nullable(), creaAttivita: z.boolean(),
  documenti: z.array(id).max(10).default([]),
}).strict();
export const ProblemaUpdate = z.object({
  richiestaId: z.uuid(), versione: z.number().int().min(1),
  stato: z.enum(["APERTA", "IN_LAVORAZIONE", "IN_ATTESA", "RISOLTA"]),
  assegnatarioId: id.nullable(), scadenza: z.iso.date().nullable(),
  priorita: z.enum(["BASSA", "MEDIA", "ALTA", "URGENTE"]), commento: nota,
  documenti: z.array(id).max(10).default([]),
}).strict();
