import { DetailNavigation } from "@/components/navigation-context";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireOperai } from "@/lib/enums";
import { OperaioAddForm, OperaioEditForm } from "./operai-ui";
import { createOperaio, deleteOperaio, updateOperaio } from "./actions";
import { Prisma } from "@/generated/prisma";
import ListFilters from "@/components/list-filters";
import ListPagination from "@/components/list-pagination";
import { queryText } from "@/lib/list-state";
import { inPageOrder, listSources, searchListPage } from "@/lib/list-search";

export const metadata = { title: "Operai — CRM Elettra" };

export default async function OperaiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stato?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const q = queryText(sp.q);
  const stato = sp.stato === "attivi" || sp.stato === "inattivi" ? sp.stato : "";

  const user = await getCurrentUser();
  const puoModificare = user ? puoGestireOperai(user.ruolo) : false;

  const pagination = await searchListPage(prisma, listSources.operai, {
    query: q, page: sp.pagina, scope: stato ? Prisma.sql`s.attivo = ${stato === "attivi"}` : undefined,
    orderBy: Prisma.sql`s.attivo DESC, s.cognome ASC, s.nome ASC`, extraCount: Prisma.sql`count(*) FILTER (WHERE s.attivo)`,
  });
  const operai = inPageOrder(await prisma.operaio.findMany({
    where: { id: { in: pagination.ids } },
    include: { _count: { select: { assegnazioni: true } } },
  }), pagination.ids);

  const attivi = pagination.extra;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <DetailNavigation listPath="/progetti" listLabel="Progetti" currentLabel="Operai" />
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Anagrafica operai
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {pagination.total} in elenco · {attivi} attiv{attivi === 1 ? "o" : "i"}
          </p>
        </div>
      </header>

      <ListFilters q={q} total={pagination.total} similar={pagination.similar} placeholder="Nome, qualifica, squadra…" filters={[
        { name: "stato", label: "Disponibilità anagrafica", value: stato, options: [{ value: "", label: "Tutto il personale" }, { value: "attivi", label: "Attivi" }, { value: "inattivi", label: "Non attivi" }] },
      ]} />

      <section className="rounded-xl border border-line bg-panel p-6">
        <h2 className="text-sm font-semibold">
          Personale{" "}
          <span className="font-normal text-ink-faint">({operai.length})</span>
        </h2>

        {operai.length === 0 ? (
          <p className="mt-4 text-sm text-ink-faint">
            {q
              ? "Nessun operaio corrisponde alla ricerca."
              : "Nessun operaio in anagrafica."}
          </p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {operai.map((o) => (
              <li key={o.id} className="py-3 first:pt-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">
                    {o.cognome} {o.nome}
                  </span>
                  {o.qualifica && (
                    <span className="rounded-md bg-lead-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                      {o.qualifica}
                    </span>
                  )}
                  {o.squadra && (
                    <span className="text-xs text-ink-soft">{o.squadra}</span>
                  )}
                  {o.telefono && (
                    <span className="font-mono text-xs text-ink-faint">
                      {o.telefono}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-3">
                    <span className="font-mono text-xs text-ink-faint">
                      {o._count.assegnazioni === 0
                        ? "nessun cantiere"
                        : `${o._count.assegnazioni} cantier${o._count.assegnazioni === 1 ? "e" : "i"}`}
                    </span>
                    {!o.attivo && (
                      <span className="rounded-full bg-lead-soft px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                        non attivo
                      </span>
                    )}
                  </span>
                </div>

                {o.note && (
                  <p className="mt-1 text-xs text-ink-soft">{o.note}</p>
                )}

                {puoModificare && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-ink-faint transition hover:text-brand-deep">
                      Modifica
                    </summary>
                    <OperaioEditForm
                      action={updateOperaio.bind(null, o.id)}
                      eliminaAction={deleteOperaio.bind(null, o.id)}
                      operaio={{
                        nome: o.nome,
                        cognome: o.cognome,
                        qualifica: o.qualifica,
                        squadra: o.squadra,
                        telefono: o.telefono,
                        note: o.note,
                        attivo: o.attivo,
                      }}
                    />
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}

        {puoModificare && (
          <div className="mt-5">
            <OperaioAddForm action={createOperaio} />
          </div>
        )}
      </section>
      <ListPagination path="/progetti/operai" params={sp} page={pagination.page} pages={pagination.pages} />

      {!puoModificare && (
        <p className="text-xs text-ink-faint">
          Solo Super Admin, Backoffice e Project Manager possono modificare
          l&apos;anagrafica operai.
        </p>
      )}
    </div>
  );
}
