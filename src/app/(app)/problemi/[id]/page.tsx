import Link from "next/link";
import AiContextPanel from "@/components/ai/context-panel";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { commessaScope } from "@/lib/access";
import { puoGestireProgetti } from "@/lib/enums";
import { formatDate, formatDateTime } from "@/lib/format";
import { ProblemaForm } from "@/components/operativo-forms";
import { ProblemaStato } from "@/components/problemi-list";
import { DetailNavigation } from "@/components/navigation-context";

export default async function ProblemaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ esito?: string }> }) {
  const user = await requireUser(); const { id } = await params;
  const p = await prisma.problemaCantiere.findFirst({ where: { id, commessa: commessaScope(user) }, include: { commessa: { select: { numero: true, cliente: { select: { ragioneSociale: true } } } }, documenti: { orderBy: { createdAt: "asc" } }, eventi: { orderBy: { createdAt: "desc" }, take: 100 }, attivita: { select: { id: true } } } });
  if (!p) notFound();
  const utenti = await prisma.user.findMany({ where: { attivo: true }, select: { id: true, nome: true, cognome: true, ruolo: true }, orderBy: { cognome: "asc" } });
  const responsabile = utenti.find((u) => u.id === p.assegnatarioId);
  return <div className="space-y-6"><header className="space-y-3"><DetailNavigation listPath="/problemi" listLabel="Problemi di cantiere" currentLabel={p.titolo} /><h1 className="break-words text-2xl font-semibold">{p.titolo}</h1><ProblemaStato stato={p.stato} priorita={p.priorita} /><div className="flex flex-wrap items-center gap-3"><Link href={`/progetti/${p.commessaId}?tab=problemi`} className="inline-flex min-h-11 items-center text-sm text-brand-deep underline">{p.commessa.numero} · {p.commessa.cliente.ragioneSociale} →</Link>{puoGestireProgetti(user.ruolo) && <a href="#aggiorna-problema" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-deep xl:hidden">Aggiorna problema</a>}</div></header>
    {(await searchParams).esito === "salvato" && <p role="status" className="rounded-lg bg-ok-soft p-4 text-sm text-ok">Problema salvato. Attività e notifiche collegate sono aggiornate.</p>}
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><div className="min-w-0 space-y-6"><section className="space-y-4 rounded-xl border border-line bg-panel p-4 sm:p-6"><h2 className="text-sm font-semibold">Dettagli</h2><p className="whitespace-pre-wrap break-words text-sm">{p.descrizione}</p><p className="text-sm text-ink-soft">Responsabile: {responsabile ? `${responsabile.nome} ${responsabile.cognome}` : p.assegnatarioId ? "Utente non attivo" : "Da assegnare"}<br />Scadenza: {formatDate(p.scadenza)}</p><p className="text-xs text-ink-soft">Aperto da {p.autoreNome} · {formatDateTime(p.createdAt)}</p>{p.attivita && <Link href={`/attivita/${p.attivita.id}`} className="inline-flex min-h-11 items-center text-sm text-brand-deep underline">Apri attività collegata →</Link>}
      {p.documenti.length > 0 && <div><h3 className="text-sm font-medium">Allegati ({p.documenti.length})</h3><ul>{p.documenti.map((d) => <li key={d.id}><a href={`/documenti/${d.id}`} className="inline-flex min-h-11 items-center break-all text-sm text-brand-deep underline">{d.nomeFile}</a></li>)}</ul></div>}
    </section><section className="rounded-xl border border-line bg-panel p-4 sm:p-6"><h2 className="mb-4 text-sm font-semibold">Storico aggiornamenti</h2><ol className="space-y-4">{p.eventi.map((e) => <li key={e.id} className="border-l-2 border-line pl-4"><p className="text-xs text-ink-soft">{e.autoreNome} · {formatDateTime(e.createdAt)}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{e.testo}</p></li>)}</ol><p className="mt-4 text-xs text-ink-soft">Ultimi 100 aggiornamenti.</p></section></div>
    {puoGestireProgetti(user.ruolo) && <section className="min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-6"><h2 id="aggiorna-problema" tabIndex={-1} className="mb-5 scroll-mt-6 text-base font-semibold">Aggiorna problema</h2><ProblemaForm key={p.versione} commessaId={p.commessaId} richiestaId={randomUUID()} utenti={utenti.filter((u) => puoGestireProgetti(u.ruolo)).map((u) => ({ id: u.id, label: `${u.nome} ${u.cognome}` }))} initial={{ id, titolo: p.titolo, versione: p.versione, stato: p.stato, priorita: p.priorita, assegnatarioId: p.assegnatarioId, scadenza: p.scadenza?.toISOString().slice(0, 10) ?? "" }} /></section>}
    </div><AiContextPanel type="problema" id={id} /></div>;
}
