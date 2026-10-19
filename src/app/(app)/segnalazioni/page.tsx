import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireSegnalazioni } from "@/lib/enums";
import { formatDate } from "@/lib/format";
import {
  PrioritaBadge,
  StatoSegnalazioneBadge,
  TipoSegnalazioneBadge,
} from "@/components/badges";
import { Prisma } from "@/generated/prisma";
import ListFilters from "@/components/list-filters";
import ListPagination from "@/components/list-pagination";
import { queryText } from "@/lib/list-state";
import { inPageOrder, listSources, searchListPage } from "@/lib/list-search";

export const metadata = { title: "Segnalazioni — CRM Elettra" };

const VISTE = {
  aperte: "Da lavorare",
  concluse: "Concluse",
  tutte: "Tutte",
} as const;

type Vista = keyof typeof VISTE;

export default async function SegnalazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; q?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const vista: Vista = sp.vista && Object.hasOwn(VISTE, sp.vista) ? (sp.vista as Vista) : "aperte";
  const q = queryText(sp.q);

  const user = await requireUser();
  const puoGestire = puoGestireSegnalazioni(user.ruolo);

  const pagination = await searchListPage(prisma, listSources.segnalazioni, {
    query: q, page: sp.pagina,
    scope: vista === "aperte" ? Prisma.sql`s.stato IN ('APERTA', 'IN_LAVORAZIONE')` : vista === "concluse" ? Prisma.sql`s.stato = 'CONCLUSA'` : undefined,
    orderBy: Prisma.sql`(s.stato = 'CONCLUSA') ASC, CASE s.priorita WHEN 'ALTA' THEN 0 WHEN 'BASSA' THEN 2 ELSE 1 END ASC, s."createdAt" DESC`,
  });
  const ordinate = inPageOrder(await prisma.segnalazione.findMany({
    where: { id: { in: pagination.ids } },
    include: {
      autore: { select: { nome: true, cognome: true } },
      _count: { select: { allegati: true } },
    },
  }), pagination.ids);

  const [aperte, inLavorazione] = await Promise.all([
    prisma.segnalazione.count({ where: { stato: "APERTA" } }),
    prisma.segnalazione.count({ where: { stato: "IN_LAVORAZIONE" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
            Segnalazioni
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Note di chi prova il CRM
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {aperte} apert{aperte === 1 ? "a" : "e"} · {inLavorazione} in
            lavorazione
          </p>
        </div>
        <Link
          href="/segnalazioni/nuova"
          className="rounded-lg bg-elettra px-4 py-2.5 text-sm font-semibold text-white transition"
        >
          + Nuova segnalazione
        </Link>
      </header>

      <div className="rounded-xl border border-line bg-panel px-5 py-4">
        <p className="text-sm text-ink-soft">
          Se qualcosa non torna o vorresti che funzionasse diversamente,
          scrivilo qui: allega una schermata e chi sviluppa la trova con tutto il
          contesto. Puoi segnalare da qualunque pagina col pulsante{" "}
          <span className="font-medium">Segnala</span> in basso a destra.
        </p>
      </div>

      <ListFilters q={q} total={pagination.total} similar={pagination.similar} placeholder="Titolo o testo della segnalazione…" filters={[
        { name: "vista", label: "Situazione", value: vista, defaultValue: "aperte", options: Object.entries(VISTE).map(([value, label]) => ({ value, label })) },
      ]} />

      {ordinate.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel px-6 py-12 text-center">
          <p className="text-sm text-ink-faint">
            {vista === "concluse"
              ? "Nessuna segnalazione conclusa."
              : q
                ? "Nessuna segnalazione corrisponde alla ricerca."
                : "Nessuna segnalazione aperta. Se trovi qualcosa che non torna, aprine una."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordinate.map((s) => (
            <li
              key={s.id}
              className={`relative rounded-xl border bg-panel p-5 transition hover:border-brand/40 focus-within:ring-2 focus-within:ring-brand ${
                s.stato === "CONCLUSA" ? "border-line/60 opacity-75" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      href={`/segnalazioni/${s.id}`}
                      className="text-sm font-semibold text-brand-deep underline underline-offset-4 after:absolute after:inset-0 after:rounded-xl"
                    >
                      {s.titolo}
                    </Link>
                    <StatoSegnalazioneBadge stato={s.stato} />
                    <PrioritaBadge priorita={s.priorita} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">
                    {s.descrizione}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <TipoSegnalazioneBadge tipo={s.tipo} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-faint">
                <span>
                  {s.autore.nome} {s.autore.cognome}
                </span>
                <span>{formatDate(s.createdAt)}</span>
                {s._count.allegati > 0 && (
                  <span>
                    {s._count.allegati} schermat
                    {s._count.allegati === 1 ? "a" : "e"}
                  </span>
                )}
                {s.pagina && (
                  <span className="font-mono">{s.pagina}</span>
                )}
                {s.stato === "CONCLUSA" && s.conclusaIl && (
                  <span className="text-ok">
                    conclusa il {formatDate(s.conclusaIl)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ListPagination path="/segnalazioni" params={sp} page={pagination.page} pages={pagination.pages} />
      {!puoGestire && (
        <p className="text-xs text-ink-faint">
          Puoi aprire segnalazioni e seguirne lo stato. La presa in carico e la
          chiusura sono riservate a chi sviluppa.
        </p>
      )}
    </div>
  );
}
