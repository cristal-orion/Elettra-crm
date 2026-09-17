export default function Loading() {
  return <div role="status" aria-live="polite" className="space-y-5 py-4"><p className="text-sm text-ink-soft">Caricamento dei dati…</p><div aria-hidden className="h-8 w-56 rounded bg-line" /><div aria-hidden className="h-48 rounded-xl border border-line bg-panel" /></div>;
}
