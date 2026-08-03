"use client";

import { useActionState, useEffect, useRef } from "react";
import type { OperaioState } from "./actions";

type Azione = (
  state: OperaioState,
  formData: FormData,
) => Promise<OperaioState>;

const inputCls =
  "rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls =
  "font-mono text-[11px] uppercase tracking-wider text-ink-faint";

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function Esito({ state }: { state: OperaioState }) {
  if (state?.error) {
    return (
      <span role="alert" className="text-xs font-medium text-danger">
        {state.error}
      </span>
    );
  }
  if (state?.ok) {
    return <span className="text-xs font-medium text-ok">{state.ok}</span>;
  }
  return null;
}

type Operaio = {
  nome: string;
  cognome: string;
  qualifica: string | null;
  squadra: string | null;
  telefono: string | null;
  note: string | null;
  attivo: boolean;
};

/** Campi condivisi da creazione e modifica: unico punto da tenere allineato. */
function CampiOperaio({
  operaio,
  conAttivo,
}: {
  operaio?: Operaio;
  conAttivo?: boolean;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Campo label="Nome">
          <input
            name="nome"
            required
            defaultValue={operaio?.nome ?? ""}
            className={inputCls}
          />
        </Campo>
        <Campo label="Cognome">
          <input
            name="cognome"
            required
            defaultValue={operaio?.cognome ?? ""}
            className={inputCls}
          />
        </Campo>
        <Campo label="Qualifica">
          <input
            name="qualifica"
            placeholder="es. Elettricista"
            defaultValue={operaio?.qualifica ?? ""}
            className={inputCls}
          />
        </Campo>
        <Campo label="Squadra">
          <input
            name="squadra"
            placeholder="es. Squadra A"
            defaultValue={operaio?.squadra ?? ""}
            className={inputCls}
          />
        </Campo>
        <Campo label="Telefono">
          <input
            name="telefono"
            defaultValue={operaio?.telefono ?? ""}
            className={inputCls}
          />
        </Campo>
        {conAttivo && (
          <label className="flex items-end gap-2 pb-2.5">
            <input
              type="checkbox"
              name="attivo"
              defaultChecked={operaio?.attivo ?? true}
              className="h-4 w-4 rounded border-line accent-brand"
            />
            <span className="text-sm">Attivo (assegnabile ai cantieri)</span>
          </label>
        )}
      </div>
      <Campo label="Note">
        <textarea
          name="note"
          rows={2}
          defaultValue={operaio?.note ?? ""}
          className={inputCls}
        />
      </Campo>
    </>
  );
}

export function OperaioAddForm({ action }: { action: Azione }) {
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
      <CampiOperaio />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : "+ Aggiungi operaio"}
        </button>
        <Esito state={state} />
      </div>
    </form>
  );
}

export function OperaioEditForm({
  action,
  eliminaAction,
  operaio,
}: {
  action: Azione;
  eliminaAction: Azione;
  operaio: Operaio;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div className="flex flex-col gap-3 pt-3">
      <form action={formAction} className="flex flex-col gap-3">
        <CampiOperaio operaio={operaio} conAttivo />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand-deep transition hover:bg-brand-soft disabled:opacity-60"
          >
            {pending ? "Salvataggio…" : "Salva"}
          </button>
          <Esito state={state} />
        </div>
      </form>
      <EliminaOperaio
        action={eliminaAction}
        nome={`${operaio.nome} ${operaio.cognome}`}
      />
    </div>
  );
}

function EliminaOperaio({ action, nome }: { action: Azione; nome: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Eliminare ${nome} dall'anagrafica operai?`)) {
          e.preventDefault();
        }
      }}
      className="flex flex-wrap items-center gap-3 border-t border-line pt-3"
    >
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger-soft disabled:opacity-60"
      >
        {pending ? "Eliminazione…" : "Elimina"}
      </button>
      <span className="text-xs text-ink-faint">
        Se è già stato assegnato a un cantiere viene disattivato, non eliminato.
      </span>
      <Esito state={state} />
    </form>
  );
}
