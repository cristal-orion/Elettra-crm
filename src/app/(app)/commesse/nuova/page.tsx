import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { DetailNavigation } from "@/components/navigation-context";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireCommesse, puoGestireAnagrafiche } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { emptyWizard, WizardData } from "@/lib/commessa-wizard-schema";
import CommessaWizard from "../commessa-wizard";
import { DocumentiUploader, DocDeleteButton } from "../documenti-ui";
import { uploadDocumentiBozza, deleteDocumento } from "../documenti-actions";
import Link from "next/link";

export const metadata = { title: "Nuova commessa — CRM Elettra" };

export default async function NuovaCommessaPage({ searchParams }: { searchParams: Promise<{ bozza?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !puoGestireCommesse(user.ruolo)) redirect("/commesse");

  const { bozza } = await searchParams;
  const draft = bozza ? await prisma.bozzaCommessa.findFirst({ where: { id: bozza, autoreId: user.id }, include: { documenti: { orderBy: { createdAt: "desc" } } } }) : null;
  if (bozza && !draft) notFound();
  if (draft?.commessaId) redirect(`/commesse/${draft.commessaId}`);
  const manageCustomers = puoGestireAnagrafiche(user.ruolo);
  const [anagrafiche, operai, pms] = await Promise.all([
    prisma.anagrafica.findMany({ where: manageCustomers ? {} : { isCliente: true }, orderBy: { ragioneSociale: "asc" }, select: {
      id: true, ragioneSociale: true, codiceCliente: true, isCliente: true, partitaIva: true, email: true, telefono: true,
      indirizzo: true, localita: true,
      referenti: { orderBy: [{ principale: "desc" }, { cognome: "asc" }], select: { id: true, nome: true, cognome: true, titolo: true } },
    } }),
    prisma.operaio.findMany({ where: { attivo: true }, orderBy: [{ cognome: "asc" }, { nome: "asc" }], select: { id: true, nome: true, cognome: true, squadra: true } }),
    prisma.user.findMany({ where: { attivo: true, ruolo: "PROJECT_MANAGER" }, orderBy: [{ cognome: "asc" }, { nome: "asc" }], select: { id: true, nome: true, cognome: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <DetailNavigation listPath="/commesse" listLabel="Commesse" currentLabel="Nuova commessa" />
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Nuova commessa
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Cinque passi, con bozze recuperabili. Il numero viene assegnato solo alla conferma dell’incarico.
        </p>
      </header>
      <p className="text-sm text-ink-soft">Incarico ancora da acquisire? <Link href="/commerciale/nuova" className="text-brand-deep underline">Apri una trattativa</Link>. <Link href="/commesse/bozze" className="text-brand-deep underline">Le mie bozze →</Link></p>
      <CommessaWizard key={draft?.id ?? "nuova"} id={draft?.id ?? randomUUID()} initial={draft ? WizardData.parse(draft.dati) : emptyWizard}
        initialVersion={draft?.versione ?? 0} initialStep={draft?.passo ?? 0}
        clienti={anagrafiche} pms={pms} operai={operai} manageCustomers={manageCustomers}
        documenti={draft?.documenti.map((d) => ({ id: d.id, nomeFile: d.nomeFile })) ?? []}>
        {draft && <section aria-label="Allegati della bozza" className="rounded-xl border border-line bg-panel p-5">
          <h3 className="mb-3 font-semibold">Allegati della bozza</h3>
          <p className="mb-3 text-sm text-ink-soft">Restano privati fino alla conferma; poi saranno collegati alla commessa senza duplicarli.</p>
          <ul className="mb-4 divide-y divide-line">{draft.documenti.map((doc) => <li key={doc.id} className="flex items-center justify-between gap-3 py-2"><a href={`/documenti/${doc.id}`} className="min-w-0 break-words text-sm text-brand-deep underline">{doc.nomeFile}</a><DocDeleteButton action={deleteDocumento.bind(null, doc.id)} nome={doc.nomeFile} /></li>)}</ul>
          <DocumentiUploader action={uploadDocumentiBozza.bind(null, draft.id)} />
        </section>}
      </CommessaWizard>
    </div>
  );
}
