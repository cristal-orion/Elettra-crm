"use client";
import { useActionState } from "react";
import { saveSchedule, runNow, toggleSchedule } from "./actions";

const cls = "min-h-11 rounded-lg border border-line bg-panel px-3 py-2 text-sm";
type Values = { id: string; name: string; hour: number; minute: number; weekdaysOnly: boolean; followupDays: number; horizonDays: number; recipientIds: string[] };
export function ScheduleForm({ users, initial }: { users: { id: string; nome: string; cognome: string }[]; initial?: Values }) {
  const [state, action, pending] = useActionState(saveSchedule, undefined);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="id" value={initial?.id ?? ""} />
    <label className="flex flex-col gap-1 text-sm">Nome del controllo<input name="name" required maxLength={150} defaultValue={initial?.name ?? "Priorità di commesse e cantieri"} className={cls} /></label>
    <div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-1 text-sm">Ora (Italia)<input type="number" name="hour" min={0} max={23} defaultValue={initial?.hour ?? 8} required className={cls} /></label><label className="flex flex-col gap-1 text-sm">Minuti<input type="number" name="minute" min={0} max={59} defaultValue={initial?.minute ?? 0} required className={cls} /></label>
      <label className="flex flex-col gap-1 text-sm">Follow-up fermi da giorni<input type="number" name="followupDays" min={1} max={365} defaultValue={initial?.followupDays ?? 14} required className={cls} /></label><label className="flex flex-col gap-1 text-sm">Scadenze entro giorni<input type="number" name="horizonDays" min={1} max={60} defaultValue={initial?.horizonDays ?? 7} required className={cls} /></label></div>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="weekdaysOnly" defaultChecked={initial?.weekdaysOnly ?? true} />Solo dal lunedì al venerdì</label>
    <fieldset><legend className="mb-2 text-sm font-medium">Destinatari delle notifiche</legend><div className="grid gap-1 sm:grid-cols-2">{users.map((u) => <label key={u.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="recipientIds" value={u.id} defaultChecked={initial?.recipientIds.includes(u.id)} />{u.nome} {u.cognome}</label>)}</div></fieldset>
    <p className="text-xs text-ink-soft">Controlla follow-up, pianificazione, ritardi, scadenze, dati mancanti e sovrapposizioni. Produce un riepilogo; le proposte si eseguono dalla chat.</p>
    {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}{state?.ok && <p role="status" className="text-sm text-ok">{state.ok}</p>}
    <button disabled={pending} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Salvataggio…" : "Salva pianificazione"}</button>
  </form>;
}
export function ScheduleControls({ id, enabled }: { id: string; enabled: boolean }) {
  const [run, runAction, running] = useActionState(runNow.bind(null, id), undefined);
  const [toggle, toggleAction, toggling] = useActionState(toggleSchedule.bind(null, id), undefined);
  return <div className="space-y-2"><div className="flex flex-wrap gap-2"><form action={runAction}><button disabled={running || toggling} className={cls}>{running ? "Controllo in corso…" : "Esegui ora"}</button></form><form action={toggleAction}><button disabled={running || toggling} className={cls}>{enabled ? "Sospendi" : "Attiva"}</button></form></div>{(run?.error || toggle?.error) && <p role="alert" className="text-sm text-danger">{run?.error ?? toggle?.error}</p>}{(run?.ok || toggle?.ok) && <p role="status" className="text-sm text-ok">{run?.ok ?? toggle?.ok}</p>}</div>;
}
