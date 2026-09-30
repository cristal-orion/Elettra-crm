/** Prova Docker reale e restore; usa esclusivamente il cluster locale di compose.yaml. */
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { SignJWT } from "jose";
import { PrismaClient } from "../src/generated/prisma";

const docker = (args: string[], env = process.env) => execFileSync("docker", args, { env, encoding: "utf8", stdio: "pipe" }).trim();
test("provisioning PostgreSQL: ruolo applicativo non superuser, migrazioni consentite", { timeout: 60_000 }, async () => {
  const container = `elettra-provision-${randomUUID().replaceAll("-", "")}`;
  const env = { ...process.env, POSTGRES_PASSWORD: randomBytes(24).toString("base64"), POSTGRES_APP_PASSWORD: randomBytes(24).toString("base64") };
  try {
    docker(["run", "-d", "--name", container, "--network", "elettra-crm_default", "-e", "POSTGRES_PASSWORD", "-e", "POSTGRES_APP_PASSWORD", "-e", "POSTGRES_DB=elettra", "--mount", `type=bind,src=${path.resolve("ops/init-postgres.sh")},dst=/docker-entrypoint-initdb.d/10-elettra.sh,readonly`, "postgres:16-alpine"], env);
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        const flags = docker(["exec", container, "psql", "-U", "postgres", "-d", "elettra", "-At", "-c", "SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname='elettra'"]);
        if (flags === "f|f|f|f") { ready = true; break; }
      } catch { /* provisioning */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.equal(ready, true);
    const DATABASE_URL = `postgresql://elettra:${encodeURIComponent(env.POSTGRES_APP_PASSWORD)}@${container}:5432/elettra`;
    docker(["run", "--rm", "--network", "elettra-crm_default", "-e", "DATABASE_URL", "--entrypoint", "node_modules/.bin/prisma", "elettra-crm:production", "migrate", "deploy"], { ...env, DATABASE_URL });
    assert.equal(docker(["exec", container, "psql", "-U", "elettra", "-d", "elettra", "-At", "-c", 'SELECT count(*) FROM "User"']), "0");
    assert.throws(() => docker(["exec", container, "psql", "-U", "elettra", "-d", "elettra", "-v", "ON_ERROR_STOP=1", "-c", "CREATE DATABASE forbidden"]));
  } finally {
    try { docker(["rm", "-f", "-v", container]); } catch { /* not created */ }
  }
});
test("Docker produzione: non-root, bootstrap, CSP, revoca sessioni, backup e restore integrali", { timeout: 120_000 }, async (t) => {
  const suffix = randomUUID().replaceAll("-", "");
  const name = `ops_${suffix}`;
  const restoredName = `restore_${suffix}`;
  const container = `elettra-ops-${suffix}`;
  const cluster = "elettra-crm-db-1";
  const network = "elettra-crm_default";
  const hostUrl = `postgresql://elettra:elettra-local-only@127.0.0.1:55432/${name}`;
  const internalUrl = `postgresql://elettra:elettra-local-only@db:5432/${name}`;
  const restoredUrl = `postgresql://elettra:elettra-local-only@db:5432/${restoredName}`;
  const dir = await mkdtemp(path.join(tmpdir(), "elettra-ops-"));
  const data = path.join(dir, "data"), backups = path.join(dir, "backups"), restored = path.join(dir, "restored");
  const env = { ...process.env, DATABASE_URL: internalUrl, SESSION_SECRET: randomBytes(32).toString("base64"), DATA_ENCRYPTION_SECRET: randomBytes(32).toString("base64"), APP_ORIGIN: "https://crm.example.test", ADMIN_EMAIL: "admin@example.test", ADMIN_PASSWORD: randomBytes(18).toString("base64"), BACKUP_DATABASE_URL: internalUrl, RESTORE_DATABASE_URL: restoredUrl };
  const db = new PrismaClient({ datasourceUrl: hostUrl });
  const target = new PrismaClient({ datasourceUrl: hostUrl.replace(name, restoredName) });
  let running = false;
  try {
    await mkdir(path.join(data, "uploads", "261001"), { recursive: true });
    await mkdir(backups); await mkdir(restored);
    await writeFile(path.join(data, "uploads", "261001", "prova.pdf"), "%PDF-1.4\nfixture\n");
    docker(["exec", cluster, "psql", "-U", "elettra", "-d", "elettra", "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${name}"`]);
    docker(["exec", cluster, "psql", "-U", "elettra", "-d", "elettra", "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${restoredName}"`]);
    docker(["run", "-d", "--name", container, "--network", network, "-p", "127.0.0.1::3000", "-e", "DATABASE_URL", "-e", "SESSION_SECRET", "-e", "DATA_ENCRYPTION_SECRET", "-e", "APP_ORIGIN", "--mount", `type=bind,src=${data},dst=/data`, "elettra-crm:production"], env);
    running = true;
    const port = docker(["port", container, "3000/tcp"]).split(":").at(-1);
    let base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`${base}/api/health/ready`)).ok) { ready = true; break; } } catch { /* startup */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ready) throw new Error(`Container non pronto: ${docker(["logs", container])}`);
    assert.equal(docker(["exec", container, "id", "-u"]), "1000");
    assert.equal(await db.user.count(), 0); // Nessun seed al primo avvio.
    docker(["exec", "-e", "ADMIN_EMAIL", "-e", "ADMIN_PASSWORD", container, "npm", "run", "auth:bootstrap"], env);
    assert.throws(() => docker(["exec", "-e", "ADMIN_EMAIL", "-e", "ADMIN_PASSWORD", container, "npm", "run", "auth:bootstrap"], env));
    const user = await db.user.findUniqueOrThrow({ where: { email: env.ADMIN_EMAIL } });
    await db.anagrafica.create({ data: { id: "client", ragioneSociale: "Cliente test", isCliente: true } });
    await db.commessa.create({ data: { id: "project", clienteId: "client", numero: "261001", anno: 2026, progressivo: 1001, importoOrdine: "1234.56" } });
    await db.documento.create({ data: { id: "doc", commessaId: "project", nomeFile: "prova.pdf", percorso: "261001/prova.pdf", tipoMime: "application/pdf", dimensione: 18 } });
    const token = await new SignJWT({ userId: user.id, ruolo: user.ruolo, nome: user.nome, sessionVersion: 0 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(env.SESSION_SECRET));
    const cookie = { cookie: `elettra_session=${token}` };
    await t.test("HTML dinamico applica il nonce CSP agli script; accesso e allegati autenticati", async () => {
      const response = await fetch(`${base}/login`);
      const nonce = response.headers.get("content-security-policy")?.match(/'nonce-([^']+)'/)?.[1];
      assert.ok(nonce);
      assert.match(await response.text(), new RegExp(`nonce="${nonce}"`));
      assert.equal(response.headers.get("x-powered-by"), null);
      assert.equal((await fetch(`${base}/commesse`, { headers: cookie, redirect: "manual" })).status, 200);
      assert.equal((await fetch(`${base}/documenti/doc`, { headers: cookie })).status, 200);
      const forbidden = await fetch(`${base}/assistente/api`, { method: "POST", headers: { ...cookie, origin: "https://evil.test", "content-type": "application/json" }, body: "{}" });
      assert.equal(forbidden.status, 403);
    });
    await t.test("revoca versione sessione blocca token già firmato", async () => {
      await db.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
      const response = await fetch(`${base}/commesse`, { headers: cookie, redirect: "manual" });
      assert.equal(response.status, 307);
      assert.ok(response.headers.get("location")?.endsWith("/login"));
      assert.equal((await fetch(`${base}/documenti/doc`, { headers: cookie, redirect: "manual" })).status, 401);
    });
    await t.test("restart preserva il DB senza seed", async () => {
      docker(["restart", container]);
      base = `http://127.0.0.1:${docker(["port", container, "3000/tcp"]).split(":").at(-1)}`;
      let restarted = false;
      for (let i = 0; i < 60; i++) {
        try { if ((await fetch(`${base}/api/health/ready`)).ok) { restarted = true; break; } } catch { /* restarting */ }
        await new Promise((r) => setTimeout(r, 500));
      }
      assert.equal(restarted, true);
      assert.equal(await db.user.count(), 1);
      assert.equal(await db.documento.count(), 1);
    });
    docker(["stop", container]); running = false;
    const mounts = ["--mount", `type=bind,src=${path.resolve("ops")},dst=/ops,readonly`, "--mount", `type=bind,src=${data},dst=/data,readonly`, "--mount", `type=bind,src=${backups},dst=/backups`];
    docker(["run", "--rm", "--user", "1000:1000", "--network", network, "-e", "BACKUP_DATABASE_URL", ...mounts, "postgres:16-alpine", "sh", "/ops/backup-container.sh"], env);
    const stamp = (await readdir(backups)).find((f) => !f.startsWith("."))!;
    assert.ok(stamp);
    await t.test("deposito restic cifrato: backup, verifica integrità e recupero bundle", async () => {
      const repository = path.join(dir, "repository"), recovered = path.join(dir, "recovered");
      await mkdir(repository); await mkdir(recovered);
      const resticEnv = { ...env, RESTIC_PASSWORD: randomBytes(32).toString("base64") };
      const run = (args: string[]) => docker(["run", "--rm", "--user", "1000:1000", "-e", "RESTIC_PASSWORD", "-e", "RESTIC_REPOSITORY=/repo", "-e", "XDG_CACHE_HOME=/tmp/cache", "--mount", `type=bind,src=${repository},dst=/repo`, "--mount", `type=bind,src=${backups},dst=/backups,readonly`, "--mount", `type=bind,src=${recovered},dst=/recovered`, "restic/restic:0.18.1", ...args], resticEnv);
      run(["init"]); run(["backup", "/backups", "--tag", "elettra"]); run(["check", "--read-data"]);
      run(["restore", "latest", "--target", "/recovered"]);
      assert.deepEqual(await readFile(path.join(recovered, "backups", stamp, "database.dump")), await readFile(path.join(backups, stamp, "database.dump")));
    });
    await t.test("restore ricostruisce database e allegati e rifiuta destinazioni già popolate", async () => {
      const args = ["run", "--rm", "--network", network, "-e", "RESTORE_DATABASE_URL", ...mounts, "--mount", `type=bind,src=${restored},dst=/restore-data`, "postgres:16-alpine", "sh", "/ops/restore-container.sh", `/backups/${stamp}`];
      docker(args, env);
      assert.equal((await target.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, user.passwordHash);
      assert.equal((await target.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion, 1);
      assert.equal((await target.commessa.findUniqueOrThrow({ where: { id: "project" } })).importoOrdine?.toString(), "1234.56");
      assert.deepEqual(await readFile(path.join(restored, "uploads", "261001", "prova.pdf")), await readFile(path.join(data, "uploads", "261001", "prova.pdf")));
      assert.throws(() => docker(args, env));
    });
  } finally {
    if (running) docker(["stop", container]);
    try { docker(["rm", container]); } catch { /* not created */ }
    await db.$disconnect(); await target.$disconnect();
    for (const database of [name, restoredName]) {
      try { docker(["exec", cluster, "psql", "-U", "elettra", "-d", "elettra", "-c", `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`]); } catch { /* best effort */ }
    }
    await rm(dir, { recursive: true, force: true });
  }
});
