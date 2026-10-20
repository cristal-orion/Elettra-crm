import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@/generated/prisma";
import { testDatabase } from "../../scripts/test-database";
import { attivitaWhere, normalizeAttivitaFilters } from "./attivita";
import { executeCommand } from "./crm/commands";
import { getTodayTasks } from "./today-tasks";

test("Da fare oggi: agenda personale, conteggi e destinazioni coerenti", async (t) => {
  const database = testDatabase();
  const db = new PrismaClient({ datasourceUrl: database.url });
  const now = new Date("2026-10-20T22:30:00Z"); // in Italia è già il 21
  const day = (offset: number) => new Date(Date.UTC(2026, 9, 21 + offset));
  const admin = { id: "agenda-admin", ruolo: "SUPER_ADMIN" };
  const reader = { id: "agenda-reader", ruolo: "AMMINISTRAZIONE" };
  const empty = { id: "agenda-empty", ruolo: "PROJECT_MANAGER" };
  try {
    await db.user.createMany({ data: [admin, reader, empty].map((u) => ({ ...u, nome: u.id, cognome: "Test", email: `${u.id}@example.test`, passwordHash: "test-only" })) });
    await db.attivita.createMany({ data: [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `late-${i}`, titolo: `Scaduta ${i}`, userId: admin.id, scadenza: day(-1), createdAt: day(-5) })),
      ...["today-1", "today-2"].map((id) => ({ id, titolo: id, userId: admin.id, scadenza: day(0) })),
      { id: "tomorrow", titolo: "Domani", userId: admin.id, scadenza: day(1) },
      { id: "week-end", titolo: "Settimo giorno", userId: admin.id, scadenza: day(7) },
      { id: "later", titolo: "Ottavo giorno", userId: admin.id, scadenza: day(8) },
      { id: "undated", titolo: "Senza data", userId: admin.id },
      { id: "done", titolo: "Già completata", userId: admin.id, scadenza: day(-1), stato: "COMPLETATA" },
      { id: "reader-late", titolo: "Scaduta altrui", userId: reader.id, scadenza: day(-1) },
      { id: "reader-today", titolo: "Oggi altrui", userId: reader.id, scadenza: day(0) },
    ] });
    await t.test("giorno italiano, totale integrale, limite anteprima e ordinamento stabile", async () => {
      const data = await getTodayTasks(db, admin, now);
      assert.equal(data.date.toISOString(), "2026-10-21T00:00:00.000Z");
      assert.equal(data.total, 14); assert.equal(data.due, 10);
      assert.deepEqual(data.cards.map((c) => c.count), [8, 2, 2, 1]);
      assert.deepEqual(data.tasks.map((t) => t.id), Array.from({ length: 6 }, (_, i) => `late-${i}`));
      for (const { count, href } of [...data.cards, { count: data.total, href: data.allHref }, { count: data.due, href: data.dueHref }]) {
        const filters = normalizeAttivitaFilters(admin, Object.fromEntries(new URL(href, "https://crm.invalid").searchParams));
        assert.equal(filters.vista, "mie");
        assert.equal(await db.attivita.count({ where: attivitaWhere(admin, filters, now) }), count);
      }
    });
    await t.test("nessun dato altrui anche per amministratori, stato vuoto per PM senza attività", async () => {
      const data = await getTodayTasks(db, reader, now);
      assert.deepEqual(data.tasks.map((a) => a.id), ["reader-late", "reader-today"]);
      assert.equal(data.total, 2); assert.equal(data.due, 2);
      const noTasks = await getTodayTasks(db, empty, now);
      assert.equal(noTasks.total, 0); assert.equal(noTasks.due, 0);
      assert.deepEqual(noTasks.tasks, []);
      assert.ok(noTasks.cards.every((c) => c.count === 0));
    });
    await t.test("completamento autorizzato aggiorna conteggi e anteprima, versioni e proprietario verificati", async () => {
      const task = await db.attivita.findUniqueOrThrow({ where: { id: "reader-late" } });
      const command = { type: "aggiornaAttivita", id: task.id, stato: "COMPLETATA", expectedUpdatedAt: task.updatedAt.toISOString() };
      await assert.rejects(db.$transaction((tx) => executeCommand(tx, reader.id, { ...command, id: "late-0" })), /Non puoi modificare/);
      await db.$transaction((tx) => executeCommand(tx, reader.id, command));
      const data = await getTodayTasks(db, reader, now);
      assert.equal(data.due, 1); assert.equal(data.cards[0].count, 0);
      assert.deepEqual(data.tasks.map((t) => t.id), ["reader-today"]);
      await assert.rejects(db.$transaction((tx) => executeCommand(tx, reader.id, { ...command, stato: "DA_FARE" })), /modificato/);
    });
  } finally { await database.cleanup(db); }
});
