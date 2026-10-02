import Link from "next/link";

export default function PrintLink({ href }: { href: string }) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" prefetch={false} title="Apri la versione stampabile in una nuova scheda" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-panel px-4 py-2.5 text-sm font-medium text-ink transition hover:border-brand/40 print:hidden">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true"><path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7zM17 11h1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Stampa
    </Link>
  );
}
