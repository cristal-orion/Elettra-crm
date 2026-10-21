import assert from "node:assert/strict";
import type { Browser, BrowserContext, Page } from "playwright";
import type { PrismaClient } from "../src/generated/prisma";

export async function verifyCommercialeUi({ page, context, browser, db, origin, readerToken }: {
  page: Page; context: BrowserContext; browser: Browser; db: PrismaClient; origin: string; readerToken: string;
}) {
  await page.goto(`${origin}/anagrafiche/nuova?tipo=prospect`);
  await page.waitForLoadState("networkidle");
  assert.equal(await page.getByLabel("Potenziale cliente", { exact: true }).isChecked(), true);
  await page.getByLabel("Ragione sociale *", { exact: true }).fill("Nuovo Prospect Commerciale");
  await page.getByRole("button", { name: "Crea anagrafica", exact: true }).click();
  await page.getByRole("heading", { name: "Nuovo Prospect Commerciale", exact: true }).waitFor();
  const customer = await db.anagrafica.findFirstOrThrow({ where: { ragioneSociale: "Nuovo Prospect Commerciale" } });
  assert.equal(customer.isProspect, true); assert.equal(customer.isCliente, false); assert.equal(customer.codiceCliente, null);
  await page.getByRole("link", { name: "Nuova trattativa", exact: true }).click();
  await page.getByLabel("Titolo *", { exact: true }).fill("Commerciale UI — impianto");
  await page.getByLabel("Tipologia", { exact: true }).selectOption("C");
  await page.getByLabel("Valore previsto (€)", { exact: true }).fill("1234.56");
  await page.getByRole("button", { name: "Crea trattativa", exact: true }).click();
  await page.getByRole("heading", { name: "Commerciale UI — impianto", exact: true }).waitFor();
  const opp = await db.opportunita.findFirstOrThrow({ where: { titolo: "Commerciale UI — impianto" } });
  assert.equal(opp.anagraficaId, customer.id); assert.equal(opp.tipologia, "C");
  const path = `/commerciale/${opp.id}`;

  const interaction = page.getByRole("form", { name: "Registra interazione", exact: true });
  await interaction.getByLabel("Contenuto *", { exact: true }).fill("Sopralluogo concordato");
  await interaction.getByLabel("Pianifica il prossimo contatto", { exact: true }).check();
  await interaction.getByLabel("Prossimo passo *", { exact: true }).fill("Richiamare il prospect commerciale");
  await interaction.getByRole("button", { name: "Registra contatto", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Contatto registrato." }).waitFor();
  await page.getByRole("region", { name: "Prossimi contatti", exact: true }).getByRole("link", { name: "Richiamare il prospect commerciale", exact: true }).waitFor();
  assert.equal(await db.attivita.count({ where: { opportunitaId: opp.id } }), 1);
  await page.locator('input[type="file"]').setInputFiles({ name: "accordo-commerciale.txt", mimeType: "text/plain", buffer: Buffer.from("Accordo cliente di prova") });
  await page.getByRole("button", { name: "Carica documenti", exact: true }).click();
  await page.getByRole("link", { name: "accordo-commerciale.txt", exact: true }).waitFor();
  const doc = await db.documento.findFirstOrThrow({ where: { opportunitaId: opp.id } });
  assert.equal(await (await context.request.get(`${origin}/documenti/${doc.id}`)).text(), "Accordo cliente di prova");

  await page.goto(`${origin}/commerciale?q=commerciale`);
  await page.waitForLoadState("networkidle");
  const lead = page.getByRole("region", { name: "Lead", exact: true });
  await lead.getByText("Sposta fase", { exact: true }).click();
  await lead.getByLabel("Fase", { exact: true }).selectOption("contattato");
  await lead.getByRole("button", { name: "Aggiorna fase", exact: true }).click();
  await page.getByRole("region", { name: "Contattato", exact: true }).getByRole("link", { name: opp.titolo, exact: true }).waitFor();
  await page.getByRole("link", { name: "Elenco", exact: true }).click();
  await page.getByRole("table").getByRole("link", { name: opp.titolo, exact: true }).waitFor();
  const listUrl = page.url();
  await page.getByRole("table").getByRole("link", { name: opp.titolo, exact: true }).click();
  await page.getByRole("button", { name: "← Indietro", exact: true }).click();
  await page.waitForURL(listUrl);
  await page.goto(`${origin}${path}`);
  const phase = page.getByRole("form", { name: "Cambia fase", exact: true });
  await phase.getByLabel("Fase", { exact: true }).selectOption("persa");
  await phase.getByLabel("Motivo della perdita *", { exact: true }).fill("Budget da rivalutare");
  await phase.getByRole("button", { name: "Aggiorna fase", exact: true }).click();
  await page.getByText("Motivo della perdita: Budget da rivalutare", { exact: true }).waitFor();
  await phase.getByLabel("Fase", { exact: true }).selectOption("qualificato");
  await phase.getByRole("button", { name: "Aggiorna fase", exact: true }).click();
  await page.getByRole("heading", { name: "Conferma incarico", exact: true }).waitFor();

  await page.getByRole("link", { name: "Modifica trattativa", exact: true }).click();
  const stale = await context.newPage();
  await stale.goto(`${origin}${path}/modifica`);
  await page.getByLabel("Origine", { exact: true }).fill("Passaparola UI");
  await page.getByRole("button", { name: "Salva trattativa", exact: true }).click();
  await page.waitForURL(`${origin}${path}?esito=salvata`);
  await stale.getByLabel("Origine", { exact: true }).fill("Bozza da preservare");
  await stale.getByRole("button", { name: "Salva trattativa", exact: true }).click();
  await stale.getByRole("alert").filter({ hasText: "La trattativa è stata modificata" }).waitFor();
  assert.equal(await stale.getByLabel("Origine", { exact: true }).inputValue(), "Bozza da preservare");
  await stale.close();

  await page.screenshot({ path: "/tmp/opencode/commerciale-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [path, "/commerciale", "/commerciale?vista=elenco", `${path}/modifica`, "/commerciale/fasi"]) {
    await page.goto(`${origin}${route}`); await page.waitForLoadState("networkidle");
    if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) {
      await page.screenshot({ path: "/tmp/opencode/commerciale-overflow.png", fullPage: true });
      const overflow = await page.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 10).map((e) => ({ tag: e.tagName, css: e.className, width: e.getBoundingClientRect().width, text: e.textContent?.slice(0, 80) })));
      assert.fail(`Overflow Commerciale ${route}: ${JSON.stringify(overflow)}`);
    }
  }
  await page.goto(`${origin}${path}`);
  await page.screenshot({ path: "/tmp/opencode/commerciale-mobile.png", fullPage: true });
  const convert = page.getByRole("form", { name: "Conferma incarico", exact: true });
  await convert.getByLabel("Riferimento conferma *", { exact: true }).fill("Email del cliente di prova");
  await convert.getByRole("checkbox").check();
  const requestPromise = page.waitForRequest((r) => r.method() === "POST" && Boolean(r.headers()["next-action"]));
  await convert.getByRole("button", { name: "Conferma incarico e crea commessa", exact: true }).click();
  const sent = await requestPromise;
  await page.waitForURL(/\/commesse\/[^/]+$/);
  const job = await db.commessa.findUniqueOrThrow({ where: { opportunitaId: opp.id } });
  assert.equal(job.importoOrdine, null); assert.equal(job.clienteId, customer.id);
  await page.getByRole("link", { name: "accordo-commerciale.txt", exact: true }).waitFor();
  await page.getByRole("link", { name: /^Apri trattativa di origine/ }).click();
  await page.getByRole("link", { name: `Incarico confermato · Apri commessa ${job.numero} →`, exact: true }).waitFor();
  assert.equal(await db.commessa.count({ where: { opportunitaId: opp.id } }), 1);

  const readerContext = await browser.newContext();
  await readerContext.addCookies([{ name: "elettra_session", value: readerToken, url: origin }]);
  const reader = await readerContext.newPage();
  await reader.goto(`${origin}${path}`);
  assert.equal(await reader.getByRole("button", { name: "Registra contatto", exact: true }).count(), 0);
  const denied = await readerContext.request.post(sent.url(), { headers: { "next-action": sent.headers()["next-action"], "content-type": sent.headers()["content-type"], origin }, data: sent.postDataBuffer()! });
  assert.match(await denied.text(), /Non hai i permessi/);
  await readerContext.close();
  await page.setViewportSize({ width: 1280, height: 800 });
  console.log("PASS: Commerciale — prospect, Kanban/elenco, contatti, follow-up, allegati, perdita/riapertura, conflitti, conversione, ruoli e mobile");
}
