import assert from "node:assert/strict";
import test from "node:test";
import { avanzamento, descrizioneSal } from "./progetti";

test("SAL: sopralluogo di mezza giornata pesa meno di 60 giorni di lavoro", () => {
  const rows = [{ stato: "COMPLETATA", durataGiorni: 0.5 }, { stato: "IN_CORSO", durataGiorni: 60 }];
  assert.equal(avanzamento(rows).percentuale, 1);
  assert.equal(avanzamento(rows.map((m) => ({ ...m, stato: "COMPLETATA" }))).percentuale, 100);
  assert.equal(avanzamento([{ stato: "COMPLETATA", durataGiorni: 1000 }, { stato: "DA_FARE", durataGiorni: 0.125 }]).percentuale, 99);
});

test("SAL: nessun peso inventato per dati mancanti e nessun avanzamento per tempo trascorso", () => {
  assert.equal(avanzamento([]).percentuale, null);
  assert.equal(avanzamento([{ stato: "COMPLETATA" }]).percentuale, null);
  for (const durataGiorni of [null, 0, -1, NaN, Infinity]) assert.equal(avanzamento([{ stato: "COMPLETATA", durataGiorni }]).percentuale, null);
  assert.equal(avanzamento([{ stato: "IN_CORSO", durataGiorni: 1, dataPianificata: new Date("2000-01-01") }]).percentuale, 0);
  const real = avanzamento([{ stato: "COMPLETATA", dimostrativa: true }, { stato: "DA_FARE", durataGiorni: 1 }]);
  assert.equal(real.percentuale, 0); assert.equal(real.totali, 1);
  assert.match(descrizioneSal(avanzamento([{ stato: "COMPLETATA" }])), /durata da definire/);
});
