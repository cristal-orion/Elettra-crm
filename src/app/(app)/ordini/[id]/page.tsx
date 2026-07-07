import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireOrdini, etichettaStatoOrdine } from "@/lib/enums";
import { formatEuro, formatDate, toNumber } from "@/lib/format";
import { StatoOrdineBadge } from "@/components/badges";

/** Quantità in formato it-IT, senza decimali superflui. */
const qtaFmt = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 });

export default async function OrdineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ordine = await prisma.ordineFornitore.findUnique({
    where: { id },
    include: {
      fornitore: true,
      commessa: { include: { cliente: true } },
      righe: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!ordine) notFound();

  const user = await getCurrentUser();
  const puoModificare = user ? puoGestireOrdini(user.ruolo) : false;

  const totali = ordine.righe.reduce(
    (acc, r) => {
      const imp = toNumber(r.imponibile);
      acc.imponibile += imp;
      acc.iva += imp * (toNumber(r.aliquotaIva) / 100);
      return acc;
    },
    { imponibile: 0, iva: 0 },
  );
  const totale = totali.imponibile + totali.iva;

  const conEntrata = ordine.righe.some(
    (r) =>
      r.dataConsegnaPrevista ||
      r.quantitaRicevuta != null ||
      r.ddtNumero ||
      r.ddtData ||
      r.fatturaNumero ||
      r.fatturaData,
  );

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/ordini"
            className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
          >
            ← Ordini
          </Link>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold tracking-tight">
            <span className="font-mono tabular-nums">
              {ordine.numero ?? "Senza numero"}
            </span>
            <StatoOrdineBadge stato={ordine.stato} />
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {ordine.fornitore.ragioneSociale}
          </p>
        </div>
        {puoModificare && (
          <Link
            href={`/ordini/${ordine.id}/modifica`}
            className="rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand/40"
          >
            Modifica
          </Link>
        )}
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Ordine">
          <Row
            label="Fornitore"
            value={ordine.fornitore.ragioneSociale}
            href={`/anagrafiche/${ordine.fornitoreId}`}
          />
          <Row
            label="Commessa"
            value={
              ordine.commessa
                ? `${ordine.commessa.numero} · ${ordine.commessa.cliente.ragioneSociale}`
                : null
            }
            href={ordine.commessa ? `/commesse/${ordine.commessa.id}` : undefined}
          />
          <Row label="Numero" value={ordine.numero} mono />
          <Row label="Data" value={formatDate(ordine.data)} />
          <Row label="Stato" value={etichettaStatoOrdine(ordine.stato)} />
        </Card>

        <Card title="Totali">
          <Row label="Imponibile" value={formatEuro(totali.imponibile)} mono />
          <Row label="IVA" value={formatEuro(totali.iva)} mono />
          <Row label="Totale" value={formatEuro(totale)} mono />
          <Row label="Righe" value={String(ordine.righe.length)} mono />
        </Card>
      </div>

      {/* Righe */}
      <section className="rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold">
            Righe{" "}
            <span className="font-normal text-ink-faint">
              ({ordine.righe.length})
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="px-6 py-3 font-medium">Codice</th>
                <th className="px-4 py-3 font-medium">Descrizione</th>
                <th className="px-4 py-3 font-medium">U.M.</th>
                <th className="px-4 py-3 text-right font-medium">Qtà</th>
                <th className="px-4 py-3 text-right font-medium">Prezzo</th>
                <th className="px-4 py-3 text-right font-medium">Sc.%</th>
                <th className="px-4 py-3 text-right font-medium">IVA%</th>
                <th className="px-6 py-3 text-right font-medium">Imponibile</th>
              </tr>
            </thead>
            <tbody>
              {ordine.righe.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-6 py-3 font-mono text-ink-soft">
                    {r.codiceProdotto ?? "—"}
                  </td>
                  <td className="px-4 py-3">{r.descrizione}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {r.unitaMisura ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {qtaFmt.format(toNumber(r.quantita))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatEuro(r.prezzoUnitario)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-soft">
                    {r.sconto != null ? `${qtaFmt.format(toNumber(r.sconto))}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-soft">
                    {r.aliquotaIva != null
                      ? `${qtaFmt.format(toNumber(r.aliquotaIva))}%`
                      : "—"}
                  </td>
                  <td className="px-6 py-3 text-right font-mono tabular-nums">
                    {formatEuro(r.imponibile)}
                  </td>
                </tr>
              ))}
              {ordine.righe.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-6 text-center text-ink-faint">
                    Nessuna riga.
                  </td>
                </tr>
              )}
            </tbody>
            {ordine.righe.length > 0 && (
              <tfoot>
                <tr className="border-t border-line font-medium">
                  <td colSpan={7} className="px-6 py-3 text-right text-ink-soft">
                    Imponibile · IVA · Totale
                  </td>
                  <td className="px-6 py-3 text-right font-mono tabular-nums">
                    {formatEuro(totali.imponibile)}
                    <span className="text-ink-faint">
                      {" · "}
                      {formatEuro(totali.iva)}
                    </span>
                    <br />
                    {formatEuro(totale)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Entrata merce */}
      <section className="rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold">Entrata merce</h2>
        </div>
        {!conEntrata ? (
          <p className="px-6 py-6 text-sm text-ink-faint">
            Nessuna informazione di consegna registrata.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                  <th className="px-6 py-3 font-medium">Descrizione</th>
                  <th className="px-4 py-3 text-right font-medium">Consegna prev.</th>
                  <th className="px-4 py-3 text-right font-medium">Qtà ric.</th>
                  <th className="px-4 py-3 font-medium">DDT</th>
                  <th className="px-4 py-3 font-medium">Data DDT</th>
                  <th className="px-4 py-3 font-medium">Fattura</th>
                  <th className="px-6 py-3 font-medium">Data fatt.</th>
                </tr>
              </thead>
              <tbody>
                {ordine.righe.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-6 py-3">{r.descrizione}</td>
                    <td className="px-4 py-3 text-right text-ink-soft">
                      {r.dataConsegnaPrevista
                        ? formatDate(r.dataConsegnaPrevista)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.quantitaRicevuta != null
                        ? qtaFmt.format(toNumber(r.quantitaRicevuta))
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-soft">
                      {r.ddtNumero ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {r.ddtData ? formatDate(r.ddtData) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-soft">
                      {r.fatturaNumero ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-ink-soft">
                      {r.fatturaData ? formatDate(r.fatturaData) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <dl className="mt-3 flex flex-col gap-2">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
  href,
  mono,
}: {
  label: string;
  value: string | null;
  href?: string;
  mono?: boolean;
}) {
  const shown = value && value !== "—";
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-sm text-ink-faint">{label}</dt>
      <dd
        className={`text-right text-sm ${mono ? "font-mono" : ""} ${shown ? "text-ink" : "text-ink-faint"}`}
      >
        {shown ? (
          href ? (
            <Link href={href} className="hover:text-brand-deep">
              {value}
            </Link>
          ) : (
            value
          )
        ) : (
          "—"
        )}
      </dd>
    </div>
  );
}
