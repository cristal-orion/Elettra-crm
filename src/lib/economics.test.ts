import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@/generated/prisma";
import { calcolaEconomics, type CommessaEconomicsInput } from "./economics";

function commessa(overrides: Partial<CommessaEconomicsInput> = {}): CommessaEconomicsInput {
  return { id: "c1", stato: "ORDINE_CONFERMATO", importoOrdine: "1000", ordiniFornitore: [], ...overrides };
}

test("somma ordini acquisiti e acquisti di più fornitori senza errori decimali", () => {
  const e = calcolaEconomics([
    commessa({ importoOrdine: new Prisma.Decimal("100.30"), ordiniFornitore: [
      { righe: [{ imponibile: "0.1" }, { imponibile: "0.2" }] },
      { righe: [{ imponibile: new Prisma.Decimal("20") }] },
    ] }),
    commessa({ id: "c2", stato: "FATTURATA", importoOrdine: "99.70" }),
  ]);
  assert.equal(e.entrate, "200.00");
  assert.equal(e.uscite, "20.30");
  assert.equal(e.margine, "179.70");
  assert.equal(e.marginePercentuale, 89.9);
  assert.equal(e.ordiniAcquisto, 2);
  assert.equal(e.dettaglio[0].margine, "80.00");
});

test("include tutti gli stati acquisiti, esclude ricavi aperti o persi ma conserva i loro costi", () => {
  const stati = ["LEAD", "PREVENTIVO", "INVIATA", "IN_FOLLOWUP", "PERSA", "ORDINE_CONFERMATO", "IN_ESECUZIONE", "CONSUNTIVO", "FATTURATA"];
  const e = calcolaEconomics(stati.map((stato, i) => commessa({
    id: `c${i}`, stato, ordiniFornitore: [{ righe: [{ imponibile: "10" }] }],
  })));
  assert.equal(e.commesseAcquisite, 4);
  assert.equal(e.entrate, "4000.00");
  assert.equal(e.uscite, "90.00");
  assert.equal(e.margine, "3910.00");
  assert.equal(e.dettaglio[4].margine, "-10.00");
});

test("un importo acquisito mancante rende il margine incompleto, senza nascondere i costi", () => {
  const e = calcolaEconomics([
    commessa(),
    commessa({ id: "c2", importoOrdine: null, ordiniFornitore: [{ righe: [{ imponibile: "200" }] }] }),
    commessa({ id: "c3", stato: "PREVENTIVO", importoOrdine: null }),
  ]);
  assert.equal(e.importiMancanti, 1);
  assert.equal(e.entrate, "1000.00");
  assert.equal(e.uscite, "200.00");
  assert.equal(e.margine, null);
  assert.equal(e.marginePercentuale, null);
  assert.equal(e.dettaglio[1].entrate, null);
  assert.equal(e.dettaglio[1].margine, null);
  assert.equal(e.dettaglio[2].entrate, "0.00");
});

test("zero è un importo noto e non genera divisioni per zero", () => {
  const e = calcolaEconomics([commessa({ importoOrdine: 0, ordiniFornitore: [{ righe: [{ imponibile: 30 }] }] })]);
  assert.equal(e.importiMancanti, 0);
  assert.equal(e.margine, "-30.00");
  assert.equal(e.marginePercentuale, null);
});

test("se gli acquisti superano i ricavi mostra un margine negativo", () => {
  const e = calcolaEconomics([commessa({ ordiniFornitore: [{ righe: [{ imponibile: "1250" }] }] })]);
  assert.equal(e.margine, "-250.00");
  assert.equal(e.marginePercentuale, -25);
});

test("cliente senza commesse e ordini senza righe hanno valori a zero", () => {
  const vuoto = calcolaEconomics([]);
  assert.equal(vuoto.entrate, "0.00");
  assert.equal(vuoto.uscite, "0.00");
  assert.equal(vuoto.margine, "0.00");
  assert.equal(vuoto.marginePercentuale, null);
  assert.deepEqual(vuoto.dettaglio, []);
  const e = calcolaEconomics([commessa({ ordiniFornitore: [{ righe: [] }] })]);
  assert.equal(e.uscite, "0.00");
  assert.equal(e.ordiniAcquisto, 1);
});
