import { z } from "zod";

const text = z.string().max(10000);
const short = z.string().max(300);
export const WizardData = z.strictObject({
  clienteId: short, nuovoCliente: z.boolean(),
  ragioneSociale: short, partitaIva: short, codiceFiscale: short,
  email: short, telefono: short, indirizzo: short, localita: short,
  similaritaConfermata: z.boolean(), referenteId: short,
  fonteStorico: short,
  suggerimentiConfermati: z.array(z.enum(["pmId", "tipologia", "indirizzoCantiere", "referenteCommerciale"])).max(4),
  descrizione: text, tipologia: short, indirizzoCantiere: short,
  importoOfferta: short, importoOrdine: short,
  dataRichiesta: short, dataInvio: short, dataOrdine: short,
  metodoRicezioneOrdine: short, oda: short,
  pmId: short, referenteCommerciale: short,
  dataInizioLavori: short, scadenzaLavori: short, noteCantiere: text,
  operai: z.array(z.string().min(1).max(100)).max(100),
});
export type WizardValues = z.infer<typeof WizardData>;
export const WizardSave = z.strictObject({
  id: z.string().uuid(), versione: z.number().int().min(0),
  passo: z.number().int().min(0).max(4), dati: WizardData,
});
export const emptyWizard: WizardValues = {
  clienteId: "", nuovoCliente: false, ragioneSociale: "", partitaIva: "", codiceFiscale: "",
  email: "", telefono: "", indirizzo: "", localita: "", similaritaConfermata: false,
  referenteId: "", descrizione: "", tipologia: "", indirizzoCantiere: "",
  fonteStorico: "", suggerimentiConfermati: [],
  importoOfferta: "", importoOrdine: "", dataRichiesta: "", dataInvio: "", dataOrdine: "",
  metodoRicezioneOrdine: "", oda: "", pmId: "", referenteCommerciale: "",
  dataInizioLavori: "", scadenzaLavori: "", noteCantiere: "", operai: [],
};
export const wizardSteps = ["Cliente", "Dati commessa/offerta", "Date/PM", "Risorse/allegati", "Riepilogo"];
export const fieldStep: Partial<Record<keyof WizardValues, number>> = {
  clienteId: 0, ragioneSociale: 0, email: 0, referenteId: 0,
  descrizione: 1, tipologia: 1, importoOfferta: 1, importoOrdine: 1, dataInvio: 1,
  dataRichiesta: 2, dataOrdine: 2, metodoRicezioneOrdine: 2, oda: 2,
  dataInizioLavori: 2, scadenzaLavori: 2, pmId: 2, operai: 3,
};
export const wizardAmount = (raw: string) => raw.trim() === "" ? null : Number(raw.replace(",", "."));

/** Errori condivisi client/server; una bozza può invece essere incompleta. */
export function wizardErrors(v: WizardValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (v.nuovoCliente) {
    if (!v.ragioneSociale.trim()) errors.ragioneSociale = "Inserisci la ragione sociale.";
    if (v.email && !z.email().safeParse(v.email.trim()).success) errors.email = "Inserisci un’email valida.";
  } else if (!v.clienteId) errors.clienteId = "Seleziona il cliente.";
  if (!v.descrizione.trim()) errors.descrizione = "Descrivi il lavoro.";
  if (!["P", "C", "T", "GARA"].includes(v.tipologia)) errors.tipologia = "Seleziona la tipologia.";
  const offerta = v.tipologia === "P" || v.tipologia === "GARA";
  for (const field of ["importoOfferta", "importoOrdine"] as const) {
    const value = wizardAmount(v[field]);
    if ((offerta && value === null) || (value !== null && (!Number.isFinite(value) || value < 0 || value > 1e12 || !/^\d+(?:[.,]\d{1,2})?$/.test(v[field].trim())))) errors[field] = "Inserisci un importo non negativo, con al massimo due decimali.";
  }
  for (const field of ["dataRichiesta", "dataInvio", "dataOrdine", "dataInizioLavori", "scadenzaLavori"] as const) {
    const required = field === "dataRichiesta" || field === "dataOrdine" || (offerta && field === "dataInvio");
    if ((required || v[field]) && !z.iso.date().safeParse(v[field]).success) errors[field] = "Inserisci una data valida.";
  }
  if (v.dataInizioLavori && v.scadenzaLavori && v.dataInizioLavori > v.scadenzaLavori) errors.scadenzaLavori = "La scadenza non può precedere l’inizio lavori.";
  if (!["EMAIL", "TELEFONO", "CONTROFIRMA", "NUMERO_ORDINE"].includes(v.metodoRicezioneOrdine)) errors.metodoRicezioneOrdine = "Indica come è stato confermato l’incarico.";
  if (!v.oda.trim()) errors.oda = "Inserisci il riferimento della conferma (email, chiamata o ordine).";
  if (new Set(v.operai).size !== v.operai.length) errors.operai = "Risorse duplicate.";
  if (v.operai.length && (!v.dataInizioLavori || !v.scadenzaLavori)) errors.operai = "Per assegnare risorse indica inizio e scadenza lavori al passo Date/PM.";
  return errors;
}
