// Archiviazione documenti su filesystem (Fase 4 — documentale).
//
// I file vivono fuori da /public (niente accesso statico anonimo): sono serviti
// da un route handler autenticato. Struttura: <UPLOADS_DIR>/<numeroCommessa>/<file>
// — la "cartella commessa AANNNN/" viene creata automaticamente al primo upload.

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

/** Radice dell'archivio documenti (override con UPLOADS_DIR). */
export const UPLOADS_DIR =
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");

/** Ripulisce un nome file: niente separatori di percorso né caratteri ostili. */
export function sanitizeFilename(name: string): string {
  const senzaPath = name.replace(/[/\\]/g, "_").replace(/\.{2,}/g, ".").trim();
  const cleaned = senzaPath.replace(/[^\p{L}\p{N}._ ()\-]/gu, "_").slice(0, 180);
  return cleaned.length ? cleaned : "file";
}

/**
 * Percorso assoluto a partire da un percorso relativo alla cartella uploads.
 * Blocca i tentativi di path traversal fuori dalla radice.
 */
export function percorsoAssoluto(percorsoRelativo: string): string {
  const abs = path.resolve(UPLOADS_DIR, percorsoRelativo);
  if (abs !== UPLOADS_DIR && !abs.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error("Percorso documento non valido.");
  }
  return abs;
}

/**
 * Salva i byte in <cartella>/<nomeSuDisco>, creando la cartella se manca.
 * Ritorna il percorso relativo da persistere in `Documento.percorso`.
 */
export async function salvaFile(
  cartella: string,
  nomeSuDisco: string,
  data: Buffer,
): Promise<string> {
  const percorsoRelativo = path.join(cartella, nomeSuDisco);
  const abs = percorsoAssoluto(percorsoRelativo);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data);
  return percorsoRelativo;
}

/** Elimina il file dal disco (idempotente: ignora se già assente). */
export async function eliminaFile(percorsoRelativo: string): Promise<void> {
  try {
    await unlink(percorsoAssoluto(percorsoRelativo));
  } catch {
    // file già rimosso o mai scritto: non è un errore per l'utente
  }
}
