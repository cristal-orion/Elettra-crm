"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";

export function PrintStamp({ initialDate }: { initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  useEffect(() => {
    const update = () => flushSync(() => setDate(new Date().toISOString()));
    window.addEventListener("beforeprint", update);
    return () => window.removeEventListener("beforeprint", update);
  }, []);
  return <time data-print-date dateTime={date}>Stampato il {formatDateTime(date)}</time>;
}

export default function PrintControls({ sourceHref, landscape }: { sourceHref: string; landscape: boolean }) {
  const printed = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function preparePrint() {
    await document.fonts.ready;
    const logo = document.querySelector<HTMLImageElement>("[data-print-logo]");
    if (logo) await logo.decode();
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }

  useEffect(() => {
    let cancelled = false;
    void preparePrint().then(() => {
      if (cancelled || printed.current) return;
      printed.current = true;
      window.print();
    }).catch(() => {
      if (!cancelled) setError("Il logo non è stato caricato. Ricarica la pagina prima di stampare.");
    });
    return () => { cancelled = true; };
  }, []);

  async function print() {
    setPending(true);
    setError("");
    try { await preparePrint(); window.print(); }
    catch { setError("Stampa non disponibile. Ricarica la pagina e riprova."); }
    finally { setPending(false); }
  }

  return (
    <div className="print-controls">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={sourceHref} className="min-h-11 py-3 text-sm text-brand-deep">← Torna al CRM</Link>
        <button type="button" disabled={pending} onClick={print} className="min-h-11 rounded-lg bg-elettra px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Preparazione…" : "Stampa"}</button>
      </div>
      <p className="mt-2 text-xs text-ink-soft">Formato A4 {landscape ? "orizzontale" : "verticale"}. Puoi scegliere la stampante o salvare in PDF dalla finestra di stampa.</p>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
