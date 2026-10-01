"use client";

import { useActionState } from "react";
import { deleteTask, toggleTask } from "./actions";

export default function TaskActions({ task }: { task: { id: string; titolo: string; stato: string; updatedAt: string } }) {
  const [toggle, toggleAction, toggling] = useActionState(toggleTask.bind(null, task.id, task.updatedAt, task.stato === "COMPLETATA" ? "DA_FARE" : "COMPLETATA"), undefined);
  const [deletion, deleteAction, deleting] = useActionState(deleteTask.bind(null, task.id, task.updatedAt), undefined);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <form action={toggleAction}><button disabled={toggling || deleting} aria-label={`${task.stato === "COMPLETATA" ? "Riapri" : "Completa"} ${task.titolo}`} className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm font-medium text-brand-deep hover:bg-brand-soft disabled:opacity-50">{toggling ? "Salvataggio…" : task.stato === "COMPLETATA" ? "Riapri attività" : "Segna completata"}</button></form>
        <form action={deleteAction} onSubmit={(event) => { if (!confirm(`Eliminare definitivamente l’attività “${task.titolo}”? Le commesse e le anagrafiche collegate saranno conservate.`)) event.preventDefault(); }}><button disabled={toggling || deleting} aria-label={`Elimina ${task.titolo}`} className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm text-danger hover:bg-danger-soft disabled:opacity-50">{deleting ? "Eliminazione…" : "Elimina"}</button></form>
      </div>
      {(toggle?.error || deletion?.error) && <p role="alert" className="text-sm text-danger">{toggle?.error ?? deletion?.error}</p>}
      {toggle?.ok && <p role="status" className="text-sm text-ok">{toggle.ok}</p>}
    </div>
  );
}
