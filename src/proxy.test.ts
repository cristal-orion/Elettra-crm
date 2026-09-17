import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { COOKIE_NAME } from "./lib/session";

test("il login resta raggiungibile anche con cookie scaduti, invalidi o di utenti disattivati", () => {
  for (const cookie of ["", "scaduto", "non-valido", "sessione-utente-disattivato"]) {
    const response = proxy(new NextRequest("http://localhost/login", {
      headers: { cookie: `${COOKIE_NAME}=${cookie}` },
    }));
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  }
});

test("il proxy rimanda al login le pagine protette prive di cookie", () => {
  const response = proxy(new NextRequest("http://localhost/commesse"));
  assert.equal(response.headers.get("location"), "http://localhost/login");
});
