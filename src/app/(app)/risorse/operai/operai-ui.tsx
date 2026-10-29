"use client";

import { useActionState, useEffect, useRef } from "react";
import type { OperaioState } from "./actions";

type Azione = (
  state: OperaioState,
  formData: FormData,
) => Promise<OperaioState>;

const inputCls =
  "min-h-11 min-w-0 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls =
  "text-sm font-medium text-ink-soft";

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
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
    return <span role="status" className="text-xs font-medium text-ok">{state.ok}</span>;
  }
  return null;
}

type Operaio = {
  expectedUpdatedAt: string;
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
  squadre,
}: {
  operaio?: Operaio;
  conAttivo?: boolean;
  squadre: { nome: string; attiva: boolean }[];
}) {
  return (
    <>
      <input type="hidden" name="expectedUpdatedAt" value={operaio?.expectedUpdatedAt ?? ""} />
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
          <select name="squadra" defaultValue={operaio?.squadra ?? ""} className={inputCls}>
            <option value="">Nessuna squadra</option>
            {squadre.filter((s) => s.attiva || s.nome === operaio?.squadra).map((s) => <option key={s.nome} value={s.nome}>{s.nome}{s.attiva ? "" : " (archiviata)"}</option>)}
          </select>
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

export function OperaioAddForm({ action, squadre }: { action: Azione; squadre: { nome: string; attiva: boolean }[] }) {
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
      <CampiOperaio squadre={squadre} />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
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
  squadre,
}: {
  action: Azione;
  eliminaAction: Azione;
  operaio: Operaio;
  squadre: { nome: string; attiva: boolean }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div className="flex flex-col gap-3 pt-3">
      <form action={formAction} className="flex flex-col gap-3">
        <CampiOperaio operaio={operaio} conAttivo squadre={squadre} />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-lg border border-brand/40 px-3 py-2 text-sm font-medium text-brand-deep transition hover:bg-brand-soft disabled:opacity-60"
          >
            {pending ? "Salvataggio…" : "Salva"}
          </button>
          <Esito state={state} />
        </div>
      </form>
      <EliminaOperaio
        action={eliminaAction}
        nome={`${operaio.nome} ${operaio.cognome}`}
        expectedUpdatedAt={operaio.expectedUpdatedAt}
      />
    </div>
  );
}

function EliminaOperaio({ action, nome, expectedUpdatedAt }: { action: Azione; nome: string; expectedUpdatedAt: string }) {
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
      <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-lg border border-danger/30 px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft disabled:opacity-60"
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
