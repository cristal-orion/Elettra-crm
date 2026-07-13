import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRuolo } from "@/lib/dal";
import { etichettaRuolo } from "@/lib/enums";

export const metadata = { title: "Utenti — CRM Elettra" };

export default async function UtentiPage() {
  await requireRuolo(["SUPER_ADMIN"]);

  const utenti = await prisma.user.findMany({
    orderBy: [{ attivo: "desc" }, { cognome: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      cognome: true,
      email: true,
      ruolo: true,
      attivo: true,
      _count: { select: { commesse: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">
            Amministrazione
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Utenti</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {utenti.length} utenti · gestione ruoli e accessi
          </p>
        </div>
        <Link
          href="/utenti/nuovo"
          className="rounded-lg bg-elettra px-4 py-2.5 text-sm font-semibold text-white transition"
        >
          + Nuovo utente
        </Link>
      </header>

      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Ruolo</th>
              <th className="px-4 py-3 font-medium">Stato</th>
              <th className="px-4 py-3 text-right font-medium">Commesse</th>
            </tr>
          </thead>
          <tbody>
            {utenti.map((u) => (
              <tr key={u.id} className="border-t border-line hover:bg-paper/50">
                <td className="px-5 py-3">
                  <Link
                    href={`/utenti/${u.id}/modifica`}
                    className="font-medium hover:text-brand-deep"
                  >
                    {u.nome} {u.cognome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-brand-deep">
                    {etichettaRuolo(u.ruolo)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.attivo ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-0.5 text-[11px] font-medium text-ok">
                      Attivo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-lead-soft px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
                      Disattivato
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-soft">
                  {u._count.commesse}
                </td>
              </tr>
            ))}
            {utenti.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-ink-faint">
                  Nessun utente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
