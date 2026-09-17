"use client";
import { useActionState } from "react";
import { saveTask } from "./actions";
export default function TaskForm({ task }: { task?: { id: string; stato: string; updatedAt: string } }) {
  const [state, action, pending] = useActionState(saveTask, undefined);
  return <form action={action} className="space-y-3">
    {task ? <><input type="hidden" name="id" value={task.id} /><input type="hidden" name="expectedUpdatedAt" value={task.updatedAt} /><input type="hidden" name="stato" value={task.stato === "DA_FARE" ? "COMPLETATA" : "DA_FARE"} /></> : <div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1 text-sm">Attività<input name="titolo" required maxLength={300} className="min-h-11 rounded-lg border border-line px-3" /></label><label className="flex flex-col gap-1 text-sm">Scadenza<input type="date" name="scadenza" className="min-h-11 rounded-lg border border-line px-3" /></label><label className="flex flex-col gap-1 text-sm sm:col-span-2">Note<textarea name="note" rows={2} className="rounded-lg border border-line p-3" /></label></div>}
    <button disabled={pending} className="min-h-11 rounded-lg border border-line bg-panel px-4 text-sm font-medium text-brand-deep disabled:opacity-50">{pending ? "Salvataggio…" : task ? task.stato === "DA_FARE" ? "Segna completata" : "Riapri attività" : "Aggiungi attività"}</button>
    {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}{state?.ok && <p role="status" className="text-sm text-ok">{state.ok}</p>}
  </form>;
}
