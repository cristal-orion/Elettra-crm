import assert from "node:assert/strict";
import type { Locator } from "playwright";

// Clic reale sulle freccette native di Chromium: non simula un onChange.
export async function clickNumberArrow(input: Locator, direction: "up" | "down") {
  await input.hover();
  const dimensions = await input.evaluate((e) => {
    const css = getComputedStyle(e);
    return { width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height, paddingRight: parseFloat(css.paddingRight), appearance: css.appearance };
  });
  assert.notEqual(dimensions.appearance, "textfield", "Le freccette native devono rimanere visibili");
  await input.click({ position: { x: dimensions.width - dimensions.paddingRight - 7, y: dimensions.height / 2 + (direction === "up" ? -4 : 4) } });
}
