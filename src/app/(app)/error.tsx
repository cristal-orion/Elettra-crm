"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section role="alert" className="mx-auto max-w-lg rounded-xl border border-line bg-panel p-6"><h1 className="text-xl font-semibold">Non riesco a completare l’operazione</h1><p className="mt-3 text-sm text-ink-soft">Ricarica i dati e controlla l’esito prima di ripetere un salvataggio. Se il problema continua, apri una segnalazione.</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={reset} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white">Riprova</button><Link href="/" className="min-h-11 px-4 py-3 text-sm text-brand-deep underline">Torna alla dashboard</Link></div></section>;
}
