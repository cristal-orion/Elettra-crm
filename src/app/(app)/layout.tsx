import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { etichettaRuolo, puoGestireUtenti } from "@/lib/enums";
import { logout } from "@/app/login/actions";
import Nav from "@/components/nav";
import SegnalaButton from "@/components/segnala-button";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const iniziali = `${user.nome[0] ?? ""}${user.cognome[0] ?? ""}`.toUpperCase();
  const canManageUsers = puoGestireUtenti(user.ruolo);
  const unread = await prisma.notifica.count({ where: { userId: user.id, letta: false } });

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto bg-slatepanel px-4 py-5 text-white md:flex">
        <div className="px-2">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-light">
            Elettra S.r.l.
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            CRM
          </p>
        </div>

        <div className="mt-8 flex-1">
          <Nav canManageUsers={canManageUsers} />
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light/20 font-mono text-xs font-semibold text-brand-light">
              {iniziali}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user.nome} {user.cognome}
              </p>
              <p className="truncate text-[11px] text-white/40">
                {etichettaRuolo(user.ruolo)}
              </p>
            </div>
          </div>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              Esci
            </button>
          </form>
        </div>
      </aside>

      {/* Contenuto */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (mobile) */}
        <header className="flex items-center justify-between border-b border-line bg-slatepanel px-4 py-3 text-white md:hidden">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand-light">
            Elettra · CRM
          </p>
          <form action={logout}>
            <button type="submit" className="text-sm text-white/70">
              Esci
            </button>
          </form>
        </header>
        <div className="md:hidden"><Nav mobile canManageUsers={canManageUsers} /></div>
        {unread > 0 && <Link href="/notifiche" className="border-b border-line bg-brand-soft px-5 py-3 text-sm font-medium text-brand-deep">{unread} nuovi riepiloghi operativi · Apri notifiche →</Link>}

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
          {children}
          <SegnalaButton />
        </main>
      </div>

    </div>
  );
}
