import { prisma } from "@/lib/prisma";
import { getStoricoMateriali, type MaterialeStorico } from "./data";

/** Elenco prodotti a catalogo, con filtro testo su descrizione/codice/marca. */
export async function getProdotti(q?: string) {
  const prodotti = await prisma.prodotto.findMany({
    orderBy: { descrizione: "asc" },
    include: { _count: { select: { righeOrdine: true } } },
  });
  const query = q?.trim().toLowerCase();
  if (!query) return prodotti;
  return prodotti.filter(
    (p) =>
      p.descrizione.toLowerCase().includes(query) ||
      (p.codice?.toLowerCase().includes(query) ?? false) ||
      (p.marca?.toLowerCase().includes(query) ?? false) ||
      (p.categoria?.toLowerCase().includes(query) ?? false),
  );
}

/**
 * Dettaglio prodotto + storico prezzi agganciato: cerca gli acquisti reali
 * (righe d'ordine) per codice se presente, altrimenti per descrizione. Il match
 * finale usa la stessa chiave di aggregazione dello storico prezzi.
 */
export async function getProdottoConStorico(id: string): Promise<{
  prodotto: Awaited<ReturnType<typeof prisma.prodotto.findUnique>>;
  storico: MaterialeStorico | null;
}> {
  const prodotto = await prisma.prodotto.findUnique({ where: { id } });
  if (!prodotto) return { prodotto: null, storico: null };

  // Cerca nello storico per codice (più preciso) o descrizione.
  const chiaveRicerca = prodotto.codice ?? prodotto.descrizione;
  const materiali = await getStoricoMateriali(chiaveRicerca);

  // Aggancio: se il prodotto ha un codice, match sul codice; altrimenti sulla
  // descrizione normalizzata (case-insensitive, spazi collassati).
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const storico =
    materiali.find((m) =>
      prodotto.codice
        ? m.codiceProdotto?.toUpperCase() === prodotto.codice.toUpperCase()
        : norm(m.descrizione) === norm(prodotto.descrizione),
    ) ?? null;

  return { prodotto, storico };
}
