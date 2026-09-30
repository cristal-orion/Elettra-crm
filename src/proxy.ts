import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/session";
import { validRequestOrigin } from "@/lib/request-origin";

// Rotte pubbliche (accessibili senza sessione).
const PUBLIC_PATHS = ["/login"];

// Controllo ottimistico basato sulla sola presenza del cookie di sessione.
// La verifica effettiva (validità token + utente attivo) avviene nel DAL.
export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !validRequestOrigin(req)) return new NextResponse("Origine non valida", { status: 403 });
  // Le API applicano l'autenticazione nel route handler e restituiscono JSON/401.
  if (pathname === "/assistente/api" || pathname.startsWith("/assistente/api/") || pathname === "/materiali/estrai") return NextResponse.next();
  const hasSession = Boolean(req.cookies.get(COOKIE_NAME)?.value);
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  // Il cookie può essere scaduto o appartenere a un utente disattivato.
  // Solo la pagina login, dopo la verifica nel DAL, può rimandare alla home.
  // Next.js applica il nonce agli script del render dinamico (anche hydration).
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' blob: data:", "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`, "object-src 'none'", "base-uri 'self'",
    "form-action 'self'", "frame-ancestors 'none'", "frame-src 'self' blob:",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Esclude API, asset statici e immagini così da non bloccare CSS/JS/immagini.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
