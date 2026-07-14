// Fase 8 — Strumenti (tool) dell'assistente. Solo LETTURA in 8A.
//
// La lettura è consentita a ogni utente autenticato (l'endpoint garantisce
// l'autenticazione), coerentemente con le pagine del CRM. Gli strumenti di
// scrittura (creazione/modifica) arriveranno gated dal ruolo dell'utente.

import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toNumber, formatDate } from "@/lib/format";
import { etichettaStato, STATI_COMMESSA_LIST } from "@/lib/enums";
import { winRate } from "@/lib/statistiche";
import { getStatisticheGlobali } from "@/app/(app)/statistiche/data";
import { getStoricoMateriali } from "@/app/(app)/materiali/data";

const nomeCompleto = (u: { nome: string; cognome: string } | null) =>
  u ? `${u.nome} ${u.cognome}` : null;

// I tool devono restituire solo valori JSON-serializzabili: gli oggetti Date
// vanno convertiti in stringa, altrimenti la cronologia della chat non passa
// la validazione dei messaggi al turno successivo.
const dataStr = (d: Date | null | undefined): string | null =>
  d ? formatDate(d) : null;

export function buildReadTools() {
  return {
    cercaCommesse: tool({
      description:
        "Cerca ed elenca commesse per testo (numero, cliente, descrizione) e/o stato. Usa per domande su commesse recenti, per cliente, per stato.",
      inputSchema: z.object({
        testo: z
          .string()
          .optional()
          .describe("Testo libero: parte del numero, del cliente o descrizione"),
        stato: z
          .enum(STATI_COMMESSA_LIST as [string, ...string[]])
          .optional()
          .describe("Filtra per stato commessa"),
        limite: z.number().int().min(1).max(25).optional(),
      }),
      execute: async ({ testo, stato, limite }) => {
        const commesse = await prisma.commessa.findMany({
          orderBy: { createdAt: "desc" },
          include: { cliente: true, pm: true },
        });
        const q = testo?.trim().toLowerCase();
        const filtrate = commesse.filter((c) => {
          if (stato && c.stato !== stato) return false;
          if (!q) return true;
          return (
            c.numero.toLowerCase().includes(q) ||
            c.cliente.ragioneSociale.toLowerCase().includes(q) ||
            (c.descrizione?.toLowerCase().includes(q) ?? false)
          );
        });
        return {
          totale: filtrate.length,
          commesse: filtrate.slice(0, limite ?? 10).map((c) => ({
            numero: c.numero,
            cliente: c.cliente.ragioneSociale,
            stato: etichettaStato(c.stato),
            tipologia: c.tipologia,
            importoOfferta: toNumber(c.importoOfferta),
            importoOrdine: toNumber(c.importoOrdine),
            pm: nomeCompleto(c.pm),
            descrizione: c.descrizione,
          })),
        };
      },
    }),

    dettaglioCommessa: tool({
      description:
        "Dettaglio di una singola commessa dato il suo numero (formato AANNNN), inclusi ordini a fornitore e documenti collegati.",
      inputSchema: z.object({
        numero: z.string().describe("Numero commessa, es. 261041"),
      }),
      execute: async ({ numero }) => {
        const c = await prisma.commessa.findFirst({
          where: { numero: numero.trim() },
          include: {
            cliente: true,
            pm: true,
            referente: true,
            ordiniFornitore: {
              include: { fornitore: true, righe: { select: { imponibile: true } } },
            },
            _count: { select: { documenti: true, ordiniFornitore: true } },
          },
        });
        if (!c) return { trovata: false as const, numero };
        return {
          trovata: true as const,
          numero: c.numero,
          cliente: c.cliente.ragioneSociale,
          stato: etichettaStato(c.stato),
          tipologia: c.tipologia,
          descrizione: c.descrizione,
          pm: nomeCompleto(c.pm),
          importoOfferta: toNumber(c.importoOfferta),
          importoOrdine: toNumber(c.importoOrdine),
          dataInvio: dataStr(c.dataInvio),
          dataOrdine: dataStr(c.dataOrdine),
          nDocumenti: c._count.documenti,
          nOrdiniFornitore: c._count.ordiniFornitore,
          ordiniFornitore: c.ordiniFornitore.map((o) => ({
            numero: o.numero,
            fornitore: o.fornitore.ragioneSociale,
            imponibile: o.righe.reduce((s, r) => s + toNumber(r.imponibile), 0),
          })),
        };
      },
    }),

    cercaAnagrafiche: tool({
      description:
        "Cerca clienti e/o fornitori per ragione sociale, codice, P.IVA o località.",
      inputSchema: z.object({
        testo: z.string().describe("Testo da cercare"),
        tipo: z
          .enum(["cliente", "fornitore", "tutti"])
          .optional()
          .describe("Restringi a clienti o fornitori"),
      }),
      execute: async ({ testo, tipo }) => {
        const anagrafiche = await prisma.anagrafica.findMany({
          include: { _count: { select: { commesse: true } } },
        });
        const q = testo.trim().toLowerCase();
        const filtrate = anagrafiche.filter((a) => {
          if (tipo === "cliente" && !a.isCliente) return false;
          if (tipo === "fornitore" && !a.isFornitore) return false;
          return (
            a.ragioneSociale.toLowerCase().includes(q) ||
            (a.codiceCliente?.toLowerCase().includes(q) ?? false) ||
            (a.codiceFornitore?.toLowerCase().includes(q) ?? false) ||
            (a.partitaIva?.toLowerCase().includes(q) ?? false) ||
            (a.localita?.toLowerCase().includes(q) ?? false)
          );
        });
        return {
          totale: filtrate.length,
          anagrafiche: filtrate.slice(0, 15).map((a) => ({
            ragioneSociale: a.ragioneSociale,
            codiceCliente: a.codiceCliente,
            codiceFornitore: a.codiceFornitore,
            partitaIva: a.partitaIva,
            localita: a.localita,
            nCommesse: a._count.commesse,
          })),
        };
      },
    }),

    statisticheCommerciali: tool({
      description:
        "Statistiche commerciali complessive: tasso di conversione, valore acquisito/in pipeline/perso, clienti principali.",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await getStatisticheGlobali(new Date());
        return {
          commesseTotali: s.totali,
          vinte: s.vinte,
          inAttesa: s.attesa,
          perse: s.perse,
          tassoConversionePct: winRate(s.vinte, s.perse),
          valoreAcquisito: s.valoreAcquisito,
          valoreInPipeline: s.valorePipeline,
          valorePerso: s.valorePerso,
          topClienti: s.topClienti.slice(0, 5).map((c) => ({
            cliente: c.ragioneSociale,
            offerte: c.offerte,
            vinte: c.vinte,
            conversionePct: winRate(c.vinte, c.perse),
            valoreAcquisito: c.valoreAcquisito,
          })),
        };
      },
    }),

    ultimoPrezzoMateriale: tool({
      description:
        "Storico prezzi di acquisto di un materiale: ultimo prezzo pagato, minimo/medio/massimo e fornitore. Usa per domande tipo 'ultimo prezzo del cavo 3x1.5'.",
      inputSchema: z.object({
        descrizione: z
          .string()
          .describe("Descrizione o codice del materiale, es. 'cavo 3x1.5'"),
      }),
      execute: async ({ descrizione }) => {
        const materiali = await getStoricoMateriali(descrizione);
        if (materiali.length === 0)
          return { trovato: false as const, cercato: descrizione };
        return {
          trovato: true as const,
          materiali: materiali.slice(0, 5).map((m) => ({
            descrizione: m.descrizione,
            codice: m.codiceProdotto,
            unitaMisura: m.unitaMisura,
            ultimoPrezzo: m.ultimoPrezzo,
            ultimoFornitore: m.ultimoFornitore,
            ultimaData: dataStr(m.ultimaData),
            prezzoMin: m.prezzoMin,
            prezzoMedio: m.prezzoMedio,
            prezzoMax: m.prezzoMax,
            nAcquisti: m.nAcquisti,
          })),
        };
      },
    }),
  };
}
