import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { puoGestireCommesse } from "@/lib/enums";
import { formatDate } from "@/lib/format";
import { attivitaHref } from "@/lib/attivita";

export default async function TaskContext({ user, commessaId, clienteId }: {
  user: { id: string; ruolo: string }; commessaId?: string; clienteId?: string;
}) {
  const canManage = puoGestireCommesse(user.ruolo);
  const where = { commessaId, clienteId, userId: canManage ? undefined : user.id, stato: "DA_FARE" };
  const [count, tasks] = await Promise.all([
    prisma.attivita.count({ where }),
    prisma.attivita.findMany({ where, take: 5, orderBy: [{ scadenza: { sort: "asc", nulls: "last" } }, { id: "asc" }], select: { id: true, titolo: true, scadenza: true, user: { select: { nome: true, cognome: true } } } }),
  ]);
  const query = new URLSearchParams();
  if (commessaId) query.set("commessaId", commessaId);
  if (clienteId) query.set("clienteId", clienteId);
  return <section className="rounded-xl border border-line bg-panel p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Attività collegate <span className="text-sm font-normal text-ink-soft">· {count} da fare</span></h2><Link href={`/attivita/nuova?${query}`} className="min-h-11 py-3 text-sm font-medium text-brand-deep">+ Nuova attività</Link></div>
    {!tasks.length ? <p className="mt-2 text-sm text-ink-soft">Nessuna attività da fare {canManage ? "per questo collegamento" : "assegnata a te per questo collegamento"}.</p> : <ul className="mt-2 divide-y divide-line">{tasks.map((t) => <li key={t.id}><Link href={attivitaHref(t.id)} className="flex flex-wrap justify-between gap-2 py-3 text-sm hover:text-brand-deep"><span className="font-medium">{t.titolo}</span><span className="text-xs text-ink-soft">{t.user.nome} {t.user.cognome} · {t.scadenza ? formatDate(t.scadenza) : "Senza scadenza"}</span></Link></li>)}</ul>}
    <Link href={`/attivita?${query}&vista=${canManage ? "team" : "mie"}&stato=tutte`} className="mt-3 inline-block text-sm text-brand-deep underline">Vedi tutte le attività collegate →</Link>
  </section>;
}
