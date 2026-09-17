"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/dal";
import { publicError, runCommand } from "@/lib/crm/commands";

export type ProgettoState = { error?: string; ok?: string } | undefined;
const value = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const version = (f: FormData) => value(f, "expectedUpdatedAt") ?? undefined;

async function save(command: unknown): Promise<ProgettoState> {
  const user = await requireUser();
  try {
    const result = await runCommand(user.id, command);
    revalidatePath("/", "layout");
    return { ok: result.message };
  } catch (e) { return { error: publicError(e) }; }
}
async function quick(command: unknown) {
  const result = await save(command);
  if (result?.error) throw new Error(result.error);
}
export async function updatePianificazione(id: string, _prev: ProgettoState, f: FormData) {
  return save({ type: "pianificaProgetto", id, expectedUpdatedAt: version(f), data: Object.fromEntries(["dataInizioLavori", "scadenzaLavori", "dataFineLavori", "noteCantiere"].map((k) => [k, value(f, k)])) });
}
export async function createMilestone(commessaId: string, _prev: ProgettoState, f: FormData) {
  return save({ type: "creaMilestone", commessaId, milestone: [{ titolo: value(f, "titolo"), dataPianificata: value(f, "dataPianificata"), note: value(f, "note") }] });
}
export async function updateMilestone(id: string, _prev: ProgettoState, f: FormData) {
  return save({ type: "aggiornaMilestone", id, expectedUpdatedAt: version(f), data: Object.fromEntries(["titolo", "stato", "dataPianificata", "dataEffettiva", "note"].map((k) => [k, value(f, k)])) });
}
export async function setStatoMilestone(id: string, f: FormData): Promise<void> {
  return quick({ type: "aggiornaMilestone", id, expectedUpdatedAt: version(f), data: { stato: value(f, "stato") } });
}
export async function deleteMilestone(id: string, f: FormData): Promise<void> {
  return quick({ type: "eliminaMilestone", id, expectedUpdatedAt: version(f) });
}
export async function spostaMilestone(id: string, direzione: "su" | "giu", f: FormData): Promise<void> {
  return quick({ type: "spostaMilestone", id, direzione, expectedUpdatedAt: version(f) });
}
export async function assegnaOperaio(commessaId: string, _prev: ProgettoState, f: FormData) {
  return save({ type: "assegnaOperaio", commessaId, ...Object.fromEntries(["operaioId", "ruoloCantiere", "dal", "al", "note"].map((k) => [k, value(f, k)])) });
}
export async function rimuoviAssegnazione(id: string, _f: FormData): Promise<void> {
  return quick({ type: "rimuoviAssegnazione", id });
}
