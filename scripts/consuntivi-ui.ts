import assert from "node:assert/strict";
import type { Browser, BrowserContext, Page } from "playwright";
import type { PrismaClient } from "../src/generated/prisma";
import { tariffarioValues } from "../src/lib/consuntivi";
import { clickNumberArrow } from "./number-input-ui";

export async function verifyConsuntiviUi({ page, context, browser, db, origin, clienteId, readerToken }: {
  page: Page; context: BrowserContext; browser: Browser; db: PrismaClient; origin: string; clienteId: string; readerToken: string;
}) {
  const tariffarioPath = `/anagrafiche/${clienteId}/tariffario`;
  const consuntivoPath = "/commesse/ui-project/consuntivo";
  await page.goto(`${origin}/anagrafiche/${clienteId}`);
  await page.getByRole("link", { name: /^Tariffario cliente →/ }).click();
  await page.getByRole("button", { name: "+ Aggiungi mansione", exact: true }).click();
  await page.getByLabel("Mansione", { exact: true }).fill("Elettricista");
  await page.getByLabel("Ordinaria (€/h)", { exact: true }).fill("35");
  await page.getByLabel("Straordinaria feriale (€/h)", { exact: true }).fill("45");
  await page.getByLabel("Straordinaria festiva (€/h)", { exact: true }).fill("60");
  await page.getByRole("button", { name: "+ Aggiungi materiale", exact: true }).click();
  await page.getByRole("combobox", { name: "Materiale", exact: true }).click();
  await page.getByRole("option", { name: "CB-123 · Càvo elettrico", exact: true }).click();
  await page.getByLabel("Ricarico (%)", { exact: true }).fill("20");
  const ratePost = page.waitForRequest((r) => r.method() === "POST" && Boolean(r.headers()["next-action"]));
  await page.getByRole("button", { name: "Salva tariffario", exact: true }).click();
  const sentRate = await ratePost;
  await page.getByRole("status").filter({ hasText: "Tariffario salvato" }).waitFor();
  await page.getByRole("heading", { name: "Storico modifiche (1)", exact: true }).waitFor();

  await page.goto(`${origin}/commesse/ui-project`);
  await page.getByRole("link", { name: /^Consuntivo ore e materiali →/ }).click();
  await page.getByRole("button", { name: "+ Aggiungi ore", exact: true }).click();
  const hours = page.getByLabel("Ore effettive", { exact: true });
  await clickNumberArrow(hours, "up");
  assert.equal(await hours.inputValue(), "1.5000");
  await clickNumberArrow(hours, "down");
  assert.equal(await hours.inputValue(), "1.0000");
  await hours.press("ArrowDown");
  assert.equal(await hours.inputValue(), "0.5000");
  await hours.press("ArrowUp");
  assert.equal(await hours.inputValue(), "1.0000");
  await hours.fill("1.0012");
  await clickNumberArrow(hours, "up");
  assert.equal(await hours.inputValue(), "1.5012", "Il passo non deve eliminare la precisione delle ore manuali/storiche");
  await hours.fill("0.2");
  await clickNumberArrow(hours, "down");
  assert.equal(await hours.inputValue(), "0.0000");
  assert.equal(await page.getByLabel("Tariffa applicata (€/h)", { exact: true }).inputValue(), "35.0000");
  await page.getByLabel("Fascia oraria", { exact: true }).selectOption("straordinariaFestiva");
  assert.equal(await page.getByLabel("Tariffa applicata (€/h)", { exact: true }).inputValue(), "60.0000");
  await page.getByLabel("Fascia oraria", { exact: true }).selectOption("straordinariaFeriale");
  assert.equal(await page.getByLabel("Tariffa applicata (€/h)", { exact: true }).inputValue(), "45.0000");
  await page.getByLabel("Ore effettive", { exact: true }).fill("2.5");
  await page.getByLabel("Tariffa applicata (€/h)", { exact: true }).fill("40");
  await page.getByRole("button", { name: "+ Aggiungi materiale", exact: true }).click();
  assert.equal(await page.getByLabel("Ricarico applicato (%)", { exact: true }).inputValue(), "20.0000");
  await page.getByLabel("Costo base unitario (€)", { exact: true }).fill("10");
  await page.getByLabel(/^Quantità/).fill("3");
  await page.getByLabel("Ricarico applicato (%)", { exact: true }).fill("25");
  const sheetPost = page.waitForRequest((r) => r.method() === "POST" && Boolean(r.headers()["next-action"]));
  await page.getByRole("button", { name: "Salva consuntivo", exact: true }).click();
  const sentSheet = await sheetPost;
  await page.getByRole("heading", { name: "Totali salvati · versione 1", exact: true }).waitFor();
  const original = await db.consuntivo.findUniqueOrThrow({ where: { commessaId: "ui-project" } });
  await page.reload();
  await page.getByRole("button", { name: "Salva consuntivo", exact: true }).click({ trial: true });
  await hours.press("ArrowUp");
  assert.equal(await hours.inputValue(), "3.0000", "Passo di mezz'ora anche sulle righe già salvate");
  await hours.press("ArrowDown");
  assert.equal(await hours.inputValue(), "2.5000");
  assert.equal(original.totale.toFixed(2), "137.50");
  await page.getByRole("region", { name: "Totali salvati", exact: true }).getByText("137,50 €", { exact: true }).waitFor();

  const stale = await context.newPage();
  await stale.goto(`${origin}${consuntivoPath}`);
  await page.getByLabel("Tariffa applicata (€/h)", { exact: true }).fill("42");
  await page.getByRole("button", { name: "Salva consuntivo", exact: true }).click();
  await page.getByRole("heading", { name: "Totali salvati · versione 2", exact: true }).waitFor();
  await page.getByText(/^Versione 2 ·/).click();
  const changes = page.getByRole("region", { name: "Storico modifiche", exact: true });
  const tariffaChange = changes.getByRole("row").filter({ hasText: "Elettricista · Tariffa €/h" });
  await tariffaChange.getByRole("cell", { name: "40.0000", exact: true }).waitFor();
  await tariffaChange.getByRole("cell", { name: "42.0000", exact: true }).waitFor();
  await stale.getByLabel("Note del consuntivo", { exact: true }).fill("Bozza concorrente da conservare");
  await stale.getByRole("button", { name: "Salva consuntivo", exact: true }).click();
  await stale.getByRole("alert").filter({ hasText: "I dati sono stati modificati" }).waitFor();
  assert.equal(await stale.getByLabel("Note del consuntivo", { exact: true }).inputValue(), "Bozza concorrente da conservare");
  assert.equal(await db.modificaEconomica.count({ where: { entitaId: original.id } }), 2);
  await stale.close();
  const rate = tariffarioValues(await db.tariffarioCliente.findUniqueOrThrow({ where: { clienteId } }));
  assert.equal(rate.versione, 1); assert.equal(rate.manodopera[0].straordinariaFeriale, "45.0000"); assert.equal(rate.materiali[0].ricarico, "20.0000");

  const print = await context.newPage();
  await print.goto(`${origin}/stampa/consuntivi/ui-project`);
  const printed = print.getByRole("article", { name: "Consuntivo ore e materiali", exact: true });
  await printed.getByRole("cell", { name: /Elettricista\s*Straordinaria feriale/ }).waitFor();
  await printed.getByText("142,50 €", { exact: true }).waitFor();
  assert.doesNotMatch(await printed.innerText(), /Costo base|Ricarico|Storico modifiche/);
  await print.close();

  const readContext = await browser.newContext();
  await readContext.addCookies([{ name: "elettra_session", value: readerToken, url: origin }]);
  const readPage = await readContext.newPage();
  for (const [path, button, sent] of [[tariffarioPath, "Salva tariffario", sentRate], [consuntivoPath, "Salva consuntivo", sentSheet]] as const) {
    await readPage.goto(`${origin}${path}`);
    assert.equal(await readPage.getByRole("button", { name: button, exact: true }).count(), 0);
    for (const field of await readPage.getByRole("spinbutton").all()) assert.equal(await field.isDisabled(), true);
    const denied = await readContext.request.post(sent.url(), { headers: { "next-action": sent.headers()["next-action"], "content-type": sent.headers()["content-type"], origin }, data: sent.postDataBuffer()! });
    assert.match(await denied.text(), /Non hai i permessi/);
  }
  assert.equal(await db.modificaEconomica.count({ where: { entitaId: original.id } }), 2);
  await readContext.close();

  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [tariffarioPath, consuntivoPath]) {
    await page.goto(`${origin}${path}`);
    if (path === consuntivoPath) {
      await page.getByRole("button", { name: "Salva consuntivo", exact: true }).click({ trial: true });
      await hours.press("ArrowUp");
      assert.equal(await hours.inputValue(), "3.0000");
      await hours.press("ArrowDown");
      assert.equal(await hours.inputValue(), "2.5000");
    }
    await page.getByText(/^Versione 1 ·/).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Overflow ${path}`);
    for (const button of await page.locator("form").getByRole("button").all()) assert.ok((await button.boundingBox())!.height >= 44);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  console.log("PASS: Tariffari/consuntivi — default, fasce, override locali, audit, conflitti, stampa, permessi server e mobile");
}
