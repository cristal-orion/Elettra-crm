"use client";
import { useActionState, useState } from "react";
import type { EconomiaState } from "../../../economia-actions";
import { editableRow, FASCE_ORARIE, type ConsuntivoValues, type RigaConsuntivoInput, type TariffarioValues } from "@/lib/consuntivo-schema";
import { EconomicNumber, economicInput, useEconomicFormReady } from "@/components/economic-fields";
import FormError from "@/components/form-error";

export default function ConsuntivoForm({ initial, tariffario, date, canEdit, action }: {
  initial?: ConsuntivoValues; tariffario: TariffarioValues; date: string; canEdit: boolean;
  action: (state: EconomiaState, form: FormData) => Promise<EconomiaState>;
}) {
  const [state, save, pending] = useActionState(action, undefined);
  const ready = useEconomicFormReady();
  const [righe, setRighe] = useState<RigaConsuntivoInput[]>(initial?.righe.map(editableRow) ?? []);
  const [data, setData] = useState(initial?.data ?? date);
  const [note, setNote] = useState(initial?.note ?? "");
  const update = (id: string, patch: Record<string, string>) => setRighe((rows) => rows.map((r) => r.id === id ? { ...r, ...patch } as RigaConsuntivoInput : r));
  function add(tipo: "ORE" | "MATERIALE") {
    const id = crypto.randomUUID();
    if (tipo === "ORE" && tariffario.manodopera.length) {
      const v = tariffario.manodopera[0]; setRighe([...righe, { id, tipo, voceId: v.id, fascia: "ordinaria", quantita: "1", tariffa: v.ordinaria }]);
    } else if (tipo === "MATERIALE" && tariffario.materiali.length) {
      const v = tariffario.materiali[0]; setRighe([...righe, { id, tipo, voceId: v.id, quantita: "1", costoBase: "", ricarico: v.ricarico }]);
    }
  }
  return <form action={save} className="space-y-5">
    <input type="hidden" name="dati" value={JSON.stringify({ versione: initial?.versione ?? 0, versioneTariffario: tariffario.versione, data, note, righe })} />
    <fieldset disabled={!canEdit || !ready || pending} className="min-w-0 space-y-4">
      <label className="flex max-w-xs flex-col gap-1 text-xs text-ink-soft">Data consuntivo<input type="date" required value={data} onChange={(e) => setData(e.target.value)} className={economicInput} /></label>
      {righe.length === 0 && <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink-soft">Aggiungi le ore e i materiali effettivamente impiegati.</p>}
      {righe.map((r, i) => {
        const saved = initial?.righe.find((s) => s.id === r.id);
        const source = r.tipo === "ORE" ? tariffario.manodopera.find((s) => s.id === r.voceId) : tariffario.materiali.find((s) => s.id === r.voceId);
        const proposed = saved?.valoreListino ?? (r.tipo === "ORE" && source && "mansione" in source ? source[r.fascia] : source && "ricarico" in source ? source.ricarico : "");
        const override = Number(r.tipo === "ORE" ? r.tariffa : r.ricarico) !== Number(proposed);
        return <section key={r.id} aria-label={`Riga ${i + 1}`} className="min-w-0 space-y-3 rounded-xl border border-line bg-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Riga {i + 1} · {r.tipo === "ORE" ? "Manodopera" : "Materiale"}</h2>{canEdit && <button type="button" onClick={() => setRighe(righe.filter((s) => s.id !== r.id))} className="min-h-11 px-2 text-sm text-danger underline">Rimuovi riga</button>}</div>
          {saved ? <p className="break-words text-sm font-medium">{saved.descrizione}{saved.tipo === "ORE" ? ` · ${FASCE_ORARIE[saved.fascia]}` : ` · ${saved.unitaMisura}`}</p> : r.tipo === "ORE" ? <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft">Mansione<select aria-label="Mansione" value={r.voceId} onChange={(e) => { const v = tariffario.manodopera.find((v) => v.id === e.target.value)!; update(r.id, { voceId: v.id, tariffa: v[r.fascia] }); }} className={economicInput}>{tariffario.manodopera.map((v) => <option key={v.id} value={v.id}>{v.mansione}</option>)}</select></label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft">Fascia oraria<select aria-label="Fascia oraria" value={r.fascia} onChange={(e) => { const fascia = e.target.value as keyof typeof FASCE_ORARIE; update(r.id, { fascia, tariffa: tariffario.manodopera.find((v) => v.id === r.voceId)![fascia] }); }} className={economicInput}>{Object.entries(FASCE_ORARIE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div> : <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-soft">Materiale<select aria-label="Materiale" value={r.voceId} onChange={(e) => { const v = tariffario.materiali.find((v) => v.id === e.target.value)!; update(r.id, { voceId: v.id, ricarico: v.ricarico, costoBase: "" }); }} className={economicInput}>{tariffario.materiali.map((v) => <option key={v.id} value={v.id}>{v.descrizione} · {v.unitaMisura ?? "unità"}</option>)}</select></label>}
          <div className="grid gap-3 sm:grid-cols-3">
            <EconomicNumber label={r.tipo === "ORE" ? "Ore effettive" : `Quantità (${saved?.unitaMisura ?? (source && "unitaMisura" in source ? source.unitaMisura ?? "unità" : "unità")})`} value={r.quantita} onChange={(value) => update(r.id, { quantita: value })} />
            {r.tipo === "ORE" ? <EconomicNumber label="Tariffa applicata (€/h)" value={r.tariffa} onChange={(value) => update(r.id, { tariffa: value })} /> : <>
              <EconomicNumber label="Costo base unitario (€)" value={r.costoBase} onChange={(value) => update(r.id, { costoBase: value })} />
              <EconomicNumber label="Ricarico applicato (%)" value={r.ricarico} onChange={(value) => update(r.id, { ricarico: value })} />
            </>}
          </div>
          <p className={`text-xs ${override ? "font-medium text-warn" : "text-ink-soft"}`}>Tariffario cliente v{saved?.versioneTariffario ?? tariffario.versione}: {proposed} {r.tipo === "ORE" ? "€/h" : "% di ricarico"}{override ? " · Valore personalizzato per questo lavoro" : ""}</p>
        </section>;
      })}
      {canEdit && <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!tariffario.manodopera.length} onClick={() => add("ORE")} className="min-h-11 rounded-lg border border-line px-3 text-sm text-brand-deep disabled:opacity-50">+ Aggiungi ore</button>
        <button type="button" disabled={!tariffario.materiali.length} onClick={() => add("MATERIALE")} className="min-h-11 rounded-lg border border-line px-3 text-sm text-brand-deep disabled:opacity-50">+ Aggiungi materiale</button>
      </div>}
      <label className="flex flex-col gap-1 text-xs text-ink-soft">Note del consuntivo<textarea aria-label="Note del consuntivo" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={4000} className={economicInput} /></label>
    </fieldset>
    <p className="text-xs text-ink-soft">Il totale viene ricalcolato al salvataggio. Materiali: quantità × costo base × (1 + ricarico / 100). Prezzo unitario arrotondato a 4 decimali, importo riga a 2 decimali.</p>
    <FormError error={state?.error} />
    {canEdit && <button disabled={!ready || pending} className="min-h-11 rounded-lg bg-elettra px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Salvataggio…" : "Salva consuntivo"}</button>}
  </form>;
}
