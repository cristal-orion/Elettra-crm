import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { dueSlot } from "./ai/schedule-time";
import { CommandSchema, needsConfirmation } from "./crm/schemas";
import type { PrismaClient } from "@/generated/prisma";

let directory: string;
let db: PrismaClient;
let run: typeof import("./crm/commands").runCommand;
let submit: typeof import("./ai/operations").submitOperation;
let decide: typeof import("./ai/operations").decideOperation;
const oldDb = process.env.DATABASE_URL;
const oldKey = process.env.GEMINI_API_KEY;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "elettra-ai-test-"));
  process.env.DATABASE_URL = `file:${path.join(directory, "test.db")}`;
  process.env.GEMINI_API_KEY = "";
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: process.env, stdio: "pipe" });
  db = (await import("./prisma")).prisma;
  run = (await import("./crm/commands")).runCommand;
  ({ submitOperation: submit, decideOperation: decide } = await import("./ai/operations"));
  for (const [id, ruolo] of [["admin", "SUPER_ADMIN"], ["pm", "PROJECT_MANAGER"], ["reader", "AMMINISTRAZIONE"], ["other", "SUPER_ADMIN"]]) await db.user.create({ data: { id, ruolo, nome: id, cognome: "Test", email: `${id}@example.test`, passwordHash: "test-only" } });
  await db.anagrafica.create({ data: { id: "cliente", ragioneSociale: "Cliente Test", isCliente: true } });
  for (const [id, numero, stato] of [["project", "261001", "ORDINE_CONFERMATO"], ["project2", "261002", "IN_ESECUZIONE"], ["lead", "261003", "LEAD"]]) await db.commessa.create({ data: { id, numero, anno: 2026, progressivo: Number(numero.slice(2)), stato, clienteId: "cliente" } });
  await db.operaio.create({ data: { id: "worker", nome: "Mario", cognome: "Rossi" } });
  await db.aiConversation.create({ data: { id: "chat", userId: "admin", title: "Test" } });
});
after(async () => {
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
  if (oldDb === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldDb;
  if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
});

test("schema: enum di dominio, date impossibili e politica delle conferme", () => {
  assert.equal(CommandSchema.safeParse({ type: "aggiornaMilestone", id: "m", data: { stato: "INVALID" } }).success, false);
  assert.equal(CommandSchema.safeParse({ type: "pianificaProgetto", id: "p", data: { scadenzaLavori: "2026-02-30" } }).success, false);
  assert.equal(needsConfirmation(CommandSchema.parse({ type: "salvaCommessa", id: "p", data: { stato: "FATTURATA" } })), true);
  assert.equal(needsConfirmation(CommandSchema.parse({ type: "pianificaProgetto", id: "p", data: { noteCantiere: "nota" } })), false);
});

test("permessi reali e guardia progetto sono applicati anche fuori dalle Server Actions", async () => {
  await assert.rejects(run("reader", { type: "creaMilestone", commessaId: "project", milestone: [{ titolo: "Vietata" }] }), /permessi/);
  await assert.rejects(run("admin", { type: "creaMilestone", commessaId: "lead", milestone: [{ titolo: "Prematura" }] }), /acquisita/);
  await assert.rejects(run("pm", { type: "salvaAnagrafica", data: { ragioneSociale: "Non autorizzata", isCliente: true } }), /permessi/);
});

test("patch parziali conservano i dati e rifiutano versioni obsolete", async () => {
  await run("admin", { type: "pianificaProgetto", id: "project", data: { dataInizioLavori: "2026-10-01", scadenzaLavori: "2026-10-31" } });
  await run("admin", { type: "pianificaProgetto", id: "project", data: { noteCantiere: "Accesso ore 8" } });
  const p = await db.commessa.findUniqueOrThrow({ where: { id: "project" } });
  assert.equal(p.scadenzaLavori?.toISOString().slice(0, 10), "2026-10-31");
  await assert.rejects(run("admin", { type: "pianificaProgetto", id: p.id, expectedUpdatedAt: "2020-01-01T00:00:00.000Z", data: { noteCantiere: "Obsoleta" } }), /modificato/);
  await assert.rejects(run("admin", { type: "pianificaProgetto", id: p.id, data: { scadenzaLavori: "2026-09-01" } }), /precedere/);
});

test("un batch e il suo retry producono una sola serie di milestone", async () => {
  const command = { type: "creaMilestone", commessaId: "project", milestone: [{ titolo: "Sopralluogo" }, { titolo: "Posa" }] };
  const first = await submit("admin", "chat", "req-batch", command);
  const retry = await submit("admin", "chat", "req-batch", command);
  assert.equal(first.status, "COMPLETED"); assert.equal(first.operationId, retry.operationId);
  assert.equal(await db.milestone.count({ where: { commessaId: "project" } }), 2);
  const m = await db.milestone.findFirstOrThrow({ where: { commessaId: "project" } });
  await run("admin", { type: "aggiornaMilestone", id: m.id, data: { stato: "COMPLETATA" } });
  assert.ok((await db.milestone.findUniqueOrThrow({ where: { id: m.id } })).dataEffettiva);
  await run("admin", { type: "aggiornaMilestone", id: m.id, data: { stato: "IN_CORSO" } });
  assert.equal((await db.milestone.findUniqueOrThrow({ where: { id: m.id } })).dataEffettiva, null);
});

test("conferme: proprietà, rifiuto, esecuzione idempotente, scadenza e conflitto", async () => {
  const pending = await submit("admin", "chat", "req-price", { type: "salvaCommessa", id: "project", data: { importoOrdine: 2500 } });
  assert.equal(pending.status, "PENDING");
  assert.equal((await db.commessa.findUniqueOrThrow({ where: { id: "project" } })).importoOrdine, null);
  await assert.rejects(decide("other", pending.operationId, true), /non trovata/);
  assert.equal((await decide("admin", pending.operationId, true)).status, "COMPLETED");
  assert.equal((await decide("admin", pending.operationId, true)).status, "COMPLETED");
  assert.equal((await db.commessa.findUniqueOrThrow({ where: { id: "project" } })).importoOrdine?.toString(), "2500");
  const rejected = await submit("admin", "chat", "req-reject", { type: "salvaCommessa", id: "project", data: { stato: "FATTURATA" } });
  assert.equal((await decide("admin", rejected.operationId, false)).status, "REJECTED");
  assert.equal((await decide("admin", rejected.operationId, true)).status, "REJECTED");
  const expired = await submit("admin", "chat", "req-expired", { type: "salvaCommessa", id: "project", data: { importoOrdine: 3000 } });
  await db.aiOperation.update({ where: { id: expired.operationId }, data: { expiresAt: new Date(0) } });
  assert.equal((await decide("admin", expired.operationId, true)).status, "EXPIRED");
  const conflict = await submit("admin", "chat", "req-conflict", { type: "salvaCommessa", id: "project", data: { importoOrdine: 4000 } });
  await db.commessa.update({ where: { id: "project" }, data: { descrizione: "Modifica concorrente" } });
  await assert.rejects(decide("admin", conflict.operationId, true), /cambiato/);
  assert.equal((await db.aiOperation.findUniqueOrThrow({ where: { id: conflict.operationId } })).status, "CONFLICT");
});

test("revoca del ruolo dopo la proposta impedisce la conferma", async () => {
  const op = await submit("admin", "chat", "req-revoked", { type: "salvaCommessa", id: "project", data: { importoOrdine: 5000 } });
  await db.user.update({ where: { id: "admin" }, data: { ruolo: "AMMINISTRAZIONE" } });
  await assert.rejects(decide("admin", op.operationId, true), /permessi/);
  await db.user.update({ where: { id: "admin" }, data: { ruolo: "SUPER_ADMIN" } });
});

test("assegnazioni: operaio attivo, intervalli validi e sovrapposizioni", async () => {
  await run("pm", { type: "assegnaOperaio", commessaId: "project", operaioId: "worker", dal: "2026-10-01", al: "2026-10-10" });
  await assert.rejects(run("pm", { type: "assegnaOperaio", commessaId: "project2", operaioId: "worker", dal: "2026-10-05", al: "2026-10-12" }), /sovrapposto/);
  await run("pm", { type: "assegnaOperaio", commessaId: "project2", operaioId: "worker", dal: "2026-10-11", al: "2026-10-12" });
});

test("referenti: riconciliazione conserva i nuovi, rifiuta ID esterni e duplica fiscale", async () => {
  const a = await run("admin", { type: "salvaAnagrafica", data: { ragioneSociale: "Nuova", isCliente: true, partitaIva: "12345678901" }, referenti: [{ nome: "Mario", cognome: "Rossi" }] });
  assert.equal(await db.referente.count({ where: { anagraficaId: a.id } }), 1);
  const external = await db.referente.create({ data: { anagraficaId: "cliente", nome: "Esterno", cognome: "Test" } });
  await assert.rejects(run("admin", { type: "salvaAnagrafica", id: a.id, data: { note: "Non deve salvarsi" }, referenti: [{ id: external.id, nome: "Alterato", cognome: "Test" }] }), /non appartiene/);
  assert.equal((await db.anagrafica.findUniqueOrThrow({ where: { id: a.id } })).note, null);
  await assert.rejects(run("admin", { type: "salvaAnagrafica", data: { ragioneSociale: "Duplicata", isCliente: true, partitaIva: "12345678901" } }), /già presenti/);
});

test("P→C mantiene Tariffario e Gara anche dopo un acquisto", async () => {
  const { applicaRegolaPC } = await import("./regole");
  await db.anagrafica.update({ where: { id: "cliente" }, data: { isFornitore: true } });
  await db.ordineFornitore.create({ data: { fornitoreId: "cliente", commessaId: "project" } });
  for (const type of ["T", "GARA", "P"]) {
    await db.commessa.update({ where: { id: "project" }, data: { tipologia: type } });
    await db.$transaction((tx) => applicaRegolaPC(tx, "project"));
    assert.equal((await db.commessa.findUniqueOrThrow({ where: { id: "project" } })).tipologia, type === "P" ? "C" : type);
  }
});

test("orari: giorni lavorativi, ora legale mancante e ora solare ripetuta", () => {
  const schedule = { hour: 2, minute: 30, weekdaysOnly: false };
  assert.equal(dueSlot(schedule, new Date("2026-03-29T01:00:00Z")), "2026-03-29");
  assert.equal(dueSlot(schedule, new Date("2026-10-25T00:30:00Z")), "2026-10-25");
  assert.equal(dueSlot(schedule, new Date("2026-10-25T01:30:00Z")), "2026-10-25");
  assert.equal(dueSlot({ ...schedule, weekdaysOnly: true }, new Date("2026-10-25T12:00:00Z")), null);
  assert.equal(dueSlot({ hour: 8, minute: 0, weekdaysOnly: true }, new Date("2026-09-17T05:59:00Z")), null);
});

test("controlli programmati persistono risultati e notifiche senza duplicare lo slot", async () => {
  const { runSchedule } = await import("./ai/scheduler");
  const schedule = await db.aiSchedule.create({ data: { userId: "admin", name: "Controllo test", recipientIds: ["admin", "reader"] } });
  const first = await runSchedule(schedule.id, "2026-09-17");
  assert.equal(first.skipped, false);
  assert.equal((await runSchedule(schedule.id, "2026-09-17")).skipped, true);
  assert.equal(await db.notifica.count({ where: { runId: first.id } }), 2);
  assert.equal((await db.aiRun.findUniqueOrThrow({ where: { id: first.id } })).status, "COMPLETED");
});

test("chat: lock, proprietà dello storico e conservazione dei messaggi", async () => {
  const { startTurn, finishTurn } = await import("./ai/chat-store");
  const t = await startTurn("admin", "chat-store", "message-1", "Ciao");
  await assert.rejects(startTurn("admin", "chat-store", "message-2", "Ancora"), /Attendi/);
  await assert.rejects(startTurn("reader", "chat-store", "message-3", "Altrui"), /non trovata/);
  await finishTurn("chat-store", t.lockToken, { id: "response-1", role: "assistant", parts: [{ type: "text", text: "Buongiorno" }] });
  const next = await startTurn("admin", "chat-store", "message-2", "Continua");
  assert.equal(next.messages.length, 3);
  await finishTurn("chat-store", next.lockToken);
});

test("AI SDK: tool reali multistep, scrittura operativa e proposta commerciale nello stesso turno", async () => {
  const { MockLanguageModelV4 } = await import("ai/test");
  const { generateText, stepCountIs } = await import("ai");
  const { buildTools } = await import("./ai-tools");
  const version = (await db.commessa.findUniqueOrThrow({ where: { id: "project" } })).updatedAt.toISOString();
  const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } };
  const model = new MockLanguageModelV4({ doGenerate: [
    { content: [
      { type: "tool-call", toolCallId: "call-task", toolName: "creaAttivita", input: JSON.stringify({ titolo: "Follow-up SDK", commessaId: "project" }) },
      { type: "tool-call", toolCallId: "call-commercial", toolName: "salvaCommessa", input: JSON.stringify({ id: "project", expectedUpdatedAt: version, data: { importoOrdine: 9999 } }) },
    ], finishReason: { unified: "tool-calls", raw: "tool-calls" }, usage, warnings: [] },
    { content: [{ type: "text", text: "Attività creata. L'importo attende conferma." }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] },
  ] });
  const tools = buildTools({ userId: "admin", ruolo: "SUPER_ADMIN", conversationId: "chat", requestId: "sdk-request" });
  const result = await generateText({ model, tools, prompt: "Crea un follow-up e proponi importo 9999", stopWhen: stepCountIs(3) });
  assert.equal(result.steps.length, 2);
  assert.equal(await db.attivita.count({ where: { titolo: "Follow-up SDK" } }), 1);
  assert.notEqual((await db.commessa.findUniqueOrThrow({ where: { id: "project" } })).importoOrdine?.toNumber(), 9999);
  const proposed = result.steps[0].toolResults.find((r) => r.toolName === "salvaCommessa");
  assert.equal((proposed?.output as { status?: string })?.status, "PENDING");
  const readerTools = buildTools({ userId: "reader", ruolo: "AMMINISTRAZIONE", conversationId: "chat", requestId: "other" });
  assert.equal(readerTools.salvaCommessa, undefined);
  assert.equal(readerTools.creaMilestone, undefined);
  assert.ok(readerTools.cercaCommesse);
});

test("stream SDK: salvataggio risposta e token alla chiusura dello stream", { timeout: 10000 }, async () => {
  const { MockLanguageModelV4, simulateReadableStream } = await import("ai/test");
  const { streamText } = await import("ai");
  const { startTurn, finishTurn } = await import("./ai/chat-store");
  const turn = await startTurn("admin", "stream-chat", "stream-request", "Ciao");
  const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } };
  const model = new MockLanguageModelV4({ doStream: { stream: simulateReadableStream({ chunks: [
    { type: "stream-start", warnings: [] }, { type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "Buongiorno" }, { type: "text-end", id: "t" }, { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
  ] }) } });
  const result = streamText({ model, prompt: "Ciao" });
  const response = result.toUIMessageStreamResponse({ originalMessages: turn.messages, onEnd: async ({ responseMessage }) => {
    responseMessage.metadata = { usage: await result.usage };
    await finishTurn("stream-chat", turn.lockToken, responseMessage);
  } });
  assert.match(await response.text(), /Buongiorno/);
  assert.equal(await db.aiMessage.count({ where: { conversationId: "stream-chat" } }), 2);
  assert.equal((await db.aiConversation.findUniqueOrThrow({ where: { id: "stream-chat" } })).busyUntil, null);
});

test("storico prezzi: non confronta metri con pezzi dello stesso codice", async () => {
  const { getStoricoMateriali } = await import("../app/(app)/materiali/data");
  const order = await db.ordineFornitore.create({ data: { fornitoreId: "cliente", righe: { create: [
    { descrizione: "Cavo test", codiceProdotto: "TEST-CAVO", unitaMisura: "m", prezzoUnitario: 2, quantita: 10, imponibile: 20 },
    { descrizione: "Cavo test", codiceProdotto: "TEST-CAVO", unitaMisura: "pz", prezzoUnitario: 20, quantita: 1, imponibile: 20 },
  ] } } });
  const result = await getStoricoMateriali("TEST-CAVO");
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((m) => m.prezzoMedio).sort((a, b) => a - b), [2, 20]);
  await db.ordineFornitore.delete({ where: { id: order.id } });
});

test("analisi: quota condivisa persistente, indipendente dal tipo di estrazione", async () => {
  const { reserveAnalysis } = await import("./ai/analysis-budget");
  for (let i = 0; i < 10; i++) await reserveAnalysis("reader", { type: i % 2 ? "estrazionePDF" : "contestuale" });
  await assert.rejects(reserveAnalysis("reader", { type: "contestuale" }), /Limite di 10/);
});
