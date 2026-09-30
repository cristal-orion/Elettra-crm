import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../src/lib/prisma";
import { passwordError } from "../src/lib/password";

async function main() {
  const email = z.email().parse(process.env.ADMIN_EMAIL?.trim().toLowerCase());
  const password = process.env.ADMIN_PASSWORD ?? "";
  const error = passwordError(password);
  if (error) throw new Error(error);
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    // Lock transazionale: due bootstrap simultanei non creano due amministratori.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260930)`;
    if (await tx.user.count()) throw new Error("Sono già presenti utenti: bootstrap rifiutato.");
    await tx.user.create({ data: { email, passwordHash, nome: process.env.ADMIN_NOME?.trim() || "Admin", cognome: process.env.ADMIN_COGNOME?.trim() || "Elettra", ruolo: "SUPER_ADMIN" } });
  });
  console.log("Amministratore iniziale creato. Nessun dato demo caricato.");
}
main().catch(() => { console.error("Bootstrap fallito: verificare email, password (12 caratteri / massimo 72 byte) e assenza di utenti."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
