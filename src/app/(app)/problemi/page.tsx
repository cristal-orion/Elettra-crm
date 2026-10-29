import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { commessaScope } from "@/lib/access";
import { STATI_PROBLEMA, PRIORITA_PROBLEMA } from "@/lib/cantiere-schema";
import ProblemiList from "@/components/problemi-list";
import ListFilters from "@/components/list-filters";
import { queryText } from "@/lib/list-state";
import type { Prisma } from "@/generated/prisma";

export const metadata = { title: "Problemi di cantiere — CRM Elettra" };
export default async function ProblemiPage({ searchParams }: { searchParams: Promise<{ q?: string; stato?: string; priorita?: string; vista?: string; pagina?: string }> }) {
  const user = await requireUser(); const sp = await searchParams; const q = queryText(sp.q);
  const stato = sp.stato && Object.hasOwn(STATI_PROBLEMA, sp.stato) ? sp.stato : sp.stato === "tutti" ? "tutti" : "aperti";
  const priorita = sp.priorita && Object.hasOwn(PRIORITA_PROBLEMA, sp.priorita) ? sp.priorita : "";
  const vista = sp.vista === "miei" ? "miei" : "tutti";
  const where: Prisma.ProblemaCantiereWhereInput = { commessa: commessaScope(user), stato: stato === "aperti" ? { not: "RISOLTA" } : stato === "tutti" ? undefined : stato, priorita: priorita || undefined, assegnatarioId: vista === "miei" ? user.id : undefined,
    OR: q ? [{ titolo: { contains: q, mode: "insensitive" } }, { commessa: { numero: { contains: q, mode: "insensitive" } } }, { commessa: { cliente: { ragioneSociale: { contains: q, mode: "insensitive" } } } }] : undefined };
  const total = await prisma.problemaCantiere.count({ where });
  const pages = Math.max(1, Math.ceil(total / 25)); const page = Math.min(pages, Math.max(1, Number.parseInt(sp.pagina ?? "1", 10) || 1));
  const problemi = await prisma.problemaCantiere.findMany({ where, orderBy: [{ scadenza: "asc" }, { updatedAt: "desc" }, { id: "asc" }], take: 25, skip: (page - 1) * 25, include: { commessa: { select: { numero: true, cliente: { select: { ragioneSociale: true } } } } } });
  const href = (pagina: number) => `/problemi?${new URLSearchParams({ q, stato, priorita, vista, pagina: String(pagina) })}`;
  return <div className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Problemi di cantiere</h1><p className="mt-2 text-sm text-ink-soft">Responsabili, scadenze e aggiornamenti dei lavori{user.ruolo === "PROJECT_MANAGER" ? " assegnati a te" : ""}.</p></div><Link href="/progetti" className="inline-flex min-h-12 items-center rounded-lg border border-line bg-panel px-4 text-sm font-medium text-brand-deep">Scegli cantiere e segnala problema →</Link></header>
    <ListFilters q={q} placeholder="Titolo, cantiere o cliente…" total={total} filters={[
      { name: "stato", label: "Stato", value: stato, defaultValue: "aperti", options: [{ value: "aperti", label: "Problemi aperti" }, { value: "tutti", label: "Tutti gli stati" }, ...Object.entries(STATI_PROBLEMA).map(([value, label]) => ({ value, label }))] },
      { name: "priorita", label: "Priorità", value: priorita, options: [{ value: "", label: "Tutte le priorità" }, ...Object.entries(PRIORITA_PROBLEMA).map(([value, label]) => ({ value, label }))] },
      { name: "vista", label: "Responsabile", value: vista, defaultValue: "tutti", options: [{ value: "tutti", label: "Tutti i responsabili" }, { value: "miei", label: "Assegnati a me" }] },
    ]} />
    <section className="overflow-hidden rounded-xl border border-line bg-panel"><ProblemiList problemi={problemi} /></section>
    {pages > 1 && <nav aria-label="Pagine problemi" className="flex items-center justify-between text-sm">{page > 1 ? <Link className="min-h-11 p-3 underline" href={href(page - 1)}>Precedente</Link> : <span />}<span>{page} di {pages}</span>{page < pages ? <Link className="min-h-11 p-3 underline" href={href(page + 1)}>Successiva</Link> : <span />}</nav>}
  </div>;
}
