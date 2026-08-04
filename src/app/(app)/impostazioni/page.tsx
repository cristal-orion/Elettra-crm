import Link from "next/link";
import { requireRuolo } from "@/lib/dal";
import { isAiConfigured, apiKeyFromEnv, MODEL_ID } from "@/lib/ai";
import GeminiConfig from "./gemini-config";

export const metadata = { title: "Impostazioni — CRM Elettra" };

export default async function ImpostazioniPage() {
  await requireRuolo(["SUPER_ADMIN"]);
  const configurato = await isAiConfigured();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
          Amministrazione
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Impostazioni</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Configurazione dei servizi del CRM.
        </p>
      </header>

      <GeminiConfig
        configured={configurato}
        fromEnv={apiKeyFromEnv()}
        model={MODEL_ID}
      />

      <section className="rounded-xl border border-line bg-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Import dati da Excel</h2>
            <p className="mt-1 max-w-xl text-sm text-ink-soft">
              Carica gli elenchi storici di anagrafiche e offerte direttamente
              da qui: i file non passano dal repository.
            </p>
          </div>
          <Link
            href="/impostazioni/import"
            className="shrink-0 rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium transition hover:border-brand/40"
          >
            Apri l&apos;import
          </Link>
        </div>
      </section>
    </div>
  );
}
