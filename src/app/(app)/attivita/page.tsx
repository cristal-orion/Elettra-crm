import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import TaskForm from "./task-form";
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ stato?: string }> }) {
  const user = await requireUser();
  const stato = (await searchParams).stato === "COMPLETATA" ? "COMPLETATA" : "DA_FARE";
  const tasks = await prisma.attivita.findMany({ where: { userId: user.id, stato }, orderBy: [{ scadenza: "asc" }, { createdAt: "desc" }], include: { commessa: { select: { numero: true } }, cliente: { select: { ragioneSociale: true } } } });
  return <div className="space-y-6"><header><h1 className="text-2xl font-bold">Le mie attività</h1><p className="mt-1 text-sm text-ink-soft">Follow-up e prossimi passi, creati da te o dall’assistente.</p></header><details className="rounded-xl border border-line bg-panel p-5"><summary className="min-h-11 cursor-pointer py-2 font-semibold">+ Nuova attività</summary><TaskForm /></details><nav className="flex gap-3" aria-label="Stato attività">{["DA_FARE", "COMPLETATA"].map((s) => <Link key={s} href={`/attivita?stato=${s}`} aria-current={stato === s ? "page" : undefined} className={`min-h-11 rounded-lg px-4 py-3 text-sm ${stato === s ? "bg-brand-soft font-semibold text-brand-deep" : "bg-panel"}`}>{s === "DA_FARE" ? "Da fare" : "Completate"}</Link>)}</nav>
    {!tasks.length && <p className="rounded-xl border border-line bg-panel p-5 text-sm text-ink-soft">Nessuna attività {stato === "DA_FARE" ? "da completare. Puoi aggiungerne una qui o chiederlo all’assistente." : "completata."}</p>}
    <ul className="space-y-3">{tasks.map((t) => <li key={t.id} className="space-y-3 rounded-xl border border-line bg-panel p-5"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{t.titolo}</h2><span className="text-sm text-ink-soft">{t.scadenza ? formatDate(t.scadenza) : "Senza scadenza"}</span></div>{t.note && <p className="whitespace-pre-wrap text-sm text-ink-soft">{t.note}</p>}<div className="flex flex-wrap gap-4 text-sm">{t.commessaId && <Link href={`/commesse/${t.commessaId}`} className="text-brand-deep underline">Commessa {t.commessa?.numero}</Link>}{t.clienteId && <Link href={`/anagrafiche/${t.clienteId}`} className="text-brand-deep underline">{t.cliente?.ragioneSociale}</Link>}</div><TaskForm task={{ id: t.id, stato: t.stato, updatedAt: t.updatedAt.toISOString() }} /></li>)}</ul>
  </div>;
}
