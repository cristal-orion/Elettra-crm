import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { puoGestireCommesse } from "@/lib/enums";
import { consuntivoValues, tariffarioValues } from "@/lib/consuntivi";
import { giornoAttivita } from "@/lib/attivita";
import { formatEuro } from "@/lib/format";
import { DetailNavigation } from "@/components/navigation-context";
import EconomicHistory from "@/components/economic-history";
import { salvaConsuntivo } from "../../../economia-actions";
import ConsuntivoForm from "./consuntivo-form";
import PrintLink from "@/components/print-link";

export default async function ConsuntivoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string; esito?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const job = await prisma.commessa.findUnique({ where: { id }, include: { cliente: { include: { tariffario: true } }, consuntivo: true } });
  if (!job) notFound();
  const tariffario = tariffarioValues(job.cliente.tariffario);
  return <div className="flex flex-col gap-6">
    <header><DetailNavigation listPath="/commesse" listLabel="Commesse" parent={{ href: `/commesse/${id}`, label: job.numero }} currentLabel="Consuntivo ore e materiali" />
      <h1 className="text-2xl font-bold">Consuntivo ore e materiali</h1><p className="mt-1 text-sm text-ink-soft">Commessa {job.numero} · {job.cliente.ragioneSociale}</p>
      <p className="mt-2 text-sm text-ink-soft">Rendiconto del lavoro a consuntivo: ore e materiali effettivi valorizzati con le tariffe del cliente. Le personalizzazioni valgono per questo lavoro e restano nello storico.</p>
      <Link href={`/anagrafiche/${job.clienteId}/tariffario`} className="mt-2 inline-flex min-h-11 items-center text-sm text-brand-deep underline">Apri tariffario cliente · versione {tariffario.versione}</Link>
      {job.consuntivo && <div className="mt-2"><PrintLink href={`/stampa/consuntivi/${id}`} /></div>}
    </header>
    {sp.esito === "salvato" && <p role="status" className="rounded-lg bg-ok-soft p-4 text-sm text-ok">Consuntivo salvato e modifica registrata.</p>}
    {!tariffario.versione && <p className="rounded-lg bg-warn-soft p-4 text-sm text-warn">Configura il tariffario del cliente per proporre le tariffe orarie e i ricarichi dei materiali.</p>}
    {job.consuntivo && <section aria-label="Totali salvati" className="rounded-xl border border-line bg-panel p-4">
      <h2 className="font-semibold">Totali salvati · versione {job.consuntivo.versione}</h2>
      <dl className="mt-3 grid gap-4 sm:grid-cols-3">{[["Manodopera", job.consuntivo.totaleOre], ["Materiali", job.consuntivo.totaleMateriali], ["Totale consuntivo", job.consuntivo.totale]].map(([label, value]) => <div key={String(label)}><dt className="text-xs text-ink-soft">{String(label)}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{formatEuro(value)}</dd></div>)}</dl>
    </section>}
    <ConsuntivoForm key={`${job.consuntivo?.versione ?? 0}:${tariffario.versione}`} initial={job.consuntivo ? consuntivoValues(job.consuntivo) : undefined} tariffario={tariffario} date={giornoAttivita().toISOString().slice(0, 10)} canEdit={puoGestireCommesse(user.ruolo)} action={salvaConsuntivo.bind(null, id)} />
    <EconomicHistory entita="CONSUNTIVO" id={job.consuntivo?.id} path={`/commesse/${id}/consuntivo`} pagina={sp.pagina} />
  </div>;
}
