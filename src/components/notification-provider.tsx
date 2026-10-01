"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";

const NotificationCount = createContext(0);
export const useUnreadNotifications = () => useContext(NotificationCount);

export default function NotificationProvider({ initialCount, children }: { initialCount: number; children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState({ initialCount, count: initialCount });
  // Le Server Actions aggiornano il layout: riallineiamo anche il conteggio locale.
  if (snapshot.initialCount !== initialCount) setSnapshot({ initialCount, count: initialCount });
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    async function refreshCount() {
      if (document.visibilityState !== "visible" || running) return;
      running = true;
      try {
        const response = await fetch("/api/notifiche/conteggio", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (Number.isSafeInteger(data.count) && data.count >= 0) setSnapshot((previous) => ({ ...previous, count: data.count }));
      } catch { /* Una richiesta successiva riallinea il contatore. */ }
      finally { running = false; }
    }
    const timer = setInterval(refreshCount, 60_000);
    window.addEventListener("focus", refreshCount);
    document.addEventListener("visibilitychange", refreshCount);
    return () => {
      clearInterval(timer);
      controller.abort();
      window.removeEventListener("focus", refreshCount);
      document.removeEventListener("visibilitychange", refreshCount);
    };
  }, []);
  return <NotificationCount.Provider value={snapshot.count}>{children}</NotificationCount.Provider>;
}

export function NotificationBanner() {
  const count = useUnreadNotifications();
  return count > 0 ? <Link href="/notifiche?vista=nonlette" className="border-b border-line bg-brand-soft px-5 py-3 text-sm font-medium text-brand-deep">{count} notific{count === 1 ? "a da leggere" : "he da leggere"} · Apri notifiche →</Link> : null;
}
