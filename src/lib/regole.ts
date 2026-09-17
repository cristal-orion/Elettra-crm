// Motore di regole del CRM (flusso §5).
//
// Regola bloccante P → C — la più critica (flusso §5.1):
// una commessa con ordini a fornitore collegati ha materiale già acquistato,
// quindi NON può restare "Preventivo" (P). Il sistema forza la tipologia a
// "Consuntivo" (C) e segnala che la commessa è "da fatturare", eliminando il
// "punto d'ombra" attuale (materiale comprato ma mai fatturato).
//
// La chiave di collegamento è la FK OrdineFornitore.commessaId (più affidabile
// del match sul numero commessa usato oggi nei fogli Excel).

import type { Prisma } from "@/generated/prisma";

/** Client Prisma o transazione: basta l'accesso ai modelli usati qui. */
type Db = Pick<Prisma.TransactionClient, "commessa" | "ordineFornitore">;

/**
 * La commessa ha materiale acquistato? (≥1 ordine a fornitore collegato).
 * Ogni ordine ha per costruzione almeno una riga, quindi la sola presenza
 * dell'ordine implica un acquisto di materiale.
 */
export async function commessaHaAcquisti(
  db: Db,
  commessaId: string,
): Promise<boolean> {
  const n = await db.ordineFornitore.count({ where: { commessaId } });
  return n > 0;
}

/**
 * Tipologia effettiva da salvare applicando la regola P→C: con acquisti a
 * fornitore un "Preventivo" (o una tipologia non ancora indicata) diventa
 * "Consuntivo". A senso unico: non declassa mai C→P.
 *
 * Non toccca "T" (tariffario) e "GARA": sono modalità di fatturazione diverse,
 * non preventivi a corpo, e forzarle a C cancellerebbe un dato reale. L'alert
 * "da fatturare" resta comunque attivo per loro, perché richiedeFatturazione()
 * non guarda la tipologia.
 */
const TIPOLOGIE_DECLASSABILI = new Set([null, "P"]);

export function tipologiaForzata(
  tipologiaRichiesta: string | null,
  haAcquisti: boolean,
): string | null {
  return haAcquisti && TIPOLOGIE_DECLASSABILI.has(tipologiaRichiesta)
    ? "C"
    : tipologiaRichiesta;
}

/**
 * Applica la regola P→C a una commessa già persistita: se ha acquisti e la
 * tipologia non è già "C", la forza a "C". Ritorna true se ha modificato la
 * commessa. Da chiamare dopo aver collegato/aggiornato un ordine a fornitore.
 */
export async function applicaRegolaPC(
  db: Db,
  commessaId: string,
): Promise<boolean> {
  const commessa = await db.commessa.findUnique({
    where: { id: commessaId },
    select: { tipologia: true },
  });
  if (!commessa) return false;

  const haAcquisti = await commessaHaAcquisti(db, commessaId);
  const tipologia = tipologiaForzata(commessa.tipologia, haAcquisti);
  if (tipologia !== commessa.tipologia) {
    await db.commessa.update({
      where: { id: commessaId },
      data: { tipologia },
    });
    return true;
  }
  return false;
}

/**
 * La commessa richiede fatturazione? Ha materiale acquistato ma non è ancora
 * "Fatturata": è il flag che alimenta l'alert "da fatturare" su dettaglio e
 * dashboard.
 */
export function richiedeFatturazione(
  stato: string,
  haAcquisti: boolean,
): boolean {
  return haAcquisti && stato !== "FATTURATA";
}
