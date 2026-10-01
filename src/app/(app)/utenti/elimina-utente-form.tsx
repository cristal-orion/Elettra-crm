"use client";

import { useActionState } from "react";
import Link from "next/link";
import { etichettaRuolo } from "@/lib/enums";
import { deleteUtente } from "./actions";

export default function EliminaUtenteForm({ id, email, haDati, richiedePM, subentranti }: {
  id: string;
  email: string;
  haDati: boolean;
  richiedePM: boolean;
  subentranti: { id: string; nome: string; cognome: string; ruolo: string }[];
}) {
  const [state, action, pending] = useActionState(deleteUtente.bind(null, id), undefined);
  const bloccato = haDati && subentranti.length === 0;
  const inputCls = "min-h-11 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <form action={action} className="flex flex-col gap-5 rounded-xl border border-danger/30 bg-panel p-5">
      <div>
        <h2 className="font-semibold text-danger">Eliminazione definitiva</h2>
        <p className="mt-2 text-sm text-ink-soft">L’utente non potrà più accedere. Le sue conversazioni AI, operazioni AI, automazioni e notifiche personali saranno eliminate. Questa operazione non è annullabile.</p>
        <p className="mt-2 text-sm text-ink-soft">Se vuoi solo sospendere l’accesso conservando l’account, <Link href={`/utenti/${id}/modifica`} className="text-brand-deep underline">disattiva l’utente dalla modifica</Link>.</p>
      </div>

      {haDati && (
        <label className="flex flex-col gap-1.5 text-sm">
          Trasferisci i dati a {richiedePM ? "un Project Manager attivo" : "un utente attivo"} *
          <select name="subentranteId" required defaultValue="" disabled={pending || bloccato} className={inputCls}>
            <option value="" disabled>Seleziona il subentrante…</option>
            {subentranti.map((u) => <option key={u.id} value={u.id}>{u.nome} {u.cognome} — {etichettaRuolo(u.ruolo)}</option>)}
          </select>
        </label>
      )}
      {bloccato && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{richiedePM ? "Non ci sono altri Project Manager attivi. Crea o attiva un Project Manager prima di eliminare questo utente." : "Non ci sono altri utenti attivi disponibili per il trasferimento."}</p>}

      <label className="flex flex-col gap-1.5 text-sm">
        Per confermare, scrivi l’email {email} *
        <input name="emailConferma" type="email" required autoComplete="off" disabled={pending || bloccato} className={inputCls} />
      </label>
      {state?.error && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{state.error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending || bloccato} className="min-h-11 rounded-lg bg-danger px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Eliminazione…" : "Elimina definitivamente"}</button>
        <Link href="/utenti" className="min-h-11 rounded-lg border border-line px-5 py-2.5 text-sm text-ink-soft hover:bg-paper">Annulla</Link>
      </div>
    </form>
  );
}
