"use client";
import { useEffect, useId, useRef } from "react";

/** Riepilogo raggiungibile da tastiera e collegato ai campi con un nome noto. */
export default function FormError({ error }: { error?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!error) return;
    ref.current?.focus();
    const form = ref.current?.closest("form");
    const fields = [...(form?.querySelectorAll<HTMLInputElement>("input, select, textarea") ?? [])];
    const row = error.match(/Riga (\d+):/);
    const marked = fields.filter((field) => field.name && (error.includes(field.name) || (row && field.name.includes(`.${Number(row[1]) - 1}.`))));
    for (const field of marked) { field.setAttribute("aria-invalid", "true"); field.setAttribute("aria-describedby", id); }
    return () => { for (const field of marked) { field.removeAttribute("aria-invalid"); field.removeAttribute("aria-describedby"); } };
  }, [error, id]);
  if (!error) return null;
  return <div ref={ref} id={id} role="alert" tabIndex={-1} className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger"><p className="font-medium">Controlla i dati inseriti</p><p className="mt-1">{error}</p><button type="button" className="mt-2 min-h-10 underline" onClick={() => {
    const form = ref.current?.closest("form");
    const target = form?.querySelector<HTMLElement>('[aria-invalid="true"], input:invalid, select:invalid, textarea:invalid');
    target?.focus();
  }}>Vai al campo da correggere</button></div>;
}
