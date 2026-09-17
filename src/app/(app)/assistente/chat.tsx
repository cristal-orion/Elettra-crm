"use client";

import { useRef, useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import Markdown from "@/components/ai/markdown";
import OperationCard, { type OperationView } from "@/components/ai/operation-card";
import type { AiContext } from "@/lib/ai/http";

const SUGGERIMENTI = ["Quali progetti sono in ritardo?", "Trova le commesse in follow-up", "Mostrami le attività da completare", "Aiutami a pianificare un cantiere"];
const labels: Record<string, string> = { cercaCommesse: "Ricerca commesse", dettaglioCommessa: "Lettura della commessa", cercaAnagrafiche: "Ricerca anagrafiche", dettaglioCliente: "Lettura cliente", cercaProgetti: "Analisi progetti", cercaOperai: "Consultazione squadre", creaMilestone: "Creazione milestone", pianificaProgetto: "Pianificazione", salvaCommessa: "Salvataggio commessa", salvaAnagrafica: "Salvataggio anagrafica", assegnaOperaio: "Assegnazione operaio", cercaAttivita: "Consultazione attività", creaAttivita: "Creazione attività", leggiDocumentoCommessa: "Analisi documento" };

export default function AssistenteChat({ id: initialId, initialMessages = [], context, draft = "" }: { id: string; initialMessages?: UIMessage[]; context?: AiContext; draft?: string }) {
  const [id] = useState(initialId);
  const router = useRouter();
  const transport = new DefaultChatTransport({ api: "/assistente/api", prepareSendMessagesRequest: ({ messages }) => {
    const message = [...messages].reverse().find((m) => m.role === "user");
    return { body: { id, requestId: message?.id, text: message?.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n"), context } };
  } });
  const { messages, sendMessage, status, error, stop, regenerate, clearError } = useChat({ id, messages: initialMessages, transport,
    onFinish: () => { router.replace(`/assistente?chat=${encodeURIComponent(id)}`, { scroll: false }); router.refresh(); },
  });
  const [input, setInput] = useState(draft);
  const [copied, setCopied] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const follow = useRef(true);
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => {
    if (follow.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, status]);
  async function invia(testo: string) {
    const text = testo.trim();
    if (!text || busy) return;
    clearError(); follow.current = true;
    setInput("");
    await sendMessage({ text });
    inputRef.current?.focus();
  }
  async function copy(id: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(id); }
    catch { setCopied("failed"); }
  }
  let errorText = error?.message;
  if (errorText) { try { errorText = JSON.parse(errorText).error ?? errorText; } catch {} }
  return <div className="flex h-[min(72dvh,850px)] min-h-[420px] min-w-0 flex-col rounded-xl border border-line bg-panel">
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 text-xs text-ink-soft">
      <span>{context ? "Conversazione collegata alla scheda" : "Assistente operativo"}</span><span role="status" aria-live="polite">{busy ? "Sto lavorando…" : "Pronto"}</span>
    </div>
    <div ref={scrollRef} onScroll={() => { const el = scrollRef.current; if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6" aria-label="Messaggi della conversazione" role="log" aria-live="off">
      {!messages.length ? <div className="mx-auto max-w-xl py-6">
        <h2 className="text-xl font-semibold tracking-tight">Da cosa iniziamo?</h2><p className="mt-2 text-sm leading-relaxed text-ink-soft">Posso consultare il CRM, preparare un piano e aggiornare attività, milestone e squadre su tua richiesta. Importi e cambi di stato commerciale richiedono conferma.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">{SUGGERIMENTI.map((s) => <button key={s} type="button" onClick={() => setInput(s)} className="min-h-12 rounded-lg border border-line px-4 py-3 text-left text-sm transition hover:border-brand hover:bg-brand-soft">{s} <span aria-hidden className="text-brand">↗</span></button>)}</div>
      </div> : <div className="mx-auto max-w-3xl space-y-6">{messages.map((m) => {
        const text = m.parts.filter((p) => p.type === "text").map((p) => p.text).join("\n");
        const user = m.role === "user";
        return <article key={m.id} className={user ? "ml-auto max-w-[90%] rounded-xl bg-brand-soft px-4 py-3" : "min-w-0"} aria-label={user ? "Tu" : "Assistente"}>
          <p className="mb-2 text-xs font-semibold text-ink-soft">{user ? "Tu" : "Assistente"}</p>
          {m.parts.map((p, i) => {
            if (p.type === "text") return <div key={i} className="text-sm">{user ? <p className="whitespace-pre-wrap break-words">{p.text}</p> : <Markdown text={p.text} />}</div>;
            if (!isToolUIPart(p)) return null;
            const name = getToolName(p);
            const output = p.state === "output-available" ? p.output as Record<string, unknown> | null : null;
            if (output && typeof output.operationId === "string") return <OperationCard key={p.toolCallId} initial={output as unknown as OperationView} />;
            const failed = p.state === "output-error" || output?.status === "FAILED";
            return <details key={p.toolCallId} className="my-2 rounded-lg border border-line px-3 py-2 text-xs">
              <summary className="min-h-8 cursor-pointer py-1 text-ink-soft">{labels[name] ?? name} · {failed ? "Non completato" : p.state === "output-available" ? "Completato" : "In corso"}</summary>
              {failed ? <p className="py-2 text-danger">{p.state === "output-error" ? "Impossibile completare questa operazione." : String(output?.error ?? "Errore")}</p> : output ? <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words py-2 text-ink-soft">{JSON.stringify(output, null, 2).slice(0, 10000)}</pre> : <p className="py-2">Consultazione dei dati in corso…</p>}
            </details>;
          })}
          {!user && text && <button type="button" onClick={() => copy(m.id, text)} className="mt-2 min-h-10 px-1 text-xs text-ink-soft hover:text-brand-deep">{copied === m.id ? "Copiato" : "Copia risposta"}</button>}
          {(m.metadata as { interrupted?: boolean } | undefined)?.interrupted && <p className="mt-2 text-xs text-warn">Risposta interrotta. Controlla gli esiti delle operazioni prima di continuare.</p>}
        </article>;
      })}</div>}
      {status === "submitted" && <p role="status" className="mx-auto mt-4 max-w-3xl text-sm text-ink-soft">Consulto i dati necessari…</p>}
    </div>
    {error && <div role="alert" className="border-t border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger"><p>{errorText}</p><div className="mt-2 flex gap-4"><button type="button" onClick={() => regenerate()} className="min-h-10 underline">Riprova</button><button type="button" onClick={() => { router.replace(`/assistente?chat=${id}`); router.refresh(); }} className="min-h-10 underline">Ricarica storico</button></div></div>}
    {copied === "failed" && <p role="status" className="px-4 text-xs text-ink-soft">Copia non disponibile: seleziona il testo della risposta.</p>}
    <form onSubmit={(e) => { e.preventDefault(); void invia(input); }} className="border-t border-line p-3 sm:p-4">
      <label htmlFor="ai-message" className="sr-only">Richiesta all’assistente CRM</label>
      <div className="flex items-end gap-2"><textarea ref={inputRef} id="ai-message" value={input} maxLength={8000} onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void invia(input); } }} rows={2} placeholder="Chiedi un’analisi o descrivi cosa vuoi fare…" className="max-h-40 min-h-12 min-w-0 flex-1 resize-none rounded-lg border border-line bg-panel px-3 py-2 text-sm" />
        {busy ? <button type="button" onClick={() => stop()} className="min-h-12 rounded-lg border border-line px-4 text-sm font-medium">Interrompi</button> : <button type="submit" disabled={!input.trim()} className="min-h-12 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">Invia</button>}
      </div><p className="mt-2 text-[11px] text-ink-faint">Invio per inviare · Shift+Invio per andare a capo · Le operazioni salvate restano nello storico.</p>
    </form>
  </div>;
}
