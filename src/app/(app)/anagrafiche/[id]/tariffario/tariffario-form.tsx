"use client";
import { useActionState, useState } from "react";
import type { EconomiaState } from "../../../economia-actions";
import type { TariffarioValues } from "@/lib/consuntivo-schema";
import { FASCE_ORARIE } from "@/lib/consuntivo-schema";
import SearchableSelect from "@/components/searchable-select";
import FormError from "@/components/form-error";
import { EconomicNumber, economicInput, useEconomicFormReady } from "@/components/economic-fields";

export default function TariffarioForm({ initial, prodotti, canEdit, action }: {
  initial: TariffarioValues; prodotti: { id: string; descrizione: string; codice: string | null }[]; canEdit: boolean;
  action: (state: EconomiaState, form: FormData) => Promise<EconomiaState>;
}) {
  const [state, save, pending] = useActionState(action, undefined);
  const ready = useEconomicFormReady();
  const [ore, setOre] = useState(initial.manodopera);
  const [materiali, setMateriali] = useState(initial.materiali.map(({ id, prodottoId, ricarico }) => ({ id, prodottoId, ricarico })));
  return <form action={save} className="space-y-6">
    <input type="hidden" name="dati" value={JSON.stringify({ versione: initial.versione, manodopera: ore, materiali })} />
    <fieldset disabled={!canEdit || !ready || pending} className="min-w-0 space-y-5 rounded-xl border border-line bg-panel p-4 sm:p-6">
      <legend className="px-1 font-semibold">Tariffe orarie per mansione</legend>
      <p className="text-sm text-ink-soft">Importi da addebitare al cliente per ogni ora. La mansione professionale è distinta dal ruolo di accesso al CRM.</p>
      {ore.length === 0 && <p className="text-sm text-ink-soft">Nessuna tariffa oraria configurata.</p>}
      {ore.map((r, i) => <div key={r.id} className="space-y-3 rounded-lg border border-line p-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft">Mansione<input required maxLength={100} value={r.mansione} onChange={(e) => setOre(ore.map((x, n) => n === i ? { ...x, mansione: e.target.value } : x))} className={economicInput} /></label>
          {Object.entries(FASCE_ORARIE).map(([key, label]) => <EconomicNumber key={key} label={`${label} (€/h)`} value={r[key as keyof typeof FASCE_ORARIE]} onChange={(value) => setOre(ore.map((x, n) => n === i ? { ...x, [key]: value } : x))} />)}
        </div>
        {canEdit && <button type="button" className="min-h-11 text-sm text-danger underline" onClick={() => setOre(ore.filter((_, n) => n !== i))}>Rimuovi mansione</button>}
      </div>)}
      {canEdit && <button type="button" className="min-h-11 rounded-lg border border-line px-3 text-sm text-brand-deep" onClick={() => setOre([...ore, { id: crypto.randomUUID(), mansione: "", ordinaria: "", straordinariaFeriale: "", straordinariaFestiva: "" }])}>+ Aggiungi mansione</button>}
    </fieldset>
    <fieldset disabled={!canEdit || !ready || pending} className="min-w-0 space-y-4 rounded-xl border border-line bg-panel p-4 sm:p-6">
      <legend className="px-1 font-semibold">Ricarichi per materiale</legend>
      <p className="text-sm text-ink-soft">Ricarico percentuale sul costo base unitario inserito nel consuntivo. Esempio: costo 10 € + ricarico 20% = prezzo 12 €.</p>
      {materiali.length === 0 && <p className="text-sm text-ink-soft">Nessun ricarico configurato.</p>}
      {materiali.map((r, i) => <div key={r.id} className="grid items-end gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_10rem_auto]">
        <div className="min-w-0"><SearchableSelect name={`materiale-${r.id}`} label="Materiale" value={r.prodottoId} required onValueChange={(value) => setMateriali(materiali.map((x, n) => n === i ? { ...x, prodottoId: value } : x))} options={prodotti.map((p) => ({ value: p.id, label: `${p.codice ? `${p.codice} · ` : ""}${p.descrizione}` }))} placeholder="Seleziona materiale" className={economicInput} /></div>
        <EconomicNumber label="Ricarico (%)" value={r.ricarico} onChange={(value) => setMateriali(materiali.map((x, n) => n === i ? { ...x, ricarico: value } : x))} />
        {canEdit && <button type="button" className="min-h-11 text-sm text-danger underline" onClick={() => setMateriali(materiali.filter((_, n) => n !== i))}>Rimuovi materiale</button>}
      </div>)}
      {canEdit && <button type="button" className="min-h-11 rounded-lg border border-line px-3 text-sm text-brand-deep" onClick={() => setMateriali([...materiali, { id: crypto.randomUUID(), prodottoId: "", ricarico: "" }])}>+ Aggiungi materiale</button>}
    </fieldset>
    <FormError error={state?.error} />
    {canEdit && <button disabled={!ready || pending} className="min-h-11 rounded-lg bg-elettra px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Salvataggio…" : "Salva tariffario"}</button>}
  </form>;
}
