"use client";

import { useState } from "react";

const input = "min-h-11 w-full min-w-0 rounded-lg border border-line bg-panel px-3 py-2 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:text-sm";

export default function RisorseFiltri({ dal, al, squadra, squadre }: { dal: string; al: string; squadra: string; squadre: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const [inizio, setInizio] = useState(dal);
  return <section aria-label="Filtri risorse" className="rounded-xl border border-line bg-panel p-4">
    <button type="button" aria-expanded={expanded} aria-controls="filtri-risorse" onClick={() => setExpanded(!expanded)} className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-medium text-brand-deep sm:hidden">
      <span>Periodo e squadra{ squadra ? ` · ${squadra}` : "" }</span><span aria-hidden>{expanded ? "−" : "+"}</span>
    </button>
    <form id="filtri-risorse" method="get" className={`${expanded ? "grid" : "hidden sm:grid"} grid-cols-2 items-end gap-3 ${expanded ? "mt-3 sm:mt-0" : ""} lg:grid-cols-[1fr_1fr_1.4fr_auto]`}>
      <label className="flex min-w-0 flex-col gap-2 text-sm">Dal<input name="dal" type="date" value={inizio} onChange={(e) => setInizio(e.target.value)} className={input} required /></label>
      <label className="flex min-w-0 flex-col gap-2 text-sm">Al<input name="al" type="date" defaultValue={al} min={inizio} className={input} required /></label>
      <label className="col-span-2 flex min-w-0 flex-col gap-2 text-sm sm:col-span-1">Squadra<select name="squadra" aria-label="Squadra" defaultValue={squadra} className={input}><option value="">Tutte le squadre</option>{squadre.map((team) => <option key={team} value={team}>{team}</option>)}</select></label>
      <button type="submit" className="col-span-2 min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep sm:col-span-1">Mostra periodo</button>
    </form>
    {squadra && <p className="mt-3 hidden text-xs text-ink-soft sm:block">Squadra selezionata: {squadra}</p>}
  </section>;
}
