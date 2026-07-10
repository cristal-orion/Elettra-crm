"use client";

import { useActionState, useEffect, useRef } from "react";
import { CATEGORIE_DOCUMENTO } from "@/lib/enums";
import type { UploadState } from "./documenti-actions";

const inputCls =
  "rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function DocumentiUploader({
  action,
}: {
  action: (state: UploadState, formData: FormData) => Promise<UploadState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-dashed border-line bg-paper/40 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            File (PDF, immagini, disegni…)
          </span>
          <input
            type="file"
            name="files"
            multiple
            required
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-deep hover:file:bg-brand-soft/70"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            Categoria
          </span>
          <select name="categoria" defaultValue="ALTRO" className={inputCls}>
            {Object.entries(CATEGORIE_DOCUMENTO).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {pending ? "Caricamento…" : "Carica documenti"}
        </button>
        <span className="text-xs text-ink-faint">Max 20 MB per file.</span>
        {state?.error && (
          <span role="alert" className="text-xs font-medium text-danger">
            {state.error}
          </span>
        )}
        {state?.ok ? (
          <span className="text-xs font-medium text-ok">
            {state.ok} document{state.ok === 1 ? "o" : "i"} caricat
            {state.ok === 1 ? "o" : "i"}.
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function DocDeleteButton({
  action,
  nome,
}: {
  action: (formData: FormData) => void | Promise<void>;
  nome: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Eliminare il documento «${nome}»?`)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        title="Elimina documento"
        aria-label={`Elimina ${nome}`}
        className="rounded-md p-1.5 text-ink-faint transition hover:bg-danger-soft hover:text-danger"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            fill="currentColor"
            d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm4 2v8h1v-8h-1Zm3 0v8h1v-8h-1Z"
          />
        </svg>
      </button>
    </form>
  );
}
