"use client";

import { useActionState } from "react";
import Link from "next/link";
import AnagraficaForm from "../anagrafica-form";
import { createAnagrafica } from "../actions";
import { estraiVisura } from "./actions";

export default function VisuraImport() {
  const [state, action, pending] = useActionState(estraiVisura, undefined);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-ok/40 bg-ok-soft/50 px-5 py-4">
          <p className="text-sm font-semibold text-ok">
            Dati estratti da «{state.nome}»
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Controlla e correggi i campi qui sotto, poi conferma per creare
            l&apos;anagrafica. Nulla è stato salvato finora.
          </p>
        </div>
        <AnagraficaForm
          action={createAnagrafica}
          initial={state.dati}
          submitLabel="Crea anagrafica"
        />
        <p className="text-xs text-ink-soft">
          Dati sbagliati?{" "}
          <Link href="/anagrafiche/da-visura" className="text-brand-deep underline">
            Carica un&apos;altra visura
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="rounded-xl border border-dashed border-line bg-panel p-6">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-mono text-xs uppercase tracking-wider text-ink-faint">
            PDF della visura camerale
          </span>
          <input
            type="file"
            name="visura"
            accept="application/pdf"
            required
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-deep hover:file:bg-brand-soft/70"
          />
        </label>
        <p className="mt-3 text-xs text-ink-soft">
          L&apos;AI legge il PDF ed estrae ragione sociale, P.IVA, codice fiscale,
          SDI/PEC, sede e amministratori. Max 20 MB.
        </p>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-elettra px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {pending ? "Estraggo i dati…" : "Estrai dati dalla visura"}
        </button>
        <Link
          href="/anagrafiche"
          className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink-soft transition hover:bg-panel"
        >
          Annulla
        </Link>
      </div>
    </form>
  );
}
