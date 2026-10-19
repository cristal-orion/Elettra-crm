import { DetailNavigation } from "@/components/navigation-context";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireCatalogo } from "@/lib/enums";
import { isAiConfigured } from "@/lib/ai";
import ProdottoForm from "../prodotto-form";
import { createProdotto } from "../actions";

export const metadata = { title: "Nuovo materiale — CRM Elettra" };

export default async function NuovoMaterialePage() {
  const user = await getCurrentUser();
  if (!user || !puoGestireCatalogo(user.ruolo)) redirect("/materiali");

  const aiConfigured = await isAiConfigured();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <DetailNavigation listPath="/materiali" listLabel="Materiali" currentLabel="Nuovo materiale" />
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Nuovo materiale</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Compila i campi, oppure carica il PDF della scheda tecnica e lascia che
          l&apos;AI li riempia.
        </p>
      </header>
      <ProdottoForm
        action={createProdotto}
        submitLabel="Crea materiale"
        aiConfigured={aiConfigured}
      />
    </div>
  );
}
