import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { testDatabase } from "../../scripts/test-database";
import { saveOperaio, saveSquadra, assignSquadra, removeOperaio } from "./risorse";
import { executeCommand } from "./crm/commands";
import { saveSal } from "./cantiere";
import { avvisiAssegnazioni } from "./assegnazioni";

test("risorse e SAL: permessi, transazioni, versioni e storico su Postgres isolato", async (t) => {
  const database = testDatabase();
  process.env.DATABASE_URL = database.url;
  const db = (await import("./prisma")).prisma;
  const { serializable: tx } = await import("./transaction");
  const fields = { nome: "Luca", cognome: "Marini", qualifica: "Elettricista", telefono: null, note: null, attivo: true };
  const workerData = { ...fields, squadre: [] as string[] };
  const teamData = { nome: "Installazioni", note: null, attiva: true, membri: ["a", "b"] };
  let mainTeamId: string;
  let secondTeamId: string;
  const teamInput = async () => {
    const team = await db.squadra.findUniqueOrThrow({ where: { id: mainTeamId } });
    return { squadraId: team.id, expectedUpdatedAt: team.updatedAt.toISOString(), dal: "2026-11-01", al: "2026-11-30" };
  };
  const memberships = async (id: string) => (await db.operaio.findUniqueOrThrow({ where: { id }, include: { squadre: { orderBy: { nome: "asc" } } } })).squadre.map((s) => s.nome);
  try {
    for (const [id, ruolo] of [["admin", "SUPER_ADMIN"], ["pm", "PROJECT_MANAGER"], ["reader", "AMMINISTRAZIONE"], ["tecnico", "UFFICIO_TECNICO"]]) await db.user.create({ data: { id, nome: id, cognome: "Collaudo", email: `${id}@example.test`, ruolo, passwordHash: "unused" } });
    await db.anagrafica.create({ data: { id: "client", ragioneSociale: "Officina Nord", isCliente: true } });
    for (const [i, id] of ["job", "other", "private"].entries()) await db.commessa.create({ data: { id, numero: `R${i}`, anno: 2026, progressivo: i + 1, clienteId: "client", pmId: id === "private" ? null : "pm", stato: "IN_ESECUZIONE" } });
    await db.operaio.createMany({ data: [{ id: "a", ...fields }, { id: "b", ...fields, nome: "Giulia" }, { id: "c", ...fields, nome: "Paolo" }] });

    await t.test("gestione personale e squadre protetta anche fuori UI", async () => {
      for (const actor of ["reader", "tecnico"]) {
        await assert.rejects(tx((d) => saveSquadra(d, actor, null, teamData)), /permessi/);
        await assert.rejects(tx((d) => saveOperaio(d, actor, null, workerData)), /permessi/);
      }
      mainTeamId = (await tx((d) => saveSquadra(d, "admin", null, teamData))).id;
      assert.equal(await db.operaio.count({ where: { squadre: { some: { id: mainTeamId } } } }), 2);
      await assert.rejects(tx((d) => saveSquadra(d, "admin", null, { ...teamData, nome: "installazioni", membri: [] })), /già una squadra/);
    });
    await t.test("impegni contemporanei salvati con avviso per persona, senza esporre il cantiere", async () => {
      await db.assegnazioneOperaio.create({ data: { commessaId: "private", operaioId: "b", dal: new Date("2026-11-15"), al: new Date("2026-11-30") } });
      const input = await teamInput();
      const saved = await tx((d) => assignSquadra(d, "pm", "job", input));
      assert.equal(await db.assegnazioneOperaio.count({ where: { commessaId: "job" } }), 2);
      assert.deepEqual(saved.warnings, ["Giulia Marini: già assegnato ad altri cantieri nel periodo indicato."]);
      assert.doesNotMatch(JSON.stringify(saved), /private|R2|Officina/);
      await assert.rejects(tx((d) => assignSquadra(d, "pm", "private", input)), /non assegnata/);
      await assert.rejects(tx((d) => assignSquadra(d, "reader", "job", input)), /permessi/);
    });
    await t.test("retry concorrenti non duplicano componenti e conservano modifiche locali", async () => {
      const input = await teamInput();
      await Promise.all([tx((d) => assignSquadra(d, "pm", "job", input)), tx((d) => assignSquadra(d, "pm", "job", input))]);
      assert.equal(await db.assegnazioneOperaio.count({ where: { commessaId: "job" } }), 2);
      await tx((d) => executeCommand(d, "pm", { type: "assegnaOperaio", commessaId: "job", operaioId: "a", aggiornaEsistente: true, dal: "2026-11-05", note: "Accesso locale" }));
      const repeated = await tx((d) => assignSquadra(d, "pm", "job", input));
      assert.equal(repeated.warnings.length, 1); // anche i componenti già presenti
      const row = await db.assegnazioneOperaio.findUniqueOrThrow({ where: { commessaId_operaioId: { commessaId: "job", operaioId: "a" } } });
      assert.equal(row.dal?.toISOString().slice(0, 10), "2026-11-05"); assert.equal(row.note, "Accesso locale");
    });
    await t.test("appartenenze multiple per ogni qualifica; squadre condivise senza duplicati in cantiere", async () => {
      secondTeamId = (await tx((d) => saveSquadra(d, "admin", null, { ...teamData, nome: "Manutenzione" }))).id;
      assert.deepEqual(await memberships("a"), ["Installazioni", "Manutenzione"]);
      const second = await db.squadra.findUniqueOrThrow({ where: { id: secondTeamId } });
      const before = await db.assegnazioneOperaio.findMany({ where: { commessaId: "job" }, orderBy: { id: "asc" } });
      const assigned = await tx((d) => assignSquadra(d, "pm", "job", { squadraId: second.id, expectedUpdatedAt: second.updatedAt.toISOString(), dal: "2027-01-01", al: "2027-02-01" }));
      assert.match(assigned.message, /^0 componenti assegnati/);
      assert.equal(assigned.warnings.length, 1); // usa le date conservate, non quelle richieste
      assert.deepEqual(await db.assegnazioneOperaio.findMany({ where: { commessaId: "job" }, orderBy: { id: "asc" } }), before);
      const worker = await tx((d) => saveOperaio(d, "admin", null, { ...workerData, qualifica: "PM", squadre: [mainTeamId, secondTeamId] }));
      assert.deepEqual(await memberships(worker.id), ["Installazioni", "Manutenzione"]);
      await tx((d) => saveOperaio(d, "admin", worker.id, { ...workerData, qualifica: "PM", squadre: [secondTeamId], expectedUpdatedAt: worker.updatedAt.toISOString() }));
      assert.deepEqual(await memberships(worker.id), ["Manutenzione"]);
      await assert.rejects(tx((d) => saveOperaio(d, "admin", worker.id, { ...workerData, squadre: [], expectedUpdatedAt: worker.updatedAt.toISOString() })), /modificati/);
      const current = await db.operaio.findUniqueOrThrow({ where: { id: worker.id } });
      await tx((d) => removeOperaio(d, "admin", worker.id, current.updatedAt.toISOString()));
    });
    await t.test("modifica squadra e rinomina non cambiano i cantieri; versioni obsolete respinte", async () => {
      const before = await db.squadra.findUniqueOrThrow({ where: { id: mainTeamId } });
      const row = await tx((d) => saveSquadra(d, "admin", before.id, { ...teamData, nome: "Impianti Nord", membri: ["a", "c"], expectedUpdatedAt: before.updatedAt.toISOString() }));
      assert.deepEqual(await memberships("a"), [row.nome, "Manutenzione"]);
      assert.deepEqual(await memberships("b"), ["Manutenzione"]);
      assert.deepEqual((await db.assegnazioneOperaio.findMany({ where: { commessaId: "job" }, orderBy: { operaioId: "asc" } })).map((a) => a.operaioId), ["a", "b"]);
      await assert.rejects(tx((d) => saveSquadra(d, "admin", before.id, { ...teamData, expectedUpdatedAt: before.updatedAt.toISOString() })), /modificati/);
      await assert.rejects(tx(async (d) => assignSquadra(d, "pm", "other", { ...await teamInput(), expectedUpdatedAt: before.updatedAt.toISOString() })), /modificati/);
    });
    await t.test("disattivazione conserva storico; squadre archiviate non assegnabili", async () => {
      const worker = await db.operaio.findUniqueOrThrow({ where: { id: "a" } });
      await tx((d) => removeOperaio(d, "admin", "a", worker.updatedAt.toISOString()));
      assert.equal(await db.assegnazioneOperaio.count({ where: { operaioId: "a" } }), 1);
      await tx(async (d) => assignSquadra(d, "tecnico", "other", await teamInput()));
      assert.equal(await db.assegnazioneOperaio.count({ where: { commessaId: "other" } }), 1);
      const before = await db.squadra.findUniqueOrThrow({ where: { id: mainTeamId } });
      await tx((d) => saveSquadra(d, "admin", before.id, { ...teamData, nome: before.nome, attiva: false, membri: ["a", "c"], expectedUpdatedAt: before.updatedAt.toISOString() }));
      await assert.rejects(tx(async (d) => assignSquadra(d, "pm", "job", await teamInput())), /squadra attiva/);
      const inactive = await db.operaio.findUniqueOrThrow({ where: { id: "a" } });
      await tx((d) => saveOperaio(d, "admin", "a", { ...workerData, attivo: false, squadre: [mainTeamId, secondTeamId], expectedUpdatedAt: inactive.updatedAt.toISOString() }));
      await assert.rejects(tx((d) => saveOperaio(d, "admin", null, { ...workerData, squadre: [mainTeamId] })), /squadre attive/);
    });
    await t.test("intervalli inclusivi, estremi aperti, periodi disgiunti e cantieri conclusi", async () => {
      const person = { operaioId: "b", nome: "Giulia", cognome: "Marini" };
      const check = (dal: string | null, al: string | null) => avvisiAssegnazioni(db, "job", [{ ...person, dal: dal ? new Date(dal) : null, al: al ? new Date(al) : null }]);
      assert.equal((await check("2026-11-30", "2026-12-01")).length, 1);
      assert.equal((await check("2026-12-01", null)).length, 0);
      assert.equal((await check(null, "2026-11-14")).length, 0);
      assert.equal((await check(null, null)).length, 1);
      await db.commessa.update({ where: { id: "private" }, data: { dataFineLavori: new Date("2026-11-30") } });
      assert.equal((await check(null, null)).length, 0);
      await db.commessa.update({ where: { id: "private" }, data: { dataFineLavori: null, stato: "FATTURATA" } });
      assert.equal((await check(null, null)).length, 0);
    });
    await t.test("SAL senza durata bloccato; snapshot ponderati immutabili dopo ripianificazione", async () => {
      await tx((d) => executeCommand(d, "pm", { type: "creaMilestone", commessaId: "job", milestone: [{ titolo: "Sopralluogo", durataGiorni: 1 }, { titolo: "Lavorazione" }] }));
      const payload = async () => ({ richiestaId: randomUUID(), versione: (await db.commessa.findUniqueOrThrow({ where: { id: "job" } })).versioneOperativa, data: "2026-10-20", nota: "Collaudo ponderazione", milestone: (await db.milestone.findMany({ where: { commessaId: "job" }, orderBy: { ordine: "asc" } })).map((m) => ({ id: m.id, versione: m.updatedAt.toISOString(), stato: m.ordine === 0 ? "COMPLETATA" : "IN_CORSO" })) });
      await assert.rejects(tx(async (d) => saveSal(d, "pm", "job", await payload())), /durata prevista/);
      assert.equal(await db.aggiornamentoCantiere.count({ where: { tipo: "SAL" } }), 0);
      const long = await db.milestone.findFirstOrThrow({ where: { titolo: "Lavorazione" } });
      await tx((d) => executeCommand(d, "pm", { type: "aggiornaMilestone", id: long.id, data: { durataGiorni: 9 } }));
      const saved = await tx(async (d) => saveSal(d, "pm", "job", await payload()));
      assert.equal((saved.dopo as { percentuale: number }).percentuale, 10);
      assert.equal((saved.dopo as { metodo: string }).metodo, "DURATA_GIORNI_V1");
      await tx((d) => executeCommand(d, "pm", { type: "aggiornaMilestone", id: long.id, data: { durataGiorni: 99 } }));
      assert.deepEqual((await db.aggiornamentoCantiere.findUniqueOrThrow({ where: { id: saved.id } })).dopo, saved.dopo);
      for (const durataGiorni of [0, -5, 36501]) await assert.rejects(tx((d) => executeCommand(d, "pm", { type: "aggiornaMilestone", id: long.id, data: { durataGiorni } })));
    });
    await t.test("migrazione multisquadra conserva appartenenze, squadre archiviate, inattivi, assegnazioni e SAL", async () => {
      const workers = await db.operaio.findMany({ orderBy: { id: "asc" } });
      const teams = await db.squadra.findMany({ orderBy: { id: "asc" } });
      const assignments = await db.assegnazioneOperaio.findMany({ orderBy: { id: "asc" } });
      const history = await db.aggiornamentoCantiere.findMany({ orderBy: { id: "asc" } });
      await db.$executeRawUnsafe('ALTER TABLE "Operaio" ADD COLUMN squadra TEXT');
      await db.$executeRawUnsafe('UPDATE "Operaio" o SET squadra = (SELECT s.nome FROM "_ComponentiSquadra" m JOIN "Squadra" s ON s.id = m."B" WHERE m."A" = o.id ORDER BY s.nome LIMIT 1)');
      const expected = await db.$queryRawUnsafe('SELECT id, squadra FROM "Operaio" ORDER BY id');
      await db.$executeRawUnsafe('DROP TABLE "_ComponentiSquadra"');
      await db.$executeRawUnsafe('CREATE INDEX "Operaio_squadra_idx" ON "Operaio"(squadra)');
      await db.$executeRawUnsafe('ALTER TABLE "Operaio" ADD CONSTRAINT "Operaio_squadra_fkey" FOREIGN KEY (squadra) REFERENCES "Squadra"(nome) ON DELETE RESTRICT ON UPDATE CASCADE');
      const migration = await readFile("prisma/migrations/20261030120000_personale_multisquadra/migration.sql", "utf8");
      await db.$transaction(async (d) => { for (const statement of migration.split(";").filter((s) => s.trim())) await d.$executeRawUnsafe(statement); });
      const actual = (await db.operaio.findMany({ orderBy: { id: "asc" }, include: { squadre: true } })).map((w) => ({ id: w.id, squadra: w.squadre[0]?.nome ?? null }));
      assert.deepEqual(actual, expected);
      assert.deepEqual(await db.operaio.findMany({ orderBy: { id: "asc" } }), workers);
      assert.deepEqual(await db.squadra.findMany({ orderBy: { id: "asc" } }), teams);
      assert.deepEqual(await db.assegnazioneOperaio.findMany({ orderBy: { id: "asc" } }), assignments);
      assert.deepEqual(await db.aggiornamentoCantiere.findMany({ orderBy: { id: "asc" } }), history);
    });
    await t.test("catena migrazioni da gruppi liberi preesistenti conserva inattivi, assegnazioni e SAL", async () => {
      const assignments = await db.assegnazioneOperaio.findMany({ orderBy: { id: "asc" } });
      const history = await db.aggiornamentoCantiere.findMany({ orderBy: { id: "asc" } });
      await db.$executeRawUnsafe('ALTER TABLE "Operaio" ADD COLUMN squadra TEXT');
      await db.$executeRawUnsafe('UPDATE "Operaio" o SET squadra = (SELECT s.nome FROM "_ComponentiSquadra" m JOIN "Squadra" s ON s.id = m."B" WHERE m."A" = o.id ORDER BY s.nome LIMIT 1)');
      await db.$executeRawUnsafe('DROP TABLE "_ComponentiSquadra"');
      await db.$executeRawUnsafe('CREATE INDEX "Operaio_squadra_idx" ON "Operaio"(squadra)');
      await db.$executeRawUnsafe('DROP TABLE "Squadra"');
      await db.$executeRawUnsafe('ALTER TABLE "Milestone" DROP COLUMN "durataGiorni"');
      await db.$executeRawUnsafe(`UPDATE "Operaio" SET squadra = 'Squadra importata' WHERE id = 'b'`);
      const workers = await db.operaio.findMany({ orderBy: { id: "asc" } });
      const migration = await readFile("prisma/migrations/20261029140000_sal_durata_squadre/migration.sql", "utf8");
      for (const statement of migration.split(";").filter((s) => s.trim())) await db.$executeRawUnsafe(statement);
      const multi = await readFile("prisma/migrations/20261030120000_personale_multisquadra/migration.sql", "utf8");
      for (const statement of multi.split(";").filter((s) => s.trim())) await db.$executeRawUnsafe(statement);
      assert.deepEqual(await db.operaio.findMany({ orderBy: { id: "asc" } }), workers);
      assert.equal(await db.squadra.count(), 2);
      assert.deepEqual(await memberships("b"), ["Squadra importata"]);
      assert.deepEqual(await db.assegnazioneOperaio.findMany({ orderBy: { id: "asc" } }), assignments);
      assert.deepEqual(await db.aggiornamentoCantiere.findMany({ orderBy: { id: "asc" } }), history);
      assert.equal(await db.milestone.count({ where: { durataGiorni: { not: null } } }), 0);
    });
  } finally { await database.cleanup(db); }
});
