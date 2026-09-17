"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { etichettaStato, etichettaStatoMilestone } from "@/lib/enums";

export type OperationView = { operationId: string; status: string; preview?: unknown; result?: unknown; error?: string | null };
const statuses: Record<string, string> = { PENDING: "Da confermare", COMPLETED: "Completata", REJECTED: "Rifiutata", EXPIRED: "Scaduta", CONFLICT: "Dati modificati", FAILED: "Non completata" };
const display = (value: unknown) => value == null ? "Non indicato" : typeof value === "object" ? JSON.stringify(value) : String(value);
const fieldLabels: Record<string, string> = { importoOrdine: "Importo ordine", importoOfferta: "Importo offerta", stato: "Stato", tipologia: "Tipologia", dataOrdine: "Data ordine", dataInvio: "Data invio", motivazionePersa: "Motivazione", note: "Note", titolo: "Titolo", descrizione: "Descrizione" };
function fieldValue(field: string, value: unknown) {
  if (value == null) return "Non indicato";
  if (field.startsWith("importo") && Number.isFinite(Number(value))) return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value));
  if (field === "stato") return etichettaStatoMilestone(etichettaStato(String(value)));
  return display(value);
}

export default function OperationCard({ initial, refresh = true }: { initial: OperationView; refresh?: boolean }) {
  const [op, setOp] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (!refresh) return;
    let active = true;
    fetch(`/assistente/api/operations/${initial.operationId}`).then(async (r) => { if (r.ok && active) setOp(await r.json()); }).catch(() => {});
    return () => { active = false; };
  }, [initial.operationId, refresh]);
  async function decide(approved: boolean) {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/assistente/api/operations/${op.operationId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Operazione non completata.");
      setOp(data); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Errore di connessione."); }
    finally { setBusy(false); }
  }
  const preview = op.preview as { operazione?: string; prima?: Record<string, unknown>; proposta?: Record<string, unknown> } | undefined;
  const proposed = (preview?.proposta?.data ?? preview?.proposta ?? {}) as Record<string, unknown>;
  const result = op.result as { message?: string; href?: string } | null;
  const record = preview?.prima?.numero ? `Commessa ${preview.prima.numero}` : preview?.prima?.ragioneSociale ?? preview?.prima?.titolo;
  return <section className="my-3 overflow-hidden rounded-lg border border-line bg-panel" aria-label="Esito operazione AI">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
      <span className="text-sm font-semibold">{result?.message ?? (record ? String(record) : "Modifica al CRM")}</span>
      <span className={`text-xs font-medium ${op.status === "COMPLETED" ? "text-ok" : "text-brand-deep"}`} role="status">{statuses[op.status] ?? op.status}</span>
    </div>
    {op.status === "PENDING" && <div className="p-4">
      <p className="mb-3 text-sm text-ink-soft">Controlla i valori proposti prima di salvare. La conferma scade dopo 30 minuti.</p>
      {preview?.operazione === "eliminaMilestone" && <p className="mb-3 font-medium text-danger">Eliminazione della milestone indicata.</p>}
      {preview?.operazione === "rimuoviAssegnazione" && <p className="mb-3 font-medium text-danger">Rimozione dell’assegnazione indicata.</p>}
      <dl className="space-y-2 text-sm">{Object.entries(proposed).filter(([k]) => !["type", "expectedUpdatedAt", "id"].includes(k)).map(([k, v]) => <div key={k} className="grid gap-1 sm:grid-cols-[9rem_1fr]">
        <dt className="break-words text-ink-soft">{fieldLabels[k] ?? k.replace(/([A-Z])/g, " $1")}</dt>
        <dd className="min-w-0 break-words">{preview?.prima && k in preview.prima && <span className="mr-2 text-ink-faint line-through">{fieldValue(k, preview.prima[k])}</span>}<strong className="font-medium">{fieldValue(k, v)}</strong></dd>
      </div>)}</dl>
      <div className="mt-4 flex gap-2"><button type="button" disabled={busy} onClick={() => decide(true)} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Attendi…" : "Conferma modifica"}</button><button type="button" disabled={busy} onClick={() => decide(false)} className="min-h-11 rounded-lg border border-line px-4 text-sm">Rifiuta</button></div>
    </div>}
    {result?.href?.startsWith("/") && !result.href.startsWith("//") && <Link href={result.href} className="block px-4 py-3 text-sm font-medium text-brand-deep underline">Apri nel CRM →</Link>}
    {(error || op.error) && <p role="alert" className="px-4 py-3 text-sm text-danger">{error || op.error}</p>}
  </section>;
}
