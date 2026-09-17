import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { SignJWT } from "jose";
import { decrypt, encrypt } from "./session";

const originalSecret = process.env.SESSION_SECRET;
afterEach(() => {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSecret;
});

test("sessioni: firma valida, scadenza, manomissioni e validazione dei claim", async () => {
  const secret = "session-test-key-with-at-least-32-bytes";
  process.env.SESSION_SECRET = secret;
  const user = { userId: "u1", ruolo: "BACKOFFICE", nome: "Mario" };
  assert.deepEqual(await decrypt(await encrypt(user)), user);
  assert.equal(await decrypt(), null);
  assert.equal(await decrypt("token-non-valido"), null);

  const sign = (payload: Record<string, unknown>, expiration?: string) => {
    let jwt = new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt();
    if (expiration) jwt = jwt.setExpirationTime(expiration);
    return jwt.sign(new TextEncoder().encode(secret));
  };
  assert.equal(await decrypt(await sign(user, "-1s")), null);
  assert.equal(await decrypt(await sign(user)), null);
  assert.equal(await decrypt(await sign({ ...user, userId: 123 }, "7d")), null);
  const token = await encrypt(user);
  process.env.SESSION_SECRET = "another-session-test-key-at-least-32-bytes";
  assert.equal(await decrypt(token), null);
});

test("sessioni: non firma con secret assente, corto o di esempio", async () => {
  for (const secret of [undefined, "", "troppo-corto", "cambiami-genera-con-openssl-rand-base64-32"]) {
    if (secret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = secret;
    await assert.rejects(encrypt({ userId: "u1", ruolo: "SUPER_ADMIN", nome: "Admin" }), /SESSION_SECRET/);
  }
});
