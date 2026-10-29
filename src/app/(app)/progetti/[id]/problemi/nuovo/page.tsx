import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { commessaScope } from "@/lib/access";
import { puoGestireProgetti } from "@/lib/enums";
import { ProblemaForm } from "@/components/operativo-forms";
import { DetailNavigation } from "@/components/navigation-context";

export default async function NuovoProblema({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); const { id } = await params;
  const c = await prisma.commessa.findFirst({ where: { id, ...commessaScope(user) }, include: { cliente: { select: { ragioneSociale: true } } } });
  if (!c || !puoGestireProgetti(user.ruolo)) notFound();
  const utenti = await prisma.user.findMany({ where: { attivo: true, ruolo: { in: ["SUPER_ADMIN", "BACKOFFICE", "PROJECT_MANAGER", "UFFICIO_TECNICO"] } }, select: { id: true, nome: true, cognome: true }, orderBy: { cognome: "asc" } });
  return <div className="mx-auto w-full max-w-3xl space-y-6"><header className="space-y-3"><DetailNavigation listPath={`/progetti/${id}?tab=problemi`} listLabel={`Cantiere ${c.numero}`} currentLabel="Nuovo problema" /><h1 className="text-2xl font-semibold">Segnala problema di cantiere</h1><p className="text-sm text-ink-soft">{c.numero} · {c.cliente.ragioneSociale}</p></header><section className="rounded-xl border border-line bg-panel p-4 sm:p-6"><ProblemaForm commessaId={id} richiestaId={randomUUID()} utenti={utenti.map((u) => ({ id: u.id, label: `${u.nome} ${u.cognome}` }))} /></section></div>;
}
