import { Prisma, type PrismaClient } from "@/generated/prisma";
import { listPage, searchTerms, typoPattern } from "./list-state";

/** PostgreSQL 16: normalizzazione Unicode senza estensioni o modifiche ai dati. */
export function normalizedSearchText(value: Prisma.Sql) {
  return Prisma.sql`lower(regexp_replace(normalize(coalesce(${value}, ''), NFD), '[̀-ͯ]', '', 'g'))`;
}

export const listSources = {
  anagrafiche: Prisma.sql`SELECT a.*, concat_ws(' ', a."ragioneSociale", a."codiceCliente", a."codiceFornitore", a."partitaIva", a."codiceFiscale", a.localita, a.email, a.telefono,
    (SELECT string_agg(concat_ws(' ', r.nome, r.cognome, r.email, r.telefono), ' ') FROM "Referente" r WHERE r."anagraficaId" = a.id)) AS text FROM "Anagrafica" a`,
  commesse: Prisma.sql`SELECT c.*, a."ragioneSociale" AS "clienteNome", concat_ws(' ', c.numero, c.descrizione, a."ragioneSociale") AS text FROM "Commessa" c JOIN "Anagrafica" a ON a.id = c."clienteId"`,
  ordini: Prisma.sql`SELECT o.*, concat_ws(' ', o.numero, a."ragioneSociale", c.numero) AS text FROM "OrdineFornitore" o JOIN "Anagrafica" a ON a.id = o."fornitoreId" LEFT JOIN "Commessa" c ON c.id = o."commessaId"`,
  materiali: Prisma.sql`SELECT p.*, concat_ws(' ', p.codice, p.descrizione, p.marca, p.categoria) AS text FROM "Prodotto" p`,
  segnalazioni: Prisma.sql`SELECT s.*, concat_ws(' ', s.titolo, s.descrizione) AS text FROM "Segnalazione" s`,
  operai: Prisma.sql`SELECT o.*, concat_ws(' ', o.nome, o.cognome, o.qualifica, o.squadra) AS text FROM "Operaio" o`,
  utenti: Prisma.sql`SELECT u.id, u.nome, u.cognome, u.email, u.ruolo, u.attivo, concat_ws(' ', u.nome, u.cognome, u.email) AS text FROM "User" u`,
};

/**
 * Solo ID della pagina in uscita: niente array di tutti i risultati nell'applicazione.
 * Source/scope/orderBy sono SQL statico dei chiamanti server, mai SQL ricevuto dal browser.
 * Le autorizzazioni e tutti i filtri devono far parte di scope, prima di esatto/fuzzy.
 */
export async function searchListPage(db: PrismaClient, source: Prisma.Sql, options: {
  query: string; page?: string; scope?: Prisma.Sql; orderBy: Prisma.Sql; extraCount?: Prisma.Sql;
}) {
  const terms = searchTerms(options.query);
  const text = normalizedSearchText(Prisma.sql`s.text`);
  const exact = terms.map((term) => Prisma.sql`strpos(${text}, ${term}) > 0`);
  const scope = options.scope ?? Prisma.sql`true`;
  const exactWhere = Prisma.sql`(${scope}) AND (${exact.length ? Prisma.join(exact, " AND ") : Prisma.sql`true`})`;
  return db.$transaction(async (tx) => {
    const count = async (where: Prisma.Sql) => {
      const [result] = await tx.$queryRaw<{ total: number; extra: number }[]>(Prisma.sql`
        SELECT count(*)::int AS total, (${options.extraCount ?? Prisma.sql`0`})::int AS extra FROM (${source}) s WHERE ${where}`);
      return result;
    };
    let where = exactWhere;
    let stats = await count(where);
    let similar = false;
    // Una query troppo frammentata non avvia una ricerca approssimata costosa.
    if (stats.total === 0 && terms.length <= 8 && terms.some((term) => typoPattern(term))) {
      const fuzzy = terms.map((term, i) => {
        const pattern = typoPattern(term);
        return pattern ? Prisma.sql`(${exact[i]} OR ${text} ~ ${pattern})` : exact[i];
      });
      where = Prisma.sql`(${scope}) AND (${Prisma.join(fuzzy, " AND ")})`;
      stats = await count(where);
      similar = stats.total > 0;
    }
    const pagination = listPage(options.page, stats.total);
    const rows = stats.total ? await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT s.id FROM (${source}) s WHERE ${where} ORDER BY ${options.orderBy}, s.id ASC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}`) : [];
    return { ...pagination, total: stats.total, extra: stats.extra, similar, ids: rows.map((row) => row.id) };
  }, { isolationLevel: "RepeatableRead" });
}

export function inPageOrder<T extends { id: string }>(rows: T[], ids: string[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => { const row = byId.get(id); return row ? [row] : []; });
}
