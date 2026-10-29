import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { commessaScope } from "@/lib/access";
import { puoGestireProgetti } from "@/lib/enums";
import { romeDay } from "@/lib/ai/schedule-time";
import { SalForm } from "@/components/operativo-forms";
import { DetailNavigation } from "@/components/navigation-context";
import { avanzamento, descrizioneSal } from "@/lib/progetti";

export default async function SalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await prisma.commessa.findFirst({ where: { id, ...commessaScope(user) }, include: { cliente: { select: { ragioneSociale: true } }, milestone: { where: { dimostrativa: false }, orderBy: { ordine: "asc" } } } });
  if (!c || !puoGestireProgetti(user.ruolo)) notFound();
  const av = avanzamento(c.milestone);
  return <div className="mx-auto w-full max-w-3xl space-y-6"><header className="space-y-3"><DetailNavigation listPath={`/progetti/${id}`} listLabel={`Cantiere ${c.numero}`} currentLabel="Aggiorna SAL" /><h1 className="text-2xl font-semibold">Aggiorna SAL</h1><p className="text-sm text-ink-soft">{c.numero} · {c.cliente.ragioneSociale} · {c.descrizione}</p></header><section className="rounded-xl border border-line bg-panel p-4 sm:p-6">{av.percentuale !== null ? <SalForm key={c.versioneOperativa} commessaId={id} richiestaId={randomUUID()} versione={c.versioneOperativa} oggi={romeDay(new Date())} milestone={c.milestone.map((m) => ({ id: m.id, titolo: m.titolo, stato: m.stato, durataGiorni: m.durataGiorni, versione: m.updatedAt.toISOString() }))} /> : <div className="space-y-3"><h2 className="font-semibold">Prima definiamo le fasi del lavoro</h2><p className="text-sm text-ink-soft">{descrizioneSal(av)} L’avanzamento è ponderato sulla durata prevista delle fasi reali.</p><Link href={`/progetti/${id}?tab=avanzamento`} className="inline-flex min-h-12 items-center text-brand-deep underline">Apri pianificazione →</Link></div>}</section></div>;
}
