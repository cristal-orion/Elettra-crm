import { Prisma, type PrismaClient } from "@/generated/prisma";
import { typoPattern } from "./list-state";
import { normalizedSearchText } from "./list-search";
import { duplicateSignals, MATCH_REASONS, type AnagraficaMatch, type AnagraficaMatchInput, type AnagraficaMatches } from "./anagrafica-match";

/** Ricerca su clienti E fornitori, senza trasferire l'intera anagrafica al browser. */
export async function findSimilarAnagrafiche(db: PrismaClient, input: AnagraficaMatchInput & { excludeId?: string }): Promise<AnagraficaMatches> {
  const s = duplicateSignals(input);
  if (!s.terms.length && !s.partitaIva && !s.codiceFiscale && !s.email && !s.telefono) return { candidati: [], altri: false };
  const name = normalizedSearchText(Prisma.sql`a."ragioneSociale"`);
  const exactTerms = s.terms.map((term) => Prisma.sql`strpos(${name}, ${term}) > 0`);
  const nameTerms = s.terms.map((term) => {
    const pattern = s.terms.length <= 8 ? typoPattern(term) : null;
    return Prisma.sql`(strpos(${name}, ${term}) > 0 ${pattern ? Prisma.sql`OR ${name} ~ ${pattern}` : Prisma.empty})`;
  });
  const phone = (value: Prisma.Sql) => Prisma.sql`regexp_replace(regexp_replace(coalesce(${value}, ''), '[^0-9]', '', 'g'), '^00', '')`;
  type MatchRow = Omit<AnagraficaMatch, "motivi"> & { matches: (keyof typeof MATCH_REASONS)[] };
  const rows = await db.$queryRaw<MatchRow[]>(Prisma.sql`
    SELECT id, "ragioneSociale", "codiceCliente", "codiceFornitore", localita, "partitaIva", "codiceFiscale", matches
    FROM (
      SELECT a.id, a."ragioneSociale", a."codiceCliente", a."codiceFornitore", a.localita, a."partitaIva", a."codiceFiscale",
        (${exactTerms.length ? Prisma.join(exactTerms, " AND ") : Prisma.sql`false`}) AS "nomeEsatto",
        array_remove(ARRAY[
          CASE WHEN ${s.partitaIva ? Prisma.sql`upper(trim(a."partitaIva")) = ${s.partitaIva}` : Prisma.sql`false`} THEN 'partitaIva' END,
          CASE WHEN ${s.codiceFiscale ? Prisma.sql`upper(trim(a."codiceFiscale")) = ${s.codiceFiscale}` : Prisma.sql`false`} THEN 'codiceFiscale' END,
          CASE WHEN ${nameTerms.length ? Prisma.join(nameTerms, " AND ") : Prisma.sql`false`} THEN 'nome' END,
          CASE WHEN ${s.email ? Prisma.sql`lower(trim(a.email)) = ${s.email} OR EXISTS (
            SELECT 1 FROM "Referente" r WHERE r."anagraficaId" = a.id AND lower(trim(r.email)) = ${s.email}
          )` : Prisma.sql`false`} THEN 'email' END,
          CASE WHEN ${s.telefono ? Prisma.sql`${phone(Prisma.sql`a.telefono`)} = ${s.telefono} OR EXISTS (
            SELECT 1 FROM "Referente" r WHERE r."anagraficaId" = a.id AND ${phone(Prisma.sql`r.telefono`)} = ${s.telefono}
          )` : Prisma.sql`false`} THEN 'telefono' END
        ], NULL) AS matches
      FROM "Anagrafica" a WHERE ${input.excludeId ? Prisma.sql`a.id <> ${input.excludeId}` : Prisma.sql`true`}
    ) candidates
    WHERE cardinality(matches) > 0
    ORDER BY (matches && ARRAY['partitaIva', 'codiceFiscale']) DESC,
      cardinality(matches) DESC, "nomeEsatto" DESC, "ragioneSociale" ASC, id ASC
    LIMIT 6`);
  return { candidati: rows.slice(0, 5).map(({ matches, ...a }) => ({ ...a, motivi: matches })), altri: rows.length > 5 };
}
