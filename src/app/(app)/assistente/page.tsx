import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { UIMessage } from "ai";
import { requireUser } from "@/lib/dal";
import { isAiConfigured } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { ContextSchema, type AiContext } from "@/lib/ai/http";
import { contextData } from "@/lib/ai/read";
import AssistenteChat from "./chat";
import OperationCard from "@/components/ai/operation-card";
import { operationOutput } from "@/lib/ai/operations";

export const metadata = { title: "Assistente — CRM Elettra" };
export default async function AssistentePage({ searchParams }: { searchParams: Promise<{ chat?: string; tipo?: string; id?: string; richiesta?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [configured, conversations, current] = await Promise.all([
    isAiConfigured(),
    prisma.aiConversation.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true } }),
    sp.chat ? prisma.aiConversation.findFirst({ where: { id: sp.chat, userId: user.id }, include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, operations: { orderBy: { createdAt: "desc" }, take: 50 } } }) : null,
  ]);
  if (sp.chat && !current) notFound();
  let context = current?.context as AiContext | undefined;
  if (!current && sp.tipo && sp.id) {
    const parsed = ContextSchema.safeParse({ type: sp.tipo, id: sp.id });
    if (parsed.success) { await contextData(parsed.data); context = parsed.data; }
  }
  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight">Assistente operativo</h1><p className="mt-1 text-sm text-ink-soft">Commesse, clienti e cantieri: dai dati alle attività.</p></div><Link href="/assistente/automazioni" className="min-h-11 rounded-lg border border-line bg-panel px-4 py-3 text-sm font-medium">Controlli programmati →</Link></header>
    {!configured ? <div className="rounded-xl border border-line bg-panel p-6"><h2 className="font-semibold">Configura l’assistente</h2><p className="mt-2 text-sm text-ink-soft">{user.ruolo === "SUPER_ADMIN" ? <Link href="/impostazioni" className="text-brand-deep underline">Imposta la chiave Gemini nelle Impostazioni.</Link> : "Chiedi a un amministratore di configurare Gemini."}</p></div> : <div className="grid min-w-0 gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside aria-label="Cronologia conversazioni" className="min-w-0"><Link href="/assistente" className="mb-3 block rounded-lg border border-brand/30 bg-panel px-4 py-3 text-sm font-semibold text-brand-deep">+ Nuova conversazione</Link>
        <details className="lg:hidden"><summary className="min-h-11 cursor-pointer py-3 text-sm">Cronologia ({conversations.length})</summary><nav className="max-h-48 overflow-auto">{conversations.map((c) => <Link key={c.id} href={`/assistente?chat=${c.id}`} className="block truncate py-3 text-sm">{c.title}</Link>)}</nav></details>
        <nav className="hidden max-h-[65dvh] space-y-1 overflow-auto lg:block">{conversations.map((c) => <Link key={c.id} href={`/assistente?chat=${c.id}`} aria-current={current?.id === c.id ? "page" : undefined} className={`block truncate rounded-lg px-3 py-3 text-sm ${current?.id === c.id ? "bg-brand-soft font-medium text-brand-deep" : "text-ink-soft hover:bg-panel"}`} title={c.title}>{c.title}</Link>)}{!conversations.length && <p className="px-3 text-xs text-ink-faint">Le tue conversazioni compariranno qui.</p>}</nav>
      </aside>
      <div className="min-w-0"><AssistenteChat key={current?.id ?? `new-${sp.id ?? ""}`} id={current?.id ?? randomUUID()} initialMessages={current?.messages.map((m) => m.payload as unknown as UIMessage)} context={context} draft={sp.richiesta?.slice(0, 2000)} />
      {current && current.operations.length > 0 && <details className="mt-4 rounded-lg border border-line bg-panel p-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Registro operazioni ({current.operations.length})</summary><p className="mb-3 text-xs text-ink-soft">Esiti salvati sul server, disponibili anche dopo un’interruzione della risposta. Ultime 50 operazioni.</p>{current.operations.map((op) => <OperationCard key={`${op.id}-${op.status}`} initial={operationOutput(op)} refresh={false} />)}</details>}
      </div>
    </div>}
  </div>;
}
