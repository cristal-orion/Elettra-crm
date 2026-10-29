import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireEconomia as requireUser } from "@/lib/dal";
import { puoGestireOrdini, STATI_ORDINE, STATI_ORDINE_LIST } from "@/lib/enums";
import { formatEuro, formatDate, toNumber } from "@/lib/format";
import { StatoOrdineBadge } from "@/components/badges";
import { Prisma } from "@/generated/prisma";
import ListFilters from "@/components/list-filters";
import ListPagination from "@/components/list-pagination";
import { queryText } from "@/lib/list-state";
import { inPageOrder, listSources, searchListPage } from "@/lib/list-search";

export const metadata = { title: "Ordini a fornitore — CRM Elettra" };

export default async function OrdiniPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stato?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const q = queryText(sp.q);
  const stato =
    sp.stato && (STATI_ORDINE_LIST as string[]).includes(sp.stato)
      ? sp.stato
      : null;

  const user = await requireUser();
  const puoCreare = user ? puoGestireOrdini(user.ruolo) : false;

  const pagination = await searchListPage(prisma, listSources.ordini, {
    query: q, page: sp.pagina, scope: stato ? Prisma.sql`s.stato = ${stato}` : undefined,
    orderBy: Prisma.sql`s.data DESC`,
  });
  const ordini = inPageOrder(await prisma.ordineFornitore.findMany({
    where: { id: { in: pagination.ids } },
    include: {
      fornitore: { select: { ragioneSociale: true } },
      commessa: { select: { id: true, numero: true } },
      righe: { select: { imponibile: true } },
    },
  }), pagination.ids);

  const totale = (righe: { imponibile: Prisma.Decimal }[]) =>
    righe.reduce((acc, r) => acc + toNumber(r.imponibile), 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
            Ordini
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Ordini a fornitore
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{pagination.total} risultati</p>
        </div>
        {puoCreare && (
          <Link
            href="/ordini/nuovo"
            className="rounded-lg bg-elettra px-4 py-2.5 text-sm font-semibold text-white transition"
          >
            + Nuovo ordine
          </Link>
        )}
      </header>

      <ListFilters q={q} total={pagination.total} similar={pagination.similar} placeholder="Numero, fornitore, commessa…" filters={[
        { name: "stato", label: "Stato", value: stato ?? "", options: [{ value: "", label: "Tutti gli stati" }, ...Object.entries(STATI_ORDINE).map(([value, label]) => ({ value, label }))] },
      ]} />

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
              <th className="px-5 py-3 font-medium">Numero</th>
              <th className="px-4 py-3 font-medium">Fornitore</th>
              <th className="px-4 py-3 font-medium">Commessa</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Stato</th>
              <th className="px-6 py-3 text-right font-medium">Imponibile</th>
            </tr>
          </thead>
          <tbody>
            {ordini.map((o) => (
              <tr key={o.id} className="relative border-t border-line hover:bg-paper/50 focus-within:bg-brand-soft/50">
                <td className="px-5 py-3">
                  <Link
                    href={`/ordini/${o.id}`}
                    className="font-mono tabular-nums font-medium text-brand-deep underline underline-offset-4 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    {o.numero ?? "Ordine senza numero"}
                  </Link>
                </td>
                <td className="px-4 py-3">{o.fornitore.ragioneSociale}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-ink-soft">
                  {o.commessa ? o.commessa.numero : "—"}
                </td>
                <td className="px-4 py-3 text-ink-soft">{formatDate(o.data)}</td>
                <td className="px-4 py-3">
                  <StatoOrdineBadge stato={o.stato} />
                </td>
                <td className="px-6 py-3 text-right tabular-nums">
                  {formatEuro(totale(o.righe))}
                </td>
              </tr>
            ))}
            {ordini.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-faint">
                  Nessun ordine trovato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ListPagination path="/ordini" params={sp} page={pagination.page} pages={pagination.pages} />
    </div>
  );
}
