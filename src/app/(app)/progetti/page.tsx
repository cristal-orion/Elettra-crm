import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireOperai } from "@/lib/enums";
import { formatDate } from "@/lib/format";
import {
  avanzamento,
  faseCorrente,
  giorniAllaScadenza,
  haPianificazioneDimostrativa,
  statoAvanzamento,
  STATI_PROGETTO,
  STATI_PROGETTO_ATTIVO,
} from "@/lib/progetti";
import {
  AvanzamentoBadge,
  DimostrativoBadge,
  StatoBadge,
} from "@/components/badges";
import { BarraAvanzamento } from "@/components/charts";
import ListFilters from "@/components/list-filters";
import ListPagination from "@/components/list-pagination";
import { queryText } from "@/lib/list-state";
import { inPageOrder, searchListPage } from "@/lib/list-search";
import { projectListSource } from "@/lib/project-list";
import { Prisma } from "@/generated/prisma";

export const metadata = { title: "Progetti — CRM Elettra" };

const VISTE = {
  attivi: "Cantieri aperti",
  ritardo: "Solo in ritardo",
  tutti: "Tutti (storico incluso)",
} as const;

type Vista = keyof typeof VISTE;

export default async function ProgettiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vista?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const q = queryText(sp.q);
  const vista: Vista =
    sp.vista && Object.hasOwn(VISTE, sp.vista) ? (sp.vista as Vista) : "attivi";

  const user = await requireUser();
  const puoOperai = user ? puoGestireOperai(user.ruolo) : false;
  const stati =
    vista === "attivi" ? [...STATI_PROGETTO_ATTIVO] : STATI_PROGETTO;
  const pagination = await searchListPage(prisma, projectListSource(), {
    query: q, page: sp.pagina,
    scope: Prisma.sql`s.stato IN (${Prisma.join(stati)}) AND ${vista === "ritardo" ? Prisma.sql`s.urgency = 0` : Prisma.sql`true`}`,
    orderBy: Prisma.sql`s.urgency ASC, s."dueDay" ASC NULLS LAST, s.anno DESC, s.progressivo DESC`,
    extraCount: Prisma.sql`count(*) FILTER (WHERE s.urgency = 0)`,
  });

  const commesse = inPageOrder(await prisma.commessa.findMany({
    where: { id: { in: pagination.ids } },
    include: {
      cliente: { select: { id: true, ragioneSociale: true } },
      pm: { select: { nome: true, cognome: true } },
      milestone: {
        select: {
          id: true,
          titolo: true,
          stato: true,
          ordine: true,
          dataPianificata: true,
          dimostrativa: true,
        },
        orderBy: { ordine: "asc" },
      },
      _count: { select: { assegnazioni: true } },
    },
  }), pagination.ids);

  const progetti = commesse
    .map((c) => {
      const av = avanzamento(c.milestone);
      return {
        commessa: c,
        av,
        stato: statoAvanzamento(c),
        fase: faseCorrente(c.milestone),
        giorni: giorniAllaScadenza(c.scadenzaLavori),
        dimostrativo: haPianificazioneDimostrativa(c.milestone),
      };
    });

  const inRitardo = pagination.extra;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
            Progetti
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Cantieri in corso
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {pagination.total} progett{pagination.total === 1 ? "o" : "i"}
            {inRitardo > 0 && (
              <>
                {" · "}
                <span className="font-medium text-danger">
                  {inRitardo} in ritardo
                </span>
              </>
            )}
          </p>
        </div>
        {puoOperai && (
          <Link
            href="/progetti/operai"
            className="rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand/40"
          >
            Gestisci operai
          </Link>
        )}
      </header>

      <ListFilters q={q} total={pagination.total} similar={pagination.similar} placeholder="Numero, descrizione, cliente…" filters={[
        { name: "vista", label: "Situazione", value: vista, defaultValue: "attivi", options: Object.entries(VISTE).map(([value, label]) => ({ value, label })) },
      ]} suggestions={progetti.slice(0, 5).map(({ commessa: c }) => ({ href: `/progetti/${c.id}`, label: `${c.numero} · ${c.cliente.ragioneSociale}`, type: "Progetto" }))} />

      {progetti.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel px-6 py-12 text-center">
          <p className="text-sm text-ink-faint">
            {vista === "ritardo"
              ? "Nessun progetto in ritardo."
              : "Nessun progetto. Un progetto nasce quando una commessa passa a “Ordine confermato”."}
          </p>
          <Link
            href="/commesse"
            className="mt-3 inline-block text-sm font-medium text-brand-deep hover:underline"
          >
            Vai alle commesse →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {progetti.map(({ commessa: c, av, stato, fase, giorni, dimostrativo }) => (
            <li
              key={c.id}
              className="relative rounded-xl border border-line bg-panel p-5 transition hover:border-brand/40 focus-within:ring-2 focus-within:ring-brand"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      href={`/progetti/${c.id}`}
                      aria-label={`Apri progetto ${c.numero} — ${c.cliente.ragioneSociale}`}
                      className="font-mono tabular-nums font-semibold text-brand-deep underline underline-offset-4 after:absolute after:inset-0 after:rounded-xl"
                    >
                      {c.numero}
                    </Link>
                    <AvanzamentoBadge stato={stato} />
                    <StatoBadge stato={c.stato} />
                    {dimostrativo && <DimostrativoBadge compatto />}
                  </div>
                  <p className="mt-1.5 truncate text-sm font-medium">
                    {c.descrizione ?? "Senza descrizione"}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-soft">
                    {c.cliente.ragioneSociale}
                  </p>
                </div>

                <div className="w-full max-w-xs shrink-0">
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
                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                    <div className="flex gap-1.5">
                      <dt className="text-ink-faint">PM</dt>
                      <dd>{c.pm ? `${c.pm.nome} ${c.pm.cognome}` : "—"}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-ink-faint">Scadenza</dt>
                      <dd
                        className={
                          giorni !== null && giorni < 0 && stato !== "COMPLETATO"
                            ? "font-medium text-danger"
                            : ""
                        }
                      >
                        {c.scadenzaLavori ? formatDate(c.scadenzaLavori) : "—"}
                        {giorni !== null && stato !== "COMPLETATO" && (
                          <span className="ml-1 text-ink-faint">
                            {giorni < 0
                              ? `(${-giorni} gg fa)`
                              : giorni === 0
                                ? "(oggi)"
                                : `(${giorni} gg)`}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-ink-faint">Milestone</dt>
                      <dd className="tabular-nums">
                        {av.totali === 0 ? "—" : `${av.completate}/${av.totali}`}
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-ink-faint">Squadra</dt>
                      <dd className="tabular-nums">
                        {c._count.assegnazioni === 0
                          ? "—"
                          : c._count.assegnazioni}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {fase && (
                <p className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">
                  <span className="text-ink-faint">Fase corrente: </span>
                  <span className="font-medium">{fase.titolo}</span>
                  {fase.dataPianificata && (
                    <span className="text-ink-faint">
                      {" "}
                      · prevista {formatDate(fase.dataPianificata)}
                    </span>
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <ListPagination path="/progetti" params={sp} page={pagination.page} pages={pagination.pages} />
    </div>
  );
}
