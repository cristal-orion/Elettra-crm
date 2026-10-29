import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireOperai } from "@/lib/enums";
import { queryText } from "@/lib/list-state";
import ListFilters from "@/components/list-filters";
import ListPagination from "@/components/list-pagination";
import RisorseNavigation from "../navigation";

export const metadata = { title: "Squadre — CRM Elettra" };
export default async function SquadrePage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = queryText(sp.q);
  const where = { nome: q ? { contains: q, mode: "insensitive" as const } : undefined };
  const total = await prisma.squadra.count({ where });
  const pages = Math.max(1, Math.ceil(total / 30));
  const page = Math.min(pages, Math.max(1, parseInt(sp.pagina ?? "1", 10) || 1));
  const teams = await prisma.squadra.findMany({ where, take: 30, skip: (page - 1) * 30, orderBy: [{ attiva: "desc" }, { nome: "asc" }], include: { _count: { select: { membri: true } }, membri: { where: { attivo: true }, select: { id: true } } } });
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Squadre</h1><p className="mt-2 text-sm text-ink-soft">Composizione del personale per le assegnazioni ai cantieri.</p></div>{puoGestireOperai(user.ruolo) && <Link href="/risorse/squadre/nuova" className="inline-flex min-h-11 items-center rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white">Crea squadra</Link>}</header>
    <RisorseNavigation current="squadre" />
    <ListFilters q={q} total={total} placeholder="Cerca squadra…" filters={[]} />
    <section className="divide-y divide-line rounded-xl border border-line bg-panel">
      {teams.map((s) => <article key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><h2 className="break-words text-base font-semibold">{s.nome}</h2><p className="mt-1 text-sm text-ink-soft">{s.membri.length} attivi su {s._count.membri} componenti · {s.attiva ? "Attiva" : "Archiviata"}</p></div><Link href={`/risorse/squadre/${s.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-brand-deep underline">Apri squadra →</Link></article>)}
      {!teams.length && <p className="p-5 text-sm text-ink-soft">Nessuna squadra trovata. Crea una squadra per raggruppare il personale.</p>}
    </section>
    <ListPagination path="/risorse/squadre" params={sp} page={page} pages={pages} />
  </div>;
}
