"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-xs font-mono uppercase tracking-wider text-ink-faint"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-lg border border-line bg-panel px-3.5 py-2.5 text-[15px] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="nome.cognome@elettra.it"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-xs font-mono uppercase tracking-wider text-ink-faint"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-line bg-panel px-3.5 py-2.5 text-[15px] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="••••••••"
        />
      </div>

      {state?.error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-lg bg-elettra px-4 py-2.5 text-[15px] font-semibold text-white transition disabled:opacity-60"
      >
        {pending ? "Accesso in corso…" : "Entra"}
      </button>
    </form>
  );
}
