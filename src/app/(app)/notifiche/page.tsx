import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { openNotification } from "./actions";
import NotificationControls from "./notification-controls";
import type { Prisma } from "@/generated/prisma";
import ListFilters from "@/components/list-filters";
import ListPagination from "@/components/list-pagination";
import { listPage } from "@/lib/list-state";
import { notificationScope } from "@/lib/notifiche";

export const metadata = { title: "Notifiche — CRM Elettra" };
const PER_PAGE = 30;

export default async function NotificationsPage({ searchParams }: {
  searchParams: Promise<{ vista?: string; tipo?: string; pagina?: string; esito?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const vista = sp.vista === "nonlette" || sp.vista === "lette" ? sp.vista : "tutte";
  const tipo = sp.tipo === "attivita" || sp.tipo === "controlli" || sp.tipo === "problemi" ? sp.tipo : "tutte";
  const scope = await notificationScope(prisma, user);
  const where: Prisma.NotificaWhereInput = { ...scope };
  if (vista !== "tutte") where.letta = vista === "lette";
  if (tipo === "controlli") where.runId = { not: null };
  if (tipo === "attivita") { where.runId = null; where.href = { startsWith: "/attivita/" }; }
  if (tipo === "problemi") where.href = { startsWith: "/problemi/" };
  const [totale, stats] = await Promise.all([
    prisma.notifica.count({ where }),
    prisma.notifica.groupBy({ by: ["letta"], where: scope, _count: { _all: true } }),
  ]);
  const unread = stats.find((s) => !s.letta)?._count._all ?? 0;
  const all = stats.reduce((n, s) => n + s._count._all, 0);
  const { page: pagina, pages } = listPage(sp.pagina, totale, PER_PAGE);
  const rows = await prisma.notifica.findMany({ where, orderBy: [{ letta: "asc" }, { createdAt: "desc" }, { id: "asc" }], skip: (pagina - 1) * PER_PAGE, take: PER_PAGE });
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-xs uppercase tracking-wider text-brand-deep">Aggiornamenti</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Notifiche</h1><p className="mt-1 text-sm text-ink-soft">Assegnazioni, scadenze delle attività e riepiloghi dei controlli programmati.</p></div>
        <NotificationControls disabled={unread === 0} />
      </header>
      {sp.esito === "non-trovata" && <p role="alert" className="rounded-lg bg-warn-soft p-4 text-sm text-warn">La notifica non è più disponibile o non appartiene al tuo account.</p>}
      <div className="grid grid-cols-3 gap-3">{[["Da leggere", unread], ["Lette", all - unread], ["Totali", all]].map(([label, n]) => <div key={label} className="rounded-xl border border-line bg-panel px-4 py-4"><p className="text-xs text-ink-soft">{label}</p><p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{n}</p></div>)}</div>
      <ListFilters total={totale} filters={[
        { name: "vista", label: "Stato", value: vista, defaultValue: "tutte", options: [{ value: "tutte", label: "Tutte" }, { value: "nonlette", label: "Da leggere" }, { value: "lette", label: "Lette" }] },
        { name: "tipo", label: "Tipo", value: tipo, defaultValue: "tutte", options: [{ value: "tutte", label: "Tutti i tipi" }, { value: "attivita", label: "Attività" }, { value: "problemi", label: "Problemi cantiere" }, { value: "controlli", label: "Controlli programmati" }] },
      ]} />
      <p className="text-xs text-ink-soft">{totale} notifiche in questa vista · Aprendo una notifica, viene segnata come letta.</p>
      {!rows.length && <div className="rounded-xl border border-line bg-panel p-6"><h2 className="font-semibold">Nessuna notifica in questa vista</h2><p className="mt-2 text-sm text-ink-soft">Qui compariranno le attività assegnate da altri, i promemoria delle tue scadenze e i controlli di cui sei destinatario.</p><div className="mt-4 flex flex-wrap gap-4 text-sm"><Link href="/attivita" className="text-brand-deep underline">Vai alle attività</Link>{user.ruolo === "SUPER_ADMIN" && <Link href="/assistente/automazioni" className="text-brand-deep underline">Configura i controlli programmati</Link>}</div></div>}
      <ul className="space-y-3">{rows.map((n) => <li key={n.id} className={`space-y-3 rounded-xl border bg-panel p-5 ${n.letta ? "border-line" : "border-brand/40"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <form action={openNotification.bind(null, n.id)}><button className="text-left font-semibold text-brand-deep underline underline-offset-2 hover:no-underline">{n.titolo}</button></form>
          <span className={`rounded-full px-2.5 py-1 text-xs ${n.letta ? "bg-paper text-ink-soft" : "bg-brand-soft font-medium text-brand-deep"}`}>{n.letta ? "Letta" : "Da leggere"}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm text-ink-soft">{n.testo}</p>
        <p className="text-xs text-ink-faint">{n.runId ? "Controllo programmato" : n.href.startsWith("/problemi/") ? "Problema cantiere" : "Attività"} · {formatDateTime(n.createdAt)}</p>
        <div className="flex flex-wrap items-start gap-3"><form action={openNotification.bind(null, n.id)}><button className="min-h-11 rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand-deep">Apri dettaglio →</button></form><NotificationControls id={n.id} letta={n.letta} /></div>
      </li>)}</ul>
      <ListPagination path="/notifiche" params={{ vista, tipo }} page={pagina} pages={pages} />
      <p className="text-xs text-ink-soft">I promemoria delle attività in scadenza vengono generati dal controllo sul server, senza bisogno di una chiave AI. Ogni attività riceve al massimo un promemoria al giorno.</p>
    </div>
  );
}
