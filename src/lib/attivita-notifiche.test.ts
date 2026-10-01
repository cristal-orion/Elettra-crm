import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import type { PrismaClient } from "@/generated/prisma";
import { testDatabase } from "../../scripts/test-database";
import { attivitaHref, attivitaWhere, giornoAttivita, statoScadenza } from "./attivita";

let database: ReturnType<typeof testDatabase>;
let db: PrismaClient;
let run: typeof import("./crm/commands").runCommand;
let notifications: typeof import("./notifiche");
const oldDb = process.env.DATABASE_URL;
const oldKey = process.env.GEMINI_API_KEY;

before(async () => {
  database = testDatabase();
  process.env.DATABASE_URL = database.url;
  process.env.GEMINI_API_KEY = "";
  db = (await import("./prisma")).prisma;
  run = (await import("./crm/commands")).runCommand;
  notifications = await import("./notifiche");
  for (const [id, ruolo, attivo] of [["admin", "SUPER_ADMIN", true], ["pm", "PROJECT_MANAGER", true], ["reader", "AMMINISTRAZIONE", true], ["other", "UFFICIO_TECNICO", true], ["inactive", "PROJECT_MANAGER", false]] as const) {
    await db.user.create({ data: { id, ruolo, attivo, nome: id, cognome: "Test", email: `${id}@example.test`, passwordHash: "test-only" } });
  }
  for (const id of ["cliente", "altro-cliente"]) await db.anagrafica.create({ data: { id, ragioneSociale: id, isCliente: true } });
  for (const [id, clienteId, numero] of [["commessa", "cliente", "261001"], ["altra-commessa", "altro-cliente", "261002"]]) {
    await db.commessa.create({ data: { id, clienteId, numero, anno: 2026, progressivo: Number(numero.slice(2)) } });
  }
});

after(async () => {
  if (db && database) await database.cleanup(db);
  if (oldDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldDb;
  if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
});

test("scadenze: giorno italiano, oggi non è scaduto e completate non generano allarmi", () => {
  const now = new Date("2026-10-01T22:30:00Z");
  assert.equal(giornoAttivita(now).toISOString(), "2026-10-02T00:00:00.000Z");
  assert.equal(statoScadenza(new Date("2026-10-02"), "DA_FARE", now), "oggi");
  assert.equal(statoScadenza(new Date("2026-10-01"), "DA_FARE", now), "scaduta");
  assert.equal(statoScadenza(new Date("2026-10-01"), "COMPLETATA", now), "completata");
  assert.equal(statoScadenza(null, "DA_FARE", now), "senza");
});

test("creazione: collegamento automatico al cliente e notifica atomica al responsabile", async () => {
  const a = await run("admin", { type: "creaAttivita", titolo: "Verifica impianto", userId: "reader", commessaId: "commessa", scadenza: "2026-10-02", note: "Note iniziali" });
  const row = await db.attivita.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(row.clienteId, "cliente");
  assert.equal(row.userId, "reader");
  assert.equal(a.href, attivitaHref(a.id));
  const notification = await db.notifica.findFirstOrThrow({ where: { userId: "reader", href: a.href } });
  assert.equal(notification.letta, false);
  assert.match(notification.testo, /Verifica impianto/);
  const personal = await run("reader", { type: "creaAttivita", titolo: "Personale" });
  assert.equal(await db.notifica.count({ where: { href: personal.href } }), 0);
  await assert.rejects(run("reader", { type: "creaAttivita", titolo: "Vietata", userId: "other" }), /solo per te/);
  await assert.rejects(run("admin", { type: "creaAttivita", titolo: "Non valida", userId: "inactive" }), /Responsabile non valido/);
  await assert.rejects(run("admin", { type: "creaAttivita", titolo: "Incoerente", commessaId: "commessa", clienteId: "altro-cliente" }), /non corrispondono/);
});

test("filtri: la vista team non allarga i permessi degli utenti senza gestione commesse", async () => {
  const user = { id: "reader", ruolo: "AMMINISTRAZIONE" };
  const personal = await db.attivita.findMany({ where: attivitaWhere(user, { vista: "team", responsabile: "admin", stato: "tutte" }) });
  assert.ok(personal.length > 0);
  assert.ok(personal.every((a) => a.userId === "reader"));
  const today = await db.attivita.findMany({ where: attivitaWhere(user, { scadenza: "oggi", commessaId: "commessa", q: "impianto" }, new Date("2026-10-01T22:30:00Z")) });
  assert.equal(today.length, 1);
  const team = await db.attivita.findMany({ where: attivitaWhere({ id: "admin", ruolo: "SUPER_ADMIN" }, { vista: "team", responsabile: "reader", stato: "tutte" }) });
  assert.equal(team.length, personal.length);
});

test("modifica: patch parziali, titolo/note, collegamenti coerenti e versioni obsolete", async () => {
  const a = await run("reader", { type: "creaAttivita", titolo: "Modifica test", commessaId: "commessa", note: "Originale", scadenza: "2026-10-02" });
  const version = (await db.attivita.findUniqueOrThrow({ where: { id: a.id } })).updatedAt.toISOString();
  await run("reader", { type: "aggiornaAttivita", id: a.id, expectedUpdatedAt: version, titolo: "Titolo aggiornato", note: "Nuove note" });
  let row = await db.attivita.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(row.titolo, "Titolo aggiornato");
  assert.equal(row.note, "Nuove note");
  assert.equal(row.scadenza?.toISOString().slice(0, 10), "2026-10-02");
  await assert.rejects(run("reader", { type: "aggiornaAttivita", id: a.id, expectedUpdatedAt: version, stato: "COMPLETATA" }), /modificato/);
  await assert.rejects(run("other", { type: "aggiornaAttivita", id: a.id, stato: "COMPLETATA" }), /Non puoi modificare/);
  await assert.rejects(run("reader", { type: "aggiornaAttivita", id: a.id, userId: "other" }), /riassegnare/);
  await assert.rejects(run("reader", { type: "aggiornaAttivita", id: a.id, clienteId: "altro-cliente" }), /non corrispondono/);
  await run("reader", { type: "aggiornaAttivita", id: a.id, commessaId: "altra-commessa" });
  row = await db.attivita.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(row.clienteId, "altro-cliente");
  await run("reader", { type: "aggiornaAttivita", id: a.id, scadenza: null, commessaId: null, clienteId: null, stato: "COMPLETATA" });
  row = await db.attivita.findUniqueOrThrow({ where: { id: a.id } });
  assert.equal(row.scadenza, null);
  assert.equal(row.commessaId, null);
  assert.equal(row.clienteId, null);
  await run("reader", { type: "aggiornaAttivita", id: a.id, stato: "DA_FARE" });
  assert.equal((await db.attivita.findUniqueOrThrow({ where: { id: a.id } })).stato, "DA_FARE");
});

test("riassegnazione: notifica al nuovo responsabile e nessun link rotto per il precedente", async () => {
  const a = await run("admin", { type: "creaAttivita", titolo: "Da trasferire", userId: "reader" });
  await run("admin", { type: "aggiornaAttivita", id: a.id, userId: "pm" });
  assert.equal(await db.notifica.count({ where: { href: a.href, userId: "reader" } }), 0);
  assert.equal(await db.notifica.count({ where: { href: a.href, userId: "pm" } }), 1);
  await run("admin", { type: "aggiornaAttivita", id: a.id, userId: "pm" });
  assert.equal(await db.notifica.count({ where: { href: a.href, userId: "pm" } }), 1);
  await run("admin", { type: "aggiornaAttivita", id: a.id, stato: "COMPLETATA" });
  assert.equal(await db.notifica.count({ where: { href: a.href, userId: "pm", titolo: "Attività aggiornata" } }), 1);
});

test("promemoria: oggi e scadute, un solo avviso al giorno anche con esecuzioni concorrenti", async () => {
  const now = new Date("2026-10-01T22:30:00Z");
  for (const [id, userId, stato, scadenza] of [
    ["due-today", "reader", "DA_FARE", "2026-10-02"],
    ["overdue", "reader", "DA_FARE", "2026-10-01"],
    ["future", "reader", "DA_FARE", "2026-10-03"],
    ["completed", "reader", "COMPLETATA", "2026-10-01"],
    ["inactive-task", "inactive", "DA_FARE", "2026-10-01"],
  ]) await db.attivita.create({ data: { id, userId, titolo: id, stato, scadenza: new Date(scadenza) } });
  await Promise.all([notifications.notifyDueTasks(now), notifications.notifyDueTasks(now)]);
  for (const id of ["due-today", "overdue"]) assert.equal(await db.notifica.count({ where: { href: `${attivitaHref(id)}?promemoria=2026-10-02` } }), 1);
  for (const id of ["future", "completed", "inactive-task"]) assert.equal(await db.notifica.count({ where: { href: `${attivitaHref(id)}?promemoria=2026-10-02` } }), 0);
  const note = await db.notifica.findFirstOrThrow({ where: { href: "/attivita/due-today?promemoria=2026-10-02" } });
  await notifications.setNotificationRead("reader", note.id, true);
  await notifications.notifyDueTasks(now);
  assert.equal(await db.notifica.count({ where: { href: note.href } }), 1);
  await notifications.notifyDueTasks(new Date("2026-10-02T22:30:00Z"));
  assert.equal(await db.notifica.count({ where: { href: "/attivita/due-today?promemoria=2026-10-03" } }), 1);
});

test("notifiche: lettura, riapertura, tutte lette e permessi limitati al destinatario", async () => {
  const note = await db.notifica.findFirstOrThrow({ where: { userId: "reader", letta: false } });
  const initial = await notifications.unreadNotificationCount("reader");
  await assert.rejects(notifications.setNotificationRead("other", note.id, true), /non trovata/);
  await assert.rejects(notifications.openUserNotification("other", note.id), /non trovata/);
  await assert.rejects(notifications.setNotificationRead("inactive", note.id, true), /Sessione/);
  assert.equal(await notifications.openUserNotification("reader", note.id), note.href);
  assert.equal(await notifications.unreadNotificationCount("reader"), initial - 1);
  await notifications.setNotificationRead("reader", note.id, false);
  assert.equal(await notifications.unreadNotificationCount("reader"), initial);
  const otherCount = await notifications.unreadNotificationCount("pm");
  await notifications.setNotificationRead("reader", null, true);
  assert.equal(await notifications.unreadNotificationCount("reader"), 0);
  assert.equal(await notifications.unreadNotificationCount("pm"), otherCount);
});

test("controlli programmati: notifica a destinatari attivi e apertura del riepilogo corretto", async () => {
  const { runSchedule } = await import("./ai/scheduler");
  const schedule = await db.aiSchedule.create({ data: { userId: "admin", name: "Riepilogo test", recipientIds: ["reader", "pm", "inactive", "inesistente"] } });
  const result = await runSchedule(schedule.id, "test-slot");
  assert.equal(result.skipped, false);
  assert.equal(await db.notifica.count({ where: { runId: result.id } }), 2);
  const note = await db.notifica.findFirstOrThrow({ where: { runId: result.id, userId: "reader" } });
  assert.equal(await notifications.openUserNotification("reader", note.id), `/assistente/automazioni/${result.id}`);
  assert.equal((await db.notifica.findUniqueOrThrow({ where: { id: note.id } })).letta, true);
  assert.equal((await runSchedule(schedule.id, "test-slot")).skipped, true);
  assert.equal(await db.notifica.count({ where: { runId: result.id } }), 2);
});

test("link notifiche: rifiuta destinazioni esterne, script e URL non supportati", () => {
  for (const href of ["https://example.test", "//example.test", "javascript:alert(1)", "/\\example.test", "/attivita/id?next=https://example.test", "/utenti"]) {
    assert.equal(notifications.safeNotificationHref(href), "/notifiche");
  }
  assert.equal(notifications.safeNotificationHref("/attivita/id?promemoria=2026-10-01"), "/attivita/id?promemoria=2026-10-01");
});

test("eliminazione: autorizzazione, conflitti e pulizia notifiche senza cancellare i dati collegati", async () => {
  const a = await run("admin", { type: "creaAttivita", titolo: "Da eliminare", userId: "reader", commessaId: "commessa", scadenza: "2026-10-01" });
  await notifications.notifyDueTasks(new Date("2026-10-01T12:00:00Z"));
  await assert.rejects(run("other", { type: "eliminaAttivita", id: a.id }), /Non puoi modificare/);
  await assert.rejects(run("reader", { type: "eliminaAttivita", id: a.id, expectedUpdatedAt: "2000-01-01T00:00:00.000Z" }), /modificato/);
  await run("reader", { type: "eliminaAttivita", id: a.id });
  assert.equal(await db.attivita.findUnique({ where: { id: a.id } }), null);
  assert.equal(await db.notifica.count({ where: notifications.notificheAttivitaWhere(a.id) }), 0);
  assert.ok(await db.commessa.findUnique({ where: { id: "commessa" } }));
  assert.ok(await db.anagrafica.findUnique({ where: { id: "cliente" } }));
});

test("AI: eliminazione richiede conferma e una proposta non espone le attività altrui", async () => {
  const { submitOperation, decideOperation } = await import("./ai/operations");
  for (const userId of ["reader", "other"]) await db.aiConversation.create({ data: { id: `chat-${userId}`, userId, title: "Test" } });
  const a = await run("reader", { type: "creaAttivita", titolo: "Privata da eliminare" });
  const forbidden = await submitOperation("other", "chat-other", "forbidden", { type: "eliminaAttivita", id: a.id });
  assert.equal(forbidden.status, "FAILED");
  assert.deepEqual(forbidden.preview, {});
  const proposal = await submitOperation("reader", "chat-reader", "delete-task", { type: "eliminaAttivita", id: a.id });
  assert.equal(proposal.status, "PENDING");
  assert.ok(await db.attivita.findUnique({ where: { id: a.id } }));
  assert.equal((await decideOperation("reader", proposal.operationId, true)).status, "COMPLETED");
  assert.equal(await db.attivita.findUnique({ where: { id: a.id } }), null);
});
