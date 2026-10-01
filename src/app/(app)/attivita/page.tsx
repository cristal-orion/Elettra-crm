import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { puoGestireCommesse } from "@/lib/enums";
import { attivitaHref, attivitaScope, attivitaWhere, giornoAttivita, statoScadenza } from "@/lib/attivita";
import TaskActions from "./task-actions";

export const metadata = { title: "Attività — CRM Elettra" };
const PER_PAGE = 30;

export default async function TasksPage({ searchParams }: {
  searchParams: Promise<{ stato?: string; vista?: string; responsabile?: string; scadenza?: string; q?: string; pagina?: string; esito?: string; commessaId?: string; clienteId?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const canManage = puoGestireCommesse(user.ruolo);
  const vista = canManage && sp.vista === "team" ? "team" : "mie";
  const stato = sp.stato === "COMPLETATA" || sp.stato === "tutte" ? sp.stato : "DA_FARE";
  const scadenza = ["scadute", "oggi", "prossime", "senza"].includes(sp.scadenza ?? "") ? sp.scadenza! : "";
  const q = (sp.q ?? "").trim();
  const responsabile = vista === "team" ? sp.responsabile ?? "" : "";
  const commessaId = sp.commessaId ?? "";
  const clienteId = sp.clienteId ?? "";
  const now = new Date();
  const scope = { ...attivitaScope(user, vista, responsabile), commessaId: commessaId || undefined, clienteId: clienteId || undefined };
  const where = attivitaWhere(user, { vista, responsabile, stato, scadenza, q, commessaId, clienteId }, now);
  const oggi = giornoAttivita(now);
  const [totale, riepilogo, scadute, inScadenza, utenti] = await Promise.all([
    prisma.attivita.count({ where }),
    prisma.attivita.groupBy({ by: ["stato"], where: scope, _count: { _all: true } }),
    prisma.attivita.count({ where: { ...scope, stato: "DA_FARE", scadenza: { lt: oggi } } }),
    prisma.attivita.count({ where: { ...scope, stato: "DA_FARE", scadenza: { gte: oggi, lt: new Date(oggi.getTime() + 86400000) } } }),
    canManage ? prisma.user.findMany({ orderBy: [{ cognome: "asc" }, { nome: "asc" }], select: { id: true, nome: true, cognome: true, attivo: true } }) : [],
  ]);
  const pages = Math.max(1, Math.ceil(totale / PER_PAGE));
  const pagina = Math.min(pages, Math.max(1, Math.floor(Number(sp.pagina) || 1)));
  const tasks = await prisma.attivita.findMany({
    where, skip: (pagina - 1) * PER_PAGE, take: PER_PAGE,
    orderBy: [{ stato: "desc" }, { scadenza: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }, { id: "asc" }],
    include: { user: { select: { nome: true, cognome: true } }, commessa: { select: { numero: true } }, cliente: { select: { ragioneSociale: true } } },
  });
  const link = (changes: Record<string, string>) => {
    const params = new URLSearchParams({ vista, stato, scadenza, q, responsabile, commessaId, clienteId, ...changes });
    for (const [key, value] of [...params]) if (!value) params.delete(key);
    return `/attivita?${params}`;
  };
  const cls = "min-h-11 rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
  const prefill = new URLSearchParams();
  if (commessaId) prefill.set("commessaId", commessaId);
  if (clienteId) prefill.set("clienteId", clienteId);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-wider text-brand-deep">Organizzazione</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Attività</h1><p className="mt-1 text-sm text-ink-soft">Follow-up, scadenze e prossimi passi collegati al CRM.</p></div>
        <Link href={`/attivita/nuova${prefill.size ? `?${prefill}` : ""}`} className="rounded-lg bg-elettra px-4 py-2.5 text-sm font-semibold text-white">+ Nuova attività</Link>
      </header>
      {sp.esito === "eliminata" && <p role="status" className="rounded-lg bg-ok-soft p-4 text-sm text-ok">Attività eliminata. I dati di commesse e anagrafiche sono stati conservati.</p>}
      {(commessaId || clienteId) && <p className="rounded-lg bg-brand-soft p-4 text-sm text-brand-deep">Stai visualizzando le attività del collegamento selezionato. <Link href={link({ commessaId: "", clienteId: "" })} className="ml-2 underline">Mostra tutti i collegamenti</Link></p>}
      {canManage && <nav aria-label="Vista attività" className="flex flex-wrap gap-2">{[["mie", "Le mie attività"], ["team", "Attività del team"]].map(([key, label]) => <Link key={key} href={link({ vista: key, responsabile: "", pagina: "" })} aria-current={vista === key ? "page" : undefined} className={`min-h-11 rounded-lg px-4 py-3 text-sm ${vista === key ? "bg-brand-soft font-semibold text-brand-deep" : "border border-line bg-panel text-ink-soft"}`}>{label}</Link>)}</nav>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Da fare", riepilogo.find((r) => r.stato === "DA_FARE")?._count._all ?? 0], ["Scadute", scadute], ["In scadenza oggi", inScadenza], ["Completate", riepilogo.find((r) => r.stato === "COMPLETATA")?._count._all ?? 0]].map(([label, count]) => <div key={label} className="rounded-xl border border-line bg-panel px-5 py-4"><p className="text-xs text-ink-soft">{label}</p><p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${label === "Scadute" && Number(count) > 0 ? "text-danger" : ""}`}>{count}</p></div>)}
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="vista" value={vista} />
        {commessaId && <input type="hidden" name="commessaId" value={commessaId} />}
        {clienteId && <input type="hidden" name="clienteId" value={clienteId} />}
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-xs text-ink-soft">Cerca<input name="q" defaultValue={q} placeholder="Titolo, note, commessa o cliente…" className={cls} /></label>
        <label className="flex flex-col gap-1.5 text-xs text-ink-soft">Stato<select name="stato" defaultValue={stato} className={cls}><option value="DA_FARE">Da fare</option><option value="COMPLETATA">Completate</option><option value="tutte">Tutti gli stati</option></select></label>
        <label className="flex flex-col gap-1.5 text-xs text-ink-soft">Scadenza<select name="scadenza" defaultValue={scadenza} className={cls}><option value="">Tutte le scadenze</option><option value="scadute">Scadute</option><option value="oggi">Oggi</option><option value="prossime">Prossimi 7 giorni</option><option value="senza">Senza scadenza</option></select></label>
        {vista === "team" && <label className="flex flex-col gap-1.5 text-xs text-ink-soft">Responsabile<select name="responsabile" defaultValue={responsabile} className={cls}><option value="">Tutto il team</option>{utenti.map((u) => <option key={u.id} value={u.id}>{u.nome} {u.cognome}{u.attivo ? "" : " (disattivato)"}</option>)}</select></label>}
        <button className="min-h-11 rounded-lg border border-line bg-panel px-4 text-sm font-medium hover:bg-paper">Filtra</button>
        {(q || scadenza || responsabile || stato !== "DA_FARE") && <Link href={link({ q: "", scadenza: "", responsabile: "", stato: "DA_FARE" })} className="px-2 py-3 text-sm text-ink-soft">Azzera filtri</Link>}
      </form>
      <section aria-label="Elenco attività" className="space-y-3">
        <p className="text-xs text-ink-soft">{totale} attività trovate · {vista === "team" ? "Vista del team" : "Assegnate a te"}</p>
        {!tasks.length && <div className="rounded-xl border border-line bg-panel p-6"><p className="font-medium">Nessuna attività in questa vista.</p><p className="mt-2 text-sm text-ink-soft">Modifica i filtri oppure crea un’attività per pianificare il prossimo passo.</p></div>}
        <ul className="space-y-3">{tasks.map((t) => {
          const due = statoScadenza(t.scadenza, t.stato, now);
          return <li key={t.id} className="space-y-4 rounded-xl border border-line bg-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><Link href={attivitaHref(t.id)} className="font-semibold hover:text-brand-deep">{t.titolo}</Link><p className="mt-1 text-xs text-ink-soft">{t.user.nome} {t.user.cognome}</p></div>
              <div className="flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-2.5 py-1 font-medium ${t.stato === "COMPLETATA" ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand-deep"}`}>{t.stato === "COMPLETATA" ? "Completata" : "Da fare"}</span><span className={`rounded-full px-2.5 py-1 ${due === "scaduta" ? "bg-danger-soft text-danger" : due === "oggi" ? "bg-warn-soft text-warn" : "bg-paper text-ink-soft"}`}>{due === "scaduta" ? "Scaduta · " : due === "oggi" ? "Oggi · " : ""}{t.scadenza ? formatDate(t.scadenza) : "Senza scadenza"}</span></div>
            </div>
            {t.note && <p className="line-clamp-3 whitespace-pre-wrap text-sm text-ink-soft">{t.note}</p>}
            <div className="flex flex-wrap gap-4 text-sm">{t.commessaId && <Link href={`/commesse/${t.commessaId}`} className="text-brand-deep underline">Commessa {t.commessa?.numero}</Link>}{t.clienteId && <Link href={`/anagrafiche/${t.clienteId}`} className="text-brand-deep underline">{t.cliente?.ragioneSociale}</Link>}<Link href={attivitaHref(t.id)} className="text-brand-deep underline">Apri / modifica</Link></div>
            <TaskActions task={{ id: t.id, titolo: t.titolo, stato: t.stato, updatedAt: t.updatedAt.toISOString() }} />
          </li>;
        })}</ul>
      </section>
      {pages > 1 && <nav aria-label="Pagine attività" className="flex items-center justify-between gap-3 text-sm">{pagina > 1 ? <Link href={link({ pagina: String(pagina - 1) })} className={cls}>← Precedente</Link> : <span />}<span className="text-ink-soft">Pagina {pagina} di {pages}</span>{pagina < pages ? <Link href={link({ pagina: String(pagina + 1) })} className={cls}>Successiva →</Link> : <span />}</nav>}
      <p className="text-xs text-ink-soft">Le scadenze seguono il giorno italiano. Le assegnazioni effettuate da altri e i promemoria di scadenza compaiono nelle <Link href="/notifiche" className="text-brand-deep underline">notifiche</Link>.</p>
    </div>
  );
}
