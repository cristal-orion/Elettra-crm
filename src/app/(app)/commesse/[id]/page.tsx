import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import {
  puoGestireCommesse,
  puoGestireOrdini,
  etichettaTitolo,
  etichettaStato,
  METODI_RICEZIONE,
} from "@/lib/enums";
import { formatEuro, formatDate, toNumber } from "@/lib/format";
import { StatoBadge, StatoOrdineBadge, TipologiaBadge } from "@/components/badges";

export default async function CommessaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const commessa = await prisma.commessa.findUnique({
    where: { id },
    include: {
      cliente: true,
      pm: true,
      referente: true,
      ordiniFornitore: {
        orderBy: { data: "desc" },
        include: {
          fornitore: true,
          righe: { select: { imponibile: true } },
        },
      },
      documenti: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!commessa) notFound();

  const user = await getCurrentUser();
  const puoModificare = user ? puoGestireCommesse(user.ruolo) : false;
  const puoAddOrdine = user ? puoGestireOrdini(user.ruolo) : false;

  const referente = commessa.referente
    ? `${etichettaTitolo(commessa.referente.titolo)} ${commessa.referente.nome} ${commessa.referente.cognome}`.trim()
    : null;

  const metodo = commessa.metodoRicezioneOrdine
    ? (METODI_RICEZIONE as Record<string, string>)[
        commessa.metodoRicezioneOrdine
      ] ?? commessa.metodoRicezioneOrdine
    : null;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/commesse"
            className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
          >
            ← Commesse
          </Link>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold tracking-tight">
            <span className="font-mono tabular-nums">{commessa.numero}</span>
            <StatoBadge stato={commessa.stato} />
            <TipologiaBadge tipologia={commessa.tipologia} />
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {commessa.descrizione ?? "Senza descrizione"}
          </p>
        </div>
        {puoModificare && (
          <Link
            href={`/commesse/${commessa.id}/modifica`}
            className="rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand/40"
          >
            Modifica
          </Link>
        )}
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Cliente e assegnazione">
          <Row
            label="Cliente"
            value={commessa.cliente.ragioneSociale}
            href={`/anagrafiche/${commessa.clienteId}`}
          />
          <Row label="Referente" value={referente} />
          <Row
            label="Project Manager"
            value={
              commessa.pm ? `${commessa.pm.nome} ${commessa.pm.cognome}` : null
            }
          />
          <Row label="Rif. commerciale" value={commessa.referenteCommerciale} />
        </Card>

        <Card title="Offerta">
          <Row label="Stato" value={etichettaStato(commessa.stato)} />
          <Row label="Data richiesta" value={formatDate(commessa.dataRichiesta)} />
          <Row label="Data invio" value={formatDate(commessa.dataInvio)} />
          <Row
            label="Importo offerta"
            value={commessa.importoOfferta ? formatEuro(commessa.importoOfferta) : null}
            mono
          />
        </Card>

        <Card title="Ordine">
          <Row
            label="Importo ordine"
            value={commessa.importoOrdine ? formatEuro(commessa.importoOrdine) : null}
            mono
          />
          <Row label="Data ordine" value={formatDate(commessa.dataOrdine)} />
          <Row label="Ricezione" value={metodo} />
        </Card>

        {commessa.stato === "PERSA" && (
          <Card title="Offerta persa">
            <Row label="Motivazione" value={commessa.motivazionePersa} />
          </Card>
        )}
      </div>

      {/* Ordini a fornitore */}
      <section className="rounded-xl border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold">
            Ordini a fornitore{" "}
            <span className="font-normal text-ink-faint">
              ({commessa.ordiniFornitore.length})
            </span>
          </h2>
          {puoAddOrdine && (
            <Link
              href={`/ordini/nuovo?commessa=${commessa.id}`}
              className="rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand-deep transition hover:bg-brand-soft"
            >
              + Nuovo ordine
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="px-6 py-3 font-medium">Numero</th>
                <th className="px-4 py-3 font-medium">Fornitore</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-6 py-3 text-right font-medium">Imponibile</th>
              </tr>
            </thead>
            <tbody>
              {commessa.ordiniFornitore.map((o) => (
                <tr key={o.id} className="border-t border-line hover:bg-paper/50">
                  <td className="px-6 py-3">
                    <Link
                      href={`/ordini/${o.id}`}
                      className="font-mono tabular-nums font-medium hover:text-brand-deep"
                    >
                      {o.numero ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{o.fornitore.ragioneSociale}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {formatDate(o.data)}
                  </td>
                  <td className="px-4 py-3">
                    <StatoOrdineBadge stato={o.stato} />
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">
                    {formatEuro(
                      o.righe.reduce((acc, r) => acc + toNumber(r.imponibile), 0),
                    )}
                  </td>
                </tr>
              ))}
              {commessa.ordiniFornitore.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-center text-ink-faint">
                    Nessun ordine a fornitore collegato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Documenti */}
      <section className="rounded-xl border border-line bg-panel p-6">
        <h2 className="text-sm font-semibold">
          Documenti{" "}
          <span className="font-normal text-ink-faint">
            ({commessa.documenti.length})
          </span>
        </h2>
        {commessa.documenti.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">
            Nessun documento allegato.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {commessa.documenti.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="truncate text-sm">{d.nomeFile}</span>
                <span className="shrink-0 font-mono text-xs text-ink-faint">
                  {formatDate(d.createdAt)}
                </span>
              </li>
            ))}
          </ul>
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
