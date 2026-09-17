import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireCommesse } from "@/lib/enums";
import CommessaForm, {
  type CommessaFormValues,
} from "../../commessa-form";
import { updateCommessa } from "../../actions";
import { getCommessaFormOptions } from "../../data";

export const metadata = { title: "Modifica commessa — CRM Elettra" };

/** Data → stringa "YYYY-MM-DD" per input[type=date] (null → ""). */
function toDateInput(value: Date | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default async function ModificaCommessaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user || !puoGestireCommesse(user.ruolo)) redirect("/commesse");

  const [commessa, { clienti, pms }, ordiniCollegati] = await Promise.all([
    prisma.commessa.findUnique({ where: { id } }),
    getCommessaFormOptions(),
    prisma.ordineFornitore.count({ where: { commessaId: id } }),
  ]);
  if (!commessa) notFound();

  // Regola P→C: con ordini materiali collegati la tipologia è bloccata a "C".
  const bloccoConsuntivo = ordiniCollegati > 0 && !["T", "GARA"].includes(commessa.tipologia ?? "");

  const initial: CommessaFormValues = {
    expectedUpdatedAt: commessa.updatedAt.toISOString(),
    clienteId: commessa.clienteId,
    referenteId: commessa.referenteId ?? "",
    pmId: commessa.pmId ?? "",
    referenteCommerciale: commessa.referenteCommerciale ?? "",
    stato: commessa.stato,
    tipologia: commessa.tipologia ?? "",
    descrizione: commessa.descrizione ?? "",
    dataRichiesta: toDateInput(commessa.dataRichiesta),
    dataInvio: toDateInput(commessa.dataInvio),
    importoOfferta: commessa.importoOfferta?.toString() ?? "",
    importoOrdine: commessa.importoOrdine?.toString() ?? "",
    dataOrdine: toDateInput(commessa.dataOrdine),
    metodoRicezioneOrdine: commessa.metodoRicezioneOrdine ?? "",
    motivazionePersa: commessa.motivazionePersa ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href={`/commesse/${id}`}
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← {commessa.numero}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Modifica commessa
        </h1>
      </header>
      <CommessaForm
        action={updateCommessa.bind(null, id)}
        clienti={clienti}
        pms={pms}
        initial={initial}
        submitLabel="Salva modifiche"
        cancelHref={`/commesse/${id}`}
        bloccoConsuntivo={bloccoConsuntivo}
      />
    </div>
  );
}
