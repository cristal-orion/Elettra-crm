"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { listHref } from "@/lib/list-state";

type Filter = { name: string; label: string; value: string; defaultValue?: string; options: { value: string; label: string }[] };
type Suggestion = { href: string; label: string; type: string };
const cls = "min-h-11 min-w-0 max-w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export default function ListFilters({ q, placeholder, filters = [], total, suggestions = [], similar = false }: {
  q?: string; placeholder?: string; filters?: Filter[]; total: number; suggestions?: Suggestion[]; similar?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(q ?? "");
  const [committedQuery, setCommittedQuery] = useState(q ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composing = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  // Un risultato precedente non deve sovrascrivere testo digitato più di recente.
  if ((q ?? "") !== committedQuery) {
    setCommittedQuery(q ?? "");
    if (query === committedQuery) setQuery(q ?? "");
  }
  const cancel = () => { if (timer.current) clearTimeout(timer.current); };
  useEffect(() => {
    const onBack = () => { cancel(); setQuery(new URLSearchParams(window.location.search).get("q") ?? ""); };
    window.addEventListener("popstate", onBack);
    return () => { cancel(); window.removeEventListener("popstate", onBack); };
  }, []);

  function navigate(changes: Record<string, string>) {
    const href = listHref(pathname, window.location.search, changes);
    if (href === `${window.location.pathname}${window.location.search}`) return;
    window.dispatchEvent(new CustomEvent("crm:navigate", { detail: { mode: "replace" } }));
    startTransition(() => router.replace(href, { scroll: false }));
  }
  function search(value: string) {
    setQuery(value);
    cancel();
    if (composing.current || (value.trim().length > 0 && value.trim().length < 2)) return;
    timer.current = setTimeout(() => navigate({ q: value.trim() }), 300);
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); cancel();
    const data = new FormData(event.currentTarget);
    navigate(Object.fromEntries([...data].map(([key, value]) => [key, String(value).trim()])));
  }
  const active = filters.filter((f) => f.value !== (f.defaultValue ?? ""));
  const reset = Object.fromEntries(filters.map((f) => [f.name, f.defaultValue ?? ""]));
  if (q !== undefined) reset.q = "";

  return <section aria-label="Ricerca e filtri" className="space-y-3" aria-busy={pending}>
    <form ref={form} method="get" onSubmit={apply} className="flex flex-wrap items-end gap-3">
      {[...params].filter(([key]) => key !== "q" && key !== "pagina" && key !== "esito" && !filters.some((f) => f.name === key)).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      {q !== undefined && <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-xs text-ink-soft">Cerca
        <input aria-label="Cerca" name="q" type="search" maxLength={200} value={query} placeholder={placeholder} className={cls}
          onChange={(e) => search(e.target.value)} onCompositionStart={() => { composing.current = true; cancel(); }}
          onCompositionEnd={(e) => { composing.current = false; search(e.currentTarget.value); }} />
      </label>}
      {filters.map((f) => <label key={`${f.name}:${f.value}`} className="flex min-w-0 max-w-full flex-col gap-1.5 text-xs text-ink-soft">{f.label}
        <select aria-label={f.label} name={f.name} defaultValue={f.value} className={cls}>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      </label>)}
      <button type="submit" className={`${cls} font-medium hover:bg-paper`}>Applica filtri</button>
      <button type="button" onClick={() => { cancel(); setQuery(""); form.current?.reset(); navigate(reset); }} className={`${cls} text-ink-soft hover:bg-paper`}>Azzera</button>
    </form>
    <div role="status" aria-live="polite" className="text-xs text-ink-soft">{pending ? "Aggiornamento risultati…" : `${total} risultati`}{!pending && query.trim().length === 1 ? " · Digita almeno 2 caratteri oppure premi Invio." : ""}</div>
    {similar && !pending && <p role="note" className="rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">Nessuna corrispondenza esatta nei filtri attivi. Mostriamo risultati simili alla ricerca «{q}», con un possibile errore di digitazione per parola.</p>}
    {(q || active.length > 0) && <ul aria-label="Filtri attivi" className="flex flex-wrap gap-2 text-xs">
      {q && <li><button type="button" onClick={() => { cancel(); setQuery(""); navigate({ q: "" }); }} className="min-h-9 rounded-full bg-brand-soft px-3 text-brand-deep" aria-label={`Rimuovi ricerca ${q}`}>Ricerca: {q} ×</button></li>}
      {active.map((f) => <li key={f.name}><button type="button" onClick={() => { cancel(); navigate({ [f.name]: f.defaultValue ?? "" }); }} className="min-h-9 rounded-full bg-brand-soft px-3 text-brand-deep" aria-label={`Rimuovi filtro ${f.label}`}>{f.label}: {f.options.find((o) => o.value === f.value)?.label ?? f.value} ×</button></li>)}
    </ul>}
    {q && query.trim() === q && !pending && suggestions.length > 0 && <nav aria-label="Risultati rapidi" className="flex flex-wrap gap-2">{suggestions.slice(0, 5).map((s) => <Link key={s.href} href={s.href} className="min-h-11 max-w-full rounded-lg border border-line px-3 py-2 text-sm text-brand-deep underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand"><span className="mr-2 text-xs text-ink-soft">{s.type}</span>{s.label}</Link>)}</nav>}
  </section>;
}
