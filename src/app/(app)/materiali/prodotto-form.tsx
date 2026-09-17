"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import type { ProdottoState } from "./actions";

export type ProdottoFormValues = {
  descrizione: string;
  codice: string;
  marca: string;
  unitaMisura: string;
  categoria: string;
  prezzoListino: string;
  datiTecnici: string;
  note: string;
};

const inputCls =
  "rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls = "text-xs font-mono uppercase tracking-wider text-ink-faint";

const VUOTO: ProdottoFormValues = {
  descrizione: "",
  codice: "",
  marca: "",
  unitaMisura: "",
  categoria: "",
  prezzoListino: "",
  datiTecnici: "",
  note: "",
};

export default function ProdottoForm({
  action,
  initial,
  submitLabel = "Salva",
  cancelHref = "/materiali",
  schedaAttuale,
  allowUpload = true,
  aiConfigured = false,
}: {
  action: (state: ProdottoState, formData: FormData) => Promise<ProdottoState>;
  initial?: Partial<ProdottoFormValues>;
  submitLabel?: string;
  cancelHref?: string;
  schedaAttuale?: string | null;
  allowUpload?: boolean;
  /** Se true e c'è una scheda AI configurata, offre "Compila con AI" dal PDF. */
  aiConfigured?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState<ProdottoFormValues>({
    ...VUOTO,
    ...initial,
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasFile, setHasFile] = useState(false);
  const [estraendo, setEstraendo] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiOk, setAiOk] = useState(false);
  const [proposta, setProposta] = useState<Partial<ProdottoFormValues> | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const set = (k: keyof ProdottoFormValues, val: string) =>
    setValues((v) => ({ ...v, [k]: val }));

  async function compilaConAI() {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    setEstraendo(true);
    setAiError(null);
    setAiOk(false);
    setProposta(null);
    try {
      const fd = new FormData();
      fd.append("scheda", f);
      const res = await fetch("/materiali/estrai", { method: "POST", body: fd });
      if (!res.ok) {
        setAiError((await res.text()) || "Estrazione non riuscita.");
        return;
      }
      const dati = (await res.json()) as Partial<ProdottoFormValues>;
      const clean = Object.fromEntries(Object.entries(dati).filter(([k, v]) => k in VUOTO && typeof v === "string" && v.length > 0));
      setProposta(clean);
      setSelected(Object.keys(clean).filter((k) => !values[k as keyof ProdottoFormValues]));
    } catch {
      setAiError("Errore durante l'estrazione. Riprova.");
    } finally {
      setEstraendo(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-7">
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">Dati materiale</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Descrizione *</span>
            <input
              name="descrizione"
              required
              value={values.descrizione}
              onChange={(e) => set("descrizione", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Codice articolo</span>
            <input
              name="codice"
              value={values.codice}
              onChange={(e) => set("codice", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Marca / produttore</span>
            <input
              name="marca"
              value={values.marca}
              onChange={(e) => set("marca", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Categoria</span>
            <input
              name="categoria"
              value={values.categoria}
              onChange={(e) => set("categoria", e.target.value)}
              placeholder="es. Cavi, Interruttori…"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Unità di misura</span>
            <input
              name="unitaMisura"
              value={values.unitaMisura}
              onChange={(e) => set("unitaMisura", e.target.value)}
              placeholder="pz, m, kg…"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Prezzo di listino (€)</span>
            <input
              name="prezzoListino"
              type="number"
              step="0.01"
              min="0"
              value={values.prezzoListino}
              onChange={(e) => set("prezzoListino", e.target.value)}
              placeholder="opzionale"
              className={`${inputCls} tabular-nums`}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">Dettagli</legend>
        <div className="mt-3 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Dati tecnici</span>
            <textarea
              name="datiTecnici"
              value={values.datiTecnici}
              onChange={(e) => set("datiTecnici", e.target.value)}
              rows={5}
              placeholder="Caratteristiche tecniche (una per riga)"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Note</span>
            <textarea
              name="note"
              value={values.note}
              onChange={(e) => set("note", e.target.value)}
              rows={2}
              className={inputCls}
            />
          </label>
        </div>
      </fieldset>

      {allowUpload && (
        <fieldset className="rounded-xl border border-line bg-panel p-5">
          <legend className="px-1 text-sm font-semibold">
            Scheda tecnica (PDF)
          </legend>
          {schedaAttuale && (
            <p className="mt-2 text-sm text-ink-soft">
              Allegata attualmente:{" "}
              <span className="font-medium text-ink">{schedaAttuale}</span>.
              Caricane una nuova per sostituirla.
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            name="scheda"
            aria-label="Scheda tecnica PDF"
            disabled={estraendo || pending}
            accept="application/pdf"
            onChange={(e) => {
              setHasFile(!!e.target.files?.length);
              setAiOk(false);
              setAiError(null);
              setProposta(null);
            }}
            className="mt-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-deep hover:file:bg-brand-soft/70"
          />

          {aiConfigured ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={compilaConAI}
                disabled={!hasFile || estraendo || pending}
                className="rounded-lg border border-brand/40 px-4 py-2 text-sm font-medium text-brand-deep transition hover:bg-brand-soft disabled:opacity-50"
              >
                {estraendo ? "Leggo la scheda…" : "Estrai dati con AI"}
              </button>
              <span className="text-xs text-ink-soft">
                Carica il PDF, poi confronta i dati estratti con i campi attuali.
                Il file resta allegato al materiale.
              </span>
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-soft">
              Facoltativo. Il PDF resta allegato al materiale e riscaricabile. Max 20 MB.
            </p>
          )}

          {aiError && (
            <p className="mt-3 rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger">
              {aiError}
            </p>
          )}
          {aiOk && (
            <p className="mt-3 rounded-lg bg-ok-soft px-4 py-2.5 text-sm text-ok">
              Campi compilati dall&apos;AI. Controllali e correggi se serve, poi salva.
            </p>
          )}
          {proposta && <div className="mt-4 border-t border-line pt-4"><h3 className="text-sm font-semibold">Scegli quali valori applicare</h3><p className="mt-1 text-xs text-ink-soft">I campi già compilati non sono selezionati automaticamente. Nessun dato è stato ancora sostituito.</p><div className="mt-3 space-y-2">{Object.entries(proposta).map(([k, val]) => <label key={k} className="flex min-h-11 items-start gap-3 rounded-lg bg-paper p-3 text-sm"><input type="checkbox" checked={selected.includes(k)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, k] : prev.filter((v) => v !== k))} className="mt-1" /><span className="min-w-0 break-words"><strong className="font-medium">{k.replace(/([A-Z])/g, " $1")}</strong><span className="mt-1 block text-ink-soft">Attuale: {values[k as keyof ProdottoFormValues] || "Vuoto"}</span><span className="mt-1 block">Proposto: {val}</span></span></label>)}</div><div className="mt-3 flex gap-3"><button type="button" disabled={!selected.length} onClick={() => { setValues((v) => ({ ...v, ...Object.fromEntries(Object.entries(proposta).filter(([k]) => selected.includes(k))) })); setProposta(null); setAiOk(true); }} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">Applica selezionati</button><button type="button" onClick={() => setProposta(null)} className="min-h-11 px-3 text-sm underline">Scarta estrazione</button></div></div>}
        </fieldset>
      )}

      {state?.error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || estraendo}
          className="rounded-lg bg-elettra px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink-soft transition hover:bg-panel"
        >
          Annulla
        </Link>
      </div>
    </form>
  );
}
