import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@/generated/prisma";
import { testDatabase } from "../../scripts/test-database";
import { saveWizard, confirmWizard, ownedDraft, WizardAlreadyConfirmedError } from "./commessa-wizard";
import { emptyWizard, wizardErrors, type WizardValues } from "./commessa-wizard-schema";

test("commessa guidata: bozze isolate, conferma atomica, controlli e idempotenza", async (t) => {
  const database = testDatabase();
  const db = new PrismaClient({ datasourceUrl: database.url });
  const tx = async <T>(fn: (d: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
    for (let i = 0; ; i++) {
      try { return await db.$transaction(fn, { isolationLevel: "Serializable" }); }
      catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2034" || i >= 4) throw e; }
    }
  };
  const values: WizardValues = { ...emptyWizard, clienteId: "client", descrizione: "Impianto di prova", tipologia: "C", dataRichiesta: "2026-10-27", dataOrdine: "2026-10-27", metodoRicezioneOrdine: "EMAIL", oda: "Email conferma cliente" };
  const save = (id: string, dati = values, versione = 0, passo = 0, actor = "admin") => tx((d) => saveWizard(d, actor, { id, dati, versione, passo }));
  try {
    await db.user.createMany({ data: [
      { id: "admin", email: "admin@test.invalid", nome: "Admin", cognome: "Test", ruolo: "SUPER_ADMIN", passwordHash: "unused" },
      { id: "pm", email: "pm@test.invalid", nome: "PM", cognome: "Test", ruolo: "PROJECT_MANAGER", passwordHash: "unused" },
      { id: "collega", email: "collega@test.invalid", nome: "Collega", cognome: "Test", ruolo: "BACKOFFICE", passwordHash: "unused" },
      { id: "reader", email: "reader@test.invalid", nome: "Reader", cognome: "Test", ruolo: "AMMINISTRAZIONE", passwordHash: "unused" },
    ] });
    await db.anagrafica.createMany({ data: [{ id: "client", ragioneSociale: "Cliente", isCliente: true }, { id: "supplier", ragioneSociale: "Fornitore", isFornitore: true, partitaIva: "12345678900" }] });
    await db.referente.create({ data: { id: "wrong-contact", anagraficaId: "supplier", nome: "Altro", cognome: "Contatto" } });
    await db.operaio.createMany({ data: [{ id: "worker", nome: "Luca", cognome: "Rossi" }, { id: "inactive", nome: "Mario", cognome: "Neri", attivo: false }] });
    await t.test("bozza incompleta persistita: nessun numero, cliente, KPI, prenotazione; retry e accesso privato", async () => {
      const id = randomUUID();
      const draft = await save(id, emptyWizard);
      assert.equal(draft.versione, 1); assert.equal(draft.commessaId, null);
      assert.equal((await save(id, emptyWizard)).versione, 1);
      assert.equal(await db.commessa.count(), 0); assert.equal(await db.assegnazioneOperaio.count(), 0); assert.equal(await db.anagrafica.count(), 2);
      await assert.rejects(save(id, { ...emptyWizard, descrizione: "altro" }), /altra finestra/);
      await assert.rejects(save(id, emptyWizard, 1, 0, "collega"), /non disponibile/);
      await assert.rejects(tx((d) => ownedDraft(d, "reader", id)), /permessi/);
      await assert.rejects(tx((d) => confirmWizard(d, "admin", id, 1, true)), /Seleziona|Descrivi/);
    });
    await t.test("consuntivo senza offerta/importo, allegati trasferiti e audit; conferma ripetuta crea una sola commessa", async () => {
      const id = randomUUID(); await save(id);
      await db.documento.create({ data: { id: "draft-doc", bozzaId: id, nomeFile: "incarico.txt", percorso: `bozze-${id}/incarico.txt` } });
      await assert.rejects(tx((d) => confirmWizard(d, "admin", id, 1, false)), /esplicitamente/);
      await assert.rejects(tx((d) => confirmWizard(d, "admin", id, 1, true)), /allegati sono cambiati/);
      assert.equal(await db.commessa.count(), 0);
      const [first, second] = await Promise.all([1, 2].map(() => tx((d) => confirmWizard(d, "admin", id, 1, true, ["draft-doc"]))));
      assert.equal(first, second); assert.equal(await db.commessa.count(), 1);
      const job = await db.commessa.findUniqueOrThrow({ where: { id: first } });
      assert.equal(job.stato, "ORDINE_CONFERMATO"); assert.equal(job.importoOfferta, null); assert.equal(job.importoOrdine, null);
      assert.equal(job.opportunitaId, null); assert.equal(job.oda, values.oda);
      const doc = await db.documento.findUniqueOrThrow({ where: { id: "draft-doc" } });
      assert.equal(doc.bozzaId, null); assert.equal(doc.commessaId, job.id);
      const audit = await db.modificaEconomica.findUniqueOrThrow({ where: { entita_entitaId_versione: { entita: "COMMESSA_CREAZIONE", entitaId: job.id, versione: 1 } } });
      assert.equal(audit.autoreNome, "Admin Test"); assert.equal(audit.prima, null);
      await assert.rejects(save(id, values, 1), (e) => e instanceof WizardAlreadyConfirmedError && e.commessaId === first);
      await assert.rejects(save(id, values, 1, 0, "collega"), /non disponibile/);
    });
    await t.test("versioni concorrenti non sovrascrivono; il riepilogo obsoleto non conferma", async () => {
      const id = randomUUID(); await save(id);
      const out = await Promise.allSettled(["A", "B"].map((descrizione) => save(id, { ...values, descrizione }, 1)));
      assert.equal(out.filter((r) => r.status === "fulfilled").length, 1);
      await assert.rejects(tx((d) => confirmWizard(d, "admin", id, 1, true)), /modificata/);
      assert.equal(await db.commessa.count(), 1);
    });
    await t.test("un allegato rimosso dopo il riepilogo richiede nuova revisione senza creare commesse", async () => {
      const id = randomUUID(); await save(id);
      await db.documento.create({ data: { id: "deleted-doc", bozzaId: id, nomeFile: "vecchio.txt", percorso: `bozze-${id}/vecchio.txt` } });
      await db.documento.delete({ where: { id: "deleted-doc" } });
      const before = await db.commessa.count();
      await assert.rejects(tx((d) => confirmWizard(d, "admin", id, 1, true, ["deleted-doc"])), /allegati sono cambiati/);
      assert.equal(await db.commessa.count(), before);
      assert.equal((await db.bozzaCommessa.findUniqueOrThrow({ where: { id } })).commessaId, null);
    });
    await t.test("cliente nuovo non creato in bozza, verifica simili e duplicato fiscale; promozione riusa il fornitore", async () => {
      const id = randomUUID();
      const duplicate = { ...values, nuovoCliente: true, clienteId: "", ragioneSociale: "Fornitore", partitaIva: "12345678900" };
      await save(id, duplicate); assert.equal(await db.anagrafica.count(), 2);
      await assert.rejects(tx((d) => confirmWizard(d, "admin", id, 1, true)), /simili/);
      await save(id, { ...duplicate, similaritaConfermata: true }, 1);
      await assert.rejects(tx((d) => confirmWizard(d, "admin", id, 2, true)), /già presenti/);
      assert.equal(await db.anagrafica.count(), 2);
      const promoted = await save(id, { ...values, clienteId: "supplier" }, 2);
      const jobId = await tx((d) => confirmWizard(d, "admin", id, promoted.versione, true));
      assert.equal((await db.commessa.findUniqueOrThrow({ where: { id: jobId } })).clienteId, "supplier");
      const supplier = await db.anagrafica.findUniqueOrThrow({ where: { id: "supplier" } });
      assert.equal(supplier.isCliente, true); assert.equal(supplier.isFornitore, true); assert.ok(supplier.codiceCliente);
      const fresh = randomUUID();
      await save(fresh, { ...values, nuovoCliente: true, clienteId: "", ragioneSociale: "Società Nuovissima", email: "nuova@example.test" });
      const newId = await tx((d) => confirmWizard(d, "admin", fresh, 1, true));
      assert.equal(await db.anagrafica.count(), 3);
      assert.notEqual((await db.commessa.findUniqueOrThrow({ where: { id: newId } })).clienteId, "client");
    });
    await t.test("preventivo e gara richiedono offerta e ordine distinti; zero e centesimi conservati", async () => {
      assert.ok(wizardErrors({ ...values, tipologia: "P" }).importoOfferta);
      assert.ok(wizardErrors({ ...values, tipologia: "GARA" }).importoOrdine);
      assert.ok(wizardErrors({ ...values, importoOrdine: "1.234" }).importoOrdine);
      assert.ok(wizardErrors({ ...values, dataInizioLavori: "2026-11-02", scadenzaLavori: "2026-11-01" }).scadenzaLavori);
      const id = randomUUID(); await save(id, { ...values, tipologia: "P", importoOfferta: "900.37", importoOrdine: "0", dataInvio: "2026-10-26" });
      const jobId = await tx((d) => confirmWizard(d, "admin", id, 1, true));
      const job = await db.commessa.findUniqueOrThrow({ where: { id: jobId } });
      assert.equal(job.importoOfferta?.toFixed(2), "900.37"); assert.equal(job.importoOrdine?.toFixed(2), "0.00");
    });
    await t.test("referente, PM e risorse ricontrollati; conflitti causano rollback anche del nuovo cliente", async () => {
      const id = randomUUID(); await save(id, { ...values, referenteId: "wrong-contact" });
      await assert.rejects(tx((d) => confirmWizard(d, "admin", id, 1, true)), /referente/);
      await save(id, { ...values, pmId: "reader" }, 1);
      await assert.rejects(tx((d) => confirmWizard(d, "admin", id, 2, true)), /Project Manager/);
      const resource = { ...values, pmId: "pm", indirizzoCantiere: "Via Cantiere 1", operai: ["worker"], dataInizioLavori: "2026-11-01", scadenzaLavori: "2026-11-05" };
      await save(id, resource, 2);
      const jobId = await tx((d) => confirmWizard(d, "admin", id, 3, true));
      assert.equal((await db.assegnazioneOperaio.findFirstOrThrow({ where: { commessaId: jobId } })).operaioId, "worker");
      assert.equal((await db.commessa.findUniqueOrThrow({ where: { id: jobId } })).indirizzoCantiere, "Via Cantiere 1");
      const blocked = randomUUID(); await save(blocked, { ...resource, nuovoCliente: true, ragioneSociale: "Società Senza Conflitti", email: "seconda@example.test" });
      const before = await db.anagrafica.count(), jobsBefore = await db.commessa.count();
      await assert.rejects(tx((d) => confirmWizard(d, "admin", blocked, 1, true)), /sovrapposto/);
      assert.equal(await db.anagrafica.count(), before); assert.equal(await db.commessa.count(), jobsBefore);
      assert.equal((await db.bozzaCommessa.findUniqueOrThrow({ where: { id: blocked } })).commessaId, null);
      await save(blocked, { ...resource, operai: ["inactive"] }, 1);
      await assert.rejects(tx((d) => confirmWizard(d, "admin", blocked, 2, true)), /operaio attivo/);
    });
    await t.test("revoca accesso e permessi anagrafica effettivi anche su payload forgiati", async () => {
      const id = randomUUID();
      await assert.rejects(save(id, { ...values, nuovoCliente: true, ragioneSociale: "Creazione non consentita" }, 0, 0, "pm"), /permessi/);
      await save(id, values, 0, 0, "collega");
      await db.user.update({ where: { id: "collega" }, data: { attivo: false } });
      await assert.rejects(tx((d) => ownedDraft(d, "collega", id)), /permessi/);
      await assert.rejects(save(randomUUID(), values, 0, 0, "reader"), /permessi/);
    });
  } finally { await database.cleanup(db); }
});
