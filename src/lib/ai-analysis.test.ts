import assert from "node:assert/strict";
import test from "node:test";
import { APICallError, RetryError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { generateContextAnalysis } from "./ai/analysis";
import { analysisFailure } from "./ai/analysis-error";

const content = { sintesi: "Mancano date confermate.", punti: [], azioniSuggerite: [] };
const success = {
  content: [{ type: "text" as const, text: JSON.stringify(content) }],
  finishReason: { unified: "stop" as const, raw: "STOP" }, warnings: [],
  usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 20, text: 10, reasoning: 10 } },
};
const unavailable = (statusCode = 503, retryMs = "1") => new APICallError({
  message: "Provider error with PRIVATE_KEY and CRM_PRIVATE_DATA",
  url: "https://example.test/model?key=PRIVATE_KEY", requestBodyValues: { prompt: "CRM_PRIVATE_DATA" },
  statusCode, responseHeaders: { "retry-after-ms": retryMs }, responseBody: "CRM_PRIVATE_DATA",
});

test("analisi SDK: recupera da due 503 consecutivi prima di restituire il risultato validato", async () => {
  let calls = 0;
  const model = new MockLanguageModelV4({ doGenerate: async () => {
    if (++calls < 3) throw unavailable();
    return success;
  } });
  const result = await generateContextAnalysis(model, { dimostrativo: true }, "Proponi piano");
  assert.equal(calls, 3);
  assert.deepEqual(result.output, content);
});

test("analisi SDK: indisponibilità persistente limitata a quattro tentativi e diagnosi senza dati sensibili", async () => {
  let calls = 0;
  const model = new MockLanguageModelV4({ doGenerate: async () => { calls++; throw unavailable(); } });
  await assert.rejects(generateContextAnalysis(model, {}, "Proponi piano"), (error: unknown) => {
    assert.ok(RetryError.isInstance(error));
    const failure = analysisFailure(error);
    assert.equal(failure.code, "AI_UNAVAILABLE");
    assert.equal(failure.status, 503);
    assert.equal(failure.providerStatus, 503);
    assert.equal(failure.retryAfter, 15);
    assert.equal(failure.retryable, true);
    assert.doesNotMatch(JSON.stringify(failure), /PRIVATE_KEY|CRM_PRIVATE_DATA|example\.test/);
    return true;
  });
  assert.equal(calls, 4);
});

test("analisi SDK: chiave rifiutata non ritentata, quota distinta da sovraccarico", async () => {
  let calls = 0;
  const model = new MockLanguageModelV4({ doGenerate: async () => { calls++; throw unavailable(403); } });
  await assert.rejects(generateContextAnalysis(model, {}, "Proponi piano"), (error: unknown) => {
    assert.equal(analysisFailure(error).code, "AI_CONFIGURATION");
    assert.equal(analysisFailure(error).retryable, false);
    return true;
  });
  assert.equal(calls, 1);
  const quota = analysisFailure(new RetryError({ message: "Retries exhausted", reason: "maxRetriesExceeded", errors: [unavailable(429)] }));
  assert.equal(quota.status, 429);
  assert.equal(quota.retryAfter, 60);
});

test("analisi SDK: annullamento interrompe l'attesa tra tentativi", async () => {
  const controller = new AbortController();
  let calls = 0;
  const model = new MockLanguageModelV4({ doGenerate: async () => {
    calls++;
    controller.abort();
    throw unavailable(503, "2000");
  } });
  await assert.rejects(generateContextAnalysis(model, {}, "Analizza ritardi", controller.signal));
  assert.equal(calls, 1);
});

test("analisi SDK: risposta JSON incompleta non presentata come analisi riuscita", async () => {
  const model = new MockLanguageModelV4({ doGenerate: async () => ({ ...success, content: [{ type: "text", text: '{"sintesi":' }], finishReason: { unified: "length", raw: "MAX_TOKENS" } }) });
  await assert.rejects(generateContextAnalysis(model, {}, "Analizza ritardi"), (error: unknown) => {
    assert.equal(analysisFailure(error).code, "AI_INVALID_RESPONSE");
    return true;
  });
  assert.equal(analysisFailure(new DOMException("Timed out", "TimeoutError")).status, 504);
});
