import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import {
  puoGestireCommesse,
  puoGestireOrdini,
  puoGestireDocumenti,
  etichettaTitolo,
  etichettaStato,
  etichettaCategoria,
  METODI_RICEZIONE,
} from "@/lib/enums";
import { richiedeFatturazione } from "@/lib/regole";
import { avanzamento, isProgetto, statoAvanzamento } from "@/lib/progetti";
import { formatEuro, formatDate, formatBytes, toNumber } from "@/lib/format";
import {
  AvanzamentoBadge,
  StatoBadge,
  StatoOrdineBadge,
  TipologiaBadge,
} from "@/components/badges";
import { BarraAvanzamento } from "@/components/charts";
import { DocumentiUploader, DocDeleteButton } from "../documenti-ui";
import { uploadDocumenti, deleteDocumento } from "../documenti-actions";

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
      milestone: {
        select: { stato: true, ordine: true, titolo: true, dataPianificata: true },
        orderBy: { ordine: "asc" },
      },
      _count: { select: { assegnazioni: true } },
    },
  });

  if (!commessa) notFound();

  const user = await getCurrentUser();
  const puoModificare = user ? puoGestireCommesse(user.ruolo) : false;
  const puoAddOrdine = user ? puoGestireOrdini(user.ruolo) : false;
  const puoDocumenti = user ? puoGestireDocumenti(user.ruolo) : false;

  const referente = commessa.referente
    ? `${etichettaTitolo(commessa.referente.titolo)} ${commessa.referente.nome} ${commessa.referente.cognome}`.trim()
    : null;

  const metodo = commessa.metodoRicezioneOrdine
    ? (METODI_RICEZIONE as Record<string, string>)[
        commessa.metodoRicezioneOrdine
      ] ?? commessa.metodoRicezioneOrdine
    : null;

  // Regola P→C: materiale acquistato ⇒ tipologia forzata a C e "da fatturare".
  const haAcquisti = commessa.ordiniFornitore.length > 0;
  const daFatturare = richiedeFatturazione(commessa.stato, haAcquisti);

  const avanzamentoProgetto = avanzamento(commessa.milestone);

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

      {daFatturare && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-warn/40 bg-warn-soft/60 px-5 py-4"
        >
          <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden>
            <path
              fill="currentColor"
              d="M12 2 1 21h22L12 2Zm0 6a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm0 9.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-warn">
              Materiale già acquistato — commessa da fatturare
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Esistono ordini a fornitore collegati: la tipologia è forzata a{" "}
              <span className="font-mono font-medium">Consuntivo (C)</span>{" "}
              (regola P→C). Sollecita l&apos;ordine al cliente e procedi alla
              fatturazione.
            </p>
          </div>
        </div>
      )}

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

      {/* Progetto di cantiere (Fase 7): compare solo da "Ordine confermato". */}
      {isProgetto(commessa.stato) && (
        <section className="rounded-xl border border-line bg-panel p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2.5 text-sm font-semibold">
              Progetto di cantiere
              <AvanzamentoBadge stato={statoAvanzamento(commessa)} />
            </h2>
            <Link
              href={`/progetti/${commessa.id}`}
              className="text-xs font-medium text-brand-deep hover:underline"
            >
              Apri progetto →
            </Link>
          </div>

          <div className="mt-4 grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <BarraAvanzamento
              percentuale={avanzamentoProgetto.percentuale}
              tono={
                avanzamentoProgetto.totali === 0
                  ? "neutro"
                  : avanzamentoProgetto.tutteCompletate
                    ? "ok"
                    : "brand"
              }
            />
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-soft">
              <div className="flex gap-1.5">
                <dt className="text-ink-faint">Milestone</dt>
                <dd className="tabular-nums">
                  {avanzamentoProgetto.totali === 0
                    ? "—"
                    : `${avanzamentoProgetto.completate}/${avanzamentoProgetto.totali}`}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-ink-faint">Scadenza</dt>
                <dd>{formatDate(commessa.scadenzaLavori)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-ink-faint">Squadra</dt>
                <dd className="tabular-nums">
                  {commessa._count.assegnazioni === 0
                    ? "—"
                    : commessa._count.assegnazioni}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      )}

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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Documenti{" "}
            <span className="font-normal text-ink-faint">
              ({commessa.documenti.length})
            </span>
          </h2>
          <p className="text-xs text-ink-soft">
            Cartella{" "}
            <span className="font-mono text-ink-faint">{commessa.numero}/</span>
          </p>
        </div>

        {puoDocumenti && (
          <div className="mt-4">
            <DocumentiUploader
              action={uploadDocumenti.bind(null, commessa.id)}
            />
          </div>
        )}

        {commessa.documenti.length === 0 ? (
          <p className="mt-4 text-sm text-ink-faint">
            Nessun documento allegato.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {commessa.documenti.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 py-2.5 first:pt-0"
              >
                <span className="shrink-0 rounded-md bg-lead-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                  {etichettaCategoria(d.categoria)}
                </span>
                <a
                  href={`/documenti/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:text-brand-deep"
                >
                  {d.nomeFile}
                </a>
                <span className="hidden shrink-0 font-mono text-xs text-ink-faint sm:inline">
                  {formatBytes(d.dimensione)}
                </span>
                <span className="hidden shrink-0 font-mono text-xs text-ink-faint md:inline">
                  {formatDate(d.createdAt)}
                </span>
                {puoDocumenti && (
                  <DocDeleteButton
                    action={deleteDocumento.bind(null, d.id)}
                    nome={d.nomeFile}
                  />
                )}
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
