import { requireUser } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { getPrintableTasks } from "@/lib/stampa";
import { statoScadenza, type AttivitaFilters } from "@/lib/attivita";
import PrintDocument, { PrintNotes } from "@/components/stampa/print-document";

export const metadata = { title: "Stampa elenco attività — Elettra" };
const SCADENZE: Record<string, string> = { scadute: "Scadute", oggi: "In scadenza oggi", prossime: "Prossimi 7 giorni", senza: "Senza scadenza" };

export default async function PrintTasksPage({ searchParams }: { searchParams: Promise<AttivitaFilters> }) {
  const user = await requireUser();
  const now = new Date();
  const { filters, tasks, responsabile, commessa, cliente } = await getPrintableTasks(user, await searchParams, undefined, now);
  const params = new URLSearchParams(filters);
  for (const [key, value] of [...params]) if (!value) params.delete(key);
  return (
    <PrintDocument title="Elenco attività" subtitle={filters.vista === "team" ? "Attività del team" : `Attività di ${user.nome} ${user.cognome}`} sourceHref={`/attivita?${params}`} landscape>
      <section className="print-filters" aria-label="Filtri applicati">
        <p><strong>{tasks.length} attività</strong> · Stato: {filters.stato === "tutte" ? "Tutti" : filters.stato === "COMPLETATA" ? "Completate" : "Da fare"} · Scadenza: {SCADENZE[filters.scadenza] ?? "Tutte"}</p>
        {filters.vista === "team" && <p>Responsabile: {filters.responsabile ? responsabile ? `${responsabile.nome} ${responsabile.cognome}` : "Utente non disponibile" : "Tutto il team"}</p>}
        {filters.q && <p>Ricerca: {filters.q}</p>}
        {filters.commessaId && <p>Commessa: {commessa?.numero ?? "Non disponibile"}</p>}
        {filters.clienteId && <p>Cliente / anagrafica: {cliente?.ragioneSociale ?? "Non disponibile"}</p>}
      </section>
      <table className="print-table"><colgroup><col style={{ width: "4%" }} /><col style={{ width: "34%" }} /><col style={{ width: "15%" }} /><col style={{ width: "12%" }} /><col style={{ width: "25%" }} /><col style={{ width: "10%" }} /></colgroup><thead><tr><th scope="col" aria-label="Spunta">✓</th><th scope="col">Attività e note</th><th scope="col">Responsabile</th><th scope="col">Scadenza</th><th scope="col">Commessa / cliente</th><th scope="col">Stato</th></tr></thead><tbody>{tasks.map((t) => {
        const due = statoScadenza(t.scadenza, t.stato, now);
        return <tr key={t.id} data-print-task={t.id}><td><span className="print-check" aria-label={t.stato === "COMPLETATA" ? "Completata" : "Da spuntare"}>{t.stato === "COMPLETATA" ? "✓" : ""}</span></td><td>{t.titolo}{t.note && <p className="print-task-notes">{t.note}</p>}</td><td>{t.user.nome} {t.user.cognome}</td><td>{t.scadenza ? formatDate(t.scadenza) : "Senza scadenza"}{due === "scaduta" && <strong className="print-small">Scaduta</strong>}{due === "oggi" && <strong className="print-small">Oggi</strong>}</td><td>{t.commessa ? `Commessa ${t.commessa.numero}` : "—"}{t.cliente && <span className="print-small">{t.cliente.ragioneSociale}</span>}</td><td>{t.stato === "COMPLETATA" ? "Completata" : "Da fare"}</td></tr>;
      })}{!tasks.length && <tr><td colSpan={6}>Nessuna attività corrisponde ai filtri selezionati.</td></tr>}</tbody></table>
      <PrintNotes />
    </PrintDocument>
  );
}
