import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import type { PrismaClient } from "@/generated/prisma";
import { testDatabase } from "../../scripts/test-database";

let database: ReturnType<typeof testDatabase>;
let db: PrismaClient;
let run: typeof import("./crm/commands").runCommand;
let DuplicateError: typeof import("./crm/commands").DuplicateAnagraficaError;
const oldDb = process.env.DATABASE_URL;
before(async () => {
  database = testDatabase();
  process.env.DATABASE_URL = database.url;
  db = (await import("./prisma")).prisma;
  ({ runCommand: run, DuplicateAnagraficaError: DuplicateError } = await import("./crm/commands"));
  await db.user.create({ data: { id: "admin", email: "admin@example.test", passwordHash: "test-only", nome: "Admin", cognome: "Test", ruolo: "SUPER_ADMIN" } });
});
after(async () => {
  if (db && database) await database.cleanup(db);
  if (oldDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldDb;
});

async function legacyPair(n: number) {
  const data = { isCliente: true, partitaIva: `1000000000${n}`, codiceFiscale: `FISCALE${n}` };
  const first = await db.anagrafica.create({ data: { ...data, id: `legacy-${n}-a`, ragioneSociale: `Azienda storica ${n} A`, codiceCliente: `C${String(n * 10 + 4).padStart(4, "0")}` } });
  const other = await db.anagrafica.create({ data: { ...data, id: `legacy-${n}-b`, ragioneSociale: `Azienda storica ${n} B`, codiceCliente: `C${String(n * 10 + 5).padStart(4, "0")}` } });
  return { first, other };
}

test("anagrafiche: il modulo completo salva contatti e referenti con dati fiscali storici duplicati ma invariati", async () => {
  const { first, other } = await legacyPair(1);
  const result = await run("admin", { type: "salvaAnagrafica", id: first.id, expectedUpdatedAt: first.updatedAt.toISOString(),
    data: { ragioneSociale: first.ragioneSociale, isCliente: true, partitaIva: first.partitaIva, codiceFiscale: first.codiceFiscale, telefono: "02000000", note: "Referenti aggiornati" },
    referenti: [{ nome: "Mario", cognome: "Rossi", email: "mario@example.test", principale: true }, { nome: "Andrea", cognome: "Test" }] });
  assert.equal(result.id, first.id);
  const saved = await db.anagrafica.findUniqueOrThrow({ where: { id: first.id }, include: { referenti: true } });
  assert.equal(saved.telefono, "02000000");
  assert.equal(saved.note, "Referenti aggiornati");
  assert.equal(saved.partitaIva, first.partitaIva);
  assert.equal(saved.codiceFiscale, first.codiceFiscale);
  assert.equal(saved.referenti.length, 2);
  assert.equal(await db.referente.count({ where: { anagraficaId: other.id } }), 0);
  assert.equal((await db.anagrafica.findUniqueOrThrow({ where: { id: other.id } })).updatedAt.toISOString(), other.updatedAt.toISOString());
});

test("anagrafiche: una patch senza dati fiscali non li cancella né blocca il salvataggio", async () => {
  const { first } = await legacyPair(2);
  await run("admin", { type: "salvaAnagrafica", id: first.id, data: { email: "contatto@example.test" } });
  const saved = await db.anagrafica.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(saved.email, "contatto@example.test");
  assert.equal(saved.partitaIva, first.partitaIva);
  assert.equal(saved.codiceFiscale, first.codiceFiscale);
});

test("anagrafiche: la validazione è per campo, un duplicato invariato non blocca la correzione dell'altro dato", async () => {
  const { first } = await legacyPair(3);
  await run("admin", { type: "salvaAnagrafica", id: first.id, data: { partitaIva: "30000000003", codiceFiscale: first.codiceFiscale } });
  assert.equal((await db.anagrafica.findUniqueOrThrow({ where: { id: first.id } })).partitaIva, "30000000003");
  const pair = await legacyPair(4);
  await run("admin", { type: "salvaAnagrafica", id: pair.first.id, data: { partitaIva: pair.first.partitaIva, codiceFiscale: "NUOVOFISCALE4" } });
  assert.equal((await db.anagrafica.findUniqueOrThrow({ where: { id: pair.first.id } })).codiceFiscale, "NUOVOFISCALE4");
});

test("anagrafiche: un nuovo conflitto blocca atomicamente il salvataggio e identifica scheda e campo effettivi", async () => {
  const { first } = await legacyPair(5);
  const target = await db.anagrafica.create({ data: { id: "taken-piva", ragioneSociale: "Fornitore del conflitto", codiceFornitore: "F0099", isFornitore: true, partitaIva: "20000000005" } });
  await assert.rejects(run("admin", { type: "salvaAnagrafica", id: first.id,
    data: { partitaIva: target.partitaIva, codiceFiscale: first.codiceFiscale, note: "Non deve salvarsi" }, referenti: [{ nome: "Non", cognome: "Salvato" }] }), (error: unknown) => {
    assert.ok(error instanceof DuplicateError);
    assert.equal(error.code, "DUPLICATE");
    assert.match(error.message, /Fornitore del conflitto.*F0099/);
    assert.deepEqual(error.conflicts, [{ id: target.id, ragioneSociale: target.ragioneSociale, codiceCliente: null, codiceFornitore: "F0099", campi: ["partitaIva"] }]);
    return true;
  });
  const saved = await db.anagrafica.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(saved.partitaIva, first.partitaIva);
  assert.equal(saved.note, null);
  assert.equal(await db.referente.count({ where: { anagraficaId: first.id } }), 0);
});

test("anagrafiche: nuove schede e nuovi codici fiscali duplicati sono rifiutati anche con maiuscole diverse", async () => {
  const { first } = await legacyPair(6);
  const count = await db.anagrafica.count();
  await assert.rejects(run("admin", { type: "salvaAnagrafica", data: { ragioneSociale: "Nuova duplicata", isCliente: true, partitaIva: first.partitaIva } }), /già presenti/);
  await assert.rejects(run("admin", { type: "salvaAnagrafica", data: { ragioneSociale: "Nuova duplicata CF", isCliente: true, codiceFiscale: first.codiceFiscale!.toLowerCase() } }), /già presenti/);
  assert.equal(await db.anagrafica.count(), count);
  const row = await db.anagrafica.create({ data: { id: "changing-cf", ragioneSociale: "Azienda senza CF", isCliente: true } });
  await assert.rejects(run("admin", { type: "salvaAnagrafica", id: row.id, data: { codiceFiscale: first.codiceFiscale!.toLowerCase() } }), (error: unknown) => {
    assert.ok(error instanceof DuplicateError);
    assert.ok(error.conflicts.every((a) => a.campi.length === 1 && a.campi[0] === "codiceFiscale"));
    return true;
  });
});

test("anagrafiche: pulizia di spazi/maiuscole su un dato invariato e cancellazione esplicita restano consentite", async () => {
  const { first } = await legacyPair(7);
  await run("admin", { type: "salvaAnagrafica", id: first.id, data: { partitaIva: `  ${first.partitaIva}  `, codiceFiscale: first.codiceFiscale!.toLowerCase(), note: "Dati equivalenti" } });
  await run("admin", { type: "salvaAnagrafica", id: first.id, data: { partitaIva: null, codiceFiscale: null } });
  const saved = await db.anagrafica.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(saved.partitaIva, null);
  assert.equal(saved.codiceFiscale, null);
  assert.equal(saved.note, "Dati equivalenti");
});

test("anagrafiche: il confronto usa il DB e conserva la protezione da versioni obsolete", async () => {
  const { first } = await legacyPair(8);
  await db.anagrafica.update({ where: { id: first.id }, data: { partitaIva: "40000000008", updatedAt: new Date(first.updatedAt.getTime() + 1000) } });
  await assert.rejects(run("admin", { type: "salvaAnagrafica", id: first.id, expectedUpdatedAt: first.updatedAt.toISOString(), data: { partitaIva: first.partitaIva, note: "Versione obsoleta" } }), /modificato/);
  // Senza versione, ripristinare il vecchio valore è comunque una modifica:
  // non può eludere il controllo dicendo che era il valore iniziale del form.
  await assert.rejects(run("admin", { type: "salvaAnagrafica", id: first.id, data: { partitaIva: first.partitaIva } }), /già presenti/);
});

test("anagrafiche: due creazioni concorrenti non introducono un duplicato fiscale", async () => {
  const results = await Promise.allSettled(["Prima", "Seconda"].map((ragioneSociale) => run("admin", { type: "salvaAnagrafica", data: { ragioneSociale, isCliente: true, partitaIva: "50000000009" } })));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const rejected = results.find((r) => r.status === "rejected");
  assert.ok(rejected?.status === "rejected" && rejected.reason instanceof DuplicateError);
  assert.equal(await db.anagrafica.count({ where: { partitaIva: "50000000009" } }), 1);
});

test("anagrafiche AI: stessa correzione dei duplicati storici, scrittura registrata e retry idempotente", async () => {
  const { first } = await legacyPair(9);
  await db.aiConversation.create({ data: { id: "chat-anagrafica", userId: "admin", title: "Modifica contatti" } });
  const { submitOperation } = await import("./ai/operations");
  const command = { type: "salvaAnagrafica", id: first.id, expectedUpdatedAt: first.updatedAt.toISOString(), data: { partitaIva: first.partitaIva, codiceFiscale: first.codiceFiscale, telefono: "03000000" } };
  const firstRun = await submitOperation("admin", "chat-anagrafica", "request-anagrafica", command);
  const retry = await submitOperation("admin", "chat-anagrafica", "request-anagrafica", command);
  assert.equal(firstRun.status, "COMPLETED");
  assert.equal(firstRun.operationId, retry.operationId);
  assert.equal((await db.anagrafica.findUniqueOrThrow({ where: { id: first.id } })).telefono, "03000000");
});
