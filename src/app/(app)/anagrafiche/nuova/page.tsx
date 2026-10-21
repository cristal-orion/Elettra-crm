import { redirect } from "next/navigation";
import { DetailNavigation } from "@/components/navigation-context";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireAnagrafiche } from "@/lib/enums";
import AnagraficaForm from "../anagrafica-form";
import { createAnagrafica } from "../actions";

export const metadata = { title: "Nuova anagrafica — CRM Elettra" };

export default async function NuovaAnagraficaPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !puoGestireAnagrafiche(user.ruolo)) redirect("/anagrafiche");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <DetailNavigation listPath="/anagrafiche" listLabel="Anagrafiche" currentLabel="Nuova anagrafica" />
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Nuova anagrafica
        </h1>
      </header>
      <AnagraficaForm action={createAnagrafica} initial={{ isProspect: (await searchParams).tipo === "prospect" }} submitLabel="Crea anagrafica" />
    </div>
  );
}
