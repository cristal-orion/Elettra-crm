import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireAnagrafiche } from "@/lib/enums";
import AnagraficaForm, {
  type AnagraficaFormValues,
} from "../../anagrafica-form";
import { updateAnagrafica } from "../../actions";

export const metadata = { title: "Modifica anagrafica — CRM Elettra" };

export default async function ModificaAnagraficaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user || !puoGestireAnagrafiche(user.ruolo)) redirect("/anagrafiche");

  const anagrafica = await prisma.anagrafica.findUnique({
    where: { id },
    include: {
      referenti: { orderBy: [{ principale: "desc" }, { cognome: "asc" }] },
    },
  });
  if (!anagrafica) notFound();

  const initial: AnagraficaFormValues = {
    expectedUpdatedAt: anagrafica.updatedAt.toISOString(),
    ragioneSociale: anagrafica.ragioneSociale,
    isCliente: anagrafica.isCliente,
    isFornitore: anagrafica.isFornitore,
    partitaIva: anagrafica.partitaIva ?? "",
    codiceFiscale: anagrafica.codiceFiscale ?? "",
    codiceSDI: anagrafica.codiceSDI ?? "",
    indirizzo: anagrafica.indirizzo ?? "",
    cap: anagrafica.cap ?? "",
    localita: anagrafica.localita ?? "",
    provincia: anagrafica.provincia ?? "",
    telefono: anagrafica.telefono ?? "",
    fax: anagrafica.fax ?? "",
    email: anagrafica.email ?? "",
    web: anagrafica.web ?? "",
    modalitaPagamento: anagrafica.modalitaPagamento ?? "",
    prodottiTrattati: anagrafica.prodottiTrattati ?? "",
    note: anagrafica.note ?? "",
    referenti: anagrafica.referenti.map((r) => ({
      id: r.id,
      titolo: r.titolo,
      nome: r.nome,
      cognome: r.cognome,
      ruoloAzienda: r.ruoloAzienda ?? "",
      email: r.email ?? "",
      telefono: r.telefono ?? "",
      principale: r.principale,
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href={`/anagrafiche/${id}`}
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← {anagrafica.ragioneSociale}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Modifica anagrafica
        </h1>
      </header>
      <AnagraficaForm
        action={updateAnagrafica.bind(null, id)}
        initial={initial}
        submitLabel="Salva modifiche"
        cancelHref={`/anagrafiche/${id}`}
      />
    </div>
  );
}
