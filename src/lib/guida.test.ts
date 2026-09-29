import assert from "node:assert/strict";
import test from "node:test";
import { aggiungiVisto, giaVisto, parseVisti, tourPerPercorso } from "./guida";

test("tour per percorso esatto e per dettaglio", () => {
  assert.equal(tourPerPercorso("/", "BACKOFFICE")?.chiave, "dashboard");
  assert.equal(tourPerPercorso("/commesse/", "BACKOFFICE")?.chiave, "commesse");
  assert.equal(tourPerPercorso("/commesse/abc123", "BACKOFFICE")?.chiave, "commessa-dettaglio");
  assert.equal(tourPerPercorso("/commesse/nuova", "BACKOFFICE"), null);
  assert.equal(tourPerPercorso("/percorso/inesistente", "BACKOFFICE"), null);
});

test("i tour riservati rispettano il ruolo", () => {
  assert.equal(tourPerPercorso("/utenti", "BACKOFFICE"), null);
  assert.equal(tourPerPercorso("/utenti", "SUPER_ADMIN")?.chiave, "utenti");
  assert.equal(tourPerPercorso("/progetti", "AMMINISTRAZIONE"), null);
});

test("chiavi uniche e passi non vuoti", () => {
  const chiavi = ["/", "/anagrafiche", "/commesse", "/progetti", "/ordini", "/materiali", "/statistiche",
    "/attivita", "/notifiche", "/assistente", "/segnalazioni", "/utenti", "/impostazioni",
    "/commesse/x", "/anagrafiche/x"].map((p) => tourPerPercorso(p, "SUPER_ADMIN")!);
  assert.equal(new Set(chiavi.map((t) => t.chiave)).size, chiavi.length);
  for (const t of chiavi) assert.ok(t.passi.length > 0);
});

test("elenco dei tour visti", () => {
  assert.deepEqual(parseVisti(""), []);
  assert.deepEqual(parseVisti(null), []);
  assert.equal(aggiungiVisto("", "commesse"), "commesse");
  assert.equal(aggiungiVisto("commesse", "commesse"), "commesse");
  assert.equal(aggiungiVisto("commesse", "ordini"), "commesse,ordini");
  assert.equal(aggiungiVisto("commesse", "*"), "*");
  assert.equal(giaVisto(["*"], "qualsiasi"), true);
  assert.equal(giaVisto(["ordini"], "commesse"), false);
});
