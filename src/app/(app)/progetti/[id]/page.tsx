import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import {
  puoGestireProgetti,
  etichettaStato,
  etichettaRuoloCantiere,
} from "@/lib/enums";
import { formatDate, formatEuro } from "@/lib/format";
import {
  avanzamento,
  giorniAllaScadenza,
  isProgetto,
  milestoneScaduta,
  statoAvanzamento,
} from "@/lib/progetti";
import {
  AvanzamentoBadge,
  MilestoneBadge,
  StatoBadge,
  TipologiaBadge,
} from "@/components/badges";
import { BarraAvanzamento } from "@/components/charts";
import {
  AssegnaOperaioForm,
  AzioneIcona,
  MilestoneAddForm,
  MilestoneEditForm,
  PianificazioneForm,
  StatoMilestoneSelect,
} from "../progetto-ui";
import {
  assegnaOperaio,
  createMilestone,
  deleteMilestone,
  rimuoviAssegnazione,
  setStatoMilestone,
  spostaMilestone,
  updateMilestone,
  updatePianificazione,
} from "../actions";

export default async function ProgettoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const commessa = await prisma.commessa.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, ragioneSociale: true } },
      pm: { select: { nome: true, cognome: true } },
      milestone: { orderBy: { ordine: "asc" } },
      assegnazioni: {
        include: { operaio: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!commessa) notFound();

  const user = await getCurrentUser();
  const puoModificare = user ? puoGestireProgetti(user.ruolo) : false;

  // Una commessa ancora in fase commerciale non ha cantiere: si spiega invece
  // di restituire 404, così il passaggio di stato resta comprensibile.
  if (!isProgetto(commessa.stato)) {
    return (
      <div className="flex flex-col gap-6">
        <Intestazione commessa={commessa} />
        <div className="rounded-xl border border-line bg-panel px-6 py-10 text-center">
          <p className="text-sm font-medium">
            Questa commessa non è ancora un progetto di cantiere.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            Il progetto si apre quando la commessa passa a{" "}
            <span className="font-medium">Ordine confermato</span>. Adesso è in
            stato <span className="font-medium">{etichettaStato(commessa.stato)}</span>.
          </p>
          <Link
            href={`/commesse/${commessa.id}`}
            className="mt-4 inline-block rounded-lg border border-line bg-panel px-4 py-2 text-sm font-medium transition hover:border-brand/40"
          >
            Apri la commessa
          </Link>
        </div>
      </div>
    );
  }

  const av = avanzamento(commessa.milestone);
  const stato = statoAvanzamento(commessa);
  const giorni = giorniAllaScadenza(commessa.scadenzaLavori);
  const operaiAttivi = await prisma.operaio.findMany({
    where: { attivo: true },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, cognome: true, qualifica: true },
  });

  const ultimoOrdine = commessa.milestone.length - 1;

  return (
    <div className="flex flex-col gap-7">
      <Intestazione commessa={commessa} stato={stato} />

      {stato === "IN_RITARDO" && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-danger/40 bg-danger-soft/50 px-5 py-4"
        >
          <svg
            viewBox="0 0 24 24"
            className="mt-0.5 h-5 w-5 shrink-0 text-danger"
            aria-hidden
          >
            <path
              fill="currentColor"
              d="M12 2 1 21h22L12 2Zm0 6a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm0 9.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-danger">
              Progetto in ritardo
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {giorni !== null && giorni < 0
                ? `La consegna concordata è scaduta ${-giorni} giorn${-giorni === 1 ? "o" : "i"} fa.`
                : "Almeno una milestone ha superato la data prevista senza essere completata."}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <Card title="Avanzamento">
          <div className="flex flex-col gap-3">
            <BarraAvanzamento
              percentuale={av.percentuale}
              tono={
                stato === "COMPLETATO"
                  ? "ok"
                  : stato === "IN_RITARDO"
                    ? "danger"
                    : av.totali === 0
                      ? "neutro"
                      : "brand"
              }
            />
            {av.totali === 0 ? (
              <p className="text-sm text-ink-faint">
                Nessuna milestone: l&apos;avanzamento si calcola da queste.
              </p>
            ) : (
              <dl className="flex flex-col gap-2">
                <Row
                  label="Milestone completate"
                  value={`${av.completate} di ${av.totali}`}
                />
                <Row label="In corso" value={String(av.inCorso)} />
              </dl>
            )}
          </div>
        </Card>

        <Card title="Cantiere">
          <dl className="flex flex-col gap-2">
            <Row label="Inizio lavori" value={formatDate(commessa.dataInizioLavori)} />
            <Row label="Scadenza" value={formatDate(commessa.scadenzaLavori)} />
            <Row label="Fine effettiva" value={formatDate(commessa.dataFineLavori)} />
            <Row
              label="Squadra"
              value={`${commessa.assegnazioni.length} assegnat${commessa.assegnazioni.length === 1 ? "o" : "i"}`}
            />
          </dl>
        </Card>

        <Card title="Commessa">
          <dl className="flex flex-col gap-2">
            <Row
              label="Cliente"
              value={commessa.cliente.ragioneSociale}
              href={`/anagrafiche/${commessa.clienteId}`}
            />
            <Row
              label="Project Manager"
              value={commessa.pm ? `${commessa.pm.nome} ${commessa.pm.cognome}` : null}
            />
            <Row label="Stato commessa" value={etichettaStato(commessa.stato)} />
            <Row
              label="Importo ordine"
              value={commessa.importoOrdine ? formatEuro(commessa.importoOrdine) : null}
              mono
            />
          </dl>
        </Card>
      </div>

      {commessa.noteCantiere && (
        <section className="rounded-xl border border-line bg-panel p-5">
          <h2 className="text-sm font-semibold">Note di cantiere</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">
            {commessa.noteCantiere}
          </p>
        </section>
      )}

      {puoModificare && (
        <section className="rounded-xl border border-line bg-panel p-6">
          <h2 className="text-sm font-semibold">Pianificazione</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Date di cantiere, distinte da quelle commerciali della commessa.
          </p>
          <div className="mt-4">
            <PianificazioneForm
              action={updatePianificazione.bind(null, commessa.id)}
              dataInizioLavori={commessa.dataInizioLavori}
              scadenzaLavori={commessa.scadenzaLavori}
              dataFineLavori={commessa.dataFineLavori}
              noteCantiere={commessa.noteCantiere}
            />
          </div>
        </section>
      )}

      {/* Milestone */}
      <section className="rounded-xl border border-line bg-panel p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Milestone di rilascio{" "}
            <span className="font-normal text-ink-faint">
              ({commessa.milestone.length})
            </span>
          </h2>
          <p className="text-xs text-ink-soft">
            L&apos;avanzamento è la quota di milestone completate.
          </p>
        </div>

        {commessa.milestone.length === 0 ? (
          <p className="mt-4 text-sm text-ink-faint">
            Nessuna milestone definita.
          </p>
        ) : (
          <ol className="mt-4 flex flex-col divide-y divide-line">
            {commessa.milestone.map((m, i) => {
              const inRitardo = milestoneScaduta(m);

              return (
                <li key={m.id} className="py-3 first:pt-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="font-mono text-xs tabular-nums text-ink-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {m.titolo}
                    </span>

                    <span className="font-mono text-xs text-ink-faint">
                      {m.stato === "COMPLETATA" && m.dataEffettiva
                        ? `fatto ${formatDate(m.dataEffettiva)}`
                        : m.dataPianificata
                          ? `prev. ${formatDate(m.dataPianificata)}`
                          : "senza data"}
                    </span>
                    {inRitardo && (
                      <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">
                        scaduta
                      </span>
                    )}

                    {puoModificare ? (
                      <>
                        <StatoMilestoneSelect
                          action={setStatoMilestone.bind(null, m.id)}
                          stato={m.stato}
                        />
                        <div className="flex items-center">
                          <AzioneIcona
                            action={spostaMilestone.bind(null, m.id, "su")}
                            title="Sposta su"
                            disabled={i === 0}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                              <path fill="currentColor" d="M12 7l6 7H6l6-7Z" />
                            </svg>
                          </AzioneIcona>
                          <AzioneIcona
                            action={spostaMilestone.bind(null, m.id, "giu")}
                            title="Sposta giù"
                            disabled={i === ultimoOrdine}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                              <path fill="currentColor" d="M12 17l-6-7h12l-6 7Z" />
                            </svg>
                          </AzioneIcona>
                          <AzioneIcona
                            action={deleteMilestone.bind(null, m.id)}
                            title="Elimina milestone"
                            conferma={`Eliminare la milestone «${m.titolo}»?`}
                            variante="danger"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                              <path
                                fill="currentColor"
                                d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm4 2v8h1v-8h-1Zm3 0v8h1v-8h-1Z"
                              />
                            </svg>
                          </AzioneIcona>
                        </div>
                      </>
                    ) : (
                      <MilestoneBadge stato={m.stato} />
                    )}
                  </div>

                  {m.note && !puoModificare && (
                    <p className="mt-1.5 pl-8 text-xs text-ink-soft">{m.note}</p>
                  )}

                  {puoModificare && (
                    <details className="group mt-1 pl-8">
                      <summary className="cursor-pointer text-xs text-ink-faint transition hover:text-brand-deep">
                        Modifica dettagli
                      </summary>
                      <MilestoneEditForm
                        action={updateMilestone.bind(null, m.id)}
                        titolo={m.titolo}
                        stato={m.stato}
                        dataPianificata={m.dataPianificata}
                        dataEffettiva={m.dataEffettiva}
                        note={m.note}
                      />
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {puoModificare && (
          <div className="mt-5">
            <MilestoneAddForm action={createMilestone.bind(null, commessa.id)} />
          </div>
        )}
      </section>

      {/* Squadra assegnata */}
      <section className="rounded-xl border border-line bg-panel p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Squadra in cantiere{" "}
            <span className="font-normal text-ink-faint">
              ({commessa.assegnazioni.length})
            </span>
          </h2>
          <Link
            href="/progetti/operai"
            className="text-xs font-medium text-brand-deep hover:underline"
          >
            Anagrafica operai →
          </Link>
        </div>

        {commessa.assegnazioni.length === 0 ? (
          <p className="mt-4 text-sm text-ink-faint">
            Nessun operaio assegnato.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {commessa.assegnazioni.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {a.operaio.cognome} {a.operaio.nome}
                  {!a.operaio.attivo && (
                    <span className="ml-2 text-xs font-normal text-ink-faint">
                      (non attivo)
                    </span>
                  )}
                </span>
                {a.ruoloCantiere && (
                  <span className="rounded-md bg-lead-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                    {etichettaRuoloCantiere(a.ruoloCantiere)}
                  </span>
                )}
                {a.operaio.squadra && (
                  <span className="text-xs text-ink-soft">
                    {a.operaio.squadra}
                  </span>
                )}
                <span className="font-mono text-xs text-ink-faint">
                  {a.dal || a.al
                    ? `${a.dal ? formatDate(a.dal) : "…"} → ${a.al ? formatDate(a.al) : "…"}`
                    : "periodo non indicato"}
                </span>
                {puoModificare && (
                  <AzioneIcona
                    action={rimuoviAssegnazione.bind(null, a.id)}
                    title="Rimuovi dal cantiere"
                    conferma={`Rimuovere ${a.operaio.nome} ${a.operaio.cognome} dal cantiere?`}
                    variante="danger"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                      <path fill="currentColor" d="M6 11h12v2H6v-2Z" />
                    </svg>
                  </AzioneIcona>
                )}
              </li>
            ))}
          </ul>
        )}

        {puoModificare && (
          <div className="mt-5">
            <AssegnaOperaioForm
              action={assegnaOperaio.bind(null, commessa.id)}
              operai={operaiAttivi}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Intestazione({
  commessa,
  stato,
}: {
  commessa: {
    id: string;
    numero: string;
    stato: string;
    tipologia: string | null;
    descrizione: string | null;
  };
  stato?: ReturnType<typeof statoAvanzamento>;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link
          href="/progetti"
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← Progetti
        </Link>
        <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight">
          <span className="font-mono tabular-nums">{commessa.numero}</span>
          {stato && <AvanzamentoBadge stato={stato} />}
          <StatoBadge stato={commessa.stato} />
          <TipologiaBadge tipologia={commessa.tipologia} />
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {commessa.descrizione ?? "Senza descrizione"}
        </p>
      </div>
      <Link
        href={`/commesse/${commessa.id}`}
        className="rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand/40"
      >
        Apri commessa
      </Link>
    </header>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
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
