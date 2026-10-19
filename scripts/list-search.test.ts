import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient, Prisma } from "../src/generated/prisma";
import { listSources, searchListPage } from "../src/lib/list-search";
import { projectListSource } from "../src/lib/project-list";
import { statoAvanzamento, giorniAllaScadenza, STATI_PROGETTO } from "../src/lib/progetti";
import { testDatabase } from "./test-database";

test("liste PostgreSQL: ricerca progressiva, filtri e paginazione prima dell'idratazione", async (t) => {
  const database = testDatabase();
  const db = new PrismaClient({ datasourceUrl: database.url });
  try {
    const a = await db.anagrafica.create({ data: { ragioneSociale: "Àloxe Caffè Impianti", isCliente: true, referenti: { create: { nome: "Giorgio", cognome: "Bianchi", email: "contatto@example.test" } } } });
    const b = await db.anagrafica.create({ data: { ragioneSociale: "Azienda 100%_sicura", isFornitore: true } });
    const c = await db.commessa.create({ data: { numero: "260001", anno: 2026, progressivo: 1, clienteId: a.id, descrizione: "Manutenzione città" } });
    const search = (kind: keyof typeof listSources, query: string, scope?: Prisma.Sql) => searchListPage(db, listSources[kind], { query, scope, orderBy: Prisma.sql`s.id` });
    await t.test("accenti, token riordinati, contatti e caratteri letterali", async () => {
      for (const query of ["aloxe", "ALOXE", "àloxe", "impi caffè", "caffe\u0300 impi", "BIANCHI Giorgio", "contatto@example.test"]) {
        const result = await search("anagrafiche", query);
        assert.deepEqual(result.ids, [a.id], query); assert.equal(result.similar, false);
      }
      assert.deepEqual((await search("commesse", "citta aloxe")).ids, [c.id]);
      assert.deepEqual((await search("anagrafiche", "%_")).ids, [b.id]);
      assert.deepEqual((await search("anagrafiche", "' OR 1=1 --")).ids, []);
      assert.deepEqual((await search("commesse", "inesistente")).ids, []);
      assert.equal((await search("anagrafiche", "  ")).total, 2);
    });
    await t.test("un refuso, trasposizione, esatti prioritari e fallback entro il perimetro", async () => {
      for (const query of ["alxoe", "aloxee", "aloe", "aloxe caffe impainti"]) {
        const result = await search("anagrafiche", query);
        assert.deepEqual(result.ids, [a.id], query); assert.equal(result.similar, true);
      }
      assert.equal((await search("commesse", "260002")).total, 0); // i codici non vengono corretti
      assert.equal((await search("anagrafiche", "alxxxe")).total, 0); // più di un refuso
      const exact = await db.anagrafica.create({ data: { ragioneSociale: "Alxoe Servizi", isFornitore: true } });
      const all = await search("anagrafiche", "alxoe");
      assert.deepEqual(all.ids, [exact.id]); assert.equal(all.similar, false);
      const clients = await search("anagrafiche", "alxoe", Prisma.sql`s."isCliente"`);
      assert.deepEqual(clients.ids, [a.id]); assert.equal(clients.similar, true);
      assert.equal((await search("anagrafiche", "alxoe", Prisma.sql`false`)).total, 0);
    });
    await t.test("materiali, ordini, feedback, risorse e utenti mantengono il proprio perimetro", async () => {
      const user = await db.user.create({ data: { nome: "Niccolò", cognome: "Rossi", email: "rossi@example.test", ruolo: "SUPER_ADMIN", passwordHash: "unused" } });
      const p = await db.prodotto.create({ data: { codice: "CB-123", descrizione: "Càvo elettrico", marca: "Marca" } });
      const o = await db.ordineFornitore.create({ data: { numero: "OD-123", fornitoreId: b.id, commessaId: c.id } });
      const s = await db.segnalazione.create({ data: { titolo: "Pulsante attività", descrizione: "Controllare filtro", autoreId: user.id } });
      const r = await db.operaio.create({ data: { nome: "Niccolò", cognome: "Rossi", squadra: "Èquipe" } });
      assert.deepEqual((await search("materiali", "elettrico cavo")).ids, [p.id]);
      assert.deepEqual((await search("ordini", "260001 OD-123")).ids, [o.id]);
      assert.deepEqual((await search("segnalazioni", "attivita pulsante")).ids, [s.id]);
      assert.deepEqual((await search("operai", "rossi equipe")).ids, [r.id]);
      assert.deepEqual((await search("utenti", "niccolo rossi", Prisma.sql`s.ruolo = 'SUPER_ADMIN'`)).ids, [user.id]);
      assert.equal((await search("utenti", "nicolo", Prisma.sql`s.ruolo = 'PROJECT_MANAGER'`)).total, 0);
    });
    await t.test("progetti: SQL equivalente ai calcoli esistenti, con urgenti oltre la prima pagina", async () => {
      const past = new Date(); past.setDate(past.getDate() - 2);
      const future = new Date(); future.setDate(future.getDate() + 2);
      await db.commessa.createMany({ data: Array.from({ length: 70 }, (_, i) => ({ id: `project-${i}`, numero: `P-${i}`, anno: 2026, progressivo: 100 + i, clienteId: a.id, stato: i === 4 ? "FATTURATA" : "IN_ESECUZIONE", dataInizioLavori: i % 6 === 0 ? null : past, scadenzaLavori: i % 6 === 0 ? null : i % 2 === 0 ? past : future, dataFineLavori: i === 8 ? past : null })) });
      await db.milestone.createMany({ data: [
        { commessaId: "project-2", titolo: "Completato nonostante scadenza", ordine: 0, stato: "COMPLETATA" },
        { commessaId: "project-1", titolo: "Milestone scaduta", ordine: 0, dataPianificata: past },
        { commessaId: "project-3", titolo: "Demo scaduta (regola corrente conservata)", ordine: 0, dataPianificata: past, dimostrativa: true },
      ] });
      const rows = await db.commessa.findMany({ where: { stato: { in: STATI_PROGETTO } }, include: { milestone: true } });
      const rank = { IN_RITARDO: 0, IN_CORSO: 1, DA_PIANIFICARE: 2, COMPLETATO: 3 };
      const expected = rows.sort((x, y) => rank[statoAvanzamento(x)] - rank[statoAvanzamento(y)] || ((giorniAllaScadenza(x.scadenzaLavori) ?? Infinity) - (giorniAllaScadenza(y.scadenzaLavori) ?? Infinity)) || y.anno - x.anno || y.progressivo - x.progressivo || x.id.localeCompare(y.id));
      const projectOptions = { query: "", scope: Prisma.sql`s.stato IN (${Prisma.join(STATI_PROGETTO)})`, orderBy: Prisma.sql`s.urgency, s."dueDay" ASC NULLS LAST, s.anno DESC, s.progressivo DESC`, extraCount: Prisma.sql`count(*) FILTER (WHERE urgency = 0)` };
      for (let page = 1; page <= 3; page++) {
        const result = await searchListPage(db, projectListSource(), { ...projectOptions, page: String(page) });
        assert.deepEqual(result.ids, expected.slice((page - 1) * 30, page * 30).map((row) => row.id));
        assert.equal(result.total, 70);
        assert.equal(result.extra, expected.filter((row) => statoAvanzamento(row) === "IN_RITARDO").length);
      }
      const late = await searchListPage(db, projectListSource(), { ...projectOptions, scope: Prisma.sql`(${projectOptions.scope}) AND s.urgency = 0` });
      assert.equal(late.total, expected.filter((row) => statoAvanzamento(row) === "IN_RITARDO").length);
    });
    await t.test("volume sintetico: 4000 anagrafiche, pagine complete e nessun ID extra trasferito", async () => {
      await db.anagrafica.createMany({ data: Array.from({ length: 4000 }, (_, i) => ({ id: `volume-${String(i).padStart(4, "0")}`, ragioneSociale: `Azienda Campione ${i}`, isCliente: true })) });
      const start = performance.now();
      const exact = await searchListPage(db, listSources.anagrafiche, { query: "campione", page: "100", orderBy: Prisma.sql`s.id` });
      const middle = performance.now();
      const fuzzy = await searchListPage(db, listSources.anagrafiche, { query: "campoine", page: "100", orderBy: Prisma.sql`s.id` });
      const fuzzyDone = performance.now();
      assert.equal(exact.total, 4000); assert.equal(exact.ids.length, 30);
      assert.deepEqual(fuzzy.ids, exact.ids); assert.equal(fuzzy.total, 4000); assert.equal(fuzzy.similar, true);
      const last = await searchListPage(db, listSources.anagrafiche, { query: "campione", page: "9999", orderBy: Prisma.sql`s.id` });
      assert.equal(last.page, 134); assert.equal(last.ids.length, 10);
      console.log(`4000 record sintetici: esatta ${Math.round(middle - start)}ms; fallback refuso ${Math.round(fuzzyDone - middle)}ms`);
    });
  } finally { await database.cleanup(db); }
});
