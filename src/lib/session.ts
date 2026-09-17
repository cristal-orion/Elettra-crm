import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const COOKIE_NAME = "elettra_session";

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.startsWith("cambiami") || new TextEncoder().encode(secret).length < 32) {
    throw new Error("SESSION_SECRET deve contenere un segreto casuale di almeno 32 byte.");
  }
  return new TextEncoder().encode(secret);
}
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type SessionPayload = {
  userId: string;
  ruolo: string;
  nome: string;
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
      typeof payload.nome !== "string"
    ) return null;
    return {
      userId: payload.userId,
      ruolo: payload.ruolo,
      nome: payload.nome,
    };
  } catch {
    return null;
  }
}

export async function createSession(user: {
  id: string;
  ruolo: string;
  nome: string;
}): Promise<void> {
  const token = await encrypt({
    userId: user.id,
    ruolo: user.ruolo,
    nome: user.nome,
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
