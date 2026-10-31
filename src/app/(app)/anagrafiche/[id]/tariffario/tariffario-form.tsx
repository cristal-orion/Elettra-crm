"use client";
import { useActionState, useState } from "react";
import type { EconomiaState } from "../../../economia-actions";
import type { TariffarioValues } from "@/lib/consuntivo-schema";
import { FASCE_ORARIE, TariffaMaterialeSchema } from "@/lib/consuntivo-schema";
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
  const [ricaricoUnico, setRicaricoUnico] = useState("");
  const [erroreRicarico, setErroreRicarico] = useState<string>();
  const [esitoRicarico, setEsitoRicarico] = useState<string>();
  function applicaRicarico() {
    if (!canEdit || !ready || pending || materiali.length === 0) return;
    const result = TariffaMaterialeSchema.shape.ricarico.safeParse(ricaricoUnico);
    if (!result.success) {
      setErroreRicarico("Inserisci una percentuale da 0 a 1000, con massimo 4 decimali.");
      setEsitoRicarico(undefined);
      return;
    }
    setMateriali((rows) => rows.map((r) => ({ ...r, ricarico: result.data })));
    setErroreRicarico(undefined);
    setEsitoRicarico(`Ricarico del ${result.data.replace(".", ",")}% applicato a ${materiali.length === 1 ? "1 materiale" : `${materiali.length} materiali`}. Salva il tariffario per confermare.`);
  }
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
      {canEdit && <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft sm:w-48">Ricarico unico (%)
            <input type="text" inputMode="decimal" value={ricaricoUnico} disabled={materiali.length === 0}
              aria-invalid={!!erroreRicarico} aria-describedby={erroreRicarico ? "ricarico-unico-aiuto ricarico-unico-errore" : "ricarico-unico-aiuto"}
              onChange={(e) => { setRicaricoUnico(e.target.value); setErroreRicarico(undefined); setEsitoRicarico(undefined); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applicaRicarico(); } }} className={economicInput} />
          </label>
          <button type="button" disabled={materiali.length === 0} onClick={applicaRicarico}
            className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm text-brand-deep hover:border-brand focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-ink-soft">Applica a tutti i materiali</button>
        </div>
        <p id="ricarico-unico-aiuto" className="text-xs text-ink-soft">{materiali.length === 0 ? "Aggiungi un materiale per applicare il ricarico unico." : "Da 0 a 1000%, fino a 4 decimali. Aggiorna tutte le righe di questo tariffario."}</p>
        {erroreRicarico && <p id="ricarico-unico-errore" role="alert" className="text-sm text-danger">{erroreRicarico}</p>}
        {esitoRicarico && <p role="status" className="text-sm text-brand-deep">{esitoRicarico}</p>}
      </div>}
      {materiali.length === 0 && <p className="text-sm text-ink-soft">Nessun ricarico configurato.</p>}
      {materiali.map((r, i) => <div key={r.id} className="grid items-end gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_10rem_auto]">
        <div className="min-w-0"><SearchableSelect name={`materiale-${r.id}`} label="Materiale" value={r.prodottoId} required onValueChange={(value) => setMateriali(materiali.map((x, n) => n === i ? { ...x, prodottoId: value } : x))} options={prodotti.map((p) => ({ value: p.id, label: `${p.codice ? `${p.codice} · ` : ""}${p.descrizione}` }))} placeholder="Seleziona materiale" className={economicInput} /></div>
        <EconomicNumber label="Ricarico (%)" value={r.ricarico} onChange={(value) => { setMateriali(materiali.map((x, n) => n === i ? { ...x, ricarico: value } : x)); setEsitoRicarico(undefined); }} />
        {canEdit && <button type="button" className="min-h-11 text-sm text-danger underline" onClick={() => { setMateriali(materiali.filter((_, n) => n !== i)); setEsitoRicarico(undefined); }}>Rimuovi materiale</button>}
      </div>)}
      {canEdit && <button type="button" className="min-h-11 rounded-lg border border-line px-3 text-sm text-brand-deep" onClick={() => { setMateriali([...materiali, { id: crypto.randomUUID(), prodottoId: "", ricarico: "" }]); setEsitoRicarico(undefined); }}>+ Aggiungi materiale</button>}
    </fieldset>
    <FormError error={state?.error} />
    {canEdit && <button disabled={!ready || pending} className="min-h-11 rounded-lg bg-elettra px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Salvataggio…" : "Salva tariffario"}</button>}
  </form>;
}
