import { Prisma } from "@/generated/prisma";
import { classificaEsito } from "@/lib/statistiche";

type Importo = Prisma.Decimal | string | number;

export type CommessaEconomicsInput = {
  id: string;
  stato: string;
  importoOrdine: Importo | null;
  ordiniFornitore: { righe: { imponibile: Importo }[] }[];
};

/**
 * Valori degli ordini, non movimenti di cassa. I costi comprendono tutti gli
 * acquisti collegati, anche su commesse perse o ancora in attesa. Gli importi
 * mancanti sulle commesse acquisite rendono il margine non determinabile.
 * Decimal conserva la precisione dei valori monetari durante le somme.
 */
export function calcolaEconomics(commesse: CommessaEconomicsInput[]) {
  let entrate = new Prisma.Decimal(0);
  let uscite = new Prisma.Decimal(0);
  let importiMancanti = 0;
  let commesseAcquisite = 0;
  let ordiniAcquisto = 0;

  const dettaglio = commesse.map((c) => {
    const acquisita = classificaEsito(c.stato) === "VINTA";
    const importoMancante = acquisita && c.importoOrdine === null;
    const ricavi = new Prisma.Decimal(acquisita ? (c.importoOrdine ?? 0) : 0);
    const costi = c.ordiniFornitore.reduce(
      (totale, ordine) => ordine.righe.reduce(
        (somma, riga) => somma.plus(riga.imponibile),
        totale,
      ),
      new Prisma.Decimal(0),
    );

    entrate = entrate.plus(ricavi);
    uscite = uscite.plus(costi);
    if (importoMancante) importiMancanti++;
    if (acquisita) commesseAcquisite++;
    ordiniAcquisto += c.ordiniFornitore.length;

    return {
      id: c.id,
      entrate: importoMancante ? null : ricavi.toFixed(2),
      uscite: costi.toFixed(2),
      margine: importoMancante ? null : ricavi.minus(costi).toFixed(2),
    };
  });

  const margine = entrate.minus(uscite);
  return {
    entrate: entrate.toFixed(2),
    uscite: uscite.toFixed(2),
    margine: importiMancanti ? null : margine.toFixed(2),
    marginePercentuale: !importiMancanti && entrate.greaterThan(0)
      ? margine.dividedBy(entrate).times(100).toDecimalPlaces(1).toNumber()
      : null,
    importiMancanti,
    commesseAcquisite,
    ordiniAcquisto,
    dettaglio,
  };
}

export type EconomicsCliente = ReturnType<typeof calcolaEconomics>;
