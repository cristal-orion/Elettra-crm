"use client";

import { useActionState } from "react";
import { setRead } from "./actions";

export default function NotificationControls({ id = null, letta = false, disabled = false }: { id?: string | null; letta?: boolean; disabled?: boolean }) {
  const [state, action, pending] = useActionState(setRead.bind(null, id, !letta), undefined);
  return (
    <form action={action} className="space-y-2">
      <button disabled={pending || disabled} className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm text-brand-deep hover:bg-brand-soft disabled:opacity-50">{pending ? "Aggiornamento…" : id ? letta ? "Segna da leggere" : "Segna come letta" : disabled ? "Nessuna notifica da leggere" : "Segna tutte come lette"}</button>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="text-xs text-ok">{state.ok}</p>}
    </form>
  );
}
