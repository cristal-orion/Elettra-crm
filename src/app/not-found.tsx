import Link from "next/link";
export default function NotFound() {
  return <main className="mx-auto max-w-lg px-6 py-16"><h1 className="text-2xl font-semibold">Pagina non trovata</h1><p className="mt-3 text-ink-soft">Il collegamento potrebbe non essere più disponibile o il record potrebbe essere stato rimosso.</p><Link href="/" className="mt-6 inline-block min-h-11 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white">Torna alla dashboard</Link></main>;
}
