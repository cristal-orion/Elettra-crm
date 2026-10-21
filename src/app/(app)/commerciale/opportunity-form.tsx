"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { useFormReady } from "@/components/form-ready";
import { TIPOLOGIE } from "@/lib/enums";
import SearchableSelect from "@/components/searchable-select";
import FormError from "@/components/form-error";
import type { OpportunitaInput } from "@/lib/commerciale-schema";
import type { CommercialOptions } from "./data";
import { saveOpportunity } from "./actions";

export const commercialInput = "min-h-11 min-w-0 w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-brand disabled:opacity-60";
export default function OpportunityForm({ id, initial, options, canCreateAnagrafica }: { id: string; initial: OpportunitaInput; options: CommercialOptions; canCreateAnagrafica: boolean }) {
  const router = useRouter(), ready = useFormReady();
  const [state, action, pending] = useActionState(saveOpportunity.bind(null, id), undefined);
  const [values, setValues] = useState(initial);
  const set = (key: keyof OpportunitaInput, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const anagrafica = options.anagrafiche.find((a) => a.id === values.anagraficaId);
  return <form action={action} className="min-w-0 space-y-5">
    <input type="hidden" name="dati" value={JSON.stringify(values)} />
    <fieldset disabled={!ready || pending} className="grid min-w-0 grid-cols-1 gap-4 rounded-xl border border-line bg-panel p-4 sm:grid-cols-2 sm:p-6">
      <legend className="px-1 font-semibold">Trattativa</legend>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">Titolo *<input required maxLength={250} value={values.titolo} onChange={(e) => set("titolo", e.target.value)} className={commercialInput} /></label>
      <div className="space-y-2 sm:col-span-2"><span className="text-sm">Cliente o potenziale cliente *</span><SearchableSelect name="anagraficaId" label="Cliente o potenziale cliente" required disabled={!ready || pending} value={values.anagraficaId} onValueChange={(anagraficaId) => setValues((v) => ({ ...v, anagraficaId, referenteId: "" }))}
        options={options.anagrafiche.map((a) => ({ value: a.id, label: `${a.ragioneSociale}${a.isProspect ? " · Potenziale cliente" : ""}`, keywords: `${a.codiceCliente ?? ""} ${a.partitaIva ?? ""}` }))} />
        <div className="flex flex-wrap gap-3 text-xs">{canCreateAnagrafica && <Link href="/anagrafiche/nuova?tipo=prospect" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-brand-deep underline">Registra un potenziale cliente ↗</Link>}<button type="button" onClick={() => router.refresh()} className="min-h-11 text-brand-deep underline">Aggiorna elenco anagrafiche</button></div>
      </div>
      <label className="flex min-w-0 flex-col gap-1 text-sm">Referente<select aria-label="Referente" value={values.referenteId ?? ""} onChange={(e) => set("referenteId", e.target.value)} className={commercialInput}><option value="">Nessun referente</option>{anagrafica?.referenti.map((r) => <option key={r.id} value={r.id}>{r.nome} {r.cognome}</option>)}</select></label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">Responsabile *<select aria-label="Responsabile commerciale" required value={values.responsabileId} onChange={(e) => set("responsabileId", e.target.value)} className={commercialInput}><option value="">Seleziona responsabile</option>{options.responsabili.map((u) => <option key={u.id} value={u.id} disabled={!u.attivo}>{u.nome} {u.cognome}{u.attivo ? "" : " (disattivato)"}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm">Origine<input maxLength={150} placeholder="Passaparola, sito, cliente storico…" value={values.origine} onChange={(e) => set("origine", e.target.value)} className={commercialInput} /></label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">Tipologia *<select aria-label="Tipologia" value={values.tipologia} onChange={(e) => set("tipologia", e.target.value)} className={commercialInput}>{Object.entries(TIPOLOGIE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-sm">Valore previsto (€)<input type="number" min="0" step="0.01" value={values.valorePrevisto ?? ""} onChange={(e) => set("valorePrevisto", e.target.value)} className={commercialInput} /></label>
      <p className="self-end text-xs text-ink-soft">Il valore previsto è una stima della trattativa. L’importo confermato sarà inserito alla conferma dell’incarico.</p>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">Descrizione<textarea aria-label="Descrizione" rows={4} maxLength={6000} value={values.descrizione} onChange={(e) => set("descrizione", e.target.value)} className={commercialInput} /></label>
    </fieldset>
    <fieldset disabled={!ready || pending} className="grid min-w-0 grid-cols-1 gap-4 rounded-xl border border-line bg-panel p-4 sm:grid-cols-3 sm:p-6"><legend className="px-1 font-semibold">Offerta</legend>
      <label className="flex flex-col gap-1 text-sm">Riferimento offerta<input maxLength={200} value={values.riferimentoOfferta} onChange={(e) => set("riferimentoOfferta", e.target.value)} className={commercialInput} /></label>
      <label className="flex flex-col gap-1 text-sm">Importo offerta (€)<input type="number" min="0" step="0.01" value={values.importoOfferta ?? ""} onChange={(e) => set("importoOfferta", e.target.value)} className={commercialInput} /></label>
      <label className="flex flex-col gap-1 text-sm">Data invio offerta<input type="date" value={values.dataInvioOfferta ?? ""} onChange={(e) => set("dataInvioOfferta", e.target.value)} className={commercialInput} /></label>
      <p className="text-xs text-ink-soft sm:col-span-3">Compila questi dati quando invii l’offerta. Per gli incarichi a consuntivo è disponibile la conferma diretta del lavoro. I file si allegano dalla scheda della trattativa.</p>
    </fieldset>
    <FormError error={state?.error} />
    <button disabled={!ready || pending} className="min-h-11 rounded-lg bg-elettra px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Salvataggio…" : initial.versione ? "Salva trattativa" : "Crea trattativa"}</button>
  </form>;
}
