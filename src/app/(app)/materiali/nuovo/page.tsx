import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { puoGestireCatalogo } from "@/lib/enums";
import ProdottoForm from "../prodotto-form";
import { createProdotto } from "../actions";

export const metadata = { title: "Nuovo materiale — CRM Elettra" };

export default async function NuovoMaterialePage() {
  const user = await getCurrentUser();
  if (!user || !puoGestireCatalogo(user.ruolo)) redirect("/materiali");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/materiali"
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← Catalogo materiali
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Nuovo materiale</h1>
      </header>
      <ProdottoForm action={createProdotto} submitLabel="Crea materiale" />
    </div>
  );
}
