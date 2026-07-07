import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { formatEuro, formatDate, toNumber } from "@/lib/format";
import { etichettaStato, STATI_COMMESSA_LIST } from "@/lib/enums";
import { StatoBadge, TipologiaBadge } from "@/components/badges";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  const [
    clienti,
    fornitori,
    commesseTotali,
    pending,
    sums,
    perStato,
    recenti,
  ] = await Promise.all([
    prisma.anagrafica.count({ where: { isCliente: true } }),
    prisma.anagrafica.count({ where: { isFornitore: true } }),
    prisma.commessa.count(),
    prisma.commessa.count({
      where: { stato: { in: ["PREVENTIVO", "INVIATA", "IN_FOLLOWUP"] } },
    }),
    prisma.commessa.aggregate({
      _sum: { importoOfferta: true, importoOrdine: true },
    }),
    prisma.commessa.groupBy({ by: ["stato"], _count: { _all: true } }),
    prisma.commessa.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { cliente: true, pm: true },
    }),
  ]);

  const offerto = toNumber(sums._sum.importoOfferta);
  const ordinato = toNumber(sums._sum.importoOrdine);
  const conversione = offerto > 0 ? Math.round((ordinato / offerto) * 100) : 0;

  const conteggioStato = new Map(
    perStato.map((r) => [r.stato, r._count._all]),
  );
  const statiConValori = STATI_COMMESSA_LIST.map((s) => ({
    stato: s,
    n: conteggioStato.get(s) ?? 0,
  })).filter((x) => x.n > 0);
  const maxStato = Math.max(1, ...statiConValori.map((x) => x.n));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
          Cruscotto
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Ciao{user ? `, ${user.nome}` : ""}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Panoramica di anagrafiche, pipeline e conversione.
        </p>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Clienti" value={clienti} href="/anagrafiche?tipo=cliente" />
        <Stat
          label="Fornitori"
          value={fornitori}
          href="/anagrafiche?tipo=fornitore"
        />
        <Stat label="Offerte in pending" value={pending} accent />
        <div className="rounded-xl border border-line bg-panel p-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            Valore offerto
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
            {formatEuro(offerto)}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Ordinato {formatEuro(ordinato)} ·{" "}
            <span className="font-medium text-brand-deep">
              {conversione}% conversione
            </span>
          </p>
        </div>
      </section>

      {/* Pipeline per stato */}
      <section className="rounded-xl border border-line bg-panel p-6">
        <h2 className="text-sm font-semibold">Pipeline per stato</h2>
        <p className="mt-0.5 text-xs text-ink-soft">
          {commesseTotali} commesse totali
        </p>
        <div className="mt-4 flex flex-col gap-2.5">
          {statiConValori.length === 0 && (
            <p className="text-sm text-ink-faint">Nessuna commessa.</p>
          )}
          {statiConValori.map(({ stato, n }) => (
            <div key={stato} className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-sm text-ink-soft">
                {etichettaStato(stato)}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${(n / maxStato) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-sm tabular-nums">
                {n}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Commesse recenti */}
      <section className="rounded-xl border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold">Commesse recenti</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="px-6 py-3 font-medium">Numero</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">PM</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 font-medium">Tip.</th>
                <th className="px-6 py-3 text-right font-medium">Offerta</th>
              </tr>
            </thead>
            <tbody>
              {recenti.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-6 py-3 font-mono tabular-nums">{c.numero}</td>
                  <td className="px-4 py-3">{c.cliente.ragioneSociale}</td>
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
              {recenti.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-ink-faint">
                    Nessuna commessa registrata.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div
      className={`rounded-xl border p-5 transition ${
        accent
          ? "border-brand/30 bg-brand-soft/40"
          : "border-line bg-panel hover:border-brand/40"
      }`}
    >
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
