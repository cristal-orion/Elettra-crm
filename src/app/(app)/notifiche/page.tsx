import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { markRead } from "./actions";
export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await prisma.notifica.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return <div className="space-y-6"><header><h1 className="text-2xl font-bold">Notifiche</h1><p className="mt-1 text-sm text-ink-soft">Riepiloghi dei controlli programmati condivisi con te. Ultime 100 notifiche.</p></header>{!rows.length && <p className="rounded-xl border border-line bg-panel p-5 text-sm text-ink-soft">Non ci sono notifiche. I riepiloghi dei controlli compariranno qui.</p>}<ul className="space-y-3">{rows.map((n) => <li key={n.id} className="rounded-xl border border-line bg-panel p-5"><div className="flex flex-wrap justify-between gap-3"><Link href={n.href} className="font-semibold text-brand-deep underline">{n.titolo}</Link><span className="text-xs text-ink-soft">{n.letta ? "Letta" : "Nuova"} · {n.createdAt.toLocaleDateString("it-IT")}</span></div><p className="mt-2 text-sm text-ink-soft">{n.testo}</p>{!n.letta && <form action={markRead.bind(null, n.id)}><button className="mt-2 min-h-11 text-sm text-brand-deep underline">Segna come letta</button></form>}</li>)}</ul></div>;
}
