import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/enums";
import { DetailNavigation } from "@/components/navigation-context";
import CommercialHistory from "@/components/commercial-history";
import { PhaseConfigForm } from "../workflow-forms";

export default async function PhasesPage({ searchParams }: { searchParams: Promise<{ pagina?: string; esito?: string }> }) {
  const user = await requireUser();
  if (!isSuperAdmin(user.ruolo)) redirect("/commerciale");
  const fasi = await prisma.faseCommerciale.findMany({ orderBy: [{ ordine: "asc" }, { id: "asc" }] }), sp = await searchParams;
  return <div className="space-y-6"><header><DetailNavigation listPath="/commerciale" listLabel="Commerciale" currentLabel="Configura fasi" /><h1 className="text-2xl font-bold">Fasi commerciali</h1><p className="mt-2 text-sm text-ink-soft">Personalizza nomi e ordine o aggiungi fasi aperte. La categoria determina conversione e indicatori. Per disattivare una fase, sposta prima le sue trattative; Vinta e Persa restano attive.</p></header>
    {sp.esito && <p role="status" className="text-sm text-brand-deep">Fase salvata.</p>}
    {fasi.map((f) => <PhaseConfigForm key={`${f.id}-${f.versione}`} initial={f} />)}
    <h2 className="font-semibold">Nuova fase</h2><PhaseConfigForm key={fasi.length} initial={{ id: randomUUID(), versione: 0, nome: "", categoria: "APERTA", ordine: 45, attiva: true }} />
    <CommercialHistory id={null} path="/commerciale/fasi" pagina={sp.pagina} />
  </div>;
}
