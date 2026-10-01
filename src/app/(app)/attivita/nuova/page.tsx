import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { puoGestireCommesse } from "@/lib/enums";
import TaskForm from "../task-form";
import { getTaskOptions } from "../data";

export const metadata = { title: "Nuova attività — CRM Elettra" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ commessaId?: string; clienteId?: string }> }) {
  const user = await requireUser();
  const options = await getTaskOptions(user);
  const params = await searchParams;
  const commessa = options.commesse.find((c) => c.id === params.commessaId);
  const clienteId = commessa?.clienteId ?? options.clienti.find((c) => c.id === params.clienteId)?.id ?? "";
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header><Link href="/attivita" className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep">← Attività</Link><h1 className="mt-2 text-2xl font-bold tracking-tight">Nuova attività</h1><p className="mt-1 text-sm text-ink-soft">Pianifica un follow-up, un controllo o un prossimo passo operativo.</p></header>
      <TaskForm options={options} canAssign={puoGestireCommesse(user.ruolo)} initial={{ titolo: "", note: "", scadenza: "", stato: "DA_FARE", userId: user.id, commessaId: commessa?.id ?? "", clienteId }} />
    </div>
  );
}
