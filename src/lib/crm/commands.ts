import { z } from "zod";
import { Prisma } from "@/generated/prisma";
import { prisma } from "../prisma";
import { InputError } from "../form-validation";
import { puoGestireAnagrafiche, puoGestireCommesse, puoGestireProgetti } from "../enums";
import { isProgetto } from "../progetti";
import { commessaHaAcquisti, tipologiaForzata } from "../regole";
import { CommandSchema, dateValue, type CrmCommand } from "./schemas";

export class CrmError extends InputError {
  constructor(message: string, public code = "INVALID_INPUT") { super(message); }
}
export function publicError(e: unknown): string {
  if (e instanceof InputError) return e.message;
  if (e instanceof z.ZodError) return e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ");
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "Esiste già un record con questi dati.";
  return "Operazione non completata. Riprova o ricarica i dati.";
}
export type Db = Prisma.TransactionClient;
export type CommandResult = { id: string; href: string; message: string; warnings?: string[]; ids?: string[] };

export async function checkPermission(db: Db, actorId: string, command: CrmCommand) {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { id: true, ruolo: true, attivo: true } });
  if (!actor?.attivo) throw new CrmError("Sessione non valida.", "UNAUTHORIZED");
  const allowed = command.type === "salvaAnagrafica" || command.type === "salvaReferente" ? puoGestireAnagrafiche(actor.ruolo)
    : command.type === "salvaCommessa" ? puoGestireCommesse(actor.ruolo)
    : command.type === "creaAttivita" || command.type === "aggiornaAttivita" ? true
    : puoGestireProgetti(actor.ruolo);
  if (!allowed) throw new CrmError("Non hai i permessi per questa operazione.", "FORBIDDEN");
  return actor;
}
function checkVersion(row: { updatedAt: Date }, expected?: string) {
  if (expected && row.updatedAt.toISOString() !== expected) throw new CrmError("Il record è stato modificato. Rileggi i dati prima di riprovare.", "CONFLICT");
}
async function project(db: Db, id: string) {
  const c = await db.commessa.findUnique({ where: { id } });
  if (!c || !isProgetto(c.stato)) throw new CrmError("Serve una commessa acquisita per gestire il progetto.");
  return c;
}
function range(start: Date | null | undefined, end: Date | null | undefined) {
  if (start && end && start > end) throw new CrmError("La data finale non può precedere quella iniziale.");
}
async function nextCode(db: Db, prefix: "C" | "F") {
  const field = prefix === "C" ? "codiceCliente" : "codiceFornitore";
  const rows = await db.anagrafica.findMany({ where: { [field]: { not: null } }, select: { codiceCliente: true, codiceFornitore: true } });
  const max = rows.reduce((n, row) => Math.max(n, Number(row[field]?.slice(1)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
async function saveReferente(db: Db, anagraficaId: string, data: NonNullable<Extract<CrmCommand, { type: "salvaAnagrafica" }>["referenti"]>[number]) {
  const { id, ...values } = data;
  if (id && !await db.referente.findFirst({ where: { id, anagraficaId } })) throw new CrmError("Il referente non appartiene all'anagrafica.");
  if (values.principale) await db.referente.updateMany({ where: { anagraficaId }, data: { principale: false } });
  return id ? db.referente.update({ where: { id, anagraficaId }, data: values }) : db.referente.create({ data: { anagraficaId, ...values } });
}

/** Mutazioni atomiche condivise da UI e AI. Nessun redirect né dipendenza da cookie. */
export async function executeCommand(db: Db, actorId: string, raw: unknown): Promise<CommandResult> {
  const c = CommandSchema.parse(raw);
  const actor = await checkPermission(db, actorId, c);
  switch (c.type) {
    case "salvaAnagrafica": {
      const existing = c.id ? await db.anagrafica.findUnique({ where: { id: c.id } }) : null;
      if (c.id && !existing) throw new CrmError("Anagrafica non trovata.");
      if (existing) checkVersion(existing, c.expectedUpdatedAt);
      const data = { ...existing, ...c.data };
      if (!data.ragioneSociale || (!data.isCliente && !data.isFornitore)) throw new CrmError("Indica ragione sociale e almeno Cliente o Fornitore.");
      const matches: Prisma.AnagraficaWhereInput[] = [];
      if (c.data.partitaIva) matches.push({ partitaIva: c.data.partitaIva });
      if (c.data.codiceFiscale) matches.push({ codiceFiscale: c.data.codiceFiscale });
      if (matches.length && await db.anagrafica.findFirst({ where: { id: c.id ? { not: c.id } : undefined, OR: matches } })) throw new CrmError("P. IVA o codice fiscale già presenti: consulta l'anagrafica esistente.", "DUPLICATE");
      const values = { ...c.data, codiceCliente: existing?.codiceCliente ?? (data.isCliente ? await nextCode(db, "C") : null), codiceFornitore: existing?.codiceFornitore ?? (data.isFornitore ? await nextCode(db, "F") : null) };
      const row = existing ? await db.anagrafica.update({ where: { id: existing.id }, data: values }) : await db.anagrafica.create({ data: { ...values, ragioneSociale: data.ragioneSociale } });
      if (c.referenti !== undefined) {
        const ids = c.referenti.flatMap((r) => r.id ? [r.id] : []);
        if (new Set(ids).size !== ids.length) throw new CrmError("Referenti duplicati.");
        const previous = await db.referente.findMany({ where: { anagraficaId: row.id }, select: { id: true } });
        for (const r of c.referenti) await saveReferente(db, row.id, r);
        await db.referente.deleteMany({ where: { anagraficaId: row.id, id: { in: previous.map((r) => r.id).filter((id) => !ids.includes(id)) }, commesse: { none: {} } } });
      }
      return { id: row.id, href: `/anagrafiche/${row.id}`, message: existing ? "Anagrafica aggiornata." : "Anagrafica creata." };
    }
    case "salvaReferente": {
      const a = await db.anagrafica.findUnique({ where: { id: c.anagraficaId } });
      if (!a) throw new CrmError("Anagrafica non trovata.");
      checkVersion(a, c.expectedUpdatedAt);
      const r = await saveReferente(db, a.id, c.data);
      await db.anagrafica.update({ where: { id: a.id }, data: { updatedAt: new Date() } });
      return { id: r.id, href: `/anagrafiche/${a.id}`, message: "Referente salvato." };
    }
    case "salvaCommessa": {
      const existing = c.id ? await db.commessa.findUnique({ where: { id: c.id } }) : null;
      if (c.id && !existing) throw new CrmError("Commessa non trovata.");
      if (existing) checkVersion(existing, c.expectedUpdatedAt);
      const clienteId = c.data.clienteId ?? existing?.clienteId;
      if (!clienteId || !await db.anagrafica.findFirst({ where: { id: clienteId, isCliente: true } })) throw new CrmError("Seleziona un cliente valido.");
      const referenteId = c.data.referenteId === undefined ? existing?.referenteId : c.data.referenteId;
      const pmId = c.data.pmId === undefined ? existing?.pmId : c.data.pmId;
      if (referenteId && !await db.referente.findFirst({ where: { id: referenteId, anagraficaId: clienteId } })) throw new CrmError("Il referente non appartiene al cliente.");
      if (pmId && !await db.user.findFirst({ where: { id: pmId, attivo: true, ruolo: "PROJECT_MANAGER" } })) throw new CrmError("Seleziona un Project Manager attivo.");
      const values = { ...c.data, clienteId, referenteId, pmId, dataRichiesta: dateValue(c.data.dataRichiesta) ?? undefined, dataInvio: dateValue(c.data.dataInvio), dataOrdine: dateValue(c.data.dataOrdine) };
      if (existing) {
        const tipologia = tipologiaForzata(c.data.tipologia === undefined ? existing.tipologia : c.data.tipologia, await commessaHaAcquisti(db, existing.id));
        const row = await db.commessa.update({ where: { id: existing.id }, data: { ...values, tipologia } });
        return { id: row.id, href: `/commesse/${row.id}`, message: "Commessa aggiornata." };
      }
      const { _max } = await db.commessa.aggregate({ _max: { progressivo: true } });
      const progressivo = (_max.progressivo ?? 0) + 1;
      const anno = (values.dataRichiesta ?? new Date()).getUTCFullYear();
      const numero = `${String(anno).slice(-2)}${String(progressivo).padStart(4, "0")}`;
      const row = await db.commessa.create({ data: { ...values, progressivo, anno, numero } });
      return { id: row.id, href: `/commesse/${row.id}`, message: `Commessa ${numero} creata.` };
    }
    case "pianificaProgetto": {
      const p = await project(db, c.id);
      checkVersion(p, c.expectedUpdatedAt);
      const data = { ...c.data, dataInizioLavori: dateValue(c.data.dataInizioLavori), scadenzaLavori: dateValue(c.data.scadenzaLavori), dataFineLavori: dateValue(c.data.dataFineLavori) };
      range(data.dataInizioLavori === undefined ? p.dataInizioLavori : data.dataInizioLavori, data.scadenzaLavori === undefined ? p.scadenzaLavori : data.scadenzaLavori);
      range(data.dataInizioLavori === undefined ? p.dataInizioLavori : data.dataInizioLavori, data.dataFineLavori === undefined ? p.dataFineLavori : data.dataFineLavori);
      await db.commessa.update({ where: { id: p.id }, data });
      return { id: p.id, href: `/progetti/${p.id}`, message: "Pianificazione aggiornata." };
    }
    case "creaMilestone": {
      const p = await project(db, c.commessaId);
      const { _max } = await db.milestone.aggregate({ where: { commessaId: p.id }, _max: { ordine: true } });
      const ids: string[] = [];
      for (const [i, m] of c.milestone.entries()) {
        const row = await db.milestone.create({ data: { ...m, commessaId: p.id, ordine: (_max.ordine ?? -1) + 1 + i, dataPianificata: dateValue(m.dataPianificata) } });
        ids.push(row.id);
      }
      return { id: p.id, ids, href: `/progetti/${p.id}`, message: `${ids.length} milestone aggiunte.` };
    }
    case "aggiornaMilestone":
    case "eliminaMilestone":
    case "spostaMilestone": {
      const m = await db.milestone.findUnique({ where: { id: c.id } });
      if (!m) throw new CrmError("Milestone non trovata.");
      await project(db, m.commessaId);
      checkVersion(m, c.expectedUpdatedAt);
      if (c.type === "eliminaMilestone") await db.milestone.delete({ where: { id: m.id } });
      else if (c.type === "spostaMilestone") {
        const neighbor = await db.milestone.findFirst({ where: { commessaId: m.commessaId, ordine: c.direzione === "su" ? { lt: m.ordine } : { gt: m.ordine } }, orderBy: { ordine: c.direzione === "su" ? "desc" : "asc" } });
        if (neighbor) {
          await db.milestone.update({ where: { id: m.id }, data: { ordine: neighbor.ordine } });
          await db.milestone.update({ where: { id: neighbor.id }, data: { ordine: m.ordine } });
        }
      } else {
        const stato = c.data.stato ?? m.stato;
        await db.milestone.update({ where: { id: m.id }, data: { ...c.data, dataPianificata: dateValue(c.data.dataPianificata), dataEffettiva: stato === "COMPLETATA" ? dateValue(c.data.dataEffettiva) ?? m.dataEffettiva ?? new Date() : null } });
      }
      return { id: m.id, href: `/progetti/${m.commessaId}`, message: c.type === "eliminaMilestone" ? "Milestone eliminata." : "Milestone aggiornata." };
    }
    case "assegnaOperaio": {
      await project(db, c.commessaId);
      if (!await db.operaio.findFirst({ where: { id: c.operaioId, attivo: true } })) throw new CrmError("Seleziona un operaio attivo.");
      const existing = await db.assegnazioneOperaio.findUnique({ where: { commessaId_operaioId: { commessaId: c.commessaId, operaioId: c.operaioId } } });
      if (existing && !c.aggiornaEsistente) throw new CrmError("Operaio già assegnato. Usa aggiornaEsistente per modificare l'intervallo.");
      const dal = c.dal === undefined ? existing?.dal : dateValue(c.dal);
      const al = c.al === undefined ? existing?.al : dateValue(c.al);
      range(dal, al);
      const conflicts = await db.assegnazioneOperaio.count({ where: { operaioId: c.operaioId, commessaId: { not: c.commessaId }, commessa: { stato: { in: ["ORDINE_CONFERMATO", "IN_ESECUZIONE", "CONSUNTIVO"] }, dataFineLavori: null }, AND: [{ OR: [{ al: null }, { al: { gte: dal ?? new Date(0) } }] }, { OR: [{ dal: null }, { dal: { lte: al ?? new Date("9999-12-31") } }] }] } });
      if (conflicts) throw new CrmError("Intervallo sovrapposto ad altre assegnazioni attive. Scegli date diverse o aggiorna le assegnazioni esistenti.", "OVERLAP");
      const data = { commessaId: c.commessaId, operaioId: c.operaioId, ruoloCantiere: c.ruoloCantiere, dal, al, note: c.note };
      const row = existing ? await db.assegnazioneOperaio.update({ where: { id: existing.id }, data }) : await db.assegnazioneOperaio.create({ data });
      return { id: row.id, href: `/progetti/${c.commessaId}`, message: existing ? "Assegnazione aggiornata." : "Operaio assegnato." };
    }
    case "rimuoviAssegnazione": {
      const a = await db.assegnazioneOperaio.findUnique({ where: { id: c.id } });
      if (!a) throw new CrmError("Assegnazione non trovata.");
      await project(db, a.commessaId);
      await db.assegnazioneOperaio.delete({ where: { id: a.id } });
      return { id: a.id, href: `/progetti/${a.commessaId}`, message: "Assegnazione rimossa." };
    }
    case "creaAttivita": {
      const userId = c.userId ?? actor.id;
      if (userId !== actor.id && !puoGestireCommesse(actor.ruolo)) throw new CrmError("Puoi creare attività solo per te.", "FORBIDDEN");
      if (!await db.user.findFirst({ where: { id: userId, attivo: true } })) throw new CrmError("Responsabile non valido.");
      const commessa = c.commessaId ? await db.commessa.findUnique({ where: { id: c.commessaId } }) : null;
      if (c.commessaId && !commessa) throw new CrmError("Commessa non trovata.");
      const clienteId = c.clienteId ?? commessa?.clienteId;
      if (clienteId && !await db.anagrafica.findUnique({ where: { id: clienteId } })) throw new CrmError("Cliente non trovato.");
      if (commessa && clienteId !== commessa.clienteId) throw new CrmError("Cliente e commessa non corrispondono.");
      const a = await db.attivita.create({ data: { titolo: c.titolo, note: c.note, scadenza: dateValue(c.scadenza), userId, commessaId: c.commessaId, clienteId } });
      return { id: a.id, href: "/attivita", message: "Attività creata." };
    }
    case "aggiornaAttivita": {
      const a = await db.attivita.findUnique({ where: { id: c.id } });
      if (!a) throw new CrmError("Attività non trovata.");
      if (a.userId !== actor.id && !puoGestireCommesse(actor.ruolo)) throw new CrmError("Non puoi modificare questa attività.", "FORBIDDEN");
      checkVersion(a, c.expectedUpdatedAt);
      await db.attivita.update({ where: { id: a.id }, data: { stato: c.stato, scadenza: dateValue(c.scadenza) } });
      return { id: a.id, href: "/attivita", message: "Attività aggiornata." };
    }
  }
}

export async function runCommand(actorId: string, command: unknown) {
  return prisma.$transaction((tx) => executeCommand(tx, actorId, command));
}
