import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Prisma, type Opportunita } from "@/generated/prisma";
import { puoGestireCommesse, isSuperAdmin } from "./enums";
import { InputError } from "./form-validation";
import { giornoAttivita } from "./attivita";
import { executeCommand, nextAnagraficaCode } from "./crm/commands";
import { CommercialeId, OpportunitaSchema, PassaggioSchema, InterazioneSchema, ConversioneSchema, FaseSchema, type OpportunitaInput } from "./commerciale-schema";

type Db = Prisma.TransactionClient;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const day = (value: string | null) => value ? new Date(`${value}T00:00:00Z`) : null;
const decimal = (value: string | null) => value === null ? null : new Prisma.Decimal(value);
const chiusa = (categoria: string) => categoria === "VINTA" || categoria === "PERSA";
export async function commercialeActor(db: Db, id: string, config = false) {
  const actor = await db.user.findUnique({ where: { id }, select: { id: true, nome: true, cognome: true, ruolo: true, attivo: true } });
  if (!actor?.attivo || !(config ? isSuperAdmin(actor.ruolo) : puoGestireCommesse(actor.ruolo))) throw new InputError("Non hai i permessi per questa operazione.");
  return actor;
}
export function commercialeVersion(current: number, expected: number) {
  if (current !== expected) throw new InputError("La trattativa è stata modificata. Ricarica la scheda prima di salvare.");
}
function pastDate(value: string | null) {
  if (value && day(value)! > giornoAttivita()) throw new InputError("La data del contatto, dell'invio o della conferma non può essere futura.");
}
export async function eventoCommerciale(db: Db, actor: Awaited<ReturnType<typeof commercialeActor>>, opportunitaId: string | null, tipo: string, testo: string, prima: unknown = null, dopo: unknown = null) {
  return db.eventoCommerciale.create({ data: { opportunitaId, tipo, testo, data: giornoAttivita(), autoreId: actor.id, autoreNome: `${actor.nome} ${actor.cognome}`, autoreRuolo: actor.ruolo,
    prima: prima === null ? Prisma.DbNull : json(prima), dopo: dopo === null ? Prisma.DbNull : json(dopo) } });
}
export function opportunitaInput(row: Opportunita): OpportunitaInput {
  return { versione: row.versione, titolo: row.titolo, anagraficaId: row.anagraficaId, referenteId: row.referenteId ?? "", responsabileId: row.responsabileId ?? "",
    tipologia: row.tipologia as OpportunitaInput["tipologia"], origine: row.origine ?? "", descrizione: row.descrizione ?? "", valorePrevisto: row.valorePrevisto?.toFixed(2) ?? "",
    riferimentoOfferta: row.riferimentoOfferta ?? "", importoOfferta: row.importoOfferta?.toFixed(2) ?? "", dataInvioOfferta: row.dataInvioOfferta?.toISOString().slice(0, 10) ?? "" };
}
const include = { fase: true, anagrafica: { select: { ragioneSociale: true } }, referente: { select: { nome: true, cognome: true } }, responsabile: { select: { nome: true, cognome: true } }, commessa: { select: { id: true, numero: true } } } as const;
async function opportunity(db: Db, id: string) {
  const row = await db.opportunita.findUnique({ where: { id }, include });
  if (!row) throw new InputError("Trattativa non trovata.");
  return row;
}
function offerComplete(row: { riferimentoOfferta: string | null; importoOfferta: unknown; dataInvioOfferta: unknown }) {
  if (!row.riferimentoOfferta || row.importoOfferta === null || !row.dataInvioOfferta) throw new InputError("Completa riferimento, importo e data di invio dell'offerta prima di procedere.");
}

/** Tutte le mutazioni di questo modulo richiedono una transazione Serializable. */
export async function salvaOpportunita(db: Db, actorId: string, id: string, raw: unknown) {
  const actor = await commercialeActor(db, actorId);
  CommercialeId.parse(id);
  const input = OpportunitaSchema.parse(raw);
  const old = await db.opportunita.findUnique({ where: { id }, include });
  commercialeVersion(old?.versione ?? 0, input.versione);
  if (old && chiusa(old.fase.categoria)) throw new InputError("La trattativa è chiusa. Le trattative perse vanno riaperte prima di modificarle.");
  const anagrafica = await db.anagrafica.findFirst({ where: { id: input.anagraficaId, OR: [{ isCliente: true }, { isProspect: true }] } });
  if (!anagrafica) throw new InputError("Seleziona un cliente o un potenziale cliente.");
  const owner = await db.user.findUnique({ where: { id: input.responsabileId } });
  if (!owner?.attivo || !puoGestireCommesse(owner.ruolo)) throw new InputError("Scegli un responsabile commerciale attivo.");
  if (input.referenteId && !await db.referente.findFirst({ where: { id: input.referenteId, anagraficaId: input.anagraficaId } })) throw new InputError("Il referente non appartiene all'anagrafica selezionata.");
  pastDate(input.dataInvioOfferta);
  if (input.dataInvioOfferta) offerComplete(input);
  if (old?.fase.categoria === "INVIATA") offerComplete(input);
  const { versione, ...fields } = input;
  const data = { ...fields, origine: input.origine || null, descrizione: input.descrizione || null, riferimentoOfferta: input.riferimentoOfferta || null,
    valorePrevisto: decimal(input.valorePrevisto), importoOfferta: decimal(input.importoOfferta), dataInvioOfferta: day(input.dataInvioOfferta) };
  if (old && Object.entries(data).every(([key, value]) => isDeepStrictEqual(json(value), json(old[key as keyof Opportunita])))) return old;
  const initial = old ? old.fase : await db.faseCommerciale.findFirst({ where: { attiva: true, categoria: "APERTA" }, orderBy: [{ ordine: "asc" }, { id: "asc" }] });
  if (!initial) throw new InputError("Configura almeno una fase commerciale aperta.");
  const offerChanged = old && (old.riferimentoOfferta !== data.riferimentoOfferta || old.dataInvioOfferta?.getTime() !== data.dataInvioOfferta?.getTime() || old.importoOfferta?.toString() !== data.importoOfferta?.toString());
  const row = old ? await db.opportunita.update({ where: { id }, data: { ...data, versione: versione + 1, ...(offerChanged ? { ultimaRispostaIl: null } : {}) }, include })
    : await db.opportunita.create({ data: { ...data, id, faseId: initial.id }, include });
  if (old && old.anagraficaId !== row.anagraficaId) await db.attivita.updateMany({ where: { opportunitaId: id }, data: { clienteId: row.anagraficaId } });
  await eventoCommerciale(db, actor, id, old ? "MODIFICA" : "CREAZIONE", old ? "Dati della trattativa aggiornati" : "Trattativa creata", old, row);
  return row;
}

export async function cambiaFase(db: Db, actorId: string, id: string, raw: unknown) {
  const actor = await commercialeActor(db, actorId);
  const input = PassaggioSchema.parse(raw);
  const row = await opportunity(db, id);
  commercialeVersion(row.versione, input.versione);
  if (row.commessa || row.fase.categoria === "VINTA") throw new InputError("L'incarico è già confermato: apri la commessa collegata.");
  const fase = await db.faseCommerciale.findFirst({ where: { id: input.faseId, attiva: true } });
  if (!fase) throw new InputError("Fase non disponibile.");
  if (fase.categoria === "VINTA") throw new InputError("Usa Conferma incarico per vincere la trattativa e creare la commessa.");
  if (fase.categoria === "PERSA" && !input.motivo) throw new InputError("Il motivo della perdita è obbligatorio.");
  if (fase.categoria === "INVIATA") offerComplete(row);
  if (fase.id === row.faseId && (fase.categoria !== "PERSA" || row.motivazionePersa === input.motivo)) return row;
  const updated = await db.opportunita.update({ where: { id }, data: { faseId: fase.id, versione: { increment: 1 }, faseAggiornataIl: new Date(),
    motivazionePersa: fase.categoria === "PERSA" ? input.motivo : null, chiusaIl: fase.categoria === "PERSA" ? new Date() : null } });
  await eventoCommerciale(db, actor, id, "FASE", `${row.fase.nome} → ${fase.nome}${input.motivo ? ` · ${input.motivo}` : ""}`,
    { faseId: row.faseId, fase: row.fase.nome, motivo: row.motivazionePersa }, { faseId: fase.id, fase: fase.nome, motivo: updated.motivazionePersa });
  return updated;
}

export async function registraInterazione(db: Db, actorId: string, id: string, raw: unknown) {
  const actor = await commercialeActor(db, actorId);
  const input = InterazioneSchema.parse(raw);
  const hash = createHash("sha256").update(JSON.stringify({ id, ...input })).digest("hex");
  const prior = await db.eventoCommerciale.findUnique({ where: { richiestaId: input.richiestaId } });
  if (prior) {
    if (prior.autoreId !== actorId || prior.opportunitaId !== id || prior.richiestaHash !== hash) throw new InputError("La richiesta è già stata usata per un'altra operazione.");
    return prior;
  }
  const row = await opportunity(db, id);
  commercialeVersion(row.versione, input.versione);
  pastDate(input.data);
  const data = day(input.data)!;
  const task = input.attivita ? await executeCommand(db, actorId, { type: "creaAttivita", ...input.attivita, opportunitaId: id, note: input.testo }) : null;
  await db.opportunita.update({ where: { id }, data: { versione: { increment: 1 },
    ultimaInterazioneIl: !row.ultimaInterazioneIl || data > row.ultimaInterazioneIl ? data : row.ultimaInterazioneIl,
    ultimaRispostaIl: input.rispostaCliente && (!row.ultimaRispostaIl || data > row.ultimaRispostaIl) ? data : row.ultimaRispostaIl } });
  return db.eventoCommerciale.create({ data: { opportunitaId: id, autoreId: actorId, autoreNome: `${actor.nome} ${actor.cognome}`, autoreRuolo: actor.ruolo,
    tipo: input.tipo, data, testo: input.testo, esito: input.esito || null, richiestaId: input.richiestaId, richiestaHash: hash,
    dopo: json({ rispostaCliente: input.rispostaCliente, attivitaId: task?.id ?? null }) } });
}

export async function convertiOpportunita(db: Db, actorId: string, id: string, raw: unknown) {
  const actor = await commercialeActor(db, actorId);
  const input = ConversioneSchema.parse(raw);
  const row = await opportunity(db, id);
  // Prima della versione: un doppio click/retry restituisce la stessa commessa.
  if (row.commessa) return row.commessa;
  commercialeVersion(row.versione, input.versione);
  if (row.fase.categoria === "PERSA") throw new InputError("Riapri la trattativa persa prima di confermare l'incarico.");
  if (row.tipologia === "P" || row.tipologia === "GARA") offerComplete(row);
  if (row.tipologia !== "C" && input.importoOrdine === null) throw new InputError("Indica l'importo confermato dal cliente.");
  pastDate(input.dataOrdine);
  if (row.dataInvioOfferta && day(input.dataOrdine)! < row.dataInvioOfferta) throw new InputError("La conferma non può precedere l'invio dell'offerta.");
  const anagrafica = await db.anagrafica.findUniqueOrThrow({ where: { id: row.anagraficaId } });
  if (!anagrafica.isCliente) {
    if (!anagrafica.isProspect) throw new InputError("L'anagrafica non è un potenziale cliente.");
    const fiscal: Prisma.AnagraficaWhereInput[] = ["partitaIva", "codiceFiscale"].flatMap((key) => {
      const value = anagrafica[key as "partitaIva" | "codiceFiscale"]?.trim();
      return value ? [{ [key]: { equals: value, mode: "insensitive" } }] : [];
    });
    if (fiscal.length && await db.anagrafica.findFirst({ where: { id: { not: anagrafica.id }, isCliente: true, OR: fiscal } })) throw new InputError("Esiste già un cliente con questi dati fiscali. Collega la trattativa all'anagrafica esistente.");
    await db.anagrafica.update({ where: { id: anagrafica.id }, data: { isCliente: true, isProspect: false, codiceCliente: anagrafica.codiceCliente ?? await nextAnagraficaCode(db, "C") } });
  }
  const fase = await db.faseCommerciale.findFirstOrThrow({ where: { categoria: "VINTA", attiva: true }, orderBy: { ordine: "asc" } });
  const result = await executeCommand(db, actorId, { type: "salvaCommessa", data: { clienteId: row.anagraficaId, referenteId: row.referenteId, pmId: input.pmId,
    descrizione: row.descrizione ? `${row.titolo}\n${row.descrizione}` : row.titolo, tipologia: row.tipologia, stato: "ORDINE_CONFERMATO",
    importoOfferta: row.importoOfferta?.toNumber() ?? null, dataInvio: row.dataInvioOfferta?.toISOString().slice(0, 10) ?? null,
    importoOrdine: input.importoOrdine === null ? null : Number(input.importoOrdine), dataOrdine: input.dataOrdine,
    metodoRicezioneOrdine: input.metodoRicezioneOrdine, oda: input.riferimentoConferma,
  } });
  const commessa = await db.commessa.update({ where: { id: result.id }, data: { opportunitaId: id }, select: { id: true, numero: true } });
  const updated = await db.opportunita.update({ where: { id }, data: { faseId: fase.id, faseAggiornataIl: new Date(), chiusaIl: new Date(), versione: { increment: 1 }, motivazionePersa: null }, include });
  await db.documento.updateMany({ where: { opportunitaId: id }, data: { commessaId: commessa.id } });
  await db.attivita.updateMany({ where: { opportunitaId: id }, data: { commessaId: commessa.id, clienteId: row.anagraficaId } });
  await eventoCommerciale(db, actor, id, "CONVERSIONE", `Incarico confermato · commessa ${commessa.numero}`, row, { ...updated, ...input, versione: updated.versione, clienteId: row.anagraficaId });
  return commessa;
}

export async function salvaFase(db: Db, actorId: string, id: string, raw: unknown) {
  const actor = await commercialeActor(db, actorId, true);
  CommercialeId.parse(id);
  const input = FaseSchema.parse(raw);
  const old = await db.faseCommerciale.findUnique({ where: { id } });
  commercialeVersion(old?.versione ?? 0, input.versione);
  if (old && old.categoria !== input.categoria) throw new InputError("La categoria semantica di una fase esistente è fissa. Crea una nuova fase.");
  if (!old && (input.categoria === "VINTA" || input.categoria === "PERSA")) throw new InputError("Le fasi Vinta e Persa sono già presenti.");
  if (!input.attiva) {
    if (input.categoria === "VINTA" || input.categoria === "PERSA") throw new InputError("Vinta e Persa devono restare attive.");
    if (await db.opportunita.count({ where: { faseId: id } })) throw new InputError("Sposta le trattative in un'altra fase prima di disattivarla.");
    if (!await db.faseCommerciale.count({ where: { id: { not: id }, categoria: "APERTA", attiva: true } })) throw new InputError("Deve restare almeno una fase aperta attiva.");
  }
  if (await db.faseCommerciale.findFirst({ where: { id: { not: id }, nome: { equals: input.nome, mode: "insensitive" } } })) throw new InputError("Esiste già una fase con questo nome.");
  const { versione, ...data } = input;
  if (old && Object.entries(data).every(([k, v]) => old[k as keyof typeof old] === v)) return old;
  const row = old ? await db.faseCommerciale.update({ where: { id }, data: { ...data, versione: versione + 1 } }) : await db.faseCommerciale.create({ data: { ...data, id } });
  await eventoCommerciale(db, actor, null, "CONFIGURAZIONE", `Fase ${row.nome}`, old, row);
  return row;
}
