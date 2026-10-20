import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "../src/generated/prisma";
import { findSimilarAnagrafiche } from "../src/lib/anagrafica-duplicates";
import type { AnagraficaMatchInput } from "../src/lib/anagrafica-match";
import { testDatabase } from "./test-database";

test("anagrafiche simili: segnali consultivi su PostgreSQL, nessuna modifica", async (t) => {
  const database = testDatabase();
  const db = new PrismaClient({ datasourceUrl: database.url });
  const query = (input: Partial<AnagraficaMatchInput> & { excludeId?: string }) => findSimilarAnagrafiche(db, {
    ragioneSociale: "", partitaIva: "", codiceFiscale: "", email: "", telefono: "", ...input,
  });
  try {
    const a = await db.anagrafica.create({ data: {
      ragioneSociale: "Àloxe Caffè Impianti S.r.l.", isFornitore: true, partitaIva: "01234567890", codiceFiscale: "RSSMRA80A01H501U",
      email: " Info@Example.test ", telefono: "+39 (02) 1234-5678", localita: "Milano",
      referenti: { create: [{ nome: "Ada", cognome: "Rossi", email: "ada@example.test", telefono: "333 987 6543" }, { nome: "Mario", cognome: "Rossi", email: "ada@example.test" }] },
    } });
    await t.test("nome normalizzato, parole riordinate, forma societaria e refuso", async () => {
      for (const ragioneSociale of ["ALOXE CAFFE", "caffe\u0300 impianti àloxe SRL", "alxoe caffe impainti s.r.l."]) {
        const result = await query({ ragioneSociale });
        assert.deepEqual(result.candidati.map((a) => a.id), [a.id]);
        assert.deepEqual(result.candidati[0].motivi, ["nome"]);
      }
      assert.deepEqual((await query({ ragioneSociale: "alxxxe caffe" })).candidati, []);
    });
    await t.test("dati fiscali esatti e contatti anche dei referenti, senza duplicati", async () => {
      for (const input of [{ partitaIva: " 01234567890 " }, { codiceFiscale: "rssmra80a01h501u" }, { email: "INFO@example.test" }, { email: "ada@example.test" }, { telefono: "00390212345678" }, { telefono: "333-987-6543" }]) {
        const result = await query(input);
        assert.equal(result.candidati.length, 1);
        assert.equal(result.candidati[0].id, a.id);
        assert.deepEqual(result.candidati[0].motivi, Object.keys(input));
      }
      assert.equal((await query({ partitaIva: "01234567891" })).candidati.length, 0);
      assert.equal((await query({ email: "ad@example.test" })).candidati.length, 0);
      assert.equal((await query({ telefono: "3339876544" })).candidati.length, 0);
      assert.equal((await query({ ragioneSociale: "aloxe", partitaIva: a.partitaIva!, excludeId: a.id })).candidati.length, 0);
    });
    await t.test("soglie minime, campi vuoti e input SQL/regex non diventano ricerche globali", async () => {
      for (const input of [{}, { ragioneSociale: "S.r.l." }, { ragioneSociale: "ab" }, { telefono: "123" }, { email: "@" }, { partitaIva: "' OR 1=1 --" }, { ragioneSociale: "(.*) %_" }]) {
        assert.deepEqual((await query(input)).candidati, []);
      }
    });
    await t.test("limite 5, identificativo fiscale prima dei nomi e nomi esatti prima dei refusi", async () => {
      await db.anagrafica.createMany({ data: Array.from({ length: 8 }, (_, i) => ({ ragioneSociale: `Alxoe Caffè Impianti ${i}`, isCliente: true })) });
      const result = await query({ ragioneSociale: "alxoe caffe impianti", partitaIva: "01234567890" });
      assert.equal(result.candidati.length, 5); assert.equal(result.altri, true);
      assert.equal(result.candidati[0].id, a.id);
      assert.deepEqual(result.candidati[0].motivi, ["partitaIva", "nome"]);
      const byName = await query({ ragioneSociale: "alxoe caffe impianti" });
      assert.ok(byName.candidati.every((r) => r.id !== a.id));
      assert.deepEqual(await db.anagrafica.findUnique({ where: { id: a.id } }), a);
      assert.equal(await db.anagrafica.count(), 9);
    });
  } finally { await database.cleanup(db); }
});
