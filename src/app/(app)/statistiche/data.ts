import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { classificaEsito, serieMensile } from "@/lib/statistiche";

/**
 * Aggrega tutte le commesse per il cruscotto direzionale.
 * Il volume dati di un CRM è contenuto: si legge una volta e si aggrega in JS,
 * così i calcoli restano identici su SQLite e su PostgreSQL (niente funzioni
 * data-specifiche del DB per il raggruppamento mensile).
 */
export async function getStatisticheGlobali(adesso: Date) {
  const commesse = await prisma.commessa.findMany({
    select: {
      stato: true,
      importoOfferta: true,
      importoOrdine: true,
      dataOrdine: true,
      dataInvio: true,
      createdAt: true,
      clienteId: true,
      cliente: {
        select: { id: true, ragioneSociale: true, codiceCliente: true },
      },
    },
  });

  let vinte = 0;
  let attesa = 0;
  let perse = 0;
  let valoreOfferto = 0; // somma delle offerte (tutte le commesse)
  let valoreAcquisito = 0; // somma degli ordini confermati (vinte)
  let valorePipeline = 0; // offerte ancora in gioco (attesa)
  let valorePerso = 0; // offerte perse

  // Serie temporale del valore acquisito: per le vinte usa la data ordine,
  // con fallback ragionevole se mancante.
  const puntiAcquisito: { data: Date | null; importo: number }[] = [];

  // Aggregazione per cliente.
  type RigaCliente = {
    id: string;
    ragioneSociale: string;
    codiceCliente: string | null;
    offerte: number;
    vinte: number;
    perse: number;
    valoreAcquisito: number;
  };
  const perCliente = new Map<string, RigaCliente>();

  for (const c of commesse) {
    const esito = classificaEsito(c.stato);
    const offerta = toNumber(c.importoOfferta);
    const ordine = toNumber(c.importoOrdine);
    valoreOfferto += offerta;

    if (esito === "VINTA") {
      vinte++;
      valoreAcquisito += ordine;
      puntiAcquisito.push({
        data: c.dataOrdine ?? c.dataInvio ?? c.createdAt,
        importo: ordine,
      });
    } else if (esito === "PERSA") {
      perse++;
      valorePerso += offerta;
    } else {
      attesa++;
      valorePipeline += offerta;
    }

    const riga = perCliente.get(c.clienteId) ?? {
      id: c.cliente.id,
      ragioneSociale: c.cliente.ragioneSociale,
      codiceCliente: c.cliente.codiceCliente,
      offerte: 0,
      vinte: 0,
      perse: 0,
      valoreAcquisito: 0,
    };
    riga.offerte++;
    if (esito === "VINTA") {
      riga.vinte++;
      riga.valoreAcquisito += ordine;
    } else if (esito === "PERSA") {
      riga.perse++;
    }
    perCliente.set(c.clienteId, riga);
  }

  const topClienti = [...perCliente.values()]
    .sort(
      (a, b) => b.valoreAcquisito - a.valoreAcquisito || b.offerte - a.offerte,
    )
    .slice(0, 8);

  return {
    totali: commesse.length,
    vinte,
    attesa,
    perse,
    valoreOfferto,
    valoreAcquisito,
    valorePipeline,
    valorePerso,
    serieAcquisito: serieMensile(puntiAcquisito, adesso, 12),
    topClienti,
    clientiConCommesse: perCliente.size,
  };
}
