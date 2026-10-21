import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireAnagrafiche, etichettaTitolo } from "@/lib/enums";
import { CodiceBadge } from "@/components/badges";
import { Prisma } from "@/generated/prisma";
import ListFilters from "@/components/list-filters";
import ListPagination from "@/components/list-pagination";
import { queryText } from "@/lib/list-state";
import { inPageOrder, listSources, searchListPage } from "@/lib/list-search";

export const metadata = { title: "Anagrafiche — CRM Elettra" };

export default async function AnagrafichePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; pagina?: string; ordine?: string }>;
}) {
  const sp = await searchParams;
  const q = queryText(sp.q);
  const ordine = sp.ordine === "nome_desc" ? sp.ordine : "nome";
  const tipo = sp.tipo === "cliente" || sp.tipo === "fornitore" || sp.tipo === "prospect" ? sp.tipo : null;

  const user = await getCurrentUser();
  const puoCreare = user ? puoGestireAnagrafiche(user.ruolo) : false;

  const pagination = await searchListPage(prisma, listSources.anagrafiche, {
    query: q, page: sp.pagina,
    scope: tipo === "cliente" ? Prisma.sql`s."isCliente" = true` : tipo === "fornitore" ? Prisma.sql`s."isFornitore" = true` : tipo === "prospect" ? Prisma.sql`s."isProspect" = true` : undefined,
    orderBy: ordine === "nome_desc" ? Prisma.sql`s."ragioneSociale" DESC` : Prisma.sql`s."ragioneSociale" ASC`,
  });
  const total = pagination.total;

  const anagrafiche = inPageOrder(await prisma.anagrafica.findMany({
    where: { id: { in: pagination.ids } },
    include: {
      referenti: { orderBy: { principale: "desc" }, take: 1 },
      _count: { select: { commesse: true } },
    },
  }), pagination.ids);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
            Anagrafiche
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Clienti, potenziali clienti e fornitori
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {total} risultati
          </p>
        </div>
        {puoCreare && (
          <div className="flex items-center gap-2">
            <Link
              href="/anagrafiche/da-visura"
              className="rounded-lg border border-brand/40 px-4 py-2.5 text-sm font-medium text-brand-deep transition hover:bg-brand-soft"
            >
              Da visura
            </Link>
            <Link
              href="/anagrafiche/nuova"
              className="rounded-lg bg-elettra px-4 py-2.5 text-sm font-semibold text-white transition"
            >
              + Nuova anagrafica
            </Link>
          </div>
        )}
      </header>

      <ListFilters q={q} total={total} similar={pagination.similar} placeholder="Nome, codice, P.IVA, contatto, località…" filters={[
        { name: "tipo", label: "Tipo", value: tipo ?? "", options: [{ value: "", label: "Tutte le anagrafiche" }, { value: "cliente", label: "Clienti" }, { value: "prospect", label: "Potenziali clienti" }, { value: "fornitore", label: "Fornitori" }] },
        { name: "ordine", label: "Ordina per", value: ordine, defaultValue: "nome", options: [{ value: "nome", label: "Nome A–Z" }, { value: "nome_desc", label: "Nome Z–A" }] },
      ]} suggestions={anagrafiche.slice(0, 5).map((a) => ({ href: `/anagrafiche/${a.id}`, label: a.ragioneSociale, type: [a.isCliente && "Cliente", a.isProspect && "Potenziale cliente", a.isFornitore && "Fornitore"].filter(Boolean).join(" / ") }))} />

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
              <th className="px-5 py-3 font-medium">Codice</th>
              <th className="px-4 py-3 font-medium">Ragione sociale</th>
              <th className="px-4 py-3 font-medium">Località</th>
              <th className="px-4 py-3 font-medium">Referente</th>
              <th className="px-4 py-3 text-right font-medium">Commesse</th>
            </tr>
          </thead>
          <tbody>
            {anagrafiche.map((a) => {
              const ref = a.referenti[0];
              return (
                <tr key={a.id} className="relative border-t border-line hover:bg-paper/50 focus-within:bg-brand-soft/50">
                  <td className="px-5 py-3">
                    <CodiceBadge
                      codiceCliente={a.codiceCliente}
                      codiceFornitore={a.codiceFornitore}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/anagrafiche/${a.id}`}
                      className="font-medium text-brand-deep underline underline-offset-4 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      {a.ragioneSociale}
                      {a.isProspect && <span className="ml-2 text-xs font-normal text-ink-soft">Potenziale cliente</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {a.localita
                      ? `${a.localita}${a.provincia ? ` (${a.provincia})` : ""}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {ref
                      ? `${etichettaTitolo(ref.titolo)} ${ref.nome} ${ref.cognome}`.trim()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-soft">
                    {a._count.commesse}
                  </td>
                </tr>
              );
            })}
            {anagrafiche.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-ink-faint">
                  Nessuna anagrafica trovata.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ListPagination path="/anagrafiche" params={sp} page={pagination.page} pages={pagination.pages} />
    </div>
  );
}
