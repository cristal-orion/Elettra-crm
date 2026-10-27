import { isDeepStrictEqual } from "node:util";
import { Prisma } from "@/generated/prisma";
import { InputError } from "./form-validation";
import { puoGestireAnagrafiche, puoGestireCommesse } from "./enums";
import { executeCommand, DuplicateAnagraficaError } from "./crm/commands";
import { findSimilarAnagrafiche } from "./anagrafica-duplicates";
import { WizardSave, wizardErrors, wizardAmount } from "./commessa-wizard-schema";

type Db = Prisma.TransactionClient;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const day = (v: string) => v ? new Date(`${v}T00:00:00Z`) : null;
export class WizardValidationError extends InputError {
  constructor(public fields: Record<string, string>) { super(Object.values(fields).join(" ")); }
}
export class WizardAlreadyConfirmedError extends InputError {
  constructor(public commessaId: string) { super("Questa bozza è già stata confermata. Apri la commessa."); }
}
export async function wizardActor(db: Db, id: string) {
  const actor = await db.user.findUnique({ where: { id }, select: { id: true, nome: true, cognome: true, ruolo: true, attivo: true } });
  if (!actor?.attivo || !puoGestireCommesse(actor.ruolo)) throw new InputError("Non hai i permessi per gestire questa bozza.");
  return actor;
}
export async function ownedDraft(db: Db, actorId: string, id: string) {
  await wizardActor(db, actorId);
  const draft = await db.bozzaCommessa.findUnique({ where: { id } });
  if (!draft || draft.autoreId !== actorId) throw new InputError("Bozza non disponibile per questo utente.");
  return draft;
}

export async function saveWizard(db: Db, actorId: string, raw: unknown) {
  await wizardActor(db, actorId);
  const input = WizardSave.parse(raw);
  const previous = await db.bozzaCommessa.findUnique({ where: { id: input.id } });
  if (previous && previous.autoreId !== actorId) throw new InputError("Bozza non disponibile per questo utente.");
  if (previous?.commessaId) throw new WizardAlreadyConfirmedError(previous.commessaId);
  if (previous && previous.passo === input.passo && isDeepStrictEqual(previous.dati, input.dati)) return previous;
  if ((previous?.versione ?? 0) !== input.versione) throw new InputError("Bozza modificata in un’altra finestra. Ricarica prima di salvare; i dati non sono stati sovrascritti.");
  return previous
    ? db.bozzaCommessa.update({ where: { id: input.id }, data: { dati: json(input.dati), passo: input.passo, versione: { increment: 1 } } })
    : db.bozzaCommessa.create({ data: { id: input.id, autoreId: actorId, dati: json(input.dati), passo: input.passo } });
}

/** Solo DB, da eseguire in serializable. Conferma dell'ultima versione salvata,
 * un solo cliente/numero/insieme assegnazioni anche con doppio clic o retry. */
export async function confirmWizard(db: Db, actorId: string, id: string, versione: number, conferma: boolean, documenti: string[] = []) {
  const actor = await wizardActor(db, actorId);
  const draft = await ownedDraft(db, actorId, id);
  if (!conferma) throw new InputError("Conferma esplicitamente l’incarico prima di creare la commessa.");
  if (draft.commessaId) return draft.commessaId;
  if (draft.versione !== versione) throw new InputError("Bozza modificata. Rileggi il riepilogo prima di confermare.");
  const currentDocuments = await db.documento.findMany({ where: { bozzaId: id }, select: { id: true } });
  if (!isDeepStrictEqual(currentDocuments.map((d) => d.id).sort(), [...documenti].sort())) {
    throw new WizardValidationError({ documenti: "Gli allegati sono cambiati. Rivedi l’elenco aggiornato prima di confermare." });
  }
  const v = WizardSave.shape.dati.parse(draft.dati);
  const errors = wizardErrors(v);
  if (Object.keys(errors).length) throw new WizardValidationError(errors);
  if (v.pmId && !await db.user.findFirst({ where: { id: v.pmId, attivo: true, ruolo: "PROJECT_MANAGER" }, select: { id: true } })) throw new WizardValidationError({ pmId: "Seleziona un Project Manager attivo." });
  if (!v.nuovoCliente && v.referenteId && !await db.referente.findFirst({ where: { id: v.referenteId, anagraficaId: v.clienteId }, select: { id: true } })) throw new WizardValidationError({ referenteId: "Il referente non appartiene al cliente." });
  let clienteId = v.clienteId;
  if (v.nuovoCliente) {
    if (!puoGestireAnagrafiche(actor.ruolo)) throw new InputError("La creazione del cliente richiede Backoffice o Super Admin.");
    const similar = await findSimilarAnagrafiche(db, v);
    if (similar.candidati.length && !v.similaritaConfermata) throw new WizardValidationError({ ragioneSociale: "Esistono anagrafiche simili. Verificale al passo Cliente prima di confermare." });
    try {
      const customer = await executeCommand(db, actorId, { type: "salvaAnagrafica", data: {
        ragioneSociale: v.ragioneSociale, isCliente: true,
        ...Object.fromEntries((["partitaIva", "codiceFiscale", "email", "telefono", "indirizzo", "localita"] as const).map((k) => [k, v[k].trim() || null])),
      } });
      clienteId = customer.id;
    } catch (e) {
      if (e instanceof DuplicateAnagraficaError) throw new WizardValidationError(Object.fromEntries(e.conflicts.flatMap((c) => c.campi.map((field) => [field, e.message]))));
      throw e;
    }
  } else {
    const customer = await db.anagrafica.findUnique({ where: { id: clienteId } });
    if (!customer) throw new WizardValidationError({ clienteId: "Seleziona un’anagrafica esistente." });
    if (!customer.isCliente) await executeCommand(db, actorId, { type: "salvaAnagrafica", id: clienteId, data: { isCliente: true } });
  }
  const created = await executeCommand(db, actorId, { type: "salvaCommessa", data: {
    clienteId, referenteId: v.nuovoCliente ? null : v.referenteId || null,
    pmId: v.pmId || null, referenteCommerciale: v.referenteCommerciale || null,
    descrizione: v.descrizione, stato: "ORDINE_CONFERMATO", tipologia: v.tipologia,
    dataRichiesta: v.dataRichiesta, dataInvio: v.dataInvio || null,
    importoOfferta: wizardAmount(v.importoOfferta), importoOrdine: wizardAmount(v.importoOrdine),
    dataOrdine: v.dataOrdine, metodoRicezioneOrdine: v.metodoRicezioneOrdine, oda: v.oda,
  } });
  await db.commessa.update({ where: { id: created.id }, data: {
    indirizzoCantiere: v.indirizzoCantiere || null, noteCantiere: v.noteCantiere || null,
    dataInizioLavori: day(v.dataInizioLavori), scadenzaLavori: day(v.scadenzaLavori),
  } });
  for (const operaioId of v.operai) {
    try { await executeCommand(db, actorId, {
      type: "assegnaOperaio", commessaId: created.id, operaioId,
      dal: v.dataInizioLavori, al: v.scadenzaLavori,
    }); } catch (e) {
      if (e instanceof InputError) throw new WizardValidationError({ operai: e.message });
      throw e;
    }
  }
  await db.documento.updateMany({ where: { bozzaId: draft.id }, data: { bozzaId: null, commessaId: created.id } });
  await db.bozzaCommessa.update({ where: { id: draft.id }, data: { commessaId: created.id, versione: { increment: 1 } } });
  await db.modificaEconomica.create({ data: {
    entita: "COMMESSA_CREAZIONE", entitaId: created.id, versione: 1,
    autoreId: actor.id, autoreNome: `${actor.nome} ${actor.cognome}`, autoreRuolo: actor.ruolo,
    dopo: json({ bozzaId: draft.id, ...v, clienteId, stato: "ORDINE_CONFERMATO" }),
  } });
  return created.id;
}
