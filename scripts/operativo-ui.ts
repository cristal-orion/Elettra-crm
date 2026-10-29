import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { SignJWT } from "jose";
import type { Browser, Page } from "playwright";
import type { PrismaClient } from "../src/generated/prisma";
import { giornoAttivita } from "../src/lib/attivita";

export async function verifyOperativoUi({ page: adminPage, browser, db, origin, secret, uploads }: {
  page: Page; browser: Browser; db: PrismaClient; origin: string; secret: string; uploads: string;
}) {
  const pm = await db.user.create({ data: { id: "operativo-pm", email: "operativo-pm@test.invalid", nome: "Marco", cognome: "Rinaldi", ruolo: "PROJECT_MANAGER", passwordHash: "unused", guidaVista: "*" } });
  const colleague = await db.user.create({ data: { id: "operativo-collega", email: "operativo-collega@test.invalid", nome: "Elena", cognome: "Bianchi", ruolo: "PROJECT_MANAGER", passwordHash: "unused", guidaVista: "*" } });
  const cliente = await db.anagrafica.create({ data: { ragioneSociale: "Officina Nord · collaudo operativo", isCliente: true } });
  const job = await db.commessa.create({ data: { id: "operativo-job", numero: "OP9001", anno: 2026, progressivo: 29001, clienteId: cliente.id, pmId: pm.id, stato: "IN_ESECUZIONE", importoOrdine: 98765,
    milestone: { create: [{ titolo: "Rilievo quadro", ordine: 0, durataGiorni: 1 }, { titolo: "Posa canaline", ordine: 1, durataGiorni: 9 }, { titolo: "Fase dimostrativa", ordine: 2, dimostrativa: true }] } } });
  const hidden = await db.commessa.create({ data: { numero: "OP9002", anno: 2026, progressivo: 29002, clienteId: cliente.id, stato: "IN_ESECUZIONE", descrizione: "Cantiere riservato di un altro PM" } });
  const economic = await db.documento.create({ data: { commessaId: job.id, nomeFile: "offerta-riservata.pdf", categoria: "OFFERTA", percorso: "not-stored/economico.pdf" } });
  const contextFor = async (user: typeof pm) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const token = await new SignJWT({ userId: user.id, ruolo: user.ruolo, nome: user.nome, sessionVersion: 0 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
    await context.addCookies([{ name: "elettra_session", value: token, url: origin }]);
    return context;
  };
  const context = await contextFor(pm); const otherContext = await contextFor(colleague);
  const page = await context.newPage(); const other = await otherContext.newPage();
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message)); other.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(`${origin}/progetti/${job.id}`); await page.waitForLoadState("networkidle");
    assert.doesNotMatch(await page.locator("main").innerText(), /98\.765|Importo ordine/);
    await page.getByRole("link", { name: "Aggiorna SAL", exact: true }).click();
    await page.waitForLoadState("networkidle");
    assert.equal(await page.getByLabel("Stato Fase dimostrativa", { exact: true }).count(), 0);
    await page.getByLabel("Stato Rilievo quadro", { exact: true }).selectOption("COMPLETATA");
    await page.getByLabel("Nota di cantiere", { exact: true }).fill("Rilievo verificato con il cliente");
    await page.getByLabel("Foto o documenti (facoltativi)", { exact: true }).setInputFiles({ name: "rilievo.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nRilievo di collaudo") });
    let loseResponse = true;
    await page.route(`**/progetti/${job.id}/sal`, async (route) => {
      if (route.request().method() !== "POST" || !loseResponse) return route.continue();
      loseResponse = false;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      await route.fulfill({ status: 503, contentType: "text/plain", body: "Risposta persa dopo il salvataggio" });
    });
    await page.getByRole("button", { name: "Salva aggiornamento SAL", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Connessione interrotta" }).waitFor();
    const filesBefore = await readdir(uploads, { recursive: true });
    await page.getByRole("button", { name: "Salva aggiornamento SAL", exact: true }).click();
    await page.waitForURL((u) => u.searchParams.get("esito") === "sal");
    await page.getByRole("status").filter({ hasText: "Aggiornamento SAL e allegati salvati" }).waitFor();
    await page.getByText(/SAL 0% → 10%/).waitFor();
    const doc = await db.documento.findFirstOrThrow({ where: { commessaId: job.id, aggiornamentoId: { not: null } } });
    assert.equal((await context.request.get(`${origin}/documenti/${doc.id}`)).status(), 200);
    assert.equal((await context.request.get(`${origin}/documenti/${economic.id}`)).status(), 404);
    // Il retry dal form dopo una risposta persa non duplica dati o file.
    await page.unroute(`**/progetti/${job.id}/sal`);
    assert.equal(await db.aggiornamentoCantiere.count({ where: { commessaId: job.id, tipo: "SAL" } }), 1);
    assert.deepEqual(await readdir(uploads, { recursive: true }), filesBefore);
    await page.goto(`${origin}/progetti/${job.id}/sal`); await page.waitForLoadState("networkidle");
    await page.getByLabel("Foto o documenti (facoltativi)", { exact: true }).setInputFiles({ name: "rollback.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nRollback") });
    await db.commessa.update({ where: { id: job.id }, data: { versioneOperativa: { increment: 1 } } });
    await page.getByRole("button", { name: "Salva aggiornamento SAL", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "aggiornato da un collega" }).waitFor();
    assert.deepEqual(await readdir(uploads, { recursive: true }), filesBefore);
    assert.equal(await db.documento.count({ where: { nomeFile: "rollback.pdf" } }), 0);

    await page.goto(`${origin}/progetti/${job.id}/problemi/nuovo`); await page.waitForLoadState("networkidle");
    await page.getByLabel("Titolo del problema", { exact: true }).fill("Interruttore da consegnare");
    await page.getByLabel("Cosa è successo?", { exact: true }).fill("Manca l’interruttore del quadro principale");
    await page.getByLabel("Assegna a", { exact: true }).selectOption(colleague.id);
    await page.getByLabel("Scadenza", { exact: true }).fill(giornoAttivita().toISOString().slice(0, 10));
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Apri problema", exact: true }).click();
    await page.waitForURL(/\/problemi\/[^/]+\?esito=salvato/);
    const problem = await db.problemaCantiere.findFirstOrThrow({ where: { commessaId: job.id } });
    const task = await db.attivita.findUniqueOrThrow({ where: { problemaId: problem.id } });
    await other.goto(`${origin}/notifiche`); await other.waitForLoadState("networkidle");
    await other.getByRole("button", { name: `Problema assegnato · ${job.numero}`, exact: true }).click();
    await other.waitForURL(`${origin}/problemi/${problem.id}`);
    await other.getByRole("link", { name: "Apri attività collegata →", exact: true }).click();
    await other.waitForURL(`${origin}/attivita/${task.id}`);
    assert.equal(await other.getByRole("button", { name: /Segna completata/ }).count(), 0);
    await other.getByRole("link", { name: "Aggiorna problema collegato →", exact: true }).click();
    await other.getByLabel("Stato", { exact: true }).selectOption("RISOLTA");
    await other.getByLabel("Commento o nota di risoluzione", { exact: true }).fill("Materiale ricevuto e installato");
    await other.getByRole("button", { name: "Salva aggiornamento", exact: true }).click();
    await other.getByRole("status").filter({ hasText: "Problema salvato" }).waitFor();
    assert.equal((await db.attivita.findUniqueOrThrow({ where: { id: task.id } })).stato, "COMPLETATA");
    await page.goto(origin); await page.waitForLoadState("networkidle");
    assert.equal(await page.getByRole("heading", { name: "Consuntivi ore e materiali", exact: true }).count(), 0);
    await page.getByRole("link").filter({ hasText: "Cantieri aperti" }).click();
    await page.getByRole("status").filter({ hasText: "1 risultati" }).waitFor();
    await page.goto(`${origin}/progetti/${hidden.id}`);
    assert.doesNotMatch(await page.locator("body").innerText(), /Cantiere riservato di un altro PM/);
    for (const path of ["/ordini", "/commerciale", "/consuntivi", `/commesse/${job.id}/consuntivo`]) {
      await page.goto(`${origin}${path}`); await page.waitForURL(`${origin}/progetti`);
    }
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [`/progetti/${job.id}`, `/progetti/${job.id}/sal`, `/problemi/${problem.id}`, "/", "/risorse"]) {
        await page.goto(`${origin}${path}`); await page.waitForLoadState("networkidle");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow ${width}: ${path}`);
      }
    }
    await adminPage.goto(`${origin}/?periodo=tutti`);
    await adminPage.getByRole("link", { name: "Apri rendiconti del periodo →", exact: true }).click();
    await adminPage.waitForURL(`${origin}/consuntivi?periodo=tutti`);
    assert.deepEqual(errors, []);
    console.log("PASS: PM → SAL/allegato/retry/rollback → problema/attività/notifica/risoluzione; scope e 15 viste responsive");
  } finally { await context.close(); await otherContext.close(); }
}
