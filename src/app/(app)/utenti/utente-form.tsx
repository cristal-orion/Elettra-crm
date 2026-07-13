"use client";

import { useActionState } from "react";
import Link from "next/link";
import { RUOLI } from "@/lib/enums";
import type { UtenteState } from "./actions";

export type UtenteFormValues = {
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  attivo: boolean;
};

const inputCls =
  "rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls = "text-xs font-mono uppercase tracking-wider text-ink-faint";

export default function UtenteForm({
  action,
  initial,
  isEdit = false,
  submitLabel = "Salva",
}: {
  action: (state: UtenteState, formData: FormData) => Promise<UtenteState>;
  initial?: Partial<UtenteFormValues>;
  isEdit?: boolean;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const v = (k: keyof UtenteFormValues) =>
    (initial?.[k] as string | undefined) ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-7">
      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">Dati utente</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Nome *</span>
            <input name="nome" required defaultValue={v("nome")} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Cognome *</span>
            <input
              name="cognome"
              required
              defaultValue={v("cognome")}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Email *</span>
            <input
              name="email"
              type="email"
              required
              defaultValue={v("email")}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Ruolo *</span>
            <select
              name="ruolo"
              defaultValue={initial?.ruolo ?? "PROJECT_MANAGER"}
              className={inputCls}
            >
              {Object.entries(RUOLI).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2.5 self-end pb-2 text-sm">
            <input
              type="checkbox"
              name="attivo"
              defaultChecked={initial?.attivo ?? true}
              className="h-4 w-4 accent-[color:var(--color-brand)]"
            />
            Attivo
            <span className="text-xs text-ink-faint">(può accedere)</span>
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-line bg-panel p-5">
        <legend className="px-1 text-sm font-semibold">
          {isEdit ? "Reimposta password" : "Password"}
        </legend>
        <div className="mt-3">
          <label className="flex flex-col gap-1.5 sm:max-w-sm">
            <span className={labelCls}>
              Password {isEdit ? "" : "*"}
            </span>
            <input
              name="password"
              type="password"
              required={!isEdit}
              autoComplete="new-password"
              placeholder={isEdit ? "Lascia vuoto per non cambiarla" : "Almeno 8 caratteri"}
              className={inputCls}
            />
          </label>
          <p className="mt-2 text-xs text-ink-soft">
            {isEdit
              ? "Compila solo per assegnare una nuova password (minimo 8 caratteri)."
              : "Minimo 8 caratteri. L'utente potrà usarla per accedere."}
          </p>
        </div>
      </fieldset>

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
          href="/utenti"
          className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink-soft transition hover:bg-panel"
        >
          Annulla
        </Link>
      </div>
    </form>
  );
}
