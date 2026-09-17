import assert from "node:assert/strict";
import test from "node:test";
import { parseJsonField } from "./form-validation";
import { RigheOrdineSchema, TestataOrdineSchema } from "./ordini-validation";
import { ReferentiSchema } from "./referenti-validation";

const riga = { descrizione: "Cavo", quantita: "2,5", prezzoUnitario: "10", sconto: "20" };

test("ricalcola l'imponibile e normalizza decimali e date senza fidarsi del totale client", () => {
  const result = parseJsonField(JSON.stringify([{ ...riga, imponibile: 999, ddtData: "2024-02-29" }]), RigheOrdineSchema);
  assert.ok(result.success);
  assert.equal(result.data[0].imponibile, 20);
  assert.equal(result.data[0].quantita, 2.5);
  assert.equal(result.data[0].ddtData?.toISOString(), "2024-02-29T00:00:00.000Z");
  assert.equal(result.data[0].quantitaRicevuta, null);
});

test("rifiuta strutture JSON malformate senza eccezioni né elenchi vuoti sostitutivi", () => {
  for (const value of [null, "{", "null", "{}", "[null]", "[42]"]) {
    assert.equal(parseJsonField(value, RigheOrdineSchema).success, false);
    assert.equal(parseJsonField(value, ReferentiSchema).success, false);
  }
});

test("rifiuta quantità, prezzi, sconti e date invalidi anziché salvarli come zero o null", () => {
  for (const patch of [
    { quantita: "abc" }, { quantita: -1 }, { prezzoUnitario: "Infinity" },
    { prezzoUnitario: true }, { sconto: 101 }, { sconto: -5 },
    { aliquotaIva: 101 }, { quantitaRicevuta: -1 },
    { ddtData: "2026-02-30" }, { fatturaData: "ieri" },
    { descrizione: " " }, { quantita: 1e15, prezzoUnitario: 1e15 },
  ]) {
    const result = parseJsonField(JSON.stringify([{ ...riga, ...patch }]), RigheOrdineSchema);
    assert.equal(result.success, false, JSON.stringify(patch));
  }
});

test("conserva i campi numerici vuoti facoltativi e lo sconto del 100%", () => {
  const [empty, free] = RigheOrdineSchema.parse([
    { descrizione: "Da quotare", quantita: "", prezzoUnitario: "" },
    { ...riga, sconto: "100" },
  ]);
  assert.equal(empty.imponibile, 0);
  assert.equal(empty.sconto, null);
  assert.equal(free.imponibile, 0);
});

test("arrotonda gli importi al centesimo senza gli errori del floating point", () => {
  const [row] = RigheOrdineSchema.parse([{ descrizione: "Materiale", quantita: "3", prezzoUnitario: "3.35" }]);
  assert.equal(row.imponibile, 10.05);
  const [half] = RigheOrdineSchema.parse([{ descrizione: "Materiale", quantita: "1.25", prezzoUnitario: "8.06" }]);
  assert.equal(half.imponibile, 10.08);
});

test("rifiuta righe duplicate e non scarta righe incomplete durante un aggiornamento", () => {
  const rows = [{ ...riga, id: "r1" }, { ...riga, id: "r1" }];
  assert.equal(RigheOrdineSchema.safeParse(rows).success, false);
  assert.equal(RigheOrdineSchema.safeParse([riga, { descrizione: "" }]).success, false);
});

test("solo un elenco referenti esplicitamente vuoto rappresenta la rimozione di tutti i contatti", () => {
  const result = parseJsonField("[]", ReferentiSchema);
  assert.ok(result.success);
  assert.deepEqual(result.data, []);
  const referente = { id: "r1", nome: "Mario", cognome: "Rossi" };
  for (const rows of [
    [referente, { nome: "", cognome: "" }],
    [referente, referente],
    [{ ...referente, principale: "false" }],
  ]) {
    assert.equal(parseJsonField(JSON.stringify(rows), ReferentiSchema).success, false);
  }
});

test("testata ordine: rifiuta stati sconosciuti e date inesistenti", () => {
  const valid = { fornitoreId: "f1", stato: "ORDINATO", data: "2026-09-16" };
  assert.ok(TestataOrdineSchema.safeParse(valid).success);
  assert.equal(TestataOrdineSchema.safeParse({ ...valid, stato: "ALTRO" }).success, false);
  assert.equal(TestataOrdineSchema.safeParse({ ...valid, data: "2026-02-29" }).success, false);
});
