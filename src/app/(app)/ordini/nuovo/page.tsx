import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireOrdini } from "@/lib/enums";
import OrdineForm from "../ordine-form";
import { createOrdine } from "../actions";
import { getOrdineFormOptions } from "../data";

export const metadata = { title: "Nuovo ordine — CRM Elettra" };

export default async function NuovoOrdinePage({
  searchParams,
}: {
  searchParams: Promise<{ commessa?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !puoGestireOrdini(user.ruolo)) redirect("/ordini");

  const [{ fornitori, commesse }, sp] = await Promise.all([
    getOrdineFormOptions(),
    searchParams,
  ]);
  const oggi = new Date().toISOString().slice(0, 10);

  // Preseleziona la commessa se passata (e valida) via querystring.
  const commessaId =
    sp.commessa && commesse.some((c) => c.id === sp.commessa)
      ? sp.commessa
      : "";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/ordini"
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← Ordini
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Nuovo ordine</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Ordine a fornitore con righe di materiale ed eventuale entrata merce.
        </p>
      </header>
      <OrdineForm
        action={createOrdine}
        fornitori={fornitori}
        commesse={commesse}
        initial={{ stato: "ORDINATO", data: oggi, commessaId }}
        submitLabel="Crea ordine"
      />
    </div>
  );
}
