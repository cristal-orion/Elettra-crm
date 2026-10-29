import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireOperai } from "@/lib/enums";
import { DetailNavigation } from "@/components/navigation-context";
import RisorseNavigation from "../../navigation";
import { SquadraForm } from "../squadre-ui";

export default async function SquadraPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const canEdit = puoGestireOperai(user.ruolo);
  const team = id === "nuova" ? null : await prisma.squadra.findUnique({ where: { id }, include: { membri: { select: { id: true } } } });
  if ((id !== "nuova" && !team) || (id === "nuova" && !canEdit)) notFound();
  const workers = await prisma.operaio.findMany({ where: { OR: [{ squadra: null, attivo: true }, ...(team ? [{ squadra: team.nome }] : [])] }, orderBy: [{ cognome: "asc" }, { nome: "asc" }], select: { id: true, nome: true, cognome: true, attivo: true, qualifica: true } });
  return <div className="space-y-6"><header><DetailNavigation listPath="/risorse/squadre" listLabel="Squadre" currentLabel={team?.nome ?? "Nuova"} /><h1 className="mt-2 break-words text-2xl font-semibold">{team?.nome ?? "Crea squadra"}</h1></header><RisorseNavigation current="squadre" /><section className="rounded-xl border border-line bg-panel p-4 sm:p-6"><SquadraForm squadra={team ? { ...team, versione: team.updatedAt.toISOString(), membri: team.membri.map((m) => m.id) } : undefined} operai={workers} puoModificare={canEdit} /></section></div>;
}
