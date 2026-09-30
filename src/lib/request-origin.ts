/** Origin canonica in produzione; gli header forwarded non decidono la fiducia. */
export function validRequestOrigin(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return !req.headers.get("cookie");
  try {
    const expected = process.env.APP_ORIGIN ?? new URL(req.url).origin;
    return new URL(origin).origin === expected && origin === new URL(origin).origin;
  } catch { return false; }
}
