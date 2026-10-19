import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import {
  puoGestireCommesse,
  STATI_COMMESSA,
  STATI_COMMESSA_LIST,
} from "@/lib/enums";
import { formatEuro } from "@/lib/format";
import { StatoBadge, TipologiaBadge } from "@/components/badges";
import { Prisma } from "@/generated/prisma";
import ListFilters from "@/components/list-filters";
import ListPagination from "@/components/list-pagination";
import { queryText } from "@/lib/list-state";
import { inPageOrder, listSources, searchListPage } from "@/lib/list-search";

export const metadata = { title: "Commesse — CRM Elettra" };

export default async function CommessePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stato?: string; daFatturare?: string; pagina?: string; ordine?: string }>;
}) {
  const sp = await searchParams;
  const q = queryText(sp.q);
  const ordine = sp.ordine === "cliente" || sp.ordine === "numero_asc" ? sp.ordine : "recenti";
  const stato =
    sp.stato && (STATI_COMMESSA_LIST as string[]).includes(sp.stato)
      ? sp.stato
      : null;

  const user = await requireUser();
  const puoCreare = user ? puoGestireCommesse(user.ruolo) : false;

  const pagination = await searchListPage(prisma, listSources.commesse, {
    query: q, page: sp.pagina,
    scope: Prisma.sql`${stato ? Prisma.sql`s.stato = ${stato}` : Prisma.sql`true`} AND ${sp.daFatturare === "1" ? Prisma.sql`s.stato <> 'FATTURATA' AND EXISTS (SELECT 1 FROM "OrdineFornitore" o WHERE o."commessaId" = s.id)` : Prisma.sql`true`}`,
    orderBy: ordine === "cliente" ? Prisma.sql`s."clienteNome" ASC` : ordine === "numero_asc" ? Prisma.sql`s.anno ASC, s.progressivo ASC` : Prisma.sql`s.anno DESC, s.progressivo DESC`,
  });
  const total = pagination.total;
  const commesse = inPageOrder(await prisma.commessa.findMany({
    where: { id: { in: pagination.ids } },
    include: { cliente: true, pm: true },
  }), pagination.ids);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
            Commesse
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Pipeline commerciale
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {total} risultati
          </p>
        </div>
        {puoCreare && (
          <Link
            href="/commesse/nuova"
            className="rounded-lg bg-elettra px-4 py-2.5 text-sm font-semibold text-white transition"
          >
            + Nuova commessa
          </Link>
        )}
      </header>

      <ListFilters q={q} total={total} similar={pagination.similar} placeholder="Numero, descrizione, cliente…" filters={[
        { name: "stato", label: "Stato", value: stato ?? "", options: [{ value: "", label: "Tutti gli stati" }, ...Object.entries(STATI_COMMESSA).map(([value, label]) => ({ value, label }))] },
        { name: "daFatturare", label: "Acquisti", value: sp.daFatturare === "1" ? "1" : "", options: [{ value: "", label: "Tutte le commesse" }, { value: "1", label: "Con acquisti, non fatturate" }] },
        { name: "ordine", label: "Ordina per", value: ordine, defaultValue: "recenti", options: [{ value: "recenti", label: "Numero decrescente" }, { value: "numero_asc", label: "Numero crescente" }, { value: "cliente", label: "Cliente" }] },
      ]} suggestions={commesse.slice(0, 5).map((c) => ({ href: `/commesse/${c.id}`, label: `${c.numero} · ${c.cliente.ragioneSociale}`, type: "Commessa" }))} />

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
              <th className="px-5 py-3 font-medium">Numero</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Descrizione</th>
              <th className="px-4 py-3 font-medium">PM</th>
              <th className="px-4 py-3 font-medium">Stato</th>
              <th className="px-4 py-3 font-medium">Tip.</th>
              <th className="px-6 py-3 text-right font-medium">Offerta</th>
            </tr>
          </thead>
          <tbody>
            {commesse.map((c) => (
              <tr key={c.id} className="relative border-t border-line hover:bg-paper/50 focus-within:bg-brand-soft/50">
                <td className="px-5 py-3">
                  <Link
                    href={`/commesse/${c.id}`}
                    aria-label={`Apri commessa ${c.numero} — ${c.cliente.ragioneSociale}`}
                    className="font-mono tabular-nums font-medium text-brand-deep underline underline-offset-4 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    {c.numero}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.cliente.ragioneSociale}</td>
                <td className="max-w-xs truncate px-4 py-3 text-ink-soft">
                  {c.descrizione ?? "—"}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {c.pm ? `${c.pm.nome} ${c.pm.cognome}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatoBadge stato={c.stato} />
                </td>
                <td className="px-4 py-3">
                  <TipologiaBadge tipologia={c.tipologia} />
                </td>
                <td className="px-6 py-3 text-right tabular-nums">
                  {c.importoOfferta ? formatEuro(c.importoOfferta) : "—"}
                </td>
              </tr>
            ))}
            {commesse.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-ink-faint">
                  Nessuna commessa trovata.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ListPagination path="/commesse" params={sp} page={pagination.page} pages={pagination.pages} />
    </div>
  );
}
