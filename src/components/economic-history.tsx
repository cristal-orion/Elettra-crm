import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { listPage } from "@/lib/list-state";
import ListPagination from "./list-pagination";

const LABELS: Record<string, string> = { versione: "Versione", data: "Data", note: "Note", mansione: "Mansione", ordinaria: "€/h ordinaria", straordinariaFeriale: "€/h straordinaria feriale", straordinariaFestiva: "€/h straordinaria festiva", ricarico: "Ricarico %", costoBase: "Costo base unitario €", tariffa: "Tariffa €/h", quantita: "Ore / quantità", descrizione: "Descrizione", totale: "Totale €", totaleOre: "Totale manodopera €", totaleMateriali: "Totale materiali €", valoreListino: "Valore proposto dal tariffario", versioneTariffario: "Versione tariffario di origine", prezzoUnitario: "Prezzo unitario €", unitaMisura: "Unità di misura", tipo: "Tipo", fascia: "Fascia oraria", voceId: "Voce tariffario", prodottoId: "Materiale a catalogo" };
function changes(before: unknown, after: unknown) {
  const a = (before ?? {}) as Record<string, unknown>, b = (after ?? {}) as Record<string, unknown>;
  const result: { label: string; before: string; after: string }[] = [];
  const fields = (old: Record<string, unknown>, next: Record<string, unknown>, prefix = "") => {
    for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
      if (key === "id" || Array.isArray(old[key]) || Array.isArray(next[key]) || old[key] === next[key]) continue;
      result.push({ label: `${prefix}${LABELS[key] ?? key}`, before: old[key] == null ? "—" : String(old[key]), after: next[key] == null ? "—" : String(next[key]) });
    }
  };
  fields(a, b);
  for (const section of ["manodopera", "materiali", "righe"]) {
    const old = (a[section] ?? []) as Record<string, unknown>[], next = (b[section] ?? []) as Record<string, unknown>[];
    for (const id of new Set([...old, ...next].map((r) => r.id))) {
      const x = old.find((r) => r.id === id) ?? {}, y = next.find((r) => r.id === id) ?? {};
      fields(x, y, `${y.mansione ?? y.descrizione ?? x.mansione ?? x.descrizione ?? "Riga"} · `);
    }
  }
  return result;
}

export default async function EconomicHistory({ entita, id, path, pagina }: { entita: string; id?: string; path: string; pagina?: string }) {
  if (!id) return null;
  const total = await prisma.modificaEconomica.count({ where: { entita, entitaId: id } });
  const pagination = listPage(pagina, total, 20);
  const rows = await prisma.modificaEconomica.findMany({ where: { entita, entitaId: id }, orderBy: { versione: "desc" }, skip: pagination.skip, take: pagination.take });
  return <section aria-label="Storico modifiche" className="rounded-xl border border-line bg-panel p-4 sm:p-6">
    <h2 className="font-semibold">Storico modifiche ({total})</h2>
    <p className="mt-1 text-xs text-ink-soft">Ogni salvataggio effettivo conserva autore, data e valori precedenti e successivi.</p>
    {rows.map((r) => <details key={r.id} className="mt-3 border-t border-line pt-2">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Versione {r.versione} · {formatDateTime(r.createdAt)} · {r.autoreNome}</summary>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Voce</th><th className="p-2">Prima</th><th className="p-2">Dopo</th></tr></thead>
        <tbody>{changes(r.prima, r.dopo).map((c, i) => <tr key={i} className="border-t border-line"><td className="p-2">{c.label}</td><td className="max-w-60 break-words p-2">{c.before}</td><td className="max-w-60 break-words p-2">{c.after}</td></tr>)}</tbody>
      </table></div>
    </details>)}
    <div className="mt-4"><ListPagination path={path} params={{}} page={pagination.page} pages={pagination.pages} /></div>
  </section>;
}
