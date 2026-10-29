import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { testDatabase } from "../../scripts/test-database";
import { saveSal, createProblema, updateProblema, setSospensione } from "./cantiere";
import { commessaScope, documentoScope } from "./access";
import { avanzamento, statoAvanzamento } from "./progetti";
import { getDashboard } from "./dashboard";

test("cantiere: SAL, problemi, allegati, permessi e concorrenza su Postgres isolato", async (t) => {
  const database = testDatabase();
  const oldUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.url;
  const db = (await import("./prisma")).prisma;
  const { serializable: tx } = await import("./transaction");
  const { notificationScope, notifyDueTasks } = await import("./notifiche");
  const { historyAccess } = await import("./ai/history-access");
  const { eliminaUtente } = await import("./utenti");
  const pm = { id: "pm", ruolo: "PROJECT_MANAGER" };
  const problemInput = () => ({ richiestaId: randomUUID(), titolo: "Quadro incompleto", descrizione: "Manca un interruttore", priorita: "ALTA", assegnatarioId: "collega", scadenza: "2026-10-20", creaAttivita: true });
  const salInput = async () => {
    const c = await db.commessa.findUniqueOrThrow({ where: { id: "job" } });
    const rows = await db.milestone.findMany({ where: { commessaId: "job", dimostrativa: false }, orderBy: { ordine: "asc" } });
    return { richiestaId: randomUUID(), versione: c.versioneOperativa, data: "2026-10-20", nota: "Verifica lavori", milestone: rows.map((m) => ({ id: m.id, versione: m.updatedAt.toISOString(), stato: "COMPLETATA" })) };
  };
  try {
    for (const [id, ruolo] of [["admin", "SUPER_ADMIN"], ["pm", "PROJECT_MANAGER"], ["collega", "PROJECT_MANAGER"], ["reader", "AMMINISTRAZIONE"]]) await db.user.create({ data: { id, ruolo, nome: id, cognome: "Collaudo", email: `${id}@test.invalid`, passwordHash: "unused" } });
    await db.anagrafica.create({ data: { id: "cliente", ragioneSociale: "Impianti Nord", isCliente: true } });
    for (const [i, id] of ["job", "privato", "demo"].entries()) await db.commessa.create({ data: { id, numero: `TEST${i}`, anno: 2026, progressivo: i + 1, clienteId: "cliente", pmId: id === "privato" ? null : "pm", stato: "IN_ESECUZIONE" } });
    await db.milestone.createMany({ data: [
      { id: "reale-1", commessaId: "job", titolo: "Rilievo", ordine: 0, durataGiorni: 1 }, { id: "reale-2", commessaId: "job", titolo: "Posa", ordine: 1, durataGiorni: 60 },
      { id: "demo-1", commessaId: "job", titolo: "Esempio", ordine: 2, dimostrativa: true, dataPianificata: new Date("2020-01-01") },
      { id: "demo-2", commessaId: "demo", titolo: "Solo esempio", ordine: 0, dimostrativa: true, stato: "COMPLETATA" },
    ] });
    await db.documento.createMany({ data: [
      { id: "foto", commessaId: "job", nomeFile: "foto.jpg", categoria: "FOTO", percorso: "test/foto.jpg" },
      { id: "preventivo", commessaId: "job", nomeFile: "offerta.pdf", categoria: "OFFERTA", percorso: "test/offerta.pdf" },
      { id: "esterno", commessaId: "privato", nomeFile: "esterno.jpg", categoria: "FOTO", percorso: "test/esterno.jpg" },
    ] });
    await t.test("nega SAL fuori scope e ai lettori, milestone demo escluse", async () => {
      const input = await salInput();
      await assert.rejects(tx((d) => saveSal(d, "pm", "privato", input)), /non assegnata/);
      await assert.rejects(tx((d) => saveSal(d, "reader", "job", input)), /permessi/);
      await assert.rejects(tx((d) => saveSal(d, "pm", "demo", { ...input, milestone: [] })), /milestone reale/);
      const rows = await db.milestone.findMany({ where: { commessaId: "job" } });
      assert.equal(avanzamento(rows).totali, 2);
      assert.equal(statoAvanzamento({ stato: "IN_ESECUZIONE", milestone: rows }), "IN_CORSO");
    });
    await t.test("allegati esterni/economici negati con rollback delle milestone e dello storico", async () => {
      const input = await salInput();
      for (const id of ["esterno", "preventivo"]) await assert.rejects(tx((d) => saveSal(d, "pm", "job", { ...input, documenti: [id] })), /allegato/);
      assert.equal(await db.aggiornamentoCantiere.count(), 0);
      assert.equal(await db.milestone.count({ where: { commessaId: "job", stato: "COMPLETATA" } }), 0);
      assert.equal((await db.commessa.findUniqueOrThrow({ where: { id: "job" } })).versioneOperativa, 0);
    });
    await t.test("SAL concorrente identico produce un solo storico e conserva allegati", async () => {
      const input = { ...await salInput(), documenti: ["foto"] };
      const rows = await Promise.all([tx((d) => saveSal(d, "pm", "job", input)), tx((d) => saveSal(d, "pm", "job", input))]);
      assert.equal(rows[0].id, rows[1].id);
      assert.equal(await db.aggiornamentoCantiere.count(), 1);
      assert.equal((rows[0].dopo as { percentuale: number }).percentuale, 100);
      assert.equal((await db.documento.findUniqueOrThrow({ where: { id: "foto" } })).aggiornamentoId, rows[0].id);
      await assert.rejects(tx((d) => saveSal(d, "pm", "job", { ...input, nota: "Retry alterato" })), /già utilizzata/);
      await assert.rejects(tx((d) => saveSal(d, "pm", "job", { ...input, richiestaId: randomUUID() })), /aggiornato/);
    });
    await t.test("versione milestone obsoleta impedisce una riscrittura", async () => {
      const input = await salInput();
      await db.milestone.update({ where: { id: "reale-1" }, data: { titolo: "Rilievo corretto", updatedAt: new Date(Date.now() + 1000) } });
      await assert.rejects(tx((d) => saveSal(d, "pm", "job", input)), /milestone è stata modificata/);
    });
    await t.test("sospensione separata dallo stato commerciale e ripresa versionata", async () => {
      const input = { richiestaId: randomUUID(), versione: 0, sospeso: true, motivo: "Attesa accesso" };
      await tx((d) => setSospensione(d, "pm", "demo", input));
      await tx((d) => setSospensione(d, "pm", "demo", input));
      const job = await db.commessa.findUniqueOrThrow({ where: { id: "demo" }, include: { milestone: true } });
      assert.equal(job.stato, "IN_ESECUZIONE"); assert.equal(statoAvanzamento(job), "SOSPESO");
      await assert.rejects(tx((d) => setSospensione(d, "pm", "demo", { ...input, richiestaId: randomUUID(), sospeso: false })), /cambiato/);
      await tx((d) => setSospensione(d, "pm", "demo", { ...input, richiestaId: randomUUID(), versione: 1, sospeso: false }));
    });
    let problemId = "";
    await t.test("problema concorrente: una attività, un evento, una notifica e accesso del responsabile", async () => {
      const input = problemInput();
      const rows = await Promise.all([tx((d) => createProblema(d, "pm", "job", input)), tx((d) => createProblema(d, "pm", "job", input))]);
      problemId = rows[0].id; assert.equal(rows[1].id, problemId);
      assert.equal(await db.attivita.count({ where: { problemaId: problemId } }), 1);
      assert.equal(await db.eventoProblema.count({ where: { problemaId: problemId } }), 1);
      assert.equal(await db.notifica.count({ where: { href: `/problemi/${problemId}` } }), 1);
      assert.equal(await db.commessa.count({ where: { id: "job", ...commessaScope({ id: "collega", ruolo: "PROJECT_MANAGER" }) } }), 1);
      assert.equal(await db.documento.count({ where: { id: "preventivo", ...documentoScope(pm) } }), 0);
    });
    await t.test("risoluzione/riapertura sincronizzano attività, scadenza, notifica e concorrenza", async () => {
      const base = { richiestaId: randomUUID(), versione: 1, stato: "RISOLTA", priorita: "MEDIA", assegnatarioId: "collega", scadenza: "2026-10-22", commento: "Interruttore consegnato" };
      await tx((d) => updateProblema(d, "collega", problemId, base));
      assert.equal((await db.attivita.findUniqueOrThrow({ where: { problemaId: problemId } })).stato, "COMPLETATA");
      const edits = await Promise.allSettled(["Prima nota", "Seconda nota"].map((commento) => tx((d) => updateProblema(d, "pm", problemId, { ...base, richiestaId: randomUUID(), versione: 2, stato: "IN_LAVORAZIONE", commento }))));
      assert.equal(edits.filter((r) => r.status === "fulfilled").length, 1);
      const task = await db.attivita.findUniqueOrThrow({ where: { problemaId: problemId } });
      assert.equal(task.stato, "DA_FARE"); assert.equal(task.scadenza?.toISOString().slice(0, 10), "2026-10-22");
      await assert.rejects(tx((d) => updateProblema(d, "pm", problemId, { ...base, richiestaId: randomUUID(), versione: 3, assegnatarioId: null })), /conserva/);
    });
    await t.test("cruscotto e drill-down hanno lo stesso perimetro; demo non generano ritardi", async () => {
      const data = await getDashboard(db, pm);
      assert.equal(data.aperti, 2); assert.equal(data.ritardo, 0); assert.equal(data.problemi, 1); assert.equal(data.rendiconti, null);
      const admin = await getDashboard(db, { id: "admin", ruolo: "SUPER_ADMIN" });
      assert.equal(admin.aperti, 3); assert.equal(admin.rendiconti?._count._all, 0);
    });
    await t.test("cambio assegnazione oscura notifiche storiche e contesto AI precedente", async () => {
      const actor = { id: "collega", ruolo: "PROJECT_MANAGER" };
      const before = await historyAccess(db, actor.id);
      assert.ok(await db.notifica.count({ where: await notificationScope(db, actor) }));
      await tx((d) => updateProblema(d, "pm", problemId, { richiestaId: randomUUID(), versione: 3, stato: "IN_ATTESA", priorita: "MEDIA", assegnatarioId: "pm", scadenza: "2026-10-22", commento: "Riassegnato" }));
      assert.equal(await db.notifica.count({ where: await notificationScope(db, actor) }), 0);
      const after = await historyAccess(db, actor.id);
      assert.throws(() => after.assert(before.key), /permessi/);
      await notifyDueTasks(new Date("2026-10-29"));
      assert.equal(await db.notifica.count({ where: { userId: "collega", href: { startsWith: "/attivita/" } } }), 0);
    });
    await t.test("eliminazione account trasferisce problema e attività mantenendo audit e versioni", async () => {
      const before = await db.problemaCantiere.findUniqueOrThrow({ where: { id: problemId } });
      await eliminaUtente("admin", "pm", { emailConferma: "pm@test.invalid", subentranteId: "admin" }, db);
      const after = await db.problemaCantiere.findUniqueOrThrow({ where: { id: problemId } });
      assert.equal(after.assegnatarioId, "admin"); assert.equal(after.versione, before.versione + 1);
      assert.equal(after.autoreNome, "pm Collaudo");
      assert.equal((await db.attivita.findUniqueOrThrow({ where: { problemaId: problemId } })).userId, "admin");
      assert.ok(await db.eventoProblema.findFirst({ where: { problemaId: problemId, testo: { contains: "eliminazione account" } } }));
    });
  } finally {
    await database.cleanup(db);
    if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
  }
});
