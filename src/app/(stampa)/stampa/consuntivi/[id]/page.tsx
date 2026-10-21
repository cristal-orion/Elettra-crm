import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { consuntivoValues } from "@/lib/consuntivi";
import { FASCE_ORARIE } from "@/lib/consuntivo-schema";
import { formatDate, formatEuro } from "@/lib/format";
import PrintDocument, { PrintField, PrintSection } from "@/components/stampa/print-document";

export const metadata = { title: "Consuntivo ore e materiali — Elettra" };
export default async function PrintConsuntivo({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const row = await prisma.consuntivo.findUnique({ where: { commessaId: id }, include: { commessa: true, cliente: true } });
  if (!row) notFound();
  const data = consuntivoValues(row);
  const number = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 4 });
  return <PrintDocument title="Consuntivo ore e materiali" subtitle={`Commessa ${row.commessa.numero} · versione ${row.versione}`} sourceHref={`/commesse/${id}/consuntivo`}>
    <PrintSection title="Riferimenti"><dl className="print-fields">
      <PrintField label="Cliente">{row.cliente.ragioneSociale}</PrintField><PrintField label="Data consuntivo">{formatDate(row.data)}</PrintField>
      <PrintField label="Lavoro">{row.commessa.descrizione}</PrintField><PrintField label="P. IVA / codice fiscale">{[row.cliente.partitaIva, row.cliente.codiceFiscale].filter(Boolean).join(" / ")}</PrintField>
    </dl></PrintSection>
    <PrintSection title="Ore e materiali impiegati">
      <table className="print-table"><thead><tr><th>Descrizione</th><th>U.M.</th><th className="print-number">Quantità</th><th className="print-number">Prezzo unitario €</th><th className="print-number">Importo €</th></tr></thead>
        <tbody>{data.righe.map((r) => <tr key={r.id}><td>{r.descrizione}{r.tipo === "ORE" && <span className="print-small">{FASCE_ORARIE[r.fascia]}</span>}</td><td>{r.unitaMisura}</td><td className="print-number">{number.format(Number(r.quantita))}</td><td className="print-number">{number.format(Number(r.prezzoUnitario))}</td><td className="print-number">{formatEuro(r.totale)}</td></tr>)}</tbody>
      </table>
      <dl className="print-totals"><PrintField label="Manodopera">{formatEuro(data.totaleOre)}</PrintField><PrintField label="Materiali">{formatEuro(data.totaleMateriali)}</PrintField><PrintField label="Totale ore e materiali">{formatEuro(data.totale)}</PrintField></dl>
    </PrintSection>
    {data.note && <PrintSection title="Note"><p className="whitespace-pre-wrap">{data.note}</p></PrintSection>}
  </PrintDocument>;
}
