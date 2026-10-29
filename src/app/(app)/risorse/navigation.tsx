import Link from "next/link";

export default function RisorseNavigation({ current }: { current: "assegnazioni" | "operai" | "squadre" }) {
  return <nav aria-label="Sezioni risorse" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-2">
    {[["assegnazioni", "/risorse", "Assegnazioni"], ["operai", "/risorse/operai", "Personale"], ["squadre", "/risorse/squadre", "Squadre"]].map(([key, href, label]) => <Link key={key} href={href} aria-current={current === key ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium ${key === current ? "bg-paper text-ink" : "text-ink-soft hover:text-brand-deep"}`}>{label}</Link>)}
  </nav>;
}
