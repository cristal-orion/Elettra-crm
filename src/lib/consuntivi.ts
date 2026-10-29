import { isDeepStrictEqual } from "node:util";
import { Prisma, type Consuntivo, type TariffarioCliente } from "@/generated/prisma";
import { puoGestireAnagrafiche, puoGestireCommesse } from "./enums";
import { InputError } from "./form-validation";
import { assertCommessaAccess } from "./access";
import { ConsuntivoSchema, TariffarioSchema, type ConsuntivoValues, type RigaConsuntivo, type TariffarioValues } from "./consuntivo-schema";

type Db = Prisma.TransactionClient;
const decimal = (s: string) => new Prisma.Decimal(s);
const fixed = (s: string) => decimal(s).toFixed(4);
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
// JSONB riordina le chiavi degli oggetti: un salvataggio invariato non crea revisioni.
const same = isDeepStrictEqual;

export function tariffarioValues(row: TariffarioCliente | null): TariffarioValues {
  return row ? { versione: row.versione, manodopera: row.manodopera as TariffarioValues["manodopera"], materiali: row.materiali as TariffarioValues["materiali"] }
    : { versione: 0, manodopera: [], materiali: [] };
}
export function consuntivoValues(row: Consuntivo): ConsuntivoValues {
  return { versione: row.versione, data: row.data.toISOString().slice(0, 10), note: row.note ?? "", righe: row.righe as RigaConsuntivo[],
    totaleOre: row.totaleOre.toFixed(2), totaleMateriali: row.totaleMateriali.toFixed(2), totale: row.totale.toFixed(2) };
}
async function actorFor(db: Db, actorId: string, tariffario: boolean) {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { id: true, nome: true, cognome: true, ruolo: true, attivo: true } });
  if (!actor?.attivo || !(tariffario ? puoGestireAnagrafiche(actor.ruolo) : puoGestireCommesse(actor.ruolo))) throw new InputError("Non hai i permessi per questa operazione.");
  return actor;
}
function checkVersion(current: number, expected: number) {
  if (current !== expected) throw new InputError("I dati sono stati modificati. Ricarica la pagina prima di salvare.");
}
async function audit(db: Db, actor: Awaited<ReturnType<typeof actorFor>>, entita: string, entitaId: string, versione: number, prima: unknown, dopo: unknown) {
  await db.modificaEconomica.create({ data: { entita, entitaId, versione, autoreId: actor.id, autoreNome: `${actor.nome} ${actor.cognome}`, autoreRuolo: actor.ruolo,
    prima: prima === null ? Prisma.DbNull : json(prima), dopo: json(dopo) } });
}

/** Chiamare esclusivamente in transazione Serializable: dati e audit sono atomici. */
export async function saveTariffario(db: Db, actorId: string, clienteId: string, raw: unknown) {
  const actor = await actorFor(db, actorId, true);
  const input = TariffarioSchema.parse(raw);
  const cliente = await db.anagrafica.findFirst({ where: { id: clienteId, isCliente: true } });
  if (!cliente) throw new InputError("Cliente non valido.");
  const existing = await db.tariffarioCliente.findUnique({ where: { clienteId } });
  checkVersion(existing?.versione ?? 0, input.versione);
  const products = await db.prodotto.findMany({ where: { id: { in: input.materiali.map((m) => m.prodottoId) } }, select: { id: true, descrizione: true, unitaMisura: true } });
  if (products.length !== input.materiali.length) throw new InputError("Un materiale non è più disponibile nel catalogo. Rivedi le righe.");
  const manodopera = input.manodopera.map((r) => ({ ...r, ordinaria: fixed(r.ordinaria), straordinariaFeriale: fixed(r.straordinariaFeriale), straordinariaFestiva: fixed(r.straordinariaFestiva) }));
  const materiali = input.materiali.map((r) => { const p = products.find((p) => p.id === r.prodottoId)!; return { ...r, ricarico: fixed(r.ricarico), descrizione: p.descrizione, unitaMisura: p.unitaMisura }; });
  const old = tariffarioValues(existing);
  if (existing && same(old.manodopera, manodopera) && same(old.materiali, materiali)) return existing;
  const data = { manodopera: json(manodopera), materiali: json(materiali), versione: input.versione + 1 };
  const row = existing ? await db.tariffarioCliente.update({ where: { id: existing.id }, data }) : await db.tariffarioCliente.create({ data: { ...data, clienteId } });
  await audit(db, actor, "TARIFFARIO", row.id, row.versione, existing ? old : null, tariffarioValues(row));
  return row;
}

export async function saveConsuntivo(db: Db, actorId: string, commessaId: string, raw: unknown) {
  const actor = await actorFor(db, actorId, false);
  const input = ConsuntivoSchema.parse(raw);
  const job = await assertCommessaAccess(db, actor, commessaId);
  if (!job) throw new InputError("Commessa non trovata.");
  const existing = await db.consuntivo.findUnique({ where: { commessaId } });
  checkVersion(existing?.versione ?? 0, input.versione);
  if (existing && existing.clienteId !== job.clienteId) throw new InputError("Il cliente non corrisponde a quello del consuntivo.");
  const tariffario = tariffarioValues(await db.tariffarioCliente.findUnique({ where: { clienteId: job.clienteId } }));
  const old = existing ? consuntivoValues(existing) : null;
  const righe: RigaConsuntivo[] = input.righe.map((r) => {
    const previous = old?.righe.find((p) => p.id === r.id && p.tipo === r.tipo && p.voceId === r.voceId && (r.tipo !== "ORE" || (p.tipo === "ORE" && p.fascia === r.fascia)));
    let origin: Pick<RigaConsuntivo, "valoreListino" | "versioneTariffario" | "descrizione" | "unitaMisura">;
    if (previous) origin = previous;
    else {
      checkVersion(tariffario.versione, input.versioneTariffario);
      const voce = r.tipo === "ORE" ? tariffario.manodopera.find((v) => v.id === r.voceId) : tariffario.materiali.find((v) => v.id === r.voceId);
      if (!voce) throw new InputError("La voce non appartiene al tariffario del cliente. Ricarica il modulo.");
      origin = r.tipo === "ORE" && "mansione" in voce
        ? { valoreListino: voce[r.fascia], versioneTariffario: tariffario.versione, descrizione: voce.mansione, unitaMisura: "ore" }
        : "ricarico" in voce ? { valoreListino: voce.ricarico, versioneTariffario: tariffario.versione, descrizione: voce.descrizione, unitaMisura: voce.unitaMisura ?? "unità" }
        : (() => { throw new InputError("Tipo di voce non valido."); })();
    }
    const prezzo = r.tipo === "ORE" ? decimal(r.tariffa) : decimal(r.costoBase).mul(decimal(r.ricarico).div(100).plus(1));
    const prezzoUnitario = prezzo.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP).toFixed(4);
    const totale = decimal(prezzoUnitario).mul(r.quantita).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
    const values = r.tipo === "ORE" ? { ...r, tariffa: fixed(r.tariffa) } : { ...r, costoBase: fixed(r.costoBase), ricarico: fixed(r.ricarico) };
    return { ...values, quantita: fixed(r.quantita), descrizione: origin.descrizione, unitaMisura: origin.unitaMisura,
      valoreListino: origin.valoreListino, versioneTariffario: origin.versioneTariffario, prezzoUnitario, totale };
  });
  const sum = (tipo: string) => righe.filter((r) => r.tipo === tipo).reduce((n, r) => n.plus(r.totale), decimal("0"));
  const totaleOre = sum("ORE"), totaleMateriali = sum("MATERIALE"), totale = totaleOre.plus(totaleMateriali);
  if (totale.gt("99999999999999.99")) throw new InputError("Il totale supera il limite consentito.");
  if (old && same(old.righe, righe) && old.note === input.note && old.data === input.data) return existing!;
  const data = { data: new Date(`${input.data}T00:00:00Z`), note: input.note || null, righe: json(righe), totaleOre, totaleMateriali, totale, versione: input.versione + 1 };
  const row = existing ? await db.consuntivo.update({ where: { id: existing.id }, data }) : await db.consuntivo.create({ data: { ...data, commessaId, clienteId: job.clienteId } });
  await audit(db, actor, "CONSUNTIVO", row.id, row.versione, old, consuntivoValues(row));
  return row;
}
