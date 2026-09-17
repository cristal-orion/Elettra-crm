import { Prisma } from "@/generated/prisma";
import { prisma } from "../prisma";
import { avanzamento, statoAvanzamento, haPianificazioneDimostrativa } from "../progetti";
import { CrmError } from "../crm/commands";
import type { AiContext } from "./http";

export const serialize = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const userSelect = { id: true, nome: true, cognome: true, ruolo: true } as const;

export async function readCommessa(idOrNumero: string) {
  const c = await prisma.commessa.findFirst({
    where: { OR: [{ id: idOrNumero }, { numero: idOrNumero }] },
    include: { cliente: { select: { id: true, ragioneSociale: true, codiceCliente: true } }, pm: { select: userSelect }, referente: true,
      milestone: { orderBy: { ordine: "asc" }, take: 300 }, assegnazioni: { include: { operaio: true }, take: 100 },
      documenti: { select: { id: true, nomeFile: true, categoria: true, tipoMime: true }, take: 100 },
      _count: { select: { ordiniFornitore: true, milestone: true, assegnazioni: true, documenti: true } } },
  });
  if (!c) throw new CrmError("Commessa non trovata.", "NOT_FOUND");
  const costi = await prisma.rigaOrdineFornitore.aggregate({ where: { ordine: { commessaId: c.id } }, _sum: { imponibile: true } });
  const partial = c._count.milestone > c.milestone.length;
  return serialize({ ...c, href: `/commesse/${c.id}`, progettoHref: `/progetti/${c.id}`, avanzamento: partial ? null : avanzamento(c.milestone), statoAvanzamento: partial ? null : statoAvanzamento(c), dettaglioParziale: partial || c._count.assegnazioni > c.assegnazioni.length || c._count.documenti > c.documenti.length, dimostrativo: haPianificazioneDimostrativa(c.milestone), acquisti: costi._sum.imponibile?.toString() ?? "0", documenti: c.documenti.map((d) => ({ ...d, href: `/documenti/${d.id}` })) });
}
export async function readCliente(id: string) {
  const a = await prisma.anagrafica.findUnique({ where: { id }, include: { referenti: true, _count: { select: { commesse: true, ordiniFornitore: true } } } });
  if (!a) throw new CrmError("Anagrafica non trovata.", "NOT_FOUND");
  const commesse = await prisma.commessa.findMany({ where: { clienteId: id }, take: 20, orderBy: { updatedAt: "desc" }, select: { id: true, numero: true, stato: true, descrizione: true, importoOrdine: true, updatedAt: true } });
  return serialize({ ...a, href: `/anagrafiche/${id}`, commesse: commesse.map((c) => ({ ...c, href: `/commesse/${c.id}` })), altreCommesse: a._count.commesse > commesse.length });
}
export async function contextData(context: AiContext) {
  return context.type === "cliente" ? readCliente(context.id) : readCommessa(context.id);
}
export function commessaWhere(input: { testo?: string; stato?: string; clienteId?: string; pmId?: string; dal?: string; al?: string }): Prisma.CommessaWhereInput {
  return {
    stato: input.stato, clienteId: input.clienteId, pmId: input.pmId,
    dataRichiesta: input.dal || input.al ? { gte: input.dal ? new Date(input.dal) : undefined, lt: input.al ? new Date(new Date(input.al).getTime() + 86400000) : undefined } : undefined,
    OR: input.testo ? [{ numero: { contains: input.testo } }, { descrizione: { contains: input.testo } }, { cliente: { ragioneSociale: { contains: input.testo } } }] : undefined,
  };
}
