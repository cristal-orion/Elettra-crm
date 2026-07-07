import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireOrdini } from "@/lib/enums";
import OrdineForm, {
  type OrdineFormValues,
  type RigaValue,
} from "../../ordine-form";
import { updateOrdine } from "../../actions";
import { getOrdineFormOptions } from "../../data";

export const metadata = { title: "Modifica ordine — CRM Elettra" };

/** Data → stringa "YYYY-MM-DD" per input[type=date] (null → ""). */
function toDateInput(value: Date | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default async function ModificaOrdinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user || !puoGestireOrdini(user.ruolo)) redirect("/ordini");

  const [ordine, { fornitori, commesse }] = await Promise.all([
    prisma.ordineFornitore.findUnique({
      where: { id },
      include: { righe: { orderBy: { createdAt: "asc" } } },
    }),
    getOrdineFormOptions(),
  ]);
  if (!ordine) notFound();

  const righe: RigaValue[] = ordine.righe.map((r) => ({
    id: r.id,
    codiceProdotto: r.codiceProdotto ?? "",
    descrizione: r.descrizione,
    unitaMisura: r.unitaMisura ?? "",
    quantita: r.quantita.toString(),
    prezzoUnitario: r.prezzoUnitario.toString(),
    sconto: r.sconto?.toString() ?? "",
    aliquotaIva: r.aliquotaIva?.toString() ?? "",
    dataConsegnaPrevista: toDateInput(r.dataConsegnaPrevista),
    quantitaRicevuta: r.quantitaRicevuta?.toString() ?? "",
    ddtNumero: r.ddtNumero ?? "",
    ddtData: toDateInput(r.ddtData),
    fatturaNumero: r.fatturaNumero ?? "",
    fatturaData: toDateInput(r.fatturaData),
  }));

  const initial: OrdineFormValues = {
    fornitoreId: ordine.fornitoreId,
    commessaId: ordine.commessaId ?? "",
    numero: ordine.numero ?? "",
    data: toDateInput(ordine.data),
    stato: ordine.stato,
    righe,
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href={`/ordini/${id}`}
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← {ordine.numero ?? "Ordine"}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Modifica ordine
        </h1>
      </header>
      <OrdineForm
        action={updateOrdine.bind(null, id)}
        fornitori={fornitori}
        commesse={commesse}
        initial={initial}
        submitLabel="Salva modifiche"
        cancelHref={`/ordini/${id}`}
      />
    </div>
  );
}
