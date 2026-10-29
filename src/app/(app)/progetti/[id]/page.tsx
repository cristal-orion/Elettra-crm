import Link from "next/link";
import { randomUUID } from "node:crypto";
import { commessaScope, documentoScope, puoLeggereEconomia } from "@/lib/access";
import ProblemiList from "@/components/problemi-list";
import StoricoCantiere from "@/components/storico-cantiere";
import { SospensioneForm } from "@/components/operativo-forms";
import { DetailNavigation } from "@/components/navigation-context";
import AiContextPanel from "@/components/ai/context-panel";
import PrintLink from "@/components/print-link";
import { AssegnaSquadraForm } from "../../risorse/squadre/squadre-ui";
import CommessaDocumenti from "@/components/commessa-documenti";
import TaskContext from "@/components/task-context";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import {
  puoGestireProgetti,
  puoGestireDocumenti,
  etichettaStato,
  etichettaRuoloCantiere,
} from "@/lib/enums";
import { formatDate, formatEuro } from "@/lib/format";
import {
  avanzamento,
  descrizioneSal,
  giorniAllaScadenza,
  haPianificazioneDimostrativa,
  isProgetto,
  milestoneScaduta,
  statoAvanzamento,
} from "@/lib/progetti";
import {
  AvanzamentoBadge,
  DimostrativoBadge,
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

const SEZIONI = { riepilogo: "Riepilogo", avanzamento: "Avanzamento", problemi: "Problemi", squadra: "Squadra", documenti: "Documenti" } as const;

export default async function ProgettoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; esito?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" && Object.hasOwn(SEZIONI, sp.tab) ? sp.tab as keyof typeof SEZIONI : "riepilogo";
  const user = await requireUser();

  const commessa = await prisma.commessa.findFirst({
    where: { id, ...commessaScope(user) },
    include: {
      cliente: { select: { id: true, ragioneSociale: true } },
      pm: { select: { nome: true, cognome: true } },
      milestone: { orderBy: { ordine: "asc" } },
      _count: { select: { documenti: { where: documentoScope(user) }, problemi: { where: { stato: { not: "RISOLTA" } } } } },
      assegnazioni: {
        include: { operaio: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!commessa) notFound();

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
  const dimostrativo = haPianificazioneDimostrativa(commessa.milestone);
  const operaiAttivi = puoModificare && tab === "squadra" ? await prisma.operaio.findMany({
    where: { attivo: true },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, cognome: true, qualifica: true },
  }) : [];
  const documenti = tab === "documenti" ? await prisma.documento.findMany({
    where: { commessaId: id, ...documentoScope(user) }, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { id: true, nomeFile: true, categoria: true, dimensione: true, createdAt: true, aggiornamentoId: true, problemaId: true },
  }) : [];
  const squadre = puoModificare && tab === "squadra" ? await prisma.squadra.findMany({ where: { attiva: true }, orderBy: { nome: "asc" }, include: { membri: { where: { attivo: true }, select: { nome: true, cognome: true }, orderBy: { cognome: "asc" } } } }) : [];

  const ultimoOrdine = commessa.milestone.length - 1;
  const aggiornamenti = tab === "avanzamento" ? await prisma.aggiornamentoCantiere.findMany({ where: { commessaId: id }, orderBy: { createdAt: "desc" }, take: 50, include: { documenti: { select: { id: true, nomeFile: true } } } }) : [];
  const problemi = tab === "problemi" ? await prisma.problemaCantiere.findMany({ where: { commessaId: id }, orderBy: [{ updatedAt: "desc" }], take: 100 }) : [];

  return (
    <div className="flex flex-col gap-7">
      <Intestazione commessa={commessa} stato={stato} puoModificare={puoModificare} />
      {sp.esito && <p role="status" className="rounded-lg bg-ok-soft p-4 text-sm text-ok">{sp.esito === "sal" ? "Aggiornamento SAL e allegati salvati." : "Stato operativo aggiornato."}</p>}
      {commessa.sospeso && <p role="status" className="rounded-lg bg-warn-soft p-4 text-sm text-warn"><strong>Cantiere sospeso.</strong> {commessa.motivoSospensione}</p>}

      <nav aria-label="Sezioni progetto" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-2">
        {Object.entries(SEZIONI).map(([value, label]) => <Link key={value}
          href={`/progetti/${id}?tab=${value}`} scroll={false} aria-current={tab === value ? "page" : undefined}
           className={`flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand ${tab === value ? "bg-brand-soft text-brand-deep" : "text-ink-soft hover:bg-paper"}`}>
           {label}{value === "problemi" ? ` (${commessa._count.problemi})` : value === "squadra" ? ` (${commessa.assegnazioni.length})` : value === "documenti" ? ` (${commessa._count.documenti})` : ""}
        </Link>)}
      </nav>

      {dimostrativo && (
        <div
          role="note"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-warn/40 bg-warn-soft/50 px-5 py-4"
        >
          <span aria-hidden className="mt-0.5 text-lg leading-none text-warn">
            ◆
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-warn">
              Pianificazione dimostrativa
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              Le milestone e le date di cantiere di questo progetto sono{" "}
              <strong>dati di esempio</strong>, caricati per mostrare come
              funziona la sezione. La commessa, il cliente e gli importi sono
              invece reali. Non usarle per pianificare il lavoro: si eliminano
              con <span className="font-mono text-xs">npm run demo:milestone -- --rimuovi</span>.
            </p>
          </div>
        </div>
      )}

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

      {tab === "riepilogo" && <>
      <div className="grid min-w-0 gap-5 xl:grid-cols-3">
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
                SAL non disponibile: aggiungi milestone reali nella pianificazione.
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
            <Row label="Luogo / città" value={commessa.indirizzoCantiere || "Luogo da indicare"} />
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
            {puoLeggereEconomia(user) && <Row
               label="Importo ordine"
               value={commessa.importoOrdine ? formatEuro(commessa.importoOrdine) : null}
               mono
            />}
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

      <div className="flex flex-wrap gap-3">
        <Link href={`/progetti/${id}?tab=avanzamento`} className="inline-flex min-h-11 items-center rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white">{puoModificare ? "Aggiorna avanzamento" : "Vedi avanzamento"}</Link>
        <Link href={`/progetti/${id}?tab=squadra`} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-panel px-4 py-2 text-sm font-medium text-brand-deep">{puoModificare ? "Gestisci squadra" : "Vedi squadra"}</Link>
      </div>
      <TaskContext user={user} commessaId={id} />
      {puoModificare && <SospensioneForm key={commessa.versioneOperativa} commessaId={id} versione={commessa.versioneOperativa} richiestaId={randomUUID()} sospeso={commessa.sospeso} />}
      <AiContextPanel type="progetto" id={id} />
      </>}

      {tab === "avanzamento" && <>
      <StoricoCantiere aggiornamenti={aggiornamenti} />
      <div className="rounded-xl border border-line bg-panel p-4 sm:p-6">
        <h2 className="text-sm font-semibold">Avanzamento del progetto</h2>
        <p className="mt-2 text-sm text-ink-soft">{descrizioneSal(av)}</p>
      </div>
      {puoModificare && (
        <section className="rounded-xl border border-line bg-panel p-4 sm:p-6">
          <h2 className="text-sm font-semibold">Pianificazione</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Date di cantiere, distinte da quelle commerciali della commessa.
          </p>
          <div className="mt-4">
            <PianificazioneForm
              expectedUpdatedAt={commessa.updatedAt.toISOString()}
              action={updatePianificazione.bind(null, commessa.id)}
              dataInizioLavori={commessa.dataInizioLavori}
              scadenzaLavori={commessa.scadenzaLavori}
              dataFineLavori={commessa.dataFineLavori}
              noteCantiere={commessa.noteCantiere}
              indirizzoCantiere={commessa.indirizzoCantiere}
            />
          </div>
        </section>
      )}

      {/* Milestone */}
      <section className="rounded-xl border border-line bg-panel p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex flex-wrap items-center gap-2.5 text-sm font-semibold">
            Milestone di rilascio{" "}
            <span className="font-normal text-ink-faint">
              ({commessa.milestone.length})
            </span>
            {dimostrativo && <DimostrativoBadge />}
          </h2>
          <p className="text-xs text-ink-soft">
            Il peso di ogni fase è proporzionale ai giorni lavorativi previsti.
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
                    <span className="min-w-0 flex-[1_1_12rem] break-words text-sm font-medium">
                      {m.titolo}
                      {m.dimostrativa && (
                        <span
                          title="Milestone dimostrativa, non pianificazione reale"
                          className="ml-2 align-middle font-normal text-warn"
                          aria-label="dimostrativa"
                        >
                          ◆
                        </span>
                      )}
                    </span>

                    <span className="text-xs text-ink-soft">{m.durataGiorni === null ? "Durata da definire" : `${m.durataGiorni.toLocaleString("it-IT")} gg previsti`}</span>

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
                        <StatoMilestoneSelect key={`${m.id}:${m.updatedAt.toISOString()}`}
                          expectedUpdatedAt={m.updatedAt.toISOString()}
                          action={setStatoMilestone.bind(null, m.id)}
                          stato={m.stato}
                        />
                        <div className="flex items-center">
                          <AzioneIcona
                            action={spostaMilestone.bind(null, m.id, "su")}
                            expectedUpdatedAt={m.updatedAt.toISOString()}
                            title="Sposta su"
                            disabled={i === 0}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                              <path fill="currentColor" d="M12 7l6 7H6l6-7Z" />
                            </svg>
                          </AzioneIcona>
                          <AzioneIcona
                            action={spostaMilestone.bind(null, m.id, "giu")}
                            expectedUpdatedAt={m.updatedAt.toISOString()}
                            title="Sposta giù"
                            disabled={i === ultimoOrdine}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                              <path fill="currentColor" d="M12 17l-6-7h12l-6 7Z" />
                            </svg>
                          </AzioneIcona>
                          <AzioneIcona
                            action={deleteMilestone.bind(null, m.id)}
                            expectedUpdatedAt={m.updatedAt.toISOString()}
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
                      <summary className="min-h-11 cursor-pointer py-3 text-sm text-brand-deep transition hover:underline">
                        Modifica dettagli
                      </summary>
                      <MilestoneEditForm
                        expectedUpdatedAt={m.updatedAt.toISOString()}
                        action={updateMilestone.bind(null, m.id)}
                        titolo={m.titolo}
                        stato={m.stato}
                        dataPianificata={m.dataPianificata}
                        dataEffettiva={m.dataEffettiva}
                        durataGiorni={m.durataGiorni}
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
      </>}

      {tab === "problemi" && <section className="overflow-hidden rounded-xl border border-line bg-panel"><header className="border-b border-line p-4 sm:px-6"><h2 className="text-sm font-semibold">Problemi del cantiere</h2><p className="mt-1 text-xs text-ink-soft">{commessa._count.problemi} aperti · ultimi 100 problemi, incluse le risoluzioni.</p></header><ProblemiList problemi={problemi} /></section>}
      {/* Squadra assegnata */}
      {tab === "squadra" && <section className="rounded-xl border border-line bg-panel p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">
            Squadra in cantiere{" "}
            <span className="font-normal text-ink-faint">
              ({commessa.assegnazioni.length})
            </span>
          </h2>
          <Link
            href="/risorse/operai"
            className="inline-flex min-h-11 items-center text-sm font-medium text-brand-deep hover:underline"
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
                <span className="min-w-0 flex-[1_1_12rem] break-words text-sm font-medium">
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
                {a.note && <p className="w-full break-words text-sm text-ink-soft">{a.note}</p>}
                {puoModificare && a.operaio.attivo && <details className="w-full"><summary className="min-h-11 cursor-pointer py-3 text-sm text-brand-deep">Modifica assegnazione</summary><AssegnaOperaioForm action={assegnaOperaio.bind(null, id)} operai={[a.operaio]} initial={a} /></details>}
              </li>
            ))}
          </ul>
        )}

        {puoModificare && (
          <div className="mt-5 space-y-5">
            <AssegnaSquadraForm commessaId={id} squadre={squadre.map((s) => ({ id: s.id, nome: s.nome, versione: s.updatedAt.toISOString(), membri: s.membri.map((m) => `${m.nome} ${m.cognome}`) }))} />
            <Link href="/risorse/squadre" className="inline-flex min-h-11 items-center text-sm text-brand-deep underline">Gestisci le squadre centrali →</Link>
            <AssegnaOperaioForm
              action={assegnaOperaio.bind(null, commessa.id)}
              operai={operaiAttivi}
            />
          </div>
        )}
      </section>}
      {tab === "documenti" && <>
        <p className="text-sm text-ink-soft">Documenti condivisi con la commessa {commessa.numero}. I file caricati qui sono disponibili anche nella scheda commessa.</p>
        <CommessaDocumenti id={id} numero={commessa.numero} documenti={documenti} operativo={!puoLeggereEconomia(user)} puoGestire={puoGestireDocumenti(user.ruolo)} />
      </>}
    </div>
  );
}

function Intestazione({
  commessa,
  stato,
  puoModificare = false,
}: {
  commessa: {
    id: string;
    numero: string;
    stato: string;
    tipologia: string | null;
    descrizione: string | null;
    indirizzoCantiere: string | null;
    cliente: { ragioneSociale: string };
  };
  stato?: ReturnType<typeof statoAvanzamento>;
  puoModificare?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <DetailNavigation listPath="/progetti" listLabel="Progetti" currentLabel={commessa.numero} />
        <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight">
          <span className="font-mono tabular-nums">{commessa.numero}</span>
          {stato && <AvanzamentoBadge stato={stato} />}
          <StatoBadge stato={commessa.stato} />
          <TipologiaBadge tipologia={commessa.tipologia} />
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {commessa.descrizione ?? "Senza descrizione"}
        </p>
        <p className="mt-1 break-words text-sm text-ink-soft">{commessa.cliente.ragioneSociale} · {commessa.indirizzoCantiere || "Luogo del cantiere da indicare"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {puoModificare && <><Link href={`/progetti/${commessa.id}/sal`} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-deep">Aggiorna SAL</Link><Link href={`/progetti/${commessa.id}/problemi/nuovo`} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-line bg-panel px-4 py-3 text-sm font-medium text-brand-deep">Segnala problema</Link></>}
        {stato && <PrintLink href={`/stampa/progetti/${commessa.id}`} />}
        <Link
          href={`/commesse/${commessa.id}`}
          className="rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand/40"
        >
          Apri commessa
        </Link>
      </div>
    </header>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-panel p-5">
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
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
      <dt className="text-sm text-ink-faint">{label}</dt>
      <dd
        className={`min-w-0 break-words text-right text-sm ${mono ? "font-mono" : ""} ${shown ? "text-ink" : "text-ink-faint"}`}
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
