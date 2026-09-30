import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { requiredSecret } from "./runtime-config";

const WINDOW_MS = 15 * 60_000;
// Anche gli utenti inesistenti passano da bcrypt: nessuna risposta anticipata.
let dummyHash: Promise<string> | undefined;
export async function verifyPassword(password: string, hash?: string) {
  dummyHash ??= bcrypt.hash("elettra-dummy-password-not-an-account", 12);
  return bcrypt.compare(password, hash ?? await dummyHash);
}
export async function allowLogin(email: string, now = new Date()): Promise<boolean> {
  const key = createHmac("sha256", requiredSecret("SESSION_SECRET")).update(`login:${email.toLowerCase()}`).digest("hex");
  const cutoff = new Date(now.getTime() - WINDOW_MS);
  return prisma.$transaction(async (tx) => {
    async function consume(bucket: string, limit: number) {
      const [row] = await tx.$queryRaw<{ attempts: number }[]>`
        INSERT INTO "LoginRateLimit" ("key", "attempts", "windowStartedAt") VALUES (${bucket}, 1, ${now})
        ON CONFLICT ("key") DO UPDATE SET
          "attempts" = CASE WHEN "LoginRateLimit"."windowStartedAt" <= ${cutoff} THEN 1 ELSE LEAST("LoginRateLimit"."attempts" + 1, ${limit + 1}) END,
          "windowStartedAt" = CASE WHEN "LoginRateLimit"."windowStartedAt" <= ${cutoff} THEN ${now} ELSE "LoginRateLimit"."windowStartedAt" END
        RETURNING "attempts"`;
      return row.attempts <= limit;
    }
    // Limite globale: limita anche email casuali, lavoro bcrypt e crescita tabella.
    if (!await consume("global", 200)) return false;
    await tx.loginRateLimit.deleteMany({ where: { windowStartedAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } } });
    return consume(key, 10);
  });
}
