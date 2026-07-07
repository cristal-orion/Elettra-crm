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
    },
  });

  if (!user || !user.attivo) return null;
  return user;
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
