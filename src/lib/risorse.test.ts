import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { testDatabase } from "../../scripts/test-database";
import { saveOperaio, saveSquadra, assignSquadra, removeOperaio } from "./risorse";
import { executeCommand } from "./crm/commands";
import { saveSal } from "./cantiere";

test("risorse e SAL: permessi, transazioni, versioni e storico su Postgres isolato", async (t) => {
  const database = testDatabase();
  process.env.DATABASE_URL = database.url;
  const db = (await import("./prisma")).prisma;
  const { serializable: tx } = await import("./transaction");
  const fields = { nome: "Luca", cognome: "Marini", qualifica: "Elettricista", squadra: null, telefono: null, note: null, attivo: true };
  const teamData = { nome: "Installazioni", note: null, attiva: true, membri: ["a", "b"] };
  const teamInput = async () => {
    const team = await db.squadra.findFirstOrThrow();
    return { squadraId: team.id, expectedUpdatedAt: team.updatedAt.toISOString(), dal: "2026-11-01", al: "2026-11-30" };
  };
  try {
    for (const [id, ruolo] of [["admin", "SUPER_ADMIN"], ["pm", "PROJECT_MANAGER"], ["reader", "AMMINISTRAZIONE"], ["tecnico", "UFFICIO_TECNICO"]]) await db.user.create({ data: { id, nome: id, cognome: "Collaudo", email: `${id}@example.test`, ruolo, passwordHash: "unused" } });
    await db.anagrafica.create({ data: { id: "client", ragioneSociale: "Officina Nord", isCliente: true } });
    for (const [i, id] of ["job", "other", "private"].entries()) await db.commessa.create({ data: { id, numero: `R${i}`, anno: 2026, progressivo: i + 1, clienteId: "client", pmId: id === "private" ? null : "pm", stato: "IN_ESECUZIONE" } });
    await db.operaio.createMany({ data: [{ id: "a", ...fields }, { id: "b", ...fields, nome: "Giulia" }, { id: "c", ...fields, nome: "Paolo" }] });

    await t.test("gestione personale e squadre protetta anche fuori UI", async () => {
      for (const actor of ["reader", "tecnico"]) {
        await assert.rejects(tx((d) => saveSquadra(d, actor, null, teamData)), /permessi/);
        await assert.rejects(tx((d) => saveOperaio(d, actor, null, fields)), /permessi/);
      }
      await tx((d) => saveSquadra(d, "admin", null, teamData));
      assert.equal(await db.operaio.count({ where: { squadra: teamData.nome } }), 2);
      await assert.rejects(tx((d) => saveSquadra(d, "admin", null, { ...teamData, nome: "installazioni", membri: [] })), /già una squadra/);
    });
    await t.test("conflitto di un membro annulla l’intera assegnazione, senza esporre il cantiere", async () => {
      await db.assegnazioneOperaio.create({ data: { commessaId: "private", operaioId: "b", dal: new Date("2026-11-15"), al: new Date("2026-11-30") } });
      const input = await teamInput();
      await assert.rejects(tx((d) => assignSquadra(d, "pm", "job", input)), /Giulia.*Nessun componente aggiunto/);
      assert.equal(await db.assegnazioneOperaio.count({ where: { commessaId: "job" } }), 0);
      await db.assegnazioneOperaio.deleteMany({ where: { commessaId: "private" } });
      await assert.rejects(tx((d) => assignSquadra(d, "pm", "private", input)), /non assegnata/);
      await assert.rejects(tx((d) => assignSquadra(d, "reader", "job", input)), /permessi/);
    });
    await t.test("retry concorrenti non duplicano componenti e conservano modifiche locali", async () => {
      const input = await teamInput();
      await Promise.all([tx((d) => assignSquadra(d, "pm", "job", input)), tx((d) => assignSquadra(d, "pm", "job", input))]);
      assert.equal(await db.assegnazioneOperaio.count({ where: { commessaId: "job" } }), 2);
      await tx((d) => executeCommand(d, "pm", { type: "assegnaOperaio", commessaId: "job", operaioId: "a", aggiornaEsistente: true, dal: "2026-11-05", note: "Accesso locale" }));
      await tx((d) => assignSquadra(d, "pm", "job", input));
      const row = await db.assegnazioneOperaio.findUniqueOrThrow({ where: { commessaId_operaioId: { commessaId: "job", operaioId: "a" } } });
      assert.equal(row.dal?.toISOString().slice(0, 10), "2026-11-05"); assert.equal(row.note, "Accesso locale");
    });
    await t.test("modifica squadra e rinomina non cambiano i cantieri; versioni obsolete respinte", async () => {
      const before = await db.squadra.findFirstOrThrow();
      const row = await tx((d) => saveSquadra(d, "admin", before.id, { ...teamData, nome: "Impianti Nord", membri: ["a", "c"], expectedUpdatedAt: before.updatedAt.toISOString() }));
      assert.equal((await db.operaio.findUniqueOrThrow({ where: { id: "a" } })).squadra, row.nome);
      assert.equal((await db.operaio.findUniqueOrThrow({ where: { id: "b" } })).squadra, null);
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
      const before = await db.squadra.findFirstOrThrow();
      await tx((d) => saveSquadra(d, "admin", before.id, { ...teamData, nome: before.nome, attiva: false, membri: ["a", "c"], expectedUpdatedAt: before.updatedAt.toISOString() }));
      await assert.rejects(tx(async (d) => assignSquadra(d, "pm", "job", await teamInput())), /squadra attiva/);
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
    await t.test("migrazione conserva gruppi liberi preesistenti, inattivi, assegnazioni e SAL storici", async () => {
      const assignments = await db.assegnazioneOperaio.findMany({ orderBy: { id: "asc" } });
      const history = await db.aggiornamentoCantiere.findMany({ orderBy: { id: "asc" } });
      await db.$executeRawUnsafe('ALTER TABLE "Operaio" DROP CONSTRAINT "Operaio_squadra_fkey"');
      await db.$executeRawUnsafe('DROP TABLE "Squadra"');
      await db.$executeRawUnsafe('ALTER TABLE "Milestone" DROP COLUMN "durataGiorni"');
      await db.operaio.update({ where: { id: "b" }, data: { squadra: "Squadra importata" } });
      const workers = await db.operaio.findMany({ orderBy: { id: "asc" } });
      const migration = await readFile("prisma/migrations/20261029140000_sal_durata_squadre/migration.sql", "utf8");
      for (const statement of migration.split(";").filter((s) => s.trim())) await db.$executeRawUnsafe(statement);
      assert.deepEqual(await db.operaio.findMany({ orderBy: { id: "asc" } }), workers);
      assert.equal(await db.squadra.count(), 2);
      assert.deepEqual(await db.assegnazioneOperaio.findMany({ orderBy: { id: "asc" } }), assignments);
      assert.deepEqual(await db.aggiornamentoCantiere.findMany({ orderBy: { id: "asc" } }), history);
      assert.equal(await db.milestone.count({ where: { durataGiorni: { not: null } } }), 0);
    });
  } finally { await database.cleanup(db); }
});
