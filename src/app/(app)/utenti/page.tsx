import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRuolo } from "@/lib/dal";
import { etichettaRuolo, RUOLI } from "@/lib/enums";
import { formatDate } from "@/lib/format";
import { romeDay } from "@/lib/ai/schedule-time";
import type { Prisma } from "@/generated/prisma";

export const metadata = { title: "Utenti — CRM Elettra" };

export default async function UtentiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ruolo?: string; stato?: string; esito?: string }>;
}) {
  const me = await requireRuolo(["SUPER_ADMIN"]);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const ruolo = Object.hasOwn(RUOLI, sp.ruolo ?? "") ? sp.ruolo! : "";
  const stato = sp.stato === "attivi" || sp.stato === "disattivati" ? sp.stato : "";
  const where: Prisma.UserWhereInput = {};
  if (ruolo) where.ruolo = ruolo;
  if (stato) where.attivo = stato === "attivi";
  if (q) {
    // Ogni parola può corrispondere a nome, cognome o email (anche "Nome Cognome").
    where.AND = q.split(/\s+/).map((parola) => ({
      OR: ["nome", "cognome", "email"].map((campo) => ({
        [campo]: { contains: parola, mode: "insensitive" },
      })),
    }));
  }

  const [utenti, riepilogo, commesseAperte, attivitaScadute] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ attivo: "desc" }, { cognome: "asc" }, { nome: "asc" }],
      select: {
        id: true, nome: true, cognome: true, email: true, ruolo: true, attivo: true,
        createdAt: true,
        _count: { select: {
          commesse: true,
          attivita: { where: { stato: "DA_FARE" } },
          segnalazioni: { where: { stato: { in: ["APERTA", "IN_LAVORAZIONE"] } } },
        } },
      },
    }),
    prisma.user.groupBy({ by: ["attivo", "ruolo"], _count: { _all: true } }),
    prisma.commessa.groupBy({
      by: ["pmId"], where: { pmId: { not: null }, stato: { notIn: ["FATTURATA", "PERSA"] } },
      _count: { _all: true },
    }),
    prisma.attivita.groupBy({
      by: ["userId"], where: { stato: "DA_FARE", scadenza: { lt: new Date(`${romeDay(new Date())}T00:00:00Z`) } },
      _count: { _all: true },
    }),
  ]);
  const totale = riepilogo.reduce((n, r) => n + r._count._all, 0);
  const attivi = riepilogo.filter((r) => r.attivo).reduce((n, r) => n + r._count._all, 0);
  const admin = riepilogo.filter((r) => r.attivo && r.ruolo === "SUPER_ADMIN").reduce((n, r) => n + r._count._all, 0);
  const apertePerUtente = new Map(commesseAperte.map((r) => [r.pmId, r._count._all]));
  const scadutePerUtente = new Map(attivitaScadute.map((r) => [r.userId, r._count._all]));
  const inputCls = "min-h-11 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-deep">Amministrazione</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Utenti</h1>
          <p className="mt-1 text-sm text-ink-soft">Gestione ruoli, accessi e carico di lavoro del team.</p>
        </div>
        <Link href="/utenti/nuovo" className="rounded-lg bg-elettra px-4 py-2.5 text-sm font-semibold text-white transition">
          + Nuovo utente
        </Link>
      </header>

      {sp.esito === "eliminato" && (
        <p role="status" className="rounded-lg bg-ok-soft px-4 py-3 text-sm text-ok">Utente eliminato. Gli eventuali dati operativi sono stati trasferiti al subentrante.</p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Utenti totali", totale], ["Accessi attivi", attivi], ["Disattivati", totale - attivi], ["Super Admin attivi", admin]].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-line bg-panel px-5 py-4">
            <p className="text-xs text-ink-soft">{label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-xs text-ink-soft">
          Cerca utente
          <input name="q" defaultValue={q} placeholder="Nome, cognome o email…" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-ink-soft">
          Ruolo
          <select name="ruolo" defaultValue={ruolo} className={inputCls}>
            <option value="">Tutti i ruoli</option>
            {Object.entries(RUOLI).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-ink-soft">
          Accesso
          <select name="stato" defaultValue={stato} className={inputCls}>
            <option value="">Tutti gli stati</option>
            <option value="attivi">Attivi</option>
            <option value="disattivati">Disattivati</option>
          </select>
        </label>
        <button className="min-h-11 rounded-lg border border-line bg-panel px-4 text-sm font-medium hover:bg-paper">Filtra</button>
        {(q || ruolo || stato) && <Link href="/utenti" className="px-2 py-3 text-sm text-ink-soft hover:text-brand-deep">Azzera filtri</Link>}
      </form>

      <div>
        <p className="mb-2 text-xs text-ink-soft" aria-live="polite">{utenti.length} di {totale} utenti</p>
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full text-sm">
            <caption className="sr-only">Utenti del CRM, permessi e riepilogo dei dati collegati</caption>
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                {["Utente", "Ruolo", "Accesso", "Commesse", "Attività da fare", "Segnalazioni aperte", "Creato il", "Azioni"].map((label) => (
                  <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {utenti.map((u) => {
                const scadute = scadutePerUtente.get(u.id) ?? 0;
                return (
                  <tr key={u.id} className="border-t border-line hover:bg-paper/50">
                    <td className="px-4 py-3">
                      <Link href={`/utenti/${u.id}/modifica`} className="whitespace-nowrap font-medium hover:text-brand-deep">{u.nome} {u.cognome}</Link>
                      {u.id === me.id && <span className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] text-brand-deep">Tu</span>}
                      <p className="mt-1 text-xs text-ink-soft">{u.email}</p>
                    </td>
                    <td className="px-4 py-3"><span className="whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-brand-deep">{etichettaRuolo(u.ruolo)}</span></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${u.attivo ? "bg-ok-soft text-ok" : "bg-lead-soft text-ink-soft"}`}>{u.attivo ? "Attivo" : "Disattivato"}</span></td>
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap font-mono tabular-nums">{apertePerUtente.get(u.id) ?? 0} aperte</p>
                      <p className="mt-1 text-xs text-ink-soft">{u._count.commesse} totali come PM</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono tabular-nums">{u._count.attivita}</p>
                      {scadute > 0 && <p className="mt-1 whitespace-nowrap text-xs font-medium text-danger">{scadute} scadute</p>}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{u._count.segnalazioni}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/utenti/${u.id}/modifica`} aria-label={`Modifica ${u.nome} ${u.cognome}`} className="rounded-lg border border-line px-3 py-2 text-xs font-medium hover:bg-paper">Modifica</Link>
                        {u.id !== me.id && <Link href={`/utenti/${u.id}/elimina`} aria-label={`Elimina ${u.nome} ${u.cognome}`} className="rounded-lg border border-line px-3 py-2 text-xs text-danger hover:bg-danger-soft">Elimina</Link>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {utenti.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-ink-faint">Nessun utente corrisponde ai filtri selezionati.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-soft">Commesse aperte: tutte tranne fatturate e perse. Attività e segnalazioni mostrano gli elementi ancora da completare.</p>
      </div>
    </div>
  );
}
