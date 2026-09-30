import { setTimeout } from "node:timers/promises";
import { runDueSchedules } from "../src/lib/ai/scheduler";
import { prisma } from "../src/lib/prisma";

const controller = new AbortController();
process.on("SIGTERM", () => controller.abort());
process.on("SIGINT", () => controller.abort());
async function main() {
  while (!controller.signal.aborted) {
    try { console.log(JSON.stringify({ event: "scheduled_checks", result: await runDueSchedules() })); }
    catch { console.error(JSON.stringify({ event: "scheduled_checks_failed" })); }
    try { await setTimeout(300_000, undefined, { signal: controller.signal }); }
    catch { break; }
  }
}
main().finally(() => prisma.$disconnect());
