import { prisma } from "@/lib/prisma";
import { puoGestireCommesse } from "@/lib/enums";
import { puoLeggereEconomia } from "@/lib/access";

export async function commercialOptions() {
  const [anagrafiche, users, fasi] = await Promise.all([
    prisma.anagrafica.findMany({ where: { OR: [{ isCliente: true }, { isProspect: true }] }, orderBy: { ragioneSociale: "asc" }, select: { id: true, ragioneSociale: true, partitaIva: true, codiceCliente: true, isProspect: true,
      referenti: { orderBy: { cognome: "asc" }, select: { id: true, nome: true, cognome: true } } } }),
    prisma.user.findMany({ orderBy: [{ cognome: "asc" }, { nome: "asc" }], select: { id: true, nome: true, cognome: true, ruolo: true, attivo: true } }),
    prisma.faseCommerciale.findMany({ orderBy: [{ ordine: "asc" }, { id: "asc" }] }),
  ]);
  return { anagrafiche, responsabili: users.filter((u) => puoGestireCommesse(u.ruolo)), pm: users.filter((u) => u.attivo && u.ruolo === "PROJECT_MANAGER"), users: users.filter((u) => u.attivo && puoLeggereEconomia(u)), fasi };
}
export type CommercialOptions = Awaited<ReturnType<typeof commercialOptions>>;
