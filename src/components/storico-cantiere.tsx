import type { AggiornamentoCantiere, Documento } from "@/generated/prisma";
import { formatDate, formatDateTime } from "@/lib/format";

export default function StoricoCantiere({ aggiornamenti }: { aggiornamenti: (AggiornamentoCantiere & { documenti: Pick<Documento, "id" | "nomeFile">[] })[] }) {
  return <section className="rounded-xl border border-line bg-panel p-4 sm:p-6"><h2 className="text-sm font-semibold">Storico SAL e cantiere</h2><p className="mt-1 text-xs text-ink-soft">Ultimi 50 aggiornamenti, con autore e data di registrazione.</p>{!aggiornamenti.length && <p className="mt-4 text-sm text-ink-soft">Nessun aggiornamento registrato. Usa «Aggiorna SAL» per salvare stato delle fasi, nota e foto.</p>}<ol className="mt-4 space-y-5">{aggiornamenti.map((a) => {
    const prima = a.prima as { percentuale?: number }; const dopo = a.dopo as { percentuale?: number };
    return <li key={a.id} className="border-l-2 border-line pl-4"><p className="text-sm font-medium">{a.tipo === "SAL" ? `SAL ${prima.percentuale ?? "—"}% → ${dopo.percentuale ?? "—"}%` : a.tipo === "SOSPENSIONE" ? "Cantiere sospeso" : a.tipo === "RIPRESA" ? "Lavori ripresi" : "Milestone aggiornata"} · {formatDate(a.data)}</p><p className="mt-1 text-xs text-ink-soft">{a.autoreNome} · registrato {formatDateTime(a.createdAt)}</p>{a.nota && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{a.nota}</p>}{a.documenti.map((d) => <a key={d.id} href={`/documenti/${d.id}`} className="mt-1 flex min-h-11 items-center break-all text-sm text-brand-deep underline">{d.nomeFile}</a>)}</li>;
  })}</ol></section>;
}
