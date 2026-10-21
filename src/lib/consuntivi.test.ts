import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, PrismaClient } from "@/generated/prisma";
import { testDatabase } from "../../scripts/test-database";
import { consuntivoValues, saveConsuntivo, saveTariffario, tariffarioValues } from "./consuntivi";
import { editableRow } from "./consuntivo-schema";
import { executeCommand } from "./crm/commands";

test("tariffari e consuntivi: calcoli decimali, fotografie delle tariffe e audit atomico", async (t) => {
  const database = testDatabase();
  const db = new PrismaClient({ datasourceUrl: database.url });
  const tx = <T>(fn: (db: Prisma.TransactionClient) => Promise<T>) => db.$transaction(fn, { isolationLevel: "Serializable" });
  const rateInput = { versione: 0, manodopera: [{ id: "elettricista", mansione: "Elettricista", ordinaria: "35", straordinariaFeriale: "45", straordinariaFestiva: "60" }], materiali: [{ id: "cavo", prodottoId: "materiale", ricarico: "20" }] };
  const sheetInput = { versione: 0, versioneTariffario: 1, data: "2026-10-21", note: "Lavoro a consuntivo", righe: [
    { id: "ore", tipo: "ORE" as const, voceId: "elettricista", fascia: "ordinaria" as const, quantita: "2.5", tariffa: "32" },
    { id: "materiali", tipo: "MATERIALE" as const, voceId: "cavo", quantita: "3", costoBase: "10", ricarico: "25" },
  ] };
  try {
    await db.user.createMany({ data: ["admin", "pm", "reader"].map((id) => ({ id, nome: id, cognome: "Test", email: `${id}@example.test`, passwordHash: "unused", ruolo: id === "admin" ? "SUPER_ADMIN" : id === "pm" ? "PROJECT_MANAGER" : "AMMINISTRAZIONE" })) });
    await db.anagrafica.createMany({ data: [{ id: "cliente", ragioneSociale: "Cliente", isCliente: true }, { id: "altro", ragioneSociale: "Altro", isCliente: true }] });
    await db.prodotto.create({ data: { id: "materiale", descrizione: "Cavo elettrico", unitaMisura: "m" } });
    await db.commessa.createMany({ data: [{ id: "job", clienteId: "cliente", numero: "261001", anno: 2026, progressivo: 1001, stato: "IN_ESECUZIONE", tipologia: "C" }, { id: "other-job", clienteId: "altro", numero: "261002", anno: 2026, progressivo: 1002 }] });
    await t.test("tariffario cliente: validazione, autorizzazione effettiva e registrazione autore/prima/dopo", async () => {
      await assert.rejects(tx((d) => saveTariffario(d, "pm", "cliente", rateInput)), /permessi/);
      await assert.rejects(tx((d) => saveTariffario(d, "admin", "cliente", { ...rateInput, manodopera: [...rateInput.manodopera, { ...rateInput.manodopera[0], id: "altro", mansione: " ELETTRICISTA " }] })), /Mansioni duplicate/);
      await assert.rejects(tx((d) => saveTariffario(d, "admin", "cliente", { ...rateInput, materiali: [{ ...rateInput.materiali[0], prodottoId: "inesistente" }] })), /catalogo/);
      const rate = await tx((d) => saveTariffario(d, "admin", "cliente", rateInput));
      assert.equal(rate.versione, 1);
      const log = await db.modificaEconomica.findFirstOrThrow({ where: { entitaId: rate.id } });
      assert.equal(log.autoreNome, "admin Test"); assert.equal(log.prima, null);
      assert.deepEqual(log.dopo, tariffarioValues(rate));
      const unchanged = await tx((d) => saveTariffario(d, "admin", "cliente", { ...rateInput, versione: 1 }));
      assert.equal(unchanged.versione, 1);
      assert.equal(await db.modificaEconomica.count({ where: { entitaId: rate.id } }), 1);
    });
    await t.test("override locali, costi base espliciti, arrotondamenti e totale ricalcolato sul server", async () => {
      await assert.rejects(tx((d) => saveConsuntivo(d, "reader", "job", sheetInput)), /permessi/);
      await assert.rejects(tx((d) => saveConsuntivo(d, "admin", "other-job", sheetInput)), /modificati|tariffario/);
      await assert.rejects(tx((d) => saveConsuntivo(d, "admin", "job", { ...sheetInput, totale: "1" })), /Unrecognized key/);
      await assert.rejects(tx((d) => saveConsuntivo(d, "admin", "job", { ...sheetInput, righe: [{ ...sheetInput.righe[1], costoBase: "" }] })));
      await assert.rejects(tx((d) => saveConsuntivo(d, "admin", "job", { ...sheetInput, righe: [{ ...sheetInput.righe[0], quantita: "-1" }] })));
      const sheet = await tx((d) => saveConsuntivo(d, "pm", "job", sheetInput));
      assert.equal(sheet.totale.toFixed(2), "117.50");
      assert.equal(sheet.totaleOre.toFixed(2), "80.00"); assert.equal(sheet.totaleMateriali.toFixed(2), "37.50");
      const rows = consuntivoValues(sheet).righe;
      assert.equal(rows[0].valoreListino, "35.0000"); assert.equal(rows[1].valoreListino, "20.0000");
      assert.equal(rows[1].prezzoUnitario, "12.5000");
      assert.equal(tariffarioValues(await db.tariffarioCliente.findUniqueOrThrow({ where: { clienteId: "cliente" } })).manodopera[0].ordinaria, "35.0000");
      await assert.rejects(tx((d) => executeCommand(d, "admin", { type: "salvaCommessa", id: "job", data: { clienteId: "altro" } })), /cliente deve restare/);
      const job = await db.commessa.findUniqueOrThrow({ where: { id: "job" } });
      assert.equal(job.importoOrdine, null); assert.equal(job.importoOfferta, null); assert.equal(job.stato, "IN_ESECUZIONE");
    });
    await t.test("aggiornare il tariffario non rivaluta vecchie righe; nuove voci richiedono la versione corrente", async () => {
      await tx((d) => saveTariffario(d, "admin", "cliente", { ...rateInput, versione: 1, manodopera: [{ ...rateInput.manodopera[0], ordinaria: "50" }] }));
      const sheet = await tx((d) => saveConsuntivo(d, "pm", "job", { ...sheetInput, versione: 1, righe: [{ ...sheetInput.righe[0], quantita: "3" }, sheetInput.righe[1]] }));
      assert.equal(sheet.totale.toFixed(2), "133.50");
      assert.equal(consuntivoValues(sheet).righe[0].valoreListino, "35.0000");
      assert.equal(consuntivoValues(sheet).righe[0].versioneTariffario, 1);
      await assert.rejects(tx((d) => saveConsuntivo(d, "pm", "job", { ...sheetInput, versione: 2, righe: [...sheetInput.righe, { ...sheetInput.righe[0], id: "nuova" }] })), /modificati/);
      const round = await tx((d) => saveConsuntivo(d, "pm", "job", { ...sheetInput, versione: 2, versioneTariffario: 2, righe: [...consuntivoValues(sheet).righe.map(editableRow), { ...sheetInput.righe[0], id: "nuova", quantita: "0.1", tariffa: "0.15" }] }));
      assert.equal(consuntivoValues(round).righe[2].totale, "0.02");
      assert.equal(consuntivoValues(round).righe[2].valoreListino, "50.0000");
      const log = await db.modificaEconomica.findUniqueOrThrow({ where: { entita_entitaId_versione: { entita: "CONSUNTIVO", entitaId: round.id, versione: 3 } } });
      assert.deepEqual(log.prima, consuntivoValues(sheet)); assert.deepEqual(log.dopo, consuntivoValues(round));
    });
    await t.test("rollback audit, salvataggio invariato, richieste concorrenti e revoca ruolo", async () => {
      const original = await db.consuntivo.findUniqueOrThrow({ where: { commessaId: "job" } });
      const values = consuntivoValues(original);
      const input = { versione: values.versione, versioneTariffario: 2, data: values.data, note: values.note, righe: values.righe.map(editableRow) };
      await tx((d) => saveConsuntivo(d, "pm", "job", input));
      assert.equal(await db.modificaEconomica.count({ where: { entitaId: original.id } }), 3);
      await assert.rejects(tx(async (d) => { await saveConsuntivo(d, "pm", "job", { ...input, note: "Non deve restare" }); throw new Error("rollback"); }), /rollback/);
      assert.equal((await db.consuntivo.findUniqueOrThrow({ where: { id: original.id } })).note, original.note);
      assert.equal(await db.modificaEconomica.count({ where: { entitaId: original.id } }), 3);
      const outcomes = await Promise.allSettled(["A", "B"].map((note) => tx((d) => saveConsuntivo(d, "pm", "job", { ...input, note }))));
      assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(await db.modificaEconomica.count({ where: { entitaId: original.id } }), 4);
      await db.user.update({ where: { id: "pm" }, data: { ruolo: "AMMINISTRAZIONE" } });
      await assert.rejects(tx((d) => saveConsuntivo(d, "pm", "job", { ...input, versione: 4 })), /permessi/);
      await db.user.delete({ where: { id: "pm" } });
      const historical = await db.modificaEconomica.findFirstOrThrow({ where: { entitaId: original.id } });
      assert.equal(historical.autoreId, null); assert.equal(historical.autoreNome, "pm Test");
    });
  } finally { await database.cleanup(db); }
});
