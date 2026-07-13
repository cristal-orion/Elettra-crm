// Cifratura simmetrica per segreti applicativi salvati nel DB (es. chiave API
// Gemini). AES-256-GCM con chiave derivata dal SESSION_SECRET: in tabella non
// finisce mai un segreto in chiaro. Formato: "iv:tag:ciphertext" (base64).

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

let cached: Buffer | null = null;

function aesKey(): Buffer {
  if (cached) return cached;
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET mancante: impossibile cifrare i segreti.");
  cached = scryptSync(secret, "elettra-crm-secrets-v1", 32);
  return cached;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivB, tagB, dataB] = payload.split(":");
  if (!ivB || !tagB || !dataB) throw new Error("Formato segreto non valido.");
  const decipher = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
