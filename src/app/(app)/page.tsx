import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { formatEuro, toNumber } from "@/lib/format";
import { etichettaStato, STATI_COMMESSA_LIST } from "@/lib/enums";
import { StatoBadge, TipologiaBadge } from "@/components/badges";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Regola P→C: commesse con materiale acquistato ma non ancora fatturato.
  const daFatturareWhere = {
    stato: { not: "FATTURATA" },
    ordiniFornitore: { some: {} },
  } as const;

  const [
    clienti,
    fornitori,
    commesseTotali,
    pending,
    sums,
    perStato,
    recenti,
    daFatturareCount,
    daFatturare,
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
    prisma.commessa.count({ where: daFatturareWhere }),
    prisma.commessa.findMany({
      where: daFatturareWhere,
      take: 8,
      orderBy: { updatedAt: "desc" },
      include: {
        cliente: true,
        _count: { select: { ordiniFornitore: true } },
      },
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

      {/* Alert regola P→C: materiale acquistato ma non ancora fatturato */}
      {daFatturareCount > 0 && (
        <section className="rounded-xl border border-warn/40 bg-warn-soft/50">
          <div className="flex items-center gap-2.5 border-b border-warn/30 px-6 py-4">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-warn" aria-hidden>
              <path
                fill="currentColor"
                d="M12 2 1 21h22L12 2Zm0 6a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm0 9.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"
              />
            </svg>
            <div>
              <h2 className="text-sm font-semibold text-warn">
                Da fatturare — materiale già acquistato
              </h2>
              <p className="text-xs text-ink-soft">
                {daFatturareCount} commesse con ordini a fornitore collegati (regola P→C)
              </p>
            </div>
          </div>
          <ul className="divide-y divide-warn/20">
            {daFatturare.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/commesse/${c.id}`}
                  className="flex items-center gap-3 px-6 py-3 text-sm transition hover:bg-warn-soft/60"
                >
                  <span className="font-mono tabular-nums font-medium">
                    {c.numero}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-soft">
                    {c.cliente.ragioneSociale}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-ink-faint">
                    {c._count.ordiniFornitore} ordini
                  </span>
                  <StatoBadge stato={c.stato} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
          <Link
            href="/commesse"
            className="text-sm text-brand-deep underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          >
            Tutte le commesse →
          </Link>
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
                <tr
                  key={c.id}
                  className="relative border-t border-line transition hover:bg-paper/70 focus-within:bg-brand-soft/50"
                >
                  <td className="px-6 py-3 font-mono tabular-nums">
                    <Link
                      href={`/commesse/${c.id}`}
                      aria-label={`Apri commessa ${c.numero} — ${c.cliente.ragioneSociale}`}
                      className="font-medium text-brand-deep underline decoration-brand/30 underline-offset-4 after:absolute after:inset-0 hover:decoration-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                    >
                      {c.numero}
                    </Link>
                  </td>
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
