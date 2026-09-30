import { access, mkdir, constants } from "node:fs/promises";
import { validateRuntime } from "../src/lib/runtime-config";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  validateRuntime();
  const uploads = process.env.UPLOADS_DIR ?? "uploads";
  await mkdir(uploads, { recursive: true, mode: 0o700 });
  await access(uploads, constants.R_OK | constants.W_OK);
}
main().catch(() => {
  console.error("Configurazione non valida: verificare DATABASE_URL, SESSION_SECRET, DATA_ENCRYPTION_SECRET, APP_ORIGIN HTTPS, UPLOADS_DIR scrivibile e seed automatico disabilitato.");
  process.exitCode = 1;
});
