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
    </div>
  );
}
