import { z } from "zod";
import { METODI_RICEZIONE, TIPOLOGIE } from "./enums";

export const CATEGORIE_FASE = { APERTA: "Trattativa aperta", INVIATA: "Offerta inviata", VINTA: "Vinta", PERSA: "Persa" } as const;
export const TIPI_INTERAZIONE = { CHIAMATA: "Chiamata", EMAIL: "Email", INCONTRO: "Incontro", SOPRALLUOGO: "Sopralluogo", NOTA: "Nota" } as const;
const keys = <T extends Record<string, string>>(v: T) => Object.keys(v) as [Extract<keyof T, string>, ...Extract<keyof T, string>[]];
const id = z.string().trim().min(1).max(100);
export const CommercialeId = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, "Identificativo non valido.");
const nullableId = z.union([id, z.literal("")]).nullable().transform((v) => v || null);
const text = (max: number) => z.string().trim().max(max);
const money = text(18).transform((v) => v.replace(",", ".")).pipe(z.string().regex(/^(?:\d{1,12}(?:\.\d{1,2})?)?$/, "Inserisci un importo positivo, con massimo 2 decimali.")).nullable()
  .transform((v) => v || null);
const day = z.iso.date({ message: "Inserisci una data valida." });
const optionalDay = z.union([day, z.literal("")]).nullable().transform((v) => v || null);
const versione = z.number().int().min(0);

export const OpportunitaSchema = z.object({
  versione, titolo: text(250).min(1, "Il titolo è obbligatorio."), anagraficaId: id, referenteId: nullableId,
  responsabileId: id, tipologia: z.enum(keys(TIPOLOGIE)), origine: text(150), descrizione: text(6000),
  valorePrevisto: money, riferimentoOfferta: text(200), importoOfferta: money, dataInvioOfferta: optionalDay,
}).strict();
export const PassaggioSchema = z.object({ versione, faseId: id, motivo: text(2000) }).strict();
export const InterazioneSchema = z.object({
  versione, richiestaId: z.uuid(), tipo: z.enum(keys(TIPI_INTERAZIONE)), data: day,
  testo: text(6000).min(1, "Descrivi l'interazione."), esito: text(2000), rispostaCliente: z.boolean(),
  attivita: z.object({ titolo: text(300).min(1), scadenza: day, userId: id }).strict().nullable(),
}).strict();
export const ConversioneSchema = z.object({
  versione, dataOrdine: day, importoOrdine: money, metodoRicezioneOrdine: z.enum(keys(METODI_RICEZIONE)),
  riferimentoConferma: text(200).min(1, "Indica il riferimento della conferma del cliente."), pmId: nullableId,
  conferma: z.literal(true, { message: "Conferma i dati dell'incarico prima di creare la commessa." }),
}).strict();
export const FaseSchema = z.object({
  versione, nome: text(60).min(1), categoria: z.enum(keys(CATEGORIE_FASE)), ordine: z.number().int().min(0).max(1000), attiva: z.boolean(),
}).strict();

export type OpportunitaInput = z.input<typeof OpportunitaSchema>;
export type FaseValues = { id: string; nome: string; categoria: string; ordine: number; attiva: boolean; versione: number };
