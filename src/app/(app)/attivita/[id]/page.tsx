import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { puoGestireCommesse } from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import TaskForm from "../task-form";
import TaskActions from "../task-actions";
import { getTaskOptions } from "../data";

export const metadata = { title: "Dettaglio attività — CRM Elettra" };

export default async function TaskPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ esito?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const canAssign = puoGestireCommesse(user.ruolo);
  const task = await prisma.attivita.findFirst({
    where: { id, ...(canAssign ? {} : { userId: user.id }) },
    include: { user: { select: { nome: true, cognome: true } }, commessa: { select: { numero: true } }, cliente: { select: { ragioneSociale: true } } },
  });
  if (!task) notFound();
  const options = await getTaskOptions(user, task.userId);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header>
        <Link href="/attivita" className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep">← Attività</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{task.titolo}</h1>
        <p className="mt-1 text-sm text-ink-soft">{task.user.nome} {task.user.cognome} · {task.stato === "COMPLETATA" ? "Completata" : "Da fare"} · Creata il {formatDateTime(task.createdAt)}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {task.commessaId && <Link href={`/commesse/${task.commessaId}`} className="text-brand-deep underline">Commessa {task.commessa?.numero}</Link>}
          {task.clienteId && <Link href={`/anagrafiche/${task.clienteId}`} className="text-brand-deep underline">{task.cliente?.ragioneSociale}</Link>}
        </div>
      </header>
      {(await searchParams).esito === "salvata" && <p role="status" className="rounded-lg bg-ok-soft p-4 text-sm text-ok">Attività salvata.</p>}
      <TaskForm key={task.updatedAt.toISOString()} options={options} canAssign={canAssign} initial={{ id: task.id, expectedUpdatedAt: task.updatedAt.toISOString(), titolo: task.titolo, note: task.note ?? "", scadenza: task.scadenza?.toISOString().slice(0, 10) ?? "", stato: task.stato, userId: task.userId, commessaId: task.commessaId ?? "", clienteId: task.clienteId ?? "" }} />
      <section className="rounded-xl border border-line bg-panel p-5"><h2 className="mb-3 text-sm font-semibold">Azioni rapide</h2><TaskActions task={{ id: task.id, titolo: task.titolo, stato: task.stato, updatedAt: task.updatedAt.toISOString() }} /></section>
    </div>
  );
}
