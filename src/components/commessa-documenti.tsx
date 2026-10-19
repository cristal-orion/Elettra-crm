import type { Documento } from "@/generated/prisma";
import { etichettaCategoria } from "@/lib/enums";
import { formatBytes, formatDate } from "@/lib/format";
import { DocumentiUploader, DocDeleteButton } from "@/app/(app)/commesse/documenti-ui";
import { uploadDocumenti, deleteDocumento } from "@/app/(app)/commesse/documenti-actions";

/** Un solo archivio per commessa e progetto, con le medesime azioni e autorizzazioni. */
export default function CommessaDocumenti({ id, numero, documenti, puoGestire }: {
  id: string; numero: string; documenti: Pick<Documento, "id" | "categoria" | "nomeFile" | "dimensione" | "createdAt">[]; puoGestire: boolean;
}) {
  return <section className="rounded-xl border border-line bg-panel p-4 sm:p-6" aria-labelledby="documenti-title">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="documenti-title" className="text-sm font-semibold">Documenti <span className="font-normal text-ink-faint">({documenti.length})</span></h2>
      <p className="text-xs text-ink-soft">Cartella <span className="font-mono text-ink-faint">{numero}/</span></p>
    </div>
    {puoGestire && <div className="mt-4"><DocumentiUploader action={uploadDocumenti.bind(null, id)} /></div>}
    {documenti.length === 0 ? <p className="mt-4 text-sm text-ink-faint">Nessun documento allegato.</p> : (
      <ul className="mt-4 flex flex-col divide-y divide-line">
        {documenti.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0">
          <span className="shrink-0 rounded-md bg-lead-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">{etichettaCategoria(d.categoria)}</span>
          <a href={`/documenti/${d.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-words py-3 text-sm font-medium text-brand-deep underline underline-offset-4">{d.nomeFile}</a>
          <span className="hidden shrink-0 font-mono text-xs text-ink-faint sm:inline">{formatBytes(d.dimensione)}</span>
          <span className="hidden shrink-0 font-mono text-xs text-ink-faint md:inline">{formatDate(d.createdAt)}</span>
          {puoGestire && <DocDeleteButton action={deleteDocumento.bind(null, d.id)} nome={d.nomeFile} />}
        </li>)}
      </ul>
    )}
  </section>;
}
