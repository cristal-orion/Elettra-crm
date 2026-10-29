import { Prisma } from "@/generated/prisma";
import { STATI_PROGETTO, STATI_PROGETTO_ATTIVO } from "./progetti";
import { queryText } from "./list-state";

const urgencyByState = { IN_RITARDO: 0, IN_CORSO: 1, DA_PIANIFICARE: 2, COMPLETATO: 3, SOSPESO: 4 } as const;
export function projectFilters(params: Record<string, unknown>) {
  const vista = params.vista === "tutti" || params.vista === "ritardo" ? params.vista : "attivi";
  const avanzamento = typeof params.avanzamento === "string" && Object.hasOwn(urgencyByState, params.avanzamento)
    ? params.avanzamento as keyof typeof urgencyByState : "";
  return { vista, avanzamento, pm: queryText(params.pm), cliente: queryText(params.cliente), squadra: queryText(params.squadra) } as const;
}

/** Ogni filtro è applicato prima di conteggio, fallback fuzzy e paginazione. */
export function projectListScope(filters: ReturnType<typeof projectFilters>) {
  const states = filters.vista === "attivi" ? [...STATI_PROGETTO_ATTIVO] : STATI_PROGETTO;
  return Prisma.sql`s.stato IN (${Prisma.join(states)})
    AND ${filters.vista === "ritardo" ? Prisma.sql`s.urgency = 0` : Prisma.sql`true`}
    AND ${filters.avanzamento ? Prisma.sql`s.urgency = ${urgencyByState[filters.avanzamento]}` : Prisma.sql`true`}
    AND ${filters.pm === "non_assegnato" ? Prisma.sql`s."pmId" IS NULL` : filters.pm ? Prisma.sql`s."pmId" = ${filters.pm}` : Prisma.sql`true`}
    AND ${filters.cliente ? Prisma.sql`s."clienteId" = ${filters.cliente}` : Prisma.sql`true`}
    AND ${filters.squadra ? Prisma.sql`EXISTS (
      SELECT 1 FROM "AssegnazioneOperaio" a JOIN "Operaio" o ON o.id = a."operaioId"
      WHERE a."commessaId" = s.id AND o.squadra = ${filters.squadra}
    )` : Prisma.sql`true`}`;
}

/** Equivalente SQL di statoAvanzamento: aggrega nel DB, idrata solo la pagina. */
export function projectListSource(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return Prisma.sql`
    SELECT c.*, concat_ws(' ', c.numero, c.descrizione, a."ragioneSociale", c."indirizzoCantiere") AS text,
      date_trunc('day', (c."scadenzaLavori" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}) AS "dueDay",
      CASE
        WHEN c."dataFineLavori" IS NOT NULL OR c.stato = 'FATTURATA' OR (m.total > 0 AND m.total = m.done) THEN 3
        WHEN c.sospeso THEN 4
        WHEN (NOT EXISTS (SELECT 1 FROM "Milestone" d WHERE d."commessaId" = c.id AND d.dimostrativa) AND c."scadenzaLavori" < ${today}) OR m.late > 0 THEN 0
        WHEN m.total = 0 AND c."dataInizioLavori" IS NULL AND c."scadenzaLavori" IS NULL THEN 2
        ELSE 1
      END AS urgency
    FROM "Commessa" c JOIN "Anagrafica" a ON a.id = c."clienteId"
    LEFT JOIN LATERAL (
      SELECT count(*) AS total, count(*) FILTER (WHERE stato = 'COMPLETATA') AS done,
        count(*) FILTER (WHERE stato <> 'COMPLETATA' AND "dataPianificata" < ${today}) AS late
      FROM "Milestone" WHERE "commessaId" = c.id AND NOT dimostrativa
    ) m ON true`;
}
