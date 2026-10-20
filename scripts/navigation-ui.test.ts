import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
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
  const uploads = await mkdtemp("/tmp/opencode/elettra-ui-uploads-");
  const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, NODE_ENV: "development", DATABASE_URL: database.url, SESSION_SECRET: secret, DATA_ENCRYPTION_SECRET: randomBytes(48).toString("hex"), APP_ORIGIN: origin, GEMINI_API_KEY: "", UPLOADS_DIR: uploads },
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
      // Aspetta anche i bundle: i campi SSR sono visibili prima degli handler React.
      await p.waitForLoadState("networkidle");
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

    await page.goto(`${origin}/progetti/ui-project`);
    const panel = page.getByRole("region", { name: "Assistenza AI contestuale" });
    // Risposte simulate: nessuna chiamata a Gemini, si verifica il recupero reale della UI.
    let analysisCalls = 0;
    let attemptedTask = "";
    await page.route("**/assistente/api/analysis", async (route) => {
      attemptedTask = route.request().postDataJSON().task;
      if (++analysisCalls === 1) await route.fulfill({ status: 503, headers: { "Retry-After": "1" }, json: { error: "Gemini è temporaneamente sovraccarico.", retryable: true } });
      else await route.fulfill({ json: { sintesi: "Analisi completata dopo indisponibilità.", punti: [], azioniSuggerite: [] } });
    });
    await panel.getByRole("button", { name: "Proponi piano", exact: true }).click();
    await panel.getByRole("alert").filter({ hasText: "sovraccarico" }).waitFor();
    assert.equal(await panel.getByRole("button", { name: /Riprova tra/ }).isDisabled(), true);
    await panel.getByRole("button", { name: "Riprova analisi", exact: true }).click();
    await panel.getByText("Analisi completata dopo indisponibilità.", { exact: true }).waitFor();
    assert.equal(attemptedTask, "Proponi piano");
    assert.equal(analysisCalls, 2);
    await page.unroute("**/assistente/api/analysis");
    await page.route("**/assistente/api/analysis", (route) => route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Bad gateway</h1>" }));
    await panel.getByRole("button", { name: "Analizza ritardi", exact: true }).click();
    await panel.getByRole("alert").filter({ hasText: "Il servizio di analisi non ha risposto correttamente" }).waitFor();
    await page.unroute("**/assistente/api/analysis");
    // Endpoint reale su DB isolato, chiave non configurata: messaggio e stato FAILED persistiti.
    await panel.getByRole("button", { name: "Organizza squadra", exact: true }).click();
    await panel.getByRole("alert").filter({ hasText: "Configura Gemini" }).waitFor();
    const failedAnalysis = await db.aiOperation.findFirstOrThrow({ where: { userId: user.id, status: "FAILED" } });
    assert.match(failedAnalysis.error ?? "", /Configura Gemini/);
    console.log("PASS: AI contestuale — cooldown 503, riprova stessa azione, errore proxy e diagnostica persistente");

    const worker = await db.operaio.findFirstOrThrow();
    await db.commessa.update({ where: { id: "ui-project" }, data: { pmId: user.id } });
    await db.assegnazioneOperaio.create({ data: { commessaId: "ui-project", operaioId: worker.id } });
    const otherClient = await db.anagrafica.create({ data: { ragioneSociale: "Altro cliente operativo con una ragione sociale molto lunga per verificare i filtri su telefono", isCliente: true } });
    await db.commessa.create({ data: { numero: "269998", anno: 2026, progressivo: 9998, clienteId: otherClient.id, stato: "IN_ESECUZIONE" } });
    await page.goto(`${origin}/progetti`); await ready(page);
    await page.getByLabel("Project Manager", { exact: true }).selectOption(user.id);
    await page.getByLabel("Cliente", { exact: true }).selectOption(cliente.id);
    await page.getByLabel("Squadra", { exact: true }).selectOption("Èquipe");
    await page.getByLabel("Avanzamento", { exact: true }).selectOption("DA_PIANIFICARE");
    await page.getByRole("button", { name: "Applica filtri" }).click();
    await page.waitForURL((u) => u.searchParams.get("squadra") === "Èquipe");
    await page.getByRole("status").filter({ hasText: "1 risultati" }).waitFor();
    const projectList = page.url();
    await page.getByRole("link", { name: /Apri progetto 269999/ }).click();
    const sections = page.getByRole("navigation", { name: "Sezioni progetto" });
    await sections.getByRole("link", { name: "Avanzamento", exact: true }).click();
    await page.waitForURL((u) => u.searchParams.get("tab") === "avanzamento");
    await page.getByLabel("Nuova milestone", { exact: true }).fill("Sopralluogo operativo");
    await page.getByRole("button", { name: "+ Aggiungi milestone", exact: true }).click();
    await page.getByText("Sopralluogo operativo", { exact: true }).waitFor();
    await page.getByLabel("Stato milestone", { exact: true }).selectOption("COMPLETATA");
    await page.getByText(/1 milestone completate su 1 \(100%\)/).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("tab"), "avanzamento");
    assert.equal(await db.milestone.count({ where: { commessaId: "ui-project", stato: "COMPLETATA" } }), 1);
    await sections.getByRole("link", { name: /^Squadra/ }).click();
    await page.getByRole("heading", { name: /Squadra in cantiere/ }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: /Squadra in cantiere/ }).waitFor();
    await page.getByRole("button", { name: "← Indietro", exact: true }).click();
    await page.waitForURL((u) => u.searchParams.get("tab") === "avanzamento");
    await page.getByRole("navigation", { name: "Percorso di navigazione" }).getByRole("link", { name: "Progetti", exact: true }).click();
    await page.waitForURL(projectList); await ready(page);
    // La milestone completata ha cambiato l'avanzamento; i filtri precedenti restano applicati.
    await page.getByRole("status").filter({ hasText: "0 risultati" }).waitFor();
    assert.equal(await page.getByLabel("Project Manager", { exact: true }).inputValue(), user.id);
    await page.goto(`${origin}/progetti/ui-project?tab=documenti`);
    await page.getByLabel("File (PDF, immagini, disegni…)", { exact: true }).setInputFiles({ name: "note-cantiere.txt", mimeType: "text/plain", buffer: Buffer.from("Documento di collaudo") });
    const uploadRequest = page.waitForRequest((r) => r.method() === "POST" && Boolean(r.headers()["next-action"]));
    await page.getByRole("button", { name: "Carica documenti", exact: true }).click();
    const sentUpload = await uploadRequest;
    await page.getByRole("link", { name: "note-cantiere.txt", exact: true }).waitFor();
    const uploadedDocument = await db.documento.findFirstOrThrow({ where: { commessaId: "ui-project" } });
    assert.equal(await db.documento.count({ where: { commessaId: "ui-project" } }), 1);
    const download = await context.request.get(`${origin}/documenti/${uploadedDocument.id}`);
    assert.equal(await download.text(), "Documento di collaudo");
    await page.getByRole("link", { name: "Apri commessa", exact: true }).click();
    await page.getByRole("link", { name: "note-cantiere.txt", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "note-cantiere.txt", exact: true }).getAttribute("href"), `/documenti/${uploadedDocument.id}`);

    const reader = await db.user.create({ data: { email: "reader-ui@example.test", nome: "Lettura", cognome: "Test", passwordHash: "unused", ruolo: "AMMINISTRAZIONE", guidaVista: "*" } });
    const readerContext = await browser.newContext();
    const readerToken = await new SignJWT({ userId: reader.id, ruolo: reader.ruolo, nome: reader.nome, sessionVersion: 0 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
    await readerContext.addCookies([{ name: "elettra_session", value: readerToken, url: origin }]);
    const readPage = await readerContext.newPage();
    await readPage.goto(`${origin}/progetti/ui-project?tab=documenti`);
    await readPage.getByRole("link", { name: "note-cantiere.txt", exact: true }).waitFor();
    assert.equal(await readPage.getByRole("button", { name: "Carica documenti", exact: true }).count(), 0);
    const denied = await readerContext.request.post(sentUpload.url(), { headers: { "next-action": sentUpload.headers()["next-action"], "content-type": sentUpload.headers()["content-type"], origin }, data: sentUpload.postDataBuffer()! });
    assert.match(await denied.text(), /Non hai i permessi/);
    assert.equal(await db.documento.count({ where: { commessaId: "ui-project" } }), 1);
    await readPage.goto(`${origin}/progetti/ui-project?tab=avanzamento`);
    await readPage.getByRole("heading", { name: "Avanzamento del progetto", exact: true }).waitFor();
    assert.equal(await readPage.getByRole("button", { name: /Salva pianificazione|Aggiungi milestone/ }).count(), 0);
    assert.equal((await readerContext.request.post(`${origin}/anagrafiche/simili`, { headers: { origin }, data: { ragioneSociale: "aloxe" } })).status(), 403);
    await readerContext.close();
    console.log("PASS: Progetti — filtri combinati, sezioni URL/back, milestone, documenti condivisi e permessi server");

    const existing = await db.anagrafica.create({ data: { ragioneSociale: "Identità Impianti S.r.l.", isFornitore: true, partitaIva: "01234567890" } });
    const beforeCreate = await db.anagrafica.count();
    // Compila il dettaglio prima di aprirlo in un'altra scheda: il Fast Refresh di
    // next dev può rimontare i form aperti quando compila nuove route condivise.
    await page.goto(`${origin}/anagrafiche/${existing.id}`); await page.waitForLoadState("networkidle");
    await page.goto(`${origin}/anagrafiche/nuova`); await page.waitForLoadState("networkidle");
    const matches = page.getByRole("region", { name: "Verifica anagrafiche simili" });
    const nameInput = page.getByLabel("Ragione sociale *", { exact: true });
    await nameInput.fill("identita impainti");
    await matches.getByText(existing.ragioneSociale, { exact: true }).waitFor();
    await matches.getByText("Ragione sociale simile", { exact: true }).waitFor();
    await page.getByLabel("Note", { exact: true }).fill("Bozza da conservare");
    const popup = page.waitForEvent("popup");
    await matches.getByRole("link", { name: /Apri scheda esistente/ }).click();
    const existingPage = await popup;
    await existingPage.waitForURL(`${origin}/anagrafiche/${existing.id}`);
    assert.equal(await nameInput.inputValue(), "identita impainti");
    assert.equal(await page.getByLabel("Note", { exact: true }).inputValue(), "Bozza da conservare");
    await existingPage.close();
    await nameInput.fill("Soggetto differente");
    await page.getByLabel("Partita IVA", { exact: true }).fill("01234567890");
    await matches.getByText("Stessa partita IVA", { exact: true }).waitFor();
    await page.getByRole("checkbox", { name: "Cliente (C)", exact: true }).check();
    await page.getByRole("button", { name: "Crea anagrafica", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "P. IVA o codice fiscale già presenti" }).waitFor();
    assert.equal(await db.anagrafica.count(), beforeCreate);
    assert.equal(await nameInput.inputValue(), "Soggetto differente");

    await page.goto(`${origin}/anagrafiche/${existing.id}/modifica`);
    await matches.getByRole("status").filter({ hasText: "Nessuna corrispondenza suggerita" }).waitFor();
    assert.equal(await matches.getByRole("link").count(), 0); // dati precompilati, esclusione del record stesso
    await page.goto(`${origin}/anagrafiche/nuova`); await page.waitForLoadState("networkidle");
    await nameInput.fill(existing.ragioneSociale);
    await matches.getByText(existing.ragioneSociale, { exact: true }).waitFor();
    await page.getByRole("checkbox", { name: "Cliente (C)", exact: true }).check();
    await page.getByRole("button", { name: "Crea anagrafica", exact: true }).click();
    await page.waitForURL((u) => /^\/anagrafiche\/[^/]+$/.test(u.pathname) && u.pathname !== "/anagrafiche/nuova");
    assert.equal(await db.anagrafica.count(), beforeCreate + 1); // il nome simile è consultivo

    await page.goto(`${origin}/anagrafiche/nuova`); await page.waitForLoadState("networkidle");
    let releaseOld!: () => void;
    const holdOld = new Promise<void>((resolve) => { releaseOld = resolve; });
    let oldDone!: () => void;
    const oldFinished = new Promise<void>((resolve) => { oldDone = resolve; });
    await page.route("**/anagrafiche/simili", async (route) => {
      if (route.request().postDataJSON().ragioneSociale !== "Vecchia ricerca") return route.continue();
      await holdOld;
      await route.fulfill({ json: { candidati: [{ ...existing, ragioneSociale: "Risposta obsoleta", motivi: ["nome"] }], altri: false } }).catch(() => {});
      oldDone();
    });
    const oldRequest = page.waitForRequest((r) => r.url().endsWith("/anagrafiche/simili") && r.postDataJSON().ragioneSociale === "Vecchia ricerca");
    await nameInput.fill("Vecchia ricerca"); await oldRequest;
    await nameInput.fill("aloxe");
    await matches.getByText(cliente.ragioneSociale, { exact: true }).waitFor();
    releaseOld(); await oldFinished;
    assert.equal(await matches.getByText("Risposta obsoleta", { exact: true }).count(), 0);
    await page.unroute("**/anagrafiche/simili");
    await page.route("**/anagrafiche/simili", (route) => route.fulfill({ status: 503, json: { error: "Verifica non disponibile." } }));
    await nameInput.fill("aloxe caffe");
    await matches.getByText("Verifica non disponibile.", { exact: true }).waitFor();
    assert.equal(await matches.getByRole("link").count(), 0);
    await page.unroute("**/anagrafiche/simili");
    await matches.getByRole("button", { name: "Riprova verifica", exact: true }).click();
    await matches.getByText(cliente.ragioneSociale, { exact: true }).waitFor();
    await nameInput.fill("");
    await matches.getByRole("status").filter({ hasText: "Compila la ragione sociale" }).waitFor();
    assert.equal(await matches.getByRole("link").count(), 0);
    const anon = await browser.newContext();
    assert.equal((await anon.request.post(`${origin}/anagrafiche/simili`, { data: { ragioneSociale: "aloxe" } })).status(), 401);
    await anon.close();
    assert.equal((await context.request.post(`${origin}/anagrafiche/simili`, { headers: { origin }, data: { ragioneSociale: ["aloxe"] } })).status(), 400);
    assert.equal((await context.request.post(`${origin}/anagrafiche/simili`, { headers: { origin }, data: { ragioneSociale: "x".repeat(9000) } })).status(), 413);
    assert.equal((await context.request.post(`${origin}/anagrafiche/simili`, { headers: { origin: "https://altro.example" }, data: { ragioneSociale: "aloxe" } })).status(), 403);
    console.log("PASS: anagrafiche simili — ricerca live, bozza preservata, controllo fiscale, omonimi consentiti, esclusione di sé, risposte obsolete/errori e permessi API");

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
    for (const tab of ["riepilogo", "avanzamento", "squadra", "documenti"]) {
      await page.goto(`${origin}/progetti/ui-project?tab=${tab}`);
      await page.getByRole("navigation", { name: "Sezioni progetto" }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow nella sezione ${tab}`);
      for (const link of await page.getByRole("navigation", { name: "Sezioni progetto" }).getByRole("link").all()) {
        assert.ok((await link.boundingBox())!.height >= 44);
      }
    }
    await page.goto(`${origin}/anagrafiche/nuova`); await page.waitForLoadState("networkidle");
    await nameInput.fill("identita impianti");
    await matches.getByRole("link", { name: /Apri scheda esistente/ }).first().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Overflow suggerimenti anagrafiche mobile");
    assert.ok((await matches.getByRole("link").first().boundingBox())!.height >= 44);
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
    await rm(uploads, { recursive: true, force: true });
  }
});
