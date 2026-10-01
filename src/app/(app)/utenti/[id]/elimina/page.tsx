import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRuolo } from "@/lib/dal";
import { etichettaRuolo } from "@/lib/enums";
import EliminaUtenteForm from "../../elimina-utente-form";

export const metadata = { title: "Elimina utente — CRM Elettra" };

export default async function EliminaUtentePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRuolo(["SUPER_ADMIN"]);
  const { id } = await params;
  const utente = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, nome: true, cognome: true, email: true, ruolo: true,
      _count: { select: { commesse: true, attivita: true, segnalazioni: true } },
    },
  });
  if (!utente) notFound();
  const haDati = Object.values(utente._count).some((n) => n > 0);
  const subentranti = haDati && id !== me.id ? await prisma.user.findMany({
    where: { id: { not: id }, attivo: true, ...(utente._count.commesse > 0 ? { ruolo: "PROJECT_MANAGER" } : {}) },
    orderBy: [{ cognome: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, cognome: true, ruolo: true },
  }) : [];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header>
        <Link href="/utenti" className="font-mono text-xs uppercase tracking-wider text-ink-faint hover:text-brand-deep">← Utenti</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Elimina {utente.nome} {utente.cognome}</h1>
        <p className="mt-1 text-sm text-ink-soft">{utente.email} · {etichettaRuolo(utente.ruolo)}</p>
      </header>

      {id === me.id ? (
        <p role="alert" className="rounded-xl bg-danger-soft p-5 text-sm text-danger">Non puoi eliminare il tuo stesso account.</p>
      ) : (
        <>
          <section className="rounded-xl border border-line bg-panel p-5">
            <h2 className="font-semibold">Dati collegati all’utente</h2>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              {[["Commesse", utente._count.commesse], ["Attività", utente._count.attivita], ["Segnalazioni", utente._count.segnalazioni]].map(([label, n]) => (
                <div key={label}><dt className="text-xs text-ink-soft">{label}</dt><dd className="mt-1 font-mono text-xl tabular-nums">{n}</dd></div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-ink-soft">
              {haDati ? "Questi dati, inclusi quelli già conclusi, saranno conservati e trasferiti al subentrante. Nelle segnalazioni l’autore precedente resterà annotato nella descrizione." : "Non ci sono commesse, attività o segnalazioni da trasferire."}
            </p>
          </section>
          <EliminaUtenteForm
            id={id}
            email={utente.email}
            haDati={haDati}
            richiedePM={utente._count.commesse > 0}
            subentranti={subentranti}
          />
        </>
      )}
    </div>
  );
}
