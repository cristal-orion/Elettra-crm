import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/session";

// Rotte pubbliche (accessibili senza sessione).
const PUBLIC_PATHS = ["/login"];

// Controllo ottimistico basato sulla sola presenza del cookie di sessione.
// La verifica effettiva (validità token + utente attivo) avviene nel DAL.
export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
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
  return NextResponse.next();
}

export const config = {
  // Esclude API, asset statici e immagini così da non bloccare CSS/JS/immagini.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
