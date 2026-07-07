"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { puoGestireAnagrafiche, TITOLI } from "@/lib/enums";
import type { Prisma } from "@/generated/prisma";

export type AnagraficaState = { error?: string } | undefined;

type ReferenteInput = {
  id?: string;
  titolo?: string;
  nome?: string;
  cognome?: string;
  ruoloAzienda?: string;
  email?: string;
  telefono?: string;
  principale?: boolean;
};

type ReferentePulito = {
  id?: string;
  titolo: string;
  nome: string;
  cognome: string;
  ruoloAzienda: string | null;
  email: string | null;
  telefono: string | null;
  principale: boolean;
};

const TITOLI_VALIDI = Object.keys(TITOLI);

/** Prossimo codice progressivo per prefisso C (cliente) o F (fornitore). */
async function nextCodice(
  tx: Prisma.TransactionClient,
  prefix: "C" | "F",
): Promise<string> {
  const field = prefix === "C" ? "codiceCliente" : "codiceFornitore";
  const rows = await tx.anagrafica.findMany({
    where: { NOT: { [field]: null } },
    select: { codiceCliente: true, codiceFornitore: true },
  });
  let max = 0;
  for (const r of rows) {
    const val = prefix === "C" ? r.codiceCliente : r.codiceFornitore;
    if (!val) continue;
    const n = parseInt(val.slice(1), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(4, "0");
}

/** Estrae e normalizza i campi comuni dal FormData. */
function estrai(formData: FormData) {
  const str = (k: string): string | null => {
    const v = String(formData.get(k) ?? "").trim();
    return v.length ? v : null;
  };
  const ragioneSociale = String(formData.get("ragioneSociale") ?? "").trim();
  const isCliente = formData.get("isCliente") === "on";
  const isFornitore = formData.get("isFornitore") === "on";

  let referenti: ReferentePulito[] = [];
  try {
    const raw = JSON.parse(String(formData.get("referenti") ?? "[]"));
    if (Array.isArray(raw)) {
      referenti = (raw as ReferenteInput[])
        .map((r) => ({
          id: r.id || undefined,
          titolo: TITOLI_VALIDI.includes(String(r.titolo))
            ? String(r.titolo)
            : "NESSUNO",
          nome: String(r.nome ?? "").trim(),
          cognome: String(r.cognome ?? "").trim(),
          ruoloAzienda: String(r.ruoloAzienda ?? "").trim() || null,
          email: String(r.email ?? "").trim() || null,
          telefono: String(r.telefono ?? "").trim() || null,
          principale: Boolean(r.principale),
        }))
        .filter((r) => r.nome && r.cognome);
    }
  } catch {
    referenti = [];
  }

  return {
    ragioneSociale,
    isCliente,
    isFornitore,
    referenti,
    campi: {
      partitaIva: str("partitaIva"),
      codiceFiscale: str("codiceFiscale"),
      codiceSDI: str("codiceSDI"),
      indirizzo: str("indirizzo"),
      cap: str("cap"),
      localita: str("localita"),
      provincia: str("provincia"),
      telefono: str("telefono"),
      fax: str("fax"),
      email: str("email"),
      web: str("web"),
      modalitaPagamento: str("modalitaPagamento"),
      prodottiTrattati: str("prodottiTrattati"),
      note: str("note"),
    },
  };
}

export async function createAnagrafica(
  _prev: AnagraficaState,
  formData: FormData,
): Promise<AnagraficaState> {
  const user = await requireUser();
  if (!puoGestireAnagrafiche(user.ruolo)) {
    return { error: "Non hai i permessi per gestire le anagrafiche." };
  }

  const { ragioneSociale, isCliente, isFornitore, referenti, campi } =
    estrai(formData);

  if (!ragioneSociale) return { error: "La ragione sociale è obbligatoria." };
  if (!isCliente && !isFornitore)
    return { error: "Seleziona almeno Cliente o Fornitore." };

  let id: string;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const codiceCliente = isCliente ? await nextCodice(tx, "C") : null;
      const codiceFornitore = isFornitore ? await nextCodice(tx, "F") : null;
      return tx.anagrafica.create({
        data: {
          ragioneSociale,
          isCliente,
          isFornitore,
          codiceCliente,
          codiceFornitore,
          ...campi,
          referenti: {
            create: referenti.map(({ id: _drop, ...r }) => r),
          },
        },
      });
    });
    id = created.id;
  } catch {
    return { error: "Errore nel salvataggio. Riprova." };
  }

  revalidatePath("/anagrafiche");
  revalidatePath("/");
  redirect(`/anagrafiche/${id}`);
}

export async function updateAnagrafica(
  anagraficaId: string,
  _prev: AnagraficaState,
  formData: FormData,
): Promise<AnagraficaState> {
  const user = await requireUser();
  if (!puoGestireAnagrafiche(user.ruolo)) {
    return { error: "Non hai i permessi per gestire le anagrafiche." };
  }

  const { ragioneSociale, isCliente, isFornitore, referenti, campi } =
    estrai(formData);

  if (!ragioneSociale) return { error: "La ragione sociale è obbligatoria." };
  if (!isCliente && !isFornitore)
    return { error: "Seleziona almeno Cliente o Fornitore." };

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.anagrafica.findUnique({
        where: { id: anagraficaId },
        include: { referenti: { select: { id: true } } },
      });
      if (!existing) throw new Error("not-found");

      // I codici non si riassegnano né si cancellano: si aggiungono se mancanti.
      const codiceCliente =
        existing.codiceCliente ?? (isCliente ? await nextCodice(tx, "C") : null);
      const codiceFornitore =
        existing.codiceFornitore ??
        (isFornitore ? await nextCodice(tx, "F") : null);

      await tx.anagrafica.update({
        where: { id: anagraficaId },
        data: {
          ragioneSociale,
          isCliente,
          isFornitore,
          codiceCliente,
          codiceFornitore,
          ...campi,
        },
      });

      // Riconciliazione referenti: aggiorna/crea, elimina i rimossi non
      // referenziati da commesse (per non violare i vincoli FK).
      const incomingIds = new Set(
        referenti.filter((r) => r.id).map((r) => r.id as string),
      );
      const rimossi = existing.referenti
        .map((r) => r.id)
        .filter((id) => !incomingIds.has(id));
      if (rimossi.length) {
        const usati = await tx.commessa.findMany({
          where: { referenteId: { in: rimossi } },
          select: { referenteId: true },
        });
        const usatiSet = new Set(usati.map((c) => c.referenteId));
        const cancellabili = rimossi.filter((id) => !usatiSet.has(id));
        if (cancellabili.length) {
          await tx.referente.deleteMany({ where: { id: { in: cancellabili } } });
        }
      }

      for (const r of referenti) {
        const dati = {
          titolo: r.titolo,
          nome: r.nome,
          cognome: r.cognome,
          ruoloAzienda: r.ruoloAzienda,
          email: r.email,
          telefono: r.telefono,
          principale: r.principale,
        };
        if (r.id) {
          await tx.referente.update({ where: { id: r.id }, data: dati });
        } else {
          await tx.referente.create({
            data: { anagraficaId, ...dati },
          });
        }
      }
    });
  } catch {
    return { error: "Errore nel salvataggio. Riprova." };
  }

  revalidatePath("/anagrafiche");
  revalidatePath(`/anagrafiche/${anagraficaId}`);
  revalidatePath("/");
  redirect(`/anagrafiche/${anagraficaId}`);
}
