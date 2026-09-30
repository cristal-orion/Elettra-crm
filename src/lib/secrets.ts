// Cifratura simmetrica per segreti applicativi salvati nel DB (es. chiave API
// Gemini). AES-256-GCM con DATA_ENCRYPTION_SECRET per i nuovi valori (v2).
// I valori legacy restano leggibili con SESSION_SECRET fino alla ricifratura.
// Formato v2: "v2:iv:tag:ciphertext" (base64), nessun segreto in chiaro in tabella.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { requiredSecret } from "./runtime-config";

function aesKey(legacy = false): Buffer {
  const name = !legacy && process.env.DATA_ENCRYPTION_SECRET ? "DATA_ENCRYPTION_SECRET" : "SESSION_SECRET";
  return scryptSync(requiredSecret(name), "elettra-crm-secrets-v1", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
  return process.env.DATA_ENCRYPTION_SECRET ? `v2:${payload}` : payload;
}

export function decryptSecret(payload: string): string {
  const v2 = payload.startsWith("v2:");
  if (v2 && !process.env.DATA_ENCRYPTION_SECRET) throw new Error("DATA_ENCRYPTION_SECRET mancante.");
  const [ivB, tagB, dataB] = (v2 ? payload.slice(3) : payload).split(":");
  if (!ivB || !tagB || !dataB) throw new Error("Formato segreto non valido.");
  const decipher = createDecipheriv("aes-256-gcm", aesKey(!v2), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
