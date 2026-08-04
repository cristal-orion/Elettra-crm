import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
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
  type StatoAvanzamento,
} from "@/lib/progetti";
import {
  AvanzamentoBadge,
  DimostrativoBadge,
  StatoBadge,
} from "@/components/badges";
import { BarraAvanzamento } from "@/components/charts";

export const metadata = { title: "Progetti — CRM Elettra" };

const VISTE = {
  attivi: "Cantieri aperti",
  ritardo: "Solo in ritardo",
  tutti: "Tutti (storico incluso)",
} as const;

type Vista = keyof typeof VISTE;

/** Ordine di urgenza del badge: prima i ritardi, per ultimi i chiusi. */
const PESO: Record<StatoAvanzamento, number> = {
  IN_RITARDO: 0,
  IN_CORSO: 1,
  DA_PIANIFICARE: 2,
  COMPLETATO: 3,
};

export default async function ProgettiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const vista: Vista =
    sp.vista && sp.vista in VISTE ? (sp.vista as Vista) : "attivi";

  const user = await getCurrentUser();
  const puoOperai = user ? puoGestireOperai(user.ruolo) : false;

  // La vista "attivi" filtra già in query; "ritardo" ha bisogno del calcolo
  // derivato, quindi parte da tutti i progetti e stringe dopo.
  const stati =
    vista === "attivi" ? [...STATI_PROGETTO_ATTIVO] : STATI_PROGETTO;

  const commesse = await prisma.commessa.findMany({
    where: {
      stato: { in: stati },
      ...(q
        ? {
            OR: [
              { numero: { contains: q } },
              { descrizione: { contains: q } },
              { cliente: { ragioneSociale: { contains: q } } },
            ],
          }
        : {}),
    },
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
    orderBy: [{ anno: "desc" }, { progressivo: "desc" }],
  });

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
    })
    .filter((p) => (vista === "ritardo" ? p.stato === "IN_RITARDO" : true))
    .sort((a, b) => {
      const d = PESO[a.stato] - PESO[b.stato];
      if (d !== 0) return d;
      // A pari stato: prima le scadenze più vicine, le commesse senza data dopo.
      const ga = a.giorni ?? Number.POSITIVE_INFINITY;
      const gb = b.giorni ?? Number.POSITIVE_INFINITY;
      return ga - gb;
    });

  const inRitardo = progetti.filter((p) => p.stato === "IN_RITARDO").length;

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
            {progetti.length} progett{progetti.length === 1 ? "o" : "i"}
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

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cerca per numero, descrizione, cliente…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3.5 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <select
          name="vista"
          defaultValue={vista}
          className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-soft outline-none focus:border-brand"
        >
          {Object.entries(VISTE).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-line bg-panel px-4 py-2 text-sm text-ink-soft hover:border-brand/40"
        >
          Filtra
        </button>
      </form>

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
              className="rounded-xl border border-line bg-panel p-5 transition hover:border-brand/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      href={`/progetti/${c.id}`}
                      className="font-mono tabular-nums font-semibold hover:text-brand-deep"
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
    </div>
  );
}
