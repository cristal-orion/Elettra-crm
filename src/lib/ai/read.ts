import { Prisma } from "@/generated/prisma";
import { prisma } from "../prisma";
import { avanzamento, statoAvanzamento, haPianificazioneDimostrativa } from "../progetti";
import { CrmError } from "../crm/commands";
import type { AiContext } from "./http";
import { attivitaHref, attivitaScope } from "../attivita";

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
  const a = await prisma.anagrafica.findUnique({ where: { id }, include: { referenti: true, destinazioni: { take: 100, orderBy: { codice: "asc" } }, _count: { select: { commesse: true, ordiniFornitore: true, destinazioni: true } } } });
  if (!a) throw new CrmError("Anagrafica non trovata.", "NOT_FOUND");
  const commesse = await prisma.commessa.findMany({ where: { clienteId: id }, take: 20, orderBy: { updatedAt: "desc" }, select: { id: true, numero: true, stato: true, descrizione: true, importoOrdine: true, updatedAt: true } });
  return serialize({ ...a, href: `/anagrafiche/${id}`, commesse: commesse.map((c) => ({ ...c, href: `/commesse/${c.id}` })), altreCommesse: a._count.commesse > commesse.length, altreDestinazioni: a._count.destinazioni > a.destinazioni.length });
}
export async function readOrdine(id: string, pagina = 1, limite = 25) {
  const ordine = await prisma.ordineFornitore.findUnique({ where: { id }, include: {
    fornitore: { select: { id: true, ragioneSociale: true, email: true, telefono: true } },
    commessa: { select: { id: true, numero: true, descrizione: true } },
    _count: { select: { righe: true } },
  } });
  if (!ordine) throw new CrmError("Ordine non trovato.", "NOT_FOUND");
  const [righe, totale] = await Promise.all([
    prisma.rigaOrdineFornitore.findMany({ where: { ordineId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (pagina - 1) * limite, take: limite }),
    prisma.rigaOrdineFornitore.aggregate({ where: { ordineId: id }, _sum: { imponibile: true } }),
  ]);
  return serialize({ ...ordine, href: `/ordini/${id}`, fornitoreHref: `/anagrafiche/${ordine.fornitoreId}`, commessaHref: ordine.commessaId ? `/commesse/${ordine.commessaId}` : null,
    imponibileTotale: totale._sum.imponibile ?? new Prisma.Decimal(0), totaleRighe: ordine._count.righe, pagina, altrePagine: pagina * limite < ordine._count.righe,
    righe: righe.map((r) => ({ ...r, quantitaDaRicevere: r.quantitaRicevuta === null ? null : Prisma.Decimal.max(0, r.quantita.minus(r.quantitaRicevuta)) })),
    limiteDati: "Quantità ricevuta null significa dato non registrato, non zero. Lo stato dell'ordine è quello registrato; non sono disponibili giacenze di magazzino." });
}

export const materialeSelect = { id: true, codice: true, descrizione: true, unitaMisura: true, categoria: true, marca: true, datiTecnici: true, note: true, prezzoListino: true, schedaNomeFile: true, updatedAt: true } as const;
export async function readMateriale(id: string) {
  const prodotto = await prisma.prodotto.findUnique({ where: { id }, select: materialeSelect });
  if (!prodotto) throw new CrmError("Materiale non trovato.", "NOT_FOUND");
  return serialize({ ...prodotto, href: `/materiali/${id}`, schedaHref: prodotto.schedaNomeFile ? `/materiali/scheda/${id}` : null, limiteDati: "Il listino è indicativo, non il prezzo dell'ultimo acquisto. Giacenze e disponibilità non sono registrate nel CRM." });
}

export async function activityActor(userId?: string) {
  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, ruolo: true, attivo: true } }) : null;
  if (!user?.attivo) throw new CrmError("Utente non disponibile.", "UNAUTHORIZED");
  return user;
}
export async function readAttivita(id: string, userId?: string) {
  const user = await activityActor(userId);
  const task = await prisma.attivita.findFirst({ where: { id, ...attivitaScope(user, "team") }, include: { user: { select: userSelect }, commessa: { select: { id: true, numero: true } }, cliente: { select: { id: true, ragioneSociale: true } } } });
  if (!task) throw new CrmError("Attività non trovata.", "NOT_FOUND");
  return serialize({ ...task, href: attivitaHref(task.id) });
}
export async function contextData(context: AiContext) {
  if (context.type === "cliente") return readCliente(context.id);
  if (context.type === "ordine") return readOrdine(context.id);
  if (context.type === "materiale") return readMateriale(context.id);
  return readCommessa(context.id);
}
export function commessaWhere(input: { testo?: string; stato?: string; clienteId?: string; pmId?: string; dal?: string; al?: string }): Prisma.CommessaWhereInput {
  return {
    stato: input.stato, clienteId: input.clienteId, pmId: input.pmId,
    dataRichiesta: input.dal || input.al ? { gte: input.dal ? new Date(input.dal) : undefined, lt: input.al ? new Date(new Date(input.al).getTime() + 86400000) : undefined } : undefined,
    OR: input.testo ? [{ numero: { contains: input.testo, mode: "insensitive" } }, { descrizione: { contains: input.testo, mode: "insensitive" } }, { cliente: { ragioneSociale: { contains: input.testo, mode: "insensitive" } } }] : undefined,
  };
}
