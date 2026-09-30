import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { PrismaClient, Prisma } from "../src/generated/prisma";
import { testDatabase } from "./test-database";
import { migrateSqlite } from "./migrate-sqlite";

const { DatabaseSync } = createRequire(path.resolve("package.json"))("node:sqlite") as {
  DatabaseSync: new (file: string) => { exec(sql: string): void; close(): void };
};
test("migrazione SQLite → Postgres: conservazione dati, rollback, rate limit concorrente e numerazione", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "elettra-production-"));
  const source = path.join(dir, "source.db");
  const sqlite = new DatabaseSync(source);
  const database = testDatabase();
  const oldUrl = process.env.DATABASE_URL;
  const oldSecret = process.env.SESSION_SECRET;
  process.env.DATABASE_URL = database.url;
  process.env.SESSION_SECRET = "integration-session-secret-at-least-32-bytes";
  const db = (await import("../src/lib/prisma")).prisma;
  try {
    const migrations = await readdir("prisma/legacy-sqlite/migrations", { withFileTypes: true });
    for (const entry of migrations.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) sqlite.exec(await readFile(`prisma/legacy-sqlite/migrations/${entry.name}/migration.sql`, "utf8"));
    sqlite.exec(`
      INSERT INTO "User" (id,email,passwordHash,nome,cognome,ruolo,updatedAt) VALUES ('admin','admin@example.test','preserved-hash','Mario','Rossi','SUPER_ADMIN',1767225600123);
      INSERT INTO "Anagrafica" (id,ragioneSociale,isCliente,updatedAt) VALUES ('client','Èlettra S.r.l.',1,1767225600123);
      INSERT INTO "Commessa" (id,numero,anno,progressivo,clienteId,importoOrdine,updatedAt) VALUES ('project','261001',2026,1001,'client',1234.56,1767225600123);
      INSERT INTO "Documento" (id,commessaId,nomeFile,percorso,dimensione) VALUES ('doc','project','prova.pdf','261001/prova.pdf',42);
      INSERT INTO "AiConversation" (id,userId,title,context,updatedAt) VALUES ('chat','admin','Chat',NULL,1767225600123),('json-null','admin','JSON null','null',1767225600123);
      INSERT INTO "AiMessage" (id,conversationId,payload) VALUES ('msg','chat','{"nested":{"a":1},"array":[true,"è"]}');
      INSERT INTO "AiMessage" (id,conversationId,payload) VALUES ('json-string','chat','"ciao"');
    `);
    sqlite.close();
    await t.test("dry run non scrive, esecuzione verifica tutte le righe e rifiuta il secondo import", async () => {
      const dry = await migrateSqlite(source, database.url);
      assert.equal(dry.find((m) => m.table === "Commessa")?.rows, 1);
      assert.equal(await db.user.count(), 0);
      await migrateSqlite(source, database.url, true);
      const user = await db.user.findUniqueOrThrow({ where: { id: "admin" } });
      assert.equal(user.passwordHash, "preserved-hash");
      assert.equal(user.updatedAt.getTime(), 1767225600123);
      assert.equal(user.sessionVersion, 0);
      assert.equal((await db.commessa.findUniqueOrThrow({ where: { id: "project" } })).importoOrdine?.toString(), "1234.56");
      assert.equal((await db.documento.findUniqueOrThrow({ where: { id: "doc" } })).percorso, "261001/prova.pdf");
      assert.deepEqual((await db.aiMessage.findUniqueOrThrow({ where: { id: "msg" } })).payload, { nested: { a: 1 }, array: [true, "è"] });
      assert.equal((await db.aiMessage.findUniqueOrThrow({ where: { id: "json-string" } })).payload, "ciao");
      assert.equal(await db.aiConversation.count({ where: { context: { equals: Prisma.DbNull } } }), 1);
      assert.equal(await db.aiConversation.count({ where: { context: { equals: Prisma.JsonNull } } }), 1);
      await assert.rejects(migrateSqlite(source, database.url, true), /non vuota/);
      assert.equal(await db.user.count(), 1);
    });
    await t.test("errore tardivo annulla anche i dati già copiati", async () => {
      const empty = testDatabase();
      const target = new PrismaClient({ datasourceUrl: empty.url });
      const corrupt = new DatabaseSync(source);
      corrupt.exec(`UPDATE "AiMessage" SET payload='not-json'`);
      corrupt.close();
      try {
        await assert.rejects(migrateSqlite(source, empty.url, true));
        assert.equal(await target.user.count(), 0);
        assert.equal(await target.commessa.count(), 0);
      } finally { await empty.cleanup(target); }
    });
    await t.test("limite login atomico anche con richieste simultanee e finestra scaduta", async () => {
      const { allowLogin } = await import("../src/lib/login-security");
      const now = new Date("2026-09-30T12:00:00Z");
      const results = await Promise.all(Array.from({ length: 12 }, () => allowLogin("admin@example.test", now)));
      assert.equal(results.filter(Boolean).length, 10);
      assert.equal(await allowLogin("admin@example.test", new Date(now.getTime() + 15 * 60_000)), true);
      assert.equal(await db.loginRateLimit.count({ where: { key: { contains: "admin" } } }), 0);
    });
    await t.test("creazioni concorrenti non duplicano numeri commessa", async () => {
      const { runCommand } = await import("../src/lib/crm/commands");
      const results = await Promise.all(Array.from({ length: 3 }, (_, i) => runCommand("admin", { type: "salvaCommessa", data: { clienteId: "client", descrizione: `Concurrent ${i}` } })));
      assert.equal(new Set(results.map((r) => r.id)).size, 3);
      assert.equal(await db.commessa.count(), 4);
    });
    await t.test("schema migrato corrisponde allo schema Prisma", () => {
      execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-url", database.url, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"], { stdio: "pipe" });
    });
  } finally {
    await database.cleanup(db);
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
    if (oldSecret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = oldSecret;
    await rm(dir, { recursive: true, force: true });
  }
});
