"use client";

import { useRef, useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const SUGGERIMENTI = [
  "Quali sono le ultime commesse?",
  "Qual è il tasso di conversione?",
  "Commesse in follow-up",
  "Ultimo prezzo del cavo",
];

export default function AssistenteChat() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/assistente/api" }),
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  function invia(testo: string) {
    const t = testo.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-xl border border-line bg-panel">
      {/* Messaggi */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-lg pt-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-brand-deep" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 2a7 7 0 0 0-7 7c0 2 .9 3.4 2 4.6.7.8 1 1.3 1 2.4v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1c0-1.1.3-1.6 1-2.4 1.1-1.2 2-2.6 2-4.6a7 7 0 0 0-7-7Zm-3 19a1 1 0 0 1 1-1h4a1 1 0 0 1 0 2h-4a1 1 0 0 1-1-1Z"
                />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold">Assistente CRM</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Chiedimi di commesse, clienti, ordini, statistiche o prezzi dei
              materiali. Leggo i dati reali del CRM.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGERIMENTI.map((s) => (
                <button
                  key={s}
                  onClick={() => invia(s)}
                  className="rounded-full border border-line bg-paper/60 px-3 py-1.5 text-xs text-ink-soft transition hover:border-brand/40 hover:text-brand-deep"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.map((m) => {
              const testo = m.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join("");
              const isUser = m.role === "user";
              const attende =
                !isUser && !testo && (status === "streaming" || status === "submitted");
              return (
                <div
                  key={m.id}
                  className={isUser ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      isUser
                        ? "whitespace-pre-wrap bg-brand text-white"
                        : "border border-line bg-paper/70 text-ink"
                    }`}
                  >
                    {attende ? (
                      <span className="inline-flex gap-1 text-ink-faint">
                        <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
                      </span>
                    ) : isUser ? (
                      testo
                    ) : testo ? (
                      <Markdown text={testo} />
                    ) : (
                      <span className="text-ink-faint">…</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="border-t border-danger/30 bg-danger-soft px-6 py-2 text-xs text-danger">
          Errore nell&apos;assistente. Riprova. ({error.message})
        </p>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          invia(input);
        }}
        className="flex items-end gap-2 border-t border-line p-3 sm:p-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              invia(input);
            }
          }}
          rows={1}
          placeholder="Scrivi una domanda…  (Invio per inviare, Shift+Invio a capo)"
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-line bg-panel px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-elettra px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {busy ? "…" : "Invia"}
        </button>
      </form>
    </div>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint"
      style={{ animationDelay: delay }}
    />
  );
}

/**
 * Renderer Markdown minimale per le risposte dell'assistente (senza dipendenze).
 * Copre i pattern tipici di un LLM: titoli, elenchi puntati/numerati (con un
 * livello di indentazione), **grassetto** e `codice`. Costruisce nodi React
 * (niente HTML grezzo), quindi non c'è rischio di injection.
 */
function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  return (
    <div className="flex flex-col gap-1 leading-relaxed">
      {lines.map((raw, i) => {
        if (!raw.trim()) return <div key={i} className="h-1.5" aria-hidden />;

        const indent = raw.match(/^\s*/)?.[0].length ?? 0;
        const line = raw.trim();

        const h = line.match(/^#{1,6}\s+(.*)$/);
        if (h) {
          return (
            <p key={i} className="mt-1 font-semibold">
              <Inline text={h[1]} />
            </p>
          );
        }

        const ol = line.match(/^(\d+)\.\s+(.*)$/);
        const ul = line.match(/^[-*]\s+(.*)$/);
        if (ol || ul) {
          const marker = ol ? `${ol[1]}.` : "•";
          const content = ol ? ol[2] : ul![1];
          return (
            <div
              key={i}
              className="flex gap-2"
              style={{ paddingLeft: indent >= 2 ? "1.15rem" : 0 }}
            >
              <span className="shrink-0 tabular-nums text-ink-faint">
                {marker}
              </span>
              <span className="min-w-0 flex-1">
                <Inline text={content} />
              </span>
            </div>
          );
        }

        return (
          <p key={i}>
            <Inline text={line} />
          </p>
        );
      })}
    </div>
  );
}

/** Formattazione inline: **grassetto** e `codice`. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i}>{p.slice(2, -2)}</strong>;
        }
        if (p.length > 2 && p.startsWith("`") && p.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-panel px-1 py-0.5 font-mono text-[0.85em]"
            >
              {p.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
