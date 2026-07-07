import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/session";

// Rotte pubbliche (accessibili senza sessione).
const PUBLIC_PATHS = ["/login"];

// Controllo ottimistico basato sulla sola presenza del cookie di sessione.
// La verifica effettiva (validità token + utente attivo) avviene nel DAL.
export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(COOKIE_NAME)?.value);
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Esclude API, asset statici e immagini così da non bloccare CSS/JS/immagini.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
