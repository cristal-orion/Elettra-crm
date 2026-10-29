import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { formatEuro, formatDateTime } from "@/lib/format";
import TodayTasks from "@/components/today-tasks";
import ProblemiList from "@/components/problemi-list";
import { getTodayTasks } from "@/lib/today-tasks";
import { getDashboard } from "@/lib/dashboard";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const user = await requireUser(); const sp = await searchParams;
  const [data, tasks] = await Promise.all([getDashboard(prisma, user, sp.periodo), getTodayTasks(prisma, user)]);
  const max = Math.max(1, ...data.commerciale.map((f) => f.totale));
  const vinte = data.commerciale.filter((f) => f.categoria === "VINTA").reduce((n, f) => n + f.totale, 0);
  const perse = data.commerciale.filter((f) => f.categoria === "PERSA").reduce((n, f) => n + f.totale, 0);
  return <div className="space-y-7"><header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Cruscotto operativo</h1><p className="mt-2 text-sm text-ink-soft">{user.nome}, ecco le priorità {user.ruolo === "PROJECT_MANAGER" ? "dei cantieri assegnati a te" : "di oggi"}.</p></div><p className="text-xs text-ink-soft">Dati al {formatDateTime(data.aggiornatoIl)}</p></header>
    <section aria-label="Situazione cantieri" className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
      { label: "Cantieri aperti", value: data.aperti, href: "/progetti?vista=attivi" },
      { label: "In ritardo", value: data.ritardo, href: "/progetti?vista=attivi&avanzamento=IN_RITARDO" },
      { label: "Sospesi", value: data.sospesi, href: "/progetti?vista=attivi&avanzamento=SOSPESO" },
      { label: "Problemi aperti", value: data.problemi, href: "/problemi" },
    ].map((c) => <Link key={c.label} href={c.href} className="min-w-0 rounded-xl border border-line bg-panel p-4 hover:border-brand sm:p-5"><p className="text-sm text-ink-soft">{c.label}</p><p className={`mt-2 text-3xl font-semibold tabular-nums ${c.label === "In ritardo" && c.value ? "text-danger" : "text-ink"}`}>{c.value}</p><p className="mt-3 text-xs text-brand-deep">Apri elenco →</p></Link>)}</section>
    <TodayTasks data={tasks} />
    <section className="overflow-hidden rounded-xl border border-line bg-panel"><header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-6"><h2 className="text-sm font-semibold">Problemi da seguire</h2><Link href="/problemi" className="inline-flex min-h-11 items-center text-sm text-brand-deep underline">Tutti ({data.problemi}) →</Link></header><ProblemiList problemi={data.recenti} /></section>
    {data.rendiconti && <section className="rounded-xl border border-line bg-panel p-4 sm:p-6"><header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Consuntivi ore e materiali</h2><p className="mt-1 text-xs text-ink-soft">Rendiconti registrati, secondo la data del lavoro.</p></div><nav aria-label="Periodo consuntivi" className="flex flex-wrap gap-2">{[["30", "30 giorni"], ["90", "90 giorni"], ["tutti", "Tutto lo storico"]].map(([value, label]) => <Link key={value} href={`/?periodo=${value}`} aria-current={data.periodo === value ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm ${data.periodo === value ? "bg-brand-soft font-medium text-brand-deep" : "border border-line text-ink-soft"}`}>{label}</Link>)}</nav></header>
      <dl className="mt-5 grid gap-5 sm:grid-cols-3">{[["Totale rendicontato", data.rendiconti._sum.totale], ["Manodopera valorizzata", data.rendiconti._sum.totaleOre], ["Materiali valorizzati", data.rendiconti._sum.totaleMateriali]].map(([label, value]) => <div key={String(label)}><dt className="text-sm text-ink-soft">{String(label)}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{data.rendiconti!._count._all ? formatEuro(value) : "—"}</dd></div>)}</dl>
      <p className="mt-5 text-xs text-ink-soft">{data.rendiconti._count._all ? `${data.rendiconti._count._all} rendiconti. Valori alle tariffe applicate al cliente; non sono costi interni, ordini acquisiti o incassi.` : "Nessun rendiconto nel periodo. Un dato mancante non equivale a un importo pari a zero."}</p><Link href={`/consuntivi?periodo=${data.periodo}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand-deep underline">Apri rendiconti del periodo →</Link>
    </section>}
    {data.rendiconti && <section className="rounded-xl border border-line bg-panel p-4 sm:p-6"><header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Pipeline commerciale</h2><p className="mt-1 text-xs text-ink-soft">Tutte le trattative · conversione sulle chiuse: {vinte + perse ? `${Math.round(vinte / (vinte + perse) * 100)}%` : "non disponibile"}</p></div><Link href="/commerciale" className="inline-flex min-h-11 items-center text-sm text-brand-deep underline">Apri Commerciale →</Link></header><div className="mt-4 space-y-1">{data.commerciale.map((f) => <Link key={f.id} href={`/commerciale?fase=${f.id}&vista=elenco`} className="grid min-h-12 grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2rem] items-center gap-3 text-sm"><span className="break-words text-ink-soft">{f.nome}</span><span className="h-2 overflow-hidden rounded-full bg-paper"><span className="block h-full rounded-full bg-brand" style={{ width: `${f.totale / max * 100}%` }} /></span><span className="text-right font-semibold tabular-nums">{f.totale}</span></Link>)}{!data.commerciale.length && <p className="text-sm text-ink-soft">Nessuna trattativa registrata.</p>}</div></section>}
  </div>;
}
