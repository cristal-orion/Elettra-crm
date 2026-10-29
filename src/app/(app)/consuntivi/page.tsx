import Link from "next/link";
import { requireEconomia } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { periodoConsuntivi } from "@/lib/dashboard";
import { formatDate, formatEuro } from "@/lib/format";
import ListPagination from "@/components/list-pagination";

export default async function ConsuntiviPage({ searchParams }: { searchParams: Promise<{ periodo?: string; pagina?: string }> }) {
  await requireEconomia(); const sp = await searchParams; const range = periodoConsuntivi(sp.periodo);
  const where = { data: range.date };
  const total = await prisma.consuntivo.count({ where }); const pages = Math.max(1, Math.ceil(total / 25)); const page = Math.min(pages, Math.max(1, parseInt(sp.pagina ?? "1", 10) || 1));
  const rows = await prisma.consuntivo.findMany({ where, take: 25, skip: (page - 1) * 25, orderBy: [{ data: "desc" }, { id: "asc" }], include: { commessa: { select: { numero: true, descrizione: true } }, cliente: { select: { ragioneSociale: true } } } });
  return <div className="space-y-6"><header><Link href={`/?periodo=${range.periodo}`} className="inline-flex min-h-11 items-center text-sm text-brand-deep underline">← Cruscotto</Link><h1 className="mt-2 text-2xl font-semibold">Consuntivi ore e materiali</h1><p className="mt-2 text-sm text-ink-soft">{total} rendiconti · {range.periodo === "tutti" ? "Tutto lo storico" : `Ultimi ${range.periodo} giorni`}, per data del lavoro.</p></header><section className="overflow-x-auto rounded-xl border border-line bg-panel"><table className="w-full text-left text-sm"><thead><tr>{["Commessa / cliente", "Data", "Manodopera", "Materiali", "Totale"].map((h) => <th key={h} className="whitespace-nowrap p-4 font-medium text-ink-soft">{h}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-t border-line"><td className="p-4"><Link href={`/commesse/${r.commessaId}/consuntivo`} className="font-semibold text-brand-deep underline">{r.commessa.numero}</Link><p className="mt-1 text-xs text-ink-soft">{r.cliente.ragioneSociale}</p></td><td className="whitespace-nowrap p-4">{formatDate(r.data)}</td>{[r.totaleOre, r.totaleMateriali, r.totale].map((v, i) => <td key={i} className="whitespace-nowrap p-4 tabular-nums">{formatEuro(v)}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="p-6 text-sm text-ink-soft">Nessun rendiconto in questo periodo. Apri una commessa per registrare ore e materiali.</p>}</section><ListPagination path="/consuntivi" params={sp} page={page} pages={pages} /></div>;
}
