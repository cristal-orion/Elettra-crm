import { Prisma } from "@/generated/prisma";

/** Equivalente SQL di statoAvanzamento: aggrega nel DB, idrata solo la pagina. */
export function projectListSource(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return Prisma.sql`
    SELECT c.*, concat_ws(' ', c.numero, c.descrizione, a."ragioneSociale") AS text,
      date_trunc('day', (c."scadenzaLavori" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}) AS "dueDay",
      CASE
        WHEN c."dataFineLavori" IS NOT NULL OR c.stato = 'FATTURATA' OR (m.total > 0 AND m.total = m.done) THEN 3
        WHEN c."scadenzaLavori" < ${today} OR m.late > 0 THEN 0
        WHEN m.total = 0 AND c."dataInizioLavori" IS NULL AND c."scadenzaLavori" IS NULL THEN 2
        ELSE 1
      END AS urgency
    FROM "Commessa" c JOIN "Anagrafica" a ON a.id = c."clienteId"
    LEFT JOIN LATERAL (
      SELECT count(*) AS total, count(*) FILTER (WHERE stato = 'COMPLETATA') AS done,
        count(*) FILTER (WHERE stato <> 'COMPLETATA' AND "dataPianificata" < ${today}) AS late
      FROM "Milestone" WHERE "commessaId" = c.id
    ) m ON true`;
}
