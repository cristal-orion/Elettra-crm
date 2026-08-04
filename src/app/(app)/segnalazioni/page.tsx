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
import type { Prisma } from "@/generated/prisma";

export const metadata = { title: "Segnalazioni — CRM Elettra" };

const VISTE = {
  aperte: "Da lavorare",
  concluse: "Concluse",
  tutte: "Tutte",
} as const;

type Vista = keyof typeof VISTE;

/** Prima le più urgenti: alta priorità in cima, poi le più recenti. */
const PESO_PRIORITA: Record<string, number> = { ALTA: 0, MEDIA: 1, BASSA: 2 };

export default async function SegnalazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const vista: Vista = sp.vista && sp.vista in VISTE ? (sp.vista as Vista) : "aperte";
  const q = (sp.q ?? "").trim();

  const user = await requireUser();
  const puoGestire = puoGestireSegnalazioni(user.ruolo);

  const where: Prisma.SegnalazioneWhereInput = {};
  if (vista === "aperte") where.stato = { in: ["APERTA", "IN_LAVORAZIONE"] };
  if (vista === "concluse") where.stato = "CONCLUSA";
  if (q) {
    where.OR = [
      { titolo: { contains: q } },
      { descrizione: { contains: q } },
    ];
  }

  const segnalazioni = await prisma.segnalazione.findMany({
    where,
    include: {
      autore: { select: { nome: true, cognome: true } },
      _count: { select: { allegati: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const ordinate = [...segnalazioni].sort((a, b) => {
    // Le concluse scendono in fondo anche nella vista "tutte".
    const chiusa = Number(a.stato === "CONCLUSA") - Number(b.stato === "CONCLUSA");
    if (chiusa !== 0) return chiusa;
    const p = (PESO_PRIORITA[a.priorita] ?? 1) - (PESO_PRIORITA[b.priorita] ?? 1);
    if (p !== 0) return p;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

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

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cerca nel titolo o nel testo…"
          className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3.5 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <select
          name="vista"
          defaultValue={vista}
          className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-soft outline-none focus:border-brand"
        >
          {Object.entries(VISTE).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
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
              className={`rounded-xl border bg-panel p-5 transition hover:border-brand/40 ${
                s.stato === "CONCLUSA" ? "border-line/60 opacity-75" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      href={`/segnalazioni/${s.id}`}
                      className="text-sm font-semibold hover:text-brand-deep"
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

      {!puoGestire && (
        <p className="text-xs text-ink-faint">
          Puoi aprire segnalazioni e seguirne lo stato. La presa in carico e la
          chiusura sono riservate a chi sviluppa.
        </p>
      )}
    </div>
  );
}
