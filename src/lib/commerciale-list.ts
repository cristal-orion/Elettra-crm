import { Prisma, type PrismaClient } from "@/generated/prisma";
import { normalizedSearchText } from "./list-search";
import { listPage, queryText, searchTerms, typoPattern } from "./list-state";
import { giornoAttivita } from "./attivita";
import { puoGestireCommesse } from "./enums";

export type CommercialeParams = { q?: string; fase?: string; cliente?: string; responsabile?: string; situazione?: string; periodo?: string; ordine?: string; vista?: string; pagina?: string };
export const SITUAZIONI_COMMERCIALI = { tutte: "Tutte", aperte: "Aperte", vinte: "Vinte", perse: "Perse", richiamare: "Contatti entro oggi", prossime: "Contatti nei prossimi 7 giorni", senzaRisposta: "Offerte senza risposta da 7 giorni", ferme: "Ferme da 14 giorni" };
export function commercialeFilters(sp: CommercialeParams) {
  return { q: queryText(sp.q), fase: queryText(sp.fase), cliente: queryText(sp.cliente), responsabile: queryText(sp.responsabile),
    situazione: Object.hasOwn(SITUAZIONI_COMMERCIALI, sp.situazione ?? "") ? sp.situazione! : "tutte",
    periodo: ["30", "90", "anno"].includes(sp.periodo ?? "") ? sp.periodo! : "", ordine: ["titolo", "valore", "contatto"].includes(sp.ordine ?? "") ? sp.ordine! : "recenti",
    vista: sp.vista === "elenco" ? "elenco" : "kanban", pagina: typeof sp.pagina === "string" ? sp.pagina : "" };
}
type Stats = { total: number; aperte: number; vinte: number; perse: number; pipeline: string; senzaValore: number; richiamare: number; senzaRisposta: number; ferme: number };

export async function commercialeList(db: PrismaClient, user: { id: string; ruolo: string }, sp: CommercialeParams, now = new Date()) {
  const f = commercialeFilters(sp), today = giornoAttivita(now);
  const tomorrow = new Date(+today + 86400000), next = new Date(+today + 8 * 86400000);
  const weekAgo = new Date(+today - 7 * 86400000), stale = new Date(+today - 14 * 86400000);
  const taskScope = puoGestireCommesse(user.ruolo) ? Prisma.sql`true` : Prisma.sql`t."userId" = ${user.id}`;
  const source = Prisma.sql`SELECT o.*, f.nome AS "faseNome", f.categoria, a."ragioneSociale",
    concat_ws(' ', o.titolo, o.descrizione, o."riferimentoOfferta", a."ragioneSociale", a."partitaIva", a.email, a.telefono, r.nome, r.cognome, r.email, r.telefono) AS text,
    (f.categoria NOT IN ('VINTA','PERSA')) AS aperta,
    EXISTS (SELECT 1 FROM "Attivita" t WHERE t."opportunitaId"=o.id AND t.stato='DA_FARE' AND ${taskScope} AND t.scadenza < ${tomorrow}) AS richiamare,
    EXISTS (SELECT 1 FROM "Attivita" t WHERE t."opportunitaId"=o.id AND t.stato='DA_FARE' AND ${taskScope} AND t.scadenza >= ${tomorrow} AND t.scadenza < ${next}) AS prossime,
    (SELECT min(t.scadenza) FROM "Attivita" t WHERE t."opportunitaId"=o.id AND t.stato='DA_FARE' AND ${taskScope}) AS "prossimoContatto",
    (o."dataInvioOfferta" <= ${weekAgo} AND (o."ultimaRispostaIl" IS NULL OR o."ultimaRispostaIl" < o."dataInvioOfferta")) AS "senzaRisposta",
    (greatest(o."faseAggiornataIl", o."ultimaInterazioneIl", o."createdAt") < ${stale}) AS ferma
    FROM "Opportunita" o JOIN "FaseCommerciale" f ON f.id=o."faseId" JOIN "Anagrafica" a ON a.id=o."anagraficaId" LEFT JOIN "Referente" r ON r.id=o."referenteId"`;
  const period = f.periodo === "anno" ? new Date(`${today.getUTCFullYear()}-01-01T00:00:00Z`) : f.periodo ? new Date(+today - (Number(f.periodo) - 1) * 86400000) : null;
  const filters: Prisma.Sql[] = [
    f.fase ? Prisma.sql`s."faseId"=${f.fase}` : Prisma.sql`true`,
    f.cliente ? Prisma.sql`s."anagraficaId"=${f.cliente}` : Prisma.sql`true`,
    f.responsabile === "nessuno" ? Prisma.sql`s."responsabileId" IS NULL` : f.responsabile ? Prisma.sql`s."responsabileId"=${f.responsabile}` : Prisma.sql`true`,
    period ? Prisma.sql`s."createdAt" >= ${period}` : Prisma.sql`true`,
    f.situazione === "aperte" ? Prisma.sql`s.aperta` : f.situazione === "vinte" ? Prisma.sql`s.categoria='VINTA'` : f.situazione === "perse" ? Prisma.sql`s.categoria='PERSA'`
      : f.situazione === "richiamare" ? Prisma.sql`s.aperta AND s.richiamare` : f.situazione === "prossime" ? Prisma.sql`s.aperta AND s.prossime`
      : f.situazione === "senzaRisposta" ? Prisma.sql`s.aperta AND s."senzaRisposta"` : f.situazione === "ferme" ? Prisma.sql`s.aperta AND s.ferma` : Prisma.sql`true`,
  ];
  const terms = searchTerms(f.q), text = normalizedSearchText(Prisma.sql`s.text`);
  const exact = terms.map((term) => Prisma.sql`strpos(${text}, ${term}) > 0`);
  return db.$transaction(async (tx) => {
    const stats = async (where: Prisma.Sql) => (await tx.$queryRaw<Stats[]>(Prisma.sql`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE s.aperta)::int AS aperte, count(*) FILTER (WHERE s.categoria='VINTA')::int AS vinte, count(*) FILTER (WHERE s.categoria='PERSA')::int AS perse,
      coalesce(sum(s."valorePrevisto") FILTER (WHERE s.aperta),0)::text AS pipeline,
      count(*) FILTER (WHERE s.aperta AND s."valorePrevisto" IS NULL)::int AS "senzaValore",
      count(*) FILTER (WHERE s.aperta AND s.richiamare)::int AS richiamare,
      count(*) FILTER (WHERE s.aperta AND s."senzaRisposta")::int AS "senzaRisposta",
      count(*) FILTER (WHERE s.aperta AND s.ferma)::int AS ferme FROM (${source}) s WHERE ${where}`))[0];
    const scope = Prisma.join(filters, " AND ");
    let where = Prisma.sql`(${scope}) AND (${exact.length ? Prisma.join(exact, " AND ") : Prisma.sql`true`})`;
    let totals = await stats(where), similar = false;
    if (!totals.total && terms.length <= 8 && terms.some(typoPattern)) {
      where = Prisma.sql`(${scope}) AND (${Prisma.join(terms.map((term, i) => { const p = typoPattern(term); return p ? Prisma.sql`(${exact[i]} OR ${text} ~ ${p})` : exact[i]; }), " AND ")})`;
      totals = await stats(where); similar = totals.total > 0;
    }
    const pagination = listPage(f.pagina, totals.total);
    const order = f.ordine === "titolo" ? Prisma.sql`s.titolo ASC` : f.ordine === "valore" ? Prisma.sql`s."valorePrevisto" DESC NULLS LAST` : f.ordine === "contatto" ? Prisma.sql`s."prossimoContatto" ASC NULLS LAST` : Prisma.sql`s."createdAt" DESC`;
    const phases = await tx.$queryRaw<{ faseId: string; total: number }[]>(Prisma.sql`SELECT s."faseId", count(*)::int AS total FROM (${source}) s WHERE ${where} GROUP BY s."faseId"`);
    const ids = f.vista === "elenco" ? await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT s.id FROM (${source}) s WHERE ${where} ORDER BY ${order}, s.id LIMIT ${pagination.take} OFFSET ${pagination.skip}`)
      : await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM (SELECT s.id, row_number() OVER (PARTITION BY s."faseId" ORDER BY ${order},s.id) AS n FROM (${source}) s WHERE ${where}) ranked WHERE n <= 10 ORDER BY n, id`);
    const rows = await tx.opportunita.findMany({ where: { id: { in: ids.map((r) => r.id) } }, include: {
      fase: true, anagrafica: { select: { ragioneSociale: true, isProspect: true } }, responsabile: { select: { nome: true, cognome: true } }, commessa: { select: { id: true, numero: true } },
      attivita: { where: { stato: "DA_FARE", ...(puoGestireCommesse(user.ruolo) ? {} : { userId: user.id }) }, orderBy: [{ scadenza: { sort: "asc", nulls: "last" } }, { id: "asc" }], take: 1 },
    } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return { filters: f, totals, phases, similar, pagination, rows: ids.flatMap(({ id }) => byId.has(id) ? [byId.get(id)!] : []) };
  }, { isolationLevel: "RepeatableRead" });
}
