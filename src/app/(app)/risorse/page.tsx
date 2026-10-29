import Link from "next/link";
import { z } from "zod";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { commessaScope } from "@/lib/access";
import { giornoAttivita } from "@/lib/attivita";
import { formatDate } from "@/lib/format";
import { STATI_PROGETTO_ATTIVO } from "@/lib/progetti";
import ListPagination from "@/components/list-pagination";
import RisorseFiltri from "./filtri";

export const metadata = { title: "Risorse e squadre — CRM Elettra" };
export default async function RisorsePage({ searchParams }: { searchParams: Promise<{ dal?: string; al?: string; squadra?: string; pagina?: string }> }) {
  const user = await requireUser(); const sp = await searchParams;
  const dal = z.iso.date().safeParse(sp.dal).success ? sp.dal! : giornoAttivita().toISOString().slice(0, 10);
  const al = z.iso.date().safeParse(sp.al).success && sp.al! >= dal ? sp.al! : new Date(+new Date(dal) + 6 * 86400000).toISOString().slice(0, 10);
  const where = { attivo: true, squadra: sp.squadra || undefined };
  const total = await prisma.operaio.count({ where }); const pages = Math.max(1, Math.ceil(total / 30)); const page = Math.min(pages, Math.max(1, parseInt(sp.pagina ?? "1", 10) || 1));
  const [workers, teams, accessible] = await Promise.all([
    prisma.operaio.findMany({ where, take: 30, skip: (page - 1) * 30, orderBy: [{ squadra: "asc" }, { cognome: "asc" }, { id: "asc" }], include: { assegnazioni: { where: { commessa: { stato: { in: [...STATI_PROGETTO_ATTIVO] }, dataFineLavori: null }, AND: [{ OR: [{ dal: null }, { dal: { lte: new Date(al) } }] }, { OR: [{ al: null }, { al: { gte: new Date(dal) } }] }] }, include: { commessa: { select: { id: true, numero: true, sospeso: true } } }, orderBy: { dal: "asc" } } } }),
    prisma.operaio.findMany({ where: { attivo: true, squadra: { not: null } }, distinct: ["squadra"], select: { squadra: true }, orderBy: { squadra: "asc" } }),
    prisma.commessa.findMany({ where: { ...commessaScope(user), stato: { in: [...STATI_PROGETTO_ATTIVO] } }, select: { id: true } }),
  ]);
  const ids = new Set(accessible.map((c) => c.id));
  const cls = "min-h-11 min-w-0 rounded-lg border border-line bg-panel px-3 py-2 text-sm";
  return <div className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Risorse e squadre</h1><p className="mt-2 text-sm text-ink-soft">Assegnazioni registrate dal {formatDate(new Date(dal))} al {formatDate(new Date(al))}.</p></div><Link href="/progetti/operai" className={`${cls} inline-flex items-center text-brand-deep`}>Gestisci anagrafica operai →</Link></header>
    <RisorseFiltri key={`${dal}:${al}:${sp.squadra ?? ""}`} dal={dal} al={al} squadra={sp.squadra ?? ""} squadre={teams.map((t) => t.squadra!)} />
    <p role="status" className="text-sm text-ink-soft">{total} {total === 1 ? "operaio attivo" : "operai attivi"} nel filtro selezionato.</p>
    <section className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">{workers.map((w) => <article key={w.id} className="grid min-w-0 gap-3 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"><div><h2 className="font-semibold">{w.nome} {w.cognome}</h2><p className="mt-1 text-xs text-ink-soft">{w.squadra || "Squadra da definire"} · {w.qualifica || "Qualifica da definire"}</p></div><div className="min-w-0">{!w.assegnazioni.length ? <p className="py-2 text-sm text-ink-soft">Nessuna assegnazione registrata nel periodo</p> : <ul className="space-y-2">{w.assegnazioni.map((a) => <li key={a.id} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2 text-sm">{ids.has(a.commessaId) ? <Link href={`/progetti/${a.commessaId}?tab=squadra`} className="font-medium text-brand-deep underline">Cantiere {a.commessa.numero}{a.commessa.sospeso ? " · sospeso" : ""}</Link> : <span>Assegnato a un altro cantiere</span>}<span className="text-xs text-ink-soft">{a.dal ? formatDate(a.dal) : "Inizio non indicato"} – {a.al ? formatDate(a.al) : "Fine non indicata"}</span></li>)}</ul>}</div></article>)}{!workers.length && <p className="p-6 text-sm text-ink-soft">Nessun operaio attivo per questa squadra.</p>}</section>
    <ListPagination path="/risorse" params={sp} page={page} pages={pages} /><p className="text-xs text-ink-soft">I periodi senza date sono considerati occupati. Ferie e turni non sono ancora registrati: nessuna assegnazione non garantisce disponibilità.</p><Link href="/progetti" className="inline-flex min-h-11 items-center text-sm text-brand-deep underline">Apri un cantiere per assegnare le risorse →</Link>
  </div>;
}
