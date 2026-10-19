import assert from "node:assert/strict";
import test from "node:test";
import { listHref, listPage, safeListHref, searchTerms, queryText, typoPattern } from "./list-state";

test("filtri condivisibili: conserva perimetro, sort e tab ma riparte dalla prima pagina", () => {
  const href = listHref("/attivita", "vista=team&commessaId=123&pagina=4&ordine=nome&tab=note&esito=salvata", { q: "caffè & impianti", stato: "" });
  const url = new URL(href, "https://crm.test");
  assert.equal(url.searchParams.get("vista"), "team");
  assert.equal(url.searchParams.get("commessaId"), "123");
  assert.equal(url.searchParams.get("ordine"), "nome");
  assert.equal(url.searchParams.get("tab"), "note");
  assert.equal(url.searchParams.get("q"), "caffè & impianti");
  assert.equal(url.searchParams.has("pagina"), false);
  assert.equal(url.searchParams.has("esito"), false);
  assert.equal(listHref("/commesse", "stato=INVIATA", { pagina: "2" }, false), "/commesse?stato=INVIATA&pagina=2");
});

test("pagine malformate o fuori intervallo non producono offset invalidi", () => {
  for (const value of [undefined, "-1", "Infinity", "abc", "2.5", "9007199254740992"]) assert.equal(listPage(value, 61).page, 1);
  assert.deepEqual(listPage("99", 61), { page: 3, pages: 3, skip: 60, take: 30 });
  assert.equal(listPage("2", 0).page, 1);
});

test("ricerca normalizza accenti Unicode, spazi e termini duplicati", () => {
  assert.deepEqual(searchTerms("  CÀFFÈ  Elettra  caffè "), ["caffe", "elettra"]);
  assert.deepEqual(searchTerms("CAFFE\u0300"), ["caffe"]);
  assert.deepEqual(searchTerms("  "), []);
});

test("parametri ripetuti e codici non diventano query fuzzy o regex arbitrarie", () => {
  assert.equal(queryText(["primo", "secondo"]), "");
  assert.equal(queryText("  Àloxe  "), "Àloxe");
  assert.equal(queryText("a".repeat(300)).length, 200);
  for (const term of ["260001", "CB-123", "a.*b", "abc", "a".repeat(33), "a@example.test"]) assert.equal(typoPattern(term), null);
});

test("breadcrumb ripristina solo URL della propria lista, mai URL esterni o eseguibili", () => {
  assert.equal(safeListHref("/commesse?q=aloxe&pagina=2", "/commesse"), "/commesse?q=aloxe&pagina=2");
  for (const value of ["javascript:alert(1)", "//evil.test", "/\\evil.test", "https://evil.test/commesse", "/anagrafiche?q=test", null]) assert.equal(safeListHref(value, "/commesse"), "/commesse");
});
