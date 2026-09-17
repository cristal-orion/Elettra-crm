import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import type { Finding } from "@/lib/ai/findings";
import Markdown from "@/components/ai/markdown";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const run = await prisma.aiRun.findFirst({ where: { id: (await params).id, OR: [{ schedule: { userId: user.id } }, { notifications: { some: { userId: user.id } } }] }, include: { schedule: { select: { name: true } } } });
  if (!run) notFound();
  const report = run.findings as { findings?: Finding[]; analisiParziale?: boolean; commesseAnalizzate?: number } | null;
  const usage = run.usage as { totalTokens?: number } | null;
  return <div className="space-y-6"><Link href="/assistente/automazioni" className="text-sm text-brand-deep underline">← Controlli programmati</Link><header><h1 className="text-2xl font-bold">{run.schedule.name}</h1><p className="mt-2 text-sm text-ink-soft">{run.createdAt.toLocaleString("it-IT", { timeZone: "Europe/Rome" })} · {report?.commesseAnalizzate ?? 0} commesse analizzate{usage?.totalTokens ? ` · ${usage.totalTokens} token` : ""}</p></header>
    {run.error && <p role="status" className="rounded-lg bg-warn-soft p-4 text-sm text-warn">{run.error}</p>}
    {report?.analisiParziale && <p className="text-sm text-warn">Analisi parziale: è stato raggiunto il limite di 5.000 record per categoria.</p>}
    <section className="rounded-xl border border-line bg-panel p-5 text-sm"><Markdown text={run.summary ?? "Il controllo non ha ancora prodotto un riepilogo."} /></section>
    <section><h2 className="mb-3 text-lg font-semibold">Elementi rilevati ({report?.findings?.length ?? 0})</h2><ul className="space-y-3">{report?.findings?.map((f) => <li key={f.key} className="rounded-lg border border-line bg-panel p-4"><div className="flex flex-wrap justify-between gap-2"><Link href={f.href} className="font-medium text-brand-deep underline">{f.titolo}</Link><span className="text-xs text-ink-soft">{f.tipo.replaceAll("_", " ")}</span></div><p className="mt-2 text-sm text-ink-soft">{f.dettaglio}</p><Link href={`/assistente?${new URLSearchParams({ tipo: f.context.type, id: f.context.id, richiesta: `Analizza questa criticità e aiutami a risolverla: ${f.dettaglio}` })}`} className="mt-3 inline-block min-h-10 py-2 text-sm font-medium text-brand-deep">Lavora con l’assistente →</Link></li>)}</ul></section>
  </div>;
}
