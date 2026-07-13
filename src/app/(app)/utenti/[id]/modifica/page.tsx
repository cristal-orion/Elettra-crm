import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRuolo } from "@/lib/dal";
import { etichettaRuolo } from "@/lib/enums";
import UtenteForm, { type UtenteFormValues } from "../../utente-form";
import { updateUtente } from "../../actions";

export const metadata = { title: "Modifica utente — CRM Elettra" };

export default async function ModificaUtentePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRuolo(["SUPER_ADMIN"]);
  const { id } = await params;

  const utente = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      cognome: true,
      email: true,
      ruolo: true,
      attivo: true,
    },
  });
  if (!utente) notFound();

  const initial: UtenteFormValues = {
    nome: utente.nome,
    cognome: utente.cognome,
    email: utente.email,
    ruolo: utente.ruolo,
    attivo: utente.attivo,
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/utenti"
          className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep"
        >
          ← Utenti
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {utente.nome} {utente.cognome}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">{etichettaRuolo(utente.ruolo)}</p>
      </header>
      <UtenteForm
        action={updateUtente.bind(null, id)}
        initial={initial}
        isEdit
        submitLabel="Salva modifiche"
      />
    </div>
  );
}
