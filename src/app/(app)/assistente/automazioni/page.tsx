import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ScheduleControls, ScheduleForm } from "./schedule-form";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Controlli programmati — Elettra" };
export default async function AutomazioniPage() {
  const user = await requireUser();
  const admin = user.ruolo === "SUPER_ADMIN";
  const [schedules, users, runs] = await Promise.all([
    admin ? prisma.aiSchedule.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) : [],
    admin ? prisma.user.findMany({ where: { attivo: true }, select: { id: true, nome: true, cognome: true } }) : [],
    prisma.aiRun.findMany({ where: admin ? { schedule: { userId: user.id } } : { notifications: { some: { userId: user.id } } }, orderBy: { createdAt: "desc" }, take: 30, include: { schedule: { select: { name: true } } } }),
  ]);
  return <div className="space-y-6"><header><Link href="/assistente" className="text-sm text-brand-deep underline">← Assistente</Link><h1 className="mt-3 text-2xl font-bold">Controlli programmati</h1><p className="mt-1 text-sm text-ink-soft">Priorità e criticità individuate dai dati del CRM, anche quando non apri la chat.</p></header>
    {admin && <><details className="rounded-xl border border-line bg-panel p-5"><summary className="min-h-11 cursor-pointer py-2 font-semibold">+ Nuovo controllo</summary><div className="mt-4"><ScheduleForm users={users} /></div></details>
      {schedules.map((s) => <section key={s.id} className="space-y-4 rounded-xl border border-line bg-panel p-5"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-semibold">{s.name}</h2><p className="mt-1 text-sm text-ink-soft">{String(s.hour).padStart(2, "0")}:{String(s.minute).padStart(2, "0")} · Europe/Rome · {s.weekdaysOnly ? "Lun–ven" : "Ogni giorno"} · {s.enabled ? "Attivo" : "Sospeso"}</p></div></div><ScheduleControls id={s.id} enabled={s.enabled} /><details><summary className="min-h-11 cursor-pointer py-3 text-sm text-brand-deep">Modifica impostazioni e destinatari</summary><ScheduleForm users={users} initial={{ ...s, recipientIds: s.recipientIds as string[] }} /></details></section>)}
      <p className="text-xs text-ink-soft">Sul server eseguire <code>npm run ai:scheduled</code> ogni 5 minuti tramite attività pianificata Coolify. I controlli saltati vengono recuperati nello stesso giorno; lo storico impedisce esecuzioni duplicate.</p></>}
    <section><h2 className="mb-3 text-lg font-semibold">Ultime esecuzioni</h2>{!runs.length ? <p className="rounded-xl border border-line bg-panel p-5 text-sm text-ink-soft">Nessun riepilogo disponibile. {admin ? "Configura un controllo e premi Esegui ora per provarlo." : "I controlli condivisi con te compariranno qui."}</p> : <ul className="divide-y divide-line rounded-xl border border-line bg-panel">{runs.map((r) => <li key={r.id}><Link href={`/assistente/automazioni/${r.id}`} className="flex flex-wrap justify-between gap-2 px-5 py-4 text-sm hover:bg-brand-soft"><span className="font-medium">{r.schedule.name}</span><span className="text-ink-soft">{formatDate(r.createdAt)} · {r.status === "COMPLETED" ? "Completato" : r.status === "RUNNING" ? r.leaseUntil < new Date() ? "Interrotto" : "In corso" : "Non completato"}</span></Link></li>)}</ul>}</section>
  </div>;
}
