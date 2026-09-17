import { prisma } from "../prisma";
import { STATI_PROGETTO_ATTIVO } from "../progetti";
import { romeDay } from "./schedule-time";

export type Finding = { key: string; tipo: string; titolo: string; dettaglio: string; href: string; context: { type: "commessa" | "progetto"; id: string } };
export async function collectFindings(followupDays: number, horizonDays: number, now = new Date()) {
  const today = new Date(`${romeDay(now)}T00:00:00Z`);
  const horizon = new Date(today.getTime() + horizonDays * 86400000);
  const cutoff = new Date(now.getTime() - followupDays * 86400000);
  const [commesse, total, assegnazioni] = await Promise.all([
    prisma.commessa.findMany({ where: { stato: { notIn: ["FATTURATA", "PERSA"] } }, take: 5000, orderBy: { numero: "asc" }, select: { id: true, numero: true, stato: true, updatedAt: true, importoOrdine: true, dataInizioLavori: true, dataFineLavori: true, scadenzaLavori: true, pmId: true, milestone: { select: { id: true, titolo: true, stato: true, dataPianificata: true, dimostrativa: true } } } }),
    prisma.commessa.count({ where: { stato: { notIn: ["FATTURATA", "PERSA"] } } }),
    prisma.assegnazioneOperaio.findMany({ where: { commessa: { stato: { in: [...STATI_PROGETTO_ATTIVO] }, dataFineLavori: null }, OR: [{ al: null }, { al: { gte: today } }] }, take: 5000, orderBy: [{ operaioId: "asc" }, { dal: "asc" }, { id: "asc" }], include: { operaio: { select: { nome: true, cognome: true } }, commessa: { select: { numero: true } } } }),
  ]);
  const findings: Finding[] = [];
  const add = (c: { id: string; numero: string }, tipo: string, dettaglio: string, suffix = "") => findings.push({ key: `${tipo}:${c.id}:${suffix}`, tipo, titolo: `Commessa ${c.numero}`, dettaglio, href: `/${tipo === "FOLLOWUP" ? "commesse" : "progetti"}/${c.id}`, context: { type: tipo === "FOLLOWUP" ? "commessa" : "progetto", id: c.id } });
  for (const c of commesse) {
    if (["INVIATA", "IN_FOLLOWUP"].includes(c.stato) && c.updatedAt <= cutoff) add(c, "FOLLOWUP", `Nessun aggiornamento registrato da almeno ${followupDays} giorni.`);
    if (!(STATI_PROGETTO_ATTIVO as readonly string[]).includes(c.stato) || c.dataFineLavori) continue;
    if (c.milestone.length > 0 && c.milestone.every((m) => m.stato === "COMPLETATA")) continue;
    // La pianificazione demo non deve generare allarmi operativi reali.
    if (c.milestone.some((m) => m.dimostrativa)) continue;
    if (!c.milestone.length && !c.dataInizioLavori && !c.scadenzaLavori) add(c, "DA_PIANIFICARE", "Progetto acquisito senza milestone o date di cantiere.");
    if (!c.pmId || c.importoOrdine === null) add(c, "DATI_MANCANTI", [!c.pmId ? "Project Manager non assegnato" : "", c.importoOrdine === null ? "Importo ordine mancante" : ""].filter(Boolean).join("; "));
    if (c.scadenzaLavori && c.scadenzaLavori < horizon) add(c, c.scadenzaLavori < today ? "RITARDO" : "SCADENZA", `Scadenza lavori: ${c.scadenzaLavori.toISOString().slice(0, 10)}.`);
    for (const m of c.milestone) if (m.stato !== "COMPLETATA" && m.dataPianificata && m.dataPianificata < horizon) add(c, m.dataPianificata < today ? "RITARDO" : "SCADENZA", `${m.titolo}: ${m.dataPianificata.toISOString().slice(0, 10)}.`, m.id);
  }
  for (let i = 0; i < assegnazioni.length; i++) {
    const a = assegnazioni[i];
    for (let j = i + 1; j < assegnazioni.length && assegnazioni[j].operaioId === a.operaioId; j++) {
      const b = assegnazioni[j];
      if (a.commessaId === b.commessaId) continue;
      if ((a.dal ?? today) <= (b.al ?? horizon) && (b.dal ?? today) <= (a.al ?? horizon)) add({ id: a.commessaId, numero: a.commessa.numero }, "SOVRAPPOSIZIONE", `${a.operaio.nome} ${a.operaio.cognome}: assegnazioni sovrapposte alle commesse ${a.commessa.numero} e ${b.commessa.numero}.`, `${a.id}:${b.id}`);
    }
  }
  return { findings, analisiParziale: total > commesse.length || assegnazioni.length === 5000, commesseAnalizzate: commesse.length };
}
