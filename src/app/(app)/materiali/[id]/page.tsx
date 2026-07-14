import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireCatalogo } from "@/lib/enums";
import { formatEuro, formatDate } from "@/lib/format";
import { getProdottoConStorico } from "../catalogo";
import EliminaMateriale from "../elimina-materiale";

export default async function MaterialeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { prodotto, storico } = await getProdottoConStorico(id);
  if (!prodotto) notFound();

  const user = await getCurrentUser();
  const puoGestire = user ? puoGestireCatalogo(user.ruolo) : false;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/materiali"
            className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
          >
            ← Catalogo materiali
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {prodotto.descrizione}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            {prodotto.codice && (
              <span className="rounded-md bg-brand-soft px-2 py-0.5 font-mono text-brand-deep">
                {prodotto.codice}
              </span>
            )}
            {prodotto.marca && (
              <span className="rounded-full bg-lead-soft px-2.5 py-0.5 text-ink-soft">
                {prodotto.marca}
              </span>
            )}
            {prodotto.categoria && (
              <span className="rounded-full bg-lead-soft px-2.5 py-0.5 text-ink-soft">
                {prodotto.categoria}
              </span>
            )}
          </div>
        </div>
        {puoGestire && (
          <div className="flex items-center gap-2">
            <Link
              href={`/materiali/${prodotto.id}/modifica`}
              className="rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand/40"
            >
              Modifica
            </Link>
            <EliminaMateriale id={prodotto.id} />
          </div>
        )}
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold">Anagrafica</h2>
          <dl className="mt-3 flex flex-col gap-2">
            <Row label="Codice" value={prodotto.codice} mono />
            <Row label="Marca" value={prodotto.marca} />
            <Row label="Categoria" value={prodotto.categoria} />
            <Row label="Unità di misura" value={prodotto.unitaMisura} />
            <Row
              label="Prezzo di listino"
              value={prodotto.prezzoListino ? formatEuro(prodotto.prezzoListino) : null}
            />
          </dl>
          {prodotto.schedaPercorso && (
            <a
              href={`/materiali/scheda/${prodotto.id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand/40 px-3 py-2 text-sm font-medium text-brand-deep transition hover:bg-brand-soft"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                <path
                  fill="currentColor"
                  d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6Zm7 1.5L18.5 9H13V3.5ZM8 13h8v1.5H8V13Zm0 3h8v1.5H8V16Z"
                />
              </svg>
              Apri scheda tecnica
              <span className="font-normal text-ink-faint">
                {prodotto.schedaNomeFile}
              </span>
            </a>
          )}
        </div>

        <div className="rounded-xl border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold">Dati tecnici</h2>
          {prodotto.datiTecnici ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">
              {prodotto.datiTecnici}
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink-faint">Nessun dato tecnico.</p>
          )}
          {prodotto.note && (
            <>
              <h3 className="mt-4 text-xs font-mono uppercase tracking-wider text-ink-faint">
                Note
              </h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">
                {prodotto.note}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Storico prezzi agganciato (per codice/descrizione) */}
      <section className="rounded-xl border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold">Storico prezzi acquisti</h2>
          <Link
            href="/materiali/prezzi"
            className="font-mono text-xs text-brand-deep hover:underline"
          >
            tutto lo storico →
          </Link>
        </div>

        {storico ? (
          <>
            <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
              <MiniStat label="Ultimo" value={formatEuro(storico.ultimoPrezzo)} />
              <MiniStat label="Min" value={formatEuro(storico.prezzoMin)} />
              <MiniStat label="Medio" value={formatEuro(storico.prezzoMedio)} />
              <MiniStat label="Max" value={formatEuro(storico.prezzoMax)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                    <th className="px-6 py-2.5 font-medium">Data</th>
                    <th className="px-4 py-2.5 font-medium">Fornitore</th>
                    <th className="px-4 py-2.5 font-medium">Commessa</th>
                    <th className="px-4 py-2.5 text-right font-medium">Q.tà</th>
                    <th className="px-6 py-2.5 text-right font-medium">Netto</th>
                  </tr>
                </thead>
                <tbody>
                  {storico.acquisti.map((a, i) => (
                    <tr key={`${a.ordineId}-${i}`} className="border-t border-line">
                      <td className="px-6 py-2.5 text-ink-soft">
                        {formatDate(a.data)}
                      </td>
                      <td className="px-4 py-2.5">{a.fornitore}</td>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-ink-soft">
                        {a.commessaNumero ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {a.quantita}
                        {a.unitaMisura ? ` ${a.unitaMisura}` : ""}
                      </td>
                      <td className="px-6 py-2.5 text-right font-medium tabular-nums">
                        {formatEuro(a.prezzoNetto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="px-6 py-6 text-sm text-ink-faint">
            Nessun acquisto collegato. Lo storico si popola dalle righe degli
            ordini a fornitore con lo stesso{" "}
            {prodotto.codice ? "codice" : "nome"} del materiale.
          </p>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-sm text-ink-faint">{label}</dt>
      <dd
        className={`text-right text-sm ${mono ? "font-mono" : ""} ${value ? "text-ink" : "text-ink-faint"}`}
      >
        {value || "—"}
      </dd>
    </div>
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
