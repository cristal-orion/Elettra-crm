import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireCatalogo } from "@/lib/enums";
import { toNumber } from "@/lib/format";
import ProdottoForm, { type ProdottoFormValues } from "../../prodotto-form";
import { updateProdotto } from "../../actions";
import { isAiConfigured } from "@/lib/ai";

export const metadata = { title: "Modifica materiale — CRM Elettra" };

export default async function ModificaMaterialePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user || !puoGestireCatalogo(user.ruolo)) redirect("/materiali");

  const p = await prisma.prodotto.findUnique({ where: { id } });
  if (!p) notFound();

  const initial: ProdottoFormValues = {
    descrizione: p.descrizione,
    codice: p.codice ?? "",
    marca: p.marca ?? "",
    unitaMisura: p.unitaMisura ?? "",
    categoria: p.categoria ?? "",
    prezzoListino: p.prezzoListino ? String(toNumber(p.prezzoListino)) : "",
    datiTecnici: p.datiTecnici ?? "",
    note: p.note ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href={`/materiali/${id}`}
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← {p.descrizione}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Modifica materiale</h1>
      </header>
      <ProdottoForm
        action={updateProdotto.bind(null, id)}
        initial={initial}
        submitLabel="Salva modifiche"
        cancelHref={`/materiali/${id}`}
        schedaAttuale={p.schedaNomeFile}
        aiConfigured={await isAiConfigured()}
      />
    </div>
  );
}
