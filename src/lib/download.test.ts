import assert from "node:assert/strict";
import test from "node:test";
import { downloadHeaders } from "./download";

test("SVG, HTML e MIME manipolati vengono scaricati senza esecuzione inline", () => {
  for (const mime of ["text/html", "image/svg+xml", "image/SVG+XML", "image/svg+xml; charset=utf-8", "image/unknown", null]) {
    const headers = downloadHeaders("allegato.txt", mime, 20);
    assert.match(headers["Content-Disposition"], /^attachment;/);
    assert.equal(headers["Content-Type"], "application/octet-stream");
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.equal(headers["Content-Security-Policy"], "sandbox");
  }
});

test("PDF e immagini raster mantengono l'anteprima e i nomi Unicode", () => {
  for (const mime of ["application/pdf", "image/png", "image/jpeg"]) {
    const headers = downloadHeaders("scheda è.pdf", mime, 42);
    assert.match(headers["Content-Disposition"], /^inline;/);
    assert.ok(headers["Content-Disposition"].includes("scheda%20%C3%A8.pdf"));
    assert.equal(headers["Content-Type"], mime);
    assert.equal(headers["Cache-Control"], "private, no-store");
  }
});
