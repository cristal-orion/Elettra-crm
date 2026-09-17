import { z } from "zod";

/** Solo questi errori di dominio possono essere mostrati al client. */
export class InputError extends Error {}

export function parseJsonField<T extends z.ZodType>(
  value: FormDataEntryValue | null,
  schema: T,
): { success: true; data: z.output<T> } | { success: false; error: string } {
  let raw: unknown;
  try {
    if (typeof value !== "string") return { success: false, error: "Dati mancanti o non validi. Ricarica il modulo." };
    raw = JSON.parse(value);
  } catch {
    return { success: false, error: "Dati non validi. Ricarica il modulo." };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const index = issue?.path[0];
    const prefix = typeof index === "number" ? `Riga ${index + 1}: ` : "";
    return { success: false, error: prefix + (issue?.message ?? "Dati non validi.") };
  }
  return { success: true, data: parsed.data };
}

export const testoOpzionale = z.string().trim().nullish().transform((v) => v || null);

/** Accetta il formato dei campi HTML date, senza normalizzare date impossibili. */
export const dataOpzionale = z.union([z.literal(""), z.iso.date()])
  .nullish().transform((v) => v ? new Date(`${v}T00:00:00.000Z`) : null);

export function numeroOpzionale(label: string, max = Number.MAX_SAFE_INTEGER) {
  return z.union([z.string(), z.number()]).nullish()
    .transform((v) => {
      if (v == null || (typeof v === "string" && !v.trim())) return null;
      return typeof v === "number" ? v : Number(v.trim().replace(",", "."));
    })
    .pipe(z.number({ message: `${label}: inserisci un numero valido.` })
      .min(0, `${label}: il valore non può essere negativo.`)
      .max(max, `${label}: valore troppo grande (massimo ${max}).`).nullable());
}

export function idsUnivoci(rows: { id?: string }[]): boolean {
  const ids = rows.flatMap((r) => r.id ? [r.id] : []);
  return new Set(ids).size === ids.length;
}
