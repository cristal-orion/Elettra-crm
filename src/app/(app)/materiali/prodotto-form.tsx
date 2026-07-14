"use client";

import { useActionState } from "react";
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

export default function ProdottoForm({
  action,
  initial,
  submitLabel = "Salva",
  cancelHref = "/materiali",
  schedaAttuale,
  allowUpload = true,
  extraHidden,
}: {
  action: (state: ProdottoState, formData: FormData) => Promise<ProdottoState>;
  initial?: Partial<ProdottoFormValues>;
  submitLabel?: string;
  cancelHref?: string;
  schedaAttuale?: string | null;
  allowUpload?: boolean;
  extraHidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = (k: keyof ProdottoFormValues) =>
    (initial?.[k] as string | undefined) ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-7">
      {extraHidden &&
        Object.entries(extraHidden).map(([k, val]) => (
          <input key={k} type="hidden" name={k} value={val} />
        ))}
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">Dati materiale</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Descrizione *</span>
            <input
              name="descrizione"
              required
              defaultValue={v("descrizione")}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Codice articolo</span>
            <input name="codice" defaultValue={v("codice")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Marca / produttore</span>
            <input name="marca" defaultValue={v("marca")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Categoria</span>
            <input
              name="categoria"
              defaultValue={v("categoria")}
              placeholder="es. Cavi, Interruttori…"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Unità di misura</span>
            <input
              name="unitaMisura"
              defaultValue={v("unitaMisura")}
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
              defaultValue={v("prezzoListino")}
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
              defaultValue={v("datiTecnici")}
              rows={5}
              placeholder="Caratteristiche tecniche (una per riga)"
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Note</span>
            <textarea
              name="note"
              defaultValue={v("note")}
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
            type="file"
            name="scheda"
            accept="application/pdf"
            className="mt-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-deep hover:file:bg-brand-soft/70"
          />
          <p className="mt-2 text-xs text-ink-soft">
            Facoltativo. Il PDF resta allegato al materiale e riscaricabile. Max 20 MB.
          </p>
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
          disabled={pending}
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
