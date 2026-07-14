"use client";

import { useActionState } from "react";
import Link from "next/link";
import ProdottoForm from "../prodotto-form";
import { createProdotto } from "../actions";
import { estraiScheda } from "./actions";

export default function SchedaImport() {
  const [state, action, pending] = useActionState(estraiScheda, undefined);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-ok/40 bg-ok-soft/50 px-5 py-4">
          <p className="text-sm font-semibold text-ok">
            Dati estratti da «{state.nome}»
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Controlla e correggi i campi, poi conferma per creare il materiale a
            catalogo. Il PDF resterà allegato. Nulla è stato salvato finora.
          </p>
        </div>
        <ProdottoForm
          action={createProdotto}
          initial={state.dati}
          submitLabel="Crea materiale"
          schedaAttuale={state.pending.nome}
          allowUpload={false}
          extraHidden={{
            pendingPercorso: state.pending.percorso,
            pendingNome: state.pending.nome,
            pendingMime: state.pending.mime,
            pendingDim: String(state.pending.dim),
          }}
        />
        <p className="text-xs text-ink-soft">
          Scheda sbagliata?{" "}
          <Link href="/materiali/da-scheda" className="text-brand-deep underline">
            Carica un&apos;altra scheda
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
            PDF della scheda tecnica
          </span>
          <input
            type="file"
            name="scheda"
            accept="application/pdf"
            required
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-deep hover:file:bg-brand-soft/70"
          />
        </label>
        <p className="mt-3 text-xs text-ink-soft">
          L&apos;AI legge il datasheet ed estrae descrizione, codice, marca, U.M.,
          categoria, prezzo di listino e caratteristiche tecniche. Max 20 MB.
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
          {pending ? "Leggo la scheda…" : "Estrai dati dalla scheda"}
        </button>
        <Link
          href="/materiali"
          className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink-soft transition hover:bg-panel"
        >
          Annulla
        </Link>
      </div>
    </form>
  );
}
