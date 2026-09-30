import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { validateRuntime } from "./runtime-config";
import { encryptSecret, decryptSecret } from "./secrets";
import { validRequestOrigin } from "./request-origin";
import { passwordError } from "./password";

const original = { session: process.env.SESSION_SECRET, data: process.env.DATA_ENCRYPTION_SECRET, origin: process.env.APP_ORIGIN };
afterEach(() => {
  for (const [key, value] of [["SESSION_SECRET", original.session], ["DATA_ENCRYPTION_SECRET", original.data], ["APP_ORIGIN", original.origin]]) {
    if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
  }
});
test("produzione: blocca SQLite, segreti deboli, HTTP, upload relativi e seed automatico", () => {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production", DATABASE_URL: "postgresql://user:password@db:5432/elettra", SESSION_SECRET: "a".repeat(32), DATA_ENCRYPTION_SECRET: "b".repeat(32), APP_ORIGIN: "https://crm.example.test", UPLOADS_DIR: "/data/uploads" };
  assert.doesNotThrow(() => validateRuntime(env));
  for (const invalid of [{ DATABASE_URL: "file:/data/elettra.db" }, { SESSION_SECRET: "short" }, { DATA_ENCRYPTION_SECRET: "short" }, { APP_ORIGIN: "http://crm.example.test" }, { APP_ORIGIN: "https://crm.example.test/" }, { UPLOADS_DIR: "uploads" }, { SEED_ON_FIRST_BOOT: "true" }]) {
    assert.throws(() => validateRuntime({ ...env, ...invalid }));
  }
});
test("cifratura: legacy leggibile, nuova chiave indipendente dalla firma sessioni e manomissioni rifiutate", () => {
  process.env.SESSION_SECRET = "original-session-secret-at-least-32-bytes";
  delete process.env.DATA_ENCRYPTION_SECRET;
  const legacy = encryptSecret("legacy-api-key");
  process.env.DATA_ENCRYPTION_SECRET = "independent-data-key-at-least-32-bytes";
  assert.equal(decryptSecret(legacy), "legacy-api-key");
  const modern = encryptSecret("new-api-key");
  assert.ok(modern.startsWith("v2:"));
  process.env.SESSION_SECRET = "rotated-session-secret-at-least-32-bytes";
  assert.equal(decryptSecret(modern), "new-api-key");
  assert.throws(() => decryptSecret(legacy));
  const parts = modern.split(":");
  parts[3] = Buffer.from("tampered").toString("base64");
  assert.throws(() => decryptSecret(parts.join(":")));
});
test("CSRF: origine canonica, forwarded spoof, cookie senza Origin e Fetch Metadata", () => {
  process.env.APP_ORIGIN = "https://crm.example.test";
  const req = (headers: Record<string, string>) => new Request("http://internal:3000/assistente/api", { method: "POST", headers });
  assert.equal(validRequestOrigin(req({ origin: process.env.APP_ORIGIN })), true);
  assert.equal(validRequestOrigin(req({ origin: "https://evil.test", "x-forwarded-host": "evil.test" })), false);
  assert.equal(validRequestOrigin(req({ cookie: "elettra_session=token" })), false);
  assert.equal(validRequestOrigin(req({ origin: process.env.APP_ORIGIN, "sec-fetch-site": "cross-site" })), false);
});
test("password: rifiuta password corte e troncamento bcrypt anche con Unicode", () => {
  assert.equal(passwordError("correct-horse-battery"), null);
  assert.ok(passwordError("short"));
  assert.ok(passwordError("a".repeat(73)));
  assert.ok(passwordError("😀".repeat(19)));
});
