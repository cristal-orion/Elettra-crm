"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { salvaSquadra, assegnaSquadra, type SquadraState } from "./actions";
import AvvisiAssegnazioni from "@/components/avvisi-assegnazioni";

const input = "min-h-11 min-w-0 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-brand";
const button = "min-h-11 rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";
function Esito({ state }: { state: SquadraState }) {
  return state?.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : state?.ok ? <><p role="status" className="text-sm text-ok">{state.ok}</p><AvvisiAssegnazioni warnings={state.warnings} /></> : null;
}

export function SquadraForm({ squadra, operai, puoModificare }: {
  squadra?: { id: string; nome: string; note: string | null; attiva: boolean; versione: string; membri: string[] };
  operai: { id: string; nome: string; cognome: string; qualifica: string | null; attivo: boolean; squadre: { nome: string }[] }[];
  puoModificare: boolean;
}) {
  const [state, action, pending] = useActionState(salvaSquadra.bind(null, squadra?.id ?? null), undefined);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(squadra?.membri ?? []);
  const router = useRouter();
  useEffect(() => { if (state?.href) router.push(state.href); }, [state, router]);
  const shown = operai.filter((o) => `${o.nome} ${o.cognome} ${o.qualifica ?? ""}`.toLocaleLowerCase("it").includes(query.toLocaleLowerCase("it")));
  return <form action={action} className="space-y-5">
    <input type="hidden" name="expectedUpdatedAt" value={squadra?.versione ?? ""} />
    {selected.map((id) => <input key={id} type="hidden" name="membri" value={id} />)}
    <fieldset disabled={pending || !puoModificare} className="space-y-4">
      <label className="flex flex-col gap-2 text-sm font-medium">Nome squadra<input name="nome" required maxLength={150} defaultValue={squadra?.nome ?? ""} className={input} /></label>
      <label className="flex flex-col gap-2 text-sm font-medium">Note<textarea name="note" maxLength={5000} rows={2} defaultValue={squadra?.note ?? ""} className={input} /></label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input name="attiva" type="checkbox" defaultChecked={squadra?.attiva ?? true} className="h-5 w-5 accent-brand" />Squadra attiva (assegnabile ai cantieri)</label>
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Componenti · {selected.length}</h2>
        <p className="text-sm text-ink-soft">Ogni persona può far parte di più squadre. Aggiungere o togliere un componente qui non modifica le altre squadre.</p>
        <label className="flex flex-col gap-2 text-sm">Cerca un componente<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className={input} /></label>
        <div className="max-h-96 overflow-y-auto rounded-lg border border-line">
          {shown.map((o) => <label key={o.id} className="flex min-h-14 items-center gap-3 border-b border-line px-3 py-2 last:border-0"><input type="checkbox" checked={selected.includes(o.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id))} className="h-5 w-5 shrink-0 accent-brand" /><span className="min-w-0 break-words text-sm"><span className="font-medium">{o.cognome} {o.nome}</span><span className="block text-xs text-ink-soft">{o.qualifica || "Qualifica da indicare"}{!o.attivo ? " · non attivo, escluso dalle nuove assegnazioni" : ""}</span>{o.squadre.length > 0 && <span className="block text-xs text-ink-soft">Squadre: {o.squadre.map((s) => s.nome).join(", ")}</span>}</span></label>)}
          {!shown.length && <p className="p-4 text-sm text-ink-soft">Nessun componente disponibile per questa ricerca.</p>}
        </div>
      </section>
    </fieldset>
    <p className="text-sm text-ink-soft">Modifiche ai componenti e archiviazione valgono per le nuove assegnazioni. Date, ruoli e persone già assegnate si gestiscono nel singolo cantiere.</p>
    <Esito state={state} />
    {puoModificare && <button disabled={pending} className={button}>{pending ? "Salvataggio…" : "Salva squadra"}</button>}
  </form>;
}

export function AssegnaSquadraForm({ commessaId, squadre }: {
  commessaId: string;
  squadre: { id: string; nome: string; versione: string; membri: string[] }[];
}) {
  const [id, setId] = useState("");
  const selected = squadre.find((s) => s.id === id);
  const [state, action, pending] = useActionState(assegnaSquadra.bind(null, commessaId), undefined);
  return <form action={action} className="space-y-4 rounded-lg border border-line bg-paper p-4">
    <h3 className="text-sm font-semibold">Assegna una squadra completa</h3>
    <input type="hidden" name="expectedUpdatedAt" value={selected?.versione ?? ""} />
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr]">
      <label className="flex min-w-0 flex-col gap-2 text-sm">Squadra<select name="squadraId" required value={id} onChange={(e) => setId(e.target.value)} className={input}><option value="">Scegli una squadra…</option>{squadre.map((s) => <option key={s.id} value={s.id} disabled={!s.membri.length}>{s.nome} · {s.membri.length} attivi</option>)}</select></label>
      <label className="flex min-w-0 flex-col gap-2 text-sm">Dal<input name="dal" type="date" className={input} /></label>
      <label className="flex min-w-0 flex-col gap-2 text-sm">Al<input name="al" type="date" className={input} /></label>
    </fieldset>
    {selected && <p className="text-sm text-ink-soft">Componenti attivi: {selected.membri.join(", ") || "nessuno"}.</p>}
    <p className="text-xs text-ink-soft">Aggiunge i componenti attivi e conserva le assegnazioni già presenti. Gli impegni su altri cantieri vengono segnalati senza bloccare il salvataggio. Date vuote indicano un periodo aperto.</p>
    <Esito state={state} />
    <button disabled={pending || !selected?.membri.length} className={button}>{pending ? "Assegnazione…" : "Assegna squadra al cantiere"}</button>
  </form>;
}
