import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { etichettaStato, etichettaStatoMilestone, etichettaRuoloCantiere } from "@/lib/enums";
import { avanzamento, haPianificazioneDimostrativa, isProgetto, statoAvanzamento, ETICHETTE_AVANZAMENTO } from "@/lib/progetti";
import PrintDocument, { PrintField, PrintNotes, PrintSection } from "@/components/stampa/print-document";

export const metadata = { title: "Stampa scheda cantiere — Elettra" };

export default async function PrintProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  // Proiezione operativa: la scheda cantiere contiene pianificazione e squadra.
  const c = await prisma.commessa.findUnique({
    where: { id },
    select: {
      numero: true, stato: true, descrizione: true, dataInizioLavori: true, scadenzaLavori: true, dataFineLavori: true, noteCantiere: true,
      cliente: { select: { ragioneSociale: true, telefono: true, email: true } },
      pm: { select: { nome: true, cognome: true, email: true } },
      referente: { select: { nome: true, cognome: true, telefono: true, email: true } },
      milestone: { orderBy: [{ ordine: "asc" }, { id: "asc" }], select: { id: true, titolo: true, stato: true, dataPianificata: true, dataEffettiva: true, note: true, dimostrativa: true } },
      assegnazioni: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, ruoloCantiere: true, dal: true, al: true, note: true, operaio: { select: { nome: true, cognome: true, qualifica: true, squadra: true, telefono: true, attivo: true } } } },
    },
  });
  if (!c || !isProgetto(c.stato)) notFound();
  const av = avanzamento(c.milestone);

  return (
    <PrintDocument title="Scheda operativa di cantiere" subtitle={`Commessa ${c.numero} · ${c.cliente.ragioneSociale}`} sourceHref={`/progetti/${id}`}>
      {haPianificazioneDimostrativa(c.milestone) && <p className="print-callout"><strong>Pianificazione dimostrativa.</strong> Le milestone contrassegnate come dimostrative sono dati di esempio.</p>}
      <PrintSection title="Riferimenti"><dl className="print-fields"><PrintField label="Commessa">{c.numero}</PrintField><PrintField label="Cliente">{c.cliente.ragioneSociale}</PrintField><PrintField label="Project Manager">{c.pm ? `${c.pm.nome} ${c.pm.cognome}\n${c.pm.email}` : undefined}</PrintField><PrintField label="Referente cliente">{c.referente ? [c.referente.nome + " " + c.referente.cognome, c.referente.telefono, c.referente.email].filter(Boolean).join("\n") : undefined}</PrintField><PrintField label="Recapiti cliente">{[c.cliente.telefono, c.cliente.email].filter(Boolean).join("\n") || undefined}</PrintField><PrintField label="Stato commessa / progetto">{`${etichettaStato(c.stato)} · ${ETICHETTE_AVANZAMENTO[statoAvanzamento(c)]}`}</PrintField></dl></PrintSection>
      <PrintSection title="Lavori"><p className="print-text">{c.descrizione || "Nessuna descrizione registrata."}</p></PrintSection>
      <PrintSection title="Pianificazione"><dl className="print-fields"><PrintField label="Inizio lavori">{formatDate(c.dataInizioLavori)}</PrintField><PrintField label="Scadenza concordata">{formatDate(c.scadenzaLavori)}</PrintField><PrintField label="Fine effettiva">{formatDate(c.dataFineLavori)}</PrintField><PrintField label="Avanzamento">{av.totali ? `${av.percentuale}% · ${av.completate} di ${av.totali} milestone completate` : "Nessuna milestone definita"}</PrintField></dl></PrintSection>
      {c.noteCantiere && <PrintSection title="Note di cantiere"><p className="print-text">{c.noteCantiere}</p></PrintSection>}
      <PrintSection title={`Milestone (${c.milestone.length})`}>{c.milestone.length ? <table className="print-table"><colgroup><col style={{ width: "7%" }} /><col style={{ width: "39%" }} /><col style={{ width: "18%" }} /><col style={{ width: "18%" }} /><col style={{ width: "18%" }} /></colgroup><thead><tr><th scope="col">N.</th><th scope="col">Lavorazione</th><th scope="col">Stato</th><th scope="col">Prevista</th><th scope="col">Effettiva</th></tr></thead><tbody>{c.milestone.map((m, index) => <tr key={m.id}><td>{index + 1}</td><td>{m.titolo}{m.dimostrativa && <span className="print-small">Dimostrativa</span>}{m.note && <p className="print-task-notes">{m.note}</p>}</td><td>{etichettaStatoMilestone(m.stato)}</td><td>{formatDate(m.dataPianificata)}</td><td>{formatDate(m.dataEffettiva)}</td></tr>)}</tbody></table> : <p className="print-empty">Nessuna milestone definita.</p>}</PrintSection>
      <PrintSection title={`Squadra assegnata (${c.assegnazioni.length})`}>{c.assegnazioni.length ? <table className="print-table"><thead><tr><th scope="col">Nome e contatto</th><th scope="col">Ruolo / qualifica</th><th scope="col">Squadra</th><th scope="col">Periodo</th></tr></thead><tbody>{c.assegnazioni.map((a) => <tr key={a.id}><td>{a.operaio.nome} {a.operaio.cognome}{a.operaio.telefono && <span className="print-small">{a.operaio.telefono}</span>}{!a.operaio.attivo && <span className="print-small">Non attivo</span>}{a.note && <p className="print-task-notes">{a.note}</p>}</td><td>{a.ruoloCantiere ? etichettaRuoloCantiere(a.ruoloCantiere) : "—"}{a.operaio.qualifica && <span className="print-small">{a.operaio.qualifica}</span>}</td><td>{a.operaio.squadra ?? "—"}</td><td>{formatDate(a.dal)} – {formatDate(a.al)}</td></tr>)}</tbody></table> : <p className="print-empty">Nessun operaio assegnato.</p>}</PrintSection>
      <PrintNotes />
    </PrintDocument>
  );
}
