import assert from "node:assert/strict";
import type { Page, Browser } from "playwright";
import type { PrismaClient } from "../src/generated/prisma";
import { SignJWT } from "jose";

export async function verifyRisorseUi({ page, browser, db, origin, secret }: { page: Page; browser: Browser; db: PrismaClient; origin: string; secret: string }) {
  await page.setViewportSize({ width: 390, height: 844 });
  const ready = () => page.waitForLoadState("networkidle");
  await page.goto(`${origin}/risorse`); await ready();
  await page.getByRole("link", { name: "Gestisci anagrafica operai →", exact: true }).click();
  await page.waitForURL(`${origin}/risorse/operai`); await ready();
  await page.getByText("Aggiungi operaio / dipendente", { exact: true }).click();
  const add = page.locator("#nuovo");
  await add.getByLabel("Nome", { exact: true }).fill("Fabio");
  await add.getByLabel("Cognome", { exact: true }).fill("Greco");
  await add.getByLabel("Qualifica", { exact: true }).fill("Elettricista");
  await add.getByRole("button", { name: "+ Aggiungi operaio", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Operaio aggiunto" }).waitFor();
  const worker = await db.operaio.findFirstOrThrow({ where: { nome: "Fabio", cognome: "Greco" } });
  await page.getByRole("navigation", { name: "Sezioni risorse" }).getByRole("link", { name: "Squadre", exact: true }).click();
  await page.getByRole("link", { name: "Crea squadra", exact: true }).click(); await ready();
  await page.getByLabel("Nome squadra", { exact: true }).fill("Squadra collaudo Nord");
  await page.getByRole("checkbox", { name: /Greco Fabio/ }).check();
  await page.getByRole("button", { name: "Salva squadra", exact: true }).click();
  await page.waitForURL(/\/risorse\/squadre\/(?!nuova)[^/]+$/); await ready();
  const team = await db.squadra.findUniqueOrThrow({ where: { nome: "Squadra collaudo Nord" } });
  assert.equal((await db.operaio.findUniqueOrThrow({ where: { id: worker.id } })).squadra, team.nome);
  const client = await db.anagrafica.create({ data: { ragioneSociale: "Cliente collaudo Risorse", isCliente: true } });
  const job = await db.commessa.create({ data: { numero: "RS9001", anno: 2026, progressivo: 39001, stato: "IN_ESECUZIONE", clienteId: client.id, indirizzoCantiere: "Località Colle Alto · Belluno", milestone: { create: [{ titolo: "Sopralluogo breve", ordine: 0, durataGiorni: 1, stato: "COMPLETATA" }, { titolo: "Lavorazione lunga", ordine: 1, durataGiorni: 9 }] } } });
  await page.goto(`${origin}/progetti/${job.id}?tab=squadra`); await ready();
  const assign = page.locator("form").filter({ has: page.getByRole("heading", { name: "Assegna una squadra completa", exact: true }) });
  await assign.getByRole("combobox", { name: "Squadra", exact: true }).selectOption(team.id);
  await assign.getByRole("button", { name: "Assegna squadra al cantiere", exact: true }).click();
  await assign.getByRole("status").filter({ hasText: "1 componenti assegnati" }).waitFor();
  await page.getByText("Modifica assegnazione", { exact: true }).click();
  const local = page.locator("details").filter({ has: page.getByText("Modifica assegnazione", { exact: true }) });
  await local.getByRole("combobox", { name: "Ruolo in cantiere", exact: true }).selectOption({ label: "Capo squadra" });
  await local.getByLabel("Note assegnazione", { exact: true }).fill("Ingresso dal cancello nord");
  await local.getByRole("button", { name: "Salva assegnazione", exact: true }).click();
  await local.getByRole("status").filter({ hasText: "Assegnazione aggiornata" }).waitFor();
  await page.goto(`${origin}/risorse`); await ready();
  const row = page.locator("article").filter({ hasText: "Fabio Greco" });
  assert.match(await row.innerText(), /RS9001 · Cliente collaudo Risorse/);
  assert.match(await row.innerText(), /Colle Alto · Belluno/);
  for (const path of [`/commesse/${job.id}`, `/progetti/${job.id}`, `/progetti/${job.id}/sal`, `/stampa/progetti/${job.id}`]) {
    await page.goto(`${origin}${path}`); await ready();
    assert.match(await page.locator("main").innerText(), /10%/);
  }
  const pm = await db.user.create({ data: { email: "risorse-pm@example.test", nome: "PM", cognome: "Riservato", ruolo: "PROJECT_MANAGER", passwordHash: "unused", guidaVista: "*" } });
  const token = await new SignJWT({ userId: pm.id, ruolo: pm.ruolo, nome: pm.nome, sessionVersion: 0 }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "elettra_session", value: token, url: origin }]);
  const hiddenPage = await ctx.newPage();
  await hiddenPage.goto(`${origin}/risorse`); await hiddenPage.waitForLoadState("networkidle");
  const hiddenRow = await hiddenPage.locator("article").filter({ hasText: "Fabio Greco" }).innerText();
  assert.match(hiddenRow, /Assegnato a un altro cantiere/);
  assert.doesNotMatch(hiddenRow, /RS9001|Cliente collaudo Risorse|Colle Alto|Belluno/);
  await ctx.close();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/risorse", "/risorse/operai", "/risorse/squadre", `/risorse/squadre/${team.id}`, `/progetti/${job.id}?tab=squadra`, `/progetti/${job.id}/sal`]) {
      await page.goto(`${origin}${path}`); await ready();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow ${width}: ${path}`);
    }
    await page.goto(`${origin}/?periodo=30`); await ready();
    const period = page.getByRole("navigation", { name: "Periodo consuntivi", exact: true });
    await period.scrollIntoViewIfNeeded();
    for (const [name, value] of [["90 giorni", "90"], ["Tutto lo storico", "tutti"], ["30 giorni", "30"]]) {
      const y = await page.evaluate(() => window.scrollY);
      await period.getByRole("link", { name, exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("periodo") === value); await ready();
      assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - y) < 40, `Scroll dashboard ${width}: ${name}`);
    }
  }
  await page.goto(`${origin}/progetti/operai?q=Greco`);
  await page.waitForURL(`${origin}/risorse/operai?q=Greco`);
  await page.setViewportSize({ width: 1440, height: 900 }); await ready();
  assert.equal(await page.locator('aside a[aria-current="page"]').innerText(), "Risorse e squadre");
  console.log("PASS: personale → squadra → assegnazione → modifica locale; SAL coerente; privacy PM; redirect e scroll dashboard; 18 viste responsive");
}
