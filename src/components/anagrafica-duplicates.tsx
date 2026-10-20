"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasDuplicateSignals, MATCH_REASONS, type AnagraficaMatchInput, type AnagraficaMatches } from "@/lib/anagrafica-match";

export default function AnagraficaDuplicates({ input, excludeId }: { input: AnagraficaMatchInput; excludeId?: string }) {
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ body: string; retry: number; data?: AnagraficaMatches; error?: string }>();
  const body = JSON.stringify({ ...input, excludeId });
  const eligible = hasDuplicateSignals(input);
  const current = result?.body === body && result.retry === retry ? result : undefined;
  const candidates = eligible ? current?.data?.candidati ?? [] : [];
  useEffect(() => {
    if (!eligible) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/anagrafiche/simili", {
          method: "POST", headers: { "Content-Type": "application/json" }, body, cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Verifica delle anagrafiche non disponibile.");
        if (!controller.signal.aborted) setResult({ body, retry, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ body, retry, error: error instanceof Error && error.name === "Error" ? error.message : "Verifica delle anagrafiche non disponibile. Riprova tra poco." });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [body, retry, eligible]);

  return <section aria-label="Verifica anagrafiche simili" className="min-w-0 rounded-xl border border-line bg-paper/60 p-4">
    <h2 className="text-sm font-semibold">Prima di salvare: anagrafiche già presenti</h2>
    <div role="status" aria-live="polite" className="mt-2 text-sm text-ink-soft">
      {!eligible ? "Compila la ragione sociale (almeno 4 caratteri), i dati fiscali o un contatto per cercare schede simili." : !current ? "Verifica delle anagrafiche in corso…" : current.error ? current.error : current.data?.candidati.length ? "Possibili corrispondenze: controlla se puoi riutilizzare una scheda esistente." : "Nessuna corrispondenza suggerita con i dati inseriti. Il controllo fiscale viene ripetuto al salvataggio."}
    </div>
    {eligible && current?.error && <button type="button" onClick={() => setRetry((n) => n + 1)} className="mt-2 min-h-11 rounded-lg border border-line px-3 py-2 text-sm font-medium text-brand-deep">Riprova verifica</button>}
    {candidates.length > 0 && <>
      <ul className="mt-3 space-y-3">
        {candidates.map((a) => <li key={a.id} className="min-w-0 rounded-lg border border-line bg-panel p-3">
          <p className="break-words text-sm font-semibold">{a.ragioneSociale}</p>
          <p className="mt-1 break-words text-xs text-ink-soft">{[a.codiceCliente, a.codiceFornitore, a.localita, a.partitaIva && `P. IVA ${a.partitaIva}`, a.codiceFiscale && `CF ${a.codiceFiscale}`].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 text-xs text-ink-soft">{a.motivi.map((reason) => MATCH_REASONS[reason]).join(" · ")}</p>
          <Link href={`/anagrafiche/${encodeURIComponent(a.id)}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-brand-deep underline underline-offset-4">Apri scheda esistente<span className="sr-only">: {a.ragioneSociale} (nuova scheda)</span></Link>
        </li>)}
      </ul>
      {current?.data?.altri && <p className="mt-2 text-xs text-ink-soft">Mostrate le prime 5 corrispondenze. Completa i dati fiscali per evidenziare la scheda corretta.</p>}
      <p className="mt-3 text-xs text-ink-soft">I link si aprono in una nuova scheda: i dati del modulo restano qui. Nomi o contatti simili possono appartenere a soggetti diversi; verifica prima di creare una nuova anagrafica.</p>
    </>}
  </section>;
}
