import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { percorsoAssoluto, UPLOADS_DIR } from "./storage";

test("l'archivio risolve i file interni e blocca radice e traversal anche verso cartelle col medesimo prefisso", () => {
  assert.equal(percorsoAssoluto("261001/scheda.pdf"), path.join(UPLOADS_DIR, "261001/scheda.pdf"));
  for (const input of [".", "..", "../secret", "a/../../secret", `${UPLOADS_DIR}-altro/file.pdf`]) {
    assert.throws(() => percorsoAssoluto(input), /Percorso documento non valido/);
  }
});

test("UPLOADS_DIR relativo è normalizzato prima del controllo di contenimento", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", `
    const assert = require('node:assert/strict');
    const path = require('node:path');
    const { percorsoAssoluto } = require('./src/lib/storage.ts');
    assert.equal(percorsoAssoluto('261001/file.pdf'), path.resolve('uploads', '261001/file.pdf'));
  `], { env: { ...process.env, UPLOADS_DIR: "./uploads/" }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
