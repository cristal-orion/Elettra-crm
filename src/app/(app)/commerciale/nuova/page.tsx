import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { puoGestireAnagrafiche, puoGestireCommesse } from "@/lib/enums";
import { DetailNavigation } from "@/components/navigation-context";
import { commercialOptions } from "../data";
import OpportunityForm from "../opportunity-form";

export default async function NewOpportunity({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const user = await requireUser();
  if (!puoGestireCommesse(user.ruolo)) redirect("/commerciale");
  const options = await commercialOptions(), sp = await searchParams;
  return <div className="space-y-6"><header><DetailNavigation listPath="/commerciale" listLabel="Commerciale" currentLabel="Nuova trattativa" /><h1 className="text-2xl font-bold">Nuova trattativa</h1></header>
    <OpportunityForm id={randomUUID()} options={options} canCreateAnagrafica={puoGestireAnagrafiche(user.ruolo)} initial={{ versione: 0, titolo: "", anagraficaId: options.anagrafiche.some((a) => a.id === sp.cliente) ? sp.cliente! : "", referenteId: "", responsabileId: user.id, tipologia: "P", origine: "", descrizione: "", valorePrevisto: "", riferimentoOfferta: "", importoOfferta: "", dataInvioOfferta: "" }} />
  </div>;
}
