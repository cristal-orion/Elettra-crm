import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";

// Storico prezzi materiali (flusso §5.2): derivato dalle righe d'ordine a
// fornitore. Non esiste (ancora) un catalogo Prodotto collegato: i materiali
// sono identificati dal codice prodotto — o, in mancanza, dalla descrizione
// normalizzata — esattamente come nell'"Elenco Analitico Ordini Fornitori".

export type AcquistoStorico = {
  ordineId: string;
  numeroOrdine: string | null;
  data: Date;
  fornitore: string;
  commessaId: string | null;
  commessaNumero: string | null;
  quantita: number;
  unitaMisura: string | null;
  prezzoUnitario: number;
  sconto: number | null;
  /** Prezzo unitario al netto dello sconto: il prezzo davvero pagato. */
  prezzoNetto: number;
};

export type MaterialeStorico = {
  key: string;
  descrizione: string;
  codiceProdotto: string | null;
  unitaMisura: string | null;
  nAcquisti: number;
  ultimaData: Date;
  ultimoPrezzo: number;
  ultimoFornitore: string;
  prezzoMin: number;
  prezzoMax: number;
  prezzoMedio: number;
  acquisti: AcquistoStorico[];
};

function normalizza(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Chiave d'aggregazione: codice prodotto se presente, altrimenti descrizione. */
function chiaveMateriale(codice: string | null, descrizione: string, unita: string | null, prodottoId: string | null): string {
  const c = codice?.trim().toUpperCase();
  const prodotto = prodottoId ? `P:${prodottoId}` : c ? `C:${c}` : `D:${normalizza(descrizione)}`;
  return `${prodotto}|UM:${normalizza(unita ?? "non indicata")}`;
}

type Accumulatore = {
  acquisti: AcquistoStorico[];
  descrizione: string;
  codiceProdotto: string | null;
  unitaMisura: string | null;
  ultimaData: Date;
};

/**
 * Ritorna lo storico prezzi aggregato per materiale, ordinato per acquisto più
 * recente. Con `q` filtra per descrizione o codice (case-insensitive: SQLite
 * non supporta la ricerca insensitive di Prisma, quindi filtriamo in memoria —
 * il volume delle righe d'ordine è contenuto).
 */
export async function getStoricoMateriali(
  q?: string,
): Promise<MaterialeStorico[]> {
  const righe = await prisma.rigaOrdineFornitore.findMany({
    include: {
      ordine: {
        select: {
          id: true,
          numero: true,
          data: true,
          fornitore: { select: { ragioneSociale: true } },
          commessa: { select: { id: true, numero: true } },
        },
      },
    },
  });

  const gruppi = new Map<string, Accumulatore>();

  for (const r of righe) {
    const key = chiaveMateriale(r.codiceProdotto, r.descrizione, r.unitaMisura, r.prodottoId);
    const prezzoUnitario = toNumber(r.prezzoUnitario);
    const sconto = r.sconto === null ? null : toNumber(r.sconto);
    const netto = prezzoUnitario * (1 - (sconto ?? 0) / 100);

    const acquisto: AcquistoStorico = {
      ordineId: r.ordine.id,
      numeroOrdine: r.ordine.numero,
      data: r.ordine.data,
      fornitore: r.ordine.fornitore.ragioneSociale,
      commessaId: r.ordine.commessa?.id ?? null,
      commessaNumero: r.ordine.commessa?.numero ?? null,
      quantita: toNumber(r.quantita),
      unitaMisura: r.unitaMisura,
      prezzoUnitario,
      sconto,
      prezzoNetto: Math.round((netto + Number.EPSILON) * 10000) / 10000,
    };

    const acc = gruppi.get(key);
    if (!acc) {
      gruppi.set(key, {
        acquisti: [acquisto],
        descrizione: r.descrizione,
        codiceProdotto: r.codiceProdotto,
        unitaMisura: r.unitaMisura,
        ultimaData: r.ordine.data,
      });
    } else {
      acc.acquisti.push(acquisto);
      // Il "rappresentante" del gruppo (descrizione/codice/UM) è la riga più
      // recente, così l'etichetta riflette l'ultimo dato inserito.
      if (r.ordine.data >= acc.ultimaData) {
        acc.ultimaData = r.ordine.data;
        acc.descrizione = r.descrizione;
        if (r.codiceProdotto) acc.codiceProdotto = r.codiceProdotto;
        if (r.unitaMisura) acc.unitaMisura = r.unitaMisura;
      }
    }
  }

  let materiali: MaterialeStorico[] = [];
  for (const [key, acc] of gruppi) {
    const acquisti = acc.acquisti.sort(
      (a, b) => b.data.getTime() - a.data.getTime(),
    );
    const prezzi = acquisti.map((a) => a.prezzoNetto);
    const ultimo = acquisti[0];
    materiali.push({
      key,
      descrizione: acc.descrizione,
      codiceProdotto: acc.codiceProdotto,
      unitaMisura: acc.unitaMisura,
      nAcquisti: acquisti.length,
      ultimaData: ultimo.data,
      ultimoPrezzo: ultimo.prezzoNetto,
      ultimoFornitore: ultimo.fornitore,
      prezzoMin: Math.min(...prezzi),
      prezzoMax: Math.max(...prezzi),
      prezzoMedio: prezzi.reduce((s, p) => s + p, 0) / prezzi.length,
      acquisti,
    });
  }

  const query = q?.trim().toLowerCase();
  if (query) {
    materiali = materiali.filter(
      (m) =>
        m.descrizione.toLowerCase().includes(query) ||
        (m.codiceProdotto?.toLowerCase().includes(query) ?? false),
    );
  }

  materiali.sort((a, b) => b.ultimaData.getTime() - a.ultimaData.getTime());
  return materiali;
}
