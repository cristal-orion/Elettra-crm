import Link from "next/link";
import { requireRuolo } from "@/lib/dal";
import UtenteForm from "../utente-form";
import { createUtente } from "../actions";

export const metadata = { title: "Nuovo utente — CRM Elettra" };

export default async function NuovoUtentePage() {
  await requireRuolo(["SUPER_ADMIN"]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/utenti"
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← Utenti
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Nuovo utente</h1>
      </header>
      <UtenteForm action={createUtente} submitLabel="Crea utente" />
    </div>
  );
}
