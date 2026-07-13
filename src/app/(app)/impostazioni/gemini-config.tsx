"use client";

import { useActionState, useState, useTransition } from "react";
import {
  type ConfigState,
  rimuoviChiaveGemini,
  salvaChiaveGemini,
  testaGemini,
} from "./actions";

export default function GeminiConfig({
  configured,
  fromEnv,
  model,
}: {
  configured: boolean;
  fromEnv: boolean;
  model: string;
}) {
  const [saveState, salva, saving] = useActionState(salvaChiaveGemini, undefined);
  const [azione, setAzione] = useState<ConfigState>();
  const [pending, start] = useTransition();

  function esegui(fn: () => Promise<ConfigState>) {
    setAzione(undefined);
    start(async () => setAzione(await fn()));
  }

  const esito = azione ?? saveState;

  return (
    <section className="rounded-xl border border-line bg-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Assistente AI — Google Gemini</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Modello <span className="font-mono">{model}</span> ·{" "}
            {configured ? (
              <span className="font-medium text-ok">chiave configurata</span>
            ) : (
              <span className="font-medium text-warn">nessuna chiave</span>
            )}
          </p>
        </div>
        <span
          className={`h-2.5 w-2.5 rounded-full ${configured ? "bg-ok" : "bg-warn"}`}
          aria-hidden
        />
      </div>

      {fromEnv ? (
        <p className="mt-4 rounded-lg bg-lead-soft px-4 py-3 text-sm text-ink-soft">
          La chiave è impostata tramite variabile d&apos;ambiente{" "}
          <span className="font-mono text-xs">GEMINI_API_KEY</span> e non è
          modificabile da qui. Puoi comunque testare la connessione.
        </p>
      ) : (
        <form action={salva} className="mt-4 flex flex-col gap-2 sm:max-w-xl">
          <label className="text-xs font-mono uppercase tracking-wider text-ink-faint">
            Chiave API Gemini
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              name="apiKey"
              type="password"
              autoComplete="off"
              placeholder={
                configured ? "•••••••••• (inserisci per sostituire)" : "Incolla qui la chiave"
              }
              className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="submit"
              disabled={saving}
              className="shrink-0 rounded-lg bg-elettra px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60"
            >
              {saving ? "Salvo…" : "Salva"}
            </button>
          </div>
          <p className="text-xs text-ink-soft">
            Ottienila su{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-brand-deep underline"
            >
              aistudio.google.com/apikey
            </a>
            . Viene salvata cifrata; non è più visibile in chiaro.
          </p>
        </form>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <button
          type="button"
          onClick={() => esegui(testaGemini)}
          disabled={pending || !configured}
          className="rounded-lg border border-brand/40 px-4 py-2 text-sm font-medium text-brand-deep transition hover:bg-brand-soft disabled:opacity-50"
        >
          {pending ? "Test in corso…" : "Testa connessione"}
        </button>
        {!fromEnv && configured && (
          <button
            type="button"
            onClick={() => esegui(rimuoviChiaveGemini)}
            disabled={pending}
            className="rounded-lg border border-line px-4 py-2 text-sm text-danger transition hover:bg-danger-soft disabled:opacity-50"
          >
            Rimuovi chiave
          </button>
        )}
      </div>

      {esito?.error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {esito.error}
        </p>
      )}
      {esito?.ok && esito.message && (
        <p className="mt-4 rounded-lg bg-ok-soft px-4 py-3 text-sm text-ok">
          {esito.message}
        </p>
      )}
    </section>
  );
}
