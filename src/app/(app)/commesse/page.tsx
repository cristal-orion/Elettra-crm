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
import type { Prisma } from "@/generated/prisma";

export const metadata = { title: "Commesse — CRM Elettra" };

export default async function CommessePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stato?: string; daFatturare?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const stato =
    sp.stato && (STATI_COMMESSA_LIST as string[]).includes(sp.stato)
      ? sp.stato
      : null;

  const user = await requireUser();
  const puoCreare = user ? puoGestireCommesse(user.ruolo) : false;

  const where: Prisma.CommessaWhereInput = {};
  if (stato) where.stato = stato;
  if (sp.daFatturare === "1") { where.AND = [{ stato: { not: "FATTURATA" } }, { ordiniFornitore: { some: {} } }]; }
  if (q) {
    where.OR = [
      { numero: { contains: q } },
      { descrizione: { contains: q } },
      { cliente: { ragioneSociale: { contains: q } } },
    ];
  }

  const commesse = await prisma.commessa.findMany({
    where,
    orderBy: [{ anno: "desc" }, { progressivo: "desc" }],
    include: { cliente: true, pm: true },
  });

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
            {commesse.length} risultati
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

      <form method="get" className="flex flex-wrap items-center gap-2">
        {sp.daFatturare === "1" && <input type="hidden" name="daFatturare" value="1" />}
        <input
          aria-label="Cerca commesse"
          name="q"
          defaultValue={q}
          placeholder="Cerca per numero, descrizione, cliente…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3.5 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <select
          aria-label="Stato commessa"
          name="stato"
          defaultValue={stato ?? ""}
          className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-soft outline-none focus:border-brand"
        >
          <option value="">Tutti gli stati</option>
          {Object.entries(STATI_COMMESSA).map(([key, label]) => (
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
      {sp.daFatturare === "1" && <p className="text-sm text-warn">Commesse con acquisti collegati e non ancora fatturate. <Link href="/commesse" className="underline">Rimuovi filtro</Link></p>}

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
              <tr key={c.id} className="border-t border-line hover:bg-paper/50">
                <td className="px-5 py-3">
                  <Link
                    href={`/commesse/${c.id}`}
                    className="font-mono tabular-nums font-medium hover:text-brand-deep"
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
    </div>
  );
}
