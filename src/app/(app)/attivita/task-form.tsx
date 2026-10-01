"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import SearchableSelect from "@/components/searchable-select";
import { saveTask } from "./actions";
import type { TaskOptions } from "./data";

export type TaskValues = {
  id?: string; expectedUpdatedAt?: string; titolo: string; note: string;
  scadenza: string; stato: string; userId: string; commessaId: string; clienteId: string;
};

export default function TaskForm({ options, initial, canAssign }: {
  options: TaskOptions; initial: TaskValues; canAssign: boolean;
}) {
  const [state, action, pending] = useActionState(saveTask, undefined);
  const [commessaId, setCommessaId] = useState(initial.commessaId);
  const [clienteId, setClienteId] = useState(initial.clienteId);
  const commessa = options.commesse.find((c) => c.id === commessaId);
  const cls = "min-h-11 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <form action={action} className="space-y-5">
      {initial.id && <><input type="hidden" name="id" value={initial.id} /><input type="hidden" name="expectedUpdatedAt" value={initial.expectedUpdatedAt} /></>}
      <fieldset disabled={pending} className="grid gap-4 rounded-xl border border-line bg-panel p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Dati dell’attività</legend>
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">Titolo *<input name="titolo" required maxLength={300} defaultValue={initial.titolo} className={cls} /></label>
        <label className="flex flex-col gap-1.5 text-sm">Scadenza<input type="date" name="scadenza" defaultValue={initial.scadenza} className={cls} /></label>
        {initial.id ? <label className="flex flex-col gap-1.5 text-sm">Stato<select name="stato" defaultValue={initial.stato} className={cls}><option value="DA_FARE">Da fare</option><option value="COMPLETATA">Completata</option></select></label> : <p className="self-end pb-3 text-xs text-ink-soft">La nuova attività sarà inserita tra quelle da fare.</p>}
        <div className="flex flex-col gap-1.5 text-sm">
          <span>Responsabile *</span>
          {canAssign ? <SearchableSelect name="userId" label="Responsabile" required defaultValue={initial.userId} disabled={pending} options={options.utenti.map((u) => ({ value: u.id, label: `${u.nome} ${u.cognome}${u.attivo ? "" : " (disattivato)"}` }))} /> : <><input type="hidden" name="userId" value={initial.userId} /><p className="py-3 text-ink-soft">Assegnata a te</p></>}
        </div>
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">Note<textarea name="note" maxLength={10000} rows={4} defaultValue={initial.note} className={cls} /></label>
      </fieldset>

      <fieldset disabled={pending} className="grid gap-4 rounded-xl border border-line bg-panel p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Collegamenti nel CRM</legend>
        <div className="flex flex-col gap-1.5 text-sm">
          <span>Commessa</span>
          <SearchableSelect name="commessaId" label="Commessa" value={commessaId} disabled={pending} placeholder="Nessuna commessa" searchPlaceholder="Numero o cliente…" options={options.commesse.map((c) => ({ value: c.id, label: `${c.numero} · ${c.cliente.ragioneSociale}` }))} onValueChange={(id) => {
            setCommessaId(id);
            if (id) setClienteId(options.commesse.find((c) => c.id === id)?.clienteId ?? "");
          }} />
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          <span>Cliente / anagrafica</span>
          {commessa ? <><input type="hidden" name="clienteId" value={commessa.clienteId} /><p className="py-3 text-ink-soft">{commessa.cliente.ragioneSociale}</p></> : <SearchableSelect name="clienteId" label="Cliente o anagrafica" value={clienteId} disabled={pending} onValueChange={setClienteId} placeholder="Nessun collegamento" options={options.clienti.map((c) => ({ value: c.id, label: `${c.codiceCliente ? `${c.codiceCliente} · ` : ""}${c.ragioneSociale}` }))} />}
        </div>
        <p className="text-xs text-ink-soft sm:col-span-2">Scegliendo una commessa, il cliente viene collegato automaticamente. Puoi anche creare un’attività generale senza collegamenti.</p>
      </fieldset>
      {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{state.error}</p>}
      <div className="flex flex-wrap gap-3">
        <button disabled={pending} className="min-h-11 rounded-lg bg-elettra px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Salvataggio…" : initial.id ? "Salva modifiche" : "Crea attività"}</button>
        <Link href="/attivita" className="min-h-11 rounded-lg border border-line px-5 py-2.5 text-sm text-ink-soft hover:bg-panel">Torna all’elenco</Link>
      </div>
    </form>
  );
}
