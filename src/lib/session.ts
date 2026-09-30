import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { requiredSecret } from "./runtime-config";

export const COOKIE_NAME = "elettra_session";

function sessionKey(): Uint8Array {
  const secret = requiredSecret("SESSION_SECRET");
  return new TextEncoder().encode(secret);
}
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type SessionPayload = {
  userId: string;
  ruolo: string;
  nome: string;
  sessionVersion?: number;
};

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(sessionKey());
}

export async function decrypt(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      algorithms: ["HS256"],
      requiredClaims: ["exp", "iat"],
    });
    if (
      typeof payload.userId !== "string" || !payload.userId ||
      typeof payload.ruolo !== "string" || !payload.ruolo ||
      typeof payload.nome !== "string" ||
      (payload.sessionVersion !== undefined && (!Number.isSafeInteger(payload.sessionVersion) || Number(payload.sessionVersion) < 0))
    ) return null;
    return {
      userId: payload.userId,
      ruolo: payload.ruolo,
      nome: payload.nome,
      ...(payload.sessionVersion !== undefined ? { sessionVersion: Number(payload.sessionVersion) } : {}),
    };
  } catch {
    return null;
  }
}

export async function createSession(user: {
  id: string;
  ruolo: string;
  nome: string;
  sessionVersion: number;
}): Promise<void> {
  const token = await encrypt({
    userId: user.id,
    ruolo: user.ruolo,
    nome: user.nome,
    sessionVersion: user.sessionVersion,
  });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return decrypt(token);
}
