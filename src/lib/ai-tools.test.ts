import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { z } from "zod";
import type { ToolSet } from "ai";
import type { PrismaClient } from "@/generated/prisma";
import { testDatabase } from "../../scripts/test-database";
import { giornoAttivita } from "./attivita";

let database: ReturnType<typeof testDatabase>;
let db: PrismaClient;
let buildTools: typeof import("./ai-tools").buildTools;
const oldDb = process.env.DATABASE_URL;
before(async () => {
  database = testDatabase();
  process.env.DATABASE_URL = database.url;
  db = (await import("./prisma")).prisma;
  ({ buildTools } = await import("./ai-tools"));
  for (const [id, ruolo] of [["admin", "SUPER_ADMIN"], ["reader", "AMMINISTRAZIONE"], ["worker", "PROJECT_MANAGER"]]) {
    await db.user.create({ data: { id, ruolo, nome: id, cognome: "Test", email: `${id}@example.test`, passwordHash: "test-only" } });
  }
  await db.anagrafica.create({ data: { id: "supplier", ragioneSociale: "Fornitore Alpha", isCliente: true, isFornitore: true, destinazioni: { create: { codice: "D0001", descrizione: "Cantiere Nord", localita: "Milano" } } } });
  await db.commessa.create({ data: { id: "project", numero: "261001", anno: 2026, progressivo: 1001, clienteId: "supplier", stato: "IN_ESECUZIONE" } });
  await db.prodotto.create({ data: { id: "product", codice: "CAT-CAVO", descrizione: "Cavo del catalogo", marca: "Marca Test", categoria: "Cavi", unitaMisura: "m", datiTecnici: "Sezione 6 mm²", prezzoListino: 0, schedaNomeFile: "scheda.pdf", schedaPercorso: "materiali/product/private.pdf" } });
  await db.ordineFornitore.create({ data: { id: "order", numero: "OF-10", stato: "ENTRATA", data: new Date("2026-10-01"), commessaId: "project", fornitoreId: "supplier", righe: { create: [
    { id: "line1", descrizione: "Cavo del catalogo", prodottoId: "product", codiceProdotto: "CAT-CAVO", unitaMisura: "m", quantita: 10, prezzoUnitario: 0.1, imponibile: 1, quantitaRicevuta: 4, ddtNumero: "DDT-1" },
    { id: "line2", descrizione: "Altro materiale", quantita: 2, prezzoUnitario: 0.2, imponibile: 0.4, quantitaRicevuta: null },
  ] } } });
  await db.ordineFornitore.create({ data: { id: "other-order", numero: "OF-ALTRO", stato: "RICEVUTO", data: new Date("2026-09-01"), fornitoreId: "supplier" } });
  const oggi = giornoAttivita();
  for (const [id, userId, stato, scadenza] of [
    ["own", "reader", "DA_FARE", oggi],
    ["team", "worker", "DA_FARE", oggi],
    ["late", "worker", "DA_FARE", new Date(oggi.getTime() - 86400000)],
    ["done", "worker", "COMPLETATA", oggi],
  ] as const) await db.attivita.create({ data: { id, titolo: `Follow-up ${id}`, userId, stato, scadenza, commessaId: "project", clienteId: "supplier" } });
});
after(async () => {
  if (db && database) await database.cleanup(db);
  if (oldDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldDb;
});

function tools(userId = "admin", ruolo = "SUPER_ADMIN") {
  return buildTools({ userId, ruolo, conversationId: "read-only", requestId: "audit" });
}
async function call<T>(tools: ToolSet, name: string, input: unknown): Promise<T> {
  const t = tools[name];
  assert.ok(t?.execute, `Strumento ${name} collegato`);
  const parsed = (t.inputSchema as z.ZodType).parse(input);
  return await t.execute(parsed, { toolCallId: `call-${name}`, messages: [], context: {} }) as T;
}

test("AI ordini: filtri per commessa/fornitore/materiale/stato/periodo e dettaglio paginato con totale integrale", async () => {
  const t = tools();
  const result = await call<{ totale: number; ordini: { id: string; href: string }[] }>(t, "cercaOrdini", { testo: "cat-cavo", commessaId: "project", fornitoreId: "supplier", stato: "ENTRATA", dal: "2026-10-01", al: "2026-10-01" });
  assert.equal(result.totale, 1);
  assert.equal(result.ordini[0].href, "/ordini/order");
  const detail = await call<{ imponibileTotale: string; totaleRighe: number; altrePagine: boolean; righe: { id: string; quantitaDaRicevere: string | null; ddtNumero: string | null }[] }>(t, "dettaglioOrdine", { id: result.ordini[0].id, limite: 1 });
  assert.equal(detail.imponibileTotale, "1.4");
  assert.equal(detail.totaleRighe, 2);
  assert.equal(detail.altrePagine, true);
  assert.equal(detail.righe[0].quantitaDaRicevere, "6");
  assert.equal(detail.righe[0].ddtNumero, "DDT-1");
  const next = await call<typeof detail>(t, "dettaglioOrdine", { id: "order", limite: 1, pagina: 2 });
  assert.equal(next.righe[0].quantitaDaRicevere, null);
  assert.equal(next.altrePagine, false);
});

test("AI catalogo: trova prodotti senza confonderli con lo storico e non espone percorsi dei file", async () => {
  const t = tools();
  const result = await call<{ totale: number; materiali: { id: string; href: string }[] }>(t, "cercaMateriali", { testo: "cat-cavo", marca: "marca test", categoria: "cavi" });
  assert.equal(result.totale, 1);
  const detail = await call<{ prezzoListino: string; datiTecnici: string; schedaHref: string; schedaPercorso?: string }>(t, "dettaglioMateriale", { id: result.materiali[0].id });
  assert.equal(detail.prezzoListino, "0");
  assert.equal(detail.datiTecnici, "Sezione 6 mm²");
  assert.equal(detail.schedaHref, "/materiali/scheda/product");
  assert.equal(detail.schedaPercorso, undefined);
  const { contextData } = await import("./ai/read");
  const { ContextSchema } = await import("./ai/http");
  for (const [type, id, href] of [["ordine", "order", "/ordini/order"], ["materiale", "product", "/materiali/product"]]) {
    assert.equal((await contextData(ContextSchema.parse({ type, id }))).href, href);
  }
});

test("AI attività: vista team, scadenze italiane, cliente e responsabile seguono i filtri del CRM", async () => {
  const t = tools();
  const result = await call<{ totale: number; attivita: { id: string; href: string; updatedAt: string }[]; vista: string }>(t, "cercaAttivita", { vista: "team", responsabile: "worker", scadenza: "oggi", commessaId: "project", clienteId: "supplier" });
  assert.equal(result.vista, "team");
  assert.equal(result.totale, 1);
  assert.equal(result.attivita[0].href, "/attivita/team");
  assert.ok(result.attivita[0].updatedAt);
  const overdue = await call<typeof result>(t, "cercaAttivita", { vista: "team", testo: "follow-up", scadenza: "scadute" });
  assert.deepEqual(overdue.attivita.map((a) => a.id), ["late"]);
  const detail = await call<{ id: string; href: string; updatedAt: string; user: { id: string }; passwordHash?: string }>(t, "dettaglioAttivita", { id: "team" });
  assert.equal(detail.user.id, "worker");
  assert.equal(detail.href, "/attivita/team");
  assert.ok(detail.updatedAt);
  assert.equal(JSON.stringify(detail).includes("passwordHash"), false);
});

test("AI attività: il ruolo effettivo impedisce letture team e dettagli altrui anche con ruolo obsoleto", async () => {
  const t = tools("reader", "SUPER_ADMIN");
  const result = await call<{ totale: number; vista: string; attivita: { id: string }[]; limiteDati: string }>(t, "cercaAttivita", { vista: "team", responsabile: "worker" });
  assert.equal(result.vista, "mie");
  assert.equal(result.totale, 1);
  assert.equal(result.attivita[0].id, "own");
  assert.ok(result.limiteDati);
  const denied = await call<{ error: string }>(t, "dettaglioAttivita", { id: "team" });
  assert.equal(denied.error, "Attività non trovata.");
  await db.user.update({ where: { id: "reader" }, data: { attivo: false } });
  assert.equal((await call<{ error: string }>(t, "cercaAttivita", {})).error, "Utente non disponibile.");
  await db.user.update({ where: { id: "reader" }, data: { attivo: true } });
});

test("AI criticità: stesse regole dei controlli programmati, limiti dichiarati e dati demo esclusi", async () => {
  const t = tools();
  const result = await call<{ totale: number; altrePagine: boolean; findings: { tipo: string; href: string }[] }>(t, "cercaCriticita", { commessaId: "project", limite: 1 });
  assert.equal(result.totale, 2);
  assert.equal(result.altrePagine, true);
  assert.equal(result.findings[0].href, "/progetti/project");
  await db.milestone.create({ data: { id: "demo", commessaId: "project", titolo: "Esempio", ordine: 0, dimostrativa: true, dataPianificata: new Date("2020-01-01") } });
  assert.equal((await call<typeof result>(t, "cercaCriticita", { commessaId: "project" })).totale, 0);
  await db.milestone.delete({ where: { id: "demo" } });
});

test("AI anagrafiche/prezzi: destinazioni collegate e fonte dell'acquisto disponibile", async () => {
  const t = tools();
  const client = await call<{ destinazioni: { descrizione: string }[]; altreDestinazioni: boolean }>(t, "dettaglioCliente", { id: "supplier" });
  assert.equal(client.destinazioni[0].descrizione, "Cantiere Nord");
  assert.equal(client.altreDestinazioni, false);
  const prices = await call<{ totale: number; materiali: { acquisti: { href: string }[]; altriAcquisti: boolean }[] }>(t, "ultimoPrezzoMateriale", { descrizione: "CAT-CAVO" });
  assert.equal(prices.totale, 1);
  assert.equal(prices.materiali[0].acquisti[0].href, "/ordini/order");
  assert.equal(prices.materiali[0].altriAcquisti, false);
});

test("AI documenti: errori espliciti e limite condiviso fra documenti commessa e schede tecniche", async () => {
  const t = tools();
  for (let i = 0; i < 3; i++) {
    assert.equal((await call<{ error: string }>(t, "leggiSchedaMateriale", { prodottoId: "missing", domanda: "Riassumi" })).error, "Scheda tecnica non disponibile per questo materiale.");
  }
  assert.match((await call<{ error: string }>(t, "leggiDocumentoCommessa", { documentoId: "missing", domanda: "Riassumi" })).error, /Limite di 3/);
});

test("AI SDK: dalla ricerca all'ordine, ai dati reali di consegna senza scritture", async () => {
  const { MockLanguageModelV4 } = await import("ai/test");
  const { generateText, stepCountIs } = await import("ai");
  const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } };
  const model = new MockLanguageModelV4({ doGenerate: [
    { content: [{ type: "tool-call", toolCallId: "search", toolName: "cercaOrdini", input: JSON.stringify({ commessaId: "project" }) }], finishReason: { unified: "tool-calls", raw: "tool-calls" }, usage, warnings: [] },
    { content: [{ type: "tool-call", toolCallId: "detail", toolName: "dettaglioOrdine", input: JSON.stringify({ id: "order" }) }], finishReason: { unified: "tool-calls", raw: "tool-calls" }, usage, warnings: [] },
    { content: [{ type: "text", text: "Mancano 6 metri di cavo. Puoi aprire l'ordine." }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] },
  ] });
  const result = await generateText({ model, tools: tools(), prompt: "Controlla le consegne della commessa", stopWhen: stepCountIs(4) });
  assert.equal(result.steps.length, 3);
  const output = result.steps[1].toolResults[0].output as { righe: { quantitaDaRicevere: string | null }[] };
  assert.equal(output.righe[0].quantitaDaRicevere, "6");
  assert.equal(await db.aiOperation.count(), 0);
});
