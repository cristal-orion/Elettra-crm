import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { puoGestireAnagrafiche } from "@/lib/enums";
import { tariffarioValues } from "@/lib/consuntivi";
import { DetailNavigation } from "@/components/navigation-context";
import EconomicHistory from "@/components/economic-history";
import { salvaTariffario } from "../../../economia-actions";
import TariffarioForm from "./tariffario-form";

export default async function TariffarioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string; esito?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const cliente = await prisma.anagrafica.findFirst({ where: { id, isCliente: true }, include: { tariffario: true } });
  if (!cliente) notFound();
  const prodotti = await prisma.prodotto.findMany({ orderBy: { descrizione: "asc" }, select: { id: true, descrizione: true, codice: true } });
  return <div className="flex flex-col gap-6">
    <header><DetailNavigation listPath="/anagrafiche" listLabel="Anagrafiche" parent={{ href: `/anagrafiche/${id}`, label: cliente.ragioneSociale }} currentLabel="Tariffario" />
      <h1 className="text-2xl font-bold">Tariffario cliente</h1><p className="mt-1 text-sm text-ink-soft">{cliente.ragioneSociale} · Versione {cliente.tariffario?.versione ?? 0}</p>
      <p className="mt-2 text-sm text-ink-soft">Le tariffe propongono i valori dei nuovi consuntivi. Ogni lavoro conserva i valori applicati e le relative modifiche nello storico.</p>
    </header>
    {sp.esito === "salvato" && <p role="status" className="rounded-lg bg-ok-soft p-4 text-sm text-ok">Tariffario salvato e modifica registrata.</p>}
    <TariffarioForm key={cliente.tariffario?.versione ?? 0} initial={tariffarioValues(cliente.tariffario)} prodotti={prodotti} canEdit={puoGestireAnagrafiche(user.ruolo)} action={salvaTariffario.bind(null, id)} />
    <EconomicHistory entita="TARIFFARIO" id={cliente.tariffario?.id} path={`/anagrafiche/${id}/tariffario`} pagina={sp.pagina} />
  </div>;
}
