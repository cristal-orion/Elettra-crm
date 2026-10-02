import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatDate, formatEuro, toNumber } from "@/lib/format";
import { etichettaStatoOrdine } from "@/lib/enums";
import { printQuantity } from "@/lib/stampa";
import PrintDocument, { PrintField, PrintSection } from "@/components/stampa/print-document";

export const metadata = { title: "Stampa ordine a fornitore — Elettra" };

export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const ordine = await prisma.ordineFornitore.findUnique({
    where: { id },
    include: {
      fornitore: { select: { ragioneSociale: true, partitaIva: true, codiceFiscale: true, indirizzo: true, cap: true, localita: true, provincia: true, email: true, telefono: true, modalitaPagamento: true } },
      commessa: { select: { numero: true, oda: true, cliente: { select: { ragioneSociale: true } } } },
      righe: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });
  if (!ordine) notFound();
  const totali = ordine.righe.reduce((acc, r) => ({
    imponibile: acc.imponibile + toNumber(r.imponibile),
    iva: acc.iva + toNumber(r.imponibile) * toNumber(r.aliquotaIva) / 100,
  }), { imponibile: 0, iva: 0 });
  const consegne = ordine.righe.filter((r) => r.dataConsegnaPrevista || r.quantitaRicevuta != null || r.ddtNumero || r.ddtData || r.fatturaNumero || r.fatturaData);
  const f = ordine.fornitore;
  const indirizzo = [f.indirizzo, [f.cap, f.localita, f.provincia ? `(${f.provincia})` : null].filter(Boolean).join(" ")].filter(Boolean).join("\n");

  return (
    <PrintDocument title="Ordine a fornitore" subtitle={ordine.numero ? `Ordine ${ordine.numero}` : "Ordine senza numero"} sourceHref={`/ordini/${id}`}>
      <PrintSection title="Dati dell’ordine">
        <dl className="print-fields"><PrintField label="Numero ordine">{ordine.numero ?? "Senza numero"}</PrintField><PrintField label="Data ordine">{formatDate(ordine.data)}</PrintField><PrintField label="Stato">{etichettaStatoOrdine(ordine.stato)}</PrintField><PrintField label="Commessa">{ordine.commessa?.numero}</PrintField><PrintField label="Cliente della commessa">{ordine.commessa?.cliente.ragioneSociale}</PrintField><PrintField label="Riferimento ordine cliente (ODA)">{ordine.commessa?.oda}</PrintField></dl>
      </PrintSection>
      <PrintSection title="Fornitore">
        <dl className="print-fields"><PrintField label="Ragione sociale">{f.ragioneSociale}</PrintField><PrintField label="Partita IVA / codice fiscale">{[f.partitaIva, f.codiceFiscale].filter(Boolean).join(" / ") || undefined}</PrintField><PrintField label="Indirizzo">{indirizzo || undefined}</PrintField><PrintField label="Recapiti">{[f.telefono, f.email].filter(Boolean).join("\n") || undefined}</PrintField><PrintField label="Modalità di pagamento registrata">{f.modalitaPagamento}</PrintField></dl>
      </PrintSection>
      <PrintSection title={`Materiali ordinati (${ordine.righe.length})`}>
        <table className="print-table"><colgroup><col style={{ width: "13%" }} /><col style={{ width: "29%" }} /><col style={{ width: "6%" }} /><col style={{ width: "9%" }} /><col style={{ width: "12%" }} /><col style={{ width: "7%" }} /><col style={{ width: "7%" }} /><col style={{ width: "17%" }} /></colgroup>
          <thead><tr><th scope="col">Codice</th><th scope="col">Descrizione</th><th scope="col">U.M.</th><th scope="col" className="print-number">Qtà</th><th scope="col" className="print-number">Prezzo</th><th scope="col" className="print-number">Sc.%</th><th scope="col" className="print-number">IVA%</th><th scope="col" className="print-number">Imponibile</th></tr></thead>
          <tbody>{ordine.righe.map((r) => <tr key={r.id}><td>{r.codiceProdotto ?? "—"}</td><td>{r.descrizione}</td><td>{r.unitaMisura ?? "—"}</td><td className="print-number">{printQuantity.format(toNumber(r.quantita))}</td><td className="print-number">{formatEuro(r.prezzoUnitario)}</td><td className="print-number">{r.sconto != null ? printQuantity.format(toNumber(r.sconto)) : "—"}</td><td className="print-number">{r.aliquotaIva != null ? printQuantity.format(toNumber(r.aliquotaIva)) : "—"}</td><td className="print-number">{formatEuro(r.imponibile)}</td></tr>)}{!ordine.righe.length && <tr><td colSpan={8}>Nessuna riga registrata.</td></tr>}</tbody>
        </table>
        <dl className="print-totals"><PrintField label="Imponibile">{formatEuro(totali.imponibile)}</PrintField><PrintField label="IVA registrata">{formatEuro(totali.iva)}</PrintField><PrintField label="Totale">{formatEuro(totali.imponibile + totali.iva)}</PrintField></dl>
      </PrintSection>
      {consegne.length > 0 && <PrintSection title="Consegne e documenti registrati"><table className="print-table"><thead><tr><th scope="col">Materiale</th><th scope="col">Consegna prevista</th><th scope="col">Qtà ricevuta</th><th scope="col">DDT</th><th scope="col">Fattura</th></tr></thead><tbody>{consegne.map((r) => <tr key={r.id}><td>{r.descrizione}</td><td>{formatDate(r.dataConsegnaPrevista)}</td><td>{r.quantitaRicevuta != null ? printQuantity.format(toNumber(r.quantitaRicevuta)) : "—"}</td><td>{r.ddtNumero ?? "—"}<span className="print-small">{r.ddtData ? formatDate(r.ddtData) : ""}</span></td><td>{r.fatturaNumero ?? "—"}<span className="print-small">{r.fatturaData ? formatDate(r.fatturaData) : ""}</span></td></tr>)}</tbody></table></PrintSection>}
    </PrintDocument>
  );
}
