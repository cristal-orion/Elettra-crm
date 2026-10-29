import Link from "next/link";
import { formatDate } from "@/lib/format";
import { attivitaHref } from "@/lib/attivita";
import type { getTodayTasks } from "@/lib/today-tasks";
import TaskActions from "@/app/(app)/attivita/task-actions";

export default function TodayTasks({ data }: { data: Awaited<ReturnType<typeof getTodayTasks>> }) {
  return <section aria-labelledby="today-tasks-title" className="min-w-0 rounded-xl border border-brand/30 bg-panel p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="today-tasks-title" className="text-lg font-semibold">Da fare oggi</h2>
        <p className="mt-1 text-sm text-ink-soft">Le attività assegnate a te · {formatDate(data.date)} · giorno italiano</p>
      </div>
      <Link href="/attivita/nuova" className="inline-flex min-h-11 items-center rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">+ Nuova attività</Link>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {data.cards.map((card) => <Link key={card.key} href={card.href} aria-label={`${card.label}: ${card.count} attività`}
        className="min-w-0 rounded-lg border border-line bg-paper/50 p-3 transition hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:p-4">
        <p className="text-xs text-ink-soft">{card.label}</p>
        <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${card.key === "scadute" && card.count > 0 ? "text-danger" : "text-ink"}`}>{card.count}</p>
        <span className="mt-1 block text-xs text-brand-deep">Apri elenco →</span>
      </Link>)}
    </div>
    <p role="status" className="mt-4 text-sm text-ink-soft">{data.due} attività scadute o in scadenza oggi · {data.total} attività aperte assegnate a te.</p>
    {data.tasks.length === 0 ? <p className="mt-3 rounded-lg bg-paper/50 p-4 text-sm text-ink-soft">
      {data.total === 0 ? "Non hai attività aperte. Crea un’attività per pianificare il prossimo passo." : "Nessuna attività scaduta o in scadenza oggi. Puoi consultare le attività pianificate o quelle senza scadenza."}
    </p> : <ul className="mt-2 divide-y divide-line">
      {data.tasks.map((task) => <li key={`${task.id}:${task.updatedAt.toISOString()}`} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 py-4">
        <div className="min-w-0 flex-[1_1_18rem]">
          <Link href={attivitaHref(task.id)} className="inline-block min-h-11 max-w-full break-words py-2.5 text-sm font-semibold text-brand-deep underline decoration-brand/30 underline-offset-4 focus-visible:outline-2 focus-visible:outline-brand">{task.titolo}</Link>
          <p className={`text-xs ${task.scadenza && task.scadenza < data.date ? "text-danger" : "text-warn"}`}>{task.scadenza && task.scadenza < data.date ? "Scaduta" : "Oggi"} · {formatDate(task.scadenza)}</p>
          <div className="flex flex-wrap gap-x-4 text-xs">
            {task.commessa && <Link href={`/commesse/${task.commessa.id}`} className="inline-flex min-h-11 items-center text-brand-deep underline">Commessa {task.commessa.numero}</Link>}
            {task.cliente && <Link href={`/anagrafiche/${task.cliente.id}`} className="inline-flex min-h-11 max-w-full items-center break-words py-2 text-brand-deep underline">{task.cliente.ragioneSociale}</Link>}
          </div>
        </div>
        <TaskActions task={{ id: task.id, problemaId: task.problemaId, titolo: task.titolo, stato: task.stato, updatedAt: task.updatedAt.toISOString() }} showDelete={false} />
      </li>)}
    </ul>}
    <div className="mt-3 flex flex-wrap justify-between gap-x-5 gap-y-2 border-t border-line pt-2 text-sm">
      {data.due > 0 && <Link href={data.dueHref} className="inline-flex min-h-11 items-center text-brand-deep underline">{data.tasks.length} di {data.due} · Vedi tutte le attività entro oggi →</Link>}
      <Link href={data.allHref} className="inline-flex min-h-11 items-center text-brand-deep underline">Tutte le mie attività aperte ({data.total}) →</Link>
    </div>
  </section>;
}
