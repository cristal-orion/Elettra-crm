import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { puoGestireCatalogo } from "@/lib/enums";
import { formatEuro } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";
import ListFilters from "@/components/list-filters";
import ListPagination from "@/components/list-pagination";
import { queryText } from "@/lib/list-state";
import { inPageOrder, listSources, searchListPage } from "@/lib/list-search";

export const metadata = { title: "Catalogo materiali — CRM Elettra" };

export default async function MaterialiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string; scheda?: string }>;
}) {
  const sp = await searchParams;
  const q = queryText(sp.q);
  const scheda = sp.scheda === "presente" || sp.scheda === "assente" ? sp.scheda : "";
  const user = await requireUser();
  const pagination = await searchListPage(prisma, listSources.materiali, {
    query: q, page: sp.pagina, orderBy: Prisma.sql`s.descrizione ASC`,
    scope: scheda === "presente" ? Prisma.sql`s."schedaPercorso" IS NOT NULL` : scheda === "assente" ? Prisma.sql`s."schedaPercorso" IS NULL` : undefined,
  });
  const prodotti = inPageOrder(await prisma.prodotto.findMany({ where: { id: { in: pagination.ids } }, include: { _count: { select: { righeOrdine: true } } } }), pagination.ids);
  const puoGestire = user ? puoGestireCatalogo(user.ruolo) : false;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
            Acquisti
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Catalogo materiali
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {pagination.total} material{pagination.total === 1 ? "e" : "i"} a
            catalogo ·{" "}
            <Link href="/materiali/prezzi" className="text-brand-deep hover:underline">
              storico prezzi acquisti →
            </Link>
          </p>
        </div>
        {puoGestire && (
          <Link
            href="/materiali/nuovo"
            className="rounded-lg bg-elettra px-4 py-2.5 text-sm font-semibold text-white transition"
          >
            + Nuovo materiale
          </Link>
        )}
      </header>

      <ListFilters q={q} total={pagination.total} similar={pagination.similar} placeholder="Descrizione, codice, marca o categoria…" filters={[
        { name: "scheda", label: "Scheda tecnica", value: scheda, options: [{ value: "", label: "Tutti i materiali" }, { value: "presente", label: "Con scheda tecnica" }, { value: "assente", label: "Senza scheda tecnica" }] },
      ]} />

      {prodotti.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-ink-faint">
          {q || scheda ? (
            "Nessun materiale corrisponde ai filtri selezionati."
          ) : (
            <>
              Il catalogo è vuoto. Aggiungi il primo materiale con{" "}
              <Link href="/materiali/nuovo" className="text-brand-deep underline">
                + Nuovo materiale
              </Link>{" "}
              (a mano o caricando la scheda tecnica).
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="px-5 py-3 font-medium">Codice</th>
                <th className="px-4 py-3 font-medium">Descrizione</th>
                <th className="px-4 py-3 font-medium">Marca</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 text-right font-medium">Listino</th>
                <th className="px-5 py-3 text-right font-medium">Acquisti</th>
              </tr>
            </thead>
            <tbody>
              {prodotti.map((p) => (
                <tr key={p.id} className="relative border-t border-line hover:bg-paper/50 focus-within:bg-brand-soft/50">
                  <td className="px-5 py-3 font-mono text-xs text-ink-soft">
                    {p.codice ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/materiali/${p.id}`}
                      className="font-medium text-brand-deep underline underline-offset-4 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      {p.descrizione}
                    </Link>
                    {p.schedaPercorso && (
                      <span
                        className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] text-brand-deep"
                        title="Scheda tecnica allegata"
                      >
                        PDF
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{p.marca ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{p.categoria ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-soft">
                    {p.prezzoListino ? formatEuro(p.prezzoListino) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-ink-soft">
                    {p._count.righeOrdine}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ListPagination path="/materiali" params={sp} page={pagination.page} pages={pagination.pages} />
    </div>
  );
}
