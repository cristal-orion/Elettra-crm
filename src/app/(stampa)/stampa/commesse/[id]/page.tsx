import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatDate, formatEuro, toNumber } from "@/lib/format";
import { etichettaStato, etichettaStatoOrdine, etichettaTitolo, etichettaCategoria, METODI_RICEZIONE, TIPOLOGIE } from "@/lib/enums";
import PrintDocument, { PrintField, PrintNotes, PrintSection } from "@/components/stampa/print-document";

export const metadata = { title: "Stampa scheda commessa — Elettra" };

export default async function PrintCommessaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const c = await prisma.commessa.findUnique({
    where: { id },
    include: {
      cliente: { select: { ragioneSociale: true, codiceCliente: true, partitaIva: true, indirizzo: true, cap: true, localita: true, provincia: true, telefono: true, email: true } },
      pm: { select: { nome: true, cognome: true } },
      referente: { select: { titolo: true, nome: true, cognome: true, telefono: true, email: true } },
      ordiniFornitore: { orderBy: [{ data: "desc" }, { id: "asc" }], include: { fornitore: { select: { ragioneSociale: true } }, righe: { select: { imponibile: true } } } },
      documenti: { orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, nomeFile: true, categoria: true, createdAt: true } },
    },
  });
  if (!c) notFound();
  const tipo = c.tipologia ? (TIPOLOGIE as Record<string, string>)[c.tipologia] ?? c.tipologia : undefined;
  const metodo = c.metodoRicezioneOrdine ? (METODI_RICEZIONE as Record<string, string>)[c.metodoRicezioneOrdine] ?? c.metodoRicezioneOrdine : undefined;
  const acquisti = c.ordiniFornitore.reduce((sum, ordine) => sum + ordine.righe.reduce((n, r) => n + toNumber(r.imponibile), 0), 0);

  return (
    <PrintDocument title="Scheda commessa" subtitle={`Commessa ${c.numero} · ${c.cliente.ragioneSociale}`} sourceHref={`/commesse/${id}`}>
      <PrintSection title="Identificazione e responsabili"><dl className="print-fields"><PrintField label="Numero commessa">{c.numero}</PrintField><PrintField label="Stato">{etichettaStato(c.stato)}</PrintField><PrintField label="Tipologia">{tipo}</PrintField><PrintField label="Project Manager">{c.pm ? `${c.pm.nome} ${c.pm.cognome}` : undefined}</PrintField><PrintField label="Riferimento commerciale">{c.referenteCommerciale}</PrintField></dl></PrintSection>
      <PrintSection title="Descrizione"><p className="print-text">{c.descrizione || "Nessuna descrizione registrata."}</p></PrintSection>
      <PrintSection title="Cliente e contatti"><dl className="print-fields"><PrintField label="Cliente">{c.cliente.ragioneSociale}</PrintField><PrintField label="Codice cliente / partita IVA">{[c.cliente.codiceCliente, c.cliente.partitaIva].filter(Boolean).join(" / ") || undefined}</PrintField><PrintField label="Sede cliente (anagrafica)">{[c.cliente.indirizzo, [c.cliente.cap, c.cliente.localita, c.cliente.provincia ? `(${c.cliente.provincia})` : null].filter(Boolean).join(" ")].filter(Boolean).join("\n") || undefined}</PrintField><PrintField label="Recapiti cliente">{[c.cliente.telefono, c.cliente.email].filter(Boolean).join("\n") || undefined}</PrintField><PrintField label="Referente">{c.referente ? `${etichettaTitolo(c.referente.titolo)} ${c.referente.nome} ${c.referente.cognome}`.trim() : undefined}</PrintField><PrintField label="Recapiti referente">{[c.referente?.telefono, c.referente?.email].filter(Boolean).join("\n") || undefined}</PrintField></dl></PrintSection>
      <PrintSection title="Date e riepilogo economico"><dl className="print-fields"><PrintField label="Data richiesta">{formatDate(c.dataRichiesta)}</PrintField><PrintField label="Data invio offerta">{formatDate(c.dataInvio)}</PrintField><PrintField label="Importo offerta">{c.importoOfferta != null ? formatEuro(c.importoOfferta) : undefined}</PrintField><PrintField label="Importo ordine cliente">{c.importoOrdine != null ? formatEuro(c.importoOrdine) : undefined}</PrintField><PrintField label="Data ordine cliente">{formatDate(c.dataOrdine)}</PrintField><PrintField label="Ricezione ordine">{metodo}</PrintField><PrintField label="Numero ordine cliente (ODA)">{c.oda}</PrintField><PrintField label="Acquisti a fornitore (imponibile)">{formatEuro(acquisti)}</PrintField></dl></PrintSection>
      {c.stato === "PERSA" && c.motivazionePersa && <PrintSection title="Motivazione offerta persa"><p className="print-text">{c.motivazionePersa}</p></PrintSection>}
      <PrintSection title={`Ordini a fornitore (${c.ordiniFornitore.length})`}>{c.ordiniFornitore.length ? <table className="print-table"><thead><tr><th scope="col">Numero</th><th scope="col">Fornitore</th><th scope="col">Data</th><th scope="col">Stato</th><th scope="col" className="print-number">Imponibile</th></tr></thead><tbody>{c.ordiniFornitore.map((o) => <tr key={o.id}><td>{o.numero ?? "Senza numero"}</td><td>{o.fornitore.ragioneSociale}</td><td>{formatDate(o.data)}</td><td>{etichettaStatoOrdine(o.stato)}</td><td className="print-number">{formatEuro(o.righe.reduce((sum, r) => sum + toNumber(r.imponibile), 0))}</td></tr>)}</tbody></table> : <p className="print-empty">Nessun ordine a fornitore collegato.</p>}</PrintSection>
      {c.documenti.length > 0 && <PrintSection title="Elenco allegati registrati"><table className="print-table"><thead><tr><th scope="col">Nome file</th><th scope="col">Categoria</th><th scope="col">Caricato il</th></tr></thead><tbody>{c.documenti.map((d) => <tr key={d.id}><td>{d.nomeFile}</td><td>{etichettaCategoria(d.categoria)}</td><td>{formatDate(d.createdAt)}</td></tr>)}</tbody></table></PrintSection>}
      <PrintNotes />
    </PrintDocument>
  );
}
