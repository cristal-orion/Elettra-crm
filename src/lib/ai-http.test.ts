import assert from "node:assert/strict";
import test from "node:test";
import { readJson, readFormData, ApiError } from "./ai/http";

test("endpoint AI: JSON limitato, origine verificata e corpo malformato rifiutato", async () => {
  const request = (body: string, origin = "https://crm.example.test") => new Request("https://crm.example.test/assistente/api", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body });
  assert.deepEqual(await readJson(request('{"text":"ciao"}')), { text: "ciao" });
  await assert.rejects(readJson(request("{")), (e: unknown) => e instanceof ApiError && e.status === 400);
  await assert.rejects(readJson(request("{}", "https://estraneo.example.test")), (e: unknown) => e instanceof ApiError && e.status === 403);
  await assert.rejects(readJson(request(JSON.stringify({ text: "x".repeat(100) })), 32), (e: unknown) => e instanceof ApiError && e.status === 413);
});

test("upload AI: il limite si applica al corpo letto anche senza Content-Length", async () => {
  const form = new FormData();
  form.set("scheda", new File(["%PDF-" + "x".repeat(1000)], "test.pdf", { type: "application/pdf" }));
  const request = new Request("https://crm.example.test/materiali/estrai", { method: "POST", body: form });
  assert.equal(request.headers.has("content-length"), false);
  await assert.rejects(readFormData(request, 100), (e: unknown) => e instanceof ApiError && e.status === 413);
});
