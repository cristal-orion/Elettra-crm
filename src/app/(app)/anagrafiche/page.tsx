import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireAnagrafiche, etichettaTitolo } from "@/lib/enums";
import { CodiceBadge } from "@/components/badges";
import type { Prisma } from "@/generated/prisma";

export const metadata = { title: "Anagrafiche — CRM Elettra" };

export default async function AnagrafichePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const tipo = sp.tipo === "cliente" || sp.tipo === "fornitore" ? sp.tipo : null;

  const user = await getCurrentUser();
  const puoCreare = user ? puoGestireAnagrafiche(user.ruolo) : false;

  const where: Prisma.AnagraficaWhereInput = {};
  if (tipo === "cliente") where.isCliente = true;
  if (tipo === "fornitore") where.isFornitore = true;
  if (q) {
    where.OR = [
      { ragioneSociale: { contains: q } },
      { codiceCliente: { contains: q } },
      { codiceFornitore: { contains: q } },
      { partitaIva: { contains: q } },
      { localita: { contains: q } },
    ];
  }

  const anagrafiche = await prisma.anagrafica.findMany({
    where,
    orderBy: { ragioneSociale: "asc" },
    include: {
      referenti: { orderBy: { principale: "desc" }, take: 1 },
      _count: { select: { commesse: true } },
    },
  });

  const filtro = (value: string | null, label: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (value) params.set("tipo", value);
    const href = `/anagrafiche${params.toString() ? `?${params}` : ""}`;
    const active = tipo === value;
    return (
      <Link
        href={href}
        className={`rounded-full px-3 py-1.5 text-sm transition ${
          active
            ? "bg-brand text-white"
            : "border border-line bg-panel text-ink-soft hover:border-brand/40"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
            Anagrafiche
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Clienti e fornitori
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {anagrafiche.length} risultati
          </p>
        </div>
        {puoCreare && (
          <Link
            href="/anagrafiche/nuova"
            className="rounded-lg bg-elettra px-4 py-2.5 text-sm font-semibold text-white transition"
          >
            + Nuova anagrafica
          </Link>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <form method="get" className="flex flex-1 gap-2">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Cerca per nome, codice, P.IVA, località…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3.5 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="submit"
            className="rounded-lg border border-line bg-panel px-4 py-2 text-sm text-ink-soft hover:border-brand/40"
          >
            Cerca
          </button>
        </form>
        <div className="flex gap-2">
          {filtro(null, "Tutti")}
          {filtro("cliente", "Clienti")}
          {filtro("fornitore", "Fornitori")}
        </div>
      </div>

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
                <tr key={a.id} className="border-t border-line hover:bg-paper/50">
                  <td className="px-5 py-3">
                    <CodiceBadge
                      codiceCliente={a.codiceCliente}
                      codiceFornitore={a.codiceFornitore}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/anagrafiche/${a.id}`}
                      className="font-medium hover:text-brand-deep"
                    >
                      {a.ragioneSociale}
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
    </div>
  );
}
