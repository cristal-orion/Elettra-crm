import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireUtenti } from "@/lib/enums";
import { isAiConfigured, MODEL_ID } from "@/lib/ai";
import AssistenteChat from "./chat";

export const metadata = { title: "Assistente — CRM Elettra" };

export default async function AssistentePage() {
  const [configurato, user] = await Promise.all([
    isAiConfigured(),
    getCurrentUser(),
  ]);
  const isAdmin = user ? puoGestireUtenti(user.ruolo) : false;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
            Assistente AI
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Chiedi al CRM
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Assistente in sola lettura su commesse, clienti, ordini e prezzi.
          </p>
        </div>
        <span className="rounded-full bg-lead-soft px-2.5 py-1 font-mono text-[11px] text-ink-soft">
          {MODEL_ID}
        </span>
      </header>

      {configurato ? (
        <AssistenteChat />
      ) : (
        <div className="rounded-xl border border-warn/40 bg-warn-soft/50 p-6">
          <h2 className="text-sm font-semibold text-warn">
            Assistente non ancora configurato
          </h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            Manca la chiave API di Gemini.{" "}
            {isAdmin ? (
              <>
                Impostala da{" "}
                <Link
                  href="/impostazioni"
                  className="font-medium text-brand-deep underline"
                >
                  Impostazioni
                </Link>{" "}
                (con test di funzionamento), oppure via variabile
                d&apos;ambiente <span className="font-mono text-xs">GEMINI_API_KEY</span>.
              </>
            ) : (
              <>Chiedi a un amministratore di configurarla dalle Impostazioni.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
