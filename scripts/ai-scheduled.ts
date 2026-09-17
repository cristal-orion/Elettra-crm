import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { runDueSchedules } = await import("../src/lib/ai/scheduler");
  const { prisma } = await import("../src/lib/prisma");
  try { console.log(JSON.stringify(await runDueSchedules())); }
  finally { await prisma.$disconnect(); }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : "Errore controlli AI"); process.exitCode = 1; });
