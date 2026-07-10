import Link from "next/link";
import { formatEuro, formatDate } from "@/lib/format";
import { getStoricoMateriali, type MaterialeStorico } from "./data";

export const metadata = { title: "Materiali · Storico prezzi — CRM Elettra" };

export default async function MaterialiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const materiali = await getStoricoMateriali(q);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
          Acquisti
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Materiali · Storico prezzi
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {materiali.length} material{materiali.length === 1 ? "e" : "i"} ·
          prezzo netto (sconto incluso) derivato dalle righe d&apos;ordine
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cerca materiale per descrizione o codice… (es. cavo 3G2,5)"
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3.5 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="submit"
          className="rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white transition"
        >
          Cerca
        </button>
        {q && (
          <Link
            href="/materiali"
            className="rounded-lg border border-line bg-panel px-4 py-2 text-sm text-ink-soft hover:border-brand/40"
          >
            Azzera
          </Link>
        )}
      </form>

      {materiali.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-ink-faint">
          {q
            ? `Nessun materiale trovato per «${q}».`
            : "Nessun acquisto registrato: lo storico si popola dalle righe degli ordini a fornitore."}
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {materiali.map((m) => (
            <MaterialeCard key={m.key} m={m} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MaterialeCard({ m }: { m: MaterialeStorico }) {
  return (
    <li className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {m.codiceProdotto && (
              <span className="rounded-md bg-brand-soft px-2 py-0.5 font-mono text-[11px] text-brand-deep">
                {m.codiceProdotto}
              </span>
            )}
            {m.unitaMisura && (
              <span className="font-mono text-[11px] text-ink-faint">
                €/{m.unitaMisura}
              </span>
            )}
          </div>
          <h2 className="mt-1 text-sm font-semibold">{m.descrizione}</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Ultimo acquisto {formatDate(m.ultimaData)} · {m.ultimoFornitore}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            Ultimo prezzo
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">
            {formatEuro(m.ultimoPrezzo)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
        <MiniStat label="Min" value={formatEuro(m.prezzoMin)} />
        <MiniStat label="Medio" value={formatEuro(m.prezzoMedio)} />
        <MiniStat label="Max" value={formatEuro(m.prezzoMax)} />
        <MiniStat label="Acquisti" value={String(m.nAcquisti)} />
      </div>

      <details className="border-t border-line">
        <summary className="cursor-pointer list-none px-5 py-3 text-xs font-medium text-brand-deep transition hover:bg-paper/50">
          Mostra storico ({m.nAcquisti})
        </summary>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="px-5 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Ordine</th>
                <th className="px-4 py-2.5 font-medium">Fornitore</th>
                <th className="px-4 py-2.5 font-medium">Commessa</th>
                <th className="px-4 py-2.5 text-right font-medium">Q.tà</th>
                <th className="px-4 py-2.5 text-right font-medium">Prezzo</th>
                <th className="px-4 py-2.5 text-right font-medium">Sconto</th>
                <th className="px-5 py-2.5 text-right font-medium">Netto</th>
              </tr>
            </thead>
            <tbody>
              {m.acquisti.map((a, i) => (
                <tr
                  key={`${a.ordineId}-${i}`}
                  className="border-t border-line hover:bg-paper/50"
                >
                  <td className="px-5 py-2.5 text-ink-soft">
                    {formatDate(a.data)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/ordini/${a.ordineId}`}
                      className="font-mono tabular-nums hover:text-brand-deep"
                    >
                      {a.numeroOrdine ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{a.fornitore}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-ink-soft">
                    {a.commessaNumero && a.commessaId ? (
                      <Link
                        href={`/commesse/${a.commessaId}`}
                        className="hover:text-brand-deep"
                      >
                        {a.commessaNumero}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {a.quantita}
                    {a.unitaMisura ? ` ${a.unitaMisura}` : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-soft">
                    {formatEuro(a.prezzoUnitario)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-soft">
                    {a.sconto ? `${a.sconto}%` : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-right font-medium tabular-nums">
                    {formatEuro(a.prezzoNetto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </li>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}
