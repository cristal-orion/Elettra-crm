/** Migrazione offline: SQLite aperto in sola lettura, Postgres vuoto, una transazione. */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { Prisma, PrismaClient } from "../src/generated/prisma";

type Row = Record<string, unknown>;
type Sqlite = { prepare(sql: string): { all(): Row[] }; exec(sql: string): void; close(): void };
type Delegate = {
  count(): Promise<number>;
  createMany(args: { data: Row[] }): Promise<unknown>;
  findMany(args: { select: Record<string, boolean>; orderBy: Record<string, string> }): Promise<Row[]>;
};
const models = Prisma.dmmf.datamodel.models;
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
function orderedModels() {
  const done = new Set<string>();
  const result: typeof models[number][] = [];
  while (result.length < models.length) {
    const ready = models.filter((m) => !done.has(m.name) && m.fields.every((f) =>
      f.kind !== "object" || !f.relationFromFields?.length || f.type === m.name || done.has(f.type)));
    if (!ready.length) throw new Error("Relazioni cicliche: serve una migrazione dedicata.");
    for (const m of ready) { done.add(m.name); result.push(m); }
  }
  return result;
}
function value(type: string, input: unknown, fromSqlite = false): unknown {
  if (input === null) return null;
  if (type === "DateTime") {
    const dateInput = typeof input === "string" && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d+)?$/.test(input) ? `${input.replace(" ", "T")}Z` : input;
    const d = new Date(dateInput as string | number);
    if (!Number.isFinite(d.getTime())) throw new Error("Data SQLite non valida.");
    return d;
  }
  if (type === "Boolean") {
    if (![0, 1, true, false].includes(input as number)) throw new Error("Booleano SQLite non valido.");
    return Boolean(input);
  }
  if (type === "Decimal") return new Prisma.Decimal(String(input)).toString();
  if (type === "Json") return fromSqlite && typeof input === "string" ? JSON.parse(input) : input;
  return input;
}
function canonical(input: unknown): string {
  if (input instanceof Date) return JSON.stringify(input.toISOString());
  if (Array.isArray(input)) return `[${input.map(canonical).join(",")}]`;
  if (input && typeof input === "object") return `{${Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(input);
}
function digest(rows: Row[]) {
  return createHash("sha256").update(canonical(rows)).digest("hex");
}

export async function migrateSqlite(source: string, url: string, execute = false) {
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error("DATABASE_URL deve essere PostgreSQL.");
  const { DatabaseSync } = createRequire(path.resolve("package.json"))("node:sqlite") as {
    DatabaseSync: new (file: string, options: { readOnly: boolean }) => Sqlite;
  };
  const sqlite = new DatabaseSync(path.resolve(source), { readOnly: true });
  const db = new PrismaClient({ datasourceUrl: url, log: [] });
  try {
    sqlite.exec("BEGIN"); // Snapshot coerente anche se qualcuno scrive sul file sorgente.
    if (sqlite.prepare("PRAGMA integrity_check").all().some((r) => Object.values(r)[0] !== "ok")) throw new Error("SQLite non integro.");
    if (sqlite.prepare("PRAGMA foreign_key_check").all().length) throw new Error("SQLite contiene relazioni non valide.");
    const sourceTables = new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => String(r.name)));
    for (const table of sourceTables) {
      if (!table.startsWith("_") && !table.startsWith("sqlite_") && !models.some((m) => (m.dbName ?? m.name) === table)) throw new Error(`Tabella sorgente non riconosciuta: ${table}`);
    }
    const summary: { table: string; rows: number; sha256: string }[] = [];
    await db.$transaction(async (tx) => {
      for (const m of models) {
        const delegate = (tx as unknown as Record<string, Delegate>)[m.name[0].toLowerCase() + m.name.slice(1)];
        if (await delegate.count()) throw new Error(`Destinazione non vuota: ${m.name}. Nessun dato sovrascritto.`);
      }
      for (const m of orderedModels()) {
        const table = m.dbName ?? m.name;
        if (!sourceTables.has(table)) continue;
        const columns = new Set(sqlite.prepare(`PRAGMA table_info(${quote(table)})`).all().map((r) => String(r.name)));
        const fields = m.fields.filter((f) => f.kind !== "object" && columns.has(f.dbName ?? f.name));
        for (const column of columns) if (!fields.some((f) => (f.dbName ?? f.name) === column)) throw new Error(`Colonna sorgente non riconosciuta: ${table}.${column}`);
        const pk = m.fields.find((f) => f.isId);
        if (!pk) throw new Error(`Chiave primaria mancante: ${table}`);
        const sourceRows = sqlite.prepare(`SELECT * FROM ${quote(table)} ORDER BY ${quote(pk.dbName ?? pk.name)}`).all();
        const rows = sourceRows.map((r) =>
          Object.fromEntries(fields.map((f) => [f.name, value(f.type, r[f.dbName ?? f.name], true)])));
        const expected = digest(rows);
        const delegate = (tx as unknown as Record<string, Delegate>)[m.name[0].toLowerCase() + m.name.slice(1)];
        if (execute) {
          for (let i = 0; i < rows.length; i += 100) {
            const data = rows.slice(i, i + 100).map((r, j) => Object.fromEntries(fields.map((f) =>
              [f.name, f.type === "Json" && r[f.name] === null ? (sourceRows[i + j][f.dbName ?? f.name] === null ? Prisma.DbNull : Prisma.JsonNull) : r[f.name]])));
            await delegate.createMany({ data });
          }
          const actual = await delegate.findMany({ select: Object.fromEntries(fields.map((f) => [f.name, true])), orderBy: { [pk.name]: "asc" } });
          const normalized = actual.map((r) => Object.fromEntries(fields.map((f) => [f.name, value(f.type, r[f.name])])));
          // Ordine per ID in JS: collazione Postgres e SQLite possono essere diverse.
          const sort = (r: Row[]) => r.sort((a, b) => String(a[pk.name]) < String(b[pk.name]) ? -1 : String(a[pk.name]) > String(b[pk.name]) ? 1 : 0);
          if (digest(sort(normalized)) !== digest(sort(rows))) throw new Error(`Verifica dati fallita: ${table}. Transazione annullata.`);
        }
        summary.push({ table, rows: rows.length, sha256: expected });
      }
    }, { timeout: 300_000, maxWait: 10_000 });
    return summary;
  } finally {
    sqlite.close();
    await db.$disconnect();
  }
}

if (process.argv[1]?.endsWith("migrate-sqlite.ts")) {
  const args = process.argv.slice(2);
  const source = args.find((a) => !a.startsWith("--"));
  if (!source || args.some((a) => a.startsWith("--") && a !== "--execute")) {
    console.error("Uso: npm run db:from-sqlite -- /percorso/copia.db [--execute]. Default: sola analisi.");
    process.exitCode = 1;
  } else {
    migrateSqlite(source, process.env.DATABASE_URL ?? "", args.includes("--execute"))
      .then((summary) => { console.table(summary); console.log(args.includes("--execute") ? "Migrazione e confronto integrale riusciti." : "Analisi riuscita. Nessun dato scritto; per migrare aggiungere --execute."); })
      .catch(() => { console.error("Migrazione interrotta: controllare integrità della sorgente, schema e destinazione vuota. Nessun URL o dato sensibile viene stampato."); process.exitCode = 1; });
  }
}
