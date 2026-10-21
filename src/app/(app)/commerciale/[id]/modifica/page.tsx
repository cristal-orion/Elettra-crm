import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { puoGestireAnagrafiche, puoGestireCommesse } from "@/lib/enums";
import { opportunitaInput } from "@/lib/commerciale";
import { DetailNavigation } from "@/components/navigation-context";
import { commercialOptions } from "../../data";
import OpportunityForm from "../../opportunity-form";

export default async function EditOpportunity({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(), { id } = await params;
  if (!puoGestireCommesse(user.ruolo)) redirect(`/commerciale/${id}`);
  const row = await prisma.opportunita.findUnique({ where: { id }, include: { fase: true } });
  if (!row) notFound();
  if (["VINTA", "PERSA"].includes(row.fase.categoria)) redirect(`/commerciale/${id}`);
  return <div className="space-y-6"><header><DetailNavigation listPath="/commerciale" listLabel="Commerciale" parent={{ href: `/commerciale/${id}`, label: row.titolo }} currentLabel="Modifica" /><h1 className="text-2xl font-bold">Modifica trattativa</h1></header>
    <OpportunityForm key={row.versione} id={id} options={await commercialOptions()} initial={opportunitaInput(row)} canCreateAnagrafica={puoGestireAnagrafiche(user.ruolo)} />
  </div>;
}
