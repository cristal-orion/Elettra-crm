import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireCommesse } from "@/lib/enums";
import { WizardData, wizardSteps } from "@/lib/commessa-wizard-schema";
import { formatDate } from "@/lib/format";
import { DetailNavigation } from "@/components/navigation-context";

export const metadata = { title: "Le mie bozze commessa — CRM Elettra" };
export default async function BozzePage() {
  const user = await requireUser();
  if (!puoGestireCommesse(user.ruolo)) redirect("/commesse");
  const drafts = await prisma.bozzaCommessa.findMany({ where: { autoreId: user.id, commessaId: null }, orderBy: { updatedAt: "desc" }, take: 100 });
  return <div className="flex flex-col gap-5">
    <header><DetailNavigation listPath="/commesse" listLabel="Commesse" currentLabel="Le mie bozze" /><h1 className="mt-2 text-2xl font-bold">Le mie bozze commessa</h1></header>
    <p className="text-sm text-ink-soft">Le ultime 100 bozze personali: non hanno un numero, non impegnano risorse e non rientrano nei totali delle commesse.</p>
    <Link href="/commesse/nuova" className="text-brand-deep underline">+ Nuova commessa</Link>
    {drafts.length === 0 && <p>Nessuna bozza da riprendere.</p>}
    <ul className="divide-y divide-line rounded-xl border border-line bg-panel">{drafts.map((draft) => {
      const data = WizardData.parse(draft.dati);
      return <li key={draft.id} className="p-4"><Link href={`/commesse/nuova?bozza=${draft.id}`} className="block break-words font-medium text-brand-deep">{data.descrizione.trim() || data.ragioneSociale.trim() || "Bozza senza titolo"}</Link><p className="mt-1 text-xs text-ink-soft">{wizardSteps[draft.passo]} · Ultimo salvataggio {formatDate(draft.updatedAt)}</p></li>;
    })}</ul>
  </div>;
}
