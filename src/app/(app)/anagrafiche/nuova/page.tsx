import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireAnagrafiche } from "@/lib/enums";
import AnagraficaForm from "../anagrafica-form";
import { createAnagrafica } from "../actions";

export const metadata = { title: "Nuova anagrafica — CRM Elettra" };

export default async function NuovaAnagraficaPage() {
  const user = await getCurrentUser();
  if (!user || !puoGestireAnagrafiche(user.ruolo)) redirect("/anagrafiche");

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
          Nuova anagrafica
        </h1>
      </header>
      <AnagraficaForm action={createAnagrafica} submitLabel="Crea anagrafica" />
    </div>
  );
}
