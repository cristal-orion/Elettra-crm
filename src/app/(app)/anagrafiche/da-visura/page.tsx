import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireAnagrafiche, puoGestireUtenti } from "@/lib/enums";
import { isAiConfigured } from "@/lib/ai";
import VisuraImport from "./visura-import";

export const metadata = { title: "Nuova anagrafica da visura — CRM Elettra" };

export default async function DaVisuraPage() {
  const user = await getCurrentUser();
  if (!user || !puoGestireAnagrafiche(user.ruolo)) redirect("/anagrafiche");

  const configurato = await isAiConfigured();
  const isAdmin = puoGestireUtenti(user.ruolo);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/anagrafiche"
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← Anagrafiche
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Nuova anagrafica da visura
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Carica la visura camerale: l&apos;AI precompila la scheda, tu confermi.
        </p>
      </header>

      {configurato ? (
        <VisuraImport />
      ) : (
        <div className="rounded-xl border border-warn/40 bg-warn-soft/50 p-6">
          <h2 className="text-sm font-semibold text-warn">
            Assistente AI non configurato
          </h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            L&apos;estrazione da visura richiede la chiave API Gemini.{" "}
            {isAdmin ? (
              <>
                Impostala dalle{" "}
                <Link href="/impostazioni" className="font-medium text-brand-deep underline">
                  Impostazioni
                </Link>
                .
              </>
            ) : (
              <>Chiedi a un amministratore di configurarla.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
