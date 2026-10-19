import Link from "next/link";
import { listHref } from "@/lib/list-state";

export default function ListPagination({ path, params, page, pages }: { path: string; params: Record<string, string | undefined>; page: number; pages: number }) {
  if (pages <= 1) return null;
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")).toString();
  const href = (n: number) => listHref(path, query, { pagina: String(n) }, false);
  const cls = "min-h-11 rounded-lg border border-line bg-panel px-4 py-3 text-sm hover:border-brand focus-visible:outline-2 focus-visible:outline-brand";
  return <nav aria-label="Paginazione risultati" className="flex items-center justify-between gap-3 text-sm">
    {page > 1 ? <Link href={href(page - 1)} className={cls}>← Precedente</Link> : <span />}
    <span>Pagina {page} di {pages}</span>
    {page < pages ? <Link href={href(page + 1)} className={cls}>Successiva →</Link> : <span />}
  </nav>;
}
