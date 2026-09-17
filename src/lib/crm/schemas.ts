import { z } from "zod";
import { METODI_RICEZIONE, RUOLI_CANTIERE, STATI_COMMESSA, STATI_MILESTONE, TIPOLOGIE, TITOLI } from "../enums";

const text = z.string().trim().max(10000).nullable().optional();
const id = z.string().trim().min(1).max(100);
const optionalId = id.nullable().optional();
export const day = z.iso.date({ message: "Inserisci una data valida (AAAA-MM-GG)." }).nullable().optional();
const version = z.iso.datetime().optional();
const money = z.number().finite().min(0).max(1e12).nullable().optional();
const keys = <T extends Record<string, string>>(values: T) => Object.keys(values) as [Extract<keyof T, string>, ...Extract<keyof T, string>[]];

export const ReferenteData = z.object({
  id: id.optional(), titolo: z.enum(keys(TITOLI)).default("NESSUNO"),
  nome: z.string().trim().min(1).max(150), cognome: z.string().trim().min(1).max(150),
  ruoloAzienda: text, email: text, telefono: text, principale: z.boolean().default(false),
});
export const AnagraficaData = z.object({
  ragioneSociale: z.string().trim().min(1).max(300).optional(),
  isCliente: z.boolean().optional(), isFornitore: z.boolean().optional(),
  partitaIva: text, codiceFiscale: text, codiceSDI: text, indirizzo: text,
  cap: text, localita: text, provincia: text, telefono: text, fax: text, email: text,
  web: text, modalitaPagamento: text, prodottiTrattati: text, note: text,
});
export const CommessaData = z.object({
  clienteId: id.optional(), pmId: optionalId, referenteId: optionalId,
  referenteCommerciale: text, descrizione: text,
  stato: z.enum(keys(STATI_COMMESSA)).optional(), tipologia: z.enum(keys(TIPOLOGIE)).nullable().optional(),
  dataRichiesta: day, dataInvio: day, dataOrdine: day,
  importoOfferta: money, importoOrdine: money,
  metodoRicezioneOrdine: z.enum(keys(METODI_RICEZIONE)).nullable().optional(),
  motivazionePersa: text, oda: text,
});
export const MilestoneData = z.object({
  titolo: z.string().trim().min(1).max(300), dataPianificata: day, note: text,
});
export const CommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("salvaAnagrafica"), id: id.optional(), expectedUpdatedAt: version, data: AnagraficaData, referenti: z.array(ReferenteData).max(100).optional() }),
  z.object({ type: z.literal("salvaReferente"), anagraficaId: id, expectedUpdatedAt: version, data: ReferenteData }),
  z.object({ type: z.literal("salvaCommessa"), id: id.optional(), expectedUpdatedAt: version, data: CommessaData }),
  z.object({ type: z.literal("pianificaProgetto"), id, expectedUpdatedAt: version, data: z.object({ dataInizioLavori: day, scadenzaLavori: day, dataFineLavori: day, noteCantiere: text }) }),
  z.object({ type: z.literal("creaMilestone"), commessaId: id, milestone: z.array(MilestoneData).min(1).max(30) }),
  z.object({ type: z.literal("aggiornaMilestone"), id, expectedUpdatedAt: version, data: MilestoneData.partial().extend({ stato: z.enum(keys(STATI_MILESTONE)).optional(), dataEffettiva: day }) }),
  z.object({ type: z.literal("spostaMilestone"), id, expectedUpdatedAt: version, direzione: z.enum(["su", "giu"]) }),
  z.object({ type: z.literal("eliminaMilestone"), id, expectedUpdatedAt: version }),
  z.object({ type: z.literal("assegnaOperaio"), commessaId: id, operaioId: id, ruoloCantiere: z.enum(keys(RUOLI_CANTIERE)).nullable().optional(), dal: day, al: day, note: text, aggiornaEsistente: z.boolean().default(false) }),
  z.object({ type: z.literal("rimuoviAssegnazione"), id }),
  z.object({ type: z.literal("creaAttivita"), titolo: z.string().trim().min(1).max(300), note: text, scadenza: day, userId: id.optional(), commessaId: optionalId, clienteId: optionalId }),
  z.object({ type: z.literal("aggiornaAttivita"), id, expectedUpdatedAt: version, stato: z.enum(["DA_FARE", "COMPLETATA"]), scadenza: day }),
]);
export type CrmCommand = z.infer<typeof CommandSchema>;

export function needsConfirmation(c: CrmCommand): boolean {
  if (c.type === "eliminaMilestone" || c.type === "rimuoviAssegnazione") return true;
  if (c.type !== "salvaCommessa") return false;
  return c.data.importoOfferta !== undefined || c.data.importoOrdine !== undefined ||
    c.data.tipologia !== undefined || (c.data.stato !== undefined && (Boolean(c.id) || c.data.stato !== "LEAD"));
}

export function dateValue(value: string | null | undefined): Date | null | undefined {
  return value === undefined ? undefined : value === null ? null : new Date(`${value}T00:00:00.000Z`);
}
