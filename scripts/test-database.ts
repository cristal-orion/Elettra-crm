import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { PrismaClient } from "../src/generated/prisma";

export function testDatabase() {
  // Non usa DATABASE_URL: i test non devono toccare il database dell'app.
  const url = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://elettra:elettra-local-only@127.0.0.1:55432/elettra");
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("TEST_DATABASE_URL deve essere Postgres.");
  const schema = `test_${randomUUID().replaceAll("-", "")}`;
  url.searchParams.set("schema", schema);
  const databaseUrl = url.toString();
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
  return {
    url: databaseUrl,
    async cleanup(db: PrismaClient) {
      await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      await db.$disconnect();
    },
  };
}
