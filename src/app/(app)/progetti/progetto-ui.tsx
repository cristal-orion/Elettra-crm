"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  RUOLI_CANTIERE,
  STATI_MILESTONE,
  etichettaStatoMilestone,
} from "@/lib/enums";
import type { ProgettoState } from "./actions";

type Azione = (
  state: ProgettoState,
  formData: FormData,
) => Promise<ProgettoState>;

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

/** Riga di esito condivisa dai form: errore in rosso, conferma in verde. */
function Esito({ state }: { state: ProgettoState }) {
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

/** Valore per <input type="date">: "YYYY-MM-DD" oppure vuoto. */
function isoDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/* ----------------------------- pianificazione ----------------------------- */

export function PianificazioneForm({
  action,
  dataInizioLavori,
  scadenzaLavori,
  dataFineLavori,
  noteCantiere,
}: {
  action: Azione;
  dataInizioLavori: Date | null;
  scadenzaLavori: Date | null;
  dataFineLavori: Date | null;
  noteCantiere: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo label="Inizio lavori">
          <input
            type="date"
            name="dataInizioLavori"
            defaultValue={isoDate(dataInizioLavori)}
            className={inputCls}
          />
        </Campo>
        <Campo label="Scadenza concordata">
          <input
            type="date"
            name="scadenzaLavori"
            defaultValue={isoDate(scadenzaLavori)}
            className={inputCls}
          />
        </Campo>
        <Campo label="Fine effettiva">
          <input
            type="date"
            name="dataFineLavori"
            defaultValue={isoDate(dataFineLavori)}
            className={inputCls}
          />
        </Campo>
      </div>
      <Campo label="Note di cantiere">
        <textarea
          name="noteCantiere"
          rows={2}
          defaultValue={noteCantiere ?? ""}
          className={inputCls}
        />
      </Campo>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : "Salva pianificazione"}
        </button>
        <Esito state={state} />
      </div>
    </form>
  );
}

/* -------------------------------- milestone ------------------------------- */

export function MilestoneAddForm({ action }: { action: Azione }) {
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
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Campo label="Nuova milestone">
          <input
            name="titolo"
            required
            placeholder="es. Posa cavidotti"
            className={inputCls}
          />
        </Campo>
        <Campo label="Data prevista">
          <input type="date" name="dataPianificata" className={inputCls} />
        </Campo>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {pending ? "Aggiunta…" : "+ Aggiungi milestone"}
        </button>
        <Esito state={state} />
      </div>
    </form>
  );
}

/** Select di stato che invia da sé: un click in meno per l'uso quotidiano. */
function StatoSelectInner({ stato }: { stato: string }) {
  const { pending } = useFormStatus();
  return (
    <select
      name="stato"
      defaultValue={stato}
      disabled={pending}
      aria-label="Stato milestone"
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs outline-none transition focus:border-brand disabled:opacity-50"
    >
      {Object.keys(STATI_MILESTONE).map((k) => (
        <option key={k} value={k}>
          {etichettaStatoMilestone(k)}
        </option>
      ))}
    </select>
  );
}

export function StatoMilestoneSelect({
  action,
  stato,
}: {
  action: (formData: FormData) => void | Promise<void>;
  stato: string;
}) {
  return (
    <form action={action}>
      <StatoSelectInner stato={stato} />
    </form>
  );
}

/** Bottone icona che invia un'action senza payload (sposta / elimina). */
export function AzioneIcona({
  action,
  title,
  conferma,
  variante = "neutro",
  children,
  disabled,
}: {
  action: (formData: FormData) => void | Promise<void>;
  title: string;
  conferma?: string;
  variante?: "neutro" | "danger";
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (conferma && !confirm(conferma)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        title={title}
        aria-label={title}
        disabled={disabled}
        className={`rounded-md p-1.5 text-ink-faint transition disabled:opacity-30 ${
          variante === "danger"
            ? "hover:bg-danger-soft hover:text-danger"
            : "hover:bg-paper hover:text-ink"
        }`}
      >
        {children}
      </button>
    </form>
  );
}

export function MilestoneEditForm({
  action,
  titolo,
  stato,
  dataPianificata,
  dataEffettiva,
  note,
}: {
  action: Azione;
  titolo: string;
  stato: string;
  dataPianificata: Date | null;
  dataEffettiva: Date | null;
  note: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Titolo">
          <input
            name="titolo"
            required
            defaultValue={titolo}
            className={inputCls}
          />
        </Campo>
        <Campo label="Stato">
          <select name="stato" defaultValue={stato} className={inputCls}>
            {Object.keys(STATI_MILESTONE).map((k) => (
              <option key={k} value={k}>
                {etichettaStatoMilestone(k)}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Data prevista">
          <input
            type="date"
            name="dataPianificata"
            defaultValue={isoDate(dataPianificata)}
            className={inputCls}
          />
        </Campo>
        <Campo label="Data effettiva">
          <input
            type="date"
            name="dataEffettiva"
            defaultValue={isoDate(dataEffettiva)}
            className={inputCls}
          />
        </Campo>
      </div>
      <Campo label="Note">
        <textarea
          name="note"
          rows={2}
          defaultValue={note ?? ""}
          className={inputCls}
        />
      </Campo>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand-deep transition hover:bg-brand-soft disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : "Salva milestone"}
        </button>
        <span className="text-xs text-ink-faint">
          La data effettiva si compila da sé quando la milestone passa a
          completata.
        </span>
        <Esito state={state} />
      </div>
    </form>
  );
}

/* ------------------------------ assegnazioni ------------------------------ */

export function AssegnaOperaioForm({
  action,
  operai,
}: {
  action: Azione;
  operai: { id: string; nome: string; cognome: string; qualifica: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  if (operai.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-paper/40 p-4 text-sm text-ink-faint">
        Nessun operaio attivo in anagrafica: creane uno in “Gestisci operai”
        prima di comporre la squadra.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-dashed border-line bg-paper/40 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo label="Operaio">
          <select name="operaioId" required defaultValue="" className={inputCls}>
            <option value="" disabled>
              Scegli…
            </option>
            {operai.map((o) => (
              <option key={o.id} value={o.id}>
                {o.cognome} {o.nome}
                {o.qualifica ? ` — ${o.qualifica}` : ""}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Ruolo in cantiere">
          <select name="ruoloCantiere" defaultValue="" className={inputCls}>
            <option value="">—</option>
            {Object.entries(RUOLI_CANTIERE).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Dal">
          <input type="date" name="dal" className={inputCls} />
        </Campo>
        <Campo label="Al">
          <input type="date" name="al" className={inputCls} />
        </Campo>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-elettra px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
        >
          {pending ? "Assegnazione…" : "+ Assegna al cantiere"}
        </button>
        <Esito state={state} />
      </div>
    </form>
  );
}
