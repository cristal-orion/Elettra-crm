import path from "node:path";

export function requiredSecret(name: string, env = process.env): string {
  const secret = env[name];
  if (!secret || /^(cambiami|change.?me|example)/i.test(secret) || new TextEncoder().encode(secret).length < 32) {
    throw new Error(`${name} deve contenere un segreto casuale di almeno 32 byte.`);
  }
  return secret;
}

export function validateRuntime(env = process.env) {
  if (!env.DATABASE_URL || !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) throw new Error("DATABASE_URL PostgreSQL obbligatoria.");
  const db = new URL(env.DATABASE_URL);
  if (!db.hostname || !db.pathname.slice(1) || !db.username || !db.password) throw new Error("DATABASE_URL incompleta.");
  requiredSecret("SESSION_SECRET", env);
  if (env.NODE_ENV === "production") {
    requiredSecret("DATA_ENCRYPTION_SECRET", env);
    const origin = new URL(env.APP_ORIGIN ?? "");
    if (origin.protocol !== "https:" || origin.origin !== env.APP_ORIGIN || origin.username || origin.password) throw new Error("APP_ORIGIN deve essere l'origine HTTPS pubblica, senza percorso o slash finale.");
    if (!env.UPLOADS_DIR || !path.isAbsolute(env.UPLOADS_DIR)) throw new Error("UPLOADS_DIR assoluta obbligatoria in produzione.");
    if (env.SEED_ON_FIRST_BOOT && env.SEED_ON_FIRST_BOOT !== "false") throw new Error("Seed automatico disabilitato: usare il bootstrap esplicito.");
  }
}
