import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireCatalogo, puoGestireUtenti } from "@/lib/enums";
import { isAiConfigured } from "@/lib/ai";
import SchedaImport from "./scheda-import";

export const metadata = { title: "Materiale da scheda tecnica — CRM Elettra" };

export default async function DaSchedaPage() {
  const user = await getCurrentUser();
  if (!user || !puoGestireCatalogo(user.ruolo)) redirect("/materiali");

  const configurato = await isAiConfigured();
  const isAdmin = puoGestireUtenti(user.ruolo);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/materiali"
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← Catalogo materiali
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Nuovo materiale da scheda tecnica
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Carica il PDF della scheda: l&apos;AI precompila il materiale, tu confermi.
        </p>
      </header>

      {configurato ? (
        <SchedaImport />
      ) : (
        <div className="rounded-xl border border-warn/40 bg-warn-soft/50 p-6">
          <h2 className="text-sm font-semibold text-warn">
            Assistente AI non configurato
          </h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            La lettura delle schede richiede la chiave API Gemini.{" "}
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
            )}{" "}
            Puoi comunque{" "}
            <Link href="/materiali/nuovo" className="font-medium text-brand-deep underline">
              inserire il materiale a mano
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
