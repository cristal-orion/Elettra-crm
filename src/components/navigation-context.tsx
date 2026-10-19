"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useRef, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";
import { safeListHref } from "@/lib/list-state";

type Entry = { id: string; url: string; previous?: string; y: number };
type Navigation = { back: (fallback: string) => void; list: (path: string, event: ReactMouseEvent<HTMLAnchorElement>) => void };
const Context = createContext<Navigation | null>(null);
const lists = new Set(["/anagrafiche", "/commesse", "/progetti", "/progetti/operai", "/attivita", "/notifiche", "/ordini", "/materiali", "/materiali/prezzi", "/segnalazioni", "/utenti"]);

/** Stato per scheda browser e utente; non modifica le chiavi interne del router Next. */
export function NavigationProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const url = `${path}${params.size ? `?${params}` : ""}`;
  const current = useRef<Entry | null>(null);
  const entries = useRef<Record<string, Entry>>({});
  const lastLists = useRef<Record<string, Entry>>({});
  const intent = useRef<{ mode: "push" | "replace" | "pop"; y?: number }>({ mode: "push" });
  const storageKey = `crm:navigation:${userId}`;

  function persist() {
    if (current.current) {
      entries.current[current.current.id] = { ...current.current };
      const pathname = current.current.url.split("?")[0];
      if (lists.has(pathname)) lastLists.current[pathname] = { ...current.current };
    }
    // Limite per evitare una cronologia in memoria senza fine.
    const recent = Object.values(entries.current).slice(-80);
    entries.current = Object.fromEntries(recent.map((entry) => [entry.id, entry]));
    try { sessionStorage.setItem(storageKey, JSON.stringify({ entries: entries.current, lists: lastLists.current })); } catch { /* storage non disponibile: resta la sessione in memoria */ }
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (saved?.entries && saved?.lists) { entries.current = saved.entries; lastLists.current = saved.lists; }
    } catch { /* sessione precedente non leggibile */ }
    const oldRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const scroll = () => {
      const query = new URLSearchParams(location.search).toString();
      const locationUrl = `${location.pathname}${query ? `?${query}` : ""}`;
      if (current.current?.url === locationUrl) current.current.y = window.scrollY;
    };
    const capture = (event: Event) => {
      scroll(); persist();
      if (event instanceof MouseEvent && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
        const anchor = (event.target as Element).closest?.("a");
        if (anchor && anchor.origin === location.origin && !anchor.target && !anchor.hasAttribute("download")) intent.current = { mode: "push" };
      }
    };
    const pop = () => { persist(); intent.current = { mode: "pop" }; };
    const replace = () => { scroll(); persist(); intent.current = { mode: "replace" }; };
    const hide = () => { scroll(); persist(); };
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("click", capture, true);
    document.addEventListener("submit", capture, true);
    window.addEventListener("popstate", pop);
    window.addEventListener("crm:navigate", replace);
    window.addEventListener("pagehide", hide);
    return () => {
      persist(); history.scrollRestoration = oldRestoration;
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("click", capture, true);
      document.removeEventListener("submit", capture, true);
      window.removeEventListener("popstate", pop);
      window.removeEventListener("crm:navigate", replace);
      window.removeEventListener("pagehide", hide);
    };
    // La sessione di navigazione viene ricreata solo al cambio dell'utente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (current.current?.url === url && intent.current.mode !== "pop") return;
    const state = history.state?.crmNavigation;
    const stored = state?.userId === userId ? entries.current[state.id] : undefined;
    const restoring = (intent.current.mode === "pop" || !current.current) && stored?.url === url;
    const old = current.current;
    const y = restoring ? stored.y : intent.current.y;
    current.current = restoring ? { ...stored } : {
      id: crypto.randomUUID(), url, y: y ?? 0,
      previous: intent.current.mode === "replace" ? old?.previous : old?.id,
    };
    history.replaceState({ ...history.state, crmNavigation: { id: current.current.id, userId } }, "");
    persist(); intent.current = { mode: "push" };
    let frame = 0;
    let attempts = 0;
    if (typeof y === "number" && Number.isFinite(y)) {
      const restore = () => {
        window.scrollTo({ top: y, behavior: "instant" });
        if (document.documentElement.scrollHeight - innerHeight < y && attempts++ < 30) frame = requestAnimationFrame(restore);
      };
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(restore); });
    }
    return () => cancelAnimationFrame(frame);
    // I riferimenti contengono lo stato aggiornato anche durante una transizione.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, userId]);

  const navigation: Navigation = {
    back(fallback) {
      persist();
      if (current.current?.previous && entries.current[current.current.previous]) router.back();
      else {
        const saved = lastLists.current[fallback];
        intent.current = { mode: "replace", y: saved?.y ?? 0 };
        router.replace(safeListHref(saved?.url, fallback), { scroll: false });
      }
    },
    list(listPath, event) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault(); persist();
      const saved = lastLists.current[listPath];
      intent.current = { mode: "push", y: saved?.y ?? 0 };
      router.push(safeListHref(saved?.url, listPath), { scroll: false });
    },
  };
  return <Context.Provider value={navigation}>{children}</Context.Provider>;
}

export function DetailNavigation({ listPath, listLabel, currentLabel, parent }: {
  listPath: string; listLabel: string; currentLabel: string; parent?: { href: string; label: string };
}) {
  const navigation = useContext(Context);
  const router = useRouter();
  return <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
    <button type="button" onClick={() => navigation ? navigation.back(listPath) : router.push(listPath)} className="min-h-11 rounded-lg border border-line px-3 text-ink-soft hover:border-brand focus-visible:outline-2 focus-visible:outline-brand">← Indietro</button>
    <nav aria-label="Percorso di navigazione"><ol className="flex flex-wrap items-center gap-2">
      <li><Link href={listPath} onClick={(e) => navigation?.list(listPath, e)} className="inline-block py-3 text-brand-deep underline underline-offset-4">{listLabel}</Link></li>
      {parent && <li className="flex items-center gap-2"><span aria-hidden>/</span><Link href={parent.href} className="py-3 text-brand-deep underline">{parent.label}</Link></li>}
      <li className="flex items-center gap-2"><span aria-hidden>/</span><span aria-current="page">{currentLabel}</span></li>
    </ol></nav>
  </div>;
}
