import { Prisma, type PrismaClient } from "@/generated/prisma";
import { commessaScope, commessaScopeSql, puoLeggereEconomia, type Actor } from "./access";
import { projectListSource } from "./project-list";
import { STATI_PROGETTO_ATTIVO } from "./progetti";
import { giornoAttivita } from "./attivita";

export function periodoConsuntivi(periodo?: string, now = new Date()) {
  const giorni = periodo === "90" ? 90 : periodo === "tutti" ? null : 30;
  const oggi = giornoAttivita(now);
  return { periodo: giorni === null ? "tutti" : String(giorni), date: giorni === null ? {} : { gte: new Date(+oggi - (giorni - 1) * 86400000), lt: new Date(+oggi + 86400000) } };
}

export async function getDashboard(db: PrismaClient, actor: Actor, periodo?: string, now = new Date()) {
  const range = periodoConsuntivi(periodo, now);
  return db.$transaction(async (tx) => {
    const [states, problemi, recenti, rendiconti, commerciale] = await Promise.all([
      tx.$queryRaw<{ stato: number; totale: number }[]>(Prisma.sql`SELECT s.urgency::int AS stato, count(*)::int AS totale FROM (${projectListSource(now)}) s WHERE ${commessaScopeSql(actor)} AND s.stato IN (${Prisma.join([...STATI_PROGETTO_ATTIVO])}) GROUP BY s.urgency`),
      tx.problemaCantiere.count({ where: { commessa: commessaScope(actor), stato: { not: "RISOLTA" } } }),
      tx.problemaCantiere.findMany({ where: { commessa: commessaScope(actor), stato: { not: "RISOLTA" } }, take: 5, orderBy: [{ scadenza: "asc" }, { updatedAt: "desc" }], include: { commessa: { select: { numero: true, cliente: { select: { ragioneSociale: true } } } } } }),
      puoLeggereEconomia(actor) ? tx.consuntivo.aggregate({ where: { data: range.date }, _count: { _all: true }, _sum: { totale: true, totaleOre: true, totaleMateriali: true } }) : null,
      puoLeggereEconomia(actor) ? tx.opportunita.groupBy({ by: ["faseId"], _count: { _all: true }, _sum: { valorePrevisto: true } }) : [],
    ]);
    const fasi = commerciale.length ? await tx.faseCommerciale.findMany({ where: { id: { in: commerciale.map((r) => r.faseId) } }, orderBy: { ordine: "asc" } }) : [];
    const counts = new Map(states.map((s) => [s.stato, s.totale]));
    return { aggiornatoIl: now, periodo: range.periodo, aperti: states.reduce((n, r) => n + r.totale, 0), ritardo: counts.get(0) ?? 0, sospesi: counts.get(4) ?? 0, problemi, recenti, rendiconti,
      commerciale: fasi.map((f) => ({ ...f, totale: commerciale.find((r) => r.faseId === f.id)!._count._all, valore: commerciale.find((r) => r.faseId === f.id)!._sum.valorePrevisto })) };
  }, { isolationLevel: "RepeatableRead" });
}
