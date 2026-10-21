import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/format";
import { etichettaRuolo } from "@/lib/enums";
import { TIPI_INTERAZIONE } from "@/lib/commerciale-schema";
import { listPage } from "@/lib/list-state";
import ListPagination from "./list-pagination";

const labels: Record<string, string> = { ...TIPI_INTERAZIONE, CREAZIONE: "Creazione", MODIFICA: "Modifica", FASE: "Cambio fase", CONVERSIONE: "Conferma incarico", DOCUMENTO: "Documento", CONFIGURAZIONE: "Configurazione", ATTIVITA: "Attività", RESPONSABILE: "Responsabile" };
const fieldLabels: Record<string, string> = { titolo: "Titolo", anagrafica: "Anagrafica", referente: "Referente", responsabile: "Responsabile", descrizione: "Descrizione", tipologia: "Tipologia", origine: "Origine", valorePrevisto: "Valore previsto", riferimentoOfferta: "Riferimento offerta", importoOfferta: "Importo offerta", dataInvioOfferta: "Invio offerta", fase: "Fase", motivo: "Motivo", commessa: "Commessa", importoOrdine: "Importo confermato", dataOrdine: "Data conferma", riferimentoConferma: "Riferimento conferma", metodoRicezioneOrdine: "Ricezione", nome: "Nome", categoria: "Categoria", ordine: "Ordine", attiva: "Attiva", nomeFile: "File", titoloAttivita: "Attività", stato: "Stato", scadenza: "Scadenza", userId: "Responsabile attività", rispostaCliente: "Risposta cliente" };
function printable(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") { const v = value as Record<string, unknown>; return [v.ragioneSociale, v.nome, v.cognome, v.numero].filter(Boolean).join(" ") || JSON.stringify(value); }
  if (typeof value === "boolean") return value ? "Sì" : "No";
  return String(value);
}
export default async function CommercialHistory({ id, path, pagina }: { id: string | null; path: string; pagina?: string }) {
  const where = { opportunitaId: id };
  const total = await prisma.eventoCommerciale.count({ where }), pagination = listPage(pagina, total, 20);
  const rows = await prisma.eventoCommerciale.findMany({ where, orderBy: [{ data: "desc" }, { createdAt: "desc" }, { id: "desc" }], skip: pagination.skip, take: pagination.take });
  return <section id="cronologia" aria-label="Cronologia commerciale" className="min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-6"><h2 className="font-semibold">Cronologia ({total})</h2><p className="mt-1 text-xs text-ink-soft">Contatti e modifiche con autore e data di registrazione. Le interazioni sono ordinate per data effettiva.</p>
    <ol className="mt-4 divide-y divide-line">{rows.map((r) => {
      const before = (r.prima ?? {}) as Record<string, unknown>, after = (r.dopo ?? {}) as Record<string, unknown>;
      const changes = Object.entries(fieldLabels).filter(([k]) => JSON.stringify(before[k]) !== JSON.stringify(after[k]) && (Object.hasOwn(before, k) || Object.hasOwn(after, k)));
      return <li key={r.id} className="space-y-2 py-4"><p className="text-sm font-semibold">{formatDate(r.data)} · {labels[r.tipo] ?? r.tipo}</p><p className="whitespace-pre-wrap break-words text-sm">{r.testo}</p>{r.esito && <p className="whitespace-pre-wrap text-sm text-ink-soft">Esito: {r.esito}</p>}<p className="text-xs text-ink-faint">Registrato il {formatDateTime(r.createdAt)} · {r.autoreNome} · {etichettaRuolo(r.autoreRuolo)}</p>
        {changes.length > 0 && <details><summary className="min-h-11 cursor-pointer py-3 text-xs text-brand-deep">Valori registrati</summary><dl className="space-y-2">{changes.map(([k, label]) => <div key={k} className="grid min-w-0 gap-1 text-xs sm:grid-cols-[10rem_1fr_1fr]"><dt className="font-medium">{label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words">Prima: {printable(before[k])}</dd><dd className="min-w-0 whitespace-pre-wrap break-words">Dopo: {printable(after[k])}</dd></div>)}</dl></details>}
      </li>;
    })}</ol><ListPagination path={path} params={{}} page={pagination.page} pages={pagination.pages} />
  </section>;
}
