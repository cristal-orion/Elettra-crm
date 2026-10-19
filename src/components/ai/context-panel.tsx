"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AiContext } from "@/lib/ai/http";
import Markdown from "./markdown";

type Analysis = { sintesi: string; punti: { titolo: string; dettaglio: string; priorita: string }[]; azioniSuggerite: { titolo: string; richiesta: string }[]; fonte: { href: string; label: string } };
export default function AiContextPanel(props: AiContext) {
  return <ContextPanel key={`${props.type}:${props.id}`} {...props} />;
}

function ContextPanel({ type, id }: AiContext) {
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const [lastTask, setLastTask] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, [type, id]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const actions = type === "cliente" ? ["Riassumi situazione", "Prepara follow-up"] : type === "progetto" ? ["Analizza ritardi", "Proponi piano", "Organizza squadra"] : type === "ordine" ? ["Riassumi ordine e consegne", "Prepara sollecito fornitore"] : type === "materiale" ? ["Riassumi dati tecnici", "Individua informazioni mancanti"] : ["Analizza criticità", "Prepara prossime attività"];
  const href = (richiesta?: string) => `/assistente?${new URLSearchParams({ tipo: type, id, ...(richiesta ? { richiesta } : {}) })}`;
  async function analyze(task: string) {
    if (controller.current || cooldown > 0) return;
    const request = new AbortController();
    controller.current = request; setBusy(true); setError(""); setResult(null); setRetryable(false); setLastTask(task);
    try {
      const res = await fetch("/assistente/api/analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: { type, id }, task }), signal: request.signal });
      const data = await res.json().catch(() => null);
      if (controller.current !== request || request.signal.aborted) return;
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Il servizio di analisi non ha risposto correttamente. Riprova tra poco.");
        setRetryable(typeof data?.retryable === "boolean" ? data.retryable : res.status >= 500 || res.status === 429);
        const wait = Number(res.headers.get("Retry-After"));
        if (Number.isFinite(wait) && wait > 0) setCooldown(Math.min(300, Math.ceil(wait)));
      } else if (typeof data?.sintesi !== "string" || !Array.isArray(data.punti) || !Array.isArray(data.azioniSuggerite)) {
        setError("Il servizio ha restituito una risposta non valida. Riprova l’analisi."); setRetryable(true);
      } else setResult(data);
    } catch {
      if (controller.current === request && !request.signal.aborted) {
        setError("Connessione interrotta durante l’analisi. Controlla la connessione e riprova."); setRetryable(true);
      }
    } finally {
      if (controller.current === request) { controller.current = null; setBusy(false); }
    }
  }
  return <section className="rounded-xl border border-line bg-panel p-5" aria-label="Assistenza AI contestuale">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Lavora su questa scheda con l’AI</h2><Link href={href()} className="min-h-10 py-2 text-sm text-brand-deep underline">Apri conversazione →</Link></div>
    <div className="mt-2 flex flex-wrap gap-2">{actions.map((a) => <button key={a} type="button" disabled={busy || cooldown > 0} onClick={() => analyze(a)} className="min-h-11 rounded-lg border border-line px-3 text-sm text-brand-deep hover:bg-brand-soft disabled:opacity-50">{a}</button>)}{busy && <button type="button" onClick={() => controller.current?.abort()} className="min-h-11 px-3 text-sm underline">Interrompi</button>}</div>
    {busy && <p role="status" className="mt-3 text-sm text-ink-soft">Analizzo i dati della scheda… Se Gemini è occupato, riprovo automaticamente. L’operazione può richiedere fino a un minuto.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    {error && retryable && !busy && <button type="button" disabled={cooldown > 0} onClick={() => analyze(lastTask)} className="mt-3 min-h-11 rounded-lg border border-line px-3 text-sm text-brand-deep hover:bg-brand-soft disabled:opacity-50">{cooldown > 0 ? `Riprova tra ${cooldown}s` : "Riprova analisi"}</button>}
    {result && <div className="mt-5 space-y-4 border-t border-line pt-4 text-sm"><Markdown text={result.sintesi} /><ul className="space-y-3">{result.punti.map((p, i) => <li key={i}><strong>{p.titolo}</strong><span className="ml-2 text-xs text-ink-soft">{p.priorita}</span><p className="mt-1 text-ink-soft">{p.dettaglio}</p></li>)}</ul>
      {result.azioniSuggerite.length > 0 && <div><p className="mb-2 font-medium">Prossimi passi suggeriti</p><div className="flex flex-wrap gap-2">{result.azioniSuggerite.map((a, i) => <Link key={i} href={href(a.richiesta)} className="rounded-lg border border-line px-3 py-3 text-brand-deep hover:bg-brand-soft">{a.titolo} →</Link>)}</div></div>}
      <p className="text-xs text-ink-faint">Analisi basata sui dati attuali della scheda. Le proposte non sono ancora state salvate.</p>
    </div>}
  </section>;
}
