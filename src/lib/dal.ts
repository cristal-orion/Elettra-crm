import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import { prisma } from "./prisma";

/** Utente corrente (dal DB), memoizzato per render. null se non autenticato. */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      nome: true,
      cognome: true,
      email: true,
      ruolo: true,
      attivo: true,
      guidaVista: true,
      sessionVersion: true,
    },
  });

  if (!user || !user.attivo || user.sessionVersion !== (session.sessionVersion ?? 0)) return null;
  return { id: user.id, nome: user.nome, cognome: user.cognome, email: user.email, ruolo: user.ruolo, attivo: user.attivo, guidaVista: user.guidaVista };
});

export type CurrentUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

/** Richiede un utente autenticato: altrimenti redirect a /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Richiede uno dei ruoli indicati: altrimenti redirect alla home. */
export async function requireRuolo(ruoli: string[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!ruoli.includes(user.ruolo)) redirect("/");
  return user;
}
