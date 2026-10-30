import Link from "next/link";
import { commessaScope, puoLeggereEconomia } from "@/lib/access";
import { DetailNavigation } from "@/components/navigation-context";
import AiContextPanel from "@/components/ai/context-panel";
import TaskContext from "@/components/task-context";
import PrintLink from "@/components/print-link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import {
  puoGestireCommesse,
  puoGestireOrdini,
  puoGestireDocumenti,
  etichettaTitolo,
  etichettaStato,
  METODI_RICEZIONE,
  etichettaRuolo,
} from "@/lib/enums";
import { richiedeFatturazione } from "@/lib/regole";
import { avanzamento, isProgetto, statoAvanzamento } from "@/lib/progetti";
import { formatEuro, formatDate, formatDateTime, toNumber } from "@/lib/format";
import {
  AvanzamentoBadge,
  StatoBadge,
  StatoOrdineBadge,
  TipologiaBadge,
} from "@/components/badges";
import { BarraAvanzamento } from "@/components/charts";
import CommessaDocumenti from "@/components/commessa-documenti";
import AvvisiAssegnazioni from "@/components/avvisi-assegnazioni";
import { avvisiAssegnazioni } from "@/lib/assegnazioni";

export default async function CommessaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const commessa = await prisma.commessa.findFirst({
    where: { id, ...commessaScope(user) },
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
        select: { stato: true, ordine: true, titolo: true, dataPianificata: true, dimostrativa: true, durataGiorni: true },
        orderBy: { ordine: "asc" },
      },
      _count: { select: { assegnazioni: true } },
    },
  });

  if (!commessa) notFound();
  if (!puoLeggereEconomia(user)) return <div className="space-y-6"><header><DetailNavigation listPath="/commesse" listLabel="Commesse" currentLabel={commessa.numero} /><h1 className="mt-3 text-2xl font-semibold">Commessa {commessa.numero}</h1><p className="mt-2 text-sm text-ink-soft">{commessa.cliente.ragioneSociale} · {commessa.descrizione}</p></header><StatoBadge stato={commessa.stato} /><section className="rounded-xl border border-line bg-panel p-5"><h2 className="font-semibold">Informazioni operative</h2><p className="mt-3 text-sm">PM: {commessa.pm ? `${commessa.pm.nome} ${commessa.pm.cognome}` : "Da assegnare"}</p><p className="mt-2 text-sm">{commessa.indirizzoCantiere || "Indirizzo cantiere da completare"}</p>{isProgetto(commessa.stato) ? <Link href={`/progetti/${id}`} className="mt-4 inline-flex min-h-12 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white">Apri cantiere, SAL e problemi →</Link> : <p className="mt-4 text-sm text-ink-soft">Il cantiere si apre alla conferma dell’incarico.</p>}</section><TaskContext user={user} commessaId={id} /></div>;
  const confermaIniziale = await prisma.modificaEconomica.findUnique({
    where: { entita_entitaId_versione: { entita: "COMMESSA_CREAZIONE", entitaId: id, versione: 1 } },
    select: { autoreNome: true, autoreRuolo: true, createdAt: true, dopo: true },
  });
  const valoriIniziali = confermaIniziale?.dopo as { importoOfferta?: string; importoOrdine?: string } | undefined;
  const impegni = isProgetto(commessa.stato) && commessa._count.assegnazioni > 0
    ? await prisma.assegnazioneOperaio.findMany({ where: { commessaId: id }, select: { operaioId: true, dal: true, al: true, operaio: { select: { nome: true, cognome: true } } } }) : [];
  const warnings = await avvisiAssegnazioni(prisma, id, impegni.map((a) => ({ ...a, ...a.operaio })));

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
  const [titoloCommessa, ...dettagliCommessa] = (commessa.descrizione?.trim() || "Senza descrizione").split("\n");

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-full sm:basis-0">
          <DetailNavigation listPath="/commesse" listLabel="Commesse" currentLabel={commessa.numero} />
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            <span className="block font-mono text-sm font-medium tracking-normal text-ink-soft tabular-nums">Commessa {commessa.numero}</span>
            <span className="mt-1 block break-words">{titoloCommessa}</span>
          </h1>
          <p className="mt-2 break-words text-sm text-ink-soft">
            Cliente: <Link href={`/anagrafiche/${commessa.clienteId}`} className="font-medium text-brand-deep underline decoration-brand/30 underline-offset-4 hover:decoration-brand">{commessa.cliente.ragioneSociale}</Link>
          </p>
          {dettagliCommessa.length > 0 && <p className="mt-2 whitespace-pre-line break-words text-sm text-ink-soft">{dettagliCommessa.join("\n")}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatoBadge stato={commessa.stato} />
            <TipologiaBadge tipologia={commessa.tipologia} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintLink href={`/stampa/commesse/${commessa.id}`} />
          {puoModificare && (
            <Link
              href={`/commesse/${commessa.id}/modifica`}
              className="rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand/40"
            >
              Modifica
            </Link>
          )}
        </div>
      </header>
      <AvvisiAssegnazioni warnings={warnings} />

      <nav aria-label="Sezioni della commessa" className="flex flex-wrap gap-2 text-sm">
        <a href="#dati-commessa" className="min-h-11 rounded-lg border border-line px-4 py-3 text-brand-deep">Cliente, PM e importi</a>
        {isProgetto(commessa.stato) && <a href="#cantiere-commessa" className="min-h-11 rounded-lg border border-line px-4 py-3 text-brand-deep">Cantiere e risorse</a>}
        <a href="#acquisti-commessa" className="min-h-11 rounded-lg border border-line px-4 py-3 text-brand-deep">Acquisti ({commessa.ordiniFornitore.length})</a>
        <a href="#documenti-commessa" className="min-h-11 rounded-lg border border-line px-4 py-3 text-brand-deep">Documenti ({commessa.documenti.length})</a>
        <Link href={`/attivita?commessaId=${id}`} className="min-h-11 rounded-lg border border-line px-4 py-3 text-brand-deep">Attività collegate →</Link>
      </nav>

      <AiContextPanel type="commessa" id={id} />
      <TaskContext user={user} commessaId={id} />
      {commessa.opportunitaId && <Link href={`/commerciale/${commessa.opportunitaId}`} className="min-h-11 rounded-lg border border-line p-4 text-sm text-brand-deep">Apri trattativa di origine, offerta e conferma incarico →</Link>}

      <Link href={`/commesse/${id}/consuntivo`} className="rounded-xl border border-line bg-panel p-5 text-sm font-medium text-brand-deep hover:border-brand">Consuntivo ore e materiali → <span className="mt-1 block font-normal text-ink-soft">Tariffario cliente, valori applicati al lavoro e storico delle modifiche.</span></Link>

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
              Esistono ordini a fornitore collegati. La regola P→C converte i preventivi
              a corpo in Consuntivo; Tariffario e Gara mantengono la propria tipologia.
              Verifica l&apos;ordine del cliente e la fatturazione.
            </p>
          </div>
        </div>
      )}

      <div id="dati-commessa" className="scroll-mt-6 grid gap-5 md:grid-cols-2">
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
          <Row label="Indirizzo cantiere" value={commessa.indirizzoCantiere} />
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
          <Row label="Riferimento conferma" value={commessa.oda} />
        </Card>

        {commessa.stato === "PERSA" && (
          <Card title="Offerta persa">
            <Row label="Motivazione" value={commessa.motivazionePersa} />
          </Card>
        )}
      </div>

      {confermaIniziale && <details className="rounded-xl border border-line bg-panel p-5">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">Conferma iniziale dell’incarico</summary>
        <p className="mt-3 text-sm text-ink-soft">{formatDateTime(confermaIniziale.createdAt)} · {confermaIniziale.autoreNome} · {etichettaRuolo(confermaIniziale.autoreRuolo)}</p>
        <p className="mt-2 text-sm text-ink-soft">Valori al momento della creazione guidata: offerta {valoriIniziali?.importoOfferta ? `${valoriIniziali.importoOfferta} €` : "non definita"}; ordine {valoriIniziali?.importoOrdine ? `${valoriIniziali.importoOrdine} €` : "non definito"}. È la fotografia iniziale, non lo storico delle successive modifiche della scheda.</p>
      </details>}

      {/* Progetto di cantiere (Fase 7): compare solo da "Ordine confermato". */}
      {isProgetto(commessa.stato) && (
        <section id="cantiere-commessa" className="scroll-mt-6 rounded-xl border border-line bg-panel p-6">
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
          <p className="mt-3 text-sm text-ink-soft">Inizio lavori: {formatDate(commessa.dataInizioLavori)} · Scadenza: {formatDate(commessa.scadenzaLavori)}</p>
          {commessa.noteCantiere && <p className="mt-2 whitespace-pre-line break-words text-sm text-ink-soft">{commessa.noteCantiere}</p>}

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
      <section id="acquisti-commessa" className="scroll-mt-6 rounded-xl border border-line bg-panel">
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
                        {o.numero ?? "Ordine senza numero"}
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
      <div id="documenti-commessa" className="scroll-mt-6"><CommessaDocumenti id={commessa.id} numero={commessa.numero} documenti={commessa.documenti} puoGestire={puoDocumenti} /></div>
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
