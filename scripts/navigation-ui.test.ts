import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { chromium, type Page } from "playwright";
import { PrismaClient } from "../src/generated/prisma";
import { testDatabase } from "./test-database";

test("Sprint 0: filtri live, cronologia, breadcrumb e scroll su dati isolati", { timeout: 180_000 }, async () => {
  const database = testDatabase();
  const db = new PrismaClient({ datasourceUrl: database.url });
  const secret = randomBytes(48).toString("hex");
  const portServer = createServer();
  portServer.listen(0, "127.0.0.1");
  await once(portServer, "listening");
  const port = (portServer.address() as { port: number }).port;
  await new Promise<void>((resolve) => portServer.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, NODE_ENV: "development", DATABASE_URL: database.url, SESSION_SECRET: secret, DATA_ENCRYPTION_SECRET: randomBytes(48).toString("hex"), APP_ORIGIN: origin, GEMINI_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  app.stdout.on("data", (chunk) => { logs += chunk; });
  app.stderr.on("data", (chunk) => { logs += chunk; });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Next non pronto: ${logs}`)), 60_000);
      app.stdout.on("data", (chunk) => { if (String(chunk).includes("Ready")) { clearTimeout(timeout); resolve(); } });
      app.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Next terminato ${code}: ${logs}`)); });
    });
    const user = await db.user.create({ data: { email: "ui@example.test", passwordHash: "unused-test-account", nome: "UI", cognome: "Test", ruolo: "SUPER_ADMIN", guidaVista: "*" } });
    const cliente = await db.anagrafica.create({ data: { ragioneSociale: "Àloxe Caffè Impianti", isCliente: true } });
    await db.commessa.createMany({ data: Array.from({ length: 65 }, (_, i) => ({ id: `ui-job-${i}`, numero: `26${String(i + 1).padStart(4, "0")}`, anno: 2026, progressivo: i + 1, clienteId: cliente.id, stato: "INVIATA", descrizione: `Impianto ${i + 1}` })) });
    await db.commessa.create({ data: { id: "ui-project", numero: "269999", anno: 2026, progressivo: 9999, clienteId: cliente.id, stato: "IN_ESECUZIONE", descrizione: "Cantiere operativo" } });
    await db.attivita.create({ data: { titolo: "Richiamare cliente", userId: user.id, commessaId: "ui-job-0", clienteId: cliente.id } });
    await db.notifica.create({ data: { userId: user.id, titolo: "Promemoria UI", testo: "Notifica di prova", href: "/attivita" } });
    await db.prodotto.create({ data: { id: "ui-material", codice: "CB-123", descrizione: "Càvo elettrico", marca: "Marca" } });
    const supplier = await db.anagrafica.create({ data: { id: "ui-supplier", ragioneSociale: "Fornitore Cavi", isFornitore: true } });
    await db.ordineFornitore.create({ data: { id: "ui-order", numero: "OD-123", fornitoreId: supplier.id, commessaId: "ui-job-0", righe: { create: { prodottoId: "ui-material", codiceProdotto: "CB-123", descrizione: "Càvo elettrico", quantita: 2, prezzoUnitario: 10, imponibile: 20 } } } });
    await db.segnalazione.create({ data: { id: "ui-feedback", titolo: "Pulsante attività", descrizione: "Verificare filtro", autoreId: user.id } });
    await db.operaio.create({ data: { nome: "Niccolò", cognome: "Rossi", squadra: "Èquipe" } });
    const token = await new SignJWT({ userId: user.id, ruolo: user.ruolo, nome: user.nome, sessionVersion: 0 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addCookies([{ name: "elettra_session", value: token, url: origin }]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const list = `${origin}/commesse?stato=INVIATA&pagina=2&ordine=numero_asc&q=impianto%20aloxe`;
    const ready = async (p: Page) => {
      await p.getByRole("button", { name: "Applica filtri" }).waitFor();
      await p.waitForFunction(() => Boolean(history.state?.crmNavigation));
    };
    await page.goto(list);
    await ready(page);
    assert.equal(await page.locator("tbody tr").count(), 30);
    const row = page.getByRole("link", { name: "Apri commessa 260051 — Àloxe Caffè Impianti", exact: true });
    await row.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => window.scrollY);
    assert.ok(y > 0);
    await row.click();
    await page.getByRole("button", { name: "← Indietro", exact: true }).waitFor();
    await page.getByRole("button", { name: "← Indietro", exact: true }).click();
    await page.waitForURL(list);
    await ready(page);
    await page.waitForFunction((expected) => Math.abs(window.scrollY - expected) < 20, y);
    await row.click();
    await page.getByRole("button", { name: "← Indietro", exact: true }).waitFor();
    await page.goBack();
    await page.waitForURL(list);
    await ready(page);
    await page.waitForFunction((expected) => Math.abs(window.scrollY - expected) < 20, y);
    console.log("PASS: indietro app/browser conserva pagina, filtri, ordinamento e scroll");

    await row.click();
    await page.getByRole("link", { name: "Modifica", exact: true }).click();
    await page.waitForURL(/\/commesse\/ui-job-50\/modifica$/);
    await page.getByRole("heading", { name: "Modifica commessa", exact: true }).waitFor();
    await page.getByRole("navigation", { name: "Percorso di navigazione" }).getByRole("link", { name: "Commesse", exact: true }).click();
    await page.waitForURL(list.replace("%20", "+"));
    await ready(page);
    await page.waitForFunction((expected) => Math.abs(window.scrollY - expected) < 20, y);
    await page.goBack();
    await page.waitForURL(/\/commesse\/ui-job-50\/modifica$/);
    console.log("PASS: breadcrumb ripristina lista e resta distinto dalla cronologia");

    await page.goto(`${origin}/commesse`);
    await ready(page);
    const historyLength = await page.evaluate(() => history.length);
    await page.getByRole("searchbox", { name: "Cerca", exact: true }).fill("CAFFE aloxe");
    await page.waitForURL((u) => u.searchParams.get("q") === "CAFFE aloxe");
    await page.getByRole("status").filter({ hasText: "66 risultati" }).waitFor();
    assert.equal(await page.evaluate(() => history.length), historyLength);
    assert.equal(await page.getByRole("searchbox").inputValue(), "CAFFE aloxe");
    await page.route("**/commesse?**", async (route) => {
      const query = new URL(route.request().url()).searchParams;
      if (query.get("q") === "inesistente") await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    const slow = page.waitForRequest((request) => new URL(request.url()).searchParams.get("q") === "inesistente");
    await page.getByRole("searchbox").fill("inesistente");
    await slow;
    await page.getByRole("searchbox").fill("ALOXE");
    await page.waitForURL((u) => u.searchParams.get("q") === "ALOXE");
    await page.getByRole("status").filter({ hasText: "66 risultati" }).waitFor();
    assert.equal(await page.getByRole("searchbox").inputValue(), "ALOXE");
    await page.getByLabel("Stato", { exact: true }).selectOption("INVIATA");
    await page.getByRole("button", { name: "Applica filtri" }).click();
    await page.getByRole("status").filter({ hasText: "65 risultati" }).waitFor();
    await page.getByRole("button", { name: "Azzera", exact: true }).click();
    await page.waitForURL((u) => !u.searchParams.has("q") && !u.searchParams.has("stato"));
    await page.getByRole("status").filter({ hasText: "66 risultati" }).waitFor();
    assert.equal(await page.getByRole("searchbox").inputValue(), "");
    console.log("PASS: ricerca live, accenti/token, risposte fuori ordine, Applica/Azzera");

    await page.getByRole("searchbox").fill("alxoe");
    await page.waitForURL((u) => u.searchParams.get("q") === "alxoe");
    await page.getByRole("note").filter({ hasText: "risultati simili" }).waitFor();
    await page.getByRole("status").filter({ hasText: "66 risultati" }).waitFor();
    await page.getByLabel("Stato", { exact: true }).selectOption("INVIATA");
    await page.getByRole("button", { name: "Applica filtri" }).click();
    await page.getByRole("status").filter({ hasText: "65 risultati" }).waitFor();
    console.log("PASS: refuso segnalato, risultati simili limitati ai filtri attivi");

    for (const [path, query] of [["anagrafiche", "caffe"], ["progetti", "aloxe"], ["attivita", "Richiamare"]]) {
      await page.goto(`${origin}/${path}`); await ready(page);
      await page.getByRole("searchbox").fill(query);
      await page.waitForURL((u) => u.searchParams.get("q") === query);
      await page.getByRole("status").filter({ hasText: "1 risultati" }).waitFor();
    }
    await page.goto(`${origin}/notifiche`); await ready(page);
    await page.getByLabel("Stato", { exact: true }).selectOption("lette");
    await page.getByRole("button", { name: "Applica filtri" }).click();
    await page.getByRole("status").filter({ hasText: "0 risultati" }).waitFor();
    await page.getByRole("button", { name: "Azzera", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "1 risultati" }).waitFor();
    console.log("PASS: ricerca/filtri nei cinque moduli");

    for (const scenario of [
      { path: "ordini", query: "OD-123", filter: "Stato", empty: "RICEVUTO", title: "OD-123" },
      { path: "materiali", query: "eletrico", filter: "Scheda tecnica", empty: "presente", title: "Càvo elettrico" },
      { path: "segnalazioni", query: "pulsante", filter: "Situazione", empty: "concluse", title: "Pulsante attività" },
    ]) {
      await page.goto(`${origin}/${scenario.path}`); await ready(page);
      await page.getByRole("searchbox").fill(scenario.query);
      await page.waitForURL((u) => u.searchParams.get("q") === scenario.query);
      await page.getByRole("status").filter({ hasText: "1 risultati" }).waitFor();
      const filtered = page.url();
      await page.getByRole("link", { name: scenario.title, exact: true }).click();
      await page.getByRole("button", { name: "← Indietro", exact: true }).click();
      await page.waitForURL(filtered); await ready(page);
      await page.getByLabel(scenario.filter, { exact: true }).selectOption(scenario.empty);
      await page.getByRole("button", { name: "Applica filtri" }).click();
      await page.getByRole("status").filter({ hasText: "0 risultati" }).waitFor();
      await page.getByRole("button", { name: "Azzera", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "1 risultati" }).waitFor();
    }
    await page.goto(`${origin}/progetti/operai`); await ready(page);
    await page.getByRole("searchbox").fill("nicolo");
    await page.waitForURL((u) => u.searchParams.get("q") === "nicolo");
    await page.getByRole("note").filter({ hasText: "risultati simili" }).waitFor();
    await page.getByRole("status").filter({ hasText: "1 risultati" }).waitFor();
    await page.goto(`${origin}/utenti`); await ready(page);
    await page.getByRole("searchbox").fill("test");
    await page.waitForURL((u) => u.searchParams.get("q") === "test");
    await page.getByRole("status").filter({ hasText: "1 risultati" }).waitFor();
    await page.getByLabel("Accesso", { exact: true }).selectOption("disattivati");
    await page.getByRole("button", { name: "Applica filtri" }).click();
    await page.getByRole("status").filter({ hasText: "0 risultati" }).waitFor();
    await page.goto(`${origin}/materiali/prezzi`); await ready(page);
    await page.getByRole("searchbox").fill("CB-123");
    await page.waitForURL((u) => u.searchParams.get("q") === "CB-123");
    await page.getByRole("status").filter({ hasText: "1 risultati" }).waitFor();
    console.log("PASS: Ordini, Materiali, Segnalazioni, Operai, Utenti e Storico prezzi");

    const direct = await context.newPage();
    await direct.goto(`${origin}/commesse/ui-job-0`);
    await direct.waitForFunction(() => Boolean(history.state?.crmNavigation));
    await direct.getByRole("button", { name: "← Indietro", exact: true }).click();
    await direct.waitForURL(`${origin}/commesse`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/progetti`); await ready(page);
    await page.getByRole("searchbox").fill("aloxe");
    await page.waitForURL((u) => u.searchParams.get("q") === "aloxe");
    await page.getByRole("status").filter({ hasText: "1 risultati" }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    console.log("PASS: ingresso diretto con fallback e filtri mobile senza overflow");
  } catch (error) {
    console.error(logs.slice(-6000));
    throw error;
  } finally {
    await browser?.close();
    const stopped = once(app, "exit");
    app.kill("SIGTERM");
    if (app.exitCode === null) await stopped;
    await database.cleanup(db);
  }
});
