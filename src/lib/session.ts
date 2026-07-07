import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const COOKIE_NAME = "elettra_session";

const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET);
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
    .sign(encodedKey);
}

export async function decrypt(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    if (!payload.userId) return null;
    return {
      userId: String(payload.userId),
      ruolo: String(payload.ruolo),
      nome: String(payload.nome),
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
