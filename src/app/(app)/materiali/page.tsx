import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireCatalogo } from "@/lib/enums";
import { formatEuro } from "@/lib/format";
import { getProdotti } from "./catalogo";

export const metadata = { title: "Catalogo materiali — CRM Elettra" };

export default async function MaterialiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const [prodotti, user] = await Promise.all([getProdotti(q), getCurrentUser()]);
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
            {prodotti.length} material{prodotti.length === 1 ? "e" : "i"} a
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

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cerca per descrizione, codice, marca o categoria…"
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

      {prodotti.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-ink-faint">
          {q ? (
            `Nessun materiale trovato per «${q}».`
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
                <tr key={p.id} className="border-t border-line hover:bg-paper/50">
                  <td className="px-5 py-3 font-mono text-xs text-ink-soft">
                    {p.codice ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/materiali/${p.id}`}
                      className="font-medium hover:text-brand-deep"
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
    </div>
  );
}
