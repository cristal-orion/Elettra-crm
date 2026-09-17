import { z } from "zod";
import { CrmError, publicError } from "../crm/commands";

export class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
async function readBytes(req: Request, maxBytes: number): Promise<Buffer> {
  const origin = req.headers.get("origin");
  if (origin) {
    let host: string;
    try { host = new URL(origin).host; } catch { throw new ApiError("Origine della richiesta non valida.", 403); }
    if (host !== (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host)) throw new ApiError("Origine della richiesta non valida.", 403);
  }
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError("Richiesta vuota.");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) { await reader.cancel(); throw new ApiError("Richiesta troppo grande.", 413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  if (!req.headers.get("content-type")?.includes("application/json")) throw new ApiError("È richiesto un corpo JSON.");
  const bytes = await readBytes(req, maxBytes);
  try { return JSON.parse(bytes.toString("utf8")); }
  catch { throw new ApiError("JSON non valido."); }
}
export async function readFormData(req: Request, maxBytes = 21 * 1024 * 1024) {
  const bytes = await readBytes(req, maxBytes);
  try { return await new Response(new Uint8Array(bytes), { headers: { "Content-Type": req.headers.get("content-type") ?? "" } }).formData(); }
  catch { throw new ApiError("Modulo non valido."); }
}
export function apiError(e: unknown) {
  const status = e instanceof ApiError ? e.status : e instanceof CrmError ? ({ UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, RATE_LIMIT: 429 }[e.code] ?? 400) : e instanceof z.ZodError ? 400 : 500;
  return Response.json({ error: e instanceof ApiError ? e.message : publicError(e) }, { status });
}
export const ContextSchema = z.object({ type: z.enum(["commessa", "progetto", "cliente"]), id: z.string().min(1).max(100) });
export type AiContext = z.infer<typeof ContextSchema>;
