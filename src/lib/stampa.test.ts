import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { PrismaClient } from "@/generated/prisma";
import { testDatabase } from "../../scripts/test-database";
import { getPrintableTasks } from "./stampa";
import { normalizeAttivitaFilters, type AttivitaFilters } from "./attivita";

let database: ReturnType<typeof testDatabase>;
let db: PrismaClient;
const reader = { id: "reader", ruolo: "AMMINISTRAZIONE" };
const admin = { id: "admin", ruolo: "SUPER_ADMIN" };
const now = new Date("2026-10-02T12:00:00Z");

before(async () => {
  database = testDatabase();
  db = new PrismaClient({ datasourceUrl: database.url });
  for (const user of [reader, admin, { id: "other", ruolo: "UFFICIO_TECNICO" }]) await db.user.create({ data: { ...user, nome: user.id, cognome: "Test", email: `${user.id}@example.test`, passwordHash: "test-only" } });
  await db.anagrafica.create({ data: { id: "cliente", ragioneSociale: "Cliente stampa", isCliente: true } });
  await db.commessa.create({ data: { id: "commessa", numero: "261001", anno: 2026, progressivo: 1001, clienteId: "cliente" } });
  await db.attivita.createMany({ data: Array.from({ length: 42 }, (_, i) => ({ id: `task-${String(i).padStart(2, "0")}`, userId: reader.id, titolo: `Controllo settimanale ${i}`, note: "Prima riga\nSeconda riga\nNota completa da stampare", stato: "DA_FARE", scadenza: new Date("2026-10-02"), commessaId: "commessa", clienteId: "cliente" })) });
  await db.attivita.create({ data: { id: "completed", userId: "reader", titolo: "Controllo completato", stato: "COMPLETATA" } });
  await db.attivita.create({ data: { id: "private", userId: "other", titolo: "Attività privata di un altro utente" } });
});
after(async () => { if (db && database) await database.cleanup(db); });

test("stampa attività: tutti i risultati filtrati, anche oltre le 30 righe della pagina", async () => {
  const input = { q: " settimanale ", scadenza: "oggi", commessaId: "commessa", pagina: "2" };
  const result = await getPrintableTasks(reader, input, db, now);
  assert.equal(result.tasks.length, 42);
  assert.ok(result.tasks.some((t) => t.id === "task-41"));
  assert.equal(result.filters.q, "settimanale");
  assert.equal(result.commessa?.numero, "261001");
  assert.equal(result.tasks[0].note, "Prima riga\nSeconda riga\nNota completa da stampare");
  assert.equal(result.tasks[0].cliente?.ragioneSociale, "Cliente stampa");
  assert.ok(!JSON.stringify(result).includes("passwordHash"));
});

test("stampa attività: una vista team forzata non espone le attività altrui", async () => {
  const result = await getPrintableTasks(reader, { vista: "team", responsabile: "other", stato: "tutte" }, db, now);
  assert.equal(result.filters.vista, "mie");
  assert.equal(result.filters.responsabile, "");
  assert.equal(result.tasks.length, 43);
  assert.ok(!result.tasks.some((t) => t.id === "private"));
});

test("stampa attività: gestione team rispetta responsabile, stato e collegamenti", async () => {
  const result = await getPrintableTasks(admin, { vista: "team", responsabile: "reader", stato: "COMPLETATA" }, db, now);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].id, "completed");
  assert.equal(result.responsabile?.nome, "reader");
  const other = await getPrintableTasks(admin, { vista: "team", responsabile: "other" }, db, now);
  assert.equal(other.tasks.length, 1);
  assert.equal(other.tasks[0].id, "private");
  const noMatches = await getPrintableTasks(reader, { clienteId: "non-esiste" }, db, now);
  assert.equal(noMatches.tasks.length, 0);
});

test("filtri condivisi: valori invalidi e parametri ripetuti vengono normalizzati", () => {
  const filters = normalizeAttivitaFilters(reader, { vista: "team", stato: "INVALID", scadenza: "INVALID", q: ["uno", "due"], commessaId: ["commessa", "altra"] } as unknown as AttivitaFilters);
  assert.equal(filters.vista, "mie");
  assert.equal(filters.stato, "DA_FARE");
  assert.equal(filters.scadenza, "");
  assert.equal(filters.q, "");
  assert.equal(filters.commessaId, "");
});
