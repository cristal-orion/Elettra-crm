// I MIME degli upload provengono dal client: solo una lista esplicita può
// abilitare l'apertura inline, mai un generico startsWith("image/").
const INLINE_MIME = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp",
  "image/avif", "image/heic", "image/heif", "image/bmp",
]);

export function downloadHeaders(nome: string, mime: string | null, size: number) {
  const type = mime?.trim().toLowerCase() ?? "";
  const inline = INLINE_MIME.has(type);
  return {
    "Content-Type": inline ? type : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(nome)}`,
    "Content-Length": String(size),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
  };
}
