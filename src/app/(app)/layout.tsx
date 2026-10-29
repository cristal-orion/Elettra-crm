import { requireUser } from "@/lib/dal";
import { puoLeggereEconomia } from "@/lib/access";
import { etichettaRuolo, puoGestireUtenti } from "@/lib/enums";
import { logout } from "@/app/login/actions";
import Nav from "@/components/nav";
import SegnalaButton from "@/components/segnala-button";
import Guida, { GuidaButton } from "@/components/guida";
import { unreadNotificationCount } from "@/lib/notifiche";
import NotificationProvider, { NotificationBanner } from "@/components/notification-provider";
import { NavigationProvider } from "@/components/navigation-context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const iniziali = `${user.nome[0] ?? ""}${user.cognome[0] ?? ""}`.toUpperCase();
  const canManageUsers = puoGestireUtenti(user.ruolo);
  const unread = await unreadNotificationCount(user.id);

  return (
    <NotificationProvider key={user.id} initialCount={unread}>
    <NavigationProvider key={user.id} userId={user.id}>
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto bg-slatepanel px-4 py-5 text-white lg:flex">
        <div className="px-2">
          <p className="text-base font-semibold text-white">
            Elettra S.r.l.
          </p>
          <p className="mt-0.5 text-xs text-white/70">
            CRM
          </p>
        </div>

        <div className="mt-8 flex-1">
          <Nav canManageUsers={canManageUsers} canEconomia={puoLeggereEconomia(user)} />
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
              {iniziali}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user.nome} {user.cognome}
              </p>
              <p className="truncate text-xs text-white/70">
                {etichettaRuolo(user.ruolo)}
              </p>
            </div>
          </div>
          <GuidaButton className="mt-3 w-full rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-white/60 transition hover:bg-white/5 hover:text-white" />
          <form action={logout} className="mt-2">
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
        <header className="flex items-center justify-between border-b border-line bg-slatepanel px-5 py-2 text-white lg:hidden">
          <p className="text-sm font-semibold text-white">
            Elettra · CRM
          </p>
          <div className="flex items-center gap-4">
            <GuidaButton className="min-h-11 text-sm text-white/70" />
            <form action={logout}>
              <button type="submit" className="min-h-11 text-sm text-white/70">
                Esci
              </button>
            </form>
          </div>
        </header>
        <div className="lg:hidden"><Nav mobile canManageUsers={canManageUsers} canEconomia={puoLeggereEconomia(user)} /></div>
        <NotificationBanner />

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8">
          {children}
          <SegnalaButton />
        </main>
      </div>
      <Guida ruolo={user.ruolo} viste={user.guidaVista} />

    </div>
    </NavigationProvider>
    </NotificationProvider>
  );
}
