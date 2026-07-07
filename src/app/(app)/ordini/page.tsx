import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireOrdini, STATI_ORDINE, STATI_ORDINE_LIST } from "@/lib/enums";
import { formatEuro, formatDate, toNumber } from "@/lib/format";
import { StatoOrdineBadge } from "@/components/badges";
import type { Prisma } from "@/generated/prisma";

export const metadata = { title: "Ordini a fornitore — CRM Elettra" };

export default async function OrdiniPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stato?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const stato =
    sp.stato && (STATI_ORDINE_LIST as string[]).includes(sp.stato)
      ? sp.stato
      : null;

  const user = await getCurrentUser();
  const puoCreare = user ? puoGestireOrdini(user.ruolo) : false;

  const where: Prisma.OrdineFornitoreWhereInput = {};
  if (stato) where.stato = stato;
  if (q) {
    where.OR = [
      { numero: { contains: q } },
      { fornitore: { ragioneSociale: { contains: q } } },
      { commessa: { numero: { contains: q } } },
    ];
  }

  const ordini = await prisma.ordineFornitore.findMany({
    where,
    orderBy: { data: "desc" },
    include: {
      fornitore: { select: { ragioneSociale: true } },
      commessa: { select: { id: true, numero: true } },
      righe: { select: { imponibile: true } },
    },
  });

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
          <p className="mt-1 text-sm text-ink-soft">{ordini.length} risultati</p>
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

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cerca per numero, fornitore, commessa…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3.5 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <select
          name="stato"
          defaultValue={stato ?? ""}
          className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-soft outline-none focus:border-brand"
        >
          <option value="">Tutti gli stati</option>
          {Object.entries(STATI_ORDINE).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-line bg-panel px-4 py-2 text-sm text-ink-soft hover:border-brand/40"
        >
          Filtra
        </button>
      </form>

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
              <tr key={o.id} className="border-t border-line hover:bg-paper/50">
                <td className="px-5 py-3">
                  <Link
                    href={`/ordini/${o.id}`}
                    className="font-mono tabular-nums font-medium hover:text-brand-deep"
                  >
                    {o.numero ?? "—"}
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
    </div>
  );
}
